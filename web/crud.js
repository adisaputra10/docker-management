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
    // openclaw uses logo_url instead of SVG
    openclaw: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>`,
    n8n: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 18l-8-4V8l8-4 8 4v8l-8 4zm-4-9h8v2H8v-2z"/></svg>`,
    flowise: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zM7 11V9l5-2.5L17 9v2l-5 2.5L7 11zM7 15l5 2.5 5-2.5v-2l-5 2.5L7 13v2z"/></svg>`,
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
    openclaw: '#ff4d00',
    n8n: '#f97316',
    flowise: '#4f46e5',
};

const DEPLOYMENT_TEMPLATES = [
    { id: 'blank', name: 'Custom', description: 'Start from scratch with a blank form.', category: 'custom', image: '', ports: '', env: '', restart: 'no' },

    // ⚡ HOT / TRENDING
    {
        id: 'openclaw',
        name: 'OpenClaw',
        description: 'AI coding agent gateway — run Claude/GPT/Gemini-powered agents in a sandboxed container. Trending now.',
        category: 'ai',
        hot: true,
        type: 'compose',
        logo_url: 'https://www.cnet.com/a/img/resize/8ee704adc959642b8f136a52ebf81860050bdf60/hub/2026/01/30/a0605f4b-533d-410e-9bbf-49113e923a1b/image.png?auto=webp&fit=crop&height=1200&width=1200',
        icon_override: 'openclaw',
    },
    {
        id: 'n8n',
        name: 'n8n',
        description: 'Workflow automation tool — build complex automations with a visual interface. Fair-code self-hosted.',
        category: 'automation',
        hot: true,
        type: 'compose',
        logo_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ8b13FupbJiqRDcYQbK4BfEcAJ6S7eA8I5oQ&s',
        icon_override: 'n8n',
    },
    {
        id: 'flowise',
        name: 'FlowiseAI',
        description: 'Open-source low-code tool for building customized LLM orchestration and AI agents.',
        category: 'ai',
        hot: true,
        type: 'compose',
        logo_url: 'https://cdn-1.webcatalog.io/catalog/flowiseai/flowiseai-icon-filled-256.webp?v=1748322017965',
        icon_override: 'flowise',
    },

    // 🌐 Web
    { id: 'nginx', name: 'Nginx', description: 'High-performance web server & reverse proxy.', category: 'web', image: 'nginx:alpine', ports: '80:80, 443:443', env: '', restart: 'unless-stopped' },
    { id: 'apache', name: 'Apache HTTP', description: "The world's most used web server.", category: 'web', image: 'httpd:alpine', ports: '80:80', env: '', restart: 'unless-stopped' },
    { id: 'traefik', name: 'Traefik', description: 'Modern HTTP reverse proxy & load balancer.', category: 'proxy', image: 'traefik:v3.0', ports: '80:80, 443:443, 8080:8080', env: '', restart: 'unless-stopped' },
    { id: 'wordpress', name: 'WordPress', description: 'Popular CMS. Requires a MySQL/MariaDB container.', category: 'cms', image: 'wordpress:latest', ports: '8080:80', env: 'WORDPRESS_DB_HOST=db:3306\nWORDPRESS_DB_USER=wordpress\nWORDPRESS_DB_PASSWORD=wordpress_password\nWORDPRESS_DB_NAME=wordpress', restart: 'unless-stopped' },

    // 🗄️ Database
    { id: 'mysql', name: 'MySQL 8', description: "World's most popular open-source relational database.", category: 'database', image: 'mysql:8.0', ports: '3306:3306', env: 'MYSQL_ROOT_PASSWORD=rootpassword\nMYSQL_DATABASE=mydb\nMYSQL_USER=dbuser\nMYSQL_PASSWORD=dbpassword', restart: 'unless-stopped' },
    { id: 'mariadb', name: 'MariaDB', description: 'Community-developed MySQL-compatible database.', category: 'database', image: 'mariadb:latest', ports: '3306:3306', env: 'MYSQL_ROOT_PASSWORD=rootpassword\nMYSQL_DATABASE=mydb\nMYSQL_USER=dbuser\nMYSQL_PASSWORD=dbpassword', restart: 'unless-stopped' },
    { id: 'postgres', name: 'PostgreSQL', description: 'Advanced open-source relational database.', category: 'database', image: 'postgres:16-alpine', ports: '5432:5432', env: 'POSTGRES_USER=pguser\nPOSTGRES_PASSWORD=pgpassword\nPOSTGRES_DB=mydb', restart: 'unless-stopped' },
    { id: 'redis', name: 'Redis', description: 'In-memory data store, cache and message broker.', category: 'database', image: 'redis:7-alpine', ports: '6379:6379', env: '', restart: 'unless-stopped' },
    { id: 'mongodb', name: 'MongoDB', description: 'Document-oriented NoSQL database.', category: 'database', image: 'mongo:7', ports: '27017:27017', env: 'MONGO_INITDB_ROOT_USERNAME=admin\nMONGO_INITDB_ROOT_PASSWORD=adminpassword\nMONGO_INITDB_DATABASE=mydb', restart: 'unless-stopped' },

    // ⚙️ DevOps
    { id: 'portainer', name: 'Portainer', description: 'Docker management UI (standalone agent).', category: 'devops', image: 'portainer/portainer-ce:latest', ports: '9000:9000, 9443:9443', env: '', restart: 'always' },
    { id: 'pgadmin', name: 'pgAdmin 4', description: 'Web-based PostgreSQL administration tool.', category: 'devops', image: 'dpage/pgadmin4:latest', ports: '5050:80', env: 'PGADMIN_DEFAULT_EMAIL=admin@example.com\nPGADMIN_DEFAULT_PASSWORD=adminpassword', restart: 'unless-stopped' },

    // 📊 Monitoring — Docker Compose stacks
    {
        id: 'prometheus-grafana',
        name: 'Grafana Monitoring',
        description: 'Full monitoring stack: Prometheus scraping + Grafana dashboards. Ready-to-use Docker Compose.',
        category: 'monitoring',
        type: 'compose',
        icon_override: 'prometheus',
    },
    { id: 'grafana', name: 'Grafana', description: 'Open-source analytics & monitoring visualization (standalone).', category: 'monitoring', image: 'grafana/grafana:latest', ports: '3000:3000', env: 'GF_SECURITY_ADMIN_USER=admin\nGF_SECURITY_ADMIN_PASSWORD=adminpassword', restart: 'unless-stopped' },
    { id: 'prometheus', name: 'Prometheus', description: 'Open-source monitoring & alerting toolkit (standalone).', category: 'monitoring', image: 'prom/prometheus:latest', ports: '9090:9090', env: '', restart: 'unless-stopped' },

    // 📨 Messaging / Storage / Search
    { id: 'rabbitmq', name: 'RabbitMQ', description: 'Message broker with management UI.', category: 'messaging', image: 'rabbitmq:3-management', ports: '5672:5672, 15672:15672', env: 'RABBITMQ_DEFAULT_USER=admin\nRABBITMQ_DEFAULT_PASS=adminpassword', restart: 'unless-stopped' },
    { id: 'minio', name: 'MinIO', description: 'High-performance S3-compatible object storage.', category: 'storage', image: 'minio/minio:latest', ports: '9000:9000, 9001:9001', env: 'MINIO_ROOT_USER=minioadmin\nMINIO_ROOT_PASSWORD=minioadmin', restart: 'unless-stopped' },
    { id: 'elasticsearch', name: 'Elasticsearch', description: 'Distributed search and analytics engine.', category: 'search', image: 'elasticsearch:8.12.0', ports: '9200:9200, 9300:9300', env: 'discovery.type=single-node\nES_JAVA_OPTS=-Xms512m -Xmx512m\nxpack.security.enabled=false', restart: 'unless-stopped' },
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
    ai: { label: 'AI', color: '#ff4d00' },
};


