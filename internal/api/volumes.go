package api

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/volume"
	"github.com/gorilla/mux"
)

// List all volumes
func listVolumes(w http.ResponseWriter, r *http.Request) {
	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	volumes, err := cli.VolumeList(context.Background(), volume.ListOptions{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	containers, _ := cli.ContainerList(context.Background(), container.ListOptions{All: true})
	usedVolumes := make(map[string]bool)
	for _, c := range containers {
		for _, m := range c.Mounts {
			if m.Type == "volume" {
				usedVolumes[m.Name] = true
			}
		}
	}

	// Transform to simple format
	type VolumeResponse struct {
		Name       string            `json:"name"`
		Driver     string            `json:"driver"`
		Mountpoint string            `json:"mountpoint"`
		CreatedAt  string            `json:"created"`
		Labels     map[string]string `json:"labels"`
		Scope      string            `json:"scope"`
		Options    map[string]string `json:"options"`
		Used       bool              `json:"used"`
	}

	response := []VolumeResponse{}
	for _, vol := range volumes.Volumes {
		response = append(response, VolumeResponse{
			Name:       vol.Name,
			Driver:     vol.Driver,
			Mountpoint: vol.Mountpoint,
			CreatedAt:  vol.CreatedAt,
			Labels:     vol.Labels,
			Scope:      vol.Scope,
			Options:    vol.Options,
			Used:       usedVolumes[vol.Name],
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Create volume
func createVolume(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name   string            `json:"name"`
		Driver string            `json:"driver"`
		Labels map[string]string `json:"labels"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Driver == "" {
		req.Driver = "local"
	}

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	vol, err := cli.VolumeCreate(context.Background(), volume.CreateOptions{
		Name:   req.Name,
		Driver: req.Driver,
		Labels: req.Labels,
	})

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		database.LogActivity("create_volume", req.Name, "error")
		return
	}

	database.LogActivity("create_volume", vol.Name, "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"volume":  vol,
	})
}

// Remove volume
func removeVolume(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	name := vars["name"]

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	err = cli.VolumeRemove(context.Background(), name, true)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		database.LogActivity("remove_volume", name, "error")
		return
	}

	database.LogActivity("remove_volume", name, "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Inspect volume
func inspectVolume(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	name := vars["name"]

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	vol, err := cli.VolumeInspect(context.Background(), name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(vol)
}

// Prune unused volumes
func pruneVolumes(w http.ResponseWriter, r *http.Request) {
	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	report, err := cli.VolumesPrune(context.Background(), filters.Args{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		database.LogActivity("prune_volumes", "all", "error")
		return
	}

	database.LogActivity("prune_volumes", "all", "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":        true,
		"volumesDeleted": len(report.VolumesDeleted),
		"spaceReclaimed": report.SpaceReclaimed,
	})
}
