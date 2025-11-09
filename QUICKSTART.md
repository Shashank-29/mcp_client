# Quick Start Guide

Get up and running with MCP Copilot Chrome Extension in 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Start the MCP Bridge Server

```bash
npm run server
```

Keep this terminal window open. You should see:
```
🚀 MCP Bridge Server running on http://localhost:8765
✅ Connected to Playwright MCP server
```

## Step 3: Load the Chrome Extension

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `mcp_client` folder
6. Extension should appear in your list

## Step 4: Configure Gemini API Key

1. Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click the extension icon in Chrome toolbar
3. Paste your API key in the "Gemini AI Agent" section
4. Click "Save API Key"
5. Status should show "API Key Configured" (green)

## Step 5: Connect and Use

1. Click "Connect to MCP Server"
2. Status should show "Connected" (green)
3. Navigate to any webpage (e.g., https://example.com)
4. Press `Cmd+Shift+K` (Mac) or `Ctrl+Shift+K` (Windows/Linux)
5. Chat UI appears! 🎉

## Try These Commands (Natural Language)

The Gemini AI understands natural language, so you can ask in many ways:

- **"Take a screenshot"** - Captures the current page
- **"Analyze this page"** - Shows page structure and elements
- **"Navigate to https://github.com"** - Navigates to a URL
- **"What's on this page?"** - Analyzes and describes the page
- **"Go to GitHub and take a screenshot"** - Multi-step task!
- **"Fill the form with test@example.com"** - Intelligent form filling

## Troubleshooting

**Extension shows "Disconnected"?**
- Make sure the bridge server is running (`npm run server`)
- Check that port 8765 is not blocked

**Gemini API key not working?**
- Verify your API key is correct
- Check that the API key has access to Gemini API
- Make sure you've saved the key in the extension popup
- Check bridge server logs for API errors

**Chat UI doesn't appear?**
- Reload the extension in `chrome://extensions/`
- Refresh the webpage
- Check browser console (F12) for errors

**AI not responding?**
- Make sure Gemini API key is configured
- Check bridge server terminal for errors
- Verify your internet connection
- Check API rate limits (free tier: 60 requests/minute)

**Tools not working?**
- Check bridge server terminal for errors
- Verify Playwright MCP is installed: `npx -y @playwright/mcp@latest`
- Check server logs
- Make sure MCP server is connected

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [INSTALL.md](INSTALL.md) for detailed installation instructions
- Explore all available Playwright tools in the chat

Enjoy automating with MCP Copilot! 🤖