function showDeploymentTemplates(networkOptions, volumeOptions) {
    const templateCards = DEPLOYMENT_TEMPLATES.map(t => {
        const cat = CATEGORY_LABELS[t.category] || { label: t.category, color: '#94a3b8' };
        const iconId = t.icon_override || t.id;
        const iconColor = TEMPLATE_ICON_COLORS[iconId] || '#94a3b8';
        const iconSvg = TEMPLATE_ICONS[iconId] || TEMPLATE_ICONS.blank;

        // Build icon element: logo_url takes priority over SVG
        const iconHtml = t.logo_url
            ? `<img src="${t.logo_url}" alt="${t.name}" style="width:36px;height:36px;object-fit:contain;border-radius:6px;"
                   onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
               <span style="display:none;">${iconSvg}</span>`
            : iconSvg;

        // HOT badge
        const hotBadge = t.hot
            ? `<span style="position:absolute;top:-6px;right:-6px;font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:2px 7px;border-radius:999px;background:linear-gradient(135deg,#ff4d00,#ff9500);color:#fff;box-shadow:0 2px 8px rgba(255,77,0,.5);white-space:nowrap;">🔥 HOT</span>`
            : '';

        // Compose type indicator
        const composeBadge = t.type === 'compose'
            ? `<span style="font-size:0.6rem;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(99,102,241,0.15);color:#818cf8;border:1px solid rgba(99,102,241,0.3);margin-left:4px;">Compose</span>`
            : '';

        return `
            <div class="template-card" onclick="applyDeploymentTemplate('${t.id}', ${JSON.stringify(networkOptions).replace(/"/g, '&quot;')}, ${JSON.stringify(volumeOptions).replace(/"/g, '&quot;')})" style="position:relative;">
                ${hotBadge}
                <div class="template-card-icon" style="background: ${iconColor}22; color: ${iconColor}; border: 1.5px solid ${iconColor}44; overflow:hidden;">
                    ${iconHtml}
                </div>
                <div class="template-card-info">
                    <div class="template-card-name" style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">${t.name}${composeBadge}</div>
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

    // Handle Docker Compose stack templates
    if (template.type === 'compose') {
        showComposeTemplateModal(template);
        return;
    }

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

// ================================================
// DOCKER COMPOSE TEMPLATE MODALS
// ================================================

function showComposeTemplateModal(template) {
    if (template.id === 'prometheus-grafana') {
        showPrometheusGrafanaCompose();
    } else if (template.id === 'openclaw') {
        showOpenclawCompose();
    } else if (template.id === 'n8n') {
        showN8nCompose();
    } else if (template.id === 'flowise') {
        showFlowiseCompose();
    } else {
        showToast('Compose template not found', 'error');
    }
}

function showPrometheusGrafanaCompose() {
    const composeYaml = `version: '3.8'

networks:
  monitoring:
    driver: bridge

volumes:
  prometheus_data: {}
  grafana_data: {}

services:

  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
    ports:
      - "9090:9090"
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=adminpassword
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_SERVER_ROOT_URL=http://localhost:3000
    ports:
      - "3000:3000"
    networks:
      - monitoring
    depends_on:
      - prometheus

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    restart: unless-stopped
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    ports:
      - "9100:9100"
    networks:
      - monitoring`;

    const prometheusConfig = `global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'docker'
    static_configs:
      - targets: ['host.docker.internal:9323']`;

    const grafanaDatasource = `apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true`;

    const content = `
        <div style="display:flex;flex-direction:column;gap:1.25rem;">

            <!-- Header -->
            <div style="display:flex;align-items:center;gap:0.75rem;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-radius:0.75rem;padding:1rem;">
                <div style="width:44px;height:44px;border-radius:10px;background:rgba(249,115,22,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg viewBox="0 0 24 24" fill="#e6522c" width="26" height="26"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                </div>
                <div>
                    <div style="font-weight:700;font-size:1rem;">Prometheus + Grafana Stack</div>
                    <div style="color:var(--text-muted);font-size:0.8rem;">Full monitoring stack — Docker Compose ready-to-use</div>
                </div>
                <span style="margin-left:auto;font-size:0.65rem;font-weight:700;padding:3px 8px;border-radius:999px;background:rgba(99,102,241,0.15);color:#818cf8;border:1px solid rgba(99,102,241,0.3);">Compose Stack</span>
            </div>

            <!-- Services included -->
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.6rem;">
                <div style="background:rgba(230,82,44,0.08);border:1px solid rgba(230,82,44,0.2);border-radius:0.5rem;padding:0.65rem 0.75rem;">
                    <div style="font-size:0.75rem;font-weight:700;color:#f97316;">Prometheus</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">:9090 — Metrics</div>
                </div>
                <div style="background:rgba(244,104,0,0.08);border:1px solid rgba(244,104,0,0.2);border-radius:0.5rem;padding:0.65rem 0.75rem;">
                    <div style="font-size:0.75rem;font-weight:700;color:#f46800;">Grafana</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">:3000 — Dashboards</div>
                </div>
                <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:0.5rem;padding:0.65rem 0.75rem;">
                    <div style="font-size:0.75rem;font-weight:700;color:#818cf8;">Node Exporter</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">:9100 — Host metrics</div>
                </div>
            </div>

            <!-- Steps -->
            <div style="background:rgba(0,0,0,0.2);border-radius:0.75rem;padding:1rem;">
                <div style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:0.75rem;">📋 Setup Steps</div>
                <div style="display:flex;flex-direction:column;gap:0.5rem;font-size:0.8rem;color:var(--text-muted);">
                    <div><span style="color:#6366f1;font-weight:700;">1.</span> Create a folder: <code style="background:rgba(0,0,0,0.3);padding:1px 6px;border-radius:4px;">mkdir monitoring && cd monitoring</code></div>
                    <div><span style="color:#6366f1;font-weight:700;">2.</span> Save the files below into that folder</div>
                    <div><span style="color:#6366f1;font-weight:700;">3.</span> Create datasource dir: <code style="background:rgba(0,0,0,0.3);padding:1px 6px;border-radius:4px;">mkdir -p grafana/provisioning/datasources</code></div>
                    <div><span style="color:#6366f1;font-weight:700;">4.</span> Run: <code style="background:rgba(0,0,0,0.3);padding:1px 6px;border-radius:4px;">docker compose up -d</code></div>
                    <div><span style="color:#6366f1;font-weight:700;">5.</span> Open Grafana at <a href="http://localhost:3000" target="_blank" rel="noopener" style="color:#818cf8;">http://localhost:3000</a> — login admin/adminpassword</div>
                </div>
            </div>

            <!-- Environment Variables -->
            <div>
                <div style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;">
                    ⚙️ Environment Variables
                    <span style="font-size:0.65rem;font-weight:400;color:var(--text-muted);text-transform:none;">(One per line, e.g. GF_SECURITY_ADMIN_PASSWORD=adm)</span>
                </div>
                <textarea id="monitoring-env-input" class="form-control" rows="3" placeholder="GF_SECURITY_ADMIN_PASSWORD=adminpassword" style="font-family:monospace;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(230,82,44,0.3);border-radius:0.5rem;padding:0.75rem;color:#e2e8f0;width:100%;box-sizing:border-box;"></textarea>
            </div>

            <!-- docker-compose.yml -->
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                    <div style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);">📄 docker-compose.yml</div>
                    <button class="btn btn-sm btn-secondary" style="font-size:0.72rem;padding:0.25rem 0.6rem;" onclick="copyToClipboard('compose-yaml-content')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copy
                    </button>
                </div>
                <pre id="compose-yaml-content" style="background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.07);border-radius:0.5rem;padding:1rem;font-size:0.72rem;line-height:1.5;overflow-x:auto;max-height:240px;overflow-y:auto;color:#e2e8f0;white-space:pre;">${escapeHtml(composeYaml)}</pre>
            </div>

            <!-- prometheus.yml -->
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                    <div style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);">📄 prometheus.yml</div>
                    <button class="btn btn-sm btn-secondary" style="font-size:0.72rem;padding:0.25rem 0.6rem;" onclick="copyToClipboard('prom-config-content')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copy
                    </button>
                </div>
                <pre id="prom-config-content" style="background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.07);border-radius:0.5rem;padding:1rem;font-size:0.72rem;line-height:1.5;overflow-x:auto;max-height:160px;overflow-y:auto;color:#e2e8f0;white-space:pre;">${escapeHtml(prometheusConfig)}</pre>
            </div>

            <!-- grafana datasource -->
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                    <div style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);">📄 grafana/provisioning/datasources/prometheus.yml</div>
                    <button class="btn btn-sm btn-secondary" style="font-size:0.72rem;padding:0.25rem 0.6rem;" onclick="copyToClipboard('grafana-ds-content')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copy
                    </button>
                </div>
                <pre id="grafana-ds-content" style="background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.07);border-radius:0.5rem;padding:1rem;font-size:0.72rem;line-height:1.5;overflow-x:auto;max-height:130px;overflow-y:auto;color:#e2e8f0;white-space:pre;">${escapeHtml(grafanaDatasource)}</pre>
            </div>

            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                <button class="btn btn-secondary" onclick="downloadComposeFiles()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    Download Files
                </button>
                <button class="btn btn-success" onclick="deployGrafanaStack()">
                    🚀 Deploy Stack
                </button>
            </div>
        </div>
    `;
    showModal('📊 Prometheus + Grafana Stack', content);
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function copyToClipboard(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = el.innerText || el.textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Copy failed — try selecting manually', 'error');
    });
}

function downloadComposeFiles() {
    // Download docker-compose.yml
    const composeEl = document.getElementById('compose-yaml-content');
    const promEl = document.getElementById('prom-config-content');
    const dsEl = document.getElementById('grafana-ds-content');
    if (composeEl) downloadText('docker-compose.yml', composeEl.textContent);
    if (promEl) setTimeout(() => downloadText('prometheus.yml', promEl.textContent), 200);
    if (dsEl) setTimeout(() => downloadText('prometheus-datasource.yml', dsEl.textContent), 400);
    showToast('Downloading 3 config files...', 'success');
}

function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function showOpenclawCompose() {
    const composeYaml = `services:

  openclaw-gateway:
    image: ghcr.io/openclaw/openclaw:latest
    container_name: openclaw-gateway
    restart: unless-stopped
    ports:
      - "18789:18789"   # Web UI
      - "18788:18788"   # Gateway API
    volumes:
      - openclaw_data:/home/node
      - /var/run/docker.sock:/var/run/docker.sock  # optional: agent sandbox
    environment:
      - OPENCLAW_HOME=/home/node
      - OPENCLAW_CONTROL_ALLOW_FALLBACK=true
      # Add your API keys below:
      # - ANTHROPIC_API_KEY=sk-...
      # - OPENAI_API_KEY=sk-...
      # - GEMINI_API_KEY=AIza...
    command: ["openclaw", "gateway", "--port", "18788", "--allow-unconfigured", "--bind", "lan"]

  openclaw-cli:
    image: ghcr.io/openclaw/openclaw:latest
    network_mode: "service:openclaw-gateway"
    volumes:
      - openclaw_data:/home/node
    environment:
      - OPENCLAW_HOME=/home/node
      - OPENCLAW_GATEWAY_CONTROLUI_DANGEROUSLYALLOWHOSTHEADERORIGINFALLBACK=true
    command: ["tail", "-f", "/dev/null"]
    depends_on:
      - openclaw-gateway
    profiles:
      - cli   # run with: docker compose run --rm openclaw-cli <command>

