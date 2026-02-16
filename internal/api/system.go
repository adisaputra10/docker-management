package api

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
)

func getDockerInfo(w http.ResponseWriter, r *http.Request) {
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

func getStats(w http.ResponseWriter, r *http.Request) {
	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	containers, _ := cli.ContainerList(context.Background(), container.ListOptions{All: true})
	images, _ := cli.ImageList(context.Background(), image.ListOptions{All: true})
	info, _ := cli.Info(context.Background())

	runningContainers := 0
	for _, c := range containers {
		if c.State == "running" {
			runningContainers++
		}
	}

	stats := map[string]interface{}{
		"containers": map[string]int{
			"total":   len(containers),
			"running": runningContainers,
			"stopped": len(containers) - runningContainers,
		},
		"images": len(images),
		"info": map[string]interface{}{
			"serverVersion": info.ServerVersion,
			"os":            info.OperatingSystem,
			"architecture":  info.Architecture,
			"cpus":          info.NCPU,
			"memTotal":      info.MemTotal,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func getActivityLogs(w http.ResponseWriter, r *http.Request) {
	logs, err := database.GetActivityLogs()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}
