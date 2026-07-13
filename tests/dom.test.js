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

function wikipediaMath(markup, source, display = false) {
  return [
    '<span class="mwe-math-element mwe-math-element-', display ? 'block' : 'inline', '">',
    '<span class="mwe-math-mathml-', display ? 'display' : 'inline', ' mwe-math-mathml-a11y" style="display:none">',
    '<math', display ? ' display="block"' : '', '><semantics>', markup,
    '<annotation encoding="application/x-tex">{\\displaystyle ', source, '}</annotation>',
    '</semantics></math></span>',
    '<img class="mwe-math-fallback-image-', display ? 'display' : 'inline', '" aria-hidden="true" ',
    'alt="{\\displaystyle ', source, '}">',
    '</span>'
  ].join('');
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

function googleDocsSlice(parts, textStyles = []) {
  let spacers = '';
  const equationStyles = [];
  const writeNode = (node) => {
    if (typeof node === 'string') {
      spacers += node;
      return;
    }
    if (node && Array.isArray(node.equation)) {
      spacers += '\u001a';
      node.equation.forEach(writeNode);
      spacers += '\u001e';
      return;
    }
    if (!node || typeof node.command !== 'string') throw new Error('invalid Google Docs test node');
    const hasArguments = Array.isArray(node.args);
    const marker = hasArguments ? '\u0019' : '\u001f';
    const index = spacers.length;
    spacers += marker;
    equationStyles[index] = { eqfs_c: node.command };
    if (!hasArguments) return;
    node.args.forEach((argument, argumentIndex) => {
      if (argumentIndex) spacers += '\u001d';
      (Array.isArray(argument) ? argument : [argument]).forEach(writeNode);
    });
    spacers += '\u001b';
  };
  parts.forEach(writeNode);
  const styles = [];
  for (const [index, alignment] of textStyles) styles[index] = { ts_va: alignment };
  const data = {
    resolved: {
      dsl_spacers: spacers,
      dsl_styleslices: [
        { stsl_type: 'equation_function', stsl_styles: equationStyles },
        { stsl_type: 'text', stsl_styles: styles }
      ]
    }
  };
  return JSON.stringify({ data: JSON.stringify(data) });
}

function reportedGoogleDocsEquationSlice() {
  const power = (base) => ({ command: '\\superscript', args: [base, '2'] });
  return googleDocsSlice([{
    equation: [
      { command: '\\abs', args: ['B'] },
      '=',
      { command: '\\sqrt', args: [[
        power('(27.187)'), '+', power('(17.479)'), '+', power('(-28.112)')
      ]] },
      '=42.84 ', { command: '\\mu' }, 'T'
    ]
  }]);
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
  assert.equal(payload.text, 'r ∝ √(m/|q|)');
  assert.equal(/[\s\u200b\u2060]$/.test(payload.text), false);
  assert.match(payload.html, /border-top:1px solid currentColor/);
  assert.match(payload.mathML, /^<math/);
});

test('regression: preserves nested fraction/root order in faithful and calculator modes', () => {
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
  const faithfulPayload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, visual),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    visual
  );
  assert.equal(
    faithfulPayload.text,
    'r = (1/0.452)√(2(0.666 × 10⁻²⁵)(2464)/(1.602 × 10⁻¹⁹))'
  );
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, visual),
    { ...cleanCopy.DEFAULT_SETTINGS, outputMode: 'calculator' },
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

test('an exact direct MathML token selection never widens to its flat math root', () => {
  const instance = dom('<math id="formula">' + '<mi>x</mi>'.repeat(100) + '</math>');
  const tokens = instance.window.document.querySelectorAll('#formula > mi');
  const selected = tokens[57];
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, selected),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    selected
  );
  assert.equal(payload.text, 'x');
  assert.doesNotMatch(payload.mathML, /<mi>x<\/mi><mi>x<\/mi>/);
});

test('repeated-token partial matching uses the visual offset with bounded cloning', () => {
  for (const tokenCount of [500, 1000, 2000]) {
    const mathML = '<mrow>' + '<mi>x</mi>'.repeat(tokenCount) + '</mrow>';
    const visual = '<span>x</span>'.repeat(tokenCount);
    const instance = dom([
      '<span class="katex">',
      '<span class="katex-mathml"><math><semantics>', mathML,
      '<annotation encoding="application/x-tex">x</annotation>',
      '</semantics></math></span>',
      '<span class="katex-html" aria-hidden="true">', visual, '</span>',
      '</span>'
    ].join(''));
    const tokens = instance.window.document.querySelectorAll('.katex-html > span');
    const selected = tokens[Math.floor(tokenCount * 0.75)];
    const originalClone = instance.window.Node.prototype.cloneNode;
    let cloneCalls = 0;
    instance.window.Node.prototype.cloneNode = function countedClone(...args) {
      cloneCalls += 1;
      return originalClone.apply(this, args);
    };
    try {
      const payload = cleanCopy.getCopyPayload(
        instance.window.document,
        selectContents(instance.window, selected),
        cleanCopy.DEFAULT_SETTINGS,
        instance.window,
        selected
      );
      if (tokenCount > 1000) assert.equal(payload, null, String(tokenCount));
      else assert.equal(payload.text, 'x', String(tokenCount));
      assert.ok(cloneCalls < 12, tokenCount + ' repeated tokens used ' + cloneCalls + ' clones');
    } finally {
      instance.window.Node.prototype.cloneNode = originalClone;
    }
  }
});

