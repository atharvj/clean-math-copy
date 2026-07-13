'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const cleanCopy = require('../clean-math-copy.user.js');

function dom(html, url = 'https://example.test/') {
  return new JSDOM('<!doctype html><html><body>' + html + '</body></html>', {
    url
  });
}

function selectContents(window, element) {
  const selection = window.getSelection();
  selection.removeAllRanges();
  const range = window.document.createRange();
  range.selectNodeContents(element);
  selection.addRange(range);
  return selection;
}

function katex(markup, source, display = false) {
  const expression = [
    '<span class="katex">',
    '<span class="katex-mathml"><math' + (display ? ' display="block"' : '') + '><semantics>',
    markup,
    '<annotation encoding="application/x-tex">' + source + '</annotation>',
    '</semantics></math></span>',
    '<span class="katex-html" aria-hidden="true">DUPLICATE GARBLED GLYPHS</span>',
    '</span>'
  ].join('');
  return display ? '<div class="katex-display">' + expression + '</div>' : expression;
}

function rendererWithSeparateAccessibilityTree(markup, visualText) {
  return [
    '<span class="opaque-renderer">',
    '<span class="a11y-mathml" style="position:absolute;clip:rect(1px,1px,1px,1px)"><math>',
    markup,
    '</math></span>',
    '<span class="visual-layout">', visualText, '</span>',
    '</span>'
  ].join('');
}

function positionedWordToken(left, top, size, text) {
  return [
    '<span role="presentation" dir="ltr" style="left:calc(var(--scale-factor)*', left,
    'px);top:calc(var(--scale-factor)*', top, 'px);font-size:calc(var(--scale-factor)*', size,
    'px)"><span tabindex="0">', text, '</span></span>'
  ].join('');
}

test('copies KaTeX exactly once and uses its MathML structure', () => {
  const instance = dom('<p id="target">Einstein wrote ' + katex(
    '<mrow><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></mrow>',
    'E=mc^2'
  ) + '.</p>');
  const target = instance.window.document.querySelector('#target');
  const selection = selectContents(instance.window, target);
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    { outputMode: 'unicode' },
    instance.window,
    target
  );
  assert.equal(payload.reason, 'rendered-math');
  assert.equal(payload.text, 'Einstein wrote E = mc².');
  assert.equal(payload.text.includes('DUPLICATE'), false);
});

test('regression: recognizes the ChatGPT square-root layout outside the MathML branch', () => {
  const markup = [
    '<mrow><mi>r</mi><mo>∝</mo><msqrt><mfrac><mi>m</mi>',
    '<mrow><mo>|</mo><mi>q</mi><mo>|</mo></mrow>',
    '</mfrac></msqrt></mrow>'
  ].join('');
  const instance = dom('<p>Before ' + rendererWithSeparateAccessibilityTree(markup, 'r∝∣q∣m\u200b') + ' after</p>');
  const visual = instance.window.document.querySelector('.visual-layout');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, visual),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    visual
  );
  assert.equal(payload.text, 'r ∝ sqrt(m/abs(q))');
  assert.equal(/[\s\u200b\u2060]$/.test(payload.text), false);
  assert.match(payload.html, /border-top:1px solid currentColor/);
  assert.match(payload.mathML, /^<math/);
});

test('regression: preserves nested fraction/root order as executable calculator text', () => {
  const markup = [
    '<mrow><mi>r</mi><mo>=</mo><mfrac><mn>1</mn><mn>0.452</mn></mfrac><msqrt><mfrac>',
    '<mrow><mn>2</mn><mo>(</mo><mn>0.666</mn><mo>×</mo>',
    '<msup><mn>10</mn><mrow><mo>−</mo><mn>25</mn></mrow></msup><mo>)</mo>',
    '<mo>(</mo><mn>2464</mn><mo>)</mo></mrow>',
    '<mrow><mn>1.602</mn><mo>×</mo><msup><mn>10</mn>',
    '<mrow><mo>−</mo><mn>19</mn></mrow></msup></mrow>',
    '</mfrac></msqrt></mrow>'
  ].join('');
  const brokenVisualOrder = 'r=0.4521\u200b1.602×10−192(0.666×10−25)(2464)\u200b\n';
  const instance = dom(rendererWithSeparateAccessibilityTree(markup, brokenVisualOrder));
  const visual = instance.window.document.querySelector('.visual-layout');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, visual),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    visual
  );
  const expected = 'r=(1/0.452)*sqrt((2*(0.666*10^(-25))*(2464))/(1.602*10^(-19)))';
  assert.equal(payload.text, expected);
  assert.equal(/\s$/.test(payload.text), false);
  const calculatorExpression = payload.text.slice(2).replace(/\^/g, '**').replace(/sqrt/g, 'Math.sqrt');
  assert.ok(Math.abs(Function('return ' + calculatorExpression)() - 0.10013889008551723) < 1e-14);
  assert.match(payload.html, /display:inline-block/);
  assert.match(payload.html, /border-top:1px solid currentColor/);
});

test('keeps several inline equations in document order with their surrounding spacing', () => {
  const instance = dom('<p id="target">First ' +
    katex('<mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow>', 'x=1') +
    ', then ' + katex('<mrow><mi>y</mi><mo>=</mo><mn>2</mn></mrow>', 'y=2') + '.</p>');
  const target = instance.window.document.querySelector('#target');
  const selection = selectContents(instance.window, target);
  assert.equal(
    cleanCopy.getCopyPayload(instance.window.document, selection, { outputMode: 'unicode' }, instance.window, target).text,
    'First x = 1, then y = 2.'
  );
});

test('supports original LaTeX and ASCII output modes', () => {
  const instance = dom('<p id="target">Value: ' + katex(
    '<mfrac><mn>1</mn><mn>2</mn></mfrac>',
    String.raw`\frac{1}{2}`
  ) + '</p>');
  const target = instance.window.document.querySelector('#target');
  const selection = selectContents(instance.window, target);
  assert.equal(
    cleanCopy.getCopyPayload(instance.window.document, selection, { outputMode: 'latex' }, instance.window, target).text,
    String.raw`Value: $\frac{1}{2}$`
  );
  assert.equal(
    cleanCopy.getCopyPayload(instance.window.document, selection, { outputMode: 'ascii' }, instance.window, target).text,
    'Value: (1)/(2)'
  );
});

test('an unmatched partial renderer selection is never widened to the whole equation', () => {
  const instance = dom('<p id="target">before ' + katex(
    '<mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow>',
    'x+1'
  ) + ' after</p>');
  const duplicate = instance.window.document.querySelector('.katex-html').firstChild;
  const selection = instance.window.getSelection();
  const range = instance.window.document.createRange();
  range.setStart(duplicate, 2);
  range.setEnd(duplicate, 7);
  selection.addRange(range);
  const payload = cleanCopy.getCopyPayload(instance.window.document, selection, { outputMode: 'unicode' }, instance.window, duplicate.parentElement);
  assert.equal(payload, null);
});

