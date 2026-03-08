
// Helper for admin actions (Users and Projects)

// Helper for admin actions (Users and Projects)

// --- Users ---

async function loadUsers() {
    const list = document.getElementById('users-list');
    if (!list) {
        console.error('users-list element not found');
        return;
    }
    list.innerHTML = '<div class="loading">Loading users...</div>';

    try {
        const res = await fetch(`${API_BASE}/users`);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const users = await res.json();

        if (!users || users.length === 0) {
            list.innerHTML = '<div class="empty-state">No users found</div>';
            return;
        }

        const roleIcons = {
            'admin': '👑 Admin',
            'user_docker': '🐳 Docker Full',
            'user_docker_basic': '🐳 Docker Basic',
            'user_k8s_full': '☸️ K8s Full',
            'user_k8s_view': '👁️ K8s View',
            'user_cicd_full': '🚀 CI/CD Full',
            'user_cicd_view': '👁️ CI/CD View'
        };

        function roleBadges(roleStr) {
            return (roleStr || '').split(',').map(r => r.trim()).filter(Boolean).map(r =>
                `<span class="card-status ${r === 'admin' ? 'running' : 'stopped'}" style="width:fit-content;font-size:0.72rem;padding:0.15rem 0.5rem; margin-bottom: 0.25rem;">${roleIcons[r] || r}</span>`
            ).join('');
        }

        // Use cards-grid for consistency
        list.className = 'cards-grid';
        list.innerHTML = users.map(u => `
            <div class="card user-card">
                <div class="card-header">
                    <div class="card-title">${u.username}</div>
                    <div class="card-status running">Active</div>
                </div>
                <div class="card-body" style="flex: 1; display: flex; flex-direction: column;">
                    <div class="detail-label" style="margin-top: 0.5rem;">Permissions / Roles</div>
                    <div style="display:flex;flex-wrap:wrap;gap:0.35rem; margin-bottom: 1rem;">
                        ${roleBadges(u.role) || '<span style="color:#64748b; font-size:0.8rem;">No roles assigned</span>'}
                    </div>
                    <div class="detail-label">Member Since</div>
                    <div class="detail-value" style="margin-bottom: 1.5rem;">${new Date(u.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
                <div class="card-actions" style="margin-top: auto; display: flex; gap: 0.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05);">
                    <button class="btn btn-sm btn-primary" style="flex: 1;" onclick="showEditUserModal('${u.id}', '${u.username}', '${u.role}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}', '${u.username}')">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Error loading users:', e);
        list.innerHTML = `<div class="error">Error: ${e.message}</div>`;
    }
}

function _roleCheckboxes(selectedRoles) {
    const allRoles = [
        { value: 'admin', label: '👑 Admin' },
        { value: 'user_docker', label: '🐳 Docker Full' },
        { value: 'user_docker_basic', label: '🐳 Docker Basic' },
        { value: 'user_k8s_full', label: '☸️ K8s Full' },
        { value: 'user_k8s_view', label: '👁️ K8s View' },
        { value: 'user_cicd_full', label: '🚀 CI/CD Full' },
        { value: 'user_cicd_view', label: '👁️ CI/CD View' },
    ];
    return `<div id="role-checkboxes" style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:0.75rem;">
        ${allRoles.map(r => `
        <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;padding:0.3rem;border-radius:4px;color:#e2e8f0;font-size:0.85rem;">
            <input type="checkbox" value="${r.value}" ${selectedRoles.includes(r.value) ? 'checked' : ''} style="cursor:pointer;accent-color:#6366f1;width:14px;height:14px;">
            ${r.label}
        </label>`).join('')}
    </div>`;
}

function _getCheckedRoles() {
    return Array.from(document.querySelectorAll('#role-checkboxes input[type=checkbox]:checked')).map(cb => cb.value);
}

function showEditUserModal(id, username, role) {
    const currentRoles = (role || '').split(',').map(r => r.trim()).filter(Boolean);
    showModal(`Edit User: ${username}`, `
        <input type="hidden" id="edit-user-id" value="${id}">
        <div class="form-group">
            <label>Username</label>
            <input type="text" id="edit-username" class="form-input" value="${username}" required>
        </div>
        <div class="form-group">
            <label>Roles <small style="color:#64748b">(select one or more)</small></label>
            ${_roleCheckboxes(currentRoles)}
        </div>
        <div class="form-group">
            <label>New Password <small style="color:#666">(leave blank to keep current)</small></label>
            <input type="password" id="edit-password" class="form-input" placeholder="New Password">
        </div>
        <button class="btn btn-success" style="width: 100%;" onclick="submitEditUser()">Save Changes</button>
    `);
}

async function submitEditUser() {
    const id = document.getElementById('edit-user-id').value;
    const username = document.getElementById('edit-username').value;
    const roles = _getCheckedRoles();
    const password = document.getElementById('edit-password').value;

    if (roles.length === 0) {
        showToast('Please select at least one role', 'error');
        return;
    }

    const payload = { username, roles };
    if (password) {
        payload.password = password;
    }

    try {
        const res = await fetch(`${API_BASE}/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeModal();
            loadUsers();
            showToast('User updated successfully', 'success');
        } else {
            showToast('Failed to update user', 'error');
        }
    } catch (e) {
        showToast('Error updating user', 'error');
    }
}

