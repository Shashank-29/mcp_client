# CDP Implementation - Quick Reference

## What Changed?

### Before
- Playwright MCP launched new Chromium browser
- No access to extensions or logged-in sessions
- Separate browser instance

### After
- Connects to existing Chrome via CDP
- Uses your Chrome profile with extensions
- Same browser instance

## Files Changed

### Created
- `src/playwright-cdp-handler.js` - CDP connection handler
- `CHROME_CDP_SETUP.md` - Setup guide
- `CDP_IMPLEMENTATION.md` - Technical docs
- `CDP_CHANGES_SUMMARY.md` - Changes summary
- `CDP_ARCHITECTURE.md` - Architecture diagrams
- `CDP_IMPLEMENTATION_SUMMARY.md` - Overview

### Modified
- `src/mcp-bridge-server.js` - Added CDP detection and routing
- `package.json` - Added Playwright dependency
- `README.md` - Added CDP documentation

## How It Works

```
1. Bridge server detects Chrome CDP endpoint (ports 9222-9225)
2. Connects to existing Chrome via CDP
3. Routes browser operations to CDP handler
4. Falls back to MCP server if CDP unavailable
```

## Setup

### 1. Install Playwright
```bash
npm install
```

### 2. Start Chrome with Remote Debugging
```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

### 3. Start Bridge Server
```bash
npm run server
```

### 4. Verify
Check logs for: `✅ Connected to existing Chrome via CDP`

## Key Code Changes

### 1. CDP Handler (`src/playwright-cdp-handler.js`)
- Connects via `chromium.connectOverCDP()`
- Manages browser contexts and pages
- Provides browser operation methods

### 2. CDP Detection (`src/mcp-bridge-server.js`)
- Scans ports 9222-9225
- Detects Chrome CDP endpoint
- Connects automatically

### 3. Tool Routing (`src/mcp-bridge-server.js`)
- Routes browser operations to CDP handler
- Falls back to MCP server if needed
- Maintains same interface

## Benefits

- ✅ Uses existing Chrome profile
- ✅ Extensions available
- ✅ Logged-in sessions work
- ✅ Same browser instance
- ✅ No breaking changes
- ✅ Automatic fallback

## Troubleshooting

### Chrome CDP Not Detected
- Verify Chrome is running with `--remote-debugging-port=9222`
- Check: `curl http://localhost:9222/json/version`
- Try different port or set `CHROME_CDP_ENDPOINT` env var

### CDP Connection Fails
- Verify Chrome is still running
- Check Chrome/Playwright version compatibility
- Restart Chrome with remote debugging

## Documentation

- **Quick Setup:** `CHROME_CDP_SETUP.md`
- **Technical Details:** `CDP_IMPLEMENTATION.md`
- **Changes Summary:** `CDP_CHANGES_SUMMARY.md`
- **Architecture:** `CDP_ARCHITECTURE.md`
- **Overview:** `CDP_IMPLEMENTATION_SUMMARY.md`

