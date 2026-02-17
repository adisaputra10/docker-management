// ========================================
// CRUD OPERATIONS - VOLUMES, NETWORKS, IMAGES, CONTAINERS
// ========================================

// ===================
// MODAL MANAGEMENT
// ===================

function showModal(title, content) {
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    overlay.classList.add('active');
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
}

// ===================
// VOLUMES
// ===================

async function refreshVolumes() {
    const volumesList = document.getElementById('volumes-list');
    if (!volumesList) return;
    volumesList.innerHTML = '<div class="loading">Loading volumes...</div>';

    try {
        const response = await fetch(`${API_BASE}/volumes`);
        const volumes = await response.json();

        // Update stats
        const statEl = document.querySelector('#totalVolumes .stat-value');
        if (statEl) statEl.textContent = volumes.length || 0;

        if (volumes.length === 0) {
            volumesList.innerHTML = '<div class="empty-state">No volumes found</div>';
            return;
        }

        volumesList.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Driver</th>
                        <th>Mountpoint</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${volumes.map(vol => `
                        <tr>
                            <td><strong>${vol.name}</strong></td>
                            <td>${vol.driver}</td>
                            <td><code>${vol.mountpoint}</code></td>
                            <td>${vol.created || 'N/A'}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="inspectVolume('${vol.name}')">Inspect</button>
                                <button class="btn btn-sm btn-danger" onclick="removeVolume('${vol.name}')">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        volumesList.innerHTML = '<div class="error">Failed to load volumes</div>';
        showToast('Error loading volumes', 'error');
    }
}

function showCreateVolumeModal() {
    const content = `
        <div class="form-group">
            <label for="volume-name">Volume Name*</label>
            <input type="text" id="volume-name" placeholder="my-volume" required>
            <small>Unique name for the volume</small>
        </div>
        <div class="form-group">
            <label for="volume-driver">Driver</label>
            <select id="volume-driver">
                <option value="local">local</option>
            </select>
            <small>Volume driver (local is default)</small>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-success" onclick="createVolume()">Create Volume</button>
        </div>
    `;
    showModal('Create Volume', content);
}

async function createVolume() {
    const name = document.getElementById('volume-name').value;
    const driver = document.getElementById('volume-driver').value;

    if (!name) {
        showToast('Please enter a volume name', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/volumes/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, driver })
        });

        if (response.ok) {
            showToast('Volume created successfully', 'success');
            closeModal();
            refreshVolumes();
        } else {
            const error = await response.text();
            showToast(`Failed to create volume: ${error}`, 'error');
        }
    } catch (error) {
        showToast('Error creating volume', 'error');
    }
}

async function removeVolume(name) {
    if (!confirm(`Are you sure you want to remove volume "${name}"?`)) return;

    try {
        const response = await fetch(`${API_BASE}/volumes/${name}/remove`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Volume removed successfully', 'success');
            refreshVolumes();
        } else {
            const error = await response.text();
            showToast(`Failed to remove volume: ${error}`, 'error');
        }
    } catch (error) {
        showToast('Error removing volume', 'error');
    }
}

async function inspectVolume(name) {
    try {
        const response = await fetch(`${API_BASE}/volumes/${name}/inspect`);
        const data = await response.json();

        const content = `
            <div class="inspect-json">
                <pre>${JSON.stringify(data, null, 2)}</pre>
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="closeModal()">Close</button>
            </div>
        `;
        showModal(`Inspect Volume: ${name}`, content);
    } catch (error) {
        showToast('Error loading volume details', 'error');
    }
}

async function pruneVolumes() {
    if (!confirm('Remove all unused volumes? This cannot be undone.')) return;

    try {
        const response = await fetch(`${API_BASE}/volumes/prune`, {
            method: 'POST'
        });

        const data = await response.json();
        showToast(`Pruned volumes. Space reclaimed: ${formatBytes(data.spaceReclaimed || 0)}`, 'success');
        refreshVolumes();
    } catch (error) {
        showToast('Error pruning volumes', 'error');
    }
}

// ===================
// NETWORKS
// ===================

async function refreshNetworks() {
    const networksList = document.getElementById('networks-list');
    if (!networksList) return;
    networksList.innerHTML = '<div class="loading">Loading networks...</div>';

    try {
        const response = await fetch(`${API_BASE}/networks`);
        const networks = await response.json();

        // Update stats
        const statEl = document.querySelector('#totalNetworks .stat-value');
        if (statEl) statEl.textContent = networks.length || 0;

        if (networks.length === 0) {
            networksList.innerHTML = '<div class="empty-state">No networks found</div>';
            return;
        }

        networksList.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>ID</th>
                        <th>Driver</th>
                        <th>Scope</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${networks.map(net => `
                        <tr>
                            <td><strong>${net.name}</strong></td>
                            <td><code>${net.id}</code></td>
                            <td>${net.driver}</td>
                            <td>${net.scope}</td>
                            <td>${net.created}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="inspectNetwork('${net.id}')">Inspect</button>
                                ${!['bridge', 'host', 'none'].includes(net.name) ?
                `<button class="btn btn-sm btn-danger" onclick="removeNetwork('${net.id}', '${net.name}')">Delete</button>` :
                '<span class="badge badge-secondary">System</span>'
            }
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        networksList.innerHTML = '<div class="error">Failed to load networks</div>';
        showToast('Error loading networks', 'error');
    }
}

function showCreateNetworkModal() {
    const content = `
        <div class="form-group">
            <label for="network-name">Network Name*</label>
            <input type="text" id="network-name" placeholder="my-network" required>
        </div>
        <div class="form-group">
            <label for="network-driver">Driver</label>
            <select id="network-driver">
                <option value="bridge">bridge</option>
                <option value="overlay">overlay</option>
                <option value="macvlan">macvlan</option>
            </select>
        </div>
        <div class="form-group">
            <label for="network-subnet">Subnet (optional)</label>
            <input type="text" id="network-subnet" placeholder="172.20.0.0/16">
            <small>CIDR format, e.g., 172.20.0.0/16</small>
        </div>
        <div class="form-group">
            <label for="network-gateway">Gateway (optional)</label>
            <input type="text" id="network-gateway" placeholder="172.20.0.1">
            <small>Gateway IP address</small>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-success" onclick="createNetwork()">Create Network</button>
        </div>
    `;
    showModal('Create Network', content);
}

async function createNetwork() {
    const name = document.getElementById('network-name').value;
    const driver = document.getElementById('network-driver').value;
    const subnet = document.getElementById('network-subnet').value;
    const gateway = document.getElementById('network-gateway').value;

    if (!name) {
        showToast('Please enter a network name', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/networks/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, driver, subnet, gateway })
        });

        if (response.ok) {
            showToast('Network created successfully', 'success');
            closeModal();
            refreshNetworks();
        } else {
            const error = await response.text();
            showToast(`Failed to create network: ${error}`, 'error');
        }
    } catch (error) {
        showToast('Error creating network', 'error');
    }
}

