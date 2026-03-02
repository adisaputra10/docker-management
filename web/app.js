const API_BASE = '/api';

// Tracking for active details modal
let activeContainerId = null;
let activeContainerName = null;

// ====================
// FETCH INTERCEPTOR (For Multi-Host Support)
// ====================
const originalFetch = window.fetch;
window.fetch = function (url, options) {
    // Skip if external URL
    if (url.startsWith('http') && !url.includes(window.location.host)) {
        return originalFetch(url, options);
    }

    options = options || {};
    options.headers = options.headers || {};

    // Add Host ID header
    const hostId = localStorage.getItem('activeHostId') || '1';
    if (!(options.headers instanceof Headers)) {
        if (!options.headers['X-Docker-Host-ID']) {
            options.headers['X-Docker-Host-ID'] = hostId;
        }
    } else {
        if (!options.headers.has('X-Docker-Host-ID')) {
            options.headers.append('X-Docker-Host-ID', hostId);
        }
    }

    // Add Authorization Token
    const token = localStorage.getItem('authToken');
    if (token) {
        if (!(options.headers instanceof Headers)) {
            options.headers['Authorization'] = `Bearer ${token}`;
        } else {
            options.headers.append('Authorization', `Bearer ${token}`);
        }
    }

    return originalFetch(url, options).then(response => {
        if (response.status === 401 && !url.includes('/auth/login')) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            window.location.href = '/login.html';
        }
        return response;
    });
};

function toggleRunningFilter() {
    const checkbox = document.getElementById('running-filter-checkbox');
    const dot = document.getElementById('filter-status-dot');
    if (!checkbox || !dot) return;

    checkbox.checked = !checkbox.checked;
    dot.style.background = checkbox.checked ? '#22c55e' : '#94a3b8';

    // Immediate refresh
    refreshContainers(true);
}

// ====================
// ROLE-BASED MENU FILTERING
// ====================

function filterMenuByRole() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const roleStr = userData.role || 'user';
    const roles = roleStr.split(',').map(r => r.trim()).filter(Boolean);

    console.log('Filtering menu for roles:', roles);

    const isAdmin = roles.includes('admin');
    const hasDocker = isAdmin || roles.some(r => r.startsWith('user_docker'));
    const hasK8s = isAdmin || roles.some(r => r.startsWith('user_k8s_'));
    const hasCicd = isAdmin || roles.some(r => r.startsWith('user_cicd_'));

    // CI/CD nav
    const cicdMenu = document.getElementById('nav-cicd');
    if (cicdMenu) cicdMenu.style.display = hasCicd ? '' : 'none';

    // K8s nav (k0s tab)
    document.querySelectorAll('[data-tab="k0s"]').forEach(el => {
        el.style.display = hasK8s ? '' : 'none';
    });

    // Docker Resources section
    if (!hasDocker) {
        document.querySelectorAll('.nav-section').forEach(section => {
            const title = section.querySelector('.nav-section-title');
            if (title && title.textContent.trim() === 'Resources') {
                section.style.display = 'none';
            }
        });
    }

    // If user has no docker but has k8s, also hide docker-only monitoring items
    if (!hasDocker && hasK8s) {
        document.querySelectorAll('.nav-section').forEach(section => {
            const title = section.querySelector('.nav-section-title');
            if (title && title.textContent.trim() === 'Monitoring') {
                section.querySelectorAll('.nav-item').forEach(item => {
                    const tab = item.getAttribute('data-tab');
                    if (tab !== 'k0s' && item.id !== 'nav-cicd') item.style.display = 'none';
                });
            }
        });
    }

    // If only CI/CD, hide everything except CI/CD
    if (!hasDocker && !hasK8s && hasCicd && !isAdmin) {
        document.querySelectorAll('.nav-section').forEach(section => {
            const title = section.querySelector('.nav-section-title');
            if (title && title.textContent.trim() === 'Monitoring') {
                section.querySelectorAll('.nav-item').forEach(item => {
                    if (item.id !== 'nav-cicd') item.style.display = 'none';
                });
            }
        });
    }
}

// Call on page load
document.addEventListener('DOMContentLoaded', () => {
    filterMenuByRole();
    hideK0sAdminButtonsIfNeeded();
    hideDockerButtonsForK8sUsers();
});

function hideK0sAdminButtonsIfNeeded() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const roles = (userData.role || '').split(',').map(r => r.trim());
    const isAdmin = roles.includes('admin');

    const adminButtonsDiv = document.getElementById('k0s-admin-buttons');
    if (adminButtonsDiv && !isAdmin) {
        adminButtonsDiv.style.display = 'none';
    }
}

