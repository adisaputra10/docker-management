package api

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/gorilla/mux"
)

// clusterSSHRun runs a command on the controller via SSH and returns stdout
func clusterSSHRun(clusterID string, cmd string) (string, error) {
	var ipAddress, username string
	var password, authMethod, sshKey sql.NullString

	err := database.DB.QueryRow(
		"SELECT ip_address, username, COALESCE(password,''), COALESCE(auth_method,'password'), COALESCE(ssh_key,'') FROM k0s_clusters WHERE id = ?",
		clusterID,
	).Scan(&ipAddress, &username, &password, &authMethod, &sshKey)
	if err != nil {
		return "", fmt.Errorf("cluster not found: %v", err)
	}

	auth := authMethod.String
	if auth == "" {
		auth = "password"
	}
	credential := password.String
	if auth == "ssh-key" {
		credential = sshKey.String
	}

	client, err := connectSSH(ipAddress, username, credential, auth)
	if err != nil {
		return "", fmt.Errorf("SSH connect failed: %v", err)
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return "", fmt.Errorf("SSH session failed: %v", err)
	}
	defer session.Close()

	var out strings.Builder
	var errOut strings.Builder
	session.Stdout = &out
	session.Stderr = &errOut

	if runErr := session.Run(cmd); runErr != nil {
		return "", fmt.Errorf("command failed: %v\nstderr: %s", runErr, errOut.String())
	}

	return out.String(), nil
}

// checkNamespaceAccess checks if user has access to a namespace
// Admin users have access to all namespaces
// Non-admin users only have access to assigned namespaces
func checkNamespaceAccess(user User, clusterID int, namespace string) bool {
	// Admin users have access to all namespaces
	if user.Role == "admin" {
		return true
	}

	// Non-admin: check if namespace is assigned to user
	var count int
	err := database.DB.QueryRow(
		"SELECT COUNT(*) FROM user_namespaces WHERE user_id = ? AND cluster_id = ? AND namespace = ?",
		user.ID, clusterID, namespace,
	).Scan(&count)
	
	if err != nil {
		log.Printf("[checkNamespaceAccess] Error querying: %v", err)
		return false
	}

	return count > 0
}

