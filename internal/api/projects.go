package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/gorilla/mux"
)

// --- User Management ---

func ListUsers(w http.ResponseWriter, r *http.Request) {
	// Verify Admin
	user, success := GetUserFromContext(r.Context())
	if !success || !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	rows, err := database.DB.Query("SELECT id, username, role, created_at FROM users ORDER BY id")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var id int
		var username, role, createdAt string
		if err := rows.Scan(&id, &username, &role, &createdAt); err != nil {
			continue
		}
		users = append(users, map[string]interface{}{
			"id":         id,
			"username":   username,
			"role":       role,
			"created_at": createdAt,
		})
	}

	// Return empty array if no users instead of null
	if users == nil {
		users = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func CreateUser(w http.ResponseWriter, r *http.Request) {
	user, success := GetUserFromContext(r.Context())
	if !success || !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var req struct {
		Username string   `json:"username"`
		Password string   `json:"password"`
		Role     string   `json:"role"`
		Roles    []string `json:"roles"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Username == "" || req.Password == "" {
		http.Error(w, "Username and password are required", http.StatusBadRequest)
		return
	}

	// Support both single Role and multiple Roles
	if len(req.Roles) == 0 && req.Role != "" {
		req.Roles = []string{req.Role}
	}
	if len(req.Roles) == 0 {
		http.Error(w, "At least one role is required", http.StatusBadRequest)
		return
	}

	// Validate each role
	validRoles := map[string]bool{
		"admin":             true,
		"user_docker":       true,
		"user_docker_basic": true,
		"user_k8s_full":     true,
		"user_k8s_view":     true,
		"user_cicd_full":    true,
		"user_cicd_view":    true,
	}
	for _, rr := range req.Roles {
		if !validRoles[strings.TrimSpace(rr)] {
			http.Error(w, "Invalid role: "+rr, http.StatusBadRequest)
			return
		}
	}
	roleStr := strings.Join(req.Roles, ",")

	hashed := hashPassword(req.Password) // defined in auth.go
	_, err := database.DB.Exec("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", req.Username, hashed, roleStr)
	if err != nil {
		http.Error(w, "Error creating user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "User created successfully"})
}

func UpdateUser(w http.ResponseWriter, r *http.Request) {
	user, success := GetUserFromContext(r.Context())
	if !success || !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Username string   `json:"username"`
		Password string   `json:"password"`
		Role     string   `json:"role"`
		Roles    []string `json:"roles"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Support both single Role and multiple Roles
	if len(req.Roles) == 0 && req.Role != "" {
		req.Roles = []string{req.Role}
	}
	if len(req.Roles) == 0 {
		http.Error(w, "At least one role is required", http.StatusBadRequest)
		return
	}

	// Validate each role
	validRoles := map[string]bool{
		"admin":             true,
		"user_docker":       true,
		"user_docker_basic": true,
		"user_k8s_full":     true,
		"user_k8s_view":     true,
		"user_cicd_full":    true,
		"user_cicd_view":    true,
	}
	for _, rr := range req.Roles {
		if !validRoles[strings.TrimSpace(rr)] {
			http.Error(w, "Invalid role: "+rr, http.StatusBadRequest)
			return
		}
	}
	roleStr := strings.Join(req.Roles, ",")

	var err error
	if req.Username != "" && req.Password != "" {
		hashed := hashPassword(req.Password)
		_, err = database.DB.Exec("UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?", req.Username, hashed, roleStr, id)
	} else if req.Username != "" {
		_, err = database.DB.Exec("UPDATE users SET username = ?, role = ? WHERE id = ?", req.Username, roleStr, id)
	} else if req.Password != "" {
		hashed := hashPassword(req.Password)
		_, err = database.DB.Exec("UPDATE users SET password = ?, role = ? WHERE id = ?", hashed, roleStr, id)
	} else {
		_, err = database.DB.Exec("UPDATE users SET role = ? WHERE id = ?", roleStr, id)
	}

	if err != nil {
		http.Error(w, "Error updating user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func DeleteUser(w http.ResponseWriter, r *http.Request) {
	user, success := GetUserFromContext(r.Context())
	if !success || !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	vars := mux.Vars(r)
	id := vars["id"]

	// Delete from user_namespaces first (foreign key constraint)
	_, err := database.DB.Exec("DELETE FROM user_namespaces WHERE user_id = ?", id)
	if err != nil {
		http.Error(w, "Error deleting user namespace assignments: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Then delete from users
	result, err := database.DB.Exec("DELETE FROM users WHERE id = ?", id)
	if err != nil {
		http.Error(w, "Error deleting user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "User deleted successfully"})
}

// --- Project Management ---

type Project struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

func ListProjects(w http.ResponseWriter, r *http.Request) {
	user, success := GetUserFromContext(r.Context())
	if !success {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	query := ""
	args := []interface{}{}

	if HasRole(user.Role, "admin") {
		query = "SELECT id, name, description FROM projects"
	} else {
		query = "SELECT p.id, p.name, p.description FROM projects p JOIN project_users pu ON p.id = pu.project_id WHERE pu.user_id = ?"
		args = append(args, user.ID)
	}

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var p Project
		rows.Scan(&p.ID, &p.Name, &p.Description)
		projects = append(projects, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projects)
}

func CreateProject(w http.ResponseWriter, r *http.Request) {
	user, success := GetUserFromContext(r.Context())
	if !success || !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var req Project
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	_, err := database.DB.Exec("INSERT INTO projects (name, description) VALUES (?, ?)", req.Name, req.Description)
	if err != nil {
		http.Error(w, "Error creating project", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func DeleteProject(w http.ResponseWriter, r *http.Request) {
	user, success := GetUserFromContext(r.Context())
	if !success || !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	vars := mux.Vars(r)
	database.DB.Exec("DELETE FROM projects WHERE id = ?", vars["id"])
	w.WriteHeader(http.StatusOK)
}

// Assign User to Project
func AssignUser(w http.ResponseWriter, r *http.Request) {
	user, success := GetUserFromContext(r.Context())
	if !success || !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	var req struct {
		UserID    int `json:"user_id"`
		ProjectID int `json:"project_id"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	_, err := database.DB.Exec("INSERT OR IGNORE INTO project_users (user_id, project_id) VALUES (?, ?)", req.UserID, req.ProjectID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// Assign Resource (Container) to Project
func AssignResource(w http.ResponseWriter, r *http.Request) {
	user, success := GetUserFromContext(r.Context())
	if !success || !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	var req struct {
		ProjectID int    `json:"project_id"`
		HostID    int    `json:"host_id"`
		Resource  string `json:"resource_identifier"` // Container Name
	}
	json.NewDecoder(r.Body).Decode(&req)

	// Default host if missing
	if req.HostID == 0 {
		req.HostID = 1
	}

	_, err := database.DB.Exec("INSERT OR IGNORE INTO project_resources (project_id, host_id, resource_identifier) VALUES (?, ?, ?)", req.ProjectID, req.HostID, req.Resource)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// Get Project Details (Resources + Users)
func GetProject(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])

	// Check access
	user, success := GetUserFromContext(r.Context())
	if !success {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if !HasRole(user.Role, "admin") {
		// Check assignment
		var count int
		database.DB.QueryRow("SELECT COUNT(*) FROM project_users WHERE project_id = ? AND user_id = ?", id, user.ID).Scan(&count)
		if count == 0 {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
	}

	// Fetch details
	var p Project
	err := database.DB.QueryRow("SELECT id, name, description FROM projects WHERE id = ?", id).Scan(&p.ID, &p.Name, &p.Description)
	if err != nil {
		http.Error(w, "Project not found", http.StatusNotFound)
		return
	}

	// Fetch Users
	userRows, _ := database.DB.Query("SELECT u.id, u.username FROM users u JOIN project_users pu ON u.id = pu.user_id WHERE pu.project_id = ?", id)
	var users []map[string]interface{}
	if userRows != nil {
		for userRows.Next() {
			var uid int
			var uname string
			userRows.Scan(&uid, &uname)
			users = append(users, map[string]interface{}{"id": uid, "username": uname})
		}
		userRows.Close()
	}

	// Fetch Resources
	resRows, _ := database.DB.Query(`
		SELECT pr.host_id, pr.resource_identifier, dh.name 
		FROM project_resources pr 
		LEFT JOIN docker_hosts dh ON pr.host_id = dh.id 
		WHERE pr.project_id = ?`, id)

	var resources []map[string]interface{}
	if resRows != nil {
		for resRows.Next() {
			var hid int
			var rid string
			var hname *string

			err := resRows.Scan(&hid, &rid, &hname)
			if err != nil {
				continue
			}

			hostName := "Unknown"
			if hname != nil {
				hostName = *hname
			}

			resources = append(resources, map[string]interface{}{
				"host_id":   hid,
				"name":      rid,
				"host_name": hostName,
			})
		}
		resRows.Close()
	}

	resp := map[string]interface{}{
		"project":   p,
		"users":     users,
		"resources": resources,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func UnassignUser(w http.ResponseWriter, r *http.Request) {
	user, success := GetUserFromContext(r.Context())
	if !success || !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	var req struct {
		UserID    int `json:"user_id"`
		ProjectID int `json:"project_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	_, err := database.DB.Exec("DELETE FROM project_users WHERE user_id = ? AND project_id = ?", req.UserID, req.ProjectID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func UnassignResource(w http.ResponseWriter, r *http.Request) {
	user, success := GetUserFromContext(r.Context())
	if !success || !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	var req struct {
		ProjectID int    `json:"project_id"`
		HostID    int    `json:"host_id"`
		Resource  string `json:"resource_identifier"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.HostID == 0 {
		req.HostID = 1
	}

	_, err := database.DB.Exec("DELETE FROM project_resources WHERE project_id = ? AND host_id = ? AND resource_identifier = ?", req.ProjectID, req.HostID, req.Resource)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// GetUserNamespaces returns namespaces assigned to a user for a specific cluster
// GET /api/users/{id}/namespaces?cluster_id=123
func GetUserNamespaces(w http.ResponseWriter, r *http.Request) {
	user, success := GetUserFromContext(r.Context())
	if !success || !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	userID := mux.Vars(r)["id"]
	clusterID := r.URL.Query().Get("cluster_id")

	if clusterID == "" {
		http.Error(w, "cluster_id query parameter required", http.StatusBadRequest)
		return
	}

	rows, err := database.DB.Query(`
		SELECT namespace 
		FROM user_namespaces 
		WHERE user_id = ? AND cluster_id = ?
		ORDER BY namespace
	`, userID, clusterID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var namespaces []string
	for rows.Next() {
		var ns string
		if err := rows.Scan(&ns); err != nil {
			continue
		}
		namespaces = append(namespaces, ns)
	}

	w.Header().Set("Content-Type", "application/json")
	if namespaces == nil {
		namespaces = []string{}
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"user_id":     userID,
		"cluster_id":  clusterID,
		"namespaces": namespaces,
	})
}

// AssignUserNamespaces assigns/updates namespaces for a user in a cluster
// POST /api/users/{id}/namespaces
// body: {"cluster_id":1,"namespaces":["default","kube-system"]}
func AssignUserNamespaces(w http.ResponseWriter, r *http.Request) {
	user, success := GetUserFromContext(r.Context())
	if !success || !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	userID := mux.Vars(r)["id"]

	var body struct {
		ClusterID  int      `json:"cluster_id"`
		Namespaces []string `json:"namespaces"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	if body.ClusterID == 0 {
		http.Error(w, "cluster_id required", http.StatusBadRequest)
		return
	}

	// Start transaction
	tx, err := database.DB.Begin()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Delete existing assignments for this user+cluster
	if _, err := tx.Exec(
		"DELETE FROM user_namespaces WHERE user_id = ? AND cluster_id = ?",
		userID, body.ClusterID,
	); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Insert new assignments
	for _, ns := range body.Namespaces {
		if ns != "" {
			if _, err := tx.Exec(
				"INSERT INTO user_namespaces (user_id, cluster_id, namespace) VALUES (?, ?, ?)",
				userID, body.ClusterID, ns,
			); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"user_id":     userID,
		"cluster_id":  body.ClusterID,
		"namespaces": body.Namespaces,
	})
}

// RevokeUserNamespace removes namespace access from a user
// DELETE /api/users/{id}/namespaces/{namespace}?cluster_id=1
func RevokeUserNamespace(w http.ResponseWriter, r *http.Request) {
	user, success := GetUserFromContext(r.Context())
	if !success || !HasRole(user.Role, "admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	vars := mux.Vars(r)
	userID := vars["id"]
	namespace := vars["namespace"]
	clusterID := r.URL.Query().Get("cluster_id")

	if clusterID == "" {
		http.Error(w, "cluster_id query parameter required", http.StatusBadRequest)
		return
	}

	_, err := database.DB.Exec(
		"DELETE FROM user_namespaces WHERE user_id = ? AND cluster_id = ? AND namespace = ?",
		userID, clusterID, namespace,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "revoked"})
}