async function deleteUser(id, username) {
    if (!confirm(`Delete user "${username}"?`)) return;
    try {
        await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
        loadUsers();
        showToast('User deleted', 'success');
    } catch (e) {
        showToast('Failed to delete user', 'error');
    }
}

function showCreateUserModal() {
    showModal('Create New User', `
        <div class="form-group">
            <label>Username</label>
            <input type="text" id="new-username" class="form-input" required>
        </div>
        <div class="form-group">
            <label>Password</label>
            <input type="password" id="new-password" class="form-input" required>
        </div>
        <div class="form-group">
            <label>Roles <small style="color:#64748b">(select one or more)</small></label>
            ${_roleCheckboxes([])}
        </div>
        <button class="btn btn-success" style="width: 100%;" onclick="submitCreateUser()">Create User</button>
    `);
}

async function submitCreateUser() {
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const roles = _getCheckedRoles();

    if (!username || !password) {
        showToast('Username and password required', 'error');
        return;
    }
    if (roles.length === 0) {
        showToast('Please select at least one role', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, roles })
        });

        if (res.ok) {
            closeModal();
            loadUsers();
            showToast('User created successfully', 'success');
        } else {
            showToast('Failed to create user', 'error');
        }
    } catch (e) {
        showToast('Error creating user', 'error');
    }
}

// --- Projects ---

