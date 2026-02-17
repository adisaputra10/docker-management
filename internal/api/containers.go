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
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"
	"github.com/gorilla/mux"
)

// List Containers
func listContainers(w http.ResponseWriter, r *http.Request) {
	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	containers, err := cli.ContainerList(context.Background(), container.ListOptions{
		All: true,
	})
	if err != nil {
		database.LogActivity("list_containers", "all", "error")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Filter for RBAC
	user, success := GetUserFromContext(r.Context())
	allowedContainers := make(map[string]bool)
	isAdmin := false
	if success {
		if user.Role == "admin" {
			isAdmin = true
		} else {
			// Fetch allowed containers for this user and host
			hostIDStr := r.Header.Get("X-Docker-Host-ID")
			if hostIDStr == "" {
				hostIDStr = "1"
			}
			hostID, _ := strconv.Atoi(hostIDStr)

			rows, err := database.DB.Query(`
				SELECT pr.resource_identifier 
				FROM project_resources pr 
				JOIN project_users pu ON pr.project_id = pu.project_id 
				WHERE pu.user_id = ? AND pr.host_id = ?`, user.ID, hostID)

			if err == nil {
				defer rows.Close()
				for rows.Next() {
					var name string
					if err := rows.Scan(&name); err == nil {
						allowedContainers[name] = true
					}
				}
			}
		}
	}

	var containerInfos []models.ContainerInfo
	for _, c := range containers {
		name := ""
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
		}

		// Apply filter
		if success && !isAdmin {
			if !allowedContainers[name] {
				continue
			}
		}

		var ports []string
		for _, port := range c.Ports {
			if port.PublicPort != 0 {
				ports = append(ports, fmt.Sprintf("%d:%d/%s", port.PublicPort, port.PrivatePort, port.Type))
			}
		}

		containerInfos = append(containerInfos, models.ContainerInfo{
			ID:      c.ID[:12],
			Name:    name,
			Image:   c.Image,
			State:   c.State,
			Status:  c.Status,
			Created: c.Created,
			Ports:   ports,
			Labels:  c.Labels,
		})
	}

	database.LogActivity("list_containers", "all", "success")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(containerInfos)
}

