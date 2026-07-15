'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const WebSocket = require('ws');

const STARTUP_TIMEOUT = 60000;
const CONDITION_TIMEOUT = 30000;

function browserExecutable() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  for (const command of ['chromium', 'chromium-browser', 'brave-browser', 'microsoft-edge', 'google-chrome']) {
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

// A generated one-page fixture keeps the browser smoke deterministic and
// avoids checking a binary test artifact into the repository. The separate
// text objects deliberately place "2" above x so the production PDF geometry
// analyzer must recover a superscript rather than merely copy a text stream.
function pdfFixture() {
  const content = [
    'BT',
    '/F1 18 Tf',
    '1 0 0 1 72 720 Tm',
    '(Offline PDF smoke) Tj',
    'ET',
    'BT',
    '/F1 24 Tf',
    '1 0 0 1 200 620 Tm',
    '(x) Tj',
    'ET',
    'BT',
    '/F1 12 Tf',
    '1 0 0 1 214 631 Tm',
    '(2) Tj',
    'ET',
    'BT',
    '/F1 24 Tf',
    '1 0 0 1 222 620 Tm',
    '( + 1 = 0) Tj',
    'ET',
    ''
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    '<< /Length ' + Buffer.byteLength(content, 'latin1') + ' >>\nstream\n' + content + 'endstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  ];
  let source = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(source, 'latin1'));
    source += (index + 1) + ' 0 obj\n' + objects[index] + '\nendobj\n';
  }
  const xrefOffset = Buffer.byteLength(source, 'latin1');
  source += 'xref\n0 ' + (objects.length + 1) + '\n';
  source += '0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) {
    source += String(offset).padStart(10, '0') + ' 00000 n \n';
  }
  source += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n';
  source += 'startxref\n' + xrefOffset + '\n%%EOF\n';
  return Buffer.from(source, 'latin1');
}

function startFixtureServer(pdf) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
      if (pathname !== '/fixture.pdf') {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': pdf.length,
        'Cache-Control': 'no-store',
        'Accept-Ranges': 'none'
      });
      if (request.method === 'HEAD') response.end();
      else response.end(pdf);
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function closeServer(server) {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}

function extensionId(extensionPath) {
  const digest = crypto.createHash('sha256').update(fs.realpathSync(extensionPath)).digest().subarray(0, 16);
  let id = '';
  for (const byte of digest) {
    id += String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15));
  }
  return id;
}

async function jsonTargets(port) {
  const response = await fetch('http://127.0.0.1:' + port + '/json/list', {
    signal: AbortSignal.timeout(1500)
  });
  if (!response.ok) throw new Error('DevTools endpoint returned HTTP ' + response.status);
  return response.json();
}

function runtimeEvaluate(target, expression, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch (_error) { /* already closed */ }
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('DevTools evaluation timed out.')), timeout);
    socket.once('open', () => {
      socket.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression,
          awaitPromise: true,
          returnByValue: true,
          userGesture: true
        }
      }));
    });
    socket.on('message', (data) => {
      const message = JSON.parse(String(data));
      if (message.id !== 1) return;
      if (message.error) {
        finish(new Error('DevTools evaluation failed: ' + JSON.stringify(message.error)));
        return;
      }
      if (message.result && message.result.exceptionDetails) {
        const details = message.result.exceptionDetails;
        const description = details.exception && details.exception.description;
        finish(new Error(description || details.text || 'Browser evaluation threw an exception.'));
        return;
      }
      finish(null, message.result && message.result.result && message.result.result.value);
    });
    socket.once('error', (error) => finish(error));
    socket.once('close', () => {
      if (!settled) finish(new Error('DevTools connection closed before returning a result.'));
    });
  });
}

async function evaluateJson(target, expression) {
  const value = await runtimeEvaluate(target,
    '(async () => JSON.stringify(await (' + expression + ')))()');
  return JSON.parse(value);
}

