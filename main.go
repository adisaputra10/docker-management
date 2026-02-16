package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
	"github.com/fasthttp/websocket"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
	_ "modernc.org/sqlite"
)

var (
	dockerClient *client.Client
	db           *sql.DB
)

type ContainerInfo struct {
	ID      string            `json:"id"`
	Name    string            `json:"name"`
	Image   string            `json:"image"`
	State   string            `json:"state"`
	Status  string            `json:"status"`
	Created int64             `json:"created"`
	Ports   []string          `json:"ports"`
	Labels  map[string]string `json:"labels"`
}

type ImageInfo struct {
	ID         string `json:"id"`
	Repository string `json:"repository"`
	Tag        string `json:"tag"`
	Size       int64  `json:"size"`
	Created    int64  `json:"created"`
}

type ActivityLog struct {
	ID        int    `json:"id"`
	Action    string `json:"action"`
	Target    string `json:"target"`
	Timestamp string `json:"timestamp"`
	Status    string `json:"status"`
}

func initDB() error {
	var err error

	// Create database directory if it doesn't exist
	if err := os.MkdirAll("./database", 0755); err != nil {
		return fmt.Errorf("failed to create database directory: %v", err)
	}

	db, err = sql.Open("sqlite", "./database/docker-manager.db")
	if err != nil {
		return err
	}

	// Create activity_logs table
	query := `
	CREATE TABLE IF NOT EXISTS activity_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		action TEXT NOT NULL,
		target TEXT NOT NULL,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
		status TEXT NOT NULL
	);
	`
	if _, err = db.Exec(query); err != nil {
		return err
	}

	// Create docker_hosts table
	queryHosts := `
	CREATE TABLE IF NOT EXISTS docker_hosts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		uri TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	if _, err = db.Exec(queryHosts); err != nil {
		return err
	}

	// Insert default Local host if not exists
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM docker_hosts").Scan(&count); err == nil && count == 0 {
		// Detect default socket based on OS (simplified)
		defaultUri := "unix:///var/run/docker.sock"
		if os.Getenv("OS") == "Windows_NT" || os.PathSeparator == '\\' {
			defaultUri = "npipe:////./pipe/docker_engine"
		}

		_, err = db.Exec("INSERT INTO docker_hosts (name, uri) VALUES (?, ?)", "Local", defaultUri)
		if err != nil {
			log.Printf("Failed to insert default host: %v", err)
		}
	}

	return nil
}

func logActivity(action, target, status string) {
	query := `INSERT INTO activity_logs (action, target, status) VALUES (?, ?, ?)`
	_, err := db.Exec(query, action, target, status)
	if err != nil {
		log.Printf("Failed to log activity: %v", err)
	}
}

func getActivityLogs(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, action, target, timestamp, status FROM activity_logs ORDER BY id DESC LIMIT 100")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var logs []ActivityLog
	for rows.Next() {
		var log ActivityLog
		if err := rows.Scan(&log.ID, &log.Action, &log.Target, &log.Timestamp, &log.Status); err != nil {
			continue
		}
		logs = append(logs, log)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}

func listContainers(w http.ResponseWriter, r *http.Request) {
	cli, err := getClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	containers, err := cli.ContainerList(context.Background(), container.ListOptions{
		All: true,
	})
	if err != nil {
		logActivity("list_containers", "all", "error")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var containerInfos []ContainerInfo
	for _, c := range containers {
		var ports []string
		for _, port := range c.Ports {
			if port.PublicPort != 0 {
				ports = append(ports, fmt.Sprintf("%d:%d/%s", port.PublicPort, port.PrivatePort, port.Type))
			}
		}

		name := ""
		if len(c.Names) > 0 {
			name = c.Names[0]
		}

		containerInfos = append(containerInfos, ContainerInfo{
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

	logActivity("list_containers", "all", "success")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(containerInfos)
}

func startContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	cli, err := getClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	err = cli.ContainerStart(context.Background(), containerID, container.StartOptions{})
	if err != nil {
		logActivity("start_container", containerID, "error")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	logActivity("start_container", containerID, "success")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "started"})
}

func stopContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	cli, err := getClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	timeout := 10
	err = cli.ContainerStop(context.Background(), containerID, container.StopOptions{
		Timeout: &timeout,
	})
	if err != nil {
		logActivity("stop_container", containerID, "error")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	logActivity("stop_container", containerID, "success")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "stopped"})
}

func restartContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	cli, err := getClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	timeout := 10
	err = cli.ContainerRestart(context.Background(), containerID, container.StopOptions{
		Timeout: &timeout,
	})
	if err != nil {
		logActivity("restart_container", containerID, "error")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	logActivity("restart_container", containerID, "success")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "restarted"})
}

func removeContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	cli, err := getClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	err = cli.ContainerRemove(context.Background(), containerID, container.RemoveOptions{
		Force: true,
	})
	if err != nil {
		logActivity("remove_container", containerID, "error")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	logActivity("remove_container", containerID, "success")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "removed"})
}

func listImages(w http.ResponseWriter, r *http.Request) {
	cli, err := getClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	images, err := cli.ImageList(context.Background(), image.ListOptions{
		All: true,
	})
	if err != nil {
		logActivity("list_images", "all", "error")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var imageInfos []ImageInfo
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

		imageInfos = append(imageInfos, ImageInfo{
			ID:         img.ID[7:19],
			Repository: repository,
			Tag:        tag,
			Size:       img.Size,
			Created:    img.Created,
		})
	}

	logActivity("list_images", "all", "success")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(imageInfos)
}

func getDockerInfo(w http.ResponseWriter, r *http.Request) {
	cli, err := getClient(r)
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
	cli, err := getClient(r)
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

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// Container exec with WebSocket terminal
func execContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	cli, err := getClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	// Create exec configuration
	execConfig := container.ExecOptions{
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          true,
		Cmd:          []string{"/bin/sh"}, // Try /bin/sh first
	}

	// Try /bin/bash if /bin/sh fails
	execID, err := cli.ContainerExecCreate(context.Background(), containerID, execConfig)
	if err != nil {
		// Try with bash
		execConfig.Cmd = []string{"/bin/bash"}
		execID, err = cli.ContainerExecCreate(context.Background(), containerID, execConfig)
		if err != nil {
			conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Error creating exec: %v\r\n", err)))
			logActivity("exec_container", containerID, "error")
			return
		}
	}

	// Attach to exec
	// Attach to exec
	hijackedResp, err := cli.ContainerExecAttach(context.Background(), execID.ID, container.ExecStartOptions{
		Tty: true,
	})
	if err != nil {
		conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Error attaching to exec: %v\r\n", err)))
		logActivity("exec_container", containerID, "error")
		return
	}
	defer hijackedResp.Close()

	logActivity("exec_container", containerID, "success")

	// Send welcome message
	conn.WriteMessage(websocket.TextMessage, []byte("Connected to container terminal...\r\n"))

	// Channel for errors
	errChan := make(chan error, 2)

	// Goroutine: Read from Docker and write to WebSocket
	go func() {
		buffer := make([]byte, 4096)
		for {
			n, err := hijackedResp.Reader.Read(buffer)
			if err != nil {
				if err != io.EOF {
					errChan <- fmt.Errorf("read from docker: %v", err)
				}
				return
			}
			if n > 0 {
				err = conn.WriteMessage(websocket.TextMessage, buffer[:n])
				if err != nil {
					errChan <- fmt.Errorf("write to websocket: %v", err)
					return
				}
			}
		}
	}()

	// Goroutine: Read from WebSocket and write to Docker
	go func() {
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					errChan <- fmt.Errorf("read from websocket: %v", err)
				}
				return
			}
			_, err = hijackedResp.Conn.Write(message)
			if err != nil {
				errChan <- fmt.Errorf("write to docker: %v", err)
				return
			}
		}
	}()

	// Wait for error or completion
	select {
	case err := <-errChan:
		log.Printf("Exec session ended: %v", err)
	}
}

func main() {
	var err error

	// Initialize Docker client
	dockerClient, err = client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		log.Fatalf("Failed to create Docker client: %v", err)
	}
	defer dockerClient.Close()

	// Test Docker connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = dockerClient.Ping(ctx)
	if err != nil {
		log.Fatalf("Failed to connect to Docker daemon: %v\nMake sure Docker is running and accessible", err)
	}

	log.Println("✓ Successfully connected to Docker daemon")

	// Initialize database
	if err := initDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()
	log.Println("✓ Database initialized")

	// Setup router
	r := mux.NewRouter()

	// API routes
	api := r.PathPrefix("/api").Subrouter()

	// Containers
	api.HandleFunc("/containers", listContainers).Methods("GET")
	api.HandleFunc("/containers/create", createContainer).Methods("POST")
	api.HandleFunc("/containers/prune", pruneContainers).Methods("POST")
	api.HandleFunc("/containers/{id}/start", startContainer).Methods("POST")
	api.HandleFunc("/containers/{id}/stop", stopContainer).Methods("POST")
	api.HandleFunc("/containers/{id}/restart", restartContainer).Methods("POST")
	api.HandleFunc("/containers/{id}/remove", removeContainer).Methods("DELETE")
	api.HandleFunc("/containers/{id}/rename", renameContainer).Methods("POST")
	api.HandleFunc("/containers/{id}/inspect", inspectContainer).Methods("GET")
	api.HandleFunc("/containers/{id}/exec", execContainer).Methods("GET") // WebSocket

	// Images
	api.HandleFunc("/images", listImages).Methods("GET")
	api.HandleFunc("/images/pull", pullImage).Methods("POST")
	api.HandleFunc("/images/search", searchImages).Methods("GET")
	api.HandleFunc("/images/tag", tagImage).Methods("POST")
	api.HandleFunc("/images/prune", pruneImages).Methods("POST")
	api.HandleFunc("/images/{id}/remove", removeImage).Methods("DELETE")
	api.HandleFunc("/images/{id}/inspect", inspectImage).Methods("GET")

	// Volumes
	api.HandleFunc("/volumes", listVolumes).Methods("GET")
	api.HandleFunc("/volumes/create", createVolume).Methods("POST")
	api.HandleFunc("/volumes/prune", pruneVolumes).Methods("POST")
	api.HandleFunc("/volumes/{name}/remove", removeVolume).Methods("DELETE")
	api.HandleFunc("/volumes/{name}/inspect", inspectVolume).Methods("GET")

	// Networks
	api.HandleFunc("/networks", listNetworks).Methods("GET")
	api.HandleFunc("/networks/create", createNetwork).Methods("POST")
	api.HandleFunc("/networks/prune", pruneNetworks).Methods("POST")
	api.HandleFunc("/networks/{id}/remove", removeNetwork).Methods("DELETE")
	api.HandleFunc("/networks/{id}/inspect", inspectNetwork).Methods("GET")
	api.HandleFunc("/networks/{id}/connect", connectNetwork).Methods("POST")
	api.HandleFunc("/networks/{id}/disconnect", disconnectNetwork).Methods("POST")

	// System
	api.HandleFunc("/info", getDockerInfo).Methods("GET")
	api.HandleFunc("/stats", getStats).Methods("GET")
	api.HandleFunc("/logs", getActivityLogs).Methods("GET")

	// Hosts
	api.HandleFunc("/hosts", listHosts).Methods("GET")
	api.HandleFunc("/hosts/create", createHost).Methods("POST")
	api.HandleFunc("/hosts/{id}", removeHost).Methods("DELETE")
	api.HandleFunc("/hosts/{id}/inspect", inspectHost).Methods("GET")

	// Serve static files
	r.PathPrefix("/").Handler(http.FileServer(http.Dir("./frontend")))

	// CORS middleware
	handler := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	}).Handler(r)

	// Start server
	port := "8080"
	log.Printf("🚀 Server starting on http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