test('partial matching collapses zero-surface MathML nodes instead of exploring quadratic slices', () => {
  const spaces = '<mspace></mspace>'.repeat(100);
  const instance = dom(rendererWithSeparateAccessibilityTree(
    '<mrow><mi>y</mi>' + spaces + '<mi>x</mi>' + spaces + '<mi>z</mi></mrow>',
    'yxz'
  ));
  const visual = instance.window.document.querySelector('.visual-layout');
  const range = instance.window.document.createRange();
  range.setStart(visual.firstChild, 1);
  range.setEnd(visual.firstChild, 2);
  const selection = instance.window.getSelection();
  selection.addRange(range);
  const originalClone = instance.window.Node.prototype.cloneNode;
  let cloneCalls = 0;
  instance.window.Node.prototype.cloneNode = function countedClone(...args) {
    cloneCalls += 1;
    return originalClone.apply(this, args);
  };
  try {
    const payload = cleanCopy.getCopyPayload(
      instance.window.document,
      selection,
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      visual
    );
    assert.equal(payload.text, 'x');
    assert.ok(cloneCalls < 100, 'expected fewer than 100 clones, got ' + cloneCalls);
  } finally {
    instance.window.Node.prototype.cloneNode = originalClone;
  }
});

test('serializes native MathML fractions, roots, scripts, and tables', () => {
  const instance = dom([
    '<div id="target"><math><mrow>',
    '<mfrac><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow><msqrt><mi>y</mi></msqrt></mfrac>',
    '<mo>=</mo><msubsup><mi>a</mi><mn>1</mn><mn>2</mn></msubsup>',
    '</mrow></math></div>',
    '<math id="matrix"><mtable><mtr><mtd><mi>a</mi></mtd><mtd><mi>b</mi></mtd></mtr>',
    '<mtr><mtd><mi>c</mi></mtd><mtd><mi>d</mi></mtd></mtr></mtable></math>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  const selection = selectContents(instance.window, target);
  assert.equal(
    cleanCopy.getCopyPayload(instance.window.document, selection, { outputMode: 'unicode' }, instance.window, target).text,
    '(x + 1)/(√(y)) = a₁²'
  );
  assert.equal(cleanCopy.mathMLToUnicode(instance.window.document.querySelector('#matrix')), '[a, b; c, d]');
});

test('preserves supported Content MathML operators and declines unsupported structures without truncating them', () => {
  const instance = dom([
    '<math id="sum"><apply><plus></plus><ci>x</ci><cn>1</cn></apply></math>',
    '<math id="power"><apply><power></power><ci>x</ci><cn>2</cn></apply></math>',
    '<math id="stack"><mrow><mi>x</mi><mstack><msrow><mn>1</mn></msrow></mstack></mrow></math>'
  ].join(''));
  const sum = instance.window.document.querySelector('#sum');
  const power = instance.window.document.querySelector('#power');
  const stack = instance.window.document.querySelector('#stack');
  const sumPayload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, sum),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    sum
  );
  assert.equal(sumPayload.text, 'x+1');
  assert.match(sumPayload.html, />x \+ 1</);
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, power),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    power
  ).text, 'x^(2)');
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, stack),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    stack
  ), null);
});

test('uses only the presentation child of MathML semantics', () => {
  const instance = dom([
    '<math id="math"><semantics><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow>',
    '<annotation encoding="application/x-tex">x+1 SHOULD NOT DUPLICATE</annotation>',
    '<annotation encoding="application/x-speech">x plus one</annotation>',
    '</semantics></math>'
  ].join(''));
  assert.equal(cleanCopy.mathMLToUnicode(instance.window.document.querySelector('#math')), 'x + 1');
});

test('sanitizes MathML clipboard markup and emits valid XML with one namespace', () => {
  const instance = dom([
    '<math id="target" onclick="steal()" style="background:url(javascript:steal())">',
    '<mrow><mi onmouseover="steal()" href="javascript:steal()">x</mi>',
    '<foreign><script>bad()</script></foreign><mglyph src="https://evil.test/pixel" alt=""></mglyph></mrow>',
    '</math>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(payload.text, 'x');
  assert.doesNotMatch(payload.mathML, /onclick|onmouseover|style=|href=|src=|script|foreign|bad\(\)/i);
  assert.equal((payload.mathML.match(/\sxmlns=/g) || []).length, 1);
  const parsed = new instance.window.DOMParser().parseFromString(payload.mathML, 'application/xml');
  assert.equal(parsed.querySelector('parsererror'), null);
});

test('rejects over-deep MathML and OMML safely instead of recursing into untrusted clipboard trees', () => {
  let nestedMath = '<mi>x</mi>';
  let nestedOffice = '<m:r><m:t>x</m:t></m:r>';
  for (let index = 0; index < 130; index += 1) {
    nestedMath = '<mrow>' + nestedMath + '</mrow>';
    nestedOffice = '<m:e>' + nestedOffice + '</m:e>';
  }
  const instance = dom(
    '<math id="deep">' + nestedMath + '</math>' +
    '<m:oMath id="deep-office" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">' + nestedOffice + '</m:oMath>'
  );
  const deep = instance.window.document.querySelector('#deep');
  assert.doesNotThrow(() => cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, deep),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    deep
  ));
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, deep),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    deep
  ), null);
  assert.equal(cleanCopy.ommlToMathML(instance.window.document.querySelector('#deep-office'), instance.window.document), null);
});

test('recognizes absolute-value bars even when a renderer mislabels them as identifiers or text', () => {
  const instance = dom([
    '<math id="identifier-bars"><mrow><mi>∣</mi><mi>q</mi><mi>∣</mi></mrow></math>',
    '<math id="text-bars"><mrow><mtext>∣\u200fq\ufe0f∣</mtext></mrow></math>'
  ].join(''));
  assert.equal(cleanCopy.mathMLToCalculator(instance.window.document.querySelector('#identifier-bars')), 'abs(q)');
  assert.equal(cleanCopy.mathMLToCalculator(instance.window.document.querySelector('#text-bars')), 'abs(q)');
  assert.equal(cleanCopy.unicodeToCalculator('∣**q**∣'), 'abs(q)');
  const fenced = instance.window.document.createElementNS('http://www.w3.org/1998/Math/MathML', 'mfenced');
  fenced.setAttribute('open', '|');
  fenced.setAttribute('close', '|');
  const identifier = instance.window.document.createElementNS('http://www.w3.org/1998/Math/MathML', 'mi');
  identifier.textContent = 'x';
  fenced.appendChild(identifier);
  assert.equal(cleanCopy.mathMLToCalculator(fenced), 'abs(x)');
});

test('an empty recognized equation never replaces the clipboard with whitespace', () => {
  const instance = dom('<p><span id="empty" role="math"><svg aria-hidden="true"><path></path></svg> </span></p>');
  const target = instance.window.document.querySelector('#empty');
  assert.equal(
    cleanCopy.getCopyPayload(instance.window.document, selectContents(instance.window, target), {}, instance.window, target),
    null
  );
});

test('places display equations on their own line without renderer whitespace', () => {
  const instance = dom('<div id="target"><p>Before</p>' +
    katex('<mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow>', 'x=1', true) +
    '<p>After</p></div>');
  const target = instance.window.document.querySelector('#target');
  assert.equal(
    cleanCopy.getCopyPayload(instance.window.document, selectContents(instance.window, target), { outputMode: 'unicode' }, instance.window, target).text,
    'Before\n\nx = 1\nAfter'
  );
});

