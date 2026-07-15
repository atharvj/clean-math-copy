'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const cleanCopy = require('../clean-math-copy.user.js');

// Reduced from David Tong's General Relativity, PDF page 148, equation (4.1).
// Its embedded CMEX10 integral is extracted as "Z", its dimension is a
// separate raised text item, and the radical rule ends between the combined
// "gR" text item's two characters.
const TONG_EQUATION_ITEMS = [
  pdfItem('S', 255.384, 278.713, 11.955, 6.000),
  pdfItem('=', 266.600, 278.713, 11.955, 7.000),
  pdfItem('Z', 279.025, 294.985, 11.955, 6.200, 'integralFont'),
  pdfItem('d', 292.973, 278.713, 11.955, 6.083),
  pdfItem('4', 299.056, 283.649, 7.970, 4.117),
  pdfItem('x', 303.788, 278.713, 11.955, 5.500),
  pdfItem('√', 314.342, 287.658, 11.955, 9.963, 'rootFont'),
  pdfItem('−', 324.305, 278.713, 11.955, 9.298),
  pdfItem('gR', 333.603, 278.713, 11.955, 14.946)
];

const TONG_RADICAL_RULES = [
  { x1: 324.305, y: 287.897, x2: 339.638 }
];

function pdfItem(str, x, y, size, width, fontName = 'mathFont') {
  return {
    str,
    transform: [size, 0, 0, size, x, y],
    width,
    height: size,
    fontName,
    hasEOL: false
  };
}

function analyzeTongEquation() {
  return cleanCopy.analyzePdfPageText(
    TONG_EQUATION_ITEMS,
    {},
    { integralFont: { name: 'ABCDEF+CMEX10' } },
    TONG_RADICAL_RULES
  );
}

function analyzeLegacyEncodedTongEquation() {
  const items = TONG_EQUATION_ITEMS.map((item) => {
    if (item.str === '√') return { ...item, str: 'p' };
    if (item.str === '−') return { ...item, str: '\u0000', fontName: 'rootFont' };
    return { ...item };
  });
  return cleanCopy.analyzePdfPageText(
    items,
    {},
    {
      integralFont: { name: 'ABCDEF+CMEX10' },
      rootFont: { name: 'ABCDEF+CMSY10' }
    },
    TONG_RADICAL_RULES
  );
}

function radicalCharacterCount(item) {
  if (!item.radical || item.semantic === 'root') return 0;
  if (item.x + item.width <= item.radicalEndX + item.size * 0.06) return item.text.length;
  // The real viewer measures DOM Range character rectangles. This exact
  // reduced fixture captures that the rule covers "g" but stops before "R".
  if (item.text === 'gR') return 1;
  return 0;
}

function annotateAnalyzedPdfPage(document, page, analysis, { rendererArtifacts = false, ready = true } = {}) {
  page.setAttribute('data-cmc-pdf-line-gap', String(analysis.normalLineGap || 0));
  if (ready) page.setAttribute('data-cmc-pdf-text-ready', '1');
  for (const item of analysis.items) {
    const token = document.createElement('span');
    token.textContent = item.text;
    if (!item.text.trim()) {
      // Production leaves whitespace-only TextLayer nodes unannotated.
      token.className = 'pdfjs-whitespace';
      page.appendChild(token);
      if (rendererArtifacts && item.hasEOL) {
        const lineBreak = document.createElement('br');
        lineBreak.setAttribute('role', 'presentation');
        lineBreak.className = 'pdfjs-renderer-line-wrap';
        page.appendChild(lineBreak);
      }
      continue;
    }

    const line = analysis.lines[item.line];
    token.setAttribute('data-cmc-pdf-item', String(item.index));
    token.setAttribute('data-cmc-pdf-line', String(item.line));
    token.setAttribute('data-cmc-pdf-line-y', String(line ? line.y : item.effectiveY));
    token.setAttribute('data-cmc-pdf-x', String(item.x));
    token.setAttribute('data-cmc-pdf-width', String(item.width));
    token.setAttribute('data-cmc-pdf-size', String(item.size));
    if (item.math) token.setAttribute('data-cmc-pdf-math', '1');
    if (item.mathGroup) token.setAttribute('data-cmc-pdf-math-group', item.mathGroup);
    if (item.displayMath) token.setAttribute('data-cmc-pdf-display-math', '1');
    if (item.semantic) token.setAttribute('data-cmc-pdf-semantic', item.semantic);
    if (item.accent) {
      token.setAttribute('data-cmc-pdf-accent', item.accent);
      token.setAttribute('data-cmc-pdf-accent-base', String(item.accentBase));
    }
    if (item.script) {
      token.setAttribute('data-cmc-pdf-script', item.script);
      token.setAttribute('data-cmc-pdf-script-base', String(item.scriptBase));
    }
    if (item.radical) {
      token.setAttribute('data-cmc-pdf-radical', item.radical);
      token.setAttribute('data-cmc-pdf-radical-end', String(item.radicalEndX));
      token.setAttribute('data-cmc-pdf-radical-chars', String(radicalCharacterCount(item)));
    }
    if (item.fraction) {
      token.setAttribute('data-cmc-pdf-fraction', item.fraction);
      token.setAttribute('data-cmc-pdf-fraction-role', item.fractionRole);
      token.setAttribute('data-cmc-pdf-fraction-x1', String(item.fractionX1));
      token.setAttribute('data-cmc-pdf-fraction-x2', String(item.fractionX2));
    }
    page.appendChild(token);
  }
}

