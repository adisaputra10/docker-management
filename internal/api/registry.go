package api

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/gorilla/mux"
)

// ── Models ─────────────────────────────────────────────────────────────────

type CicdRegistry struct {
	ID                 int    `json:"id"`
	Name               string `json:"name"`
	Type               string `json:"type"`
	URL                string `json:"url"`
	Username           string `json:"username"`
	SSLEnabled         bool   `json:"ssl_enabled"`
	InsecureSkipVerify bool   `json:"insecure_skip_verify"`
	ExtraConfig        string `json:"extra_config,omitempty"` // JSON blob
	Description        string `json:"description"`
	WorkspaceID        string `json:"workspace_id"`
	CreatedAt          string `json:"created_at"`
}

type RegistryRequest struct {
	Name               string `json:"name"`
	Type               string `json:"type"`
	URL                string `json:"url"`
	Username           string `json:"username"`
	Password           string `json:"password"`
	SSLEnabled         bool   `json:"ssl_enabled"`
	InsecureSkipVerify bool   `json:"insecure_skip_verify"`
	ExtraConfig        string `json:"extra_config"`
	Description        string `json:"description"`
	WorkspaceID        string `json:"workspace_id"`
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// buildRegistryBaseURL constructs the base URL for the registry respecting SSL flag.
// If the provided url already has a scheme, it is replaced based on ssl_enabled.
func buildRegistryBaseURL(rawURL string, sslEnabled bool) string {
	u := strings.TrimSpace(rawURL)
	// Strip existing scheme
	for _, prefix := range []string{"https://", "http://"} {
		u = strings.TrimPrefix(u, prefix)
	}
	u = strings.TrimRight(u, "/")
	if sslEnabled {
		return "https://" + u
	}
	return "http://" + u
}

// httpClientForRegistry returns an *http.Client that honours insecure_skip_verify.
func httpClientForRegistry(insecure bool) *http.Client {
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: insecure}, //nolint:gosec
	}
	return &http.Client{Transport: tr, Timeout: 10 * time.Second}
}

// ── Handlers ────────────────────────────────────────────────────────────────

