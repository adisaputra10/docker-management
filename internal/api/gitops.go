package api

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/gorilla/mux"
)

// ─── Models ──────────────────────────────────────────────────────────────────

type GitopsRepo struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	URL         string  `json:"url"`
	Branch      string  `json:"branch"`
	AuthType    string  `json:"auth_type"`
	AuthToken   *string `json:"auth_token,omitempty"`
	WorkspaceID *string `json:"workspace_id"`
	Description *string `json:"description"`
	CreatedAt   string  `json:"created_at"`
}

type GitopsDeployment struct {
	ID             int     `json:"id"`
	Name           string  `json:"name"`
	RepoID         *int    `json:"repo_id"`
	RepoName       *string `json:"repo_name"`
	DeployType     string  `json:"deploy_type"`
	Namespace      string  `json:"namespace"`
	ChartPath      *string `json:"chart_path"`
	ValuesOverride *string `json:"values_override"`
	ManifestPath   *string `json:"manifest_path"`
	KubeContext    *string `json:"kube_context"`
	Status         string  `json:"status"`
	LastOutput     *string `json:"last_output"`
	WorkspaceID    *string `json:"workspace_id"`
	DeployedAt     *string `json:"deployed_at"`
	CreatedAt      string  `json:"created_at"`
}

// ─── Repos ───────────────────────────────────────────────────────────────────

func ListGitopsRepos(w http.ResponseWriter, r *http.Request) {
	wsID := r.URL.Query().Get("workspace_id")

	var rows *sql.Rows
	var err error
	if wsID != "" {
		rows, err = database.DB.Query(
			`SELECT id, name, url, branch, auth_type, auth_token, workspace_id, description, created_at
			 FROM gitops_repos WHERE workspace_id = ? OR workspace_id IS NULL OR workspace_id = ''
			 ORDER BY created_at DESC`, wsID)
	} else {
		rows, err = database.DB.Query(
			`SELECT id, name, url, branch, auth_type, auth_token, workspace_id, description, created_at
			 FROM gitops_repos ORDER BY created_at DESC`)
	}
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()

	repos := []GitopsRepo{}
	for rows.Next() {
		var rep GitopsRepo
		if err := rows.Scan(&rep.ID, &rep.Name, &rep.URL, &rep.Branch, &rep.AuthType,
			&rep.AuthToken, &rep.WorkspaceID, &rep.Description, &rep.CreatedAt); err != nil {
			continue
		}
		// hide token in list
		rep.AuthToken = nil
		repos = append(repos, rep)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(repos)
}

func CreateGitopsRepo(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		URL         string `json:"url"`
		Branch      string `json:"branch"`
		AuthType    string `json:"auth_type"`
		AuthToken   string `json:"auth_token"`
		WorkspaceID string `json:"workspace_id"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", 400)
		return
	}
	if req.Name == "" || req.URL == "" {
		http.Error(w, "name and url are required", 400)
		return
	}
	if req.Branch == "" {
		req.Branch = "main"
	}
	if req.AuthType == "" {
		req.AuthType = "none"
	}

	res, err := database.DB.Exec(
		`INSERT INTO gitops_repos (name, url, branch, auth_type, auth_token, workspace_id, description)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		req.Name, req.URL, req.Branch, req.AuthType,
		nullStr(req.AuthToken), nullStr(req.WorkspaceID), nullStr(req.Description))
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	id, _ := res.LastInsertId()

	var rep GitopsRepo
	database.DB.QueryRow(
		`SELECT id, name, url, branch, auth_type, auth_token, workspace_id, description, created_at
		 FROM gitops_repos WHERE id = ?`, id).
		Scan(&rep.ID, &rep.Name, &rep.URL, &rep.Branch, &rep.AuthType,
			&rep.AuthToken, &rep.WorkspaceID, &rep.Description, &rep.CreatedAt)
	rep.AuthToken = nil
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(rep)
}

func DeleteGitopsRepo(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if _, err := database.DB.Exec(`DELETE FROM gitops_repos WHERE id = ?`, id); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	// also remove associated deployments
	database.DB.Exec(`DELETE FROM gitops_deployments WHERE repo_id = ?`, id)
	w.WriteHeader(204)
}

