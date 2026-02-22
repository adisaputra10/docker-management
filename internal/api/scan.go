package api

import (
	"encoding/json"
	"net/http"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/gorilla/mux"
)

// ── Models ─────────────────────────────────────────────────────────────────

type ScanReport struct {
	ID           int     `json:"id"`
	ScanType     string  `json:"scan_type"`
	Target       string  `json:"target"`
	PipelineID   *string `json:"pipeline_id"`
	PipelineName *string `json:"pipeline_name"`
	Status       string  `json:"status"`
	Critical     int     `json:"critical"`
	High         int     `json:"high"`
	Medium       int     `json:"medium"`
	Low          int     `json:"low"`
	Info         int     `json:"info"`
	Summary      *string `json:"summary"`
	WorkspaceID  *string `json:"workspace_id"`
	CreatedAt    string  `json:"created_at"`
}

type ScanReportRequest struct {
	ScanType     string `json:"scan_type"`
	Target       string `json:"target"`
	PipelineID   string `json:"pipeline_id"`
	PipelineName string `json:"pipeline_name"`
	Status       string `json:"status"`
	Critical     int    `json:"critical"`
	High         int    `json:"high"`
	Medium       int    `json:"medium"`
	Low          int    `json:"low"`
	Info         int    `json:"info"`
	Summary      string `json:"summary"`
	ResultJSON   string `json:"result_json"`
	WorkspaceID  string `json:"workspace_id"`
}

// ── Handlers ────────────────────────────────────────────────────────────────

// GET /api/cicd/scans
func ListScanReports(w http.ResponseWriter, r *http.Request) {
	user, ok := GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	_ = user

	wsID     := r.URL.Query().Get("workspace_id")
	scanType := r.URL.Query().Get("type")

	query := `SELECT id, scan_type, target, pipeline_id, pipeline_name, status,
	           critical, high, medium, low, info, summary, workspace_id, created_at
	           FROM cicd_scan_reports WHERE 1=1`
	args := []interface{}{}

	if wsID != "" {
		query += " AND (workspace_id = ? OR workspace_id IS NULL OR workspace_id = '')"
		args = append(args, wsID)
	}
	if scanType != "" {
		query += " AND scan_type = ?"
		args = append(args, scanType)
	}
	query += " ORDER BY created_at DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var list []ScanReport
	for rows.Next() {
		var s ScanReport
		if err := rows.Scan(&s.ID, &s.ScanType, &s.Target, &s.PipelineID, &s.PipelineName,
			&s.Status, &s.Critical, &s.High, &s.Medium, &s.Low, &s.Info,
			&s.Summary, &s.WorkspaceID, &s.CreatedAt); err != nil {
			continue
		}
		list = append(list, s)
	}
	if list == nil {
		list = []ScanReport{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

// POST /api/cicd/scans
func CreateScanReport(w http.ResponseWriter, r *http.Request) {
	_, ok := GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var req ScanReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	validTypes := map[string]bool{"sbom": true, "trivy": true, "gitleaks": true, "dependency": true}
	if !validTypes[req.ScanType] {
		http.Error(w, "invalid scan_type; must be sbom|trivy|gitleaks|dependency", http.StatusBadRequest)
		return
	}
	if req.Target == "" {
		http.Error(w, "target is required", http.StatusBadRequest)
		return
	}
	if req.Status == "" {
		req.Status = "clean"
		if req.Critical+req.High+req.Medium+req.Low+req.Info > 0 {
			req.Status = "findings"
		}
	}

	result, err := database.DB.Exec(
		`INSERT INTO cicd_scan_reports
		 (scan_type, target, pipeline_id, pipeline_name, status, critical, high, medium, low, info, summary, result_json, workspace_id)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		req.ScanType, req.Target, req.PipelineID, req.PipelineName,
		req.Status, req.Critical, req.High, req.Medium, req.Low, req.Info,
		req.Summary, req.ResultJSON, req.WorkspaceID,
	)
	if err != nil {
		http.Error(w, "Error saving scan report: "+err.Error(), http.StatusInternalServerError)
		return
	}
	id, _ := result.LastInsertId()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "id": id})
}

// GET /api/cicd/scans/{id}  — full detail incl. result_json
func GetScanReport(w http.ResponseWriter, r *http.Request) {
	_, ok := GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	id := mux.Vars(r)["id"]
	var s ScanReport
	var resultJSON string
	err := database.DB.QueryRow(
		`SELECT id, scan_type, target, pipeline_id, pipeline_name, status,
		 critical, high, medium, low, info, summary, result_json, workspace_id, created_at
		 FROM cicd_scan_reports WHERE id = ?`, id,
	).Scan(&s.ID, &s.ScanType, &s.Target, &s.PipelineID, &s.PipelineName,
		&s.Status, &s.Critical, &s.High, &s.Medium, &s.Low, &s.Info,
		&s.Summary, &resultJSON, &s.WorkspaceID, &s.CreatedAt)
	if err != nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	type fullReport struct {
		ScanReport
		ResultJSON string `json:"result_json"`
	}
	out := fullReport{ScanReport: s, ResultJSON: resultJSON}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

// DELETE /api/cicd/scans/{id}
func DeleteScanReport(w http.ResponseWriter, r *http.Request) {
	user, ok := GetUserFromContext(r.Context())
	if !ok || !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	id := mux.Vars(r)["id"]
	if _, err := database.DB.Exec("DELETE FROM cicd_scan_reports WHERE id = ?", id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// GET /api/cicd/scans/summary  — aggregate counts per type for current workspace
func ScanSummary(w http.ResponseWriter, r *http.Request) {
	_, ok := GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	wsID := r.URL.Query().Get("workspace_id")

	query := `SELECT scan_type,
	           COALESCE(SUM(critical),0), COALESCE(SUM(high),0),
	           COALESCE(SUM(medium),0),  COALESCE(SUM(low),0),
	           COALESCE(SUM(info),0),    COUNT(*)
	           FROM cicd_scan_reports`
	args := []interface{}{}
	if wsID != "" {
		query += " WHERE workspace_id = ?"
		args = append(args, wsID)
	}
	query += " GROUP BY scan_type"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type typeSummary struct {
		ScanType string `json:"scan_type"`
		Critical int    `json:"critical"`
		High     int    `json:"high"`
		Medium   int    `json:"medium"`
		Low      int    `json:"low"`
		Info     int    `json:"info"`
		Total    int    `json:"total"`
	}
	result := map[string]typeSummary{}
	for rows.Next() {
		var ts typeSummary
		if err := rows.Scan(&ts.ScanType, &ts.Critical, &ts.High, &ts.Medium, &ts.Low, &ts.Info, &ts.Total); err != nil {
			continue
		}
		result[ts.ScanType] = ts
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
