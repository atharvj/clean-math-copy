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
  assert.match(source, /\/\/ @version\s+2\.0\.1/);
  assert.match(source, /\/\/ @namespace\s+https:\/\/github\.com\/atharvj\/clean-math-copy/);
  assert.match(source, /\/\/ @homepageURL\s+https:\/\/github\.com\/atharvj\/clean-math-copy/);
  assert.match(source, /\/\/ @supportURL\s+https:\/\/github\.com\/atharvj\/clean-math-copy\/issues/);
  assert.match(source, /\/\/ @downloadURL\s+https:\/\/raw\.githubusercontent\.com\/atharvj\/clean-math-copy\/main\/clean-math-copy\.user\.js/);
  assert.match(source, /\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/atharvj\/clean-math-copy\/main\/clean-math-copy\.user\.js/);
  assert.match(source, /\/\/ @run-at\s+document-start/);
  assert.match(source, /\/\/ @match\s+https:\/\/\*\/\*/);
  assert.match(source, /\/\/ ==\/UserScript==/);
  assert.match(source, /const VERSION = '2\.0\.1'/);
  assert.match(source, /const STORAGE_KEY = 'cleanMathCopy\.settings\.v3'/);
  assert.match(source, /outputMode: 'faithful'/);
});

test('the installable artifact has no network-loaded runtime dependencies', () => {
  assert.doesNotMatch(source, /\/\/ @require\s+/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
});
