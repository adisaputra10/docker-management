package api

import (
	"crypto/tls"
	"database/sql"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	ssh "golang.org/x/crypto/ssh"
)

// PodExec opens a WebSocket-bridged interactive shell inside a pod.
// For imported clusters (stored kubeconfig) it uses local kubectl exec.
// For k0s provisioned clusters it uses SSH → k0s kubectl exec.
// GET /api/k0s/clusters/{id}/k8s/pods/{name}/exec?namespace=xxx&container=xxx&shell=xxx
func PodExec(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	podName := vars["name"]
	namespace := r.URL.Query().Get("namespace")
	if namespace == "" {
		namespace = "default"
	}
	container := r.URL.Query().Get("container")
	shell := r.URL.Query().Get("shell")
	if shell == "" {
		shell = "sh"
	}

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[PodExec] WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	wsSend := func(msg string) {
		conn.WriteMessage(websocket.TextMessage, []byte(msg))
	}

	// Get cluster credentials
	var ipAddress, username string
	var password, authMethod, sshKey, storedKC sql.NullString
	err = database.DB.QueryRow(
		"SELECT ip_address, username, COALESCE(password,''), COALESCE(auth_method,'password'), COALESCE(ssh_key,''), COALESCE(kubeconfig,'') FROM k0s_clusters WHERE id = ?",
		clusterID,
	).Scan(&ipAddress, &username, &password, &authMethod, &sshKey, &storedKC)
	if err != nil {
		wsSend(fmt.Sprintf("\r\n\x1b[31mError: cluster not found: %v\x1b[0m\r\n", err))
		return
	}

	// Imported cluster with a kubeconfig → run kubectl exec locally
	if storedKC.Valid && strings.TrimSpace(storedKC.String) != "" {
		podExecViaKubeconfig(storedKC.String, podName, namespace, container, shell, conn)
		return
	}

	// k0s provisioned cluster → SSH into controller node and run k0s kubectl exec
	auth := authMethod.String
	if auth == "" {
		auth = "password"
	}
	credential := password.String
	if auth == "ssh-key" {
		credential = sshKey.String
	}

	sshClient, err := connectSSH(ipAddress, username, credential, auth)
	if err != nil {
		wsSend(fmt.Sprintf("\r\n\x1b[31mSSH connect failed: %v\x1b[0m\r\n", err))
		return
	}
	defer sshClient.Close()

	session, err := sshClient.NewSession()
	if err != nil {
		wsSend(fmt.Sprintf("\r\n\x1b[31mSSH session failed: %v\x1b[0m\r\n", err))
		return
	}
	defer session.Close()

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm-256color", 40, 200, modes); err != nil {
		wsSend(fmt.Sprintf("\r\n\x1b[31mPTY request failed: %v\x1b[0m\r\n", err))
		return
	}

	stdinPipe, err := session.StdinPipe()
	if err != nil {
		wsSend(fmt.Sprintf("\r\n\x1b[31mStdin pipe failed: %v\x1b[0m\r\n", err))
		return
	}
	stdoutPipe, err := session.StdoutPipe()
	if err != nil {
		wsSend(fmt.Sprintf("\r\n\x1b[31mStdout pipe failed: %v\x1b[0m\r\n", err))
		return
	}

	containerFlag := ""
	if container != "" {
		containerFlag = " -c " + container
	}
	execCmd := fmt.Sprintf("sudo k0s kubectl exec -it %s -n %s%s -- %s", podName, namespace, containerFlag, shell)

	log.Printf("[PodExec] SSH cluster=%s pod=%s ns=%s shell=%s", clusterID, podName, namespace, shell)
	wsSend(fmt.Sprintf("\x1b[32mConnecting to pod %s/%s (shell: %s)...\x1b[0m\r\n", namespace, podName, shell))

	if err := session.Start(execCmd); err != nil {
		wsSend(fmt.Sprintf("\r\n\x1b[31mExec failed: %v\x1b[0m\r\n", err))
		return
	}

	errChan := make(chan error, 2)

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stdoutPipe.Read(buf)
			if n > 0 {
				conn.WriteMessage(websocket.TextMessage, buf[:n])
			}
			if err != nil {
				errChan <- err
				return
			}
		}
	}()

	go func() {
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				errChan <- err
				return
			}
			if len(msg) > 0 && msg[0] == '{' {
				var cols, rows uint32
				n, _ := fmt.Sscanf(string(msg), `{"type":"resize","cols":%d,"rows":%d}`, &cols, &rows)
				if n == 2 {
					session.WindowChange(int(rows), int(cols))
					continue
				}
			}
			if _, err := stdinPipe.Write(msg); err != nil {
				errChan <- err
				return
			}
		}
	}()

	<-errChan
	session.Close()
	log.Printf("[PodExec] SSH session ended for pod=%s ns=%s", podName, namespace)
}