async function loadProjects() {
    const list = document.getElementById('projects-list');
    if (!list) return;
    list.innerHTML = '<div class="loading">Loading projects...</div>';

    try {
        const res = await fetch(`${API_BASE}/projects`);
        if (!res.ok) throw new Error('Failed to fetch projects');
        const projects = (await res.json()) || [];

        if (!projects || projects.length === 0) {
            list.innerHTML = '<div class="empty-state">No projects found</div>';
            return;
        }

        list.innerHTML = projects.map(p => `
            <div class="card project-card">
                <div class="card-header">
                    <div class="card-title">${p.name}</div>
                    <div class="card-status running">Active</div>
                </div>
                <div class="card-body" style="flex: 1;">
                    <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.5rem;">${p.description || 'No description provided for this project.'}</p>
                </div>
                <div class="card-actions" style="margin-top: auto; display: flex; gap: 0.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05);">
                    <button class="btn btn-primary" style="flex: 1;" onclick="manageProject('${p.id}')">Manage</button>
                    <button class="btn btn-danger" onclick="deleteProject('${p.id}', '${p.name}')">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = `<div class="error">Error: ${e.message}</div>`;
    }
}

function showCreateProjectModal() {
    showModal('Create Project', `
        <div class="form-group">
            <label>Project Name</label>
            <input type="text" id="proj-name" class="form-input">
        </div>
        <div class="form-group">
            <label>Description</label>
            <input type="text" id="proj-desc" class="form-input">
        </div>
        <button class="btn btn-success" style="width: 100%;" onclick="submitCreateProject()">Create</button>
    `);
}

async function submitCreateProject() {
    const name = document.getElementById('proj-name').value;
    const description = document.getElementById('proj-desc').value;

    await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
    });
    closeModal();
    loadProjects();
    showToast('Project created', 'success');
}

async function deleteProject(id, name) {
    if (!confirm(`Delete project "${name}"?`)) return;
    await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
    loadProjects();
    showToast('Project deleted', 'success');
}

function closeProjectManage() {
    document.getElementById('projects-view-list').style.display = 'block';
    document.getElementById('projects-view-manage').style.display = 'none';
}

async function manageProject(id) {
    // If we're on index.html (not admin.html), redirect to admin.html
    const projectsViewList = document.getElementById('projects-view-list');
    if (!projectsViewList) {
        window.location.href = '/admin.html';
        return;
    }
    projectsViewList.style.display = 'none';
    const manageView = document.getElementById('projects-view-manage');
    if (!manageView) return;
    manageView.style.display = 'block';
    const content = document.getElementById('manage-project-content');
    if (!content) return;
    content.innerHTML = '<div class="loading">Loading details...</div>';

    try {
        const res = await fetch(`${API_BASE}/projects/${id}`);
        if (!res.ok) throw new Error('Failed to load project');
        const data = await res.json();

        const titleEl = document.getElementById('manage-project-title');
        if (titleEl) {
            titleEl.textContent = `Manage: ${data.project.name}`;
        }

        const usersList = (data.users || []).map(u => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span style="font-weight: 500;">${u.username}</span>
                <button class="btn btn-sm btn-danger" onclick="unassignUser('${id}', '${u.id}', '${u.username}')">Remove</button>
            </div>
        `).join('');

        const resourcesList = (data.resources || []).map(r => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span style="font-family: monospace; color: #e2e8f0;">
                    <span style="color: #94a3b8; font-size: 0.85rem;">[${r.host_name || '?'}]</span> ${r.name}
                </span>
                <button class="btn btn-sm btn-danger" onclick="unassignResource('${id}', '${r.host_id}', '${r.name}')">Remove</button>
            </div>
        `).join('');

        content.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <!-- Users Column -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;">Assigned Users</h3>
                        <button class="btn btn-sm btn-primary" onclick="showAssignUserModal('${id}')">+ Assign User</button>
                    </div>
                    <div style="background: rgba(0,0,0,0.2); border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.05);">
                        ${usersList || '<div style="padding: 1rem; color: #94a3b8;">No users assigned</div>'}
                    </div>
                </div>

                <!-- Resources Column -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;">Assigned Containers</h3>
                        <button class="btn btn-sm btn-primary" onclick="showAssignResourceModal('${id}')">+ Assign Container</button>
                    </div>
                    <div style="background: rgba(0,0,0,0.2); border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.05);">
                        ${resourcesList || '<div style="padding: 1rem; color: #94a3b8;">No containers assigned</div>'}
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        content.innerHTML = `<div class="error">Error: ${e.message}</div>`;
    }
}

async function unassignUser(projectId, userId, username) {
    if (!confirm(`Remove user "${username}" from project?`)) return;
    try {
        await fetch(`${API_BASE}/projects/unassign_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: parseInt(projectId), user_id: parseInt(userId) })
        });
        manageProject(projectId);
        showToast('User removed', 'success');
    } catch (e) {
        showToast('Failed to remove user', 'error');
    }
}

async function unassignResource(projectId, hostId, resourceIdentifier) {
    if (!confirm(`Remove container "${resourceIdentifier}" from project?`)) return;
    try {
        await fetch(`${API_BASE}/projects/unassign_resource`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: parseInt(projectId),
                host_id: parseInt(hostId),
                resource_identifier: resourceIdentifier
            })
        });
        manageProject(projectId);
        showToast('Resource removed', 'success');
    } catch (e) {
        showToast('Failed to remove resource', 'error');
    }
}

async function showAssignUserModal(projectId) {
    const res = await fetch(`${API_BASE}/users`);
    const users = await res.json();
    const options = users.map(u => `<option value="${u.id}">${u.username}</option>`).join('');

    showModal('Assign User', `
        <div class="form-group">
            <label>Select User</label>
            <select id="assign-user-select" class="form-input">${options}</select>
        </div>
        <button class="btn btn-success" style="width: 100%;" onclick="submitAssignUser('${projectId}')">Assign</button>
    `);
}

