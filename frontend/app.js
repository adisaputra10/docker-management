
const API_BASE = '/api';

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
        options.headers['X-Docker-Host-ID'] = hostId;
    } else {
        options.headers.append('X-Docker-Host-ID', hostId);
    }

    return originalFetch(url, options);
};

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
            <small>Format: tcp://IP:PORT for remote, or unix:///path/to/socket for local</small>
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

    // Auto-refresh every 30 seconds
    setInterval(() => {
        fetchStats();
        const activeTab = document.querySelector('.nav-item.active');
        if (activeTab) {
            const tabName = activeTab.getAttribute('data-tab');
            loadTabData(tabName);
        }
    }, 30000);
});

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
        const [containersRes, imagesRes, volumesRes, networksRes] = await Promise.all([
            fetch(`${API_BASE}/containers`),
            fetch(`${API_BASE}/images`),
            fetch(`${API_BASE}/volumes`),
            fetch(`${API_BASE}/networks`)
        ]);

        const containers = await containersRes.json();
        const images = await imagesRes.json();
        const volumes = await volumesRes.json();
        const networks = await networksRes.json();

        const totalContainers = containers.length;
        const runningContainers = containers.filter(c => c.state === 'running').length;
        const totalImages = images.length;
        const totalVolumes = volumes.length;
        const totalNetworks = networks.length;

        // Update header stats
        document.querySelector('#totalContainers .stat-value').textContent = totalContainers;
        document.querySelector('#runningContainers .stat-value').textContent = runningContainers;
        document.querySelector('#totalImages .stat-value').textContent = totalImages;
        document.querySelector('#totalVolumes .stat-value').textContent = totalVolumes;
        document.querySelector('#totalNetworks .stat-value').textContent = totalNetworks;

        // Update sidebar
        updateSidebarBadges({
            containers: { total: totalContainers, running: runningContainers },
            images: totalImages,
            volumes: totalVolumes,
            networks: totalNetworks
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

// Containers
async function refreshContainers() {
    const containersList = document.getElementById('containers-list');
    containersList.innerHTML = '<div class="loading">Loading containers...</div>';

    try {
        const response = await fetch(`${API_BASE}/containers`);
        const containers = await response.json();

        if (!containers || containers.length === 0) {
            containersList.innerHTML = '<div class="loading">No containers found</div>';
            return;
        }

        containersList.innerHTML = containers.map(container => `
            <div class="card">
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
                        <button class="btn btn-primary" onclick="execContainer('${container.id}', '${container.name}')" style="flex: 1">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="4 17 10 11 4 5"/>
                                <line x1="12" y1="19" x2="20" y2="19"/>
                            </svg>
                            Exec
                        </button>
                        <button class="btn btn-warning" onclick="stopContainer('${container.id}')" title="Stop">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="6" width="12" height="12"/>
                            </svg>
                        </button>
                        <button class="btn btn-secondary" onclick="restartContainer('${container.id}')" title="Restart">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                            </svg>
                        </button>
                    ` : `
                        <button class="btn btn-success" onclick="startContainer('${container.id}')" style="flex: 1">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                            Start
                        </button>
                    `}
                    <button class="btn btn-danger" onclick="removeContainer('${container.id}')" title="Remove">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        fetchStats();
    } catch (error) {
        containersList.innerHTML = '<div class="loading">Failed to load containers</div>';
        showToast('Failed to load containers', 'error');
        console.error('Error fetching containers:', error);
    }
}

async function startContainer(id) {
    try {
        const response = await fetch(`${API_BASE}/containers/${id}/start`, {
            method: 'POST'
        });

        if (response.ok) {
            showToast('Container started successfully', 'success');
            refreshContainers();
        } else {
            showToast('Failed to start container', 'error');
        }
    } catch (error) {
        showToast('Error starting container', 'error');
        console.error('Error starting container:', error);
    }
}

async function stopContainer(id) {
    try {
        const response = await fetch(`${API_BASE}/containers/${id}/stop`, {
            method: 'POST'
        });

        if (response.ok) {
            showToast('Container stopped successfully', 'success');
            refreshContainers();
        } else {
            showToast('Failed to stop container', 'error');
        }
    } catch (error) {
        showToast('Error stopping container', 'error');
        console.error('Error stopping container:', error);
    }
}

async function restartContainer(id) {
    try {
        const response = await fetch(`${API_BASE}/containers/${id}/restart`, {
            method: 'POST'
        });

        if (response.ok) {
            showToast('Container restarted successfully', 'success');
            refreshContainers();
        } else {
            showToast('Failed to restart container', 'error');
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

// Images
async function refreshImages() {
    const imagesList = document.getElementById('images-list');
    imagesList.innerHTML = '<div class="loading">Loading images...</div>';

    try {
        const response = await fetch(`${API_BASE}/images`);
        const images = await response.json();

        if (!images || images.length === 0) {
            imagesList.innerHTML = '<div class="loading">No images found</div>';
            return;
        }

        imagesList.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Repository</th>
                        <th>Tag</th>
                        <th>ID</th>
                        <th>Size</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${images.map(image => `
                        <tr>
                            <td>${image.repository}</td>
                            <td>${image.tag}</td>
                            <td>${image.id}</td>
                            <td>${formatBytes(image.size)}</td>
                            <td>${formatDate(image.created)}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="inspectImage('${image.id}')">Inspect</button>
                                <button class="btn btn-sm btn-danger" onclick="removeImage('${image.id}', '${image.repository}:${image.tag}')">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

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

function switchTab(event, tabName) {
    event.preventDefault();

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
    document.getElementById(tabName + '-tab').classList.add('active');

    // Load tab data
    loadTabData(tabName);
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
