package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/adisaputra10/docker-management/internal/models"

	"github.com/docker/docker/client"
	"github.com/gorilla/mux"
)

// List Hosts
func listHosts(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query("SELECT id, name, uri, created_at FROM docker_hosts ORDER BY id ASC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var hosts []models.DockerHost
	for rows.Next() {
		var h models.DockerHost
		if err := rows.Scan(&h.ID, &h.Name, &h.URI, &h.CreatedAt); err != nil {
			continue
		}
		hosts = append(hosts, h)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(hosts)
}

// Create Host
func createHost(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
		URI  string `json:"uri"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.URI == "" {
		http.Error(w, "Name and URI are required", http.StatusBadRequest)
		return
	}

	// Normalize URI
	if !strings.Contains(req.URI, "://") {
		if strings.HasPrefix(req.URI, "/") || strings.HasPrefix(req.URI, ".") {
			req.URI = "unix://" + req.URI
		} else {
			req.URI = "tcp://" + req.URI
		}
	}

	// Test connection first
	cli, err := client.NewClientWithOpts(client.WithHost(req.URI), client.WithAPIVersionNegotiation())
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid host URI: %v", err), http.StatusBadRequest)
		return
	}
	defer cli.Close()

	_, err = cli.Ping(context.Background())
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to connect to host: %v", err), http.StatusBadRequest)
		return
	}

	// Insert into DB
	res, err := database.DB.Exec("INSERT INTO docker_hosts (name, uri) VALUES (?, ?)", req.Name, req.URI)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := res.LastInsertId()

	database.LogActivity("create_host", req.Name, "success")

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"id":      id,
	})
}

// Remove Host
func removeHost(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])

	if id == 1 {
		http.Error(w, "Cannot remove default Local host", http.StatusForbidden)
		return
	}

	_, err := database.DB.Exec("DELETE FROM docker_hosts WHERE id = ?", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Remove from cache using the function in client.go
	ClearClientCache(id)

	database.LogActivity("remove_host", fmt.Sprintf("ID: %d", id), "success")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Inspect Host (Test Connection)
func inspectHost(w http.ResponseWriter, r *http.Request) {
	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	info, err := cli.Info(context.Background())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(info)
}