function tongDomFixture({ trusted = true } = {}) {
  const instance = new JSDOM(
    '<!doctype html><html><body><div id="viewer"><section id="page" data-cmc-pdf-page="148"></section></div></body></html>',
    { url: 'https://example.test/general-relativity.pdf' }
  );
  const { document } = instance.window;
  const root = document.querySelector('#viewer');
  const page = document.querySelector('#page');
  const analysis = analyzeTongEquation();
  annotateAnalyzedPdfPage(document, page, analysis);

  if (trusted) cleanCopy.registerTrustedPdfViewerRoot(root);
  return { instance, document, root, page, analysis };
}

const TONG_PARAGRAPH_LINES = [
  ['Spacetime is a manifold', 'M', ',', 'equipped with a metric of Lorentzian signature', '.', 'An'],
  ['action is an integral over', 'M', '.', 'We know from Section 2.4.4 that we need a volume-form'],
  ['to integrate over a manifold', '.', 'Happily', ',', 'as we have seen', ',', 'the metric provides a canonical'],
  ['volume form', ',', 'which we can then multiply by any scalar function', '.', 'Given that we only'],
  ['have the metric to play with', ',', 'the simplest such (non-trivial) function is the Ricci scalar'],
  ['R', '.', 'This motivates us to consider the wonderfully concise action']
];

const TONG_PARAGRAPH = TONG_PARAGRAPH_LINES
  .map((parts) => parts.reduce((text, part) => {
    if (part === ',' || part === '.') return text + part;
    return text ? text + ' ' + part : part;
  }, ''))
  .join(' ');

function fullTongPageItems() {
  const items = [];
  const baselines = [389.714, 373.823, 357.933, 342.042, 326.152, 310.261];
  for (let lineIndex = 0; lineIndex < TONG_PARAGRAPH_LINES.length; lineIndex += 1) {
    const parts = TONG_PARAGRAPH_LINES[lineIndex];
    let x = 30;
    for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
      const part = parts[partIndex];
      const width = Math.max(3.2, Array.from(part).length * 4.75);
      items.push(pdfItem(part, x, baselines[lineIndex], 11.955, width, 'textFont'));
      x += width;

      // PDF.js can expose explicit whitespace text items even though spacing
      // is already encoded in geometry. The final one also creates the
      // renderer's visual line-break node.
      const whitespace = pdfItem(' ', x, baselines[lineIndex], 11.955, 3, 'textFont');
      whitespace.hasEOL = partIndex === parts.length - 1;
      items.push(whitespace);
      x += 3;
    }
  }
  return items.concat(TONG_EQUATION_ITEMS.map((item) => ({ ...item })));
}

function fullTongPageFixture() {
  const instance = new JSDOM(
    '<!doctype html><html><body><div id="viewer"><section id="page" data-cmc-pdf-page="148"></section></div></body></html>',
    { url: 'https://example.test/general-relativity.pdf' }
  );
  const { document } = instance.window;
  const root = document.querySelector('#viewer');
  const page = document.querySelector('#page');
  const analysis = cleanCopy.analyzePdfPageText(
    fullTongPageItems(),
    {},
    { integralFont: { name: 'ABCDEF+CMEX10' } },
    TONG_RADICAL_RULES
  );
  annotateAnalyzedPdfPage(document, page, analysis, { rendererArtifacts: true });

  cleanCopy.registerTrustedPdfViewerRoot(root);
  return { instance, document, root, page, analysis };
}

