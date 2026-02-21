// K0s Kubernetes Management
// ========================

async function fetchK0sClusters() {
    try {
        const response = await fetch(`${API_BASE}/k0s/clusters`);
        const clusters = await response.json();
        displayK0sClusters(clusters || []);
    } catch (error) {
        console.error('Failed to fetch k0s clusters:', error);
    }
}

function showLoadingModal(text = 'Loading...') {
    const modal = document.getElementById('loading-modal');
    if (modal) {
        document.getElementById('loading-text').textContent = text;
        modal.classList.add('active');
    }
}

function updateLoadingModal(text) {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) {
        loadingText.textContent = text;
    }
}

function hideLoadingModal() {
    const modal = document.getElementById('loading-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function displayK0sClusters(clusters) {
    const container = document.getElementById('k0s-clusters-container');
    if (!container) return;

    if (!clusters || clusters.length === 0) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; text-align: center; background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-lg);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 64px; height: 64px; margin-bottom: 1.5rem; color: var(--text-secondary); opacity: 0.6;">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                    <circle cx="8.5" cy="9.5" r="1.5" />
                    <circle cx="15.5" cy="9.5" r="1.5" />
                </svg>
                <h3 style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-size: 1.25rem;">No K0s Clusters Yet</h3>
                <p style="margin: 0 0 1.5rem 0; color: var(--text-secondary); font-size: 0.95rem; max-width: 400px;">Create your first Kubernetes cluster to get started with k0s management.</p>
                <button class="btn-primary" onclick="showCreateK0sModal()" style="background: var(--primary); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: var(--radius-md); cursor: pointer; font-weight: 500; font-size: 0.95rem;">
                    <span>+ Create Cluster</span>
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = clusters.map(cluster => `
        <div style="border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1rem; background: var(--card-bg); transition: all 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
                <div style="flex: 1;">
                    <h3 style="margin: 0 0 0.75rem 0; color: var(--text-primary); font-size: 1.1rem; font-weight: 600;">${cluster.name}</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                        <p style="margin: 0.25rem 0; font-size: 0.875rem; color: var(--text-secondary);">
                            <strong>IP:</strong> <span style="color: var(--text-primary); font-family: monospace;">${cluster.ip_address}</span>
                        </p>
                        <p style="margin: 0.25rem 0; font-size: 0.875rem; color: var(--text-secondary);">
                            <strong>Type:</strong> <span style="color: var(--text-primary);">${cluster.type}</span>
                        </p>
                        ${cluster.version ? `<p style="margin: 0.25rem 0; font-size: 0.875rem; color: var(--text-secondary);"><strong>Version:</strong> <span style="color: var(--text-primary);">${cluster.version}</span></p>` : ''}
                        <p style="margin: 0.25rem 0; font-size: 0.875rem; color: var(--text-secondary);">
                            <strong>Nodes:</strong> <span style="color: var(--text-primary);">${cluster.node_count}</span>
                        </p>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span style="padding: 0.5rem 1rem; border-radius: var(--radius-md); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; background: ${getStatusBackground(cluster.status)}; color: ${getStatusColor(cluster.status)};">
                        ${cluster.status}
                    </span>
                </div>
            </div>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button onclick="showK0sDetails('${cluster.id}')" style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: var(--radius-md); cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 0.2s;">
                    📋 Details
                </button>
                <button onclick="enterCluster('${cluster.id}', '${cluster.name}')" style="background: #22c55e; color: white; border: none; padding: 0.5rem 1rem; border-radius: var(--radius-md); cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 0.2s;">
                    🖥️ Masuk Cluster
                </button>
                <button onclick="downloadK0sKubeconfig('${cluster.id}', '${cluster.name}')" style="background: #8b5cf6; color: white; border: none; padding: 0.5rem 1rem; border-radius: var(--radius-md); cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 0.2s;">
                    📥 Kubeconfig
                </button>
                <button onclick="showAddWorkerModal('${cluster.id}', '${cluster.name}')" style="background: #f59e0b; color: white; border: none; padding: 0.5rem 1rem; border-radius: var(--radius-md); cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 0.2s;">
                    ➕ Add Worker
                </button>
                <button onclick="deleteK0sCluster('${cluster.id}', '${cluster.name}')" style="background: #dc2626; color: white; border: none; padding: 0.5rem 1rem; border-radius: var(--radius-md); cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 0.2s;">
                    🗑️ Delete
                </button>
            </div>
        </div>
    `).join('');
}

