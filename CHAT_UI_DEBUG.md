# Chat UI Debugging Guide

## Issue: Toggle Chat UI Button Not Opening Chat

### Fixed Issues

1. **Chat UI Initialization**: Chat now starts hidden and shows when toggled
2. **Show/Hide Methods**: Improved visibility handling
3. **Content Script Injection**: Better error handling and retry logic
4. **Popup Button**: Now properly injects content script if needed

### How to Test

1. **Reload the Extension**:
   - Go to `chrome://extensions/`
   - Click reload on the MCP Copilot extension

2. **Test Toggle Button**:
   - Click extension icon
   - Click "Toggle Chat UI" button
   - Chat should appear on the current page

3. **Test Keyboard Shortcut**:
   - Press `Cmd+Shift+K` (Mac) or `Ctrl+Shift+K` (Windows/Linux)
   - Chat should toggle

4. **Check Browser Console**:
   - Open DevTools (F12)
   - Look for:
     - "MCP Copilot Chat extension loaded"
     - "MCP Copilot Chat UI initialized"
   - Check for any errors

### Debugging Steps

#### 1. Check if Content Script is Loaded
```javascript
// In browser console
chrome.runtime.sendMessage({type: 'TEST'}, (response) => {
  console.log('Extension connected:', !chrome.runtime.lastError);
});
```

#### 2. Check if Chat UI is Initialized
```javascript
// In browser console
console.log('Chat UI exists:', window.copilotChat);
console.log('Container exists:', window.copilotChat?.container);
```

#### 3. Manually Show Chat
```javascript
// In browser console
if (window.copilotChat) {
  window.copilotChat.show();
}
```

#### 4. Check Extension Permissions
- Go to `chrome://extensions/`
- Find MCP Copilot
- Check that all permissions are granted
- Verify "Allow access to file URLs" if testing on file:// pages

### Common Issues

#### Chat UI Not Appearing
- **Solution**: Reload extension and refresh page
- **Check**: Browser console for errors
- **Verify**: Content script is injected (check page source for script tag)

#### Toggle Button Not Working
- **Solution**: Check if content script has permission to run on the page
- **Check**: Some pages (like chrome:// pages) don't allow content scripts
- **Workaround**: Try on a regular website like google.com

#### Script Injection Errors
- **Solution**: Check web_accessible_resources in manifest.json
- **Verify**: Files exist at the specified paths
- **Check**: Extension is properly loaded

### Files Modified

1. `src/content.js` - Improved injection and toggle logic
2. `src/chat-ui.js` - Fixed show/hide methods
3. `src/popup.js` - Better error handling for toggle button

### Next Steps

If chat still doesn't appear:
1. Check browser console for specific errors
2. Verify extension permissions
3. Try on a different website
4. Check that MCP bridge server is running
5. Reload extension completely


