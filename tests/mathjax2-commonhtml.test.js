'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const cleanCopy = require('../clean-math-copy.user.js');
const fixture = require('./fixtures/mathjax2-commonhtml.js');

function setup(markup) {
  const instance = new JSDOM('<!doctype html><html><head><style>' + fixture.commonHtmlCss +
    '</style></head><body>' + markup + '</body></html>', {
    url: 'https://courseware.example/assessment'
  });
  return { instance, document: instance.window.document };
}

function selectContents(window, element) {
  const selection = window.getSelection();
  selection.removeAllRanges();
  const range = window.document.createRange();
  range.selectNodeContents(element);
  selection.addRange(range);
  return selection;
}

function payloadFor(instance, element, outputMode = 'faithful') {
  return cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, element),
    { outputMode },
    instance.window,
    element
  );
}

function dispatchCopy(instance, element) {
  const clipboard = new Map();
  const event = new instance.window.Event('copy', {
    bubbles: true,
    cancelable: true,
    composed: true
  });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      get types() { return Array.from(clipboard.keys()); },
      clearData(type) { if (arguments.length) clipboard.delete(type); else clipboard.clear(); },
      setData(type, value) { clipboard.set(type, value); },
      getData(type) { return clipboard.get(type) || ''; }
    }
  });
  element.dispatchEvent(event);
  return { clipboard, event };
}

function withAssistiveMathML(rootMarkup, mathMarkup, options = {}) {
  const escaped = mathMarkup
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
  const visual = rootMarkup.replace(
    '<span class="mjx-math">',
    '<span class="mjx-math" aria-hidden="true">'
  );
  const frame = visual.replace(
    /^(<span\b[^>]*)(>)/u,
    '$1 data-mathml="' + escaped + '" role="presentation" style="position:relative"$2'
  );
  const classes = 'MJX_Assistive_MathML' + (options.extraClass ? ' ' + options.extraClass : '');
  const style = options.visible
    ? ' style="position:static;clip:auto;width:auto;height:auto;overflow:visible"'
    : '';
  const branch = '<span class="' + classes + '" role="presentation"' + style + '>' +
    mathMarkup + '</span>';
  return frame.replace(/<\/span>$/u, branch + '</span>');
}

test('fixture retains genuine MathJax 2.7.9 CommonHTML topology and raw glyph order', () => {
  const representativeRoots = [
    fixture.roots.leaf,
    fixture.roots.subscript,
    fixture.roots.vector,
    fixture.roots.equation,
    fixture.roots.degree
  ];
  const { document } = setup('<div id="target">' + representativeRoots.join('') + '</div>');
  const roots = Array.from(document.querySelectorAll('#target > .MathJax_CHTML'));
  assert.equal(roots.length, 5);
  assert.deepEqual(roots.map((root) => root.textContent), [
    'V',
    'VC',
    '→V',
    '→V=→VR+(→VL+→VC)',
    '180∘'
  ]);
  assert.equal(roots[1].querySelectorAll('.mjx-msubsup > .mjx-base').length, 1);
  assert.equal(roots[2].querySelectorAll('.mjx-munderover .mjx-over + .mjx-op').length, 1);
  assert.equal(roots[3].querySelectorAll('.mjx-msubsup > .mjx-sub').length, 3);

  const defaultOutput = setup('<p id="output">' +
    fixture.withSource(fixture.roots.subscript, 'V_C') + '</p>').document.querySelector('#output');
  assert.deepEqual(
    Array.from(defaultOutput.children, (element) => element.matches('script')
      ? 'script[type="math/tex"]'
      : element.className),
    ['MathJax_Preview', 'mjx-chtml MathJax_CHTML', 'script[type="math/tex"]']
  );
  assert.equal(
    defaultOutput.children[1].id,
    defaultOutput.children[2].id + '-Frame',
    'the rendered frame and its following source script keep MathJax 2\'s id association'
  );
});

