/**
 * Gemini AI Agent
 * Uses Gemini API to interpret user intent and orchestrate MCP tool calls
 */

import logger from './logger.js';

class GeminiAgent {
  constructor(apiKey, mcpClient) {
    this.apiKey = apiKey;
    this.mcpClient = mcpClient;
  // Use gemini-2.5-flash for faster responses. This codebase is locked to 2.5 flash only.
  this.model = 'gemini-2.5-flash';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.conversationHistory = [];
    this.availableTools = null;
  }

  /**
   * Run a task session: repeatedly ask Gemini what to do next, execute tools,
   * and feed back results until the agent signals completion or max iterations.
   * Returns a trace of steps performed and the final assistant message.
   */
  async runTaskSession(taskDescription, context = {}, options = {}) {
    const maxIterations = (options && options.maxIterations) || 10;
    const trace = [];
    let iteration = 0;
    let lastToolResult = null;
    let finished = false;
  // Track repeated identical actions to avoid infinite loops when model keeps returning same call
  let previousActionSignature = null;
  let repeatCount = 0;

    // Starter prompt: tell Gemini to act as a planner/actor and output JSON actions
    let prompt = `You are executing a task on behalf of the user. The task: ${taskDescription}.\n\nRespond with a JSON object describing the next action in the exact format:\n{ "action":"call_tool", "tool":"tool_name", "args":{...} }\nor when finished respond with:\n{ "action":"done", "message":"final human friendly message" }.\n\nOnly request one tool invocation at a time. After you receive the result of a tool call, you will be given that result and should continue by returning the next JSON action or {"action":"done"}.`;

  while (iteration < maxIterations && !finished) {
      try {
  // Append previous tool result as context for the next planning step
  const contextSuffix = lastToolResult ? `\n\nPrevious tool result: ${JSON.stringify(lastToolResult)}` : '';
  const geminiResponse = await this.callGeminiAPI(prompt + contextSuffix, this.conversationHistory.slice(-5));
  // Log raw Gemini response for debugging session flow
  try { logger.debug('[Gemini Session] Raw response', geminiResponse && geminiResponse.slice ? geminiResponse.slice(0, 4000) : String(geminiResponse)); } catch (e) {}
  const parsed = this.parseGeminiResponse(geminiResponse);

  if (parsed.action === 'call_tool') {
          // Detect identical repeated tool calls (same tool + args) to prevent looping
          try {
            const sig = `${parsed.tool}|${JSON.stringify(parsed.args || {})}`;
            if (previousActionSignature === sig) {
              repeatCount += 1;
            } else {
              previousActionSignature = sig;
              repeatCount = 0;
            }
            if (repeatCount >= 2) {
              // We've seen the same action repeatedly; stop the session to avoid infinite loops
              logger.warn('[Gemini Session] Detected repeated action from Gemini, stopping session to avoid loop', sig);
              finished = true;
              const message = 'Stopped: repeated action detected (no progress).';
              return { success: true, message, trace };
            }
          } catch (e) {
            // ignore signature errors
          }
          // Try to compute a ref if missing
          try {
            const computedRef = await this.computeRefIfMissing(parsed.tool, parsed.args || {}, taskDescription);
            if (computedRef) {
              parsed.args = parsed.args || {};
              parsed.args.ref = parsed.args.ref || computedRef;
              logger.info(`[Gemini Session] Auto-detected ref for tool ${parsed.tool}: ${computedRef}`);
            }
          } catch (e) {
            logger.warn('Failed to compute ref during session:', e && e.message ? e.message : e);
          }

          // Execute the requested tool
          logger.info(`[Gemini Session] Executing tool ${parsed.tool} (iteration ${iteration + 1})`);
          const toolResult = await this.executeTool(parsed.tool, parsed.args || {});
          trace.push({ iteration: iteration + 1, tool: parsed.tool, args: parsed.args || {}, result: toolResult });

          // Emit update callback if provided (for live UI updates)
          try {
            if (options && typeof options.onUpdate === 'function') {
              options.onUpdate({ status: 'running', iteration: iteration + 1, action: parsed, toolResult, trace });
            }
          } catch (e) {
            // ignore callback errors
          }

          // Prepare next loop: lastToolResult holds result summary
          lastToolResult = toolResult && toolResult.result ? toolResult.result : toolResult;
          iteration += 1;
          // Continue loop; Gemini will be called again and given the tool result
          continue;
        }

        // If Gemini signals done or a plain respond action, finish
        if (parsed.action === 'done' || parsed.action === 'respond' || !parsed.action) {
          finished = true;
          const message = parsed.message || geminiResponse || 'Done';
          logger.info('[Gemini Session] Finished with message', message);
          return { success: true, message, trace };
        }

  // Unknown action: stop with failure
  logger.warn('[Gemini Session] Unknown action from Gemini', parsed);
  finished = true;
  return { success: false, message: `Unknown action from Gemini: ${JSON.stringify(parsed)}`, trace };
      } catch (error) {
        logger.error('Session error:', error && (error.message || error));
        return { success: false, message: error && (error.message || String(error)), trace };
      }
    }

    if (!finished) {
      return { success: false, message: `Max iterations (${maxIterations}) reached`, trace };
    }
  }

