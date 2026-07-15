'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const popupSource = fs.readFileSync(path.join(root, 'extension', 'popup.js'), 'utf8');
const shimSource = fs.readFileSync(path.join(root, 'extension', 'shim.js'), 'utf8');
const pageRelaySource = fs.readFileSync(path.join(root, 'extension', 'page-relay.js'), 'utf8');
const userscriptApi = require('../clean-math-copy.user.js');

test('companion extension installs the shared source early in every eligible frame', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, '140');
  assert.deepEqual(manifest.permissions.sort(), ['clipboardWrite', 'storage']);
  assert.deepEqual(manifest.host_permissions, ['<all_urls>']);
  assert.equal(manifest.content_scripts.length, 2);

  const mainWorld = manifest.content_scripts[0];
  const isolatedWorld = manifest.content_scripts[1];
  assert.deepEqual(mainWorld.js, ['extension/page-relay.js']);
  assert.equal(mainWorld.world, 'MAIN');
  assert.deepEqual(isolatedWorld.js, ['extension/shim.js', 'clean-math-copy.user.js']);
  assert.equal(isolatedWorld.world, 'ISOLATED');
  for (const contentScript of [mainWorld, isolatedWorld]) {
    assert.equal(contentScript.run_at, 'document_start');
    assert.equal(contentScript.all_frames, true);
    assert.equal(contentScript.match_about_blank, true);
    assert.equal(contentScript.match_origin_as_fallback, true);
    assert.deepEqual(contentScript.matches, ['http://*/*', 'https://*/*', 'file:///*']);
  }
  for (const filename of [...mainWorld.js, ...isolatedWorld.js]) {
    assert.equal(fs.existsSync(path.join(root, filename)), true, filename + ' must exist');
  }
});

test('MAIN-world relay artifact exactly embeds the exported production relay', () => {
  const relayFunctionSource = userscriptApi.cleanMathCopyPageRelayMain.toString();
  assert.ok(pageRelaySource.includes(relayFunctionSource));
  assert.equal(pageRelaySource.split(relayFunctionSource).length - 1, 1);
});

test('MAIN-world relay accepts one strict hidden-carrier handshake without exposing its capability', () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    runScripts: 'outside-only',
    url: 'https://example.test/'
  });
  const { window } = dom;
  const storageListeners = [];
  window.chrome = {
    runtime: { lastError: null, getURL: (filename) => 'chrome-extension://test/' + filename },
    storage: {
      local: {
        get: (_key, callback) => callback({}),
        set: (_record, callback) => callback()
      },
      onChanged: { addListener: (listener) => storageListeners.push(listener) }
    }
  };
  window.fetch = async () => ({ ok: true, text: async () => '' });
  window.eval(pageRelaySource);
  window.eval(shimSource);

  const carrier = window.document.createElement('span');
  carrier.id = 'clean-math-copy-relay-1-2-3-4';
  carrier.hidden = true;
  carrier.setAttribute('aria-hidden', 'true');
  window.document.documentElement.appendChild(carrier);

  let leakedEvents = 0;
  window.document.addEventListener('clean-math-copy-extension-relay-install-v1', () => {
    leakedEvents += 1;
  }, true);
  carrier.setAttribute('data-forged', '1');
  carrier.textContent = JSON.stringify({
    version: 1,
    eventName: 'clean-math-copy-request-5-6-7-8',
    googleDocs: false,
    nonce: '9-a-b-c'
  });
  carrier.dispatchEvent(new window.Event('clean-math-copy-extension-relay-install-v1'));
  assert.notEqual(carrier.getAttribute('data-clean-math-copy-relay-ready'), '1');

  carrier.removeAttribute('data-forged');
  carrier.textContent = '';
  assert.equal(window.GM_cleanMathCopyInstallPageRelay(
    carrier.id,
    'clean-math-copy-request-5-6-7-8',
    false
  ), true);
  assert.equal(carrier.getAttribute('data-clean-math-copy-relay-ready'), '1');
  assert.equal(carrier.hasAttribute('data-clean-math-copy-relay-install-ack'), false);
  assert.equal(carrier.textContent, '');
  assert.equal(leakedEvents, 0);

  const second = window.document.createElement('span');
  second.id = 'clean-math-copy-relay-d-e-f-g';
  second.hidden = true;
  second.setAttribute('aria-hidden', 'true');
  window.document.documentElement.appendChild(second);
  assert.equal(window.GM_cleanMathCopyInstallPageRelay(
    second.id,
    'clean-math-copy-request-h-i-j-k',
    false
  ), false);
  dom.window.close();
});

test('companion extension exposes only its bundled PDF engine assets', () => {
  assert.equal(manifest.web_accessible_resources.length, 1);
  const resources = manifest.web_accessible_resources[0];
  assert.deepEqual(resources.matches, ['<all_urls>']);
  assert.deepEqual(resources.resources.sort(), [
    'extension/vendor/cmaps/*',
    'extension/vendor/iccs/*',
    'extension/vendor/pdf.min.mjs',
    'extension/vendor/pdf.worker.min.mjs',
    'extension/vendor/standard_fonts/*',
    'extension/vendor/wasm/*'
  ]);
  for (const filename of resources.resources) {
    if (filename.endsWith('/*')) {
      const directory = path.join(root, filename.slice(0, -2));
      assert.equal(fs.statSync(directory).isDirectory(), true, filename + ' must be a directory');
      assert.ok(fs.readdirSync(directory).length > 0, filename + ' must not be empty');
    } else {
      assert.equal(fs.existsSync(path.join(root, filename)), true, filename + ' must exist');
    }
  }
  assert.equal(fs.existsSync(path.join(root, 'extension/vendor/wasm/quickjs-eval.js')), false);
  assert.equal(fs.existsSync(path.join(root, 'extension/vendor/wasm/quickjs-eval.wasm')), false);
});