test('math-root discovery is linear-ish, reused once, and safely budgets document-wide selections', () => {
  const instance = dom('<div id="target">' +
    '<span role="math"><math><mi>x</mi></math></span>'.repeat(120) + '</div>');
  const target = instance.window.document.querySelector('#target');
  const range = instance.window.document.createRange();
  range.selectNodeContents(target);
  const originalContains = instance.window.Node.prototype.contains;
  const originalQuery = instance.window.Element.prototype.querySelector;
  let containsCalls = 0;
  let sharedAccessibilityScans = 0;
  instance.window.Node.prototype.contains = function countedContains(...args) {
    containsCalls += 1;
    return originalContains.apply(this, args);
  };
  instance.window.Element.prototype.querySelector = function countedQuery(selector) {
    if (this === target && selector === ':scope > [aria-hidden="true"]') {
      sharedAccessibilityScans += 1;
    }
    return originalQuery.call(this, selector);
  };
  try {
    assert.equal(cleanCopy.rootsForRange(range).length, 120);
    assert.ok(containsCalls < 2500, 'root discovery made ' + containsCalls + ' contains() calls');
    assert.equal(sharedAccessibilityScans, 1);
  } finally {
    instance.window.Node.prototype.contains = originalContains;
    instance.window.Element.prototype.querySelector = originalQuery;
  }

  const single = dom('<div id="target"><span role="math"><math><mi>x</mi></math></span></div>');
  const singleTarget = single.window.document.querySelector('#target');
  const originalQueryAll = single.window.Element.prototype.querySelectorAll;
  let connectedDiscoveryScans = 0;
  single.window.Element.prototype.querySelectorAll = function countedQueryAll(selector) {
    if (this.isConnected && String(selector).includes('[data-testid*="formula"]')) {
      connectedDiscoveryScans += 1;
    }
    return originalQueryAll.call(this, selector);
  };
  try {
    assert.equal(cleanCopy.getCopyPayload(
      single.window.document,
      selectContents(single.window, singleTarget),
      cleanCopy.DEFAULT_SETTINGS,
      single.window,
      singleTarget
    ).text, 'x');
    assert.equal(connectedDiscoveryScans, 1);
  } finally {
    single.window.Element.prototype.querySelectorAll = originalQueryAll;
  }

  const overBudget = dom('<div id="target">' +
    '<span role="math"><math><mi>x</mi></math></span>'.repeat(129) + '</div>');
  const overBudgetTarget = overBudget.window.document.querySelector('#target');
  assert.equal(cleanCopy.getCopyPayload(
    overBudget.window.document,
    selectContents(overBudget.window, overBudgetTarget),
    cleanCopy.DEFAULT_SETTINGS,
    overBudget.window,
    overBudgetTarget
  ), null);

  const acrossRanges = dom('<div id="first">' +
    '<span role="math"><math><mi>x</mi></math></span>'.repeat(65) +
    '</div><div id="second">' +
    '<span role="math"><math><mi>y</mi></math></span>'.repeat(65) + '</div>');
  const firstRange = acrossRanges.window.document.createRange();
  const secondRange = acrossRanges.window.document.createRange();
  firstRange.selectNodeContents(acrossRanges.window.document.querySelector('#first'));
  secondRange.selectNodeContents(acrossRanges.window.document.querySelector('#second'));
  let rangeReads = 0;
  assert.equal(cleanCopy.getCopyPayload(
    acrossRanges.window.document,
    {
      isCollapsed: false,
      rangeCount: 2,
      getRangeAt(index) {
        rangeReads += 1;
        return index === 0 ? firstRange : secondRange;
      }
    },
    cleanCopy.DEFAULT_SETTINGS,
    acrossRanges.window,
    acrossRanges.window.document.body
  ), null);
  assert.equal(rangeReads, 2);
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

test('faithful MathML preserves compound scope, text punctuation, accents, and parallel versus norm', () => {
  const render = (markup) => {
    const instance = dom('<math>' + markup + '</math>');
    return cleanCopy.mathMLToFaithful(instance.window.document.querySelector('math'));
  };
  assert.equal(render('<mfrac><mn>1</mn><mrow><mn>2</mn><mi>a</mi><mi>b</mi></mrow></mfrac>'), '1/(2ab)');
  assert.equal(render('<msup><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow><mn>2</mn></msup>'), '(a + b)²');
  assert.equal(render('<msup><mrow><mi>a</mi><mi>b</mi></mrow><mn>2</mn></msup>'), '(ab)²');
  assert.equal(render('<msup><mfrac><mi>a</mi><mi>b</mi></mfrac><mn>2</mn></msup>'), '(a/b)²');
  assert.equal(render('<msup><msqrt><mi>x</mi></msqrt><mn>2</mn></msup>'), '(√x)²');
  assert.equal(render('<msqrt><msup><mi>x</mi><mn>2</mn></msup></msqrt>'), '√(x²)');
  assert.equal(render('<msqrt><msup><mi>x</mi><mo>′</mo></msup></msqrt>'), '√(x′)');
  assert.equal(render('<msqrt><msub><mi>x</mi><mn>1</mn></msub></msqrt>'), '√x₁');
  assert.equal(render('<mrow><msqrt><mi>x</mi></msqrt><mi>y</mi></mrow>'), '√(x)y');
  assert.equal(render('<mfrac><mn>1</mn><mrow><msqrt><mi>x</mi></msqrt><mi>y</mi></mrow></mfrac>'), '1/(√(x)y)');
  assert.equal(render('<mfrac><mrow><mi>sin</mi><mo>⁡</mo><mi>x</mi></mrow><mi>x</mi></mfrac>'), '(sin x)/x');
  assert.equal(render('<mrow><mi>sin</mi><mo>⁡</mo><mrow><mi>x</mi><mo>+</mo><mi>y</mi></mrow></mrow>'), 'sin(x + y)');
  assert.equal(render('<mrow><mi>sin</mi><mo>⁡</mo><mi>x</mi></mrow>'), 'sin x');
  assert.equal(render("<mtext>time-dependent; don&apos;t</mtext>"), "time-dependent; don't");
  assert.equal(render('<mrow><mi>a</mi><mo fence="false">∥</mo><mi>b</mi></mrow>'), 'a ∥ b');
  assert.equal(render('<mrow><mo fence="true">∥</mo><mi>x</mi><mo fence="true">∥</mo></mrow>'), '‖x‖');
  assert.equal(render('<mover><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow><mo>‾</mo></mover>'), 'overline(a + b)');
  assert.equal(render('<mover><mrow><mi>x</mi><mi>y</mi></mrow><mo>^</mo></mover>'), 'hat(xy)');
});

test('faithful MathML preserves explicit alphabets while leaving unstyled identifiers plain', () => {
  const render = (markup) => {
    const instance = dom('<math>' + markup + '</math>');
    return cleanCopy.mathMLToFaithful(instance.window.document.querySelector('math'));
  };
  assert.equal(render('<mi>x</mi>'), 'x');
  assert.equal(render('<mi mathvariant="normal">x</mi>'), 'x');
  assert.equal(render('<mi mathvariant="normal">ϰ</mi>'), 'ϰ');
  assert.equal(render('<mi mathvariant="bold">x</mi>'), '𝐱');
  assert.equal(render('<mi mathvariant="bold-italic">α</mi>'), '𝜶');
  assert.equal(render('<mi mathvariant="script">B</mi>'), 'ℬ');
  assert.equal(render('<mi mathvariant="fraktur">C</mi>'), 'ℭ');
  assert.equal(render('<mi mathvariant="sans-serif">x</mi>'), '𝗑');
  assert.equal(render('<mi mathvariant="monospace">x</mi>'), '𝚡');
  assert.equal(render('<mi mathvariant="double-struck">R</mi>'), 'ℝ');
  assert.equal(render('<mi mathvariant="script">α</mi>'), 'script(α)');
  assert.equal(render('<mstyle mathvariant="bold"><mi>x</mi><mi>α</mi></mstyle>'), '𝐱𝛂');
  assert.equal(render('<mstyle mathvariant="bold"><mi>x</mi><mo>+</mo><mn>1</mn></mstyle>'), '𝐱 + 𝟏');
});

test('faithful MathML retains enclosures and orders pre- and post-scripts correctly', () => {
  const render = (markup) => {
    const instance = dom('<math>' + markup + '</math>');
    return cleanCopy.mathMLToFaithful(instance.window.document.querySelector('math'));
  };
  assert.equal(render('<menclose notation="updiagonalstrike"><mi>x</mi></menclose>'), 'cancel(x)');
  assert.equal(render('<menclose notation="downdiagonalstrike"><mi>x</mi></menclose>'), 'bcancel(x)');
  assert.equal(render('<menclose notation="updiagonalstrike downdiagonalstrike"><mi>x</mi></menclose>'), 'xcancel(x)');
  assert.equal(render('<menclose notation="box"><mi>x</mi></menclose>'), 'boxed(x)');
  assert.equal(render('<menclose notation="box updiagonalstrike"><mi>x</mi></menclose>'), 'boxed(cancel(x))');
  assert.equal(render('<menclose notation="circle"><mi>x</mi></menclose>'), 'enclose(circle, x)');
  assert.equal(
    render('<mmultiscripts><mi>C</mi><mn>2</mn><mn>3</mn><mprescripts></mprescripts><mn>6</mn><mn>14</mn></mmultiscripts>'),
    '¹⁴₆C₂³'
  );
  assert.equal(render('<msubsup><mrow></mrow><mn>6</mn><mn>14</mn></msubsup><mi>C</mi>'), '¹⁴₆C');
  assert.equal(render('<mover accent="false"><mo>=</mo><mo>!</mo></mover>'), 'overset(!, =)');
  assert.equal(render('<munder><mi>x</mi><mi>i</mi></munder>'), 'underset(i, x)');
  assert.equal(
    render('<munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover>'),
    '∑ᵢ₌₁ⁿ'
  );
});

test('faithful MathML distinguishes binomial and generic zero-line stacks from fractions', () => {
  const render = (markup) => {
    const instance = dom('<math>' + markup + '</math>');
    return cleanCopy.mathMLToFaithful(instance.window.document.querySelector('math'));
  };
  assert.equal(
    render('<mrow><mo>(</mo><mfrac linethickness="0"><mi>n</mi><mi>k</mi></mfrac><mo>)</mo></mrow>'),
    'C(n, k)'
  );
  assert.equal(render('<mfrac linethickness="0px"><mi>n</mi><mi>k</mi></mfrac>'), 'stack(n, k)');
  assert.equal(
    render('<mrow><mo>[</mo><mfrac linethickness="0.0em"><mi>n</mi><mi>k</mi></mfrac><mo>]</mo></mrow>'),
    '[stack(n, k)]'
  );
});

test('faithful MathML recognizes real renderer accent glyphs', () => {
  const render = (markup) => {
    const instance = dom('<math>' + markup + '</math>');
    return cleanCopy.mathMLToFaithful(instance.window.document.querySelector('math'));
  };
  assert.equal(render('<mover accent="true"><mi>v</mi><mo>⃗</mo></mover>'), 'v⃗');
  assert.equal(render('<mover accent="true"><mi>x</mi><mo>ˉ</mo></mover>'), 'x̅');
  assert.equal(render('<mover accent="true"><mi>x</mi><mo>ˊ</mo></mover>'), 'x́');
  assert.equal(render('<mover accent="true"><mi>x</mi><mo>ˋ</mo></mover>'), 'x̀');
  assert.equal(render('<mover accent="true"><mi>x</mi><mo>˘</mo></mover>'), 'x̆');
  assert.equal(render('<mover accent="true"><mi>x</mi><mo>ˇ</mo></mover>'), 'x̌');
  assert.equal(render('<mover accent="true"><mi>x</mi><mo>˚</mo></mover>'), 'x̊');
  assert.equal(render('<munder accentunder="true"><mi>x</mi><mo>‾</mo></munder>'), 'x̲');
  assert.equal(render('<mover><mi>x</mi><mo>⏞</mo></mover>'), 'overset(⏞, x)');
  assert.equal(render('<munder><mi>x</mi><mo>⏟</mo></munder>'), 'underset(⏟, x)');
});

test('faithful MathML linearizes alignment tables as equation rows, not matrices', () => {
  const render = (markup) => {
    const instance = dom('<math>' + markup + '</math>');
    return cleanCopy.mathMLToFaithful(instance.window.document.querySelector('math'));
  };
  const alignedRows = [
    '<mtr><mtd><mi>x</mi></mtd><mtd><mo>=</mo><mn>1</mn></mtd></mtr>',
    '<mtr><mtd><mi>y</mi></mtd><mtd><mo>=</mo><mn>2</mn></mtd></mtr>'
  ].join('');
  assert.equal(
    render('<mtable columnalign="right left" columnspacing="0em">' + alignedRows + '</mtable>'),
    'x = 1; y = 2'
  );
  const gatheredRows = [
    '<mtr><mtd><mi>x</mi><mo>=</mo><mn>1</mn></mtd></mtr>',
    '<mtr><mtd><mi>y</mi><mo>=</mo><mn>2</mn></mtd></mtr>'
  ].join('');
  assert.equal(
    render('<mtable columnalign="center" columnspacing="0em">' + gatheredRows + '</mtable>'),
    'x = 1; y = 2'
  );
  assert.equal(
    render('<mtable columnalign="center center" columnspacing="1em">' + alignedRows + '</mtable>'),
    '[x, = 1; y, = 2]'
  );
});

test('faithful MathML spaces annotated relation wrappers between operands', () => {
  const instance = dom(
    '<math><mrow><mi>A</mi><mover accent="false"><mrow><mo>⟶</mo></mrow><mi>f</mi></mover><mi>B</mi></mrow></math>'
  );
  assert.equal(
    cleanCopy.mathMLToFaithful(instance.window.document.querySelector('math')),
    'A overset(f, ⟶) B'
  );
});

test('faithful whole-math copy trusts sanitized rendering over a divergent TeX annotation', () => {
  const instance = dom([
    '<span id="root" class="katex"><span class="katex-mathml"><math><semantics>',
    '<mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">y</annotation>',
    '</semantics></math></span><span class="katex-html" aria-hidden="true">x</span></span>'
  ].join(''));
  const visual = instance.window.document.querySelector('.katex-html');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, visual),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    visual
  );
  assert.equal(payload.text, 'x');
});

test('whole-math copy declines stale hidden semantics that disagree with the visible formula', () => {
  const instance = dom([
    '<span class="katex"><span class="katex-mathml"><math><semantics>',
    '<mi>x</mi><annotation encoding="application/x-tex">x</annotation>',
    '</semantics></math></span><span class="katex-html" aria-hidden="true">y</span></span>'
  ].join(''));
  const visual = instance.window.document.querySelector('.katex-html');
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, visual),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    visual
  ), null);
});

test('faithful whole-math copy preserves rendered grouping against contradictory annotations', () => {
  const copy = (presentation, annotation, visualText = 'abc') => {
    const instance = dom([
      '<span class="katex"><span class="katex-mathml"><math><semantics>',
      presentation,
      '<annotation encoding="application/x-tex">', annotation, '</annotation>',
      '</semantics></math></span><span class="katex-html" aria-hidden="true">', visualText, '</span></span>'
    ].join(''));
    const visual = instance.window.document.querySelector('.katex-html');
    return cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, visual),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      visual
    ).text;
  };
  assert.equal(
    copy(
      '<mrow><mrow><mfrac><mi>a</mi><mi>b</mi></mfrac></mrow><mi>c</mi></mrow>',
      String.raw`\frac{a}{bc}`
    ),
    '(a/b)c'
  );
  assert.equal(
    copy(
      '<mfrac><mi>a</mi><mrow><mi>b</mi><mi>c</mi></mrow></mfrac>',
      String.raw`\frac ab c`
    ),
    'a/(bc)'
  );
  assert.equal(
    copy('<msqrt><mrow><mi>x</mi><mi>y</mi></mrow></msqrt>', String.raw`\sqrt{x}y`, '√xy'),
    '√(xy)'
  );
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
  assert.equal(sumPayload.text, 'x + 1');
  assert.match(sumPayload.html, />x \+ 1</);
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, power),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    power
  ).text, 'x²');
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