function showCreateK0sModal() {
    const content = `
        <form onsubmit="createK0sCluster(event)" style="display: flex; flex-direction: column; gap: 1.25rem;">
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label for="k0s-name" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">Cluster Name</label>
                <input type="text" id="k0s-name" required placeholder="e.g., k8s-prod" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.95rem; transition: all 0.2s;"/>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label for="k0s-ip" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">IP Address</label>
                <input type="text" id="k0s-ip" required placeholder="192.168.1.100 (untuk remote) atau 127.0.0.1 (lokal)" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.95rem; transition: all 0.2s;"/>
            </div>

            <div id="k0s-remote-fields" style="display: none; padding: 1rem; background: rgba(59, 130, 246, 0.05); border-radius: var(--radius-md); border: 1px solid rgba(59, 130, 246, 0.1);">
                <!-- Auth Method Selection -->
                <div style="display: flex; gap: 1rem; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(59, 130, 246, 0.2);">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500; color: var(--text-primary);">
                        <input type="radio" id="k0s-auth-password" name="k0s-auth-method" value="password" checked onchange="toggleK0sAuthMethod()"/>
                        🔐 Password
                    </label>
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500; color: var(--text-primary);">
                        <input type="radio" id="k0s-auth-key" name="k0s-auth-method" value="ssh-key" onchange="toggleK0sAuthMethod()"/>
                        🔑 SSH Key
                    </label>
                </div>

                <!-- Username (common for both) -->
                <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                    <label for="k0s-username" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">Username</label>
                    <input type="text" id="k0s-username" placeholder="ssh username (e.g., ubuntu, root)" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.95rem;"/>
                </div>

                <!-- Password Fields -->
                <div id="k0s-password-fields" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                    <label for="k0s-password" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">SSH Password</label>
                    <input type="password" id="k0s-password" placeholder="ssh password" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.95rem;"/>
                </div>

                <!-- SSH Key Fields -->
                <div id="k0s-sshkey-fields" style="display: none; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                    <label for="k0s-sshkey" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">SSH Private Key (OpenSSH format)</label>
                    <textarea id="k0s-sshkey" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----" rows="8" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.875rem; font-family: monospace; resize: vertical;"></textarea>
                    <p style="margin: 0; color: #f59e0b; font-size: 0.85rem;\">\u26a0\ufe0f Jangan share private key ke siapapun</p>
                </div>

                <div style="display: flex; gap: 0.5rem;">
                    <button type="button" id="test-connection-btn" style="flex: 1; background: #3b82f6; color: white; border: none; padding: 0.75rem 1.25rem; border-radius: var(--radius-md); cursor: pointer; font-weight: 500; transition: all 0.2s;">
                        🔗 Test Connection
                    </button>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label for="k0s-type" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">Cluster Type</label>
                <select id="k0s-type" style="width: 100%; padding: 0.75rem 2.5rem 0.75rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: rgba(255,255,255,0.08) url('data:image/svg+xml;charset=UTF-8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238892b0%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22></polyline></svg>') no-repeat right 0.75rem center / 1.25rem; color: var(--text-primary); font-size: 0.95rem; cursor: pointer; appearance: none; font-weight: 500; transition: all 0.3s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.1); user-select: none;">
                    <option value="controller" style="background: #1e293b; color: white; padding: 0.5rem; font-weight: 500;">✓ Controller (Control Plane + Worker)</option>
                </select>
            </div>

            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button type="submit" class="btn-primary" style="flex: 1; background: var(--primary, #3b82f6); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: var(--radius-md); cursor: pointer; font-weight: 500; font-size: 0.95rem; transition: all 0.2s;">Create Cluster</button>
                <button type="button" style="flex: 1; background: var(--secondary-bg, rgba(255,255,255,0.05)); color: var(--text-primary); border: 1px solid var(--border); padding: 0.75rem 1.5rem; border-radius: var(--radius-md); cursor: pointer; font-weight: 500; font-size: 0.95rem; transition: all 0.2s;" onclick="closeModal()">Cancel</button>
            </div>
        </form>
    `;

    showModal('Create K0s Cluster', content);
    initializeK0sForm();
}

function initializeK0sForm() {
    // Delayed initialization untuk memastikan DOM ready
    setTimeout(() => {
        const ipInput = document.getElementById('k0s-ip');
        const remoteFields = document.getElementById('k0s-remote-fields');
        const testBtn = document.getElementById('test-connection-btn');

        if (!ipInput || !remoteFields || !testBtn) {
            console.error('K0s form elements not found');
            return;
        }

        function updateRemoteFields() {
            const isLocal = ipInput.value === '127.0.0.1' || ipInput.value === 'localhost';
            remoteFields.style.display = isLocal ? 'none' : 'block';
            if (isLocal) {
                document.getElementById('k0s-username').value = '';
                document.getElementById('k0s-password').value = '';
                document.getElementById('k0s-sshkey').value = '';
            }
        }

        // Add event listeners
        ipInput.addEventListener('change', updateRemoteFields);
        ipInput.addEventListener('input', updateRemoteFields);
        ipInput.addEventListener('keyup', updateRemoteFields);
        ipInput.addEventListener('blur', updateRemoteFields);
        
        // Test Connection button
        testBtn.addEventListener('click', async () => {
            const ip = document.getElementById('k0s-ip').value;
            const username = document.getElementById('k0s-username').value;
            const authMethod = document.querySelector('input[name="k0s-auth-method"]:checked').value;
            const password = document.getElementById('k0s-password').value;
            const sshKey = document.getElementById('k0s-sshkey').value;

            if (!username) {
                alert('⚠️ Masukkan username');
                return;
            }

            if (authMethod === 'password' && !password) {
                alert('⚠️ Masukkan password');
                return;
            }

            if (authMethod === 'ssh-key' && !sshKey) {
                alert('⚠️ Masukkan SSH private key');
                return;
            }

            try {
                testBtn.disabled = true;
                testBtn.textContent = '🔗 Testing...';
                const response = await fetch(`${API_BASE}/k0s/test-connection`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip, username, password, sshKey, authMethod })
                });
                const result = await response.json();
                if (result.connected) {
                    alert('✓ Koneksi berhasil!');
                    testBtn.textContent = '🔗 Test Connection';
                    testBtn.style.background = '#22c55e';
                } else {
                    alert('✗ Koneksi gagal: ' + (result.error || 'Unknown error'));
                    testBtn.textContent = '🔗 Test Connection';
                    testBtn.style.background = '#3b82f6';
                }
            } catch (error) {
                alert('Error: ' + error.message);
                testBtn.textContent = '🔗 Test Connection';
                testBtn.style.background = '#3b82f6';
            } finally {
                testBtn.disabled = false;
            }
        });

        // Initial update
        updateRemoteFields();
    }, 50);
}

