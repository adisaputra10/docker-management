package api

import (
	"encoding/json"
	"net/http"

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

	StandardLoginEnabled bool `json:"standard_login_enabled"`
}

func GetSSOSettings(w http.ResponseWriter, r *http.Request) {
	s := SSOSettings{}

	val, _ := database.GetSetting("sso_gitlab_enabled")
	s.GitLabEnabled = val == "true"
	s.GitLabClientID, _ = database.GetSetting("sso_gitlab_client_id")
	// For security, maybe mask secret? User asked for settings, usually admins need to overwrite or view.
	// Typically we return masked or empty.
	// I'll return as is for now as user requested "settingan".
	s.GitLabClientSecret, _ = database.GetSetting("sso_gitlab_client_secret")
	s.GitLabRedirectURI, _ = database.GetSetting("sso_gitlab_redirect_uri")

	val, _ = database.GetSetting("sso_entra_enabled")
	s.EntraEnabled = val == "true"
	s.EntraClientID, _ = database.GetSetting("sso_entra_client_id")
	s.EntraClientSecret, _ = database.GetSetting("sso_entra_client_secret")
	s.EntraTenantID, _ = database.GetSetting("sso_entra_tenant_id")
	s.EntraRedirectURI, _ = database.GetSetting("sso_entra_redirect_uri")

	std, _ := database.GetSetting("standard_login_enabled")
	s.StandardLoginEnabled = std != "false"

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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
