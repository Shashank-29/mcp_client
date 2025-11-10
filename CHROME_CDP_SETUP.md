# Chrome CDP Setup - Using Existing Chrome Profile

This extension now supports connecting to your existing Chrome instance via Chrome DevTools Protocol (CDP). This allows the automation to use your current Chrome profile, extensions, and logged-in sessions.

## How It Works

The bridge server automatically detects if Chrome is running with remote debugging enabled and connects to it via CDP. Browser operations (navigation, clicking, typing, etc.) are routed through the CDP connection to your existing Chrome instance, while the MCP server is still used for tool definitions.

## Quick Setup

### macOS

1. **Close all Chrome windows** (important! Chrome must be restarted with the flag)

2. **Start Chrome with remote debugging (uses your existing profile by default):**
   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
   ```

   This will use your default Chrome profile. Chrome will automatically use your existing profile from `~/Library/Application Support/Google/Chrome`.

### Linux

1. **Close all Chrome windows**

2. **Start Chrome with remote debugging (uses your existing profile by default):**
   ```bash
   google-chrome --remote-debugging-port=9222
   ```

   This will use your default Chrome profile from `~/.config/google-chrome`.

### Windows

1. **Close all Chrome windows**

2. **Start Chrome with remote debugging (uses your existing profile by default):**
   ```cmd
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
   ```

   This will use your default Chrome profile from `%LOCALAPPDATA%\Google\Chrome\User Data`.

## Verify CDP is Running

After starting Chrome, verify the CDP endpoint is accessible:

```bash
curl http://localhost:9222/json/version
```

You should see JSON output with Chrome version information.

## Using a Different Port

If port 9222 is already in use, you can use a different port:

1. Start Chrome with a different port (e.g., 9223):
   ```bash
   # macOS
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9223 --user-data-dir="$HOME/chrome-debug-profile"
   ```

2. Set the environment variable before starting the bridge server:
   ```bash
   export CHROME_CDP_ENDPOINT=http://localhost:9223
   npm run server
   ```

## Disable CDP Connection

If you want to use a new browser instance instead (default Playwright behavior):

```bash
export USE_EXISTING_BROWSER=false
npm run server
```

## Troubleshooting

### Chrome won't start with remote debugging

- Make sure all Chrome windows are closed first
- Check if the port is already in use: `lsof -i :9222` (macOS/Linux) or `netstat -ano | findstr :9222` (Windows)
- Try a different port

### "Chrome remote debugging not found" warning

- Verify Chrome is running with `--remote-debugging-port=9222`
- Check if the CDP endpoint is accessible: `curl http://localhost:9222/json/version`
- The bridge server will automatically search ports 9222-9225

### Profile conflicts

- **Important**: Do NOT use `--user-data-dir` if you want to use your existing profile
- Using `--user-data-dir` creates a new, separate profile
- To use your existing profile, just use `--remote-debugging-port=9222` without the `--user-data-dir` flag
- Chrome will automatically use your default profile location

## Notes

- **Security**: Remote debugging allows external connections. Only use on trusted networks.
- **Performance**: Using your existing profile may be slower than a clean profile
- **Extensions**: Your existing Chrome extensions will be available when using your profile

