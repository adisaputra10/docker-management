package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"

	"github.com/docker/docker/client"
	"github.com/gorilla/mux"
)

// DockerHost struct
type DockerHost struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	URI       string `json:"uri"`
	CreatedAt string `json:"created_at"`
}

// Client Cache
var (
	clientCache = make(map[int]*client.Client)
	cacheMutex  sync.RWMutex
)

// Helper: Get Docker Client based on Request Header
func getClient(r *http.Request) (*client.Client, error) {
	hostIDStr := r.Header.Get("X-Docker-Host-ID")
	if hostIDStr == "" {
		// Default to global local client if no header
		// Or better: default to ID 1 (Local) from DB?
		// For backward compatibility, let's allow falling back to the global 'dockerClient'
		// if it exists, otherwise try ID 1.
		if dockerClient != nil {
			return dockerClient, nil
		}
		hostIDStr = "1"
	}

	hostID, err := strconv.Atoi(hostIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid host id")
	}

	// Check cache
	cacheMutex.RLock()
	if cli, ok := clientCache[hostID]; ok {
		cacheMutex.RUnlock()
		return cli, nil
	}
	cacheMutex.RUnlock()

	// If not in cache, fetch from DB
	var uri string
	err = db.QueryRow("SELECT uri FROM docker_hosts WHERE id = ?", hostID).Scan(&uri)
	if err != nil {
		// Fallback to local if ID 1 and not found (maybe first run)
		if hostID == 1 && dockerClient != nil {
			return dockerClient, nil
		}
		return nil, fmt.Errorf("host not found: %v", err)
	}

	// Create new client
	cli, err := client.NewClientWithOpts(client.WithHost(uri), client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}

	// Cache it
	cacheMutex.Lock()
	clientCache[hostID] = cli
	cacheMutex.Unlock()

	return cli, nil
}

// List Hosts
func listHosts(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, name, uri, created_at FROM docker_hosts ORDER BY id ASC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var hosts []DockerHost
	for rows.Next() {
		var h DockerHost
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
	res, err := db.Exec("INSERT INTO docker_hosts (name, uri) VALUES (?, ?)", req.Name, req.URI)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := res.LastInsertId()

	logActivity("create_host", req.Name, "success")

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

	_, err := db.Exec("DELETE FROM docker_hosts WHERE id = ?", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Remove from cache
	cacheMutex.Lock()
	if cli, ok := clientCache[id]; ok {
		cli.Close()
		delete(clientCache, id)
	}
	cacheMutex.Unlock()

	logActivity("remove_host", fmt.Sprintf("ID: %d", id), "success")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Inspect Host (Test Connection)
func inspectHost(w http.ResponseWriter, r *http.Request) {
	cli, err := getClient(r)
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
