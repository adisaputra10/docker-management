// ========================================
// CRUD OPERATIONS - VOLUMES, NETWORKS, IMAGES, CONTAINERS
// ========================================

// ========================================
// DEPLOYMENT TEMPLATES
// ========================================

// Icon SVGs for deployment templates
const TEMPLATE_ICONS = {
    blank: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    nginx: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm-1 14.5L5 13.18V9l6 3v4.5zm1-6.5L5.5 6.5 12 3l6.5 3.5L12 10zm7 3.18l-6 3.32V10l6-3v6.18z"/></svg>`,
    apache: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v7c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>`,
    traefik: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 6l-1-2H5v17h2v-7h5l1 2h7V6h-6zm4 8h-4l-1-2H7V6h5l1 2h5v6z"/></svg>`,
    wordpress: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-4.65 4.19c-1.29 0-2.48-.48-3.38-1.27L9.5 15.5l-1.91-5.25A4.83 4.83 0 0 1 12 5.5a4.83 4.83 0 0 1 4.83 4.83 4.67 4.67 0 0 1-.12 1.06l2.5-4.7zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`,
    mysql: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 4.69 2 8v8c0 3.31 4.48 6 10 6s10-2.69 10-6V8c0-3.31-4.48-6-10-6zm0 2c4.82 0 8 2.22 8 4s-3.18 4-8 4-8-2.22-8-4 3.18-4 8-4zm0 16c-4.82 0-8-2.22-8-4v-2.35C5.64 14.57 8.63 15.5 12 15.5s6.36-.93 8-2.85V18c0 1.78-3.18 4-8 4z"/></svg>`,
    mariadb: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 4.69 2 8v8c0 3.31 4.48 6 10 6s10-2.69 10-6V8c0-3.31-4.48-6-10-6zm0 2c4.82 0 8 2.22 8 4s-3.18 4-8 4-8-2.22-8-4 3.18-4 8-4zm8 10c0 1.78-3.18 4-8 4s-8-2.22-8-4v-2.35c1.64 1.92 4.63 2.85 8 2.85s6.36-.93 8-2.85V14z"/></svg>`,
    postgres: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 0 0-5 5v1H5a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3h-2V7a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v1H9V7a3 3 0 0 1 3-3zM5 10h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zm7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>`,
    redis: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5L12 2zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
    mongodb: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C9 7 7 9.5 7 14a5 5 0 0 0 10 0c0-4.5-2-7-5-12zm0 16.5a2 2 0 0 1-2-2c0-1.5 2-5 2-5s2 3.5 2 5a2 2 0 0 1-2 2z"/></svg>`,
    portainer: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M12 12v4M10 14h4" stroke="white" stroke-width="1.5" fill="none"/></svg>`,
    grafana: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3v18h18M7 16l4-4 4 4 4-7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    prometheus: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
    rabbitmq: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-5 9h-2v2h-2v-2H9v-2h2V9h2v2h2v2z"/></svg>`,
    minio: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5zm7 4l5 9H7l5-9z"/></svg>`,
    elasticsearch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M7 11h8M11 7v8" stroke-linecap="round"/></svg>`,
    pgadmin: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 0 0-5 5v1H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-3V7a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v1H9V7a3 3 0 0 1 3-3zm-1 8h2v4h-2v-4zm-3 1h2v3H8v-3zm6 0h2v3h-2v-3z"/></svg>`,
};

const TEMPLATE_ICON_COLORS = {
    blank: '#94a3b8',
    nginx: '#009639',
    apache: '#d42029',
    traefik: '#24a1c1',
    wordpress: '#21759b',
    mysql: '#00758f',
    mariadb: '#c0765a',
    postgres: '#336791',
    redis: '#dc382d',
    mongodb: '#47a248',
    portainer: '#13bef9',
    grafana: '#f46800',
    prometheus: '#e6522c',
    rabbitmq: '#ff6600',
    minio: '#c72e49',
    elasticsearch: '#005571',
    pgadmin: '#336791',
};