// GetClusterNamespaces returns all namespaces in a cluster
// GET /api/k0s/clusters/{id}/k8s/namespaces
// Admin users see all namespaces; non-admin users see only assigned namespaces
func GetClusterNamespaces(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	clusterIDInt, _ := strconv.Atoi(clusterID)

	out, err := clusterSSHRun(clusterID, "sudo k0s kubectl get namespaces -o json")
	if err != nil {
		log.Printf("[ClusterAdmin] GetNamespaces error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Parse namespaces response - use generic unmarshaling to preserve full structure
	var nsData struct {
		Items []map[string]interface{} `json:"items"`
	}
	if err := json.Unmarshal([]byte(out), &nsData); err != nil {
		log.Printf("[ClusterAdmin] Failed to parse namespaces: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Check if user is admin or not - if not admin, filter namespaces
	user, ok := GetUserFromContext(r.Context())
	if ok && user.Role != "admin" {
		// Non-admin user: get assigned namespaces for this cluster
		rows, err := database.DB.Query(
			"SELECT namespace FROM user_namespaces WHERE user_id = ? AND cluster_id = ?",
			user.ID, clusterIDInt,
		)
		if err != nil {
			log.Printf("[ClusterAdmin] Error getting assigned namespaces: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		assignedNS := make(map[string]bool)
		for rows.Next() {
			var ns string
			if err := rows.Scan(&ns); err != nil {
				continue
			}
			assignedNS[ns] = true
		}

		// Filter namespaces by checking metadata.name
		var filtered []map[string]interface{}
		for _, item := range nsData.Items {
			metadata, ok := item["metadata"].(map[string]interface{})
			if !ok {
				continue
			}
			nsName, ok := metadata["name"].(string)
			if !ok {
				continue
			}
			if assignedNS[nsName] {
				filtered = append(filtered, item)
			}
		}
		nsData.Items = filtered
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(nsData)
}

// CreateNamespace creates a new namespace
// POST /api/k0s/clusters/{id}/k8s/namespaces  body: {"name":"..."}
func CreateNamespace(w http.ResponseWriter, r *http.Request) {
	// Check user role - view role cannot create
	user, ok := GetUserFromContext(r.Context())
	if ok && user.Role == "view" {
		http.Error(w, "view-only users cannot create resources", http.StatusForbidden)
		return
	}

	vars := mux.Vars(r)
	clusterID := vars["id"]

	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Name) == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	out, err := clusterSSHRun(clusterID, fmt.Sprintf("sudo k0s kubectl create namespace %s", body.Name))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"output": out})
}

// DeleteNamespaceResource deletes a namespace
// DELETE /api/k0s/clusters/{id}/k8s/namespaces/{ns}
func DeleteNamespaceResource(w http.ResponseWriter, r *http.Request) {
	// Check user role - view role cannot delete
	user, ok := GetUserFromContext(r.Context())
	if ok && user.Role == "view" {
		http.Error(w, "view-only users cannot delete resources", http.StatusForbidden)
		return
	}

	vars := mux.Vars(r)
	clusterID := vars["id"]
	clusterIDInt, _ := strconv.Atoi(clusterID)
	ns := vars["ns"]

	// Non-admin users can only delete namespaces they have access to
	if ok && user.Role != "admin" {
		if !checkNamespaceAccess(user, clusterIDInt, ns) {
			http.Error(w, "access denied: namespace not assigned to user", http.StatusForbidden)
			return
		}
	}

	protected := map[string]bool{"default": true, "kube-system": true, "kube-public": true, "kube-node-lease": true}
	if protected[ns] {
		http.Error(w, "cannot delete system namespace: "+ns, http.StatusForbidden)
		return
	}

	out, err := clusterSSHRun(clusterID, fmt.Sprintf("sudo k0s kubectl delete namespace %s", ns))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"output": out})
}

// UpdateNamespaceLabels patches labels on a namespace
// PATCH /api/k0s/clusters/{id}/k8s/namespaces/{ns}  body: {"labels":{"k":"v"}}
func UpdateNamespaceLabels(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	clusterIDInt, _ := strconv.Atoi(clusterID)
	ns := vars["ns"]

	// Non-admin users can only access namespaces they have been assigned to
	user, ok := GetUserFromContext(r.Context())
	if ok && user.Role != "admin" {
		if !checkNamespaceAccess(user, clusterIDInt, ns) {
			http.Error(w, "access denied: namespace not assigned to user", http.StatusForbidden)
			return
		}
	}

	var body struct {
		Labels map[string]string `json:"labels"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	if len(body.Labels) == 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"output": "no labels provided"})
		return
	}

	var parts []string
	for k, v := range body.Labels {
		parts = append(parts, fmt.Sprintf("%s=%s", k, v))
	}
	cmd := fmt.Sprintf("sudo k0s kubectl label namespace %s %s --overwrite", ns, strings.Join(parts, " "))
	out, err := clusterSSHRun(clusterID, cmd)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"output": out})
}

// GetAllResourceQuotas returns ResourceQuota objects for all namespaces
// GET /api/k0s/clusters/{id}/k8s/quotas
func GetAllResourceQuotas(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	clusterIDInt, _ := strconv.Atoi(clusterID)

	out, err := clusterSSHRun(clusterID, "sudo k0s kubectl get resourcequota --all-namespaces -o json")
	if err != nil {
		// Return empty list on error (cluster may have no quotas)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"items":[]}`))
		return
	}

	// Parse quotas - use generic unmarshaling to preserve full structure
	var quotaData struct {
		Items []map[string]interface{} `json:"items"`
	}
	if err := json.Unmarshal([]byte(out), &quotaData); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"items":[]}`))
		return
	}

	// Filter quotas for non-admin users
	user, ok := GetUserFromContext(r.Context())
	if ok && user.Role != "admin" {
		// Get assigned namespaces
		rows, err := database.DB.Query(
			"SELECT namespace FROM user_namespaces WHERE user_id = ? AND cluster_id = ?",
			user.ID, clusterIDInt,
		)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"items":[]}`))
			return
		}
		defer rows.Close()

		assignedNS := make(map[string]bool)
		for rows.Next() {
			var ns string
			if err := rows.Scan(&ns); err != nil {
				continue
			}
			assignedNS[ns] = true
		}

		// Filter quotas by checking metadata.namespace
		var filtered []map[string]interface{}
		for _, item := range quotaData.Items {
			metadata, ok := item["metadata"].(map[string]interface{})
			if !ok {
				continue
			}
			itemNS, ok := metadata["namespace"].(string)
			if !ok {
				continue
			}
			if assignedNS[itemNS] {
				filtered = append(filtered, item)
			}
		}
		quotaData.Items = filtered
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(quotaData)
}

// parseQuantityMillis converts a Kubernetes CPU quantity string to millicores (int64)
func parseQuantityMillis(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" || s == "0" {
		return 0
	}
	if strings.HasSuffix(s, "m") {
		v, _ := strconv.ParseFloat(s[:len(s)-1], 64)
		return int64(v)
	}
	v, _ := strconv.ParseFloat(s, 64)
	return int64(v * 1000)
}

// parseQuantityBytes converts a Kubernetes memory quantity string to bytes (int64)
func parseQuantityBytes(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" || s == "0" {
		return 0
	}
	suffixes := []struct {
		suffix string
		mult   float64
	}{
		{"Ki", 1024}, {"Mi", 1024 * 1024}, {"Gi", 1024 * 1024 * 1024},
		{"Ti", math.Pow(1024, 4)},
		{"K", 1000}, {"M", 1000000}, {"G", 1000000000},
	}
	for _, sfx := range suffixes {
		if strings.HasSuffix(s, sfx.suffix) {
			v, _ := strconv.ParseFloat(s[:len(s)-len(sfx.suffix)], 64)
			return int64(v * sfx.mult)
		}
	}
	v, _ := strconv.ParseFloat(s, 64)
	return int64(v)
}

