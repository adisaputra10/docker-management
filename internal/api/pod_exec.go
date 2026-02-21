package api

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	ssh "golang.org/x/crypto/ssh"
)

// PodExec opens a WebSocket-bridged interactive shell inside a pod via SSH → k0s kubectl exec
// GET /api/k0s/clusters/{id}/k8s/pods/{name}/exec?namespace=xxx&container=xxx
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

	// Get cluster SSH credentials
	var ipAddress, username string
	var password, authMethod, sshKey sql.NullString
	err = database.DB.QueryRow(
		"SELECT ip_address, username, COALESCE(password,''), COALESCE(auth_method,'password'), COALESCE(ssh_key,'') FROM k0s_clusters WHERE id = ?",
		clusterID,
	).Scan(&ipAddress, &username, &password, &authMethod, &sshKey)
	if err != nil {
		wsSend(fmt.Sprintf("\r\n\x1b[31mError: cluster not found: %v\x1b[0m\r\n", err))
		return
	}

	auth := authMethod.String
	if auth == "" {
		auth = "password"
	}
	credential := password.String
	if auth == "ssh-key" {
		credential = sshKey.String
	}

	// Connect to controller via SSH
	sshClient, err := connectSSH(ipAddress, username, credential, auth)
	if err != nil {
		wsSend(fmt.Sprintf("\r\n\x1b[31mSSH connect failed: %v\x1b[0m\r\n", err))
		return
	}
	defer sshClient.Close()

	// Create SSH session with PTY
	session, err := sshClient.NewSession()
	if err != nil {
		wsSend(fmt.Sprintf("\r\n\x1b[31mSSH session failed: %v\x1b[0m\r\n", err))
		return
	}
	defer session.Close()

	// Request PTY
	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm-256color", 40, 200, modes); err != nil {
		wsSend(fmt.Sprintf("\r\n\x1b[31mPTY request failed: %v\x1b[0m\r\n", err))
		return
	}

	// Pipe stdin/stdout
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

	// Build exec command — exec directly into chosen shell (no /bin/sh wrapper)
	containerFlag := ""
	if container != "" {
		containerFlag = " -c " + container
	}
	execCmd := fmt.Sprintf("sudo k0s kubectl exec -it %s -n %s%s -- %s", podName, namespace, containerFlag, shell)

	log.Printf("[PodExec] cluster=%s pod=%s ns=%s shell=%s", clusterID, podName, namespace, shell)
	wsSend(fmt.Sprintf("\x1b[32mConnecting to pod %s/%s (shell: %s)...\x1b[0m\r\n", namespace, podName, shell))

	if err := session.Start(execCmd); err != nil {
		wsSend(fmt.Sprintf("\r\n\x1b[31mExec failed: %v\x1b[0m\r\n", err))
		return
	}

	errChan := make(chan error, 2)

	// stdout → WebSocket
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

	// WebSocket → stdin
	go func() {
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				errChan <- err
				return
			}
			// Handle resize messages (JSON: {"type":"resize","cols":N,"rows":N})
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
	log.Printf("[PodExec] session ended for pod=%s ns=%s", podName, namespace)
}
