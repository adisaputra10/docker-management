/* ── Cluster Admin JS ────────────────────────────────── */
const API_BASE = '/api';

// ── Auth: inject token into every fetch (same as app.js) ──
const _origFetch = window.fetch.bind(window);
window.fetch = (url, options = {}) => {
    options.headers = options.headers || {};
    const token = localStorage.getItem('authToken');
    if (token) {
        if (!(options.headers instanceof Headers)) {
            options.headers['Authorization'] = `Bearer ${token}`;
        } else {
            options.headers.append('Authorization', `Bearer ${token}`);
        }
    }
    return _origFetch(url, options).then(res => {
        if (res.status === 401 && !url.includes('/auth/login')) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            window.location.href = '/login.html';
        }
        return res;
    });
};

// Helper: Escape HTML special characters
function escapeHtml(text) {
    if (typeof text !== 'string') return String(text);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// State
const state = {
    clusterId: null,
    clusterName: '',
    currentResource: 'nodes',
    currentNamespace: 'all',
    namespaces: [],
    data: null,
    allItems: [],
    searchQuery: '',
    currentPage: 1,
    pageSize: 20,
    nsQuotas: {},
    nsUsage: {},
    nodeMetrics: {},
    podMetrics: {},
};

// ── Helper: Check if current user can create/delete (not view-only) ──
function canUserCreateOrDelete() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const role = userData.role || 'user';
    // Hide create/delete for view-only K8s users
    if (role === 'user_k8s_view') {
        return false;
    }
    return role !== 'view';
}

// ── Helper: Check if current user is admin ──
function isUserAdmin() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    return userData.role === 'admin';
}

// ── Helper: Update sidebar visibility based on user role ──
function updateSidebarVisibility() {
    const clusterSection = document.getElementById('cluster-admin-section');
    if (clusterSection) {
        clusterSection.style.display = isUserAdmin() ? 'block' : 'none';
    }
}

// ── Init ──––––––––––––––––––––––––––––––––––––––––––
window.addEventListener('DOMContentLoaded', () => {
    // Redirect to login if not authenticated
    if (!localStorage.getItem('authToken')) {
        window.location.href = '/login.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    state.clusterId = params.get('id');
    state.clusterName = params.get('name') || 'Cluster';

    if (!state.clusterId) {
        document.getElementById('main-content').innerHTML =
            '<div class="empty-state"><div class="empty-icon">⚠️</div><div>No cluster ID provided. Go back and click "Masuk Cluster".</div></div>';
        return;
    }

    document.getElementById('cluster-name-title').textContent = state.clusterName;
    document.title = `${state.clusterName} — Cluster Admin`;

    updateSidebarVisibility();
    loadClusterMeta();
    loadNamespaces();
    selectResource('nodes');
});

// ── Load cluster meta from API ────────────────────────
async function loadClusterMeta() {
    try {
        const res = await fetch(`${API_BASE}/k0s/clusters/${state.clusterId}`);
        if (!res.ok) return;
        const cluster = await res.json();
        document.getElementById('cluster-ip-subtitle').textContent = cluster.ip_address || '';
        const badge = document.getElementById('cluster-status-badge');
        badge.textContent = cluster.status || 'unknown';
        badge.className = 'topbar-badge' + (cluster.status === 'running' ? '' : ' stopped');
    } catch (e) { /* silent */ }

    // Load cluster info (node/pod/ns counts)
    try {
        const res = await fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/info`);
        if (!res.ok) return;
        const info = await res.json();
        document.getElementById('stat-nodes').textContent = info.node_count || '—';
        document.getElementById('stat-pods').textContent = info.pod_count || '—';
        document.getElementById('stat-ns').textContent = info.ns_count || '—';
    } catch (e) { /* silent */ }
}

// ── Load Namespaces ───────────────────────────────────
async function loadNamespaces() {
    try {
        const res = await fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/namespaces`);
        if (!res.ok) return;
        const data = await res.json();
        const items = data.items || [];
        state.namespaces = items.map(i => i.metadata.name);

        const sel = document.getElementById('ns-select');
        sel.innerHTML = '<option value="all">All Namespaces</option>';
        state.namespaces.forEach(ns => {
            const opt = document.createElement('option');
            opt.value = ns;
            opt.textContent = ns;
            sel.appendChild(opt);
        });
    } catch (e) {
        console.error('loadNamespaces error:', e);
    }
}

// ── Resource navigation ───────────────────────────────
const RESOURCE_META = {
    nodes:                  { label: 'Nodes',        icon: '🖥️',  subtitle: 'All nodes in the cluster' },
    deployments:            { label: 'Deployments',  icon: '🚀',  subtitle: 'Application deployments' },
    pods:                   { label: 'Pods',          icon: '📦',  subtitle: 'Running pods' },
    statefulsets:           { label: 'StatefulSets', icon: '🗄️',  subtitle: 'Stateful application sets' },
    daemonsets:             { label: 'DaemonSets',   icon: '👾',  subtitle: 'Daemon sets' },
    jobs:                   { label: 'Jobs',          icon: '⚙️',  subtitle: 'Batch jobs' },
    events:                 { label: 'Events',       icon: '📢',  subtitle: 'Cluster events' },
    services:               { label: 'Services',     icon: '🔗',  subtitle: 'Kubernetes services' },
    ingresses:              { label: 'Ingresses',    icon: '🌐',  subtitle: 'Ingress rules' },
    configmaps:             { label: 'ConfigMaps',   icon: '📄',  subtitle: 'Configuration maps' },
    secrets:                { label: 'Secrets',      icon: '🔑',  subtitle: 'Kubernetes secrets' },
    persistentvolumeclaims: { label: 'PVCs',         icon: '💾',  subtitle: 'Persistent volume claims' },
    namespaces:             { label: 'Namespaces',   icon: '🏷️',  subtitle: 'Cluster namespaces' },
    users:                  { label: 'Users',        icon: '👥',  subtitle: 'System users' },
};

// Resources that support namespace filtering
const NAMESPACED_RESOURCES = new Set(['deployments','pods','services','ingresses','configmaps','secrets','statefulsets','daemonsets','jobs','persistentvolumeclaims','events']);
// Cluster-scoped resources (no namespace filter, no namespace dropdown)
const CLUSTER_SCOPED = new Set(['nodes','namespaces','users']);

function selectResource(resource, el) {
    state.currentResource = resource;

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');
    else {
        const target = document.querySelector(`[data-resource="${resource}"]`);
        if (target) target.classList.add('active');
    }

    const meta = RESOURCE_META[resource] || { label: resource, subtitle: '' };
    document.getElementById('resource-title').textContent = `${meta.icon} ${meta.label}`;
    document.getElementById('resource-subtitle').textContent = meta.subtitle;

    loadResource();
}

function onNamespaceChange(ns) {
    state.currentNamespace = ns;
    // Sync sidebar dropdown
    const sel = document.getElementById('ns-select');
    if (sel) sel.value = ns;
    loadResource();
}

function filterByNs(ns) {
    state.currentNamespace = ns;
    // Sync sidebar dropdown
    const sel = document.getElementById('ns-select');
    if (sel) sel.value = ns;
    loadResource();
}

function refreshResource() {
    loadClusterMeta();
    loadResource();
}