test('extension shim maps storage and only the two named PDF modules', async () => {
  const values = new Map([['saved', 7]]);
  const storageListeners = [];
  let writes = 0;
  const chrome = {
    runtime: {
      lastError: null,
      getURL: (filename) => 'chrome-extension://test/' + filename
    },
    storage: {
      local: {
        get: (key, callback) => callback(values.has(key) ? { [key]: values.get(key) } : {}),
        set: (record, callback) => {
          writes += 1;
          for (const [key, value] of Object.entries(record)) values.set(key, value);
          callback();
        }
      },
      onChanged: { addListener: (listener) => storageListeners.push(listener) }
    }
  };
  const context = {
    chrome,
    document: {
      createElement: (tagName) => ({ tagName, appendChild() {} })
    },
    navigator: { clipboard: { writeText: async () => undefined } },
    window: {},
    fetch: async () => ({ ok: true, text: async () => 'module source' })
  };
  vm.runInNewContext(shimSource, context);

  assert.equal(writes, 0, 'loading the shim must not race by writing defaults');
  assert.equal(context.GM_info.injectInto, 'content');
  assert.equal(context.GM.info.injectInto, 'content');
  assert.equal(await context.GM_getValue('saved', 0), 7);
  assert.equal(await context.GM_getValue('missing', 9), 9);
  await context.GM_setValue('saved', 8);
  assert.equal(values.get('saved'), 8);
  assert.equal(
    context.GM_getResourceURL('clean_math_copy_pdfjs'),
    'chrome-extension://test/extension/vendor/pdf.min.mjs'
  );
  assert.equal(
    context.GM.getResourceUrl('clean_math_copy_pdfjs_worker'),
    'chrome-extension://test/extension/vendor/pdf.worker.min.mjs'
  );
  assert.throws(() => context.GM_getResourceURL('unexpected'), /Unknown bundled resource/);

  let change = null;
  context.GM_addValueChangeListener('saved', (...args) => { change = args; });
  storageListeners[0]({ saved: { oldValue: 8, newValue: 10 } }, 'local');
  assert.deepEqual(Array.from(change), ['saved', 8, 10, true]);
});

function popupHarness(storedMode, delayInitialRead = false) {
  const buttons = ['faithful', 'calculator', 'latex', 'native'].map((mode) => {
    const attributes = new Map();
    const listeners = new Map();
    return {
      dataset: { mode, label: mode.toUpperCase() },
      textContent: '',
      setAttribute: (name, value) => attributes.set(name, value),
      getAttribute: (name) => attributes.get(name),
      addEventListener: (name, listener) => listeners.set(name, listener),
      click: () => listeners.get('click')()
    };
  });
  let storageListener = null;
  let pendingRead = null;
  let stored = storedMode ? { outputMode: storedMode } : undefined;
  const chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        get: (_key, callback) => {
          const snapshot = { 'cleanMathCopy.settings.v3': stored };
          if (delayInitialRead) pendingRead = () => callback(snapshot);
          else callback(snapshot);
        },
        set: (value, callback) => {
          stored = value['cleanMathCopy.settings.v3'];
          callback();
        }
      },
      onChanged: { addListener: (listener) => { storageListener = listener; } }
    }
  };
  vm.runInNewContext(popupSource, {
    chrome,
    document: { querySelectorAll: () => buttons }
  });
  return {
    buttons,
    get stored() { return stored; },
    resolveRead: () => pendingRead && pendingRead(),
    change: (mode) => storageListener({
      'cleanMathCopy.settings.v3': { newValue: { outputMode: mode } }
    }, 'local')
  };
}

test('popup marks exactly the active mode and keeps the checkmark synchronized', () => {
  const popup = popupHarness('calculator');
  assert.deepEqual(popup.buttons.map((button) => button.textContent), [
    'FAITHFUL', '✓ CALCULATOR', 'LATEX', 'NATIVE'
  ]);
  assert.deepEqual(popup.buttons.map((button) => button.getAttribute('aria-pressed')), [
    'false', 'true', 'false', 'false'
  ]);

  popup.buttons[2].click();
  assert.equal(popup.stored.outputMode, 'latex');
  assert.equal(popup.buttons[2].textContent, '✓ LATEX');

  popup.change('native');
  assert.equal(popup.buttons[2].textContent, 'LATEX');
  assert.equal(popup.buttons[3].textContent, '✓ NATIVE');
});

test('popup falls back to faithful when extension storage is missing or invalid', () => {
  for (const candidate of [undefined, 'not-a-mode']) {
    const popup = popupHarness(candidate);
    assert.equal(popup.buttons[0].textContent, '✓ FAITHFUL');
    assert.equal(popup.buttons.filter((button) => button.textContent.startsWith('✓ ')).length, 1);
  }
});

test('popup never lets a stale initial storage read replace a newer mode', () => {
  const popup = popupHarness('calculator', true);
  popup.change('latex');
  popup.resolveRead();
  assert.equal(popup.buttons[2].textContent, '✓ LATEX');
  assert.equal(popup.buttons[1].textContent, 'CALCULATOR');
});