test('oversized hidden LaTeX metadata falls back to bounded visible text', () => {
  const instance = dom('<span id="target" role="math">x</span>');
  const target = instance.window.document.querySelector('#target');
  target.setAttribute('data-latex', String.raw`\text{` + 'z'.repeat(50001) + '}');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(payload.text, 'x');
  assert.equal(payload.reason, 'rendered-math');
  assert.doesNotMatch(payload.text, /z|\\text/u);
  assert.equal(cleanCopy.extractMathText(target, 'faithful', instance.window), 'x');
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
  // MathJax's SVG surface can flatten script geometry, but its visible token
  // anchors must still agree with the MathItem source before source metadata
  // is allowed to replace the selection.
  const instance = dom('<p id="target">Result: <mjx-container><svg><text>∫01x2dx</text></svg></mjx-container></p>');
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

test('source-only MathJax rewrites exact visual drags but never widens a partial', () => {
  const instance = dom('<mjx-container id="math"><svg><text>∫01x2dx</text></svg></mjx-container>');
  const root = instance.window.document.querySelector('#math');
  const svg = root.querySelector('svg');
  const textElement = root.querySelector('text');
  const textNode = textElement.firstChild;
  const pageWindow = {
    MathJax: {
      startup: {
        document: {
          getMathItemsWithin(candidate) {
            return candidate === root ? [{ math: String.raw`\int_0^1 x^2\,dx` }] : [];
          }
        }
      }
    }
  };
  const copyRange = (range) => {
    const selection = instance.window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return cleanCopy.getCopyPayload(
      instance.window.document,
      selection,
      { outputMode: 'unicode' },
      pageWindow,
      textElement
    );
  };
  for (const element of [root, svg, textElement]) {
    const range = instance.window.document.createRange();
    range.selectNodeContents(element);
    assert.equal(copyRange(range).text, '∫₀¹ x² dx');
  }
  const completeText = instance.window.document.createRange();
  completeText.setStart(textNode, 0);
  completeText.setEnd(textNode, textNode.nodeValue.length);
  assert.equal(copyRange(completeText).text, '∫₀¹ x² dx');

  const partial = instance.window.document.createRange();
  partial.setStart(textNode, 0);
  partial.setEnd(textNode, 3);
  assert.equal(copyRange(partial), null);
});

test('source-only math metadata must agree with visible anchors in surrounding prose', () => {
  const copy = (source, visible) => {
    const instance = dom('<p id="target">before <span data-latex="' +
      source.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '">' + visible + '</span> after</p>');
    const target = instance.window.document.querySelector('#target');
    return cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      target
    );
  };
  assert.equal(copy('y', 'x'), null);
  assert.equal(copy(String.raw`\foo+1`, 'x² + 1'), null);
  assert.equal(copy('x+y', 'x−y'), null);
  assert.equal(copy('a=b', 'a≠b'), null);
  assert.equal(copy(String.raw`a\times b`, 'a÷b'), null);
  assert.equal(copy(String.raw`\frac{a}{b}`, 'ba').text, 'before a/b after');
  assert.equal(copy(String.raw`\sqrt{x}`, 'x').text, 'before √x after');
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

test('ordinary prose collapses accidental source wraps and repeated spacing without math false positives', () => {
  const instance = dom('<p id="target" class="formula">Keep  spacing,\nemoji 👨‍👩‍👧‍👦, and symbols ≤ exactly.</p>');
  const target = instance.window.document.querySelector('#target');
  const selection = selectContents(instance.window, target);
  const payload = cleanCopy.getCopyPayload(instance.window.document, selection, {}, instance.window, target);
  assert.equal(payload.reason, 'ordinary-text-cleanup');
  assert.equal(payload.text, 'Keep spacing, emoji 👨‍👩‍👧‍👦, and symbols ≤ exactly.');
  assert.equal(payload.html, '<!--StartFragment--><p>Keep spacing, emoji 👨‍👩‍👧‍👦, and symbols ≤ exactly.</p><!--EndFragment-->');
});

test('cleans hard-wrapped inline prose across uneven spans while preserving complex Unicode', () => {
  const instance = dom([
    '<p id="target"><span>This   is </span><span>a\nsoft</span> ',
    '<span> wrapped</span> paragraph in שלום with e\u0301 and 👩‍💻.</p>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.ordinarySelectionPayload(
    instance.window.document,
    selectContents(instance.window, target),
    instance.window,
    target
  );
  assert.equal(payload.text, 'This is a soft wrapped paragraph in שלום with e\u0301 and 👩‍💻.');
  assert.match(payload.html, /<span>This is <\/span><span>a soft<\/span> <span>wrapped<\/span>/);
  assert.match(payload.html, /שלום with e\u0301 and 👩‍💻/);
});

test('preserves intentional paragraphs, breaks, headings, lists, tables, and preformatted islands', () => {
  const instance = dom([
    '<div id="target">',
    '<p>First paragraph.</p>',
    '<p>Second<br>line.<br><br>Still the same paragraph.</p>',
    '<h2>Heading</h2>',
    '<ul><li>Alpha</li><li>Beta<ul><li>Nested</li></ul></li></ul>',
    '<ol start="3"><li>Third</li><li value="7">Seventh</li></ol>',
    '<ol reversed type="A"><li>Top</li><li>Bottom</li></ol>',
    '<table><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>',
    '<pre>  keep\n    indentation</pre>',
    '<code>x  y</code>',
    '</div>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    {},
    instance.window,
    target
  );
  assert.equal(payload.text, [
    'First paragraph.',
    '',
    'Second',
    'line.',
    '',
    'Still the same paragraph.',
    '',
    'Heading',
    '',
    '• Alpha',
    '• Beta',
    '  • Nested',
    '3. Third',
    '7. Seventh',
    'B. Top',
    'A. Bottom',
    'A\tB',
    '1\t2',
    '  keep',
    '    indentation',
    'x  y'
  ].join('\n'));
  assert.match(payload.html, /<p>Second<br>line\.<br><br>Still the same paragraph\.<\/p>/);
  assert.match(payload.html, /<ol start="3"><li>Third<\/li><li value="7">Seventh<\/li><\/ol>/);
  assert.match(payload.html, /<table><tbody><tr><th>A<\/th><th>B<\/th><\/tr>/);
  assert.match(payload.html, /<pre>  keep\n    indentation<\/pre><code>x  y<\/code>/);
});

test('honors explicit pre-line whitespace without flattening its real newlines', () => {
  const instance = dom('<div id="target"><span style="white-space:pre-line">a  b\nc   d</span></div>');
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    {},
    instance.window,
    target
  );
  assert.equal(payload.text, 'a b\nc d');
  assert.match(payload.html, /style="white-space:pre-line;">a b\nc d<\/span>/);
});

test('defers to native copy when computed CSS makes whitespace or layout significant', () => {
  const instance = dom([
    '<style>.poem{white-space:pre-wrap}.inline-paragraph{display:inline}</style>',
    '<div id="poem" class="poem">first  line\n  indented second</div>',
    '<p id="inline" class="inline-paragraph">first   second</p>'
  ].join(''));
  for (const id of ['poem', 'inline']) {
    const target = instance.window.document.querySelector('#' + id);
    assert.equal(
      cleanCopy.ordinarySelectionPayload(
        instance.window.document,
        selectContents(instance.window, target),
        instance.window,
        target
      ),
      null,
      id
    );
  }
});

test('generic react-pdf pages still receive ordinary cleanup without Word clipboard recovery', () => {
  const instance = dom(
    '<div class="react-pdf__Page__textContent textLayer"><p id="target">ordinary   wrapped\ntext</p></div>',
    'https://example.com/document.pdf'
  );
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(payload.reason, 'ordinary-text-cleanup');
  assert.equal(payload.text, 'ordinary wrapped text');
});

test('declines oversized positioned text layers before geometry or quadratic association work', () => {
  const tokens = Array.from({ length: 600 }, (_value, index) =>
    positionedWordToken(index * 7, 10, 11, 'a')).join('');
  const instance = dom(
    '<div id="target" class="react-pdf__Page__textContent textLayer"><span class="markedContent">' +
    tokens + '</span></div>'
  );
  const target = instance.window.document.querySelector('#target');
  const originalRect = instance.window.Element.prototype.getBoundingClientRect;
  let geometryCalls = 0;
  instance.window.Element.prototype.getBoundingClientRect = function countedRect(...args) {
    geometryCalls += 1;
    return originalRect.apply(this, args);
  };
  try {
    assert.equal(cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      target
    ), null);
    assert.equal(geometryCalls, 0);
  } finally {
    instance.window.Element.prototype.getBoundingClientRect = originalRect;
  }
});

test('declines pathological multi-range selections before touching individual ranges', () => {
  const instance = dom('<p id="target">ordinary text</p>');
  const target = instance.window.document.querySelector('#target');
  let rangeReads = 0;
  const selection = {
    isCollapsed: false,
    rangeCount: 10000,
    getRangeAt() {
      rangeReads += 1;
      throw new Error('individual ranges must not be inspected');
    }
  };
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  ), null);
  assert.equal(rangeReads, 0);
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    {
      isCollapsed: false,
      get rangeCount() { throw new Error('hostile Selection-like getter'); }
    },
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  ), null);

  target.textContent = 'ordinary   text';
  const stableRange = instance.window.document.createRange();
  stableRange.selectNodeContents(target);
  let countReads = 0;
  const stableSelection = {
    isCollapsed: false,
    anchorNode: target.firstChild,
    focusNode: target.firstChild,
    get rangeCount() {
      countReads += 1;
      return countReads === 1 ? 1 : 10000;
    },
    getRangeAt() { return stableRange; }
  };
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    stableSelection,
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  ).text, 'ordinary text');
  assert.equal(countReads, 1);
});

test('joins multiple ordinary selection ranges predictably without merging their words', () => {
  const instance = dom('<p id="first">First   range</p><p id="second">Second\nrange</p>');
  const first = instance.window.document.querySelector('#first');
  const second = instance.window.document.querySelector('#second');
  const firstRange = instance.window.document.createRange();
  const secondRange = instance.window.document.createRange();
  firstRange.selectNodeContents(first);
  secondRange.selectNodeContents(second);
  const selection = {
    isCollapsed: false,
    rangeCount: 2,
    anchorNode: first.firstChild,
    focusNode: second.firstChild,
    getRangeAt(index) { return index === 0 ? firstRange : secondRange; }
  };
  const payload = cleanCopy.ordinarySelectionPayload(
    instance.window.document,
    selection,
    instance.window,
    first
  );
  assert.equal(payload.text, 'First range\nSecond range');
  assert.match(payload.html, /<p>First range<\/p><br><p>Second range<\/p>/);
});

test('mixed Firefox-style ranges decline instead of copying computed-hidden companion text', () => {
  const instance = dom([
    '<style>.hidden-companion { display:none }</style>',
    '<p id="math"><span role="math"><math><mi>x</mi></math></span></p>',
    '<p id="prose">A&nbsp;<span class="hidden-companion">SECRET</span>B</p>'
  ].join(''));
  const math = instance.window.document.querySelector('#math');
  const prose = instance.window.document.querySelector('#prose');
  const mathRange = instance.window.document.createRange();
  const proseRange = instance.window.document.createRange();
  mathRange.selectNodeContents(math);
  proseRange.selectNodeContents(prose);
  const selection = {
    isCollapsed: false,
    rangeCount: 2,
    anchorNode: math.firstChild,
    focusNode: prose.lastChild,
    getRangeAt(index) { return index === 0 ? mathRange : proseRange; }
  };
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    math
  ), null);
});