// ── Load & render resource ────────────────────────────
async function loadResource() {
    const content = document.getElementById('main-content');
    content.innerHTML = '<div class="loading-state"><div class="spinner"></div><div>Loading...</div></div>';

    try {
        let url;
        let data;
        
        // Special handling for users resource
        if (state.currentResource === 'users') {
            const res = await fetch(`${API_BASE}/users`);
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || `HTTP ${res.status}`);
            }
            data = await res.json();
            // If data is array of users, convert to items format
            if (Array.isArray(data)) {
                state.allItems = data;
            } else {
                state.allItems = data.items || [];
            }
        } else if (CLUSTER_SCOPED.has(state.currentResource)) {
            url = `${API_BASE}/k0s/clusters/${state.clusterId}/k8s/${state.currentResource}`;
            const res = await fetch(url);
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || `HTTP ${res.status}`);
            }
            data = await res.json();
            state.allItems = data.items || [];
            
            // If loading nodes, also fetch metrics
            if (state.currentResource === 'nodes') {
                try {
                    const metricsRes = await fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/nodes-metrics`);
                    if (metricsRes.ok) {
                        const metricsData = await metricsRes.json();
                        state.nodeMetrics = (metricsData.items || []).reduce((acc, metric) => {
                            acc[metric.metadata.name] = metric.usage || {};
                            return acc;
                        }, {});
                    }
                } catch (e) {
                    log(`[loadResource] Warning: Could not fetch node metrics: ${e.message}`);
                    state.nodeMetrics = {};
                }
            }
        } else {
            const ns = state.currentNamespace || 'all';
            url = `${API_BASE}/k0s/clusters/${state.clusterId}/k8s/${state.currentResource}?namespace=${ns}`;
            const res = await fetch(url);
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || `HTTP ${res.status}`);
            }
            data = await res.json();
            state.allItems = data.items || [];
            
            // If loading pods or deployments, also fetch pod metrics
            if (state.currentResource === 'pods' || state.currentResource === 'deployments') {
                try {
                    const metricsRes = await fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/pods-metrics?namespace=${ns}`);
                    if (metricsRes.ok) {
                        const metricsData = await metricsRes.json();
                        state.podMetrics = (metricsData.items || []).reduce((acc, metric) => {
                            const key = (metric.metadata.namespace || 'default') + '/' + metric.metadata.name;
                            acc[key] = metric.containers || [];
                            return acc;
                        }, {});
                    }
                } catch (e) {
                    log(`[loadResource] Warning: Could not fetch pod metrics: ${e.message}`);
                    state.podMetrics = {};
                }
            }
        }
        
        state.data = data;
        // Also fetch quotas + pod usage when viewing namespaces
        if (state.currentResource === 'namespaces') {
            const [quotaRes, usageRes] = await Promise.allSettled([
                fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/quotas`),
                fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/ns-usage`),
            ]);
            try {
                const qData = await quotaRes.value.json();
                state.nsQuotas = {};
                (qData.items || []).forEach(q => {
                    const ns = q.metadata.namespace;
                    state.nsQuotas[ns] = q.spec?.hard || {};
                });
            } catch (_) { state.nsQuotas = {}; }
            try {
                state.nsUsage = await usageRes.value.json();
            } catch (_) { state.nsUsage = {}; }
        }
        state.searchQuery = '';
        state.currentPage = 1;
        // Update sidebar count
        const cntEl = document.getElementById(`cnt-${state.currentResource}`);
        if (cntEl) cntEl.textContent = state.allItems.length;
        renderAll();
    } catch (e) {
        const content2 = document.getElementById('main-content');
        content2.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div>Error: ${e.message}</div></div>`;
    }
}

// ── Renderers ─────────────────────────────────────────
function renderResource(resource, items) {
    switch (resource) {
        case 'nodes':                  return renderNodes(items);
        case 'pods':                   return renderPods(items);
        case 'deployments':            return renderDeployments(items);
        case 'services':               return renderServices(items);
        case 'ingresses':              return renderIngresses(items);
        case 'configmaps':             return renderConfigMaps(items);
        case 'secrets':                return renderSecrets(items);
        case 'namespaces':             return renderNamespaces(items);
        case 'users':                  return renderUsers(items);
        case 'events':                 return renderEvents(items);
        case 'statefulsets':
        case 'daemonsets':             return renderWorkloadGeneric(items, resource);
        default:                       return renderGeneric(items);
    }
}

function statusBadge(status) {
    const s = (status || 'unknown').toLowerCase().replace(/\s+/g, '');
    return `<span class="badge badge-${s}">${status || 'Unknown'}</span>`;
}

function age(timestamp) {
    if (!timestamp) return '—';
    const diff = Date.now() - new Date(timestamp).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}

/* NODES */
function renderNodes(items) {
    const rows = items.map(n => {
        const name = n.metadata.name;
        const roles = Object.keys(n.metadata.labels || {})
            .filter(k => k.startsWith('node-role.kubernetes.io/'))
            .map(k => k.replace('node-role.kubernetes.io/', ''))
            .join(', ') || 'worker';
        const readyCond = (n.status.conditions || []).find(c => c.type === 'Ready');
        const ready = readyCond && readyCond.status === 'True';
        const version = n.status.nodeInfo?.kubeletVersion || '—';
        const ip = (n.status.addresses || []).find(a => a.type === 'InternalIP')?.address || '—';
        const os = n.status.nodeInfo?.osImage || '—';
        const cpuCapacity = n.status.capacity?.cpu || '—';
        const memCapacity = n.status.capacity?.memory || '—';
        
        // Get metrics for this node
        const metrics = state.nodeMetrics[name] || {};
        const cpuUsage = metrics.cpu || '—';
        const memUsage = metrics.memory || '—';
        
        // Format display: show usage / capacity in cores (not millis/nanos)
        let cpuDisplay = cpuUsage === '—' ? fmtCPU(cpuCapacity) : fmtCPU(cpuUsage) + ' / ' + fmtCPU(cpuCapacity);
        let memDisplay = memUsage === '—' ? fmtMem(memCapacity) : fmtMem(memUsage) + ' / ' + fmtMem(memCapacity);
        
        // Calculate percentage if both available
        let tooltip = '';
        if (cpuUsage !== '—' && cpuCapacity !== '—') {
            // Parse CPU values - handle both nanocores (n) and millicores (m)
            let usageNum = 0, capacityNum = 0;
            if (cpuUsage.endsWith('n')) {
                usageNum = parseInt(cpuUsage.replace('n', '')) / 1000000000;
            } else if (cpuUsage.endsWith('m')) {
                usageNum = parseInt(cpuUsage.replace('m', '')) / 1000;
            } else {
                usageNum = parseFloat(cpuUsage);
            }
            if (cpuCapacity.endsWith('m')) {
                capacityNum = parseInt(cpuCapacity.replace('m', '')) / 1000;
            } else {
                capacityNum = parseFloat(cpuCapacity);
            }
            if (!isNaN(usageNum) && !isNaN(capacityNum) && capacityNum > 0) {
                const cpuPercent = ((usageNum / capacityNum) * 100).toFixed(1);
                tooltip += `CPU: ${cpuPercent}% used\n`;
            }
        }
        if (memUsage !== '—' && memCapacity !== '—') {
            try {
                const memUsageNum = parseInt(memUsage.replace('Ki', ''));
                const memCapacityNum = parseInt(memCapacity.replace('Ki', ''));
                if (!isNaN(memUsageNum) && !isNaN(memCapacityNum)) {
                    const memPercent = ((memUsageNum / memCapacityNum) * 100).toFixed(1);
                    tooltip += `Memory: ${memPercent}% used`;
                }
            } catch (e) {}
        }
        
        return `<tr>
            <td><strong>${name}</strong></td>
            <td>${statusBadge(ready ? 'Ready' : 'NotReady')}</td>
            <td><span style="color:#94a3b8">${roles}</span></td>
            <td>${ip}</td>
            <td>${version}</td>
            <td>${os}</td>
            <td title="${tooltip}"><div style="display:flex;gap:0.5rem;align-items:center">
                <span>${cpuDisplay}</span>
                <span style="color:#94a3b8">│</span>
                <span>${memDisplay}</span>
            </div></td>
            <td style="color:#64748b">${age(n.metadata.creationTimestamp)}</td>
            <td>
                <button class="btn btn-ghost" style="padding:0.2rem 0.6rem;font-size:0.75rem" onclick="showNodeLabelModal('${name}')">🏷️ Labels</button>
            </td>
        </tr>`;
    }).join('');
    return `<table class="resource-table">
        <thead><tr>
            <th>Name</th><th>Status</th><th>Roles</th><th>IP</th>
            <th>Version</th><th>OS</th><th>CPU / Memory (Usage/Capacity)</th><th>Age</th><th>Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

// ── Pod Details Modal ────────────────────────────────────
function closePodDetailsModal() {
    document.getElementById('pod-details-modal').classList.remove('open');
}

async function showPodDetails(podName, namespace) {
    document.getElementById('pod-details-title').textContent = `Pod: ${podName}`;
    document.getElementById('pod-describe').textContent = 'Loading...';
    document.getElementById('pod-events').textContent = 'Loading...';
    document.getElementById('pod-details-modal').classList.add('open');

    try {
        // Fetch pod describe
        const desc = await fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/pods/${podName}/describe?namespace=${namespace}`)
            .then(r => r.text());
        document.getElementById('pod-describe').textContent = desc;
    } catch (e) {
        document.getElementById('pod-describe').textContent = 'Error fetching pod description:\n' + e.message;
    }

    try {
        // Fetch pod events
        const events = await fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/pods/${podName}/events?namespace=${namespace}`)
            .then(r => r.text());
        document.getElementById('pod-events').textContent = events || 'No events found';
    } catch (e) {
        document.getElementById('pod-events').textContent = 'Error fetching pod events:\n' + e.message;
    }
}

