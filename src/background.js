/**
 * Background Service Worker for Chrome Extension
 * Handles MCP client communication via HTTP bridge server
 */

const MCP_BRIDGE_URL = 'http://localhost:8765';
const LOG_ENDPOINT = `${MCP_BRIDGE_URL}/logs`;

// Simple client-side logger that POSTS to bridge /logs and falls back to console
async function sendLog(level, message, meta) {
  try {
    // Fire-and-forget; don't block main flow
    fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, meta }),
    }).catch(() => {});
  } catch (e) {
    // ignore
  }
}
let isConnected = false;

// Check if bridge server is running
async function checkBridgeServer() {
  try {
    const response = await fetch(`${MCP_BRIDGE_URL}/health`);
    const data = await response.json();
    return data.connected === true;
  } catch (error) {
    return false;
  }
}

// Initialize MCP client connection via bridge server
async function initializeMCP() {
  try {
    const response = await fetch(`${MCP_BRIDGE_URL}/mcp/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    isConnected = data.success;
    return isConnected;
  } catch (error) {
    sendLog('error', 'Failed to connect to MCP bridge server:', { error: String(error) });
    isConnected = false;
    return false;
  }
}

// Call MCP bridge API
async function callBridgeAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${MCP_BRIDGE_URL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    return await response.json();
  } catch (error) {
    throw new Error(`Bridge server error: ${error.message}`);
  }
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
    sendLog('info', 'Extension installed', details);
  if (details.reason === 'install') {
    // Initialize MCP connection on first install
    initializeMCP().catch(console.error);
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'MCP_CONNECT':
        const serverRunning = await checkBridgeServer();
        if (!serverRunning) {
          sendResponse({ success: false, error: 'MCP bridge server is not running. Please start it with: npm run server' });
          break;
        }
        await initializeMCP();
        sendResponse({ success: isConnected });
        break;

      case 'MCP_LIST_TOOLS':
        const toolsResponse = await callBridgeAPI('/mcp/tools');
        sendResponse(toolsResponse);
        break;

      case 'MCP_CALL_TOOL':
        const callResponse = await callBridgeAPI(`/mcp/tools/${message.toolName}`, {
          method: 'POST',
          body: JSON.stringify({ args: message.args || {} }),
        });
        sendResponse(callResponse);
        break;

      case 'MCP_NAVIGATE':
        // Use provided toolName or find navigation tool dynamically
        if (message.toolName) {
          const navResponse = await callBridgeAPI(`/mcp/tools/${message.toolName}`, {
            method: 'POST',
            body: JSON.stringify({ args: { url: message.url } }),
          });
          sendResponse(navResponse);
        } else {
          // Try to find navigation tool from available tools
          const toolsResp = await callBridgeAPI('/mcp/tools');
          if (toolsResp.success && toolsResp.tools) {
            const navTool = toolsResp.tools.find(t => 
              t.name.toLowerCase().includes('navigate') || 
              t.name.toLowerCase().includes('goto') || 
              t.name.toLowerCase() === 'goto'
            );
            if (navTool) {
              const navResponse = await callBridgeAPI(`/mcp/tools/${navTool.name}`, {
                method: 'POST',
                body: JSON.stringify({ args: { url: message.url } }),
              });
              sendResponse(navResponse);
            } else {
              sendResponse({ success: false, error: 'Navigation tool not found' });
            }
          } else {
            sendResponse({ success: false, error: 'Could not list tools to find navigation tool' });
          }
        }
        break;

      case 'MCP_SCREENSHOT':
        if (message.toolName) {
          const screenshotResponse = await callBridgeAPI(`/mcp/tools/${message.toolName}`, {
            method: 'POST',
            body: JSON.stringify({ args: message.options || {} }),
          });
          sendResponse(screenshotResponse);
        } else {
          const toolsResp = await callBridgeAPI('/mcp/tools');
          if (toolsResp.success && toolsResp.tools) {
            const screenshotTool = toolsResp.tools.find(t => 
              t.name.includes('screenshot') || t.name.includes('capture')
            );
            if (screenshotTool) {
              const screenshotResponse = await callBridgeAPI(`/mcp/tools/${screenshotTool.name}`, {
                method: 'POST',
                body: JSON.stringify({ args: message.options || {} }),
              });
              sendResponse(screenshotResponse);
            } else {
              sendResponse({ success: false, error: 'Screenshot tool not found' });
            }
          } else {
            sendResponse({ success: false, error: 'Could not list tools to find screenshot tool' });
          }
        }
        break;

      case 'MCP_CLICK':
        if (message.toolName) {
          const clickResponse = await callBridgeAPI(`/mcp/tools/${message.toolName}`, {
            method: 'POST',
            body: JSON.stringify({ args: { selector: message.selector } }),
          });
          sendResponse(clickResponse);
        } else {
          const toolsResp = await callBridgeAPI('/mcp/tools');
          if (toolsResp.success && toolsResp.tools) {
            const clickTool = toolsResp.tools.find(t => t.name.includes('click'));
            if (clickTool) {
              const clickResponse = await callBridgeAPI(`/mcp/tools/${clickTool.name}`, {
                method: 'POST',
                body: JSON.stringify({ args: { selector: message.selector } }),
              });
              sendResponse(clickResponse);
            } else {
              sendResponse({ success: false, error: 'Click tool not found' });
            }
          } else {
            sendResponse({ success: false, error: 'Could not list tools to find click tool' });
          }
        }
        break;

      case 'MCP_FILL':
        if (message.toolName) {
          const fillResponse = await callBridgeAPI(`/mcp/tools/${message.toolName}`, {
            method: 'POST',
            body: JSON.stringify({ args: { selector: message.selector, text: message.text } }),
          });
          sendResponse(fillResponse);
        } else {
          const toolsResp = await callBridgeAPI('/mcp/tools');
          if (toolsResp.success && toolsResp.tools) {
            const fillTool = toolsResp.tools.find(t => t.name.includes('fill') || t.name.includes('type'));
            if (fillTool) {
              const fillResponse = await callBridgeAPI(`/mcp/tools/${fillTool.name}`, {
                method: 'POST',
                body: JSON.stringify({ args: { selector: message.selector, text: message.text } }),
              });
              sendResponse(fillResponse);
            } else {
              sendResponse({ success: false, error: 'Fill tool not found' });
            }
          } else {
            sendResponse({ success: false, error: 'Could not list tools to find fill tool' });
          }
        }
        break;

      case 'MCP_GET_PAGE_CONTENT':
        if (message.toolName) {
          const contentResponse = await callBridgeAPI(`/mcp/tools/${message.toolName}`, {
            method: 'POST',
            body: JSON.stringify({ args: {} }),
          });
          sendResponse(contentResponse);
        } else {
          const toolsResp = await callBridgeAPI('/mcp/tools');
          if (toolsResp.success && toolsResp.tools) {
            const contentTool = toolsResp.tools.find(t => 
              t.name.includes('accessibility') || t.name.includes('snapshot') || t.name.includes('content')
            );
            if (contentTool) {
              const contentResponse = await callBridgeAPI(`/mcp/tools/${contentTool.name}`, {
                method: 'POST',
                body: JSON.stringify({ args: {} }),
              });
              sendResponse(contentResponse);
            } else {
              sendResponse({ success: false, error: 'Page content tool not found' });
            }
          } else {
            sendResponse({ success: false, error: 'Could not list tools to find page content tool' });
          }
        }
        break;

      case 'MCP_EVALUATE':
        if (message.toolName) {
          const evalResponse = await callBridgeAPI(`/mcp/tools/${message.toolName}`, {
            method: 'POST',
            body: JSON.stringify({ args: { script: message.script } }),
          });
          sendResponse(evalResponse);
        } else {
          const toolsResp = await callBridgeAPI('/mcp/tools');
          if (toolsResp.success && toolsResp.tools) {
            const evalTool = toolsResp.tools.find(t => 
              t.name.includes('evaluate') || t.name.includes('execute') || t.name.includes('script')
            );
            if (evalTool) {
              const evalResponse = await callBridgeAPI(`/mcp/tools/${evalTool.name}`, {
                method: 'POST',
                body: JSON.stringify({ args: { script: message.script } }),
              });
              sendResponse(evalResponse);
            } else {
              sendResponse({ success: false, error: 'Evaluate tool not found' });
            }
          } else {
            sendResponse({ success: false, error: 'Could not list tools to find evaluate tool' });
          }
        }
        break;

      case 'MCP_WAIT_FOR':
        if (message.toolName) {
          const waitResponse = await callBridgeAPI(`/mcp/tools/${message.toolName}`, {
            method: 'POST',
            body: JSON.stringify({ args: { selector: message.selector, ...message.options } }),
          });
          sendResponse(waitResponse);
        } else {
          const toolsResp = await callBridgeAPI('/mcp/tools');
          if (toolsResp.success && toolsResp.tools) {
            const waitTool = toolsResp.tools.find(t => t.name.includes('wait'));
            if (waitTool) {
              const waitResponse = await callBridgeAPI(`/mcp/tools/${waitTool.name}`, {
                method: 'POST',
                body: JSON.stringify({ args: { selector: message.selector, ...message.options } }),
              });
              sendResponse(waitResponse);
            } else {
              sendResponse({ success: false, error: 'Wait tool not found' });
            }
          } else {
            sendResponse({ success: false, error: 'Could not list tools to find wait tool' });
          }
        }
        break;

      case 'MCP_GET_AVAILABLE_TOOLS':
        const availableToolsResponse = await callBridgeAPI('/mcp/tools');
        if (availableToolsResponse.success) {
          const tools = availableToolsResponse.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          }));
          sendResponse({ success: true, tools });
        } else {
          sendResponse(availableToolsResponse);
        }
        break;

      case 'MCP_DISCONNECT':
        const disconnectResponse = await callBridgeAPI('/mcp/disconnect', {
          method: 'POST',
        });
        isConnected = false;
        sendResponse(disconnectResponse);
        break;

      case 'GET_TAB_URL':
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            sendResponse({ success: true, url: tabs[0].url });
          } else {
            sendResponse({ success: false, error: 'No active tab' });
          }
        });
        return true; // Async response

      case 'GEMINI_INITIALIZE':
        const initResponse = await callBridgeAPI('/gemini/initialize', {
          method: 'POST',
          body: JSON.stringify({ apiKey: message.apiKey }),
        });
        sendResponse(initResponse);
        break;

      case 'GEMINI_CHAT':
        // Forward autoSession and options when provided so the bridge can start a session-run
        const chatResponse = await callBridgeAPI('/gemini/chat', {
          method: 'POST',
          body: JSON.stringify({
            message: message.message,
            context: message.context || {},
            autoSession: !!message.autoSession,
            options: message.options || {},
          }),
        });
        sendResponse(chatResponse);
        break;

      case 'GEMINI_CLEAR':
        const clearResponse = await callBridgeAPI('/gemini/clear', {
          method: 'POST',
        });
        sendResponse(clearResponse);
        break;

      case 'GEMINI_UPDATE_API_KEY':
        const updateKeyResponse = await callBridgeAPI('/gemini/update-api-key', {
          method: 'POST',
          body: JSON.stringify({ apiKey: message.apiKey }),
        });
        sendResponse(updateKeyResponse);
        break;

      case 'SAVE_API_KEY':
        try {
          await chrome.storage.local.set({ geminiApiKey: message.apiKey });
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'GET_API_KEY':
        try {
          const result = await chrome.storage.local.get('geminiApiKey');
          sendResponse({ success: true, apiKey: result.geminiApiKey || null });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    sendLog('error', 'Error handling message', { error: String(error) });
    sendResponse({ success: false, error: error.message });
  }
}

async function ensureConnected() {
  if (!isConnected) {
    const serverRunning = await checkBridgeServer();
    if (!serverRunning) {
      throw new Error('MCP bridge server is not running. Please start it with: npm run server');
    }
    await initializeMCP();
  }
  if (!isConnected) {
    throw new Error('Failed to connect to MCP server');
  }
}

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  sendLog('info', 'Extension started');
  initializeMCP().catch(err => sendLog('error','initializeMCP failed', { error: String(err) }));
});

// Handle extension activation
chrome.action.onClicked.addListener((tab) => {
  // This can be used to toggle the chat UI if needed
  sendLog('info', 'Extension icon clicked', { tabId: tab.id });
});