function toggleK0sAuthMethod() {
    setTimeout(() => {
        const passwordFields = document.getElementById('k0s-password-fields');
        const sshKeyFields = document.getElementById('k0s-sshkey-fields');
        const authMethod = document.querySelector('input[name="k0s-auth-method"]:checked').value;

        if (passwordFields && sshKeyFields) {
            if (authMethod === 'password') {
                passwordFields.style.display = 'flex';
                sshKeyFields.style.display = 'none';
            } else {
                passwordFields.style.display = 'none';
                sshKeyFields.style.display = 'flex';
            }
        }
    }, 10);
}

async function createK0sCluster(event) {
    event.preventDefault();

    const name = document.getElementById('k0s-name').value;
    const ip = document.getElementById('k0s-ip').value;
    const username = document.getElementById('k0s-username').value || '';
    const authMethod = document.querySelector('input[name="k0s-auth-method"]:checked').value;
    const password = document.getElementById('k0s-password').value || '';
    const sshKey = document.getElementById('k0s-sshkey').value || '';
    const type = document.getElementById('k0s-type').value;

    // Validation
    if (ip !== '127.0.0.1' && ip !== 'localhost') {
        if (!username) {
            alert('⚠️ Username diperlukan untuk koneksi remote');
            return;
        }
        if (authMethod === 'password' && !password) {
            alert('⚠️ Password diperlukan');
            return;
        }
        if (authMethod === 'ssh-key' && !sshKey) {
            alert('⚠️ SSH Private Key diperlukan');
            return;
        }
    }

    try {
        // Show loading modal
        showLoadingModal('Provisioning K0s cluster...');
        
        const response = await fetch(`${API_BASE}/k0s/clusters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                ip,
                username,
                password,
                sshKey,
                authMethod,
                type
            })
        });

        const result = await response.json();
        hideLoadingModal();
        
        if (result.success) {
            alert('✓ Cluster provisioning started! Silahkan tunggu beberapa menit.');
            closeModal();
            fetchK0sClusters();
            // Auto-refresh every 10 seconds
            setInterval(() => fetchK0sClusters(), 10000);
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        hideLoadingModal();
        alert('Error creating cluster: ' + error.message);
    }
}

async function showK0sDetails(clusterId) {
    try {
        const response = await fetch(`${API_BASE}/k0s/clusters/${clusterId}`);
        const cluster = await response.json();

        // Fetch nodes
        const nodesResponse = await fetch(`${API_BASE}/k0s/clusters/${clusterId}/nodes`);
        const nodes = await nodesResponse.json();

        const nodesHtml = nodes && nodes.length > 0 ? nodes.map(node => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); border: 1px solid var(--border); ${node.role === 'worker' ? 'border-color: rgba(245, 158, 11, 0.3);' : ''}">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                        <span style="font-weight: 600; color: var(--text-primary); font-family: monospace;">${node.ip_address}</span>
                        <span style="padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; background: ${node.role === 'controller' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; color: ${node.role === 'controller' ? '#3b82f6' : '#f59e0b'};">
                            ${node.role === 'controller' ? '🎛️ Controller' : '⚙️ Worker'}
                        </span>
                    </div>
                    ${node.hostname ? `<p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">${node.hostname}</p>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span style="padding: 0.35rem 0.75rem; border-radius: var(--radius-md); font-size: 0.75rem; font-weight: 600; background: ${node.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(156, 163, 175, 0.2)'}; color: ${node.status === 'active' ? '#22c55e' : '#9ca3af'};">
                        ${node.status}
                    </span>
                    ${node.role === 'worker' ? `<button onclick="deleteWorkerNode('${clusterId}', '${node.id}', '${node.ip_address}', '${node.hostname}')" style="background: #ef4444; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: var(--radius-md); cursor: pointer; font-size: 0.8rem; font-weight: 600; transition: all 0.2s;" title="Delete worker">🗑️ Delete</button>` : ''}
                </div>
            </div>
        `).join('') : '<p style="margin: 0; color: var(--text-secondary); text-align: center; padding: 1rem;">No nodes found</p>';

        const content = `
            <div style="display: flex; flex-direction: column; gap: 1.5rem; padding: 2rem;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 1.5rem; border-bottom: 2px solid var(--border);">
                    <div>
                        <h2 style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-size: 1.75rem;">${cluster.name}</h2>
                        <p style="margin: 0; color: var(--text-secondary);">Cluster Details</p>
                    </div>
                    <button onclick="hideK0sDetailsSection()" style="background: var(--secondary-bg, rgba(255,255,255,0.05)); color: var(--text-primary); border: 1px solid var(--border); padding: 0.5rem 1.5rem; border-radius: var(--radius-md); cursor: pointer; font-weight: 500; font-size: 0.95rem; transition: all 0.2s;">Close Section</button>
                </div>

                <!-- Info Grid -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 1.5rem;">
                    <div style="padding: 1rem; background: rgba(255,255,255,0.02); border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <p style="color: var(--text-secondary); font-size: 0.875rem; margin: 0; font-weight: 500;">Cluster Name</p>
                        <p style="color: var(--text-primary); font-weight: 600; margin: 0.5rem 0 0 0; font-size: 1.05rem;">${cluster.name}</p>
                    </div>
                    <div style="padding: 1rem; background: rgba(255,255,255,0.02); border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <p style="color: var(--text-secondary); font-size: 0.875rem; margin: 0; font-weight: 500;">Status</p>
                        <p style="color: var(--text-primary); font-weight: 600; margin: 0.5rem 0 0 0; display: inline-block; padding: 0.35rem 0.75rem; background: ${getStatusBackground(cluster.status)}; color: ${getStatusColor(cluster.status)}; border-radius: var(--radius-md); font-size: 0.875rem; text-transform: uppercase;">${cluster.status}</p>
                    </div>
                    <div style="padding: 1rem; background: rgba(255,255,255,0.02); border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <p style="color: var(--text-secondary); font-size: 0.875rem; margin: 0; font-weight: 500;">Controller IP</p>
                        <p style="color: var(--text-primary); font-weight: 600; margin: 0.5rem 0 0 0; font-family: monospace; font-size: 1.05rem;">${cluster.ip_address}</p>
                    </div>
                    <div style="padding: 1rem; background: rgba(255,255,255,0.02); border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <p style="color: var(--text-secondary); font-size: 0.875rem; margin: 0; font-weight: 500;">Cluster Type</p>
                        <p style="color: var(--text-primary); font-weight: 600; margin: 0.5rem 0 0 0; font-size: 1.05rem;">${cluster.type}</p>
                    </div>
                    <div style="padding: 1rem; background: rgba(255,255,255,0.02); border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <p style="color: var(--text-secondary); font-size: 0.875rem; margin: 0; font-weight: 500;">K0s Version</p>
                        <p style="color: var(--text-primary); font-weight: 600; margin: 0.5rem 0 0 0; font-size: 1.05rem;">${cluster.version || 'N/A'}</p>
                    </div>
                    <div style="padding: 1rem; background: rgba(255,255,255,0.02); border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <p style="color: var(--text-secondary); font-size: 0.875rem; margin: 0; font-weight: 500;">Total Nodes</p>
                        <p style="color: var(--text-primary); font-weight: 600; margin: 0.5rem 0 0 0; font-size: 1.05rem;">${cluster.node_count}</p>
                    </div>
                    <div style="padding: 1rem; background: rgba(255,255,255,0.02); border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <p style="color: var(--text-secondary); font-size: 0.875rem; margin: 0; font-weight: 500;">Created</p>
                        <p style="color: var(--text-primary); font-weight: 600; margin: 0.5rem 0 0 0; font-size: 0.95rem;">${new Date(cluster.created_at).toLocaleString()}</p>
                    </div>
                </div>

                <!-- Cluster Nodes Section -->
                <div style="padding: 1.5rem; background: rgba(255,255,255,0.02); border-radius: var(--radius-md); border: 1px solid var(--border);">
                    <h3 style="margin: 0 0 1rem 0; color: var(--text-primary); font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                        <span>🖥️</span> Cluster Nodes (${nodes ? nodes.length : 0})
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        ${nodesHtml}
                    </div>
                </div>
            </div>
        `;

        // Display in section
        const detailsContainer = document.getElementById('k0s-details-section');
        if (detailsContainer) {
            detailsContainer.innerHTML = content;
            detailsContainer.style.display = 'block';
            // Scroll to details section
            detailsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (error) {
        alert('Error fetching cluster details: ' + error.message);
    }
}

function hideK0sDetailsSection() {
    const detailsContainer = document.getElementById('k0s-details-section');
    if (detailsContainer) {
        detailsContainer.style.display = 'none';
        detailsContainer.innerHTML = '';
    }
}

function showK0sDeploymentModal(clusterId) {
    const content = `
        <form onsubmit="deployOnK0s(event, '${clusterId}')" style="display: flex; flex-direction: column; gap: 1.25rem;">
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label for="deploy-name" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">Deployment Name</label>
                <input type="text" id="deploy-name" required placeholder="my-app" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.95rem;"/>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label for="deploy-image" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">Docker Image</label>
                <input type="text" id="deploy-image" required placeholder="nginx:latest" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.95rem;"/>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <label for="deploy-replicas" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">Replicas</label>
                    <input type="number" id="deploy-replicas" min="1" value="1" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.95rem;"/>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <label for="deploy-port" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">Service Port</label>
                    <input type="number" id="deploy-port" value="80" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.95rem;"/>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label for="deploy-container-port" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">Container Port</label>
                <input type="number" id="deploy-container-port" value="8080" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.95rem;"/>
            </div>

            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button type="submit" style="flex: 1; background: var(--primary, #22c55e); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: var(--radius-md); cursor: pointer; font-weight: 500; font-size: 0.95rem; transition: all 0.2s;">Deploy</button>
                <button type="button" style="flex: 1; background: var(--secondary-bg, rgba(255,255,255,0.05)); color: var(--text-primary); border: 1px solid var(--border); padding: 0.75rem 1.5rem; border-radius: var(--radius-md); cursor: pointer; font-weight: 500; font-size: 0.95rem;" onclick="closeModal()">Cancel</button>
            </div>
        </form>
    `;

    showModal('Deploy on K0s', content);
}

async function deployOnK0s(event, clusterId) {
    event.preventDefault();

    const data = {
        cluster_id: parseInt(clusterId),
        name: document.getElementById('deploy-name').value,
        image: document.getElementById('deploy-image').value,
        replicas: parseInt(document.getElementById('deploy-replicas').value),
        port: parseInt(document.getElementById('deploy-port').value),
        container_port: parseInt(document.getElementById('deploy-container-port').value)
    };

    try {
        const response = await fetch(`${API_BASE}/k0s/deploy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.success) {
            alert('✓ Deployment created successfully!\n\nYou can now access your application at http://<cluster-ip>:' + data.port);
            closeModal();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        alert('Error deploying: ' + error.message);
    }
}

function enterCluster(clusterId, clusterName) {
    window.location.href = `cluster-admin.html?id=${clusterId}&name=${encodeURIComponent(clusterName)}`;
}

async function downloadK0sKubeconfig(clusterId, clusterName) {
    try {
        // First check if kubeconfig is available
        const statusResponse = await fetch(`${API_BASE}/k0s/clusters/${clusterId}/kubeconfig-status`);
        const statusData = await statusResponse.json();
        
        console.log('Kubeconfig status:', statusData);
        
        if (!statusData.kubeconfig_available) {
            alert(`⚠️ Kubeconfig sedang disiapkan untuk cluster "${clusterName}"\n\nStatus: ${statusData.status}\n\nSilahkan coba lagi dalam beberapa saat.`);
            return;
        }

        // Now download the kubeconfig
        const response = await fetch(`${API_BASE}/k0s/clusters/${clusterId}/kubeconfig`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kubeconfig-${clusterName}.yaml`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Show success message
        alert(`✓ Kubeconfig berhasil didownload!\n\nFile: kubeconfig-${clusterName}.yaml\n\nGunakan dengan: kubectl --kubeconfig=kubeconfig-${clusterName}.yaml get pods`);
    } catch (error) {
        console.error('Kubeconfig error:', error);
        alert('⚠️ Error downloading kubeconfig: ' + error.message + '\n\nCluster mungkin masih initializing. Silahkan tunggu beberapa saat.');
    }
}

async function deleteK0sCluster(clusterId, clusterName) {
    const confirmDelete = confirm(`⚠️ WARNING - Delete Cluster\n\n` +
        `Cluster: ${clusterName}\n\n` +
        `This action will:\n` +
        `  • Stop k0s services\n` +
        `  • Remove k0s binaries\n` +
        `  • Delete all config & data\n` +
        `  • Remove from database\n\n` +
        `This is PERMANENT and CANNOT be undone!\n\n` +
        `Are you absolutely sure?`
    );
    
    if (!confirmDelete) {
        return;
    }

    try {
        showLoadingModal(`Destroying cluster "${clusterName}"...\n\nRemoving k0s and cleaning up...`);
        
        const response = await fetch(`${API_BASE}/k0s/clusters/${clusterId}`, {
            method: 'DELETE'
        });

        let result;
        try {
            result = await response.json();
        } catch (e) {
            console.error('Failed to parse response:', e, 'Status:', response.status);
            result = {error: 'Invalid response from server'};
        }
        
        // Wait a bit for backend to complete cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        hideLoadingModal();
        
        if (response.ok && result.status === 'deleted') {
            alert(`✓ Cluster "${clusterName}" berhasil dihapus!\n\nK0s telah diremove dari server.\nAnda sekarang bisa create cluster baru.`);
            fetchK0sClusters();
        } else if (result.error) {
            alert(`⚠️ Error deleting cluster:\n\n${result.error}`);
            fetchK0sClusters();
        } else {
            alert(`⚠️ Error deleting cluster. Status: ${response.status}`);
            fetchK0sClusters();
        }
    } catch (error) {
        hideLoadingModal();
        console.error('Delete cluster error:', error);
        alert('⚠️ Error: ' + error.message);
    }
}

function getStatusClass(status) {
    const classes = {
        'running': 'bg-green-100 text-green-800',
        'provisioning': 'bg-yellow-100 text-yellow-800',
        'stopped': 'bg-gray-100 text-gray-800',
        'failed': 'bg-red-100 text-red-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
}

function getStatusBackground(status) {
    const backgrounds = {
        'running': 'rgba(34, 197, 94, 0.15)',
        'provisioning': 'rgba(250, 204, 21, 0.15)',
        'stopped': 'rgba(107, 114, 128, 0.15)',
        'failed': 'rgba(220, 38, 38, 0.15)',
        'imported': 'rgba(99, 102, 241, 0.15)'
    };
    return backgrounds[status] || 'rgba(107, 114, 128, 0.15)';
}

function getStatusColor(status) {
    const colors = {
        'running': '#22c55e',
        'provisioning': '#f59e0b',
        'stopped': '#6b7280',
        'failed': '#dc2626',
        'imported': '#6366f1'
    };
    return colors[status] || '#6b7280';
}

// Add worker/node to existing cluster
function showAddWorkerModal(clusterId, clusterName) {
    const content = `
        <form onsubmit="addWorkerNode(event, '${clusterId}')" style="display: flex; flex-direction: column; gap: 1.25rem;">
            <div style="padding: 1rem; background: rgba(245, 158, 11, 0.1); border-radius: var(--radius-md); border: 1px solid rgba(245, 158, 11, 0.3); margin-bottom: 0.5rem;">
                <p style="margin: 0; color: var(--text-primary); font-size: 0.95rem;">
                    <strong>🔧 Adding worker to:</strong> ${clusterName}
                </p>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label for="worker-ip" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">Worker Node IP Address</label>
                <input type="text" id="worker-ip" required placeholder="192.168.1.101" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.95rem; transition: all 0.2s;"/>
            </div>

            <div style="padding: 1rem; background: rgba(59, 130, 246, 0.05); border-radius: var(--radius-md); border: 1px solid rgba(59, 130, 246, 0.1);">
                <!-- Auth Method Selection -->
                <div style="display: flex; gap: 1rem; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(59, 130, 246, 0.2);">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500; color: var(--text-primary);">
                        <input type="radio" id="worker-auth-password" name="worker-auth-method" value="password" checked onchange="toggleWorkerAuthMethod()"/>
                        🔐 Password
                    </label>
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500; color: var(--text-primary);">
                        <input type="radio" id="worker-auth-key" name="worker-auth-method" value="ssh-key" onchange="toggleWorkerAuthMethod()"/>
                        🔑 SSH Key
                    </label>
                </div>

                <!-- Username -->
                <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                    <label for="worker-username" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">Username</label>
                    <input type="text" id="worker-username" required placeholder="ssh username (e.g., ubuntu, root)" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.95rem;"/>
                </div>

                <!-- Password Fields -->
                <div id="worker-password-fields" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                    <label for="worker-password" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">SSH Password</label>
                    <input type="password" id="worker-password" placeholder="ssh password" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.95rem;"/>
                </div>

                <!-- SSH Key Fields -->
                <div id="worker-sshkey-fields" style="display: none; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                    <label for="worker-sshkey" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">SSH Private Key (OpenSSH format)</label>
                    <textarea id="worker-sshkey" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----" rows="8" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.875rem; font-family: monospace; resize: vertical;"></textarea>
                    <p style="margin: 0; color: #f59e0b; font-size: 0.85rem;">⚠️ Pastikan private key dalam format OpenSSH</p>
                </div>

                <div style="display: flex; gap: 0.5rem;">
                    <button type="button" id="test-worker-connection-btn" style="flex: 1; background: #3b82f6; color: white; border: none; padding: 0.75rem 1.25rem; border-radius: var(--radius-md); cursor: pointer; font-weight: 500; transition: all 0.2s;">
                        🔗 Test Connection
                    </button>
                </div>
            </div>

            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button type="submit" class="btn-primary" style="flex: 1; background: #f59e0b; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: var(--radius-md); cursor: pointer; font-weight: 500; font-size: 0.95rem; transition: all 0.2s;">Add Worker Node</button>
                <button type="button" style="flex: 1; background: var(--secondary-bg, rgba(255,255,255,0.05)); color: var(--text-primary); border: 1px solid var(--border); padding: 0.75rem 1.5rem; border-radius: var(--radius-md); cursor: pointer; font-weight: 500; font-size: 0.95rem; transition: all 0.2s;" onclick="closeModal()">Cancel</button>
            </div>
        </form>
    `;

    showModal('Add Worker Node', content);
    
    // Initialize test connection button
    setTimeout(() => {
        const testBtn = document.getElementById('test-worker-connection-btn');
        if (testBtn) {
            testBtn.addEventListener('click', async () => {
                const ip = document.getElementById('worker-ip').value;
                const username = document.getElementById('worker-username').value;
                const authMethod = document.querySelector('input[name="worker-auth-method"]:checked').value;
                const password = document.getElementById('worker-password').value;
                const sshKey = document.getElementById('worker-sshkey').value;

                if (!ip) {
                    alert('⚠️ Masukkan IP address');
                    return;
                }

                if (!username) {
                    alert('⚠️ Masukkan username');
                    return;
                }

                if (authMethod === 'password' && !password) {
                    alert('⚠️ Masukkan password');
                    return;
                }

                if (authMethod === 'ssh-key' && !sshKey) {
                    alert('⚠️ Masukkan SSH private key');
                    return;
                }

                try {
                    testBtn.disabled = true;
                    testBtn.textContent = '🔗 Testing...';
                    const response = await fetch(`${API_BASE}/k0s/test-connection`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ip, username, password, sshKey, authMethod })
                    });
                    const result = await response.json();
                    if (result.connected) {
                        alert('✓ Koneksi berhasil!');
                        testBtn.textContent = '🔗 Test Connection';
                        testBtn.style.background = '#22c55e';
                    } else {
                        alert('✗ Koneksi gagal: ' + (result.error || 'Unknown error'));
                        testBtn.textContent = '🔗 Test Connection';
                        testBtn.style.background = '#3b82f6';
                    }
                } catch (error) {
                    alert('Error: ' + error.message);
                    testBtn.textContent = '🔗 Test Connection';
                    testBtn.style.background = '#3b82f6';
                } finally {
                    testBtn.disabled = false;
                }
            });
        }
    }, 50);
}

function toggleWorkerAuthMethod() {
    setTimeout(() => {
        const passwordFields = document.getElementById('worker-password-fields');
        const sshKeyFields = document.getElementById('worker-sshkey-fields');
        const authMethod = document.querySelector('input[name="worker-auth-method"]:checked').value;

        if (passwordFields && sshKeyFields) {
            if (authMethod === 'password') {
                passwordFields.style.display = 'flex';
                sshKeyFields.style.display = 'none';
            } else {
                passwordFields.style.display = 'none';
                sshKeyFields.style.display = 'flex';
            }
        }
    }, 10);
}

async function addWorkerNode(event, clusterId) {
    event.preventDefault();

    const ip = document.getElementById('worker-ip').value;
    const username = document.getElementById('worker-username').value;
    const authMethod = document.querySelector('input[name="worker-auth-method"]:checked').value;
    const password = document.getElementById('worker-password').value || '';
    const sshKey = document.getElementById('worker-sshkey').value || '';

    // Validation
    if (!username) {
        alert('⚠️ Username diperlukan');
        return;
    }
    if (authMethod === 'password' && !password) {
        alert('⚠️ Password diperlukan');
        return;
    }
    if (authMethod === 'ssh-key' && !sshKey) {
        alert('⚠️ SSH Private Key diperlukan');
        return;
    }

    try {
        showLoadingModal('Adding worker node to cluster... (this may take 2-5 minutes)');
        
        const response = await fetch(`${API_BASE}/k0s/clusters/${clusterId}/workers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ip,
                username,
                password,
                sshKey,
                authMethod
            })
        });

        const result = await response.json();
        
        if (result.success) {
            alert('✓ Worker addition started! Waiting for node to join cluster (2-5 minutes)...');
            closeModal();
            
            // Poll to check when worker is actually added
            let retries = 0;
            const maxRetries = 120; // 2 minutes max wait (120 * 1 second)
            let workerFound = false;
            
            const checkWorkerAdded = async () => {
                try {
                    const nodesRes = await fetch(`${API_BASE}/k0s/clusters/${clusterId}/nodes`);
                    const nodes = await nodesRes.json();
                    const clusterRes = await fetch(`${API_BASE}/k0s/clusters/${clusterId}`);
                    const cluster = await clusterRes.json();
                    
                    // Check if new worker appears in list (matching IP)
                    const workerExists = nodes && nodes.some(n => n.ip_address === ip && n.role === 'worker');
                    
                    if (workerExists) {
                        workerFound = true;
                        hideLoadingModal();
                        fetchK0sClusters();
                        showK0sDetails(clusterId);
                        alert(`✓ Worker ${ip} successfully added to cluster!`);
                        return;
                    }
                    
                    retries++;
                    if (retries < maxRetries) {
                        // Update modal with retry count
                        updateLoadingModal(`Adding worker node to cluster... (${retries}s elapsed, checking...)`);
                        setTimeout(checkWorkerAdded, 1000);
                    } else {
                        hideLoadingModal();
                        fetchK0sClusters();
                        showK0sDetails(clusterId);
                        alert('⚠️ Worker addition timeout. Please check if worker is in cluster manually.');
                    }
                } catch (error) {
                    console.error('Error checking worker status:', error);
                    retries++;
                    if (retries < maxRetries) {
                        setTimeout(checkWorkerAdded, 1000);
                    } else {
                        hideLoadingModal();
                        fetchK0sClusters();
                        showK0sDetails(clusterId);
                    }
                }
            };
            
            // Start checking after 3 seconds to give backend time to start
            setTimeout(checkWorkerAdded, 3000);
        } else {
            hideLoadingModal();
            alert('Error: ' + result.message);
        }
    } catch (error) {
        hideLoadingModal();
        alert('Error adding worker node: ' + error.message);
    }
}