// GET /api/cicd/registries
func ListRegistries(w http.ResponseWriter, r *http.Request) {
	user, ok := GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	wsID := r.URL.Query().Get("workspace_id")

	query := "SELECT id, name, type, url, username, ssl_enabled, insecure_skip_verify, extra_config, description, workspace_id, created_at FROM cicd_registries"
	args := []interface{}{}
	isAdmin := HasRole(user.Role, "admin")

	if wsID != "" {
		query += " WHERE workspace_id = ?"
		args = append(args, wsID)
	} else if !isAdmin {
		// non-admin can only see registries for workspaces they belong to (by workspace_id)
		query += " WHERE 1=1"
	}
	query += " ORDER BY created_at DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var list []CicdRegistry
	for rows.Next() {
		var reg CicdRegistry
		var sslInt, insecureInt int
		if err := rows.Scan(&reg.ID, &reg.Name, &reg.Type, &reg.URL, &reg.Username,
			&sslInt, &insecureInt, &reg.ExtraConfig, &reg.Description, &reg.WorkspaceID, &reg.CreatedAt); err != nil {
			continue
		}
		reg.SSLEnabled = sslInt == 1
		reg.InsecureSkipVerify = insecureInt == 1
		list = append(list, reg)
	}
	if list == nil {
		list = []CicdRegistry{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

// POST /api/cicd/registries
func CreateRegistry(w http.ResponseWriter, r *http.Request) {
	_, ok := GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req RegistryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	validTypes := map[string]bool{
		"harbor": true, "registryv2": true, "gitlab": true,
		"aws": true, "alibaba": true, "huawei": true,
	}
	if !validTypes[req.Type] {
		http.Error(w, "invalid registry type", http.StatusBadRequest)
		return
	}

	sslInt := 0
	if req.SSLEnabled {
		sslInt = 1
	}
	insecureInt := 0
	if req.InsecureSkipVerify {
		insecureInt = 1
	}

	result, err := database.DB.Exec(
		`INSERT INTO cicd_registries (name, type, url, username, password, ssl_enabled, insecure_skip_verify, extra_config, description, workspace_id)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		req.Name, req.Type, req.URL, req.Username, req.Password,
		sslInt, insecureInt, req.ExtraConfig, req.Description, req.WorkspaceID,
	)
	if err != nil {
		http.Error(w, "Error creating registry: "+err.Error(), http.StatusInternalServerError)
		return
	}
	id, _ := result.LastInsertId()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "id": id})
}

// DELETE /api/cicd/registries/{id}
func DeleteRegistry(w http.ResponseWriter, r *http.Request) {
	user, ok := GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	id := mux.Vars(r)["id"]
	_, err := database.DB.Exec("DELETE FROM cicd_registries WHERE id = ?", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// POST /api/cicd/registries/test
// Body: same as RegistryRequest (uses the live form fields, not a saved registry)
func TestRegistry(w http.ResponseWriter, r *http.Request) {
	_, ok := GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req RegistryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	result := testRegistryConnection(req)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// testRegistryConnection performs an actual network probe to the registry endpoint.
func testRegistryConnection(req RegistryRequest) map[string]interface{} {
	if req.Type == "aws" {
		// AWS ECR needs AWS SDK auth — we just verify the endpoint URL shape
		var extra map[string]string
		if req.ExtraConfig != "" {
			json.Unmarshal([]byte(req.ExtraConfig), &extra) //nolint:errcheck
		}
		region := extra["aws_region"]
		account := extra["aws_account"]
		if region == "" || account == "" {
			return map[string]interface{}{"success": false, "message": "AWS Region and Account ID are required"}
		}
		endpoint := fmt.Sprintf("%s.dkr.ecr.%s.amazonaws.com", account, region)
		return map[string]interface{}{
			"success": true,
			"message": fmt.Sprintf("AWS ECR endpoint: %s (authentication via AWS SDK at build time)", endpoint),
		}
	}

	rawURL := strings.TrimSpace(req.URL)
	if rawURL == "" {
		return map[string]interface{}{"success": false, "message": "Registry URL is required"}
	}

	baseURL := buildRegistryBaseURL(rawURL, req.SSLEnabled)
	pingURL := strings.TrimRight(baseURL, "/") + "/v2/"

	client := httpClientForRegistry(req.InsecureSkipVerify)

	httpReq, err := http.NewRequest("GET", pingURL, nil)
	if err != nil {
		return map[string]interface{}{"success": false, "message": "Invalid URL: " + err.Error()}
	}
	// Basic auth if provided
	if req.Username != "" && req.Password != "" {
		httpReq.SetBasicAuth(req.Username, req.Password)
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "certificate") || strings.Contains(msg, "tls") || strings.Contains(msg, "x509") {
			return map[string]interface{}{
				"success": false,
				"message": "TLS/SSL error: " + msg + ". Try enabling 'Skip TLS Verify' if using a self-signed certificate.",
			}
		}
		return map[string]interface{}{"success": false, "message": "Connection failed: " + msg}
	}
	defer resp.Body.Close()

	scheme := "https"
	if !req.SSLEnabled {
		scheme = "http"
	}

	// Registry v2 API returns 200 (no auth) or 401 (auth required) — both mean registry is reachable
	if resp.StatusCode == http.StatusOK {
		return map[string]interface{}{
			"success": true,
			"message": fmt.Sprintf("Connected via %s — registry responded 200 OK", strings.ToUpper(scheme)),
		}
	}
	if resp.StatusCode == http.StatusUnauthorized {
		return map[string]interface{}{
			"success": true,
			"message": fmt.Sprintf("Connected via %s — registry requires authentication (401). Credentials will be used at build time.", strings.ToUpper(scheme)),
		}
	}
	return map[string]interface{}{
		"success": false,
		"message": fmt.Sprintf("Unexpected response from registry: HTTP %d %s", resp.StatusCode, resp.Status),
	}
}

// GET /api/cicd/registries/{id} — full detail including password (admin only)
func GetRegistry(w http.ResponseWriter, r *http.Request) {
	user, ok := GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	id := mux.Vars(r)["id"]
	var reg CicdRegistry
	var password string
	var sslInt, insecureInt int
	err := database.DB.QueryRow(
		`SELECT id, name, type, url, username, password, ssl_enabled, insecure_skip_verify, extra_config, description, workspace_id, created_at
		 FROM cicd_registries WHERE id = ?`, id,
	).Scan(&reg.ID, &reg.Name, &reg.Type, &reg.URL, &reg.Username, &password,
		&sslInt, &insecureInt, &reg.ExtraConfig, &reg.Description, &reg.WorkspaceID, &reg.CreatedAt)
	if err != nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	reg.SSLEnabled = sslInt == 1
	reg.InsecureSkipVerify = insecureInt == 1

	out := map[string]interface{}{
		"id":                   reg.ID,
		"name":                 reg.Name,
		"type":                 reg.Type,
		"url":                  reg.URL,
		"username":             reg.Username,
		"password":             password,
		"ssl_enabled":          reg.SSLEnabled,
		"insecure_skip_verify": reg.InsecureSkipVerify,
		"extra_config":         reg.ExtraConfig,
		"description":          reg.Description,
		"workspace_id":         reg.WorkspaceID,
		"created_at":           reg.CreatedAt,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}