test('MathJax 2 roots use their following TeX script, never the previous formula source', () => {
  const markup = '<div id="target">' + [
    fixture.withSource(fixture.roots.leaf, 'V', { preview: false }),
    fixture.withSource(fixture.roots.subscript, 'V_C', { preview: false }),
    fixture.withSource(fixture.roots.vector, '\\vec V', { preview: false }),
    fixture.withSource(
      fixture.roots.equation,
      '\\vec V = \\vec V_R + (\\vec V_L + \\vec V_C)',
      { preview: false }
    ),
    fixture.withSource(fixture.roots.degree, '180^\\circ', { preview: false })
  ].join('') + '</div>';
  const { instance, document } = setup(markup);
  const roots = Array.from(document.querySelectorAll('.MathJax_CHTML'));

  assert.equal(payloadFor(instance, roots[1]).text, 'V_C');
  assert.equal(payloadFor(instance, roots[2]).text, 'V⃗');
  assert.equal(payloadFor(instance, roots[3]).text, 'V⃗ = V⃗_R + (V⃗_L + V⃗_C)');
  assert.equal(payloadFor(instance, roots[4]).text, '180°');
  assert.equal(
    payloadFor(instance, roots[3], 'latex').text,
    '$\\vec V = \\vec V_R + (\\vec V_L + \\vec V_C)$'
  );
});

test('source-less MathJax 2 CommonHTML recovers scripts, vectors, and degrees from renderer topology', () => {
  const { instance, document } = setup('<div id="target">' + [
    fixture.roots.leaf,
    fixture.roots.subscript,
    fixture.roots.vector,
    fixture.roots.equation,
    fixture.roots.degree
  ].join('') + '</div>');
  const roots = Array.from(document.querySelectorAll('.MathJax_CHTML'));

  assert.equal(payloadFor(instance, roots[0]).text, 'V');
  assert.equal(payloadFor(instance, roots[1]).text, 'V_C');
  assert.equal(payloadFor(instance, roots[2]).text, 'V⃗');
  assert.equal(payloadFor(instance, roots[3]).text, 'V⃗ = V⃗_R + (V⃗_L + V⃗_C)');
  assert.equal(payloadFor(instance, roots[4]).text, '180°');
});

test('official MathJax 2 AssistiveMML is cross-checked but only the painted glyph key is copied', () => {
  const equationMath = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>' +
    '<mover><mi>V</mi><mo>→</mo></mover><mo>=</mo>' +
    '<msub><mover><mi>V</mi><mo>→</mo></mover><mi>R</mi></msub><mo>+</mo><mo>(</mo>' +
    '<msub><mover><mi>V</mi><mo>→</mo></mover><mi>L</mi></msub><mo>+</mo>' +
    '<msub><mover><mi>V</mi><mo>→</mo></mover><mi>C</mi></msub><mo>)</mo>' +
    '</mrow></math>';
  const assisted = withAssistiveMathML(fixture.roots.equation, equationMath);
  const markup = '<main id="target">' + fixture.withSource(
    assisted,
    '\\vec V = \\vec V_R + (\\vec V_L + \\vec V_C)',
    { preview: false }
  ) + '</main>';
  const { instance, document } = setup(markup);
  const root = document.querySelector('.MathJax_CHTML');
  const visual = root.querySelector(':scope > .mjx-math');

  assert.deepEqual(cleanCopy.rootsForRange((() => {
    const range = document.createRange(); range.selectNodeContents(visual); return range;
  })()), [root], 'data-mathml must not promote hidden MathML to an ordinary ancestor');
  assert.equal(payloadFor(instance, visual).text, 'V⃗ = V⃗_R + (V⃗_L + V⃗_C)');
  assert.equal(payloadFor(instance, visual, 'latex').text,
    '$\\vec V = \\vec V_R + (\\vec V_L + \\vec V_C)$');
  assert.equal(payloadFor(instance, root).text, 'V⃗ = V⃗_R + (V⃗_L + V⃗_C)',
    'an exact frame range may include the clipped duplicate but remains a whole formula');
});

