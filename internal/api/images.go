package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/adisaputra10/docker-management/internal/models"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/registry"
	"github.com/gorilla/mux"
)

// List Images
func listImages(w http.ResponseWriter, r *http.Request) {
	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	images, err := cli.ImageList(context.Background(), image.ListOptions{
		All: true,
	})
	if err != nil {
		database.LogActivity("list_images", "all", "error")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var imageInfos []models.ImageInfo
	for _, img := range images {
		repository := "<none>"
		tag := "<none>"

		if len(img.RepoTags) > 0 {
			repoTag := img.RepoTags[0]
			// Split repository and tag
			parts := strings.Split(repoTag, ":")
			if len(parts) >= 2 {
				repository = parts[0]
				tag = parts[1]
			} else {
				repository = repoTag
			}
		}

		// Handle case where ID might be shorter than expected? Usually sha256:...
		shortID := ""
		if len(img.ID) > 19 {
			shortID = img.ID[7:19]
		} else {
			shortID = img.ID
		}

		imageInfos = append(imageInfos, models.ImageInfo{
			ID:         shortID,
			Repository: repository,
			Tag:        tag,
			Size:       img.Size,
			Created:    img.Created,
		})
	}

	database.LogActivity("list_images", "all", "success")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(imageInfos)
}

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
	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	out, err := cli.ImagePull(context.Background(), req.Image, image.PullOptions{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		database.LogActivity("pull_image", req.Image, "error")
		return
	}
	defer out.Close()

	// Read and discard output (in production, you might want to stream this)
	io.Copy(io.Discard, out)

	database.LogActivity("pull_image", req.Image, "success")

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

	cli, err := GetClient(r)
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
		database.LogActivity("remove_image", id, "error")
		return
	}

	database.LogActivity("remove_image", id, "success")

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

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	err = cli.ImageTag(context.Background(), req.Source, repo+":"+tag)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		database.LogActivity("tag_image", req.Source+" -> "+req.Target, "error")
		return
	}

	database.LogActivity("tag_image", req.Source+" -> "+req.Target, "success")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Inspect image
func inspectImage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	cli, err := GetClient(r)
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

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	report, err := cli.ImagesPrune(context.Background(), pruneFilters)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		database.LogActivity("prune_images", "all", "error")
		return
	}

	database.LogActivity("prune_images", "all", "success")

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

	cli, err := GetClient(r)
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
