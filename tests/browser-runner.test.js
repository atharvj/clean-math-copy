'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const runner = fs.readFileSync(path.join(__dirname, 'run-browser-smoke.js'), 'utf8');

test('browser smoke runner keeps CDP local and does not disable browser sandboxing', () => {
  assert.match(runner, /--remote-debugging-address=127\.0\.0\.1/);
  assert.doesNotMatch(runner, /--no-sandbox/);
  assert.doesNotMatch(runner, /--allow-file-access-from-files/);
});

test('browser smoke runner observes launch errors and awaits graceful and forced termination', () => {
  assert.match(runner, /child\.once\('error'/);
  assert.match(runner, /await terminateBrowser\(child\)/);
  assert.match(runner, /SIGTERM/);
  assert.match(runner, /SIGKILL/);
  assert.match(runner, /await waitForChildExit/);
});