test('MathJax 2 AssistiveMML disagreement, visible alternates, and unknown branch classes fail closed', () => {
  const correct = '<math xmlns="http://www.w3.org/1998/Math/MathML"><msub><mi>V</mi><mi>C</mi></msub></math>';
  const stale = '<math xmlns="http://www.w3.org/1998/Math/MathML"><msub><mi>V</mi><mi>X</mi></msub></math>';
  for (const assisted of [
    withAssistiveMathML(fixture.roots.subscript, stale),
    withAssistiveMathML(fixture.roots.subscript, correct, { visible: true }),
    withAssistiveMathML(fixture.roots.subscript, correct, { extraClass: 'page-authored' })
  ]) {
    const { instance, document } = setup('<main>' + assisted + '</main>');
    const root = document.querySelector('.MathJax_CHTML');
    assert.equal(payloadFor(instance, root.querySelector(':scope > .mjx-math')), null);
  }
});

test('MathJax 2 large-operator limits preserve munderover semantics', () => {
  for (const markup of [fixture.withSource(fixture.roots.sum, '\\sum_{i=1}^{n}i^2'), fixture.roots.sum]) {
    const { instance, document } = setup('<main>' + markup + '</main>');
    assert.equal(payloadFor(instance, document.querySelector('.MathJax_CHTML')).text, '∑ᵢ₌₁ⁿ i²');
  }
});

test('MathJax 2 rejects a keyed but stale following source script', () => {
  const { instance, document } = setup('<main>' +
    fixture.withSource(fixture.roots.subscript, 'V_X', { preview: false }) + '</main>');
  assert.equal(payloadFor(instance, document.querySelector('.MathJax_CHTML')), null);
});

test('source-less MathJax 2 strict partial selection stays native and never widens', () => {
  const { instance, document } = setup('<p id="target">before ' + fixture.roots.subscript + ' after</p>');
  const root = document.querySelector('.MathJax_CHTML');
  const selectedGlyph = root.querySelector('.mjx-sub .mjx-char').firstChild;
  const selection = instance.window.getSelection();
  selection.removeAllRanges();
  const range = document.createRange();
  range.selectNodeContents(selectedGlyph);
  selection.addRange(range);
  const payload = cleanCopy.getCopyPayload(
    document,
    selection,
    { outputMode: 'faithful' },
    instance.window,
    root
  );

  // The authenticated projection maps the complete renderer topology, not
  // arbitrary painted-glyph offsets. Returning null is intentional here: the
  // browser natively copies the exact selected C, while a semantic rewrite
  // could accidentally widen it to V_C or the surrounding line.
  assert.equal(payload, null);
});

test('full MathJax 2 phasor selection is owned and excludes a long image transcript', () => {
  const { instance, document } = setup(fixture.phasorPage());
  const target = document.querySelector('#target');
  const payload = payloadFor(instance, target);

  assert.ok(payload);
  assert.equal(payload.text, [
    'A phasor diagram visualizes the voltage drops across a capacitor V_C, inductor V_L, and resistor V_R.',
    'The output voltage vector V⃗ is the vector sum',
    'V⃗ = V⃗_R + (V⃗_L + V⃗_C)',
    'The drops are 180° out of phase.',
    'From the options, the correct result is Figure D.'
  ].join('\n\n'));
  assert.doesNotMatch(payload.text + payload.html, /Three sequential|parallelogram|<img\b/iu);

  // This is the user-facing failure mode: returning null lets the browser's
  // native default copy run and reintroduce flattened glyphs plus image alt.
  cleanCopy.install(document, instance.window, { registerMenus: false });
  selectContents(instance.window, target);
  const copied = dispatchCopy(instance, target);
  assert.equal(copied.event.defaultPrevented, true);
  assert.equal(copied.clipboard.get('text/plain'), payload.text);
  assert.doesNotMatch(
    (copied.clipboard.get('text/plain') || '') + (copied.clipboard.get('text/html') || ''),
    /Three sequential|parallelogram|<img\b/iu
  );
});

test('full source-less MathJax 2 phasor selection also excludes the image transcript', () => {
  const { instance, document } = setup(fixture.phasorPage({ sources: false }));
  const target = document.querySelector('#target');
  const payload = payloadFor(instance, target);

  assert.ok(payload);
  assert.match(payload.text, /capacitor V_C, inductor V_L, and resistor V_R/u);
  assert.match(payload.text, /V⃗ = V⃗_R \+ \(V⃗_L \+ V⃗_C\)/u);
  assert.match(payload.text, /180° out of phase/u);
  assert.doesNotMatch(payload.text + payload.html, /Three sequential|parallelogram|<img\b/iu);
});