test('ordinary rich cleanup drops executable markup and untrusted attributes', () => {
  const instance = dom([
    '<div id="target">',
    '<svg onload="steal()"><text>SVG PAYLOAD</text></svg>',
    '<p onclick="steal()" style="background:url(javascript:steal())">Safe   words</p>',
    '<custom-widget onmouseover="steal()">kept   text</custom-widget>',
    '<iframe srcdoc="SCRIPT PAYLOAD">FRAME PAYLOAD</iframe>',
    '<span hidden>HIDDEN PAYLOAD</span>',
    '</div>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    {},
    instance.window,
    target
  );
  assert.equal(payload.text, 'Safe words\n\nkept text');
  assert.match(payload.html, /<p>Safe words<\/p>kept text/);
  assert.doesNotMatch(payload.html, /svg|iframe|onclick|onmouseover|javascript|style=|PAYLOAD|custom-widget/i);
});

test('image alt text cannot reintroduce invisible artifacts into rich clipboard HTML', () => {
  const leakedArtifact = /&(?:nbsp|shy);|[\u00a0\u00ad\u200b\u2060\ufeff]/iu;
  const alt = 'A\u00a0B\u200bC\u2060D\u00adE\ufeff';
  const ordinary = dom('<p id="target">Before\u200b <img alt="' + alt + '"> after</p>');
  const ordinaryTarget = ordinary.window.document.querySelector('#target');
  const ordinaryPayload = cleanCopy.getCopyPayload(
    ordinary.window.document,
    selectContents(ordinary.window, ordinaryTarget),
    cleanCopy.DEFAULT_SETTINGS,
    ordinary.window,
    ordinaryTarget
  );
  assert.equal(ordinaryPayload.text, 'Before A BCDE after');
  assert.doesNotMatch(ordinaryPayload.html, leakedArtifact);

  const mixed = dom('<p id="target"><img alt="' + alt + '"> ' +
    katex('<mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow>', 'x=1') + '</p>');
  const mixedTarget = mixed.window.document.querySelector('#target');
  const mixedPayload = cleanCopy.getCopyPayload(
    mixed.window.document,
    selectContents(mixed.window, mixedTarget),
    cleanCopy.DEFAULT_SETTINGS,
    mixed.window,
    mixedTarget
  );
  assert.equal(mixedPayload.text, 'A BCDE x = 1');
  assert.doesNotMatch(mixedPayload.html, leakedArtifact);
});

test('ordinary cleanup leaves over-budget ranges entirely native without cloning', () => {
  for (const shape of ['deep', 'wide', 'attribute']) {
    const instance = dom('<div id="target"></div>');
    const target = instance.window.document.querySelector('#target');
    if (shape === 'deep') {
      let current = target;
      for (let depth = 0; depth < 140; depth += 1) {
        const child = instance.window.document.createElement('span');
        current.appendChild(child);
        current = child;
      }
      current.textContent = 'A\u200bB';
    } else if (shape === 'wide') {
      for (let count = 0; count < 1100; count += 1) target.appendChild(instance.window.document.createElement('span'));
      target.appendChild(instance.window.document.createTextNode('A\u200bB'));
    } else {
      target.setAttribute('data-hostile-padding', 'x'.repeat(1024 * 1024 + 1));
      target.textContent = 'A\u200bB';
    }
    const originalClone = instance.window.Range.prototype.cloneContents;
    let cloneCalls = 0;
    instance.window.Range.prototype.cloneContents = function countedCloneContents() {
      cloneCalls += 1;
      return originalClone.call(this);
    };
    try {
      const payload = cleanCopy.ordinarySelectionPayload(
        instance.window.document,
        selectContents(instance.window, target),
        instance.window,
        target
      );
      assert.equal(payload, null, shape);
      assert.equal(cloneCalls, 0, shape);
    } finally {
      instance.window.Range.prototype.cloneContents = originalClone;
    }
  }
});

test('ordinary cleanup never exposes text hidden only by computed CSS', () => {
  const instance = dom([
    '<style>.hidden-by-css { display: none }</style>',
    '<div id="target">Visible <span class="hidden-by-css">SECRET</span>text</div>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  const selection = selectContents(instance.window, target);
  assert.equal(cleanCopy.ordinarySelectionPayload(
    instance.window.document,
    selection,
    instance.window,
    target
  ), null);
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  ), null);
});

test('ordinary cleanup defers to native for rendered text transforms and unmodeled list markers', () => {
  const instance = dom([
    '<style>',
    '.caps { text-transform: uppercase }',
    '.letters { list-style-type: lower-alpha }',
    '.markerless { list-style-type: none }',
    '.images { list-style-image: url("marker.png") }',
    '</style>',
    '<p id="caps" class="caps">Mixed&nbsp;case</p>',
    '<ol id="letters" class="letters"><li>Alpha&nbsp;item</li></ol>',
    '<ul id="markerless" class="markerless"><li>Hidden&nbsp;marker</li></ul>',
    '<ul id="images" class="images"><li>Image&nbsp;marker</li></ul>'
  ].join(''));
  for (const id of ['caps', 'letters', 'markerless', 'images']) {
    const target = instance.window.document.querySelector('#' + id);
    assert.equal(cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      target
    ), null, id);
  }
});

test('ordinary cleanup keeps visible text that is only hidden from accessibility APIs', () => {
  const instance = dom('<p id="target">Visible <span aria-hidden="true">kept&nbsp;text</span> <span class="sr-only">and&nbsp;class</span></p>');
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(payload.text, 'Visible kept text and class');
  assert.match(payload.html, /Visible <span>kept text<\/span> <span>and class<\/span>/);
});

test('ordinary cleanup defers when CSS can hide, transform, or visually reorder selected text', () => {
  const instance = dom([
    '<p id="opacity">Visible <span style="opacity:0">SECRET</span>&nbsp; text</p>',
    '<p id="zero">Visible <span style="font-size:0">SECRET</span>&nbsp; text</p>',
    '<p id="transparent">Visible <span style="color:transparent">SECRET</span>&nbsp; text</p>',
    '<p id="clipped">Visible <span style="clip-path:inset(100%)">SECRET</span>&nbsp; text</p>',
    '<p id="absolute">Visible <span style="position:absolute;left:0">moved</span>&nbsp; text</p>',
    '<p id="caps" style="font-variant:small-caps">Mixed&nbsp; case</p>'
  ].join(''));
  for (const id of ['opacity', 'zero', 'transparent', 'clipped', 'absolute', 'caps']) {
    const target = instance.window.document.querySelector('#' + id);
    assert.equal(cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      target
    ), null, id);
  }
});

test('clean ordinary text and editable or code selections remain on their native copy paths', () => {
  const clean = dom('<p id="target">Clean prose 👩‍💻 שלום e\u0301.</p>');
  const cleanTarget = clean.window.document.querySelector('#target');
  assert.equal(cleanCopy.ordinarySelectionPayload(
    clean.window.document,
    selectContents(clean.window, cleanTarget),
    clean.window,
    cleanTarget
  ), null);

  for (const markup of [
    '<div id="target" contenteditable="true">Uneven   editable text</div>',
    '<pre id="target">  exact\n    code</pre>',
    '<code id="target">x   y</code>'
  ]) {
    const instance = dom(markup);
    const target = instance.window.document.querySelector('#target');
    assert.equal(cleanCopy.ordinarySelectionPayload(
      instance.window.document,
      selectContents(instance.window, target),
      instance.window,
      target
    ), null, markup);
  }
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
  assert.equal(payload.text, 'Intro x = 1 outro and unrelated text.');
});

test('a generic formula wrapper keeps hidden MathML semantics for its direct visual text', () => {
  const instance = dom('<span class="formula" id="target">' +
    '<math style="display:none"><msup><mi>x</mi><mn>2</mn></msup></math>x2</span>');
  const target = instance.window.document.querySelector('#target');
  const visualText = target.lastChild;
  const range = instance.window.document.createRange();
  range.selectNodeContents(visualText);
  const selection = instance.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    visualText
  );
  assert.equal(payload.text, 'x²');
});

test('Wikipedia formula page classes never swallow its real MathML renderers', () => {
  const plusMinus = wikipediaMath('<mrow><mo>±</mo></mrow>', '\\pm');
  const instance = dom([
    '<main class="page-Quadratic_formula rootpage-Quadratic_formula">',
    '<p id="target">where the <a href="https://en.wikipedia.org/wiki/Plus-minus_sign">plus–minus symbol</a> "',
    '<span class="nowrap">\u2060', plusMinus, '\u2060</span>" indicates that the equation has two roots.',
    '<sup class="reference"><a href="#cite_note-1">[1]</a></sup> Written separately, these are:</p>',
    '</main>'
  ].join(''), 'https://en.wikipedia.org/wiki/Quadratic_formula');
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(
    payload.text,
    'where the plus–minus symbol "±" indicates that the equation has two roots.[1] Written separately, these are:'
  );
  assert.doesNotMatch(payload.html, /displaystyle|\\pm|href=|\u2060|\u200b|\]\(https?:/u);
  assert.equal(cleanCopy.rootsForRange(instance.window.getSelection().getRangeAt(0))[0].classList.contains('mwe-math-element'), true);
});

test('Wikipedia prose plus display equation copies one clean readable selection', () => {
  const inline = wikipediaMath([
    '<mrow><mi>a</mi><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mi>b</mi><mi>x</mi>',
    '<mo>+</mo><mi>c</mi><mo>=</mo><mn>0</mn></mrow>'
  ].join(''), '\\textstyle ax^{2}+bx+c=0');
  const display = wikipediaMath([
    '<mrow><mi>x</mi><mo>=</mo><mfrac><mrow><mo>−</mo><mi>b</mi><mo>±</mo><msqrt>',
    '<msup><mi>b</mi><mn>2</mn></msup><mo>−</mo><mn>4</mn><mi>a</mi><mi>c</mi>',
    '</msqrt></mrow><mrow><mn>2</mn><mi>a</mi></mrow></mfrac><mo>,</mo></mrow>'
  ].join(''), 'x={\\frac {-b\\pm {\\sqrt {b^{2}-4ac}}}{2a}},', true);
  const instance = dom([
    '<main id="target" class="page-Quadratic_formula rootpage-Quadratic_formula">',
    '<p>Given a general quadratic equation of the form <span class="nowrap">\u2060', inline,
    '\u2060</span>, the values can be found using the quadratic formula,</p><p>', display, '</p></main>'
  ].join(''), 'https://en.wikipedia.org/wiki/Quadratic_formula');
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(
    payload.text,
    'Given a general quadratic equation of the form ax² + bx + c = 0, the values can be found using the quadratic formula,\n\nx = (−b ± √(b² − 4ac))/(2a),'
  );
  assert.doesNotMatch(payload.text + payload.html, /displaystyle|\\textstyle|\\frac|\u2060/u);
});

test('Wikipedia hidden MathML must agree with its visible fallback in mixed prose', () => {
  const formula = wikipediaMath(
    '<mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow>',
    'x=1'
  );
  const instance = dom('<p id="target">Before ' + formula + ' after.</p>', 'https://en.wikipedia.org/wiki/Equation');
  const target = instance.window.document.querySelector('#target');
  const selection = selectContents(instance.window, target);
  const matching = cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(matching.text, 'Before x = 1 after.');

  target.querySelector('img[alt]').setAttribute('alt', '{\\displaystyle y=2}');
  const mismatching = cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(mismatching, null);
});

test('Wikipedia equivalent slash and MathML grouping remain readable', () => {
  const formula = wikipediaMath(
    '<mrow><mi>c</mi><mrow><mo>/</mo></mrow><mi>a</mi></mrow>',
    'c/a'
  );
  const instance = dom('<p id="target">Therefore ' + formula + ' is the product.</p>',
    'https://en.wikipedia.org/wiki/Quadratic_formula');
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(payload.text, 'Therefore c/a is the product.');
});