test('uses MathJax original TeX when no assistive MathML is present', () => {
  const instance = dom('<p id="target">Result: <mjx-container><svg><text>visual</text></svg></mjx-container></p>');
  const target = instance.window.document.querySelector('#target');
  const mathRoot = instance.window.document.querySelector('mjx-container');
  const pageWindow = {
    MathJax: {
      startup: {
        document: {
          getMathItemsWithin(root) {
            return root === mathRoot ? [{ math: String.raw`\int_0^1 x^2\,dx` }] : [];
          }
        }
      }
    }
  };
  const selection = selectContents(instance.window, target);
  assert.equal(
    cleanCopy.getCopyPayload(instance.window.document, selection, { outputMode: 'unicode' }, pageWindow, target).text,
    'Result: ∫₀¹ x² dx'
  );
});

test('falls back to the MathJax MathItem list when container lookup rejects rendered roots', () => {
  const instance = dom('<mjx-container id="math"><svg></svg></mjx-container>');
  const root = instance.window.document.querySelector('#math');
  const pageWindow = {
    MathJax: {
      startup: {
        document: {
          getMathItemsWithin() { throw new TypeError('source containers only'); },
          math: [{ math: String.raw`\sqrt{x}`, typesetRoot: root }]
        }
      }
    }
  };
  assert.equal(cleanCopy.extractMathText(root, 'unicode', pageWindow), '√(x)');
});

test('preserves semantic blocks, lists, tables, image alt text, and preformatted text around math', () => {
  const instance = dom([
    '<div id="target">',
    '<p>Formula ' + katex('<mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow>', 'x=1') + '</p>',
    '<ul><li>first</li><li>second</li></ul>',
    '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>',
    '<pre>  keep\n    indentation</pre>',
    '<img alt="diagram description">',
    '</div>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  const selection = selectContents(instance.window, target);
  const text = cleanCopy.getCopyPayload(instance.window.document, selection, { outputMode: 'unicode' }, instance.window, target).text;
  assert.equal(text, [
    'Formula x = 1',
    '',
    '• first',
    '• second',
    'A\tB',
    '1\t2',
    '  keep',
    '    indentation',
    'diagram description'
  ].join('\n'));
});

test('ordinary text stays on the native browser copy path, even under a generic formula class', () => {
  const instance = dom('<p id="target" class="formula">Keep  spacing,\nemoji 👨‍👩‍👧‍👦, and symbols ≤ exactly.</p>');
  const target = instance.window.document.querySelector('#target');
  const selection = selectContents(instance.window, target);
  assert.equal(cleanCopy.getCopyPayload(instance.window.document, selection, {}, instance.window, target), null);
});

test('a generic formula ancestor never swallows prose around a nested renderer', () => {
  const instance = dom('<article class="formula" id="target">Intro ' +
    katex('<mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow>', 'x=1') +
    ' outro and unrelated text.</article>');
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(payload.text, 'Intro x=1 outro and unrelated text.');
});

test('raw delimited LaTeX converts in prose but remains literal in code and text controls', () => {
  const instance = dom('<p id="prose">Equation $x^2+1$.</p><code id="code">$x^2+1$</code><textarea id="input">$x^2+1$</textarea>');
  const prose = instance.window.document.querySelector('#prose');
  assert.equal(
    cleanCopy.getCopyPayload(instance.window.document, selectContents(instance.window, prose), { outputMode: 'unicode' }, instance.window, prose).text,
    'Equation x² + 1.'
  );
  const code = instance.window.document.querySelector('#code');
  assert.equal(cleanCopy.getCopyPayload(instance.window.document, selectContents(instance.window, code), {}, instance.window, code), null);
  const input = instance.window.document.querySelector('#input');
  assert.equal(cleanCopy.getCopyPayload(instance.window.document, selectContents(instance.window, input), {}, instance.window, input), null);
});

test('converts compact standalone Unicode math and exact numeric partials while preserving rich symbols', () => {
  const instance = dom([
    '<p id="root">r ∝ √(m/|q|)\n</p>',
    '<p id="mass">m = <strong>0.666 × 10⁻²⁵</strong> kg</p>'
  ].join(''));
  const root = instance.window.document.querySelector('#root');
  const rootPayload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, root),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    root
  );
  assert.equal(rootPayload.reason, 'unicode-math');
  assert.equal(rootPayload.text, 'r ∝ sqrt(m/abs(q))');
  assert.equal(/\s$/.test(rootPayload.text), false);
  assert.match(rootPayload.html, /√\(m\/\|q\|\)/);
  assert.doesNotMatch(rootPayload.html, /sqrt\(/);

  const mass = instance.window.document.querySelector('#mass');
  const massPayload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, mass),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    mass
  );
  assert.equal(massPayload.text, 'm=0.666*10^(-25)*k*g');

  const numeric = mass.querySelector('strong');
  const numericPayload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, numeric),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    numeric
  );
  assert.equal(numericPayload.text, '0.666*10^(-25)');
  assert.match(numericPayload.html, /<strong>0\.666 × 10⁻²⁵<\/strong>/);
});

test('standalone Unicode detection declines prose and protected code selections', () => {
  for (const text of [
    'The symbols ≤ and ≥ are supported.',
    'For x ≥ 0, use √x.',
    'Temperature ≥ 20 × 1 degrees.',
    'Plan A ≠ Plan B',
    'Temperature ≥ room temperature'
  ]) {
    const instance = dom('<p id="target"></p>');
    const target = instance.window.document.querySelector('#target');
    target.textContent = text;
    assert.equal(
      cleanCopy.getCopyPayload(instance.window.document, selectContents(instance.window, target), {}, instance.window, target),
      null
    );
  }
  const protectedInstance = dom('<pre id="target">0.666 × 10⁻²⁵</pre>');
  const protectedTarget = protectedInstance.window.document.querySelector('#target');
  assert.equal(
    cleanCopy.getCopyPayload(
      protectedInstance.window.document,
      selectContents(protectedInstance.window, protectedTarget),
      {},
      protectedInstance.window,
      protectedTarget
    ),
    null
  );
});

test('standalone Unicode detection rejects compact and comparative prose but accepts structured named formulas', () => {
  for (const prose of [
    'α vs β',
    'go × up',
    'no ≥ 2 × us',
    'AI × ML',
    'Plan A ≠ Plan B',
    'Temperature ≥ room temperature'
  ]) {
    assert.equal(cleanCopy.looksLikeStandaloneUnicodeMath(prose), false, prose);
  }
  assert.equal(cleanCopy.looksLikeStandaloneUnicodeMath('speed = 2 × time'), true);
  assert.equal(cleanCopy.looksLikeStandaloneUnicodeMath('velocity = 2 × time'), true);
  assert.equal(cleanCopy.looksLikeStandaloneUnicodeMath('initial_velocity ∝ final_velocity²'), true);
  assert.equal(cleanCopy.looksLikeStandaloneUnicodeMath('dx/dt²'), true);
  const instance = dom('<p id="target">speed = 2 × time</p>');
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(payload.reason, 'unicode-math');
  assert.equal(payload.text, 'speed=2*time');
});

