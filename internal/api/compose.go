package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/docker/docker/api/types/container"
	dockerfilters "github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/go-connections/nat"
	"github.com/gorilla/mux"
)

// ComposeService represents a single service in a compose deployment request.
type ComposeService struct {
	Name        string            `json:"name"`
	Image       string            `json:"image"`
	Ports       []string          `json:"ports"`       // "hostPort:containerPort"
	Env         []string          `json:"env"`         // "KEY=value"
	Volumes     []string          `json:"volumes"`     // "volumeName:/path" or "/host:/container"
	Restart     string            `json:"restart"`
	DependsOn   []string          `json:"depends_on"`
	NetworkMode string            `json:"network_mode"`
	Command     []string          `json:"command"`
	Labels      map[string]string `json:"labels"`
}

// ComposeDeployRequest is the body for POST /api/compose/deploy.
type ComposeDeployRequest struct {
	Project  string           `json:"project"`   // compose project name
	Services []ComposeService `json:"services"`  // ordered list (deps first)
	Volumes  []string         `json:"volumes"`   // named volumes to pre-create
	Networks []string         `json:"networks"`  // named networks to pre-create
}

// deployComposeStack handles POST /api/compose/deploy
func deployComposeStack(w http.ResponseWriter, r *http.Request) {
	var req ComposeDeployRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.Project == "" || len(req.Services) == 0 {
		http.Error(w, "project and services are required", http.StatusBadRequest)
		return
	}

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	ctx := context.Background()

	// ── 1. Create named volumes ──────────────────────────────────
	for _, vol := range req.Volumes {
		_, err := cli.VolumeCreate(ctx, volume.CreateOptions{
			Name: vol,
			Labels: map[string]string{
				"com.docker.compose.project": req.Project,
				"com.docker.compose.volume":  vol,
			},
		})
		if err != nil {
			// Ignore "already exists" errors
			if !strings.Contains(err.Error(), "already exists") {
				database.LogActivity("compose_deploy", req.Project, "volume_error:"+vol)
			}
		}
	}

	// ── 2. Create named networks ─────────────────────────────────
	defaultNetwork := req.Project + "_default"
	allNetworks := append([]string{defaultNetwork}, req.Networks...)
	networkIDMap := map[string]string{} // networkName -> networkID

	for _, netName := range allNetworks {
		// Check if it already exists
		found := false
		nets, _ := cli.NetworkList(ctx, network.ListOptions{
			Filters: dockerfilters.NewArgs(dockerfilters.Arg("name", netName)),
		})
		for _, n := range nets {
			if n.Name == netName {
				networkIDMap[netName] = n.ID
				found = true
				break
			}
		}
		if !found {
			resp, err := cli.NetworkCreate(ctx, netName, network.CreateOptions{
				Driver: "bridge",
				Labels: map[string]string{
					"com.docker.compose.project": req.Project,
					"com.docker.compose.network": netName,
				},
			})
			if err == nil {
				networkIDMap[netName] = resp.ID
			}
		}
	}

	// ── 3. Deploy each service ───────────────────────────────────
	var created []map[string]string

	for _, svc := range req.Services {
		// Compose labels
		svcLabels := map[string]string{
			"com.docker.compose.project": req.Project,
			"com.docker.compose.service": svc.Name,
			"com.docker.compose.version": "2.0",
		}
		for k, v := range svc.Labels {
			svcLabels[k] = v
		}

		// Pull image if not present
		_, _, inspErr := cli.ImageInspectWithRaw(ctx, svc.Image)
		if inspErr != nil {
			pullReader, pullErr := cli.ImagePull(ctx, svc.Image, image.PullOptions{})
			if pullErr != nil {
				http.Error(w, fmt.Sprintf("Failed to pull image '%s': %v", svc.Image, pullErr), http.StatusInternalServerError)
				database.LogActivity("compose_deploy", req.Project, "pull_error:"+svc.Image)
				return
			}
			io.Copy(io.Discard, pullReader)
			pullReader.Close()
		}

		// Ports
		portBindings := nat.PortMap{}
		exposedPorts := nat.PortSet{}
		for _, p := range svc.Ports {
			parts := strings.SplitN(p, ":", 2)
			if len(parts) == 2 {
				hostPort := parts[0]
				cPort := parts[1]
				if !strings.Contains(cPort, "/") {
					cPort += "/tcp"
				}
				proto := strings.Split(cPort, "/")[1]
				portNum := strings.Split(cPort, "/")[0]
				natPort, err := nat.NewPort(proto, portNum)
				if err != nil {
					continue
				}
				portBindings[natPort] = []nat.PortBinding{{HostIP: "0.0.0.0", HostPort: hostPort}}
				exposedPorts[natPort] = struct{}{}
			}
		}

		// Volumes / binds
		binds := []string{}
		for _, v := range svc.Volumes {
			// named volume "volName:/path" — keep as-is for Docker to handle
			binds = append(binds, v)
		}

		// Restart policy
		var restartPolicy container.RestartPolicy
		switch svc.Restart {
		case "always":
			restartPolicy = container.RestartPolicy{Name: container.RestartPolicyAlways}
		case "on-failure":
			restartPolicy = container.RestartPolicy{Name: container.RestartPolicyOnFailure, MaximumRetryCount: 3}
		case "unless-stopped":
			restartPolicy = container.RestartPolicy{Name: container.RestartPolicyUnlessStopped}
		default:
			restartPolicy = container.RestartPolicy{Name: container.RestartPolicyDisabled}
		}

		// Network mode
		netMode := container.NetworkMode(defaultNetwork)
		if svc.NetworkMode != "" {
			// Translate Compose's service:xxx to Docker Engine's container:xxx
			if strings.HasPrefix(svc.NetworkMode, "service:") {
				serviceName := strings.TrimPrefix(svc.NetworkMode, "service:")
				svc.NetworkMode = "container:" + req.Project + "_" + serviceName + "_1"
			}
			netMode = container.NetworkMode(svc.NetworkMode)
		}

		cfg := &container.Config{
			Image:        svc.Image,
			Env:          svc.Env,
			ExposedPorts: exposedPorts,
			Labels:       svcLabels,
		}
		if len(svc.Command) > 0 {
			cfg.Cmd = svc.Command
		}

		hostCfg := &container.HostConfig{
			PortBindings:  portBindings,
			Binds:         binds,
			RestartPolicy: restartPolicy,
			NetworkMode:   netMode,
		}

		// Remove existing container with same name (re-deploy)
		containerName := req.Project + "_" + svc.Name + "_1"
		_ = cli.ContainerRemove(ctx, containerName, container.RemoveOptions{Force: true})

		resp, err := cli.ContainerCreate(ctx, cfg, hostCfg, &network.NetworkingConfig{}, nil, containerName)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create container '%s': %v", svc.Name, err), http.StatusInternalServerError)
			database.LogActivity("compose_deploy", req.Project, "create_error:"+svc.Name)
			return
		}

		// Start it
		if err := cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
			// Non-fatal — container created but not started (e.g. cli-only profile service)
			database.LogActivity("compose_deploy", req.Project, "start_error:"+svc.Name)
		}

		created = append(created, map[string]string{
			"id":   resp.ID[:12],
			"name": containerName,
			"service": svc.Name,
		})
		database.LogActivity("compose_deploy", req.Project+"/"+svc.Name, "success")
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"project":  req.Project,
		"created":  created,
		"count":    len(created),
	})
}

