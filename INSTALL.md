# Installation Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the MCP Bridge Server**
   ```bash
   npm run server
   ```
   Keep this terminal window open. The server runs on `http://localhost:8765`.

3. **Load the Chrome Extension**
   - Open Chrome
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select the `mcp_client` directory
   - The extension should appear in your extensions list

4. **Create Extension Icons** (Optional but recommended)
   - Open `create-icons.html` in a browser
   - Icons will be generated automatically
   - Move the downloaded icons to the `icons/` directory
   - Or create your own icons (16x16, 48x48, 128x128 pixels)

5. **Verify Installation**
   - Click the extension icon in Chrome toolbar
   - Click "Connect to MCP Server"
   - Status should show "Connected"
   - Navigate to any webpage
   - Press `Cmd+Shift+K` (Mac) or `Ctrl+Shift+K` (Windows/Linux)
   - Chat UI should appear

## Troubleshooting

### Server Won't Start

- Make sure Node.js 18+ is installed: `node --version`
- Check if port 8765 is already in use
- Try a different port (update `src/background.js` and `src/mcp-bridge-server.js`)

### Extension Shows "Disconnected"

- Verify the bridge server is running (`npm run server`)
- Check server logs for errors
- Open browser console (F12) and check for errors
- Verify `http://localhost:8765/health` is accessible

### Chat UI Doesn't Appear

- Reload the extension in `chrome://extensions/`
- Refresh the webpage
- Check browser console for JavaScript errors
- Verify content scripts are enabled in extension details

### MCP Tools Not Working

- Check bridge server logs
- Verify Playwright MCP can be installed: `npx -y @playwright/mcp@latest`
- Check Node.js and npm are up to date
- Review server terminal output for errors

## Next Steps

Once installed, try these commands in the chat:

- "Take a screenshot"
- "Analyze this page"
- "Navigate to https://example.com"

See README.md for more details and usage examples.