async function removeNetwork(id, name) {
    if (!confirm(`Are you sure you want to remove network "${name}"?`)) return;

    try {
        const response = await fetch(`${API_BASE}/networks/${id}/remove`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Network removed successfully', 'success');
            refreshNetworks();
        } else {
            const error = await response.text();
            showToast(`Failed to remove network: ${error}`, 'error');
        }
    } catch (error) {
        showToast('Error removing network', 'error');
    }
}

async function inspectNetwork(id) {
    try {
        const response = await fetch(`${API_BASE}/networks/${id}/inspect`);
        const data = await response.json();

        const content = `
            <div class="inspect-json">
                <pre>${JSON.stringify(data, null, 2)}</pre>
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="closeModal()">Close</button>
            </div>
        `;
        showModal(`Inspect Network: ${data.Name}`, content);
    } catch (error) {
        showToast('Error loading network details', 'error');
    }
}

async function pruneNetworks() {
    if (!confirm('Remove all unused networks? This cannot be undone.')) return;

    try {
        const response = await fetch(`${API_BASE}/networks/prune`, {
            method: 'POST'
        });

        const data = await response.json();
        showToast(`Pruned ${(data.networksDeleted || []).length} networks`, 'success');
        refreshNetworks();
    } catch (error) {
        showToast('Error pruning networks', 'error');
    }
}

// ===================
// IMAGES
// ===================

function showPullImageModal() {
    const content = `
        <div class="form-group">
            <label for="image-name">Image Name*</label>
            <input type="text" id="image-name" placeholder="nginx:latest" required>
            <small>Format: image:tag (e.g., nginx:latest, mysql:8.0)</small>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-success" onclick="pullImage()">Pull Image</button>
        </div>
    `;
    showModal('Pull Docker Image', content);
}