/* PODS */
function renderPods(items) {
    const canDelete = canUserCreateOrDelete();
    const rows = items.map(p => {
        const name = p.metadata.name;
        const ns = p.metadata.namespace || '—';
        const phase = p.status.phase || 'Unknown';
        const containers = p.spec.containers?.length || 0;
        const ready = (p.status.containerStatuses || []).filter(c => c.ready).length;
        const restarts = (p.status.containerStatuses || []).reduce((s, c) => s + (c.restartCount || 0), 0);
        const nodeName = p.spec.nodeName || '—';
        const ip = p.status.podIP || '—';
        const hasDel = phase !== 'Succeeded' && canDelete;
        
        // Get aggregated CPU/Memory limits from container specs
        let totalCpuLimit = '—', totalMemLimit = '—', totalCpuRequest = '—', totalMemRequest = '—';
        let cpuLimitNum = 0, memLimitNum = 0, cpuReqNum = 0, memReqNum = 0;
        (p.spec.containers || []).forEach(c => {
            const res = c.resources || {};
            const limits = res.limits || {};
            const requests = res.requests || {};
            
            if (limits.cpu) {
                if (limits.cpu.endsWith('m')) {
                    cpuLimitNum += parseInt(limits.cpu) / 1000;
                } else {
                    cpuLimitNum += parseFloat(limits.cpu);
                }
            }
            if (limits.memory) {
                memLimitNum += parseInt(limits.memory.replace('Mi', '')) || 0;
            }
            if (requests.cpu) {
                if (requests.cpu.endsWith('m')) {
                    cpuReqNum += parseInt(requests.cpu) / 1000;
                } else {
                    cpuReqNum += parseFloat(requests.cpu);
                }
            }
            if (requests.memory) {
                memReqNum += parseInt(requests.memory.replace('Mi', '')) || 0;
            }
        });
        
        if (cpuLimitNum > 0) totalCpuLimit = fmtCPU((cpuLimitNum * 1000) + 'm');
        if (memLimitNum > 0) totalMemLimit = memLimitNum + ' Mi';
        if (cpuReqNum > 0) totalCpuRequest = fmtCPU((cpuReqNum * 1000) + 'm');
        if (memReqNum > 0) totalMemRequest = memReqNum + ' Mi';
        
        // Get metrics for this pod
        const metricKey = ns + '/' + name;
        const podMetrics = state.podMetrics[metricKey] || [];
        let totalCpuUsage = '—', totalMemUsage = '—';
        let cpuUsageNum = 0, memUsageNum = 0;
        podMetrics.forEach(mc => {
            if (mc.usage?.cpu) {
                if (mc.usage.cpu.endsWith('n')) {
                    cpuUsageNum += parseInt(mc.usage.cpu) / 1000000000;
                } else if (mc.usage.cpu.endsWith('m')) {
                    cpuUsageNum += parseInt(mc.usage.cpu) / 1000;
                }
            }
            if (mc.usage?.memory) {
                memUsageNum += parseInt(mc.usage.memory.replace('Ki', '')) / 1024 || 0;
            }
        });
        
        if (cpuUsageNum > 0) totalCpuUsage = fmtCPU((cpuUsageNum * 1000) + 'm');
        if (memUsageNum > 0) totalMemUsage = Math.round(memUsageNum) + ' Mi';
        
        const cpuDisplay = totalCpuUsage === '—' ? totalCpuLimit : totalCpuUsage + ' / ' + totalCpuLimit;
        const memDisplay = totalMemUsage === '—' ? totalMemLimit : totalMemUsage + ' / ' + totalMemLimit;
        
        return `<tr>
            <td><strong>${name}</strong></td>
            <td><span style="color:#64748b;font-size:0.75rem">${ns}</span></td>
            <td>${statusBadge(phase)}</td>
            <td>${ready}/${containers}</td>
            <td>${restarts > 0 ? `<span style="color:#f59e0b">${restarts}</span>` : restarts}</td>
            <td style="color:#94a3b8">${nodeName}</td>
            <td style="color:#94a3b8">${ip}</td>
            <td><div style="display:flex;gap:0.5rem;align-items:center">
                <span>${cpuDisplay}</span>
                <span style="color:#94a3b8">│</span>
                <span>${memDisplay}</span>
            </div></td>
            <td style="color:#64748b">${age(p.metadata.creationTimestamp)}</td>
            <td>
                <button class="btn btn-ghost" style="padding:0.2rem 0.6rem;font-size:0.75rem" onclick="showPodDetails('${name}','${ns}')">ℹ️ Details</button>
                <button class="btn btn-ghost" style="padding:0.2rem 0.6rem;font-size:0.75rem;margin-left:0.25rem" onclick="showLogs('${ns}','${name}')">📋 Logs</button>
                <button class="btn btn-ghost" style="padding:0.2rem 0.6rem;font-size:0.75rem;margin-left:0.25rem;background:#0f4c75;color:#e2f0ff" onclick="execPod('${ns}','${name}')">💻 Exec</button>
                ${hasDel ? `<button class="btn btn-danger" style="padding:0.2rem 0.6rem;font-size:0.75rem;margin-left:0.25rem" onclick="deleteResource('pods','${name}','${ns}')">🗑️</button>` : ''}
            </td>
        </tr>`;
    }).join('');
    return `<table class="resource-table">
        <thead><tr>
            <th>Name</th><th>Namespace</th><th>Status</th><th>Ready</th>
            <th>Restarts</th><th>Node</th><th>IP</th><th>CPU / Memory (Usage/Limit)</th><th>Age</th><th>Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

/* EVENTS */
function renderEvents(items) {
    const rows = items.map(e => {
        const name = e.metadata.name || '—';
        const ns = e.metadata.namespace || '—';
        const involvedObj = e.involvedObject || {};
        const objType = involvedObj.kind || '—';
        const objName = involvedObj.name || '—';
        const reason = e.reason || '—';
        const message = e.message || '—';
        const type = e.type || 'Normal';
        const msgPreview = message.length > 60 ? message.substring(0, 60) + '...' : message;
        const typeColor = type === 'Warning' ? '#f59e0b' : (type === 'Error' ? '#ef4444' : '#10b981');
        return `<tr>
            <td><strong>${name}</strong></td>
            <td><span style="color:#64748b;font-size:0.75rem">${ns}</span></td>
            <td>${objType}</td>
            <td><strong>${objName}</strong></td>
            <td><span style="color:${typeColor};font-weight:500">${type}</span></td>
            <td><strong>${reason}</strong></td>
            <td title="${message}" style="max-width:250px;overflow:hidden;text-overflow:ellipsis;color:#94a3b8">${msgPreview}</td>
            <td style="color:#64748b">${age(e.lastTimestamp)}</td>
        </tr>`;
    }).join('');
    return `<table class="resource-table">
        <thead><tr>
            <th>Name</th><th>Namespace</th><th>Type</th><th>Object</th>
            <th>Event Type</th><th>Reason</th><th>Message</th><th>Age</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

/* DEPLOYMENTS */
function renderDeployments(items) {
    const canEdit = canUserCreateOrDelete();
    const rows = items.map(d => {
        const name = d.metadata.name;
        const ns = d.metadata.namespace || '—';
        const desired = d.spec.replicas || 0;
        const ready = d.status.readyReplicas || 0;
        const available = d.status.availableReplicas || 0;
        const images = (d.spec.template.spec.containers || []).map(c => c.image.split('/').pop()).join(', ');
        const statusStr = ready === desired ? 'Available' : (ready > 0 ? 'Partial' : 'Unavailable');
        
        // Calculate aggregated pod template limits
        let totalCpuLimit = '—', totalMemLimit = '—';
        let cpuLimitNum = 0, memLimitNum = 0;
        (d.spec.template.spec.containers || []).forEach(c => {
            const res = c.resources || {};
            const limits = res.limits || {};
            
            if (limits.cpu) {
                if (limits.cpu.endsWith('m')) {
                    cpuLimitNum += parseInt(limits.cpu) / 1000;
                } else {
                    cpuLimitNum += parseFloat(limits.cpu);
                }
            }
            if (limits.memory) {
                memLimitNum += parseInt(limits.memory.replace('Mi', '')) || 0;
            }
        });
        
        if (cpuLimitNum > 0) totalCpuLimit = fmtCPU((cpuLimitNum * 1000) + 'm');
        if (memLimitNum > 0) totalMemLimit = memLimitNum + ' Mi';
        
        const cpuMemDisplay = totalCpuLimit !== '—' || totalMemLimit !== '—' ? 
            `${totalCpuLimit} / ${totalMemLimit}` : '—';
        
        return `<tr style="cursor:pointer;transition:background 0.2s" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''" onclick="viewDeploymentDetail('${name}','${ns}')">
            <td><strong>📦 ${name}</strong></td>
            <td><span style="color:#64748b;font-size:0.75rem">${ns}</span></td>
            <td>${statusBadge(statusStr)}</td>
            <td>${ready}/${desired}</td>
            <td>${available}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;color:#94a3b8">${images}</td>
            <td>${cpuMemDisplay}</td>
            <td style="color:#64748b">${age(d.metadata.creationTimestamp)}</td>
            <td onclick="event.stopPropagation()">
                ${canEdit ? `<button class="btn btn-ghost" style="padding:0.2rem 0.6rem;font-size:0.75rem;margin-right:0.2rem" onclick="editResource('deployments','${name}','${ns}')">✏️ Edit</button>` : ''}
                ${canEdit ? `<button class="btn btn-danger" style="padding:0.2rem 0.6rem;font-size:0.75rem" onclick="deleteResource('deployments','${name}','${ns}')">🗑️ Delete</button>` : ''}
            </td>
        </tr>`;
    }).join('');
    return `<table class="resource-table">
        <thead><tr>
            <th>Name</th><th>Namespace</th><th>Status</th><th>Ready</th>
            <th>Available</th><th>Image</th><th>Pod Limits (CPU/Memory)</th><th>Age</th><th>Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

/* SERVICES */
function renderServices(items) {
    const rows = items.map(s => {
        const name = s.metadata.name;
        const ns = s.metadata.namespace || '—';
        const type = s.spec.type || '—';
        const clusterIP = s.spec.clusterIP || '—';
        const externalIP = (s.status.loadBalancer?.ingress || []).map(i => i.ip || i.hostname).join(', ') || '—';
        const ports = (s.spec.ports || []).map(p => `${p.port}${p.targetPort ? ':' + p.targetPort : ''}/${p.protocol}`).join(', ');
        return `<tr>
            <td><strong>${name}</strong></td>
            <td><span style="color:#64748b;font-size:0.75rem">${ns}</span></td>
            <td>${statusBadge(type)}</td>
            <td style="color:#94a3b8">${clusterIP}</td>
            <td>${externalIP !== '—' ? `<span style="color:#22c55e">${externalIP}</span>` : '<span style="color:#64748b">—</span>'}</td>
            <td style="color:#94a3b8">${ports}</td>
            <td style="color:#64748b">${age(s.metadata.creationTimestamp)}</td>
        </tr>`;
    }).join('');
    return `<table class="resource-table">
        <thead><tr>
            <th>Name</th><th>Namespace</th><th>Type</th><th>Cluster IP</th>
            <th>External IP</th><th>Ports</th><th>Age</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

/* INGRESSES */
function renderIngresses(items) {
    if (!items.length) return `<div class="empty-state"><div class="empty-icon">🌐</div><div>No Ingresses found</div></div>`;
    const canDelete = canUserCreateOrDelete();
    const rows = items.map(i => {
        const name = i.metadata.name;
        const ns = i.metadata.namespace || '—';
        const className = i.spec.ingressClassName || i.metadata.annotations?.['kubernetes.io/ingress.class'] || '—';
        const rules = (i.spec.rules || []).map(r => r.host || '*').join(', ') || '—';
        const tls = (i.spec.tls || []).length > 0 ? '🔒 TLS' : '—';
        return `<tr>
            <td><strong>${name}</strong></td>
            <td><span style="color:#64748b;font-size:0.75rem">${ns}</span></td>
            <td style="color:#94a3b8">${className}</td>
            <td style="color:#60a5fa">${rules}</td>
            <td>${tls}</td>
            <td style="color:#64748b">${age(i.metadata.creationTimestamp)}</td>
            <td>
                ${canDelete ? `<button class="btn btn-ghost" style="padding:0.2rem 0.6rem;font-size:0.75rem;margin-right:0.2rem" onclick="editResource('ingresses','${name}','${ns}')">✏️ Edit</button>` : ''}
                ${canDelete ? `<button class="btn btn-danger" style="padding:0.2rem 0.6rem;font-size:0.75rem" onclick="deleteResource('ingresses','${name}','${ns}')">🗑️</button>` : ''}
            </td>
        </tr>`;
    }).join('');
    return `<table class="resource-table">
        <thead><tr>
            <th>Name</th><th>Namespace</th><th>Class</th><th>Hosts</th>
            <th>TLS</th><th>Age</th><th>Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

/* CONFIGMAPS */
function renderConfigMaps(items) {
    const rows = items.map(c => {
        const name = c.metadata.name;
        const ns = c.metadata.namespace || '—';
        const keys = Object.keys(c.data || {}).length;
        return `<tr>
            <td><strong>${name}</strong></td>
            <td><span style="color:#64748b;font-size:0.75rem">${ns}</span></td>
            <td>${keys} key${keys !== 1 ? 's' : ''}</td>
            <td style="color:#64748b">${age(c.metadata.creationTimestamp)}</td>
        </tr>`;
    }).join('');
    return `<table class="resource-table">
        <thead><tr><th>Name</th><th>Namespace</th><th>Data</th><th>Age</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

/* Generic workload (statefulsets, daemonsets) */
function renderWorkloadGeneric(items, resource) {
    const canDelete = canUserCreateOrDelete();
    const rows = items.map(d => {
        const name = d.metadata.name;
        const ns = d.metadata.namespace || '—';
        const desired = d.spec.replicas || d.status.desiredNumberScheduled || 0;
        const ready = d.status.readyReplicas || d.status.numberReady || 0;
        const images = (d.spec.template.spec.containers || []).map(c => c.image.split('/').pop()).join(', ');
        return `<tr>
            <td><strong>${name}</strong></td>
            <td><span style="color:#64748b;font-size:0.75rem">${ns}</span></td>
            <td>${statusBadge(ready === desired ? 'Available' : 'Partial')}</td>
            <td>${ready}/${desired}</td>
            <td style="color:#94a3b8;max-width:200px;overflow:hidden;text-overflow:ellipsis">${images}</td>
            <td style="color:#64748b">${age(d.metadata.creationTimestamp)}</td>
            <td>
                ${canDelete ? `<button class="btn btn-ghost" style="padding:0.2rem 0.6rem;font-size:0.75rem;margin-right:0.2rem" onclick="editResource('${resource}','${name}','${ns}')">✏️ Edit</button>` : ''}
                ${canDelete ? `<button class="btn btn-danger" style="padding:0.2rem 0.6rem;font-size:0.75rem" onclick="deleteResource('${resource}','${name}','${ns}')">🗑️</button>` : ''}
            </td>
        </tr>`;
    }).join('');
    return `<table class="resource-table">
        <thead><tr><th>Name</th><th>Namespace</th><th>Status</th><th>Ready</th><th>Image</th><th>Age</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

/* SECRETS */
function renderSecrets(items) {
    const canDelete = canUserCreateOrDelete();
    const rows = items.map(s => {
        const name = s.metadata.name;
        const ns = s.metadata.namespace || '—';
        const type = s.type || '—';
        const keys = Object.keys(s.data || {}).length;
        const isServiceAccount = type === 'kubernetes.io/service-account-token';
        return `<tr>
            <td><strong>${name}</strong></td>
            <td><span style="color:#64748b;font-size:0.75rem">${ns}</span></td>
            <td><span style="color:#94a3b8;font-size:0.78rem">${type}</span></td>
            <td>${keys} key${keys !== 1 ? 's' : ''}</td>
            <td style="color:#64748b">${age(s.metadata.creationTimestamp)}</td>
            <td>
                ${!isServiceAccount && canDelete ? `<button class="btn btn-ghost" style="padding:0.2rem 0.6rem;font-size:0.75rem;margin-right:0.2rem" onclick="editResource('secrets','${name}','${ns}')">✏️ Edit</button>` : ''}
                ${!isServiceAccount && canDelete ? `<button class="btn btn-danger" style="padding:0.2rem 0.6rem;font-size:0.75rem" onclick="deleteResource('secrets','${name}','${ns}')">🗑️</button>` : (isServiceAccount ? '<span style="color:#64748b;font-size:0.75rem">system</span>' : '')}
            </td>
        </tr>`;
    }).join('');
    return `<table class="resource-table">
        <thead><tr><th>Name</th><th>Namespace</th><th>Type</th><th>Data</th><th>Age</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

/* NAMESPACES */
const NS_SYSTEM = new Set(['default','kube-system','kube-public','kube-node-lease']);

// Parse a k8s quantity string to a number (CPU→cores, Memory→bytes)
function parseK8sQty(s) {
    if (!s || s === '—') return 0;
    s = String(s).trim();
    const mem = [['Ki',1024],['Mi',1024**2],['Gi',1024**3],['Ti',1024**4],['K',1e3],['M',1e6],['G',1e9]];
    for (const [sfx, mult] of mem) { if (s.endsWith(sfx)) return parseFloat(s) * mult; }
    if (s.endsWith('m')) return parseFloat(s) / 1000; // millicores → cores
    return parseFloat(s) || 0;
}

// Render a used / limit cell with mini progress bar
function usageLimitCell(usedRaw, limitRaw) {
    const u = usedRaw  || '';
    const l = limitRaw || '';
    if (!u && !l) return '<span style="color:#475569">—</span>';
    if (!l) return `<span style="color:#94a3b8;font-size:0.78rem">${u} <span style="color:#475569;font-size:0.7rem">/ ∞</span></span>`;
    if (!u) return `<span style="color:#475569;font-size:0.78rem">0 <span style="color:#64748b">/ ${l}</span></span>`;
    const pct   = Math.min(100, Math.round(parseK8sQty(u) / (parseK8sQty(l) || 1) * 100));
    const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';
    return `<div style="min-width:100px">
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:2px">
            <span style="color:${color};font-weight:600">${u}</span>
            <span style="color:#475569">/ ${l}</span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${color};border-radius:2px;transition:width .3s"></div>
        </div>
    </div>`;
}

function renderNamespaces(items) {
    const quotas = state.nsQuotas || {};
    const usage  = state.nsUsage  || {};
    const rows = items.map(n => {
        const name     = n.metadata.name;
        const phase    = n.status.phase || 'Active';
        const isSystem = NS_SYSTEM.has(name);
        const q  = quotas[name] || {};
        const u  = usage[name]  || {};
        const hasQuota = Object.keys(q).length > 0;
        const quotaBtnStyle = hasQuota
            ? 'padding:0.2rem 0.6rem;font-size:0.75rem;background:#1e40af;color:#fff;border-color:#1e40af'
            : 'padding:0.2rem 0.6rem;font-size:0.75rem';
        const podBadge = u.pod_count
            ? ` <span title="Running pods" style="font-size:0.68rem;color:#64748b;background:rgba(255,255,255,0.06);padding:0.1rem 0.35rem;border-radius:4px">${u.pod_count}p</span>`
            : '';
        return `<tr>
            <td><strong>${name}</strong>${isSystem ? ' <span style="font-size:0.68rem;color:#64748b;background:rgba(255,255,255,0.06);padding:0.1rem 0.4rem;border-radius:4px;margin-left:0.3rem">system</span>' : ''}${podBadge}</td>
            <td>${statusBadge(phase)}</td>
            <td>${usageLimitCell(u.cpu_req, q['requests.cpu'])}</td>
            <td>${usageLimitCell(u.cpu_lmt, q['limits.cpu'])}</td>
            <td>${usageLimitCell(u.mem_req, q['requests.memory'])}</td>
            <td>${usageLimitCell(u.mem_lmt, q['limits.memory'])}</td>
            <td style="color:#64748b">${age(n.metadata.creationTimestamp)}</td>
            <td>
                <button class="btn btn-ghost" style="${quotaBtnStyle}" onclick='openNsQuotaModal("${name}")'>⚙️ Quota</button>
                ${!isSystem ? `<button class="btn btn-danger" style="padding:0.2rem 0.6rem;font-size:0.75rem;margin-left:0.25rem" onclick="deleteNamespace('${name}')">\ud83d\uddd1\ufe0f Delete</button>` : ''}
            </td>
        </tr>`;
    }).join('');
    return `<table class="resource-table">
        <thead><tr>
            <th>Name</th><th>Status</th>
            <th>⚙️ CPU Req</th>
            <th>⚙️ CPU Lmt</th>
            <th>💾 Mem Req</th>
            <th>💾 Mem Lmt</th>
            <th>Age</th><th>Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

/* USERS */
function renderUsers(items) {
    const rows = items.map(u => {
        const uid = u.id || '';
        const uname = (u.username || '').replace(/"/g, '&quot;');
        const urole = u.role || 'user';
        let roleColor = { bg: '#3b82f6', text: '#3b82f6' };
        if (urole === 'view') roleColor = { bg: '#8b5cf6', text: '#8b5cf6' };
        else if (urole !== 'admin') roleColor = { bg: '#64748b', text: '#94a3b8' };
        
        return `
        <tr>
            <td><strong>${escapeHtml(u.username)}</strong></td>
            <td><span style="display:inline-block;padding:0.2rem 0.6rem;background:${roleColor.bg}22;color:${roleColor.text};border-radius:4px;font-size:0.75rem;font-weight:600">${urole}</span></td>
            <td style="color:#94a3b8;font-size:0.8rem">${u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
            <td>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-ghost" style="padding:0.2rem 0.6rem;font-size:0.75rem" onclick='showAssignNsModal(${uid}, "${uname}")' title="Assign namespaces">🔐 NS</button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
    
    return `<table class="resource-table">
        <thead><tr>
            <th>Username</th>
            <th>Role</th>
            <th>Created</th>
            <th>Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

// Role checkboxes helper for cluster-admin
function _caRoleCheckboxes(selectedRoles) {
    const allRoles = [
        { value: 'admin',             label: '\ud83d\udc51 admin' },
        { value: 'user_docker',       label: '\ud83d\udc33 user_docker' },
        { value: 'user_docker_basic', label: '\ud83d\udc33 user_docker_basic' },
        { value: 'user_k8s_full',     label: '\u2638\ufe0f user_k8s_full' },
        { value: 'user_k8s_view',     label: '\ud83d\udc41\ufe0f user_k8s_view' },
        { value: 'user_cicd_full',    label: '\ud83d\ude80 user_cicd_full' },
        { value: 'user_cicd_view',    label: '\ud83d\udc41\ufe0f user_cicd_view' },
    ];
    return `<div id="ca-role-checkboxes" style="display:grid;grid-template-columns:1fr 1fr;gap:0.35rem;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:0.6rem;">
        ${allRoles.map(r => `
        <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;padding:0.25rem;color:#e2e8f0;font-size:0.8rem;">
            <input type="checkbox" value="${r.value}" ${selectedRoles.includes(r.value) ? 'checked' : ''} style="cursor:pointer;accent-color:#6366f1;">
            ${r.label}
        </label>`).join('')}
    </div>`;
}

function _caGetCheckedRoles() {
    return Array.from(document.querySelectorAll('#ca-role-checkboxes input[type=checkbox]:checked')).map(cb => cb.value);
}

// Create new user modal
function showCreateUserModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-box" style="max-width: 400px;">
            <div class="modal-header">
                <div class="modal-title">➕ Create User</div>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div style="display:grid;gap:0.85rem;">
                    <div>
                        <label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:0.35rem;">Username</label>
                        <input id="new-user-username" type="text" placeholder="e.g. john.doe" 
                            style="width:100%;padding:0.5rem;background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;border-radius:8px;font-size:0.85rem;">
                    </div>
                    <div>
                        <label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:0.35rem;">Password</label>
                        <input id="new-user-password" type="password" placeholder="Enter password"
                            style="width:100%;padding:0.5rem;background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;border-radius:8px;font-size:0.85rem;">
                    </div>
                    <div>
                        <label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:0.35rem;">Roles <small style="color:#64748b">(select one or more)</small></label>
                        ${_caRoleCheckboxes([])}
                    </div>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn btn-primary" onclick="saveNewUser()" style="flex:1;">Create</button>
                        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="flex:1;">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('open');
}

async function saveNewUser() {
    const username = document.getElementById('new-user-username').value.trim();
    const password = document.getElementById('new-user-password').value;
    const roles = _caGetCheckedRoles();
    
    if (!username || !password) {
        alert('Username and password required');
        return;
    }
    if (roles.length === 0) {
        alert('Please select at least one role');
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, roles })
        });
        
        if (res.ok) {
            // Find and close the create user modal specifically
            const modals = document.querySelectorAll('.modal-overlay');
            modals.forEach(m => {
                if (m.querySelector('.modal-title') && m.querySelector('.modal-title').textContent.includes('Create User')) {
                    m.remove();
                }
            });
            // Reload user list
            await loadResource();
        } else {
            const err = await res.text();
            alert('Error: ' + err);
        }
    } catch (e) {
        alert('Failed: ' + e.message);
    }
}

// Edit user modal
function showEditUserModal(userId, username, role) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-box" style="max-width: 400px;">
            <div class="modal-header">
                <div class="modal-title">✏️ Edit User: ${username}</div>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div style="display:grid;gap:0.85rem;">
                    <div>
                        <label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:0.35rem;">New Password (leave blank to keep current)</label>
                        <input id="edit-user-password" type="password" placeholder="New password"
                            style="width:100%;padding:0.5rem;background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;border-radius:8px;font-size:0.85rem;">
                    </div>
                    <div>
                        <label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:0.35rem;">Roles <small style="color:#64748b">(select one or more)</small></label>
                        ${_caRoleCheckboxes((role || '').split(',').map(r => r.trim()).filter(Boolean))}
                    </div>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn btn-primary" onclick='saveEditUser("${userId}")' style="flex:1;">Update</button>
                        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="flex:1;">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('open');
}

async function saveEditUser(userId) {
    const password = document.getElementById('edit-user-password').value;
    const roles = _caGetCheckedRoles();
    
    if (roles.length === 0) {
        alert('Please select at least one role');
        return;
    }
    
    const body = { roles };
    if (password) body.password = password;
    
    try {
        const res = await fetch(`${API_BASE}/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (res.ok) {
            // Find and close the edit user modal
            const modals = document.querySelectorAll('.modal-overlay');
            modals.forEach(m => {
                if (m.querySelector('.modal-title') && m.querySelector('.modal-title').textContent.includes('Edit User')) {
                    m.remove();
                }
            });
            await loadResource();
        } else {
            alert('Error updating user');
        }
    } catch (e) {
        alert('Failed: ' + e.message);
    }
}

// Delete user
async function deleteUserConfirm(userId, username) {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    
    try {
        const res = await fetch(`${API_BASE}/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (res.ok) {
            loadResource();
        } else {
            alert('Error deleting user');
        }
    } catch (e) {
        alert('Failed: ' + e.message);
    }
}

// Assign namespaces modal
async function showAssignNsModal(userId, username) {
    // Fetch available namespaces
    try {
        const res = await fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/namespaces`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        const data = await res.json();
        const allNs = (data.items || []).map(n => n.metadata.name).sort();
        
        // Fetch user's current assignments
        const assignRes = await fetch(`${API_BASE}/users/${userId}/namespaces?cluster_id=${state.clusterId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        const assignData = await assignRes.json();
        const assigned = new Set(assignData.namespaces || []);
        
        const checkboxes = allNs.map(ns => `
            <label style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem;cursor:pointer;border-radius:4px;margin-bottom:0.3rem;color:#e2e8f0;">
                <input type="checkbox" class="ns-assign-checkbox" value="${ns}" ${assigned.has(ns) ? 'checked' : ''} style="cursor:pointer;">
                <span>${ns}</span>
            </label>
        `).join('');
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-box" style="max-width: 500px;">
                <div class="modal-header">
                    <div class="modal-title">🔐 Assign Namespaces — ${username}</div>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:0.5rem;">Select namespaces for this user:</label>
                    <div style="background:#0f1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:0.75rem;max-height:300px;overflow-y:auto;">
                        ${checkboxes}
                    </div>
                    <div style="display:flex;gap:0.5rem;margin-top:1rem;">
                        <button class="btn btn-primary" onclick='saveUserNsAssign("${userId}")' style="flex:1;">✓ Save</button>
                        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="flex:1;">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.classList.add('open');
    } catch (e) {
        alert('Error loading namespaces: ' + e.message);
    }
}

async function saveUserNsAssign(userId) {
    const selected = Array.from(document.querySelectorAll('.ns-assign-checkbox:checked')).map(cb => cb.value);
    
    try {
        const res = await fetch(`${API_BASE}/users/${userId}/namespaces`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cluster_id: parseInt(state.clusterId),
                namespaces: selected
            })
        });
        
        if (res.ok) {
            // Find and close the assign namespaces modal
            const modals = document.querySelectorAll('.modal-overlay');
            modals.forEach(m => {
                if (m.querySelector('.modal-title') && m.querySelector('.modal-title').textContent.includes('Assign Namespaces')) {
                    m.remove();
                }
            });
            await loadResource();
        } else {
            alert('Error assigning namespaces');
        }
    } catch (e) {
        alert('Failed: ' + e.message);
    }
}

function showUserNsModal(userId, username) {
    // Try to get user's assigned namespaces for this cluster
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-box" style="max-width: 600px;">
            <div class="modal-header">
                <div class="modal-title">🔐 Namespaces — ${username}</div>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div id="user-ns-list" class="loading-state" style="padding:1rem;text-align:center;color:#64748b;">
                    Loading namespaces...
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('open');
    
    // Fetch user's assigned namespaces
    fetch(`${API_BASE}/users/${userId}/namespaces?cluster_id=${state.clusterId}`)
        .then(res => res.ok ? res.json() : Promise.reject('Failed'))
        .then(data => {
            const ns = data.namespaces || [];
            const html = ns.length > 0
                ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.5rem">${ns.map(n => `<div style="padding:0.5rem;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:6px;font-size:0.85rem;color:#a5b4fc">${n}</div>`).join('')}</div>`
                : '<div style="padding:1rem;text-align:center;color:#64748b;">No namespaces assigned</div>';
            document.getElementById('user-ns-list').innerHTML = html;
        })
        .catch(() => {
            document.getElementById('user-ns-list').innerHTML = '<div style="padding:1rem;text-align:center;color:#f87171;">Failed to load</div>';
        });
}

/* Generic fallback */
function renderGeneric(items) {
    const rows = items.map(i => {
        const name = i.metadata?.name || '—';
        const ns = i.metadata?.namespace || '—';
        return `<tr>
            <td><strong>${name}</strong></td>
            <td><span style="color:#64748b;font-size:0.75rem">${ns}</span></td>
            <td style="color:#64748b">${age(i.metadata?.creationTimestamp)}</td>
        </tr>`;
    }).join('');
    return `<table class="resource-table">
        <thead><tr><th>Name</th><th>Namespace</th><th>Age</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

// ── Search, Pagination & Create ─────────────────────

function renderAll() {
    const content = document.getElementById('main-content');
    const q = (state.searchQuery || '').toLowerCase();
    const filtered = q
        ? state.allItems.filter(item => {
            const name = (item.metadata?.name || '').toLowerCase();
            const ns   = (item.metadata?.namespace || '').toLowerCase();
            return name.includes(q) || ns.includes(q);
          })
        : state.allItems;
    const total      = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    const start     = (state.currentPage - 1) * state.pageSize;
    const pageItems = filtered.slice(start, start + state.pageSize);

    // Namespace dropdown
    let nsHtml = '';
    if (NAMESPACED_RESOURCES.has(state.currentResource) && state.namespaces.length > 0) {
        const cur  = state.currentNamespace || 'all';
        const opts = ['all', ...state.namespaces].map(n =>
            `<option value="${n}" ${cur === n ? 'selected' : ''}>${n === 'all' ? 'All Namespaces' : n}</option>`
        ).join('');
        nsHtml = `<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.7rem">
            <label style="font-size:0.78rem;color:#94a3b8;white-space:nowrap">Namespace:</label>
            <select onchange="filterByNs(this.value)" style="padding:0.35rem 0.7rem;background:#1a1f2e;border:1px solid rgba(255,255,255,0.15);color:#f1f5f9;border-radius:8px;font-size:0.82rem;cursor:pointer;outline:none;min-width:160px">${opts}</select>
        </div>`;
    }

    // Toolbar
    const canCreate = state.currentResource !== 'nodes' && canUserCreateOrDelete();
    const selOpts = [10, 20, 50, 100].map(n =>
        `<option value="${n}" ${state.pageSize === n ? 'selected' : ''}>${n} / page</option>`
    ).join('');
    
    // Build create menu options based on current resource
    let createMenuItems = `
            <div onclick="openDeploymentFormModal();toggleCreateMenu()" style="padding:0.6rem 1rem;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.82rem;color:#e2e8f0;transition:background 0.2s" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background=''">📦 Deployment</div>
            <div onclick="openServiceFormModal();toggleCreateMenu()" style="padding:0.6rem 1rem;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.82rem;color:#e2e8f0;transition:background 0.2s" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background=''">🔌 Service</div>
            <div onclick="openIngressFormModal();toggleCreateMenu()" style="padding:0.6rem 1rem;cursor:pointer;font-size:0.82rem;color:#e2e8f0;transition:background 0.2s" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background=''">🌐 Ingress</div>
    `;
    
    // Add namespace option if viewing namespaces
    if (state.currentResource === 'namespaces') {
        createMenuItems = `<div onclick="openNamespaceFormModal();toggleCreateMenu()" style="padding:0.6rem 1rem;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.82rem;color:#e2e8f0;transition:background 0.2s" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background=''">📋 Namespace</div>` + createMenuItems;
    }
    
    const createBtnHtml = canCreate ? `<div style="position:relative;display:inline-block">
        <button class="btn btn-primary" onclick="toggleCreateMenu(event)" style="padding:0.38rem 0.9rem;font-size:0.82rem">➕ Create</button>
        <div id="create-menu" style="position:absolute;top:100%;right:0;background:#1a1f2e;border:1px solid rgba(255,255,255,0.12);border-radius:8px;min-width:160px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:1000;margin-top:0.3rem;display:none">
            ${createMenuItems}
        </div>
    </div>` : '';
    const toolbarHtml = `<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.85rem;flex-wrap:wrap;background:rgba(255,255,255,0.03);padding:0.6rem 0.85rem;border-radius:10px;border:1px solid rgba(255,255,255,0.06)">
        <div style="position:relative;flex:1;min-width:160px;max-width:300px">
            <span style="position:absolute;left:0.55rem;top:50%;transform:translateY(-50%);color:#64748b;pointer-events:none;font-size:0.85rem">🔍</span>
            <input type="text" placeholder="Search name / namespace…" value="${escHtml(state.searchQuery)}"
                oninput="onSearch(this.value)"
                style="width:100%;padding:0.38rem 0.7rem 0.38rem 2rem;background:#0f1117;border:1px solid rgba(255,255,255,0.12);color:#e2e8f0;border-radius:8px;font-size:0.82rem;outline:none;box-sizing:border-box">
        </div>
        <span style="font-size:0.78rem;color:#64748b;white-space:nowrap">${total} item${total !== 1 ? 's' : ''}${q ? ' (filtered)' : ''}</span>
        <div style="margin-left:auto;display:flex;align-items:center;gap:0.5rem">
            <select onchange="setPageSize(+this.value)" title="Items per page"
                style="padding:0.35rem 0.55rem;background:#0f1117;border:1px solid rgba(255,255,255,0.12);color:#e2e8f0;border-radius:8px;font-size:0.78rem;outline:none;cursor:pointer">${selOpts}</select>
            ${createBtnHtml}
        </div>
    </div>`;

    const tableHtml = pageItems.length === 0
        ? `<div class="empty-state"><div class="empty-icon">${q ? '🔍' : '📭'}</div><div>${q ? 'No results for &ldquo;' + escHtml(q) + '&rdquo;' : 'No ' + state.currentResource + ' found'}</div></div>`
        : renderResource(state.currentResource, pageItems);

    const pagHtml = totalPages > 1 ? renderPaginationBar(state.currentPage, totalPages) : '';
    content.innerHTML = nsHtml + toolbarHtml + tableHtml + pagHtml;
}

function onSearch(val) {
    state.searchQuery = val;
    state.currentPage = 1;
    renderAll();
}

function setPageSize(n) {
    state.pageSize = n;
    state.currentPage = 1;
    renderAll();
}

function goToPage(n) {
    state.currentPage = n;
    renderAll();
    document.getElementById('main-content').scrollTop = 0;
}

function renderPaginationBar(cur, total) {
    const show = new Set([1, total, cur, cur - 1, cur + 1].filter(p => p >= 1 && p <= total));
    const sorted = [...show].sort((a, b) => a - b);
    let last = 0, btns = '';
    for (const p of sorted) {
        if (last && p - last > 1) btns += `<span style="padding:0 0.25rem;color:#475569">…</span>`;
        btns += `<button onclick="goToPage(${p})"
            style="min-width:30px;padding:0.3rem 0.55rem;border-radius:6px;border:1px solid ${p === cur ? '#3b82f6' : 'rgba(255,255,255,0.1)'};background:${p === cur ? '#1d4ed820' : 'transparent'};color:${p === cur ? '#60a5fa' : '#94a3b8'};cursor:pointer;font-size:0.8rem">${p}</button>`;
        last = p;
    }
    return `<div style="display:flex;align-items:center;justify-content:center;gap:0.3rem;margin-top:1rem;padding-top:0.75rem;border-top:1px solid rgba(255,255,255,0.06)">
        <button onclick="goToPage(${cur - 1})" ${cur === 1 ? 'disabled' : ''}
            style="padding:0.3rem 0.65rem;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:${cur === 1 ? '#334155' : '#94a3b8'};cursor:${cur === 1 ? 'not-allowed' : 'pointer'};font-size:0.8rem">‹ Prev</button>
        ${btns}
        <button onclick="goToPage(${cur + 1})" ${cur === total ? 'disabled' : ''}
            style="padding:0.3rem 0.65rem;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:${cur === total ? '#334155' : '#94a3b8'};cursor:${cur === total ? 'not-allowed' : 'pointer'};font-size:0.8rem">Next ›</button>
    </div>`;
}

function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Create Resource ───────────────────────────────────
const YAML_TEMPLATES = {
    deployments: ns => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: ${ns === 'all' ? 'default' : ns}
  labels:
    app: my-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-app
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 100m
            memory: 128Mi`,
    pods: ns => `apiVersion: v1
kind: Pod
metadata:
  name: my-pod
  namespace: ${ns === 'all' ? 'default' : ns}
  labels:
    app: my-pod
spec:
  containers:
  - name: my-container
    image: nginx:latest
    ports:
    - containerPort: 80`,
    services: ns => `apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: ${ns === 'all' ? 'default' : ns}
spec:
  selector:
    app: my-app
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP`,
    ingresses: ns => `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  namespace: ${ns === 'all' ? 'default' : ns}
spec:
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-service
            port:
              number: 80`,
    configmaps: ns => `apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
  namespace: ${ns === 'all' ? 'default' : ns}
data:
  APP_ENV: production
  APP_PORT: "8080"`,
    secrets: ns => `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
  namespace: ${ns === 'all' ? 'default' : ns}
type: Opaque
stringData:
  username: admin
  password: changeme`,
    persistentvolumeclaims: ns => `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
  namespace: ${ns === 'all' ? 'default' : ns}
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi`,
    statefulsets: ns => `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: my-statefulset
  namespace: ${ns === 'all' ? 'default' : ns}
spec:
  serviceName: my-service
  replicas: 1
  selector:
    matchLabels:
      app: my-statefulset
  template:
    metadata:
      labels:
        app: my-statefulset
    spec:
      containers:
      - name: my-container
        image: nginx:latest`,
    daemonsets: ns => `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: my-daemonset
  namespace: ${ns === 'all' ? 'default' : ns}
spec:
  selector:
    matchLabels:
      app: my-daemonset
  template:
    metadata:
      labels:
        app: my-daemonset
    spec:
      containers:
      - name: my-container
        image: nginx:latest`,
    jobs: ns => `apiVersion: batch/v1
kind: Job
metadata:
  name: my-job
  namespace: ${ns === 'all' ? 'default' : ns}
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: my-job
        image: busybox
        command: ["echo", "Hello, Kubernetes!"]`,
    namespaces: () => `apiVersion: v1
kind: Namespace
metadata:
  name: my-namespace
  labels:
    environment: production`,
};

function openCreateModal() {
    if (!canUserCreateOrDelete()) {
        alert('❌ View-only users cannot create resources');
        return;
    }
    if (state.currentResource === 'namespaces') {
        openNsCreateModal();
        return;
    }
    const resource = state.currentResource;
    const ns       = state.currentNamespace;
    const meta     = RESOURCE_META[resource] || { label: resource };
    const tmplFn   = YAML_TEMPLATES[resource] || YAML_TEMPLATES['deployments'];
    document.getElementById('create-modal-title').textContent = `➕ Create ${meta.label}`;
    document.getElementById('create-yaml-input').value = tmplFn(ns);
    document.getElementById('create-modal-error').textContent = '';
    document.getElementById('create-modal').classList.add('open');
    setTimeout(() => document.getElementById('create-yaml-input').focus(), 100);
}

function closeCreateModal() {
    const modal = document.getElementById('create-modal');
    modal.classList.remove('open');
    modal.dataset.editMode = 'false';
    document.getElementById('create-modal-title').textContent = '➕ Create Resource';
}

async function submitCreate() {
    const yaml  = document.getElementById('create-yaml-input').value.trim();
    const errEl = document.getElementById('create-modal-error');
    const btn   = document.getElementById('create-submit-btn');
    const modal = document.getElementById('create-modal');
    const isEditMode = modal.dataset.editMode === 'true';
    
    if (!yaml) { errEl.textContent = 'YAML cannot be empty.'; return; }
    btn.disabled = true;
    btn.textContent = isEditMode ? 'Updating…' : 'Applying…';
    errEl.textContent = '';
    try {
        const res = await fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ yaml }),
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(txt);
        closeCreateModal();
        await loadResource();
    } catch (e) {
        errEl.textContent = e.message;
    } finally {
        btn.disabled = false;
        btn.textContent = isEditMode ? 'Update' : 'Apply';
        modal.dataset.editMode = 'false';
    }
}

// ── Toggle Create Menu ────────────────────────────────────
function toggleCreateMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('create-menu');
    if (!menu) return;
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', () => {
    const menu = document.getElementById('create-menu');
    if (menu) menu.style.display = 'none';
});

// ── Helper: Populate namespace select dropdowns ────────────────────────────────────
function populateNamespaceSelects(...selectIds) {
    selectIds.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        // Clear existing options except the first one
        sel.innerHTML = '';
        // Add all available namespaces
        (state.namespaces || []).forEach(ns => {
            const opt = document.createElement('option');
            opt.value = ns;
            opt.textContent = ns;
            sel.appendChild(opt);
        });
        // Set default to first namespace or 'default'
        if (state.namespaces && state.namespaces.length > 0) {
            sel.value = state.namespaces[0];
        } else {
            const opt = document.createElement('option');
            opt.value = 'default';
            opt.textContent = 'default';
            sel.appendChild(opt);
            sel.value = 'default';
        }
    });
}

// ── Deployment Form ────────────────────────────────────
function openDeploymentFormModal() {
    document.getElementById('dep-name').value = '';
    populateNamespaceSelects('dep-namespace');
    document.getElementById('dep-image').value = '';
    document.getElementById('dep-replicas').value = '1';
    document.getElementById('dep-port').value = '80';
    document.getElementById('dep-label').value = '';
    document.getElementById('dep-node-selector').value = '';
    document.getElementById('dep-cpu-req').value = '100m';
    document.getElementById('dep-cpu-lim').value = '100m';
    document.getElementById('dep-mem-req').value = '128Mi';
    document.getElementById('dep-mem-lim').value = '128Mi';
    document.getElementById('deployment-form-error').textContent = '';
    document.getElementById('deployment-form-modal').classList.add('open');
}

function closeDeploymentFormModal() {
    document.getElementById('deployment-form-modal').classList.remove('open');
}

async function submitDeploymentForm() {
    const name = document.getElementById('dep-name').value.trim();
    const ns = document.getElementById('dep-namespace').value.trim() || 'default';
    const image = document.getElementById('dep-image').value.trim();
    const replicas = parseInt(document.getElementById('dep-replicas').value) || 1;
    const port = parseInt(document.getElementById('dep-port').value) || 80;
    const cpuReq = document.getElementById('dep-cpu-req').value.trim() || '100m';
    const cpuLim = document.getElementById('dep-cpu-lim').value.trim() || '100m';
    const memReq = document.getElementById('dep-mem-req').value.trim() || '128Mi';
    const memLim = document.getElementById('dep-mem-lim').value.trim() || '128Mi';
    let label = document.getElementById('dep-label').value.trim();
    if (!label) label = name;

    // Parse node selector
    const nodeSelectorText = document.getElementById('dep-node-selector').value.trim();
    const nodeSelector = {};
    if (nodeSelectorText) {
        const lines = nodeSelectorText.split('\n').map(l => l.trim()).filter(l => l);
        for (const line of lines) {
            const [key, value] = line.split('=');
            if (!key || !value) continue;
            nodeSelector[key.trim()] = value.trim();
        }
    }

    const errEl = document.getElementById('deployment-form-error');
    errEl.textContent = '';

    if (!name) { errEl.textContent = 'Deployment name is required'; return; }
    if (!image) { errEl.textContent = 'Docker image is required'; return; }

    // Log yang jelas untuk debug
    console.log(`[Deployment] Creating: name=${name}, namespace=${ns}, image=${image}, replicas=${replicas}, port=${port}, cpu=${cpuReq}/${cpuLim}, mem=${memReq}/${memLim}, nodeSelector=${JSON.stringify(nodeSelector)}`);

    let yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${ns}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${label}
  template:
    metadata:
      labels:
        app: ${label}
    spec:`;
    
    // Add nodeSelector if provided
    if (Object.keys(nodeSelector).length > 0) {
        yaml += `
      nodeSelector:`;
        for (const [key, value] of Object.entries(nodeSelector)) {
            yaml += `
        ${key}: ${value}`;
        }
    }
    
    yaml += `
      containers:
      - name: ${name}
        image: ${image}
        ports:
        - containerPort: ${port}
        resources:
          requests:
            cpu: ${cpuReq}
            memory: ${memReq}
          limits:
            cpu: ${cpuLim}
            memory: ${memLim}`;

    try {
        const res = await fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ yaml }),
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(txt);
        closeDeploymentFormModal();
        await loadResource();
    } catch (e) {
        errEl.textContent = e.message;
    }
}

// ── Service Form ────────────────────────────────────
function openServiceFormModal() {
    document.getElementById('svc-name').value = '';
    populateNamespaceSelects('svc-namespace');
    document.getElementById('svc-type').value = 'ClusterIP';
    document.getElementById('svc-selector').value = '';
    document.getElementById('svc-port').value = '80';
    document.getElementById('svc-target-port').value = '80';
    document.getElementById('svc-protocol').value = 'TCP';
    document.getElementById('service-form-error').textContent = '';
    document.getElementById('service-form-modal').classList.add('open');
}

function closeServiceFormModal() {
    document.getElementById('service-form-modal').classList.remove('open');
}

async function submitServiceForm() {
    const name = document.getElementById('svc-name').value.trim();
    const ns = document.getElementById('svc-namespace').value.trim();
    const type = document.getElementById('svc-type').value;
    const selector = document.getElementById('svc-selector').value.trim();
    const port = parseInt(document.getElementById('svc-port').value) || 80;
    const targetPort = parseInt(document.getElementById('svc-target-port').value) || 80;
    const protocol = document.getElementById('svc-protocol').value;

    const errEl = document.getElementById('service-form-error');
    errEl.textContent = '';

    if (!name) { errEl.textContent = 'Service name is required'; return; }
    if (!ns) { errEl.textContent = 'Namespace is required'; return; }
    if (!selector) { errEl.textContent = 'App selector is required'; return; }

    const yaml = `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${ns}
spec:
  type: ${type}
  selector:
    app: ${selector}
  ports:
  - protocol: ${protocol}
    port: ${port}
    targetPort: ${targetPort}`;

    try {
        const res = await fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ yaml }),
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(txt);
        closeServiceFormModal();
        await loadResource();
    } catch (e) {
        errEl.textContent = e.message;
    }
}

