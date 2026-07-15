'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const cleanCopy = require('../clean-math-copy.user.js');

const EXPECTED_EQUATION = 'S = ∫ d⁴x √(−g) R';

function equationToken(index, text, x, width, attributes = '') {
  return [
    '<span data-cmc-pdf-item="', index, '" data-cmc-pdf-line="0" ',
    'data-cmc-pdf-line-y="278.713" data-cmc-pdf-x="', x, '" ',
    'data-cmc-pdf-width="', width, '" data-cmc-pdf-size="11.9552" ',
    'data-cmc-pdf-math="1" data-cmc-pdf-math-group="math-1" ',
    'data-cmc-pdf-display-math="1" ', attributes, '>', text, '</span>'
  ].join('');
}

function directPdfCopyFixture() {
  const equation = [
    equationToken(51, 'S', 255.384, 7.199),
    equationToken(53, '=', 266.6, 9.105),
    equationToken(55, 'Z', 279.025, 6.642, 'data-cmc-pdf-semantic="integral"'),
    equationToken(57, 'd', 292.973, 6.083),
    equationToken(58, '4', 299.056, 4.235,
      'data-cmc-pdf-script="sup" data-cmc-pdf-script-base="57"'),
    equationToken(59, 'x', 303.788, 6.652),
    equationToken(61, '√', 314.342, 9.963,
      'data-cmc-pdf-semantic="root" data-cmc-pdf-radical="root-61" ' +
      'data-cmc-pdf-radical-end="339.638" data-cmc-pdf-radical-chars="0"'),
    equationToken(62, '−', 324.305, 9.299,
      'data-cmc-pdf-radical="root-61" data-cmc-pdf-radical-end="339.638" ' +
      'data-cmc-pdf-radical-chars="1"'),
    equationToken(63, 'gR', 333.603, 14.946,
      'data-cmc-pdf-radical="root-61" data-cmc-pdf-radical-end="339.638" ' +
      'data-cmc-pdf-radical-chars="1"')
  ].join('');
  const instance = new JSDOM([
    '<!doctype html><html><body>',
    '<div id="viewer"><section data-cmc-pdf-page="148" ',
    'data-cmc-pdf-text-ready="1" data-cmc-pdf-line-gap="15.891">',
    equation,
    '</section></div><p id="newer">newer copy</p>',
    '</body></html>'
  ].join(''), { url: 'https://example.test/general-relativity.pdf' });
  const { document } = instance.window;
  const viewer = document.querySelector('#viewer');
  cleanCopy.registerTrustedPdfViewerRoot(viewer);
  const selection = instance.window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(viewer);
  selection.removeAllRanges();
  selection.addRange(range);
  return { instance, document, viewer, newer: document.querySelector('#newer') };
}

function dispatchCopy(instance, target) {
  const values = new Map();
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      get types() { return Array.from(values.keys()); },
      clearData(type) { if (arguments.length) values.delete(type); else values.clear(); },
      setData(type, value) { values.set(String(type), String(value)); },
      getData(type) { return values.get(String(type)) || ''; }
    }
  });
  target.dispatchEvent(event);
  return { event, values };
}

function markAsDirectPdf(document) {
  Object.defineProperty(document, 'contentType', {
    configurable: true,
    value: 'application/pdf'
  });
}

