/**
 * Simplified Content Script
 * Directly creates and manages chat UI without external script injection
 */

// Inject styles
(function injectStyles() {
  if (document.querySelector('#mcp-copilot-styles')) return;
  
  const style = document.createElement('link');
  style.id = 'mcp-copilot-styles';
  style.rel = 'stylesheet';
  style.href = chrome.runtime.getURL('src/styles.css');
  document.head.appendChild(style);
})();

// Logging helper to send logs to the bridge server
const BRIDGE_LOG_URL_SIMPLE = 'http://localhost:8765/logs';
function postLog(level, message, meta) {
  try {
    fetch(BRIDGE_LOG_URL_SIMPLE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, meta }),
    }).catch(() => {});
  } catch (e) {}
}

// Chat UI state
let chatContainer = null;
let isChatVisible = false;

// Create chat container
function createChatContainer() {
  if (chatContainer && document.getElementById('mcp-copilot-chat')) {
    return chatContainer;
  }

  // Remove existing if any
  const existing = document.getElementById('mcp-copilot-chat');
  if (existing) {
    existing.remove();
  }

  chatContainer = document.createElement('div');
  chatContainer.id = 'mcp-copilot-chat';
  chatContainer.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-content">
        <div class="chat-header-icon">🤖</div>
        <div class="chat-header-title">MCP Copilot</div>
        <div class="chat-header-subtitle">Gemini AI Agent</div>
      </div>
      <div class="chat-header-actions">
        <label style="display:flex;align-items:center;gap:6px;margin-right:10px;font-size:12px;color:#cccccc;">
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

  // Add welcome message
  const messagesContainer = chatContainer.querySelector('#chat-messages');
  const welcomeMsg = document.createElement('div');
  welcomeMsg.className = 'chat-message chat-message-assistant';
  welcomeMsg.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-content">Hello! I'm your MCP Copilot agent powered by Gemini AI and Playwright. I can help you automate browser tasks, take screenshots, analyze pages, and interact with elements using natural language. What would you like me to do?</div>
  `;
  messagesContainer.appendChild(welcomeMsg);

  // Setup event listeners
  setupChatListeners(chatContainer);

  // Start hidden
  chatContainer.style.display = 'none';
  document.body.appendChild(chatContainer);

  return chatContainer;
}

// Setup event listeners
function setupChatListeners(container) {
  const input = container.querySelector('#chat-input');
  const sendButton = container.querySelector('#chat-send');
  const minimizeButton = container.querySelector('#chat-minimize');
  const closeButton = container.querySelector('#chat-close');
  const suggestions = container.querySelectorAll('.suggestion-chip');

  // Auto-session toggle: log when user changes checkbox so bridge receives the event
  const autosessionEl = container.querySelector('#chat-autosession');
  if (autosessionEl) {
    autosessionEl.addEventListener('change', () => {
      try {
        postLog('info', 'Auto-session toggled', { checked: autosessionEl.checked });
      } catch (e) {
        // best-effort, do not block UI
      }
    });
  }

  // Send message
  function sendMessage() {
    const message = input.value.trim();
    if (!message) return;

    // Add user message
    const messagesContainer = container.querySelector('#chat-messages');
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message chat-message-user';
    userMsg.innerHTML = `<div class="message-content">${message}</div>`;
    messagesContainer.appendChild(userMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Show thinking
    const thinkingMsg = document.createElement('div');
    thinkingMsg.className = 'chat-message chat-message-assistant';
    thinkingMsg.id = 'thinking-msg';
    thinkingMsg.innerHTML = `
      <div class="message-avatar">⏳</div>
      <div class="message-content">Thinking...</div>
    `;
    messagesContainer.appendChild(thinkingMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Determine autoSession checkbox
  const autosessionEl = container.querySelector('#chat-autosession');
  const useAutoSession = autosessionEl && autosessionEl.checked;

  // Process message
  processMessage(message, useAutoSession).then(response => {
      thinkingMsg.remove();
      const responseMsg = document.createElement('div');
      responseMsg.className = 'chat-message chat-message-assistant';
      responseMsg.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">${formatMessage(response)}</div>
      `;
      messagesContainer.appendChild(responseMsg);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }).catch(error => {
      thinkingMsg.remove();
      const errorMsg = document.createElement('div');
      errorMsg.className = 'chat-message chat-message-assistant';
      errorMsg.innerHTML = `
        <div class="message-avatar">❌</div>
        <div class="message-content">Error: ${error.message}</div>
      `;
      messagesContainer.appendChild(errorMsg);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
  }

  // Send on Enter
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
  });

  // Send button
  sendButton.addEventListener('click', sendMessage);

  // Minimize
  minimizeButton.addEventListener('click', () => {
    container.classList.toggle('minimized');
  });

  // Close
  closeButton.addEventListener('click', () => {
    hideChat();
  });

  // Suggestions
  suggestions.forEach(chip => {
    chip.addEventListener('click', () => {
      const action = chip.dataset.action;
      input.value = getSuggestionText(action);
      sendMessage();
    });
  });
}

function getSuggestionText(action) {
  const texts = {
    screenshot: 'Take a screenshot of this page',
    analyze: 'Analyze this page and tell me what elements are available',
    click: 'Show me how to click on an element',
    fill: 'Help me fill out a form on this page'
  };
  return texts[action] || '';
}