// removeComposeStack handles DELETE /api/compose/{project}
// Stops and removes all containers that have com.docker.compose.project=<project>
func removeComposeStack(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	project := vars["project"]
	if project == "" {
		http.Error(w, "project is required", http.StatusBadRequest)
		return
	}

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	ctx := context.Background()

	// Find all containers for this project
	f := dockerfilters.NewArgs()
	f.Add("label", "com.docker.compose.project="+project)

	containers, err := cli.ContainerList(ctx, container.ListOptions{All: true, Filters: f})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	removed := []string{}
	for _, c := range containers {
		name := c.ID[:12]
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
		}
		// Check protection
		if protectedContainers[name] {
			continue
		}
		if err := cli.ContainerRemove(ctx, c.ID, container.RemoveOptions{Force: true}); err == nil {
			removed = append(removed, name)
		}
	}

	// Also remove project networks  
	nets, _ := cli.NetworkList(ctx, network.ListOptions{
		Filters: dockerfilters.NewArgs(dockerfilters.Arg("label", "com.docker.compose.project="+project)),
	})
	for _, n := range nets {
		cli.NetworkRemove(ctx, n.ID)
	}

	database.LogActivity("compose_remove", project, "success")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"project": project,
		"removed": removed,
	})
}

// stopComposeStack handles POST /api/compose/{project}/stop
// Stops all containers that have com.docker.compose.project=<project>
func stopComposeStack(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	project := vars["project"]
	if project == "" {
		http.Error(w, "project is required", http.StatusBadRequest)
		return
	}

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	ctx := context.Background()

	// Find all containers for this project
	f := dockerfilters.NewArgs()
	f.Add("label", "com.docker.compose.project="+project)

	containers, err := cli.ContainerList(ctx, container.ListOptions{All: true, Filters: f})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	stopped := []string{}
	for _, c := range containers {
		name := c.ID[:12]
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
		}
		// Check protection
		if protectedContainers[name] {
			continue
		}
		// Stop the container if running
		if c.State == "running" {
			if err := cli.ContainerStop(ctx, c.ID, container.StopOptions{}); err == nil {
				stopped = append(stopped, name)
			}
		}
	}

	database.LogActivity("compose_stop", project, "success")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"project": project,
		"stopped": stopped,
	})
}
