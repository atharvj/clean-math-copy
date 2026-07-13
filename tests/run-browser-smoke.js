'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');

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

async function waitForResult(port, processState, isolatedFixture) {
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
      const isolated = pages.find((item) => item.url === isolatedFixture);
      if (isolated && /^FAIL\b/.test(isolated.title || '')) throw new Error(isolated.title + ' at ' + isolated.url);
      if (isolated && /^PASS\b/.test(isolated.title || '')) return isolated.title;
    } catch (error) {
      if (/^FAIL\b/.test(error.message || '')) throw error;
      lastError = error;
    }
    await delay(100);
  }
  throw new Error('Timed out waiting for the browser smoke result' + (lastError ? ': ' + lastError.message : '.'));
}

function startFixtureServer(html, scriptSource) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
      if (pathname === '/clean-math-copy.user.js') {
        response.writeHead(200, {
          'Content-Type': 'text/javascript; charset=utf-8',
          'Cache-Control': 'no-store'
        });
        response.end(scriptSource);
        return;
      }
      if (pathname !== '/browser-smoke.html') {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      response.end(html);
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function closeServer(server) {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}

function isolatedExtension(profile, scriptSource, relaySource) {
  const extension = path.join(profile, 'isolated-world-extension');
  fs.mkdirSync(extension, { recursive: true });
  const manifest = {
    manifest_version: 3,
    name: 'Clean Math Copy isolated-world smoke',
    version: '1.0.0',
    content_scripts: [
      {
        matches: ['http://127.0.0.1/*'],
        js: ['page-relay.js'],
        run_at: 'document_start',
        world: 'MAIN'
      },
      {
        matches: ['http://127.0.0.1/*'],
        js: ['content.js'],
        run_at: 'document_start',
        world: 'ISOLATED'
      }
    ]
  };
  const prelude = [
    "'use strict';",
    "if (new URLSearchParams(location.search).has('isolated')) {",
    "globalThis.GM_info = { injectInto: 'content' };",
    'globalThis.GM_addElement = (tagName, attributes) => {',
    '  const element = document.createElement(tagName);',
    '  for (const [name, value] of Object.entries(attributes || {})) {',
    "    if (name === 'textContent') element.textContent = String(value);",
    '    else element.setAttribute(name, String(value));',
    '  }',
    '  (document.head || document.documentElement).appendChild(element);',
    "  document.dispatchEvent(new CustomEvent('clean-math-copy-test-inject'));",
    '  return element;',
    '};'
  ].join('\n');
  const pageRelay = [
    "'use strict';",
    relaySource + ';',
    "document.addEventListener('clean-math-copy-test-inject', () => {",
    "  const carriers = document.querySelectorAll('[id^=\"clean-math-copy-relay-\"]');",
    '  for (const carrier of carriers) {',
    "    if (carrier.getAttribute('data-clean-math-copy-relay-ready') !== '1') {",
    "      cleanMathCopyPageRelayMain(carrier.id, carrier.id + '-request');",
    '    }',
    '  }',
    '}, true);'
  ].join('\n');
  fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(extension, 'page-relay.js'), pageRelay);
  fs.writeFileSync(path.join(extension, 'content.js'), prelude + '\n' + scriptSource + '\n}\n');
  return extension;
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
  const fixtureHTML = fs.readFileSync(path.join(__dirname, 'browser-smoke.html'), 'utf8');
  const scriptPath = path.join(__dirname, '..', 'clean-math-copy.user.js');
  const scriptSource = fs.readFileSync(scriptPath, 'utf8');
  const relaySource = require(scriptPath).cleanMathCopyPageRelayMain.toString();
  const fixtureServer = await startFixtureServer(fixtureHTML, scriptSource);
  const fixturePort = fixtureServer.address().port;
  const isolatedFixture = 'http://127.0.0.1:' + fixturePort + '/browser-smoke.html?isolated=1';
  const extension = isolatedExtension(profile, scriptSource, relaySource);
  const processState = { error: null, exitCode: null, signal: null };
  let diagnostics = '';
  const child = spawn(executable, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions-except=' + extension,
    '--load-extension=' + extension,
    '--disable-background-networking',
    '--user-data-dir=' + profile,
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=' + port,
    '--virtual-time-budget=3000',
    isolatedFixture
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
    const title = await waitForResult(port, processState, isolatedFixture);
    console.log(title + ' — page-world and isolated-world copy/DataTransfer smoke');
  } catch (error) {
    if (diagnostics.trim()) console.error(diagnostics.trim());
    throw error;
  } finally {
    try {
      await terminateBrowser(child);
    } finally {
      await closeServer(fixtureServer);
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