// Import existing cluster via kubeconfig
function showImportK0sModal() {
    const content = `
        <form onsubmit="importK0sCluster(event)" style="display: flex; flex-direction: column; gap: 1.25rem;">
            <div style="padding: 1rem; background: rgba(99, 102, 241, 0.1); border-radius: var(--radius-md); border: 1px solid rgba(99, 102, 241, 0.2);">
                <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5;">
                    📋 Import an existing Kubernetes cluster by providing its kubeconfig file. This allows you to manage external clusters without provisioning k0s.
                </p>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label for="import-name" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">Cluster Name</label>
                <input type="text" id="import-name" required placeholder="e.g., production-k8s" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.95rem; transition: all 0.2s;"/>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label for="import-kubeconfig" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">Kubeconfig Content</label>
                <textarea id="import-kubeconfig" required placeholder="Paste your kubeconfig YAML content here..." rows="10" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-primary); font-size: 0.875rem; font-family: monospace; resize: vertical; line-height: 1.5;"></textarea>
                <p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">
                    💡 Get kubeconfig from: <code style="background: rgba(255,255,255,0.05); padding: 0.2rem 0.4rem; border-radius: 0.25rem;">kubectl config view --raw</code>
                </p>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label for="import-type" style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">Cluster Type</label>
                <select id="import-type" style="width: 100%; padding: 0.75rem 2.5rem 0.75rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: rgba(255,255,255,0.08) url('data:image/svg+xml;charset=UTF-8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238892b0%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22></polyline></svg>') no-repeat right 0.75rem center / 1.25rem; color: var(--text-primary); font-size: 0.95rem; cursor: pointer; appearance: none;">
                    <option value="external" style="background: #1e293b; color: white; padding: 0.5rem;">External Cluster</option>
                    <option value="controller" style="background: #1e293b; color: white; padding: 0.5rem;">K0s Controller</option>
                </select>
            </div>

            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button type="submit" class="btn-primary" style="flex: 1; background: #6366f1; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: var(--radius-md); cursor: pointer; font-weight: 500; font-size: 0.95rem; transition: all 0.2s;">✓ Import Cluster</button>
                <button type="button" style="flex: 1; background: var(--secondary-bg, rgba(255,255,255,0.05)); color: var(--text-primary); border: 1px solid var(--border); padding: 0.75rem 1.5rem; border-radius: var(--radius-md); cursor: pointer; font-weight: 500; font-size: 0.95rem; transition: all 0.2s;" onclick="closeModal()">Cancel</button>
            </div>
        </form>
    `;

    showModal('Import Existing Cluster', content);
}