volumes:
  openclaw_data: {}`;

    const content = `
        <div style="display:flex;flex-direction:column;gap:1.25rem;">

            <!-- Header -->
            <div style="display:flex;align-items:center;gap:0.75rem;background:rgba(255,77,0,0.08);border:1px solid rgba(255,77,0,0.25);border-radius:0.75rem;padding:1rem;">
                <div style="width:52px;height:52px;flex-shrink:0;border-radius:10px;overflow:hidden;background:rgba(255,77,0,0.1);display:flex;align-items:center;justify-content:center;">
                    <img src="https://www.cnet.com/a/img/resize/8ee704adc959642b8f136a52ebf81860050bdf60/hub/2026/01/30/a0605f4b-533d-410e-9bbf-49113e923a1b/image.png?auto=webp&fit=crop&height=1200&width=1200"
                         alt="OpenClaw" style="width:48px;height:48px;object-fit:contain;"
                         onerror="this.src='';this.parentElement.innerHTML='🦾';">
                </div>
                <div>
                    <div style="font-weight:700;font-size:1rem;display:flex;align-items:center;gap:0.5rem;">
                        OpenClaw
                        <span style="font-size:0.6rem;font-weight:800;padding:2px 7px;border-radius:999px;background:linear-gradient(135deg,#ff4d00,#ff9500);color:#fff;">🔥 HOT</span>
                    </div>
                    <div style="color:var(--text-muted);font-size:0.8rem;">AI coding agent gateway — Claude / GPT / Gemini powered</div>
                </div>
                <span style="margin-left:auto;font-size:0.65rem;font-weight:700;padding:3px 8px;border-radius:999px;background:rgba(99,102,241,0.15);color:#818cf8;border:1px solid rgba(99,102,241,0.3);">Compose Stack</span>
            </div>

            <!-- What is OpenClaw -->
            <div style="background:rgba(0,0,0,0.15);border-radius:0.75rem;padding:1rem;font-size:0.82rem;color:var(--text-muted);line-height:1.6;">
                <span style="color:#fb923c;font-weight:700;">OpenClaw</span> is an AI coding agent gateway that can run Claude, GPT-4, or Gemini-based agents in isolation within Docker containers. Ideal for coding assistants, automation, and CI/CD workflows.
                <br><span style="font-size:0.75rem;color:#64748b;">📦 Image: <code style="color:#a5b4fc;">ghcr.io/openclaw/openclaw:latest</code> · <a href="https://docs.openclaw.ai/install/docker" target="_blank" style="color:#818cf8;">Official Docs →</a></span>
            </div>

            <!-- Setup Steps -->
            <div style="background:rgba(0,0,0,0.2);border-radius:0.75rem;padding:1rem;">
                <div style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:0.75rem;">📋 Setup Steps</div>
                <div style="display:flex;flex-direction:column;gap:0.5rem;font-size:0.8rem;color:var(--text-muted);">
                    <div><span style="color:#ff4d00;font-weight:700;">1.</span> Create a folder: <code style="background:rgba(0,0,0,0.3);padding:1px 6px;border-radius:4px;">mkdir openclaw && cd openclaw</code></div>
                    <div><span style="color:#ff4d00;font-weight:700;">2.</span> Save the <code style="background:rgba(0,0,0,0.3);padding:1px 6px;border-radius:4px;">docker-compose.yml</code> below into that folder</div>
                    <div><span style="color:#ff4d00;font-weight:700;">3.</span> Fill in your API keys in the environment (Anthropic / OpenAI / Gemini)</div>
                    <div><span style="color:#ff4d00;font-weight:700;">4.</span> Run: <code style="background:rgba(0,0,0,0.3);padding:1px 6px;border-radius:4px;">docker compose up -d</code></div>
                    <div><span style="color:#ff4d00;font-weight:700;">5.</span> Open Dashboard UI: <a href="http://127.0.0.1:18788" target="_blank" style="color:#818cf8;">http://127.0.0.1:18788</a></div>
                    <div><span style="color:#ff4d00;font-weight:700;">6.</span> Get Token: <code style="background:rgba(0,0,0,0.3);padding:1px 6px;border-radius:4px;">docker compose run --rm openclaw-cli openclaw dashboard --no-open</code></div>
                    <div><span style="color:#ff4d00;font-weight:700;">7.</span> Onboarding: <code style="background:rgba(0,0,0,0.3);padding:1px 6px;border-radius:4px;">docker compose run --rm openclaw-cli openclaw onboard</code></div>
                </div>
            </div>

            <!-- Environment Variables Input -->
            <div style="margin-bottom:1rem;">
                <div style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:0.4rem;">🔑 Environment Variables</div>
                <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:0.5rem;">Enter optional API keys or config (e.g. <code style="color:#a5b4fc;">OPENAI_API_KEY=sk-...</code>), one per line. They will be injected into the Gateway container.</div>
                <textarea id="openclaw-env-input" class="form-control" rows="3" placeholder="OPENAI_API_KEY=sk-...\nANTHROPIC_API_KEY=sk-..." style="font-family:monospace;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,149,0,0.3);border-radius:0.5rem;padding:0.75rem;color:#e2e8f0;width:100%;box-sizing:border-box;"></textarea>
            </div>

            <!-- docker-compose.yml -->
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                    <div style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);">📄 docker-compose.yml</div>
                    <button class="btn btn-sm btn-secondary" style="font-size:0.72rem;padding:0.25rem 0.6rem;" onclick="copyToClipboard('openclaw-compose-content')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copy
                    </button>
                </div>
                <pre id="openclaw-compose-content" style="background:rgba(0,0,0,0.35);border:1px solid rgba(255,77,0,0.15);border-radius:0.5rem;padding:1rem;font-size:0.72rem;line-height:1.5;overflow-x:auto;max-height:280px;overflow-y:auto;color:#e2e8f0;white-space:pre;">${escapeHtml(composeYaml)}</pre>
            </div>

            <!-- Useful commands -->
            <div style="background:rgba(0,0,0,0.15);border-radius:0.75rem;padding:1rem;">
                <div style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:0.5rem;">🔧 Useful Commands</div>
                <div style="display:flex;flex-direction:column;gap:0.4rem;font-size:0.75rem;">
                    <code style="background:rgba(0,0,0,0.3);padding:4px 8px;border-radius:4px;color:#a5b4fc;">docker compose run --rm openclaw-cli openclaw status</code>
                    <code style="background:rgba(0,0,0,0.3);padding:4px 8px;border-radius:4px;color:#a5b4fc;">docker compose run --rm openclaw-cli openclaw doctor</code>
                    <code style="background:rgba(0,0,0,0.3);padding:4px 8px;border-radius:4px;color:#a5b4fc;">docker compose run --rm openclaw-cli openclaw dashboard --no-open</code>
                </div>
            </div>

            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                <button class="btn btn-secondary" onclick="downloadText('docker-compose.yml', document.getElementById('openclaw-compose-content').textContent); showToast('Downloaded docker-compose.yml','success')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    Download YAML
                </button>
                <button class="btn btn-success" onclick="deployOpenclawStack()">
                    🚀 Deploy Stack
                </button>
            </div>
        </div>
    `;
    showModal('OpenClaw — AI Agent Gateway', content);
}


function deployGrafanaStack() {
    const services = [
        {
            name: 'prometheus',
            image: 'prom/prometheus:latest',
            restart: 'unless-stopped',
            volumes: ['prometheus_data:/prometheus'],
            command: ['--config.file=/etc/prometheus/prometheus.yml', '--storage.tsdb.path=/prometheus', '--storage.tsdb.retention.time=30d', '--web.enable-lifecycle'],
            ports: ['9090:9090']
        },
        {
            name: 'grafana',
            image: 'grafana/grafana:latest',
            restart: 'unless-stopped',
            volumes: ['grafana_data:/var/lib/grafana'],
            env: ['GF_SECURITY_ADMIN_USER=admin', 'GF_SECURITY_ADMIN_PASSWORD=adminpassword', 'GF_USERS_ALLOW_SIGN_UP=false', 'GF_SERVER_ROOT_URL=http://localhost:3000'],
            ports: ['3000:3000']
        },
    ];
    deployComposeStack('monitoring', services, ['prometheus_data', 'grafana_data'], ['monitoring']);
}

function deployOpenclawStack() {
    // Parse environment variables from the textarea
    const envText = document.getElementById('openclaw-env-input')?.value || '';
    const userEnv = envText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && line.includes('='));

    const baseGatewayEnv = [
        'OPENCLAW_HOME=/home/node',
        'OPENCLAW_GATEWAY_CONTROLUI_DANGEROUSLYALLOWHOSTHEADERORIGINFALLBACK=true'
    ];

    const services = [
        {
            name: 'openclaw-gateway',
            image: 'ghcr.io/openclaw/openclaw:latest',
            restart: 'unless-stopped',
            ports: ['18789:18789', '18788:18788'],
            volumes: ['openclaw_data:/home/node', '/var/run/docker.sock:/var/run/docker.sock'],
            env: [...baseGatewayEnv, ...userEnv],
            command: ["openclaw", "gateway", "--port", "18788", "--allow-unconfigured", "--bind", "lan"]
        },
        {
            name: 'openclaw-cli',
            image: 'ghcr.io/openclaw/openclaw:latest',
            network_mode: 'service:openclaw-gateway', // will be replaced dynamically or rely on api behavior
            volumes: ['openclaw_data:/home/node'],
            env: ['OPENCLAW_HOME=/home/node', 'OPENCLAW_CONTROL_ALLOW_FALLBACK=true'],
            command: ["tail", "-f", "/dev/null"]
        }
    ];
    deployComposeStack('openclaw', services, ['openclaw_data']);
}

function showN8nCompose() {
    const composeYaml = `version: '3.8'

