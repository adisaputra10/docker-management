package api

import (
	"crypto/sha256"
	"crypto/tls"
	"database/sql"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"gopkg.in/yaml.v3"
)

// clusterK8sCreds holds parsed credentials from a stored admin kubeconfig.
type clusterK8sCreds struct {
	serverURL   string
	bearerToken string
	tlsConfig   *tls.Config
	kcHash      string
}

// k8sCredsCache caches parsed kubeconfig credentials keyed by cluster ID.
var k8sCredsCache sync.Map // clusterID (string) → *clusterK8sCreds

// kubeconfigFile is a minimal kubeconfig struct for YAML unmarshaling.
type kubeconfigFile struct {
	Clusters []struct {
		Name    string `yaml:"name"`
		Cluster struct {
			Server                   string `yaml:"server"`
			InsecureSkipTLSVerify    bool   `yaml:"insecure-skip-tls-verify"`
			CertificateAuthorityData string `yaml:"certificate-authority-data"`
		} `yaml:"cluster"`
	} `yaml:"clusters"`
	Users []struct {
		Name string `yaml:"name"`
		User struct {
			Token                 string `yaml:"token"`
			ClientCertificateData string `yaml:"client-certificate-data"`
			ClientKeyData         string `yaml:"client-key-data"`
		} `yaml:"user"`
	} `yaml:"users"`
	Contexts []struct {
		Name    string `yaml:"name"`
		Context struct {
			Cluster string `yaml:"cluster"`
			User    string `yaml:"user"`
		} `yaml:"context"`
	} `yaml:"contexts"`
	CurrentContext string `yaml:"current-context"`
}

// decodeB64 decodes a base64 string, stripping any whitespace/newlines that
// YAML parsers or text editors might have introduced.
func decodeB64(s string) ([]byte, error) {
	clean := strings.Map(func(r rune) rune {
		if r == '\n' || r == '\r' || r == ' ' || r == '\t' {
			return -1
		}
		return r
	}, s)
	return base64.StdEncoding.DecodeString(clean)
}