  /**
   * Initialize the agent by loading available tools
   */
  async initialize() {
    try {
      const tools = await this.mcpClient.listTools();
      this.availableTools = tools;
      return true;
    } catch (error) {
      logger.error('Failed to initialize Gemini agent:', error);
      return false;
    }
  }

  /**
   * Get available tools as a formatted string for Gemini
   */
  formatToolsForPrompt() {
    if (!this.availableTools || this.availableTools.length === 0) {
      return 'No tools available.';
    }

    return this.availableTools.map(tool => {
      const schema = tool.inputSchema || {};
      const properties = schema.properties || {};
      const params = Object.keys(properties).map(key => {
        const prop = properties[key];
        return `  - ${key}: ${prop.type || 'string'}${prop.description ? ` (${prop.description})` : ''}`;
      }).join('\n');

      return `- ${tool.name}: ${tool.description || 'No description'}\n${params ? `  Parameters:\n${params}` : ''}`;
    }).join('\n\n');
  }

  /**
   * Create system prompt for Gemini
   */
  createSystemPrompt() {
    return `You are an AI assistant whose ONLY job is to plan and execute browser automation using the Playwright MCP tools listed below.

Available Playwright MCP Tools:
${this.formatToolsForPrompt()}

Operational rules (read carefully):
1) Strict JSON-only responses: except when explicitly asked for a human-readable reply, your response MUST contain a single JSON object and nothing else (no leading text, no trailing text, no markdown).

2) Allowed JSON shapes:
  - Call a single tool (preferred for iterative sessions):
    { "action": "call_tool", "tool": "<tool_name>", "args": { ... }, "reasoning": "brief (1-2 sentence) rationale" }

  - Finish the session:
    { "action": "done", "message": "short user-facing completion message" }

  - Non-tool reply (only for pure questions or confirmations):
    { "action": "respond", "message": "text reply" }

3) Single-tool-per-response: In session mode, return at most one "call_tool" per response. Do NOT return multiple tool calls or long planning lists. After you return a tool call, wait for the tool result; the agent will feed the result back into you and you should then return the next single action.

4) Avoid "chain_tools": If you believe multiple steps are required, still return only the FIRST immediate "call_tool" and include brief reasoning. The system will execute it and provide the result for the next planning step.

5) Element selection and refs:
  - If a tool requires a DOM selector/ref but you cannot reliably produce a stable CSS selector, provide a natural-language hint using the "element_hint" (or "element"/"placeholder_hint") field in "args" instead of guessing brittle selectors.
  - Example: { "action":"call_tool", "tool":"browser_type", "args": { "element_hint":"search box", "text":"hello" } }
  - The bridge/agent will attempt to compute a robust "ref" from that hint (via evaluate) before executing the tool.

6) Prefer evaluate-based interactions for typing/clicking/filling: When deciding between a high-level selector and an evaluate script, prefer evaluate-style operations (the runtime will use "browser_evaluate" when available) to reduce brittleness.

7) Clarity and brevity:
  - Keep "reasoning" extremely short (one or two sentences max).
  - Do not include internal deliberation or long transcripts in the JSON.

8) When uncertain ask a clarifying question rather than guessing parameters that may perform destructive actions (navigation, form submission). Use "respond" to ask a one-question clarification.

9) Error handling:
  - If a previous tool result is provided, inspect it and adapt. If you detect the tool failed, return a corrective "call_tool" or a "respond" explaining the failure.

10) Session behavior:
  - If "autoSession" is enabled, the orchestrator will call you repeatedly. You must therefore always follow the single-tool-per-response rule so iterations remain deterministic.

Examples (must be exact JSON):
  { "action": "call_tool", "tool": "browser_navigate", "args": { "url": "https://example.com" }, "reasoning": "open target page" }
  { "action": "call_tool", "tool": "browser_type", "args": { "element_hint": "search", "text": "agentic ai", "submit": true }, "reasoning": "search the site" }
  { "action": "done", "message": "Search performed and first result opened." }

Follow these rules strictly so the bridge can reliably execute and iterate on your plan.`;
  }

