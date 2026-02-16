// Xterm.js Terminal Implementation
let term = null;
let fitAddon = null;
let ws = null;
let containerId = '';
let containerName = '';

// Get container ID from URL parameter
function getContainerIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Get container name from URL parameter
function getContainerNameFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('name') || 'Container';
}

// Toast notification function
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

// Update connection status
function updateStatus(status) {
    const statusEl = document.getElementById('terminal-status');
    statusEl.className = 'terminal-status';

    if (status === 'connected') {
        statusEl.classList.add('connected');
        statusEl.textContent = 'Connected';
    } else if (status === 'disconnected') {
        statusEl.classList.add('disconnected');
        statusEl.textContent = 'Disconnected';
    }
}

// Clear terminal
function clearTerminal() {
    if (term) {
        term.clear();
        showToast('Terminal cleared', 'success');
    }
}

// Close terminal and go back
function closeTerminal() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
    window.location.href = '/';
}

// Initialize Xterm.js
function initXterm() {
    // Create terminal instance with Linux-like appearance
    term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontFamily: '"Cascadia Code", "Fira Code", "Courier New", monospace',
        fontSize: 14,
        lineHeight: 1.2,
        theme: {
            background: '#000000',
            foreground: '#ffffff',
            cursor: '#ffffff',
            cursorAccent: '#000000',
            black: '#000000',
            red: '#cd0000',
            green: '#00cd00',
            yellow: '#cdcd00',
            blue: '#0000ee',
            magenta: '#cd00cd',
            cyan: '#00cdcd',
            white: '#e5e5e5',
            brightBlack: '#7f7f7f',
            brightRed: '#ff0000',
            brightGreen: '#00ff00',
            brightYellow: '#ffff00',
            brightBlue: '#5c5cff',
            brightMagenta: '#ff00ff',
            brightCyan: '#00ffff',
            brightWhite: '#ffffff'
        },
        allowProposedApi: true,
        scrollback: 10000,
        convertEol: false
    });

    // Create fit addon for responsive terminal
    fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);

    // Open terminal in the container
    term.open(document.getElementById('terminal'));

    // Fit terminal to container
    fitAddon.fit();

    // Write welcome message
    term.writeln('\x1b[1;32m╔═══════════════════════════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[1;32m║\x1b[0m  \x1b[1;36mDocker Container Terminal\x1b[0m                            \x1b[1;32m║\x1b[0m');
    term.writeln('\x1b[1;32m╚═══════════════════════════════════════════════════════════╝\x1b[0m');
    term.writeln('');
    term.writeln('\x1b[33mConnecting to container...\x1b[0m');
    term.writeln('');

    // Handle window resize
    window.addEventListener('resize', () => {
        if (fitAddon) {
            fitAddon.fit();
        }
    });

    // Connect WebSocket after terminal is ready
    connectWebSocket();
}

// Connect to WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/containers/${containerId}/exec`;

    try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            term.writeln('\x1b[1;32m✓ Connected to container shell\x1b[0m');
            term.writeln('');
            updateStatus('connected');
            showToast('Connected to container', 'success');

            // Send input from terminal to WebSocket
            term.onData(data => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(data);
                }
            });
        };

        ws.onmessage = (event) => {
            // Write data from container to terminal
            term.write(event.data);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            term.writeln('\r\n\x1b[1;31m✗ WebSocket error occurred\x1b[0m');
            updateStatus('disconnected');
            showToast('Connection error', 'error');
        };

        ws.onclose = () => {
            term.writeln('\r\n\r\n\x1b[1;33m✗ Connection closed\x1b[0m');
            term.writeln('\x1b[90mPress any key to return to dashboard...\x1b[0m');
            updateStatus('disconnected');
            showToast('Connection closed', 'warning');

            // Allow one keypress to go back
            const disposable = term.onData(() => {
                disposable.dispose();
                setTimeout(() => window.location.href = '/', 500);
            });
        };
    } catch (error) {
        console.error('Failed to connect:', error);
        term.writeln('\x1b[1;31m✗ Failed to connect to container\x1b[0m');
        updateStatus('disconnected');
        showToast('Connection failed', 'error');
    }
}

// Initialize terminal
function initTerminal() {
    containerId = getContainerIdFromURL();
    containerName = getContainerNameFromURL();

    if (!containerId) {
        showToast('No container ID provided', 'error');
        setTimeout(() => window.location.href = '/', 2000);
        return;
    }

    // Set container name in header
    document.getElementById('container-name').textContent = `Terminal: ${containerName}`;

    // Initialize xterm.js terminal
    initXterm();

    // Handle window close
    window.addEventListener('beforeunload', () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
        if (term) {
            term.dispose();
        }
    });
}

// Start when page loads
document.addEventListener('DOMContentLoaded', initTerminal);