test('mixed math cleanup ignores forged placeholders and unwraps unknown rich elements', () => {
  const instance = dom('<p id="target"><x-trigger data-clean-math-copy-value="FORGED">visible<!--EndFragment--></x-trigger> ' +
    katex('<mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow>', 'x=1') + '</p>');
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(payload.text, 'visible x = 1');
  assert.match(payload.html, /visible/);
  assert.doesNotMatch(payload.html, /x-trigger|FORGED|data-clean-math-copy/i);
  assert.equal((payload.html.match(/<!--EndFragment-->/g) || []).length, 1);
});

test('mixed math keeps visually rendered aria-hidden prose', () => {
  const instance = dom('<p id="target">Visible <span aria-hidden="true">kept</span> ' +
    '<span role="math"><math><mi>x</mi></math></span></p>');
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(payload.text, 'Visible kept x');
  assert.match(payload.html, /Visible <span>kept<\/span>/);
});

test('mixed math preserves preformatted, code, list, and table selection context', () => {
  const cases = [
    ['<pre id="target">  before  <span role="math"><math><mi>x</mi></math></span>  after  \n</pre>', '  before  x  after', /<pre>  before/],
    ['<code id="target">a  <span role="math"><math><mi>x</mi></math></span>  b</code>', 'a  x  b', /<code>a  /],
    ['<ul id="target"><li>first <span role="math"><math><mi>x</mi></math></span></li><li>second</li></ul>', '• first x\n• second', /<ul><li>first/],
    ['<ol id="target" start="3"><li>first <span role="math"><math><mi>x</mi></math></span></li><li>second</li></ol>', '3. first x\n4. second', /<ol start="3">/],
    ['<table id="target"><tbody><tr><td>A <span role="math"><math><mi>x</mi></math></span></td><td>B</td></tr></tbody></table>', 'A x\tB', /<table><tbody><tr><td>/]
  ];
  for (const [markup, expected, richPattern] of cases) {
    const instance = dom(markup);
    const target = instance.window.document.querySelector('#target');
    const payload = cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      target
    );
    assert.equal(payload.text, expected, target.localName);
    assert.match(payload.html, richPattern, target.localName);
  }

  const partial = dom('<table><tr><td id="start">A <span role="math"><math><mi>x</mi></math></span></td><td id="end">B</td></tr></table>');
  const start = partial.window.document.querySelector('#start');
  const end = partial.window.document.querySelector('#end');
  const range = partial.window.document.createRange();
  range.setStart(start.firstChild, 0);
  range.setEnd(end.firstChild, end.firstChild.length);
  const selection = partial.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  const payload = cleanCopy.getCopyPayload(
    partial.window.document,
    selection,
    cleanCopy.DEFAULT_SETTINGS,
    partial.window,
    start
  );
  assert.equal(payload.text, 'A x\tB');
  assert.match(payload.html, /<table><tbody><tr><td>A /);
});

test('a cross-boundary math selection declines when its prose prefix has computed-hidden text', () => {
  const instance = dom([
    '<style>.hidden-prefix { display:none }</style>',
    '<p id="target">Visible <span class="hidden-prefix">SECRET</span>',
    '<span role="math"><math><mi>x</mi></math></span></p>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  const mathText = target.querySelector('mi').firstChild;
  const range = instance.window.document.createRange();
  range.setStart(target.firstChild, 0);
  range.setEnd(mathText, mathText.nodeValue.length);
  const selection = instance.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  ), null);
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

  const mixed = dom('<p id="start">Keep </p><code id="end">$x^2$</code>');
  const start = mixed.window.document.querySelector('#start');
  const end = mixed.window.document.querySelector('#end');
  const range = mixed.window.document.createRange();
  range.setStart(start.firstChild, 0);
  range.setEnd(end.firstChild, end.firstChild.length);
  const reversedLikeSelection = {
    isCollapsed: false,
    rangeCount: 1,
    anchorNode: start.firstChild,
    focusNode: end.firstChild,
    getRangeAt() { return range; }
  };
  assert.equal(
    cleanCopy.getCopyPayload(mixed.window.document, reversedLikeSelection, {}, mixed.window, start),
    null
  );
});

test('currency arithmetic is never paired into fake dollar-delimited LaTeX', () => {
  for (const source of ['$5 + $10 = $15', '$5 - $3 = $2', '$5 × 2 = $10']) {
    const instance = dom('<p id="target"></p>');
    const target = instance.window.document.querySelector('#target');
    target.textContent = source;
    assert.equal(cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      target
    ), null, source);
  }
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
  assert.equal(rootPayload.text, 'r ∝ √(m/|q|)');
  assert.equal(/\s$/.test(rootPayload.text), false);
  assert.match(rootPayload.html, /√\(m\/\|q\|\)/);
  assert.doesNotMatch(rootPayload.html, /sqrt\(/);

  const mass = instance.window.document.querySelector('#mass');
  const massPayload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, mass),
    { ...cleanCopy.DEFAULT_SETTINGS, outputMode: 'calculator' },
    instance.window,
    mass
  );
  assert.equal(massPayload.text, 'm=0.666*10^(-25)*k*g');

  const numeric = mass.querySelector('strong');
  const numericPayload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, numeric),
    { ...cleanCopy.DEFAULT_SETTINGS, outputMode: 'calculator' },
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
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  ), null);
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    { ...cleanCopy.DEFAULT_SETTINGS, outputMode: 'calculator' },
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
    { ...cleanCopy.DEFAULT_SETTINGS, outputMode: 'calculator' },
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
        { ...cleanCopy.DEFAULT_SETTINGS, outputMode: 'calculator' },
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
  assert.equal(officeClipboard.get('text/plain'), '√x');
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

test('decodes the reported Google Docs equation from its structural clipboard slice', () => {
  const slice = reportedGoogleDocsEquationSlice();
  const faithful = cleanCopy.googleDocsSlicePayload(slice, { outputMode: 'faithful' });
  assert.equal(
    faithful.text,
    '|B| = √((27.187)² + (17.479)² + (−28.112)²) = 42.84 μT'
  );
  assert.equal(faithful.reason, 'google-docs-semantic-clipboard');
  assert.equal(faithful.mathRanges, 1);
  assert.equal(/[\s\u200b\u2060]$/.test(faithful.text), false);
  assert.equal(
    cleanCopy.googleDocsSlicePayload(slice, { outputMode: 'calculator' }).text,
    'abs(B)=sqrt((27.187)^(2)+(17.479)^(2)+(-28.112)^(2))=42.84*mu*T'
  );
});

test('uses Google Docs explicit rich HTML as a script fallback when its private slice is unavailable', () => {
  const instance = dom('');
  const markup = [
    '<meta charset="utf-8"><b id="docs-internal-guid-fallback">',
    '|B|=√((27.187)<span style="font-size:0.6em;vertical-align:super">2</span>',
    '+(17.479)<span style="vertical-align: super">2</span>',
    '+(-28.112)<sup>2</sup>) = 42.84 μT</b>'
  ].join('');
  const payload = cleanCopy.richScriptClipboardPayloadFromMarkup(
    markup,
    { outputMode: 'faithful' },
    instance.window.document
  );
  assert.equal(
    payload.text,
    '|B| = √((27.187)² + (17.479)² + (−28.112)²) = 42.84 μT'
  );
  assert.equal(payload.sourceText, '|B|=√((27.187)2+(17.479)2+(-28.112)2) = 42.84 μT');
});

test('explicit rich HTML preserves nested superscripts and subscripts without flattening', () => {
  const instance = dom('');
  assert.equal(
    cleanCopy.richScriptClipboardPayloadFromMarkup(
      'x<sup>2<sup>3</sup></sup>',
      { outputMode: 'faithful' },
      instance.window.document
    ).text,
    'x^(2^3)'
  );
  assert.equal(
    cleanCopy.richScriptClipboardPayloadFromMarkup(
      'x<sup>a<sub>i</sub></sup>',
      { outputMode: 'faithful' },
      instance.window.document
    ).text,
    'x^(a_i)'
  );
  const cases = [
    ['x<sup>2<sub>i</sub></sup>', 'x^(2_i)', 'x^(2_(i))', 'x^{2_{i}}'],
    ['x<sub>i<sup>2</sup></sub>', 'x_(i^2)', 'x_(i^(2))', 'x_{i^{2}}'],
    ['x<sub>i<sub>j</sub></sub>', 'x_(i_j)', 'x_(i_(j))', 'x_{i_{j}}']
  ];
  for (const [markup, faithful, calculator, latex] of cases) {
    assert.equal(
      cleanCopy.richScriptClipboardPayloadFromMarkup(markup, { outputMode: 'faithful' }, instance.window.document).text,
      faithful
    );
    assert.equal(
      cleanCopy.richScriptClipboardPayloadFromMarkup(markup, { outputMode: 'calculator' }, instance.window.document).text,
      calculator
    );
    assert.equal(
      cleanCopy.richScriptClipboardPayloadFromMarkup(markup, { outputMode: 'latex' }, instance.window.document).text,
      latex
    );
  }
  assert.equal(
    cleanCopy.richScriptClipboardPayloadFromMarkup(
      'x<sub>i</sub><sup>2</sup>',
      { outputMode: 'faithful' },
      instance.window.document
    ).text,
    'xᵢ²'
  );
});

test('uses explicit Google Docs text styles for scripts without guessing adjacent digits', () => {
  const styled = googleDocsSlice(['x2 + H2O'], [
    [0, 'nor'], [1, 'sup'], [2, 'nor'], [6, 'sub'], [7, 'nor']
  ]);
  assert.equal(
    cleanCopy.googleDocsSlicePayload(styled, { outputMode: 'faithful' }).text,
    'x² + H₂O'
  );
  assert.equal(cleanCopy.googleDocsSlicePayload(googleDocsSlice(['x2 + H2O']), { outputMode: 'faithful' }), null);
  assert.equal(cleanCopy.googleDocsSlicePayload('{not json', { outputMode: 'faithful' }), null);
});

test('Google Docs equation text and operator names preserve authored spaces', () => {
  const slice = googleDocsSlice([{ equation: [
    { command: '\\text', args: ['hello world'] },
    ' + ',
    { command: '\\operatorname', args: ['standard error'] },
    '(x)'
  ] }]);
  assert.equal(
    cleanCopy.googleDocsSlicePayload(slice, { outputMode: 'faithful' }).text,
    'hello world + standard error(x)'
  );
});

test('Google Docs parser preserves mixed order and fails closed on malformed or hostile slices', () => {
  const mixed = googleDocsSlice([
    'Before ',
    { equation: [{ command: '\\superscript', args: ['x', '2'] }] },
    '\nAfter ',
    { equation: [{ command: '\\sqrt', args: ['y'] }] }
  ]);
  assert.equal(
    cleanCopy.googleDocsSlicePayload(mixed, { outputMode: 'faithful' }).text,
    'Before x²\nAfter √y'
  );
  assert.equal(cleanCopy.googleDocsSlicePayload(googleDocsSlice(['27.187']), { outputMode: 'faithful' }), null);
  assert.equal(
    cleanCopy.googleDocsSlicePayload(
      googleDocsSlice([{ equation: [{ command: '\\unknowncommand' }] }]),
      { outputMode: 'faithful' }
    ),
    null
  );
  let nested = 'x';
  for (let index = 0; index < 130; index += 1) nested = { command: '\\sqrt', args: [nested] };
  assert.equal(
    cleanCopy.googleDocsSlicePayload(googleDocsSlice([{ equation: [nested] }]), { outputMode: 'faithful' }),
    null
  );
  assert.equal(
    cleanCopy.googleDocsSlicePayload(googleDocsSlice(['x'.repeat(50001)]), { outputMode: 'faithful' }),
    null
  );
  const missingCommand = JSON.parse(reportedGoogleDocsEquationSlice());
  const missingData = JSON.parse(missingCommand.data);
  const equationStyles = missingData.resolved.dsl_styleslices.find((slice) => slice.stsl_type === 'equation_function');
  equationStyles.stsl_styles = [];
  missingCommand.data = JSON.stringify(missingData);
  assert.equal(cleanCopy.googleDocsSlicePayload(JSON.stringify(missingCommand), { outputMode: 'faithful' }), null);
});