test('standalone rich HTML strips forged style trust and falls back before cloning over-budget DOM', () => {
  const forged = dom([
    '<p id="target" data-clean-math-copy-rich="true" ',
    'style="color:red;background-image:url(javascript:steal())">',
    '<strong data-clean-math-copy-rich="true" style="font-size:9999px">0.666 × 10⁻²⁵</strong>',
    '</p>'
  ].join(''));
  const forgedTarget = forged.window.document.querySelector('#target');
  const forgedPayload = cleanCopy.getCopyPayload(
    forged.window.document,
    selectContents(forged.window, forgedTarget),
    cleanCopy.DEFAULT_SETTINGS,
    forged.window,
    forgedTarget
  );
  assert.equal(forgedPayload.text, '0.666*10^(-25)');
  assert.match(forgedPayload.html, /<strong>0\.666 × 10⁻²⁵<\/strong>/);
  assert.doesNotMatch(forgedPayload.html, /style=|data-clean-math-copy-rich|javascript:/i);

  for (const shape of ['deep', 'wide']) {
    const instance = dom('<div id="target"></div>');
    const target = instance.window.document.querySelector('#target');
    if (shape === 'deep') {
      let current = target;
      for (let depth = 0; depth < 140; depth += 1) {
        const child = instance.window.document.createElement('span');
        current.appendChild(child);
        current = child;
      }
      current.textContent = '0.666 × 10⁻²⁵';
    } else {
      for (let count = 0; count < 5001; count += 1) target.appendChild(instance.window.document.createElement('span'));
      target.appendChild(instance.window.document.createTextNode('0.666 × 10⁻²⁵'));
    }
    const originalClone = instance.window.Range.prototype.cloneContents;
    let cloneCalls = 0;
    instance.window.Range.prototype.cloneContents = function countedCloneContents() {
      cloneCalls += 1;
      return originalClone.call(this);
    };
    try {
      const payload = cleanCopy.getCopyPayload(
        instance.window.document,
        selectContents(instance.window, target),
        cleanCopy.DEFAULT_SETTINGS,
        instance.window,
        target
      );
      assert.equal(payload.text, '0.666*10^(-25)', shape);
      assert.equal(cloneCalls, 0, shape);
      assert.doesNotMatch(payload.html, /<span/i, shape);
      assert.match(payload.html, /0\.666 × 10⁻²⁵/, shape);
    } finally {
      instance.window.Range.prototype.cloneContents = originalClone;
    }
  }
});

test('standalone Unicode fallback defers to contenteditable and Office semantic copy handlers', () => {
  const editable = dom('<div id="target" contenteditable="true">0.666 × 10⁻²⁵</div>');
  const editableTarget = editable.window.document.querySelector('#target');
  selectContents(editable.window, editableTarget);
  cleanCopy.install(editable.window.document, editable.window);
  let editableHandlerCalled = false;
  const editableClipboard = new Map();
  editableTarget.addEventListener('copy', (event) => {
    editableHandlerCalled = true;
    event.clipboardData.setData('text/html', '<strong>editor semantic payload</strong>');
  });
  const editableEvent = new editable.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(editableEvent, 'clipboardData', {
    value: {
      clearData() { editableClipboard.clear(); },
      setData(type, value) { editableClipboard.set(type, value); },
      getData(type) { return editableClipboard.get(type) || ''; }
    }
  });
  editableTarget.dispatchEvent(editableEvent);
  assert.equal(editableHandlerCalled, true);
  assert.equal(editableEvent.defaultPrevented, false);
  assert.equal(editableClipboard.get('text/html'), '<strong>editor semantic payload</strong>');
  assert.equal(editableClipboard.has('text/plain'), false);

  const office = dom('<div id="target">r ∝ √(m/|q|)</div>', 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const officeTarget = office.window.document.querySelector('#target');
  selectContents(office.window, officeTarget);
  cleanCopy.install(office.window.document, office.window);
  let officeHandlerCalled = false;
  const officeClipboard = new Map();
  officeTarget.addEventListener('copy', (event) => {
    officeHandlerCalled = true;
    event.clipboardData.setData('MathML', '<math xmlns="http://www.w3.org/1998/Math/MathML"><msqrt><mi>x</mi></msqrt></math>');
    event.stopImmediatePropagation();
  });
  const officeEvent = new office.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(officeEvent, 'clipboardData', {
    value: {
      get types() { return Array.from(officeClipboard.keys()); },
      clearData(type) { if (type) officeClipboard.delete(type); else officeClipboard.clear(); },
      setData(type, value) { officeClipboard.set(type, value); },
      getData(type) { return officeClipboard.get(type) || ''; }
    }
  });
  officeTarget.dispatchEvent(officeEvent);
  assert.equal(officeHandlerCalled, true);
  assert.equal(officeClipboard.get('text/plain'), 'sqrt(x)');
  assert.match(officeClipboard.get('text/html'), /role="math"/);
});

test('empty LaTeX conversions never clear, write, or suppress the native clipboard event', () => {
  const instance = dom('<p id="target">$\\phantom{x}$</p>');
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  let cleared = 0;
  let writes = 0;
  let siteCalled = false;
  target.addEventListener('copy', () => { siteCalled = true; });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      get types() { return []; },
      clearData() { cleared += 1; },
      setData() { writes += 1; },
      getData() { return ''; }
    }
  });
  target.dispatchEvent(event);
  assert.equal(siteCalled, true);
  assert.equal(cleared, 0);
  assert.equal(writes, 0);
  assert.equal(event.defaultPrevented, false);
});

test('reconstructs Word for the web positioned subscripts without copying its layout DOM', () => {
  const instance = dom([
    '<div class="react-pdf__Page"><div id="line" class="react-pdf__Page__textContent textLayer">',
    '<span class="markedContent" id="word-line"><br role="presentation">',
    positionedWordToken(72.03, 100, 11, '𝑅'),
    positionedWordToken(78.28, 104.65, 8, '1'),
    positionedWordToken(83, 100, 11, ', '),
    positionedWordToken(93, 100, 11, '𝑅'),
    positionedWordToken(99.25, 104.65, 8, '2'),
    positionedWordToken(104, 100, 11, ' = 4.7kΩ, 10kΩ and C = 220μF'),
    '</span></div></div>'
  ].join(''), 'https://view.officeapps.live.com/op/view.aspx');
  const line = instance.window.document.querySelector('#line');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, line),
    { outputMode: 'unicode' },
    instance.window,
    line
  );
  assert.equal(payload.text, 'R₁, R₂ = 4.7kΩ, 10kΩ and C = 220μF');
  assert.match(payload.html, /𝑅<sub>1<\/sub>, 𝑅<sub>2<\/sub>/);
  assert.doesNotMatch(payload.html, /react-pdf|markedContent|position\s*:/);
  assert.equal(/[\s\u200b\u2060]$/.test(payload.text), false);
  assert.equal(
    cleanCopy.getCopyPayload(instance.window.document, selectContents(instance.window, line), { outputMode: 'calculator' }, instance.window, line).text,
    'R_(1), R_(2)=4.7*kOmega, 10*kOmega and C=220*muF'
  );

  const tokens = instance.window.document.querySelectorAll('#word-line [tabindex]');
  const range = instance.window.document.createRange();
  range.setStart(tokens[0].firstChild, 0);
  range.setEnd(tokens[1].firstChild, 1);
  const partial = instance.window.getSelection();
  partial.removeAllRanges();
  partial.addRange(range);
  assert.equal(
    cleanCopy.getCopyPayload(instance.window.document, partial, { outputMode: 'unicode' }, instance.window, tokens[0]).text,
    'R₁'
  );
});

