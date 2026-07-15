'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const runner = fs.readFileSync(path.join(__dirname, 'run-browser-smoke.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');

test('browser smoke runner keeps CDP local and does not disable browser sandboxing', () => {
  assert.match(runner, /--remote-debugging-address=127\.0\.0\.1/);
  assert.doesNotMatch(runner, /--no-sandbox/);
  assert.doesNotMatch(runner, /--allow-file-access-from-files/);
  assert.doesNotMatch(runner, /--virtual-time-budget/);
});

test('browser smoke prefers Chromium for unpacked-extension testing', () => {
  assert.match(runner, /'\/Applications\/Chromium[^]*'\/Applications\/Google Chrome/);
  assert.match(runner, /\['chromium', 'chromium-browser', 'brave-browser'[^]*'google-chrome'\]/);
});

test('Linux CI runs Chromium with its user-namespace sandbox available', () => {
  assert.match(workflow, /kernel\.apparmor_restrict_unprivileged_userns=0/);
  assert.match(workflow, /CHROME_BIN: \/usr\/bin\/chromium/);
  assert.doesNotMatch(workflow, /--no-sandbox/);
});

test('browser smoke runner observes launch errors and awaits graceful and forced termination', () => {
  assert.match(runner, /child\.once\('error'/);
  assert.match(runner, /await terminateBrowser\(child\)/);
  assert.match(runner, /SIGTERM/);
  assert.match(runner, /SIGKILL/);
  assert.match(runner, /await waitForChildExit/);
  assert.match(runner, /Date\.now\(\) \+ 120000/);
});

test('browser smoke exercises both page and isolated userscript worlds', () => {
  assert.match(runner, /world: 'MAIN'/);
  assert.match(runner, /world: 'ISOLATED'/);
  assert.match(runner, /--disable-extensions-except=/);
  assert.match(runner, /page-world and isolated-world copy\/DataTransfer smoke/);
});
