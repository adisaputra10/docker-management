package api

import (
"encoding/json"
"fmt"
"net"
"net/http"
"time"

"github.com/adisaputra10/docker-management/internal/database"
"github.com/gorilla/mux"
)

//  Models 

type CicdWorker struct {
ID          int    `json:"id"`
Name        string `json:"name"`
Host        string `json:"host"`
SSHPort     int    `json:"ssh_port"`
SSHUser     string `json:"ssh_user"`
AgentType   string `json:"agent_type"`
Labels      string `json:"labels"`
Description string `json:"description"`
WorkspaceID string `json:"workspace_id"`
Status      string `json:"status"`
CreatedAt   string `json:"created_at"`
}

type WorkerRequest struct {
Name          string `json:"name"`
Host          string `json:"host"`
SSHPort       int    `json:"ssh_port"`
SSHUser       string `json:"ssh_user"`
SSHPrivateKey string `json:"ssh_private_key"`
AgentType     string `json:"agent_type"`
Labels        string `json:"labels"`
Description   string `json:"description"`
WorkspaceID   string `json:"workspace_id"`
}

//  Handlers 

// GET /api/cicd/workers  (admin only)
func ListWorkers(w http.ResponseWriter, r *http.Request) {
user, ok := GetUserFromContext(r.Context())
if !ok || !HasRole(user.Role, "admin") {
http.Error(w, "Forbidden", http.StatusForbidden)
return
}
wsID := r.URL.Query().Get("workspace_id")
query := "SELECT id, name, host, ssh_port, ssh_user, agent_type, labels, description, workspace_id, status, created_at FROM cicd_workers"
args := []interface{}{}
if wsID != "" {
query += " WHERE workspace_id = ?"
args = append(args, wsID)
}
query += " ORDER BY created_at DESC"

rows, err := database.DB.Query(query, args...)
if err != nil {
http.Error(w, err.Error(), http.StatusInternalServerError)
return
}
defer rows.Close()

var list []CicdWorker
for rows.Next() {
var wk CicdWorker
if err := rows.Scan(&wk.ID, &wk.Name, &wk.Host, &wk.SSHPort, &wk.SSHUser,
&wk.AgentType, &wk.Labels, &wk.Description, &wk.WorkspaceID, &wk.Status, &wk.CreatedAt); err != nil {
continue
}
list = append(list, wk)
}
if list == nil {
list = []CicdWorker{}
}
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(list)
}

// POST /api/cicd/workers  (admin only)
func CreateWorker(w http.ResponseWriter, r *http.Request) {
user, ok := GetUserFromContext(r.Context())
if !ok || !HasRole(user.Role, "admin") {
http.Error(w, "Forbidden", http.StatusForbidden)
return
}
var req WorkerRequest
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, "Invalid request", http.StatusBadRequest)
return
}
if req.Name == "" {
http.Error(w, "name is required", http.StatusBadRequest)
return
}
if req.Host == "" {
http.Error(w, "host is required", http.StatusBadRequest)
return
}
if req.SSHPort <= 0 {
req.SSHPort = 22
}
if req.SSHUser == "" {
req.SSHUser = "root"
}
if req.AgentType == "" {
req.AgentType = "shell"
}

result, err := database.DB.Exec(
`INSERT INTO cicd_workers (name, host, ssh_port, ssh_user, ssh_private_key, agent_type, labels, description, workspace_id, status)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline')`,
req.Name, req.Host, req.SSHPort, req.SSHUser, req.SSHPrivateKey,
req.AgentType, req.Labels, req.Description, req.WorkspaceID,
)
if err != nil {
http.Error(w, "Error creating worker: "+err.Error(), http.StatusInternalServerError)
return
}
id, _ := result.LastInsertId()
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "id": id})
}