// ── Ingress Form ────────────────────────────────────
function openIngressFormModal() {
    document.getElementById('ing-name').value = '';
    populateNamespaceSelects('ing-namespace');
    document.getElementById('ing-hostname').value = '';
    document.getElementById('ing-service').value = '';
    document.getElementById('ing-port').value = '80';
    document.getElementById('ing-path').value = '/';
    document.getElementById('ingress-form-error').textContent = '';
    document.getElementById('ingress-form-modal').classList.add('open');
}

function closeIngressFormModal() {
    document.getElementById('ingress-form-modal').classList.remove('open');
}

async function submitIngressForm() {
    const name = document.getElementById('ing-name').value.trim();
    const ns = document.getElementById('ing-namespace').value.trim();
    const hostname = document.getElementById('ing-hostname').value.trim();
    const service = document.getElementById('ing-service').value.trim();
    const port = parseInt(document.getElementById('ing-port').value) || 80;
    let path = document.getElementById('ing-path').value.trim();
    if (!path) path = '/';

    const errEl = document.getElementById('ingress-form-error');
    errEl.textContent = '';

    if (!name) { errEl.textContent = 'Ingress name is required'; return; }
    if (!ns) { errEl.textContent = 'Namespace is required'; return; }
    if (!hostname) { errEl.textContent = 'Hostname is required'; return; }
    if (!service) { errEl.textContent = 'Service name is required'; return; }

    const yaml = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${name}
  namespace: ${ns}
spec:
  rules:
  - host: ${hostname}
    http:
      paths:
      - path: ${path}
        pathType: Prefix
        backend:
          service:
            name: ${service}
            port:
              number: ${port}`;

    try {
        const res = await fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ yaml }),
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(txt);
        closeIngressFormModal();
        await loadResource();
    } catch (e) {
        errEl.textContent = e.message;
    }
}

// ── Namespace Form Modal (alias for consistency) ────────────────────────────────────
function openNamespaceFormModal() {
    openNsCreateModal();
}

// ── Namespace CRUD ────────────────────────────────────────
function openNsCreateModal() {
    document.getElementById('ns-create-name').value = '';
    document.getElementById('ns-create-error').textContent = '';
    document.getElementById('ns-create-modal').classList.add('open');
    setTimeout(() => document.getElementById('ns-create-name').focus(), 100);
}

function closeNsCreateModal() {
    document.getElementById('ns-create-modal').classList.remove('open');
}

async function submitNsCreate() {
    const name  = document.getElementById('ns-create-name').value.trim();
    const errEl = document.getElementById('ns-create-error');
    const btn   = document.getElementById('ns-create-submit');
    if (!name) { errEl.textContent = 'Name cannot be empty.'; return; }
    if (!/^[a-z0-9][a-z0-9\-]{0,61}[a-z0-9]$|^[a-z0-9]$/.test(name)) {
        errEl.textContent = 'Invalid name: use lowercase letters, numbers and hyphens only.';
        return;
    }
    btn.disabled = true;
    btn.textContent = 'Creating…';
    errEl.textContent = '';
    try {
        const res = await fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/namespaces`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(txt);
        closeNsCreateModal();
        await loadNamespaces();
        await loadResource();
    } catch (e) {
        errEl.textContent = e.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create';
    }
}

