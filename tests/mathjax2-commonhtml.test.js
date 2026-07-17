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

test('source-less MathJax 2 fails closed when CSS can contradict renderer DOM order', () => {
  const adversarialLayouts = [
    ['flex row reversal', '.mjx-math > .mjx-mrow', 'display:flex;flex-direction:row-reverse'],
    ['grid placement', '.mjx-math > .mjx-mrow', 'display:grid;grid-auto-flow:column'],
    ['unmodeled inline table', '.mjx-math > .mjx-mrow', 'display:inline-table'],
    ['nonzero order', '.mjx-math > .mjx-mrow > .mjx-mo', 'order:-1'],
    ['bidi override', '.mjx-math > .mjx-mrow', 'direction:rtl;unicode-bidi:bidi-override'],
    ['vertical writing', '.mjx-math > .mjx-mrow', 'writing-mode:vertical-rl'],
    ['transformed operand', '.mjx-math > .mjx-mrow > .mjx-mo', 'transform:translateX(-100px)'],
    ['offset operand', '.mjx-math > .mjx-mrow > .mjx-mo', 'position:relative;left:-100px'],
    ['transformed glyph leaf', '.mjx-math > .mjx-mrow > .mjx-mo > .mjx-char',
      'transform:translateX(-100px)'],
    ['offset glyph leaf', '.mjx-math > .mjx-mrow > .mjx-mo > .mjx-char',
      'position:relative;left:-100px'],
    ['painted uppercase', '.mjx-math > .mjx-mrow', 'text-transform:uppercase']
  ];
  for (const [name, selector, style] of adversarialLayouts) {
    const { instance, document } = setup('<main>' + fixture.roots.equation + '</main>');
    const root = document.querySelector('.MathJax_CHTML');
    const target = root.querySelector(selector);
    assert.ok(target, name + ' fixture target');
    target.setAttribute('style', style);
    assert.equal(payloadFor(instance, root), null, name);
  }

  const generated = setup('<main>' + fixture.roots.equation + '</main>');
  const generatedRoot = generated.document.querySelector('.MathJax_CHTML');
  const generatedRow = generatedRoot.querySelector('.mjx-math > .mjx-mrow');
  generatedRow.id = 'generated-mathjax2-row';
  const nativeGetComputedStyle = generated.instance.window.getComputedStyle.bind(generated.instance.window);
  Object.defineProperty(generated.instance.window.navigator, 'userAgent', {
    value: 'Clean Math Copy CHTML pseudo-style test',
    configurable: true
  });
  generated.instance.window.getComputedStyle = (element, pseudo) => {
    if (element === generatedRow && pseudo === '::before') {
      return { content: '"+"', getPropertyValue: () => '' };
    }
    if (pseudo === '::before' || pseudo === '::after') {
      return { content: 'none', getPropertyValue: () => '' };
    }
    return nativeGetComputedStyle(element);
  };
  assert.equal(payloadFor(generated.instance, generatedRoot), null, 'generated formula glyph');
});

