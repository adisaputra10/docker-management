package api

import (
	"github.com/gorilla/mux"
)

func NewRouter() *mux.Router {
	r := mux.NewRouter()
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

	return r
}