// ── Namespace Quota Modal ──────────────────────────────
let _nsQuotaCurrent = '';

function openNsQuotaModal(name) {
    _nsQuotaCurrent = name;
    const q = (state.nsQuotas || {})[name] || {};
    document.getElementById('ns-quota-title').textContent = `📊 Resource Quota — ${name}`;
    document.getElementById('q-cpu-req').value  = q['requests.cpu']    || '';
    document.getElementById('q-cpu-lmt').value  = q['limits.cpu']      || '';
    document.getElementById('q-mem-req').value  = q['requests.memory'] || '';
    document.getElementById('q-mem-lmt').value  = q['limits.memory']   || '';
    document.getElementById('ns-quota-error').textContent = '';
    document.getElementById('ns-quota-modal').classList.add('open');
    setTimeout(() => document.getElementById('q-cpu-req').focus(), 100);
}

function closeNsQuotaModal() {
    document.getElementById('ns-quota-modal').classList.remove('open');
}

async function submitNsQuota(remove) {
    const errEl = document.getElementById('ns-quota-error');
    const btn   = document.getElementById('ns-quota-submit');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    errEl.textContent = '';

    const body = remove ? { cpu_request:'0', cpu_limit:'0', mem_request:'0', mem_limit:'0' } : {
        cpu_request: document.getElementById('q-cpu-req').value.trim(),
        cpu_limit:   document.getElementById('q-cpu-lmt').value.trim(),
        mem_request: document.getElementById('q-mem-req').value.trim(),
        mem_limit:   document.getElementById('q-mem-lmt').value.trim(),
    };

    try {
        const res = await fetch(
            `${API_BASE}/k0s/clusters/${state.clusterId}/k8s/namespaces/${_nsQuotaCurrent}/quota`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        );
        const txt = await res.text();
        if (!res.ok) throw new Error(txt);
        closeNsQuotaModal();
        await loadResource();
    } catch (e) {
        errEl.textContent = e.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save';
    }
}