async function pullImage() {
    const image = document.getElementById('image-name').value;

    if (!image) {
        showToast('Please enter an image name', 'error');
        return;
    }

    showToast('Pulling image... This may take a while', 'info');
    closeModal();

    try {
        const response = await fetch(`${API_BASE}/images/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image })
        });

        if (response.ok) {
            showToast(`Image ${image} pulled successfully`, 'success');
            refreshImages();
        } else {
            const error = await response.text();
            showToast(`Failed to pull image: ${error}`, 'error');
        }
    } catch (error) {
        showToast('Error pulling image', 'error');
    }
}

async function removeImage(id, name) {
    if (!confirm(`Are you sure you want to remove image "${name}"?`)) return;

    try {
        const response = await fetch(`${API_BASE}/images/${id}/remove?force=true`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Image removed successfully', 'success');
            refreshImages();
        } else {
            const error = await response.text();
            showToast(`Failed to remove image: ${error}`, 'error');
        }
    } catch (error) {
        showToast('Error removing image', 'error');
    }
}

async function inspectImage(id) {
    try {
        const response = await fetch(`${API_BASE}/images/${id}/inspect`);
        const data = await response.json();

        const content = `
            <div class="inspect-json">
                <pre>${JSON.stringify(data, null, 2)}</pre>
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="closeModal()">Close</button>
            </div>
        `;
        showModal(`Inspect Image`, content);
    } catch (error) {
        showToast('Error loading image details', 'error');
    }
}

async function pruneImages() {
    if (!confirm('Remove all unused images? This cannot be undone.')) return;

    try {
        const response = await fetch(`${API_BASE}/images/prune`, {
            method: 'POST'
        });

        const data = await response.json();
        showToast(`Pruned images. Space reclaimed: ${formatBytes(data.spaceReclaimed || 0)}`, 'success');
        refreshImages();
    } catch (error) {
        showToast('Error pruning images', 'error');
    }
}

// ===================
// CONTAINERS
// ===================

async function showCreateContainerModal() {
    showModal('Create Container (New)', '<div class="loading">Loading details...</div>');

    try {
        // Fetch networks and volumes in parallel
        const [networksRes, volumesRes] = await Promise.all([
            fetch(`${API_BASE}/networks`),
            fetch(`${API_BASE}/volumes`)
        ]);

        const networks = await networksRes.json();
        const volumes = await volumesRes.json();

        // Generate options
        const networkOptions = networks.map(n =>
            `<option value="${n.name}">${n.name} (${n.driver})</option>`
        ).join('');

        const volumeOptions = volumes.map(v =>
            `<option value="${v.name}">${v.name}</option>`
        ).join('');

        const content = `
            <div class="form-group">
                <label for="container-name">Container Name*</label>
                <input type="text" id="container-name" placeholder="my-container" required>
            </div>
            <div class="form-group">
                <label for="container-image">Image*</label>
                <input type="text" id="container-image" placeholder="nginx:latest" required>
                <small>Image name with tag (e.g., nginx:latest)</small>
            </div>
            
            <div class="form-row" style="display: flex; gap: 1rem;">
                <div class="form-group" style="flex: 1;">
                    <label for="container-network">Network</label>
                    <select id="container-network">
                        <option value="bridge">bridge (default)</option>
                        <option value="host">host</option>
                        <option value="none">none</option>
                        ${networkOptions}
                    </select>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label for="container-restart">Restart Policy</label>
                    <select id="container-restart">
                        <option value="no">No</option>
                        <option value="always">Always</option>
                        <option value="unless-stopped">Unless Stopped</option>
                        <option value="on-failure">On Failure</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label for="container-ports">Ports (optional)</label>
                <input type="text" id="container-ports" placeholder="8080:80, 8443:443">
                <small>Format: hostPort:containerPort</small>
            </div>

            <div class="form-group">
                <label>Mount Volume (Optional)</label>
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <select id="container-volume-select" style="flex: 1;">
                        <option value="">-- Select Volume --</option>
                        ${volumeOptions}
                    </select>
                    <input type="text" id="container-volume-path" placeholder="/data" style="flex: 1;">
                </div>
                <small>Select an existing volume and map it to a container path</small>
            </div>

            <div class="form-group">
                <label for="container-env">Environment Variables (optional)</label>
                <textarea id="container-env" rows="3" placeholder="KEY=value&#10;ANOTHER_KEY=value"></textarea>
                <small>One per line, format: KEY=value</small>
            </div>
            
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-success" onclick="createContainer()">Create Container</button>
            </div>
        `;
        showModal('Create Container', content);

    } catch (error) {
        console.error('Error loading networks/volumes:', error);
        showToast(`Error: ${error.message || 'Failed to load networks/volumes'}`, 'error');
        closeModal();
    }
}

async function createContainer() {
    const name = document.getElementById('container-name').value;
    const image = document.getElementById('container-image').value;
    const portsStr = document.getElementById('container-ports').value;
    const envStr = document.getElementById('container-env').value;
    const restartPolicy = document.getElementById('container-restart').value;
    const networkMode = document.getElementById('container-network').value;

    // Volume logic
    const selectedVolume = document.getElementById('container-volume-select').value;
    const volumePath = document.getElementById('container-volume-path').value;
    let volumes = [];
    if (selectedVolume && volumePath) {
        volumes.push(`${selectedVolume}:${volumePath}`);
    }

    if (!name || !image) {
        showToast('Please enter container name and image', 'error');
        return;
    }

    // Parse ports
    const ports = portsStr ? portsStr.split(',').map(p => p.trim()).filter(p => p) : [];

    // Parse environment variables
    const env = envStr ? envStr.split('\n').map(e => e.trim()).filter(e => e) : [];

    showToast('Creating container...', 'info');
    closeModal(); // Close immediately to indicate action started

    try {
        const response = await fetch(`${API_BASE}/containers/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                image,
                ports,
                env,
                volumes,
                restartPolicy,
                networkMode
            })
        });

        if (response.ok) {
            showToast('Container created successfully', 'success');
            setTimeout(refreshContainers, 1000);
        } else {
            const error = await response.text();
            showToast(`Failed to create container: ${error}`, 'error');
        }
    } catch (error) {
        showToast('Error creating container', 'error');
    }
}

