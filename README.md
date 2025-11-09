# MCP Copilot Chrome Extension

A Chrome extension that mimics the VS Code GitHub Copilot chat agent with Playwright MCP integration and **Gemini AI**. This extension provides an intelligent chatbot interface that can automate browser tasks using Playwright, powered by Google's Gemini AI for natural language understanding.

## Features

- 🤖 **Gemini AI Agent**: Intelligent natural language processing using Google's Gemini AI
- 💬 **Chat Interface**: GitHub Copilot-style chat UI that appears on any webpage
- 🎭 **Playwright MCP Integration**: Full integration with Playwright MCP server for browser automation
- 🧠 **Intelligent Tool Selection**: Gemini AI automatically selects the right Playwright tools
- 📸 **Screenshot Capture**: Take screenshots of web pages
- 🔍 **Page Analysis**: Analyze page structure and accessibility
- 🎯 **Element Interaction**: Click elements, fill forms, and interact with pages
- 🚀 **Navigation**: Navigate to URLs and control browser behavior
- 🔗 **Multi-step Tasks**: Chain multiple tool calls for complex automation
- ⌨️ **Keyboard Shortcuts**: Toggle chat with `Cmd+Shift+K` (Mac) or `Ctrl+Shift+K` (Windows/Linux)

## Architecture

The extension uses a bridge server architecture with Gemini AI:

1. **Chrome Extension**: Provides the UI and user interaction
2. **MCP Bridge Server**: Node.js server that bridges the extension with Gemini AI and Playwright MCP
3. **Gemini AI Agent**: Interprets user intent and orchestrates tool calls
4. **Playwright MCP Server**: Handles actual browser automation