async function deleteNamespace(name) {
    if (!confirm(`Delete namespace "${name}"?\n\nThis will delete ALL resources inside it. This action cannot be undone.`)) return;
    try {
        const res = await fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/namespaces/${name}`, {
            method: 'DELETE',
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(txt);
        await loadNamespaces();
        await loadResource();
    } catch (e) {
        alert(`Failed to delete namespace: ${e.message}`);
    }
}

// ── Node Labels Modal ──────────────────────────────────
let _nodeLabelCurrent = '';

function showNodeLabelModal(nodeName) {
    _nodeLabelCurrent = nodeName;
    document.getElementById('node-label-title').textContent = `🏷️ Node Labels — ${nodeName}`;
    document.getElementById('node-label-input').value = '';
    document.getElementById('node-label-error').textContent = '';
    document.getElementById('node-label-modal').classList.add('open');
    setTimeout(() => document.getElementById('node-label-input').focus(), 100);
}

function closeNodeLabelModal() {
    document.getElementById('node-label-modal').classList.remove('open');
}

async function submitNodeLabels() {
    const input = document.getElementById('node-label-input').value.trim();
    const errEl = document.getElementById('node-label-error');
    const btn = document.getElementById('node-label-submit');
    
    if (!input) {
        errEl.textContent = 'Please enter at least one label.';
        return;
    }
    
    // Parse labels from input (format: key=value, one per line)
    const lines = input.split('\n').filter(l => l.trim());
    const labels = {};
    
    for (const line of lines) {
        const parts = line.split('=');
        if (parts.length !== 2) {
            errEl.textContent = `Invalid format: "${line}". Use key=value format.`;
            return;
        }
        const key = parts[0].trim();
        const value = parts[1].trim();
        if (!key || !value) {
            errEl.textContent = `Invalid format: "${line}". Key and value cannot be empty.`;
            return;
        }
        labels[key] = value;
    }
    
    btn.disabled = true;
    btn.textContent = 'Updating…';
    errEl.textContent = '';
    
    try {
        const res = await fetch(`${API_BASE}/k0s/clusters/${state.clusterId}/k8s/nodes/${_nodeLabelCurrent}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ labels }),
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(txt);
        closeNodeLabelModal();
        await loadResource();
    } catch (e) {
        errEl.textContent = e.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Update Labels';
    }
}

