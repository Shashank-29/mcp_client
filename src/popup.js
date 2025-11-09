/**
 * Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
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
  const statusEl = document.getElementById('status');
  const connectBtn = document.getElementById('connect-btn');
  const toggleChatBtn = document.getElementById('toggle-chat-btn');
  const geminiStatusEl = document.getElementById('gemini-status');
  const apiKeyInput = document.getElementById('api-key-input');
  const saveApiKeyBtn = document.getElementById('save-api-key-btn');

  // Check connection status
  async function checkStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'MCP_CONNECT' });
      if (response.success) {
        statusEl.textContent = 'Connected';
        statusEl.className = 'status connected';
        connectBtn.disabled = true;
      } else {
        statusEl.textContent = 'Disconnected';
        statusEl.className = 'status disconnected';
        connectBtn.disabled = false;
      }
    } catch (error) {
      statusEl.textContent = 'Error: ' + error.message;
      statusEl.className = 'status disconnected';
      connectBtn.disabled = false;
    }
  }

  // Check Gemini API key status
  async function checkGeminiStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
      if (response.success && response.apiKey) {
        geminiStatusEl.textContent = 'API Key Configured';
        geminiStatusEl.className = 'status gemini configured';
        apiKeyInput.value = response.apiKey.substring(0, 10) + '...'; // Show partial key
        apiKeyInput.type = 'password';
      } else {
        geminiStatusEl.textContent = 'Not configured';
        geminiStatusEl.className = 'status gemini';
        apiKeyInput.value = '';
      }
    } catch (error) {
      postLog('error', 'Error checking Gemini status', { error: String(error) });
    }
  }

  // Connect button
  connectBtn.addEventListener('click', async () => {
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';
    try {
      const response = await chrome.runtime.sendMessage({ type: 'MCP_CONNECT' });
      if (response.success) {
        statusEl.textContent = 'Connected';
        statusEl.className = 'status connected';
      } else {
        statusEl.textContent = 'Failed to connect';
        statusEl.className = 'status disconnected';
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect to MCP Server';
      }
    } catch (error) {
      statusEl.textContent = 'Error: ' + error.message;
      statusEl.className = 'status disconnected';
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect to MCP Server';
    }
  });

  // Save API key button
  saveApiKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      alert('Please enter your Gemini API key');
      return;
    }

    saveApiKeyBtn.disabled = true;
    saveApiKeyBtn.textContent = 'Saving...';

    try {
      // Save API key
      const saveResponse = await chrome.runtime.sendMessage({
        type: 'SAVE_API_KEY',
        apiKey: apiKey,
      });

      if (saveResponse.success) {
        // Update Gemini agent with new API key
        const updateResponse = await chrome.runtime.sendMessage({
          type: 'GEMINI_UPDATE_API_KEY',
          apiKey: apiKey,
        });

        if (updateResponse.success) {
          geminiStatusEl.textContent = 'API Key Saved';
          geminiStatusEl.className = 'status gemini configured';
          apiKeyInput.type = 'password';
          apiKeyInput.value = apiKey.substring(0, 10) + '...';
          alert('API key saved successfully!');
        } else {
          alert('Failed to initialize Gemini agent: ' + updateResponse.error);
        }
      } else {
        alert('Failed to save API key: ' + saveResponse.error);
      }
    } catch (error) {
      alert('Error saving API key: ' + error.message);
    } finally {
      saveApiKeyBtn.disabled = false;
      saveApiKeyBtn.textContent = 'Save API Key';
    }
  });

  // Toggle chat button
  toggleChatBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        postLog('warn', 'No active tab found');
          return;
      }

      // Check if page allows content scripts (chrome://, chrome-extension://, etc. don't)
      const url = new URL(tab.url);
      if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || url.protocol === 'edge:' || url.protocol === 'about:') {
        alert('Chat UI cannot be shown on this type of page. Please navigate to a regular website (like google.com) and try again.');
        return;
      }

  postLog('info', 'Sending SHOW_CHAT message to tab', { tabId: tab.id, url: tab.url });
      
      // Content script should be auto-loaded via manifest, just send message
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_CHAT' }, (response) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          postLog('warn', 'Content script not ready', { error: errorMsg });
          
          // Content script might not be loaded yet - ask user to refresh
          if (errorMsg.includes('Could not establish connection') || errorMsg.includes('Receiving end does not exist')) {
            const shouldRefresh = confirm(
              'The chat UI needs to be loaded on this page. Would you like to refresh the page to load it?\n\n' +
              'Alternatively, you can manually refresh the page and try again.'
            );
            if (shouldRefresh) {
              chrome.tabs.reload(tab.id);
            }
          } else {
            alert('Could not communicate with the page. Please refresh the page and try again.\n\nError: ' + errorMsg);
          }
        } else {
          postLog('info', 'Chat shown successfully', { tabId: tab.id });
          // Optionally close the popup
          window.close();
        }
      });
    } catch (error) {
      postLog('error', 'Error toggling chat', { error: String(error) });
      alert('Error: ' + error.message + '\n\nPlease make sure you are on a regular webpage (not a chrome:// page) and try again.');
    }
  });

  // Check status on load
  await checkStatus();
  await checkGeminiStatus();
});