test('recognizes Unicode letterlike math exceptions in positioned Word scripts', () => {
  const instance = dom([
    '<div class="react-pdf__Page"><div id="line" class="react-pdf__Page__textContent textLayer">',
    '<span class="markedContent">',
    positionedWordToken(20, 40, 11, 'ℎ'),
    positionedWordToken(26, 44.65, 8, '1'),
    '</span></div></div>'
  ].join(''), 'https://view.officeapps.live.com/op/view.aspx');
  const line = instance.window.document.querySelector('#line');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, line),
    { outputMode: 'unicode' },
    instance.window,
    line
  );
  assert.equal(payload.text, 'h₁');
  assert.match(payload.html, /ℎ<sub>1<\/sub>/);
});

test('folds only Word native mathematical-alphanumeric duplicate runs', () => {
  const native = '𝑅1\nR\n1\n \n, \n𝑅2\nR\n2\n \n = 4.7kΩ, 10kΩ and C = 220μF\n';
  assert.equal(cleanCopy.cleanOfficeClipboardText(native), 'R₁, R₂ = 4.7kΩ, 10kΩ and C = 220μF');
  assert.equal(cleanCopy.cleanOfficeClipboardText('𝑅1\nR\n1\n'), 'R₁');
  assert.equal(cleanCopy.cleanOfficeClipboardText('𝑥\nx\n'), 'x');
  assert.equal(cleanCopy.cleanOfficeClipboardText('𝛼\nα\n'), 'α');
  assert.equal(cleanCopy.cleanOfficeClipboardText('ℎ\nh\n'), 'h');
  assert.equal(cleanCopy.cleanOfficeClipboardText('ℂ\nC\n'), 'C');
  assert.equal(cleanCopy.cleanOfficeClipboardText('R1\nR\n1\nordinary'), 'R1\nR\n1\nordinary');
  assert.equal(cleanCopy.cleanOfficeClipboardText('𝑅1\nR\n2\nmismatch'), '𝑅1\nR\n2\nmismatch');
  assert.equal(cleanCopy.cleanOfficeClipboardText('𝐀𝐁\nA\nB\nthird'), '𝐀𝐁\nA\nB\nthird');
  assert.equal(cleanCopy.cleanOfficeClipboardText('before\n\n𝑅1\nR\n1\n\nafter'), 'before\n\nR₁\n\nafter');
});

test('converts Office Math OMML fractions, radicals, and scripts before plain-text fallback', () => {
  const instance = dom([
    '<div id="office">',
    '<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">',
    '<m:sSub><m:e><m:r><m:t>R</m:t></m:r></m:e><m:sub><m:r><m:t>1</m:t></m:r></m:sub></m:sSub>',
    '<m:r><m:t>=</m:t></m:r>',
    '<m:rad><m:deg></m:deg><m:e><m:f><m:num><m:r><m:t>m</m:t></m:r></m:num>',
    '<m:den><m:r><m:t>q</m:t></m:r></m:den></m:f></m:e></m:rad>',
    '</m:oMath></div>'
  ].join(''));
  const office = cleanCopy.ommlToMathML(
    Array.from(instance.window.document.querySelectorAll('#office *')).find((element) => /omath$/i.test(element.nodeName)),
    instance.window.document
  );
  assert.equal(cleanCopy.mathMLToCalculator(office), 'R_(1)=sqrt(m/q)');
  assert.equal(cleanCopy.mathMLToUnicode(office), 'R₁ = √((m)/(q))');
});

test('converts the reported Word OMML line without false products around commas or equals signs', () => {
  const instance = dom([
    '<div id="office"><m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">',
    '<m:sSub><m:e><m:r><m:t>R</m:t></m:r></m:e><m:sub><m:r><m:t>1</m:t></m:r></m:sub></m:sSub>',
    '<m:r><m:t>, </m:t></m:r>',
    '<m:sSub><m:e><m:r><m:t>R</m:t></m:r></m:e><m:sub><m:r><m:t>2</m:t></m:r></m:sub></m:sSub>',
    '<m:r><m:t> = 4.7kΩ, 10kΩ and C = 220μF</m:t></m:r>',
    '</m:oMath></div>'
  ].join(''));
  const root = Array.from(instance.window.document.querySelectorAll('#office *'))
    .find((element) => /omath$/i.test(element.nodeName));
  const math = cleanCopy.ommlToMathML(root, instance.window.document);
  assert.equal(cleanCopy.mathMLToUnicode(math), 'R₁, R₂ = 4.7kΩ, 10kΩ and C = 220μF');
  assert.equal(cleanCopy.mathMLToCalculator(math), 'R_(1),R_(2)=4.7*kOmega,10*kOmega*and*C=220*muF');
});

