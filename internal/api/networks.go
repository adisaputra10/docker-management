package api

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
	"github.com/gorilla/mux"
)

// List all networks
func listNetworks(w http.ResponseWriter, r *http.Request) {
	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	networks, err := cli.NetworkList(context.Background(), types.NetworkListOptions{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Transform to simple format
	type NetworkResponse struct {
		ID       string            `json:"id"`
		Name     string            `json:"name"`
		Driver   string            `json:"driver"`
		Scope    string            `json:"scope"`
		Created  string            `json:"created"`
		Internal bool              `json:"internal"`
		Labels   map[string]string `json:"labels"`
	}

	var response []NetworkResponse
	for _, net := range networks {
		response = append(response, NetworkResponse{
			ID:       net.ID[:12],
			Name:     net.Name,
			Driver:   net.Driver,
			Scope:    net.Scope,
			Created:  net.Created.Format("2006-01-02 15:04:05"),
			Internal: net.Internal,
			Labels:   net.Labels,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Create network
func createNetwork(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string            `json:"name"`
		Driver   string            `json:"driver"`
		Internal bool              `json:"internal"`
		Labels   map[string]string `json:"labels"`
		Subnet   string            `json:"subnet"`
		Gateway  string            `json:"gateway"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Driver == "" {
		req.Driver = "bridge"
	}

	// Create network config
	config := types.NetworkCreate{
		Driver:   req.Driver,
		Internal: req.Internal,
		Labels:   req.Labels,
	}

	// Add IPAM config if subnet provided
	if req.Subnet != "" {
		config.IPAM = &network.IPAM{
			Config: []network.IPAMConfig{
				{
					Subnet:  req.Subnet,
					Gateway: req.Gateway,
				},
			},
		}
	}

	// Create network
	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	resp, err := cli.NetworkCreate(context.Background(), req.Name, config)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		database.LogActivity("create_network", req.Name, "error")
		return
	}

	database.LogActivity("create_network", req.Name, "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"id":      resp.ID,
		"warning": resp.Warning,
	})
}

// Remove network
func removeNetwork(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	err = cli.NetworkRemove(context.Background(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		database.LogActivity("remove_network", id, "error")
		return
	}

	database.LogActivity("remove_network", id, "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Inspect network
func inspectNetwork(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	net, err := cli.NetworkInspect(context.Background(), id, types.NetworkInspectOptions{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(net)
}

// Connect container to network
func connectNetwork(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	networkID := vars["id"]

	var req struct {
		Container string `json:"container"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	err = cli.NetworkConnect(context.Background(), networkID, req.Container, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		database.LogActivity("connect_network", networkID, "error")
		return
	}

	database.LogActivity("connect_network", networkID+" to "+req.Container, "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Disconnect container from network
func disconnectNetwork(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	networkID := vars["id"]

	var req struct {
		Container string `json:"container"`
		Force     bool   `json:"force"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	err = cli.NetworkDisconnect(context.Background(), networkID, req.Container, req.Force)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		database.LogActivity("disconnect_network", networkID, "error")
		return
	}

	database.LogActivity("disconnect_network", networkID+" from "+req.Container, "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Prune unused networks
func pruneNetworks(w http.ResponseWriter, r *http.Request) {
	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	report, err := cli.NetworksPrune(context.Background(), filters.Args{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		database.LogActivity("prune_networks", "all", "error")
		return
	}

	database.LogActivity("prune_networks", "all", "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":         true,
		"networksDeleted": report.NetworksDeleted,
	})
}
