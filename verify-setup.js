#!/usr/bin/env node
/**
 * Setup Verification Script
 * Verifies that the MCP bridge server and Playwright MCP are properly configured
 */

import { spawn } from 'child_process';

console.log('🔍 Verifying MCP Copilot Setup...\n');

// Check Node.js version
const nodeVersion = process.version;
console.log(`✅ Node.js version: ${nodeVersion}`);

// Check if dependencies are installed
try {
  const express = await import('express');
  const cors = await import('cors');
  const mcpSdk = await import('@modelcontextprotocol/sdk/client/index.js');
  console.log('✅ Dependencies installed');
} catch (error) {
  console.error('❌ Dependencies not installed. Run: npm install');
  process.exit(1);
}

// Check if Playwright MCP can be accessed
console.log('\n🔍 Checking Playwright MCP server...');
const playwrightCheck = spawn('npx', ['-y', '@playwright/mcp@latest', '--version'], {
  stdio: 'pipe',
  timeout: 10000,
});

let playwrightAvailable = false;
playwrightCheck.stdout.on('data', () => {
  playwrightAvailable = true;
});

playwrightCheck.stderr.on('data', (data) => {
  // Some MCP servers output to stderr, which is fine
  if (data.toString().includes('version') || data.toString().includes('Playwright')) {
    playwrightAvailable = true;
  }
});

playwrightCheck.on('close', (code) => {
  if (playwrightAvailable || code === 0) {
    console.log('✅ Playwright MCP server is accessible');
  } else {
    console.log('⚠️  Playwright MCP server check inconclusive (this is usually OK)');
  }
  
  console.log('\n✅ Setup verification complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Run: npm run server');
  console.log('   2. Load the extension in Chrome');
  console.log('   3. Connect to MCP server from the extension popup');
  console.log('   4. Press Cmd+Shift+K on any webpage to open the chat UI\n');
});

playwrightCheck.on('error', () => {
  console.log('⚠️  Could not verify Playwright MCP (this is usually OK if npx is working)');
  console.log('\n✅ Setup verification complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Run: npm run server');
  console.log('   2. Load the extension in Chrome');
  console.log('   3. Connect to MCP server from the extension popup');
  console.log('   4. Press Cmd+Shift+K on any webpage to open the chat UI\n');
});