test('the CHTML visual-order audit preserves an official nested MathJax 2 derivation', () => {
  const { instance, document } = setup('<main>' + fixture.derivationRoots.inductance + '</main>');
  const root = document.querySelector('.MathJax_CHTML');
  assert.equal(payloadFor(instance, root).text, 'L = (R tan ϕ + 1/(ωC))/ω');
  assert.equal(payloadFor(instance, root, 'calculator').text, 'L=((R*tan(phi)+(1/(omega*C)))/omega)');
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

test('original LaTeX rejects a stale keyed source when authoritative MathJax 2 MathML disagrees', () => {
  const math = '<math xmlns="http://www.w3.org/1998/Math/MathML">' +
    '<msub><mi>V</mi><mi>C</mi></msub></math>';
  const assisted = withAssistiveMathML(fixture.roots.subscript, math);
  const matching = setup('<main>' + fixture.withSource(
    assisted,
    'V_{C}',
    { preview: false }
  ) + '</main>');
  const matchingRoot = matching.document.querySelector('.MathJax_CHTML');

  // A genuinely matching keyed source remains byte-for-byte original rather
  // than being replaced by the reconstructed `${V}_{C}` spelling.
  assert.equal(payloadFor(matching.instance, matchingRoot, 'latex').text, '$V_{C}$');

  const stale = setup('<main>' + fixture.withSource(
    assisted,
    'V^C',
    { preview: false }
  ) + '</main>');
  const staleRoot = stale.document.querySelector('.MathJax_CHTML');

  assert.equal(payloadFor(stale.instance, staleRoot).text, 'V_C');
  assert.equal(payloadFor(stale.instance, staleRoot, 'calculator').text, 'V_(C)');
  assert.equal(
    payloadFor(stale.instance, staleRoot, 'latex').text,
    '${V}_{C}$',
    'stale superscript TeX must not override the visible and AssistiveMML subscript'
  );
});

test('official display AssistiveMML remains authenticated with its clipped full-width Block class', () => {
  const math = '<math xmlns="http://www.w3.org/1998/Math/MathML"><msub><mi>V</mi><mi>C</mi></msub></math>';
  const assisted = withAssistiveMathML(fixture.roots.subscript, math, {
    extraClass: 'MJX_Assistive_MathML_Block'
  });
  const { instance, document } = setup('<main>' + fixture.withSource(
    assisted,
    'V_C',
    { preview: false, display: true }
  ) + '</main>');
  const root = document.querySelector('.MathJax_CHTML');
  assert.equal(payloadFor(instance, root).text, 'V_C');
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

test('MathJax 2 nested derivation fractions and named functions stay semantic with or without TeX', () => {
  const expected = {
    voltage: 'V_(L, max) = IₘX_L = IₘωL',
    inductance: 'L = (R tan ϕ + 1/(ωC))/ω',
    current: 'Iₘ = Eₘ/Z = Eₘ/(R/cos ϕ) = (Eₘ cos ϕ)/R',
    evaluation: 'V_(L, max) = ((Eₘ cos ϕ)/R)(R tan ϕ + 1/(ωC))',
    alignedCurrent: 'Iₘ = Eₘ/Z; = Eₘ/(R/cos ϕ); = (Eₘ cos ϕ)/R',
    spacedUnits: '120 V',
    calligraphicInline: 'ℰₘ',
    calligraphicFraction: '(ℰₘ cos ϕ)/R',
    calligraphicAligned: 'Iₘ = ℰₘ/Z; = (ℰₘ cos ϕ)/R',
    fontVariants: '𝐱 + x + 𝑥 + 𝒙 + ℝ + 𝔤 + 𝗌 + 𝚝'
  };

  for (const [name, output] of Object.entries(expected)) {
    for (const sourceBacked of [false, true]) {
      const markup = sourceBacked
        ? fixture.withSource(fixture.derivationRoots[name], fixture.derivationSources[name], {
          preview: false,
          display: true
        })
        : fixture.derivationRoots[name];
      const { instance, document } = setup('<main>' + markup + '</main>');
      const root = document.querySelector('.MathJax_CHTML');
      const payload = payloadFor(instance, root);
      assert.ok(payload, name + ' must be owned (' + (sourceBacked ? 'source-backed' : 'source-less') + ')');
      assert.equal(payload.text, output);
      assert.equal(/\n/u.test(payload.text), false, 'one rendered formula must not gain layout newlines');
    }
  }

  const alternate = setup('<main>' + fixture.withSource(
    fixture.derivationRoots.calligraphicInline,
    '\\mathcal E_m',
    { preview: false }
  ) + '</main>');
  assert.equal(
    payloadFor(alternate.instance, alternate.document.querySelector('.MathJax_CHTML')).text,
    'ℰₘ'
  );
});

test('a full nested MathJax 2 derivation never falls back to flattened native text or image alt', () => {
  const expected = [
    'The maximum inductor voltage is',
    'V_(L, max) = IₘX_L = IₘωL',
    'Solving for the inductance gives',
    'L = (R tan ϕ + 1/(ωC))/ω',
    'The current amplitude can be written as',
    'Iₘ = Eₘ/Z = Eₘ/(R/cos ϕ) = (Eₘ cos ϕ)/R',
    'Substitution produces',
    'V_(L, max) = ((Eₘ cos ϕ)/R)(R tan ϕ + 1/(ωC))',
    'This completes the derivation.'
  ].join('\n\n');

  for (const sources of [true, false]) {
    const { instance, document } = setup(fixture.derivationPage({ sources }));
    const target = document.querySelector('#target');
    const payload = payloadFor(instance, target);
    assert.ok(payload);
    assert.equal(payload.text, expected);
    assert.doesNotMatch(payload.text + payload.html, /Three sequential|parallelogram|<img\b/iu);
  }
});

test('MathJax 2 keeps calculator and original-LaTeX semantics across source precedence and aligned rows', () => {
  const sourceBacked = (name, outputMode) => {
    const { instance, document } = setup('<main>' + fixture.withSource(
      fixture.derivationRoots[name],
      fixture.derivationSources[name],
      { preview: false }
    ) + '</main>');
    return payloadFor(instance, document.querySelector('.MathJax_CHTML'), outputMode).text;
  };
  const sourceLess = (name, outputMode) => {
    const { instance, document } = setup('<main>' + fixture.derivationRoots[name] + '</main>');
    return payloadFor(instance, document.querySelector('.MathJax_CHTML'), outputMode).text;
  };

  // A v2 frame without AssistiveMML still has an authoritative following TeX
  // script. It must not be mistaken for a source-less projected MathML root.
  assert.equal(
    sourceBacked('inductance', 'calculator'),
    'L=((R*tan(phi)+(1/(omega*C)))/omega)'
  );
  assert.equal(
    sourceBacked('inductance', 'latex'),
    '$' + fixture.derivationSources.inductance + '$'
  );
  assert.equal(sourceBacked('calligraphicInline', 'calculator'), 'E_(m)');
  assert.equal(
    sourceBacked('calligraphicInline', 'latex'),
    '$' + fixture.derivationSources.calligraphicInline + '$'
  );
  assert.equal(sourceBacked('fontVariants', 'calculator'), 'x+x+x+x+R+g+s+t');

  // A genuinely source-less aligned renderer is an equation derivation, not a
  // matrix. Calculator mode keeps its rows in order and LaTeX reconstructs the
  // authenticated alignment environment.
  assert.equal(
    sourceLess('alignedCurrent', 'calculator'),
    'I_(m)=((E_(m))/Z);=((E_(m))/(R/cos(phi)));=((E_(m)*cos(phi))/R)'
  );
  assert.equal(
    sourceLess('alignedCurrent', 'latex'),
    String.raw`$\begin{aligned}{I}_{m}&=\frac{{E}_{m}}{Z}\\&=\frac{{E}_{m}}{R/\cos \varphi }\\&=\frac{{E}_{m}\cos \varphi }{R}\end{aligned}$`
  );
  assert.equal(
    sourceLess('calligraphicInline', 'latex'),
    '$' + String.raw`{\mathcal{E}}_{m}` + '$'
  );
  assert.equal(
    sourceLess('fontVariants', 'latex'),
    String.raw`$\mathbf{x}+\mathrm{x}+x+\boldsymbol{x}+\mathbb{R}+\mathfrak{g}+\mathsf{s}+\mathtt{t}$`
  );
  assert.equal(sourceLess('spacedUnits', 'latex'), String.raw`$120\,\mathrm{V}$`);

  // Alignment metadata is not sufficient by itself: ordinary right/left
  // matrix cells do not begin with relations and must remain a matrix.
  const matrix = setup([
    '<math><mtable columnalign="right left" columnspacing="0em 2em">',
    '<mtr><mtd><mi>a</mi></mtd><mtd><mi>b</mi></mtd></mtr>',
    '<mtr><mtd><mi>c</mi></mtd><mtd><mi>d</mi></mtd></mtr>',
    '</mtable></math>'
  ].join('')).document.querySelector('math');
  assert.equal(cleanCopy.mathMLToCalculator(matrix), '[[a,b],[c,d]]');
  assert.equal(cleanCopy.mathMLToLatex(matrix), String.raw`\begin{matrix}a&b\\c&d\end{matrix}`);
});

test('source-less MathML-to-LaTeX applies every explicit alphabet exactly once', () => {
  const { document } = setup([
    '<math><mrow>',
    '<mi mathvariant="normal">x</mi><mo>+</mo>',
    '<mi mathvariant="italic">x</mi><mo>+</mo>',
    '<mi mathvariant="bold">x</mi><mo>+</mo>',
    '<mi mathvariant="bold-italic">x</mi><mo>+</mo>',
    '<mi mathvariant="script">ℰ</mi><mo>+</mo>',
    '<mi mathvariant="bold-script">x</mi><mo>+</mo>',
    '<mi mathvariant="fraktur">x</mi><mo>+</mo>',
    '<mi mathvariant="bold-fraktur">x</mi><mo>+</mo>',
    '<mi mathvariant="double-struck">R</mi><mo>+</mo>',
    '<mi mathvariant="sans-serif">x</mi><mo>+</mo>',
    '<mi mathvariant="bold-sans-serif">x</mi><mo>+</mo>',
    '<mi mathvariant="sans-serif-italic">x</mi><mo>+</mo>',
    '<mi mathvariant="sans-serif-bold-italic">x</mi><mo>+</mo>',
    '<mi mathvariant="monospace">x</mi><mo>+</mo>',
    '<mn mathvariant="normal">2</mn><mo>+</mo>',
    '<mn mathvariant="italic">2</mn><mo>+</mo>',
    '<mi mathvariant="bold">α</mi>',
    '</mrow></math>'
  ].join(''));
  assert.equal(
    cleanCopy.mathMLToLatex(document.querySelector('math')),
    String.raw`\mathrm{x}+x+\mathbf{x}+\boldsymbol{x}+\mathcal{E}+\mathbf{\mathcal{x}}+\mathfrak{x}+\mathbf{\mathfrak{x}}+\mathbb{R}+\mathsf{x}+\mathbf{\mathsf{x}}+\mathit{\mathsf{x}}+\boldsymbol{\mathsf{x}}+\mathtt{x}+2+\mathit{2}+\boldsymbol{\alpha }`
  );
});

test('MathML-to-LaTeX inherits mathvariant from math and mstyle exactly once', () => {
  const { document } = setup([
    '<math mathvariant="bold"><mrow>',
    '<mi>x</mi><mo>+</mo><mi>α</mi><mo>+</mo>',
    '<mstyle mathvariant="script"><mi>ℰ</mi><mo>+</mo>',
    '<mstyle><mi>F</mi></mstyle><mo>+</mo>',
    '<mi mathvariant="normal">x</mi></mstyle><mo>+</mo>',
    '<mi>x</mi>',
    '</mrow></math>'
  ].join(''));

  assert.equal(
    cleanCopy.mathMLToLatex(document.querySelector('math')),
    String.raw`\mathbf{x}+\boldsymbol{\alpha }+\mathcal{E}+\mathcal{F}+\mathrm{x}+\mathbf{x}`
  );
});

test('MathJax 2 renderer-only empties are accepted only in their exact authenticated grammar', () => {
  const mutations = [
    (document) => {
      document.querySelector('.mjx-mo > .mjx-char:empty').classList.add('page-authored');
    },
    (document) => {
      document.querySelector('.mjx-mo > .mjx-char:empty')
        .parentElement.previousElementSibling.querySelector('.mjx-char').textContent = 'widget';
    }
  ];
  for (const mutate of mutations) {
    const { instance, document } = setup('<main>' + fixture.derivationRoots.inductance + '</main>');
    mutate(document);
    assert.equal(payloadFor(instance, document.querySelector('.MathJax_CHTML')), null);
  }

  for (const mutate of [
    (space) => { space.textContent = 'hidden'; },
    (space) => { space.appendChild(space.ownerDocument.createElement('span')); },
    (space) => { space.setAttribute('style', 'width: 0.167em; position: absolute'); },
    (space) => { space.setAttribute('id', 'page-authored'); }
  ]) {
    const { instance, document } = setup('<main>' + fixture.derivationRoots.spacedUnits + '</main>');
    mutate(document.querySelector('.mjx-mspace'));
    assert.equal(payloadFor(instance, document.querySelector('.MathJax_CHTML')), null);
  }

  const { instance, document } = setup('<main>' + fixture.derivationRoots.alignedCurrent + '</main>');
  document.querySelector('.mjx-mtd[style*="text-align: left"] > .mjx-mrow > .mjx-mi')
    .setAttribute('id', 'MJXc-Node-0');
  assert.equal(payloadFor(instance, document.querySelector('.MathJax_CHTML')), null);

  const forged = setup('<main>' + fixture.derivationRoots.calligraphicInline + '</main>');
  forged.document.querySelector('.MJXc-TeX-cal-R').classList.add('page-authored');
  assert.equal(payloadFor(
    forged.instance,
    forged.document.querySelector('.MathJax_CHTML')
  ), null);
});

test('a strict partial selection inside a nested MathJax 2 fraction never widens to the equation', () => {
  const { instance, document } = setup('<main>' + fixture.derivationRoots.inductance + '</main>');
  const root = document.querySelector('.MathJax_CHTML');
  const glyph = root.querySelector('.mjx-denominator .mjx-char').firstChild;
  const selection = instance.window.getSelection();
  const range = document.createRange();
  selection.removeAllRanges();
  range.selectNodeContents(glyph);
  selection.addRange(range);
  assert.equal(cleanCopy.getCopyPayload(
    document,
    selection,
    { outputMode: 'faithful' },
    instance.window,
    root
  ), null);
});

test('a safe ordinary role=math root cannot poison authenticated formulas in a mixed selection', () => {
  const { instance, document } = setup([
    '<main id="target"><p>Before ',
    fixture.roots.subscript,
    ' middle <span id="ordinary-math" role="math">x + y</span> after ',
    fixture.roots.vector,
    '.</p></main>'
  ].join(''));
  const target = document.querySelector('#target');

  // The generic role=math surface is independently safe as ordinary inline
  // text. It must not force the two structurally authenticated CommonHTML
  // roots back through the browser's flattened native clipboard projection.
  assert.equal(payloadFor(instance, document.querySelector('#ordinary-math')).text, 'x + y');
  const payload = payloadFor(instance, target);
  assert.ok(payload);
  assert.equal(payload.text, 'Before V_C middle x + y after V⃗.');
});

test('a safe outer role=math wrapper cannot shadow its genuine MathJax 2 child', () => {
  const { instance, document } = setup([
    '<div id="outer-math" role="math">Label ',
    fixture.roots.subscript,
    ' tail.</div>'
  ].join(''));
  const outer = document.querySelector('#outer-math');
  const child = outer.querySelector('.MathJax_CHTML');

  const childPayload = payloadFor(instance, child);
  assert.ok(childPayload);
  assert.equal(childPayload.text, 'V_C');

  const outerPayload = payloadFor(instance, outer);
  assert.ok(outerPayload);
  assert.equal(outerPayload.text, 'Label V_C tail.');
});

test('an over-budget role=math wrapper cannot shadow an authentic descendant beyond the walk cap', () => {
  // Put the real renderer after more descendants than the bounded wrapper
  // audit will inspect. Exhaustion must classify the unsourced wrapper as an
  // unsafe non-root, not silently promote it over the authentic formula.
  const { instance, document } = setup([
    '<div id="outer-math" role="math">',
    '<i></i>'.repeat(4097),
    fixture.roots.subscript,
    '</div>'
  ].join(''));
  const child = document.querySelector('.MathJax_CHTML');
  const payload = payloadFor(instance, child);

  assert.ok(payload);
  assert.equal(payload.text, 'V_C');
});

test('an unsafe outer math layout still makes the nested rewrite fail closed', () => {
  const { instance, document } = setup([
    '<div id="unsafe-outer" role="math" style="display:flex;flex-direction:row-reverse">',
    '<span>Visible prose</span>',
    fixture.roots.subscript,
    '</div>'
  ].join(''));
  const outer = document.querySelector('#unsafe-outer');

  // The authenticated child must not grant its unmodeled flex/reordered
  // ancestor a layout exemption. Native copy is the only safe outcome until
  // that complete outer layout can be represented.
  assert.equal(payloadFor(instance, outer), null);
});

test('an empty aria-only math root cannot inject an unselected label into mixed output', () => {
  const { instance, document } = setup([
    '<main id="target">Before ',
    fixture.roots.subscript,
    ' <span role="math" aria-label="SECRET_NOT_SELECTED"></span> after ',
    fixture.roots.vector,
    '.</main>'
  ].join(''));
  const payload = payloadFor(instance, document.querySelector('#target'));

  // A programmatic or page-expanded Range can intersect an empty ARIA node,
  // but there is no independently selected surface that authenticates its
  // label. Returning native is safe; injecting the label is not.
  assert.doesNotMatch(payload && payload.text || '', /SECRET_NOT_SELECTED/u);
});

test('an unsourced fallback root cannot promote aria-hidden alternate text', () => {
  const { instance, document } = setup([
    '<main id="target">Before ',
    fixture.roots.subscript,
    ' <span role="math"><span aria-hidden="true">SECRET_ALTERNATE</span>x + y</span> after ',
    fixture.roots.vector,
    '.</main>'
  ].join(''));
  const payload = payloadFor(instance, document.querySelector('#target'));

  assert.doesNotMatch(payload && payload.text || '', /SECRET_ALTERNATE/u);
});

test('an ordinary-safe fallback root preserves authored superscript and subscript meaning', () => {
  const { instance, document } = setup([
    '<main id="target">Before ',
    fixture.roots.subscript,
    ' <span role="math">V<sub>coil</sub> + x<sup>ab</sup></span> after ',
    fixture.roots.vector,
    '.</main>'
  ].join(''));
  const expected = {
    faithful: 'Before V_C V_(coil) + x^(ab) after V⃗.',
    calculator: 'Before V_(C) V_(coil) + x^(ab) after V.',
    latex: 'Before ${V}_{C}$ V_{coil} + x^{ab} after $\\overset{⃗}{V}$.'
  };
  for (const [outputMode, text] of Object.entries(expected)) {
    const payload = payloadFor(instance, document.querySelector('#target'), outputMode);
    assert.ok(payload);
    assert.equal(payload.text, text, outputMode);
    assert.doesNotMatch(payload.text, /c\*o\*i\*l|a\*b/u);
  }
});

test('an exact ordinary-safe fallback root preserves authored scripts without surrounding renderers', () => {
  const { instance, document } = setup([
    '<main><span id="target" role="math">V<sub>C</sub> + x<sup>2</sup></span></main>'
  ].join(''));
  for (const [outputMode, expected] of Object.entries({
    faithful: 'V_C + x²',
    calculator: 'V_(C) + x^(2)',
    latex: 'V_{C} + x^{2}'
  })) {
    const payload = payloadFor(instance, document.querySelector('#target'), outputMode);
    assert.ok(payload);
    assert.equal(payload.text, expected, outputMode);
    assert.doesNotMatch(payload.text, /VC \+ x2/u);
  }
});

test('an exact ordinary-safe fallback root preserves an authored line boundary', () => {
  const { instance, document } = setup([
    '<main><span id="target" role="math">x<br>y</span></main>'
  ].join(''));
  const payload = payloadFor(instance, document.querySelector('#target'));

  assert.ok(payload);
  assert.equal(payload.text, 'x\ny');
  assert.notEqual(payload.text, 'xy');
});

test('an ordinary-safe fallback root preserves an authored line boundary', () => {
  const { instance, document } = setup([
    '<main id="target">Before ',
    fixture.roots.subscript,
    ' <span role="math">x<br>y</span> after ',
    fixture.roots.vector,
    '.</main>'
  ].join(''));
  const payload = payloadFor(instance, document.querySelector('#target'));

  assert.ok(payload);
  assert.equal(payload.text, 'Before V_C x\ny after V⃗.');
  assert.doesNotMatch(payload.text, /V_C xy after/u);
});

test('an unsourced fallback rejects unmodeled offsets, clips, graphics, and every image', () => {
  const unsafeCases = {
    'relative raised token': 'x<span style="position:relative;top:-.5em;font-size:70%">2</span>',
    'relative offscreen text': 'x + y<span style="position:relative;left:-100000px">SECRET</span>',
    'sticky offset text': 'x<span style="position:sticky;top:1px">2</span>',
    'clipped nonzero box': 'x + y<span style="display:inline-block;width:1px;height:1px;overflow:hidden">SECRET</span>',
    'SVG-drawn operator': 'x<svg viewBox="0 0 10 10"><path d="M0 5h10M5 0v10"/></svg>y',
    'canvas-drawn operator': 'x<canvas width="10" height="10"></canvas>y',
    'embedded object': 'x<object data="about:blank"></object>y',
    'embedded frame': 'x<iframe src="about:blank"></iframe>y',
    'one image alt': 'x<img src="plus.png" alt="+">y',
    'multiple image alts': 'x + y<img src="one.png" alt="x + y"><img src="two.png" alt="SECRET">',
    'closed details content': 'x<details><summary>+</summary><span>SECRET_CLOSED</span></details>y',
    'ruby annotation layout': 'x<ruby>y<rt>2</rt></ruby>',
    'bidirectional visual override element': '<bdo dir="rtl">x + y</bdo>',
    'bidirectional visual override CSS': '<span style="direction:rtl;unicode-bidi:bidi-override">x + y</span>'
  };

  for (const [name, unsafeMarkup] of Object.entries(unsafeCases)) {
    const { instance, document } = setup([
      '<main id="target">Before ',
      fixture.roots.subscript,
      ' <span id="unsafe" role="math">', unsafeMarkup, '</span> after ',
      fixture.roots.vector,
      '.</main>'
    ].join(''));
    assert.equal(payloadFor(instance, document.querySelector('#unsafe')), null, name + ' exact');
    assert.equal(payloadFor(instance, document.querySelector('#target')), null, name + ' mixed');
  }
});

test('an explicit stale ARIA script direction invalidates an unsourced fallback root', () => {
  const { instance, document } = setup([
    '<main id="target">Before ',
    fixture.roots.subscript,
    ' <span role="math" aria-label="x₂">x<sup>2</sup></span> after ',
    fixture.roots.vector,
    '.</main>'
  ].join(''));

  // NFKC maps both Unicode superscripts and subscripts to the same baseline
  // digit. Agreement must retain their direction instead of accepting this
  // contradictory accessible representation as equivalent.
  assert.equal(payloadFor(instance, document.querySelector('#target')), null);
});

test('an unsourced fallback root rejects generated CSS math content it cannot serialize', () => {
  const { instance, document } = setup([
    '<main id="target">Before ',
    fixture.roots.subscript,
    ' <span id="generated" role="math">xy</span> after ',
    fixture.roots.vector,
    '.</main>'
  ].join(''));
  const nativeGetComputedStyle = instance.window.getComputedStyle.bind(instance.window);
  Object.defineProperty(instance.window.navigator, 'userAgent', {
    value: 'Clean Math Copy pseudo-style test',
    configurable: true
  });
  instance.window.getComputedStyle = (element, pseudo) => {
    if (element && element.id === 'generated' && pseudo === '::before') {
      return { content: '"+"', getPropertyValue: () => '' };
    }
    if (pseudo === '::before' || pseudo === '::after') {
      return { content: 'none', getPropertyValue: () => '' };
    }
    return nativeGetComputedStyle(element);
  };

  assert.equal(payloadFor(instance, document.querySelector('#target')), null);
});

test('an exact unsourced fallback root cannot bypass a hidden ancestor', () => {
  for (const style of [
    'display:none',
    'opacity:0',
    'position:absolute;left:-100000px',
    'height:0;overflow:hidden'
  ]) {
    const { instance, document } = setup([
      '<main><span style="', style, '">',
      '<span id="target" role="math">SECRET_ANCESTOR</span>',
      '</span></main>'
    ].join(''));
    assert.equal(payloadFor(instance, document.querySelector('#target')), null, style);
  }
});

test('a partial unsourced math selection cannot widen through a normalized surface key', () => {
  const variants = [
    {
      label: 'preserved spaces',
      markup: '<span id="target" role="math" style="white-space:pre">  x  </span>',
      start: 2,
      end: 3
    },
    {
      label: 'bidirectional control',
      markup: '<span id="target" role="math">‮x</span>',
      start: 1,
      end: 2
    }
  ];

  for (const variant of variants) {
    const { instance, document } = setup('<main>' + variant.markup + '</main>');
    const target = document.querySelector('#target');
    const range = document.createRange();
    range.setStart(target.firstChild, variant.start);
    range.setEnd(target.firstChild, variant.end);
    const selection = instance.window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    assert.equal(range.toString(), 'x', variant.label + ' native range');
    assert.equal(cleanCopy.getCopyPayload(
      document,
      selection,
      { outputMode: 'faithful' },
      instance.window,
      target
    ), null, variant.label);
  }
});

test('the stricter unsourced fallback does not disable independently sourced semantic math', () => {
  const { instance, document } = setup([
    '<main><span id="target" role="math" data-latex="x^2">',
    'x<span style="position:relative;top:-.5em;font-size:70%">2</span>',
    '</span></main>'
  ].join(''));
  const payload = payloadFor(instance, document.querySelector('#target'));

  assert.ok(payload);
  assert.equal(payload.text, 'x²');
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