test('repairs Google Docs equation clipboard text even when Docs stops propagation', () => {
  const flat = '|B|=√((27.187)2+(17.479)2+(-28.112)2) = 42.84 μT';
  const rich = [
    '<meta charset="utf-8"><b id="docs-internal-guid-test" style="font-weight:normal">',
    '|B|=√((27.187)<span style="font-size:0.6em;vertical-align:super;">2</span>',
    '+(17.479)<span style="vertical-align: super">2</span>',
    '+(-28.112)<sup>2</sup>) = 42.84 μT</b>'
  ].join('');
  const slice = reportedGoogleDocsEquationSlice();
  const instance = dom('<div id="target" contenteditable="true">' + flat + '</div>', 'https://docs.google.com/document/d/test/edit');
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const clipboard = new Map();
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData('text/plain', flat);
    event.clipboardData.setData('text/html', rich);
    event.clipboardData.setData('application/x-vnd.google-docs-document-slice-clip+wrapped', slice);
    event.preventDefault();
    event.stopImmediatePropagation();
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      get types() { return Array.from(clipboard.keys()); },
      clearData(type) { if (type) clipboard.delete(type); else clipboard.clear(); },
      setData(type, value) { clipboard.set(type, value); },
      getData(type) { return clipboard.get(type) || ''; }
    }
  });
  target.dispatchEvent(event);
  assert.equal(
    clipboard.get('text/plain'),
    '|B| = √((27.187)² + (17.479)² + (−28.112)²) = 42.84 μT'
  );
  assert.equal(clipboard.get('text/html'), rich);
  assert.equal(clipboard.get('application/x-vnd.google-docs-document-slice-clip+wrapped'), slice);
  assert.equal(event.defaultPrevented, true);
});

test('repairs copy events inside Google Docs hidden text-event iframe', async () => {
  const flat = '|B|=√((27.187)2+(17.479)2+(-28.112)2) = 42.84 μT';
  const slice = reportedGoogleDocsEquationSlice();
  const instance = dom('<div class="kix-appview-editor"></div>', 'https://docs.google.com/document/d/test/edit');
  cleanCopy.install(instance.window.document, instance.window);

  const frame = instance.window.document.createElement('iframe');
  frame.className = 'docs-texteventtarget-iframe docs-offscreen-z-index';
  instance.window.document.body.appendChild(frame);
  const childDocument = frame.contentDocument;
  const childWindow = frame.contentWindow;
  childDocument.body.innerHTML = '<div id="target" contenteditable="true">' + flat + '</div>';
  const target = childDocument.querySelector('#target');
  const clipboard = new Map();
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData('text/plain', flat);
    event.clipboardData.setData('application/x-vnd.google-docs-document-slice-clip+wrapped', slice);
    event.preventDefault();
    event.stopImmediatePropagation();
  });

  await new Promise((resolve) => instance.window.setTimeout(resolve, 0));
  selectContents(childWindow, target);
  const event = new childWindow.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      get types() { return Array.from(clipboard.keys()); },
      clearData(type) { if (arguments.length) clipboard.delete(type); else clipboard.clear(); },
      setData(type, value) { clipboard.set(type, value); },
      getData(type) { return clipboard.get(type) || ''; }
    }
  });
  target.dispatchEvent(event);
  assert.equal(
    clipboard.get('text/plain'),
    '|B| = √((27.187)² + (17.479)² + (−28.112)²) = 42.84 μT'
  );
  assert.equal(clipboard.get('application/x-vnd.google-docs-document-slice-clip+wrapped'), slice);
  assert.equal(event.defaultPrevented, true);

  const replacement = instance.window.document.createElement('iframe');
  instance.window.document.body.appendChild(replacement);
  replacement.className = 'docs-texteventtarget-iframe docs-texteventtarget-iframe-negative-top';
  const replacementDocument = replacement.contentDocument;
  const replacementWindow = replacement.contentWindow;
  replacementDocument.body.innerHTML = '<div id="replacement" contenteditable="true">' + flat + '</div>';
  const replacementTarget = replacementDocument.querySelector('#replacement');
  const replacementClipboard = new Map();
  replacementTarget.addEventListener('copy', (copyEvent) => {
    copyEvent.clipboardData.setData('text/plain', flat);
    copyEvent.clipboardData.setData('application/x-vnd.google-docs-document-slice-clip+wrapped', slice);
    copyEvent.preventDefault();
    copyEvent.stopImmediatePropagation();
  });
  await new Promise((resolve) => instance.window.setTimeout(resolve, 0));
  selectContents(replacementWindow, replacementTarget);
  const replacementEvent = new replacementWindow.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(replacementEvent, 'clipboardData', {
    value: {
      get types() { return Array.from(replacementClipboard.keys()); },
      clearData(type) { if (arguments.length) replacementClipboard.delete(type); else replacementClipboard.clear(); },
      setData(type, value) { replacementClipboard.set(type, value); },
      getData(type) { return replacementClipboard.get(type) || ''; }
    }
  });
  replacementTarget.dispatchEvent(replacementEvent);
  assert.equal(
    replacementClipboard.get('text/plain'),
    '|B| = √((27.187)² + (17.479)² + (−28.112)²) = 42.84 μT'
  );
});

test('Google Docs owns an inherited child before its clipboard class is assigned', () => {
  const flat = '|B|=√((27.187)2+(17.479)2+(-28.112)2) = 42.84 μT';
  const slice = reportedGoogleDocsEquationSlice();
  const instance = dom('<div class="kix-appview-editor"></div>', 'https://docs.google.com/document/d/test/edit');
  const frame = instance.window.document.createElement('iframe');
  instance.window.document.body.appendChild(frame);
  frame.contentDocument.body.innerHTML = '<div id="target" contenteditable="true">' + flat + '</div>';

  let storedSettings = { ...cleanCopy.DEFAULT_SETTINGS };
  const previousGetValue = Object.getOwnPropertyDescriptor(globalThis, 'GM_getValue');
  Object.defineProperty(globalThis, 'GM_getValue', {
    configurable: true,
    writable: true,
    value() { return storedSettings; }
  });
  let childController;
  try {
    childController = cleanCopy.install(frame.contentDocument, frame.contentWindow);
    assert.equal(frame.contentDocument.__cleanMathCopyInstalled, true);
    storedSettings = { ...storedSettings, outputMode: 'ascii' };
    assert.equal(childController.settings.outputMode, 'ascii');
    storedSettings = { ...storedSettings, outputMode: 'faithful' };
  } finally {
    if (previousGetValue) Object.defineProperty(globalThis, 'GM_getValue', previousGetValue);
    else delete globalThis.GM_getValue;
  }

  frame.className = 'docs-texteventtarget-iframe docs-texteventtarget-iframe-negative-top';
  cleanCopy.install(instance.window.document, instance.window);
  assert.equal(frame.contentDocument.__cleanMathCopyInstalled, true);

  const clipboard = new Map();
  const target = frame.contentDocument.querySelector('#target');
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData('text/plain', flat);
    event.clipboardData.setData('application/x-vnd.google-docs-document-slice-clip+wrapped', slice);
    event.preventDefault();
    event.stopImmediatePropagation();
  });
  const event = new frame.contentWindow.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      get types() { return Array.from(clipboard.keys()); },
      clearData(type) { if (arguments.length) clipboard.delete(type); else clipboard.clear(); },
      setData(type, value) { clipboard.set(type, value); },
      getData(type) { return clipboard.get(type) || ''; }
    }
  });
  target.dispatchEvent(event);
  assert.equal(
    clipboard.get('text/plain'),
    '|B| = √((27.187)² + (17.479)² + (−28.112)²) = 42.84 μT'
  );
});

test('isolated relay harvests cached Google Docs writes from its about:blank clipboard iframe', () => {
  const flat = '|B|=√((27.187)2+(17.479)2+(-28.112)2) = 42.84 μT';
  const slice = reportedGoogleDocsEquationSlice();
  const instance = new JSDOM(
    '<!doctype html><html><body><div class="kix-appview-editor"></div></body></html>',
    { url: 'https://docs.google.com/document/d/test/edit', runScripts: 'dangerously' }
  );
  const frame = instance.window.document.createElement('iframe');
  frame.className = 'docs-texteventtarget-iframe docs-texteventtarget-iframe-negative-top';
  instance.window.document.body.appendChild(frame);
  const childDocument = frame.contentDocument;
  const childWindow = frame.contentWindow;
  childDocument.body.innerHTML = '<div id="target" contenteditable="true">' + flat + '</div>';

  const previousInfo = Object.getOwnPropertyDescriptor(globalThis, 'GM_info');
  const previousAddElement = Object.getOwnPropertyDescriptor(globalThis, 'GM_addElement');
  Object.defineProperty(globalThis, 'GM_info', {
    value: { injectInto: 'content' }, configurable: true, writable: true
  });
  Object.defineProperty(globalThis, 'GM_addElement', {
    configurable: true,
    writable: true,
    value(parent, tagName, attributes) {
      const ownerDocument = parent.ownerDocument;
      const element = ownerDocument.createElement(tagName);
      for (const [name, value] of Object.entries(attributes || {})) {
        if (name !== 'textContent') element.setAttribute(name, String(value));
      }
      parent.appendChild(element);
      if (attributes && attributes.textContent) ownerDocument.defaultView.eval(String(attributes.textContent));
      return element;
    }
  });

  try {
    cleanCopy.install(instance.window.document, instance.window);
    assert.equal(childDocument.__cleanMathCopyInstalled, true);
    assert.equal(childWindow.location.href, 'about:blank');
    assert.ok(childDocument.querySelector('[data-clean-math-copy-relay-ready="1"]'));

    const clipboard = new Map();
    const clipboardPrototype = {
      get types() { return Array.from(clipboard.keys()); },
      clearData(type) { if (arguments.length) clipboard.delete(type); else clipboard.clear(); },
      setData(type, value) { clipboard.set(type, value); },
      getData(type) { return clipboard.get(type) || ''; }
    };
    // Google Docs calls a cached/prototype DataTransfer method, bypassing the
    // relay's temporary own-property wrappers. The final MIME snapshot must
    // still reach the isolated semantic parser.
    const cachedSetData = clipboardPrototype.setData;
    const target = childDocument.querySelector('#target');
    target.addEventListener('copy', (event) => {
      Reflect.apply(cachedSetData, event.clipboardData, ['text/plain', flat]);
      Reflect.apply(cachedSetData, event.clipboardData, [
        'application/x-vnd.google-docs-document-slice-clip+wrapped',
        slice
      ]);
      event.preventDefault();
      event.stopImmediatePropagation();
    });
    const event = new childWindow.Event('copy', { bubbles: true, cancelable: true, composed: true });
    Object.defineProperty(event, 'clipboardData', { value: Object.create(clipboardPrototype) });
    target.dispatchEvent(event);
    assert.equal(
      clipboard.get('text/plain'),
      '|B| = √((27.187)² + (17.479)² + (−28.112)²) = 42.84 μT'
    );
    assert.equal(clipboard.get('application/x-vnd.google-docs-document-slice-clip+wrapped'), slice);
    assert.equal(event.defaultPrevented, true);
  } finally {
    if (previousInfo) Object.defineProperty(globalThis, 'GM_info', previousInfo);
    else delete globalThis.GM_info;
    if (previousAddElement) Object.defineProperty(globalThis, 'GM_addElement', previousAddElement);
    else delete globalThis.GM_addElement;
  }
});

