package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/adisaputra10/docker-management/internal/models"
	"github.com/gorilla/mux"
	"golang.org/x/crypto/ssh"
)

// ListK0sClusters returns all k0s clusters
func ListK0sClusters(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query("SELECT id, name, ip_address, username, status, created_at, version, node_count, type FROM k0s_clusters ORDER BY created_at DESC")
	if err != nil {
		log.Printf("Error querying k0s clusters: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	clusters := []models.K0sCluster{}
	for rows.Next() {
		var cluster models.K0sCluster
		var version sql.NullString
		err := rows.Scan(&cluster.ID, &cluster.Name, &cluster.IPAddress, &cluster.Username, &cluster.Status, &cluster.CreatedAt, &version, &cluster.NodeCount, &cluster.Type)
		if err != nil {
			log.Printf("Error scanning cluster: %v", err)
			continue
		}
		if version.Valid {
			cluster.Version = version.String
		}
		clusters = append(clusters, cluster)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(clusters)
}

// CreateK0sCluster creates and provisions a new k0s cluster
func CreateK0sCluster(w http.ResponseWriter, r *http.Request) {
	var req models.K0sClusterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate input
	if req.Name == "" || req.IP == "" {
		http.Error(w, "Name and IP are required", http.StatusBadRequest)
		return
	}

	if req.Type == "" {
		req.Type = "controller"
	}

	// Insert into database
	result, err := database.DB.Exec(
		"INSERT INTO k0s_clusters (name, ip_address, username, password, auth_method, ssh_key, status, created_at, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		req.Name, req.IP, req.Username, req.Password, req.AuthMethod, req.SSHKey, "provisioning", time.Now().Format("2006-01-02 15:04:05"), req.Type,
	)
	if err != nil {
		log.Printf("Error inserting cluster: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, err := result.LastInsertId()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Insert controller node
	_, err = database.DB.Exec(
		"INSERT INTO k0s_nodes (cluster_id, ip_address, role, status) VALUES (?, ?, ?, ?)",
		id, req.IP, "controller", "provisioning",
	)
	if err != nil {
		log.Printf("Error inserting controller node: %v", err)
	}

	// Provision cluster asynchronously
	go provisionK0sCluster(int(id), req)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"message":   "Provisioning started",
		"cluster_id": id,
	})
}

// provisionK0sCluster provisions k0s on local or remote machine
func provisionK0sCluster(id int, req models.K0sClusterRequest) {
	log.Printf("Starting k0s provisioning for cluster %d (%s)", id, req.Name)

	if req.IP == "127.0.0.1" || req.IP == "localhost" {
		// Local execution
		cmd := localProvision(req.Type)
		output, err := cmd.CombinedOutput()
		if err != nil {
			log.Printf("Provisioning error: %v\nOutput: %s", err, string(output))
			updateClusterStatus(id, "failed")
			recordActivityLog("k0s_provision", req.Name, string(output), "failed")
			return
		}
	} else {
		// Remote SSH execution
		if req.Username == "" || req.Password == "" {
			log.Printf("Remote provisioning requires username and password")
			updateClusterStatus(id, "failed")
			return
		}

		// Use SSH sessions for better control
		client, err := connectSSH(req.IP, req.Username, req.Password, "password")
		if err != nil {
			log.Printf("Failed to connect to controller: %v", err)
			updateClusterStatus(id, "failed")
			return
		}
		defer client.Close()

		// Get hostname
		hostnameSession, _ := client.NewSession()
		var hostnameOutput strings.Builder
		hostnameSession.Stdout = &hostnameOutput
		hostnameSession.Run("hostname")
		hostnameSession.Close()
		hostname := strings.TrimSpace(hostnameOutput.String())
		log.Printf("Controller hostname: %s", hostname)

		// Update controller node with hostname
		database.DB.Exec("UPDATE k0s_nodes SET hostname = ? WHERE cluster_id = ? AND role = ?", hostname, id, "controller")

		// Install k0s
		log.Printf("Installing k0s on controller...")
		installSession, _ := client.NewSession()
		var installOutput strings.Builder
		installSession.Stdout = &installOutput
		installSession.Stderr = &installOutput
		err = installSession.Run("curl -sSLf https://get.k0s.sh | sudo sh")
		installSession.Close()
		if err != nil {
			log.Printf("Install output: %s", installOutput.String())
			log.Printf("Failed to install k0s: %v", err)
			updateClusterStatus(id, "failed")
			return
		}

		// Write k0s config with correct API address so token embeds the right IP
		log.Printf("Writing k0s config with api.address=%s ...", req.IP)
		k0sConfig := fmt.Sprintf(
			"apiVersion: k0s.k0sproject.io/v1beta1\nkind: ClusterConfig\nmetadata:\n  name: k0s\nspec:\n  api:\n    address: %s\n    externalAddress: %s\n",
			req.IP, req.IP,
		)
		cfgWriteSession, _ := client.NewSession()
		var cfgWriteOutput strings.Builder
		cfgWriteSession.Stdout = &cfgWriteOutput
		cfgWriteSession.Stderr = &cfgWriteOutput
		cfgWriteCmd := fmt.Sprintf(
			"sudo mkdir -p /etc/k0s && printf '%%s' '%s' | sudo tee /etc/k0s/k0s.yaml > /dev/null",
			strings.ReplaceAll(k0sConfig, "'", "'\\''"),
		)
		err = cfgWriteSession.Run(cfgWriteCmd)
		cfgWriteSession.Close()
		if err != nil {
			log.Printf("Config write output: %s", cfgWriteOutput.String())
			log.Printf("WARNING: Failed to write k0s config: %v - continuing without custom config", err)
		} else {
			log.Printf("✓ k0s config written to /etc/k0s/k0s.yaml")
			// Verify
			verifySession, _ := client.NewSession()
			var verifyOut strings.Builder
			verifySession.Stdout = &verifyOut
			verifySession.Run("sudo cat /etc/k0s/k0s.yaml")
			verifySession.Close()
			log.Printf("k0s config contents:\n%s", strings.TrimSpace(verifyOut.String()))
		}

		// Configure and start controller
		log.Printf("Configuring k0s controller...")
		var installation string
		if req.Type == "worker" {
			installation = "sudo k0s install worker --enable-worker"
		} else {
			installation = "sudo k0s install controller --enable-worker -c /etc/k0s/k0s.yaml"
		}

		configSession, _ := client.NewSession()
		var configOutput strings.Builder
		configSession.Stdout = &configOutput
		configSession.Stderr = &configOutput
		err = configSession.Run(installation)
		configSession.Close()
		if err != nil {
			log.Printf("Config output: %s", configOutput.String())
			log.Printf("Failed to configure k0s: %v", err)
			updateClusterStatus(id, "failed")
			return
		}
		log.Printf("Install output: %s", strings.TrimSpace(configOutput.String()))

		// Start k0s
		log.Printf("Starting k0s service...")
		startSession, _ := client.NewSession()
		var startOutput strings.Builder
		startSession.Stdout = &startOutput
		startSession.Stderr = &startOutput
		err = startSession.Run("sudo k0s start")
		startSession.Close()
		if err != nil {
			log.Printf("Start output: %s", startOutput.String())
			log.Printf("Failed to start k0s: %v", err)
			updateClusterStatus(id, "failed")
			return
		}

		log.Printf("Waiting for k0s to be ready...")
		time.Sleep(10 * time.Second)

		// Fetch and store kubeconfig after cluster is ready
		log.Printf("Fetching kubeconfig from controller...")
		kubeconfigSession, kcErr := client.NewSession()
		if kcErr != nil {
			log.Printf("WARNING: Failed to create kubeconfig session: %v", kcErr)
		} else {
			var kcOut strings.Builder
			var kcErr2 strings.Builder
			kubeconfigSession.Stdout = &kcOut
			kubeconfigSession.Stderr = &kcErr2
			kcRunErr := kubeconfigSession.Run("sudo cat /var/lib/k0s/pki/admin.conf")
			kubeconfigSession.Close()
			if kcRunErr != nil {
				log.Printf("WARNING: Failed to fetch kubeconfig: %v - %s", kcRunErr, kcErr2.String())
			} else {
				kubeconfig := kcOut.String()
				kubeconfig = strings.ReplaceAll(kubeconfig, "localhost", req.IP)
				kubeconfig = strings.ReplaceAll(kubeconfig, "127.0.0.1", req.IP)
				kubeconfig = strings.ReplaceAll(kubeconfig, "10.0.2.15", req.IP)
				_, dbErr := database.DB.Exec("UPDATE k0s_clusters SET kubeconfig = ? WHERE id = ?", kubeconfig, id)
				if dbErr != nil {
					log.Printf("WARNING: Failed to save kubeconfig to DB: %v", dbErr)
				} else {
					log.Printf("✓ Kubeconfig saved to database")
				}
			}
		}
	}

	log.Printf("Provisioning successful for cluster %d", id)
	updateClusterStatus(id, "running")
	
	// Update controller node status
	database.DB.Exec("UPDATE k0s_nodes SET status = ? WHERE cluster_id = ? AND role = ?", "active", id, "controller")
	
	recordActivityLog("k0s_provision", req.Name, "K0s cluster provisioned successfully", "success")

	// Get version info
	getK0sVersion(id)
}

// localProvision creates command for local k0s installation
func localProvision(clusterType string) *exec.Cmd {
	var installation string
	if clusterType == "worker" {
		installation = "sudo k0s install worker --enable-worker"
	} else {
		installation = "sudo k0s install controller --enable-worker"
	}

	// For Linux/Mac, use bash
	if runtime.GOOS == "linux" || runtime.GOOS == "darwin" {
		return exec.Command("bash", "-c", installation+" && sudo k0s start")
	}

	// For Windows, use PowerShell (assuming k0s is available)
	return exec.Command("powershell", "-Command", installation)
}

// remoteProvision creates SSH-based provisioning
func remoteProvision(ip, username, password, clusterType string) (*exec.Cmd, error) {
	var installation string
	if clusterType == "worker" {
		installation = "k0s install worker --enable-worker"
	} else {
		installation = "k0s install controller --enable-worker"
	}

	command := fmt.Sprintf("sudo %s && sudo k0s start", installation)

	// For SSH execution, we'll use sshpass if available, otherwise we'd need a key
	// This is a wrapper that can execute via SSH
	return exec.Command(
		"bash", "-c",
		fmt.Sprintf("sshpass -p '%s' ssh -o StrictHostKeyChecking=no %s@%s '%s'", password, username, ip, command),
	), nil
}

// getK0sVersion retrieves k0s version and updates cluster info
func getK0sVersion(id int) {
	cmd := exec.Command("k0s", "version")
	output, err := cmd.Output()
	if err != nil {
		log.Printf("Error getting k0s version: %v", err)
		return
	}

	version := strings.TrimSpace(string(output))
	database.DB.Exec("UPDATE k0s_clusters SET version = ? WHERE id = ?", version, id)
}

// GetK0sCluster returns a specific cluster
func GetK0sCluster(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var cluster models.K0sCluster
	var version sql.NullString
	err := database.DB.QueryRow(
		"SELECT id, name, ip_address, username, status, created_at, version, node_count, type FROM k0s_clusters WHERE id = ?",
		id,
	).Scan(&cluster.ID, &cluster.Name, &cluster.IPAddress, &cluster.Username, &cluster.Status, &cluster.CreatedAt, &version, &cluster.NodeCount, &cluster.Type)

	if version.Valid {
		cluster.Version = version.String
	}

	if err != nil {
		http.Error(w, "Cluster not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cluster)
}

// DeleteK0sCluster deletes a k0s cluster
func DeleteK0sCluster(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid cluster ID", http.StatusBadRequest)
		return
	}

	var clusterName string
	var ip string
	err = database.DB.QueryRow(
		"SELECT name, ip_address FROM k0s_clusters WHERE id = ?",
		id,
	).Scan(&clusterName, &ip)

	if err != nil {
		http.Error(w, "Cluster not found", http.StatusNotFound)
		return
	}

	// Execute uninstall asynchronously
	go uninstallK0s(id, clusterName, ip)

	_, err = database.DB.Exec("DELETE FROM k0s_clusters WHERE id = ?", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

// uninstallK0s uninstalls k0s from a cluster
func uninstallK0s(id int, name, ip string) {
	var cmd *exec.Cmd

	if ip == "127.0.0.1" || ip == "localhost" {
		cmd = exec.Command("bash", "-c", "sudo k0s stop && sudo k0s remove")
	} else {
		cmd = exec.Command("bash", "-c", fmt.Sprintf("ssh -o StrictHostKeyChecking=no root@%s 'sudo k0s stop && sudo k0s remove'", ip))
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Error uninstalling k0s: %v\nOutput: %s", err, string(output))
	} else {
		log.Printf("K0s uninstalled from %s", name)
	}
}

// TestK0sConnection tests if we can connect to a remote server
func TestK0sConnection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IP         string `json:"ip"`
		Username   string `json:"username"`
		Password   string `json:"password"`
		SSHKey     string `json:"sshKey"`
		AuthMethod string `json:"authMethod"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.IP == "127.0.0.1" || req.IP == "localhost" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"connected": true})
		return
	}

	// Normalize auth method
	authMethod := strings.ToLower(strings.TrimSpace(req.AuthMethod))
	if authMethod != "password" && authMethod != "ssh-key" {
		authMethod = "password" // Default to password
	}

	// Determine credential to use
	credential := req.Password
	if authMethod == "ssh-key" {
		credential = req.SSHKey
	}

	// Test SSH connection using connectSSH function
	log.Printf("Testing connection to %s@%s with auth method: %s", req.Username, req.IP, authMethod)
	conn, err := connectSSH(req.IP, req.Username, credential, authMethod)
	if err != nil {
		log.Printf("Connection test failed: %v", err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"connected": false,
			"error":     fmt.Sprintf("Connection failed: %v", err),
		})
		return
	}
	defer conn.Close()

	log.Printf("Connection test successful to %s@%s", req.Username, req.IP)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"connected": true})
}

// DeploymentRequest is for deploying applications on k0s
type DeploymentRequest struct {
	ClusterID   int    `json:"cluster_id"`
	Name        string `json:"name"`
	Image       string `json:"image"`
	Replicas    int    `json:"replicas"`
	Port        int    `json:"port"`
	ContainerPort int `json:"container_port"`
}

// DeployOnK0s deploys an application on k0s cluster
func DeployOnK0s(w http.ResponseWriter, r *http.Request) {
	var req DeploymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.ClusterID == 0 || req.Name == "" || req.Image == "" {
		http.Error(w, "cluster_id, name, and image are required", http.StatusBadRequest)
		return
	}

	if req.Replicas == 0 {
		req.Replicas = 1
	}
	if req.ContainerPort == 0 {
		req.ContainerPort = 8080
	}

	// Create kubernetes deployment manifest
	yaml := fmt.Sprintf(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: %s
spec:
  replicas: %d
  selector:
    matchLabels:
      app: %s
  template:
    metadata:
      labels:
        app: %s
    spec:
      containers:
      - name: %s
        image: %s
        ports:
        - containerPort: %d
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 100m
            memory: 128Mi
---
apiVersion: v1
kind: Service
metadata:
  name: %s-service
spec:
  selector:
    app: %s
  ports:
  - protocol: TCP
    port: %d
    targetPort: %d
  type: LoadBalancer
`, req.Name, req.Replicas, req.Name, req.Name, req.Name, req.Image, req.ContainerPort, req.Name, req.Name, req.Port, req.ContainerPort)

	// Apply deployment (you'd need to implement kubectl or k0s integration here)
	log.Printf("Deployment manifest for %s:\n%s", req.Name, yaml)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Deployment created",
		"manifest": yaml,
	})
}

// AddWorkerNode adds a worker node to an existing k0s cluster
func AddWorkerNode(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]

	var req struct {
		IP         string `json:"ip"`
		Username   string `json:"username"`
		Password   string `json:"password"`
		SSHKey     string `json:"sshKey"`
		AuthMethod string `json:"authMethod"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate input
	if req.IP == "" || req.Username == "" {
		http.Error(w, "IP and Username are required", http.StatusBadRequest)
		return
	}

	// Normalize auth method
	authMethod := strings.ToLower(strings.TrimSpace(req.AuthMethod))
	if authMethod != "password" && authMethod != "ssh-key" {
		authMethod = "password" // Default to password
	}

	if authMethod == "password" && req.Password == "" {
		http.Error(w, "Password is required", http.StatusBadRequest)
		return
	}

	if authMethod == "ssh-key" && req.SSHKey == "" {
		http.Error(w, "SSH Key is required", http.StatusBadRequest)
		return
	}

	// Get cluster info
	var cluster models.K0sCluster
	var version sql.NullString
	err := database.DB.QueryRow(
		"SELECT id, name, ip_address, username, status, created_at, version, node_count, type FROM k0s_clusters WHERE id = ?",
		clusterID,
	).Scan(&cluster.ID, &cluster.Name, &cluster.IPAddress, &cluster.Username, &cluster.Status, &cluster.CreatedAt, &version, &cluster.NodeCount, &cluster.Type)

	if version.Valid {
		cluster.Version = version.String
	}

	if err != nil {
		log.Printf("Cluster not found: %v", err)
		http.Error(w, "Cluster not found", http.StatusNotFound)
		return
	}

	// Run worker addition in background
	go func() {
		log.Printf("=====================================")
		log.Printf("Starting worker node addition process")
		log.Printf("Cluster ID: %s", clusterID)
		log.Printf("Cluster Name: %s", cluster.Name)
		log.Printf("Cluster IP (from DB): %s", cluster.IPAddress)
		log.Printf("Cluster Username: %s", cluster.Username)
		log.Printf("Worker IP (input): %s", req.IP)
		log.Printf("Worker Username (input): %s", req.Username)
		log.Printf("=====================================")

		// Get controller password from DB
		var controllerPassword string
		database.DB.QueryRow("SELECT password FROM k0s_clusters WHERE id = ?", clusterID).Scan(&controllerPassword)
		log.Printf("[DEBUG] Controller password retrieved from database")

		// Get controller kubeconfig and token
		log.Printf("[CONTROLLER %s] Connecting to controller at %s@%s ...", cluster.IPAddress, cluster.Username, cluster.IPAddress)
		controllerClient, err := connectSSH(cluster.IPAddress, cluster.Username, controllerPassword, "password")
		if err != nil {
			log.Printf("[CONTROLLER %s] ERROR: Failed to connect to controller: %v", cluster.IPAddress, err)
			return
		}
		defer controllerClient.Close()
		log.Printf("[CONTROLLER %s] ✓ Connected successfully", cluster.IPAddress)

		// Get join token from controller
		log.Printf("[CONTROLLER %s] Creating worker token...", cluster.IPAddress)
		controllerSession, err := controllerClient.NewSession()
		if err != nil {
			log.Printf("[CONTROLLER %s] ERROR: Failed to create controller session: %v", cluster.IPAddress, err)
			return
		}
		defer controllerSession.Close()

		var tokenOutput strings.Builder
		var tokenErr strings.Builder
		controllerSession.Stdout = &tokenOutput
		controllerSession.Stderr = &tokenErr
		tokenCmd := "sudo k0s token create --role=worker"
		log.Printf("[CONTROLLER %s] Running: %s", cluster.IPAddress, tokenCmd)
		err = controllerSession.Run(tokenCmd)
		if err != nil {
			log.Printf("[CONTROLLER %s] Token stderr: %s", cluster.IPAddress, tokenErr.String())
			log.Printf("[CONTROLLER %s] Token stdout: %s", cluster.IPAddress, tokenOutput.String())
			log.Printf("[CONTROLLER %s] ERROR: Failed to create worker token: %v", cluster.IPAddress, err)
			return
		}

		token := strings.TrimSpace(tokenOutput.String())
		if token == "" {
			log.Printf("[CONTROLLER %s] ERROR: Empty token received", cluster.IPAddress)
			return
		}
		log.Printf("[CONTROLLER %s] ✓ Worker token created successfully (length: %d chars)", cluster.IPAddress, len(token))

		// Connect to worker node
		// Use SSH key if auth method is ssh-key, otherwise use password
		workerCredential := req.Password
		if authMethod == "ssh-key" {
			workerCredential = req.SSHKey
		}
		
		log.Printf("[WORKER %s] Connecting to worker %s@%s with auth method: %s", req.IP, req.Username, req.IP, authMethod)
		workerClient, err := connectSSH(req.IP, req.Username, workerCredential, authMethod)
		if err != nil {
			log.Printf("[WORKER %s] ERROR: Failed to connect to worker: %v", req.IP, err)
			return
		}
		defer workerClient.Close()

		log.Printf("[WORKER %s] ✓ Connected successfully", req.IP)

		// Install k0s on worker
		log.Printf("[WORKER %s] Step 1: Installing k0s binary...", req.IP)
		installSession, err := workerClient.NewSession()
		if err != nil {
			log.Printf("[WORKER %s] ERROR: Failed to create install session: %v", req.IP, err)
			return
		}
		var installOutput strings.Builder
		var installErr strings.Builder
		installSession.Stdout = &installOutput
		installSession.Stderr = &installErr
		installCmd := "curl -sSLf https://get.k0s.sh | sudo sh"
		log.Printf("[WORKER %s] Running: %s", req.IP, installCmd)
		err = installSession.Run(installCmd)
		installSession.Close()
		if err != nil {
			log.Printf("[WORKER %s] Install stderr: %s", req.IP, installErr.String())
			log.Printf("[WORKER %s] Install stdout: %s", req.IP, installOutput.String())
			log.Printf("[WORKER %s] ERROR: Failed to install k0s: %v", req.IP, err)
		} else {
			log.Printf("[WORKER %s] ✓ k0s binary installed successfully", req.IP)
		}

		// Stop k0s if already running
		log.Printf("[WORKER %s] Step 2: Stopping any existing k0s service...", req.IP)
		stopSession, _ := workerClient.NewSession()
		var stopOutput strings.Builder
		stopSession.Stdout = &stopOutput
		stopCmd := "sudo k0s stop || true"
		log.Printf("[WORKER %s] Running: %s", req.IP, stopCmd)
		stopSession.Run(stopCmd)
		stopSession.Close()
		log.Printf("[WORKER %s] Stop output: %s", req.IP, strings.TrimSpace(stopOutput.String()))
		time.Sleep(2 * time.Second)

		// Reset/cleanup any previous k0s installation
		log.Printf("[WORKER %s] Step 3: Resetting k0s (cleanup previous installation)...", req.IP)
		resetSession, _ := workerClient.NewSession()
		var resetOutput strings.Builder
		resetSession.Stdout = &resetOutput
		resetCmd := "sudo k0s reset || true"
		log.Printf("[WORKER %s] Running: %s", req.IP, resetCmd)
		resetSession.Run(resetCmd)
		resetSession.Close()
		log.Printf("[WORKER %s] Reset output: %s", req.IP, strings.TrimSpace(resetOutput.String()))
		time.Sleep(2 * time.Second)

		// Write token to temporary file on worker
		log.Printf("[WORKER %s] Step 4: Writing join token to worker...", req.IP)
		tokenFile := "/tmp/k0s-token"
		writeTokenSession, err := workerClient.NewSession()
		if err != nil {
			log.Printf("[WORKER %s] ERROR: Failed to create token write session: %v", req.IP, err)
			return
		}
		// Escape token for shell
		escapedToken := strings.ReplaceAll(token, "'", "'\\''")
		writeTokenCmd := fmt.Sprintf("echo '%s' | sudo tee %s > /dev/null", escapedToken, tokenFile)
		var writeTokenOutput strings.Builder
		var writeTokenErr strings.Builder
		writeTokenSession.Stdout = &writeTokenOutput
		writeTokenSession.Stderr = &writeTokenErr
		bashCmd := "bash -c '" + strings.ReplaceAll(writeTokenCmd, "'", "'\\''") + "'"
		log.Printf("[WORKER %s] Running: echo '<TOKEN>' | sudo tee %s", req.IP, tokenFile)
		err = writeTokenSession.Run(bashCmd)
		writeTokenSession.Close()
		if err != nil {
			log.Printf("[WORKER %s] Token write stderr: %s", req.IP, writeTokenErr.String())
			log.Printf("[WORKER %s] ERROR: Failed to write token: %v", req.IP, err)
			return
		}
		log.Printf("[WORKER %s] ✓ Token written successfully", req.IP)

		// Cat token file to verify contents
		catSession, err := workerClient.NewSession()
		if err != nil {
			log.Printf("[WORKER %s] WARNING: Failed to create cat session: %v", req.IP, err)
		} else {
			var catOutput strings.Builder
			var catErr strings.Builder
			catSession.Stdout = &catOutput
			catSession.Stderr = &catErr
			catCmd := fmt.Sprintf("sudo cat %s", tokenFile)
			log.Printf("[WORKER %s] Running: %s", req.IP, catCmd)
			catRunErr := catSession.Run(catCmd)
			catSession.Close()
			if catRunErr != nil {
				log.Printf("[WORKER %s] cat stderr: %s", req.IP, catErr.String())
				log.Printf("[WORKER %s] WARNING: cat token file failed: %v", req.IP, catRunErr)
			} else {
				log.Printf("[WORKER %s] Token file contents:\n%s", req.IP, strings.TrimSpace(catOutput.String()))
			}
		}

		// Install k0s worker with token from file
		log.Printf("[WORKER %s] Step 5: Installing k0s worker role with token...", req.IP)
		joinSession, err := workerClient.NewSession()
		if err != nil {
			log.Printf("[WORKER %s] ERROR: Failed to create join session: %v", req.IP, err)
			return
		}
		var joinOutput strings.Builder
		var joinErr strings.Builder
		joinSession.Stdout = &joinOutput
		joinSession.Stderr = &joinErr
		joinCmd := fmt.Sprintf("sudo k0s install worker --token-file %s", tokenFile)
		log.Printf("[WORKER %s] Running: %s", req.IP, joinCmd)
		err = joinSession.Run(joinCmd)
		joinSession.Close()
		if joinOutput.Len() > 0 {
			log.Printf("[WORKER %s] Join stdout: %s", req.IP, strings.TrimSpace(joinOutput.String()))
		}
		if joinErr.Len() > 0 {
			log.Printf("[WORKER %s] Join stderr: %s", req.IP, strings.TrimSpace(joinErr.String()))
		}
		if err != nil {
			log.Printf("[WORKER %s] ERROR: Failed to install worker: %v", req.IP, err)
			return
		}
		log.Printf("[WORKER %s] ✓ Worker installed successfully", req.IP)

		// Token file kept at /tmp/k0s-token (do NOT delete - removing it causes worker not to appear in cluster)
		log.Printf("[WORKER %s] Step 6: Skipping token file cleanup (file kept at %s)", req.IP, tokenFile)

		// Start k0s worker service using k0s native command
		log.Printf("[WORKER %s] Step 7: Starting k0s worker service...", req.IP)
		startSession, err := workerClient.NewSession()
		if err != nil {
			log.Printf("[WORKER %s] ERROR: Failed to create start session: %v", req.IP, err)
			return
		}
		var startOutput strings.Builder
		var startErr strings.Builder
		startSession.Stdout = &startOutput
		startSession.Stderr = &startErr
		// Use 'sudo k0s start' which is the k0s-native way, handles systemd internally
		startCmd := "sudo k0s start"
		log.Printf("[WORKER %s] Running: %s", req.IP, startCmd)
		err = startSession.Run(startCmd)
		startSession.Close()
		if err != nil {
			log.Printf("[WORKER %s] Start stderr: %s", req.IP, startErr.String())
			log.Printf("[WORKER %s] Start stdout: %s", req.IP, startOutput.String())
			log.Printf("[WORKER %s] WARNING: k0s start failed: %v, trying systemctl fallback...", req.IP, err)

			// Fallback: try systemctl enable + start
			fallbackSession, _ := workerClient.NewSession()
			var fbOut strings.Builder
			fallbackSession.Stdout = &fbOut
			fallbackSession.Stderr = &fbOut
			fallbackCmd := "sudo systemctl enable k0s && sudo systemctl start k0s"
			log.Printf("[WORKER %s] Fallback running: %s", req.IP, fallbackCmd)
			fbErr := fallbackSession.Run(fallbackCmd)
			fallbackSession.Close()
			if fbErr != nil {
				log.Printf("[WORKER %s] Fallback output: %s", req.IP, fbOut.String())
				log.Printf("[WORKER %s] WARNING: Fallback also failed: %v", req.IP, fbErr)
			} else {
				log.Printf("[WORKER %s] ✓ k0s worker service started via systemctl fallback", req.IP)
			}
		} else {
			log.Printf("[WORKER %s] ✓ k0s worker service started", req.IP)
		}

		// Wait for worker to connect
		log.Printf("[WORKER %s] Step 8: Waiting 15 seconds for worker to connect to cluster...", req.IP)
		time.Sleep(15 * time.Second)

		// Get hostname from worker
		log.Printf("[WORKER %s] Step 9: Getting hostname from worker...", req.IP)
		hostnameSession, _ := workerClient.NewSession()
		var hostnameOutput strings.Builder
		hostnameSession.Stdout = &hostnameOutput
		hostnameCmd := "hostname"
		log.Printf("[WORKER %s] Running: %s", req.IP, hostnameCmd)
		hostnameSession.Run(hostnameCmd)
		hostnameSession.Close()
		hostname := strings.TrimSpace(hostnameOutput.String())
		log.Printf("[WORKER %s] Hostname: %s", req.IP, hostname)

		// Verify worker status on worker node
		log.Printf("[WORKER %s] Step 10: Checking k0s status on worker...", req.IP)
		statusSession, _ := workerClient.NewSession()
		var statusOutput strings.Builder
		statusSession.Stdout = &statusOutput
		statusCmd := "sudo k0s status"
		log.Printf("[WORKER %s] Running: %s", req.IP, statusCmd)
		statusSession.Run(statusCmd)
		statusSession.Close()
		log.Printf("[WORKER %s] k0s status output:\n%s", req.IP, statusOutput.String())

		// Verify from controller that node joined
		log.Printf("[CONTROLLER %s] Step 11: Getting kubectl nodes from controller...", cluster.IPAddress)
		verifySession, err := controllerClient.NewSession()
		if err != nil {
			log.Printf("[CONTROLLER %s] ERROR: Failed to create verify session: %v", cluster.IPAddress, err)
		} else {
			var verifyOutput strings.Builder
			var verifyErr strings.Builder
			verifySession.Stdout = &verifyOutput
			verifySession.Stderr = &verifyErr
			verifyCmd := "sudo k0s kubectl get nodes -o wide"
			log.Printf("[CONTROLLER %s] Running: %s", cluster.IPAddress, verifyCmd)
			err := verifySession.Run(verifyCmd)
			verifySession.Close()
			if err != nil {
				log.Printf("[CONTROLLER %s] Verify stderr: %s", cluster.IPAddress, verifyErr.String())
				log.Printf("[CONTROLLER %s] ERROR: kubectl get nodes failed: %v", cluster.IPAddress, err)
			}
			log.Printf("[CONTROLLER %s] Cluster nodes:\n%s", cluster.IPAddress, verifyOutput.String())

			// Check if worker is in the list
			output := verifyOutput.String()
			if strings.Contains(output, hostname) || strings.Contains(output, req.IP) {
				log.Printf("[SUCCESS] ✓✓✓ Worker %s (%s) found in cluster!", hostname, req.IP)
			} else {
				log.Printf("[WARNING] ⚠️ Worker %s (%s) NOT found in cluster nodes list!", hostname, req.IP)
				log.Printf("[DEBUG] Worker hostname: %s, Worker IP: %s", hostname, req.IP)
			}
		}

		// Update node count
		log.Printf("[DATABASE] Step 12: Updating node count in database...")
		_, err = database.DB.Exec("UPDATE k0s_clusters SET node_count = node_count + 1 WHERE id = ?", clusterID)
		if err != nil {
			log.Printf("[DATABASE] ERROR: Failed to update node count: %v", err)
		} else {
			log.Printf("[DATABASE] ✓ Node count updated")
		}

		// Insert worker node to k0s_nodes with hostname
		log.Printf("[DATABASE] Step 13: Inserting worker node record (IP: %s, Hostname: %s, Role: worker)...", req.IP, hostname)
		_, err = database.DB.Exec(
			"INSERT OR REPLACE INTO k0s_nodes (cluster_id, ip_address, hostname, role, status) VALUES (?, ?, ?, ?, ?)",
			clusterID, req.IP, hostname, "worker", "active",
		)
		if err != nil {
			log.Printf("[DATABASE] ERROR: Failed to insert worker node: %v", err)
		} else {
			log.Printf("[DATABASE] ✓ Worker node record inserted")
		}

		log.Printf("=====================================")
		log.Printf("✓ COMPLETED: Worker %s (%s) added to cluster %s", hostname, req.IP, cluster.Name)
		log.Printf("=====================================")
		database.LogActivity("Add Worker", fmt.Sprintf("Added worker %s (%s) to cluster %s", hostname, req.IP, cluster.Name), "success")
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Worker node addition started",
	})
}

// DeleteWorkerNode removes a worker node from k0s cluster
func DeleteWorkerNode(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	nodeID := vars["nodeId"]

	var req struct {
		IP string `json:"ip"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.IP == "" {
		http.Error(w, "IP is required", http.StatusBadRequest)
		return
	}

	// Get cluster info
	var cluster models.K0sCluster
	var password string
	var version sql.NullString
	err := database.DB.QueryRow(
		"SELECT id, name, ip_address, username, password, status, version FROM k0s_clusters WHERE id = ?",
		clusterID,
	).Scan(&cluster.ID, &cluster.Name, &cluster.IPAddress, &cluster.Username, &password, &cluster.Status, &version)

	if err != nil {
		log.Printf("Cluster not found: %v", err)
		http.Error(w, "Cluster not found", http.StatusNotFound)
		return
	}

	if version.Valid {
		cluster.Version = version.String
	}

	// Get node info
	var nodeName string
	err = database.DB.QueryRow(
		"SELECT hostname FROM k0s_nodes WHERE id = ? AND cluster_id = ?",
		nodeID, clusterID,
	).Scan(&nodeName)

	if err != nil {
		log.Printf("Node not found: %v", err)
		http.Error(w, "Node not found", http.StatusNotFound)
		return
	}

	// Delete in background
	go func() {
		log.Printf("=====================================")
		log.Printf("Starting worker node deletion process")
		log.Printf("Cluster ID: %s", clusterID)
		log.Printf("Cluster Name: %s", cluster.Name)
		log.Printf("Cluster IP (from DB): %s", cluster.IPAddress)
		log.Printf("Node ID: %s", nodeID)
		log.Printf("worker IP (input): %s", req.IP)
		log.Printf("Worker Hostname: %s", nodeName)
		log.Printf("=====================================")

		// Always clean up from database at the end, regardless of SSH failures
		defer func() {
			// Delete node record from database
			log.Printf("[DATABASE] Deleting node record from database (nodeID: %s, clusterID: %s)...", nodeID, clusterID)
			_, err := database.DB.Exec(
				"DELETE FROM k0s_nodes WHERE id = ? AND cluster_id = ?",
				nodeID, clusterID,
			)
			if err != nil {
				log.Printf("[DATABASE] ERROR: Failed to delete node record: %v", err)
			} else {
				log.Printf("[DATABASE] ✓ Node record deleted")
			}

			// Recalculate actual node count
			log.Printf("[DATABASE] Recalculating node count...")
			var count int
			database.DB.QueryRow("SELECT COUNT(*) FROM k0s_nodes WHERE cluster_id = ?", clusterID).Scan(&count)
			_, err = database.DB.Exec("UPDATE k0s_clusters SET node_count = ? WHERE id = ?", count, clusterID)
			if err != nil {
				log.Printf("[DATABASE] ERROR: Failed to update node count: %v", err)
			} else {
				log.Printf("[DATABASE] ✓ Node count updated to %d", count)
			}

			log.Printf("=====================================")
			log.Printf("✓ COMPLETED: Worker %s (%s) deleted from cluster %s", nodeName, req.IP, cluster.Name)
			log.Printf("=====================================")
			database.LogActivity("Delete Worker", fmt.Sprintf("Deleted worker %s (%s) from cluster %s", nodeName, req.IP, cluster.Name), "success")
		}()

		// Get controller password from DB
		var controllerPassword string
		database.DB.QueryRow("SELECT password FROM k0s_clusters WHERE id = ?", clusterID).Scan(&controllerPassword)
		log.Printf("[DEBUG] Controller password retrieved from database")

		// Connect to controller
		log.Printf("[CONTROLLER %s] Connecting to controller at %s@%s ...", cluster.IPAddress, cluster.Username, cluster.IPAddress)
		controllerClient, err := connectSSH(cluster.IPAddress, cluster.Username, controllerPassword, "password")
		if err != nil {
			log.Printf("[CONTROLLER %s] WARNING: Failed to connect to controller: %v (will skip kubectl cleanup, but DB will still be cleaned)", cluster.IPAddress, err)
		} else {
			defer controllerClient.Close()

			// Delete node from cluster
			log.Printf("[CONTROLLER %s] Step 1: Removing node from cluster...", cluster.IPAddress)
			deleteSession, err := controllerClient.NewSession()
			if err != nil {
				log.Printf("[CONTROLLER %s] ERROR: Failed to create delete session: %v", cluster.IPAddress, err)
			} else {
				var deleteOutput strings.Builder
				var deleteErr strings.Builder
				deleteSession.Stdout = &deleteOutput
				deleteSession.Stderr = &deleteErr
				deleteCmd := fmt.Sprintf("sudo k0s kubectl delete node %s", nodeName)
				log.Printf("[CONTROLLER %s] Running: %s", cluster.IPAddress, deleteCmd)
				err = deleteSession.Run(deleteCmd)
				deleteSession.Close()
				if err != nil {
					log.Printf("[CONTROLLER %s] Delete stderr: %s", cluster.IPAddress, deleteErr.String())
					log.Printf("[CONTROLLER %s] Delete stdout: %s", cluster.IPAddress, deleteOutput.String())
					log.Printf("[CONTROLLER %s] WARNING: kubectl delete node failed: %v (might be ok if node already removed)", cluster.IPAddress, err)
				} else {
					log.Printf("[CONTROLLER %s] ✓ Node removed from cluster", cluster.IPAddress)
				}
			}

			// Verify deletion
			log.Printf("[CONTROLLER %s] Step 2: Verifying node removal...", cluster.IPAddress)
			verifySession, _ := controllerClient.NewSession()
			var verifyOutput strings.Builder
			verifySession.Stdout = &verifyOutput
			verifyCmd := "sudo k0s kubectl get nodes -o wide"
			log.Printf("[CONTROLLER %s] Running: %s", cluster.IPAddress, verifyCmd)
			verifySession.Run(verifyCmd)
			verifySession.Close()
			log.Printf("[CONTROLLER %s] Cluster nodes after deletion:\n%s", cluster.IPAddress, verifyOutput.String())
		}

		// Connect to worker node to stop k0s
		log.Printf("[WORKER %s] Step 3: Connecting to worker to cleanup...", req.IP)
		workerPassword := password // Use same password as controller for now
		workerClient, err := connectSSH(req.IP, cluster.Username, workerPassword, "password")
		if err != nil {
			log.Printf("[WORKER %s] WARNING: Failed to connect to worker: %v (will skip cleanup, DB will still be cleaned)", req.IP, err)
		} else {
			defer workerClient.Close()

			// Stop k0s service on worker
			log.Printf("[WORKER %s] Step 4: Stopping k0s service...", req.IP)
			stopSession, _ := workerClient.NewSession()
			var stopOutput strings.Builder
			stopSession.Stdout = &stopOutput
			stopCmd := "sudo systemctl stop k0s || true"
			log.Printf("[WORKER %s] Running: %s", req.IP, stopCmd)
			stopSession.Run(stopCmd)
			stopSession.Close()
			log.Printf("[WORKER %s] Stop output: %s", req.IP, strings.TrimSpace(stopOutput.String()))

			// Reset k0s on worker
			log.Printf("[WORKER %s] Step 5: Resetting k0s...", req.IP)
			resetSession, _ := workerClient.NewSession()
			var resetOutput strings.Builder
			resetSession.Stdout = &resetOutput
			resetCmd := "sudo k0s reset || true"
			log.Printf("[WORKER %s] Running: %s", req.IP, resetCmd)
			resetSession.Run(resetCmd)
			resetSession.Close()
			log.Printf("[WORKER %s] Reset output: %s", req.IP, strings.TrimSpace(resetOutput.String()))

			log.Printf("[WORKER %s] ✓ Worker cleanup completed", req.IP)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Worker node deletion started",
	})
}

// DownloadKubeconfig downloads the kubeconfig for a cluster
func DownloadKubeconfig(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]

	// Get cluster info including credentials
	var cluster models.K0sCluster
	var password, authMethod, sshKey sql.NullString
	err := database.DB.QueryRow(
		"SELECT id, name, ip_address, username, COALESCE(password,''), COALESCE(auth_method,'password'), COALESCE(ssh_key,''), status FROM k0s_clusters WHERE id = ?",
		clusterID,
	).Scan(&cluster.ID, &cluster.Name, &cluster.IPAddress, &cluster.Username, &password, &authMethod, &sshKey, &cluster.Status)

	if err != nil {
		log.Printf("DownloadKubeconfig: cluster query failed: %v", err)
		http.Error(w, "Cluster not found", http.StatusNotFound)
		return
	}

	auth := authMethod.String
	if auth == "" {
		auth = "password"
	}
	credential := password.String
	if auth == "ssh-key" {
		credential = sshKey.String
	}

	// Check if kubeconfig is already stored in DB
	var storedKubeconfig sql.NullString
	database.DB.QueryRow("SELECT kubeconfig FROM k0s_clusters WHERE id = ?", clusterID).Scan(&storedKubeconfig)

	var kubeconfig string
	if storedKubeconfig.Valid && strings.TrimSpace(storedKubeconfig.String) != "" {
		log.Printf("DownloadKubeconfig: serving from DB cache for cluster %s", clusterID)
		kubeconfig = storedKubeconfig.String
	} else {
		// Fall back to SSH
		log.Printf("DownloadKubeconfig: no cached kubeconfig, connecting to %s@%s (auth=%s)", cluster.Username, cluster.IPAddress, auth)

		client, err := connectSSH(cluster.IPAddress, cluster.Username, credential, auth)
		if err != nil {
			http.Error(w, "Failed to connect to cluster", http.StatusInternalServerError)
			return
		}
		defer client.Close()

		session, err := client.NewSession()
		if err != nil {
			http.Error(w, "Failed to create SSH session", http.StatusInternalServerError)
			return
		}
		defer session.Close()

		var output strings.Builder
		session.Stdout = &output
		err = session.Run("sudo cat /var/lib/k0s/pki/admin.conf")
		if err != nil {
			http.Error(w, "Failed to get kubeconfig", http.StatusInternalServerError)
			return
		}

		kubeconfig = output.String()
		kubeconfig = strings.ReplaceAll(kubeconfig, "localhost", cluster.IPAddress)
		kubeconfig = strings.ReplaceAll(kubeconfig, "127.0.0.1", cluster.IPAddress)
		kubeconfig = strings.ReplaceAll(kubeconfig, "10.0.2.15", cluster.IPAddress)

		// Save to DB for next time
		database.DB.Exec("UPDATE k0s_clusters SET kubeconfig = ? WHERE id = ?", kubeconfig, clusterID)
		log.Printf("DownloadKubeconfig: kubeconfig fetched via SSH and cached to DB")
	}

	w.Header().Set("Content-Type", "application/x-yaml")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=kubeconfig-%s.yaml", cluster.Name))
	w.Write([]byte(kubeconfig))
}

// GetKubeconfigStatus checks if kubeconfig is available
func GetKubeconfigStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]

	var status string
	var storedKc sql.NullString
	err := database.DB.QueryRow("SELECT status, kubeconfig FROM k0s_clusters WHERE id = ?", clusterID).Scan(&status, &storedKc)
	if err != nil {
		http.Error(w, "Cluster not found", http.StatusNotFound)
		return
	}

	kubeconfigAvailable := (status == "running") || (storedKc.Valid && strings.TrimSpace(storedKc.String) != "")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"kubeconfig_available": kubeconfigAvailable,
		"status":               status,
	})
}

