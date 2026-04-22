#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The CLI script simply spawns the Electron app.
// If installed globally via npm, it will find the electron binary in node_modules and run our main.js
const appPath = path.join(__dirname, '..');

const child = spawn('npx', ['electron', appPath], {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code);
});