```
User Message (Natural Language)
    ↓
Chrome Extension (Chat UI)
    ↓ HTTP (localhost:8765)
MCP Bridge Server
    ↓
Gemini AI Agent
    ├→ Analyzes intent
    ├→ Selects tools
    └→ Formats response
    ↓
Playwright MCP Server (via stdio)
    ↓ Playwright
Browser Automation
    ↓
Results → Gemini AI → Formatted Response → User
```

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Chrome browser
- Playwright MCP server (installed automatically via npx)
- **Gemini API Key** (get it from [Google AI Studio](https://makersuite.google.com/app/apikey))

## Installation

### 1. Clone and Install Dependencies

```bash
cd mcp_client
npm install
```

### 2. Start the MCP Bridge Server

```bash
npm run server
```

The server will start on `http://localhost:8765` and automatically connect to the Playwright MCP server.

### 3. Load the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select the `mcp_client` directory
5. The extension should now be loaded and ready to use

### 4. Configure Gemini API Key

1. Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click the extension icon in the Chrome toolbar
3. Paste your API key in the "Gemini AI Agent" section
4. Click "Save API Key"
5. Status should show "API Key Configured"

### 5. Verify Installation

1. Click "Connect to MCP Server" - it should show "Connected" status
2. Navigate to any webpage
3. Press `Cmd+Shift+K` (Mac) or `Ctrl+Shift+K` (Windows/Linux) to open the chat UI
4. Start chatting with the AI agent!

## Usage

### Opening the Chat UI

- **Keyboard Shortcut**: Press `Cmd+Shift+K` (Mac) or `Ctrl+Shift+K` (Windows/Linux) on any webpage
- **Extension Popup**: Click the extension icon and then "Toggle Chat UI"
- **Auto-inject**: The chat UI automatically appears on web pages

### Example Commands (Natural Language)

The Gemini AI agent understands natural language, so you can ask in many ways:

- **Take a screenshot**: 
  - "Take a screenshot of this page"
  - "Capture the current page"
  - "Screenshot this"

- **Analyze page**: 
  - "Analyze this page"
  - "What elements are on this page?"
  - "Tell me about the structure of this page"

- **Navigate**: 
  - "Navigate to https://example.com"
  - "Go to https://github.com"
  - "Open google.com"

- **Complex Tasks**:
  - "Navigate to GitHub, take a screenshot, and analyze the page"
  - "Fill out the login form with test@example.com and password123"
  - "Click the submit button and wait for the page to load"

### Available Playwright Tools

The extension provides access to all Playwright MCP tools:

- `playwright_navigate` - Navigate to a URL
- `playwright_screenshot` - Capture screenshots
- `playwright_click` - Click on elements
- `playwright_fill` - Fill input fields
- `playwright_accessibility_snapshot` - Get page structure
- `playwright_evaluate` - Execute JavaScript
- `playwright_wait_for` - Wait for elements or conditions

## Development

### Project Structure

```
mcp_client/
├── src/
│   ├── background.js          # Chrome extension background service worker
│   ├── content.js             # Content script that injects chat UI
│   ├── chat-ui.js             # Chat UI component
│   ├── popup.html             # Extension popup HTML
│   ├── popup.js               # Extension popup script
│   ├── styles.css             # Chat UI styles
│   └── mcp-bridge-server.js   # MCP bridge server
├── manifest.json              # Chrome extension manifest
├── package.json               # Node.js dependencies
└── README.md                  # This file
```

### Running the Bridge Server

```bash
npm run server
```

The server runs on `http://localhost:8765` and handles communication between the Chrome extension and the Playwright MCP server.

### Developing the Extension

1. Make changes to the extension files in `src/`
2. Reload the extension in Chrome (`chrome://extensions/` → click reload)
3. Test on any webpage

### Debugging

- **Extension Logs**: Open `chrome://extensions/` → click "Inspect views: service worker" for background script logs
- **Content Script Logs**: Open DevTools on any webpage to see content script logs
- **Bridge Server Logs**: Check the terminal where you ran `npm run server`

## How It Works (Like GitHub Copilot)

This extension mimics how GitHub Copilot uses MCP with AI:

1. **User Input**: User types a natural language command in the chat interface
2. **Gemini AI Processing**: Gemini AI interprets the user's intent and context
3. **Tool Selection**: Gemini AI automatically selects the appropriate Playwright MCP tool(s)
4. **Tool Execution**: Tool(s) are called via the MCP bridge server
5. **Playwright Automation**: Playwright MCP server executes the browser automation
6. **AI Response**: Gemini AI formats the results into a natural, helpful response
7. **Multi-step Tasks**: Gemini can chain multiple tools for complex automation

### MCP Protocol Flow with Gemini AI

```
User Message (Natural Language)
    ↓
Chat UI
    ↓
Background Script (Message Handler)
    ↓
HTTP Request to Bridge Server
    ↓
MCP Bridge Server
    ↓
Gemini AI Agent
    ├→ Understands intent
    ├→ Selects Playwright tools
    └→ Calls tools via MCP Client
    ↓
Playwright MCP Server (stdio)
    ↓
Playwright Browser Automation
    ↓
Tool Results
    ↓
Gemini AI (Formats response)
    ↓
Response (back through the chain)
    ↓
Chat UI (Displays to user)
```

## Configuration

### Changing the Bridge Server Port

Edit `src/background.js`:

```javascript
const MCP_BRIDGE_URL = 'http://localhost:8765'; // Change port here
```

And update `src/mcp-bridge-server.js`:

```javascript
const PORT = 8765; // Change port here
```

### Customizing Playwright MCP Server

Edit `src/mcp-bridge-server.js` to change the MCP server command:

```javascript
mcpTransport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', '@playwright/mcp@latest'], // Customize here
});
```

## Troubleshooting

### Port 8765 already in use

If you see `EADDRINUSE: address already in use :::8765`:

```bash
# Option 1: Kill the existing server
npm run kill-server

# Option 2: Manual kill
lsof -ti:8765 | xargs kill -9

# Option 3: Restart the server
npm run restart
```

### Extension shows "Disconnected" status

1. Make sure the bridge server is running: `npm run server`
2. Check that the server is accessible at `http://localhost:8765/health`
3. Check browser console for errors
4. Verify MCP connection in server logs

### Chat UI doesn't appear

1. Reload the extension in `chrome://extensions/`
2. Check that content scripts are enabled
3. Open browser DevTools and check for JavaScript errors
4. Try refreshing the webpage
5. Press `Cmd+Shift+K` (Mac) or `Ctrl+Shift+K` (Windows/Linux)

### Gemini API key issues

1. Verify your API key is correct in the extension popup
2. Check that the API key has access to Gemini API
3. Check bridge server logs for API errors
4. Verify your internet connection
5. Check API rate limits (free tier: 60 requests/minute)

### MCP tools not working

1. Verify the bridge server is connected to Playwright MCP (check server logs for "✅ Connected")
2. Check bridge server logs for errors
3. Ensure Playwright MCP server can be installed via `npx`
4. Check that Node.js and npm are properly installed
5. Try restarting the server: `npm run restart`

### CORS errors

The bridge server includes CORS headers, but if you encounter CORS issues:

1. Check that the bridge server is running
2. Verify the port matches in both extension and server
3. Check browser console for specific CORS error messages

## Limitations

- Requires the bridge server to be running locally
- Browser automation runs in a separate Playwright instance (not the current Chrome tab)
- Some Playwright features may not work exactly as in the user's browser context

## Future Improvements

- [ ] Add AI model integration for better intent detection
- [ ] Support for multiple MCP servers
- [ ] Persistent chat history across sessions
- [ ] Custom tool definitions
- [ ] Better error handling and retry logic
- [ ] Support for streaming responses
- [ ] Integration with other MCP servers (not just Playwright)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [Playwright MCP Server](https://github.com/microsoft/playwright-mcp)
- [GitHub Copilot](https://github.com/features/copilot)

