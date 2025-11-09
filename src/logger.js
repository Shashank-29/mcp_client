// Advanced logger utility for the MCP client project
// Supports console output, optional file persistence with simple rotation, and structured JSON logs.
import fs from 'fs';
import path from 'path';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
let currentLevel = process.env.LOG_LEVEL ? (process.env.LOG_LEVEL.toLowerCase()) : 'info';
if (!(currentLevel in LEVELS)) currentLevel = 'info';

const LOG_DIR = process.env.LOG_DIR || path.resolve(process.cwd(), 'logs');
const LOG_FILE = process.env.LOG_FILE || path.join(LOG_DIR, 'mcp.log');
const MAX_BYTES = parseInt(process.env.LOG_MAX_BYTES || '5242880', 10); // default 5MB
const ENABLE_JSON = !!(process.env.LOG_JSON && process.env.LOG_JSON !== '0');

// Ensure log dir exists
try {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (e) {
  // ignore
}

function shouldLog(level) {
  return LEVELS[level] <= LEVELS[currentLevel];
}

function makeEntry(level, parts) {
  const time = new Date().toISOString();
  if (ENABLE_JSON) {
    // Produce structured JSON
    const payload = {
      ts: time,
      level,
      message: parts.map(p => (typeof p === 'string' ? p : JSON.stringify(p))).join(' '),
      pid: process.pid,
      module: 'mcp',
    };
    return JSON.stringify(payload) + '\n';
  }

  return `[mcp:${time}] ${parts.join(' ')}\n`;
}

function rotateIfNeeded() {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    const stat = fs.statSync(LOG_FILE);
    if (stat.size >= MAX_BYTES) {
      const rotated = LOG_FILE + '.1';
      try { fs.renameSync(LOG_FILE, rotated); } catch (e) { /* ignore */ }
    }
  } catch (e) {
    // ignore rotation errors
  }
}

function writeToFile(entry) {
  try {
    rotateIfNeeded();
    fs.appendFileSync(LOG_FILE, entry, { encoding: 'utf8' });
  } catch (e) {
    // Could not write to file, but don't crash
    console.error('Logger file write error:', e && e.message ? e.message : e);
  }
}

function logToOutputs(level, ...parts) {
  if (!shouldLog(level)) return;
  const entry = makeEntry(level, parts);
  // Console output
  if (level === 'error') console.error(entry.trim());
  else if (level === 'warn') console.warn(entry.trim());
  else console.log(entry.trim());
  // File output
  writeToFile(entry);
}

function error(...args) { logToOutputs('error', ...args); }
function warn(...args) { logToOutputs('warn', ...args); }
function info(...args) { logToOutputs('info', ...args); }
function debug(...args) { logToOutputs('debug', ...args); }

function setLevel(level) {
  const l = (level || '').toLowerCase();
  if (l in LEVELS) currentLevel = l;
}

export default { error, warn, info, debug, setLevel };