services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - NODE_ENV=production
      - WEBHOOK_URL=http://localhost:5678/
    volumes:
      - n8n_data:/home/node/.n8n
      - n8n_local_files:/files

volumes:
  n8n_data:
  n8n_local_files:`;

    const content = `
        <div style="display:flex;flex-direction:column;gap:1.25rem;">
            <!-- Header -->
            <div style="display:flex;align-items:center;gap:0.75rem;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-radius:0.75rem;padding:1rem;">
                <div style="width:52px;height:52px;flex-shrink:0;border-radius:10px;overflow:hidden;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.1);">
                    <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ8b13FupbJiqRDcYQbK4BfEcAJ6S7eA8I5oQ&s" 
                         alt="n8n" style="width:48px;height:48px;object-fit:contain;">
                </div>
                <div>
                    <div style="font-weight:700;font-size:1.1rem;display:flex;align-items:center;gap:0.5rem;">
                        n8n
                        <span style="font-size:0.6rem;font-weight:800;padding:2px 7px;border-radius:999px;background:linear-gradient(135deg,#ff4d00,#ff9500);color:#fff;">🔥 HOT</span>
                    </div>
                    <div style="color:var(--text-muted);font-size:0.8rem;">Workflow automation tool</div>
                </div>
                <span style="margin-left:auto;font-size:0.65rem;font-weight:700;padding:3px 8px;border-radius:999px;background:rgba(99,102,241,0.15);color:#818cf8;border:1px solid rgba(99,102,241,0.3);">Compose Stack</span>
            </div>

            <!-- What is n8n -->
            <div style="background:rgba(0,0,0,0.15);border-radius:0.75rem;padding:1rem;font-size:0.82rem;color:var(--text-muted);line-height:1.6;">
                <span style="color:#f97316;font-weight:700;">n8n</span> is an extendable workflow automation tool. With a fair-code distribution model, n8n will always have visible source code, be available to self-host, and allow you to add your own custom functions, logic and apps.
                <br><span style="font-size:0.75rem;color:#64748b;">📦 Image: <code style="color:#a5b4fc;">docker.n8n.io/n8nio/n8n:latest</code> · <a href="https://docs.n8n.io/" target="_blank" style="color:#818cf8;">Official Docs →</a></span>
            </div>

            <!-- Environment Variables -->
            <div>
                <div style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;">
                    ⚙️ Environment Variables
                    <span style="font-size:0.65rem;font-weight:400;color:var(--text-muted);text-transform:none;">(Add your custom variables, one per line)</span>
                </div>
                <textarea id="n8n-env-input" class="form-control" rows="5" placeholder="GENERIC_TIMEZONE=UTC\nNODE_ENV=production" style="font-family:monospace;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(249,115,22,0.3);border-radius:0.5rem;padding:0.75rem;color:#e2e8f0;width:100%;box-sizing:border-box;">GENERIC_TIMEZONE=UTC</textarea>
            </div>

            <!-- docker-compose.yml -->
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                    <div style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);">📄 docker-compose.yml</div>
                    <button class="btn btn-sm btn-secondary" style="font-size:0.72rem;padding:0.25rem 0.6rem;" onclick="copyToClipboard('n8n-compose-content')">
                        Copy
                    </button>
                </div>
                <pre id="n8n-compose-content" style="background:rgba(0,0,0,0.35);border:1px solid rgba(249,115,22,0.15);border-radius:0.5rem;padding:1rem;font-size:0.72rem;line-height:1.5;overflow-x:auto;max-height:280px;overflow-y:auto;color:#e2e8f0;white-space:pre;">${escapeHtml(composeYaml)}</pre>
            </div>

            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                <button class="btn btn-success" onclick="deployN8nStack()">
                    🚀 Deploy Stack
                </button>
            </div>
        </div>
    `;
    showModal('n8n — Workflow Automation', content);
}

function deployMonitoringStack() {
    const envText = document.getElementById('monitoring-env-input')?.value || '';
    const userEnv = envText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && line.includes('='));

    const services = [
        {
            name: 'prometheus',
            image: 'prom/prometheus:latest',
            restart: 'unless-stopped',
            volumes: ['prometheus_data:/prometheus'],
            ports: ['9090:9090'],
            networks: ['monitoring'],
            env: userEnv.filter(e => e.startsWith('PROMETHEUS_'))
        },
        {
            name: 'grafana',
            image: 'grafana/grafana:latest',
            restart: 'unless-stopped',
            volumes: ['grafana_data:/var/lib/grafana'],
            ports: ['3000:3000'],
            networks: ['monitoring'],
            env: ['GF_SECURITY_ADMIN_USER=admin', 'GF_SECURITY_ADMIN_PASSWORD=adminpassword', ...userEnv]
        }
    ];
    deployComposeStack('monitoring', services, ['prometheus_data', 'grafana_data'], ['monitoring']);
}

function deployN8nStack() {
    const envText = document.getElementById('n8n-env-input')?.value || '';
    const userEnv = envText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && line.includes('='));

    const services = [
        {
            name: 'n8n',
            image: 'docker.n8n.io/n8nio/n8n:latest',
            restart: 'always',
            ports: ['5678:5678'],
            volumes: ['n8n_data:/home/node/.n8n', 'n8n_local_files:/files'],
            env: [
                'N8N_PORT=5678',
                'N8N_PROTOCOL=http',
                'NODE_ENV=production',
                'WEBHOOK_URL=http://localhost:5678/',
                ...userEnv
            ]
        }
    ];
    deployComposeStack('n8n', services, ['n8n_data', 'n8n_local_files']);
}

function showFlowiseCompose() {
    const composeYaml = `version: '3.8'