test('lets Word populate its native clipboard, then cleans it without blocking the site handler', () => {
  const instance = dom([
    '<div id="WACViewPanel_EditingElement" contenteditable="true">\u00a0</div>',
    '<div id="WACViewPanel_ClipboardElement"></div>'
  ].join(''), 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const target = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const clipboard = new Map();
  const data = {
    get types() { return Array.from(clipboard.keys()); },
    clearData() { clipboard.clear(); },
    setData(type, value) { clipboard.set(type, value); },
    getData(type) { return clipboard.get(type) || ''; }
  };
  let wordHandlerCalled = false;
  target.addEventListener('copy', (event) => {
    wordHandlerCalled = true;
    event.clipboardData.setData('text/plain', '𝑅1\nR\n1\n \n, \n𝑅2\nR\n2\n \n = 4.7kΩ, 10kΩ and C = 220μF\n');
    event.preventDefault();
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', { value: data });
  target.dispatchEvent(event);
  assert.equal(wordHandlerCalled, true);
  assert.equal(clipboard.get('text/plain'), 'R₁, R₂ = 4.7kΩ, 10kΩ and C = 220μF');
  assert.equal(event.defaultPrevented, true);
});

test('prefers semantic MathML that Word adds after its temporary plain-text flavor', () => {
  const instance = dom('<div id="WACViewPanel_EditingElement" contenteditable="true">\u00a0</div>',
    'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const target = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const clipboard = new Map();
  const data = {
    get types() { return Array.from(clipboard.keys()); },
    clearData() { clipboard.clear(); },
    setData(type, value) { clipboard.set(type, value); },
    getData(type) { return clipboard.get(type) || ''; }
  };
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData('text/plain', 'garbled denominator numerator');
    event.clipboardData.setData('MathML', [
      '<math xmlns="http://www.w3.org/1998/Math/MathML"><msqrt><mfrac>',
      '<mi>m</mi><mrow><mi>∣</mi><mi>q</mi><mi>∣</mi></mrow>',
      '</mfrac></msqrt></math>'
    ].join(''));
    event.preventDefault();
    event.stopImmediatePropagation();
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', { value: data });
  target.dispatchEvent(event);
  assert.equal(clipboard.get('text/plain'), 'sqrt(m/abs(q))');
  assert.match(clipboard.get('text/html'), /border-top:1px solid currentColor/);
  assert.match(clipboard.get('MathML'), /^<math/);
});

test('a later Word plain-text write cannot overwrite semantic MathML already recovered', () => {
  const instance = dom('<div id="WACViewPanel_EditingElement" contenteditable="true">\u00a0</div>',
    'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const target = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const clipboard = new Map();
  const data = {
    get types() { return Array.from(clipboard.keys()); },
    clearData() { clipboard.clear(); },
    setData(type, value) { clipboard.set(type, value); },
    getData(type) { return clipboard.get(type) || ''; }
  };
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData('MathML', '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mi>a</mi><mi>b</mi></mfrac></math>');
    event.clipboardData.clearData();
    event.clipboardData.setData('text/plain', 'later garbled text');
    event.stopImmediatePropagation();
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', { value: data });
  target.dispatchEvent(event);
  assert.equal(clipboard.get('text/plain'), '(a/b)');
});

test('preserves prose and every equation in mixed Office HTML even when Word stops propagation', () => {
  const instance = dom('<div id="WACViewPanel_EditingElement" contenteditable="true">\u00a0</div>',
    'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const target = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const clipboard = new Map();
  const data = {
    get types() { return Array.from(clipboard.keys()); },
    clearData() { clipboard.clear(); },
    setData(type, value) { clipboard.set(type, value); },
    getData(type) { return clipboard.get(type) || ''; }
  };
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData('MathML', '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>');
    event.clipboardData.setData('text/plain', 'garbled first second');
    event.clipboardData.setData('text/html', [
      'Version:1.0\r\nStartHTML:00000097\r\nEndHTML:00000999\r\n',
      '<!--StartFragment-->',
      '<p>Before <math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow></math>',
      ' and <math xmlns="http://www.w3.org/1998/Math/MathML"><msqrt><mi>y</mi></msqrt></math> after</p>',
      '<!--EndFragment-->'
    ].join(''));
    event.preventDefault();
    event.stopImmediatePropagation();
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', { value: data });
  target.dispatchEvent(event);
  assert.equal(clipboard.get('text/plain'), 'Before x=1 and sqrt(y) after');
  assert.equal((clipboard.get('text/html').match(/role="math"/g) || []).length, 2);
  assert.equal(clipboard.has('MathML'), false);
});

test('separates multiple equations in an Office oMathPara instead of multiplying them', () => {
  const instance = dom('<div id="WACViewPanel_EditingElement" contenteditable="true">\u00a0</div>',
    'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const target = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const clipboard = new Map();
  const data = {
    get types() { return Array.from(clipboard.keys()); },
    clearData() { clipboard.clear(); },
    setData(type, value) { clipboard.set(type, value); },
    getData(type) { return clipboard.get(type) || ''; }
  };
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData('MathML', [
      '<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">',
      '<m:oMath><m:r><m:t>x=1</m:t></m:r></m:oMath>',
      '<m:oMath><m:r><m:t>y=2</m:t></m:r></m:oMath>',
      '</m:oMathPara>'
    ].join(''));
    event.stopImmediatePropagation();
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', { value: data });
  target.dispatchEvent(event);
  assert.equal(clipboard.get('text/plain'), 'x=1\ny=2');
  assert.equal(clipboard.has('MathML'), false);
});

test('never blocks a site handler or clears data for a whitespace-only Word equation placeholder', () => {
  const instance = dom([
    '<div id="WACViewPanel_EditingElement" contenteditable="true">',
    '<span id="empty" role="math"><svg aria-hidden="true"><path></path></svg>\u00a0</span>',
    '</div>'
  ].join(''), 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const target = instance.window.document.querySelector('#empty');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  let siteCalled = false;
  let cleared = 0;
  let writes = 0;
  target.addEventListener('copy', () => { siteCalled = true; });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      get types() { return []; },
      clearData() { cleared += 1; },
      setData() { writes += 1; },
      getData() { return ''; }
    }
  });
  target.dispatchEvent(event);
  assert.equal(siteCalled, true);
  assert.equal(cleared, 0);
  assert.equal(writes, 0);
  assert.equal(event.defaultPrevented, false);
});

test('recovers Word clipboard text when the site writes only through its staging element', async () => {
  const instance = dom([
    '<div id="WACViewPanel_EditingElement" contenteditable="true">\u00a0</div>',
    '<div id="WACViewPanel_ClipboardElement"></div>'
  ].join(''), 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const target = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  const staging = instance.window.document.querySelector('#WACViewPanel_ClipboardElement');
  selectContents(instance.window, target);
  let recovered = '';
  const previous = global.GM_setClipboard;
  global.GM_setClipboard = (value) => { recovered = value; };
  try {
    cleanCopy.install(instance.window.document, instance.window);
    target.addEventListener('copy', () => {
      const value = instance.window.document.createElement('span');
      value.textContent = '𝑅1\nR\n1\n \n, \n𝑅2\nR\n2\n \n = 4.7kΩ, 10kΩ and C = 220μF';
      staging.appendChild(value);
    });
    const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        get types() { return []; },
        clearData() {},
        setData() {},
        getData() { return ''; }
      }
    });
    target.dispatchEvent(event);
    await new Promise((resolve) => instance.window.setTimeout(resolve, 10));
    assert.equal(recovered, 'R₁, R₂ = 4.7kΩ, 10kΩ and C = 220μF');
  } finally {
    if (previous === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previous;
  }
});

test('semantic Word staging still wins after Word first writes nonempty plain text', async () => {
  const instance = dom([
    '<div id="WACViewPanel_EditingElement" contenteditable="true">\u00a0</div>',
    '<div id="WACViewPanel_ClipboardElement"></div>'
  ].join(''), 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const target = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  const staging = instance.window.document.querySelector('#WACViewPanel_ClipboardElement');
  selectContents(instance.window, target);
  let recovered = '';
  const previous = global.GM_setClipboard;
  global.GM_setClipboard = (value) => { recovered = value; };
  try {
    cleanCopy.install(instance.window.document, instance.window);
    const clipboard = new Map();
    target.addEventListener('copy', (event) => {
      event.clipboardData.setData('text/plain', 'garbled fraction');
      staging.innerHTML = [
        '<math xmlns="http://www.w3.org/1998/Math/MathML"><msqrt><mfrac>',
        '<mi>m</mi><mi>q</mi></mfrac></msqrt></math>'
      ].join('');
    });
    const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        get types() { return Array.from(clipboard.keys()); },
        clearData() { clipboard.clear(); },
        setData(type, value) { clipboard.set(type, value); },
        getData(type) { return clipboard.get(type) || ''; }
      }
    });
    target.dispatchEvent(event);
    await new Promise((resolve) => instance.window.setTimeout(resolve, 10));
    assert.equal(clipboard.get('text/plain'), 'garbled fraction');
    assert.equal(recovered, 'sqrt(m/q)');
  } finally {
    if (previous === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previous;
  }
});

test('a newer Word copy cancels an older staging recovery before it can overwrite the clipboard', async () => {
  const instance = dom([
    '<div id="WACViewPanel_EditingElement" contenteditable="true">\u00a0</div>',
    '<div id="WACViewPanel_ClipboardElement"></div>'
  ].join(''), 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const target = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  const staging = instance.window.document.querySelector('#WACViewPanel_ClipboardElement');
  selectContents(instance.window, target);
  const recovered = [];
  const previous = global.GM_setClipboard;
  global.GM_setClipboard = (value) => { recovered.push(value); };
  try {
    cleanCopy.install(instance.window.document, instance.window);
    let copyNumber = 0;
    target.addEventListener('copy', () => {
      copyNumber += 1;
      staging.textContent = copyNumber === 1 ? 'first copy' : 'second copy';
    });
    const dispatch = () => {
      const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
      Object.defineProperty(event, 'clipboardData', {
        value: { get types() { return []; }, clearData() {}, setData() {}, getData() { return ''; } }
      });
      target.dispatchEvent(event);
    };
    dispatch();
    dispatch();
    await new Promise((resolve) => instance.window.setTimeout(resolve, 10));
    assert.deepEqual(recovered, ['second copy']);
  } finally {
    if (previous === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previous;
  }
});

test('a manual copy cancels an older Word staging recovery before it can overwrite the clipboard', async () => {
  const instance = dom([
    '<div id="WACViewPanel_EditingElement" contenteditable="true">\u00a0</div>',
    '<div id="WACViewPanel_ClipboardElement"></div>',
    '<p id="manual">newer manual copy</p>'
  ].join(''), 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const officeTarget = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  const staging = instance.window.document.querySelector('#WACViewPanel_ClipboardElement');
  const manualTarget = instance.window.document.querySelector('#manual');
  selectContents(instance.window, officeTarget);
  const commands = new Map();
  const recovered = [];
  const previousRegister = global.GM_registerMenuCommand;
  const previousSetClipboard = global.GM_setClipboard;
  global.GM_registerMenuCommand = (name, callback) => commands.set(name, callback);
  global.GM_setClipboard = (value) => { recovered.push(value); };
  try {
    cleanCopy.install(instance.window.document, instance.window);
    officeTarget.addEventListener('copy', () => {
      staging.textContent = 'older staged copy';
    });
    const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { get types() { return []; }, clearData() {}, setData() {}, getData() { return ''; } }
    });
    officeTarget.dispatchEvent(event);

    selectContents(instance.window, manualTarget);
    const command = commands.get('Clean Math Copy: copy current selection now');
    assert.equal(await command(), true);
    await new Promise((resolve) => instance.window.setTimeout(resolve, 10));
    assert.deepEqual(recovered, ['newer manual copy']);
  } finally {
    if (previousRegister === undefined) delete global.GM_registerMenuCommand;
    else global.GM_registerMenuCommand = previousRegister;
    if (previousSetClipboard === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previousSetClipboard;
  }
});

test('installed capture handler wins over later site handlers only when rewriting is needed', () => {
  const instance = dom('<p id="target">Math: ' + katex('<mrow><mi>x</mi><mo>=</mo><mn>2</mn></mrow>', 'x=2') + '</p>');
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  let siteHandlerCalled = false;
  instance.window.document.addEventListener('copy', () => { siteHandlerCalled = true; });
  const clipboard = new Map();
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      clearData() { clipboard.clear(); },
      setData(type, value) { clipboard.set(type, value); },
      getData(type) { return clipboard.get(type) || ''; }
    }
  });
  target.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(siteHandlerCalled, false);
  assert.equal(clipboard.get('text/plain'), 'Math: x=2');
  assert.match(clipboard.get('text/html'), /role="math"/);
});

test('installed handler leaves ordinary copy events and site behavior untouched', () => {
  const instance = dom('<p id="target">Ordinary 👩‍💻 text.</p>');
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  let siteHandlerCalled = false;
  instance.window.document.addEventListener('copy', () => { siteHandlerCalled = true; });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { clearData() {}, setData() { throw new Error('must not rewrite'); } }
  });
  target.dispatchEvent(event);
  assert.equal(siteHandlerCalled, true);
  assert.equal(event.defaultPrevented, false);
});