// ImportK0sCluster imports an existing cluster via kubeconfig content
func ImportK0sCluster(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name       string `json:"name"`
		Kubeconfig string `json:"kubeconfig"`
		Type       string `json:"type"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.Kubeconfig == "" {
		http.Error(w, "Name and kubeconfig are required", http.StatusBadRequest)
		return
	}

	if req.Type == "" {
		req.Type = "external"
	}

	// Extract server IP/host from kubeconfig
	ipAddress := "external"
	for _, line := range strings.Split(req.Kubeconfig, "\n") {
		trimed := strings.TrimSpace(line)
		if strings.HasPrefix(trimed, "server:") {
			serverURL := strings.TrimSpace(strings.TrimPrefix(trimed, "server:"))
			serverURL = strings.TrimPrefix(serverURL, "https://")
			serverURL = strings.TrimPrefix(serverURL, "http://")
			if idx := strings.Index(serverURL, "/"); idx > 0 {
				serverURL = serverURL[:idx]
			}
			if host, _, err := net.SplitHostPort(serverURL); err == nil {
				ipAddress = host
			} else {
				ipAddress = serverURL
			}
			break
		}
	}

	// Check if cluster with this name already exists – update kubeconfig if so
	var existingID int
	existErr := database.DB.QueryRow("SELECT id FROM k0s_clusters WHERE name = ?", req.Name).Scan(&existingID)
	if existErr == nil {
		// Cluster exists – update kubeconfig, status and ip
		_, err := database.DB.Exec(
			"UPDATE k0s_clusters SET kubeconfig = ?, ip_address = ?, status = 'running', type = ? WHERE id = ?",
			req.Kubeconfig, ipAddress, req.Type, existingID,
		)
		if err != nil {
			log.Printf("Error updating cluster kubeconfig: %v", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": err.Error()})
			return
		}
		log.Printf("Cluster '%s' (id=%d) kubeconfig updated successfully (server: %s)", req.Name, existingID, ipAddress)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Cluster kubeconfig updated successfully",
			"id":      existingID,
		})
		return
	}

	// New cluster – insert
	result, err := database.DB.Exec(
		"INSERT INTO k0s_clusters (name, ip_address, username, status, created_at, kubeconfig, type) VALUES (?, ?, ?, ?, ?, ?, ?)",
		req.Name, ipAddress, "", "running", time.Now().Format("2006-01-02 15:04:05"), req.Kubeconfig, req.Type,
	)
	if err != nil {
		log.Printf("Error importing cluster: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	log.Printf("Cluster '%s' imported successfully with id %d (server: %s)", req.Name, id, ipAddress)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Cluster imported successfully",
		"id":      id,
	})
}

// UpdateClusterKubeconfig updates the kubeconfig of an existing cluster
// PUT /api/k0s/clusters/{id}/kubeconfig-update
func UpdateClusterKubeconfig(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]

	var req struct {
		Kubeconfig string `json:"kubeconfig"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Kubeconfig) == "" {
		http.Error(w, "kubeconfig is required", http.StatusBadRequest)
		return
	}

	// Extract server IP
	ipAddress := ""
	for _, line := range strings.Split(req.Kubeconfig, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "server:") {
			serverURL := strings.TrimSpace(strings.TrimPrefix(trimmed, "server:"))
			serverURL = strings.TrimPrefix(serverURL, "https://")
			serverURL = strings.TrimPrefix(serverURL, "http://")
			if idx := strings.Index(serverURL, "/"); idx > 0 {
				serverURL = serverURL[:idx]
			}
			if host, _, err := net.SplitHostPort(serverURL); err == nil {
				ipAddress = host
			} else {
				ipAddress = serverURL
			}
			break
		}
	}

	query := "UPDATE k0s_clusters SET kubeconfig = ?, status = 'running'"
	args := []interface{}{req.Kubeconfig}
	if ipAddress != "" {
		query += ", ip_address = ?"
		args = append(args, ipAddress)
	}
	query += " WHERE id = ?"
	args = append(args, clusterID)

	_, err := database.DB.Exec(query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Printf("Kubeconfig updated for cluster id=%s (server: %s)", clusterID, ipAddress)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "Kubeconfig updated"})
}