test('Google Docs semantics survive reverse clipboard writes and an intervening clear', () => {
  const flat = '|B|=√((27.187)2+(17.479)2+(-28.112)2) = 42.84 μT';
  const slice = reportedGoogleDocsEquationSlice();
  const instance = dom('<div id="target" contenteditable="true">' + flat + '</div>', 'https://docs.google.com/document/u/0/d/test/edit');
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const clipboard = new Map();
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData('application/x-vnd.google-docs-document-slice-clip+wrapped', slice);
    event.clipboardData.clearData('text/plain');
    event.clipboardData.setData('text/plain', flat);
    event.preventDefault();
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      get types() { return Array.from(clipboard.keys()); },
      clearData(type) { if (type) clipboard.delete(type); else clipboard.clear(); },
      setData(type, value) { clipboard.set(type, value); },
      getData(type) { return clipboard.get(type) || ''; }
    }
  });
  target.dispatchEvent(event);
  assert.equal(
    clipboard.get('text/plain'),
    '|B| = √((27.187)² + (17.479)² + (−28.112)²) = 42.84 μT'
  );
  assert.equal(clipboard.get('application/x-vnd.google-docs-document-slice-clip+wrapped'), slice);
});

test('invalidated Google Docs and rich-HTML flavors never leave stale rewritten math', () => {
  const customType = 'application/x-vnd.google-docs-document-slice-clip+wrapped';
  const run = (operations) => {
    const instance = dom('<div id="target" contenteditable="true">x2</div>', 'https://docs.google.com/document/d/test/edit');
    const target = instance.window.document.querySelector('#target');
    selectContents(instance.window, target);
    cleanCopy.install(instance.window.document, instance.window);
    const clipboard = new Map();
    target.addEventListener('copy', (event) => {
      operations(event.clipboardData);
      event.preventDefault();
      event.stopImmediatePropagation();
    });
    const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        get types() { return Array.from(clipboard.keys()); },
        clearData(type) { if (arguments.length) clipboard.delete(type); else clipboard.clear(); },
        setData(type, value) { clipboard.set(type, value); },
        getData(type) { return clipboard.get(type) || ''; }
      }
    });
    target.dispatchEvent(event);
    return clipboard;
  };
  const slice = googleDocsSlice([{ equation: [{ command: '\\superscript', args: ['x', '2'] }] }]);

  const malformedOverwrite = run((data) => {
    data.setData('text/plain', 'x2');
    data.setData(customType, slice);
    data.setData(customType, '{malformed');
  });
  assert.equal(malformedOverwrite.get('text/plain'), 'x2');
  assert.equal(malformedOverwrite.get(customType), '{malformed');

  const clearedFlavor = run((data) => {
    data.setData('text/plain', 'x2');
    data.setData(customType, slice);
    data.clearData(customType);
  });
  assert.equal(clearedFlavor.get('text/plain'), 'x2');
  assert.equal(clearedFlavor.has(customType), false);

  const clearedAll = run((data) => {
    data.setData(customType, slice);
    data.clearData();
    data.setData('text/plain', 'Room 101');
  });
  assert.equal(clearedAll.get('text/plain'), 'Room 101');
  assert.equal(clearedAll.has(customType), false);

  const replacedHTML = run((data) => {
    data.setData('text/plain', 'x2');
    data.setData('text/html', '<span>x<sup>2</sup></span>');
    data.setData('text/html', '<span>x2</span>');
  });
  assert.equal(replacedHTML.get('text/plain'), 'x2');
  assert.equal(replacedHTML.get('text/html'), '<span>x2</span>');
});

test('generic semantic markup must agree with the site plain text before rewriting', () => {
  const instance = dom('<div id="target" contenteditable="true">Room 101</div>');
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const clipboard = new Map();
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData('text/plain', 'Room 101');
    event.clipboardData.setData(
      'application/mathml+xml',
      '<math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>x</mi><mn>2</mn></msup></math>'
    );
    event.preventDefault();
    event.stopImmediatePropagation();
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      get types() { return Array.from(clipboard.keys()); },
      clearData(type) { if (type) clipboard.delete(type); else clipboard.clear(); },
      setData(type, value) { clipboard.set(type, value); },
      getData(type) { return clipboard.get(type) || ''; }
    }
  });
  target.dispatchEvent(event);
  assert.equal(clipboard.get('text/plain'), 'Room 101');
});

test('generic rich HTML and MathML stay pending when a site writes semantics before plain text', () => {
  const cases = [
    ['text/html', '<span>x<sup>2</sup></span>'],
    ['application/mathml+xml', '<math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>x</mi><mn>2</mn></msup></math>']
  ];
  for (const [semanticType, semanticValue] of cases) {
    const instance = dom('<div id="target" contenteditable="true">x2</div>');
    const target = instance.window.document.querySelector('#target');
    selectContents(instance.window, target);
    cleanCopy.install(instance.window.document, instance.window);
    const clipboard = new Map();
    target.addEventListener('copy', (event) => {
      event.clipboardData.setData(semanticType, semanticValue);
      event.clipboardData.setData('text/plain', 'x2');
      event.preventDefault();
      event.stopImmediatePropagation();
    });
    const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        get types() { return Array.from(clipboard.keys()); },
        clearData(type) { if (type) clipboard.delete(type); else clipboard.clear(); },
        setData(type, value) { clipboard.set(type, value); },
        getData(type) { return clipboard.get(type) || ''; }
      }
    });
    target.dispatchEvent(event);
    assert.equal(clipboard.get('text/plain'), 'x²');
    assert.equal(clipboard.get(semanticType), semanticValue);
  }
});

test('clearing a plain-text alias removes every representation injected by a rewrite', () => {
  for (const alias of ['text', 'unicode']) {
    const instance = dom('<div id="target" contenteditable="true">x2</div>');
    const target = instance.window.document.querySelector('#target');
    selectContents(instance.window, target);
    cleanCopy.install(instance.window.document, instance.window);
    const clipboard = new Map();
    target.addEventListener('copy', (event) => {
      event.clipboardData.setData(alias, 'x2');
      event.clipboardData.setData('text/html', '<span>x<sup>2</sup></span>');
      event.clipboardData.clearData(alias);
      event.preventDefault();
      event.stopImmediatePropagation();
    });
    const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        get types() { return Array.from(clipboard.keys()); },
        clearData(type) { if (arguments.length) clipboard.delete(type); else clipboard.clear(); },
        setData(type, value) { clipboard.set(type, value); },
        getData(type) { return clipboard.get(type) || ''; }
      }
    });
    target.dispatchEvent(event);
    assert.equal(clipboard.has(alias), false);
    assert.equal(clipboard.has('text/plain'), false);
    assert.equal(clipboard.get('text/html'), '<span>x<sup>2</sup></span>');
  }
});

test('a rejected bubble rewrite never cancels the native copy', () => {
  const instance = dom('<div id="target" contenteditable="true">x2</div>');
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const values = new Map([
    ['text/plain', 'x2'],
    ['application/mathml+xml', '<math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>x</mi><mn>2</mn></msup></math>']
  ]);
  const clipboardData = {
    get types() { return Array.from(values.keys()); },
    clearData() {},
    getData(type) { return values.get(type) || ''; }
  };
  Object.defineProperty(clipboardData, 'setData', {
    value() { throw new Error('browser rejected write'); },
    configurable: false,
    writable: false
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  target.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(values.get('text/plain'), 'x2');
});

test('a partially rejected multi-alias rewrite rolls back every successful alias', () => {
  const instance = dom('<div id="target" contenteditable="true">x2</div>');
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const values = new Map();
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData('text', 'x2');
    event.clipboardData.setData('text/html', '<span>x<sup>2</sup></span>');
    event.preventDefault();
    event.stopImmediatePropagation();
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      get types() { return Array.from(values.keys()); },
      clearData(type) { if (type) values.delete(type); else values.clear(); },
      setData(type, value) {
        if (type === 'text/plain' && value === 'x²') throw new Error('canonical alias rejected');
        values.set(type, value);
      },
      getData(type) { return values.get(type) || ''; }
    }
  });
  target.dispatchEvent(event);
  assert.equal(values.get('text'), 'x2');
  assert.equal(values.has('text/plain'), false);
  assert.equal(values.get('text/html'), '<span>x<sup>2</sup></span>');
});

test('page relay aborts cleanly when clearData cannot be observed', () => {
  const instance = new JSDOM('<!doctype html><html><body><span id="carrier"></span><div id="target">x2</div></body></html>', {
    url: 'https://example.test/',
    runScripts: 'dangerously'
  });
  instance.window.eval(
    '(' + cleanCopy.cleanMathCopyPageRelayMain.toString() + ')(' +
    JSON.stringify('carrier') + ',' + JSON.stringify('relay-request') + ');'
  );
  const values = new Map();
  const prototype = {
    setData(type, value) { values.set(type, value); },
    getData(type) { return values.get(type) || ''; }
  };
  const clipboardData = Object.create(prototype);
  Object.defineProperty(clipboardData, 'clearData', {
    value(type) { if (type) values.delete(type); else values.clear(); },
    configurable: false,
    writable: false
  });
  const target = instance.window.document.querySelector('#target');
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData('text/plain', 'x2');
    event.clipboardData.setData('text/html', '<span>x<sup>2</sup></span>');
    event.preventDefault();
    event.stopImmediatePropagation();
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  target.dispatchEvent(event);
  assert.equal(Object.hasOwn(clipboardData, 'setData'), false);
  assert.equal(values.get('text/plain'), 'x2');
  assert.equal(values.get('text/html'), '<span>x<sup>2</sup></span>');
});

test('Google Docs published and preview pages keep ordinary DOM copy cleanup', () => {
  for (const suffix of ['preview', 'pub']) {
    const instance = dom(
      '<p id="target">alpha\u200b&nbsp;beta</p>',
      'https://docs.google.com/document/d/example/' + suffix
    );
    const target = instance.window.document.querySelector('#target');
    selectContents(instance.window, target);
    cleanCopy.install(instance.window.document, instance.window);
    const clipboard = new Map();
    const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        clearData() { clipboard.clear(); },
        setData(type, value) { clipboard.set(type, value); },
        getData(type) { return clipboard.get(type) || ''; },
        get types() { return Array.from(clipboard.keys()); }
      }
    });
    target.dispatchEvent(event);
    assert.equal(clipboard.get('text/plain'), 'alpha beta');
    assert.equal(event.defaultPrevented, true);
  }
});

