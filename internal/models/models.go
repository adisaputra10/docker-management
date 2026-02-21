package models

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

type DockerHost struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	URI       string `json:"uri"`
	CreatedAt string `json:"created_at"`
}

type K0sCluster struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	IPAddress   string `json:"ip_address"`
	Username    string `json:"username"`
	Password    string `json:"password"`
	Status      string `json:"status"` // provisioning, running, stopped, failed
	CreatedAt   string `json:"created_at"`
	Version     string `json:"version,omitempty"`
	NodeCount   int    `json:"node_count"`
	Type        string `json:"type"` // "controller" or "worker"
}

type K0sClusterRequest struct {
	Name       string `json:"name"`
	IP         string `json:"ip"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	AuthMethod string `json:"authMethod"`
	SSHKey     string `json:"sshKey"`
	Type       string `json:"type"` // "controller" or "worker", default "controller"
}

type K0sProvisioningResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}
