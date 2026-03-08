package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/adisaputra10/docker-management/internal/database"
)

type SSOSettings struct {
	GitLabEnabled      bool   `json:"gitlab_enabled"`
	GitLabClientID     string `json:"gitlab_client_id"`
	GitLabClientSecret string `json:"gitlab_client_secret"`
	GitLabRedirectURI  string `json:"gitlab_redirect_uri"`

	EntraEnabled      bool   `json:"entra_enabled"`
	EntraClientID     string `json:"entra_client_id"`
	EntraClientSecret string `json:"entra_client_secret"`
	EntraTenantID     string `json:"entra_tenant_id"`
	EntraRedirectURI  string `json:"entra_redirect_uri"`

	// Generic OIDC provider
	OIDCEnabled     bool   `json:"oidc_enabled"`
	OIDCDisplayName string `json:"oidc_display_name"`
	OIDCIssuer      string `json:"oidc_issuer"`
	OIDCClientID    string `json:"oidc_client_id"`
	OIDCClientSecret string `json:"oidc_client_secret"`
	OIDCRedirectURI  string `json:"oidc_redirect_uri"`
	OIDCDefaultRole  string `json:"oidc_default_role"`
	OIDCScopes       string `json:"oidc_scopes"`

	StandardLoginEnabled bool `json:"standard_login_enabled"`
}

// ── OIDC state store (CSRF protection via cookie) ────────────────────────────
// State is stored in a short-lived HttpOnly cookie so it survives server
// restarts and scales across multiple processes.

func oidcGenerateState() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func oidcSetStateCookie(w http.ResponseWriter, state string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "oidc_state",
		Value:    state,
		Path:     "/",
		MaxAge:   600, // 10 minutes
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func oidcValidateStateCookie(r *http.Request, state string) bool {
	cookie, err := r.Cookie("oidc_state")
	if err != nil {
		return false
	}
	return cookie.Value != "" && cookie.Value == state
}

func oidcClearStateCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:   "oidc_state",
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})
}

// ── OIDC Discovery ────────────────────────────────────────────────────────────
type oidcDiscoveryDoc struct {
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	UserinfoEndpoint      string `json:"userinfo_endpoint"`
}

func fetchOIDCDiscovery(issuer string) (*oidcDiscoveryDoc, error) {
	issuer = strings.TrimRight(issuer, "/")
	discoveryURL := issuer + "/.well-known/openid-configuration"
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(discoveryURL)
	if err != nil {
		return nil, fmt.Errorf("discovery request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("discovery returned %d: %s", resp.StatusCode, string(body))
	}
	var doc oidcDiscoveryDoc
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, fmt.Errorf("discovery decode: %v", err)
	}
	if doc.AuthorizationEndpoint == "" || doc.TokenEndpoint == "" {
		return nil, fmt.Errorf("incomplete OIDC discovery document")
	}
	return &doc, nil
}

