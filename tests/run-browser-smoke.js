'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

function browserExecutable() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  for (const command of ['google-chrome', 'brave-browser', 'microsoft-edge', 'chromium', 'chromium-browser']) {
    const located = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { encoding: 'utf8' });
    if (located.status === 0 && located.stdout.trim()) return located.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('No Chromium-family browser found. Set CHROME_BIN to its executable.');
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForResult(port, processState) {
  const deadline = Date.now() + 15000;
  let lastError = null;
  while (Date.now() < deadline) {
    if (processState.error) {
      throw new Error('Browser failed to start: ' + processState.error.message);
    }
    if (processState.exitCode != null || processState.signal != null) {
      const status = processState.exitCode == null ? 'signal ' + processState.signal : 'code ' + processState.exitCode;
      throw new Error('Browser exited before completing the smoke test (' + status + ').');
    }
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/json/list');
      const pages = await response.json();
      const page = pages.find((item) => /browser-smoke\.html$/.test(item.url || ''));
      if (page && /^PASS\b/.test(page.title || '')) return page.title;
      if (page && /^FAIL\b/.test(page.title || '')) throw new Error(page.title);
    } catch (error) {
      if (/^FAIL\b/.test(error.message || '')) throw error;
      lastError = error;
    }
    await delay(100);
  }
  throw new Error('Timed out waiting for the browser smoke result' + (lastError ? ': ' + lastError.message : '.'));
}

function childHasExited(child) {
  return !child || child.exitCode != null || child.signalCode != null;
}

function waitForChildExit(child, timeoutMilliseconds) {
  if (childHasExited(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let timer = null;
    let settled = false;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      child.removeListener('exit', onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    child.once('exit', onExit);
    timer = setTimeout(() => finish(false), timeoutMilliseconds);
    if (childHasExited(child)) finish(true);
  });
}

function runTaskkill(pid, force) {
  return new Promise((resolve) => {
    const args = ['/pid', String(pid), '/t'];
    if (force) args.push('/f');
    const killer = spawn('taskkill', args, { stdio: 'ignore' });
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    killer.once('error', finish);
    killer.once('exit', finish);
  });
}

async function terminateBrowser(child) {
  if (childHasExited(child) || !child.pid) return;
  if (process.platform === 'win32') {
    await runTaskkill(child.pid, false);
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch (error) {
      if (error && error.code !== 'ESRCH') throw error;
    }
  }
  if (await waitForChildExit(child, 2000)) return;

  if (process.platform === 'win32') {
    await runTaskkill(child.pid, true);
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
      if (error && error.code !== 'ESRCH') throw error;
    }
  }
  if (!await waitForChildExit(child, 2000)) {
    throw new Error('Browser process did not exit after SIGTERM/taskkill and forced termination.');
  }
}

async function main() {
  const executable = browserExecutable();
  const port = await availablePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-math-copy-browser-'));
  const fixture = pathToFileURL(path.join(__dirname, 'browser-smoke.html')).href;
  const processState = { error: null, exitCode: null, signal: null };
  let diagnostics = '';
  const child = spawn(executable, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--user-data-dir=' + profile,
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=' + port,
    '--virtual-time-budget=3000',
    fixture
  ], {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'ignore', 'pipe']
  });
  child.stderr.on('data', (chunk) => { diagnostics = (diagnostics + chunk).slice(-8000); });
  child.once('error', (error) => { processState.error = error; });
  child.once('exit', (code, signal) => {
    processState.exitCode = code;
    processState.signal = signal;
  });
  try {
    const title = await waitForResult(port, processState);
    console.log(title + ' — real browser copy/DataTransfer smoke');
  } catch (error) {
    if (diagnostics.trim()) console.error(diagnostics.trim());
    throw error;
  } finally {
    try {
      await terminateBrowser(child);
    } finally {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