// parseKubeconfigCreds parses a kubeconfig YAML string and returns the K8s API
// credentials. Results are cached by SHA-256 of the kubeconfig content —
// a fresh parse is triggered only when the stored kubeconfig changes.
func parseKubeconfigCreds(clusterID, kcYAML string) (*clusterK8sCreds, error) {
	h := sha256.Sum256([]byte(kcYAML))
	kcHash := fmt.Sprintf("%x", h[:8])

	if cached, ok := k8sCredsCache.Load(clusterID); ok {
		c := cached.(*clusterK8sCreds)
		if c.kcHash == kcHash {
			return c, nil
		}
	}

	var kc kubeconfigFile
	if err := yaml.Unmarshal([]byte(kcYAML), &kc); err != nil {
		return nil, fmt.Errorf("parse kubeconfig YAML: %v", err)
	}

	// Resolve cluster + user from current-context.
	clusterName, userName := "", ""
	for _, ctx := range kc.Contexts {
		if ctx.Name == kc.CurrentContext {
			clusterName = ctx.Context.Cluster
			userName = ctx.Context.User
			break
		}
	}

	// Find matching cluster entry (fall back to first if context resolution failed).
	serverURL, insecureSkip, caData := "", false, ""
	for _, cl := range kc.Clusters {
		if clusterName == "" || cl.Name == clusterName {
			serverURL = cl.Cluster.Server
			insecureSkip = cl.Cluster.InsecureSkipTLSVerify
			caData = cl.Cluster.CertificateAuthorityData
			break
		}
	}
	if serverURL == "" && len(kc.Clusters) > 0 {
		serverURL = kc.Clusters[0].Cluster.Server
		insecureSkip = kc.Clusters[0].Cluster.InsecureSkipTLSVerify
		caData = kc.Clusters[0].Cluster.CertificateAuthorityData
	}
	if serverURL == "" {
		return nil, fmt.Errorf("kubeconfig has no server URL")
	}

	// Find matching user entry (fall back to first).
	token, certB64, keyB64 := "", "", ""
	for _, u := range kc.Users {
		if userName == "" || u.Name == userName {
			token = u.User.Token
			certB64 = u.User.ClientCertificateData
			keyB64 = u.User.ClientKeyData
			break
		}
	}
	if token == "" && certB64 == "" && len(kc.Users) > 0 {
		token = kc.Users[0].User.Token
		certB64 = kc.Users[0].User.ClientCertificateData
		keyB64 = kc.Users[0].User.ClientKeyData
	}

	// Build TLS config — always skip server cert verification so the proxy
	// works regardless of whether the cluster uses a self-signed CA.
	// Client certificate authentication is still presented when available.
	tlsCfg := &tls.Config{InsecureSkipVerify: true} //nolint:gosec
	_ = caData
	_ = insecureSkip
	// Load client certificate (used by k0s and most bare-metal clusters).
	if certB64 != "" && keyB64 != "" {
		certPEM, err1 := decodeB64(certB64)
		keyPEM, err2 := decodeB64(keyB64)
		if err1 != nil {
			log.Printf("[K8sProxy] cluster %s: failed to base64-decode client-certificate-data: %v", clusterID, err1)
		} else if err2 != nil {
			log.Printf("[K8sProxy] cluster %s: failed to base64-decode client-key-data: %v", clusterID, err2)
		} else {
			cert, err := tls.X509KeyPair(certPEM, keyPEM)
			if err != nil {
				log.Printf("[K8sProxy] cluster %s: failed to load client key pair: %v", clusterID, err)
			} else {
				tlsCfg.Certificates = []tls.Certificate{cert}
			}
		}
	}

	hasToken := strings.TrimSpace(token) != ""
	hasCert := len(tlsCfg.Certificates) > 0
	if !hasToken && !hasCert {
		log.Printf("[K8sProxy] WARNING cluster %s: kubeconfig has neither a bearer token nor a client certificate — upstream K8s will likely return 401. certB64_len=%d keyB64_len=%d",
			clusterID, len(certB64), len(keyB64))
	}

	creds := &clusterK8sCreds{
		serverURL:   strings.TrimRight(strings.TrimSpace(serverURL), "/"),
		bearerToken: strings.TrimSpace(token),
		tlsConfig:   tlsCfg,
		kcHash:      kcHash,
	}
	k8sCredsCache.Store(clusterID, creds)
	log.Printf("[K8sProxy] Parsed kubeconfig for cluster %s → server=%s token=%v clientCert=%v insecureSkip=%v",
		clusterID, creds.serverURL, hasToken, hasCert, insecureSkip)
	return creds, nil
}

// K8sProxyInfo returns diagnostic information about the parsed kubeconfig
// credentials for a cluster. Useful to verify the proxy can authenticate
// to the upstream K8s API before running kubectl commands.
// GET /api/k0s/clusters/{id}/proxy-info
func K8sProxyInfo(w http.ResponseWriter, r *http.Request) {
	user, ok := GetUserFromContext(r.Context())
	if !ok || !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden: admin only", http.StatusForbidden)
		return
	}
	vars := mux.Vars(r)
	clusterID := vars["id"]

	var storedKC sql.NullString
	if err := database.DB.QueryRow(
		"SELECT COALESCE(kubeconfig,'') FROM k0s_clusters WHERE id = ?", clusterID,
	).Scan(&storedKC); err != nil {
		http.Error(w, "Cluster not found", http.StatusNotFound)
		return
	}
	if strings.TrimSpace(storedKC.String) == "" {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"error":"no kubeconfig stored for this cluster"}`)
		return
	}

	// Force re-parse (bypass cache) by evicting it first.
	k8sCredsCache.Delete(clusterID)
	creds, err := parseKubeconfigCreds(clusterID, storedKC.String)
	if err != nil {
		http.Error(w, "parse error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Probe the upstream K8s API with the parsed creds.
	testURL := creds.serverURL + "/version"
	req, _ := http.NewRequest("GET", testURL, nil)
	if creds.bearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+creds.bearerToken)
	}
	client := &http.Client{
		Transport: &http.Transport{TLSClientConfig: creds.tlsConfig},
		Timeout:   10 * time.Second,
	}
	probeStatus, probeBody := 0, ""
	if resp, err := client.Do(req); err != nil {
		probeBody = "dial error: " + err.Error()
	} else {
		defer resp.Body.Close()
		probeStatus = resp.StatusCode
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		probeBody = strings.TrimSpace(string(b))
	}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"cluster_id":%q,"server":%q,"has_token":%v,"has_client_cert":%v,"probe_url":%q,"probe_status":%d,"probe_body":%q}`,
		clusterID, creds.serverURL,
		creds.bearerToken != "", len(creds.tlsConfig.Certificates) > 0,
		testURL, probeStatus, probeBody)
}

