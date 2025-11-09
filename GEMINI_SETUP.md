# Gemini API Setup Guide

This extension now uses Google's Gemini AI as the intelligent agent to interpret user requests and orchestrate Playwright MCP tool calls, just like GitHub Copilot!

## Getting Your Gemini API Key

1. **Visit Google AI Studio**
   - Go to: https://makersuite.google.com/app/apikey
   - Or: https://aistudio.google.com/app/apikey

2. **Sign in with Google Account**
   - Use your Google account to sign in

3. **Create API Key**
   - Click "Create API Key"
   - Select or create a Google Cloud project
   - Copy your API key

4. **Configure in Extension**
   - Click the extension icon in Chrome
   - Paste your API key in the "Gemini AI Agent" section
   - Click "Save API Key"
   - Status should show "API Key Configured"

## How It Works

### Before (Simple Intent Detection)
- Basic keyword matching
- Limited understanding
- Manual tool selection

### Now (Gemini AI Agent)
- ✅ Natural language understanding
- ✅ Intelligent intent detection
- ✅ Automatic tool selection
- ✅ Context-aware responses
- ✅ Conversational flow
- ✅ Multi-step task execution

## Example Conversations

### Simple Requests
**User:** "Take a screenshot of this page"
**Agent:** Analyzes intent → Calls screenshot tool → Returns result

**User:** "What elements are on this page?"
**Agent:** Analyzes intent → Calls accessibility snapshot tool → Formats response

### Complex Requests
**User:** "Navigate to GitHub, take a screenshot, and tell me what's on the page"
**Agent:** 
1. Analyzes intent
2. Chains multiple tools: navigate → screenshot → analyze
3. Provides comprehensive response

### Natural Language
**User:** "Can you help me test this form by filling it out?"
**Agent:** Understands context → Identifies form elements → Fills form fields

## Features

- **Intelligent Tool Selection**: Gemini automatically selects the right Playwright tools
- **Context Awareness**: Remembers conversation history
- **Multi-step Tasks**: Can chain multiple tool calls
- **Natural Responses**: Provides human-friendly explanations
- **Error Handling**: Gracefully handles errors and suggests solutions

## API Key Security

- API keys are stored locally in Chrome extension storage
- Keys are never sent to external servers (only to Google's Gemini API)
- Keys are encrypted by Chrome's storage system
- You can update or remove your API key anytime

## Troubleshooting

### "API Key not configured" Error
- Make sure you've saved your API key in the extension popup
- Check that the API key is valid
- Verify the key has access to Gemini API

### "Failed to initialize Gemini agent" Error
- Check your internet connection
- Verify the API key is correct
- Make sure the MCP bridge server is running
- Check server logs for detailed error messages

### API Rate Limits
- Gemini API has rate limits based on your Google Cloud project
- Free tier: 60 requests per minute
- If you hit limits, wait a moment and try again
- Consider upgrading your Google Cloud plan for higher limits

## Cost

- **Free Tier**: Gemini API offers a generous free tier
- **Pricing**: Check current pricing at https://ai.google.dev/pricing
- **Usage**: This extension only uses the API for chat interactions, not for tool execution

## Next Steps

1. Get your Gemini API key
2. Configure it in the extension
3. Start chatting naturally!
4. Try complex automation tasks

Enjoy intelligent browser automation with Gemini AI! 🤖✨


