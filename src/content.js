/**
 * Content Script
 * Injects the chat UI into web pages
 */

// Ensure DOM is ready
const BRIDGE_LOG_URL = 'http://localhost:8765/logs';
function postLog(level, message, meta) {
  try {
    fetch(BRIDGE_LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, meta }),
    }).catch(() => {});
  } catch (e) {}
}
function injectChatUI() {
  // Inject chat UI styles
  if (!document.querySelector('link[href*="styles.css"]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = chrome.runtime.getURL('src/styles.css');
    document.head.appendChild(style);
  }

  // Inject chat UI script (only if not already injected)
  if (!window.copilotChat && !document.querySelector('script[src*="chat-ui.js"]')) {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/chat-ui.js');
    script.type = 'module';
    script.onerror = () => {
      postLog('error', 'Failed to load chat UI script');
    };
    document.body.appendChild(script);
  }
}

// Inject when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectChatUI);
} else {
  injectChatUI();
}

// Wait for chat UI to be initialized
function waitForChatUI(callback, maxAttempts = 100) {
  if (window.copilotChat && window.copilotChat.container) {
    callback();
    return;
  }
  if (maxAttempts > 0) {
    setTimeout(() => waitForChatUI(callback, maxAttempts - 1), 50);
  } else {
    postLog('error', 'Chat UI failed to initialize');
  }
}

// Function to show chat UI
function showChatUI() {
  waitForChatUI(() => {
    if (window.copilotChat) {
      window.copilotChat.show();
      // Ensure it's visible
      if (window.copilotChat.container) {
        window.copilotChat.container.style.display = 'flex';
        window.copilotChat.container.style.visibility = 'visible';
      }
    }
  });
}

// Function to toggle chat UI
function toggleChatUI() {
  waitForChatUI(() => {
    if (window.copilotChat) {
      const container = window.copilotChat.container;
      if (container) {
        const isHidden = container.style.display === 'none' || 
                        container.style.visibility === 'hidden' ||
                        !container.style.display;
        
        if (isHidden) {
          window.copilotChat.show();
          container.style.display = 'flex';
          container.style.visibility = 'visible';
        } else {
          window.copilotChat.toggleMinimize();
        }
      } else {
        // Container doesn't exist, initialize it
        window.copilotChat.init();
        showChatUI();
      }
    } else {
      // Chat UI not initialized, try to inject it
      injectChatUI();
      setTimeout(showChatUI, 500);
    }
  });
}

// Listen for messages from background script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_CHAT') {
    toggleChatUI();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'SHOW_CHAT') {
    showChatUI();
    sendResponse({ success: true });
    return true;
  }
  
  return true;
});

// Add keyboard shortcut to toggle chat (Cmd/Ctrl + Shift + K)
document.addEventListener('keydown', (e) => {
  // Only trigger if not typing in an input field
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
    const target = e.target;
    const isInput = target.tagName === 'INPUT' || 
                   target.tagName === 'TEXTAREA' || 
                   target.isContentEditable;
    
    if (!isInput) {
      e.preventDefault();
      toggleChatUI();
    }
  }
});

postLog('info', 'MCP Copilot Chat extension loaded');