// isAPIDiscoveryPath returns true for Kubernetes API group/version discovery
// endpoints that kubectl calls before every real operation.  These return
// only metadata (resource type lists, API group info) and must be allowed for
// all authenticated users regardless of namespace assignment, otherwise kubectl
// fails with "couldn't get current server API group list: the server has asked
// for the client to provide credentials".
func isAPIDiscoveryPath(path string) bool {
	switch path {
	case "/", "", "/api", "/apis", "/version",
		"/healthz", "/readyz", "/livez", "/api/v1":
		return true
	}
	if strings.HasPrefix(path, "/openapi") {
		return true
	}
	// /apis/<group> and /apis/<group>/<version> — API group/version discovery.
	// Deeper paths like /apis/apps/v1/namespaces/... are resource operations.
	if strings.HasPrefix(path, "/apis/") {
		rest := strings.Trim(strings.TrimPrefix(path, "/apis/"), "/")
		if strings.Count(rest, "/") <= 1 { // 0 or 1 slash → group or group/version
			return true
		}
	}
	return false
}

// extractNamespaceFromK8sPath parses a Kubernetes API URL path and returns the
// namespace and whether the request is namespace-scoped.
//
//	/api/v1/namespaces/default/pods          → "default", true
//	/apis/apps/v1/namespaces/default/deploys → "default", true
//	/api/v1/namespaces                       → "", false  (list namespaces)
//	/api/v1/nodes                            → "", false  (cluster-scoped)
func extractNamespaceFromK8sPath(path string) (namespace string, namespaced bool) {
	parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
	for i, part := range parts {
		// i+2 < len(parts) ensures there is a resource type after the ns name,
		// distinguishing "namespaces/{ns}/pods" from "namespaces/{ns}" (get ns).
		if part == "namespaces" && i+2 < len(parts) && parts[i+1] != "" {
			return parts[i+1], true
		}
	}
	return "", false
}

