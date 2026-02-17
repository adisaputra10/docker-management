package api

import (
	"github.com/gorilla/mux"
)

func NewRouter() *mux.Router {
	r := mux.NewRouter()
	api := r.PathPrefix("/api").Subrouter()

	// Middleware
	api.Use(AuthMiddleware)

	// Auth
	api.HandleFunc("/auth/login", LoginHandler).Methods("POST")
	api.HandleFunc("/auth/logout", LogoutHandler).Methods("POST")
	api.HandleFunc("/auth/providers", GetAuthProviders).Methods("GET")

	// Users
	api.HandleFunc("/users", ListUsers).Methods("GET")
	api.HandleFunc("/users", CreateUser).Methods("POST")
	api.HandleFunc("/users/{id}", DeleteUser).Methods("DELETE")
	api.HandleFunc("/users/{id}", UpdateUser).Methods("PUT")

	// Projects
	api.HandleFunc("/projects", ListProjects).Methods("GET")
	api.HandleFunc("/projects", CreateProject).Methods("POST")
	api.HandleFunc("/projects/{id}", DeleteProject).Methods("DELETE")
	api.HandleFunc("/projects/{id}", GetProject).Methods("GET")
	api.HandleFunc("/projects/assign_user", AssignUser).Methods("POST")
	api.HandleFunc("/projects/assign_resource", AssignResource).Methods("POST")
	api.HandleFunc("/projects/unassign_user", UnassignUser).Methods("POST")
	api.HandleFunc("/projects/unassign_resource", UnassignResource).Methods("POST")

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
	api.HandleFunc("/hosts/{id}/containers", GetHostContainers).Methods("GET")

	// Chat / AI
	// Handler functions are defined in chat.go (same package)
	api.HandleFunc("/chat", handleChat).Methods("POST")
	api.HandleFunc("/settings", getSettings).Methods("GET")
	api.HandleFunc("/settings", saveSettings).Methods("POST")

	// SSO
	api.HandleFunc("/settings/sso", GetSSOSettings).Methods("GET")
	api.HandleFunc("/settings/sso", SaveSSOSettings).Methods("POST")

	// Load Balancer
	api.HandleFunc("/lb/routes", ListLBRoutes).Methods("GET")
	api.HandleFunc("/lb/routes", AddLBRoute).Methods("POST")
	api.HandleFunc("/lb/routes/{id}", DeleteLBRoute).Methods("DELETE")
	api.HandleFunc("/lb/setup", StartTraefik).Methods("POST")
	api.HandleFunc("/lb/status", GetTraefikStatus).Methods("GET")

	return r
}
