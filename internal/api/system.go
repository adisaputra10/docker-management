package api

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/volume"
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
	volumes, _ := cli.VolumeList(ctx, volume.ListOptions{})
	networks, _ := cli.NetworkList(ctx, types.NetworkListOptions{})
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
					// CPU calculation
					cpuDelta := float64(v.CPUStats.CPUUsage.TotalUsage) - float64(v.PreCPUStats.CPUUsage.TotalUsage)
					systemDelta := float64(v.CPUStats.SystemUsage) - float64(v.PreCPUStats.SystemUsage)
					
					// If PreCPUStats is missing/zero (common in non-streaming requests), approximate usage
					if v.PreCPUStats.SystemUsage == 0 && v.CPUStats.SystemUsage > 0 {
						numCores := float64(len(v.CPUStats.CPUUsage.PercpuUsage))
						if numCores == 0 {
							numCores = 1
						}
						totalCPU += (float64(v.CPUStats.CPUUsage.TotalUsage) / float64(v.CPUStats.SystemUsage)) * numCores * 100.0
					} else if systemDelta > 0.0 && cpuDelta > 0.0 {
						numCores := float64(len(v.CPUStats.CPUUsage.PercpuUsage))
						if numCores == 0 {
							numCores = 1
						}
						totalCPU += (cpuDelta / systemDelta) * numCores * 100.0
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
		"images":   len(images),
		"volumes":  len(volumes.Volumes),
		"networks": len(networks),
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
