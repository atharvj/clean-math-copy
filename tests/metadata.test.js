'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join(__dirname, '..', 'clean-math-copy.user.js');
const source = fs.readFileSync(scriptPath, 'utf8');

test('ships a valid installable userscript metadata block', () => {
  assert.match(source, /^\/\/ ==UserScript==/);
  assert.match(source, /\/\/ @name\s+Clean Math Copy/);
  assert.match(source, /\/\/ @version\s+1\.2\.2/);
  assert.match(source, /\/\/ @run-at\s+document-start/);
  assert.match(source, /\/\/ @match\s+https:\/\/\*\/\*/);
  assert.match(source, /\/\/ ==\/UserScript==/);
});

test('the installable artifact has no network-loaded runtime dependencies', () => {
  assert.doesNotMatch(source, /\/\/ @require\s+/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
});
