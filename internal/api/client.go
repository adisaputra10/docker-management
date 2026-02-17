package api

import (
	"fmt"
	"net/http"
	"strconv"
	"sync"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/docker/docker/client"
)

var (
	clientCache = make(map[int]*client.Client)
	cacheMutex  sync.RWMutex
	// Default client for fallback if needed, though we prefer DB
	DefaultClient *client.Client
)

// GetClient retrieves the Docker client based on the X-Docker-Host-ID header
func GetClient(r *http.Request) (*client.Client, error) {
	hostIDStr := r.Header.Get("X-Docker-Host-ID")
	if hostIDStr == "" {
		hostIDStr = r.URL.Query().Get("hostId")
	}
	if hostIDStr == "" {
		hostIDStr = "1"
	}

	hostID, err := strconv.Atoi(hostIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid host id")
	}

	// Check cache
	cacheMutex.RLock()
	if cli, ok := clientCache[hostID]; ok {
		cacheMutex.RUnlock()
		return cli, nil
	}
	cacheMutex.RUnlock()

	// If not in cache, fetch from DB
	var uri string
	err = database.DB.QueryRow("SELECT uri FROM docker_hosts WHERE id = ?", hostID).Scan(&uri)
	if err != nil {
		// Fallback to default client if ID 1 and not found in DB (edge case)
		if hostID == 1 && DefaultClient != nil {
			return DefaultClient, nil
		}
		return nil, fmt.Errorf("host not found: %v", err)
	}

	// Create new client
	cli, err := client.NewClientWithOpts(client.WithHost(uri), client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}

	// Cache it
	cacheMutex.Lock()
	clientCache[hostID] = cli
	cacheMutex.Unlock()

	return cli, nil
}

func ClearClientCache(hostID int) {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()
	if cli, ok := clientCache[hostID]; ok {
		cli.Close()
		delete(clientCache, hostID)
	}
}

// GetClientByHostID retrieves the Docker client for a specific host ID
func GetClientByHostID(hostID int) (*client.Client, error) {
	// Check cache
	cacheMutex.RLock()
	if cli, ok := clientCache[hostID]; ok {
		cacheMutex.RUnlock()
		return cli, nil
	}
	cacheMutex.RUnlock()

	// If not in cache, fetch from DB
	var uri string
	err := database.DB.QueryRow("SELECT uri FROM docker_hosts WHERE id = ?", hostID).Scan(&uri)
	if err != nil {
		// Fallback to default client if ID 1 and not found in DB (edge case)
		if hostID == 1 && DefaultClient != nil {
			return DefaultClient, nil
		}
		return nil, fmt.Errorf("host not found: %v", err)
	}

	// Create new client
	cli, err := client.NewClientWithOpts(client.WithHost(uri), client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}

	// Cache it
	cacheMutex.Lock()
	clientCache[hostID] = cli
	cacheMutex.Unlock()

	return cli, nil
}
