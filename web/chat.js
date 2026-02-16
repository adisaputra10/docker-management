/* Chat Logic */
document.addEventListener('DOMContentLoaded', () => {
    const chatButton = document.getElementById('chat-button');
    const chatWindow = document.getElementById('chat-window');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('chat-messages');
    const settingsButton = document.getElementById('chat-settings-btn');
    const settingsPanel = document.getElementById('chat-settings');
    const saveSettingsButton = document.getElementById('save-settings-btn');
    const closeSettingsButton = document.getElementById('close-settings-btn');

    // Toggle Chat Window
    if (chatButton) {
        chatButton.addEventListener('click', () => {
            chatWindow.classList.toggle('active');
            if (chatWindow.classList.contains('active')) {
                chatInput.focus();
                scrollToBottom();
            }
        });
    }

    // Toggle Settings
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            settingsPanel.classList.toggle('active');
            if (settingsPanel.classList.contains('active')) {
                loadSettings();
            }
        });
    }

    if (closeSettingsButton) {
        closeSettingsButton.addEventListener('click', () => {
            settingsPanel.classList.remove('active');
        });
    }

    // Save Settings
    if (saveSettingsButton) {
        saveSettingsButton.addEventListener('click', async () => {
            const apiKey = document.getElementById('openai-key').value;
            const model = document.getElementById('openai-model').value;
            const baseUrl = document.getElementById('openai-url').value;

            try {
                await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey, model, baseUrl })
                });
                showToast('Settings saved!', 'success');
                settingsPanel.classList.remove('active');
            } catch (error) {
                showToast('Failed to save settings', 'error');
            }
        });
    }

    async function loadSettings() {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            document.getElementById('openai-key').value = data.apiKey || '';
            document.getElementById('openai-key').placeholder = data.apiKey ? 'Enter new key to update' : 'sk-...';
            document.getElementById('openai-model').value = data.model || 'gpt-3.5-turbo';
            document.getElementById('openai-url').value = data.baseUrl || 'https://api.openai.com/v1';
        } catch (error) {
            console.error('Failed to load settings', error);
        }
    }

    // Send Message
    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Add user message
        addMessage(text, 'user');
        chatInput.value = '';

        // Show typing indicator
        const typingId = showTyping();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            removeTyping(typingId);

            if (!response.ok) {
                const errText = await response.text();
                // If it's HTML (from 500 error page), strip tags or show generic
                if (errText.includes('<!DOCTYPE html>') || errText.includes('<html>')) {
                    throw new Error(response.statusText);
                }
                throw new Error(errText);
            }

            const data = await response.json();
            addMessage(data.reply, 'assistant');

        } catch (error) {
            removeTyping(typingId);
            addMessage(`Error: ${error.message}`, 'system');
        }
    }

    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    function addMessage(text, role) {
        const div = document.createElement('div');
        div.className = `message ${role}`;

        // Simple markdown formatting
        if (role === 'assistant') {
            // 1. Triple backticks
            text = text.replace(/```(\w*)([\s\S]*?)```/g, (match, lang, code) => {
                return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
            });
            // 2. Single backticks
            text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
            // 3. Newlines to br (only outside of pre tags?? simplified logic: replaces ALL, CSS handles pre)
            // Actually, pre tags preserve whitespace. We shouldn't replace newlines inside them.
            // But simpler approach for now:
            text = text.replace(/\n/g, '<br>');
            // Fix pre tags double-spacing if any
            div.innerHTML = text;
        } else {
            div.textContent = text;
        }

        messagesContainer.appendChild(div);
        scrollToBottom();
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function (m) { return map[m]; });
    }

    function showTyping() {
        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.className = 'typing-indicator';
        div.id = id;
        div.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        messagesContainer.appendChild(div);
        scrollToBottom();
        return id;
    }

    function removeTyping(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});
