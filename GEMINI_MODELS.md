# Gemini API Models

## Available Models

The Gemini API supports several models. Here are the commonly available ones:

### Recommended Models

1. **gemini-2.5-flash** (Default)
   - Fast and efficient
   - Good for most tasks
   - Lower cost
   - Recommended for real-time interactions

2. **gemini-2.5-pro**
   - Higher quality responses
   - Better for complex tasks
   - Slower but more accurate
   - Use for complex automation tasks

3. **gemini-1.0-pro**
   - Older model
   - Still supported
   - May have limitations

## Changing the Model

To change the model used by the extension, you can:

1. **Edit the code**: Update `src/gemini-agent.js` (note: this repo enforces use of 2.5 flash):
   ```javascript
   this.model = 'gemini-2.5-flash';
   ```

2. **Or use environment variable** (if implemented):
   ```bash
   GEMINI_MODEL=gemini-1.5-pro npm run server
   ```

## API Versions

- **v1beta**: Current version, supports latest models
- **v1**: Stable version

The extension uses `v1beta` by default for access to the latest models.

## Model Availability

Not all models are available in all regions or API versions. If you get a 404 error:

1. Check that the model name is correct
2. Verify your API key has access to the model
3. Try a different model (e.g., `gemini-1.5-flash` instead of `gemini-1.5-pro`)
4. Check Google AI Studio for available models in your region

## Current Configuration

- Fast and responsive
- Cost-effective
- Widely available
- Good for browser automation tasks
The extension is configured to use `gemini-2.5-flash` by default, which is:
- Fast and responsive
- Cost-effective
- Widely available
- Good for browser automation tasks
- Fast and responsive
- Cost-effective
- Widely available
- Good for browser automation tasks