async function importK0sCluster(event) {
    event.preventDefault();

    const name = document.getElementById('import-name').value;
    const kubeconfig = document.getElementById('import-kubeconfig').value;
    const type = document.getElementById('import-type').value;

    try {
        const response = await fetch(`${API_BASE}/k0s/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                kubeconfig,
                type
            })
        });

        const result = await response.json();
        if (result.success) {
            alert('✓ Cluster imported successfully!');
            closeModal();
            fetchK0sClusters();
        } else {
            alert('Error: ' + (result.message || 'Failed to import cluster'));
        }
    } catch (error) {
        alert('Error importing cluster: ' + error.message);
    }
}

async function deleteWorkerNode(clusterId, nodeId, nodeIP, nodeName) {
    if (!confirm(`Delete worker ${nodeName} (${nodeIP})?\n\nThis will:\n1. Remove node from k0s cluster\n2. Stop k0s service on worker\n3. Delete the node record\n\nContinue?`)) {
        return;
    }

    try {
        showLoadingModal('Deleting worker node...');
        
        const response = await fetch(`${API_BASE}/k0s/clusters/${clusterId}/workers/${nodeId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: nodeIP })
        });

        const result = await response.json();
        
        if (result.success) {
            alert('✓ Worker node deletion started! Refreshing cluster details...');
            
            // Wait longer for backend to process (background goroutine)
            // Then poll until node is actually deleted
            let retries = 0;
            const maxRetries = 30; // 30 seconds max wait
            let nodeDeleted = false;
            
            const checkNodeDeleted = async () => {
                try {
                    const clusterRes = await fetch(`${API_BASE}/k0s/clusters/${clusterId}`);
                    const nodesRes = await fetch(`${API_BASE}/k0s/clusters/${clusterId}/nodes`);
                    const nodes = await nodesRes.json();
                    
                    // Check if node still exists
                    const nodeExists = nodes && nodes.some(n => n.id == nodeId);
                    
                    if (!nodeExists) {
                        nodeDeleted = true;
                        hideLoadingModal();
                        fetchK0sClusters();
                        showK0sDetails(clusterId);
                        alert('✓ Worker node deleted successfully!');
                        return;
                    }
                    
                    retries++;
                    if (retries < maxRetries) {
                        // Keep polling every 1 second
                        setTimeout(checkNodeDeleted, 1000);
                    } else {
                        hideLoadingModal();
                        fetchK0sClusters();
                        showK0sDetails(clusterId);
                        alert('✓ Deletion completed. Cluster refreshed.');
                    }
                } catch (error) {
                    console.error('Error checking delete status:', error);
                    retries++;
                    if (retries < maxRetries) {
                        setTimeout(checkNodeDeleted, 1000);
                    } else {
                        hideLoadingModal();
                        fetchK0sClusters();
                        showK0sDetails(clusterId);
                    }
                }
            };
            
            // Start checking after 2 seconds to give backend time to start
            setTimeout(checkNodeDeleted, 2000);
        } else {
            hideLoadingModal();
            alert('Error: ' + (result.message || 'Failed to delete worker'));
        }
    } catch (error) {
        hideLoadingModal();
        alert('Error deleting worker: ' + error.message);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('k0s-clusters-container')) {
        fetchK0sClusters();
    }
});