function processFailure(processState) {
  if (processState.error) return new Error('Browser failed to start: ' + processState.error.message);
  if (processState.exitCode == null && processState.signal == null) return null;
  const status = processState.exitCode == null
    ? 'signal ' + processState.signal
    : 'code ' + processState.exitCode;
  return new Error('Browser exited before completing the PDF smoke test (' + status + ').');
}

async function waitForTarget(port, processState, predicate, label, timeout = STARTUP_TIMEOUT) {
  const deadline = Date.now() + timeout;
  let lastError = null;
  while (Date.now() < deadline) {
    const failure = processFailure(processState);
    if (failure) throw failure;
    try {
      const target = (await jsonTargets(port)).find(predicate);
      if (target) return target;
      lastError = null;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error('Timed out waiting for ' + label + (lastError ? ': ' + lastError.message : '.'));
}

async function waitForCondition(target, expression, label, timeout = CONDITION_TIMEOUT) {
  const deadline = Date.now() + timeout;
  let lastValue;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      lastValue = await runtimeEvaluate(target, expression, 5000);
      lastError = null;
      if (lastValue) return lastValue;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  const detail = lastError ? lastError.message : JSON.stringify(lastValue);
  throw new Error('Timed out waiting for ' + label + ' (last result: ' + detail + ').');
}

async function waitForJsonCondition(target, expression, predicate, label, timeout = CONDITION_TIMEOUT) {
  const deadline = Date.now() + timeout;
  let lastValue;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      lastValue = await evaluateJson(target, expression);
      lastError = null;
      if (predicate(lastValue)) return lastValue;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  const detail = lastError ? lastError.message : JSON.stringify(lastValue);
  throw new Error('Timed out waiting for ' + label + ' (last value: ' + detail + ').');
}

async function openPopup(port, popupUrl) {
  const response = await fetch('http://127.0.0.1:' + port + '/json/new?' + encodeURIComponent(popupUrl), {
    method: 'PUT',
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error('Could not open the extension popup: HTTP ' + response.status);
  return response.json();
}

async function activateTarget(port, target) {
  const response = await fetch('http://127.0.0.1:' + port + '/json/activate/' + target.id, {
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error('Could not activate browser target ' + target.id + ': HTTP ' + response.status);
}

function popupSnapshotExpression() {
  return `(async () => {
    const buttons = Array.from(document.querySelectorAll('button[data-mode]'));
    const stored = await chrome.storage.local.get('cleanMathCopy.settings.v3');
    return {
      ready: document.readyState === 'complete' && buttons.length === 4,
      stored: stored['cleanMathCopy.settings.v3'] || null,
      buttons: buttons.map((button) => ({
        mode: button.dataset.mode,
        text: button.textContent,
        pressed: button.getAttribute('aria-pressed')
      }))
    };
  })()`;
}

function assertActiveMode(snapshot, expectedMode) {
  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.buttons.length, 4);
  const active = snapshot.buttons.filter((button) => button.pressed === 'true');
  assert.deepEqual(active.map((button) => button.mode), [expectedMode]);
  assert.equal(active[0].text.startsWith('✓ '), true);
  assert.equal(snapshot.buttons.filter((button) => button.text.startsWith('✓ ')).length, 1);
  if (snapshot.stored) assert.equal(snapshot.stored.outputMode, expectedMode);
}

async function setMode(popup, mode) {
  const clicked = await runtimeEvaluate(popup, `(() => {
    const button = document.querySelector('button[data-mode="${mode}"]');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true, 'popup did not contain the ' + mode + ' mode');
  await waitForCondition(popup, `(async () => {
    const stored = await chrome.storage.local.get('cleanMathCopy.settings.v3');
    const active = document.querySelector('button[data-mode="${mode}"]');
    return Boolean(stored['cleanMathCopy.settings.v3'] &&
      stored['cleanMathCopy.settings.v3'].outputMode === '${mode}' &&
      active && active.getAttribute('aria-pressed') === 'true' &&
      active.textContent.startsWith('✓ '));
  })()`, mode + ' popup/storage state');
  const snapshot = await evaluateJson(popup, popupSnapshotExpression());
  assertActiveMode(snapshot, mode);
}

function copyEquationExpression() {
  return `(() => {
    const items = Array.from(document.querySelectorAll('[data-cmc-pdf-item]'));
    const x = items.find((item) => item.textContent === 'x' && item.getAttribute('data-cmc-pdf-math') === '1');
    if (!x) return { error: 'math x token was not found' };
    const groupName = x.getAttribute('data-cmc-pdf-math-group');
    const group = items.filter((item) => item.getAttribute('data-cmc-pdf-math-group') === groupName);
    if (!group.length || !group[0].firstChild || !group[group.length - 1].firstChild) {
      return { error: 'math group was empty' };
    }
    const range = document.createRange();
    range.setStart(group[0].firstChild, 0);
    range.setEnd(group[group.length - 1].firstChild, group[group.length - 1].firstChild.length);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const clipboardData = new DataTransfer();
    const event = new ClipboardEvent('copy', { clipboardData, bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    return {
      selected: selection.toString(),
      prevented: event.defaultPrevented,
      types: Array.from(clipboardData.types),
      plain: clipboardData.getData('text/plain'),
      html: clipboardData.getData('text/html')
    };
  })()`;
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
    throw new Error('Browser process did not exit after graceful and forced termination.');
  }
}

async function main() {
  const executable = browserExecutable();
  const extension = fs.realpathSync(path.join(__dirname, '..'));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-math-copy-pdf-extension-'));
  const remotePort = await availablePort();
  const fixtureServer = await startFixtureServer(pdfFixture());
  const fixtureUrl = 'http://127.0.0.1:' + fixtureServer.address().port + '/fixture.pdf';
  const popupUrl = 'chrome-extension://' + extensionId(extension) + '/extension/popup.html';
  const processState = { error: null, exitCode: null, signal: null };
  let diagnostics = '';
  const child = spawn(executable, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions-except=' + extension,
    '--load-extension=' + extension,
    '--disable-background-networking',
    '--disable-component-update',
    '--no-first-run',
    '--disable-default-apps',
    '--user-data-dir=' + profile,
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=' + remotePort,
    fixtureUrl
  ], {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'ignore', 'pipe']
  });
  child.stderr.on('data', (chunk) => { diagnostics = (diagnostics + chunk).slice(-12000); });
  child.once('error', (error) => { processState.error = error; });
  child.once('exit', (code, signal) => {
    processState.exitCode = code;
    processState.signal = signal;
  });

  try {
    const pdfTarget = await waitForTarget(remotePort, processState,
      (target) => target.type === 'page' && target.url === fixtureUrl,
      'the generated PDF target');
    await waitForCondition(pdfTarget, `(() => {
      const root = document.querySelector('.cmc-pdf-viewer-root');
      const page = document.querySelector('[data-cmc-pdf-page="1"]');
      const canvas = page && page.querySelector('canvas');
      return Boolean(document.contentType === 'application/pdf' && root && !root.hidden &&
        document.querySelectorAll('[data-cmc-pdf-page]').length === 1 &&
        page.getAttribute('data-cmc-pdf-text-ready') === '1' &&
        canvas && canvas.width > 1 && canvas.height > 1 &&
        !document.querySelector('.cmc-pdf-error'));
    })()`, 'the bundled selectable PDF viewer', STARTUP_TIMEOUT);

    const initialViewer = await evaluateJson(pdfTarget, `(() => {
      const root = document.querySelector('.cmc-pdf-viewer-root');
      globalThis.__cleanMathCopySmokeRoot = root;
      const page = document.querySelector('[data-cmc-pdf-page="1"]');
      const canvas = page.querySelector('canvas');
      return {
        contentType: document.contentType,
        pageCount: document.querySelectorAll('[data-cmc-pdf-page]').length,
        textReady: page.getAttribute('data-cmc-pdf-text-ready'),
        itemCount: page.querySelectorAll('[data-cmc-pdf-item]').length,
        canvas: [canvas.width, canvas.height],
        error: document.querySelector('.cmc-pdf-error')?.textContent || ''
      };
    })()`);
    assert.equal(initialViewer.contentType, 'application/pdf');
    assert.equal(initialViewer.pageCount, 1);
    assert.equal(initialViewer.textReady, '1');
    assert.equal(initialViewer.itemCount >= 4, true);
    assert.equal(initialViewer.canvas[0] > 1 && initialViewer.canvas[1] > 1, true);
    assert.equal(initialViewer.error, '');

    const popupTarget = await openPopup(remotePort, popupUrl);
    await waitForCondition(popupTarget,
      `document.readyState === 'complete' && document.querySelectorAll('button[data-mode]').length === 4`,
      'the extension popup');
    const initialPopup = await evaluateJson(popupTarget, popupSnapshotExpression());
    assertActiveMode(initialPopup, 'faithful');

    const assetResults = await evaluateJson(popupTarget, `(async () => {
      const paths = [
        'extension/vendor/pdf.min.mjs',
        'extension/vendor/pdf.worker.min.mjs',
        'extension/vendor/cmaps/Adobe-CNS1-UCS2.bcmap',
        'extension/vendor/standard_fonts/LiberationSans-Regular.ttf',
        'extension/vendor/wasm/openjpeg.wasm',
        'extension/vendor/iccs/CGATS001Compat-v2-micro.icc'
      ];
      return Promise.all(paths.map(async (asset) => {
        const response = await fetch(chrome.runtime.getURL(asset));
        const bytes = await response.arrayBuffer();
        return { asset, ok: response.ok, bytes: bytes.byteLength };
      }));
    })()`);
    for (const asset of assetResults) {
      assert.equal(asset.ok, true, asset.asset + ' was not fetchable');
      assert.equal(asset.bytes > 100, true, asset.asset + ' was unexpectedly empty');
    }

    // `/json/new` represents the popup as a normal foreground tab. Bring the
    // document back to the foreground before asking PDF.js to paint; otherwise
    // headless Chromium may throttle its animation-frame render queue forever.
    await activateTarget(remotePort, pdfTarget);
    const faithful = await waitForJsonCondition(pdfTarget, copyEquationExpression(),
      (value) => value && value.prevented === true && value.plain === 'x² + 1 = 0',
      'Faithful mode to reach the PDF copy handler');
    assert.equal(faithful.error, undefined);
    assert.equal(faithful.prevented, true);
    assert.equal(faithful.plain, 'x² + 1 = 0');
    assert.match(faithful.html, /x<sup>2<\/sup> \+ 1 = 0/);
    assert.deepEqual(faithful.types.sort(), ['text/html', 'text/plain']);

    await activateTarget(remotePort, popupTarget);
    await setMode(popupTarget, 'calculator');
    await activateTarget(remotePort, pdfTarget);
    const calculator = await waitForJsonCondition(pdfTarget, copyEquationExpression(),
      (value) => value && value.prevented === true && value.plain === 'x^(2)+1=0',
      'Calculator mode to reach the PDF copy handler');
    assert.equal(calculator.prevented, true);
    assert.equal(calculator.plain, 'x^(2)+1=0');

    await activateTarget(remotePort, popupTarget);
    await setMode(popupTarget, 'latex');
    await activateTarget(remotePort, pdfTarget);
    const latex = await waitForJsonCondition(pdfTarget, copyEquationExpression(),
      (value) => value && value.prevented === true && value.plain === '$x^{2} + 1 = 0$',
      'LaTeX mode to reach the PDF copy handler');
    assert.equal(latex.prevented, true);
    assert.equal(latex.plain, '$x^{2} + 1 = 0$');

    const zoomStarted = await runtimeEvaluate(pdfTarget, `(() => {
      const buttons = Array.from(document.querySelectorAll('.cmc-pdf-toolbar button'));
      const zoomIn = buttons.find((button) => button.textContent === '+');
      const zoomOut = buttons.find((button) => button.textContent === '−');
      if (!zoomIn || !zoomOut) return false;
      for (let index = 0; index < 10; index += 1) {
        zoomIn.click();
        zoomOut.click();
      }
      return true;
    })()`);
    assert.equal(zoomStarted, true);
    try {
      await waitForCondition(pdfTarget, `(() => {
        const page = document.querySelector('[data-cmc-pdf-page="1"]');
        const canvas = page && page.querySelector('canvas');
        return Boolean(page && page.getAttribute('data-cmc-pdf-text-ready') === '1' &&
          canvas && canvas.width > 1 && canvas.height > 1 &&
          !document.querySelector('.cmc-pdf-error'));
      })()`, 'rapid zoom rendering to settle');
    } catch (error) {
      const zoomState = await evaluateJson(pdfTarget, `(() => {
        const page = document.querySelector('[data-cmc-pdf-page="1"]');
        const canvas = page && page.querySelector('canvas');
        return {
          textReady: page && page.getAttribute('data-cmc-pdf-text-ready'),
          renderError: page && page.getAttribute('data-cmc-pdf-render-error'),
          canvas: canvas && [canvas.width, canvas.height],
          zoom: Array.from(document.querySelectorAll('.cmc-pdf-status'))
            .map((item) => item.textContent).find((value) => /%$/.test(value)) || '',
          viewerError: document.querySelector('.cmc-pdf-error')?.textContent || '',
          textChildren: document.querySelector('.cmc-pdf-text-layer')?.childNodes.length || 0
        };
      })()`);
      throw new Error(error.message + ' Final zoom state: ' + JSON.stringify(zoomState));
    }

    await activateTarget(remotePort, popupTarget);
    await setMode(popupTarget, 'native');
    await activateTarget(remotePort, pdfTarget);
    const nativeState = await evaluateJson(pdfTarget, `(() => {
      const root = document.querySelector('.cmc-pdf-viewer-root');
      const page = document.querySelector('[data-cmc-pdf-page="1"]');
      return {
        sameRoot: root === globalThis.__cleanMathCopySmokeRoot,
        pageCount: document.querySelectorAll('[data-cmc-pdf-page]').length,
        textReady: page && page.getAttribute('data-cmc-pdf-text-ready')
      };
    })()`);
    assert.deepEqual(nativeState, { sameRoot: true, pageCount: 1, textReady: '1' });
    const nativeCopy = await waitForJsonCondition(pdfTarget, copyEquationExpression(),
      (value) => value && value.prevented === false && value.plain === '' && value.types.length === 0,
      'Original copy/paste mode to bypass the PDF copy handler');
    assert.equal(nativeCopy.prevented, false);
    assert.equal(nativeCopy.plain, '');
    assert.deepEqual(nativeCopy.types, []);

    await activateTarget(remotePort, popupTarget);
    await setMode(popupTarget, 'faithful');
    await activateTarget(remotePort, pdfTarget);
    const returnedState = await evaluateJson(pdfTarget, `(() => {
      const root = document.querySelector('.cmc-pdf-viewer-root');
      const page = document.querySelector('[data-cmc-pdf-page="1"]');
      const canvas = page && page.querySelector('canvas');
      return {
        sameRoot: root === globalThis.__cleanMathCopySmokeRoot,
        pageCount: document.querySelectorAll('[data-cmc-pdf-page]').length,
        textReady: page && page.getAttribute('data-cmc-pdf-text-ready'),
        canvasReady: Boolean(canvas && canvas.width > 1 && canvas.height > 1),
        error: document.querySelector('.cmc-pdf-error')?.textContent || ''
      };
    })()`);
    assert.deepEqual(returnedState, {
      sameRoot: true,
      pageCount: 1,
      textReady: '1',
      canvasReady: true,
      error: ''
    });
    const returnedCopy = await waitForJsonCondition(pdfTarget, copyEquationExpression(),
      (value) => value && value.prevented === true && value.plain === faithful.plain,
      'Faithful mode to resume PDF copy interception');
    assert.equal(returnedCopy.prevented, true);
    assert.equal(returnedCopy.plain, faithful.plain);

    console.log('PASS actual-extension PDF smoke — offline viewer, assets, modes, copy, zoom, and stable Native→Faithful');
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
