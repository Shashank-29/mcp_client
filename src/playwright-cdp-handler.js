/**
 * Playwright CDP Handler
 * Connects to an existing Chrome instance via CDP instead of launching a new browser
 */

import { chromium } from 'playwright';
import logger from './logger.js';

class PlaywrightCDPHandler {
  constructor(cdpEndpoint = 'http://localhost:9222') {
    this.cdpEndpoint = cdpEndpoint;
    this.browser = null;
    this.context = null;
    this.pages = new Map(); // Track pages by ID
    this.isConnected = false;
  }

  /**
   * Connect to existing Chrome instance via CDP
   */
  async connect() {
    try {
      logger.info(`🔗 Connecting to Chrome via CDP: ${this.cdpEndpoint}`);
      
      // Connect to existing Chrome instance
      this.browser = await chromium.connectOverCDP(this.cdpEndpoint);
      
      // Get the default context (or first available context)
      const contexts = this.browser.contexts();
      if (contexts.length > 0) {
        this.context = contexts[0];
        logger.info(`✅ Connected to existing Chrome context with ${contexts.length} context(s)`);
      } else {
        // Create a new context if none exists
        this.context = await this.browser.newContext();
        logger.info('✅ Created new browser context');
      }

      // Get existing pages or create a new one
      const existingPages = this.context.pages();
      if (existingPages.length > 0) {
        logger.info(`📄 Found ${existingPages.length} existing page(s)`);
        existingPages.forEach((page, index) => {
          this.pages.set(`page-${index}`, page);
        });
      } else {
        // Create a new page
        const page = await this.context.newPage();
        this.pages.set('page-0', page);
        logger.info('📄 Created new page');
      }

      this.isConnected = true;
      return true;
    } catch (error) {
      logger.error('❌ Failed to connect to Chrome via CDP:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Get or create a page
   */
  async getPage(pageId = 'page-0') {
    if (!this.isConnected || !this.context) {
      throw new Error('Not connected to Chrome. Call connect() first.');
    }

    if (this.pages.has(pageId)) {
      return this.pages.get(pageId);
    }

    // Create a new page
    const page = await this.context.newPage();
    this.pages.set(pageId, page);
    return page;
  }

  /**
   * Navigate to a URL
   */
  async navigate(url, pageId = 'page-0') {
    const page = await this.getPage(pageId);
    await page.goto(url);
    return {
      url: page.url(),
      title: await page.title(),
    };
  }

  /**
   * Take a screenshot
   */
  async screenshot(options = {}, pageId = 'page-0') {
    const page = await this.getPage(pageId);
    const buffer = await page.screenshot(options);
    return buffer.toString('base64');
  }

  /**
   * Click on an element
   */
  async click(selector, options = {}, pageId = 'page-0') {
    const page = await this.getPage(pageId);
    await page.click(selector, options);
    return { success: true };
  }

  /**
   * Fill an input field
   */
  async fill(selector, text, options = {}, pageId = 'page-0') {
    const page = await this.getPage(pageId);
    await page.fill(selector, text, options);
    return { success: true };
  }

  /**
   * Type text
   */
  async type(selector, text, options = {}, pageId = 'page-0') {
    const page = await this.getPage(pageId);
    await page.type(selector, text, options);
    return { success: true };
  }

  /**
   * Evaluate JavaScript in the page context
   */
  async evaluate(script, pageId = 'page-0') {
    const page = await this.getPage(pageId);
    
    // Playwright's evaluate expects a function, not a string
    // If script is a string (function string), we need to convert it to a function
    if (typeof script === 'string') {
      // The script is likely a function string like "() => { ... }"
      // We need to evaluate it as code that returns a function
      try {
        // Create a function from the string
        // This handles both arrow functions and regular functions
        const func = eval(`(${script})`);
        if (typeof func === 'function') {
          const result = await page.evaluate(func);
          return result;
        } else {
          // If it's not a function, try evaluating it directly as code
          const result = await page.evaluate(new Function(script));
          return result;
        }
      } catch (e) {
        // If eval fails, try using Function constructor
        try {
          const func = new Function('return ' + script)();
          const result = await page.evaluate(func);
          return result;
        } catch (e2) {
          // Last resort: try evaluating as raw code
          const func = new Function(script);
          const result = await page.evaluate(func);
          return result;
        }
      }
    } else if (typeof script === 'function') {
      // If it's already a function, evaluate it directly
      const result = await page.evaluate(script);
      return result;
    } else {
      throw new Error('Invalid script type: expected string or function');
    }
  }

  /**
   * Get page content
   */
  async getContent(pageId = 'page-0') {
    const page = await this.getPage(pageId);
    return {
      url: page.url(),
      title: await page.title(),
      content: await page.content(),
    };
  }

  /**
   * Wait for an element
   */
  async waitForSelector(selector, options = {}, pageId = 'page-0') {
    const page = await this.getPage(pageId);
    await page.waitForSelector(selector, options);
    return { success: true };
  }

  /**
   * Get accessibility snapshot
   */
  async getAccessibilitySnapshot(pageId = 'page-0') {
    const page = await this.getPage(pageId);
    const snapshot = await page.accessibility.snapshot();
    return snapshot;
  }

  /**
   * Close a page
   */
  async closePage(pageId) {
    if (this.pages.has(pageId)) {
      const page = this.pages.get(pageId);
      await page.close();
      this.pages.delete(pageId);
      return { success: true };
    }
    return { success: false, error: 'Page not found' };
  }

  /**
   * Disconnect from browser (but don't close it since it's an existing instance)
   */
  async disconnect() {
    // Don't close the browser since it's an existing Chrome instance
    // Just clear our references
    this.pages.clear();
    this.context = null;
    if (this.browser) {
      // Note: We don't call browser.close() because it would close the user's Chrome
      this.browser = null;
    }
    this.isConnected = false;
    logger.info('🔌 Disconnected from Chrome (browser remains open)');
  }

  /**
   * Check if connected
   */
  isConnectedToBrowser() {
    return this.isConnected && this.browser !== null;
  }
}

export default PlaywrightCDPHandler;