function selectNodeContents(instance, node) {
  const selection = instance.window.getSelection();
  selection.removeAllRanges();
  const range = instance.window.document.createRange();
  range.selectNodeContents(node);
  selection.addRange(range);
  return selection;
}

test('Tong PDF geometry recovers its integral, superscript, and exact radical scope', () => {
  const analysis = analyzeTongEquation();
  const [s, equals, integral, differential, dimension, coordinate, root, minus, radicandAndFactor] = analysis.items;

  assert.equal(integral.text, 'Z');
  assert.equal(integral.originalFont, 'CMEX10');
  assert.equal(integral.semantic, 'integral');
  assert.equal(integral.effectiveY, differential.y);

  assert.equal(dimension.script, 'sup');
  assert.equal(dimension.scriptBase, differential.index);
  assert.equal(dimension.line, differential.line);

  assert.equal(root.semantic, 'root');
  assert.equal(root.radical, 'root-' + root.index);
  assert.equal(root.radicalEndX, 339.638);
  assert.equal(minus.radical, root.radical);
  assert.equal(radicandAndFactor.radical, root.radical);
  assert.ok(radicandAndFactor.x < root.radicalEndX);
  assert.ok(radicandAndFactor.x + radicandAndFactor.width > root.radicalEndX);

  assert.equal(analysis.lines.length, 1);
  assert.equal(analysis.lines[0].math, true);
  assert.deepEqual(
    [s, equals, integral, differential, dimension, coordinate, root, minus, radicandAndFactor].map((item) => item.line),
    Array(9).fill(0)
  );
});

test('Tong PDF geometry decodes legacy CMSY radical and minus font slots', () => {
  const analysis = analyzeLegacyEncodedTongEquation();
  const root = analysis.items[6];
  const minus = analysis.items[7];

  assert.equal(root.text, '√');
  assert.equal(root.semantic, 'root');
  assert.equal(root.originalFont, 'CMSY10');
  assert.equal(minus.text, '−');
  assert.equal(minus.radical, root.radical);

  const instance = new JSDOM(
    '<!doctype html><html><body><div id="viewer"><section id="page" data-cmc-pdf-page="148"></section></div></body></html>',
    { url: 'https://example.test/general-relativity.pdf' }
  );
  const { document } = instance.window;
  const viewer = document.querySelector('#viewer');
  const page = document.querySelector('#page');
  annotateAnalyzedPdfPage(document, page, analysis);
  cleanCopy.registerTrustedPdfViewerRoot(viewer);
  const payload = cleanCopy.getCopyPayload(
    document,
    selectNodeContents(instance, page),
    { outputMode: 'faithful' },
    instance.window,
    page
  );
  assert.ok(payload);
  assert.equal(payload.text, 'S = ∫ d⁴x √(−g) R');
  assert.doesNotMatch(payload.text, /[p\u0000]/u);
});

test('Tong PDF geometry recognizes its shallow Greek metric subscript', () => {
  const metricItems = [
    pdfItem('g', 30.000, 215.383, 11.9552, 6.000),
    pdfItem('=', 41.000, 215.383, 11.9552, 7.000),
    pdfItem('det', 53.000, 215.383, 11.9552, 16.000),
    pdfItem('g', 74.000, 215.383, 11.9552, 6.200),
    pdfItem('μν', 80.200, 213.590, 7.9701, 8.000),
    pdfItem(',', 89.200, 215.383, 11.9552, 3.000),
    pdfItem('is negative', 97.200, 215.383, 11.9552, 52.000),
    pdfItem('.', 149.200, 215.383, 11.9552, 3.000)
  ];
  const analysis = cleanCopy.analyzePdfPageText(metricItems, {}, {}, []);
  const base = analysis.items[3];
  const greekIndices = analysis.items[4];
  assert.equal((greekIndices.y - base.y) / base.size < -0.10, true);
  assert.equal((greekIndices.y - base.y) / base.size > -0.16, true);
  assert.equal(greekIndices.script, 'sub');
  assert.equal(greekIndices.scriptBase, base.index);
  assert.equal(greekIndices.line, base.line);

  const instance = new JSDOM(
    '<!doctype html><html><body><div id="viewer"><section id="page" data-cmc-pdf-page="136"></section></div></body></html>',
    { url: 'https://example.test/general-relativity.pdf' }
  );
  const { document } = instance.window;
  const root = document.querySelector('#viewer');
  const page = document.querySelector('#page');
  annotateAnalyzedPdfPage(document, page, analysis);
  cleanCopy.registerTrustedPdfViewerRoot(root);
  const payload = cleanCopy.getCopyPayload(
    document,
    selectNodeContents(instance, page),
    { outputMode: 'faithful' },
    instance.window,
    page
  );
  assert.ok(payload);
  assert.equal(payload.reason, 'trusted-pdf-text-layer');
  assert.equal(payload.text, 'g = det g_(μν), is negative.');
});