// ── Pod Logs ──────────────────────────────────────────
let _logCtx = { ns: '', pod: '' };

function colorizeLog(text) {
    return text.split('\n').map(line => {
        const esc = line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        // timestamp prefix  e.g. 2024-01-01T00:00:00
        const withTs = esc.replace(
            /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[\d:.Z+-]*)/,
            '<span class="log-ts">$1</span>'
        );
        if (/\b(ERROR|FATAL|CRITICAL|EXCEPTION|panic)\b/i.test(line))
            return `<span class="log-err">${withTs}</span>`;
        if (/\b(WARN|WARNING)\b/i.test(line))
            return `<span class="log-warn">${withTs}</span>`;
        if (/\b(INFO|NOTICE)\b/i.test(line))
            return `<span class="log-info">${withTs}</span>`;
        if (/\b(DEBUG|TRACE)\b/i.test(line))
            return `<span class="log-debug">${withTs}</span>`;
        if (/\b(OK|SUCCESS|READY|RUNNING|started)\b/i.test(line))
            return `<span class="log-ok">${withTs}</span>`;
        return withTs;
    }).join('\n');
}

async function showLogs(namespace, podName) {
    _logCtx = { ns: namespace, pod: podName };
    document.getElementById('log-modal-title').textContent = `📋 Logs — ${podName}`;
    document.getElementById('log-modal').classList.add('open');
    await _fetchLogs();
}

async function reloadCurrentLog() {
    if (_logCtx.pod) await _fetchLogs();
}

async function _fetchLogs() {
    const el = document.getElementById('log-output');
    el.innerHTML = '<span style="color:#475569">Loading logs…</span>';
    document.getElementById('log-line-count').textContent = '';

    const tail = document.getElementById('log-tail')?.value || '500';
    const tailParam = tail === '0' ? '' : `&tailLines=${tail}`;

    try {
        const res = await fetch(
            `${API_BASE}/k0s/clusters/${state.clusterId}/k8s/pods/${_logCtx.pod}/logs?namespace=${_logCtx.ns}${tailParam}`
        );
        const text = await res.text();
        if (!text.trim()) {
            el.innerHTML = '<span style="color:#475569">(no log output)</span>';
            return;
        }
        el.innerHTML = colorizeLog(text);
        const lines = text.split('\n').filter(Boolean).length;
        document.getElementById('log-line-count').textContent = `${lines} lines`;
        el.scrollTop = el.scrollHeight;
    } catch (e) {
        el.innerHTML = `<span class="log-err">Error: ${e.message}</span>`;
    }
}

function toggleLogWrap() {
    const el = document.getElementById('log-output');
    const btn = document.getElementById('log-wrap-btn');
    el.classList.toggle('no-wrap');
    btn.style.background = el.classList.contains('no-wrap')
        ? 'rgba(99,102,241,0.3)' : '';
}

function copyLogs() {
    const el = document.getElementById('log-output');
    navigator.clipboard.writeText(el.innerText).then(() => {
        const btn = document.querySelector('.log-toolbar button[onclick="copyLogs()"]');
        if (btn) { btn.textContent = '✓ Copied'; setTimeout(() => btn.textContent = '📋 Copy', 1800); }
    });
}

function closeLogModal() {
    document.getElementById('log-modal').classList.remove('open');
}

