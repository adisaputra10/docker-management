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
	// User Namespaces (K8s cluster namespace assignments)
	api.HandleFunc("/users/{id}/namespaces", GetUserNamespaces).Methods("GET")
	api.HandleFunc("/users/{id}/namespaces", AssignUserNamespaces).Methods("POST")
	api.HandleFunc("/users/{id}/namespaces/{namespace}", RevokeUserNamespace).Methods("DELETE")

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

	// K0s Kubernetes
	api.HandleFunc("/k0s/clusters", ListK0sClusters).Methods("GET")
	api.HandleFunc("/k0s/clusters", CreateK0sCluster).Methods("POST")
	api.HandleFunc("/k0s/clusters/{id}", GetK0sCluster).Methods("GET")
	api.HandleFunc("/k0s/clusters/{id}", DeleteK0sCluster).Methods("DELETE")
	api.HandleFunc("/k0s/clusters/{id}/workers", AddWorkerNode).Methods("POST")
	api.HandleFunc("/k0s/clusters/{id}/workers/{nodeId}", DeleteWorkerNode).Methods("DELETE")
	api.HandleFunc("/k0s/clusters/{id}/nodes", GetClusterNodes).Methods("GET")
	api.HandleFunc("/k0s/clusters/{id}/kubeconfig", DownloadKubeconfig).Methods("GET")
	api.HandleFunc("/k0s/clusters/{id}/kubeconfig-status", GetKubeconfigStatus).Methods("GET")
	api.HandleFunc("/k0s/import", ImportK0sCluster).Methods("POST")
	api.HandleFunc("/k0s/clusters/{id}/kubeconfig-update", UpdateClusterKubeconfig).Methods("PUT")
	api.HandleFunc("/k0s/test-connection", TestK0sConnection).Methods("POST")
	api.HandleFunc("/k0s/deploy", DeployOnK0s).Methods("POST")

	// Cluster Admin - k8s resource management
	api.HandleFunc("/k0s/clusters/{id}/k8s/info", GetClusterInfo).Methods("GET")
	api.HandleFunc("/k0s/clusters/{id}/k8s/namespaces", GetClusterNamespaces).Methods("GET")
	api.HandleFunc("/k0s/clusters/{id}/k8s/namespaces", CreateNamespace).Methods("POST")
	api.HandleFunc("/k0s/clusters/{id}/k8s/namespaces/{ns}", DeleteNamespaceResource).Methods("DELETE")
	api.HandleFunc("/k0s/clusters/{id}/k8s/namespaces/{ns}", UpdateNamespaceLabels).Methods("PATCH")
	api.HandleFunc("/k0s/clusters/{id}/k8s/namespaces/{ns}/quota", SetNamespaceQuota).Methods("POST")
	api.HandleFunc("/k0s/clusters/{id}/k8s/quotas", GetAllResourceQuotas).Methods("GET")
	api.HandleFunc("/k0s/clusters/{id}/k8s/ns-usage", GetNamespacePodUsage).Methods("GET")
	api.HandleFunc("/k0s/clusters/{id}/k8s/nodes", GetClusterNodes2).Methods("GET")
	api.HandleFunc("/k0s/clusters/{id}/k8s/nodes/{name}", UpdateNodeLabels).Methods("PATCH")
	api.HandleFunc("/k0s/clusters/{id}/k8s/nodes-metrics", GetNodeMetrics).Methods("GET")
	api.HandleFunc("/k0s/clusters/{id}/k8s/pods-metrics", GetPodMetrics).Methods("GET")
	api.HandleFunc("/k0s/clusters/{id}/k8s/{resource}", GetClusterResources).Methods("GET")
	api.HandleFunc("/k0s/clusters/{id}/k8s/{resource}/{name}", GetClusterResourceByName).Methods("GET")
	api.HandleFunc("/k0s/clusters/{id}/k8s/{resource}/{name}", DeleteClusterResource).Methods("DELETE")
	api.HandleFunc("/k0s/clusters/{id}/k8s/pods/{name}/logs", GetResourceLogs).Methods("GET")
	api.HandleFunc("/k0s/clusters/{id}/k8s/pods/{name}/describe", GetPodDescribe).Methods("GET")
	api.HandleFunc("/k0s/clusters/{id}/k8s/pods/{name}/events", GetPodEvents).Methods("GET")
	api.HandleFunc("/k0s/clusters/{id}/k8s/pods/{name}/exec", PodExec).Methods("GET") // WebSocket
	api.HandleFunc("/k0s/clusters/{id}/k8s/apply", ApplyClusterResource).Methods("POST")

	// CI/CD Registries
	api.HandleFunc("/cicd/registries", ListRegistries).Methods("GET")
	api.HandleFunc("/cicd/registries", CreateRegistry).Methods("POST")
	api.HandleFunc("/cicd/registries/test", TestRegistry).Methods("POST")
	api.HandleFunc("/cicd/registries/{id}", GetRegistry).Methods("GET")
	api.HandleFunc("/cicd/registries/{id}", DeleteRegistry).Methods("DELETE")

	// CI/CD Workers  (admin only)
	api.HandleFunc("/cicd/workers", ListWorkers).Methods("GET")
	api.HandleFunc("/cicd/workers", CreateWorker).Methods("POST")
	api.HandleFunc("/cicd/workers/test-ssh", TestWorkerSSHDirect).Methods("POST")
	api.HandleFunc("/cicd/workers/{id}", GetWorker).Methods("GET")
	api.HandleFunc("/cicd/workers/{id}", DeleteWorker).Methods("DELETE")
	api.HandleFunc("/cicd/workers/{id}/test", TestWorkerSSH).Methods("POST")

	// Security Scan Reports
	api.HandleFunc("/cicd/scans", ListScanReports).Methods("GET")
	api.HandleFunc("/cicd/scans/summary", ScanSummary).Methods("GET")
	api.HandleFunc("/cicd/scans", CreateScanReport).Methods("POST")
	api.HandleFunc("/cicd/scans/{id}", GetScanReport).Methods("GET")
	api.HandleFunc("/cicd/scans/{id}", DeleteScanReport).Methods("DELETE")

	return r
}