// GetClusterNodes returns all nodes in a cluster
func GetClusterNodes(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]

	rows, err := database.DB.Query(
		"SELECT id, ip_address, hostname, role, status, created_at FROM k0s_nodes WHERE cluster_id = ? ORDER BY role DESC, created_at ASC",
		clusterID,
	)
	if err != nil {
		log.Printf("Error querying nodes: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Node struct {
		ID        int    `json:"id"`
		IPAddress string `json:"ip_address"`
		Hostname  string `json:"hostname,omitempty"`
		Role      string `json:"role"`
		Status    string `json:"status"`
		CreatedAt string `json:"created_at"`
	}

	nodes := []Node{}
	for rows.Next() {
		var node Node
		var hostname sql.NullString
		err := rows.Scan(&node.ID, &node.IPAddress, &hostname, &node.Role, &node.Status, &node.CreatedAt)
		if err != nil {
			log.Printf("Error scanning node: %v", err)
			continue
		}
		if hostname.Valid {
			node.Hostname = hostname.String
		}
		nodes = append(nodes, node)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(nodes)
}

// Helper functions

func removeSSHHostKey(ip string) {
	// Remove SSH host key from known_hosts to avoid conflicts
	cmd := exec.Command("ssh-keygen", "-R", ip)
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Ignore errors, file might not exist
		log.Printf("ssh-keygen -R %s: %s", ip, string(output))
	} else {
		log.Printf("Removed SSH host key for %s", ip)
	}
}