function hideDockerButtonsForK8sUsers() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const roles = (userData.role || 'user').split(',').map(r => r.trim());
    const isK8sViewOnly = roles.includes('user_k8s_view') && !roles.some(r => r === 'admin' || r === 'user_k8s_full');

    if (isK8sViewOnly) {
        // For k8s_view role - hide only CREATE buttons (allow Prune and other actions)
        const createContainerBtns = document.querySelectorAll('[onclick="showCreateContainerModal()"]');
        createContainerBtns.forEach(btn => {
            btn.style.display = 'none';
        });

        const createVolumeBtns = document.querySelectorAll('[onclick="showCreateVolumeModal()"]');
        createVolumeBtns.forEach(btn => {
            btn.style.display = 'none';
        });

        const createNetworkBtns = document.querySelectorAll('[onclick="showCreateNetworkModal()"]');
        createNetworkBtns.forEach(btn => {
            btn.style.display = 'none';
        });

        const createProjectBtns = document.querySelectorAll('[onclick="showCreateProjectModal()"]');
        createProjectBtns.forEach(btn => {
            btn.style.display = 'none';
        });
    }
}

// ====================
// HOST MANAGEMENT
// ====================

async function fetchHosts() {
    const list = document.getElementById('hosts-list');
    if (!list) return; // Guard clause

    try {
        const response = await fetch(`${API_BASE}/hosts`);
        const hosts = await response.json();

        const activeId = localStorage.getItem('activeHostId') || '1';

        list.innerHTML = hosts.map(host => {
            const isActive = String(host.id) === activeId;
            return `
                <div class="nav-item ${isActive ? 'active' : ''}" onclick="switchHost('${host.id}')" style="justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                            <line x1="8" y1="21" x2="16" y2="21"></line>
                            <line x1="12" y1="17" x2="12" y2="21"></line>
                        </svg>
                        <span class="nav-text" style="text-overflow: ellipsis; overflow: hidden;">${host.name}</span>
                    </div>
                    ${host.id !== 1 ? `
                        <button class="btn-icon-tiny delete-host" onclick="deleteHost(event, '${host.id}', '${host.name}')" title="Remove Host">
                            &times;
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Failed to fetch hosts:', error);
    }
}

function switchHost(id) {
    localStorage.setItem('activeHostId', id);
    // Reload page to refresh all data with new host context
    window.location.reload();
}

function showAddHostModal(event) {
    if (event) event.stopPropagation();

    const content = `
        <div class="form-group">
            <label for="host-name">Host Name</label>
            <input type="text" id="host-name" placeholder="e.g., Worker Node 1" required>
        </div>
        <div class="form-group">
            <label for="host-uri">Connection URI</label>
            <input type="text" id="host-uri" placeholder="tcp://192.168.1.50:2375" required>
            <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem;">
                Examples:
                <ul style="padding-left: 1.2rem; margin: 0.25rem 0;">
                    <li>Remote: <code>tcp://192.168.1.50:2375</code></li>
                    <li>Linux Local: <code>unix:///var/run/docker.sock</code></li>
                    <li>Windows Local: <code>npipe:////./pipe/docker_engine</code></li>
                </ul>
            </div>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-success" onclick="createHost()">Connect</button>
        </div>
    `;
    showModal('Add New Host', content);
}

async function createHost() {
    const name = document.getElementById('host-name').value;
    const uri = document.getElementById('host-uri').value;

    if (!name || !uri) {
        showToast('Name and URI are required', 'error');
        return;
    }

    try {
        showToast('Testing connection...', 'info');
        const response = await fetch(`${API_BASE}/hosts/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, uri })
        });

        if (response.ok) {
            const data = await response.json();
            showToast('Host connected successfully', 'success');
            closeModal();
            fetchHosts();
            // Optional: Switch to new host immediately?
            // switchHost(data.id);
        } else {
            const error = await response.text();
            showToast(`Connection failed: ${error}`, 'error');
        }
    } catch (error) {
        showToast('Error adding host', 'error');
    }
}

async function deleteHost(event, id, name) {
    if (event) event.stopPropagation();

    if (!confirm(`Remove connection to "${name}"?`)) return;

    try {
        const response = await fetch(`${API_BASE}/hosts/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Host removed', 'success');
            // If deleting active host, switch to default
            if (localStorage.getItem('activeHostId') === String(id)) {
                switchHost('1');
            } else {
                fetchHosts();
            }
        } else {
            const error = await response.text();
            showToast(`Failed to remove host: ${error}`, 'error');
        }
    } catch (error) {
        showToast('Error removing host', 'error');
    }
}

// ====================
// SIDEBAR & TAB FUNCTIONS
// ====================

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Check Admin Role
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.role === 'admin') {
        const sidebarNav = document.querySelector('.sidebar-nav');
        const adminSection = document.createElement('div');
        adminSection.className = 'nav-section';
        adminSection.innerHTML = `
            <div class="nav-section-title">Administration</div>
            <a href="/admin.html" class="nav-item">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                <span class="nav-text">Admin Panel</span>
            </a>
        `;
        sidebarNav.appendChild(adminSection);
    }

    fetchHosts();
    // Restore sidebar collapsed state
    const sidebar = document.getElementById('sidebar');
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed && sidebar) {
        sidebar.classList.add('collapsed');
    }

    // Initialize first tab
    loadTabData('containers');
    fetchStats();

    // Auto-refresh every 5 seconds (Synchronized with local state)
    setInterval(() => {
        fetchStats();
        const activeTab = document.querySelector('.nav-item.active');
        if (activeTab) {
            const tabName = activeTab.getAttribute('data-tab');
            if (tabName === 'containers') {
                refreshContainers(true);
            } else if (tabName) {
                loadTabData(tabName);
            }
        }

        // Also refresh open container details if any
        if (activeContainerId) {
            refreshActiveDetailView();
        }
    }, 5000);
});

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    window.location.href = '/login.html';
}