function selectContents(instance, element) {
  const selection = instance.window.getSelection();
  const range = instance.window.document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

function settle(instance) {
  return new Promise((resolve) => instance.window.setTimeout(resolve, 20));
}

test('direct PDF copy replays semantic text after Chromium commits corrupt font bytes', async () => {
  const fixture = directPdfCopyFixture();
  let systemClipboard = '';
  const writes = [];
  const previous = global.GM_setClipboard;
  global.GM_setClipboard = (value) => {
    systemClipboard = String(value);
    writes.push(systemClipboard);
  };
  try {
    cleanCopy.install(fixture.document, fixture.instance.window, {
      registerMenus: false,
      settingsProvider: () => ({ outputMode: 'faithful' })
    });
    // Mark it only after installation so this focused test does not start the
    // full PDF.js viewer bootstrap; the copy event still has the exact MIME
    // condition that triggers Chromium's privileged PDF copy path.
    markAsDirectPdf(fixture.document);
    const copied = dispatchCopy(fixture.instance, fixture.viewer);
    assert.equal(copied.event.defaultPrevented, true);
    assert.equal(copied.values.get('text/plain'), EXPECTED_EQUATION);

    // This is the exact late native result observed in real Brave/Tampermonkey.
    systemClipboard = 'S = ∫ d⁴x\n\np \u0000gR';
    await settle(fixture.instance);

    assert.equal(systemClipboard, EXPECTED_EQUATION);
    assert.deepEqual(writes, [EXPECTED_EQUATION]);
  } finally {
    if (previous === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previous;
  }
});

test('direct PDF replay preserves rich HTML when the Clipboard API accepts it', async () => {
  const fixture = directPdfCopyFixture();
  let finalPlain = '';
  let finalHtml = '';
  let writtenItem = null;
  let plainFallbacks = 0;
  class FakeClipboardItem {
    constructor(representations) { this.representations = representations; }
  }
  Object.defineProperty(fixture.instance.window, 'Blob', { configurable: true, value: Blob });
  Object.defineProperty(fixture.instance.window, 'ClipboardItem', {
    configurable: true,
    value: FakeClipboardItem
  });
  Object.defineProperty(fixture.instance.window.navigator, 'clipboard', {
    configurable: true,
    value: {
      async write(items) {
        writtenItem = items[0];
        finalPlain = await writtenItem.representations['text/plain'].text();
        finalHtml = await writtenItem.representations['text/html'].text();
      }
    }
  });
  const previous = global.GM_setClipboard;
  global.GM_setClipboard = () => { plainFallbacks += 1; };
  try {
    cleanCopy.install(fixture.document, fixture.instance.window, {
      registerMenus: false,
      settingsProvider: () => ({ outputMode: 'faithful' })
    });
    markAsDirectPdf(fixture.document);
    const copied = dispatchCopy(fixture.instance, fixture.viewer);
    assert.equal(copied.event.defaultPrevented, true);

    finalPlain = 'p \u0000gR';
    await settle(fixture.instance);

    assert.ok(writtenItem);
    assert.equal(finalPlain, EXPECTED_EQUATION);
    assert.equal(
      finalHtml,
      '<!--StartFragment-->S = ∫ d<sup>4</sup>x √(−g) R<!--EndFragment-->'
    );
    assert.equal(plainFallbacks, 0);
  } finally {
    if (previous === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previous;
  }
});

test('a newer copy invalidates a pending direct PDF replay', async () => {
  const fixture = directPdfCopyFixture();
  const writes = [];
  const previous = global.GM_setClipboard;
  global.GM_setClipboard = (value) => { writes.push(String(value)); };
  try {
    cleanCopy.install(fixture.document, fixture.instance.window, {
      registerMenus: false,
      settingsProvider: () => ({ outputMode: 'faithful' })
    });
    markAsDirectPdf(fixture.document);
    dispatchCopy(fixture.instance, fixture.viewer);

    // The later copy need not itself be rewritten to invalidate the older
    // asynchronous PDF task; user intent order, not payload availability, wins.
    selectContents(fixture.instance, fixture.newer);
    const newer = dispatchCopy(fixture.instance, fixture.newer);
    assert.equal(newer.event.defaultPrevented, false);
    await settle(fixture.instance);

    assert.deepEqual(writes, []);
  } finally {
    if (previous === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previous;
  }
});

test('a mode change invalidates a pending direct PDF replay', async () => {
  const fixture = directPdfCopyFixture();
  const writes = [];
  let outputMode = 'faithful';
  const previous = global.GM_setClipboard;
  global.GM_setClipboard = (value) => { writes.push(String(value)); };
  try {
    cleanCopy.install(fixture.document, fixture.instance.window, {
      registerMenus: false,
      settingsProvider: () => ({ outputMode })
    });
    markAsDirectPdf(fixture.document);
    dispatchCopy(fixture.instance, fixture.viewer);
    outputMode = 'native';
    await settle(fixture.instance);
    assert.deepEqual(writes, []);
  } finally {
    if (previous === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previous;
  }
});

test('trusted PDF markup on an ordinary HTML document does not trigger an async replay', async () => {
  const fixture = directPdfCopyFixture();
  const writes = [];
  const previous = global.GM_setClipboard;
  global.GM_setClipboard = (value) => { writes.push(String(value)); };
  try {
    cleanCopy.install(fixture.document, fixture.instance.window, {
      registerMenus: false,
      settingsProvider: () => ({ outputMode: 'faithful' })
    });
    const copied = dispatchCopy(fixture.instance, fixture.viewer);
    assert.equal(copied.values.get('text/plain'), EXPECTED_EQUATION);
    await settle(fixture.instance);
    assert.deepEqual(writes, []);
  } finally {
    if (previous === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previous;
  }
});