services:
  flowise:
    image: flowiseai/flowise:latest
    restart: always
    environment:
      - PORT=3000
      - DATABASE_PATH=/root/.flowise
      - APIKEY_PATH=/root/.flowise
      - LOG_PATH=/root/.flowise/logs
    volumes:
      - flowise_data:/root/.flowise
    ports:
      - "3000:3000"

volumes:
  flowise_data:`;

    const content = `
        <div style="display:flex;flex-direction:column;gap:1.25rem;">
            <!-- Header -->
            <div style="display:flex;align-items:center;gap:0.75rem;background:rgba(79,70,229,0.08);border:1px solid rgba(79,70,229,0.25);border-radius:0.75rem;padding:1rem;">
                <div style="width:52px;height:52px;flex-shrink:0;border-radius:10px;overflow:hidden;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.1);">
                    <img src="https://cdn-1.webcatalog.io/catalog/flowiseai/flowiseai-icon-filled-256.webp?v=1748322017965" 
                         alt="Flowise" style="width:48px;height:48px;object-fit:contain;">
                </div>
                <div>
                    <div style="font-weight:700;font-size:1.1rem;display:flex;align-items:center;gap:0.5rem;">
                        FlowiseAI
                        <span style="font-size:0.6rem;font-weight:800;padding:2px 7px;border-radius:999px;background:linear-gradient(135deg,#ff4d00,#ff9500);color:#fff;">🔥 HOT</span>
                    </div>
                    <div style="color:var(--text-muted);font-size:0.8rem;">Low-code LLM Orchestration</div>
                </div>
                <span style="margin-left:auto;font-size:0.65rem;font-weight:700;padding:3px 8px;border-radius:999px;background:rgba(99,102,241,0.15);color:#818cf8;border:1px solid rgba(99,102,241,0.3);">Compose Stack</span>
            </div>

            <!-- What is Flowise -->
            <div style="background:rgba(0,0,0,0.15);border-radius:0.75rem;padding:1rem;font-size:0.82rem;color:var(--text-muted);line-height:1.6;">
                <span style="color:#4f46e5;font-weight:700;">FlowiseAI</span> is an open-source low-code tool for building customized LLM orchestration and AI agents. It allows you to build chatbots, search engines, and more using a dragndrop interface.
                <br><span style="font-size:0.75rem;color:#64748b;">📦 Image: <code style="color:#a5b4fc;">flowiseai/flowise:latest</code> · <a href="https://docs.flowiseai.com/" target="_blank" style="color:#818cf8;">Official Docs →</a></span>
            </div>

            <!-- Environment Variables -->
            <div>
                <div style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;">
                    ⚙️ Environment Variables
                </div>
                <textarea id="flowise-env-input" class="form-control" rows="5" placeholder="PORT=3000\nFLOWISE_USERNAME=admin" style="font-family:monospace;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(79,70,229,0.3);border-radius:0.5rem;padding:0.75rem;color:#e2e8f0;width:100%;box-sizing:border-box;">PORT=3000</textarea>
            </div>

            <!-- docker-compose.yml -->
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                    <div style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);">📄 docker-compose.yml</div>
                    <button class="btn btn-sm btn-secondary" style="font-size:0.72rem;padding:0.25rem 0.6rem;" onclick="copyToClipboard('flowise-compose-content')">
                        Copy
                    </button>
                </div>
                <pre id="flowise-compose-content" style="background:rgba(0,0,0,0.35);border:1px solid rgba(79,70,229,0.15);border-radius:0.5rem;padding:1rem;font-size:0.72rem;line-height:1.5;overflow-x:auto;max-height:280px;overflow-y:auto;color:#e2e8f0;white-space:pre;">${escapeHtml(composeYaml)}</pre>
            </div>

            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                <button class="btn btn-success" onclick="deployFlowiseStack()">
                    🚀 Deploy Stack
                </button>
            </div>
        </div>
    `;
    showModal('FlowiseAI — LLM Orchestration', content);
}

function deployFlowiseStack() {
    const envText = document.getElementById('flowise-env-input')?.value || '';
    const userEnv = envText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && line.includes('='));

    const services = [
        {
            name: 'flowise',
            image: 'flowiseai/flowise:latest',
            restart: 'always',
            ports: ['3000:3000'],
            volumes: ['flowise_data:/root/.flowise'],
            env: [
                'PORT=3000',
                'DATABASE_PATH=/root/.flowise',
                'APIKEY_PATH=/root/.flowise',
                'LOG_PATH=/root/.flowise/logs',
                ...userEnv
            ]
        }
    ];
    deployComposeStack('flowise', services, ['flowise_data']);
}


function deployComposeStack(project, services, volumes = [], networks = []) {
    showToast(`Deploying ${project} compose stack...`, 'info');
    closeModal();

    // UI Progress Indicator
    const containersList = document.getElementById('containers-list');
    if (containersList) {
        if (containersList.querySelector('.loading') && containersList.children.length === 1) {
            containersList.innerHTML = '';
        }
        const dummyHtml = `
            <div class="compose-group dummy-loading" id="loading-compose-${project.replace(/[^a-z0-9]/gi, '-')}" style="margin-bottom:1.5rem; background:rgba(0,0,0,0.15); border:1px solid rgba(59,130,246,0.3); border-radius:12px; overflow:hidden; grid-column: 1 / -1; box-shadow: 0 0 15px rgba(59,130,246,0.1);">
                <div class="compose-group-header" style="display:flex; justify-content:space-between; align-items:center; padding:1rem 1.25rem; background:rgba(255,255,255,0.03); border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                        <div style="font-weight:700; font-size:1.1rem; color:#e2e8f0;">${project}</div>
                        <span style="font-size:0.65rem; font-weight:700; padding:3px 8px; border-radius:999px; background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3);">Deploying Stack</span>
                    </div>
                </div>
                <div class="compose-group-grid" style="display:flex; align-items:center; justify-content:center; padding:1.5rem; flex-direction:column; gap:1rem;">
                    <div class="spinner" style="width:30px;height:30px;border:3px solid rgba(59,130,246,0.3);border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;"></div>
                    <div style="color:var(--text-muted); font-size:0.9rem;" id="loading-compose-status-${project.replace(/[^a-z0-9]/gi, '-')}">Deploying ${services.length} services... Pulling images & starting containers.</div>
                    <button class="btn btn-sm btn-secondary" style="font-size:0.7rem; padding:0.25rem 0.5rem;" onclick="document.getElementById('loading-compose-logs-${project.replace(/[^a-z0-9]/gi, '-')}').style.display='block'; this.style.display='none';">Show Logs</button>
                </div>
                <div id="loading-compose-logs-${project.replace(/[^a-z0-9]/gi, '-')}" style="display:none; padding:0 1rem 1rem 1rem;">
                    <pre style="background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:0.75rem; font-size:0.75rem; color:#a5b4fc; height:150px; overflow-y:auto; margin:0; white-space:pre-wrap; font-family:monospace; line-height:1.4;" class="deploy-logs">> Starting compose deployment for project '${project}'...
