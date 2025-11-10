/**
 * Chat UI Component
 * Mimics GitHub Copilot chat interface
 */

class CopilotChatUI {
  constructor() {
    this.container = null;
    this.messages = [];
    this.isMinimized = false;
    this.currentTabUrl = null;
  }

  // Helper to send a message to the background and await response reliably
  runtimeSendMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (resp) => {
          // In some environments the callback may not be invoked; guard against that
          try { resolve(resp); } catch (e) { resolve(undefined); }
        });
      } catch (e) {
        resolve(undefined);
      }
    });
  }

  /**
   * Poll session status and update the chat UI with live steps
   */
  startSessionPoll(sessionId) {
    if (!this.container) return;
    const messagesContainer = this.container.querySelector('#chat-messages');
    const statusId = `session-${sessionId}`;

    let statusMsg = document.getElementById(statusId);
    if (!statusMsg) {
      statusMsg = document.createElement('div');
      statusMsg.className = 'chat-message chat-message-assistant';
      statusMsg.id = statusId;
      statusMsg.innerHTML = `<div class="message-avatar">⏳</div><div class="message-content">Session started...</div>`;
      messagesContainer.appendChild(statusMsg);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    const iv = setInterval(async () => {
      try {
        const resp = await fetch(`http://localhost:8765/gemini/session/${sessionId}`);
        const j = await resp.json();
        if (!j.success) return;
        const s = j.session;
        const trace = s.trace || [];
        const last = trace.length ? trace[trace.length-1] : null;
        const content = last ? `Iteration ${last.iteration}: ${last.tool} ${last.args ? JSON.stringify(last.args) : ''}` : `Status: ${s.status}`;
        const contentEl = statusMsg.querySelector('.message-content');
        if (contentEl) contentEl.innerHTML = this.formatMessage(content);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        if (s.status === 'finished' || s.status === 'error') {
          clearInterval(iv);
          let final = s.result || s.error || 'Session ended';
          // Ensure final is not empty
          if (final && typeof final === 'object') {
            const stringified = JSON.stringify(final);
            if (stringified === '{}' || stringified === '[]' || stringified.trim() === '') {
              final = s.status === 'finished' ? 'Task completed successfully.' : 'Task ended with an error.';
            } else {
              final = stringified;
            }
          } else if (!final || (typeof final === 'string' && final.trim() === '')) {
            final = s.status === 'finished' ? 'Task completed successfully.' : 'Task ended with an error.';
          }
          const finalMsg = document.createElement('div');
          finalMsg.className = 'chat-message chat-message-assistant';
          finalMsg.innerHTML = `<div class="message-avatar">${s.status === 'finished' ? '✅' : '❌'}</div><div class="message-content">${this.formatMessage(final)}</div>`;
          messagesContainer.appendChild(finalMsg);
          statusMsg.remove();
        }
      } catch (e) {
        // ignore polling errors
      }
    }, 1000);
  }

  /**
   * Clean up any empty message bubbles in the DOM
   */
  cleanupEmptyMessages() {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const messageElements = messagesContainer.querySelectorAll('.chat-message');
    messageElements.forEach(msgEl => {
      const contentDiv = msgEl.querySelector('.message-content');
      if (contentDiv) {
        const textContent = contentDiv.textContent || '';
        const innerHTML = contentDiv.innerHTML || '';
        // Check if content is effectively empty
        if (textContent.trim() === '' && innerHTML.trim() === '') {
          // Remove empty message bubbles
          msgEl.remove();
        } else if (textContent.trim() === '' && innerHTML.includes('(empty message)')) {
          // Replace placeholder with helpful message
          contentDiv.innerHTML = '<span style="opacity: 0.6;">Response was empty. Please try again.</span>';
        }
      }
    });
  }

  /**
   * Initialize the chat UI
   */
  init() {
    // Only initialize if not already initialized
    if (this.container && document.getElementById('mcp-copilot-chat')) {
      // Already initialized, just ensure it's visible and clean up empty messages
      this.cleanupEmptyMessages();
      this.show();
      return;
    }
    
    this.createChatContainer();
    this.loadMessages();
    this.setupEventListeners();
    this.getCurrentTabUrl();
    
    // Clean up any empty messages after a short delay to ensure DOM is ready
    setTimeout(() => {
      this.cleanupEmptyMessages();
    }, 100);
    
    // Ensure chat is visible by default (but start hidden, show on first toggle)
    // Chat will be shown when user clicks toggle button
    this.container.style.display = 'none';
  }

  // Simple client-side logger that posts to bridge server for persistence (non-blocking)
  async sendLog(level, message, meta) {
    try {
      const url = 'http://localhost:8765/logs';
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, message, meta }),
      }).catch(() => {});
    } catch (e) {
      // ignore
    }
  }

  /**
   * Get current tab URL
   */
  async getCurrentTabUrl() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_TAB_URL' });
      if (response.success) {
        this.currentTabUrl = response.url;
      }
    } catch (error) {
      this.sendLog('error', 'Error getting tab URL', { error: String(error) });
    }
  }

  /**
   * Create the chat container HTML
   */
  createChatContainer() {
    // Remove existing container if any
    const existing = document.getElementById('mcp-copilot-chat');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'mcp-copilot-chat';
    container.innerHTML = `
      <div class="chat-header">
      <div class="chat-header-content">
        <div class="chat-header-icon">🤖</div>
        <div class="chat-header-title">MCP Copilot</div>
        <div class="chat-header-subtitle">Gemini AI Agent</div>
      </div>
        <div class="chat-header-actions">
          <label style="display:flex;align-items:center;gap:6px;margin-right:10px;font-size:12px;">
            <input type="checkbox" id="chat-autosession" />
            <span>Auto-session</span>
          </label>
          <button class="chat-button-minimize" id="chat-minimize" title="Minimize">−</button>
          <button class="chat-button-close" id="chat-close" title="Close">×</button>
        </div>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-input-container">
        <div class="chat-input-wrapper">
          <textarea 
            id="chat-input" 
            class="chat-input" 
            placeholder="Ask me to automate this page with Playwright..."
            rows="1"
          ></textarea>
          <button class="chat-send-button" id="chat-send" title="Send">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M1.5 1.5L14.5 8L1.5 14.5V9.5L10.5 8L1.5 6.5V1.5Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <div class="chat-suggestions">
          <button class="suggestion-chip" data-action="screenshot">Take screenshot</button>
          <button class="suggestion-chip" data-action="analyze">Analyze page</button>
          <button class="suggestion-chip" data-action="click">Click element</button>
          <button class="suggestion-chip" data-action="fill">Fill form</button>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    // Add welcome message
    this.addMessage({
      role: 'assistant',
      content: 'Hello! I\'m your MCP Copilot agent powered by Gemini AI and Playwright. I can help you automate browser tasks, take screenshots, analyze pages, and interact with elements using natural language. What would you like me to do?',
    });

    // Auto-session control default
    this.autoSession = false;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const input = document.getElementById('chat-input');
    const sendButton = document.getElementById('chat-send');
    const minimizeButton = document.getElementById('chat-minimize');
    const closeButton = document.getElementById('chat-close');
    const suggestions = document.querySelectorAll('.suggestion-chip');

    // Send message on Enter (Shift+Enter for new line)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 'px';
    });

    // Send button click
    sendButton.addEventListener('click', () => this.sendMessage());

    // Minimize button
    minimizeButton.addEventListener('click', () => this.toggleMinimize());

    // Close button
    closeButton.addEventListener('click', () => this.hide());

    // Suggestion chips
    suggestions.forEach(chip => {
      chip.addEventListener('click', () => {
        const action = chip.dataset.action;
        this.handleSuggestion(action);
      });
    });

    // Auto-session toggle: send a persistent log so bridge can record toggle events
    const autosessionEl = document.getElementById('chat-autosession');
    if (autosessionEl) {
      autosessionEl.addEventListener('change', () => {
        try {
          this.autoSession = autosessionEl.checked;
          this.sendLog('info', 'Auto-session toggled', { checked: autosessionEl.checked });
        } catch (e) {
          // ignore logging errors
        }
      });
    }
  }

  /**
   * Handle suggestion chip clicks
   */
  async handleSuggestion(action) {
    switch (action) {
      case 'screenshot':
        await this.sendMessage('Take a screenshot of this page');
        break;
      case 'analyze':
        await this.sendMessage('Analyze this page and tell me what elements are available');
        break;
      case 'click':
        await this.sendMessage('Show me how to click on an element');
        break;
      case 'fill':
        await this.sendMessage('Help me fill out a form on this page');
        break;
    }
  }

  /**
   * Send a message
   */
  async sendMessage(userMessage = null) {
    const input = document.getElementById('chat-input');
    const message = userMessage || input.value.trim();

    if (!message) return;

    // Clear input
    if (!userMessage) {
      input.value = '';
      input.style.height = 'auto';
    }

    // Add user message
    this.addMessage({
      role: 'user',
      content: message,
    });

    // Show thinking indicator
    const thinkingId = this.addMessage({
      role: 'assistant',
      content: 'Thinking...',
      thinking: true,
    });

    try {
      // Process the message and call MCP tools
      const autosessionEl = document.getElementById('chat-autosession');
      const useAutoSession = autosessionEl && autosessionEl.checked;
      const response = await this.processMessage(message, { autoSession: useAutoSession });
      
      // Remove thinking indicator
      this.removeMessage(thinkingId);
      // Add assistant response or start session polling
      // Only add message if response is not empty
      if (response && (typeof response === 'string' ? response.trim() !== '' : true)) {
        this.addMessage({ role: 'assistant', content: response });
      } else {
        // If response is empty, show a helpful message
        this.addMessage({ 
          role: 'assistant', 
          content: 'I received your message, but the response was empty. Please try again or check if the MCP bridge server is running correctly.' 
        });
      }

      // If response was a session start message containing 'Session started (id=', try to parse sessionId and poll
      try {
        const m = /Session started \(id=(\w+)\)/.exec(response);
        if (m) {
          const sessionId = m[1];
          this.startSessionPoll(sessionId);
        }
      } catch (e) {}
    } catch (error) {
      // Remove thinking indicator
      this.removeMessage(thinkingId);

      // Add error message
      this.addMessage({
        role: 'assistant',
        content: `Error: ${error.message}`,
        error: true,
      });
    }

    this.saveMessages();
  }

  /**
   * Process message using Gemini AI agent
   */
  async processMessage(message) {
    try {
      // Ensure MCP is connected
      await this.ensureMCPConnected();

      // Get or initialize Gemini API key
  const apiKeyResult = await this.runtimeSendMessage({ type: 'GET_API_KEY' });
      if (!apiKeyResult.success || !apiKeyResult.apiKey) {
        return `⚠️ Gemini API key not configured. Please set your API key in the extension popup (click the extension icon).\n\nTo get a Gemini API key:\n1. Go to https://makersuite.google.com/app/apikey\n2. Create a new API key\n3. Copy it and paste it in the extension popup settings`;
      }

      // Initialize Gemini agent if needed
      const initResult = await this.runtimeSendMessage({
        type: 'GEMINI_INITIALIZE',
        apiKey: apiKeyResult.apiKey,
      });

      if (!initResult.success) {
        return `Failed to initialize Gemini agent: ${initResult.error}. Please check your API key and try again.`;
      }

      // Send message to Gemini agent
      const response = await this.runtimeSendMessage({
        type: 'GEMINI_CHAT',
        message: message,
        context: {
          currentUrl: this.currentTabUrl,
        },
        // forward autoSession option if provided by caller
        autoSession: (arguments[1] && arguments[1].autoSession) || false,
      });

      // Debugging: log raw bridge response to help diagnose formatting errors
      try { console.debug('Raw bridge response (chat-ui):', response); } catch (e) {}

      if (response.success) {
        // If bridge started a background session, it will return a sessionId for polling
        if (response.sessionId) {
          // Kick off polling from the UI and return a friendly message
          try { this.startSessionPoll(response.sessionId); } catch (e) {}
          return `Session started (id=${response.sessionId}). Tracking progress...`;
        }

        // If the bridge started a session object, prefer a human-friendly message
        if (response.session) {
          const sessionMsg = response.session.message || JSON.stringify(response.session);
          // Ensure session message is not empty
          if (!sessionMsg || (typeof sessionMsg === 'string' && sessionMsg.trim() === '')) {
            return 'Session started. Processing your request...';
          }
          return sessionMsg;
        }

        // Ensure response is not empty
        const responseText = response.response;
        if (!responseText || (typeof responseText === 'string' && responseText.trim() === '')) {
          return 'I received your message, but the response was empty. Please try again.';
        }
        return responseText;
      } else {
        return `Error: ${response.error || 'Unknown error occurred'}`;
      }
    } catch (error) {
      this.sendLog('error', 'Error processing message', { error: String(error) });
      return `Error processing your message: ${error.message}. Make sure the MCP bridge server is running.`;
    }
  }

  /**
   * Ensure MCP is connected
   */
  async ensureMCPConnected() {
    const response = await chrome.runtime.sendMessage({ type: 'MCP_CONNECT' });
    if (!response.success) {
      throw new Error('Failed to connect to MCP server. Make sure Playwright MCP server is installed.');
    }
  }

  /**
   * Add a message to the chat
   */
  addMessage(message) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return null;
    
    // Validate message before proceeding
    if (!message || !message.role) {
      return null;
    }
    
    // Ensure content is not empty (except for thinking indicators)
    let content = message.content;
    if (content === undefined || content === null) {
      if (!message.thinking) {
        // Don't add empty messages (except thinking indicators)
        return null;
      }
      content = 'Thinking...';
    } else if (typeof content === 'string' && content.trim() === '' && !message.thinking) {
      // Don't add empty messages (except thinking indicators)
      return null;
    }
    
    const messageId = message.id || `msg-${Date.now()}-${Math.random()}`;
    
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message chat-message-${message.role}`;
    messageEl.id = messageId;
    messageEl.dataset.messageId = messageId;

    // Format the content and ensure it's not empty
    const formattedContent = this.formatMessage(content);
    
    // Double-check that formatted content is not empty
    if (!formattedContent || formattedContent.trim() === '' || formattedContent === '<span style="opacity: 0.6;">(empty message)</span>') {
      if (!message.thinking) {
        // Replace empty content with a helpful message
        content = 'I received your message, but the response was empty. Please try again.';
      }
    }

    if (message.role === 'user') {
      messageEl.innerHTML = `
        <div class="message-content">${this.formatMessage(content)}</div>
      `;
    } else {
      const icon = message.error ? '❌' : message.thinking ? '⏳' : '🤖';
      messageEl.innerHTML = `
        <div class="message-avatar">${icon}</div>
        <div class="message-content">${this.formatMessage(content)}</div>
      `;
    }

    // Verify the content div was populated
    const contentDiv = messageEl.querySelector('.message-content');
    if (contentDiv && (!contentDiv.textContent || contentDiv.textContent.trim() === '')) {
      if (!message.thinking) {
        contentDiv.innerHTML = '<span style="opacity: 0.6;">Response was empty. Please try again.</span>';
      }
    }

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Only save non-empty messages (except thinking indicators which are temporary)
    if (!message.thinking) {
      const existingIndex = this.messages.findIndex(m => m.id === messageId);
      if (existingIndex >= 0) {
        this.messages[existingIndex] = { ...message, id: messageId, content };
      } else {
        this.messages.push({ ...message, id: messageId, content });
      }
    }
    
    return messageId;
  }

  /**
   * Remove a message
   */
  removeMessage(messageId) {
    const messageEl = document.getElementById(messageId);
    if (messageEl) {
      messageEl.remove();
    }
    this.messages = this.messages.filter(m => m.id !== messageId);
  }

  /**
   * Format message content (support markdown-like formatting)
   */
  formatMessage(content) {
    // Simple markdown formatting
    if (content === undefined || content === null) {
      return '<span style="opacity: 0.6;">(empty message)</span>';
    }
    
    const contentStr = String(content);
    if (contentStr.trim() === '') {
      return '<span style="opacity: 0.6;">(empty message)</span>';
    }
    
    let formatted = contentStr
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/\n/g, '<br>');
    
    return formatted;
  }

  /**
   * Toggle minimize
   */
  toggleMinimize() {
    if (!this.container) return;
    
    this.isMinimized = !this.isMinimized;
    if (this.isMinimized) {
      this.container.classList.add('minimized');
    } else {
      this.container.classList.remove('minimized');
      // Ensure it's visible when unminimized
      this.show();
    }
  }

  /**
   * Hide chat
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
      this.container.style.visibility = 'hidden';
    }
  }

  /**
   * Show chat
   */
  show() {
    if (this.container) {
      this.container.style.display = 'flex';
      this.container.style.visibility = 'visible';
      this.isMinimized = false;
      this.container.classList.remove('minimized');
      // Bring to front
      this.container.style.zIndex = '2147483647';
      // Clean up any empty messages when showing
      setTimeout(() => {
        this.cleanupEmptyMessages();
      }, 50);
    }
  }

  /**
   * Save messages to storage
   */
  async saveMessages() {
    try {
      await chrome.storage.local.set({ chatMessages: this.messages });
    } catch (error) {
      this.sendLog('error', 'Error saving messages', { error: String(error) });
    }
  }

  /**
   * Load messages from storage
   */
  async loadMessages() {
    try {
      const result = await chrome.storage.local.get('chatMessages');
      if (result.chatMessages) {
        // Filter out empty messages before restoring
        this.messages = result.chatMessages.filter(msg => {
          if (!msg.role) return false;
          // Only include messages with valid non-empty content (except thinking indicators)
          if (msg.thinking) return true;
          const content = msg.content;
          if (content === undefined || content === null) return false;
          if (typeof content === 'string' && content.trim() === '') return false;
          return true;
        });
        // Restore messages in UI
        this.messages.forEach(msg => {
          this.addMessage(msg);
        });
      }
    } catch (error) {
      this.sendLog('error', 'Error loading messages', { error: String(error) });
    }
  }
}

// Initialize chat UI when DOM is ready
(function() {
  // Wait a bit to ensure page is fully loaded
  function initChat() {
    try {
      if (!window.copilotChat) {
        window.copilotChat = new CopilotChatUI();
        window.copilotChat.init();
        // Log initialization (non-blocking)
        try { window.copilotChat.sendLog('info', 'MCP Copilot Chat UI initialized'); } catch(e) { /* fallback */ }
      }
    } catch (error) {
      try { window.copilotChat && window.copilotChat.sendLog('error', 'Error initializing chat UI', { error: String(error) }); } catch(e) { /* fallback */ }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Small delay to ensure styles are loaded
      setTimeout(initChat, 100);
    });
  } else {
    // DOM already ready, initialize after a short delay
    setTimeout(initChat, 100);
  }
})();