test('manual copy command preserves plain, rich HTML, and MathML clipboard representations', async () => {
  const instance = dom('<div id="target">' + katex(
    '<mfrac><mn>1</mn><msqrt><mi>x</mi></msqrt></mfrac>',
    String.raw`\frac{1}{\sqrt{x}}`
  ) + '</div>');
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  const commands = new Map();
  let writtenItem = null;
  let plainFallbackCalls = 0;
  class FakeClipboardItem {
    constructor(representations) { this.representations = representations; }
  }
  Object.defineProperty(instance.window, 'Blob', { configurable: true, value: Blob });
  Object.defineProperty(instance.window, 'ClipboardItem', { configurable: true, value: FakeClipboardItem });
  Object.defineProperty(instance.window.navigator, 'clipboard', {
    configurable: true,
    value: { write(items) { writtenItem = items[0]; return Promise.resolve(); } }
  });
  const previousRegister = global.GM_registerMenuCommand;
  const previousSetClipboard = global.GM_setClipboard;
  global.GM_registerMenuCommand = (name, callback) => commands.set(name, callback);
  global.GM_setClipboard = () => { plainFallbackCalls += 1; };
  try {
    cleanCopy.install(instance.window.document, instance.window);
    const command = commands.get('Clean Math Copy: copy current selection now');
    assert.equal(typeof command, 'function');
    assert.equal(await command(), true);
    assert.ok(writtenItem);
    assert.deepEqual(
      Object.keys(writtenItem.representations).sort(),
      ['application/mathml+xml', 'text/html', 'text/plain']
    );
    assert.equal(await writtenItem.representations['text/plain'].text(), '(1/sqrt(x))');
    assert.match(await writtenItem.representations['text/html'].text(), /border-top:1px solid currentColor/);
    assert.match(await writtenItem.representations['application/mathml+xml'].text(), /^<math/);
    assert.equal(plainFallbackCalls, 0);
  } finally {
    if (previousRegister === undefined) delete global.GM_registerMenuCommand;
    else global.GM_registerMenuCommand = previousRegister;
    if (previousSetClipboard === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previousSetClipboard;
  }
});

test('manual copy retries plain plus rich HTML when a browser rejects custom MathML', async () => {
  const instance = dom('<div id="target">' + katex(
    '<msqrt><mi>x</mi></msqrt>',
    String.raw`\sqrt{x}`
  ) + '</div>');
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  const commands = new Map();
  const constructorAttempts = [];
  let writtenItem = null;
  let plainFallbackCalls = 0;
  class RejectCustomMathMLItem {
    constructor(representations) {
      constructorAttempts.push(Object.keys(representations).sort());
      if (representations['application/mathml+xml']) throw new TypeError('custom format rejected');
      this.representations = representations;
    }
  }
  Object.defineProperty(instance.window, 'Blob', { configurable: true, value: Blob });
  Object.defineProperty(instance.window, 'ClipboardItem', { configurable: true, value: RejectCustomMathMLItem });
  Object.defineProperty(instance.window.navigator, 'clipboard', {
    configurable: true,
    value: { write(items) { writtenItem = items[0]; return Promise.resolve(); } }
  });
  const previousRegister = global.GM_registerMenuCommand;
  const previousSetClipboard = global.GM_setClipboard;
  global.GM_registerMenuCommand = (name, callback) => commands.set(name, callback);
  global.GM_setClipboard = () => { plainFallbackCalls += 1; };
  try {
    cleanCopy.install(instance.window.document, instance.window);
    assert.equal(await commands.get('Clean Math Copy: copy current selection now')(), true);
    assert.equal(constructorAttempts.length, 2);
    assert.deepEqual(Object.keys(writtenItem.representations).sort(), ['text/html', 'text/plain']);
    assert.match(await writtenItem.representations['text/html'].text(), /role="math"/);
    assert.equal(plainFallbackCalls, 0);
  } finally {
    if (previousRegister === undefined) delete global.GM_registerMenuCommand;
    else global.GM_registerMenuCommand = previousRegister;
    if (previousSetClipboard === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previousSetClipboard;
  }
});

test('a stale manual clipboard rejection cannot retry over a newer manual copy', async () => {
  const instance = dom([
    '<div id="first">', katex('<mi>x</mi>', 'x'), '</div>',
    '<div id="second">', katex('<mi>y</mi>', 'y'), '</div>'
  ].join(''));
  const firstTarget = instance.window.document.querySelector('#first');
  const secondTarget = instance.window.document.querySelector('#second');
  selectContents(instance.window, firstTarget);
  const commands = new Map();
  const attempts = [];
  let rejectFirst = null;
  let plainFallbackCalls = 0;
  class FakeClipboardItem {
    constructor(representations) { this.representations = representations; }
  }
  Object.defineProperty(instance.window, 'Blob', { configurable: true, value: Blob });
  Object.defineProperty(instance.window, 'ClipboardItem', { configurable: true, value: FakeClipboardItem });
  Object.defineProperty(instance.window.navigator, 'clipboard', {
    configurable: true,
    value: {
      write(items) {
        attempts.push(items[0]);
        if (attempts.length === 1) {
          return new Promise((_resolve, reject) => { rejectFirst = reject; });
        }
        return Promise.resolve();
      }
    }
  });
  const previousRegister = global.GM_registerMenuCommand;
  const previousSetClipboard = global.GM_setClipboard;
  global.GM_registerMenuCommand = (name, callback) => commands.set(name, callback);
  global.GM_setClipboard = () => { plainFallbackCalls += 1; };
  try {
    cleanCopy.install(instance.window.document, instance.window);
    const command = commands.get('Clean Math Copy: copy current selection now');
    const older = command();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(typeof rejectFirst, 'function');

    selectContents(instance.window, secondTarget);
    assert.equal(await command(), true);
    rejectFirst(new DOMException('custom representation rejected', 'NotSupportedError'));
    assert.equal(await older, false);
    assert.equal(attempts.length, 2);
    assert.equal(await attempts[0].representations['text/plain'].text(), 'x');
    assert.equal(await attempts[1].representations['text/plain'].text(), 'y');
    assert.equal(plainFallbackCalls, 0);
  } finally {
    if (previousRegister === undefined) delete global.GM_registerMenuCommand;
    else global.GM_registerMenuCommand = previousRegister;
    if (previousSetClipboard === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previousSetClipboard;
  }
});

test('a keyboard copy invalidates an older manual clipboard retry', async () => {
  const instance = dom([
    '<div id="first">', katex('<mi>x</mi>', 'x'), '</div>',
    '<div id="second">', katex('<mi>y</mi>', 'y'), '</div>'
  ].join(''));
  const firstTarget = instance.window.document.querySelector('#first');
  const secondTarget = instance.window.document.querySelector('#second');
  selectContents(instance.window, firstTarget);
  const commands = new Map();
  const attempts = [];
  let rejectFirst = null;
  let plainFallbackCalls = 0;
  class FakeClipboardItem {
    constructor(representations) { this.representations = representations; }
  }
  Object.defineProperty(instance.window, 'Blob', { configurable: true, value: Blob });
  Object.defineProperty(instance.window, 'ClipboardItem', { configurable: true, value: FakeClipboardItem });
  Object.defineProperty(instance.window.navigator, 'clipboard', {
    configurable: true,
    value: {
      write(items) {
        attempts.push(items[0]);
        return new Promise((_resolve, reject) => { rejectFirst = reject; });
      }
    }
  });
  const previousRegister = global.GM_registerMenuCommand;
  const previousSetClipboard = global.GM_setClipboard;
  global.GM_registerMenuCommand = (name, callback) => commands.set(name, callback);
  global.GM_setClipboard = () => { plainFallbackCalls += 1; };
  try {
    cleanCopy.install(instance.window.document, instance.window);
    const older = commands.get('Clean Math Copy: copy current selection now')();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(typeof rejectFirst, 'function');

    selectContents(instance.window, secondTarget);
    const copied = new Map();
    const keyboardEvent = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
    Object.defineProperty(keyboardEvent, 'clipboardData', {
      value: {
        clearData() { copied.clear(); },
        setData(type, value) { copied.set(type, value); },
        getData(type) { return copied.get(type) || ''; }
      }
    });
    secondTarget.dispatchEvent(keyboardEvent);
    assert.equal(copied.get('text/plain'), 'y');

    rejectFirst(new DOMException('custom representation rejected', 'NotSupportedError'));
    assert.equal(await older, false);
    assert.equal(attempts.length, 1);
    assert.equal(plainFallbackCalls, 0);
  } finally {
    if (previousRegister === undefined) delete global.GM_registerMenuCommand;
    else global.GM_registerMenuCommand = previousRegister;
    if (previousSetClipboard === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previousSetClipboard;
  }
});

test('manual copy command still uses the plain fallback for ordinary text', async () => {
  const instance = dom('<p id="target">Ordinary text</p>');
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  const commands = new Map();
  const copied = [];
  const previousRegister = global.GM_registerMenuCommand;
  const previousSetClipboard = global.GM_setClipboard;
  global.GM_registerMenuCommand = (name, callback) => commands.set(name, callback);
  global.GM_setClipboard = (text) => copied.push(text);
  try {
    cleanCopy.install(instance.window.document, instance.window);
    assert.equal(await commands.get('Clean Math Copy: copy current selection now')(), true);
    assert.deepEqual(copied, ['Ordinary text']);
  } finally {
    if (previousRegister === undefined) delete global.GM_registerMenuCommand;
    else global.GM_registerMenuCommand = previousRegister;
    if (previousSetClipboard === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previousSetClipboard;
  }
});

test('rewrites invisible artifacts without touching emoji joiners', () => {
  const instance = dom('<p id="target">A\u00a0B\u200bC 👩‍💻</p>');
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    {},
    instance.window,
    target
  );
  assert.equal(payload.reason, 'invisible-artifacts');
  assert.equal(payload.text, 'A BC 👩‍💻');
});