const DEPLOYMENT_TEMPLATES = [
    { id: 'blank', name: 'Custom', description: 'Start from scratch with a blank form.', category: 'custom', image: '', ports: '', env: '', restart: 'no' },
    { id: 'nginx', name: 'Nginx', description: 'High-performance web server & reverse proxy.', category: 'web', image: 'nginx:alpine', ports: '80:80, 443:443', env: '', restart: 'unless-stopped' },
    { id: 'apache', name: 'Apache HTTP', description: "The world's most used web server.", category: 'web', image: 'httpd:alpine', ports: '80:80', env: '', restart: 'unless-stopped' },
    { id: 'traefik', name: 'Traefik', description: 'Modern HTTP reverse proxy & load balancer.', category: 'proxy', image: 'traefik:v3.0', ports: '80:80, 443:443, 8080:8080', env: '', restart: 'unless-stopped' },
    { id: 'wordpress', name: 'WordPress', description: 'Popular CMS. Requires a MySQL/MariaDB container.', category: 'cms', image: 'wordpress:latest', ports: '8080:80', env: 'WORDPRESS_DB_HOST=db:3306\nWORDPRESS_DB_USER=wordpress\nWORDPRESS_DB_PASSWORD=wordpress_password\nWORDPRESS_DB_NAME=wordpress', restart: 'unless-stopped' },
    { id: 'mysql', name: 'MySQL 8', description: "World's most popular open-source relational database.", category: 'database', image: 'mysql:8.0', ports: '3306:3306', env: 'MYSQL_ROOT_PASSWORD=rootpassword\nMYSQL_DATABASE=mydb\nMYSQL_USER=dbuser\nMYSQL_PASSWORD=dbpassword', restart: 'unless-stopped' },
    { id: 'mariadb', name: 'MariaDB', description: 'Community-developed MySQL-compatible database.', category: 'database', image: 'mariadb:latest', ports: '3306:3306', env: 'MYSQL_ROOT_PASSWORD=rootpassword\nMYSQL_DATABASE=mydb\nMYSQL_USER=dbuser\nMYSQL_PASSWORD=dbpassword', restart: 'unless-stopped' },
    { id: 'postgres', name: 'PostgreSQL', description: 'Advanced open-source relational database.', category: 'database', image: 'postgres:16-alpine', ports: '5432:5432', env: 'POSTGRES_USER=pguser\nPOSTGRES_PASSWORD=pgpassword\nPOSTGRES_DB=mydb', restart: 'unless-stopped' },
    { id: 'redis', name: 'Redis', description: 'In-memory data store, cache and message broker.', category: 'database', image: 'redis:7-alpine', ports: '6379:6379', env: '', restart: 'unless-stopped' },
    { id: 'mongodb', name: 'MongoDB', description: 'Document-oriented NoSQL database.', category: 'database', image: 'mongo:7', ports: '27017:27017', env: 'MONGO_INITDB_ROOT_USERNAME=admin\nMONGO_INITDB_ROOT_PASSWORD=adminpassword\nMONGO_INITDB_DATABASE=mydb', restart: 'unless-stopped' },
    { id: 'portainer', name: 'Portainer', description: 'Docker management UI (standalone agent).', category: 'devops', image: 'portainer/portainer-ce:latest', ports: '9000:9000, 9443:9443', env: '', restart: 'always' },
    { id: 'grafana', name: 'Grafana', description: 'Open-source analytics & monitoring visualization.', category: 'monitoring', image: 'grafana/grafana:latest', ports: '3000:3000', env: 'GF_SECURITY_ADMIN_USER=admin\nGF_SECURITY_ADMIN_PASSWORD=adminpassword', restart: 'unless-stopped' },
    { id: 'prometheus', name: 'Prometheus', description: 'Open-source monitoring and alerting toolkit.', category: 'monitoring', image: 'prom/prometheus:latest', ports: '9090:9090', env: '', restart: 'unless-stopped' },
    { id: 'rabbitmq', name: 'RabbitMQ', description: 'Message broker with management UI.', category: 'messaging', image: 'rabbitmq:3-management', ports: '5672:5672, 15672:15672', env: 'RABBITMQ_DEFAULT_USER=admin\nRABBITMQ_DEFAULT_PASS=adminpassword', restart: 'unless-stopped' },
    { id: 'minio', name: 'MinIO', description: 'High-performance S3-compatible object storage.', category: 'storage', image: 'minio/minio:latest', ports: '9000:9000, 9001:9001', env: 'MINIO_ROOT_USER=minioadmin\nMINIO_ROOT_PASSWORD=minioadmin', restart: 'unless-stopped' },
    { id: 'elasticsearch', name: 'Elasticsearch', description: 'Distributed search and analytics engine.', category: 'search', image: 'elasticsearch:8.12.0', ports: '9200:9200, 9300:9300', env: 'discovery.type=single-node\nES_JAVA_OPTS=-Xms512m -Xmx512m\nxpack.security.enabled=false', restart: 'unless-stopped' },
    { id: 'pgadmin', name: 'pgAdmin 4', description: 'Web-based PostgreSQL administration tool.', category: 'devops', image: 'dpage/pgadmin4:latest', ports: '5050:80', env: 'PGADMIN_DEFAULT_EMAIL=admin@example.com\nPGADMIN_DEFAULT_PASSWORD=adminpassword', restart: 'unless-stopped' },
];