// fmtMillis formats millicores back to a human-readable string
func fmtMillis(m int64) string {
	if m == 0 {
		return "0m"
	}
	if m%1000 == 0 {
		return strconv.FormatInt(m/1000, 10)
	}
	return strconv.FormatInt(m, 10) + "m"
}

// fmtBytes formats bytes back to a human-readable memory string
func fmtBytes(b int64) string {
	if b == 0 {
		return "0"
	}
	const (
		Gi = 1024 * 1024 * 1024
		Mi = 1024 * 1024
		Ki = 1024
	)
	switch {
	case b >= Gi && b%Gi == 0:
		return strconv.FormatInt(b/Gi, 10) + "Gi"
	case b >= Gi:
		return fmt.Sprintf("%.1fGi", float64(b)/float64(Gi))
	case b >= Mi && b%Mi == 0:
		return strconv.FormatInt(b/Mi, 10) + "Mi"
	case b >= Mi:
		return fmt.Sprintf("%.0fMi", float64(b)/float64(Mi))
	case b >= Ki:
		return strconv.FormatInt(b/Ki, 10) + "Ki"
	default:
		return strconv.FormatInt(b, 10)
	}
}

// GetNamespacePodUsage sums resource requests/limits for all pods per namespace
// GET /api/k0s/clusters/{id}/k8s/ns-usage
func GetNamespacePodUsage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	clusterIDInt, _ := strconv.Atoi(clusterID)

	out, err := clusterSSHRun(clusterID, "sudo k0s kubectl get pods --all-namespaces -o json --field-selector=status.phase=Running")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{}`))
		return
	}

	var podList struct {
		Items []struct {
			Metadata struct {
				Namespace string `json:"namespace"`
			} `json:"metadata"`
			Spec struct {
				Containers []struct {
					Resources struct {
						Requests map[string]string `json:"requests"`
						Limits   map[string]string `json:"limits"`
					} `json:"resources"`
				} `json:"containers"`
				InitContainers []struct {
					Resources struct {
						Requests map[string]string `json:"requests"`
						Limits   map[string]string `json:"limits"`
					} `json:"resources"`
				} `json:"initContainers"`
			} `json:"spec"`
		} `json:"items"`
	}
	if err := json.Unmarshal([]byte(out), &podList); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{}`))
		return
	}

	type nsStats struct {
		CPUReqM  int64
		CPULmtM  int64
		MemReqB  int64
		MemLmtB  int64
		PodCount int
	}
	nsMap := map[string]*nsStats{}

	for _, pod := range podList.Items {
		ns := pod.Metadata.Namespace
		if _, ok := nsMap[ns]; !ok {
			nsMap[ns] = &nsStats{}
		}
		st := nsMap[ns]
		st.PodCount++
		for _, c := range pod.Spec.Containers {
			st.CPUReqM += parseQuantityMillis(c.Resources.Requests["cpu"])
			st.CPULmtM += parseQuantityMillis(c.Resources.Limits["cpu"])
			st.MemReqB += parseQuantityBytes(c.Resources.Requests["memory"])
			st.MemLmtB += parseQuantityBytes(c.Resources.Limits["memory"])
		}
	}

	// Filter namespaces for non-admin users
	user, ok := GetUserFromContext(r.Context())
	if ok && user.Role != "admin" {
		// Get assigned namespaces for non-admin user
		rows, err := database.DB.Query(
			"SELECT namespace FROM user_namespaces WHERE user_id = ? AND cluster_id = ?",
			user.ID, clusterIDInt,
		)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{}`))
			return
		}
		defer rows.Close()

		assignedNS := make(map[string]bool)
		for rows.Next() {
			var ns string
			if err := rows.Scan(&ns); err != nil {
				continue
			}
			assignedNS[ns] = true
		}

		// Keep only assigned namespaces in the result
		for ns := range nsMap {
			if !assignedNS[ns] {
				delete(nsMap, ns)
			}
		}
	}

	result := map[string]interface{}{}
	for ns, st := range nsMap {
		result[ns] = map[string]interface{}{
			"cpu_req":   fmtMillis(st.CPUReqM),
			"cpu_lmt":   fmtMillis(st.CPULmtM),
			"mem_req":   fmtBytes(st.MemReqB),
			"mem_lmt":   fmtBytes(st.MemLmtB),
			"pod_count": st.PodCount,
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// SetNamespaceQuota creates or updates a ResourceQuota for a namespace
// POST /api/k0s/clusters/{id}/k8s/namespaces/{ns}/quota
// body: {"cpu_request":"500m","cpu_limit":"1","mem_request":"256Mi","mem_limit":"512Mi"}
// Empty or "0" value means unlimited (field omitted from quota)
func SetNamespaceQuota(w http.ResponseWriter, r *http.Request) {
	// Check user role - view role cannot modify quotas
	user, ok := GetUserFromContext(r.Context())
	if ok && user.Role == "view" {
		http.Error(w, "view-only users cannot modify resource quotas", http.StatusForbidden)
		return
	}

	vars := mux.Vars(r)
	clusterID := vars["id"]
	clusterIDInt, _ := strconv.Atoi(clusterID)
	ns := vars["ns"]

	// Non-admin users can only modify quotas for namespaces they have been assigned to
	if ok && user.Role != "admin" {
		if !checkNamespaceAccess(user, clusterIDInt, ns) {
			http.Error(w, "access denied: namespace not assigned to user", http.StatusForbidden)
			return
		}
	}

	var body struct {
		CPURequest string `json:"cpu_request"`
		CPULimit   string `json:"cpu_limit"`
		MemRequest string `json:"mem_request"`
		MemLimit   string `json:"mem_limit"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	isEmpty := func(v string) bool { return v == "" || v == "0" }

	// If all fields are empty/0, delete the quota
	if isEmpty(body.CPURequest) && isEmpty(body.CPULimit) && isEmpty(body.MemRequest) && isEmpty(body.MemLimit) {
		cmd := fmt.Sprintf("sudo k0s kubectl delete resourcequota ns-quota -n %s --ignore-not-found", ns)
		out, _ := clusterSSHRun(clusterID, cmd)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"output": "Quota removed. " + strings.TrimSpace(out)})
		return
	}

	// Build hard limits section
	var hard strings.Builder
	if !isEmpty(body.CPURequest) {
		fmt.Fprintf(&hard, "    requests.cpu: \"%s\"\n", body.CPURequest)
	}
	if !isEmpty(body.CPULimit) {
		fmt.Fprintf(&hard, "    limits.cpu: \"%s\"\n", body.CPULimit)
	}
	if !isEmpty(body.MemRequest) {
		fmt.Fprintf(&hard, "    requests.memory: \"%s\"\n", body.MemRequest)
	}
	if !isEmpty(body.MemLimit) {
		fmt.Fprintf(&hard, "    limits.memory: \"%s\"\n", body.MemLimit)
	}

	yaml := fmt.Sprintf(`apiVersion: v1
kind: ResourceQuota
metadata:
  name: ns-quota
  namespace: %s
spec:
  hard:
%s`, ns, hard.String())

	encoded := base64.StdEncoding.EncodeToString([]byte(yaml))
	cmd := fmt.Sprintf("echo '%s' | base64 -d | sudo k0s kubectl apply -f -", encoded)
	out, err := clusterSSHRun(clusterID, cmd)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"output": out})
}