test('trusted PDF text layer serializes the Tong action in every output mode', () => {
  const expectations = {
    faithful: 'S = ∫ d⁴x √(−g) R',
    latex: '$S = \\int d^{4}x \\sqrt{-g} R$',
    calculator: 'S=integral(d^(4))*x*sqrt(-g)*R'
  };

  for (const [outputMode, expected] of Object.entries(expectations)) {
    const fixture = tongDomFixture();
    const selection = selectNodeContents(fixture.instance, fixture.page);
    const payload = cleanCopy.getCopyPayload(
      fixture.document,
      selection,
      { outputMode },
      fixture.instance.window,
      fixture.page
    );

    assert.ok(payload, outputMode + ' should produce a payload');
    assert.equal(payload.reason, 'trusted-pdf-text-layer');
    assert.equal(payload.text, expected);
    assert.equal(payload.text.trim(), payload.text);
  }
});

test('trusted PDF page collapses renderer wraps and keeps one exact display equation', () => {
  const fixture = fullTongPageFixture();
  const rawRendererText = fixture.page.textContent;
  assert.match(rawRendererText, /M ,/);
  assert.equal(fixture.page.querySelectorAll('.pdfjs-whitespace').length > 6, true);
  assert.equal(fixture.page.querySelectorAll('.pdfjs-renderer-line-wrap').length, 6);
  assert.equal(fixture.page.querySelectorAll('.pdfjs-whitespace[data-cmc-pdf-item]').length, 0);

  const selection = selectNodeContents(fixture.instance, fixture.page);
  const faithful = cleanCopy.getCopyPayload(
    fixture.document,
    selection,
    { outputMode: 'faithful' },
    fixture.instance.window,
    fixture.page
  );
  assert.ok(faithful);
  assert.equal(faithful.reason, 'trusted-pdf-text-layer');
  assert.equal(faithful.text, TONG_PARAGRAPH + '\n\nS = ∫ d⁴x √(−g) R');
  assert.doesNotMatch(faithful.text, / [,.]/);
  assert.equal((faithful.text.match(/\n/g) || []).length, 2);

  const latex = cleanCopy.getCopyPayload(
    fixture.document,
    selection,
    { outputMode: 'latex' },
    fixture.instance.window,
    fixture.page
  );
  assert.ok(latex);
  assert.equal(
    latex.text,
    TONG_PARAGRAPH + '\n\n$S = \\int d^{4}x \\sqrt{-g} R$'
  );
  assert.equal((latex.text.match(/\$/g) || []).length, 2, 'the display equation must be one LaTeX group');
  assert.doesNotMatch(latex.text, /\$[^$]*\$\s+\$/);
});