const CATEGORY_LABELS = {
    custom: { label: 'Custom', color: '#94a3b8' },
    web: { label: 'Web Server', color: '#3b82f6' },
    proxy: { label: 'Proxy', color: '#8b5cf6' },
    cms: { label: 'CMS', color: '#f59e0b' },
    database: { label: 'Database', color: '#10b981' },
    devops: { label: 'DevOps', color: '#6366f1' },
    monitoring: { label: 'Monitoring', color: '#f97316' },
    messaging: { label: 'Messaging', color: '#ec4899' },
    storage: { label: 'Storage', color: '#14b8a6' },
    search: { label: 'Search', color: '#eab308' },
};


function showDeploymentTemplates(networkOptions, volumeOptions) {
    const templateCards = DEPLOYMENT_TEMPLATES.map(t => {
        const cat = CATEGORY_LABELS[t.category] || { label: t.category, color: '#94a3b8' };
        const iconColor = TEMPLATE_ICON_COLORS[t.id] || '#94a3b8';
        const iconSvg = TEMPLATE_ICONS[t.id] || TEMPLATE_ICONS.blank;
        return `
            <div class="template-card" onclick="applyDeploymentTemplate('${t.id}', ${JSON.stringify(networkOptions).replace(/"/g, '&quot;')}, ${JSON.stringify(volumeOptions).replace(/"/g, '&quot;')})">
                <div class="template-card-icon" style="background: ${iconColor}22; color: ${iconColor}; border: 1.5px solid ${iconColor}44;">
                    ${iconSvg}
                </div>
                <div class="template-card-info">
                    <div class="template-card-name">${t.name}</div>
                    <div class="template-card-desc">${t.description}</div>
                </div>
                <span class="template-badge" style="background: ${cat.color}18; color: ${cat.color}; border-color: ${cat.color}33;">${cat.label}</span>
            </div>
        `;
    }).join('');

    const content = `
        <div style="margin-bottom: 0.75rem;">
            <p style="color: var(--text-muted); font-size: 0.82rem; margin: 0;">Choose a template to auto-fill the config, or start blank. Images are auto-pulled if not present.</p>
        </div>
        <div class="template-grid">
            ${templateCards}
        </div>
    `;
    showModal('🚀 Deploy Container', content);
}


function applyDeploymentTemplate(templateId, networkOptions, volumeOptions) {
    const template = DEPLOYMENT_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    const defaultName = template.id === 'blank' ? '' : template.id.replace(/[^a-z0-9]/gi, '-');

    const content = `
        <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.5rem;">${template.icon}</span>
            <div>
                <div style="font-weight: 700; font-size: 1rem;">${template.name}</div>
                <div style="color: var(--text-muted); font-size: 0.8rem;">${template.description}</div>
            </div>
            <button class="btn btn-secondary" style="margin-left: auto; padding: 0.35rem 0.75rem; font-size: 0.75rem;" onclick="showCreateContainerModal()">← Back</button>
        </div>

        <div class="form-group">
            <label for="container-name">Container Name*</label>
            <input type="text" id="container-name" placeholder="my-container" value="${defaultName}" required>
        </div>
        <div class="form-group">
            <label for="container-image">Image*</label>
            <input type="text" id="container-image" placeholder="nginx:latest" value="${template.image}" required>
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
                    <option value="no" ${template.restart === 'no' ? 'selected' : ''}>No</option>
                    <option value="always" ${template.restart === 'always' ? 'selected' : ''}>Always</option>
                    <option value="unless-stopped" ${template.restart === 'unless-stopped' ? 'selected' : ''}>Unless Stopped</option>
                    <option value="on-failure" ${template.restart === 'on-failure' ? 'selected' : ''}>On Failure</option>
                </select>
            </div>
        </div>

        <div class="form-group">
            <label for="container-ports">Ports (optional)</label>
            <input type="text" id="container-ports" placeholder="8080:80, 8443:443" value="${template.ports}">
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
            <textarea id="container-env" rows="5" placeholder="KEY=value&#10;ANOTHER_KEY=value">${template.env}</textarea>
            <small>One per line, format: KEY=value</small>
        </div>

        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-success" onclick="createContainer()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Deploy ${template.name}
            </button>
        </div>
    `;
    showModal(`🚀 Deploy — ${template.name}`, content);
}



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

    // Clear tracking in app.js if present
    if (typeof activeContainerId !== 'undefined') {
        activeContainerId = null;
        activeContainerName = null;
    }
}

