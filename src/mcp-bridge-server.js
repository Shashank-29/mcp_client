#!/usr/bin/env node
/**
 * MCP Bridge Server
 * Runs as a local HTTP server and bridges Chrome extension with Playwright MCP
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import GeminiAgent from './gemini-agent.js';
import logger from './logger.js';

// Load .env file into process.env if present (simple, no dependency)
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) return;
      let key = m[1];
      let val = m[2] || '';
      // remove surrounding quotes
      if ((val.startsWith('\"') && val.endsWith('\"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    });
  }
} catch (e) {
  // ignore .env read errors
}

const app = express();
const PORT = 8765;

app.use(cors());
app.use(express.json());

function safeStringify(obj, max = 2000) {
  try {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    if (s.length > max) return s.slice(0, max) + '...[truncated]';
    return s;
  } catch (e) {
    return String(obj);
  }
}

let mcpClient = null;
let mcpTransport = null;
let isConnected = false;
let geminiAgent = null;
// In-memory session store for live session updates
const sessions = {};

function makeSession() {
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : require('crypto').randomBytes(8).toString('hex');
  sessions[id] = { id, status: 'created', trace: [], lastUpdate: new Date().toISOString() };
  return id;
}

function updateSession(id, patch) {
  if (!sessions[id]) return;
  sessions[id] = Object.assign(sessions[id], patch, { lastUpdate: new Date().toISOString() });
}

async function connectToMCP() {
  if (isConnected && mcpClient) {
    return true;
  }

  try {
    mcpTransport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@playwright/mcp@latest'],
    });

    mcpClient = new Client(
      {
        name: 'mcp-copilot-chrome-extension',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Connect to the MCP server
    // The connect method handles the initialization handshake
    await mcpClient.connect(mcpTransport);
    
    isConnected = true;
    logger.info('✅ Connected to Playwright MCP server');

    // Auto-initialize Gemini agent from environment variable if provided.
    // This keeps the agent available across extension reloads when the bridge
    // process is started with GEMINI_API_KEY set.
    try {
      const envKey = process.env.GEMINI_API_KEY;
      if (envKey && !geminiAgent) {
        logger.info('Auto-initializing Gemini agent from GEMINI_API_KEY environment variable');
        const mcpClientWrapper = {
          listTools: async () => {
            const response = await mcpClient.listTools();
            return response.tools || [];
          },
          callTool: async (request) => {
            try { logger.info('Gemini->MCP callTool', safeStringify(request, 1000)); } catch (e) {}
            const resp = await mcpClient.callTool(request);
            try { logger.debug('Gemini->MCP callTool result', safeStringify(resp, 2000)); } catch (e) {}
            return resp;
          },
        };

        geminiAgent = new GeminiAgent(envKey, mcpClientWrapper);
        const initialized = await geminiAgent.initialize();
        if (initialized) logger.info('Gemini agent initialized from environment variable');
        else logger.warn('Gemini agent failed to initialize from GEMINI_API_KEY');
      }
    } catch (e) {
      logger.warn('Failed to auto-initialize Gemini agent from env:', e && (e.message || e));
    }
    return true;
  } catch (error) {
    logger.error('❌ Failed to connect to Playwright MCP server:', error);
    isConnected = false;
    mcpClient = null;
    mcpTransport = null;
    return false;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', connected: isConnected });
});

// Ingest logs from browser or other clients. Accepts { level, message, meta }
app.post('/logs', (req, res) => {
  try {
    const { level, message, meta } = req.body || {};
    const lvl = (level || 'info').toLowerCase();
    const msg = typeof message === 'string' ? message : JSON.stringify(message || meta || {});
    if (lvl === 'error') logger.error(msg, meta || '');
    else if (lvl === 'warn') logger.warn(msg, meta || '');
    else if (lvl === 'debug') logger.debug(msg, meta || '');
    else logger.info(msg, meta || '');
    res.json({ success: true });
  } catch (e) {
    logger.error('Failed to ingest log:', e && e.message ? e.message : e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Connect to MCP
app.post('/mcp/connect', async (req, res) => {
  try {
    const connected = await connectToMCP();
    res.json({ success: connected });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List tools
app.get('/mcp/tools', async (req, res) => {
  try {
    if (!isConnected) {
      await connectToMCP();
    }
    if (!isConnected || !mcpClient) {
      return res.status(500).json({ success: false, error: 'Not connected to MCP server' });
    }
    const response = await mcpClient.listTools();
    res.json({ success: true, tools: response.tools || [] });
  } catch (error) {
    logger.error('Error listing tools:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Call tool
app.post('/mcp/tools/:toolName', async (req, res) => {
  try {
    if (!isConnected) {
      await connectToMCP();
    }
    if (!isConnected || !mcpClient) {
      return res.status(500).json({ success: false, error: 'Not connected to MCP server' });
    }
    const { toolName } = req.params;
    const args = req.body.args || {};
    // Log incoming tool call (truncate large payloads)
    logger.info(`MCP call requested: ${toolName}`, safeStringify(args, 1000));

    const response = await mcpClient.callTool({
      name: toolName,
      arguments: args,
    });

    // Log result summary
    try {
      logger.debug(`MCP call result: ${toolName}`, safeStringify(response, 2000));
    } catch (e) {
      logger.warn('Failed to stringify MCP response for logging', e && e.message ? e.message : e);
    }

    res.json({ success: true, result: response });
  } catch (error) {
    logger.error('Error calling tool:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disconnect
app.post('/mcp/disconnect', async (req, res) => {
  try {
    if (mcpClient) {
      await mcpClient.close();
    }
    mcpClient = null;
    mcpTransport = null;
    isConnected = false;
    geminiAgent = null;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initialize Gemini Agent
app.post('/gemini/initialize', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API key is required' });
    }

    // Ensure MCP is connected
    if (!isConnected) {
      await connectToMCP();
    }

    if (!isConnected || !mcpClient) {
      return res.status(500).json({ success: false, error: 'MCP server not connected' });
    }

    // Create MCP client wrapper for Gemini agent (adds logging around calls)
    const mcpClientWrapper = {
      listTools: async () => {
        const response = await mcpClient.listTools();
        return response.tools || [];
      },
      callTool: async (request) => {
        try {
          logger.info('Gemini->MCP callTool', safeStringify(request, 1000));
        } catch (e) {}
        const resp = await mcpClient.callTool(request);
        try { logger.debug('Gemini->MCP callTool result', safeStringify(resp, 2000)); } catch(e){}
        return resp;
      },
    };

    // Initialize Gemini agent
    geminiAgent = new GeminiAgent(apiKey, mcpClientWrapper);
    const initialized = await geminiAgent.initialize();

    if (initialized) {
      res.json({ success: true, message: 'Gemini agent initialized' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to initialize Gemini agent' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Chat with Gemini Agent
app.post('/gemini/chat', async (req, res) => {
  try {
    const { message, context, options, autoSession } = req.body || {};

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    if (!geminiAgent) {
      return res.status(400).json({ success: false, error: 'Gemini agent not initialized. Please initialize with API key first.' });
    }

    // If caller requests a session-based run, start runTaskSession in background and return sessionId for polling
    const wantsSession = !!autoSession || (options && options.runSession);
    if (wantsSession) {
      logger.info('Received chat request with autoSession/runSession, starting background session', safeStringify({ message }, 1000));
      const sessionId = makeSession();

      // Start the session in background and stream updates into sessions[sessionId]
      (async () => {
        try {
          updateSession(sessionId, { status: 'running', message: message });
          const runOptions = Object.assign({}, options || {}, {
            onUpdate: (update) => {
              // update has { status, iteration, action, toolResult, trace }
              updateSession(sessionId, { status: update.status, trace: update.trace, lastAction: update.action, lastToolResult: update.toolResult });
            }
          });

          const sessionResult = await geminiAgent.runTaskSession(message, context || {}, runOptions);
          updateSession(sessionId, { status: 'finished', result: sessionResult, trace: sessionResult.trace });
        } catch (e) {
          updateSession(sessionId, { status: 'error', error: e && e.message ? e.message : String(e) });
        }
      })();

      return res.json({ success: true, sessionId });
    }

    const response = await geminiAgent.processMessage(message, context || {});
    res.json({ success: true, response });
  } catch (error) {
    logger.error('Error in Gemini chat:', error && (error.message || error));
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get session status (for UI polling)
app.get('/gemini/session/:id', (req, res) => {
  const id = req.params.id;
  const s = sessions[id];
  if (!s) return res.status(404).json({ success: false, error: 'session not found' });
  res.json({ success: true, session: s });
});

// Run a task session: repeatedly plan & execute until completion
app.post('/gemini/run-session', async (req, res) => {
  try {
    const { task, context, options } = req.body || {};
    if (!task) return res.status(400).json({ success: false, error: 'task is required' });
    if (!geminiAgent) return res.status(400).json({ success: false, error: 'Gemini agent not initialized' });

    logger.info('Starting run-session for task', safeStringify({ task }, 1000));
    const result = await geminiAgent.runTaskSession(task, context || {}, options || {});
    res.json({ success: true, session: result });
  } catch (error) {
    logger.error('Error running session:', error && (error.message || error));
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear Gemini conversation history
app.post('/gemini/clear', async (req, res) => {
  try {
    if (geminiAgent) {
      geminiAgent.clearHistory();
      res.json({ success: true, message: 'Conversation history cleared' });
    } else {
      res.json({ success: false, error: 'Gemini agent not initialized' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update Gemini API key
app.post('/gemini/update-api-key', async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API key is required' });
    }

    if (!geminiAgent) {
      // Initialize new agent if it doesn't exist
      if (!isConnected) {
        await connectToMCP();
      }
      if (!isConnected || !mcpClient) {
        return res.status(500).json({ success: false, error: 'MCP server not connected' });
      }

      const mcpClientWrapper = {
        listTools: async () => {
          const response = await mcpClient.listTools();
          return response.tools || [];
        },
        callTool: async (request) => {
          try { logger.info('Gemini->MCP callTool', safeStringify(request, 1000)); } catch(e){}
          const resp = await mcpClient.callTool(request);
          try { logger.debug('Gemini->MCP callTool result', safeStringify(resp, 2000)); } catch(e){}
          return resp;
        },
      };

      geminiAgent = new GeminiAgent(apiKey, mcpClientWrapper);
      await geminiAgent.initialize();
    } else {
      geminiAgent.updateApiKey(apiKey);
    }

    res.json({ success: true, message: 'API key updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server with error handling
const server = app.listen(PORT, () => {
    logger.info(`🚀 MCP Bridge Server running on http://localhost:${PORT}`);
    logger.info('📝 Connecting to Playwright MCP server...');
  // Connect to MCP server on startup (non-blocking)
  connectToMCP().catch((error) => {
    logger.warn('⚠️ Initial MCP connection failed, will retry on first request:', error.message);
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`❌ Port ${PORT} is already in use.`);
    logger.error(`   Please kill the existing process or use a different port.`);
    logger.error(`   To kill the process on port ${PORT}, run: lsof -ti:${PORT} | xargs kill -9`);
    process.exit(1);
  } else {
    logger.error('❌ Server error:', error);
    process.exit(1);
  }
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('\n🛑 Shutting down...');
  if (mcpClient) {
    await mcpClient.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (mcpClient) {
    await mcpClient.close();
  }
  process.exit(0);
});