// Create container
func createContainer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name          string            `json:"name"`
		Image         string            `json:"image"`
		Cmd           []string          `json:"cmd"`
		Env           []string          `json:"env"`
		Ports         []string          `json:"ports"`         // format: "8080:80/tcp"
		Volumes       []string          `json:"volumes"`       // format: "/host:/container"
		NetworkMode   string            `json:"networkMode"`   // bridge, host, none
		RestartPolicy string            `json:"restartPolicy"` // no, always, on-failure, unless-stopped
		Labels        map[string]string `json:"labels"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Image == "" {
		http.Error(w, "Image is required", http.StatusBadRequest)
		return
	}

	// Set defaults
	if req.NetworkMode == "" {
		req.NetworkMode = "bridge"
	}
	if req.RestartPolicy == "" {
		req.RestartPolicy = "no"
	}

	// Parse port bindings
	portBindings := nat.PortMap{}
	exposedPorts := nat.PortSet{}

	for _, portStr := range req.Ports {
		parts := strings.Split(portStr, ":")
		if len(parts) >= 2 {
			hostPort := parts[0]
			containerPort := parts[1]

			// Handle protocol (tcp/udp)
			if !strings.Contains(containerPort, "/") {
				containerPort += "/tcp"
			}

			port, err := nat.NewPort(strings.Split(containerPort, "/")[1], strings.Split(containerPort, "/")[0])
			if err != nil {
				continue
			}

			portBindings[port] = []nat.PortBinding{
				{
					HostIP:   "0.0.0.0",
					HostPort: hostPort,
				},
			}

			exposedPorts[port] = struct{}{}
		}
	}

	// Parse volume bindings
	binds := []string{}
	binds = append(binds, req.Volumes...)

	// Create container config
	config := &container.Config{
		Image:        req.Image,
		Cmd:          req.Cmd,
		Env:          req.Env,
		ExposedPorts: exposedPorts,
		Labels:       req.Labels,
	}

	// Parse restart policy
	var restartPolicy container.RestartPolicy
	switch req.RestartPolicy {
	case "always":
		restartPolicy = container.RestartPolicy{Name: container.RestartPolicyAlways}
	case "on-failure":
		restartPolicy = container.RestartPolicy{
			Name:              container.RestartPolicyOnFailure,
			MaximumRetryCount: 3,
		}
	case "unless-stopped":
		restartPolicy = container.RestartPolicy{Name: container.RestartPolicyUnlessStopped}
	default:
		restartPolicy = container.RestartPolicy{Name: container.RestartPolicyDisabled}
	}

	// Create host config
	hostConfig := &container.HostConfig{
		PortBindings:  portBindings,
		Binds:         binds,
		NetworkMode:   container.NetworkMode(req.NetworkMode),
		RestartPolicy: restartPolicy,
	}

	// Create network config
	networkConfig := &network.NetworkingConfig{}

	// Get docker client
	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Create container
	resp, err := cli.ContainerCreate(
		context.Background(),
		config,
		hostConfig,
		networkConfig,
		nil,
		req.Name,
	)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		database.LogActivity("create_container", req.Name, "error")
		return
	}

	database.LogActivity("create_container", req.Name, "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"id":       resp.ID,
		"warnings": resp.Warnings,
	})
}

// Rename container
func renameContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Name string `json:"name"`
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

	err = cli.ContainerRename(context.Background(), id, req.Name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		database.LogActivity("rename_container", id, "error")
		return
	}

	database.LogActivity("rename_container", id+" -> "+req.Name, "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Inspect container
func inspectContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	info, err := cli.ContainerInspect(context.Background(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(info)
}

// Prune stopped containers
func pruneContainers(w http.ResponseWriter, r *http.Request) {
	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	report, err := cli.ContainersPrune(context.Background(), filters.Args{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		database.LogActivity("prune_containers", "all", "error")
		return
	}

	database.LogActivity("prune_containers", "all", "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":           true,
		"containersDeleted": report.ContainersDeleted,
		"spaceReclaimed":    report.SpaceReclaimed,
	})
}

func startContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	err = cli.ContainerStart(context.Background(), containerID, container.StartOptions{})
	if err != nil {
		database.LogActivity("start_container", containerID, "error")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	database.LogActivity("start_container", containerID, "success")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "started"})
}

func stopContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	timeout := 10
	err = cli.ContainerStop(context.Background(), containerID, container.StopOptions{
		Timeout: &timeout,
	})
	if err != nil {
		database.LogActivity("stop_container", containerID, "error")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	database.LogActivity("stop_container", containerID, "success")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "stopped"})
}

func restartContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	timeout := 10
	err = cli.ContainerRestart(context.Background(), containerID, container.StopOptions{
		Timeout: &timeout,
	})
	if err != nil {
		database.LogActivity("restart_container", containerID, "error")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	database.LogActivity("restart_container", containerID, "success")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "restarted"})
}

func removeContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	err = cli.ContainerRemove(context.Background(), containerID, container.RemoveOptions{
		Force: true,
	})
	if err != nil {
		database.LogActivity("remove_container", containerID, "error")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	database.LogActivity("remove_container", containerID, "success")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "removed"})
}

// GetHostContainers returns containers for a specific host by ID
func GetHostContainers(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	hostIDStr := vars["id"]
	hostID, err := strconv.Atoi(hostIDStr)
	if err != nil {
		http.Error(w, "Invalid host ID", http.StatusBadRequest)
		return
	}

	// Get Docker client for this specific host
	cli, err := GetClientByHostID(hostID)
	if err != nil {
		http.Error(w, "Failed to connect to host: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// List all containers
	containers, err := cli.ContainerList(context.Background(), container.ListOptions{
		All: true,
	})
	if err != nil {
		http.Error(w, "Failed to list containers: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(containers)
}
