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

	ctx := context.Background()
	containers, _ := cli.ContainerList(ctx, container.ListOptions{All: true})
	images, _ := cli.ImageList(ctx, image.ListOptions{All: true})
	info, _ := cli.Info(ctx)

	var totalCPU float64
	var totalMem uint64
	runningContainers := 0

	for _, c := range containers {
		if c.State == "running" {
			runningContainers++
			// Get stats for running containers
			s, err := cli.ContainerStats(ctx, c.ID, false)
			if err == nil {
				var v container.StatsResponse
				if err := json.NewDecoder(s.Body).Decode(&v); err == nil {
					// CPU calculation (very simplified)
					cpuDelta := float64(v.CPUStats.CPUUsage.TotalUsage) - float64(v.PreCPUStats.CPUUsage.TotalUsage)
					systemDelta := float64(v.CPUStats.SystemUsage) - float64(v.PreCPUStats.SystemUsage)
					if systemDelta > 0.0 && cpuDelta > 0.0 {
						totalCPU += (cpuDelta / systemDelta) * float64(len(v.CPUStats.CPUUsage.PercpuUsage)) * 100.0
					}
					// Memory calculation
					totalMem += v.MemoryStats.Usage
				}
				s.Body.Close()
			}
		}
	}

	stats := map[string]interface{}{
		"containers": map[string]int{
			"total":   len(containers),
			"running": runningContainers,
			"stopped": len(containers) - runningContainers,
		},
		"images": len(images),
		"usage": map[string]interface{}{
			"cpu":    totalCPU,
			"memory": totalMem,
		},
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