// ===================
// VOLUMES
// ===================

async function refreshVolumes() {
    const volumesList = document.getElementById('volumes-list');
    if (!volumesList) return;

    // Only show loading if empty (silent refresh)
    if (volumesList.innerHTML === '' || volumesList.querySelector('.loading')) {
        volumesList.innerHTML = '<div class="loading">Loading volumes...</div>';
    }

    try {
        const response = await fetch(`${API_BASE}/volumes`);
        const volumes = await response.json();

        // Update stats
        const statEl = document.querySelector('#totalVolumes .stat-value');
        if (statEl) statEl.textContent = volumes.length || 0;

        if (!volumes || volumes.length === 0) {
            volumesList.innerHTML = '<div class="empty-state">No volumes found</div>';
            return;
        }

        const tableHTML = `
            <table class="table fixed">
                <thead>
                    <tr>
                        <th style="width: 40px;"></th>
                        <th style="width: 35%;">Name</th>
                        <th style="width: 15%;">Driver</th>
                        <th>Mountpoint</th>
                        <th style="width: 180px;">Created</th>
                        <th style="width: 100px; text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${volumes.map(vol => {
            const displayName = vol.name.length > 24 ? vol.name.substring(0, 12) + '...' + vol.name.substring(vol.name.length - 8) : vol.name;
            return `
                        <tr>
                            <td><span class="status-dot hollow"></span></td>
                            <td style="font-weight: 500;" title="${vol.name}">
                                <span class="text-truncate">${displayName}</span>
                            </td>
                            <td class="text-secondary">${vol.driver}</td>
                            <td class="text-secondary"><code class="text-truncate" title="${vol.mountpoint}">${vol.mountpoint}</code></td>
                            <td class="text-secondary">${vol.created || 'N/A'}</td>
                            <td style="text-align: right;">
                                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                                    <button class="btn btn-icon-tiny" onclick="inspectVolume('${vol.name}')" title="Inspect">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    </button>
                                    <button class="btn btn-icon-tiny" style="color: #ef4444;" onclick="removeVolume('${vol.name}')" title="Delete">
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

        if (volumesList.innerHTML !== tableHTML) {
            volumesList.innerHTML = tableHTML;
        }
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

    // Only show loading if empty (silent refresh)
    if (networksList.innerHTML === '' || networksList.querySelector('.loading')) {
        networksList.innerHTML = '<div class="loading">Loading networks...</div>';
    }

    try {
        const response = await fetch(`${API_BASE}/networks`);
        const networks = await response.json();

        // Update stats
        const statEl = document.querySelector('#totalNetworks .stat-value');
        if (statEl) statEl.textContent = networks.length || 0;

        if (!networks || networks.length === 0) {
            networksList.innerHTML = '<div class="empty-state">No networks found</div>';
            return;
        }

        const tableHTML = `
            <table class="table fixed">
                <thead>
                    <tr>
                        <th style="width: 40px;"></th>
                        <th style="width: 30%;">Name</th>
                        <th style="width: 180px;">Network ID</th>
                        <th style="width: 15%;">Driver</th>
                        <th style="width: 100px;">Scope</th>
                        <th>Created</th>
                        <th style="width: 100px; text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${networks.map(net => {
            const isSystem = ['bridge', 'host', 'none'].includes(net.name);
            const statusDot = isSystem ? '<span class="status-dot hollow"></span>' : '<span class="status-dot solid"></span>';

            return `
                            <tr>
                                <td>${statusDot}</td>
                                <td style="font-weight: 500;">
                                    <span class="text-truncate" title="${net.name}">${net.name}</span>
                                </td>
                                <td class="text-secondary"><code>${net.id.substring(0, 10)}</code></td>
                                <td class="text-secondary">${net.driver}</td>
                                <td class="text-secondary">${net.scope || 'local'}</td>
                                <td class="text-secondary">${net.created}</td>
                                <td style="text-align: right;">
                                    <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                                        <button class="btn btn-icon-tiny" onclick="inspectNetwork('${net.id}')" title="Inspect">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        </button>
                                        ${!isSystem ?
                    `<button class="btn btn-icon-tiny" style="color: #ef4444;" onclick="removeNetwork('${net.id}', '${net.name}')" title="Delete">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                            </button>` :
                    '<span class="badge" style="font-size: 0.65rem; opacity: 0.5; padding: 2px 6px;">System</span>'
                }
                                    </div>
                                </td>
                            </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        `;

        if (networksList.innerHTML !== tableHTML) {
            networksList.innerHTML = tableHTML;
        }
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
    showModal('🚀 Deploy Container', '<div class="loading">Loading...</div>');

    try {
        // Fetch networks and volumes in parallel
        const [networksRes, volumesRes] = await Promise.all([
            fetch(`${API_BASE}/networks`),
            fetch(`${API_BASE}/volumes`)
        ]);

        const networks = await networksRes.json();
        const volumes = await volumesRes.json();

        // Generate options strings (passed to template picker)
        const networkOptions = networks.map(n =>
            `<option value="${n.name}">${n.name} (${n.driver})</option>`
        ).join('');

        const volumeOptions = volumes.map(v =>
            `<option value="${v.name}">${v.name}</option>`
        ).join('');

        // Show the template picker (will call applyDeploymentTemplate on click)
        showDeploymentTemplates(networkOptions, volumeOptions);

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

    showToast(`Deploying ${name}... pulling image if needed`, 'info');
    closeModal();

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
            const data = await response.json();
            const warnings = data.warnings || [];

            // Check if any warning indicates a start failure
            const startFailure = warnings.find(w => w.includes('failed to start') || w.includes('Cannot start'));

            if (startFailure) {
                // Extract the actual reason (after the prefix we added)
                const reason = startFailure.replace('Container created but failed to start: ', '');
                showToast(`Container "${name}" created but failed to start`, 'warning');
                // Show a detailed crash modal
                showModal('⚠️ Container Failed to Start', `
                    <div style="margin-bottom: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                            <span style="font-size: 1.25rem;">📦</span>
                            <div>
                                <div style="font-weight: 600;">${name}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">Image: ${image}</div>
                            </div>
                            <span style="margin-left: auto; background: #f97316; color: white; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; text-transform: uppercase;">CREATED</span>
                        </div>
                        <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 0.5rem; padding: 0.875rem; margin-bottom: 0.75rem;">
                            <div style="font-size: 0.75rem; font-weight: 700; color: #f87171; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem;">📛 Error Details</div>
                            <code style="font-size: 0.78rem; color: #fca5a5; line-height: 1.5; display: block; word-break: break-all; white-space: pre-wrap;">${reason}</code>
                        </div>
                        <div style="background: rgba(59, 130, 246, 0.06); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 0.5rem; padding: 0.75rem; font-size: 0.78rem; color: var(--text-muted); line-height: 1.5;">
                            💡 <strong>Tip:</strong> The container was created but could not start. Common causes: port already in use, missing environment variables, or insufficient permissions. Fix the config and try again.
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                    </div>
                `);
            } else {
                showToast(`✅ Container "${name}" deployed and running`, 'success');
            }
            setTimeout(refreshContainers, 800);
        } else {
            const errorText = await response.text();
            // Show detailed error modal
            showModal('❌ Deploy Failed', `
                <div style="margin-bottom: 1rem;">
                    <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 0.5rem; padding: 0.875rem; margin-bottom: 0.75rem;">
                        <div style="font-size: 0.75rem; font-weight: 700; color: #f87171; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem;">📛 Error Details</div>
                        <code style="font-size: 0.78rem; color: #fca5a5; line-height: 1.5; display: block; word-break: break-all; white-space: pre-wrap;">${errorText.trim()}</code>
                    </div>
                    <div style="background: rgba(59, 130, 246, 0.06); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 0.5rem; padding: 0.75rem; font-size: 0.78rem; color: var(--text-muted); line-height: 1.5;">
                        💡 <strong>Tip:</strong> Check the error above. Common causes: image not found, port conflict, or invalid configuration.
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                </div>
            `);
        }
    } catch (error) {
        showModal('❌ Network Error', `
            <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 0.5rem; padding: 0.875rem; margin-bottom: 1rem;">
                <code style="font-size: 0.78rem; color: #fca5a5;">${error.message || 'Unknown error'}</code>
            </div>
            <div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">Close</button></div>
        `);
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