async function inspectContainer(id) {
    try {
        const response = await fetch(`${API_BASE}/containers/${id}/inspect`);
        const data = await response.json();

        const content = `
            <div class="inspect-json">
                <pre>${JSON.stringify(data, null, 2)}</pre>
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="closeModal()">Close</button>
            </div>
        `;
        showModal(`Inspect Container: ${data.Name}`, content);
    } catch (error) {
        showToast('Error loading container details', 'error');
    }
}

async function pruneContainers() {
    if (!confirm('Remove all stopped containers? This cannot be undone.')) return;

    try {
        const response = await fetch(`${API_BASE}/containers/prune`, {
            method: 'POST'
        });

        const data = await response.json();
        showToast(`Pruned containers. Space reclaimed: ${formatBytes(data.spaceReclaimed || 0)}`, 'success');
        refreshContainers();
    } catch (error) {
        showToast('Error pruning containers', 'error');
    }
}

// ===================
// UTILITIES
// ===================

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Update loadTabData to include new tabs
// We hook into window.loadTabData if it exists (from app.js)
// But crud.js loads BEFORE app.js.
// So we cannot "hook" originalLoadTabData because it doesn't exist yet.
// Instead, app.js should call specific refresh functions.
// app.js loadTabData switch(tabName) already calls refreshContainers, refreshImages...
// app.js defines refreshContainers etc ?
// Step 1340: APP.JS contains refreshContainers, refreshImages!
// So I duplicated them in crud.js?
// No, Step 1340 app.js contains them.
// So crud.js should NOT contain refreshContainers?
// Step 1374 crud.js had refreshVolumes, refreshNetworks.
// app.js had refreshContainers, refreshImages.
// Separation of concerns:
// app.js: Containers, Images, Logs, System.
// crud.js: Volumes, Networks (and now I added Images/Containers CREATE/ACTIONS).
// BUT I also added refreshImages in crud.js above?
// If I have refreshImages in BOTH, the second one loaded wins.
// app.js loads AFTER crud.js. So app.js wins.
// So my refreshImages in crud.js is ignored.
// That is fine.
// But createContainer calls refreshContainers.
// If app.js wins, createContainer calls app.js's refreshContainers.
// Which is fine.

// So:
// crud.js adds functionality (Create/Inspect/Prune).
// app.js provides Dashboard Refresh logic.
// This works.
