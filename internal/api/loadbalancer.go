package api

import (
	"archive/tar"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/go-connections/nat"
	"github.com/gorilla/mux"
)

type LBRoute struct {
	ID            int    `json:"id"`
	Domain        string `json:"domain"`
	HostID        *int   `json:"host_id"`
	ContainerName string `json:"container_name"`
	ContainerPort int    `json:"container_port"`
	ManualIP      string `json:"manual_ip"`
	ManualPort    int    `json:"manual_port"`
	TargetType    string `json:"target_type"` // 'container' or 'manual'
}

func ListLBRoutes(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query("SELECT id, domain, host_id, container_name, container_port, manual_ip, manual_port, target_type FROM load_balancer_routes")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var routes []LBRoute
	for rows.Next() {
		var r LBRoute
		var hostID sql.NullInt64
		var contName, manIP sql.NullString
		var contPort, manPort sql.NullInt64

		if err := rows.Scan(&r.ID, &r.Domain, &hostID, &contName, &contPort, &manIP, &manPort, &r.TargetType); err != nil {
			continue
		}
		if hostID.Valid {
			id := int(hostID.Int64)
			r.HostID = &id
		}
		if contName.Valid {
			r.ContainerName = contName.String
		}
		if contPort.Valid {
			r.ContainerPort = int(contPort.Int64)
		}
		if manIP.Valid {
			r.ManualIP = manIP.String
		}
		if manPort.Valid {
			r.ManualPort = int(manPort.Int64)
		}
		routes = append(routes, r)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(routes)
}

func AddLBRoute(w http.ResponseWriter, r *http.Request) {
	var req LBRoute
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	query := `INSERT INTO load_balancer_routes (domain, host_id, container_name, container_port, manual_ip, manual_port, target_type) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := database.DB.Exec(query, req.Domain, req.HostID, req.ContainerName, req.ContainerPort, req.ManualIP, req.ManualPort, req.TargetType)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := RegenerateConfig(); err != nil {
		fmt.Printf("Error regenerating config: %v\n", err)
		http.Error(w, "Failed to regenerate config: "+err.Error(), 500)
		return
	}

	// Reload Traefik config
	if err := ReloadTraefikConfig(); err != nil {
		fmt.Printf("Error reloading Traefik: %v\n", err)
		// Don't fail, just log
	}

	w.WriteHeader(http.StatusOK)
}

func DeleteLBRoute(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	_, err := database.DB.Exec("DELETE FROM load_balancer_routes WHERE id = ?", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := RegenerateConfig(); err != nil {
		fmt.Printf("Error regenerating config: %v\n", err)
	}

	// Reload Traefik config
	if err := ReloadTraefikConfig(); err != nil {
		fmt.Printf("Error reloading Traefik: %v\n", err)
	}

	w.WriteHeader(http.StatusOK)
}

func EnsureConfigDir() error {
	if err := os.MkdirAll("./config", 0755); err != nil {
		return err
	}
	// Static Traefik Config
	staticConf := `api:
  dashboard: true
  insecure: true
providers:
  file:
    filename: /etc/traefik/dynamic.yml
    watch: true
entryPoints:
  web:
    address: ":80"
`
	// Only write if not exists or force? Write always to ensure correctness.
	return os.WriteFile("./config/traefik.yml", []byte(staticConf), 0644)
}

// toDockerPath converts Windows paths to Docker-compatible format
// C:\path\to\file -> /c/path/to/file
func toDockerPath(winPath string) string {
	if len(winPath) >= 2 && winPath[1] == ':' {
		drive := strings.ToLower(string(winPath[0]))
		path := filepath.ToSlash(winPath[2:])
		return "/" + drive + path
	}
	return filepath.ToSlash(winPath)
}

func RegenerateConfig() error {
	if err := EnsureConfigDir(); err != nil {
		return err
	}

	rows, err := database.DB.Query("SELECT id, domain, host_id, container_name, container_port, manual_ip, manual_port, target_type FROM load_balancer_routes")
	if err != nil {
		return err
	}
	defer rows.Close()

	var sb strings.Builder
	sb.WriteString("http:\n")
	sb.WriteString("  routers:\n")

	var servicesSB strings.Builder
	servicesSB.WriteString("  services:\n")

	for rows.Next() {
		var rt LBRoute
		var hostID sql.NullInt64
		var cn, mip sql.NullString
		var cp, mp sql.NullInt64

		rows.Scan(&rt.ID, &rt.Domain, &hostID, &cn, &cp, &mip, &mp, &rt.TargetType)
		if hostID.Valid {
			id := int(hostID.Int64)
			rt.HostID = &id
		}
		rt.ContainerName = cn.String
		rt.ContainerPort = int(cp.Int64)
		rt.ManualIP = mip.String
		rt.ManualPort = int(mp.Int64)

		serviceName := fmt.Sprintf("svc-%d", rt.ID)
		routerName := fmt.Sprintf("rt-%d", rt.ID)

		// Router
		sb.WriteString(fmt.Sprintf("    %s:\n", routerName))
		sb.WriteString(fmt.Sprintf("      rule: \"Host(`%s`)\"\n", rt.Domain))
		sb.WriteString(fmt.Sprintf("      service: \"%s\"\n", serviceName))

		// Resolve Target
		targetURL := ""
		if rt.TargetType == "manual" {
			targetURL = fmt.Sprintf("http://%s:%d", rt.ManualIP, rt.ManualPort)
		} else {
			// Container target - need to resolve actual accessible URL
			hostIP := "127.0.0.1"
			usePublishedPort := false

			if rt.HostID != nil {
				var uriStr string
				if err := database.DB.QueryRow("SELECT uri FROM docker_hosts WHERE id = ?", *rt.HostID).Scan(&uriStr); err == nil {
					if strings.Contains(uriStr, "npipe") || strings.Contains(uriStr, "unix") {
						// Local Docker - use host.docker.internal
						hostIP = "host.docker.internal"
					} else {
						// Remote Docker - extract IP and use published port
						parts := strings.Split(uriStr, "://")
						if len(parts) > 1 {
							hostPort := parts[1]
							hostIP = strings.Split(hostPort, ":")[0]
							usePublishedPort = true // For remote hosts, we need published port
						}
					}
				}
			}

			// If remote host, get the published port from the actual container
			portToUse := rt.ContainerPort
			if usePublishedPort && rt.HostID != nil {
				// Get client for this host
				cli, err := GetClientByHostID(*rt.HostID)
				if err == nil {
					// Find container and get published port
					containers, err := cli.ContainerList(context.Background(), container.ListOptions{
						All: true,
						Filters: filters.NewArgs(
							filters.Arg("name", rt.ContainerName),
						),
					})

					if err == nil && len(containers) > 0 {
						// Find the published port that maps to our internal port
						for _, port := range containers[0].Ports {
							if int(port.PrivatePort) == rt.ContainerPort && port.PublicPort > 0 {
								portToUse = int(port.PublicPort)
								break
							}
						}
					}
				}
			}

			targetURL = fmt.Sprintf("http://%s:%d", hostIP, portToUse)
		}

		if targetURL != "" {
			servicesSB.WriteString(fmt.Sprintf("    %s:\n", serviceName))
			servicesSB.WriteString("      loadBalancer:\n")
			servicesSB.WriteString("        servers:\n")
			servicesSB.WriteString(fmt.Sprintf("          - url: \"%s\"\n", targetURL))
		}
	}

	fullYaml := sb.String() + servicesSB.String()
	return os.WriteFile("./config/traefik_dynamic.yml", []byte(fullYaml), 0644)
}

// ReloadTraefikConfig updates the config in the running Traefik container
func ReloadTraefikConfig() error {
	// Find Traefik container across all hosts
	rows, err := database.DB.Query("SELECT id FROM docker_hosts")
	if err != nil {
		return fmt.Errorf("database error: %v", err)
	}
	defer rows.Close()

	for rows.Next() {
		var hostID int
		rows.Scan(&hostID)

		cli, err := GetClientByHostID(hostID)
		if err != nil {
			continue
		}

		// Check for Traefik container
		containers, err := cli.ContainerList(context.Background(), container.ListOptions{
			All: true,
			Filters: filters.NewArgs(
				filters.Arg("name", "docker-manager-traefik"),
			),
		})

		if err == nil && len(containers) > 0 {
			containerID := containers[0].ID

			// Read updated config files
			cwd, _ := os.Getwd()
			configDir := filepath.Join(cwd, "config")
			staticConfig, err := os.ReadFile(filepath.Join(configDir, "traefik.yml"))
			if err != nil {
				return fmt.Errorf("failed to read traefik.yml: %v", err)
			}
			dynamicConfig, err := os.ReadFile(filepath.Join(configDir, "traefik_dynamic.yml"))
			if err != nil {
				return fmt.Errorf("failed to read traefik_dynamic.yml: %v", err)
			}

			// Create tar archive
			var buf bytes.Buffer
			tw := tar.NewWriter(&buf)

			// Add traefik.yml
			hdr := &tar.Header{
				Name: "traefik.yml",
				Mode: 0644,
				Size: int64(len(staticConfig)),
			}
			tw.WriteHeader(hdr)
			tw.Write(staticConfig)

			// Add dynamic.yml
			hdr = &tar.Header{
				Name: "dynamic.yml",
				Mode: 0644,
				Size: int64(len(dynamicConfig)),
			}
			tw.WriteHeader(hdr)
			tw.Write(dynamicConfig)
			tw.Close()

			// Copy to container's /etc/traefik
			err = cli.CopyToContainer(context.Background(), containerID, "/etc/traefik", &buf, types.CopyToContainerOptions{})
			if err != nil {
				return fmt.Errorf("failed to copy configs: %v", err)
			}

			// Restart container to apply changes
			timeout := 10
			err = cli.ContainerRestart(context.Background(), containerID, container.StopOptions{
				Timeout: &timeout,
			})
			if err != nil {
				return fmt.Errorf("failed to restart Traefik: %v", err)
			}

			fmt.Printf("✓ Traefik config reloaded successfully on host #%d\n", hostID)
			return nil
		}
	}

	return fmt.Errorf("Traefik container not found on any host")
}

func StartTraefik(w http.ResponseWriter, r *http.Request) {
	if err := RegenerateConfig(); err != nil {
		http.Error(w, "Failed to gen config: "+err.Error(), 500)
		return
	}

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, "Client error: "+err.Error(), 500)
		return
	}
	ctx := context.Background()

	// Check if exists
	_, err = cli.ContainerInspect(ctx, "docker-manager-traefik")
	if err == nil {
		// Just start
		if err := cli.ContainerStart(ctx, "docker-manager-traefik", container.StartOptions{}); err != nil {
			http.Error(w, "Failed to start: "+err.Error(), 500)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"result": "Started existing container"})
		return
	}

	cwd, _ := os.Getwd()
	configDir := filepath.Join(cwd, "config")

	// Get absolute paths for config files
	traefikYml, err := filepath.Abs(filepath.Join(configDir, "traefik.yml"))
	if err != nil {
		http.Error(w, "Failed to resolve path: "+err.Error(), 500)
		return
	}
	traefikDynamicYml, err := filepath.Abs(filepath.Join(configDir, "traefik_dynamic.yml"))
	if err != nil {
		http.Error(w, "Failed to resolve path: "+err.Error(), 500)
		return
	}

	// Ensure config files exist
	if _, err := os.Stat(traefikYml); os.IsNotExist(err) {
		http.Error(w, "Config file not found: "+traefikYml, 500)
		return
	}
	if _, err := os.Stat(traefikDynamicYml); os.IsNotExist(err) {
		http.Error(w, "Dynamic config file not found: "+traefikDynamicYml, 500)
		return
	}

	fmt.Printf("Using config files:\n  Static: %s\n  Dynamic: %s\n", traefikYml, traefikDynamicYml)

	// Create volume for Traefik config
	volumeName := "traefik-config"
	_, err = cli.VolumeCreate(ctx, volume.CreateOptions{
		Name: volumeName,
	})
	if err != nil && !strings.Contains(err.Error(), "already exists") {
		http.Error(w, "Failed to create volume: "+err.Error(), 500)
		return
	}

	// Read config files
	staticConfig, err := os.ReadFile(traefikYml)
	if err != nil {
		http.Error(w, "Failed to read traefik.yml: "+err.Error(), 500)
		return
	}
	dynamicConfig, err := os.ReadFile(traefikDynamicYml)
	if err != nil {
		http.Error(w, "Failed to read traefik_dynamic.yml: "+err.Error(), 500)
		return
	}

	// Use busybox to copy configs to volume
	// Pull busybox image first
	busyboxReader, err := cli.ImagePull(ctx, "docker.io/library/busybox:latest", image.PullOptions{})
	if err != nil {
		http.Error(w, "Failed to pull busybox: "+err.Error(), 500)
		return
	}
	io.Copy(io.Discard, busyboxReader)
	busyboxReader.Close()

	// Create temporary container with volume mounted
	tempContainer, err := cli.ContainerCreate(ctx, &container.Config{
		Image: "busybox",
		Cmd:   []string{"sh", "-c", "echo 'Copying configs...'"},
	}, &container.HostConfig{
		Binds: []string{
			volumeName + ":/config",
		},
	}, nil, nil, "traefik-config-temp")

	if err != nil {
		http.Error(w, "Failed to create temp container: "+err.Error(), 500)
		return
	}

	// Copy files to container using CopyToContainer
	// Create tar archive in memory
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)

	// Add traefik.yml
	hdr := &tar.Header{
		Name: "traefik.yml",
		Mode: 0644,
		Size: int64(len(staticConfig)),
	}
	tw.WriteHeader(hdr)
	tw.Write(staticConfig)

	// Add traefik_dynamic.yml
	hdr = &tar.Header{
		Name: "dynamic.yml",
		Mode: 0644,
		Size: int64(len(dynamicConfig)),
	}
	tw.WriteHeader(hdr)
	tw.Write(dynamicConfig)
	tw.Close()

	// Copy to container
	err = cli.CopyToContainer(ctx, tempContainer.ID, "/config", &buf, types.CopyToContainerOptions{})
	if err != nil {
		cli.ContainerRemove(ctx, tempContainer.ID, container.RemoveOptions{Force: true})
		http.Error(w, "Failed to copy configs: "+err.Error(), 500)
		return
	}

	// Remove temp container
	cli.ContainerRemove(ctx, tempContainer.ID, container.RemoveOptions{Force: true})

	// Pull Image
	reader, err := cli.ImagePull(ctx, "docker.io/library/traefik:v2.10", image.PullOptions{})
	if err != nil {
		http.Error(w, "Pull error: "+err.Error(), 500)
		return
	}
	io.Copy(io.Discard, reader)
	reader.Close()

	resp, err := cli.ContainerCreate(ctx, &container.Config{
		Image: "traefik:v2.10",
		ExposedPorts: nat.PortSet{
			"80/tcp":   struct{}{},
			"8080/tcp": struct{}{},
		},
	}, &container.HostConfig{
		PortBindings: nat.PortMap{
			"80/tcp":   []nat.PortBinding{{HostIP: "0.0.0.0", HostPort: "80"}},
			"8080/tcp": []nat.PortBinding{{HostIP: "0.0.0.0", HostPort: "8081"}},
		},
		Binds: []string{
			volumeName + ":/etc/traefik",
		},
	}, nil, nil, "docker-manager-traefik")

	if err != nil {
		http.Error(w, "Create error: "+err.Error(), 500)
		return
	}

	if err := cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		http.Error(w, "Start error: "+err.Error(), 500)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"result": "Container created and started"})
}

type TraefikStatus struct {
	Running     bool   `json:"running"`
	ContainerID string `json:"container_id"`
	Status      string `json:"status"`
	HostName    string `json:"host_name"`
	HostID      int    `json:"host_id"`
	Ports       string `json:"ports"`
}

// GetTraefikStatus checks if Traefik is running and on which host
func GetTraefikStatus(w http.ResponseWriter, r *http.Request) {
	// Check all hosts for Traefik container
	rows, err := database.DB.Query("SELECT id, name FROM docker_hosts")
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), 500)
		return
	}
	defer rows.Close()

	var status TraefikStatus
	status.Running = false

	for rows.Next() {
		var hostID int
		var hostName string
		rows.Scan(&hostID, &hostName)

		// Get client for this host
		cli, err := GetClientByHostID(hostID)
		if err != nil {
			continue
		}

		// Check for Traefik container
		containers, err := cli.ContainerList(context.Background(), container.ListOptions{
			All: true,
			Filters: filters.NewArgs(
				filters.Arg("name", "docker-manager-traefik"),
			),
		})

		if err == nil && len(containers) > 0 {
			c := containers[0]
			status.Running = c.State == "running"
			status.ContainerID = c.ID[:12]
			status.Status = c.Status
			status.HostName = hostName
			status.HostID = hostID

			// Get port mappings
			ports := []string{}
			for _, port := range c.Ports {
				if port.PublicPort > 0 {
					ports = append(ports, fmt.Sprintf("%d→%d", port.PublicPort, port.PrivatePort))
				}
			}
			status.Ports = strings.Join(ports, ", ")
			break
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}