test('trusted inline PDF math reconstructs a stacked fraction without absorbing prose', () => {
  const baseline = 100;
  const inlineItems = [
    pdfItem('For a point source ', 10, baseline, 11.955, 105, 'textFont'),
    pdfItem('ρ', 120, baseline, 11.955, 6),
    pdfItem('(', 126, baseline, 11.955, 3),
    pdfItem('r', 129, baseline, 11.955, 5),
    pdfItem(')', 134, baseline, 11.955, 3),
    pdfItem('=', 142, baseline, 11.955, 7),
    pdfItem('M', 154, baseline, 11.955, 7),
    pdfItem('δ', 161, baseline, 11.955, 7),
    pdfItem('3', 168, 104, 7.970, 4),
    pdfItem('(', 172, baseline, 11.955, 3),
    pdfItem('r', 175, baseline, 11.955, 5),
    pdfItem(')', 180, baseline, 11.955, 3),
    pdfItem('⇒', 188, baseline, 11.955, 10),
    pdfItem('Φ', 203, baseline, 11.955, 8),
    pdfItem('=', 216, baseline, 11.955, 7),
    // The unary minus sits just left of the fraction bar. Its horizontal
    // separation prevents it from being mistaken for the scripts' base.
    pdfItem('−', 219, baseline, 11.955, 5),
    pdfItem('GM', 233, 106, 9, 13),
    pdfItem('r', 237, 93, 9, 5),
    pdfItem(', which solves the equation.', 260, baseline, 11.955, 130, 'textFont')
  ];
  const fractionRule = [{ x1: 231, y: 100, x2: 249 }];
  const analysis = cleanCopy.analyzePdfPageText(inlineItems, {}, {}, fractionRule);
  const numerator = analysis.items[16];
  const denominator = analysis.items[17];
  assert.equal(numerator.fractionRole, 'numerator');
  assert.equal(denominator.fractionRole, 'denominator');
  assert.equal(numerator.fraction, denominator.fraction);
  assert.ok(numerator.fraction);
  assert.equal(numerator.mathGroup, denominator.mathGroup);
  assert.ok(numerator.mathGroup);
  assert.equal(numerator.displayMath, false);

  const instance = new JSDOM(
    '<!doctype html><html><body><div id="viewer"><section id="page" data-cmc-pdf-page="42"></section></div></body></html>',
    { url: 'https://example.test/gravity-notes.pdf' }
  );
  const { document } = instance.window;
  const root = document.querySelector('#viewer');
  const page = document.querySelector('#page');
  annotateAnalyzedPdfPage(document, page, analysis);
  cleanCopy.registerTrustedPdfViewerRoot(root);

  const first = page.querySelector('[data-cmc-pdf-item="1"]');
  const last = page.querySelector('[data-cmc-pdf-item="17"]');
  assert.ok(first);
  assert.ok(last);
  assert.equal(page.getAttribute('data-cmc-pdf-text-ready'), '1');
  assert.equal(page.querySelector('[data-cmc-pdf-item="16"]').getAttribute('data-cmc-pdf-fraction-role'), 'numerator');
  assert.equal(last.getAttribute('data-cmc-pdf-fraction-role'), 'denominator');

  const range = document.createRange();
  range.setStart(first.firstChild, 0);
  range.setEnd(last.firstChild, last.firstChild.length);
  const selection = instance.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  const faithful = cleanCopy.getCopyPayload(
    document,
    selection,
    { outputMode: 'faithful' },
    instance.window,
    first
  );
  assert.ok(faithful);
  assert.equal(faithful.reason, 'trusted-pdf-text-layer');
  assert.equal(faithful.text, 'ρ(r) = Mδ³(r) ⇒ Φ = −GM/r');

  const latex = cleanCopy.getCopyPayload(
    document,
    selection,
    { outputMode: 'latex' },
    instance.window,
    first
  );
  assert.ok(latex);
  assert.equal(latex.text, '$\\rho(r) = M\\delta^{3}(r) \\Rightarrow \\Phi = -\\frac{GM}{r}$');
  assert.equal((latex.text.match(/\$/g) || []).length, 2);
});

test('trusted PDF geometry attaches positioned vector and hat accents to their exact bases', () => {
  const items = [
    pdfItem('J', 20, 100, 12, 7),
    pdfItem('⃗', 20, 106, 8, 7),
    pdfItem('=', 34, 100, 12, 7),
    pdfItem('J', 48, 100, 12, 7),
    pdfItem('z', 55, 100, 12, 6),
    pdfItem('ˆ', 55, 106, 8, 6)
  ];
  const analysis = cleanCopy.analyzePdfPageText(items, {}, {}, []);
  assert.equal(analysis.items[1].accent, 'vector');
  assert.equal(analysis.items[1].accentBase, 0);
  assert.equal(analysis.items[5].accent, 'hat');
  assert.equal(analysis.items[5].accentBase, 4);

  const instance = new JSDOM(
    '<!doctype html><html><body><div id="viewer"><section id="page" data-cmc-pdf-page="1"></section></div></body></html>',
    { url: 'https://example.test/vector.pdf' }
  );
  const { document } = instance.window;
  const root = document.querySelector('#viewer');
  const page = document.querySelector('#page');
  annotateAnalyzedPdfPage(document, page, analysis);
  cleanCopy.registerTrustedPdfViewerRoot(root);
  const selection = selectNodeContents(instance, page);

  const faithful = cleanCopy.getCopyPayload(document, selection, { outputMode: 'faithful' }, instance.window, page);
  assert.ok(faithful);
  assert.equal(faithful.text, 'J⃗ = Jẑ');
  const latex = cleanCopy.getCopyPayload(document, selection, { outputMode: 'latex' }, instance.window, page);
  assert.ok(latex);
  assert.equal(latex.text, '$\\vec{J} = J\\hat{z}$');
});

