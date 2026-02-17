async function loadLBRoutes() {
    const list = document.getElementById('lb-routes-list');
    list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 1rem;">Loading routes...</td></tr>';

    try {
        // Fetch config to check Traefik? Maybe later.
        const res = await fetch('/api/lb/routes');
        if (!res.ok) throw new Error("Failed to fetch routes");
        const routes = await res.json();

        list.innerHTML = '';
        if (!routes || routes.length === 0) {
            list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 1rem; color: #64748b;">No load balancer routes defined.</td></tr>';
            document.getElementById('nav-lb-count').textContent = '0';
            return;
        }

        routes.forEach(r => {
            let target = '';
            if (r.target_type === 'container') {
                target = `<span style="color: #3b82f6;">Container:</span> ${r.container_name} <br><small class="text-muted">Port ${r.container_port}</small>`;
                if (r.host_id) target += ` <span class="badge badge-secondary">Host #${r.host_id}</span>`;
            } else {
                target = `<span style="color: #eab308;">Manual:</span> ${r.manual_ip}:${r.manual_port}`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600;">
                    <a href="http://${r.domain}" target="_blank" style="color: #3b82f6; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem;">
                        ${r.domain}
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </a>
                </td>
                <td>${target}</td>
                <td><span class="badge badge-info">${r.target_type}</span></td>
                <td>
                    <button class="btn btn-warning" onclick="deleteLBRoute(${r.id})" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Delete
                    </button>
                </td>
            `;
            list.appendChild(tr);
        });

        document.getElementById('nav-lb-count').textContent = routes.length;

    } catch (e) {
        list.innerHTML = `<tr><td colspan="4" style="color: #ef4444; text-align:center;">Error: ${e.message}</td></tr>`;
    }

    // Also load Traefik status
    loadTraefikStatus();
}

async function loadTraefikStatus() {
    const statusDiv = document.getElementById('traefik-status-info');
    if (!statusDiv) return;

    try {
        const res = await fetch('/api/lb/status');
        if (!res.ok) throw new Error('Failed to fetch status');
        const status = await res.json();

        if (status.running) {
            statusDiv.innerHTML = `
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 8px; padding: 1rem; margin-top: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></div>
                        <strong style="color: #10b981;">Traefik is Running</strong>
                    </div>
                    <div style="font-size: 0.875rem; color: #94a3b8;">
                        <div><strong>Location:</strong> ${status.host_name} (Host #${status.host_id})</div>
                        <div><strong>Container ID:</strong> ${status.container_id}</div>
                        <div><strong>Status:</strong> ${status.status}</div>
                        <div><strong>Ports:</strong> ${status.ports || 'N/A'}</div>
                    </div>
                </div>
            `;
        } else {
            statusDiv.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 8px; padding: 1rem; margin-top: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444;"></div>
                        <strong style="color: #ef4444;">Traefik is not running</strong>
                    </div>
                    <div style="font-size: 0.875rem; color: #94a3b8; margin-top: 0.5rem;">
                        Click "Start Traefik" to create and start the load balancer container.
                    </div>
                </div>
            `;
        }
    } catch (e) {
        statusDiv.innerHTML = `<div style="color: #ef4444; padding: 1rem;">Error loading status: ${e.message}</div>`;
    }
}

function showAddRouteModal() {
    document.getElementById('add-lb-route-modal').style.display = 'flex';
    loadLBHosts();
}

function closeLBModal() {
    document.getElementById('add-lb-route-modal').style.display = 'none';
}


async function loadLBHosts() {
    try {
        const res = await fetch('/api/hosts');
        const hosts = await res.json();
        const sel = document.getElementById('lb-host-select');
        sel.innerHTML = '';
        hosts.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.id;
            opt.textContent = h.name + " (" + h.uri + ")";
            sel.appendChild(opt);
        });

        // Trigger container load
        loadHostContainersForLB();
    } catch (e) { console.error(e); }
}

async function loadHostContainersForLB() {
    const hostId = document.getElementById('lb-host-select').value;
    const sel = document.getElementById('lb-container-select');
    sel.innerHTML = '<option>Loading...</option>';

    try {
        // Get host info first
        const hostsRes = await fetch('/api/hosts');
        const hosts = await hostsRes.json();
        const selectedHost = hosts.find(h => h.id == hostId);

        const res = await fetch(`/api/hosts/${hostId}/containers`);
        const containers = await res.json();
        sel.innerHTML = '';

        if (!containers || containers.length === 0) {
            sel.innerHTML = '<option value="">No containers found</option>';
            return;
        }

        containers.forEach(c => {
            const name = c.Names[0].replace('/', '');
            const opt = document.createElement('option');
            opt.value = name;

            let portsText = "";
            let portMappings = [];
            if (c.Ports) {
                c.Ports.forEach(p => {
                    portMappings.push({
                        private: p.PrivatePort,
                        public: p.PublicPort || p.PrivatePort
                    });
                });
                portsText = c.Ports.map(p => p.PublicPort || p.PrivatePort).join(',');
            }

            opt.textContent = `${name} (Ports: ${portsText || 'None'})`;
            opt.dataset.ports = JSON.stringify(portMappings);
            opt.dataset.hostUri = selectedHost ? selectedHost.uri : '';
            sel.appendChild(opt);
        });

        // Auto-select first port and trigger auto-fill
        if (sel.options.length > 0) {
            updatePortAndIP();
        }

    } catch (e) {
        sel.innerHTML = '<option>Error loading</option>';
        console.error(e);
    }
}

// Auto-fill container port when container is selected
function updatePortAndIP() {
    const containerSel = document.getElementById('lb-container-select');
    const selectedOpt = containerSel.options[containerSel.selectedIndex];

    if (!selectedOpt || !selectedOpt.dataset.ports) return;

    const portMappings = JSON.parse(selectedOpt.dataset.ports || '[]');

    // Auto-fill container port (private port)
    if (portMappings.length > 0) {
        document.getElementById('lb-container-port').value = portMappings[0].private;
    }
}

async function submitAddLBRoute() {
    const domain = document.getElementById('lb-domain').value;

    if (!domain) { showToast('Domain required', 'error'); return; }

    const data = {
        domain: domain,
        target_type: 'container'
    };

    data.host_id = parseInt(document.getElementById('lb-host-select').value);
    data.container_name = document.getElementById('lb-container-select').value;
    data.container_port = parseInt(document.getElementById('lb-container-port').value);

    if (!data.container_name || isNaN(data.container_port)) {
        showToast('Container details required', 'error');
        return;
    }

    // Button loading state?
    const btn = document.querySelector('#add-lb-route-modal .btn-primary');
    const oldText = btn.textContent;
    btn.textContent = 'Adding...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/lb/routes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showToast('Route added successfully');
            closeLBModal();
            loadLBRoutes();
            // Clear inputs
            document.getElementById('lb-domain').value = '';
        } else {
            const txt = await res.text();
            showToast('Error: ' + txt, 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    } finally {
        btn.textContent = oldText;
        btn.disabled = false;
    }
}

async function deleteLBRoute(id) {
    if (!confirm("Are you sure you want to delete this route?")) return;
    try {
        const res = await fetch(`/api/lb/routes/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadLBRoutes();
            showToast('Route deleted');
        } else {
            showToast('Failed to delete', 'error');
        }
    } catch (e) { showToast('Error', 'error'); }
}

async function setupTraefik() {
    showToast('Setting up Traefik Container...', 'info');
    try {
        const res = await fetch('/api/lb/setup', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            showToast(data.result || 'Traefik configured successfully');
        } else {
            showToast('Error: ' + (data.error || 'Failed'), 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Hook into existing switchTab
// We assume switchTab is global
if (typeof window.switchTab === 'function') {
    const originalSwitchTab = window.switchTab;
    window.switchTab = function (evt, tabId) {
        originalSwitchTab(evt, tabId);
        if (tabId === 'loadbalancer') {
            loadLBRoutes();
        }
    };
} else {
    // Fallback if switchTab not yet defined (script loading order)
    // Wait for it? Or redefine it?
    // Usually app.js is loaded before lb.js so it should be fine.
    // But let's add a window listener just in case.
    window.addEventListener('load', () => {
        const originalSwitchTab = window.switchTab;
        if (originalSwitchTab) {
            window.switchTab = function (evt, tabId) {
                originalSwitchTab(evt, tabId);
                if (tabId === 'loadbalancer') {
                    loadLBRoutes();
                }
            };
        }
    });
}
