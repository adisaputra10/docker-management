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