// K8sAPIProxy is an HTTP/WebSocket reverse proxy that forwards requests to the
// real Kubernetes API server of the given cluster while:
//   - authenticating callers via our session token (Bearer, validated by AuthMiddleware)
//   - enforcing namespace access for non-admin users
//   - logging the full request chain: kubectl → proxy → kubeconfig → kubernetes
//
// Upstream authentication is derived automatically from the admin kubeconfig
// stored in k0s_clusters.kubeconfig — no separate SA token configuration needed.
// Route: /api/k0s/clusters/{id}/proxy/{path:.*}  (all HTTP methods)
func K8sAPIProxy(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]

	// ── 1. Get authenticated user from AuthMiddleware context ─────────────────
	// AuthMiddleware already validated the session token and put the user in
	// context; no need to re-query the DB here.
	user, ok := GetUserFromContext(r.Context())
	if !ok {
		log.Printf("[K8sProxy] WARN: no user in context for %s %s — AuthMiddleware may have been bypassed", r.Method, r.URL.Path)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// ── 2. Decode the forwarded k8s path ──────────────────────────────────────
	k8sPath := vars["path"]
	if k8sPath != "" && !strings.HasPrefix(k8sPath, "/") {
		k8sPath = "/" + k8sPath
	}
	if k8sPath == "" {
		k8sPath = "/"
	}

	log.Printf("[K8sProxy] ← kubectl  %s %s | cluster=%s user=%s role=%s k8sPath=%s",
		r.Method, r.URL.Path, clusterID, user.Username, user.Role, k8sPath)

	// ── 3. Load and parse stored admin kubeconfig ──────────────────────────────
	var storedKC sql.NullString
	if err := database.DB.QueryRow(
		"SELECT COALESCE(kubeconfig,'') FROM k0s_clusters WHERE id = ?", clusterID,
	).Scan(&storedKC); err != nil {
		log.Printf("[K8sProxy] cluster %s: DB lookup error: %v", clusterID, err)
		http.Error(w, "Cluster not found", http.StatusNotFound)
		return
	}
	if strings.TrimSpace(storedKC.String) == "" {
		log.Printf("[K8sProxy] cluster %s: no kubeconfig stored in DB", clusterID)
		http.Error(w, "Cluster kubeconfig not available — admin must import a kubeconfig first", http.StatusBadRequest)
		return
	}

	creds, err := parseKubeconfigCreds(clusterID, storedKC.String)
	if err != nil {
		log.Printf("[K8sProxy] cluster %s: kubeconfig parse failed: %v", clusterID, err)
		http.Error(w, "Failed to parse cluster kubeconfig: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ── 4. Namespace access check for non-admin users ─────────────────────────
	if !HasRole(user.Role, "admin") && !isAPIDiscoveryPath(k8sPath) {
		ns, namespaced := extractNamespaceFromK8sPath(k8sPath)
		if !namespaced {
			log.Printf("[K8sProxy] cluster %s user %s: FORBIDDEN — cluster-scoped path %s", clusterID, user.Username, k8sPath)
			http.Error(w, "Forbidden: cluster-scoped resources require admin role", http.StatusForbidden)
			return
		}
		clusterIDInt, _ := strconv.Atoi(clusterID)
		if !checkNamespaceAccess(user, clusterIDInt, ns) {
			log.Printf("[K8sProxy] cluster %s user %s: FORBIDDEN — no access to namespace %q", clusterID, user.Username, ns)
			http.Error(w, fmt.Sprintf("Forbidden: namespace %q is not assigned to your account", ns), http.StatusForbidden)
			return
		}
	}

	// ── 5. Audit log — skip noisy discovery calls ─────────────────────────────
	if !isAPIDiscoveryPath(k8sPath) {
		go recordActivityLog(
			"kubectl",
			fmt.Sprintf("cluster=%s", clusterID),
			fmt.Sprintf("user=%s method=%s path=%s", user.Username, r.Method, k8sPath),
			"success",
		)
	}

	// ── 6. WebSocket upgrade (kubectl exec / port-forward / logs -f) ──────────
	if strings.ToLower(r.Header.Get("Upgrade")) == "websocket" {
		proxyK8sWebSocket(w, r, creds, k8sPath)
		return
	}

	// ── 7. Plain HTTP reverse-proxy ───────────────────────────────────────────
	targetURL := creds.serverURL + k8sPath
	if r.URL.RawQuery != "" {
		targetURL += "?" + r.URL.RawQuery
	}

	log.Printf("[K8sProxy] → upstream %s %s | token=%v clientCert=%v",
		r.Method, targetURL, creds.bearerToken != "", len(creds.tlsConfig.Certificates) > 0)

	forwardReq, err := http.NewRequest(r.Method, targetURL, r.Body)
	if err != nil {
		log.Printf("[K8sProxy] failed to build upstream request: %v", err)
		http.Error(w, "Failed to create upstream request: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Copy safe request headers (skip hop-by-hop and our auth header).
	hopByHop := map[string]bool{
		"authorization": true, "host": true, "upgrade": true,
		"connection": true, "proxy-authorization": true,
		"te": true, "trailer": true, "transfer-encoding": true,
	}
	for key, vals := range r.Header {
		if hopByHop[strings.ToLower(key)] {
			continue
		}
		for _, v := range vals {
			forwardReq.Header.Add(key, v)
		}
	}

	// Inject upstream K8s credentials.
	if creds.bearerToken != "" {
		forwardReq.Header.Set("Authorization", "Bearer "+creds.bearerToken)
	}
	forwardReq.Header.Set("User-Agent", "kubectl/proxy-dm")

	client := &http.Client{
		Transport: &http.Transport{TLSClientConfig: creds.tlsConfig},
		Timeout:   5 * time.Minute,
	}

	resp, err := client.Do(forwardReq)
	if err != nil {
		log.Printf("[K8sProxy] upstream dial error: %v", err)
		http.Error(w, "Upstream K8s API error: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	log.Printf("[K8sProxy] ← upstream %d for %s %s", resp.StatusCode, r.Method, targetURL)

	// Copy response headers.
	for key, vals := range resp.Header {
		for _, v := range vals {
			w.Header().Add(key, v)
		}
	}

	// For 4xx/5xx responses, buffer the body so we can log it AND return it.
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		snippet := string(body)
		if len(snippet) > 512 {
			snippet = snippet[:512]
		}
		log.Printf("[K8sProxy] ← upstream error body: %s", strings.TrimSpace(snippet))
		w.WriteHeader(resp.StatusCode)
		w.Write(body) //nolint:errcheck
		return
	}

	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body) //nolint:errcheck
}


// proxyK8sWebSocket tunnels a WebSocket connection to the K8s API server.
// This is used for kubectl exec, kubectl port-forward, and kubectl logs -f.
func proxyK8sWebSocket(w http.ResponseWriter, r *http.Request, creds *clusterK8sCreds, k8sPath string) {
	// Collect the subprotocols requested by the kubectl client.
	subprotocols := websocket.Subprotocols(r)

	// Upgrade the incoming connection (from kubectl) to WebSocket.
	upUpgrader := websocket.Upgrader{
		CheckOrigin:  func(_ *http.Request) bool { return true },
		Subprotocols: subprotocols,
	}
	clientConn, err := upUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[K8sProxy] WebSocket upgrade error: %v", err)
		return
	}
	defer clientConn.Close()

	// Dial the upstream K8s WebSocket endpoint.
	targetURL := creds.serverURL + k8sPath
	if r.URL.RawQuery != "" {
		targetURL += "?" + r.URL.RawQuery
	}
	wsURL := strings.NewReplacer("https://", "wss://", "http://", "ws://").Replace(targetURL)

	upstreamHeaders := http.Header{}
	if creds.bearerToken != "" {
		upstreamHeaders.Set("Authorization", "Bearer "+creds.bearerToken)
	}

	dialer := websocket.Dialer{
		TLSClientConfig: creds.tlsConfig,
		Subprotocols:    subprotocols,
	}
	upstreamConn, _, err := dialer.Dial(wsURL, upstreamHeaders)
	if err != nil {
		log.Printf("[K8sProxy] WebSocket upstream dial error: %v", err)
		clientConn.WriteMessage(websocket.CloseMessage, //nolint:errcheck
			websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "upstream dial failed"))
		return
	}
	defer upstreamConn.Close()

	errCh := make(chan error, 2)

	// client → upstream
	go func() {
		for {
			mt, msg, err := clientConn.ReadMessage()
			if err != nil {
				errCh <- err
				return
			}
			if err := upstreamConn.WriteMessage(mt, msg); err != nil {
				errCh <- err
				return
			}
		}
	}()

	// upstream → client
	go func() {
		for {
			mt, msg, err := upstreamConn.ReadMessage()
			if err != nil {
				errCh <- err
				return
			}
			if err := clientConn.WriteMessage(mt, msg); err != nil {
				errCh <- err
				return
			}
		}
	}()

	<-errCh
}