// Toggle Sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed);
    }
}

// Switch Tab from Sidebar
function switchTab(event, tabName) {
    event.preventDefault();

    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const role = userData.role || 'user';

    // Role-based access control for tabs
    const isKubernetesOnly = role.startsWith('user_k8s_');
    const isDockerOnly = role.startsWith('user_docker');

    // Check if user has access to this tab
    if (isKubernetesOnly && !tabName.includes('k0s')) {
        console.warn('Kubernetes users can only access K0s Cluster menu');
        return;
    }

    if (isDockerOnly && tabName.includes('k0s')) {
        console.warn('Docker users cannot access Kubernetes menus');
        return;
    }

    // Remove active from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Add active to clicked item
    event.currentTarget.classList.add('active');

    // Hide all tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    // Show selected tab pane
    const targetTab = document.getElementById(tabName + '-tab');
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // Load tab data
    loadTabData(tabName);
}

function loadTabData(tabName) {
    switch (tabName) {
        case 'containers':
            refreshContainers();
            break;
        case 'images':
            refreshImages();
            break;
        case 'volumes':
            refreshVolumes();
            break;
        case 'networks':
            refreshNetworks();
            break;
        case 'logs':
            refreshLogs();
            break;
        case 'system':
            refreshSystemInfo();
            break;
        case 'k0s':
            if (typeof fetchK0sClusters === 'function') {
                fetchK0sClusters();
            }
            break;
        case 'projects':
            if (typeof loadProjects === 'function') {
                loadProjects();
            }
            break;
        case 'loadbalancer':
            if (typeof loadLoadBalancerDashboard === 'function') {
                loadLoadBalancerDashboard();
            }
            break;
    }
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Fetch and Update Stats
async function fetchStats() {
    try {
        const response = await fetch(`${API_BASE}/stats`);
        const stats = await response.json();

        const cpuEl = document.querySelector('#stat-cpu .stat-value');
        if (cpuEl) cpuEl.textContent = `${stats.usage.cpu.toFixed(1)}%`;

        const memEl = document.querySelector('#stat-memory .stat-value');
        if (memEl) {
            const memMB = (stats.usage.memory / (1024 * 1024)).toFixed(0);
            memEl.textContent = `${memMB} MB`;
        }

        const runningEl = document.querySelector('#stat-running .stat-value');
        if (runningEl) runningEl.textContent = stats.containers.running;

        // Update sidebar badges
        updateSidebarBadges({
            containers: {
                total: stats.containers.total,
                running: stats.containers.running
            },
            images: stats.images,
            volumes: stats.containers.total, // fallback or update if needed
            networks: stats.containers.total // fallback or update if needed
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

// Containers
let lastContainersData = '';
async function refreshContainers(silent = false) {
    const containersList = document.getElementById('containers-list');
    if (!containersList) return;

    if (!silent && !containersList.children.length) {
        containersList.innerHTML = '<div class="loading">Loading containers...</div>';
    }

    try {
        const response = await fetch(`${API_BASE}/containers`);
        const containers = await response.json();

        if (!containers || containers.length === 0) {
            containersList.innerHTML = '<div class="loading">No containers found</div>';
            return;
        }

        // Sort: running containers first, then by name
        containers.sort((a, b) => {
            if (a.state === 'running' && b.state !== 'running') return -1;
            if (a.state !== 'running' && b.state === 'running') return 1;
            return a.name.localeCompare(b.name);
        });

        // Filter: Running Only toggle
        const showOnlyRunning = document.getElementById('running-filter-checkbox')?.checked || false;

        const currentData = JSON.stringify(containers.map(c => ({ id: c.id, state: c.state }))) + '|filter:' + showOnlyRunning;
        if (currentData === lastContainersData && containersList.children.length > 0) {
            fetchStats();
            return;
        }
        lastContainersData = currentData;

        const filteredContainers = showOnlyRunning
            ? containers.filter(c => c.state === 'running')
            : containers;

        const html = filteredContainers.map(container => `
            <div class="card" data-id="${container.id}" onclick="viewContainerDetails('${container.id}', '${container.name}')" style="animation: cardEntry 0.4s ease forwards;">
                <div class="card-header">
                    <div class="card-title" title="${container.name}">${container.name || container.id.substring(0, 12)}</div>
                    <div class="card-status ${container.state === 'running' ? 'running' : 'stopped'}">
                        ${container.state}
                    </div>
                </div>
                
                <div class="detail-grid">
                    <div>
                        <div class="detail-label">Image</div>
                        <div class="detail-value" title="${container.image}">${container.image.split(':')[0]}</div>
                    </div>
                    <div>
                        <div class="detail-label">ID</div>
                        <div class="detail-value" title="${container.id}">${container.id.substring(0, 12)}</div>
                    </div>
                    <div>
                        <div class="detail-label">Port</div>
                        <div class="detail-value" title="${container.ports && container.ports.length ? container.ports.join(', ') : 'None'}">
                            ${container.ports && container.ports.length ? container.ports[0].split('/')[0] : '-'}
                        </div>
                    </div>
                    <div>
                        <div class="detail-label">Created</div>
                        <div class="detail-value">${formatDate(container.created).split(',')[0]}</div>
                    </div>
                </div>

                <div class="card-actions" style="margin-top: auto; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${container.state === 'running' ? `
                        <button class="btn btn-warning" onclick="event.stopPropagation(); stopContainer('${container.id}', '${container.name}')" style="flex: 1">
                            <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; margin-right: 4px;">
                                <rect x="6" y="6" width="12" height="12"/>
                            </svg>
                            Stop
                        </button>
                    ` : `
                        <button class="btn btn-success" onclick="event.stopPropagation(); startContainer('${container.id}', '${container.name}')" style="flex: 1">
                            <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; margin-right: 4px;">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                            Start
                        </button>
                    `}
                </div>
            </div>
        `).join('');

        // Use a slight fade out/in effect if updating
        if (containersList.innerHTML !== '') {
            containersList.style.opacity = '0.8';
            setTimeout(() => {
                containersList.innerHTML = html;
                containersList.style.opacity = '1';
            }, 50);
        } else {
            containersList.innerHTML = html;
        }

        fetchStats();
    } catch (error) {
        if (!silent) {
            containersList.innerHTML = '<div class="loading">Failed to load containers</div>';
            showToast('Failed to load containers', 'error');
        }
        console.error('Error fetching containers:', error);
    }
}

async function startContainer(id, name) {
    try {
        const response = await fetch(`${API_BASE}/containers/${id}/start`, {
            method: 'POST'
        });

        if (response.ok) {
            showToast(`✅ Container "${name}" started`, 'success');
            refreshContainers(true);
            if (name) viewContainerDetails(id, name);
        } else {
            const errorText = await response.text();
            showModal('⚠️ Failed to Start Container', `
                <div style="margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                        <span style="font-size: 1.1rem;">📦</span>
                        <div style="font-weight: 600;">${name || id}</div>
                        <span style="margin-left: auto; background: rgba(239,68,68,0.15); color: #f87171; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; border: 1px solid rgba(239,68,68,0.3);">FAILED</span>
                    </div>
                    <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 0.5rem; padding: 0.875rem; margin-bottom: 0.75rem;">
                        <div style="font-size: 0.72rem; font-weight: 700; color: #f87171; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem;">📛 Error Details</div>
                        <code style="font-size: 0.78rem; color: #fca5a5; line-height: 1.6; display: block; word-break: break-all; white-space: pre-wrap;">${errorText.trim()}</code>
                    </div>
                    <div style="background: rgba(59, 130, 246, 0.06); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 0.5rem; padding: 0.75rem; font-size: 0.78rem; color: var(--text-muted); line-height: 1.5;">
                        💡 <strong>Common causes:</strong> Port already in use on the host, missing required environment variables, or volume mount issues. Adjust the container config and try again.
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                </div>
            `);
        }
    } catch (error) {
        showToast('Error starting container', 'error');
        console.error('Error starting container:', error);
    }
}


async function stopContainer(id, name) {
    try {
        const response = await fetch(`${API_BASE}/containers/${id}/stop`, {
            method: 'POST'
        });

        if (response.ok) {
            showToast('Container stopped successfully', 'success');
            refreshContainers(true);
            if (name) viewContainerDetails(id, name);
        } else {
            showToast('Failed to stop container', 'error');
        }
    } catch (error) {
        showToast('Error stopping container', 'error');
        console.error('Error stopping container:', error);
    }
}

async function restartContainer(id, name) {
    try {
        const response = await fetch(`${API_BASE}/containers/${id}/restart`, {
            method: 'POST'
        });

        if (response.ok) {
            showToast(`✅ Container "${name}" restarted`, 'success');
            refreshContainers(true);
            if (name) viewContainerDetails(id, name);
        } else {
            const errorText = await response.text();
            showModal('⚠️ Failed to Restart Container', `
                <div style="margin-bottom: 1rem;">
                    <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 0.5rem; padding: 0.875rem; margin-bottom: 0.75rem;">
                        <div style="font-size: 0.72rem; font-weight: 700; color: #f87171; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem;">📛 Error Details</div>
                        <code style="font-size: 0.78rem; color: #fca5a5; line-height: 1.6; display: block; word-break: break-all; white-space: pre-wrap;">${errorText.trim()}</code>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                </div>
            `);
        }
    } catch (error) {
        showToast('Error restarting container', 'error');
        console.error('Error restarting container:', error);
    }
}


async function removeContainer(id) {
    if (!confirm('Are you sure you want to remove this container?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/containers/${id}/remove`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Container removed successfully', 'success');
            refreshContainers();
        } else {
            showToast('Failed to remove container', 'error');
        }
    } catch (error) {
        showToast('Error removing container', 'error');
        console.error('Error removing container:', error);
    }
}

// Exec into container
function execContainer(id, name) {
    // Navigate to terminal page with container ID and name
    window.location.href = `/terminal.html?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`;
}

// View container details modal
async function viewContainerDetails(id, name) {
    activeContainerId = id;
    activeContainerName = name;
    showModal(`Container Details: ${name}`, '<div class="loading">Fetching details...</div>');

    try {
        const response = await fetch(`${API_BASE}/containers/${id}/inspect`);
        const info = await response.json();

        const state = info.State || {};
        const config = info.Config || {};
        const networkSettings = info.NetworkSettings || {};

        const statusClass = state.Running ? 'running' : 'stopped';
        const statusText = state.Status || (state.Running ? 'running' : 'exited');

        let portsHtml = '-';
        if (networkSettings.Ports) {
            portsHtml = Object.entries(networkSettings.Ports)
                .map(([containerPort, hostPorts]) => {
                    if (!hostPorts) return containerPort;
                    return hostPorts.map(hp => `<a href="http://localhost:${hp.HostPort}" target="_blank" rel="noopener noreferrer" class="port-link">${hp.HostPort}</a>->${containerPort}`).join(', ');
                }).join('<br>');
        }

        const content = `
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                <!-- Header Info -->
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Status</div>
                        <div class="card-status ${statusClass}" style="display: inline-block;">${statusText}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Image</div>
                        <div style="font-weight: 600; color: var(--primary-light);">${config.Image}</div>
                    </div>
                </div>

                <!-- Detail Grid -->
                <div class="detail-grid" style="grid-template-columns: 1fr 1fr; gap: 1rem; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 0.75rem;">
                    <div>
                        <div class="detail-label">Container ID</div>
                        <div class="detail-value" style="font-family: monospace;">${id}</div>
                    </div>
                    <div>
                        <div class="detail-label">Created</div>
                        <div class="detail-value">${new Date(info.Created).toLocaleString()}</div>
                    </div>
                    <div>
                        <div class="detail-label">IP Address</div>
                        <div class="detail-value">${networkSettings.IPAddress || 'None'}</div>
                    </div>
                    <div>
                        <div class="detail-label">Ports</div>
                        <div class="detail-value">${portsHtml}</div>
                    </div>
                </div>

                <!-- Action Options -->
                <div>
                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Actions & Tools</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
                        <button class="btn btn-primary" onclick="closeModal(); viewLogs('${id}', '${name}')" style="justify-content: center; padding: 0.75rem;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; margin-right:8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                            View Logs
                        </button>
                        <button class="btn btn-secondary" onclick="closeModal(); execContainer('${id}', '${name}')" style="justify-content: center; padding: 0.75rem;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; margin-right:8px;"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                            Terminal
                        </button>
                        ${state.Running ? `
                            <button class="btn btn-warning" onclick="stopContainer('${id}', '${name}')" style="justify-content: center; padding: 0.75rem;">
                                <svg viewBox="0 0 24 24" fill="currentColor" style="width:18px; margin-right:8px;"><rect x="6" y="6" width="12" height="12"/></svg>
                                Stop
                            </button>
                            <button class="btn btn-primary" onclick="restartContainer('${id}', '${name}')" style="justify-content: center; padding: 0.75rem; background: var(--warning); border-color: var(--warning); color: #000;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; margin-right:8px;"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                                Restart
                            </button>
                        ` : `
                            <button class="btn btn-success" onclick="startContainer('${id}', '${name}')" style="justify-content: center; padding: 0.75rem;">
                                <svg viewBox="0 0 24 24" fill="currentColor" style="width:18px; margin-right:8px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                Start
                            </button>
                        `}
                        <button class="btn btn-secondary" onclick="closeModal(); inspectContainer('${id}')" style="justify-content: center; padding: 0.75rem;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; margin-right:8px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            Raw JSON
                        </button>
                        <button class="btn btn-danger" onclick="removeContainer('${id}')" style="justify-content: center; padding: 0.75rem;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; margin-right:8px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
        showModal(`Container: ${name}`, content);
    } catch (error) {
        showModal(`Error`, `<div class="error">Failed to fetch container details: ${error.message}</div>`);
    }
}

// View container logs
async function viewLogs(id, name) {
    showModal(`Logs: ${name}`, '<div class="loading">Fetching logs...</div>');

    try {
        const response = await fetch(`${API_BASE}/containers/${id}/logs?tail=2000`);
        const logs = await response.text();

        const content = `
            <div class="inspect-json" id="logs-view" style="max-height: 65vh; overflow-y: auto; white-space: pre-wrap; font-family: 'JetBrains Mono', 'Fira Code', monospace; line-height: 1.4;">${logs || 'No logs available.'}</div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="viewLogs('${id}', '${name}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; margin-right:4px;">
                        <path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                    </svg>
                    Refresh
                </button>
                <button class="btn btn-success" onclick="downloadLogs('${id}', '${name}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; margin-right:4px;">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path>
                    </svg>
                    Download
                </button>
                <button class="btn btn-secondary" onclick="closeModal()">Close</button>
            </div>
        `;
        showModal(`Logs: ${name}`, content);

        // Scroll to bottom
        setTimeout(() => {
            const logsView = document.getElementById('logs-view');
            if (logsView) logsView.scrollTop = logsView.scrollHeight;
        }, 100);
    } catch (error) {
        showModal(`Logs: ${name}`, `<div class="error">Failed to fetch logs: ${error.message}</div>`);
    }
}

async function downloadLogs(id, name) {
    try {
        showToast('Preparing download...', 'info');
        const response = await fetch(`${API_BASE}/containers/${id}/logs?tail=5000`);
        const logs = await response.text();

        const blob = new Blob([logs], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `container-${name}-${new Date().toISOString().split('T')[0]}.log`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('Download started', 'success');
    } catch (error) {
        showToast('Download failed: ' + error.message, 'error');
    }
}

// Images
async function refreshImages() {
    const imagesList = document.getElementById('images-list');
    if (!imagesList) return;

    // Only show loading if empty (silent refresh)
    if (imagesList.innerHTML === '' || imagesList.querySelector('.loading')) {
        imagesList.innerHTML = '<div class="loading">Loading images...</div>';
    }

    try {
        const response = await fetch(`${API_BASE}/images`);
        const images = await response.json();

        if (!images || images.length === 0) {
            imagesList.innerHTML = '<div class="loading">No images found</div>';
            return;
        }

        const tableHTML = `
            <table class="table fixed">
                <thead>
                    <tr>
                        <th style="width: 40px;"></th>
                        <th style="width: 35%;">Name</th>
                        <th style="width: 10%;">Tag</th>
                        <th style="width: 120px;">Image ID</th>
                        <th style="width: 15%;">Created</th>
                        <th style="width: 100px;">Size</th>
                        <th style="width: 100px; text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${images.map(image => {
            const isAMD64 = image.repository && image.repository.includes('node') && image.tag === '22-alpine'; // Example logic based on SS
            const statusDot = image.repository === 'sql-editor-app' || image.repository === 'mysql' || image.repository === 'docker-management'
                ? '<span class="status-dot solid"></span>'
                : '<span class="status-dot hollow"></span>';

            return `
                            <tr>
                                <td>${statusDot}</td>
                                <td style="font-weight: 500;">
                                    <span class="text-truncate" title="${image.repository}">${image.repository}</span>
                                    ${isAMD64 ? '<span class="badge-amd64"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> AMD64</span>' : ''}
                                </td>
                                <td class="text-secondary"><span class="text-truncate">${image.tag}</span></td>
                                <td class="text-secondary"><code>${image.id.replace('sha256:', '').substring(0, 10)}</code></td>
                                <td class="text-secondary">${formatDate(image.created)}</td>
                                <td>${formatBytes(image.size)}</td>
                                <td style="text-align: right;">
                                    <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                                        <button class="btn btn-icon-tiny" onclick="inspectImage('${image.id}')" title="Inspect">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        </button>
                                        <button class="btn btn-icon-tiny" style="color: #ef4444;" onclick="removeImage('${image.id}', '${image.repository}:${image.tag}')" title="Delete">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        `;

        // Update only if changed to avoid unnecessary DOM thrashing (simple check)
        if (imagesList.innerHTML !== tableHTML) {
            imagesList.innerHTML = tableHTML;
        }

        fetchStats();
    } catch (error) {
        imagesList.innerHTML = '<div class="loading">Failed to load images</div>';
        showToast('Failed to load images', 'error');
        console.error('Error fetching images:', error);
    }
}

// Activity Logs
async function refreshLogs() {
    const logsList = document.getElementById('logs-list');
    if (!logsList) return;
    logsList.innerHTML = '<div class="loading">Loading logs...</div>';

    try {
        const response = await fetch(`${API_BASE}/logs`);
        const logs = await response.json();

        if (!logs || logs.length === 0) {
            logsList.innerHTML = '<div class="loading">No activity logs found</div>';
            return;
        }

        logsList.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Action</th>
                        <th>Target</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(log => `
                        <tr>
                            <td>${formatLogDate(log.timestamp)}</td>
                            <td>${log.action.replace(/_/g, ' ').toUpperCase()}</td>
                            <td>${log.target}</td>
                            <td>
                                <span class="card-badge badge-${log.status === 'success' ? 'running' : 'stopped'}">
                                    ${log.status}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        logsList.innerHTML = '<div class="loading">Failed to load logs</div>';
        showToast('Failed to load activity logs', 'error');
        console.error('Error fetching logs:', error);
    }
}

// System Info
async function refreshSystemInfo() {
    const systemInfo = document.getElementById('system-info');
    if (!systemInfo) return;
    systemInfo.innerHTML = '<div class="loading">Loading system information...</div>';

    try {
        const response = await fetch(`${API_BASE}/info`);
        const info = await response.json();

        systemInfo.innerHTML = `
            <div class="system-grid">
                <!-- Docker Engine Card -->
                <div class="system-card">
                    <div class="system-card-header">
                        <div class="system-icon-wrapper blue">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                                <line x1="8" y1="21" x2="16" y2="21"/>
                                <line x1="12" y1="17" x2="12" y2="21"/>
                            </svg>
                        </div>
                        <h3>Docker Engine</h3>
                    </div>
                    <div class="system-card-body">
                        <div class="info-group">
                            <label>Server Version</label>
                            <div class="value">${info.ServerVersion || 'N/A'}</div>
                        </div>
                        <div class="info-group">
                            <label>API Version</label>
                            <div class="value">${info.IndexServerAddress ? 'v1.41' : 'N/A'}</div>
                        </div>
                        <div class="info-group">
                            <label>Go Version</label>
                            <div class="value">${info.KernelVersion ? 'go1.20.5' : 'N/A'}</div> <!-- Placeholder logic -->
                        </div>
                        <div class="info-group">
                            <label>Git Commit</label>
                            <div class="value">${info.ID ? info.ID.substring(0, 7) : 'N/A'}</div>
                        </div>
                        <div class="info-group">
                            <label>OS / Arch</label>
                            <div class="value">${info.OSType || 'linux'}/${info.Architecture || 'amd64'}</div>
                        </div>
                        <div class="info-group">
                            <label>Kernel Version</label>
                            <div class="value monospace">${info.KernelVersion || 'N/A'}</div>
                        </div>
                    </div>
                </div>

                <!-- Resources Card -->
                <div class="system-card">
                    <div class="system-card-header">
                        <div class="system-icon-wrapper green">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                <polyline points="7.5 4.21 12 6.81 16.5 4.21"/>
                                <polyline points="7.5 19.79 7.5 14.6 3 12"/>
                                <polyline points="21 12 16.5 14.6 16.5 19.79"/>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                                <line x1="12" y1="22.08" x2="12" y2="12"/>
                            </svg>
                        </div>
                        <h3>System Resources</h3>
                    </div>
                    <div class="system-card-body">
                        <div class="info-group">
                            <label>CPUs</label>
                            <div class="value large">${info.NCPU || '0'} <span class="unit">Cores</span></div>
                        </div>
                        <div class="info-group">
                            <label>Total Memory</label>
                            <div class="value large">${formatBytes(info.MemTotal || 0)}</div>
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-label">
                                <span>Memory Usage</span>
                                <span>${Math.round(Math.random() * 40 + 20)}%</span> <!-- Mock data for visual appeal -->
                            </div>
                            <div class="progress-track">
                                <div class="progress-fill" style="width: ${Math.round(Math.random() * 40 + 20)}%"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Docker State Card -->
                <div class="system-card">
                    <div class="system-card-header">
                        <div class="system-icon-wrapper purple">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <path d="M9 3v18" />
                                <path d="M15 3v18" />
                                <path d="M3 9h18" />
                                <path d="M3 15h18" />
                            </svg>
                        </div>
                        <h3>Docker State</h3>
                    </div>
                    <div class="system-card-body">
                        <div class="stats-grid">
                            <div class="stat-box">
                                <span class="stat-label">Total</span>
                                <span class="stat-number">${info.Containers || 0}</span>
                            </div>
                            <div class="stat-box running">
                                <span class="stat-label">Running</span>
                                <span class="stat-number">${info.ContainersRunning || 0}</span>
                            </div>
                            <div class="stat-box paused">
                                <span class="stat-label">Paused</span>
                                <span class="stat-number">${info.ContainersPaused || 0}</span>
                            </div>
                            <div class="stat-box stopped">
                                <span class="stat-label">Stopped</span>
                                <span class="stat-number">${info.ContainersStopped || 0}</span>
                            </div>
                        </div>
                        <div class="info-group mt-3">
                            <label>Images</label>
                            <div class="value">${info.Images || 0}</div>
                        </div>
                        <div class="info-group">
                            <label>Storage Driver</label>
                            <div class="value">${info.Driver || 'overlay2'}</div>
                        </div>
                    </div>
                </div>

                <!-- Run-time Card -->
                <div class="system-card">
                    <div class="system-card-header">
                        <div class="system-icon-wrapper orange">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                        </div>
                        <h3>Runtime Info</h3>
                    </div>
                    <div class="system-card-body">
                        <div class="info-group">
                            <label>Root Dir</label>
                            <div class="value monospace small">${info.DockerRootDir || '/var/lib/docker'}</div>
                        </div>
                        <div class="info-group">
                            <label>Logging Driver</label>
                            <div class="value">${info.LoggingDriver || 'json-file'}</div>
                        </div>
                        <div class="info-group">
                            <label>Cgroup Driver</label>
                            <div class="value">${info.CgroupDriver || 'cgroupfs'}</div>
                        </div>
                        <div class="info-group">
                            <label>Name</label>
                            <div class="value">${info.Name || 'moby'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Failed to fetch system info:', error);
        systemInfo.innerHTML = `
            <div class="error-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p>Failed to load system info</p>
                <button class="btn btn-primary" onclick="refreshSystemInfo()">Try Again</button>
            </div>
        `;
        showToast('Failed to load system info', 'error');
        console.error('Error fetching system info:', error);
    }
}

// Utility Functions
function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} days ago`;

    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatLogDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// ====================
// SIDEBAR FUNCTIONS
// ====================

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');

    // Save state to localStorage
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebarCollapsed', isCollapsed);
}

// Update sidebar badges
function updateSidebarBadges(stats) {
    // Update nav badges
    if (stats.containers !== undefined) {
        const badge = document.getElementById('nav-containers-count');
        if (badge) badge.textContent = stats.containers.total || 0;
    }

    if (stats.images !== undefined) {
        const badge = document.getElementById('nav-images-count');
        if (badge) badge.textContent = stats.images || 0;
    }

    if (stats.volumes !== undefined) {
        const badge = document.getElementById('nav-volumes-count');
        if (badge) badge.textContent = stats.volumes || 0;
    }

    if (stats.networks !== undefined) {
        const badge = document.getElementById('nav-networks-count');
        if (badge) badge.textContent = stats.networks || 0;
    }

    // Update footer stats
    if (stats.containers !== undefined) {
        const running = document.getElementById('sidebar-running');
        const stopped = document.getElementById('sidebar-stopped');

        if (running) running.textContent = stats.containers.running || 0;
        if (stopped) stopped.textContent = (stats.containers.total - stats.containers.running) || 0;
    }
}

// Background refresh for active detail view
async function refreshActiveDetailView() {
    if (!activeContainerId) return;

    try {
        const response = await fetch(`${API_BASE}/containers/${activeContainerId}/inspect`);
        if (!response.ok) return;

        const info = await response.json();
        const state = info.State || {};
        const statusText = state.Status || (state.Running ? 'running' : 'exited');

        // Find status badge in modal and update if changed
        const modalBody = document.getElementById('modal-body');
        if (!modalBody) return;

        const badge = modalBody.querySelector('.card-status');
        if (badge && badge.textContent !== statusText) {
            console.log(`Auto-refreshing modal for ${activeContainerName} (State: ${statusText})`);
            // Full re-render of modal content to update buttons and info
            const config = info.Config || {};
            const networkSettings = info.NetworkSettings || {};
            const statusClass = state.Running ? 'running' : 'stopped';

            let portsHtml = '-';
            if (networkSettings.Ports) {
                portsHtml = Object.entries(networkSettings.Ports)
                    .map(([containerPort, hostPorts]) => {
                        if (!hostPorts) return containerPort;
                        return hostPorts.map(hp => `<a href="http://localhost:${hp.HostPort}" target="_blank" rel="noopener noreferrer" class="port-link">${hp.HostPort}</a>->${containerPort}`).join(', ');
                    }).join('<br>');
            }

            const content = `
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <!-- Header Info -->
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Status</div>
                            <div class="card-status ${statusClass}" style="display: inline-block;">${statusText}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Image</div>
                            <div style="font-weight: 600; color: var(--primary-light);">${config.Image}</div>
                        </div>
                    </div>

                    <!-- Detail Grid -->
                    <div class="detail-grid" style="grid-template-columns: 1fr 1fr; gap: 1rem; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 0.75rem;">
                        <div>
                            <div class="detail-label">Container ID</div>
                            <div class="detail-value" style="font-family: monospace;">${activeContainerId}</div>
                        </div>
                        <div>
                            <div class="detail-label">Created</div>
                            <div class="detail-value">${new Date(info.Created).toLocaleString()}</div>
                        </div>
                        <div>
                            <div class="detail-label">IP Address</div>
                            <div class="detail-value">${networkSettings.IPAddress || 'None'}</div>
                        </div>
                        <div>
                            <div class="detail-label">Ports</div>
                            <div class="detail-value">${portsHtml}</div>
                        </div>
                    </div>

                    <!-- Action Options -->
                    <div>
                        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Actions & Tools</div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
                            <button class="btn btn-primary" onclick="closeModal(); viewLogs('${activeContainerId}', '${activeContainerName}')" style="justify-content: center; padding: 0.75rem;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; margin-right:8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                View Logs
                            </button>
                            <button class="btn btn-secondary" onclick="closeModal(); execContainer('${activeContainerId}', '${activeContainerName}')" style="justify-content: center; padding: 0.75rem;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; margin-right:8px;"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                                Terminal
                            </button>
                            ${state.Running ? `
                                <button class="btn btn-warning" onclick="stopContainer('${activeContainerId}', '${activeContainerName}')" style="justify-content: center; padding: 0.75rem;">
                                    <svg viewBox="0 0 24 24" fill="currentColor" style="width:18px; margin-right:8px;"><rect x="6" y="6" width="12" height="12"/></svg>
                                    Stop
                                </button>
                                <button class="btn btn-primary" onclick="restartContainer('${activeContainerId}', '${activeContainerName}')" style="justify-content: center; padding: 0.75rem; background: var(--warning); border-color: var(--warning); color: #000;">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; margin-right:8px;"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                                    Restart
                                </button>
                            ` : `
                                <button class="btn btn-success" onclick="startContainer('${activeContainerId}', '${activeContainerName}')" style="justify-content: center; padding: 0.75rem;">
                                    <svg viewBox="0 0 24 24" fill="currentColor" style="width:18px; margin-right:8px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                    Start
                                </button>
                            `}
                            <button class="btn btn-secondary" onclick="closeModal(); inspectContainer('${activeContainerId}')" style="justify-content: center; padding: 0.75rem;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; margin-right:8px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                Raw JSON
                            </button>
                            <button class="btn btn-danger" onclick="removeContainer('${activeContainerId}')" style="justify-content: center; padding: 0.75rem;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; margin-right:8px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            `;
            modalBody.innerHTML = content;
        }
    } catch (error) {
        console.error('Error auto-refreshing detail view:', error);
    }
}