// podExecViaKubeconfig handles kubectl exec for imported/external clusters that
// have a stored kubeconfig. Runs kubectl as a local subprocess and bridges
// its stdin/stdout/stderr to the WebSocket.
// podExecViaKubeconfig implements pod exec for imported clusters using the
// Kubernetes WebSocket exec API (v5.channel.k8s.io protocol).
// This requests tty=true from the API server so the shell inside the pod
// gets a real PTY — enabling prompts, echo, and full interactive behaviour —
// without needing any PTY on the management server side.
func podExecViaKubeconfig(kubeconfigContent, podName, namespace, container, shell string, conn *websocket.Conn) {
	wsSendStr := func(msg string) {
		conn.WriteMessage(websocket.TextMessage, []byte(msg))
	}

	// Write kubeconfig to a temp file so kubectl jsonpath can read it.
	tmpKC, err := os.CreateTemp("", "kc-exec-*.yaml")
	if err != nil {
		wsSendStr(fmt.Sprintf("\r\n\x1b[31mError: %v\x1b[0m\r\n", err))
		return
	}
	defer os.Remove(tmpKC.Name())
	tmpKC.WriteString(kubeconfigContent) //nolint:errcheck
	tmpKC.Close()
	kcPath := tmpKC.Name()

	// Extract API server URL and credentials from kubeconfig.
	serverURL, err := kubectlRun(kcPath, "config", "view", "--raw", "-o", "jsonpath={.clusters[0].cluster.server}")
	if err != nil || strings.TrimSpace(serverURL) == "" {
		wsSendStr("\r\n\x1b[31mError: cannot read API server URL from kubeconfig\x1b[0m\r\n")
		return
	}
	clientCertB64, _ := kubectlRun(kcPath, "config", "view", "--raw", "-o", "jsonpath={.users[0].user.client-certificate-data}")
	clientKeyB64, _ := kubectlRun(kcPath, "config", "view", "--raw", "-o", "jsonpath={.users[0].user.client-key-data}")
	token, _ := kubectlRun(kcPath, "config", "view", "--raw", "-o", "jsonpath={.users[0].user.token}")

	// Build TLS config — skip server cert verification (matches kubectl --insecure-skip-tls-verify).
	tlsCfg := &tls.Config{InsecureSkipVerify: true} //nolint:gosec
	if strings.TrimSpace(clientCertB64) != "" && strings.TrimSpace(clientKeyB64) != "" {
		certPEM, err1 := base64.StdEncoding.DecodeString(strings.TrimSpace(clientCertB64))
		keyPEM, err2 := base64.StdEncoding.DecodeString(strings.TrimSpace(clientKeyB64))
		if err1 == nil && err2 == nil {
			if cert, err := tls.X509KeyPair(certPEM, keyPEM); err == nil {
				tlsCfg.Certificates = []tls.Certificate{cert}
			}
		}
	}

	// Build the exec WebSocket URL.
	// wss://<server>/api/v1/namespaces/<ns>/pods/<name>/exec?stdin=true&stdout=true&stderr=true&tty=true&command=<shell>
	wsServer := strings.NewReplacer("https://", "wss://", "http://", "ws://").Replace(strings.TrimSpace(serverURL))
	q := url.Values{}
	q.Set("stdin", "true")
	q.Set("stdout", "true")
	q.Set("stderr", "true")
	q.Set("tty", "true")
	q.Add("command", shell)
	if container != "" {
		q.Set("container", container)
	}
	execURL := fmt.Sprintf("%s/api/v1/namespaces/%s/pods/%s/exec?%s",
		wsServer, url.PathEscape(namespace), url.PathEscape(podName), q.Encode())

	// Dial the Kubernetes exec WebSocket endpoint.
	dialer := websocket.Dialer{
		TLSClientConfig: tlsCfg,
		Subprotocols:    []string{"v5.channel.k8s.io"},
	}
	headers := http.Header{}
	if t := strings.TrimSpace(token); t != "" {
		headers.Set("Authorization", "Bearer "+t)
	}

	log.Printf("[PodExec] dialing k8s exec: %s", execURL)
	k8sWs, resp, err := dialer.Dial(execURL, headers)
	if err != nil {
		if resp != nil {
			defer resp.Body.Close()
			body, _ := io.ReadAll(resp.Body)
			wsSendStr(fmt.Sprintf("\r\n\x1b[31mK8s exec error (HTTP %d): %s\x1b[0m\r\n", resp.StatusCode, string(body)))
		} else {
			wsSendStr(fmt.Sprintf("\r\n\x1b[31mK8s exec connect error: %v\x1b[0m\r\n", err))
		}
		return
	}
	defer k8sWs.Close()

	log.Printf("[PodExec] k8s WebSocket exec connected: pod=%s ns=%s shell=%s", podName, namespace, shell)

	errChan := make(chan error, 2)

	// k8s API → frontend: channels 1=stdout, 2=stderr
	go func() {
		for {
			_, msg, readErr := k8sWs.ReadMessage()
			if readErr != nil {
				errChan <- readErr
				return
			}
			if len(msg) < 1 {
				continue
			}
			channel := msg[0]
			data := msg[1:]
			// channel 1 = stdout, channel 2 = stderr — forward both to xterm
			if (channel == 1 || channel == 2) && len(data) > 0 {
				if writeErr := conn.WriteMessage(websocket.TextMessage, data); writeErr != nil {
					errChan <- writeErr
					return
				}
			}
			// channel 3 = error/status JSON — ignore (session end is signalled by conn close)
		}
	}()

	// frontend → k8s API: channel 0=stdin, channel 4=resize
	go func() {
		for {
			_, msg, readErr := conn.ReadMessage()
			if readErr != nil {
				errChan <- readErr
				return
			}
			if len(msg) == 0 {
				continue
			}
			// xterm.js sends resize as JSON: {"type":"resize","cols":N,"rows":N}
			if msg[0] == '{' {
				var cols, rows uint32
				n, _ := fmt.Sscanf(string(msg), `{"type":"resize","cols":%d,"rows":%d}`, &cols, &rows)
				if n == 2 {
					resize := fmt.Sprintf(`{"Width":%d,"Height":%d}`, cols, rows)
					k8sWs.WriteMessage(websocket.BinaryMessage, append([]byte{4}, []byte(resize)...)) //nolint:errcheck
					continue
				}
			}
			// Regular keystrokes → channel 0 (stdin)
			k8sWs.WriteMessage(websocket.BinaryMessage, append([]byte{0}, msg...)) //nolint:errcheck
		}
	}()

	<-errChan
	log.Printf("[PodExec] exec session ended for pod=%s ns=%s", podName, namespace)
}