  /**
   * Call Gemini API
   */
  async callGeminiAPI(prompt, conversationContext = []) {
    try {
      // Use node-fetch for Node.js compatibility
      let fetch;
      try {
        const nodeFetch = await import('node-fetch');
        fetch = nodeFetch.default;
      } catch {
        // Fallback to global fetch if available (Node 18+)
        fetch = globalThis.fetch;
        if (!fetch) {
          throw new Error('fetch is not available. Please use Node.js 18+ or install node-fetch');
        }
      }
      
      const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
      
      const systemPrompt = this.createSystemPrompt();
      
      // Build conversation history
      const historyText = conversationContext.length > 0
        ? `\n\nConversation History:\n${conversationContext.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
        : '';
      
      const fullPrompt = `${systemPrompt}${historyText}\n\nUser: ${prompt}\n\nAssistant:`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: fullPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Gemini API error: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          const errorDetails = errorJson.error;
          if (errorDetails) {
            errorMessage += ` - ${errorDetails.message || JSON.stringify(errorDetails)}`;
            // If model not found, suggest the single supported model
            if (errorDetails.message && errorDetails.message.includes('not found')) {
              errorMessage += '\n\nAvailable models: gemini-2.5-flash';
              errorMessage += `\nCurrent model: ${this.model}`;
            }
          } else {
            errorMessage += ` - ${errorText}`;
          }
        } catch {
          errorMessage += ` - ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini API: ' + JSON.stringify(data));
      }

      const text = data.candidates[0].content.parts[0].text;
      return text.trim();
    } catch (error) {
      logger.error('Error calling Gemini API:', error);
      throw error;
    }
  }

  /**
   * Parse Gemini response to extract JSON action
   */
  parseGeminiResponse(response) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON found, treat as a direct response
      return {
        action: 'respond',
        message: response,
      };
    } catch (error) {
      // If parsing fails, return as a message
      return {
        action: 'respond',
        message: response,
      };
    }
  }

  /**
   * Execute a tool call
   */
  async executeTool(toolName, args) {
    try {
      // Prefer using evaluate-based interactions for page actions so we don't rely on snapshot refs.
      const evaluateOnly = ['browser_type', 'browser_click', 'browser_fill_form', 'browser_press_key'];
      if (evaluateOnly.includes(toolName)) {
        // Find the evaluate tool name (prefer explicit browser_evaluate)
        const evalTool = (this.availableTools || []).find(t => t.name === 'browser_evaluate')
          || (this.availableTools || []).find(t => /evaluate|exec|run-js|page_execute|dom_eval|js_eval/.test(t.name));

        if (evalTool) {
          // Build a function to run in page context depending on the tool
          let fnBody = '';
          if (toolName === 'browser_type') {
            const text = args && args.text ? args.text : '';
            const submit = !!(args && args.submit);
            const slowly = !!(args && args.slowly);
            const elementHint = args && args.element ? args.element : '';
            fnBody = `() => {
              try {
                const hint = ${JSON.stringify(elementHint || '')}.toLowerCase();
                const visible = el => { const r = el.getBoundingClientRect(); return r.width>0 && r.height>0 && getComputedStyle(el).visibility !== 'hidden'; };
                const candidates = Array.from(document.querySelectorAll('input,textarea,[contenteditable]')).filter(visible);
                let el = null;
                if (hint) {
                  el = candidates.find(e => ((e.placeholder||'').toLowerCase().includes(hint) || (e.getAttribute('aria-label')||'').toLowerCase().includes(hint)));
                  if (!el) {
                    for (const e of candidates) {
                      if (e.id) {
                        const label = document.querySelector('label[for="'+e.id+'"]');
                        if (label && label.textContent.toLowerCase().includes(hint)) { el = e; break; }
                      }
                    }
                  }
                }
                if (!el) el = candidates[0] || document.querySelector('input,textarea,[contenteditable]');
                if (!el) return { error: 'element-not-found' };
                el.focus();
                const txt = ${JSON.stringify(text)};
                if (${slowly}) {
                  for (let i = 0; i < txt.length; i++) { el.value = el.value + txt[i]; el.dispatchEvent(new Event('input', {bubbles:true})); }
                } else {
                  el.value = txt;
                  el.dispatchEvent(new Event('input', {bubbles:true}));
                  el.dispatchEvent(new Event('change', {bubbles:true}));
                }
                if (${submit}) {
                  // try to submit via form or press Enter
                  if (el.form) { el.form.submit(); }
                  else { el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'})); }
                }
                return { status: 'typed' };
              } catch (e) { return { error: String(e) }; }
            }`;
          } else if (toolName === 'browser_click') {
            const elementHint = args && args.element ? args.element : '';
            fnBody = `() => {
              try {
                const hint = ${JSON.stringify(elementHint || '')}.toLowerCase();
                const visible = el => { const r = el.getBoundingClientRect(); return r.width>0 && r.height>0 && getComputedStyle(el).visibility !== 'hidden'; };
                const candidates = Array.from(document.querySelectorAll('button,a,input[type=button],[role=button]')).filter(visible);
                let el = null;
                if (hint) {
                  el = candidates.find(e => ((e.textContent||'').toLowerCase().includes(hint) || (e.getAttribute('aria-label')||'').toLowerCase().includes(hint)));
                }
                if (!el) el = candidates[0] || document.querySelector('button,a,input[type=button],[role=button]');
                if (!el) return { error: 'element-not-found' };
                el.click();
                return { status: 'clicked' };
              } catch (e) { return { error: String(e) }; }
            }`;
          } else if (toolName === 'browser_press_key') {
            const key = args && args.key ? args.key : '';
            fnBody = `() => { try { document.activeElement && document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(key)}})); return { status: 'key-pressed' }; } catch(e){return { error: String(e) } } }`;
          } else if (toolName === 'browser_fill_form') {
            const fields = (args && args.fields) || [];
            fnBody = `() => { try { for (const f of ${JSON.stringify(fields)}) { try { const el = document.querySelector(f.ref) || document.querySelector('[name="'+f.name+'"]'); if (!el) continue; el.focus(); el.value = f.value; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); } catch(e){} } return { status: 'filled' }; } catch(e){ return { error: String(e) }; } }`;
          }

          // Call the evaluate tool with the constructed function
          const evalArgs = { function: fnBody };
          const result = await this.mcpClient.callTool({ name: evalTool.name, arguments: evalArgs });
          return { success: true, result };
        }
      }

      // Default: call the MCP tool directly
      const result = await this.mcpClient.callTool({
        name: toolName,
        arguments: args,
      });
      return { success: true, result };
    } catch (error) {
      logger.error('executeTool error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Try to find or compute a `ref` selector when it's missing from tool args.
   * Uses available MCP tools to run a small page script that finds a likely input element
   * based on a user hint (from the original user message).
   * Returns the selector string or null if not found.
   */
  async computeRefIfMissing(toolName, args = {}, userHint = '') {
    try {
      if (args && args.ref) return args.ref;

      if (!this.availableTools || this.availableTools.length === 0) return null;

      // Find an evaluate-like tool that accepts a script or expression
      const evalTool = this.availableTools.find(t => {
        const n = (t.name || '').toLowerCase();
        if (/evaluate|exec|run-js|page_execute|browser_eval|browser_evaluate|dom_eval|js_eval/.test(n)) return true;
        const props = (t.inputSchema && t.inputSchema.properties) || {};
        return Object.keys(props).some(p => /script|expression|source|code|js/.test(p));
      });

      if (!evalTool) return null;

      // Determine the argument name to pass the script under
      const props = (evalTool.inputSchema && evalTool.inputSchema.properties) || {};
      let scriptArgName = Object.keys(props).find(p => /script|expression|source|code|js/.test(p));
      if (!scriptArgName) scriptArgName = 'script';

      // Small page script: find a visible input/textarea/contenteditable element that matches hint
      const pageScript = `(function(userHint){
        try {
          const hint = (userHint||'').toLowerCase();
          function visible(el){
            const rect = el.getBoundingClientRect();
            return rect.width>0 && rect.height>0 && window.getComputedStyle(el).visibility !== 'hidden';
          }
          const candidates = Array.from(document.querySelectorAll('input,textarea,[contenteditable]')).filter(visible);
          if (hint) {
            // match placeholder
            const byPlaceholder = candidates.find(el=> (el.placeholder||'').toLowerCase().includes(hint));
            if(byPlaceholder){
              if(byPlaceholder.id) return '#'+byPlaceholder.id;
              if(byPlaceholder.name) return byPlaceholder.tagName.toLowerCase()+"[name='"+byPlaceholder.name+"']";
              return byPlaceholder.tagName.toLowerCase()+"[placeholder='"+byPlaceholder.placeholder+"']";
            }
            // match associated label text
            for(const el of candidates){
              if(el.id){
                const label = document.querySelector('label[for="'+el.id+'"]');
                if(label && label.textContent.toLowerCase().includes(hint)){
                  return '#'+el.id;
                }
              }
            }
          }
          if(candidates.length){
            const el = candidates[0];
            if(el.id) return '#'+el.id;
            if(el.name) return el.tagName.toLowerCase()+"[name='"+el.name+"']";
            // fallback to nth-of-type
            const tag = el.tagName.toLowerCase();
            const index = Array.prototype.indexOf.call(document.querySelectorAll(tag), el) + 1;
            return tag+":nth-of-type("+index+")";
          }
          return null;
        } catch(e) { return null; }
      })(${JSON.stringify(userHint)});`;

      const callArgs = {};
      callArgs[scriptArgName] = pageScript;

      // Execute the evaluate tool via MCP
      const evalResponse = await this.mcpClient.callTool({
        name: evalTool.name,
        arguments: callArgs,
      });

      // The tool may return different shapes; try common locations
      if (!evalResponse) return null;
      // Try to extract a scalar string from response
      if (typeof evalResponse === 'string') return evalResponse || null;
      if (evalResponse.result && typeof evalResponse.result === 'string') return evalResponse.result || null;
      if (evalResponse.output && typeof evalResponse.output === 'string') return evalResponse.output || null;
      // If it's an object with a value property
      if (evalResponse.value && typeof evalResponse.value === 'string') return evalResponse.value || null;

      // If it's an object with nested candidates, try to stringify and parse
      try {
        const serialized = JSON.stringify(evalResponse);
        // Keep the character class explicit and escape the hyphen to avoid range errors
        const match = serialized.match(/#?[a-zA-Z0-9_\-:\[\]\.=]+/);
        return match ? match[0] : null;
      } catch {
        return null;
      }
    } catch (error) {
      logger.warn('computeRefIfMissing failed:', error && error.message ? error.message : error);
      return null;
    }
  }

  /**
   * Process user message with Gemini agent
   */
  async processMessage(userMessage, context = {}) {
    try {
      // Add user message to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      // Add context about current page
      const contextInfo = context.currentUrl 
        ? `\n\nCurrent page context: The user is on ${context.currentUrl}`
        : '';

      // Call Gemini API
      const geminiResponse = await this.callGeminiAPI(
        userMessage + contextInfo,
        this.conversationHistory.slice(-5) // Last 5 messages for context
      );

      // Parse the response
      const parsed = this.parseGeminiResponse(geminiResponse);

      let finalResponse = '';

      // Handle different action types
      if (parsed.action === 'call_tool') {
        // If ref is required but missing, try to compute one by inspecting the page
        try {
          const computedRef = await this.computeRefIfMissing(parsed.tool, parsed.args || {}, userMessage);
          if (computedRef) {
            parsed.args = parsed.args || {};
            parsed.args.ref = parsed.args.ref || computedRef;
            logger.info(`[Gemini Agent] Auto-detected ref for tool ${parsed.tool}: ${computedRef}`);
          }
        } catch (e) {
          logger.warn('Failed to compute missing ref:', e && e.message ? e.message : e);
        }

        // Execute single tool
        const toolResult = await this.executeTool(parsed.tool, parsed.args || {});
        
        if (toolResult.success) {
          // Get Gemini to format the result into a user-friendly response
          const resultPrompt = `The tool "${parsed.tool}" was executed successfully. Result: ${JSON.stringify(toolResult.result)}. Provide a helpful, user-friendly explanation of what was done.`;
          const formattedResponse = await this.callGeminiAPI(resultPrompt, []);
          finalResponse = formattedResponse;
        } else {
          finalResponse = `Failed to execute ${parsed.tool}: ${toolResult.error}. ${parsed.reasoning || ''}`;
        }
      } else if (parsed.action === 'chain_tools') {
        // Execute multiple tools in sequence
        const results = [];
        for (const toolCall of parsed.tools) {
          const toolResult = await this.executeTool(toolCall.tool, toolCall.args || {});
          results.push({
            tool: toolCall.tool,
            success: toolResult.success,
            result: toolResult.result,
            error: toolResult.error,
          });
        }

        // Format results
        const resultsSummary = results.map(r => 
          `${r.tool}: ${r.success ? 'Success' : `Failed - ${r.error}`}`
        ).join('\n');

        finalResponse = `Executed ${results.length} tool(s):\n${resultsSummary}\n\n${parsed.reasoning || ''}`;
      } else {
        // Direct response
        finalResponse = parsed.message || geminiResponse;
      }

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: finalResponse,
      });

      // Keep history manageable (last 10 messages)
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      return finalResponse;
    } catch (error) {
      logger.error('Error processing message with Gemini:', error && (error.message || error));
      throw error;
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Update API key
   */
  updateApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Update model (useful for switching between models)
   */
  setModel(modelName) {
    // Enforce using only gemini-2.5-flash. Ignore requests to switch to other models.
    const allowed = 'gemini-2.5-flash';
    if (modelName !== allowed) {
      logger.warn(`[Gemini Agent] Ignored attempt to set model to '${modelName}'. Only '${allowed}' is allowed.`);
      return;
    }
    this.model = modelName;
    console.log(`[Gemini Agent] Model updated to: ${this.model}`);
  }
}

export default GeminiAgent;