async function submitAssignUser(projectId) {
    const userId = document.getElementById('assign-user-select').value;
    await fetch(`${API_BASE}/projects/assign_user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: parseInt(projectId), user_id: parseInt(userId) })
    });
    closeModal();
    manageProject(projectId);
    showToast('User assigned', 'success');
}

async function showAssignResourceModal(projectId) {
    const list = document.getElementById('manage-project-content');
    const originalContent = list.innerHTML;
    // Show temporary loading in modal if needed, or just wait. 
    // Since showModal replaces content, we just prepare data first.

    try {
        // 1. Fetch Hosts
        const hostsRes = await fetch(`${API_BASE}/hosts`);
        const hosts = await hostsRes.json();

        // 2. Fetch Containers from ALL hosts
        const containerPromises = hosts.map(async host => {
            try {
                // Must explicitly set Authorization if needed, but browser handles cookies/storage?
                // app.js interceptor adds token if we use window.fetch.
                // We need to override X-Docker-Host-ID.
                // The interceptor checks options.headers.
                const res = await fetch(`${API_BASE}/containers`, {
                    headers: { 'X-Docker-Host-ID': String(host.id) }
                });
                if (res.ok) {
                    const containers = await res.json();
                    return containers.map(c => ({
                        ...c,
                        _hostId: host.id,
                        _hostName: host.name
                    }));
                }
            } catch (e) {
                console.error(`Failed to fetch containers from host ${host.name}`, e);
            }
            return [];
        });

        const results = await Promise.all(containerPromises);
        const allContainers = results.flat();

        const options = allContainers.map(c => {
            let name = c.name || (c.names && c.names[0]) || (c.Names && c.Names[0]) || c.id.substring(0, 12);
            name = name.replace(/^\//, '');
            // Value format: hostId:containerName
            return `<option value="${c._hostId}:${name}">[${c._hostName}] ${name}</option>`;
        }).join('');

        showModal('Assign Container', `
            <div class="form-group">
                <label>Select Container</label>
                <select id="assign-resource-select" class="form-input">${options}</select>
            </div>
            <div class="form-group">
                 <small style="color: #94a3b8;">Showing containers from all ${hosts.length} connected hosts.</small>
            </div>
            <button class="btn btn-success" style="width: 100%;" onclick="submitAssignResource('${projectId}')">Assign</button>
        `);
    } catch (e) {
        showToast('Error loading container lists', 'error');
    }
}

async function submitAssignResource(projectId) {
    const selectedValue = document.getElementById('assign-resource-select').value;

    let hostId = localStorage.getItem('activeHostId') || '1';
    let resourceId = selectedValue;

    // Parse hostId:resourceId
    const parts = selectedValue.split(':');
    if (parts.length >= 2) {
        hostId = parts[0];
        resourceId = parts.slice(1).join(':');
    }

    await fetch(`${API_BASE}/projects/assign_resource`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            project_id: parseInt(projectId),
            host_id: parseInt(hostId),
            resource_identifier: resourceId
        })
    });
    closeModal();
    manageProject(projectId);
    showToast('Resource assigned', 'success');
}

async function loadSSOSettings() {
    try {
        const res = await fetch(`${API_BASE}/settings/sso`);
        if (!res.ok) throw new Error('Failed to load settings');
        const s = await res.json();

        document.getElementById('standard-login-enabled').checked = s.standard_login_enabled;


        document.getElementById('sso-gitlab-enabled').checked = s.gitlab_enabled;
        document.getElementById('sso-gitlab-client-id').value = s.gitlab_client_id || '';
        document.getElementById('sso-gitlab-client-secret').value = s.gitlab_client_secret || '';
        document.getElementById('sso-gitlab-redirect-uri').value = s.gitlab_redirect_uri || '';

        document.getElementById('sso-entra-enabled').checked = s.entra_enabled;
        document.getElementById('sso-entra-tenant-id').value = s.entra_tenant_id || '';
        document.getElementById('sso-entra-client-id').value = s.entra_client_id || '';
        document.getElementById('sso-entra-client-secret').value = s.entra_client_secret || '';
        document.getElementById('sso-entra-redirect-uri').value = s.entra_redirect_uri || '';

        document.getElementById('sso-oidc-enabled').checked = s.oidc_enabled;
        document.getElementById('sso-oidc-display-name').value = s.oidc_display_name || '';
        document.getElementById('sso-oidc-issuer').value = s.oidc_issuer || '';
        document.getElementById('sso-oidc-client-id').value = s.oidc_client_id || '';
        document.getElementById('sso-oidc-client-secret').value = s.oidc_client_secret || '';
        document.getElementById('sso-oidc-redirect-uri').value = s.oidc_redirect_uri || '';
        document.getElementById('sso-oidc-default-role').value = s.oidc_default_role || 'user_docker_basic';
        document.getElementById('sso-oidc-scopes').value = s.oidc_scopes || 'openid profile email';
    } catch (e) {
        // Assume first run, no settings. Silent fail or log.
        console.warn('SSO settings load error', e);
    }
}

async function saveSSOSettings() {
    const data = {
        standard_login_enabled: document.getElementById('standard-login-enabled').checked,
        gitlab_enabled: document.getElementById('sso-gitlab-enabled').checked,
        gitlab_client_id: document.getElementById('sso-gitlab-client-id').value,
        gitlab_client_secret: document.getElementById('sso-gitlab-client-secret').value,
        gitlab_redirect_uri: document.getElementById('sso-gitlab-redirect-uri').value,

        entra_enabled: document.getElementById('sso-entra-enabled').checked,
        entra_tenant_id: document.getElementById('sso-entra-tenant-id').value,
        entra_client_id: document.getElementById('sso-entra-client-id').value,
        entra_client_secret: document.getElementById('sso-entra-client-secret').value,
        entra_redirect_uri: document.getElementById('sso-entra-redirect-uri').value,

        oidc_enabled: document.getElementById('sso-oidc-enabled').checked,
        oidc_display_name: document.getElementById('sso-oidc-display-name').value,
        oidc_issuer: document.getElementById('sso-oidc-issuer').value,
        oidc_client_id: document.getElementById('sso-oidc-client-id').value,
        oidc_client_secret: document.getElementById('sso-oidc-client-secret').value,
        oidc_redirect_uri: document.getElementById('sso-oidc-redirect-uri').value,
        oidc_default_role: document.getElementById('sso-oidc-default-role').value,
        oidc_scopes: document.getElementById('sso-oidc-scopes').value
    };

    try {
        const res = await fetch(`${API_BASE}/settings/sso`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            showToast('SSO settings saved', 'success');
        } else {
            throw new Error('Failed to save');
        }
    } catch (e) {
        showToast('Error saving settings', 'error');
    }
}

// --- User Namespace Assignment ---
async function showNsAssignModal(userId, username) {
    // Fetch list of clusters
    let clusters = [];
    try {
        const res = await fetch(`${API_BASE}/k0s/clusters`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        if (res.ok) {
            const data = await res.json();
            clusters = data.clusters || data.items || [];
        }
    } catch (e) {
        console.error('Failed to fetch clusters:', e);
    }

    if (clusters.length === 0) {
        showToast('No K0s clusters available', 'warning');
        return;
    }

    let clusterOptions = clusters.map(c =>
        `<option value="${c.id}">${c.name}</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-box" style="max-width: 500px;">
            <div class="modal-header">
                <div class="modal-title">🔐 Assign Namespaces — ${username}</div>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 1rem;">
                    <label style="font-size:0.85rem;color:#94a3b8;display:block;margin-bottom:0.35rem">Cluster</label>
                    <select id="ns-cluster-select" onchange="loadClusterNamespaces()" style="width:100%;padding:0.5rem;background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;border-radius:8px;font-size:0.85rem;cursor:pointer;">
                        <option value="">-- Select a cluster --</option>
                        ${clusterOptions}
                    </select>
                </div>
                <div style="margin-bottom:1rem;">
                    <label style="font-size:0.85rem;color:#94a3b8;display:block;margin-bottom:0.35rem">Namespaces (multi-select)</label>
                    <div id="ns-list-container" style="background:#0f1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:0.75rem;min-height:120px;max-height:250px;overflow-y:auto;">
                        <div style="color:#64748b;font-size:0.8rem;">Select a cluster first</div>
                    </div>
                </div>
                <div style="display:flex;gap:0.5rem;">
                    <button class="btn btn-primary" onclick="saveUserNamespaces('${userId}', '${username}')" style="flex:1;">✓ Save</button>
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="flex:1;">✕ Cancel</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('open');
}

async function loadClusterNamespaces() {
    const clusterId = document.getElementById('ns-cluster-select').value;
    if (!clusterId) {
        document.getElementById('ns-list-container').innerHTML = '<div style="color:#64748b;font-size:0.8rem;">Select a cluster first</div>';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/k0s/clusters/${clusterId}/k8s/namespaces`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        const data = await res.json();
        const namespaces = data.items || [];

        let html = namespaces.map(ns => `
            <label style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem;cursor:pointer;border-radius:4px;margin-bottom:0.3rem;transition:background 0.2s;color:#e2e8f0;">
                <input type="checkbox" class="ns-checkbox" value="${ns.metadata.name}" style="cursor:pointer;">
                <span>${ns.metadata.name}</span>
            </label>
        `).join('');

        document.getElementById('ns-list-container').innerHTML = html || '<div style="color:#64748b">No namespaces found</div>';
    } catch (e) {
        document.getElementById('ns-list-container').innerHTML = `<div style="color:#f87171">Error: ${e.message}</div>`;
    }
}

async function saveUserNamespaces(userId, username) {
    const clusterId = document.getElementById('ns-cluster-select').value;
    if (!clusterId) {
        showToast('Please select a cluster', 'warning');
        return;
    }

    const selected = Array.from(document.querySelectorAll('.ns-checkbox:checked')).map(cb => cb.value);

    try {
        const res = await fetch(`${API_BASE}/users/${userId}/namespaces`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cluster_id: parseInt(clusterId),
                namespaces: selected
            })
        });

        if (res.ok) {
            showToast(`✓ Namespaces assigned to ${username}`, 'success');
            document.querySelector('.modal-overlay').remove();
        } else {
            throw new Error('Failed to assign namespaces');
        }
    } catch (e) {
        showToast(`Error: ${e.message}`, 'error');
    }
}

// Convert a kubectl audit log entry into the equivalent kubectl CLI command.
// Parses "method=GET path=/api/v1/namespaces/test/pods" from the details field.
function auditToKubectlCommand(log) {
    if (log.action !== 'kubectl') return '';

    const details = log.details || '';
    const methodM = details.match(/method=([A-Z]+)/);
    const pathM   = details.match(/path=([^\s]+)/);
    if (!methodM || !pathM) return '';

    const method = methodM[1];
    const path   = pathM[1].split('?')[0]; // strip query string

    if (/^\/(api\/?)?(\?|$)|(^\/apis\/?)($|\?)/.test(path)) return '';
    if (path === '/version' || path === '/version/') return 'kubectl version';
    if (path === '/healthz') return '';

    const methodVerbs = { GET: 'get', DELETE: 'delete', POST: 'create', PUT: 'replace', PATCH: 'patch' };
    const shortNames  = {
        pods: 'pod', services: 'svc', deployments: 'deploy', replicasets: 'rs',
        statefulsets: 'sts', daemonsets: 'ds', configmaps: 'cm', namespaces: 'ns',
        nodes: 'node', persistentvolumes: 'pv', persistentvolumeclaims: 'pvc',
        ingresses: 'ing', serviceaccounts: 'sa', jobs: 'job', cronjobs: 'cronjob',
        events: 'events', secrets: 'secret', endpoints: 'ep',
        clusterroles: 'clusterrole', clusterrolebindings: 'clusterrolebinding',
        roles: 'role', rolebindings: 'rolebinding',
        horizontalpodautoscalers: 'hpa', networkpolicies: 'netpol',
        resourcequotas: 'quota', limitranges: 'limitrange',
        replicationcontrollers: 'rc', podtemplates: 'podtemplate',
    };

    const verb = methodVerbs[method] || method.toLowerCase();
    let ns = '', resource = '', name = '', subresource = '';

    // Namespaced: /api/v1/namespaces/{ns}/{res}[/{name}[/{sub}]]
    //          or /apis/{g}/{v}/namespaces/{ns}/{res}[/{name}[/{sub}]]
    let m = path.match(/^\/apis?\/[^/]+\/[^/]+\/namespaces\/([^/]+)\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?/)
             || path.match(/^\/api\/v[^/]+\/namespaces\/([^/]+)\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?/);
    if (m) {
        [, ns, resource, name = '', subresource = ''] = m;
    } else {
        // Cluster-scoped: /api/v1/{res}[/{name}] or /apis/{g}/{v}/{res}[/{name}]
        const cm = path.match(/^\/api\/v[^/]+\/([^/]+)(?:\/([^/]+))?/)
                || path.match(/^\/apis\/[^/]+\/[^/]+\/([^/]+)(?:\/([^/]+))?/);
        if (!cm) return '';
        [, resource, name = ''] = cm;
    }

    // Handle sub-resources
    if (subresource === 'log')                    return `kubectl logs ${name}${ns ? ' -n ' + ns : ''}`;
    if (subresource === 'exec')                   return `kubectl exec ${name}${ns ? ' -n ' + ns : ''} -- <cmd>`;
    if (subresource === 'portforward')            return `kubectl port-forward ${name}${ns ? ' -n ' + ns : ''} <port>`;
    if (subresource === 'attach')                 return `kubectl attach ${name}${ns ? ' -n ' + ns : ''}`;
    if (subresource === 'scale')                  return `kubectl scale ${shortNames[resource]||resource} ${name}${ns ? ' -n ' + ns : ''} --replicas=<n>`;

    const res = shortNames[resource] || resource;
    let cmd = `kubectl ${verb} ${res}`;
    if (name) cmd += ` ${name}`;
    if (ns)   cmd += ` -n ${ns}`;
    return cmd;
}

// --- Audit Log ---

let _auditLogData = [];
let _auditPage = 1;
let _auditPageSize = 50;

// Extract "user" from the details string e.g. "user=alice cmd=whoami".
function auditExtractUser(log) {
    const d = log.details || '';
    const m = d.match(/(?:^|\s)user=([^\s]+)/);
    return m ? m[1] : '—';
}

async function loadAuditLogs() {
    const tbody = document.getElementById('audit-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="padding:1rem; color:#64748b; text-align:center;">Loading…</td></tr>';
    try {
        const res = await fetch(`${API_BASE}/logs`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const logs = await res.json();
        _auditLogData = logs || [];
        _auditPage = 1;
        _populateAuditUserFilter();
        _applyAuditFilters();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding:1rem; color:#f87171; text-align:center;">Error: ${e.message}</td></tr>`;
    }
}

function _populateAuditUserFilter() {
    const sel = document.getElementById('audit-user-filter');
    if (!sel) return;
    const current = sel.value;
    const users = [...new Set(_auditLogData.map(l => auditExtractUser(l)).filter(u => u !== '—'))].sort();
    sel.innerHTML = '<option value="">All users</option>' +
        users.map(u => `<option value="${escHtml(u)}"${u===current?' selected':''}>${escHtml(u)}</option>`).join('');
}

function auditSetPageSize() {
    const sel = document.getElementById('audit-page-size');
    _auditPageSize = parseInt(sel?.value || '50', 10);
    _auditPage = 1;
    _applyAuditFilters();
}

function auditChangePage(delta) {
    _auditPage += delta;
    _applyAuditFilters();
}

function filterAuditLogs() {
    _auditPage = 1;
    _applyAuditFilters();
}

function _applyAuditFilters() {
    const q = (document.getElementById('audit-search')?.value || '').toLowerCase();
    const userFilter = (document.getElementById('audit-user-filter')?.value || '').toLowerCase();

    let filtered = _auditLogData;

    if (userFilter) {
        filtered = filtered.filter(l => auditExtractUser(l).toLowerCase() === userFilter);
    }
    if (q) {
        filtered = filtered.filter(l =>
            (l.action || '').toLowerCase().includes(q) ||
            (l.target || '').toLowerCase().includes(q) ||
            (l.details || '').toLowerCase().includes(q) ||
            (l.status || '').toLowerCase().includes(q)
        );
    }

    renderAuditLog(filtered);
}

function renderAuditLog(filtered) {
    const tbody = document.getElementById('audit-tbody');
    if (!tbody) return;

    const total = filtered ? filtered.length : 0;
    const pageSize = _auditPageSize;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (_auditPage > totalPages) _auditPage = totalPages;
    if (_auditPage < 1) _auditPage = 1;

    const start = (_auditPage - 1) * pageSize;
    const page = (filtered || []).slice(start, start + pageSize);

    // Update pager controls
    const infoEl = document.getElementById('audit-pager-info');
    const labelEl = document.getElementById('audit-page-label');
    const prevBtn = document.getElementById('audit-prev');
    const nextBtn = document.getElementById('audit-next');
    if (infoEl) infoEl.textContent = total === 0 ? 'No results' : `${start + 1}–${Math.min(start + pageSize, total)} of ${total} entries`;
    if (labelEl) labelEl.textContent = `Page ${_auditPage} / ${totalPages}`;
    if (prevBtn) prevBtn.disabled = _auditPage <= 1;
    if (nextBtn) nextBtn.disabled = _auditPage >= totalPages;

    if (page.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="padding:1.5rem; color:#64748b; text-align:center;">No audit events found.</td></tr>';
        return;
    }

    const actionColors = {
        'kubectl':       '#60a5fa',
        'exec_command':  '#f59e0b',
        'k0s_provision': '#34d399',
        'list_containers': '#94a3b8',
    };

    tbody.innerHTML = page.map((l, i) => {
        const color = actionColors[l.action] || '#a78bfa';
        const statusColor = l.status === 'success' ? '#34d399' : l.status === 'failed' ? '#f87171' : '#94a3b8';
        const ts = l.timestamp ? new Date(l.timestamp).toLocaleString() : '—';
        const extractedUser = auditExtractUser(l);
        // Strip "user=xxx " prefix from details for cleaner display
        const detailsClean = (l.details || '').replace(/^user=[^\s]+\s*/, '').trim() || '—';
        const kubectlCmd = auditToKubectlCommand(l);
        return `<tr style="border-bottom:1px solid rgba(255,255,255,0.05); background:${i%2===0?'#0f1117':'transparent'}">
            <td style="padding:0.5rem 0.75rem; color:#64748b; font-size:0.78rem;">${l.id}</td>
            <td style="padding:0.5rem 0.75rem; color:#94a3b8; white-space:nowrap; font-size:0.78rem;">${escHtml(ts)}</td>
            <td style="padding:0.5rem 0.75rem; color:#93c5fd; font-size:0.8rem; font-weight:500; white-space:nowrap;">${escHtml(extractedUser)}</td>
            <td style="padding:0.5rem 0.75rem;"><span style="color:${color}; font-weight:600; font-family:monospace; font-size:0.8rem;">${escHtml(l.action)}</span></td>
            <td style="padding:0.5rem 0.75rem; color:#cbd5e1; font-size:0.8rem; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escHtml(l.target)}">${escHtml(l.target)}</td>
            <td style="padding:0.5rem 0.75rem; color:#cbd5e1; font-size:0.8rem; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escHtml(l.details || '')}">${escHtml(detailsClean)}</td>
            <td style="padding:0.5rem 0.75rem; max-width:280px;">${kubectlCmd ? `<code style="background:#0f2744;color:#7dd3fc;padding:0.15rem 0.45rem;border-radius:4px;font-size:0.78rem;white-space:nowrap;display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(kubectlCmd)}">${escHtml(kubectlCmd)}</code>` : '<span style="color:#475569;font-size:0.78rem;">—</span>'}</td>
            <td style="padding:0.5rem 0.75rem;"><span style="color:${statusColor}; font-size:0.78rem;">${escHtml(l.status)}</span></td>
        </tr>`;
    }).join('');
}

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