test('PDF geometry analysis fails closed before adversarial accent association becomes quadratic', () => {
  const items = [];
  for (let index = 0; index < 1500; index += 1) {
    items.push(pdfItem('x', index * 2, 100, 12, 1));
    items.push(pdfItem('ˆ', index * 2, 106, 8, 1));
  }
  const analysis = cleanCopy.analyzePdfPageText(items, {}, {}, []);
  assert.equal(analysis.overBudget, true);
  assert.deepEqual(analysis.items, []);
});

test('trusted PDF partial selection preserves either side of a combined radicand/factor item', () => {
  const slices = [
    { start: 0, end: 1, expectations: { faithful: 'g', latex: '$g$', calculator: 'g' } },
    { start: 1, end: 2, expectations: { faithful: 'R', latex: '$R$', calculator: 'R' } }
  ];
  for (const { start, end, expectations } of slices) {
    const fixture = tongDomFixture();
    const combinedToken = Array.from(fixture.page.querySelectorAll('[data-cmc-pdf-item]'))
      .find((token) => token.textContent === 'gR');
    assert.ok(combinedToken);

    const range = fixture.document.createRange();
    range.setStart(combinedToken.firstChild, start);
    range.setEnd(combinedToken.firstChild, end);
    const selection = fixture.instance.window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    for (const [outputMode, expected] of Object.entries(expectations)) {
      const payload = cleanCopy.getCopyPayload(
        fixture.document,
        selection,
        { outputMode },
        fixture.instance.window,
        combinedToken
      );
      assert.ok(payload);
      assert.equal(payload.reason, 'trusted-pdf-text-layer');
      assert.equal(payload.text, expected);
    }
  }
});

test('selection crossing an unready trusted PDF page declines custom clipboard handling', () => {
  const instance = new JSDOM([
    '<!doctype html><html><body><div id="viewer">',
    '<section id="ready" data-cmc-pdf-page="1"></section>',
    '<section id="unready" data-cmc-pdf-page="2"><span class="cmc-pdf-page-number">2</span></section>',
    '</div></body></html>'
  ].join(''), { url: 'https://example.test/large-document.pdf' });
  const { document } = instance.window;
  const root = document.querySelector('#viewer');
  const readyPage = document.querySelector('#ready');
  const unreadyLabel = document.querySelector('#unready .cmc-pdf-page-number');
  const analysis = cleanCopy.analyzePdfPageText([pdfItem('A', 20, 100, 12, 8, 'textFont')], {}, {}, []);
  annotateAnalyzedPdfPage(document, readyPage, analysis);
  cleanCopy.registerTrustedPdfViewerRoot(root);
  assert.equal(readyPage.getAttribute('data-cmc-pdf-text-ready'), '1');
  assert.equal(document.querySelector('#unready').hasAttribute('data-cmc-pdf-text-ready'), false);

  const readyToken = readyPage.querySelector('[data-cmc-pdf-item]');
  const range = document.createRange();
  range.setStart(readyToken.firstChild, 0);
  range.setEnd(unreadyLabel.firstChild, unreadyLabel.firstChild.length);
  const selection = instance.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  const payload = cleanCopy.getCopyPayload(
    document,
    selection,
    { outputMode: 'faithful' },
    instance.window,
    readyToken
  );
  assert.notEqual(payload && payload.reason, 'trusted-pdf-text-layer');
});

