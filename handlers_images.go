package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/registry"
	"github.com/gorilla/mux"
)

// Pull image from registry
func pullImage(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Image string `json:"image"` // format: "image:tag" or just "image"
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Image == "" {
		http.Error(w, "Image name is required", http.StatusBadRequest)
		return
	}

	// Add :latest if no tag specified
	if !strings.Contains(req.Image, ":") {
		req.Image += ":latest"
	}

	// Pull image
	cli, err := getClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	out, err := cli.ImagePull(context.Background(), req.Image, image.PullOptions{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		logActivity("pull_image", req.Image, "error")
		return
	}
	defer out.Close()

	// Read and discard output (in production, you might want to stream this)
	io.Copy(io.Discard, out)

	logActivity("pull_image", req.Image, "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"image":   req.Image,
	})
}

// Remove image
func removeImage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Get force parameter from query
	force := r.URL.Query().Get("force") == "true"

	cli, err := getClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	_, err = cli.ImageRemove(context.Background(), id, image.RemoveOptions{
		Force:         force,
		PruneChildren: true,
	})

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		logActivity("remove_image", id, "error")
		return
	}

	logActivity("remove_image", id, "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Tag image
func tagImage(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Source string `json:"source"` // source image ID or name
		Target string `json:"target"` // new tag (repo:tag format)
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Parse target into repo and tag
	parts := strings.Split(req.Target, ":")
	repo := parts[0]
	tag := "latest"
	if len(parts) > 1 {
		tag = parts[1]
	}

	cli, err := getClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	err = cli.ImageTag(context.Background(), req.Source, repo+":"+tag)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		logActivity("tag_image", req.Source+" -> "+req.Target, "error")
		return
	}

	logActivity("tag_image", req.Source+" -> "+req.Target, "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Inspect image
func inspectImage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	cli, err := getClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	img, _, err := cli.ImageInspectWithRaw(context.Background(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(img)
}

// Prune unused images
func pruneImages(w http.ResponseWriter, r *http.Request) {
	// Get dangling parameter (true = only dangling, false = all unused)
	dangling := r.URL.Query().Get("dangling") != "false"

	var pruneFilters filters.Args
	if dangling {
		pruneFilters = filters.NewArgs()
		pruneFilters.Add("dangling", "true")
	}

	cli, err := getClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	report, err := cli.ImagesPrune(context.Background(), pruneFilters)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		logActivity("prune_images", "all", "error")
		return
	}

	logActivity("prune_images", "all", "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":        true,
		"imagesDeleted":  report.ImagesDeleted,
		"spaceReclaimed": report.SpaceReclaimed,
	})
}

// Search images in Docker Hub
func searchImages(w http.ResponseWriter, r *http.Request) {
	term := r.URL.Query().Get("term")
	if term == "" {
		http.Error(w, "Search term is required", http.StatusBadRequest)
		return
	}

	cli, err := getClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	results, err := cli.ImageSearch(context.Background(), term, registry.SearchOptions{
		Limit: 25,
	})

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