function formatMessage(text) {
  if (text === undefined || text === null) text = '';
  return String(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/\n/g, '<br>');
}

// Process message
async function processMessage(message, autoSession = false) {
  try {
    // Use callback-style sendMessage to ensure background replies are received across environments
    const response = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({
          type: 'GEMINI_CHAT',
          message: message,
          context: {
            currentUrl: window.location.href,
          },
          autoSession: !!autoSession,
        }, (resp) => { resolve(resp); });
      } catch (e) {
        resolve(undefined);
      }
    });

    // Debugging: log raw bridge response to help diagnose formatting errors
    try { console.debug('Raw bridge response (content-simple):', response); } catch (e) {}

    if (response.success) {
      if (response.session) {
          // If background session started, response contains sessionId to poll
          if (response.sessionId) {
            startSessionPoll(response.sessionId, container);
            return `Session started (id=${response.sessionId}). Tracking progress...`;
          }
          return response.session.message || JSON.stringify(response.session);
      }
      return response.response;
    } else {
      throw new Error(response.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error processing message:', error);
    return `Error: ${error.message}. Make sure the MCP bridge server is running and Gemini API key is configured.`;
  }
}

// Show chat
function showChat() {
  if (!chatContainer) {
    chatContainer = createChatContainer();
  }
  
  chatContainer.style.display = 'flex';
  chatContainer.style.visibility = 'visible';
  chatContainer.classList.remove('minimized');
  isChatVisible = true;
  
  // Focus input
  setTimeout(() => {
    const input = chatContainer.querySelector('#chat-input');
    if (input) input.focus();
  }, 100);
}

// Poll session status and update the chat UI with live steps
function startSessionPoll(sessionId, container) {
  const messagesContainer = container.querySelector('#chat-messages');
  let statusMsg = document.createElement('div');
  statusMsg.className = 'chat-message chat-message-assistant';
  statusMsg.id = `session-${sessionId}`;
  statusMsg.innerHTML = `<div class="message-avatar">⏳</div><div class="message-content">Session started...</div>`;
  messagesContainer.appendChild(statusMsg);

  const iv = setInterval(async () => {
    try {
      const resp = await fetch(`http://localhost:8765/gemini/session/${sessionId}`);
      const j = await resp.json();
      if (!j.success) return;
      const s = j.session;
      const trace = s.trace || [];
      const last = trace.length ? trace[trace.length-1] : null;
      const content = last ? `Iteration ${last.iteration}: ${last.tool} ${last.args ? JSON.stringify(last.args) : ''}` : `Status: ${s.status}`;
      statusMsg.querySelector('.message-content').innerHTML = content;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      if (s.status === 'finished' || s.status === 'error') {
        clearInterval(iv);
        const final = s.result || s.error || 'Session ended';
        const finalMsg = document.createElement('div');
        finalMsg.className = 'chat-message chat-message-assistant';
        finalMsg.innerHTML = `<div class="message-avatar">✅</div><div class="message-content">${formatMessage(JSON.stringify(final))}</div>`;
        messagesContainer.appendChild(finalMsg);
        statusMsg.remove();
      }
    } catch (e) {
      // ignore
    }
  }, 1000);
}

// Hide chat
function hideChat() {
  if (chatContainer) {
    chatContainer.style.display = 'none';
    isChatVisible = false;
  }
}

// Toggle chat
function toggleChat() {
  if (isChatVisible) {
    hideChat();
  } else {
    showChat();
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  postLog('debug', '[MCP Copilot] Content script received message', { message });
  
  try {
    if (message.type === 'TOGGLE_CHAT' || message.type === 'SHOW_CHAT') {
    postLog('info', '[MCP Copilot] Showing chat UI');
      
      // Ensure chat container exists
      if (!chatContainer || !document.getElementById('mcp-copilot-chat')) {
  postLog('info', '[MCP Copilot] Creating chat container');
        createChatContainer();
      }
      
      showChat();
      sendResponse({ success: true, message: 'Chat shown' });
      return true; // Keep channel open for async response
    }
    
    sendResponse({ success: false, message: 'Unknown message type' });
    return true;
  } catch (error) {
    postLog('error', '[MCP Copilot] Error handling message', { error: String(error) });
    sendResponse({ success: false, error: error.message });
    return true;
  }
});

// Keyboard shortcut
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
    const target = e.target;
    const isInput = target.tagName === 'INPUT' || 
                   target.tagName === 'TEXTAREA' || 
                   target.isContentEditable;
    
    if (!isInput) {
      e.preventDefault();
      toggleChat();
    }
  }
});

// Initialize on load
function initializeChat() {
  try {
    // Create container (but keep it hidden)
    createChatContainer();
    postLog('info', '[MCP Copilot] Content script loaded and chat container created');
    postLog('info', '[MCP Copilot] Chat is ready. Use Cmd+Shift+K to toggle or click extension button.');
  } catch (error) {
    postLog('error', '[MCP Copilot] Error initializing chat', { error: String(error) });
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeChat);
} else {
  // DOM already ready, but wait a bit to ensure everything is loaded
  setTimeout(initializeChat, 100);
}