</pre>
                </div>
            </div>
        `;
        containersList.insertAdjacentHTML('afterbegin', dummyHtml);

        // Simulate compose log progress
        const logId = `loading-compose-logs-${project.replace(/[^a-z0-9]/gi, '-')}`;
        const statusId = `loading-compose-status-${project.replace(/[^a-z0-9]/gi, '-')}`;
        setTimeout(() => {
            const logEl = document.querySelector(`#${logId} pre`);
            if (logEl) {
                logEl.innerHTML += `> Creating network ${project}_default (if missing)...\n> Creating volumes: ${volumes.join(', ') || 'none'}...\n`;
                logEl.scrollTop = logEl.scrollHeight;
            }
        }, 1000);
        setTimeout(() => {
            const logEl = document.querySelector(`#${logId} pre`);
            if (logEl) {
                logEl.innerHTML += `> Requesting daemon to pull and start services: ${services.map(s => s.name).join(', ')}\n> (Waiting for image pulls...)\n`;
                logEl.scrollTop = logEl.scrollHeight;
            }
            const statEl = document.getElementById(statusId);
            if (statEl) statEl.innerText = 'Pulling images and linking networks...';
        }, 2500);
        if (!document.getElementById('spin-keyframes')) {
            const style = document.createElement('style');
            style.id = 'spin-keyframes';
            style.textContent = '@keyframes spin { 100% { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
    }

    fetch(`${API_BASE}/compose/deploy`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ project, services, volumes, networks })
    })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => { throw new Error(text || 'Deployment failed'); });
            }
            return response.json();
        })
        .then(data => {
            const logId = `loading-compose-logs-${project.replace(/[^a-z0-9]/gi, '-')}`;
            const logEl = document.querySelector(`#${logId} pre`);
            if (logEl) {
                logEl.innerHTML += `> ✅ Stack deployed! Created ${data.count} containers.\n`;
                logEl.scrollTop = logEl.scrollHeight;
            }
            const statEl = document.getElementById(`loading-compose-status-${project.replace(/[^a-z0-9]/gi, '-')}`);
            if (statEl) statEl.innerText = 'Finishing...';

            showToast(`Successfully deployed ${data.count} containers in ${project} stack!`, 'success');
            setTimeout(() => { if (typeof refreshContainers === 'function') refreshContainers(true); }, 1500);
        })
        .catch(error => {
            const logId = `loading-compose-logs-${project.replace(/[^a-z0-9]/gi, '-')}`;
            const logEl = document.querySelector(`#${logId} pre`);
            if (logEl) {
                logEl.innerHTML += `> ❌ COMPOSE DEPLOYMENT ERROR:\n<span style="color:#fca5a5;">${error.message}</span>\n`;
                logEl.scrollTop = logEl.scrollHeight;
                document.getElementById(logId).style.display = 'block';
            }
            const statEl = document.getElementById(`loading-compose-status-${project.replace(/[^a-z0-9]/gi, '-')}`);
            if (statEl) { statEl.innerText = 'Deployment Failed'; statEl.style.color = '#ef4444'; }

            showToast(`Deploy failed: ${error.message}`, 'error');
            setTimeout(() => { if (typeof refreshContainers === 'function') refreshContainers(true); }, 6000);
        });
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
                        <th style="width: 25%;">Name</th>
                        <th style="width: 100px;">Driver</th>
                        <th style="width: 80px;">Scope</th>
                        <th>Mountpoint</th>
                        <th style="width: 140px;">Created</th>
                        <th style="width: 120px; text-align: right;">Status</th>
                        <th style="width: 80px; text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${volumes.map(vol => {
            const displayName = vol.name.length > 30 ? vol.name.substring(0, 15) + '...' + vol.name.substring(vol.name.length - 10) : vol.name;
            const labelsStr = vol.labels ? Object.entries(vol.labels).map(([k, v]) => `${k}=${v}`).join('\n') : 'No labels';

            return `
                        <tr>
                            <td><span class="status-dot hollow"></span></td>
                            <td style="font-weight: 500;" title="${vol.name}\n\nLabels:\n${labelsStr}">
                                <span class="text-truncate">${displayName}</span>
                            </td>
                            <td class="text-secondary">${vol.driver}</td>
                            <td class="text-secondary"><span style="font-size: 0.75rem;">${vol.scope || 'local'}</span></td>
                            <td class="text-secondary"><code class="text-truncate" style="font-size: 0.75rem;" title="${vol.mountpoint}">${vol.mountpoint}</code></td>
                            <td class="text-secondary" style="font-size: 0.75rem;">${vol.created ? new Date(vol.created).toLocaleString() : 'N/A'}</td>
                            <td style="text-align: right;">
                                ${vol.used ?
                    '<span class="badge badge-success" style="background: rgba(16,185,129,0.1); color: #10b981; font-size: 0.65rem; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.2);">USED</span>' :
                    '<span class="badge badge-secondary" style="background: rgba(107,114,128,0.1); color: #9ca3af; font-size: 0.65rem; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(107,114,128,0.2);">UNUSED</span>'
                }
                            </td>
                            <td style="text-align: right;">
                                <div style="display: flex; gap: 0.25rem; justify-content: flex-end; align-items: center;">
                                    <button class="btn btn-icon-tiny" onclick="inspectVolume('${vol.name}')" title="Inspect Detail">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    </button>
                                    <button class="btn btn-icon-tiny" style="color: #ef4444;" onclick="removeVolume('${vol.name}')" title="Delete Volume">
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
        showToast(`Pruned ${data.volumesDeleted || 0} volumes. Space reclaimed: ${formatBytes(data.spaceReclaimed || 0)}`, 'success');
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
                        <th style="width: 20%;">Name</th>
                        <th style="width: 120px;">Subnet</th>
                        <th style="width: 120px;">Gateway</th>
                        <th style="width: 100px;">Driver</th>
                        <th style="width: 80px;">Scope</th>
                        <th>Created</th>
                        <th style="width: 120px; text-align: right;">Status</th>
                        <th style="width: 80px; text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${networks.map(net => {
            const isSystem = ['bridge', 'host', 'none'].includes(net.name);
            const statusDot = isSystem ? '<span class="status-dot hollow"></span>' : '<span class="status-dot solid" style="background: #6366f1;"></span>';
            const labelsStr = net.labels ? Object.entries(net.labels).map(([k, v]) => `${k}=${v}`).join('\n') : 'No labels';

            return `
                            <tr>
                                <td>${statusDot}</td>
                                <td style="font-weight: 500;" title="${net.name}\n\nID: ${net.id}\nLabels:\n${labelsStr}">
                                    <span class="text-truncate">${net.name}</span>
                                </td>
                                <td class="text-secondary"><span style="font-size: 0.75rem;">${net.ipv4_subnet || '-'}</span></td>
                                <td class="text-secondary"><span style="font-size: 0.75rem;">${net.ipv4_gateway || '-'}</span></td>
                                <td class="text-secondary">${net.driver}</td>
                                <td class="text-secondary">${net.scope || 'local'}</td>
                                <td class="text-secondary" style="font-size: 0.75rem;">${net.created}</td>
                                <td style="text-align: right;">
                                    <div style="display: flex; gap: 0.25rem; justify-content: flex-end; align-items: center;">
                                        ${net.used ?
                    '<span class="badge" style="background: rgba(16,185,129,0.1); color: #10b981; font-size: 0.65rem; padding: 2px 6px; border: 1px solid rgba(16,185,129,0.2);">USED</span>' :
                    '<span class="badge" style="background: rgba(107,114,128,0.1); color: #9ca3af; font-size: 0.65rem; padding: 2px 6px; border: 1px solid rgba(107,114,128,0.2);">UNUSED</span>'
                }
                                        ${isSystem ? '<span class="badge" style="font-size: 0.65rem; opacity: 0.6; padding: 2px 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">SYSTEM</span>' : ''}
                                    </div>
                                </td>
                                <td style="text-align: right;">
                                    <div style="display: flex; gap: 0.25rem; justify-content: flex-end;">
                                        <button class="btn btn-icon-tiny" onclick="inspectNetwork('${net.id}')" title="Inspect Network">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        </button>
                                        ${!isSystem ?
                    `<button class="btn btn-icon-tiny" style="color: #ef4444;" onclick="removeNetwork('${net.id}', '${net.name}')" title="Delete Network">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                            </button>` : ''
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
        const networkOptions = (networks || []).map(n =>
            `<option value="${n.name}">${n.name} (${n.driver})</option>`
        ).join('');

        const volumeOptions = (volumes || []).map(v =>
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

    // UI Progress Indicator
    const containersList = document.getElementById('containers-list');
    if (containersList) {
        if (containersList.querySelector('.loading') && containersList.children.length === 1) {
            containersList.innerHTML = '';
        }
        const dummyHtml = `
            <div class="card dummy-loading" id="loading-${name.replace(/[^a-z0-9]/gi, '-')}" style="border-color: rgba(59,130,246,0.3); box-shadow: 0 0 15px rgba(59,130,246,0.1);">
                <div class="card-header">
                    <div style="display:flex;align-items:center;gap:0.5rem;min-width:0;flex:1;">
                        <div class="card-title" title="${name}" style="min-width:0;">${name}</div>
                    </div>
                    <div class="card-status" style="background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.2);">Installing</div>
                </div>
                <div style="padding:1.5rem 1rem;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;">
                    <div class="spinner" style="width:30px;height:30px;border:3px solid rgba(59,130,246,0.3);border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;"></div>
                    <div style="color:var(--text-muted);font-size:0.8rem;" id="loading-status-${name.replace(/[^a-z0-9]/gi, '-')}">Preparing deployment...</div>
                    <button class="btn btn-sm btn-secondary" style="font-size:0.7rem; padding:0.25rem 0.5rem;" onclick="document.getElementById('loading-logs-${name.replace(/[^a-z0-9]/gi, '-')}').style.display='block'; this.style.display='none';">Show Logs</button>
                </div>
                <div id="loading-logs-${name.replace(/[^a-z0-9]/gi, '-')}" style="display:none; padding:0 1rem 1rem 1rem;">
                    <pre style="background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:0.75rem; font-size:0.75rem; color:#a5b4fc; height:120px; overflow-y:auto; margin:0; white-space:pre-wrap; font-family:monospace; line-height:1.4;" class="deploy-logs">> Starting deployment for container ${name}...
</pre>
                </div>
            </div>
        `;
        containersList.insertAdjacentHTML('afterbegin', dummyHtml);

        // Simulate log progress for better UX during synchronous API call
        const logId = `loading-logs-${name.replace(/[^a-z0-9]/gi, '-')}`;
        const statusId = `loading-status-${name.replace(/[^a-z0-9]/gi, '-')}`;
        setTimeout(() => {
            const logEl = document.querySelector(`#${logId} pre`);
            const statEl = document.getElementById(statusId);
            if (logEl) { logEl.innerHTML += `> Creating volume bindings...\n> Checking network... ${networkMode || 'default'}\n`; logEl.scrollTop = logEl.scrollHeight; }
            if (statEl) statEl.innerText = 'Configuring resources...';
        }, 800);
        setTimeout(() => {
            const logEl = document.querySelector(`#${logId} pre`);
            const statEl = document.getElementById(statusId);
            if (logEl) { logEl.innerHTML += `> Requesting Docker daemon to pull image: ${image}\n> (This may take a while depending on image size and network...)\n`; logEl.scrollTop = logEl.scrollHeight; }
            if (statEl) statEl.innerText = 'Pulling image & generating container...';
        }, 1500);
        if (!document.getElementById('spin-keyframes')) {
            const style = document.createElement('style');
            style.id = 'spin-keyframes';
            style.textContent = '@keyframes spin { 100% { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
    }

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

        const logId = `loading-logs-${name.replace(/[^a-z0-9]/gi, '-')}`;
        const logEl = document.querySelector(`#${logId} pre`);
        const statEl = document.getElementById(`loading-status-${name.replace(/[^a-z0-9]/gi, '-')}`);

        if (response.ok) {
            const data = await response.json();
            const warnings = data.warnings || [];

            if (logEl) {
                logEl.innerHTML += `> ✅ Container generated successfully.\n> Container ID: ${data.id || 'N/A'}\n`;
                logEl.scrollTop = logEl.scrollHeight;
            }
            if (statEl) statEl.innerText = 'Finishing...';

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
            if (logEl) {
                logEl.innerHTML += `> ❌ DEPLOYMENT FAILED:\n<span style="color:#fca5a5;">${errorText}</span>\n`;
                logEl.scrollTop = logEl.scrollHeight;
                document.getElementById(logId).style.display = 'block';
                if (statEl) { statEl.innerText = 'Deployment Failed'; statEl.style.color = '#ef4444'; }
            }
            showToast(`Failed to deploy container`, 'error');
            setTimeout(() => { if (typeof refreshContainers === 'function') refreshContainers(true); }, 5000);
        }
    } catch (error) {
        const logId = `loading-logs-${name.replace(/[^a-z0-9]/gi, '-')}`;
        const logEl = document.querySelector(`#${logId} pre`);
        const statEl = document.getElementById(`loading-status-${name.replace(/[^a-z0-9]/gi, '-')}`);

        if (logEl) {
            logEl.innerHTML += `> ❌ DEPLOYMENT ERROR:\n<span style="color:#fca5a5;">${error.message}</span>\n`;
            logEl.scrollTop = logEl.scrollHeight;
            document.getElementById(logId).style.display = 'block';
            if (statEl) { statEl.innerText = 'System Error'; statEl.style.color = '#ef4444'; }
        }
        showToast('Error deploying container: ' + error.message, 'error');
        setTimeout(() => { if (typeof refreshContainers === 'function') refreshContainers(true); }, 5000);
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