function deferredPdfFixture() {
  const instance = new JSDOM([
    '<!doctype html><html><body><div id="viewer">',
    '<section id="ready" data-cmc-pdf-page="1"></section>',
    '<section id="unready" data-cmc-pdf-page="2"><span class="cmc-pdf-page-number">2</span></section>',
    '</div></body></html>'
  ].join(''), { url: 'https://example.test/deferred.pdf' });
  const { document } = instance.window;
  const root = document.querySelector('#viewer');
  const ready = document.querySelector('#ready');
  const unready = document.querySelector('#unready');
  annotateAnalyzedPdfPage(document, ready, cleanCopy.analyzePdfPageText([
    pdfItem('A', 20, 100, 12, 8, 'textFont')
  ], {}, {}, []));
  cleanCopy.registerTrustedPdfViewerRoot(root);
  const range = document.createRange();
  range.setStart(ready.querySelector('[data-cmc-pdf-item]').firstChild, 0);
  const labelText = unready.querySelector('.cmc-pdf-page-number').firstChild;
  range.setEnd(labelText, labelText.length);
  const selection = instance.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return { instance, document, root, ready, unready };
}

function finishDeferredPage(fixture) {
  const analysis = cleanCopy.analyzePdfPageText([pdfItem('B', 20, 100, 12, 8, 'textFont')], {}, {}, []);
  const label = fixture.unready.querySelector('.cmc-pdf-page-number');
  const temporary = fixture.document.createElement('section');
  annotateAnalyzedPdfPage(fixture.document, temporary, analysis);
  for (const token of Array.from(temporary.children)) fixture.unready.insertBefore(token, label);
  fixture.unready.setAttribute('data-cmc-pdf-line-gap', String(analysis.normalLineGap || 0));
  fixture.unready.setAttribute('data-cmc-pdf-text-ready', '1');
}

function dispatchCopy(instance, target) {
  const values = new Map();
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      types: [],
      clearData: () => values.clear(),
      setData: (type, value) => { values.set(type, String(value)); },
      getData: (type) => values.get(type) || ''
    }
  });
  target.dispatchEvent(event);
  return event;
}

test('installed copy handler renders missing selected PDF pages before replaying one complete clipboard', async () => {
  const fixture = deferredPdfFixture();
  const writes = [];
  const previous = global.GM_setClipboard;
  global.GM_setClipboard = (value) => { writes.push(String(value)); };
  try {
    cleanCopy.install(fixture.document, fixture.instance.window, {
      registerMenus: false,
      settingsProvider: () => ({ outputMode: 'faithful' })
    });
    fixture.root.addEventListener('clean-math-copy-pdf-render-selection-v1', () => {
      finishDeferredPage(fixture);
      fixture.root.dispatchEvent(new fixture.instance.window.Event('clean-math-copy-pdf-selection-ready-v1'));
    }, { once: true });
    const event = dispatchCopy(fixture.instance, fixture.document);
    assert.equal(event.defaultPrevented, true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(writes, ['A B']);
  } finally {
    if (previous === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previous;
  }
});

test('a mode change cancels deferred PDF clipboard replay', async () => {
  const fixture = deferredPdfFixture();
  let mode = 'faithful';
  const writes = [];
  const previous = global.GM_setClipboard;
  global.GM_setClipboard = (value) => { writes.push(String(value)); };
  try {
    cleanCopy.install(fixture.document, fixture.instance.window, {
      registerMenus: false,
      settingsProvider: () => ({ outputMode: mode })
    });
    const event = dispatchCopy(fixture.instance, fixture.document);
    assert.equal(event.defaultPrevented, true);
    mode = 'native';
    finishDeferredPage(fixture);
    fixture.root.dispatchEvent(new fixture.instance.window.Event('clean-math-copy-pdf-selection-ready-v1'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(writes, []);
  } finally {
    if (previous === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previous;
  }
});

test('page-authored PDF metadata is ignored unless the viewer root is internally trusted', () => {
  const instance = new JSDOM([
    '<!doctype html><html><body><div id="forged">',
    '<section data-cmc-pdf-page="1" data-cmc-pdf-text-ready="1"><span ',
    'data-cmc-pdf-item="0" data-cmc-pdf-line="0" data-cmc-pdf-line-y="1" ',
    'data-cmc-pdf-x="1" data-cmc-pdf-width="1" data-cmc-pdf-size="1" ',
    'data-cmc-pdf-math="1" data-cmc-pdf-math-group="math-1" data-cmc-pdf-display-math="1" ',
    'data-cmc-pdf-semantic="integral">Z</span></section>',
    '</div></body></html>'
  ].join(''), { url: 'https://attacker.example/' });
  const forged = instance.window.document.querySelector('#forged');
  const selection = selectNodeContents(instance, forged);

  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    { outputMode: 'faithful' },
    instance.window,
    forged
  ), null);
});
