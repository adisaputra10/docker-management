
// Helper for admin actions (Users and Projects)

// Helper for admin actions (Users and Projects)

// --- Users ---

async function loadUsers() {
    const list = document.getElementById('users-list');
    if (!list) return;
    list.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const res = await fetch(`${API_BASE}/users`);
        if (!res.ok) throw new Error('Failed to load users');
        const users = await res.json();

        if (users.length === 0) {
            list.innerHTML = '<div>No users found</div>';
            return;
        }

        list.innerHTML = `
            <div class="table-container">
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Created At</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(u => `
                                <tr>
                                    <td>
                                        <div style="font-weight: 600; color: #fff;">${u.username}</div>
                                    </td>
                                    <td>
                                        <span class="card-status ${u.role === 'admin' ? 'running' : 'stopped'}" style="width: fit-content;">
                                            ${u.role}
                                        </span>
                                    </td>
                                    <td style="color: #94a3b8;">${new Date(u.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <div class="action-btn-group">
                                            <button class="btn btn-sm btn-primary" onclick="showEditUserModal('${u.id}', '${u.username}', '${u.role}')">
                                                Edit
                                            </button>
                                            <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}', '${u.username}')">
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        list.innerHTML = `<div class="error">Error: ${e.message}</div>`;
    }
}

function showEditUserModal(id, username, role) {
    showModal(`Edit User: ${username}`, `
        <input type="hidden" id="edit-user-id" value="${id}">
        <div class="form-group">
            <label>Username</label>
            <input type="text" id="edit-username" class="form-input" value="${username}" required>
        </div>
        <div class="form-group">
            <label>Role</label>
            <input type="hidden" id="original-username" value="${username}"> 
            <!-- Prevent admin from locking themselves out if they are the only admin? UI doesn't handle complexity yet. -->
            <select id="edit-role" class="form-input">
                <option value="user" ${role === 'user' ? 'selected' : ''}>User</option>
                <option value="admin" ${role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
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
    const role = document.getElementById('edit-role').value;
    const password = document.getElementById('edit-password').value;

    const payload = { username, role };
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
            <label>Role</label>
            <select id="new-role" class="form-input">
                <option value="user">User</option>
                <option value="admin">Admin</option>
            </select>
        </div>
        <button class="btn btn-success" style="width: 100%;" onclick="submitCreateUser()">Create User</button>
    `);
}

async function submitCreateUser() {
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;

    if (!username || !password) {
        showToast('Username and password required', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
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
    list.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const res = await fetch(`${API_BASE}/projects`);
        if (!res.ok) throw new Error('Failed');
        const projects = await res.json();

        if (projects.length === 0) {
            list.innerHTML = '<div>No projects found</div>';
            return;
        }

        list.innerHTML = projects.map(p => `
            <div class="card">
                <div class="card-header">
                    <h3>${p.name}</h3>
                </div>
                <div class="card-body">
                    <p>${p.description || 'No description'}</p>
                </div>
                <div class="card-actions" style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary" style="flex: 1;" onclick="manageProject('${p.id}')">Manage</button>
                    <button class="btn btn-danger" onclick="deleteProject('${p.id}', '${p.name}')">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = `<div class="error">${e.message}</div>`;
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
    document.getElementById('projects-view-list').style.display = 'none';
    const manageView = document.getElementById('projects-view-manage');
    manageView.style.display = 'block';
    const content = document.getElementById('manage-project-content');
    content.innerHTML = '<div class="loading">Loading details...</div>';

    try {
        const res = await fetch(`${API_BASE}/projects/${id}`);
        if (!res.ok) throw new Error('Failed to load project');
        const data = await res.json();

        document.getElementById('manage-project-title').textContent = `Manage: ${data.project.name}`;

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
    } catch (e) {
        // Assume first run, no settings. Silent fail or log.
        console.warn('SSO settings load error', e);
    }
}

async function saveSSOSettings() {
    const data = {
        standard_login_enabled: document.getElementById('standard-login-enabled').checked,
        gitlab_enabled: document.getElementById('sso-gitlab-enabled').checked,

        gitlab_enabled: document.getElementById('sso-gitlab-enabled').checked,
        gitlab_client_id: document.getElementById('sso-gitlab-client-id').value,
        gitlab_client_secret: document.getElementById('sso-gitlab-client-secret').value,
        gitlab_redirect_uri: document.getElementById('sso-gitlab-redirect-uri').value,

        entra_enabled: document.getElementById('sso-entra-enabled').checked,
        entra_tenant_id: document.getElementById('sso-entra-tenant-id').value,
        entra_client_id: document.getElementById('sso-entra-client-id').value,
        entra_client_secret: document.getElementById('sso-entra-client-secret').value,
        entra_redirect_uri: document.getElementById('sso-entra-redirect-uri').value
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