// GET /api/cicd/workers/{id}  (admin only)  includes SSH key
func GetWorker(w http.ResponseWriter, r *http.Request) {
user, ok := GetUserFromContext(r.Context())
if !ok || !HasRole(user.Role, "admin") {
http.Error(w, "Forbidden", http.StatusForbidden)
return
}
id := mux.Vars(r)["id"]
var wk CicdWorker
var sshKey string
err := database.DB.QueryRow(
`SELECT id, name, host, ssh_port, ssh_user, ssh_private_key, agent_type, labels, description, workspace_id, status, created_at
 FROM cicd_workers WHERE id = ?`, id,
).Scan(&wk.ID, &wk.Name, &wk.Host, &wk.SSHPort, &wk.SSHUser, &sshKey,
&wk.AgentType, &wk.Labels, &wk.Description, &wk.WorkspaceID, &wk.Status, &wk.CreatedAt)
if err != nil {
http.Error(w, "Not found", http.StatusNotFound)
return
}
out := map[string]interface{}{
"id":              wk.ID,
"name":            wk.Name,
"host":            wk.Host,
"ssh_port":        wk.SSHPort,
"ssh_user":        wk.SSHUser,
"ssh_private_key": sshKey,
"agent_type":      wk.AgentType,
"labels":          wk.Labels,
"description":     wk.Description,
"workspace_id":    wk.WorkspaceID,
"status":          wk.Status,
"created_at":      wk.CreatedAt,
}
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(out)
}

// DELETE /api/cicd/workers/{id}  (admin only)
func DeleteWorker(w http.ResponseWriter, r *http.Request) {
user, ok := GetUserFromContext(r.Context())
if !ok || !HasRole(user.Role, "admin") {
http.Error(w, "Forbidden", http.StatusForbidden)
return
}
id := mux.Vars(r)["id"]
if _, err := database.DB.Exec("DELETE FROM cicd_workers WHERE id = ?", id); err != nil {
http.Error(w, err.Error(), http.StatusInternalServerError)
return
}
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// POST /api/cicd/workers/{id}/test  (admin only)  test SSH port of saved worker
func TestWorkerSSH(w http.ResponseWriter, r *http.Request) {
user, ok := GetUserFromContext(r.Context())
if !ok || !HasRole(user.Role, "admin") {
http.Error(w, "Forbidden", http.StatusForbidden)
return
}
id := mux.Vars(r)["id"]

var host string
var port int
err := database.DB.QueryRow(
`SELECT host, ssh_port FROM cicd_workers WHERE id = ?`, id,
).Scan(&host, &port)
if err != nil {
http.Error(w, "Worker not found", http.StatusNotFound)
return
}

result := probeSSHPort(host, port)

newStatus := "offline"
if result["success"].(bool) {
newStatus = "online"
}
database.DB.Exec("UPDATE cicd_workers SET status = ? WHERE id = ?", newStatus, id) //nolint:errcheck

w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(result)
}

// POST /api/cicd/workers/test-ssh  (admin only)  test before saving
func TestWorkerSSHDirect(w http.ResponseWriter, r *http.Request) {
user, ok := GetUserFromContext(r.Context())
if !ok || !HasRole(user.Role, "admin") {
http.Error(w, "Forbidden", http.StatusForbidden)
return
}
var req struct {
Host    string `json:"host"`
SSHPort int    `json:"ssh_port"`
}
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, "Invalid request", http.StatusBadRequest)
return
}
if req.SSHPort <= 0 {
req.SSHPort = 22
}
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(probeSSHPort(req.Host, req.SSHPort))
}

// probeSSHPort does a TCP dial to check if the SSH port is reachable.
func probeSSHPort(host string, port int) map[string]interface{} {
if host == "" {
return map[string]interface{}{"success": false, "message": "Host is required"}
}
addr := fmt.Sprintf("%s:%d", host, port)
conn, err := net.DialTimeout("tcp", addr, 8*time.Second)
if err != nil {
return map[string]interface{}{
"success": false,
"message": fmt.Sprintf("Cannot reach %s: %s", addr, err.Error()),
}
}
conn.Close()
return map[string]interface{}{
"success": true,
"message": fmt.Sprintf("SSH port %d is reachable on %s", port, host),
}
}