// ── Pod Exec Terminal ─────────────────────────────────
let execTerm  = null;
let execWs    = null;
let execFit   = null;
let execState = {};

function execPod(namespace, podName) {
    execState = { namespace, podName };
    document.getElementById('exec-modal-title').textContent = `💻 Terminal — ${podName} (${namespace})`;
    document.getElementById('exec-modal').classList.add('open');

    // Dispose previous session
    if (execWs) { try { execWs.close(); } catch(_) {} execWs = null; }
    if (execTerm) { execTerm.dispose(); execTerm = null; }

    const container = document.getElementById('exec-terminal');
    container.innerHTML = '';

    execTerm = new Terminal({
        theme: { background: '#1e1e1e' },
        fontFamily: '"Cascadia Code", "Courier New", monospace',
        fontSize: 14,
        scrollback: 2000,
        cursorBlink: true
    });

    if (window.FitAddon) {
        execFit = new FitAddon.FitAddon();
        execTerm.loadAddon(execFit);
    }

    execTerm.open(container);
    if (execFit) execFit.fit();

    const token = localStorage.getItem('authToken') || '';
    const shell = document.getElementById('exec-shell-select')?.value || 'sh';
    const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${wsProto}://${location.host}/api/k0s/clusters/${state.clusterId}/k8s/pods/${podName}/exec?namespace=${namespace}&shell=${encodeURIComponent(shell)}&token=${encodeURIComponent(token)}`;

    execWs = new WebSocket(wsUrl);

    execWs.onopen = () => {
        if (execFit) execFit.fit();
        execTerm.focus();
    };

    execWs.onmessage = (e) => {
        execTerm.write(typeof e.data === 'string' ? e.data : new Uint8Array(e.data));
    };

    execWs.onclose = () => {
        execTerm.write('\r\n\x1b[33m[Session closed]\x1b[0m\r\n');
    };

    execWs.onerror = (e) => {
        execTerm.write('\r\n\x1b[31m[Connection error]\x1b[0m\r\n');
    };

    execTerm.onData(data => {
        if (execWs && execWs.readyState === WebSocket.OPEN) {
            execWs.send(data);
        }
    });

    // Handle resize
    window.addEventListener('resize', onExecResize);
}

function onExecResize() {
    if (!execFit || !execTerm || !execWs) return;
    execFit.fit();
    const cols = execTerm.cols;
    const rows = execTerm.rows;
    if (execWs.readyState === WebSocket.OPEN) {
        execWs.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
}

function reconnectExec() {
    if (execState.namespace && execState.podName) {
        execPod(execState.namespace, execState.podName);
    }
}

function closeExecModal() {
    document.getElementById('exec-modal').classList.remove('open');
    window.removeEventListener('resize', onExecResize);
    if (execWs) { try { execWs.close(); } catch(_) {} execWs = null; }
    if (execTerm) { execTerm.dispose(); execTerm = null; }
    execState = {};
}

// ── Edit Resource ────────────────────────────────────
async function editResource(resource, name, namespace) {
    if (!canUserCreateOrDelete()) {
        alert('❌ View-only users cannot edit resources');
        return;
    }
    try {
        const res = await fetch(
            `${API_BASE}/k0s/clusters/${state.clusterId}/k8s/${resource}/${name}?namespace=${namespace}`
        );
        if (!res.ok) {
            throw new Error('Failed to fetch resource');
        }
        const item = await res.json();
        const yaml = JSON.stringify(item, null, 2);
        
        const modal = document.getElementById('create-modal');
        document.getElementById('create-modal-title').textContent = `✏️ Edit ${resource.slice(0, -1)}`;
        document.getElementById('create-yaml-input').value = yaml;
        document.getElementById('create-modal-error').textContent = '';
        modal.dataset.editMode = 'true';
        modal.dataset.editResource = resource;
        modal.dataset.editName = name;
        modal.dataset.editNamespace = namespace;
        modal.classList.add('open');
        setTimeout(() => document.getElementById('create-yaml-input').focus(), 100);
    } catch (e) {
        alert(`Failed to load resource: ${e.message}`);
    }
}

// ── Delete Resource ───────────────────────────────────
async function deleteResource(resource, name, namespace) {
    if (!canUserCreateOrDelete()) {
        alert('❌ View-only users cannot delete resources');
        return;
    }
    if (!confirm(`Delete ${resource} "${name}" in namespace "${namespace}"?`)) return;
    try {
        const res = await fetch(
            `${API_BASE}/k0s/clusters/${state.clusterId}/k8s/${resource}/${name}?namespace=${namespace}`,
            { method: 'DELETE' }
        );
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt);
        }
        loadResource();
    } catch (e) {
        alert(`Failed to delete: ${e.message}`);
    }
}

// ── Deployment Detail Section ────────────────────────────
function closeDeploymentDetailSection() {
    document.getElementById('deployment-detail-section').style.display = 'none';
}

async function viewDeploymentDetail(deploymentName, namespace) {
    try {
        // Open section first
        const section = document.getElementById('deployment-detail-section');
        section.style.display = 'block';
        document.getElementById('dep-name-display').textContent = escapeHtml(deploymentName);
        document.getElementById('dep-ns-display').textContent = escapeHtml(namespace);
        document.getElementById('pods-list-container').innerHTML = '<tr style="border-bottom:1px solid rgba(255,255,255,0.05)"><td colspan="5" style="padding:1rem;text-align:center;color:#64748b">Loading pods...</td></tr>';

        // Fetch deployment to get status
        const depRes = await fetch(
            `${API_BASE}/k0s/clusters/${state.clusterId}/k8s/deployments/${deploymentName}?namespace=${namespace}`
        );
        if (depRes.ok) {
            const dep = await depRes.json();
            const replicas = dep.spec?.replicas || 0;
            const ready = dep.status?.readyReplicas || 0;
            document.getElementById('dep-det-replicas').textContent = `${ready}/${replicas}`;
            document.getElementById('dep-det-status').textContent = ready === replicas ? '✅ Ready' : '⏳ Pending';
        }

        // Fetch pods matching deployment label selector
        const podsRes = await fetch(
            `${API_BASE}/k0s/clusters/${state.clusterId}/k8s/pods?namespace=${namespace}&labelSelector=app=${encodeURIComponent(deploymentName)}`
        );
        if (!podsRes.ok) throw new Error(await podsRes.text());

        const podsData = await podsRes.json() || {};
        const pods = podsData.items || podsData || [];

        if (!Array.isArray(pods) || pods.length === 0) {
            document.getElementById('pods-list-container').innerHTML = 
                '<tr style="border-bottom:1px solid rgba(255,255,255,0.05)"><td colspan="6" style="padding:1rem;text-align:center;color:#94a3b8">No pods found for this deployment</td></tr>';
            return;
        }

        // Render pods as table rows
        let html = '';
        pods.forEach((pod, idx) => {
            const podName = pod.metadata?.name || '?';
            const podNs = pod.metadata?.namespace || namespace;
            const phase = pod.status?.phase || 'Unknown';
            const ready = pod.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True';
            const restarts = pod.status?.containerStatuses?.[0]?.restartCount || 0;
            const age = pod.metadata?.creationTimestamp ? getAge(pod.metadata.creationTimestamp) : '—';
            
            // Status icon dan warna
            let statusIcon = '⏳';
            let statusColor = '#f59e0b';
            
            if (phase === 'Running' && ready) {
                statusIcon = '✅';
                statusColor = '#10b981';
            } else if (phase === 'Failed' || phase === 'CrashLoopBackOff') {
                statusIcon = '❌';
                statusColor = '#ef4444';
            }
            
            const canDeletePod = canUserCreateOrDelete();
            
            html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.2s" onmouseover="this.style.background='rgba(59,130,246,0.1)'" onmouseout="this.style.background=''">
                <td style="padding:0.6rem;text-align:center;font-size:0.9rem">${statusIcon}</td>
                <td style="padding:0.6rem;color:#e2e8f0;font-weight:500;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(podName)}">${escapeHtml(podName)}</td>
                <td style="padding:0.6rem;color:${statusColor};font-weight:600;font-size:0.75rem;text-transform:uppercase">${phase}</td>
                <td style="padding:0.6rem;color:#e2e8f0;text-align:center">${restarts}</td>
                <td style="padding:0.6rem;color:#94a3b8">${age}</td>
                <td style="padding:0.6rem;text-align:center;white-space:nowrap">
                    <button class="btn btn-ghost" style="padding:0.2rem 0.5rem;font-size:0.7rem;margin-right:0.2rem" onclick="showLogs('${escapeHtml(podNs)}','${escapeHtml(podName)}')">📋 Log</button>
                    <button class="btn btn-ghost" style="padding:0.2rem 0.5rem;font-size:0.7rem;margin-right:0.2rem;background:#0f4c75;color:#e2f0ff" onclick="execPod('${escapeHtml(podNs)}','${escapeHtml(podName)}')">💻 Exec</button>
                    ${canDeletePod ? `<button class="btn btn-danger" style="padding:0.2rem 0.5rem;font-size:0.7rem" onclick="deleteResource('pods','${escapeHtml(podName)}','${escapeHtml(podNs)}')">🗑️</button>` : ''}
                </td>
            </tr>`;
        });

        document.getElementById('pods-list-container').innerHTML = html;
    } catch (e) {
        alert(`Failed to load deployment detail: ${e.message}`);
        closeDeploymentDetailSection();
    }
}

function getAge(creationTimestamp) {
    try {
        const created = new Date(creationTimestamp).getTime();
        const now = new Date().getTime();
        const diff = Math.floor((now - created) / 1000);
        
        if (diff < 60) return `${diff}s`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return `${Math.floor(diff / 86400)}d`;
    } catch (e) {
        return '—';
    }
}

// ── Helpers ───────────────────────────────────────────
function fmtCPU(cpu) {
    if (!cpu) return '—';
    let cores = 0;
    // Handle nanocores (n)
    if (cpu.endsWith('n')) {
        const nanos = parseInt(cpu.replace('n', ''));
        if (isNaN(nanos)) return cpu;
        cores = nanos / 1000000000; // 1 billion nanocores = 1 core
    }
    // Handle millicores (m)
    else if (cpu.endsWith('m')) {
        const millis = parseInt(cpu.replace('m', ''));
        if (isNaN(millis)) return cpu;
        cores = millis / 1000; // 1000 millicores = 1 core
    }
    // Handle plain number (assume it's already in cores)
    else {
        cores = parseFloat(cpu);
        if (isNaN(cores)) return cpu;
    }
    
    if (cores < 1) {
        return cores.toFixed(3) + ' core';
    } else if (cores === 1) {
        return '1 core';
    } else {
        return cores.toFixed(1) + ' core';
    }
}

function fmtMem(mem) {
    if (!mem) return '—';
    const ki = parseInt(mem.replace('Ki', ''));
    if (isNaN(ki)) return mem;
    if (ki > 1024 * 1024) return (ki / 1024 / 1024).toFixed(1) + ' GiB';
    if (ki > 1024) return (ki / 1024).toFixed(0) + ' MiB';
    return ki + ' KiB';
}