func GetSSOSettings(w http.ResponseWriter, r *http.Request) {
	s := SSOSettings{}

	val, _ := database.GetSetting("sso_gitlab_enabled")
	s.GitLabEnabled = val == "true"
	s.GitLabClientID, _ = database.GetSetting("sso_gitlab_client_id")
	s.GitLabClientSecret, _ = database.GetSetting("sso_gitlab_client_secret")
	s.GitLabRedirectURI, _ = database.GetSetting("sso_gitlab_redirect_uri")

	val, _ = database.GetSetting("sso_entra_enabled")
	s.EntraEnabled = val == "true"
	s.EntraClientID, _ = database.GetSetting("sso_entra_client_id")
	s.EntraClientSecret, _ = database.GetSetting("sso_entra_client_secret")
	s.EntraTenantID, _ = database.GetSetting("sso_entra_tenant_id")
	s.EntraRedirectURI, _ = database.GetSetting("sso_entra_redirect_uri")

	val, _ = database.GetSetting("sso_oidc_enabled")
	s.OIDCEnabled = val == "true"
	s.OIDCDisplayName, _ = database.GetSetting("sso_oidc_display_name")
	s.OIDCIssuer, _ = database.GetSetting("sso_oidc_issuer")
	s.OIDCClientID, _ = database.GetSetting("sso_oidc_client_id")
	s.OIDCClientSecret, _ = database.GetSetting("sso_oidc_client_secret")
	s.OIDCRedirectURI, _ = database.GetSetting("sso_oidc_redirect_uri")
	s.OIDCDefaultRole, _ = database.GetSetting("sso_oidc_default_role")
	s.OIDCScopes, _ = database.GetSetting("sso_oidc_scopes")

	std, _ := database.GetSetting("standard_login_enabled")
	s.StandardLoginEnabled = std != "false"

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

func SaveSSOSettings(w http.ResponseWriter, r *http.Request) {
	var s SSOSettings
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if s.GitLabEnabled {
		database.SetSetting("sso_gitlab_enabled", "true")
	} else {
		database.SetSetting("sso_gitlab_enabled", "false")
	}
	database.SetSetting("sso_gitlab_client_id", s.GitLabClientID)
	database.SetSetting("sso_gitlab_client_secret", s.GitLabClientSecret)
	database.SetSetting("sso_gitlab_redirect_uri", s.GitLabRedirectURI)

	if s.EntraEnabled {
		database.SetSetting("sso_entra_enabled", "true")
	} else {
		database.SetSetting("sso_entra_enabled", "false")
	}
	database.SetSetting("sso_entra_client_id", s.EntraClientID)
	database.SetSetting("sso_entra_client_secret", s.EntraClientSecret)
	database.SetSetting("sso_entra_tenant_id", s.EntraTenantID)
	database.SetSetting("sso_entra_redirect_uri", s.EntraRedirectURI)

	if s.OIDCEnabled {
		database.SetSetting("sso_oidc_enabled", "true")
	} else {
		database.SetSetting("sso_oidc_enabled", "false")
	}
	if s.OIDCDisplayName == "" {
		s.OIDCDisplayName = "OIDC"
	}
	database.SetSetting("sso_oidc_display_name", s.OIDCDisplayName)
	database.SetSetting("sso_oidc_issuer", s.OIDCIssuer)
	database.SetSetting("sso_oidc_client_id", s.OIDCClientID)
	database.SetSetting("sso_oidc_client_secret", s.OIDCClientSecret)
	database.SetSetting("sso_oidc_redirect_uri", s.OIDCRedirectURI)
	if s.OIDCDefaultRole == "" {
		s.OIDCDefaultRole = "user_docker_basic"
	}
	database.SetSetting("sso_oidc_default_role", s.OIDCDefaultRole)
	if s.OIDCScopes == "" {
		s.OIDCScopes = "openid profile email"
	}
	database.SetSetting("sso_oidc_scopes", s.OIDCScopes)

	if s.StandardLoginEnabled {
		database.SetSetting("standard_login_enabled", "true")
	} else {
		database.SetSetting("standard_login_enabled", "false")
	}

	w.WriteHeader(http.StatusOK)
}

// Get Public Auth Provider Config
func GetAuthProviders(w http.ResponseWriter, r *http.Request) {
	resp := map[string]interface{}{}

	std, _ := database.GetSetting("standard_login_enabled")
	resp["standard_login_enabled"] = std != "false"

	gl, _ := database.GetSetting("sso_gitlab_enabled")
	if gl == "true" {
		cid, _ := database.GetSetting("sso_gitlab_client_id")
		resp["gitlab"] = map[string]interface{}{"enabled": true, "client_id": cid}
	} else {
		resp["gitlab"] = map[string]interface{}{"enabled": false}
	}

	en, _ := database.GetSetting("sso_entra_enabled")
	if en == "true" {
		cid, _ := database.GetSetting("sso_entra_client_id")
		tid, _ := database.GetSetting("sso_entra_tenant_id")
		resp["entra"] = map[string]interface{}{"enabled": true, "client_id": cid, "tenant_id": tid}
	} else {
		resp["entra"] = map[string]interface{}{"enabled": false}
	}

	oidcEn, _ := database.GetSetting("sso_oidc_enabled")
	if oidcEn == "true" {
		displayName, _ := database.GetSetting("sso_oidc_display_name")
		if displayName == "" {
			displayName = "OIDC"
		}
		resp["oidc"] = map[string]interface{}{"enabled": true, "display_name": displayName}
	} else {
		resp["oidc"] = map[string]interface{}{"enabled": false}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// ── OIDC Authorization Code Flow ────────────────────────────────────────────────

// OIDCBeginAuth redirects the browser to the OIDC provider's authorization endpoint.
// GET /api/auth/oidc/begin
func OIDCBeginAuth(w http.ResponseWriter, r *http.Request) {
	en, _ := database.GetSetting("sso_oidc_enabled")
	if en != "true" {
		http.Error(w, "OIDC SSO is not enabled", http.StatusBadRequest)
		return
	}

	issuer, _ := database.GetSetting("sso_oidc_issuer")
	clientID, _ := database.GetSetting("sso_oidc_client_id")
	redirectURI, _ := database.GetSetting("sso_oidc_redirect_uri")
	scopes, _ := database.GetSetting("sso_oidc_scopes")
	if scopes == "" {
		scopes = "openid profile email"
	}

	if issuer == "" || clientID == "" || redirectURI == "" {
		http.Error(w, "OIDC is not fully configured (issuer, client_id, redirect_uri required)", http.StatusInternalServerError)
		return
	}

	doc, err := fetchOIDCDiscovery(issuer)
	if err != nil {
		log.Printf("[OIDC] Discovery error: %v", err)
		http.Error(w, "OIDC provider discovery failed: "+err.Error(), http.StatusBadGateway)
		return
	}

	state := oidcGenerateState()
	oidcSetStateCookie(w, state)

	params := url.Values{}
	params.Set("client_id", clientID)
	params.Set("redirect_uri", redirectURI)
	params.Set("response_type", "code")
	params.Set("scope", scopes)
	params.Set("state", state)

	authURL := doc.AuthorizationEndpoint + "?" + params.Encode()
	http.Redirect(w, r, authURL, http.StatusFound)
}

// OIDCCallback handles the callback from the OIDC provider.
// GET /api/auth/oidc/callback
func OIDCCallback(w http.ResponseWriter, r *http.Request) {
	// Handle provider errors
	if errParam := r.URL.Query().Get("error"); errParam != "" {
		errDesc := r.URL.Query().Get("error_description")
		log.Printf("[OIDC] Provider returned error: %s — %s", errParam, errDesc)
		http.Error(w, "OIDC error: "+errParam+" — "+errDesc, http.StatusBadRequest)
		return
	}

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if code == "" {
		http.Error(w, "Missing authorization code", http.StatusBadRequest)
		return
	}

	if !oidcValidateStateCookie(r, state) {
		log.Printf("[OIDC] State mismatch: cookie vs query param — possible replay or server restart")
		http.Error(w, "Invalid or expired state parameter", http.StatusBadRequest)
		return
	}
	oidcClearStateCookie(w)

	// Load OIDC settings
	issuer, _ := database.GetSetting("sso_oidc_issuer")
	clientID, _ := database.GetSetting("sso_oidc_client_id")
	clientSecret, _ := database.GetSetting("sso_oidc_client_secret")
	redirectURI, _ := database.GetSetting("sso_oidc_redirect_uri")
	defaultRole, _ := database.GetSetting("sso_oidc_default_role")
	if defaultRole == "" {
		defaultRole = "user_docker_basic"
	}

	doc, err := fetchOIDCDiscovery(issuer)
	if err != nil {
		log.Printf("[OIDC] Discovery error in callback: %v", err)
		http.Error(w, "OIDC discovery failed", http.StatusBadGateway)
		return
	}

	// Exchange authorization code for tokens
	client := &http.Client{Timeout: 15 * time.Second}
	tokenParams := url.Values{}
	tokenParams.Set("grant_type", "authorization_code")
	tokenParams.Set("code", code)
	tokenParams.Set("redirect_uri", redirectURI)
	tokenParams.Set("client_id", clientID)
	tokenParams.Set("client_secret", clientSecret)

	tokenResp, err := client.PostForm(doc.TokenEndpoint, tokenParams)
	if err != nil {
		log.Printf("[OIDC] Token exchange request failed: %v", err)
		http.Error(w, "Token exchange failed", http.StatusBadGateway)
		return
	}
	defer tokenResp.Body.Close()

	var tokenData struct {
		AccessToken string `json:"access_token"`
		IDToken     string `json:"id_token"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.NewDecoder(tokenResp.Body).Decode(&tokenData); err != nil {
		http.Error(w, "Invalid token response", http.StatusBadGateway)
		return
	}
	if tokenData.Error != "" {
		log.Printf("[OIDC] Token error: %s — %s", tokenData.Error, tokenData.ErrorDesc)
		http.Error(w, "Token exchange error: "+tokenData.Error, http.StatusUnauthorized)
		return
	}

	// Call userinfo endpoint to get user claims
	userInfoReq, _ := http.NewRequest("GET", doc.UserinfoEndpoint, nil)
	userInfoReq.Header.Set("Authorization", "Bearer "+tokenData.AccessToken)
	userInfoResp, err := client.Do(userInfoReq)
	if err != nil {
		log.Printf("[OIDC] Userinfo request failed: %v", err)
		http.Error(w, "Userinfo request failed", http.StatusBadGateway)
		return
	}
	defer userInfoResp.Body.Close()

	var claims map[string]interface{}
	if err := json.NewDecoder(userInfoResp.Body).Decode(&claims); err != nil {
		http.Error(w, "Invalid userinfo response", http.StatusBadGateway)
		return
	}

	// Extract username: prefer preferred_username > email > sub
	username := ""
	for _, field := range []string{"preferred_username", "name", "email", "sub"} {
		if v, ok := claims[field].(string); ok && v != "" {
			username = v
			break
		}
	}
	if username == "" {
		http.Error(w, "Could not determine username from OIDC provider", http.StatusUnauthorized)
		return
	}
	// For email addresses, use the part before '@' as the username
	if strings.Contains(username, "@") {
		username = strings.Split(username, "@")[0]
	}
	// Sanitize: only printable ASCII, no spaces
	var cleanName strings.Builder
	for _, c := range username {
		if c > 32 && c < 127 {
			cleanName.WriteRune(c)
		}
	}
	username = cleanName.String()
	if username == "" {
		http.Error(w, "Invalid username from OIDC provider", http.StatusUnauthorized)
		return
	}

	// Find or auto-provision user in local DB
	var dbUser User
	err = database.DB.QueryRow(
		"SELECT id, username, role FROM users WHERE username = ?", username,
	).Scan(&dbUser.ID, &dbUser.Username, &dbUser.Role)

	switch err {
	case nil:
		// User exists — proceed
	case sql.ErrNoRows:
		// Auto-provision: create user with empty password (cannot login via standard login)
		result, insertErr := database.DB.Exec(
			"INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
			username, "", defaultRole,
		)
		if insertErr != nil {
			log.Printf("[OIDC] Failed to create user %s: %v", username, insertErr)
			http.Error(w, "Failed to create user", http.StatusInternalServerError)
			return
		}
		newID, _ := result.LastInsertId()
		dbUser = User{ID: int(newID), Username: username, Role: defaultRole}
		log.Printf("[OIDC] Auto-provisioned new user: %s with role: %s", username, defaultRole)
	default:
		log.Printf("[OIDC] DB error looking up user %s: %v", username, err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Create a session (24h)
	sessionToken, tokenErr := generateToken()
	if tokenErr != nil {
		http.Error(w, "Failed to generate session token", http.StatusInternalServerError)
		return
	}
	expiry := time.Now().Add(24 * time.Hour)
	_, sessionErr := database.DB.Exec(
		"INSERT INTO sessions (token, user_id, role, expires_at) VALUES (?, ?, ?, ?)",
		sessionToken, dbUser.ID, dbUser.Role, expiry,
	)
	if sessionErr != nil {
		log.Printf("[OIDC] Failed to create session for user %s: %v", username, sessionErr)
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		return
	}

	log.Printf("[OIDC] User %s logged in successfully", username)

	// Return an HTML page that stores the token in localStorage and redirects to the app
	userDataJSON, _ := json.Marshal(dbUser)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `<!DOCTYPE html>
<html>
<head><title>Logging in...</title></head>
<body>
<p style="font-family:system-ui;text-align:center;margin-top:4rem;color:#94a3b8">Logging in, please wait...</p>
<script>
try {
    localStorage.setItem('authToken', %q);
    localStorage.setItem('userData', %q);
    window.location.href = '/';
} catch(e) {
    document.body.innerHTML = '<p style="color:red">Login failed: ' + e.message + '</p>';
}
</script>
</body>
</html>`, sessionToken, string(userDataJSON))
}