// GetClusterNodes returns all nodes in a cluster (k8s nodes, not our DB nodes)
// GET /api/k0s/clusters/{id}/k8s/nodes
func GetClusterNodes2(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]

	out, err := clusterSSHRun(clusterID, "sudo k0s kubectl get nodes -o json")
	if err != nil {
		log.Printf("[ClusterAdmin] GetNodes error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(out))
}

// GetClusterResources returns k8s resources (pods/deployments/services/ingresses)
// GET /api/k0s/clusters/{id}/k8s/{resource}?namespace=xxx
func GetClusterResources(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	clusterIDInt, _ := strconv.Atoi(clusterID)
	resource := vars["resource"]

	// Whitelist allowed resources
	allowed := map[string]bool{
		"pods": true, "deployments": true, "services": true,
		"ingresses": true, "configmaps": true, "secrets": true,
		"persistentvolumeclaims": true, "replicasets": true,
		"statefulsets": true, "daemonsets": true, "jobs": true, "cronjobs": true,
		"nodes": true,
	}
	if !allowed[resource] {
		http.Error(w, "resource not allowed", http.StatusBadRequest)
		return
	}

	namespace := r.URL.Query().Get("namespace")
	
	// Get current user
	user, ok := GetUserFromContext(r.Context())
	
	// Non-admin users: check namespace access
	if ok && user.Role != "admin" && namespace != "" && namespace != "all" && resource != "nodes" {
		if !checkNamespaceAccess(user, clusterIDInt, namespace) {
			http.Error(w, "access denied: namespace not assigned to user", http.StatusForbidden)
			return
		}
	}

	var cmd string
	if namespace == "" || namespace == "all" {
		// For "all namespaces" query, we'll fetch all but then filter for non-admin users
		cmd = fmt.Sprintf("sudo k0s kubectl get %s --all-namespaces -o json", resource)
	} else {
		cmd = fmt.Sprintf("sudo k0s kubectl get %s -n %s -o json", resource, namespace)
	}

	log.Printf("[ClusterAdmin] cluster=%s resource=%s ns=%s", clusterID, resource, namespace)
	out, err := clusterSSHRun(clusterID, cmd)
	if err != nil {
		log.Printf("[ClusterAdmin] GetResources error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Filter results for non-admin users querying all namespaces
	if ok && user.Role != "admin" && (namespace == "" || namespace == "all") && resource != "nodes" {
		// Get assigned namespaces
		rows, err := database.DB.Query(
			"SELECT namespace FROM user_namespaces WHERE user_id = ? AND cluster_id = ?",
			user.ID, clusterIDInt,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		assignedNS := make(map[string]bool)
		for rows.Next() {
			var ns string
			if err := rows.Scan(&ns); err != nil {
				continue
			}
			assignedNS[ns] = true
		}

		// Parse and filter resources - use generic unmarshaling to preserve structure
		var data struct {
			Items []map[string]interface{} `json:"items"`
		}
		if err := json.Unmarshal([]byte(out), &data); err != nil {
			// If we can't parse, just return the original output
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(out))
			return
		}

		// Filter items based on namespace
		var filtered []map[string]interface{}
		for _, item := range data.Items {
			metadata, ok := item["metadata"].(map[string]interface{})
			if !ok {
				continue
			}
			itemNS, ok := metadata["namespace"].(string)
			if !ok {
				// For cluster-scoped resources like nodes, include them
				filtered = append(filtered, item)
				continue
			}
			// Only include if in assigned namespaces
			if assignedNS[itemNS] {
				filtered = append(filtered, item)
			}
		}

		// Re-encode filtered results
		result := map[string]interface{}{"items": filtered}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(out))
}

// GetClusterResourceByName fetches a single resource by name
// GET /api/k0s/clusters/{id}/k8s/{resource}/{name}?namespace=xxx
func GetClusterResourceByName(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	resource := vars["resource"]
	name := vars["name"]

	// Validate resource type
	allowed := map[string]bool{
		"pods": true, "deployments": true, "services": true,
		"ingresses": true, "configmaps": true, "secrets": true,
		"statefulsets": true, "daemonsets": true, "jobs": true,
	}
	if !allowed[resource] {
		http.Error(w, "resource not allowed", http.StatusBadRequest)
		return
	}

	namespace := r.URL.Query().Get("namespace")
	if namespace == "" {
		namespace = "default"
	}

	// Check user access to namespace
	user, _ := GetUserFromContext(r.Context())
	clusterIDint, _ := strconv.Atoi(clusterID)
	if user.Role != "admin" {
		if !checkNamespaceAccess(user, clusterIDint, namespace) {
			http.Error(w, "Forbidden: no access to this namespace", http.StatusForbidden)
			return
		}
	}

	// Get resource in JSON format
	cmd := fmt.Sprintf("sudo k0s kubectl get %s %s -n %s -o json", resource, name, namespace)
	log.Printf("[ClusterAdmin] GetResource: cluster=%s %s/%s ns=%s", clusterID, resource, name, namespace)

	out, err := clusterSSHRun(clusterID, cmd)
	if err != nil {
		log.Printf("[ClusterAdmin] GetResourceByName error: %v", err)
		http.Error(w, "Resource not found or error fetching", http.StatusNotFound)
		return
	}

	// Return as raw JSON
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(out))
}

// DeleteClusterResource deletes a k8s resource
// DELETE /api/k0s/clusters/{id}/k8s/{resource}/{name}?namespace=xxx
func DeleteClusterResource(w http.ResponseWriter, r *http.Request) {
	// Check user role - view role cannot delete
	user, ok := GetUserFromContext(r.Context())
	if ok && user.Role == "view" {
		http.Error(w, "view-only users cannot delete resources", http.StatusForbidden)
		return
	}

	vars := mux.Vars(r)
	clusterID := vars["id"]
	resource := vars["resource"]
	name := vars["name"]

	allowed := map[string]bool{
		"pods": true, "deployments": true, "services": true,
		"ingresses": true, "configmaps": true, "secrets": true,
		"statefulsets": true, "daemonsets": true, "jobs": true,
	}
	if !allowed[resource] {
		http.Error(w, "resource not allowed", http.StatusBadRequest)
		return
	}

	namespace := r.URL.Query().Get("namespace")
	if namespace == "" {
		namespace = "default"
	}

	cmd := fmt.Sprintf("sudo k0s kubectl delete %s %s -n %s", resource, name, namespace)
	log.Printf("[ClusterAdmin] Delete: cluster=%s %s/%s ns=%s", clusterID, resource, name, namespace)

	_, err := clusterSSHRun(clusterID, cmd)
	if err != nil {
		log.Printf("[ClusterAdmin] DeleteResource error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// GetResourceLogs returns logs for a pod
// GET /api/k0s/clusters/{id}/k8s/pods/{name}/logs?namespace=xxx&container=xxx
func GetResourceLogs(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	podName := vars["name"]

	namespace := r.URL.Query().Get("namespace")
	if namespace == "" {
		namespace = "default"
	}
	container := r.URL.Query().Get("container")
	tailLines := r.URL.Query().Get("tailLines")

	tail := "--tail=500"
	if tailLines == "0" {
		tail = "" // no limit
	} else if tailLines != "" {
		tail = "--tail=" + tailLines
	}

	cmd := fmt.Sprintf("sudo k0s kubectl logs %s -n %s %s", podName, namespace, tail)
	if container != "" {
		cmd += " -c " + container
	}

	out, err := clusterSSHRun(clusterID, cmd)
	if err != nil {
		log.Printf("[ClusterAdmin] GetLogs error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(out))
}

// GetClusterInfo returns basic cluster info
// GET /api/k0s/clusters/{id}/k8s/info
func GetClusterInfo(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]

	// Run multiple commands and aggregate
	version, _ := clusterSSHRun(clusterID, "sudo k0s kubectl version --short 2>/dev/null || sudo k0s version")
	nodeCount, _ := clusterSSHRun(clusterID, "sudo k0s kubectl get nodes --no-headers 2>/dev/null | wc -l")
	nsCount, _ := clusterSSHRun(clusterID, "sudo k0s kubectl get namespaces --no-headers 2>/dev/null | wc -l")
	podCount, _ := clusterSSHRun(clusterID, "sudo k0s kubectl get pods --all-namespaces --no-headers 2>/dev/null | wc -l")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"version":    strings.TrimSpace(version),
		"node_count": strings.TrimSpace(nodeCount),
		"ns_count":   strings.TrimSpace(nsCount),
		"pod_count":  strings.TrimSpace(podCount),
	})
}

// ApplyClusterResource applies a YAML manifest via kubectl apply -f -
// POST /api/k0s/clusters/{id}/k8s/apply   body: {"yaml":"..."}
// Also saves the YAML to local yaml/ folder for reference
func ApplyClusterResource(w http.ResponseWriter, r *http.Request) {
	// Check user role - view role cannot apply/create
	user, ok := GetUserFromContext(r.Context())
	if ok && user.Role == "view" {
		http.Error(w, "view-only users cannot create or update resources", http.StatusForbidden)
		return
	}

	vars := mux.Vars(r)
	clusterID := vars["id"]

	var body struct {
		YAML string `json:"yaml"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		log.Printf("[ApplyClusterResource] ✗ DECODE ERROR - cluster=%s user=%s error=%v", clusterID, user.Username, err)
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(body.YAML) == "" {
		log.Printf("[ApplyClusterResource] ✗ EMPTY YAML - cluster=%s user=%s", clusterID, user.Username)
		http.Error(w, "YAML body is empty", http.StatusBadRequest)
		return
	}

	// Log incoming YAML (first 300 chars for debugging)
	yamlPreview := body.YAML
	if len(yamlPreview) > 300 {
		yamlPreview = yamlPreview[:300] + "..."
	}
	log.Printf("[ApplyClusterResource] ▶ START - cluster=%s user=%s\n%s", clusterID, user.Username, yamlPreview)

	// === SAVE YAML TO LOCAL FOLDER ===
	// Create yaml folder if it doesn't exist
	yamlDir := "yaml"
	if _, err := os.Stat(yamlDir); os.IsNotExist(err) {
		os.MkdirAll(yamlDir, 0755)
		log.Printf("[ApplyClusterResource] Created yaml directory: %s", yamlDir)
	}

	// Generate filename with timestamp
	timestamp := time.Now().Format("20060102_150405")
	localYamlFile := fmt.Sprintf("%s/resource_%s_cluster%s.yaml", yamlDir, timestamp, clusterID)
	
	// Save YAML to local file
	if err := os.WriteFile(localYamlFile, []byte(body.YAML), 0644); err != nil {
		log.Printf("[ApplyClusterResource] ✗ SAVE ERROR - failed to save YAML: %v", err)
		http.Error(w, "Failed to save YAML file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	log.Printf("[ApplyClusterResource] ✓ SAVED - YAML saved to: %s", localYamlFile)

	// Base64-encode to avoid shell-escaping issues
	encoded := base64.StdEncoding.EncodeToString([]byte(body.YAML))
	
	// Create a script that saves YAML to remote file, tests connection, applies, and debugs
	installAndApplyScript := fmt.Sprintf(`#!/bin/bash
set -e

KUBECTL_CMD=""
YAML_DIR="/var/lib/docker-manager/yaml"
YAML_FILE=""

# Create YAML directory if it doesn't exist
echo "[INFO] Creating YAML directory..."
if sudo -n true 2>/dev/null; then
    sudo mkdir -p "${YAML_DIR}"
    sudo chmod 755 "${YAML_DIR}"
else
    mkdir -p ~/.local/yaml
    YAML_DIR="$HOME/.local/yaml"
fi

# Generate filename with timestamp
TIMESTAMP=$(date +%%Y%%m%%d_%%H%%M%%S)
YAML_FILENAME="${YAML_DIR}/resource_${TIMESTAMP}.yaml"

# Check if k0s kubectl exists (preferred)
if command -v k0s &> /dev/null; then
    echo "[INFO] Using k0s kubectl"
    KUBECTL_CMD="sudo k0s kubectl"
# Check if kubectl exists
elif command -v kubectl &> /dev/null; then
    echo "[INFO] Using kubectl"
    KUBECTL_CMD="kubectl"
else
    echo "[INFO] kubectl not found, installing..."
    
    # Try to install kubectl
    KUBECTL_VERSION=$(curl -s -L https://dl.k8s.io/release/stable.txt)
    KUBECTL_URL="https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
    
    echo "[INFO] Downloading kubectl from ${KUBECTL_URL}"
    # Download to /tmp
    curl -L -o /tmp/kubectl "${KUBECTL_URL}"
    chmod +x /tmp/kubectl
    
    # Try to move to /usr/local/bin with sudo, fallback to ~/.local/bin
    if sudo -n true 2>/dev/null; then
        sudo mv /tmp/kubectl /usr/local/bin/kubectl
        echo "[INFO] kubectl installed to /usr/local/bin"
        KUBECTL_CMD="kubectl"
    else
        mkdir -p ~/.local/bin
        mv /tmp/kubectl ~/.local/bin/kubectl
        export PATH="$HOME/.local/bin:$PATH"
        echo "[INFO] kubectl installed to ~/.local/bin"
        KUBECTL_CMD="kubectl"
    fi
fi

# Check version
echo "[INFO] Using command: ${KUBECTL_CMD}"
${KUBECTL_CMD} version --client=true || echo "[WARN] Could not get client version"

# Test connection to Kubernetes cluster
echo "[INFO] Testing connection to Kubernetes cluster..."
if ${KUBECTL_CMD} cluster-info &>/dev/null; then
    echo "[✓] Successfully connected to Kubernetes cluster"
else
    echo "[✗] Failed to connect to Kubernetes cluster"
    echo "[INFO] Checking kubeconfig..."
    ${KUBECTL_CMD} config view || echo "[WARN] Could not display kubeconfig"
    exit 1
fi

# Get cluster info
echo "[INFO] Cluster info:"
${KUBECTL_CMD} cluster-info

# Test API server connectivity
echo "[INFO] Testing API server..."
if ${KUBECTL_CMD} api-resources &>/dev/null; then
    echo "[✓] API server is accessible"
else
    echo "[✗] Could not access API server"
    exit 1
fi

# Save YAML to file
echo "[INFO] Saving YAML to remote server: ${YAML_FILENAME}..."
echo '%s' | base64 -d > "${YAML_FILENAME}"
echo "[✓] YAML saved to: ${YAML_FILENAME}"
echo "[INFO] YAML content:"
echo "---"
cat "${YAML_FILENAME}"
echo "---"

# Apply the YAML with --validate=false to skip OpenAPI schema validation
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║ APPLYING RESOURCE                                              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
APPLY_OUTPUT=$(${KUBECTL_CMD} apply -f "${YAML_FILENAME}" --validate=false 2>&1)
APPLY_EXITCODE=$?
echo "${APPLY_OUTPUT}"

# Extract namespace and resource type/name from YAML for debugging
NAMESPACE=$(grep -E "^  namespace:" "${YAML_FILENAME}" | head -1 | awk '{print $NF}' || echo "default")
KIND=$(grep -E "^kind:" "${YAML_FILENAME}" | head -1 | awk '{print $NF}' || echo "unknown")
NAME=$(grep -E "^  name:" "${YAML_FILENAME}" | head -1 | awk '{print $NF}' || echo "unknown")

echo ""
echo "Extracted Info: namespace=${NAMESPACE}, kind=${KIND}, name=${NAME}"

# Debug: Only run if apply was successful or if it's a deployment
if [ "${KIND}" = "Deployment" ] || [ "${APPLY_EXITCODE}" -eq 0 ]; then
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║ DEBUGGING: Resource Status & Logs                             ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    
    # Wait a bit for resource to start
    sleep 2
    
    # 1. Check Deployment/Pod Status
    if [ "${KIND}" = "Deployment" ]; then
        echo ""
        echo "━━━ DEPLOYMENT STATUS ━━━"
        ${KUBECTL_CMD} get deployment -n "${NAMESPACE}" "${NAME}" -o wide 2>/dev/null || echo "[WARN] Could not get deployment"
        
        echo ""
        echo "━━━ DEPLOYMENT DESCRIBE ━━━"
        ${KUBECTL_CMD} describe deployment -n "${NAMESPACE}" "${NAME}" 2>/dev/null || echo "[WARN] Could not describe deployment"
        
        # Get replica sets
        echo ""
        echo "━━━ REPLICA SETS ━━━"
        ${KUBECTL_CMD} get replicasets -n "${NAMESPACE}" -l app="${NAME}" 2>/dev/null || echo "[WARN] Could not get replicasets"
    fi
    
    # 2. Check Pods Status
    echo ""
    echo "━━━ POD STATUS ━━━"
    POD_OUTPUT=$(${KUBECTL_CMD} get pods -n "${NAMESPACE}" -l app="${NAME}" -o wide 2>/dev/null)
    if [ -n "${POD_OUTPUT}" ]; then
        echo "${POD_OUTPUT}"
        
        # Get first pod name for detailed debugging
        POD_NAME=$(echo "${POD_OUTPUT}" | tail -1 | awk '{print $1}')
        
        if [ -n "${POD_NAME}" ] && [ "${POD_NAME}" != "NAME" ]; then
            echo ""
            echo "━━━ POD DESCRIBE (${POD_NAME}) ━━━"
            ${KUBECTL_CMD} describe pod -n "${NAMESPACE}" "${POD_NAME}" 2>/dev/null || echo "[WARN] Could not describe pod"
            
            echo ""
            echo "━━━ POD LOGS (${POD_NAME}) ━━━"
            ${KUBECTL_CMD} logs -n "${NAMESPACE}" "${POD_NAME}" --tail=50 2>/dev/null || echo "[WARN] Could not get pod logs"
            
            echo ""
            echo "━━━ POD EVENTS (${POD_NAME}) ━━━"
            ${KUBECTL_CMD} get events -n "${NAMESPACE}" --field-selector involvedObject.name="${POD_NAME}" 2>/dev/null || echo "[WARN] Could not get pod events"
        fi
    else
        echo "[⚠] No pods found for app=${NAME}"
    fi
    
    # 3. Check Namespace Events
    echo ""
    echo "━━━ NAMESPACE EVENTS (Recent) ━━━"
    ${KUBECTL_CMD} get events -n "${NAMESPACE}" --sort-by='.lastTimestamp' 2>/dev/null | tail -10 || echo "[WARN] Could not get namespace events"
    
    # 4. Check Resource Quota
    echo ""
    echo "━━━ RESOURCE QUOTA ━━━"
    QUOTA_OUTPUT=$(${KUBECTL_CMD} describe resourcequota -n "${NAMESPACE}" 2>/dev/null)
    if [ -n "${QUOTA_OUTPUT}" ]; then
        echo "${QUOTA_OUTPUT}"
    else
        echo "[INFO] No resource quotas found in namespace"
    fi
    
    # 5. Check Namespace Resource Usage
    echo ""
    echo "━━━ NAMESPACE RESOURCE USAGE ━━━"
    echo "Running Pods in namespace ${NAMESPACE}:"
    ${KUBECTL_CMD} get pods -n "${NAMESPACE}" --all-containers=true 2>/dev/null | head -20 || echo "[WARN] Could not get pod list"
    
    # 6. Check RBAC if applicable
    echo ""
    echo "━━━ SERVICE ACCOUNT INFO ━━━"
    SA=$(grep -E "serviceAccountName:" "${YAML_FILENAME}" | head -1 | awk '{print $NF}' || echo "default")
    ${KUBECTL_CMD} get serviceaccount -n "${NAMESPACE}" "${SA}" -o yaml 2>/dev/null || echo "[INFO] Using default service account"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║ SUCCESS - Resource applied and saved                           ║"
echo "║ Saved to: ${YAML_FILENAME}                                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
`, encoded)

	// Write script to /tmp and execute it
	cmd := fmt.Sprintf("cat > /tmp/install_and_apply.sh << 'SCRIPT_EOF'\n%s\nSCRIPT_EOF\nchmod +x /tmp/install_and_apply.sh && /tmp/install_and_apply.sh", installAndApplyScript)

	log.Printf("[ApplyClusterResource] Running kubectl apply with comprehensive debugging on cluster %s", clusterID)
	output, err := clusterSSHRun(clusterID, cmd)
	if err != nil {
		log.Printf("[ApplyClusterResource] ✗ SSH ERROR - cluster=%s error=%v\nOutput: %s", clusterID, err, output)
		http.Error(w, "Failed to apply resource. Error: "+err.Error()+"\n\n--- DEBUG OUTPUT ---\n"+output, http.StatusInternalServerError)
		return
	}

	log.Printf("[ApplyClusterResource] ✓ SUCCESS - cluster=%s\nLocal file: %s\nOutput:\n%s", clusterID, localYamlFile, output)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":        true,
		"local_yaml_file": localYamlFile,
		"output":         output,
	})
}

// GetPodDescribe returns detailed information about a pod (kubectl describe)
func GetPodDescribe(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	podName := vars["name"]
	namespace := r.URL.Query().Get("namespace")
	if namespace == "" {
		namespace = "default"
	}

	// Check user access
	user, _ := GetUserFromContext(r.Context())
	clusterIDint, _ := strconv.Atoi(clusterID)
	if user.Role != "admin" {
		if !checkNamespaceAccess(user, clusterIDint, namespace) {
			http.Error(w, "Forbidden: no access to this namespace", http.StatusForbidden)
			return
		}
	}

	cmd := fmt.Sprintf("sudo k0s kubectl describe pod %s -n %s", podName, namespace)
	output, err := clusterSSHRun(clusterID, cmd)
	if err != nil {
		log.Printf("[GetPodDescribe] Error: cluster=%s pod=%s ns=%s error=%v", clusterID, podName, namespace, err)
		http.Error(w, "Failed to describe pod: "+err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(output))
}

// GetPodEvents returns events related to a pod
func GetPodEvents(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	podName := vars["name"]
	namespace := r.URL.Query().Get("namespace")
	if namespace == "" {
		namespace = "default"
	}

	// Check user access
	user, _ := GetUserFromContext(r.Context())
	clusterIDint, _ := strconv.Atoi(clusterID)
	if user.Role != "admin" {
		if !checkNamespaceAccess(user, clusterIDint, namespace) {
			http.Error(w, "Forbidden: no access to this namespace", http.StatusForbidden)
			return
		}
	}

	// Get events for this specific pod
	cmd := fmt.Sprintf("sudo k0s kubectl get events -n %s --field-selector involvedObject.name=%s", namespace, podName)
	output, err := clusterSSHRun(clusterID, cmd)
	if err != nil {
		log.Printf("[GetPodEvents] Error: cluster=%s pod=%s ns=%s error=%v", clusterID, podName, namespace, err)
		http.Error(w, "Failed to get pod events: "+err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(output))
}