func connectSSH(host, username, password, authMethod string) (*ssh.Client, error) {
	// Remove old host key to avoid conflicts
	removeSSHHostKey(host)
	
	authMethod = strings.ToLower(strings.TrimSpace(authMethod))
	var authMethods []ssh.AuthMethod

	if authMethod == "password" {
		authMethods = append(authMethods, ssh.Password(password))
		log.Printf("Connecting to %s@%s with password auth", username, host)
	} else if authMethod == "ssh-key" {
		// Parse SSH private key
		signer, err := ssh.ParsePrivateKey([]byte(password)) // password field contains SSH key for ssh-key auth
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %v", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
		log.Printf("Connecting to %s@%s with SSH key auth", username, host)
	} else {
		// Default to password if method not recognized
		log.Printf("Unknown auth method '%s', defaulting to password", authMethod)
		authMethods = append(authMethods, ssh.Password(password))
	}

	if len(authMethods) == 0 {
		return nil, fmt.Errorf("no auth methods available for %s", authMethod)
	}

	config := &ssh.ClientConfig{
		User: username,
		Auth: authMethods,
		HostKeyCallback: func(host string, remote net.Addr, key ssh.PublicKey) error {
			return nil // Skip host key verification
		},
		Timeout: 20 * time.Second,
	}

	log.Printf("SSH config prepared for %s@%s with %d auth methods", username, host, len(authMethods))
	client, err := ssh.Dial("tcp", fmt.Sprintf("%s:22", host), config)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to %s@%s:22 - %v", username, host, err)
	}

	log.Printf("Successfully connected to %s@%s", username, host)
	return client, nil
}

func updateClusterStatus(id int, status string) {
	_, err := database.DB.Exec("UPDATE k0s_clusters SET status = ? WHERE id = ?", status, id)
	if err != nil {
		log.Printf("Error updating cluster status: %v", err)
	}
}

func recordActivityLog(action, target, details, status string) {
	_, err := database.DB.Exec(
		"INSERT INTO activity_logs (action, target, details, status, timestamp) VALUES (?, ?, ?, ?, ?)",
		action, target, details, status, time.Now().Format("2006-01-02 15:04:05"),
	)
	if err != nil {
		log.Printf("Error recording activity log: %v", err)
	}
}