// ─── Deployments ─────────────────────────────────────────────────────────────

func ListDeployments(w http.ResponseWriter, r *http.Request) {
	wsID := r.URL.Query().Get("workspace_id")
	repoID := r.URL.Query().Get("repo_id")

	query := `SELECT id, name, repo_id, repo_name, deploy_type, namespace,
	           chart_path, values_override, manifest_path, kube_context,
	           status, last_output, workspace_id, deployed_at, created_at
	          FROM gitops_deployments WHERE 1=1`
	args := []interface{}{}

	if wsID != "" {
		query += ` AND (workspace_id = ? OR workspace_id IS NULL OR workspace_id = '')`
		args = append(args, wsID)
	}
	if repoID != "" {
		query += ` AND repo_id = ?`
		args = append(args, repoID)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()

	deployments := []GitopsDeployment{}
	for rows.Next() {
		var d GitopsDeployment
		if err := rows.Scan(&d.ID, &d.Name, &d.RepoID, &d.RepoName, &d.DeployType,
			&d.Namespace, &d.ChartPath, &d.ValuesOverride, &d.ManifestPath, &d.KubeContext,
			&d.Status, &d.LastOutput, &d.WorkspaceID, &d.DeployedAt, &d.CreatedAt); err != nil {
			continue
		}
		deployments = append(deployments, d)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(deployments)
}

func CreateDeployment(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name           string `json:"name"`
		RepoID         int    `json:"repo_id"`
		DeployType     string `json:"deploy_type"`
		Namespace      string `json:"namespace"`
		ChartPath      string `json:"chart_path"`
		ValuesOverride string `json:"values_override"`
		ManifestPath   string `json:"manifest_path"`
		KubeContext    string `json:"kube_context"`
		WorkspaceID    string `json:"workspace_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", 400)
		return
	}
	if req.Name == "" || req.DeployType == "" {
		http.Error(w, "name and deploy_type are required", 400)
		return
	}
	if req.Namespace == "" {
		req.Namespace = "default"
	}

	// look up repo name
	var repoName string
	if req.RepoID > 0 {
		database.DB.QueryRow(`SELECT name FROM gitops_repos WHERE id = ?`, req.RepoID).Scan(&repoName)
	}

	res, err := database.DB.Exec(
		`INSERT INTO gitops_deployments
		 (name, repo_id, repo_name, deploy_type, namespace, chart_path, values_override, manifest_path, kube_context, workspace_id)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		req.Name, nullInt(req.RepoID), nullStr(repoName), req.DeployType, req.Namespace,
		nullStr(req.ChartPath), nullStr(req.ValuesOverride), nullStr(req.ManifestPath),
		nullStr(req.KubeContext), nullStr(req.WorkspaceID))
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	id, _ := res.LastInsertId()

	var d GitopsDeployment
	database.DB.QueryRow(
		`SELECT id, name, repo_id, repo_name, deploy_type, namespace,
		        chart_path, values_override, manifest_path, kube_context,
		        status, last_output, workspace_id, deployed_at, created_at
		 FROM gitops_deployments WHERE id = ?`, id).
		Scan(&d.ID, &d.Name, &d.RepoID, &d.RepoName, &d.DeployType,
			&d.Namespace, &d.ChartPath, &d.ValuesOverride, &d.ManifestPath, &d.KubeContext,
			&d.Status, &d.LastOutput, &d.WorkspaceID, &d.DeployedAt, &d.CreatedAt)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(d)
}

func GetDeployment(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	var d GitopsDeployment
	err := database.DB.QueryRow(
		`SELECT id, name, repo_id, repo_name, deploy_type, namespace,
		        chart_path, values_override, manifest_path, kube_context,
		        status, last_output, workspace_id, deployed_at, created_at
		 FROM gitops_deployments WHERE id = ?`, id).
		Scan(&d.ID, &d.Name, &d.RepoID, &d.RepoName, &d.DeployType,
			&d.Namespace, &d.ChartPath, &d.ValuesOverride, &d.ManifestPath, &d.KubeContext,
			&d.Status, &d.LastOutput, &d.WorkspaceID, &d.DeployedAt, &d.CreatedAt)
	if err != nil {
		http.Error(w, "Not found", 404)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(d)
}

func DeleteDeployment(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if _, err := database.DB.Exec(`DELETE FROM gitops_deployments WHERE id = ?`, id); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.WriteHeader(204)
}

// TriggerDeploy runs the helm or kubectl deploy command and saves output + status.
func TriggerDeploy(w http.ResponseWriter, r *http.Request) {
	idStr := mux.Vars(r)["id"]
	id, _ := strconv.Atoi(idStr)

	var d GitopsDeployment
	err := database.DB.QueryRow(
		`SELECT id, name, repo_id, repo_name, deploy_type, namespace,
		        chart_path, values_override, manifest_path, kube_context,
		        status, last_output, workspace_id, deployed_at, created_at
		 FROM gitops_deployments WHERE id = ?`, id).
		Scan(&d.ID, &d.Name, &d.RepoID, &d.RepoName, &d.DeployType,
			&d.Namespace, &d.ChartPath, &d.ValuesOverride, &d.ManifestPath, &d.KubeContext,
			&d.Status, &d.LastOutput, &d.WorkspaceID, &d.DeployedAt, &d.CreatedAt)
	if err != nil {
		http.Error(w, "Not found", 404)
		return
	}

	// Mark running
	database.DB.Exec(`UPDATE gitops_deployments SET status = 'running' WHERE id = ?`, id)

	go func() {
		output, runErr := runDeploy(d)
		status := "success"
		if runErr != nil {
			status = "failed"
			output = output + "\nERROR: " + runErr.Error()
		}
		now := time.Now().Format(time.RFC3339)
		database.DB.Exec(
			`UPDATE gitops_deployments SET status = ?, last_output = ?, deployed_at = ? WHERE id = ?`,
			status, output, now, id)
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "running", "message": "Deployment triggered"})
}

// runDeploy builds and runs the helm or kubectl command.
func runDeploy(d GitopsDeployment) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	var cmdArgs []string

	if d.DeployType == "helm" {
		// helm upgrade --install <name> <chart> -n <ns> [--kube-context <ctx>] [-f <values>]
		chartPath := ""
		if d.ChartPath != nil {
			chartPath = *d.ChartPath
		}
		if chartPath == "" {
			return "", fmt.Errorf("chart_path is required for helm deployments")
		}
		releaseName := strings.ReplaceAll(strings.ToLower(d.Name), " ", "-")
		cmdArgs = []string{"upgrade", "--install", releaseName, chartPath, "-n", d.Namespace, "--create-namespace"}
		if d.KubeContext != nil && *d.KubeContext != "" {
			cmdArgs = append(cmdArgs, "--kube-context", *d.KubeContext)
		}
		if d.ValuesOverride != nil && *d.ValuesOverride != "" {
			// write values to a temp file
			tmpFile := fmt.Sprintf("/tmp/gitops-values-%d.yaml", d.ID)
			if err := writeFile(tmpFile, *d.ValuesOverride); err == nil {
				cmdArgs = append(cmdArgs, "-f", tmpFile)
			}
		}
		return runCmd(ctx, "helm", cmdArgs...)
	}

	if d.DeployType == "kubectl" {
		manifestPath := ""
		if d.ManifestPath != nil {
			manifestPath = *d.ManifestPath
		}
		if manifestPath == "" {
			return "", fmt.Errorf("manifest_path is required for kubectl deployments")
		}
		cmdArgs = []string{"apply", "-f", manifestPath, "-n", d.Namespace}
		if d.KubeContext != nil && *d.KubeContext != "" {
			cmdArgs = append(cmdArgs, "--context", *d.KubeContext)
		}
		return runCmd(ctx, "kubectl", cmdArgs...)
	}

	return "", fmt.Errorf("unknown deploy_type: %s", d.DeployType)
}

func runCmd(ctx context.Context, name string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf
	err := cmd.Run()
	return buf.String(), err
}

func writeFile(path, content string) error {
	return os.WriteFile(path, []byte(content), 0644)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func nullInt(i int) interface{} {
	if i == 0 {
		return nil
	}
	return i
}