test('repairs explicit rich-clipboard scripts on any site and rejects mismatched or flat guesses', () => {
  const run = (plain, html, customSlice) => {
    const instance = dom('<div id="target" contenteditable="true">' + plain + '</div>');
    const target = instance.window.document.querySelector('#target');
    selectContents(instance.window, target);
    cleanCopy.install(instance.window.document, instance.window);
    const clipboard = new Map();
    target.addEventListener('copy', (event) => {
      event.clipboardData.setData('text/plain', plain);
      if (html) event.clipboardData.setData('text/html', html);
      if (customSlice) {
        event.clipboardData.setData('application/x-vnd.google-docs-document-slice-clip+wrapped', customSlice);
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    });
    const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        clearData() { clipboard.clear(); },
        setData(type, value) { clipboard.set(type, value); },
        getData(type) { return clipboard.get(type) || ''; },
        get types() { return Array.from(clipboard.keys()); }
      }
    });
    target.dispatchEvent(event);
    return clipboard;
  };
  const googleRich = [
    '<meta charset="utf-8"><b id="docs-internal-guid-script">',
    'x<span style="font-size:0.6em;vertical-align:super">2<script>LEAK</script>',
    '<span style="display:none">SECRET</span></span> + ',
    'H<span style="vertical-align:sub">2</span>O</b>'
  ].join('');
  const corrected = run('x2 + H2O', googleRich);
  assert.equal(corrected.get('text/plain'), 'x² + H₂O');
  assert.equal(corrected.get('text/html'), googleRich);
  assert.equal(run('(27.187)2 and H2O', '').get('text/plain'), '(27.187)2 and H2O');
  assert.equal(
    run('Room 101', '<span>x<sup>2</sup></span>').get('text/plain'),
    'Room 101'
  );
  assert.equal(
    run('(27.187)2', '', reportedGoogleDocsEquationSlice()).get('text/plain'),
    '(27.187)2'
  );
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
  assert.equal(
    cleanCopy.getCopyPayload(instance.window.document, selectContents(instance.window, line), { outputMode: 'faithful' }, instance.window, line).text,
    'R₁, R₂ = 4.7kΩ, 10kΩ and C = 220μF'
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
  assert.equal(cleanCopy.cleanOfficeClipboardText('ℂ\nC\n'), 'ℂ');
  assert.equal(cleanCopy.cleanOfficeClipboardText('ℝ1\nR\n1\n'), 'ℝ₁');
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
  assert.equal(clipboard.get('text/plain'), '√(m/|q|)');
  assert.match(clipboard.get('text/html'), /border-top:1px solid currentColor/);
  assert.match(clipboard.get('MathML'), /^<math/);
});

test('Office semantic rewriting replaces unsafe CF_HTML and ignores forged equation markers', () => {
  const instance = dom('<div id="WACViewPanel_EditingElement" contenteditable="true">&nbsp;</div>',
    'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const target = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const clipboard = new Map();
  const data = {
    get types() { return Array.from(clipboard.keys()); },
    clearData(type) { if (type) clipboard.delete(type); else clipboard.clear(); },
    setData(type, value) { clipboard.set(type, value); },
    getData(type) { return clipboard.get(type) || ''; }
  };
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData('HTML Format', [
      '<img src="x" onerror="steal()">',
      '<span data-clean-math-copy-office-index="0">visible </span>',
      '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow></math>'
    ].join(''));
    event.stopImmediatePropagation();
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', { value: data });
  target.dispatchEvent(event);
  assert.equal(clipboard.get('text/plain'), 'visible x = 1');
  assert.match(clipboard.get('HTML Format'), /^Version:1\.0\r\nStartHTML:\d{10}/);
  assert.match(clipboard.get('HTML Format'), /visible/);
  assert.doesNotMatch(clipboard.get('HTML Format'), /onerror|steal|data-clean-math-copy-office-index/i);
  assert.doesNotMatch(clipboard.get('text/html'), /onerror|steal|data-clean-math-copy-office-index/i);
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
  assert.equal(clipboard.get('text/plain'), 'a/b');
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
  assert.equal(clipboard.get('text/plain'), 'Before x = 1 and √y after');
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
  assert.equal(clipboard.get('text/plain'), 'x = 1\ny = 2');
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
    assert.equal(recovered, '√(m/q)');
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

test('a deferred settings read cannot overwrite a newer menu choice', async () => {
  const instance = dom('<p>settings race</p>');
  const commands = new Map();
  const saved = [];
  let resolveInitialRead;
  const previousGM = global.GM;
  const previousRegister = global.GM_registerMenuCommand;
  try {
    // Exercise the modern asynchronous userscript API specifically. Its
    // startup read is intentionally left pending until after the user changes
    // the output mode from the registered menu.
    delete global.GM_registerMenuCommand;
    global.GM = {
      getValue() {
        return new Promise((resolve) => { resolveInitialRead = resolve; });
      },
      setValue(_key, value) {
        saved.push(value);
        return Promise.resolve();
      },
      registerMenuCommand(name, callback) {
        commands.set(name, callback);
      }
    };
    const installed = cleanCopy.install(instance.window.document, instance.window);
    assert.equal(installed.settings.outputMode, 'faithful');
    commands.get('Clean Math Copy: calculator-safe output')();
    assert.equal(installed.settings.outputMode, 'calculator');
    assert.equal(saved.at(-1).outputMode, 'calculator');

    resolveInitialRead({
      outputMode: 'latex',
      convertDelimitedLatex: false,
      cleanInvisibleArtifacts: false
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(installed.settings, {
      outputMode: 'calculator',
      convertDelimitedLatex: true,
      cleanInvisibleArtifacts: true
    });
  } finally {
    if (previousGM === undefined) delete global.GM;
    else global.GM = previousGM;
    if (previousRegister === undefined) delete global.GM_registerMenuCommand;
    else global.GM_registerMenuCommand = previousRegister;
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
  assert.equal(clipboard.get('text/plain'), 'Math: x = 2');
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
    assert.equal(await writtenItem.representations['text/plain'].text(), '1/√x');
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

test('serializes overlapping successful manual writes so the newest request remains final', async () => {
  const instance = dom([
    '<div id="first">', katex('<mi>x</mi>', 'x'), '</div>',
    '<div id="second">', katex('<mi>y</mi>', 'y'), '</div>'
  ].join(''));
  const firstTarget = instance.window.document.querySelector('#first');
  const secondTarget = instance.window.document.querySelector('#second');
  selectContents(instance.window, firstTarget);
  const commands = new Map();
  const attempts = [];
  const completeWrites = [];
  let finalClipboard = '';
  class FakeClipboardItem {
    constructor(representations) { this.representations = representations; }
  }
  Object.defineProperty(instance.window, 'Blob', { configurable: true, value: Blob });
  Object.defineProperty(instance.window, 'ClipboardItem', { configurable: true, value: FakeClipboardItem });
  Object.defineProperty(instance.window.navigator, 'clipboard', {
    configurable: true,
    value: {
      write(items) {
        const item = items[0];
        attempts.push(item);
        return new Promise((resolve) => {
          completeWrites.push(async () => {
            finalClipboard = await item.representations['text/plain'].text();
            resolve();
          });
        });
      }
    }
  });
  const previousRegister = global.GM_registerMenuCommand;
  const previousSetClipboard = global.GM_setClipboard;
  global.GM_registerMenuCommand = (name, callback) => commands.set(name, callback);
  global.GM_setClipboard = () => { throw new Error('rich clipboard path should win'); };
  try {
    cleanCopy.install(instance.window.document, instance.window);
    const command = commands.get('Clean Math Copy: copy current selection now');
    const older = command();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(attempts.length, 1);

    selectContents(instance.window, secondTarget);
    const newer = command();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(attempts.length, 1, 'newer write started before the older write settled');

    await completeWrites[0]();
    assert.equal(await older, false);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(attempts.length, 2);
    await completeWrites[1]();
    assert.equal(await newer, true);
    assert.equal(finalClipboard, 'y');
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
    const newer = command();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(attempts.length, 1);
    rejectFirst(new DOMException('custom representation rejected', 'NotSupportedError'));
    assert.equal(await older, false);
    assert.equal(await newer, true);
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
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(attempts.length, 2);
    assert.equal(await attempts[1].representations['text/plain'].text(), 'y');
    assert.equal(plainFallbackCalls, 0);
  } finally {
    if (previousRegister === undefined) delete global.GM_registerMenuCommand;
    else global.GM_registerMenuCommand = previousRegister;
    if (previousSetClipboard === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previousSetClipboard;
  }
});

test('replays a newer native keyboard copy after an already-started manual write finishes late', async () => {
  const instance = dom([
    '<div id="first">', katex('<mi>x</mi>', 'x'), '</div>',
    '<p id="second">new native text</p>'
  ].join(''));
  const firstTarget = instance.window.document.querySelector('#first');
  const secondTarget = instance.window.document.querySelector('#second');
  selectContents(instance.window, firstTarget);
  const commands = new Map();
  const attempts = [];
  let completeOlder = null;
  let finalClipboard = '';
  class FakeClipboardItem {
    constructor(representations) { this.representations = representations; }
  }
  Object.defineProperty(instance.window, 'Blob', { configurable: true, value: Blob });
  Object.defineProperty(instance.window, 'ClipboardItem', { configurable: true, value: FakeClipboardItem });
  Object.defineProperty(instance.window.navigator, 'clipboard', {
    configurable: true,
    value: {
      write(items) {
        const item = items[0];
        attempts.push(item);
        if (attempts.length === 1) {
          return new Promise((resolve) => {
            completeOlder = async () => {
              finalClipboard = await item.representations['text/plain'].text();
              resolve();
            };
          });
        }
        return item.representations['text/plain'].text().then((text) => {
          finalClipboard = text;
        });
      }
    }
  });
  const previousRegister = global.GM_registerMenuCommand;
  const previousSetClipboard = global.GM_setClipboard;
  global.GM_registerMenuCommand = (name, callback) => commands.set(name, callback);
  global.GM_setClipboard = () => { throw new Error('ClipboardItem path should win'); };
  try {
    cleanCopy.install(instance.window.document, instance.window);
    const older = commands.get('Clean Math Copy: copy current selection now')();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(typeof completeOlder, 'function');

    selectContents(instance.window, secondTarget);
    const keyboardEvent = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
    const eventClipboard = new Map();
    Object.defineProperty(keyboardEvent, 'clipboardData', {
      value: {
        get types() { return Array.from(eventClipboard.keys()); },
        clearData() { eventClipboard.clear(); },
        setData(type, value) { eventClipboard.set(type, value); },
        getData(type) { return eventClipboard.get(type) || ''; }
      }
    });
    secondTarget.dispatchEvent(keyboardEvent);
    assert.equal(keyboardEvent.defaultPrevented, false);
    // jsdom has no native clipboard implementation, so model the browser's
    // synchronous native copy before the older async write completes.
    finalClipboard = secondTarget.textContent;

    await completeOlder();
    assert.equal(await older, false);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(attempts.length, 2);
    assert.equal(finalClipboard, 'new native text');
    assert.equal(await attempts[1].representations['text/plain'].text(), 'new native text');
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
