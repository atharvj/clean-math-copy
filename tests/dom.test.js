'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const katexRenderer = require('katex');
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

function renderedKatex(source, display = false) {
  return katexRenderer.renderToString(source, {
    displayMode: display,
    output: 'htmlAndMathml',
    throwOnError: true
  });
}

function giveCssStackGeometry(root, left = 10, width = 60) {
  const rows = root.querySelectorAll(':scope > :nth-child(1), :scope > :nth-child(2)');
  rows[0].getBoundingClientRect = () => ({
    left, right: left + width, top: 10, bottom: 30, width, height: 20
  });
  rows[1].getBoundingClientRect = () => ({
    left, right: left + width, top: 31, bottom: 51, width, height: 20
  });
}

function cssStackTestRect(left, top, width, height) {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function giveNamedCssStackGeometry(documentObject, name, options = {}) {
  const left = options.left == null ? 10 : options.left;
  const top = options.top == null ? 10 : options.top;
  const width = options.width == null ? 60 : options.width;
  const rowHeight = options.rowHeight == null ? 20 : options.rowHeight;
  const gap = options.gap == null ? 2 : options.gap;
  const upper = documentObject.querySelector('[data-test-stack-row="' + name + '-top"]');
  const lower = documentObject.querySelector('[data-test-stack-row="' + name + '-bottom"]');
  if (!upper || !lower) throw new Error('Missing CSS-stack test rows for ' + name);
  upper.getBoundingClientRect = () => cssStackTestRect(left, top, width, rowHeight);
  lower.getBoundingClientRect = () => cssStackTestRect(
    left,
    top + rowHeight + gap,
    width,
    rowHeight
  );
  const rule = documentObject.querySelector('[data-test-stack-rule="' + name + '"]');
  if (rule) {
    rule.getBoundingClientRect = () => cssStackTestRect(left, top + rowHeight, width, gap);
  }
}

function cssStackLimitFixture() {
  const instance = dom([
    '<style>',
    '.lim,.intbl{display:inline-table;vertical-align:middle;text-align:center;margin:0 .12em}',
    '.lim>em,.lim>strong,.intbl>em,.intbl>strong{display:table-row;font-style:normal;font-weight:inherit}',
    '.intbl>em{border-bottom:.08em solid currentColor}',
    '</style>',
    '<p id="lead">And it is written in symbols as:</p>',
    '<p id="equation" class="center large">',
    '<span class="lim"><em>lim</em><strong>x→1</strong></span>',
    '<span class="intbl"><em>x<sup>2</sup>−1</em><strong>x−1</strong></span> = 2',
    '</p>'
  ].join(''), 'https://www.mathsisfun.com/calculus/limits.html');
  const document = instance.window.document;
  const limit = document.querySelector('.lim');
  const fraction = document.querySelector('.intbl');
  giveCssStackGeometry(limit, 10, 35);
  giveCssStackGeometry(fraction, 48, 60);
  return {
    instance,
    document,
    lead: document.querySelector('#lead'),
    equation: document.querySelector('#equation'),
    limit,
    fraction
  };
}

function selectRange(window, startContainer, startOffset, endContainer, endOffset) {
  const range = window.document.createRange();
  range.setStart(startContainer, startOffset);
  range.setEnd(endContainer, endOffset);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

function splitOldKatexNumericPower(root, insertInvisibleTimes = false) {
  const superscript = Array.from(root.querySelectorAll('.katex-mathml msup')).find((candidate) => {
    const children = Array.from(candidate.children || []);
    return children.length >= 2 && children[0].textContent === '10' &&
      children[1].textContent.replace(/[\s\u2212-]/gu, '') === '43';
  });
  if (!superscript) throw new Error('Expected a KaTeX 10^{-43} MathML power');
  const documentObject = superscript.ownerDocument;
  const namespace = superscript.namespaceURI || 'http://www.w3.org/1998/Math/MathML';
  const leadingDigit = documentObject.createElementNS(namespace, 'mn');
  leadingDigit.textContent = '1';
  superscript.firstElementChild.textContent = '0';
  superscript.before(leadingDigit);
  if (insertInvisibleTimes) {
    const invisibleTimes = documentObject.createElementNS(namespace, 'mo');
    invisibleTimes.textContent = '\u2062';
    superscript.before(invisibleTimes);
  }
  return superscript;
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

function macmillanMathJaxChtmlFixture(vectorSource = String.raw`\vec{J}=J\hat{z} `) {
  // Reduced from the live Macmillan/MathJax v3 CHTML tree. In CHTML, accents
  // occur before their bases in DOM order, and MathJax exposes the original
  // TeX through the MathItem associated with each mjx-container.
  const instance = dom([
    '<style>',
    'mjx-c { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }',
    'mjx-speech { position: absolute; }',
    '</style>',
    '<span data-test-id="equation-prefix"><span id="target">',
    'An infinitely long, straight, cylindrical wire of radius ',
    '<mjx-container id="radius" class="MathJax" jax="CHTML" has-speech="true">',
    '<mjx-math data-latex="R" aria-hidden="true">',
    '<mjx-mi data-latex="R"><mjx-c>𝑅</mjx-c></mjx-mi>',
    '</mjx-math><mjx-speech aria-label="R, math" role="img"></mjx-speech>',
    '</mjx-container>',
    ' has a uniform current density ',
    '<mjx-container id="vector" class="MathJax" jax="CHTML" has-speech="true">',
    '<mjx-math data-latex="', vectorSource, '" aria-hidden="true">',
    '<mjx-texatom data-latex="\\vec{J}"><mjx-mover>',
    '<mjx-over><mjx-mo data-semantic-role="overaccent" data-semantic-id="1"><mjx-c>⃗</mjx-c></mjx-mo></mjx-over>',
    '<mjx-base><mjx-mi data-latex="J" data-semantic-id="0"><mjx-c id="partial-base">𝐽</mjx-c></mjx-mi></mjx-base>',
    '</mjx-mover></mjx-texatom>',
    '<mjx-mo data-latex="=" data-semantic-id="3"><mjx-c>=</mjx-c></mjx-mo>',
    '<mjx-mrow><mjx-mi data-latex="J" data-semantic-id="4"><mjx-c>𝐽</mjx-c></mjx-mi>',
    '<mjx-mo data-semantic-added="true" data-semantic-id="8"><mjx-c>⁢</mjx-c></mjx-mo>',
    '<mjx-texatom data-latex="\\hat{z}"><mjx-mover>',
    '<mjx-over><mjx-mo data-semantic-role="overaccent" data-semantic-id="6"><mjx-c>ˆ</mjx-c></mjx-mo></mjx-over>',
    '<mjx-base><mjx-mi data-latex="z" data-semantic-id="5"><mjx-c>𝑧</mjx-c></mjx-mi></mjx-base>',
    '</mjx-mover></mjx-texatom></mjx-mrow>',
    '</mjx-math><mjx-speech aria-label="J right arrow equals J z hat, math" role="img"></mjx-speech>',
    '</mjx-container>',
    ' in cylindrical coordinates.',
    '</span></span>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  const radiusRoot = instance.window.document.querySelector('#radius');
  const vectorRoot = instance.window.document.querySelector('#vector');
  const mathItems = [
    { math: 'R', typesetRoot: radiusRoot },
    { math: vectorSource, typesetRoot: vectorRoot }
  ];
  const pageWindow = {
    MathJax: {
      startup: {
        document: {
          getMathItemsWithin(candidate) {
            return mathItems.filter((item) =>
              candidate === item.typesetRoot || (candidate.contains && candidate.contains(item.typesetRoot))
            );
          },
          math: mathItems
        }
      }
    }
  };
  return { instance, target, radiusRoot, vectorRoot, pageWindow };
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
  // Exact reduced form decoded from the reported live Google Docs private
  // clipboard slice. Docs leaves each opening parenthesis and number in the
  // surrounding row, then puts only the closing `)` in the superscript base.
  const power = () => ({ command: '\\superscript', args: [')', '2'] });
  return googleDocsSlice([{
    equation: [
      '|B|=√((27.187', power(), '+(17.479', power(), '+(-28.112', power(), ')'
    ]
  }, ' = 42.84 μT']);
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
    { outputMode: 'faithful' },
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
    cleanCopy.getCopyPayload(instance.window.document, selection, { outputMode: 'faithful' }, instance.window, target).text,
    'First x = 1, then y = 2.'
  );
});

test('supports original LaTeX output mode', () => {
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
  const payload = cleanCopy.getCopyPayload(instance.window.document, selection, { outputMode: 'faithful' }, instance.window, duplicate.parentElement);
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
    assert.equal(connectedDiscoveryScans, 0,
      'root discovery must not materialize an unbounded selector result');
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
    cleanCopy.getCopyPayload(instance.window.document, selection, { outputMode: 'faithful' }, instance.window, target).text,
    '(x + 1)/√y = a₁²'
  );
  assert.equal(cleanCopy.mathMLToUnicode(instance.window.document.querySelector('#matrix')), '[a, b; c, d]');
});

test('mixed native MathML replaces only a visibly and normally laid-out root', () => {
  const copy = (style) => {
    const instance = dom(
      '<p id="target">before <math' + (style ? ' style="' + style + '"' : '') +
        '><msup><mi>x</mi><mn>2</mn></msup></math> after</p>'
    );
    const target = instance.window.document.querySelector('#target');
    return cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      target
    );
  };

  assert.equal(copy('').text, 'before x² after');
  for (const style of [
    'display:none',
    'visibility:hidden',
    'opacity:0',
    'color:transparent',
    'position:absolute',
    'transform:scale(0)',
    'filter:opacity(0)',
    'clip-path:inset(100%)'
  ]) {
    assert.equal(copy(style), null, 'native MathML root layout must remain visible: ' + style);
  }
});

test('native MathML never promotes a computed-hidden presentation descendant', () => {
  const copy = (style, mixed) => {
    const instance = dom(
      (mixed ? '<p id="target">before ' : '<div id="target">') +
      '<math><mrow><mi>x</mi><mi style="' + style + '">SECRET</mi></mrow></math>' +
      (mixed ? ' after</p>' : '</div>')
    );
    const target = instance.window.document.querySelector('#target');
    const selectionTarget = mixed ? target : target.querySelector('math');
    return cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, selectionTarget),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      selectionTarget
    );
  };

  for (const style of [
    'display:none',
    'visibility:hidden',
    'opacity:0',
    'color:transparent',
    'position:absolute',
    'transform:scale(0)',
    'filter:opacity(0)',
    'clip-path:inset(100%)'
  ]) {
    assert.equal(copy(style, true), null, 'mixed MathML descendant must remain visible: ' + style);
    assert.equal(copy(style, false), null, 'whole MathML descendant must remain visible: ' + style);
  }
});

test('faithful MathML preserves compound scope, text punctuation, accents, and parallel versus norm', () => {
  const render = (markup) => {
    const instance = dom('<math>' + markup + '</math>');
    return cleanCopy.mathMLToFaithful(instance.window.document.querySelector('math'));
  };
  assert.equal(render('<mfrac><mn>1</mn><mrow><mn>2</mn><mi>a</mi><mi>b</mi></mrow></mfrac>'), '1/(2ab)');
  assert.equal(render('<mrow><mn>2</mn><mfrac><mn>1</mn><mn>3</mn></mfrac></mrow>'), '2 (1/3)');
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
  assert.equal(render('<mover><mi>x</mi><mo>⏞</mo></mover>'), 'overbrace(x)');
  assert.equal(render('<munder><mi>x</mi><mo>⏟</mo></munder>'), 'underbrace(x)');
  assert.equal(render('<mover><mover><mrow><mi>x</mi><mo>+</mo><mi>y</mi></mrow>' +
    '<mo>⏞</mo></mover><mi>n</mi></mover>'), 'overbrace(x + y)ⁿ');
  assert.equal(render('<munder><munder><mrow><mi>x</mi><mo>+</mo><mi>y</mi></mrow>' +
    '<mo>⏟</mo></munder><mi>n</mi></munder>'), 'underbrace(x + y)ₙ');
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

test('installed listener never replaces visible linear order from stale hidden MathML', () => {
  const instance = dom([
    '<span class="katex"><span class="katex-mathml"><math><semantics>',
    '<mrow><mi>x</mi><mo>−</mo><mi>y</mi></mrow>',
    '<annotation encoding="application/x-tex">x-y</annotation>',
    '</semantics></math></span><span id="visual" class="katex-html" aria-hidden="true">y−x</span></span>'
  ].join(''));
  const visual = instance.window.document.querySelector('#visual');
  selectContents(instance.window, visual);
  cleanCopy.install(instance.window.document, instance.window);
  const clipboard = new Map();
  visual.addEventListener('copy', (event) => {
    event.clipboardData.setData('text/plain', 'y−x');
    event.preventDefault();
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
  visual.dispatchEvent(event);
  assert.equal(clipboard.get('text/plain'), 'y−x');
});

test('hidden MathML agreement retains valid fraction, script, and accent layouts', () => {
  const cases = [
    ['<mfrac><mi>a</mi><mi>b</mi></mfrac>', 'ba', 'a/b'],
    ['<msup><mi>x</mi><mn>2</mn></msup>', 'x2', 'x²'],
    ['<mover accent="true"><mi>x</mi><mo>ˆ</mo></mover>', 'xˆ', 'x̂']
  ];
  for (const [presentation, visibleText, expected] of cases) {
    const instance = dom([
      '<span class="katex"><span class="katex-mathml"><math><semantics>', presentation,
      '<annotation encoding="application/x-tex">x</annotation>',
      '</semantics></math></span><span id="visual" class="katex-html" aria-hidden="true">',
      visibleText, '</span></span>'
    ].join(''));
    const visual = instance.window.document.querySelector('#visual');
    const payload = cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, visual),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      visual
    );
    assert.equal(payload && payload.text, expected, presentation);
  }

  const staleFraction = dom([
    '<span class="katex"><span class="katex-mathml"><math><semantics>',
    '<mfrac><mi>b</mi><mi>a</mi></mfrac>',
    '</semantics></math></span><span id="visual" class="katex-html" aria-hidden="true">ba</span></span>'
  ].join(''));
  const staleVisual = staleFraction.window.document.querySelector('#visual');
  assert.equal(cleanCopy.getCopyPayload(
    staleFraction.window.document,
    selectContents(staleFraction.window, staleVisual),
    cleanCopy.DEFAULT_SETTINGS,
    staleFraction.window,
    staleVisual
  ), null, 'visible denominator-first a/b must not agree with stale hidden b/a');
});

test('old KaTeX split numeric powers retain the complete visual script base', () => {
  const instance = dom(renderedKatex(String.raw`10^{-43}`, true));
  splitOldKatexNumericPower(instance.window.document);
  const visual = instance.window.document.querySelector('.katex-html');

  const faithful = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, visual),
    { outputMode: 'faithful' },
    instance.window,
    visual
  );
  assert.ok(faithful);
  assert.equal(faithful.text, '10⁻⁴³');

  const calculator = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, visual),
    { outputMode: 'calculator' },
    instance.window,
    visual
  );
  assert.ok(calculator);
  assert.equal(calculator.text, '10^(-43)');
  assert.doesNotMatch(calculator.text, /1\s*\*\s*0/u);
});

test('partial old-KaTeX powers join every selected base digit without widening the selection', () => {
  const instance = dom(renderedKatex(String.raw`2.08\times10^{-43}x`, true));
  splitOldKatexNumericPower(instance.window.document);
  const visual = instance.window.document.querySelector('.katex-html');
  const walker = instance.window.document.createTreeWalker(visual, instance.window.NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) {
    if (walker.currentNode.data) textNodes.push(walker.currentNode);
  }
  const leading = textNodes.find((node) => node.data === '1');
  const scriptedBase = textNodes.find((node) => node.data === '0');
  const exponent = textNodes.find((node) => node.data === '43');
  const coefficient = textNodes.find((node) => node.data === '2.08');
  assert.ok(leading && scriptedBase && exponent && coefficient);

  const copyRange = (start, end, outputMode) => {
    const range = instance.window.document.createRange();
    range.setStart(start, 0);
    range.setEnd(end, end.data.length);
    const selection = instance.window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return cleanCopy.getCopyPayload(
      instance.window.document,
      selection,
      { outputMode },
      instance.window,
      visual
    );
  };
  const copyThroughExponent = (start, outputMode) => copyRange(start, exponent, outputMode);

  const completeExpectations = {
    faithful: '10⁻⁴³',
    calculator: '10^(-43)',
    latex: '${10}^{-43}$'
  };
  const strictExpectations = {
    faithful: '0⁻⁴³',
    calculator: '0^(-43)',
    latex: '${0}^{-43}$'
  };
  for (const outputMode of ['faithful', 'calculator', 'latex']) {
    const complete = copyThroughExponent(leading, outputMode);
    assert.ok(complete, outputMode + ' complete');
    assert.equal(complete.text, completeExpectations[outputMode], outputMode + ' complete');
    const strict = copyThroughExponent(scriptedBase, outputMode);
    assert.ok(strict, outputMode + ' strict');
    assert.equal(strict.text, strictExpectations[outputMode], outputMode + ' strict');
  }

  for (const [outputMode, expected] of Object.entries({
    faithful: '10', calculator: '10', latex: '$10$'
  })) {
    const baseOnly = copyRange(leading, scriptedBase, outputMode);
    assert.ok(baseOnly, outputMode + ' base only');
    assert.equal(baseOnly.text, expected, outputMode + ' base only');
  }
  for (const [outputMode, expected] of Object.entries({
    faithful: '2.08 × 10⁻⁴³',
    calculator: '2.08*10^(-43)',
    latex: '$2.08\\times {10}^{-43}$'
  })) {
    const withCoefficient = copyThroughExponent(coefficient, outputMode);
    assert.ok(withCoefficient, outputMode + ' with coefficient');
    assert.equal(withCoefficient.text, expected, outputMode + ' with coefficient');
  }
});

test('old KaTeX split numeric powers do not force mixed prose and display math to native duplicate copy', () => {
  const inline = renderedKatex(String.raw`\text{length}^{-2}`);
  const display = renderedKatex(
    String.raw`\frac{8\pi G}{c^4} = 2.08 \times 10^{-43} \frac{\text{meter}^{-2}}{\text J / \text{meter}^3}.`,
    true
  );
  const instance = dom([
    '<section id="target"><p>In Cartesian coordinates, the curvature tensor has units of ',
    inline,
    '. The numerical factor relating energy and curvature is</p>',
    display,
    '</section><p id="after">Following text.</p>'
  ].join(''));
  splitOldKatexNumericPower(instance.window.document.querySelector('.katex-display'));
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    { outputMode: 'faithful' },
    instance.window,
    target
  );

  const expected = 'In Cartesian coordinates, the curvature tensor has units of length⁻². ' +
    'The numerical factor relating energy and curvature is\n\n' +
    '8πG/c⁴ = 2.08 × 10⁻⁴³ (meter⁻²/(J/meter³)).';
  assert.ok(payload);
  assert.equal(payload.reason, 'rendered-math');
  assert.equal(payload.text, expected);
  assert.equal((payload.text.match(/\n/gu) || []).length, 2);
  assert.doesNotMatch(payload.text + payload.html, /\\(?:text|frac|times)|DUPLICATE/u);

  // Chromium can terminate a real mouse drag on the direct inner `.katex`
  // wrapper at offset 2 (after its hidden semantic and visible branches),
  // instead of after the canonical `.katex-display` root.
  const firstParagraph = target.querySelector('p');
  const displayRoot = target.querySelector('.katex-display');
  const rendererWrapper = displayRoot.querySelector('.katex');
  assert.equal(rendererWrapper.parentElement, displayRoot);
  assert.equal(rendererWrapper.childNodes.length, 2);
  const mouseRange = instance.window.document.createRange();
  mouseRange.setStart(firstParagraph.firstChild, 0);
  mouseRange.setEnd(rendererWrapper, rendererWrapper.childNodes.length);
  const selection = instance.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(mouseRange);

  const mouseExpected = {
    faithful: expected,
    calculator: 'In Cartesian coordinates, the curvature tensor has units of (length)^(-2). ' +
      'The numerical factor relating energy and curvature is\n\n' +
      '((8*pi*G)/(c^(4)))=2.08*10^(-43)*((meter^(-2))/(J/meter^(3))).',
    latex: 'In Cartesian coordinates, the curvature tensor has units of $\\text{length}^{-2}$. ' +
      'The numerical factor relating energy and curvature is\n\n' +
      '$$\\frac{8\\pi G}{c^4} = 2.08 \\times 10^{-43} ' +
      '\\frac{\\text{meter}^{-2}}{\\text J / \\text{meter}^3}.$$'
  };
  for (const outputMode of ['faithful', 'calculator', 'latex']) {
    const mousePayload = cleanCopy.getCopyPayload(
      instance.window.document,
      selection,
      { outputMode },
      instance.window,
      rendererWrapper
    );
    assert.ok(mousePayload, outputMode);
    assert.equal(mousePayload.reason, 'rendered-math', outputMode);
    assert.equal(mousePayload.text, mouseExpected[outputMode], outputMode);
    assert.doesNotMatch(mousePayload.text + mousePayload.html, /DUPLICATE|\\displaystyle/u, outputMode);
    if (outputMode !== 'latex') {
      assert.doesNotMatch(mousePayload.text, /\\(?:text|frac|times)/u, outputMode);
    }
    assert.equal((mousePayload.text.match(/\n/gu) || []).length, 2, outputMode);
  }

  const afterText = instance.window.document.querySelector('#after').firstChild;
  const reverseRange = instance.window.document.createRange();
  reverseRange.setStart(rendererWrapper, 0);
  reverseRange.setEnd(afterText, afterText.data.length);
  selection.removeAllRanges();
  selection.addRange(reverseRange);
  const reversePayload = cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    { outputMode: 'faithful' },
    instance.window,
    rendererWrapper
  );
  assert.ok(reversePayload);
  assert.equal(reversePayload.text,
    '8πG/c⁴ = 2.08 × 10⁻⁴³ (meter⁻²/(J/meter³)).\nFollowing text.');
  assert.doesNotMatch(reversePayload.text + reversePayload.html, /DUPLICATE|\\displaystyle/u);

  selection.removeAllRanges();
  selection.addRange(mouseRange);
  const equationLabel = instance.window.document.createElement('span');
  equationLabel.textContent = '(1)';
  displayRoot.appendChild(equationLabel);
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    { outputMode: 'faithful' },
    instance.window,
    rendererWrapper
  ), null, 'a sibling equation label makes the outer boundary non-atomic');
  equationLabel.remove();

  // Offset 1 sits between the hidden MathML and visible HTML branches. It is
  // not a whole-renderer boundary and must never be widened to the equation.
  const partialRange = mouseRange.cloneRange();
  partialRange.setEnd(rendererWrapper, 1);
  selection.removeAllRanges();
  selection.addRange(partialRange);
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    { outputMode: 'faithful' },
    instance.window,
    rendererWrapper
  ), null);
});

test('KaTeX numeric script bases stay inside their fraction branch', () => {
  const cases = new Map([
    [String.raw`\frac{0^2}{5}`, '0²/5'],
    [String.raw`\frac{10^{-43}}{5}`, '10⁻⁴³/5'],
    [String.raw`\frac{5}{10^{-43}}`, '5/10⁻⁴³']
  ]);
  for (const [source, expected] of cases) {
    const instance = dom(renderedKatex(source, true));
    const visual = instance.window.document.querySelector('.katex-html');
    const payload = cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, visual),
      { outputMode: 'faithful' },
      instance.window,
      visual
    );
    assert.ok(payload, source);
    assert.equal(payload.text, expected, source);
  }
});

test('old KaTeX numeric recovery never crosses an explicit invisible multiplication', () => {
  const instance = dom(renderedKatex(String.raw`10^{-43}`, true));
  splitOldKatexNumericPower(instance.window.document, true);
  const visual = instance.window.document.querySelector('.katex-html');
  for (const outputMode of ['faithful', 'calculator']) {
    assert.equal(cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, visual),
      { outputMode },
      instance.window,
      visual
    ), null, outputMode);
  }
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
      String.raw`\frac{a}{bc}`,
      'bac'
    ),
    '(a/b)c'
  );
  assert.equal(
    copy(
      '<mfrac><mi>a</mi><mrow><mi>b</mi><mi>c</mi></mrow></mfrac>',
      String.raw`\frac ab c`,
      'bca'
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

test('rejects an over-wide math tree before materializing its child collection', () => {
  const instance = dom('<math id="wide"></math>');
  const wide = instance.window.document.querySelector('#wide');
  const fragment = instance.window.document.createDocumentFragment();
  for (let index = 0; index < 5001; index += 1) {
    const token = instance.window.document.createElementNS(
      'http://www.w3.org/1998/Math/MathML',
      'mi'
    );
    token.textContent = 'x';
    fragment.appendChild(token);
  }
  wide.appendChild(fragment);
  Object.defineProperty(wide, 'children', {
    configurable: true,
    get() {
      throw new Error('the complete untrusted child collection was materialized');
    }
  });
  let payload;
  assert.doesNotThrow(() => {
    payload = cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, wide),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      wide
    );
  });
  assert.equal(payload, null);
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
    cleanCopy.getCopyPayload(instance.window.document, selectContents(instance.window, target), { outputMode: 'faithful' }, instance.window, target).text,
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
    cleanCopy.getCopyPayload(instance.window.document, selection, { outputMode: 'faithful' }, pageWindow, target).text,
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
      { outputMode: 'faithful' },
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

test('source-only SVG math never replaces a different visible token order', () => {
  const copy = (source, visible) => {
    const instance = dom('<mjx-container id="math"><svg><text>' + visible + '</text></svg></mjx-container>');
    const root = instance.window.document.querySelector('#math');
    const pageWindow = {
      MathJax: {
        startup: {
          document: {
            getMathItemsWithin(candidate) {
              return candidate === root ? [{ math: source }] : [];
            }
          }
        }
      }
    };
    return cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, root),
      cleanCopy.DEFAULT_SETTINGS,
      pageWindow,
      root
    );
  };

  assert.equal(copy('x-y', 'x−y').text, 'x − y');
  assert.equal(copy('x+y', 'x+y').text, 'x + y');
  assert.equal(copy('x-y', 'y−x'), null);
  assert.equal(copy('x+y', 'y+x'), null);
  assert.equal(copy('x/y', 'xy'), null, 'SVG metadata cannot inject a missing division slash');
  assert.equal(copy('(x)', ')x('), null, 'SVG metadata cannot reorder visible fences');
  assert.equal(copy('x/y,z', 'x,y/z'), null,
    'SVG metadata cannot move authored separators between otherwise identical anchors');
});

test('copies the reported Macmillan inline-vector sentence from its live MathJax CHTML shape', () => {
  const { instance, target, pageWindow } = macmillanMathJaxChtmlFixture();
  assert.match(instance.window.getComputedStyle(target.querySelector('mjx-c')).clipPath, /^polygon\(/u);
  assert.equal(instance.window.getComputedStyle(target.querySelector('mjx-speech')).position, 'absolute');
  const selection = selectContents(instance.window, target);
  assert.equal(
    selection.toString(),
    'An infinitely long, straight, cylindrical wire of radius 𝑅 has a uniform current density ' +
      '⃗𝐽=𝐽⁢ˆ𝑧 in cylindrical coordinates.'
  );
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    cleanCopy.DEFAULT_SETTINGS,
    pageWindow,
    target
  );
  assert.ok(payload, 'the exact live CHTML selection must produce a semantic clipboard payload');
  assert.equal(
    payload.text,
    'An infinitely long, straight, cylindrical wire of radius R has a uniform current density ' +
      'J⃗ = Jẑ in cylindrical coordinates.'
  );
  assert.doesNotMatch(payload.text, /[\n\r\u2061-\u2064\u{1d400}-\u{1d7ff}]/u);
});

test('the installed copy listener rewrites the reported Macmillan CHTML selection', () => {
  const { instance, target, pageWindow } = macmillanMathJaxChtmlFixture();
  instance.window.MathJax = pageWindow.MathJax;
  // The live selection included a collapsible boundary space after the final
  // sentence. Both clipboard representations must drop it.
  target.appendChild(instance.window.document.createTextNode(' '));
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const clipboard = new Map();
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      get types() { return Array.from(clipboard.keys()); },
      clearData(type) { if (arguments.length) clipboard.delete(type); else clipboard.clear(); },
      setData(type, value) { clipboard.set(type, value); },
      getData(type) { return clipboard.get(type) || ''; }
    }
  });
  target.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(
    clipboard.get('text/plain'),
    'An infinitely long, straight, cylindrical wire of radius R has a uniform current density ' +
      'J⃗ = Jẑ in cylindrical coordinates.'
  );
  const rich = new JSDOM(clipboard.get('text/html') || '').window.document.body.textContent;
  assert.equal(rich.endsWith(' '), false);
  assert.equal(rich.endsWith('\n'), false);
  assert.match(rich, /in cylindrical coordinates\.$/u);
});

test('Macmillan CHTML uses direct mjx-math TeX when page-world MathJax is unavailable', () => {
  const { instance, target } = macmillanMathJaxChtmlFixture();
  assert.equal(instance.window.MathJax, undefined);
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.ok(payload, 'direct mjx-math data-latex must survive userscript page-world isolation');
  assert.equal(
    payload.text,
    'An infinitely long, straight, cylindrical wire of radius R has a uniform current density ' +
      'J⃗ = Jẑ in cylindrical coordinates.'
  );
});

test('Macmillan source-only CHTML never widens a strict partial vector selection', () => {
  const { instance, vectorRoot, pageWindow } = macmillanMathJaxChtmlFixture();
  const textNode = instance.window.document.querySelector('#partial-base').firstChild;
  const range = instance.window.document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, textNode.nodeValue.length);
  const selection = instance.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  assert.equal(selection.toString(), '𝐽');
  assert.equal(
    cleanCopy.getCopyPayload(
      instance.window.document,
      selection,
      cleanCopy.DEFAULT_SETTINGS,
      pageWindow,
      vectorRoot
    ),
    null
  );
});

test('Macmillan CHTML source mapping requires exact identifiers, operators, and accents', () => {
  const copyVector = (source) => {
    const { instance, vectorRoot, pageWindow } = macmillanMathJaxChtmlFixture(source);
    return cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, vectorRoot),
      cleanCopy.DEFAULT_SETTINGS,
      pageWindow,
      vectorRoot
    );
  };
  assert.equal(copyVector(String.raw`\vec{J}=J\hat{z} `).text, 'J⃗ = Jẑ');

  const staleSources = [
    String.raw`J=Jz `,
    String.raw`\vec{J}=Jz `,
    String.raw`J=J\hat{z} `,
    String.raw`\hat{J}=J\vec{z} `,
    String.raw`\bar{J}=J\hat{z} `,
    String.raw`\vec{J}=J\bar{z} `,
    String.raw`\overleftarrow{J}=J\hat{z} `,
    String.raw`\vec{K}=J\hat{z} `,
    String.raw`\vec{J}\ne J\hat{z} `
  ];
  for (const source of staleSources) {
    assert.equal(
      copyVector(source),
      null,
      'stale source must not replace the visual selection: ' + source
    );
  }
});

test('direct MathJax CHTML source mapping preserves authored token order', () => {
  const copy = (source, visible) => {
    const instance = dom(
      '<p id="target">before <mjx-container class="MathJax"><mjx-math data-latex="' +
        source.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '">' + visible +
      '</mjx-math></mjx-container> after</p>'
    );
    const target = instance.window.document.querySelector('#target');
    return cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      target
    );
  };
  assert.equal(copy('x-y', 'x−y').text, 'before x − y after');
  assert.equal(copy('x-y', 'y−x'), null);
  assert.equal(copy(String.raw`\frac{x}{y}`, 'yx'), null);
  assert.equal(copy('x=2*y+1', 'y=2*x+1'), null);
  assert.equal(copy(
    String.raw`\acute{x}`,
    '<mjx-mover data-latex="\\acute{x}"><mjx-base data-semantic-id="0">x</mjx-base>' +
      '<mjx-over data-semantic-id="1">ˊ</mjx-over></mjx-mover>'
  ).text, 'before x́ after');
  assert.equal(copy(
    String.raw`\acute{x}`,
    '<mjx-mover data-latex="\\acute{x}"><mjx-over data-semantic-id="1">ˊ</mjx-over>' +
      '<mjx-base data-semantic-id="0">x</mjx-base></mjx-mover>'
  ).text, 'before x́ after');

  const integral = dom([
    '<mjx-container id="target"><mjx-math data-latex="\\int_0^1 x^2\\,dx">',
    '<mjx-msubsup data-latex="\\int_0^1" data-semantic-role="integral">',
    '<mjx-mo data-semantic-id="0">∫</mjx-mo><mjx-script>',
    '<mjx-mn data-semantic-id="2">1</mjx-mn><mjx-mn data-semantic-id="1">0</mjx-mn>',
    '</mjx-script></mjx-msubsup>',
    '<mjx-msup data-latex="x^2"><mjx-mi data-semantic-id="4">x</mjx-mi>',
    '<mjx-mn data-semantic-id="5">2</mjx-mn></mjx-msup>',
    '<mjx-mi data-semantic-id="8">d</mjx-mi><mjx-mi data-semantic-id="9">x</mjx-mi>',
    '</mjx-math></mjx-container>'
  ].join(''));
  const integralTarget = integral.window.document.querySelector('#target');
  assert.equal(
    cleanCopy.getCopyPayload(
      integral.window.document,
      selectContents(integral.window, integralTarget),
      cleanCopy.DEFAULT_SETTINGS,
      integral.window,
      integralTarget
    ).text,
    '∫₀¹ x² dx'
  );

  const sum = dom([
    '<mjx-container id="target"><mjx-math data-latex="\\sum_{i=1}^{n}i^2">',
    '<mjx-munderover data-latex="\\sum_{i=1}^{n}" data-semantic-role="sum">',
    '<mjx-over><mjx-mi data-semantic-id="5">n</mjx-mi></mjx-over>',
    '<mjx-box><mjx-mo data-semantic-id="0">∑</mjx-mo><mjx-under>',
    '<mjx-mi data-semantic-id="1">i</mjx-mi><mjx-mo data-semantic-id="2">=</mjx-mo>',
    '<mjx-mn data-semantic-id="3">1</mjx-mn></mjx-under></mjx-box></mjx-munderover>',
    '<mjx-msup data-latex="i^2"><mjx-mi data-semantic-id="7">i</mjx-mi>',
    '<mjx-mn data-semantic-id="8">2</mjx-mn></mjx-msup>',
    '</mjx-math></mjx-container>'
  ].join(''));
  const sumTarget = sum.window.document.querySelector('#target');
  assert.equal(
    cleanCopy.getCopyPayload(
      sum.window.document,
      selectContents(sum.window, sumTarget),
      cleanCopy.DEFAULT_SETTINGS,
      sum.window,
      sumTarget
    ).text,
    '∑ᵢ₌₁ⁿ i²'
  );

  const overline = dom([
    '<mjx-container id="target"><mjx-math data-latex="\\overline{a+b}">',
    '<mjx-mover data-latex="\\overline{a+b}"><mjx-over><mjx-mo data-semantic-id="3">――――</mjx-mo></mjx-over>',
    '<mjx-base><mjx-mi data-semantic-id="0">a</mjx-mi>',
    '<mjx-mo data-semantic-id="1">+</mjx-mo><mjx-mi data-semantic-id="2">b</mjx-mi>',
    '</mjx-base></mjx-mover></mjx-math></mjx-container>'
  ].join(''));
  const overlineTarget = overline.window.document.querySelector('#target');
  assert.equal(
    cleanCopy.getCopyPayload(
      overline.window.document,
      selectContents(overline.window, overlineTarget),
      cleanCopy.DEFAULT_SETTINGS,
      overline.window,
      overlineTarget
    ).text,
    'overline(a + b)'
  );

  const underline = dom([
    '<mjx-container id="target"><mjx-math data-latex="\\underline{x}">',
    '<mjx-munder data-latex="\\underline{x}"><mjx-base><mjx-mi data-semantic-id="0">x</mjx-mi></mjx-base>',
    '<mjx-under><mjx-mo data-semantic-id="1">――</mjx-mo></mjx-under>',
    '</mjx-munder></mjx-math></mjx-container>'
  ].join(''));
  const underlineTarget = underline.window.document.querySelector('#target');
  assert.equal(
    cleanCopy.getCopyPayload(
      underline.window.document,
      selectContents(underline.window, underlineTarget),
      cleanCopy.DEFAULT_SETTINGS,
      underline.window,
      underlineTarget
    ).text,
    'x̲'
  );
});

test('direct MathJax CHTML source mapping requires matching authored structure', () => {
  const copy = (source, visible) => {
    const instance = dom(
      '<mjx-container id="target" class="MathJax"><mjx-math data-latex="' +
        source.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '">' + visible +
      '</mjx-math></mjx-container>'
    );
    const target = instance.window.document.querySelector('#target');
    return cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      target
    );
  };

  const visibleSup = [
    '<mjx-msup data-latex="x^2"><mjx-mi data-semantic-id="0">x</mjx-mi>',
    '<mjx-script><mjx-mn data-semantic-id="1">2</mjx-mn></mjx-script></mjx-msup>'
  ].join('');
  const visibleSub = [
    '<mjx-msub data-latex="x_2"><mjx-mi data-semantic-id="0">x</mjx-mi>',
    '<mjx-script><mjx-mn data-semantic-id="1">2</mjx-mn></mjx-script></mjx-msub>'
  ].join('');
  const visibleRoot = [
    '<mjx-msqrt data-latex="\\sqrt{x}"><mjx-sqrt><mjx-box>',
    '<mjx-mi>x</mjx-mi></mjx-box></mjx-sqrt></mjx-msqrt>'
  ].join('');
  const visibleFraction = [
    '<mjx-mfrac data-latex="\\frac{x}{y}"><mjx-frac>',
    '<mjx-num><mjx-mi>x</mjx-mi></mjx-num>',
    '<mjx-den><mjx-mi>y</mjx-mi></mjx-den>',
    '</mjx-frac></mjx-mfrac>'
  ].join('');

  assert.equal(copy('x^2', visibleSup).text, 'x²');
  assert.equal(copy('x_2', visibleSub).text, 'x₂');
  assert.equal(copy(String.raw`\sqrt{x}`, visibleRoot).text, '√x');
  assert.equal(copy(String.raw`\frac{x}{y}`, visibleFraction).text, 'x/y');

  const outsideFraction = [
    '<mjx-mi data-semantic-id="0">x</mjx-mi>',
    '<mjx-mfrac data-latex="\\frac{y}{z}"><mjx-frac>',
    '<mjx-num><mjx-mi data-semantic-id="1">y</mjx-mi></mjx-num>',
    '<mjx-den><mjx-mi data-semantic-id="2">z</mjx-mi></mjx-den>',
    '</mjx-frac></mjx-mfrac>'
  ].join('');
  assert.equal(copy(String.raw`\frac{xy}{z}`, outsideFraction), null,
    'a fraction cannot absorb an adjacent visible factor');

  const outsidePower = [
    '<mjx-mi data-semantic-id="0">x</mjx-mi>',
    '<mjx-msup data-latex="y^2"><mjx-mi data-semantic-id="1">y</mjx-mi>',
    '<mjx-script><mjx-mn data-semantic-id="2">2</mjx-mn></mjx-script></mjx-msup>'
  ].join('');
  assert.equal(copy('(xy)^2', outsidePower), null,
    'a superscript cannot absorb an adjacent visible factor into its base');

  const outsideRoot = [
    '<mjx-mi data-semantic-id="0">x</mjx-mi>',
    '<mjx-msqrt data-latex="\\sqrt{y}"><mjx-sqrt><mjx-surd>√</mjx-surd>',
    '<mjx-box><mjx-mi data-semantic-id="1">y</mjx-mi></mjx-box></mjx-sqrt></mjx-msqrt>'
  ].join('');
  assert.equal(copy(String.raw`\sqrt{xy}`, outsideRoot), null,
    'a radical cannot absorb an adjacent visible factor into its radicand');

  const outsideAccent = [
    '<mjx-mi data-semantic-id="0">x</mjx-mi>',
    '<mjx-texatom data-latex="\\hat{y}"><mjx-mover>',
    '<mjx-over><mjx-mo data-semantic-id="2">ˆ</mjx-mo></mjx-over>',
    '<mjx-base><mjx-mi data-semantic-id="1">y</mjx-mi></mjx-base>',
    '</mjx-mover></mjx-texatom>'
  ].join('');
  assert.equal(copy(String.raw`\hat{xy}`, outsideAccent), null,
    'an accent cannot absorb an adjacent visible factor into its base');

  const outsideTable = [
    '<mjx-mi data-semantic-id="0">x</mjx-mi>',
    '<mjx-texatom data-latex="\\begin{matrix}y&amp;z\\end{matrix}">',
    '<mjx-mtable><mjx-table><mjx-itable><mjx-mtr>',
    '<mjx-mtd><mjx-mi data-semantic-id="1">y</mjx-mi></mjx-mtd>',
    '<mjx-mtd><mjx-mi data-semantic-id="2">z</mjx-mi></mjx-mtd>',
    '</mjx-mtr></mjx-itable></mjx-table></mjx-mtable></mjx-texatom>'
  ].join('');
  assert.equal(copy(String.raw`\begin{matrix}xy&z\end{matrix}`, outsideTable), null,
    'a table cannot absorb an adjacent visible factor into its first cell');

  assert.equal(copy('x_2', visibleSup), null, 'an msup surface cannot be rewritten as a subscript');
  assert.equal(copy('x^2', visibleSub), null, 'an msub surface cannot be rewritten as a superscript');
  assert.equal(copy(String.raw`\sqrt{x}`, '<mjx-mi>x</mjx-mi>'), null,
    'a radical source requires a visible radical layout tag');
  assert.equal(copy(String.raw`\frac{x}{y}`, '<mjx-mi>x</mjx-mi><mjx-mi>y</mjx-mi>'), null,
    'a fraction source requires a visible fraction layout tag');
  assert.equal(copy('x', visibleRoot), null, 'visible radical layout cannot be flattened by stale plain metadata');
  assert.equal(copy('xy', visibleFraction), null, 'visible fraction layout cannot be flattened by stale plain metadata');

  const punctuationControls = [
    ['x/y', 'x/y', 'x/y'],
    ['|x|', '|x|', '|x|'],
    ['(x)', '(x)', '(x)'],
    ['[x]', '[x]', '[x]'],
    ['x,y', 'x,y', 'x, y'],
    ['x:y;z', 'x:y;z', 'x:y; z'],
    ['12.3', '12.3', '12.3']
  ];
  for (const [source, visible, expected] of punctuationControls) {
    assert.equal(copy(source, visible).text, expected, 'visible authored punctuation: ' + source);
  }
  for (const [source, visible] of [
    ['x/y', 'xy'],
    ['|x|', 'x'],
    ['(x)', 'x'],
    ['[x]', 'x'],
    ['x,y', 'xy'],
    ['x:y;z', 'xyz'],
    ['12.3', '123']
  ]) {
    assert.equal(copy(source, visible), null, 'source cannot inject missing punctuation: ' + source);
  }
  assert.equal(copy('(x)', '<mjx-mo>)</mjx-mo><mjx-mi>x</mjx-mi><mjx-mo>(</mjx-mo>'), null,
    'source cannot reorder visible fences');
  assert.equal(copy('x/y,z', [
    '<mjx-mi>x</mjx-mi><mjx-mo>,</mjx-mo><mjx-mi>y</mjx-mi>',
    '<mjx-mo>/</mjx-mo><mjx-mi>z</mjx-mi>'
  ].join('')), null, 'source cannot move punctuation between matching visible anchors');

  const matrix = [
    '<mjx-texatom data-latex="\\begin{pmatrix}a&amp;b\\\\c&amp;d\\end{pmatrix}">',
    '<mjx-mo>(</mjx-mo><mjx-mtable><mjx-table>',
    '<mjx-itable><mjx-mtr><mjx-mtd><mjx-mi>a</mjx-mi></mjx-mtd>',
    '<mjx-mtd><mjx-mi>b</mjx-mi></mjx-mtd></mjx-mtr>',
    '<mjx-mtr><mjx-mtd><mjx-mi>c</mjx-mi></mjx-mtd>',
    '<mjx-mtd><mjx-mi>d</mjx-mi></mjx-mtd></mjx-mtr></mjx-itable>',
    '</mjx-table></mjx-mtable><mjx-mo>)</mjx-mo></mjx-texatom>'
  ].join('');
  assert.equal(
    copy(String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}`, matrix).text,
    '[a, b; c, d]'
  );
  assert.equal(copy('abcd', matrix), null, 'visible table layout requires matching table metadata');

  const citedPrimeFormula = [
    '<mjx-mo data-semantic-id="0">(</mjx-mo>',
    '<mjx-msup data-latex="y\'">',
    '<mjx-mi data-semantic-id="1">y</mjx-mi>',
    '<mjx-script><mjx-mo data-semantic-id="2">′</mjx-mo></mjx-script></mjx-msup>',
    '<mjx-msup data-latex=")^2"><mjx-mo data-semantic-id="3">)</mjx-mo>',
    '<mjx-script><mjx-mn data-semantic-id="4">2</mjx-mn></mjx-script></mjx-msup>',
    '<mjx-mo data-semantic-id="5">=</mjx-mo>',
    '<mjx-mn data-semantic-id="6">20</mjx-mn>',
    '<mjx-msup><mjx-mi data-semantic-id="7">x</mjx-mi>',
    '<mjx-script><mjx-mo data-semantic-id="8">′</mjx-mo></mjx-script></mjx-msup>'
  ].join('');
  assert.equal(copy("(y')^2=20x'", citedPrimeFormula).text, '(y′)² = 20x′');
  assert.equal(copy("(y')_2=20x'", citedPrimeFormula), null,
    'prime superscripts cannot conceal a stale ordinary subscript');

  assert.equal(copy('[x^2', '[<mjx-msup data-latex="x^2"><mjx-mi data-semantic-id="0">x</mjx-mi>' +
    '<mjx-script><mjx-mn data-semantic-id="1">2</mjx-mn></mjx-script></mjx-msup>').text, '[x²');
  assert.equal(copy('[0,1)', '[0,1)').text, '[0, 1)');
  assert.equal(copy('x]^2', 'x<mjx-msup data-latex="]^2"><mjx-mo data-semantic-id="0">]</mjx-mo>' +
    '<mjx-script><mjx-mn data-semantic-id="1">2</mjx-mn></mjx-script></mjx-msup>').text, 'x]²');
  assert.equal(copy('x}^2', visibleSup), null, 'unmatched TeX braces fail closed');

  assert.equal(copy(String.raw`x\sp 2`, visibleSup).text, 'x²');
  assert.equal(copy(String.raw`x\sb 2`, visibleSub).text, 'x₂');
  assert.equal(copy("f''", '<mjx-msup data-latex="f\'\'"><mjx-mi data-semantic-id="0">f</mjx-mi>' +
    '<mjx-script><mjx-mo data-semantic-id="1">″</mjx-mo></mjx-script></mjx-msup>').text, 'f′′');

  const prescript = [
    '<mjx-mmultiscripts data-latex="\\prescript{14}{6}{C}">',
    '<mjx-script><mjx-mn data-semantic-id="0">14</mjx-mn>',
    '<mjx-mn data-semantic-id="1">6</mjx-mn></mjx-script>',
    '<mjx-mi data-semantic-id="2">C</mjx-mi></mjx-mmultiscripts>'
  ].join('');
  assert.equal(copy(String.raw`\prescript{14}{6}{C}`, prescript).text, '¹⁴₆C');

  const nestedAccent = [
    '<mjx-msub data-latex="x_{\\hat y}"><mjx-mi data-semantic-id="0">x</mjx-mi>',
    '<mjx-script><mjx-texatom data-latex="{\\hat y}"><mjx-texatom data-latex="\\hat y">',
    '<mjx-mover><mjx-over><mjx-mo data-semantic-id="2">ˆ</mjx-mo></mjx-over>',
    '<mjx-base><mjx-mi data-semantic-id="1">y</mjx-mi></mjx-base></mjx-mover>',
    '</mjx-texatom></mjx-texatom></mjx-script></mjx-msub>'
  ].join('');
  assert.equal(copy(String.raw`x_{\hat y}`, nestedAccent).text, 'x_(ŷ)');
  assert.equal(copy(String.raw`x_{\hat y}`,
    '<mjx-msub data-latex="x_{y}"><mjx-mi data-semantic-id="0">x</mjx-mi>' +
    '<mjx-script><mjx-mi data-semantic-id="1">y</mjx-mi></mjx-script></mjx-msub>'), null,
  'a nested accent command requires its own visible accent structure');

  const nestedMovers = [
    '<mjx-texatom data-latex="\\hat{\\vec{x}}"><mjx-mover>',
    '<mjx-over><mjx-mo data-semantic-id="3">ˆ</mjx-mo></mjx-over>',
    '<mjx-base><mjx-texatom data-latex="\\vec{x}"><mjx-mover>',
    '<mjx-over><mjx-mo data-semantic-id="1">⃗</mjx-mo></mjx-over>',
    '<mjx-base><mjx-mi data-semantic-id="0">x</mjx-mi></mjx-base>',
    '</mjx-mover></mjx-texatom></mjx-base></mjx-mover></mjx-texatom>'
  ].join('');
  assert.equal(copy(String.raw`\hat{\vec{x}}`, nestedMovers).text, 'hat(x⃗)');
  assert.equal(copy(String.raw`\hat{x}`, nestedMovers), null,
    'two nested visible accents cannot agree with a one-accent source');

  const substack = [
    '<mjx-texatom data-latex="\\begin{subarray}{c}a\\\\b\\end{subarray}">',
    '<mjx-mtable><mjx-table><mjx-itable>',
    '<mjx-mtr><mjx-mtd><mjx-mi>a</mjx-mi></mjx-mtd></mjx-mtr>',
    '<mjx-mtr><mjx-mtd><mjx-mi>b</mjx-mi></mjx-mtd></mjx-mtr>',
    '</mjx-itable></mjx-table></mjx-mtable></mjx-texatom>'
  ].join('');
  assert.equal(copy(String.raw`\substack{a\\b}`, substack).text, 'a, b');

  const longArrow = [
    '<mjx-mover data-latex="\\overrightarrow{AB}">',
    '<mjx-over><mjx-mo data-semantic-id="2">−−−→</mjx-mo></mjx-over>',
    '<mjx-base><mjx-mi data-semantic-id="0">A</mjx-mi>',
    '<mjx-mi data-semantic-id="1">B</mjx-mi></mjx-base></mjx-mover>'
  ].join('');
  assert.equal(copy(String.raw`\overrightarrow{AB}`, longArrow).text, 'vec(AB)');

  const underbrace = [
    '<mjx-munder data-latex="\\underbrace{x+y}_{n\\text{ terms}}">',
    '<mjx-row><mjx-base><mjx-texatom data-latex="\\underbrace{x+y}"><mjx-munder>',
    '<mjx-row><mjx-base><mjx-mi data-semantic-id="0">x</mjx-mi>',
    '<mjx-mo data-semantic-id="1">+</mjx-mo><mjx-mi data-semantic-id="2">y</mjx-mi>',
    '</mjx-base></mjx-row><mjx-row><mjx-under>',
    '<mjx-mo data-semantic-id="4">⏟</mjx-mo></mjx-under></mjx-row>',
    '</mjx-munder></mjx-texatom></mjx-base></mjx-row>',
    '<mjx-row><mjx-under><mjx-mi data-semantic-id="6">n</mjx-mi>',
    '<mjx-mtext data-semantic-id="7"> terms</mjx-mtext></mjx-under></mjx-row>',
    '</mjx-munder>'
  ].join('');
  assert.equal(
    copy(String.raw`\underbrace{x+y}_{n\text{ terms}}`, underbrace).text,
    'underbrace(x + y)_(n terms)'
  );

  const overbrace = [
    '<mjx-mover data-latex="\\overbrace{x+y}^{n}">',
    '<mjx-over><mjx-mi data-semantic-id="6">n</mjx-mi></mjx-over>',
    '<mjx-base><mjx-texatom data-latex="\\overbrace{x+y}"><mjx-mover>',
    '<mjx-over><mjx-mo data-semantic-id="4">⏞</mjx-mo></mjx-over>',
    '<mjx-base><mjx-mi data-semantic-id="0">x</mjx-mi>',
    '<mjx-mo data-semantic-id="1">+</mjx-mo><mjx-mi data-semantic-id="2">y</mjx-mi>',
    '</mjx-base></mjx-mover></mjx-texatom></mjx-base></mjx-mover>'
  ].join('');
  assert.equal(copy(String.raw`\overbrace{x+y}^{n}`, overbrace).text, 'overbrace(x + y)ⁿ');

  const overbraceWithSubscript = [
    '<mjx-munder data-latex="\\overbrace{x}_n"><mjx-row><mjx-base>',
    '<mjx-texatom data-latex="\\overbrace{x}"><mjx-mover>',
    '<mjx-over><mjx-mo data-semantic-id="1">⏞</mjx-mo></mjx-over>',
    '<mjx-base><mjx-mi data-semantic-id="0">x</mjx-mi></mjx-base>',
    '</mjx-mover></mjx-texatom></mjx-base></mjx-row>',
    '<mjx-row><mjx-under><mjx-mi data-semantic-id="3">n</mjx-mi>',
    '</mjx-under></mjx-row></mjx-munder>'
  ].join('');
  assert.equal(copy(String.raw`\overbrace{x}_n`, overbraceWithSubscript).text, 'overbrace(x)ₙ');

  const underbraceWithSuperscript = [
    '<mjx-mover data-latex="\\underbrace{x}^n"><mjx-over>',
    '<mjx-mi data-semantic-id="3">n</mjx-mi></mjx-over><mjx-base>',
    '<mjx-texatom data-latex="\\underbrace{x}"><mjx-munder>',
    '<mjx-row><mjx-base><mjx-mi data-semantic-id="0">x</mjx-mi>',
    '</mjx-base></mjx-row><mjx-row><mjx-under>',
    '<mjx-mo data-semantic-id="1">⏟</mjx-mo></mjx-under></mjx-row>',
    '</mjx-munder></mjx-texatom></mjx-base></mjx-mover>'
  ].join('');
  assert.equal(copy(String.raw`\underbrace{x}^n`, underbraceWithSuperscript).text, 'underbrace(x)ⁿ');
});

test('direct MathJax CHTML authenticates live limit, cases, and binomial renderer shapes', () => {
  const copy = (source, visible) => {
    const instance = dom(
      '<mjx-container id="target" class="MathJax"><mjx-math data-latex="' +
        source.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '">' + visible +
      '</mjx-math></mjx-container>'
    );
    const target = instance.window.document.querySelector('#target');
    return cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      target
    );
  };

  const limit = [
    '<mjx-munder data-latex="\\lim_{x\\to0}" data-semantic-type="limlower">',
    '<mjx-row><mjx-base><mjx-mo data-semantic-id="0">lim</mjx-mo></mjx-base></mjx-row>',
    '<mjx-row><mjx-under><mjx-texatom data-latex="{x\\to0}">',
    '<mjx-mi data-semantic-id="1">x</mjx-mi><mjx-mo data-semantic-id="2">→</mjx-mo>',
    '<mjx-mn data-semantic-id="3">0</mjx-mn></mjx-texatom></mjx-under></mjx-row>',
    '</mjx-munder><mjx-mo data-semantic-id="4">⁡</mjx-mo>',
    '<mjx-mfrac data-latex="\\frac{\\sin x}{x}"><mjx-frac>',
    '<mjx-num><mjx-mi data-semantic-id="5">sin</mjx-mi>',
    '<mjx-mo data-semantic-id="6">⁡</mjx-mo><mjx-mi data-semantic-id="7">x</mjx-mi></mjx-num>',
    '<mjx-den><mjx-mi data-semantic-id="8">x</mjx-mi></mjx-den>',
    '</mjx-frac></mjx-mfrac>'
  ].join('');
  assert.equal(
    copy(String.raw`\lim_{x\to0}\frac{\sin x}{x}`, limit).text,
    'lim_(x → 0) (sin x)/x'
  );

  const cases = [
    '<mjx-texatom data-latex="\\begin{cases}x^2 &amp;x&gt;0\\\\-x&amp;x\\le0\\end{cases}">',
    '<mjx-mrow data-semantic-type="cases"><mjx-mo data-semantic-id="0">{</mjx-mo>',
    '<mjx-mtable><mjx-table><mjx-itable><mjx-mtr>',
    '<mjx-mtd><mjx-msup data-latex="x^2"><mjx-mi data-semantic-id="1">x</mjx-mi>',
    '<mjx-script><mjx-mn data-semantic-id="2">2</mjx-mn></mjx-script></mjx-msup></mjx-mtd>',
    '<mjx-mtd><mjx-mi data-semantic-id="3">x</mjx-mi><mjx-mo data-semantic-id="4">&gt;</mjx-mo>',
    '<mjx-mn data-semantic-id="5">0</mjx-mn></mjx-mtd></mjx-mtr><mjx-mtr>',
    '<mjx-mtd><mjx-mo data-semantic-id="6">−</mjx-mo><mjx-mi data-semantic-id="7">x</mjx-mi></mjx-mtd>',
    '<mjx-mtd><mjx-mi data-semantic-id="8">x</mjx-mi><mjx-mo data-semantic-id="9">≤</mjx-mo>',
    '<mjx-mn data-semantic-id="10">0</mjx-mn></mjx-mtd>',
    '</mjx-mtr></mjx-itable></mjx-table></mjx-mtable></mjx-mrow></mjx-texatom>'
  ].join('');
  assert.equal(
    copy(String.raw`\begin{cases}x^2&x>0\\-x&x\le0\end{cases}`, cases).text,
    '{x² if x > 0; −x if x ≤ 0}'
  );

  const binomial = [
    '<mjx-texatom data-latex="\\binom{n}{k}" data-semantic-role="binomial">',
    '<mjx-mo data-semantic-id="0">(</mjx-mo><mjx-mfrac><mjx-frac atop="true">',
    '<mjx-num><mjx-mi data-semantic-id="1">n</mjx-mi></mjx-num>',
    '<mjx-den><mjx-mi data-semantic-id="2">k</mjx-mi></mjx-den>',
    '</mjx-frac></mjx-mfrac><mjx-mo data-semantic-id="3">)</mjx-mo></mjx-texatom>'
  ].join('');
  assert.equal(copy(String.raw`\binom{n}{k}`, binomial).text, 'C(n, k)');
  const nestedBinomial = [
    '<mjx-texatom data-latex="\\binom{(n)}{k}" data-semantic-role="binomial">',
    '<mjx-mo data-semantic-id="0">(</mjx-mo><mjx-mfrac><mjx-frac atop="true">',
    '<mjx-num><mjx-mo>(</mjx-mo><mjx-mi data-semantic-id="1">n</mjx-mi><mjx-mo>)</mjx-mo></mjx-num>',
    '<mjx-den><mjx-mi data-semantic-id="2">k</mjx-mi></mjx-den>',
    '</mjx-frac></mjx-mfrac><mjx-mo data-semantic-id="3">)</mjx-mo></mjx-texatom>'
  ].join('');
  assert.equal(copy(String.raw`\binom{(n)}{k}`, nestedBinomial).text, 'C((n), k)');
  assert.equal(copy(String.raw`\binom{n}{k}`, binomial
    .replace('data-semantic-id="0">(</', 'data-semantic-id="0">)</')
    .replace('data-semantic-id="3">)</', 'data-semantic-id="3">(</')), null,
  'generated binomial fences must remain balanced and oriented');

  const unsupportedPrescript = [
    '<mjx-mtext data-latex="\\prescript" data-semantic-id="0">\\prescript</mjx-mtext>',
    '<mjx-mn data-semantic-id="1">14</mjx-mn><mjx-mn data-semantic-id="2">6</mjx-mn>',
    '<mjx-mi data-semantic-id="3">C</mjx-mi>'
  ].join('');
  assert.equal(copy(String.raw`\prescript{14}{6}{C}`, unsupportedPrescript), null);
  assert.equal(
    copy(String.raw`x\sp2+y\sb1`,
      '<mjx-mi data-semantic-id="0">x</mjx-mi><mjx-mtext data-semantic-id="1">\\sp</mjx-mtext>' +
      '<mjx-mn data-semantic-id="2">2</mjx-mn><mjx-mo data-semantic-id="3">+</mjx-mo>' +
      '<mjx-mi data-semantic-id="4">y</mjx-mi><mjx-mtext data-semantic-id="5">\\sb</mjx-mtext>' +
      '<mjx-mn data-semantic-id="6">1</mjx-mn>'),
    null
  );
});

test('direct MathJax structural agreement bounds aggregate renderer metadata work', () => {
  const instance = dom(
    '<mjx-container id="target"><mjx-math data-latex="\\hat{x}"></mjx-math></mjx-container>'
  );
  const target = instance.window.document.querySelector('#target');
  const math = target.querySelector('mjx-math');
  const moverCount = 96;
  for (let index = 0; index < moverCount; index += 1) {
    const mover = instance.window.document.createElement('mjx-mover');
    mover.setAttribute('data-latex', String.raw`\hat{` + 'x'.repeat(3000) + index + '}');
    mover.innerHTML = '<mjx-over>ˆ</mjx-over><mjx-base>x</mjx-base>';
    math.appendChild(mover);
  }
  assert.equal(
    cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      target
    ),
    null
  );
});

test('source-backed renderer metadata needs a genuinely visible selected surface', () => {
  const cases = [
    '',
    '<span style="display:none">x</span>',
    '<span style="opacity:0">x</span>',
    '<span style="clip-path:inset(50%)">x</span>',
    '<span style="clip-path:inset(100%)">x</span>',
    '<span style="clip-path:polygon(0 0,0 0,0 0)">x</span>',
    '<span style="clip-path:polygon(0 0,1px 1px,2px 2px)">x</span>',
    '<span style="position:absolute">x</span>',
    '<span style="transform:scale(0)">x</span>',
    '<span style="scale:0">x</span>',
    '<span style="zoom:0">x</span>',
    '<span style="filter:opacity(0)">x</span>',
    '<span style="mask-image:linear-gradient(transparent,transparent)">x</span>',
    '<span style="-webkit-mask-image:linear-gradient(transparent,transparent)">x</span>',
    '<span style="text-indent:-9999px">x</span>',
    '<span style="width:0;height:0;overflow:hidden">x</span>'
  ];
  for (const content of cases) {
    const instance = dom(
      '<p id="target">before <mjx-container class="MathJax">' +
        '<mjx-math data-latex="x">' + content + '</mjx-math>' +
      '</mjx-container> after</p>'
    );
    const target = instance.window.document.querySelector('#target');
    assert.equal(
      cleanCopy.getCopyPayload(
        instance.window.document,
        selectContents(instance.window, target),
        cleanCopy.DEFAULT_SETTINGS,
        instance.window,
        target
      ),
      null
    );
  }
  for (const style of [
    'display:none',
    'opacity:0',
    'clip-path:inset(100%)',
    'position:absolute'
  ]) {
    const instance = dom(
      '<p id="target">before <mjx-container class="MathJax" style="' + style + '">' +
        '<mjx-math data-latex="x">x</mjx-math>' +
      '</mjx-container> after</p>'
    );
    const target = instance.window.document.querySelector('#target');
    assert.equal(
      cleanCopy.getCopyPayload(
        instance.window.document,
        selectContents(instance.window, target),
        cleanCopy.DEFAULT_SETTINGS,
        instance.window,
        target
      ),
      null,
      'renderer root layout must remain visible: ' + style
    );
  }

  for (const style of [
    'clip-path:polygon(0 0,100% 0,100% 100%,0 100%)',
    'clip-path:polygon(-17.55px -2px,calc(100% + 17.55px) -2px,calc(100% + 17.55px) calc(100% + 2px),-17.55px calc(100% + 2px)) padding-box',
    'width:10px;height:10px;overflow:hidden',
    'scale:1;zoom:1'
  ]) {
    const instance = dom(
      '<p id="target">before <mjx-container class="MathJax">' +
        '<mjx-math data-latex="x"><span style="' + style + '">x</span></mjx-math>' +
      '</mjx-container> after</p>'
    );
    const target = instance.window.document.querySelector('#target');
    assert.equal(
      cleanCopy.getCopyPayload(
        instance.window.document,
        selectContents(instance.window, target),
        cleanCopy.DEFAULT_SETTINGS,
        instance.window,
        target
      ).text,
      'before x after',
      'visible renderer control: ' + style
    );
  }
});

test('source-less accessible labels never replace different selected text', () => {
  for (const markup of [
    '<span id="target" role="math" aria-label="SECRET">x</span>',
    '<span id="target" role="math"><img alt="SECRET"><span>x</span></span>'
  ]) {
    const instance = dom(markup);
    const target = instance.window.document.querySelector('#target');
    assert.equal(
      cleanCopy.getCopyPayload(
        instance.window.document,
        selectContents(instance.window, target),
        cleanCopy.DEFAULT_SETTINGS,
        instance.window,
        target
      ),
      null
    );
  }
});

test('source-less MathJax-like roots cannot leak hidden or duplicate content alone or in mixed prose', () => {
  const cases = [
    {
      name: 'display-none',
      markup: '<span id="risky" style="display:none">SECRET</span><mjx-c>x</mjx-c>',
      raw: 'before SECRETx after',
      computedProperty: 'display',
      computedValue: 'none'
    },
    {
      name: 'zero-opacity',
      markup: '<span id="risky" style="opacity:0">SECRET</span><mjx-c>x</mjx-c>',
      raw: 'before SECRETx after',
      computedProperty: 'opacity',
      computedValue: '0'
    },
    {
      name: 'clipped',
      markup: '<span id="risky" style="clip-path:inset(100%)">SECRET</span><mjx-c>x</mjx-c>',
      raw: 'before SECRETx after',
      computedProperty: 'clipPath',
      computedValue: 'inset(100%)'
    },
    {
      name: 'absolute-duplicate',
      markup: '<mjx-c id="risky" aria-hidden="true" style="position:absolute">x</mjx-c><mjx-c>x</mjx-c>',
      raw: 'before xx after',
      computedProperty: 'position',
      computedValue: 'absolute'
    }
  ];

  for (const testCase of cases) {
    const instance = dom(
      '<p id="target">before <mjx-container class="MathJax">' +
        testCase.markup +
      '</mjx-container> after</p>'
    );
    const target = instance.window.document.querySelector('#target');
    const mathRoot = instance.window.document.querySelector('mjx-container');
    const risky = instance.window.document.querySelector('#risky');
    assert.equal(
      instance.window.getComputedStyle(risky)[testCase.computedProperty],
      testCase.computedValue,
      testCase.name + ' fixture must exercise its intended layout risk'
    );
    const selection = selectContents(instance.window, target);
    assert.equal(selection.toString(), testCase.raw);
    assert.equal(
      cleanCopy.getCopyPayload(
        instance.window.document,
        selection,
        cleanCopy.DEFAULT_SETTINGS,
        instance.window,
        target
      ),
      null,
      testCase.name + ' must stay on the browser native copy path'
    );
    assert.equal(
      cleanCopy.getCopyPayload(
        instance.window.document,
        selectContents(instance.window, mathRoot),
        cleanCopy.DEFAULT_SETTINGS,
        instance.window,
        mathRoot
      ),
      null,
      testCase.name + ' must not leak through an exact whole-root selection either'
    );
  }
});

test('benign source-less MathJax-like roots also preserve native mixed-prose copying', () => {
  const instance = dom(
    '<p id="target">before <mjx-container class="MathJax"><mjx-c>x</mjx-c></mjx-container> after</p>'
  );
  const target = instance.window.document.querySelector('#target');
  const selection = selectContents(instance.window, target);
  assert.equal(selection.toString(), 'before x after');
  assert.equal(
    cleanCopy.getCopyPayload(
      instance.window.document,
      selection,
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      target
    ),
    null
  );
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
  assert.equal(cleanCopy.extractMathText(root, 'faithful', pageWindow), '√x');
});

test('reconstructs legacy CSS-stacked limits and fractions without leaking Markdown emphasis', () => {
  const { instance, document, lead, equation, limit } = cssStackLimitFixture();
  const limitTop = limit.firstElementChild.firstChild;
  const equationTail = equation.lastChild;
  const fullSelection = selectRange(
    instance.window,
    lead.firstChild,
    0,
    equationTail,
    equationTail.nodeValue.length
  );
  const full = cleanCopy.getCopyPayload(
    document,
    fullSelection,
    { outputMode: 'faithful' },
    instance.window,
    equation
  );
  assert.equal(full.reason, 'css-stacked-math');
  assert.equal(
    full.text,
    'And it is written in symbols as:\n\nlim_(x → 1) (x² − 1)/(x − 1) = 2'
  );
  assert.equal(/[\n\r\s]$/u.test(full.text), false);
  assert.match(full.html, /x<sup>2<\/sup> − 1/u);
  assert.doesNotMatch(full.html, /<(?:em|strong)\b|class=|\*lim\*|\*\*/iu);

  const formulaSelection = selectRange(
    instance.window,
    limitTop,
    0,
    equationTail,
    equationTail.nodeValue.length
  );
  const expected = {
    faithful: 'lim_(x → 1) (x² − 1)/(x − 1) = 2',
    calculator: 'limit(((x^(2)-1)/(x-1)),x->1) = 2',
    latex: '$\\lim_{x\\to 1}\\frac{x^{2}-1}{x-1}$ = 2'
  };
  for (const [outputMode, text] of Object.entries(expected)) {
    const payload = cleanCopy.getCopyPayload(
      document,
      formulaSelection,
      { outputMode },
      instance.window,
      equation
    );
    assert.equal(payload.reason, 'css-stacked-math', outputMode);
    assert.equal(payload.text, text, outputMode);
    assert.doesNotMatch(payload.html, /<(?:em|strong)\b|class=/iu, outputMode);
  }
  assert.equal(
    cleanCopy.getCopyPayload(document, formulaSelection, { outputMode: 'native' }, instance.window, equation),
    null,
    'Original copy/paste remains a hard opt-out'
  );
});

test('CSS-stacked math keeps every strict partial selection exact', () => {
  const { instance, document, equation, limit, fraction } = cssStackLimitFixture();
  const topLimit = limit.firstElementChild.firstChild;
  const lowerLimit = limit.lastElementChild.firstChild;
  const numerator = fraction.firstElementChild;
  const denominator = fraction.lastElementChild.firstChild;
  const exponent = numerator.querySelector('sup').firstChild;
  const cases = [
    ['literal operator', topLimit, 0, topLimit, 3, 'lim'],
    ['whole limit', topLimit, 0, lowerLimit, lowerLimit.nodeValue.length, 'lim_(x → 1)'],
    ['numerator', numerator.firstChild, 0, numerator.lastChild, numerator.lastChild.nodeValue.length, 'x² − 1'],
    ['superscript only', exponent, 0, exponent, 1, '²'],
    ['denominator', denominator, 0, denominator, denominator.nodeValue.length, 'x − 1']
  ];
  for (const [name, start, startOffset, end, endOffset, expected] of cases) {
    const selection = selectRange(instance.window, start, startOffset, end, endOffset);
    const payload = cleanCopy.getCopyPayload(
      document,
      selection,
      { outputMode: 'faithful' },
      instance.window,
      equation
    );
    assert.equal(payload.reason, 'css-stacked-math', name);
    assert.equal(payload.text, expected, name);
    assert.equal(payload.text.includes('= 2'), false, name + ' must not widen to the equation tail');
    assert.equal(/[\n\r\s]$/u.test(payload.text), false, name);
  }

  const numeratorSelection = selectRange(
    instance.window,
    numerator.firstChild,
    0,
    numerator.lastChild,
    numerator.lastChild.nodeValue.length
  );
  assert.equal(
    cleanCopy.getCopyPayload(
      document,
      numeratorSelection,
      { outputMode: 'calculator' },
      instance.window,
      equation
    ).text,
    'x^(2)-1'
  );
  assert.equal(
    cleanCopy.getCopyPayload(
      document,
      numeratorSelection,
      { outputMode: 'latex' },
      instance.window,
      equation
    ).text,
    '$x^{2}-1$'
  );

  const wholeLimitSelection = selectRange(
    instance.window,
    topLimit,
    0,
    lowerLimit,
    lowerLimit.nodeValue.length
  );
  assert.equal(
    cleanCopy.getCopyPayload(
      document,
      wholeLimitSelection,
      { outputMode: 'calculator' },
      instance.window,
      equation
    ),
    null,
    'an incomplete limit must not silently lose its selected lower bound'
  );
  assert.equal(
    cleanCopy.getCopyPayload(
      document,
      wholeLimitSelection,
      { outputMode: 'latex' },
      instance.window,
      equation
    ).text,
    '$\\lim_{x\\to 1}$'
  );

  const exponentSelection = selectRange(instance.window, exponent, 0, exponent, 1);
  for (const outputMode of ['calculator', 'latex']) {
    assert.equal(
      cleanCopy.getCopyPayload(document, exponentSelection, { outputMode }, instance.window, equation),
      null,
      outputMode + ' must not emit a dangling script with no selected base'
    );
  }
  const literalLimitSelection = selectRange(instance.window, topLimit, 0, topLimit, 3);
  assert.equal(
    cleanCopy.getCopyPayload(
      document,
      literalLimitSelection,
      { outputMode: 'latex' },
      instance.window,
      equation
    ).text,
    '$\\lim$'
  );
});

test('CSS-stacked cross-row partials retain the selected fraction structure', () => {
  const instance = dom([
    '<style>.fraction{display:inline-table}.fraction>em,.fraction>strong{display:table-row}',
    '.fraction>em{border-bottom:1px solid currentColor}</style>',
    '<p id="target">Before <span class="fraction"><em>a+b+c+d</em><strong>e+f+g+h</strong></span> after</p>'
  ].join(''));
  const document = instance.window.document;
  const target = document.querySelector('#target');
  const fraction = target.querySelector('.fraction');
  giveCssStackGeometry(fraction);
  const numerator = fraction.firstElementChild.firstChild;
  const denominator = fraction.lastElementChild.firstChild;
  const partial = selectRange(instance.window, numerator, 2, denominator, 3);
  assert.equal(
    cleanCopy.getCopyPayload(document, partial, { outputMode: 'faithful' }, instance.window, target).text,
    '(b + c + d)/(e + f)'
  );
  assert.equal(
    cleanCopy.getCopyPayload(document, partial, { outputMode: 'calculator' }, instance.window, target).text,
    '(b+c+d)/(e+f)'
  );
  assert.equal(
    cleanCopy.getCopyPayload(document, partial, { outputMode: 'latex' }, instance.window, target).text,
    '$\\frac{b+c+d}{e+f}$'
  );

  const crossing = selectRange(instance.window, target.firstChild, 0, denominator, 3);
  assert.equal(
    cleanCopy.getCopyPayload(document, crossing, { outputMode: 'faithful' }, instance.window, target).text,
    'Before (a + b + c + d)/(e + f)'
  );
  assert.equal(
    cleanCopy.getCopyPayload(document, crossing, { outputMode: 'calculator' }, instance.window, target).text,
    'Before (a+b+c+d)/(e+f)'
  );

  // Start inside a generated superscript rather than at the numerator base.
  const scripted = dom([
    '<style>.fraction{display:inline-table}.fraction>em,.fraction>strong{display:table-row}',
    '.fraction>em{border-bottom:1px solid currentColor}</style>',
    '<span id="target" class="fraction"><em>x<sup>2</sup></em><strong>y</strong></span>'
  ].join(''));
  const scriptedTarget = scripted.window.document.querySelector('#target');
  giveCssStackGeometry(scriptedTarget);
  const scriptText = scriptedTarget.querySelector('sup').firstChild;
  const scriptDenominator = scriptedTarget.lastElementChild.firstChild;
  const danglingSelection = selectRange(scripted.window, scriptText, 0, scriptDenominator, 1);
  for (const outputMode of ['faithful', 'calculator', 'latex']) {
    assert.equal(
      cleanCopy.getCopyPayload(
        scripted.window.document,
        danglingSelection,
        { outputMode },
        scripted.window,
        scriptedTarget
      ),
      null,
      outputMode + ' must reject a base-less script nested in a partial fraction'
    );
  }
});

test('CSS-stacked math canonicalizes direct Unicode roots and scripts in every semantic mode', () => {
  const instance = dom([
    '<style>.fraction{display:inline-table}.fraction>em,.fraction>strong{display:table-row}',
    '.fraction>em{border-bottom:1px solid currentColor}</style>',
    '<span id="target" class="fraction"><em>√(x²+1)</em><strong>y₁</strong></span>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  giveCssStackGeometry(target);
  const selection = selectContents(instance.window, target);
  const expected = {
    faithful: '√(x² + 1)/y₁',
    calculator: '(sqrt(x^(2)+1))/(y_(1))',
    latex: '$\\frac{\\sqrt{x^{2}+1}}{y_{1}}$'
  };
  for (const [outputMode, text] of Object.entries(expected)) {
    const payload = cleanCopy.getCopyPayload(
      instance.window.document,
      selection,
      { outputMode },
      instance.window,
      target
    );
    assert.equal(payload && payload.text, text, outputMode);
  }

  const numerator = target.firstElementChild.firstChild;
  const scriptOffset = numerator.nodeValue.indexOf('²');
  const scriptOnly = selectRange(instance.window, numerator, scriptOffset, numerator, scriptOffset + 1);
  assert.equal(
    cleanCopy.getCopyPayload(
      instance.window.document,
      scriptOnly,
      { outputMode: 'faithful' },
      instance.window,
      target
    ).text,
    '²'
  );
  for (const outputMode of ['calculator', 'latex']) {
    assert.equal(
      cleanCopy.getCopyPayload(
        instance.window.document,
        scriptOnly,
        { outputMode },
        instance.window,
        target
      ),
      null,
      outputMode + ' must not invent a base for a selected Unicode script'
    );
  }
});

test('CSS-stacked math scopes Unicode fences, variants, relations, and implicit products safely', () => {
  const copy = (top, outputMode = 'faithful') => {
    const instance = dom([
      '<style>.fraction{display:inline-table}.fraction>em,.fraction>strong{display:table-row}',
      '.fraction>em{border-bottom:1px solid currentColor}</style>',
      '<span id="target" class="fraction"><em>', top, '</em><strong>z</strong></span>'
    ].join(''));
    const target = instance.window.document.querySelector('#target');
    giveCssStackGeometry(target);
    const payload = cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      { outputMode },
      instance.window,
      target
    );
    return payload && payload.text;
  };

  assert.equal(copy('√|x|'), '√|x|/z');
  assert.equal(copy('√|x|', 'calculator'), '(sqrt(abs(x)))/z');
  assert.equal(copy('√|x|', 'latex'), '$\\frac{\\sqrt{|x|}}{z}$');
  assert.equal(copy('√[x+1]'), '√(x + 1)/z');
  assert.equal(copy('√[x+1]', 'calculator'), 'sqrt(x+1)/z');
  assert.equal(copy('𝑥²'), '𝑥²/z');
  assert.equal(copy('𝑥²', 'calculator'), '(x^(2))/z');
  assert.equal(copy('𝑥²', 'latex'), '$\\frac{\\mathit{x}^{2}}{z}$');
  assert.equal(copy('𝛼+β', 'calculator'), '(alpha+beta)/z');
  assert.equal(copy('𝛼+β', 'latex'), '$\\frac{\\alpha+\\beta }{z}$');
  assert.equal(copy('x~y'), 'x∼y/z');
  assert.equal(copy('x~y', 'calculator'), '(x~=y)/z');
  assert.equal(copy('sin² z', 'calculator'), '(sin(z)^(2))/z');
  assert.equal(copy('sin² z', 'latex'), '$\\frac{\\sin ^{2} z}{z}$');
  assert.equal(copy('log₂ z', 'calculator'), '(log(z)/log(2))/z');
  assert.equal(copy('log₂ z', 'latex'), '$\\frac{\\log _{2} z}{z}$');
  assert.equal(copy('√(−gR)', 'calculator'), 'sqrt(-g*R)/z');
  assert.equal(copy('√(−gR)', 'latex'), '$\\frac{\\sqrt{-gR}}{z}$');
  assert.equal(copy('50%'), '50%/z');
  assert.equal(copy('50%', 'calculator'), '(50/100)/z');
  assert.equal(copy('50%', 'latex'), '$\\frac{50\\%}{z}$');
  assert.equal(copy('{x}', 'latex'), '$\\frac{\\{x\\}}{z}$');
  assert.equal(copy('A\\B', 'latex'), '$\\frac{A\\backslash B}{z}$');
  for (const subscript of ['xᵢ', 'aₙ', 'vₓ', 'xᵦ']) {
    assert.notEqual(copy(subscript), null, subscript);
    assert.notEqual(copy(subscript, 'latex'), null, subscript + ' LaTeX');
  }
});

test('CSS-stacked partial fractions reject unbalanced delimiters, dangling operators, and relation scripts', () => {
  const instance = dom([
    '<style>.fraction{display:inline-table}.fraction>em,.fraction>strong{display:table-row}',
    '.fraction>em{border-bottom:1px solid currentColor}</style>',
    '<span id="target" class="fraction"><em>√(x+1)</em><strong>y</strong></span>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  giveCssStackGeometry(target);
  const numerator = target.firstElementChild.firstChild;
  const denominator = target.lastElementChild.firstChild;
  const partial = selectRange(instance.window, numerator, 2, denominator, 1);
  for (const outputMode of ['faithful', 'calculator', 'latex']) {
    assert.equal(
      cleanCopy.getCopyPayload(instance.window.document, partial, { outputMode }, instance.window, target),
      null,
      outputMode + ' rejects an unmatched closing delimiter'
    );
  }

  for (const top of ['x+', '*x', 'x=', 'x/', 'x→', '([x)]', '|x', 'x|']) {
    const sample = dom([
      '<style>.fraction{display:inline-table}.fraction>em,.fraction>strong{display:table-row}',
      '.fraction>em{border-bottom:1px solid currentColor}</style>',
      '<span id="target" class="fraction"><em>', top, '</em><strong>y</strong></span>'
    ].join(''));
    const sampleTarget = sample.window.document.querySelector('#target');
    giveCssStackGeometry(sampleTarget);
    assert.equal(
      cleanCopy.getCopyPayload(
        sample.window.document,
        selectContents(sample.window, sampleTarget),
        { outputMode: 'calculator' },
        sample.window,
        sampleTarget
      ),
      null,
      top
    );
  }

  for (const relation of ['≤', '→', '±', '&lt;']) {
    const sample = dom([
      '<style>.fraction{display:inline-table}.fraction>em,.fraction>strong{display:table-row}',
      '.fraction>em{border-bottom:1px solid currentColor}</style>',
      '<span id="target" class="fraction"><em>', relation, '<sup>2</sup></em><strong>y</strong></span>'
    ].join(''));
    const sampleTarget = sample.window.document.querySelector('#target');
    giveCssStackGeometry(sampleTarget);
    for (const outputMode of ['calculator', 'latex']) {
      assert.equal(
        cleanCopy.getCopyPayload(
          sample.window.document,
          selectContents(sample.window, sampleTarget),
          { outputMode },
          sample.window,
          sampleTarget
        ),
        null,
        relation + ' ' + outputMode
      );
    }
  }
});

test('CSS-stacked math keeps adjacent scripts, products, and fractions semantic', () => {
  const copy = (tail, outputMode) => {
    const instance = dom([
      '<style>.fraction{display:inline-table}.fraction>em,.fraction>strong{display:table-row}',
      '.fraction>em{border-bottom:1px solid currentColor}</style>',
      '<span id="target"><span class="fraction"><em>x</em><strong>y</strong></span>', tail, '</span>'
    ].join(''));
    const target = instance.window.document.querySelector('#target');
    Array.from(target.querySelectorAll('.fraction')).forEach((root, index) =>
      giveCssStackGeometry(root, 10 + index * 62, 60));
    return cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      { outputMode },
      instance.window,
      target
    ).text;
  };
  assert.equal(copy('<sup>2</sup>', 'faithful'), '(x/y)²');
  assert.equal(copy('<sup>2</sup>', 'latex'), '${\\frac{x}{y}}^{2}$');
  assert.equal(copy('<sub>i</sub>', 'faithful'), '(x/y)ᵢ');
  assert.equal(copy(' \n <sup>2</sup>', 'faithful'), '(x/y)²');
  assert.equal(copy(' <!--layout--> ×z', 'calculator'), '(x/y)*z');
  assert.equal(copy('z', 'calculator'), '(x/y)*z');
  assert.equal(copy('z', 'latex'), '$\\frac{x}{y}z$');
  assert.equal(copy('×z', 'calculator'), '(x/y)*z');
  assert.equal(copy('×z', 'latex'), '$\\frac{x}{y}\\times z$');
  const second = '<span class="fraction"><em>a</em><strong>b</strong></span>';
  assert.equal(copy(second, 'faithful'), '(x/y)(a/b)');
  assert.equal(copy(second, 'calculator'), '(x/y)*(a/b)');
  assert.equal(copy(second, 'latex'), '$\\frac{x}{y}\\frac{a}{b}$');

  const incomplete = dom([
    '<style>.fraction{display:inline-table}.fraction>em,.fraction>strong{display:table-row}',
    '.fraction>em{border-bottom:1px solid currentColor}</style>',
    '<span id="target"><span class="fraction"><em>x</em><strong>y</strong></span>×z</span>'
  ].join(''));
  const incompleteTarget = incomplete.window.document.querySelector('#target');
  giveCssStackGeometry(incompleteTarget.querySelector('.fraction'));
  const tail = incompleteTarget.lastChild;
  const partial = selectRange(
    incomplete.window,
    incompleteTarget.querySelector('.fraction > em').firstChild,
    0,
    tail,
    1
  );
  assert.equal(
    cleanCopy.getCopyPayload(
      incomplete.window.document,
      partial,
      { outputMode: 'calculator' },
      incomplete.window,
      incompleteTarget
    ),
    null,
    'a selected multiplication sign without its operand fails native'
  );
});

test('CSS-stacked recovery fails closed on prose, citations, UI stacks, and incomplete drags', () => {
  const fixture = (top, bottom, tail = '', className = 'fraction') => {
    const instance = dom([
      '<style>.fraction,.intbl,.lim{display:inline-table}',
      '.fraction>em,.fraction>strong,.intbl>em,.intbl>strong,.lim>em,.lim>strong{display:table-row}',
      '.fraction>em,.intbl>em{border-bottom:1px solid currentColor}</style>',
      '<span id="target"><span class="', className, '"><em>', top, '</em><strong>', bottom,
      '</strong></span>', tail, '</span>'
    ].join(''));
    const target = instance.window.document.querySelector('#target');
    giveCssStackGeometry(target.firstElementChild);
    const copy = (outputMode, selection = selectContents(instance.window, target)) =>
      cleanCopy.getCopyPayload(
        instance.window.document,
        selection,
        { outputMode },
        instance.window,
        target
      );
    return { instance, target, copy };
  };

  const prose = fixture('x', 'y', ' is 2');
  assert.equal(prose.copy('faithful').text, 'x/y is 2');
  assert.equal(prose.copy('calculator').text, 'x/y is 2');
  assert.equal(prose.copy('latex').text, '$\\frac{x}{y}$ is 2');
  assert.doesNotMatch(prose.copy('calculator').text, /\*i\*s|\bis2\b/u);

  const limitProse = fixture('lim', 'x→0', ' is 2', 'lim');
  assert.equal(limitProse.copy('faithful').text, 'lim_(x → 0) is 2');
  assert.equal(limitProse.copy('latex').text, '$\\lim_{x\\to 0}$ is 2');
  assert.equal(limitProse.copy('calculator'), null);

  const citation = fixture('x', 'y', '<sup>[1]</sup>');
  for (const outputMode of ['faithful', 'calculator', 'latex']) {
    const payload = citation.copy(outputMode);
    assert.doesNotMatch(payload.text, /\^\(?\[1\]|_\(?\[1\]/u, outputMode);
    assert.match(payload.html, /<sup>\[1\]<\/sup>/u, outputMode);
  }

  for (const tail of ['<sup>2</sup><sup>3</sup>', '<sub>i</sub><sub>j</sub>']) {
    const repeated = fixture('x', 'y', tail);
    for (const outputMode of ['faithful', 'calculator', 'latex']) {
      assert.equal(repeated.copy(outputMode), null, tail + ' ' + outputMode);
    }
  }
  const mixedScripts = fixture('x', 'y', '<sup>2</sup><sub>i</sub>');
  assert.equal(mixedScripts.copy('faithful').text, '(x/y)²ᵢ');
  assert.equal(mixedScripts.copy('latex').text, '${\\frac{x}{y}}^{2}_{i}$');

  for (const [top, bottom] of [
    ['v1.2', 'v2.3'], ['1st', '2nd'], ['10kg', '20kg']
  ]) {
    const widget = fixture(top, bottom);
    for (const outputMode of ['faithful', 'calculator', 'latex']) {
      assert.equal(widget.copy(outputMode), null, top + '/' + bottom + ' ' + outputMode);
    }
  }
  assert.equal(
    fixture('v1.2', 'v2.3', '', 'intbl').copy('faithful'),
    null,
    'a site-specific legacy class cannot authenticate version-like UI values'
  );

  const accents = fixture('x⃗+ŷ', 'z');
  assert.equal(accents.copy('faithful').text, '(x⃗ + ŷ)/z');
  assert.equal(accents.copy('calculator'), null);
  assert.equal(accents.copy('latex').text, '$\\frac{\\vec{x}+\\hat{y}}{z}$');
  const unsupportedAccent = fixture('x̄', 'z');
  assert.equal(unsupportedAccent.copy('calculator'), null);

  const radicalFunction = fixture('√sin(x)', 'z');
  assert.equal(radicalFunction.copy('faithful').text, '√(sin(x))/z');
  assert.equal(radicalFunction.copy('calculator').text, '(sqrt(sin(x)))/z');
  assert.equal(radicalFunction.copy('latex').text, '$\\frac{\\sqrt{\\sin (x)}}{z}$');
  const radicalBraces = fixture('√{x+1}', 'z');
  assert.equal(radicalBraces.copy('faithful').text, '√(x + 1)/z');
  assert.equal(radicalBraces.copy('calculator').text, 'sqrt(x+1)/z');
  assert.equal(radicalBraces.copy('latex').text, '$\\frac{\\sqrt{x+1}}{z}$');
  for (const glyph of ['√', '∛', '∜']) {
    const loneRadical = fixture(glyph, 'z');
    for (const outputMode of ['faithful', 'calculator', 'latex']) {
      assert.equal(loneRadical.copy(outputMode), null, 'lone ' + glyph + ' ' + outputMode);
    }
  }

  for (const [top, bottom] of [['(x]', 'z'], ['[x)', 'z']]) {
    const malformed = fixture(top, bottom);
    for (const outputMode of ['faithful', 'calculator', 'latex']) {
      assert.equal(malformed.copy(outputMode), null, top + ' ' + outputMode);
    }
  }

  const partialRows = fixture('(x+y)', '(y+z)');
  const numerator = partialRows.target.querySelector('em').firstChild;
  const denominator = partialRows.target.querySelector('strong').firstChild;
  const malformedTop = selectRange(
    partialRows.instance.window,
    numerator,
    1,
    numerator,
    numerator.nodeValue.length
  );
  for (const outputMode of ['faithful', 'calculator', 'latex']) {
    assert.equal(partialRows.copy(outputMode, malformedTop), null, 'unbalanced numerator ' + outputMode);
  }
  const malformedBottom = selectRange(
    partialRows.instance.window,
    denominator,
    0,
    denominator,
    denominator.nodeValue.length - 1
  );
  for (const outputMode of ['faithful', 'calculator', 'latex']) {
    assert.equal(partialRows.copy(outputMode, malformedBottom), null, 'unbalanced denominator ' + outputMode);
  }

  const partialLimit = fixture('lim', 'x→1', '', 'lim');
  const limitTop = partialLimit.target.querySelector('em').firstChild;
  const limitBottom = partialLimit.target.querySelector('strong').firstChild;
  const danglingBound = selectRange(partialLimit.instance.window, limitTop, 0, limitBottom, 2);
  for (const outputMode of ['faithful', 'calculator', 'latex']) {
    assert.equal(partialLimit.copy(outputMode, danglingBound), null, 'incomplete limit ' + outputMode);
  }
});

test('CSS-stacked lower limits keep nested bounds and bind only to a same-line body', () => {
  const instance = dom([
    '<style>.lim,.fraction{display:inline-table}.lim>em,.lim>strong,.fraction>em,.fraction>strong{display:table-row}',
    '.fraction>em{border-bottom:1px solid currentColor}</style>',
    '<p id="target"><span class="lim"><em>lim</em><strong>x→a<sup>2</sup></strong></span>',
    '<span class="fraction"><em>x</em><strong>y</strong></span></p>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  const limit = target.querySelector('.lim');
  const fraction = target.querySelector('.fraction');
  giveCssStackGeometry(limit, 10, 35);
  giveCssStackGeometry(fraction, 48, 35);

  const limitOnly = selectContents(instance.window, limit);
  assert.equal(
    cleanCopy.getCopyPayload(
      instance.window.document,
      limitOnly,
      { outputMode: 'calculator' },
      instance.window,
      target
    ),
    null,
    'a nested lower bound is still incomplete without a selected body'
  );
  assert.equal(
    cleanCopy.getCopyPayload(
      instance.window.document,
      limitOnly,
      { outputMode: 'latex' },
      instance.window,
      target
    ).text,
    '$\\lim_{x\\to a^{2}}$'
  );

  const plainBody = dom([
    '<style>.lim{display:inline-table}.lim>em,.lim>strong{display:table-row}</style>',
    '<span id="target"><span class="lim"><em>lim</em><strong>x→0</strong></span>sin(x)</span>'
  ].join(''));
  const plainBodyTarget = plainBody.window.document.querySelector('#target');
  giveCssStackGeometry(plainBodyTarget.querySelector('.lim'), 10, 35);
  const plainBodySelection = selectContents(plainBody.window, plainBodyTarget);
  assert.equal(
    cleanCopy.getCopyPayload(
      plainBody.window.document,
      plainBodySelection,
      { outputMode: 'calculator' },
      plainBody.window,
      plainBodyTarget
    ).text,
    'limit(sin(x),x->0)'
  );
  assert.equal(
    cleanCopy.getCopyPayload(
      plainBody.window.document,
      plainBodySelection,
      { outputMode: 'latex' },
      plainBody.window,
      plainBodyTarget
    ).text,
    '$\\lim_{x\\to 0}{\\sin (x)}$'
  );

  plainBodyTarget.lastChild.nodeValue = 'f(x) = L';
  assert.equal(
    cleanCopy.getCopyPayload(
      plainBody.window.document,
      selectContents(plainBody.window, plainBodyTarget),
      { outputMode: 'calculator' },
      plainBody.window,
      plainBodyTarget
    ).text,
    'limit(f(x),x->0)=L'
  );
  assert.equal(
    cleanCopy.getCopyPayload(
      plainBody.window.document,
      selectContents(plainBody.window, plainBodyTarget),
      { outputMode: 'latex' },
      plainBody.window,
      plainBodyTarget
    ).text,
    '$\\lim_{x\\to 0}{f(x)} = L$'
  );
  plainBodyTarget.lastChild.nodeValue = 'f(x) → L';
  assert.equal(
    cleanCopy.getCopyPayload(
      plainBody.window.document,
      selectContents(plainBody.window, plainBodyTarget),
      { outputMode: 'calculator' },
      plainBody.window,
      plainBodyTarget
    ).text,
    'limit(f(x),x->0)->L'
  );
  plainBodyTarget.lastChild.nodeValue = 'f(x) = result';
  assert.equal(
    cleanCopy.getCopyPayload(
      plainBody.window.document,
      selectContents(plainBody.window, plainBodyTarget),
      { outputMode: 'calculator' },
      plainBody.window,
      plainBodyTarget
    ),
    null,
    'prose is never absorbed into a recovered limit equation'
  );

  // The DOM siblings remain adjacent, but the visual body has wrapped to a
  // later line. It must never become the first limit's argument.
  const rows = fraction.children;
  rows[0].getBoundingClientRect = () => ({ left: 10, right: 45, top: 100, bottom: 120, width: 35, height: 20 });
  rows[1].getBoundingClientRect = () => ({ left: 10, right: 45, top: 121, bottom: 141, width: 35, height: 20 });
  assert.equal(
    cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      { outputMode: 'calculator' },
      instance.window,
      target
    ),
    null,
    'a wrapped fraction is not silently attached to the preceding limit'
  );

  giveCssStackGeometry(fraction, 25, 35);
  assert.equal(
    cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      { outputMode: 'calculator' },
      instance.window,
      target
    ),
    null,
    'materially overlapping roots are not grouped as a limit body'
  );
});

test('comments and wbr nodes do not break a CSS-stacked limit from its body', () => {
  const { instance, document, equation, limit, fraction } = cssStackLimitFixture();
  limit.after(document.createComment('layout separator'), document.createElement('wbr'));
  const tail = equation.lastChild;
  const selection = selectRange(
    instance.window,
    limit.firstElementChild.firstChild,
    0,
    tail,
    tail.nodeValue.length
  );
  assert.equal(
    cleanCopy.getCopyPayload(
      document,
      selection,
      { outputMode: 'calculator' },
      instance.window,
      equation
    ).text,
    'limit(((x^(2)-1)/(x-1)),x->1) = 2'
  );
  assert.equal(fraction.isConnected, true);
});

test('the installed listener writes semantic plain and rich text for CSS-stacked math', () => {
  const { instance, document, equation, limit } = cssStackLimitFixture();
  const tail = equation.lastChild;
  selectRange(
    instance.window,
    limit.firstElementChild.firstChild,
    0,
    tail,
    tail.nodeValue.length
  );
  cleanCopy.install(document, instance.window, { registerMenus: false });
  const clipboard = new Map();
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      get types() { return Array.from(clipboard.keys()); },
      clearData(type) { if (arguments.length) clipboard.delete(type); else clipboard.clear(); },
      setData(type, value) { clipboard.set(type, value); },
      getData(type) { return clipboard.get(type) || ''; }
    }
  });
  equation.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(clipboard.get('text/plain'), 'lim_(x → 1) (x² − 1)/(x − 1) = 2');
  assert.match(clipboard.get('text/html'), /x<sup>2<\/sup> − 1/u);
  assert.doesNotMatch(clipboard.get('text/html'), /<(?:em|strong)\b|class=|\*\*/iu);
});

test('CSS-stacked math authentication fails closed for lookalikes, hidden content, and false geometry', () => {
  const copy = (markup, configure, mode = 'faithful') => {
    const instance = dom(markup);
    const target = instance.window.document.querySelector('#target');
    if (configure) configure(instance.window, target);
    return cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      { outputMode: mode },
      instance.window,
      target
    );
  };
  const style = [
    '<style>.stack{display:inline-table}.stack>em,.stack>strong{display:table-row}',
    '.fraction>em{border-bottom:1px solid currentColor}</style>'
  ].join('');
  assert.equal(copy(
    style + '<p id="target"><span class="stack"><em>ordinary</em><strong>emphasis</strong></span></p>'
  ), null, 'two rows without a fraction rule or known operator are not math');
  assert.equal(copy(
    style + '<p id="target"><span class="stack fraction"><em>Current plan</em><strong>Next revision</strong></span></p>',
    (_window, target) => giveCssStackGeometry(target.querySelector('.stack'))
  ), null, 'a bordered two-row status widget is not a fraction');
  assert.equal(copy(
    style + '<p id="target"><span class="stack fraction"><em>2025</em><strong>2026</strong></span></p>',
    (_window, target) => giveCssStackGeometry(target.querySelector('.stack'))
  ), null, 'a numeric year/status widget is not guessed to be a fraction');
  for (const rows of [
    ['2025/01', '2026/01'],
    ['2025–26', '2026–27'],
    ['1×2', '3×4'],
    ['10 kg', '20 kg'],
    ['Speed 10', 'Speed 20'],
    ['2025 Q1', '2026 Q2']
  ]) {
    assert.equal(copy(
      style + '<p id="target"><span class="stack fraction"><em>' + rows[0] +
        '</em><strong>' + rows[1] + '</strong></span></p>',
      (_window, target) => giveCssStackGeometry(target.querySelector('.stack'))
    ), null, 'numeric/status rows stay native: ' + rows.join(' / '));
  }
  assert.equal(copy(
    style + '<p id="target"><span class="stack"><em>max</em><strong>speed</strong></span></p>',
    (_window, target) => giveCssStackGeometry(target.querySelector('.stack'))
  ), null, 'ordinary max/min labels are not authenticated as bounded operators');
  assert.equal(copy(
    style + '<p id="target"><span class="stack fraction"><em>x<a href="#">2</a></em><strong>y</strong></span></p>',
    (_window, target) => giveCssStackGeometry(target.querySelector('.stack'))
  ), null, 'interactive descendants cannot authenticate a formula');
  assert.equal(copy(
    style + '<p id="target"><span class="stack fraction"><em>x<span style="display:none">SECRET</span></em><strong>y</strong></span></p>',
    (_window, target) => giveCssStackGeometry(target.querySelector('.stack'))
  ), null, 'hidden descendants cannot be promoted into copied math');
  assert.equal(copy(
    style + '<p id="target"><span class="stack fraction"><em>x</em><strong>y</strong></span></p>',
    (_window, target) => {
      const rows = target.querySelectorAll('em,strong');
      rows[0].getBoundingClientRect = () => ({ left: 0, right: 20, top: 0, bottom: 10, width: 20, height: 10 });
      rows[1].getBoundingClientRect = () => ({ left: 30, right: 50, top: 12, bottom: 22, width: 20, height: 10 });
    }
  ), null, 'non-overlapping rows are not a visual stack');
  assert.equal(copy(
    style + '<p id="target"><span class="stack fraction"><em>x</em><strong>y</strong></span></p>',
    (_window, target) => {
      const rows = target.querySelectorAll('em,strong');
      rows[0].getBoundingClientRect = () => ({ left: 0, right: 20, top: 0, bottom: 20, width: 20, height: 20 });
      rows[1].getBoundingClientRect = () => ({ left: 0, right: 20, top: 1, bottom: 21, width: 20, height: 20 });
    }
  ), null, 'overlapping rows are not a visible numerator and denominator');

  for (const ancestorStyle of ['display:none', 'opacity:0', 'clip-path:circle(0)']) {
    assert.equal(copy(
      style + '<div id="target" style="' + ancestorStyle + '"><span class="stack fraction"><em>SECRET</em><strong>x</strong></span></div>',
      (_window, target) => giveCssStackGeometry(target.querySelector('.stack'))
    ), null, 'hidden ancestor: ' + ancestorStyle);
  }
  assert.equal(copy(
    style + '<div id="target" style="overflow:hidden;width:10px;height:30px"><span class="stack fraction"><em>x</em><strong>y</strong></span></div>',
    (_window, target) => {
      target.getBoundingClientRect = () => ({ left: 0, right: 10, top: 0, bottom: 30, width: 10, height: 30 });
      giveCssStackGeometry(target.querySelector('.stack'), 100, 20);
    }
  ), null, 'a stack fully outside a clipping ancestor is not visible math');
  assert.equal(copy(
    style + '<div id="target" style="overflow:hidden;width:10px;height:60px"><span class="stack fraction"><em>x</em><strong>y</strong></span></div>',
    (_window, target) => {
      target.getBoundingClientRect = () => ({ left: 0, right: 10, top: 0, bottom: 60, width: 10, height: 60 });
      giveCssStackGeometry(target.querySelector('.stack'), 9, 20);
    }
  ), null, 'a nearly fully clipped stack is not promoted from one visible pixel');
  assert.equal(copy(
    style + '<p id="target">before <span class="stack fraction" contenteditable="true"><em>x</em><strong>y</strong></span> after</p>',
    (_window, target) => giveCssStackGeometry(target.querySelector('.stack'))
  ), null, 'an embedded editable root is never rewritten from an outside selection');
  assert.equal(copy(
    style + '<p id="target">before <span contenteditable="true"><span class="stack fraction"><em>x</em><strong>y</strong></span></span> after</p>',
    (_window, target) => giveCssStackGeometry(target.querySelector('.stack'))
  ), null, 'a stack inherited from an editable ancestor is never rewritten');
  assert.equal(copy(
    style + '<p id="target"><span class="stack fraction"><em><bdo dir="rtl">12</bdo></em><strong>x</strong></span></p>',
    (_window, target) => giveCssStackGeometry(target.querySelector('.stack'))
  ), null, 'bidi-overridden DOM order is not guessed');

  const valid = copy(
    style + '<p id="target"><span class="stack fraction"><em>a</em><strong>b</strong></span></p>',
    (_window, target) => giveCssStackGeometry(target.querySelector('.stack'))
  );
  assert.equal(valid.text, 'a/b', 'single-variable fractions remain supported');

  const knownNumeric = copy(
    style + '<p id="target"><span class="stack intbl fraction"><em>1</em><strong>2</strong></span></p>',
    (_window, target) => giveCssStackGeometry(target.querySelector('.stack'))
  );
  assert.equal(knownNumeric, null, 'site-specific renderer classes cannot authenticate numeric-only fractions');
  const semanticNumeric = copy(
    style + '<p id="target"><span class="stack math-fraction fraction"><em>1</em><strong>2</strong></span></p>',
    (_window, target) => giveCssStackGeometry(target.querySelector('.stack'))
  );
  assert.equal(semanticNumeric.text, '1/2', 'explicit cross-site math semantics retain numeric fractions');

  const ordinary = dom('<p id="target">Use <em>real emphasis</em> here.</p>');
  const ordinaryTarget = ordinary.window.document.querySelector('#target');
  assert.equal(
    cleanCopy.getCopyPayload(
      ordinary.window.document,
      selectContents(ordinary.window, ordinaryTarget),
      cleanCopy.DEFAULT_SETTINGS,
      ordinary.window,
      ordinaryTarget
    ),
    null,
    'ordinary semantic emphasis stays on the browser path'
  );
});

test('CSS-stacked formulas are domain-neutral across unrelated hosts, tags, classes, wrappers, and layouts', () => {
  const hosts = [
    'https://alpha.invalid/lesson/7',
    'https://subdomain.example.org/article?id=19',
    'https://en.wikipedia.org/wiki/Unrelated_page',
    'https://docs.google.com/document/d/fake/edit',
    'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx',
    'http://localhost:8080/math'
  ];
  const variants = [
    { rootTag: 'span', rowTag: 'i', className: '', depth: 0, rootDisplay: 'inline-table', rowDisplay: 'table-row', rule: 'top' },
    { rootTag: 'section', rowTag: 'mark', className: 'random-card', depth: 1, rootDisplay: 'flex', rowDisplay: 'block', rule: 'bottom' },
    { rootTag: 'output', rowTag: 'div', className: 'q-9381', depth: 4, rootDisplay: 'grid', rowDisplay: 'flex', rule: 'dedicated' },
    { rootTag: 'blockquote', rowTag: 'var', className: 'renderer-v47', depth: 12, rootDisplay: 'flow-root', rowDisplay: 'contents', rule: 'top', noise: true },
    { rootTag: 'h2', rowTag: 'small', className: 'layout', depth: 2, rootDisplay: 'contents', rowDisplay: 'inline', rule: 'bottom', reverse: true },
    { rootTag: 'main', rowTag: 'dfn', className: 'unrelated', depth: 3, rootDisplay: 'table-cell', rowDisplay: 'table-row', rule: 'dedicated', reverse: true },
    { rootTag: 'header', rowTag: 'cite', className: 'stackish-but-not-semantic', depth: 5, rootDisplay: 'inline-grid', rowDisplay: 'inline-flex', rule: 'top', noise: true }
  ];
  const expected = {
    faithful: '(x² + 1)/(y − 2)',
    calculator: '(x^(2)+1)/(y-2)',
    latex: '$\\frac{x^{2}+1}{y-2}$'
  };

  const fixture = (url, options) => {
    const topStyle = 'display:' + options.rowDisplay + ';' +
      (options.rule === 'top' ? 'border-bottom:1px solid currentColor;' : '');
    const bottomStyle = 'display:' + options.rowDisplay + ';' +
      (options.rule === 'bottom' ? 'border-top:1px solid currentColor;' : '');
    const top = '<' + options.rowTag + ' data-test-stack-row="formula-top" style="' + topStyle + '">' +
      'x' + (options.noise ? '<!-- split --><wbr>' : '') + '<sup>2</sup>+1</' + options.rowTag + '>';
    const bottom = '<' + options.rowTag + ' data-test-stack-row="formula-bottom" style="' + bottomStyle + '">' +
      'y−2</' + options.rowTag + '>';
    const first = options.reverse ? bottom : top;
    const last = options.reverse ? top : bottom;
    let children = first + last;
    if (options.rule === 'dedicated') {
      children = first + '<b data-test-stack-rule="formula" ' +
        'style="display:block;border-top:1px solid currentColor"></b>' + last;
    }
    if (options.noise) children = '<!-- before --><wbr>' + children + '<!-- after -->';
    for (let depth = 0; depth < options.depth; depth += 1) {
      children = '<span class="neutral-' + depth + '" style="display:' +
        (depth % 2 ? 'contents' : 'inline-block') + '">' + children + '</span>';
    }
    const instance = dom([
      '<div id="target">Before <', options.rootTag, ' id="formula" class="', options.className,
      '" style="display:', options.rootDisplay, '">', children, '</', options.rootTag,
      '> after</div>'
    ].join(''), url);
    giveNamedCssStackGeometry(instance.window.document, 'formula', { left: 20, width: 80 });
    return instance;
  };

  for (const [hostIndex, url] of hosts.entries()) {
    for (const [variantIndex, variant] of variants.entries()) {
      const instance = fixture(url, variant);
      const document = instance.window.document;
      const target = document.querySelector('#target');
      const formula = document.querySelector('#formula');
      const selection = selectContents(instance.window, formula);
      const label = 'host ' + hostIndex + ', variant ' + variantIndex;
      for (const [outputMode, text] of Object.entries(expected)) {
        const payload = cleanCopy.getCopyPayload(
          document,
          selection,
          { outputMode },
          instance.window,
          target
        );
        assert.equal(payload && payload.reason, 'css-stacked-math', label + ' ' + outputMode);
        assert.equal(payload && payload.text, text, label + ' ' + outputMode);
        assert.equal(/[\n\r\s]$/u.test(payload.text), false, label + ' trailing whitespace');
      }
      assert.equal(
        cleanCopy.getCopyPayload(document, selection, { outputMode: 'native' }, instance.window, target),
        null,
        label + ' native mode'
      );
    }
  }
});

test('open Shadow DOM composed selections use the same generic math recovery', () => {
  const instance = dom('<main><div id="host"></div></main>', 'https://shadow-components.invalid/app');
  const documentObject = instance.window.document;
  const host = documentObject.querySelector('#host');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = [
    '<span id="fraction" role="math" style="display:inline-table">',
    '<span id="numerator" style="display:table-row;border-bottom:1px solid currentColor">x<sup>2</sup>+1</span>',
    '<span id="denominator" style="display:table-row">y−2</span>',
    '</span>'
  ].join('');
  const fraction = shadow.querySelector('#fraction');
  const numerator = shadow.querySelector('#numerator');
  const denominator = shadow.querySelector('#denominator');
  fraction.getBoundingClientRect = () => ({
    left: 20, top: 10, right: 100, bottom: 50, width: 80, height: 40
  });
  numerator.getBoundingClientRect = () => ({
    left: 20, top: 10, right: 100, bottom: 25, width: 80, height: 15
  });
  denominator.getBoundingClientRect = () => ({
    left: 20, top: 35, right: 100, bottom: 50, width: 80, height: 15
  });

  let composedOptions = null;
  const selection = {
    isCollapsed: false,
    rangeCount: 1,
    anchorNode: numerator.firstChild,
    focusNode: denominator.firstChild,
    getComposedRanges(options) {
      composedOptions = options;
      return [{
        startContainer: shadow,
        startOffset: 0,
        endContainer: shadow,
        endOffset: shadow.childNodes.length
      }];
    },
    getRangeAt() {
      throw new Error('the composed selection must be used');
    }
  };
  const expected = {
    faithful: '(x² + 1)/(y − 2)',
    calculator: '(x^(2)+1)/(y-2)',
    latex: '$\\frac{x^{2}+1}{y-2}$'
  };
  for (const [outputMode, text] of Object.entries(expected)) {
    const payload = cleanCopy.getCopyPayload(
      documentObject,
      selection,
      { outputMode },
      instance.window,
      host
    );
    assert.equal(payload && payload.reason, 'css-stacked-math', outputMode);
    assert.equal(payload && payload.text, text, outputMode);
  }
  assert.deepEqual(composedOptions && composedOptions.shadowRoots, [shadow]);
  host.style.opacity = '0';
  assert.equal(cleanCopy.getCopyPayload(
    documentObject,
    selection,
    { outputMode: 'faithful' },
    instance.window,
    host
  ), null, 'a hidden shadow host cannot authenticate otherwise valid internal geometry');
});

test('numeric CSS fractions require explicit generic semantics, never a site-shaped class name', () => {
  const semanticAttributes = [
    'role="math"',
    'aria-roledescription="Formula"',
    'data-math="true"',
    'data-formula="equation"',
    'data-equation="1"'
  ];
  const hosts = [
    'https://numbers.invalid/',
    'https://example.net/random/path',
    'https://docs.google.com/document/d/fake/pub'
  ];
  const build = (url, attributes, className) => {
    const instance = dom([
      '<div id="target"><span id="outer" class="neutral-owner" style="display:inline-block">',
      '<span id="fraction" class="', className, '" ', attributes, ' style="display:inline-table">',
      '<i data-test-stack-row="numeric-top" style="display:table-row;border-bottom:1px solid currentColor">1</i>',
      '<b data-test-stack-row="numeric-bottom" style="display:table-row">2</b>',
      '</span></span></div>'
    ].join(''), url);
    giveNamedCssStackGeometry(instance.window.document, 'numeric');
    return instance;
  };
  const expected = {
    faithful: '1/2',
    calculator: '1/2',
    latex: '$\\frac{1}{2}$'
  };

  for (const [hostIndex, url] of hosts.entries()) {
    const untrusted = build(url, '', 'intbl fraction legacy-renderer-v2');
    const untrustedTarget = untrusted.window.document.querySelector('#target');
    const untrustedSelection = selectContents(
      untrusted.window,
      untrusted.window.document.querySelector('#outer')
    );
    for (const outputMode of Object.keys(expected)) {
      assert.equal(cleanCopy.getCopyPayload(
        untrusted.window.document,
        untrustedSelection,
        { outputMode },
        untrusted.window,
        untrustedTarget
      ), null, 'class-only fraction on host ' + hostIndex + ' in ' + outputMode);
    }

    for (const [semanticIndex, attributes] of semanticAttributes.entries()) {
      const instance = build(url, attributes, 'opaque-' + hostIndex + '-' + semanticIndex);
      const document = instance.window.document;
      const target = document.querySelector('#target');
      const selection = selectContents(instance.window, document.querySelector('#outer'));
      for (const [outputMode, text] of Object.entries(expected)) {
        const payload = cleanCopy.getCopyPayload(
          document,
          selection,
          { outputMode },
          instance.window,
          target
        );
        assert.equal(payload && payload.text, text, attributes + ' ' + outputMode);
      }
    }
  }
});

test('nested CSS fractions preserve hierarchy and exact partial selections on every host', () => {
  const hosts = [
    'https://nested.invalid/',
    'https://example.edu/course/physics',
    'https://en.wikipedia.org/wiki/Fraction',
    'http://localhost:3000/'
  ];
  const cases = [
    ['left', '(a/b)/c', '(a/b)/c', '$\\frac{\\frac{a}{b}}{c}$'],
    ['right', 'a/(c/d)', 'a/(c/d)', '$\\frac{a}{\\frac{c}{d}}$'],
    ['both', '(a/b)/(c/d)', '(a/b)/(c/d)', '$\\frac{\\frac{a}{b}}{\\frac{c}{d}}$']
  ];
  const inner = (name, numerator, denominator) => [
    '<span id="', name, '" class="opaque-', name, '" style="display:inline-table">',
    '<mark data-test-stack-row="', name, '-top" style="display:table-row;border-bottom:1px solid currentColor">',
    numerator, '</mark>',
    '<var data-test-stack-row="', name, '-bottom" style="display:table-row">', denominator, '</var>',
    '</span>'
  ].join('');
  const build = (url, kind) => {
    const numerator = kind === 'left' || kind === 'both' ? inner('left', 'a', 'b') : 'a';
    const denominator = kind === 'right' || kind === 'both' ? inner('right', 'c', 'd') : 'c';
    const instance = dom([
      '<div id="target"><section id="outer" class="not-a-renderer" style="display:grid">',
      '<div data-test-stack-row="outer-top" style="display:block;border-bottom:1px solid currentColor">',
      numerator, '</div>',
      '<div data-test-stack-row="outer-bottom" style="display:block">', denominator, '</div>',
      '</section></div>'
    ].join(''), url);
    const document = instance.window.document;
    giveNamedCssStackGeometry(document, 'outer', { left: 10, top: 10, width: 100, rowHeight: 30 });
    if (document.querySelector('#left')) {
      giveNamedCssStackGeometry(document, 'left', { left: 20, top: 12, width: 30, rowHeight: 9, gap: 1 });
    }
    if (document.querySelector('#right')) {
      giveNamedCssStackGeometry(document, 'right', { left: 20, top: 43, width: 30, rowHeight: 9, gap: 1 });
    }
    return instance;
  };

  for (const url of hosts) {
    for (const [kind, faithful, calculator, latex] of cases) {
      const instance = build(url, kind);
      const document = instance.window.document;
      const target = document.querySelector('#target');
      const selection = selectContents(instance.window, document.querySelector('#outer'));
      for (const [outputMode, text] of Object.entries({ faithful, calculator, latex })) {
        const payload = cleanCopy.getCopyPayload(
          document,
          selection,
          { outputMode },
          instance.window,
          target
        );
        assert.equal(payload && payload.text, text, url + ' ' + kind + ' ' + outputMode);
      }
    }
  }

  const partial = dom([
    '<div id="target"><section id="outer" style="display:inline-table">',
    '<div data-test-stack-row="outer-top" style="display:table-row;border-bottom:1px solid currentColor">',
    '<span id="inner" style="display:inline-table">',
    '<mark data-test-stack-row="inner-top" style="display:table-row;border-bottom:1px solid currentColor">a+b</mark>',
    '<var data-test-stack-row="inner-bottom" style="display:table-row">c+d</var>',
    '</span></div>',
    '<div data-test-stack-row="outer-bottom" style="display:table-row">e+f</div>',
    '</section></div>'
  ].join(''), 'https://partial-selection.invalid/');
  const document = partial.window.document;
  const target = document.querySelector('#target');
  giveNamedCssStackGeometry(document, 'outer', { width: 100, rowHeight: 30 });
  giveNamedCssStackGeometry(document, 'inner', { left: 20, top: 12, width: 40, rowHeight: 9, gap: 1 });
  const innerTop = document.querySelector('[data-test-stack-row="inner-top"]').firstChild;
  const innerBottom = document.querySelector('[data-test-stack-row="inner-bottom"]').firstChild;
  const outerBottom = document.querySelector('[data-test-stack-row="outer-bottom"]').firstChild;

  const innerPartial = selectRange(partial.window, innerTop, 2, innerBottom, 1);
  for (const [outputMode, text] of Object.entries({
    faithful: 'b/c', calculator: 'b/c', latex: '$\\frac{b}{c}$'
  })) {
    assert.equal(cleanCopy.getCopyPayload(
      document, innerPartial, { outputMode }, partial.window, target
    ).text, text, 'inner partial ' + outputMode);
  }

  const crossHierarchy = selectRange(partial.window, innerTop, 2, outerBottom, 1);
  for (const [outputMode, text] of Object.entries({
    faithful: '(b/(c + d))/e',
    calculator: '(b/(c+d))/e',
    latex: '$\\frac{\\frac{b}{c+d}}{e}$'
  })) {
    assert.equal(cleanCopy.getCopyPayload(
      document, crossHierarchy, { outputMode }, partial.window, target
    ).text, text, 'cross-hierarchy partial ' + outputMode);
  }

  const exactInner = selectContents(partial.window, document.querySelector('#inner'));
  assert.equal(cleanCopy.getCopyPayload(
    document, exactInner, { outputMode: 'faithful' }, partial.window, target
  ).text, '(a + b)/(c + d)');
});

test('unsupported visual-stack layouts fail back to native instead of flattening false math', () => {
  const hosts = ['https://fallback.invalid/', 'https://example.com/app', 'https://docs.google.com/presentation/d/fake/edit'];
  const unsupportedDisplays = ['list-item', 'ruby', 'table-caption', 'run-in'];
  for (const url of hosts) {
    for (const display of unsupportedDisplays) {
      const instance = dom([
        '<div id="target">before <span id="stack" style="display:', display, '">',
        '<i data-test-stack-row="unsupported-top" style="display:block;border-bottom:1px solid currentColor">x+1</i>',
        '<b data-test-stack-row="unsupported-bottom" style="display:block">y</b>',
        '</span> after</div>'
      ].join(''), url);
      const document = instance.window.document;
      const target = document.querySelector('#target');
      giveNamedCssStackGeometry(document, 'unsupported');
      const selection = selectContents(instance.window, document.querySelector('#stack'));
      for (const outputMode of ['faithful', 'calculator', 'latex']) {
        assert.equal(cleanCopy.getCopyPayload(
          document,
          selection,
          { outputMode },
          instance.window,
          target
        ), null, url + ' ' + display + ' ' + outputMode);
      }
    }
  }
});

test('ordinary HTML superscripts and subscripts are repaired identically on unrelated hosts', () => {
  const hosts = [
    'https://scripts.invalid/',
    'https://example.org/notes',
    'https://en.wikipedia.org/wiki/HTML',
    'https://docs.google.com/document/d/fake/pub',
    'http://localhost:4173/'
  ];
  const expectedFormula = {
    faithful: 'F_g = G(m₁m₂/r²)',
    calculator: 'F_(g) = G(m_(1)m_(2)/r^(2))',
    latex: 'F_{g} = G(m_{1}m_{2}/r^{2})'
  };
  const expectedStyled = {
    faithful: 'x² + H₂O',
    calculator: 'x^(2) + H_(2)O',
    latex: 'x^{2} + H_{2}O'
  };

  for (const url of hosts) {
    const formula = dom([
      '<article id="target">F<sub>g</sub> = G(m<sub>1</sub>m<sub>2</sub>/r<sup>2</sup>)</article>'
    ].join(''), url);
    const formulaTarget = formula.window.document.querySelector('#target');
    const formulaSelection = selectContents(formula.window, formulaTarget);
    for (const [outputMode, text] of Object.entries(expectedFormula)) {
      const payload = cleanCopy.getCopyPayload(
        formula.window.document,
        formulaSelection,
        { outputMode },
        formula.window,
        formulaTarget
      );
      assert.equal(payload && payload.reason, 'semantic-html-scripts', url + ' tag reason');
      assert.equal(payload && payload.text, text, url + ' tag ' + outputMode);
    }

    const styled = dom([
      '<style>.raised-', hosts.indexOf(url), '{vertical-align:super}',
      '.lowered-', hosts.indexOf(url), '{font-variant-position:sub}</style>',
      '<p id="target">x<span class="raised-', hosts.indexOf(url), '">2</span> + ',
      'H<span class="lowered-', hosts.indexOf(url), '">2</span>O</p>'
    ].join(''), url);
    const styledTarget = styled.window.document.querySelector('#target');
    const styledSelection = selectContents(styled.window, styledTarget);
    for (const [outputMode, text] of Object.entries(expectedStyled)) {
      assert.equal(cleanCopy.getCopyPayload(
        styled.window.document,
        styledSelection,
        { outputMode },
        styled.window,
        styledTarget
      ).text, text, url + ' computed style ' + outputMode);
    }
    assert.equal(cleanCopy.getCopyPayload(
      styled.window.document,
      styledSelection,
      { outputMode: 'native' },
      styled.window,
      styledTarget
    ), null, url + ' native mode');
  }

  const nested = dom('<p id="target">x<sub>i<sup>2</sup></sub></p>', 'https://nested-scripts.invalid/');
  const nestedTarget = nested.window.document.querySelector('#target');
  const nestedSelection = selectContents(nested.window, nestedTarget);
  for (const [outputMode, text] of Object.entries({
    faithful: 'x_(i^2)', calculator: 'x_(i^(2))', latex: 'x_{i^{2}}'
  })) {
    assert.equal(cleanCopy.getCopyPayload(
      nested.window.document,
      nestedSelection,
      { outputMode },
      nested.window,
      nestedTarget
    ).text, text, 'nested scripts ' + outputMode);
  }

  const exponent = nestedTarget.querySelector('sup').firstChild;
  const exponentOnly = selectRange(nested.window, exponent, 0, exponent, 1);
  assert.equal(cleanCopy.getCopyPayload(
    nested.window.document,
    exponentOnly,
    { outputMode: 'faithful' },
    nested.window,
    nestedTarget
  ).text, '²');
  for (const outputMode of ['calculator', 'latex']) {
    assert.equal(cleanCopy.getCopyPayload(
      nested.window.document,
      exponentOnly,
      { outputMode },
      nested.window,
      nestedTarget
    ), null, outputMode + ' cannot emit a base-less ordinary script');
  }
});

test('semantic-script discovery never queries an unrelated document-sized subtree', () => {
  const noise = Array.from({ length: 5000 }, (_value, index) =>
    '<i class="unrelated-' + index + '"><b>noise</b></i>').join('');
  const instance = dom(
    '<div id="target"><span id="start">alpha   </span><span id="end">beta</span>' +
    '<section id="unselected">' + noise + '</section></div>'
  );
  const documentObject = instance.window.document;
  const target = documentObject.querySelector('#target');
  const originalQuerySelectorAll = target.querySelectorAll;
  let unboundedSemanticQueries = 0;
  let unboundedProtectedQueries = 0;
  target.querySelectorAll = function querySelectorAll(selector) {
    if (selector === 'sup,sub,[style*="vertical-align" i],' +
        '[style*="font-variant-position" i],[class]') unboundedSemanticQueries += 1;
    if (selector === 'pre, code, textarea, input, [data-clean-math-copy-preserve]') {
      unboundedProtectedQueries += 1;
    }
    return Reflect.apply(originalQuerySelectorAll, this, [selector]);
  };
  const selection = selectRange(
    instance.window,
    documentObject.querySelector('#start').firstChild,
    0,
    documentObject.querySelector('#end').firstChild,
    4
  );
  const payload = cleanCopy.getCopyPayload(
    documentObject,
    selection,
    { outputMode: 'faithful' },
    instance.window,
    target
  );
  assert.equal(payload && payload.text, 'alpha beta');
  assert.equal(unboundedSemanticQueries, 0,
    'script detection must walk only intersecting nodes under a hard budget');
  assert.equal(unboundedProtectedQueries, 0,
    'protected-range detection must also avoid an unbounded selector result');
});

test('CSS-stacked math preserves surrounding rich prose and table spans', () => {
  const instance = dom([
    '<style>.fraction{display:inline-table}.fraction>em,.fraction>strong{display:table-row}',
    '.fraction>em{border-bottom:1px solid currentColor}</style>',
    '<div id="target"><p><em>Important</em>: ',
    '<span class="fraction"><em>x</em><strong>y</strong></span></p>',
    '<table><tbody><tr><td>A</td><td colspan="2">B</td><td>C</td></tr></tbody></table></div>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  giveCssStackGeometry(target.querySelector('.fraction'));
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(payload.text, 'Important: x/y\n\nA\tB\t\tC');
  assert.match(payload.html, /<em>Important<\/em>/u);
  assert.match(payload.html, /<table><tbody><tr><td>A<\/td><td colspan="2">B<\/td><td>C<\/td><\/tr><\/tbody><\/table>/u);
  assert.doesNotMatch(payload.html, /class="fraction"|<strong>y<\/strong>/u);

  const tableInstance = dom([
    '<style>.fraction{display:inline-table}.fraction>em,.fraction>strong{display:table-row}',
    '.fraction>em{border-bottom:1px solid currentColor}</style>',
    '<table><tbody><tr id="target"><td><span class="fraction"><em>x</em><strong>y</strong></span></td>',
    '<td>tail</td></tr></tbody></table>'
  ].join(''));
  const tableRow = tableInstance.window.document.querySelector('#target');
  giveCssStackGeometry(tableRow.querySelector('.fraction'));
  const partial = selectRange(
    tableInstance.window,
    tableRow.querySelector('.fraction > em').firstChild,
    0,
    tableRow.lastElementChild.firstChild,
    4
  );
  const partialPayload = cleanCopy.getCopyPayload(
    tableInstance.window.document,
    partial,
    cleanCopy.DEFAULT_SETTINGS,
    tableInstance.window,
    tableRow
  );
  assert.match(partialPayload.html, /<table><tbody><tr><td>/u);
  assert.doesNotMatch(partialPayload.html, /<!--StartFragment--><tr\b/u, 'partial rows are wrapped in valid table context');

  const preserved = dom([
    '<style>.fraction{display:inline-table}.fraction>em,.fraction>strong{display:table-row}',
    '.fraction>em{border-bottom:1px solid currentColor}</style>',
    '<span id="target"><span class="fraction"><em>x</em><strong>y</strong></span>',
    '<span style="white-space:pre-wrap">  alpha  \n  beta  </span></span>'
  ].join(''));
  const preservedTarget = preserved.window.document.querySelector('#target');
  giveCssStackGeometry(preservedTarget.querySelector('.fraction'));
  assert.equal(
    cleanCopy.getCopyPayload(
      preserved.window.document,
      selectContents(preserved.window, preservedTarget),
      cleanCopy.DEFAULT_SETTINGS,
      preserved.window,
      preservedTarget
    ).text,
    'x/y  alpha  \n  beta  ',
    'authored pre-wrap spacing survives beside rewritten math'
  );
});

test('CSS-stacked math discovery is bounded before document-sized layout work', () => {
  const roots = Array.from({ length: 129 }, (_value, index) =>
    '<span class="stack fraction"><em>x<sup>2</sup>+' + index + '</em><strong>y</strong></span>'
  ).join(' ');
  const instance = dom([
    '<style>.stack{display:inline-table}.stack>em,.stack>strong{display:table-row}',
    '.fraction>em{border-bottom:1px solid currentColor}</style>',
    '<div id="target">', roots, '</div>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  assert.equal(
    cleanCopy.getCopyPayload(
      instance.window.document,
      selectContents(instance.window, target),
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      target
    ),
    null
  );
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
  const text = cleanCopy.getCopyPayload(instance.window.document, selection, { outputMode: 'faithful' }, instance.window, target).text;
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

test('repairs renderer accent boxes that flatten vectors and hats into separate lines', () => {
  const instance = dom([
    '<p id="target">An infinitely long, straight, cylindrical wire of radius 𝑅 has a ',
    'uniform current density <span>',
    '<span style="display:block">⃗</span>',
    '<span style="display:block">𝐽</span>',
    '<span style="display:block">=𝐽⁢</span>',
    '<span style="display:block">ˆ</span>',
    '<span style="display:block">𝑧</span>',
    '</span> in cylindrical coordinates.</p>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  const expected = 'An infinitely long, straight, cylindrical wire of radius R has a ' +
    'uniform current density J⃗ = Jẑ in cylindrical coordinates.';
  assert.equal(payload.reason, 'flattened-renderer-math');
  assert.equal(payload.text, expected);
  assert.equal(payload.html, '<!--StartFragment-->' + expected + '<!--EndFragment-->');
  assert.doesNotMatch(payload.text, /[\u2061-\u2064\u{1d400}-\u{1d7ff}]/u);
});

test('copies the same inline vector sentence from native semantic MathML', () => {
  const instance = dom([
    '<p id="target">An infinitely long, straight, cylindrical wire of radius ',
    '<math><mi>R</mi></math> has a uniform current density ',
    '<math><mrow>',
    '<mover accent="true"><mi>J</mi><mo>⃗</mo></mover>',
    '<mo>=</mo><mi>J</mi><mo>⁢</mo>',
    '<mover accent="true"><mi>z</mi><mo>ˆ</mo></mover>',
    '</mrow></math> in cylindrical coordinates.</p>'
  ].join(''));
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
    'An infinitely long, straight, cylindrical wire of radius R has a uniform current density ' +
      'J⃗ = Jẑ in cylindrical coordinates.'
  );
});

test('flattened-renderer repair is conservative and keeps authored arrows, carets, and paragraphs', () => {
  const unchanged = [
    'Line one\nLine two',
    'Use ^\nx as written.',
    'Go\n→\nNorth',
    'The modifier ˆ\nis discussed here.'
  ];
  for (const value of unchanged) assert.equal(cleanCopy.repairFlattenedRendererText(value), value);
  assert.equal(
    cleanCopy.repairFlattenedRendererText('A\nˆ\nz\n\nNext paragraph'),
    'A ẑ\n\nNext paragraph'
  );
  assert.equal(cleanCopy.repairFlattenedRendererText('J\n⃗\n'), 'J⃗');
  assert.equal(cleanCopy.repairFlattenedRendererText('A⁢\n\n⃗\nJ'), 'A\n\nJ⃗');
  assert.equal(cleanCopy.repairFlattenedRendererText('密度\n⃗\n𝐽\n坐标。'), '密度 J⃗ 坐标。');
  assert.equal(cleanCopy.repairFlattenedRendererText('πυκνότητα\n⃗\n𝐽\nσε κυλίνδρους.'), 'πυκνότητα J⃗ σε κυλίνδρους.');
  assert.equal(cleanCopy.repairFlattenedRendererText('كثافة\n⃗\n𝐽\nفي الإحداثيات.'), 'كثافة J⃗ في الإحداثيات.');
  assert.equal(
    cleanCopy.repairFlattenedRendererText('Keep 𝕬𝔹 styled.\nRadius 𝑅, density\n⃗\n𝐽.'),
    'Keep 𝕬𝔹 styled.\nRadius R, density J⃗.'
  );
});

test('flattened-renderer repair preserves unrelated authored breaks and paragraph boundaries', () => {
  const instance = dom([
    '<div id="target"><p>First authored<br>line.</p>',
    '<p>Current density <span>',
    '<span style="display:block">⃗</span><span style="display:block">𝐽</span>',
    '<span style="display:block">=𝐽⁢</span>',
    '<span style="display:block">ˆ</span><span style="display:block">𝑧</span>',
    '</span> in cylindrical coordinates.</p>',
    '<p>Last paragraph.</p></div>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(payload.text, [
    'First authored',
    'line.',
    '',
    'Current density J⃗ = Jẑ in cylindrical coordinates.',
    '',
    'Last paragraph.'
  ].join('\n'));
  assert.match(payload.html, /First authored<br>line\.<br><br>Current density J⃗/u);
  assert.match(payload.html, /coordinates\.<br><br>Last paragraph\./u);
});

test('flattened-renderer recovery stays linear for a near-limit selection with many accents', () => {
  const padding = 'x'.repeat(850000) + '.\n';
  const count = 4096;
  const input = padding + 'density\n⃗\n𝐽\n'.repeat(count);
  assert.ok(input.length < 1024 * 1024);
  const started = Date.now();
  const repaired = cleanCopy.repairFlattenedRendererText(input);
  const elapsed = Date.now() - started;
  assert.equal(repaired, padding + Array(count).fill('density J⃗').join(' '));
  assert.ok(elapsed < 3000, 'near-limit accent repair took ' + elapsed + 'ms');
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
  const equation = wikipediaMath([
    '<mrow><mi>a</mi><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mi>b</mi><mi>x</mi>',
    '<mo>+</mo><mi>c</mi><mo>=</mo><mn>0</mn></mrow>'
  ].join(''), '\\textstyle ax^{2}+bx+c=0');
  const x = wikipediaMath('<mrow><mi>x</mi></mrow>', 'x');
  const a = wikipediaMath('<mrow><mi>a</mi></mrow>', 'a');
  const b = wikipediaMath('<mrow><mi>b</mi></mrow>', 'b');
  const c = wikipediaMath('<mrow><mi>c</mi></mrow>', 'c');
  const nonzero = wikipediaMath(
    '<mrow><mi>a</mi><mo>≠</mo><mn>0</mn></mrow>',
    'a \\neq 0'
  );
  const display = wikipediaMath([
    '<mrow><mi>x</mi><mo>=</mo><mfrac><mrow><mo>−</mo><mi>b</mi><mo>±</mo><msqrt>',
    '<msup><mi>b</mi><mn>2</mn></msup><mo>−</mo><mn>4</mn><mi>a</mi><mi>c</mi>',
    '</msqrt></mrow><mrow><mn>2</mn><mi>a</mi></mrow></mfrac><mo>,</mo></mrow>'
  ].join(''), 'x={\\frac {-b\\pm {\\sqrt {b^{2}-4ac}}}{2a}},', true);
  const nowrap = (math) => '<span class="nowrap">\u2060' + math + '\u2060</span>';
  const instance = dom([
    '<style>.mwe-math-element-block{display:block;overflow:auto hidden}</style>',
    '<main id="target" class="page-Quadratic_formula rootpage-Quadratic_formula">',
    '<p>Given a general quadratic equation of the form ', nowrap(equation),
    ', with ', nowrap(x), ' representing an unknown, and <a>coefficients</a> ', nowrap(a),
    ', ', nowrap(b), ', and ', nowrap(c), ' representing known <a>real</a> or <a>complex</a> ',
    'numbers with ', nowrap(nonzero), ', the values of ', nowrap(x),
    ' satisfying the equation, called the <a><i>roots</i></a> or <i>zeros</i>, can be found ',
    'using the quadratic formula,</p><p>', display, '</p></main>'
  ].join(''), 'https://en.wikipedia.org/wiki/Quadratic_formula');
  const target = instance.window.document.querySelector('#target');
  const firstParagraph = target.querySelector('p');
  const displayRoot = target.querySelector('.mwe-math-element-block');
  assert.equal(
    instance.window.getComputedStyle(displayRoot).display,
    'block',
    'the regression must exercise Wikipedia\'s external display-math CSS'
  );
  assert.equal(displayRoot.childNodes.length, 2, 'the live root contains hidden MathML followed by its fallback image');
  const range = instance.window.document.createRange();
  range.setStart(firstParagraph.firstChild, 0);
  // A real Chromium mouse drag ends on the wrapper after its fallback image,
  // rather than after the surrounding paragraph.
  range.setEnd(displayRoot, displayRoot.childNodes.length);
  const selection = instance.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  );
  assert.equal(
    payload.text,
    'Given a general quadratic equation of the form ax² + bx + c = 0, with x representing an unknown, ' +
      'and coefficients a, b, and c representing known real or complex numbers with a ≠ 0, the values ' +
      'of x satisfying the equation, called the roots or zeros, can be found using the quadratic formula,\n\n' +
      'x = (−b ± √(b² − 4ac))/(2a),'
  );
  assert.doesNotMatch(payload.text + payload.html, /displaystyle|\\textstyle|\\frac|\u2060/u);

  const hiddenOnlyRange = instance.window.document.createRange();
  hiddenOnlyRange.setStart(firstParagraph.firstChild, 0);
  hiddenOnlyRange.setEnd(displayRoot, 1);
  selection.removeAllRanges();
  selection.addRange(hiddenOnlyRange);
  assert.equal(
    cleanCopy.getCopyPayload(
      instance.window.document,
      selection,
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      target
    ),
    null,
    'selecting only the hidden semantic branch must never widen to the visible equation'
  );
  selection.removeAllRanges();
  selection.addRange(range);

  cleanCopy.install(instance.window.document, instance.window, { registerMenus: false });
  const clipboard = new Map();
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      get types() { return Array.from(clipboard.keys()); },
      clearData(type) { if (arguments.length) clipboard.delete(type); else clipboard.clear(); },
      setData(type, value) { clipboard.set(type, value); },
      getData(type) { return clipboard.get(type) || ''; }
    }
  });
  target.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(clipboard.get('text/plain'), payload.text);
  assert.doesNotMatch(clipboard.get('text/html'), /displaystyle|\\textstyle|\\frac|\u2060/u);
});

test('Wikipedia inline math cannot gain display layout trust from CSS alone', () => {
  const inline = wikipediaMath(
    '<mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow>',
    'x=1'
  );
  const instance = dom([
    '<style>.mwe-math-element-inline{display:block}</style>',
    '<p id="target">Before ', inline, ' after.</p>'
  ].join(''), 'https://en.wikipedia.org/wiki/Equation');
  const target = instance.window.document.querySelector('#target');
  assert.equal(instance.window.getComputedStyle(target.querySelector('.mwe-math-element-inline')).display, 'block');
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  ), null);
});

test('a contained renderer image cannot widen past an unselected trailing sibling', () => {
  const instance = dom([
    '<p id="target">Before <span id="math" role="math">',
    '<span style="display:none"><math><mi>SECRET</mi></math></span>',
    '<img aria-hidden="true" alt="harmless">',
    '<span>VISIBLE-REST</span>',
    '</span></p>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  const math = instance.window.document.querySelector('#math');
  const range = instance.window.document.createRange();
  range.setStart(target.firstChild, 0);
  range.setEnd(math, 2);
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

test('a generic two-child renderer cannot impersonate Wikipedia boundary semantics', () => {
  const instance = dom([
    '<p id="target">Before <span id="math" role="math">',
    '<span style="display:none"><math><mi>SECRET</mi></math></span>',
    '<img aria-hidden="true" alt="harmless">',
    '</span></p>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  const math = instance.window.document.querySelector('#math');
  const range = instance.window.document.createRange();
  range.setStart(target.firstChild, 0);
  range.setEnd(math, math.childNodes.length);
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

test('a forged Wikipedia wrapper without its atomic fallback image cannot widen selection', () => {
  const instance = dom([
    '<p id="target">Before <span id="math" class="mwe-math-element">',
    '<span style="display:none"><math><mi>SECRET</mi></math></span>',
    '<span aria-hidden="true">harmless</span>',
    '</span></p>'
  ].join(''));
  const target = instance.window.document.querySelector('#target');
  const math = instance.window.document.querySelector('#math');
  const range = instance.window.document.createRange();
  range.setStart(target.firstChild, 0);
  range.setEnd(math, math.childNodes.length);
  instance.window.getSelection().removeAllRanges();
  instance.window.getSelection().addRange(range);

  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    instance.window.getSelection(),
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    target
  ), null);
});

test('whole renderer boundary normalization preserves same-paragraph context', () => {
  const display = wikipediaMath(
    '<mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow>',
    'x=1',
    true
  );
  const instance = dom([
    '<style>.mwe-math-element-block{display:block}</style>',
    '<p id="target">Before ', display, ' after.</p>'
  ].join(''), 'https://en.wikipedia.org/wiki/Equation');
  const target = instance.window.document.querySelector('#target');
  const root = target.querySelector('.mwe-math-element-block');
  const selection = instance.window.getSelection();
  const payloadFor = (range) => {
    selection.removeAllRanges();
    selection.addRange(range);
    return cleanCopy.getCopyPayload(
      instance.window.document,
      selection,
      cleanCopy.DEFAULT_SETTINGS,
      instance.window,
      target
    );
  };
  const browserBoundary = instance.window.document.createRange();
  browserBoundary.setStart(target.firstChild, 0);
  browserBoundary.setEnd(root, root.childNodes.length);
  const normalizedBoundary = instance.window.document.createRange();
  normalizedBoundary.setStart(target.firstChild, 0);
  normalizedBoundary.setEndAfter(root);
  const expected = payloadFor(normalizedBoundary);
  const actual = payloadFor(browserBoundary);
  assert.equal(actual.text, 'Before\nx = 1');
  assert.equal(actual.text, expected.text);
  assert.equal(actual.html, expected.html);
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
    cleanCopy.getCopyPayload(instance.window.document, selectContents(instance.window, prose), {
      outputMode: 'faithful',
      convertDelimitedLatex: false
    }, instance.window, prose).text,
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
    faithful.html,
    '<!--StartFragment-->|B| = √((27.187)<sup>2</sup> + (17.479)<sup>2</sup> + ' +
      '(−28.112)<sup>2</sup>) = 42.84 μT<!--EndFragment-->'
  );
  const faithfulRich = dom(faithful.html).window.document.body;
  assert.deepEqual(Array.from(faithfulRich.querySelectorAll('sup'), (node) => node.textContent), ['2', '2', '2']);
  assert.equal(/^[\s\u200b\u2060]|[\s\u200b\u2060]$/u.test(faithfulRich.textContent), false);
  assert.equal(/[\r\n]/u.test(faithfulRich.textContent), false);
  assert.equal(
    cleanCopy.googleDocsSlicePayload(slice, { outputMode: 'calculator' }).text,
    'abs(B)=sqrt((27.187)^(2)+(17.479)^(2)+(-28.112)^(2)) = 42.84 μT'
  );
  assert.equal(
    cleanCopy.googleDocsSlicePayload(slice, { outputMode: 'latex' }).text,
    '$|B|=√((27.187)^{2}+(17.479)^{2}+(-28.112)^{2})$ = 42.84 μT'
  );
  for (const outputMode of ['calculator', 'latex']) {
    const payload = cleanCopy.googleDocsSlicePayload(slice, { outputMode });
    const rich = dom(payload.html).window.document.body;
    assert.equal(rich.querySelector('sup, sub'), null, outputMode);
    assert.equal(rich.textContent, payload.text, outputMode);
    assert.equal(/^[\s\u200b\u2060]|[\s\u200b\u2060]$/u.test(rich.textContent), false, outputMode);
  }
});

test('Google Docs suppresses only contextual empty fence placeholders and keeps authored fences', () => {
  const slice = googleDocsSlice([{ equation: [
    'literal () [] {} and ',
    { command: '\\rbracelr', args: [''] },
    { command: '\\sbracelr', args: [''] },
    { command: '\\bracelr', args: [''] },
    ' then ',
    { command: '\\rbracelr', args: ['x'] },
    { command: '\\sbracelr', args: ['y'] },
    { command: '\\bracelr', args: ['z'] },
    ' placeholders ',
    '(', 'a', { command: '\\rbracelr', args: [''] }, ')',
    '{', 'b', { command: '\\sbracelr', args: [''] }, '}',
    '[', 'c', { command: '\\bracelr', args: [''] }, ']',
    ' mismatches ',
    'x', { command: '\\rbracelr', args: [''] }, ')',
    '(', { command: '\\bracelr', args: [''] }, ')'
  ] }]);
  assert.equal(
    cleanCopy.googleDocsSlicePayload(slice, { outputMode: 'faithful' }).text,
    'literal () [] {} and (){}[] then (x){y}[z] placeholders (a){b}[c] mismatches x())([])'
  );
  assert.equal(
    cleanCopy.googleDocsSlicePayload(reportedGoogleDocsEquationSlice(), { outputMode: 'latex' }).text,
    '$|B|=√((27.187)^{2}+(17.479)^{2}+(-28.112)^{2})$ = 42.84 μT'
  );
});

test('Google Docs scripts keep close-only and vertical fence bases atomic', () => {
  const slice = googleDocsSlice([{ equation: [
    '(x', { command: '\\superscript', args: [')', '2'] }, ' ',
    '[x', { command: '\\superscript', args: [']', '2'] }, ' ',
    '{x', { command: '\\superscript', args: ['}', '2'] }, ' ',
    '(x', { command: '\\subscript', args: [')', 'n'] }, ' ',
    '(x', { command: '\\subsuperscript', args: [')', 'n', '2'] }
  ] }]);
  assert.equal(
    cleanCopy.googleDocsSlicePayload(slice, { outputMode: 'faithful' }).text,
    '(x)² [x]² {x}² (x)ₙ (x)ₙ²'
  );
  assert.equal(
    cleanCopy.googleDocsSlicePayload(slice, { outputMode: 'calculator' }).text,
    '(x)^(2) [x]^(2) {x}^(2)*(x)_(n)*(x)_(n)^(2)'
  );

  const absolutePower = googleDocsSlice([{ equation: [
    '|B', { command: '\\superscript', args: ['|', '2'] }
  ] }]);
  const expected = {
    faithful: '|B|²',
    calculator: 'abs(B)^(2)',
    latex: '$|B|^{2}$'
  };
  for (const [outputMode, text] of Object.entries(expected)) {
    assert.equal(cleanCopy.googleDocsSlicePayload(absolutePower, { outputMode }).text, text);
  }

  const allUnicodeClosingPunctuation = [];
  for (let point = 0; point <= 0x10ffff; point += 1) {
    const character = String.fromCodePoint(point);
    if (/^\p{Pe}$/u.test(character)) allUnicodeClosingPunctuation.push(character);
  }
  const unicodeFences = Array.from(new Set([
    ...Array.from('|∣❘∥‖‗⌉⌋»'),
    ...allUnicodeClosingPunctuation
  ]));
  for (const fence of unicodeFences) {
    const fenceSlice = googleDocsSlice([{ equation: [
      'x', { command: '\\superscript', args: [fence, '2'] }
    ] }]);
    const text = cleanCopy.googleDocsSlicePayload(fenceSlice, { outputMode: 'faithful' }).text;
    assert.doesNotMatch(text, /\(/u, 'atomic closing fence must not acquire grouping: ' + fence);
    assert.match(text, /²$/u);
  }
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
  assert.equal(
    cleanCopy.googleDocsSlicePayload(styled, { outputMode: 'faithful' }).html,
    '<!--StartFragment-->x<sup>2</sup> + H<sub>2</sub>O<!--EndFragment-->'
  );
  assert.equal(cleanCopy.googleDocsSlicePayload(googleDocsSlice(['x2 + H2O']), { outputMode: 'faithful' }), null);
  assert.equal(cleanCopy.googleDocsSlicePayload('{not json', { outputMode: 'faithful' }), null);

  const hostile = googleDocsSlice(['<script>&2'], [[0, 'nor'], [9, 'sup']]);
  const hostilePayload = cleanCopy.googleDocsSlicePayload(hostile, { outputMode: 'faithful' });
  assert.equal(hostilePayload.text, '<script>&²');
  assert.equal(
    hostilePayload.html,
    '<!--StartFragment-->&lt;script&gt;&amp;<sup>2</sup><!--EndFragment-->'
  );
  assert.doesNotMatch(hostilePayload.html, /<script[\s>]/iu);

  const schwa = googleDocsSlice([{ equation: ['xₔ'] }]);
  assert.equal(
    cleanCopy.googleDocsSlicePayload(schwa, { outputMode: 'faithful' }).html,
    '<!--StartFragment-->x<sub>ə</sub><!--EndFragment-->'
  );
});

test('Google Docs semantic rich copy stays scoped to a partial equation selection', () => {
  const partial = googleDocsSlice([{ equation: [
    '(27.187', { command: '\\superscript', args: [')', '2'] }
  ] }]);
  const payload = cleanCopy.googleDocsSlicePayload(partial, { outputMode: 'faithful' });
  assert.equal(payload.text, '(27.187)²');
  assert.equal(
    payload.html,
    '<!--StartFragment-->(27.187)<sup>2</sup><!--EndFragment-->'
  );
  assert.doesNotMatch(payload.text + payload.html, /\|B\||17\.479|28\.112|42\.84/u);
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
    event.clipboardData.setData('HTML Format', rich);
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
  assert.equal(
    clipboard.get('text/html'),
    cleanCopy.googleDocsSlicePayload(slice, { outputMode: 'faithful' }).html
  );
  assert.notEqual(clipboard.get('text/html'), rich);
  assert.match(clipboard.get('HTML Format'), /StartFragment:\d{10}/u);
  assert.match(clipboard.get('HTML Format'), /\(27\.187\)<sup>2<\/sup>/u);
  assert.doesNotMatch(clipboard.get('HTML Format'), /[\s\u200b\u2060]<\/body>/u);
  assert.equal(clipboard.get('application/x-vnd.google-docs-document-slice-clip+wrapped'), slice);
  assert.equal(event.defaultPrevented, true);
});

test('Google Docs semantic rich rejection atomically restores wrapped native clipboard flavors', () => {
  const flat = '|B|=√((27.187)2+(17.479)2+(-28.112)2) = 42.84 μT';
  const nativeHTML = '<span>|B|=√((27.187)2+(17.479)2+(-28.112)2) = 42.84 μT</span>';
  const slice = reportedGoogleDocsEquationSlice();
  const customType = 'application/x-vnd.google-docs-document-slice-clip+wrapped';
  const instance = dom('<div id="target" contenteditable="true">' + flat + '</div>', 'https://docs.google.com/document/d/test/edit');
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const clipboard = new Map();
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData('text/plain', flat);
    event.clipboardData.setData('text/html', nativeHTML);
    event.clipboardData.setData(customType, slice);
    event.preventDefault();
    event.stopImmediatePropagation();
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      get types() { return Array.from(clipboard.keys()); },
      clearData(type) { if (arguments.length) clipboard.delete(type); else clipboard.clear(); },
      setData(type, value) {
        if (type.toLowerCase() === 'text/html' && /<sup>2<\/sup>/u.test(value)) {
          throw new Error('browser rejected semantic HTML');
        }
        clipboard.set(type, value);
      },
      getData(type) { return clipboard.get(type) || ''; }
    }
  });
  target.dispatchEvent(event);
  assert.equal(clipboard.get('text/plain'), flat);
  assert.equal(clipboard.get('text/html'), nativeHTML);
  assert.equal(clipboard.get(customType), slice);
});

test('Google Docs non-wrappable semantic writes roll back every accepted rich and plain flavor', () => {
  const flat = '|B|=√((27.187)2+(17.479)2+(-28.112)2) = 42.84 μT';
  const nativeHTML = '<span>|B|=√((27.187)2+(17.479)2+(-28.112)2) = 42.84 μT</span>';
  const nativeHTMLFormat = 'Version:1.0\r\nStartHTML:0000000000\r\nNATIVE';
  const customType = 'application/x-vnd.google-docs-document-slice-clip+wrapped';
  const slice = reportedGoogleDocsEquationSlice();
  for (const rejectAt of [1, 2, 3]) {
    const instance = dom('<div id="target" contenteditable="true">' + flat + '</div>', 'https://docs.google.com/document/d/test/edit');
    const target = instance.window.document.querySelector('#target');
    selectContents(instance.window, target);
    cleanCopy.install(instance.window.document, instance.window);
    const initial = new Map([
      ['text/plain', flat],
      ['text/html', nativeHTML],
      ['HTML Format', nativeHTMLFormat],
      [customType, slice]
    ]);
    const values = new Map(initial);
    let semanticWrites = 0;
    let rejected = false;
    const clipboardData = {
      get types() { return Array.from(values.keys()); },
      clearData(type) { if (arguments.length) values.delete(type); else values.clear(); },
      getData(type) { return values.get(type) || ''; }
    };
    Object.defineProperty(clipboardData, 'setData', {
      value(type, value) {
        if (!rejected && value !== initial.get(type)) {
          semanticWrites += 1;
          if (semanticWrites === rejectAt) {
            rejected = true;
            throw new Error('browser rejected semantic flavor');
          }
        }
        values.set(type, value);
      },
      configurable: false,
      writable: false
    });
    const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: clipboardData });
    target.dispatchEvent(event);
    assert.deepEqual(values, initial, 'rejected write ' + rejectAt);
    assert.equal(event.defaultPrevented, false, 'rejected write ' + rejectAt);
  }
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
  assert.equal(
    clipboard.get('text/html'),
    cleanCopy.googleDocsSlicePayload(slice, { outputMode: 'faithful' }).html
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
  assert.equal(
    replacementClipboard.get('text/html'),
    cleanCopy.googleDocsSlicePayload(slice, { outputMode: 'faithful' }).html
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
    storedSettings = {
      outputMode: 'ascii',
      convertDelimitedLatex: false,
      cleanInvisibleArtifacts: false
    };
    assert.deepEqual(childController.settings, { outputMode: 'faithful' });
    storedSettings = { outputMode: 'calculator' };
    assert.equal(childController.settings.outputMode, 'calculator');
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

test('Original copy/paste bypasses the isolated-world relay before it patches clipboard APIs', () => {
  const instance = new JSDOM(
    '<!doctype html><html><body><div id="target">x2</div></body></html>',
    { url: 'https://example.test/', runScripts: 'dangerously' }
  );
  const previousInfo = Object.getOwnPropertyDescriptor(globalThis, 'GM_info');
  const previousAddElement = Object.getOwnPropertyDescriptor(globalThis, 'GM_addElement');
  Object.defineProperty(globalThis, 'GM_info', {
    value: { injectInto: 'content' }, configurable: true, writable: true
  });
  Object.defineProperty(globalThis, 'GM_addElement', {
    configurable: true,
    writable: true,
    value(parent, tagName, attributes) {
      const element = parent.ownerDocument.createElement(tagName);
      parent.appendChild(element);
      if (attributes && attributes.textContent) {
        parent.ownerDocument.defaultView.eval(String(attributes.textContent));
      }
      return element;
    }
  });

  try {
    cleanCopy.install(instance.window.document, instance.window, {
      settingsProvider: () => ({ outputMode: 'native' }),
      registerMenus: false
    });
    const carrier = instance.window.document.querySelector('[data-clean-math-copy-relay-ready="1"]');
    assert.ok(carrier);

    const values = new Map();
    const clipboardData = {
      get types() { return Array.from(values.keys()); },
      clearData(type) { if (arguments.length) values.delete(type); else values.clear(); },
      setData(type, value) { values.set(type, value); },
      getData(type) { return values.get(type) || ''; }
    };
    const originalSetData = clipboardData.setData;
    const originalClearData = clipboardData.clearData;
    const target = instance.window.document.querySelector('#target');
    target.addEventListener('copy', (event) => {
      assert.equal(event.clipboardData.setData, originalSetData);
      assert.equal(event.clipboardData.clearData, originalClearData);
      event.clipboardData.setData('text/plain', 'x2\n\n');
      event.clipboardData.setData('text/html', '<i>x<sup>2</sup></i>\n');
      event.clipboardData.setData('application/x-native', 'keep-me');
      event.stopImmediatePropagation();
    });
    const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
    Object.defineProperty(event, 'clipboardData', { value: clipboardData });
    target.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
    assert.equal(clipboardData.setData, originalSetData);
    assert.equal(clipboardData.clearData, originalClearData);
    assert.equal(values.get('text/plain'), 'x2\n\n');
    assert.equal(values.get('text/html'), '<i>x<sup>2</sup></i>\n');
    assert.equal(values.get('application/x-native'), 'keep-me');
  } finally {
    if (previousInfo) Object.defineProperty(globalThis, 'GM_info', previousInfo);
    else delete globalThis.GM_info;
    if (previousAddElement) Object.defineProperty(globalThis, 'GM_addElement', previousAddElement);
    else delete globalThis.GM_addElement;
  }
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
    }, { once: true });
    const event = new childWindow.Event('copy', { bubbles: true, cancelable: true, composed: true });
    Object.defineProperty(event, 'clipboardData', { value: Object.create(clipboardPrototype) });
    target.dispatchEvent(event);
    assert.equal(
      clipboard.get('text/plain'),
      '|B| = √((27.187)² + (17.479)² + (−28.112)²) = 42.84 μT'
    );
    assert.equal(
      clipboard.get('text/html'),
      cleanCopy.googleDocsSlicePayload(slice, { outputMode: 'faithful' }).html
    );
    assert.equal(clipboard.get('application/x-vnd.google-docs-document-slice-clip+wrapped'), slice);
    assert.equal(event.defaultPrevented, true);

    const rejectedClipboard = new Map();
    const nativeHTML = '<span>|B|=√((27.187)2+(17.479)2+(-28.112)2) = 42.84 μT</span>';
    const rejectingPrototype = {
      get types() { return Array.from(rejectedClipboard.keys()); },
      clearData(type) { if (arguments.length) rejectedClipboard.delete(type); else rejectedClipboard.clear(); },
      setData(type, value) {
        if (type.toLowerCase() === 'text/html' && /<sup>2<\/sup>/u.test(value)) {
          throw new Error('browser rejected relayed semantic HTML');
        }
        rejectedClipboard.set(type, value);
      },
      getData(type) { return rejectedClipboard.get(type) || ''; }
    };
    const cachedRejectingSetData = rejectingPrototype.setData;
    target.addEventListener('copy', (copyEvent) => {
      Reflect.apply(cachedRejectingSetData, copyEvent.clipboardData, ['text/plain', flat]);
      Reflect.apply(cachedRejectingSetData, copyEvent.clipboardData, ['text/html', nativeHTML]);
      Reflect.apply(cachedRejectingSetData, copyEvent.clipboardData, [
        'application/x-vnd.google-docs-document-slice-clip+wrapped',
        slice
      ]);
      copyEvent.preventDefault();
      copyEvent.stopImmediatePropagation();
    }, { once: true });
    const rejectedEvent = new childWindow.Event('copy', { bubbles: true, cancelable: true, composed: true });
    Object.defineProperty(rejectedEvent, 'clipboardData', { value: Object.create(rejectingPrototype) });
    target.dispatchEvent(rejectedEvent);
    assert.equal(rejectedClipboard.get('text/plain'), flat);
    assert.equal(rejectedClipboard.get('text/html'), nativeHTML);
    assert.equal(rejectedClipboard.get('application/x-vnd.google-docs-document-slice-clip+wrapped'), slice);
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

test('generic clipboard MathML requires visible token order and keeps valid structures', () => {
  const run = (nativeText, mathML) => {
    const instance = dom('<div id="target" contenteditable="true">' + nativeText + '</div>');
    const target = instance.window.document.querySelector('#target');
    selectContents(instance.window, target);
    cleanCopy.install(instance.window.document, instance.window);
    const clipboard = new Map();
    target.addEventListener('copy', (event) => {
      event.clipboardData.setData('text/plain', nativeText);
      event.clipboardData.setData(
        'application/mathml+xml',
        '<math xmlns="http://www.w3.org/1998/Math/MathML">' + mathML + '</math>'
      );
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
    return clipboard.get('text/plain');
  };

  assert.equal(
    run('y − x', '<mrow><mi>x</mi><mo>−</mo><mi>y</mi></mrow>'),
    'y − x'
  );
  assert.equal(run('ab', '<mfrac><mi>a</mi><mi>b</mi></mfrac>'), 'a/b');
  assert.equal(run('x2', '<msup><mi>x</mi><mn>2</mn></msup>'), 'x²');
  assert.equal(run('ˆx', '<mover accent="true"><mi>x</mi><mo>ˆ</mo></mover>'), 'x̂');
});

test('repairs a site-written flattened vector even when the site stops copy propagation', () => {
  const instance = dom('<div id="target" contenteditable="true">selected text</div>');
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const clipboard = new Map();
  const brokenHTML = '<span>density<br>⃗<br>𝐽<br>=𝐽⁢<br>ˆ<br>𝑧<br>in cylindrical coordinates.</span>';
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData(
      'text/plain',
      'An infinitely long, straight, cylindrical wire of radius 𝑅 has a uniform current density ' +
        '\n⃗\n𝐽\n=𝐽⁢\nˆ\n𝑧\n in cylindrical coordinates.'
    );
    event.clipboardData.setData('text/html', brokenHTML);
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
  assert.equal(
    clipboard.get('text/plain'),
    'An infinitely long, straight, cylindrical wire of radius R has a uniform current density ' +
      'J⃗ = Jẑ in cylindrical coordinates.'
  );
  assert.equal(
    clipboard.get('text/html'),
    '<!--StartFragment-->An infinitely long, straight, cylindrical wire of radius R has a ' +
      'uniform current density J⃗ = Jẑ in cylindrical coordinates.<!--EndFragment-->'
  );
  assert.doesNotMatch(clipboard.get('text/html'), /<br>⃗|<br>ˆ/u);
});

test('repairs flattened plain and rich clipboard data when DataTransfer methods cannot be wrapped', () => {
  const instance = dom('<div id="target" contenteditable="true">selected text</div>');
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const raw = 'density \n⃗\n𝐽\n=𝐽⁢\nˆ\n𝑧\n in cylindrical coordinates.';
  const brokenHTML = '<span>density<br>⃗<br>𝐽<br>=𝐽⁢<br>ˆ<br>𝑧<br>in cylindrical coordinates.</span>';
  const values = new Map([['text/plain', raw], ['text/html', brokenHTML]]);
  const clipboardData = {
    get types() { return Array.from(values.keys()); },
    clearData(type) { if (arguments.length) values.delete(type); else values.clear(); },
    getData(type) { return values.get(type) || ''; }
  };
  Object.defineProperty(clipboardData, 'setData', {
    value(type, value) { values.set(type, value); },
    configurable: false,
    writable: false
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  target.dispatchEvent(event);
  assert.equal(values.get('text/plain'), 'density J⃗ = Jẑ in cylindrical coordinates.');
  assert.equal(
    values.get('text/html'),
    '<!--StartFragment-->density J⃗ = Jẑ in cylindrical coordinates.<!--EndFragment-->'
  );
  assert.equal(event.defaultPrevented, true);
});

test('a non-wrappable flattened rich rewrite rolls back rejected second and third writes', () => {
  const rawPlain = 'density \n⃗\n𝐽\n=𝐽⁢\nˆ\n𝑧\n in cylindrical coordinates.';
  const rawHTML = '<span>density<br>⃗<br>𝐽<br>=𝐽⁢<br>ˆ<br>𝑧</span>';
  const rawHTMLFormat = 'Version:1.0\r\nStartHTML:0000000000\r\nBROKEN';
  for (const rejectAt of [2, 3]) {
    const instance = dom('<div id="target" contenteditable="true">selected text</div>');
    const target = instance.window.document.querySelector('#target');
    selectContents(instance.window, target);
    cleanCopy.install(instance.window.document, instance.window);
    const initial = new Map([
      ['text/plain', rawPlain],
      ['text/html', rawHTML],
      ['HTML Format', rawHTMLFormat]
    ]);
    const values = new Map(initial);
    let repairWrites = 0;
    let rejected = false;
    const clipboardData = {
      get types() { return Array.from(values.keys()); },
      clearData(type) { if (arguments.length) values.delete(type); else values.clear(); },
      getData(type) { return values.get(type) || ''; }
    };
    Object.defineProperty(clipboardData, 'setData', {
      value(type, value) {
        if (!rejected && value !== initial.get(type)) {
          repairWrites += 1;
          if (repairWrites === rejectAt) {
            rejected = true;
            throw new Error('browser rejected clipboard flavor');
          }
        }
        values.set(type, value);
      },
      configurable: false,
      writable: false
    });
    const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: clipboardData });
    target.dispatchEvent(event);
    assert.deepEqual(values, initial, 'rejected write ' + rejectAt);
    assert.equal(event.defaultPrevented, false, 'rejected write ' + rejectAt);
  }
});

test('a later native plain write rolls back an earlier flattened rich rewrite', () => {
  const instance = dom('<div id="target" contenteditable="true">selected text</div>');
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  cleanCopy.install(instance.window.document, instance.window);
  const clipboard = new Map();
  const nativeHTML = '<span>site-owned final HTML</span>';
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData('text/plain', 'density \n⃗\n𝐽\n=𝐽⁢\nˆ\n𝑧');
    event.clipboardData.setData('text/html', nativeHTML);
    event.clipboardData.setData('text/plain', 'site-owned final text');
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
  assert.equal(clipboard.get('text/plain'), 'site-owned final text');
  assert.equal(clipboard.get('text/html'), nativeHTML);
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

test('a disconnected page relay never patches page-owned clipboard methods', () => {
  const instance = new JSDOM(
    '<!doctype html><html><body><span id="carrier"></span><div id="target">native</div></body></html>',
    { url: 'https://example.test/', runScripts: 'dangerously' }
  );
  instance.window.eval(
    '(' + cleanCopy.cleanMathCopyPageRelayMain.toString() + ')(' +
    JSON.stringify('carrier') + ',' + JSON.stringify('relay-request') + ');'
  );
  const carrier = instance.window.document.querySelector('#carrier');
  assert.equal(carrier.getAttribute('data-clean-math-copy-relay-ready'), '1');
  carrier.remove();

  const values = new Map();
  const clipboardPrototype = {
    get types() { return Array.from(values.keys()); },
    clearData(type) { if (type) values.delete(type); else values.clear(); },
    setData(type, value) { values.set(type, value); },
    getData(type) { return values.get(type) || ''; }
  };
  const clipboardData = Object.create(clipboardPrototype);
  const target = instance.window.document.querySelector('#target');
  target.addEventListener('copy', (event) => {
    event.clipboardData.setData('text/plain', 'native');
    event.stopImmediatePropagation();
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  target.dispatchEvent(event);

  assert.equal(values.get('text/plain'), 'native');
  assert.equal(Object.hasOwn(clipboardData, 'setData'), false);
  assert.equal(Object.hasOwn(clipboardData, 'clearData'), false);
  assert.equal(Object.hasOwn(event, 'stopPropagation'), false);
  assert.equal(Object.hasOwn(event, 'stopImmediatePropagation'), false);
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
    { outputMode: 'faithful' },
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
    cleanCopy.getCopyPayload(instance.window.document, partial, { outputMode: 'faithful' }, instance.window, tokens[0]).text,
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
    { outputMode: 'faithful' },
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

test('paired modern menus mark only the active mode and reject a stale settings read', async () => {
  const instance = dom('<p>settings race</p>');
  const commands = new Map();
  const registrations = [];
  const removals = [];
  const saved = [];
  let nextCommandId = 0;
  let resolveInitialRead;
  const previousGM = global.GM;
  const previousRegister = global.GM_registerMenuCommand;
  const previousUnregister = global.GM_unregisterMenuCommand;
  try {
    delete global.GM_registerMenuCommand;
    delete global.GM_unregisterMenuCommand;
    global.GM = {
      getValue() {
        return new Promise((resolve) => { resolveInitialRead = resolve; });
      },
      setValue(_key, value) {
        saved.push(value);
        return Promise.resolve();
      },
      registerMenuCommand(caption, callback) {
        const id = 'returned-menu-' + (++nextCommandId);
        commands.set(id, { caption, callback, argumentCount: arguments.length });
        registrations.push({ id, caption, argumentCount: arguments.length });
        return Promise.resolve(id);
      },
      unregisterMenuCommand(id) {
        removals.push(id);
        return Promise.resolve().then(() => commands.delete(id));
      }
    };
    const installed = cleanCopy.install(instance.window.document, instance.window);
    assert.deepEqual(Array.from(commands.values(), (command) => command.caption), [
      '✓ Readable text (recommended)',
      'Calculator-safe',
      'Original LaTeX',
      'Original copy/paste'
    ]);
    assert.equal(Array.from(commands.values()).every((command) => command.argumentCount === 2), true);
    assert.doesNotMatch(
      Array.from(commands.values(), (command) => command.caption).join('\n'),
      /ASCII|toggle|copy current|show current/i
    );

    Array.from(commands.values()).find((command) => command.caption === 'Calculator-safe').callback();
    assert.deepEqual(installed.settings, { outputMode: 'calculator' });
    assert.deepEqual(saved.at(-1), { outputMode: 'calculator' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(commands.size, 4);
    assert.deepEqual(Array.from(commands.values(), (command) => command.caption), [
      'Readable text (recommended)',
      '✓ Calculator-safe',
      'Original LaTeX',
      'Original copy/paste'
    ]);
    assert.deepEqual(removals, [
      'returned-menu-1', 'returned-menu-2', 'returned-menu-3', 'returned-menu-4'
    ]);
    assert.equal(registrations.every((command) => command.argumentCount === 2), true);

    const registrationCount = registrations.length;
    const removalCount = removals.length;
    Array.from(commands.values()).find((command) => command.caption === '✓ Calculator-safe').callback();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(registrations.length, registrationCount, 'selecting the active mode does not churn menus');
    assert.equal(removals.length, removalCount);

    resolveInitialRead({
      outputMode: 'latex',
      convertDelimitedLatex: false,
      cleanInvisibleArtifacts: false
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(installed.settings, { outputMode: 'calculator' });
    assert.equal(Array.from(commands.values()).filter((command) => command.caption.startsWith('✓ ')).length, 1);
    assert.ok(Array.from(commands.values()).some((command) => command.caption === '✓ Calculator-safe'));

    Array.from(commands.values()).find((command) => command.caption === 'Original LaTeX').callback();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(installed.settings, { outputMode: 'latex' });
    assert.ok(Array.from(commands.values()).some((command) => command.caption === '✓ Original LaTeX'));
    Array.from(commands.values()).find((command) => command.caption === 'Original copy/paste').callback();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(installed.settings, { outputMode: 'native' });
    assert.deepEqual(saved.at(-1), { outputMode: 'native' });
    assert.equal(commands.size, 4);
    assert.ok(Array.from(commands.values()).some((command) => command.caption === '✓ Original copy/paste'));
  } finally {
    if (previousGM === undefined) delete global.GM;
    else global.GM = previousGM;
    if (previousRegister === undefined) delete global.GM_registerMenuCommand;
    else global.GM_registerMenuCommand = previousRegister;
    if (previousUnregister === undefined) delete global.GM_unregisterMenuCommand;
    else global.GM_unregisterMenuCommand = previousUnregister;
  }
});

test('rejected ID-less Promise menu registrations stay handled and never duplicate static choices', async () => {
  const instance = dom('<p>stored settings</p>');
  const commands = new Map();
  let nextCommandId = 0;
  const previousGM = global.GM;
  const previousRegister = global.GM_registerMenuCommand;
  try {
    delete global.GM_registerMenuCommand;
    global.GM = {
      getValue() {
        return Promise.resolve({
          outputMode: 'latex',
          convertDelimitedLatex: false,
          cleanInvisibleArtifacts: false
        });
      },
      setValue() { return Promise.resolve(); },
      registerMenuCommand(caption, callback) {
        const id = 'returned-menu-' + (++nextCommandId);
        commands.set(id, { caption, callback });
        return Promise.reject(new Error('manager rejected its optional result'));
      }
    };
    const installed = cleanCopy.install(instance.window.document, instance.window);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(installed.settings, { outputMode: 'latex' });
    assert.equal(commands.size, 4);
    assert.deepEqual(Array.from(commands.values(), (command) => command.caption), [
      'Readable text (recommended)',
      'Calculator-safe',
      '✓ Original LaTeX',
      'Original copy/paste'
    ]);
    commands.get('returned-menu-2').callback();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(installed.settings, { outputMode: 'calculator' });
    assert.equal(commands.size, 4);
  } finally {
    if (previousGM === undefined) delete global.GM;
    else global.GM = previousGM;
    if (previousRegister === undefined) delete global.GM_registerMenuCommand;
    else global.GM_registerMenuCommand = previousRegister;
  }
});

test('ID-less legacy menu APIs receive four two-argument choices without duplicate refreshes', () => {
  const instance = dom('<p>legacy menu</p>');
  const commands = [];
  const previousGM = global.GM;
  const previousGetValue = global.GM_getValue;
  const previousRegister = global.GM_registerMenuCommand;
  const previousUnregister = global.GM_unregisterMenuCommand;
  const previousSetValue = global.GM_setValue;
  try {
    delete global.GM;
    global.GM_getValue = () => ({ outputMode: 'faithful' });
    delete global.GM_unregisterMenuCommand;
    global.GM_registerMenuCommand = function strictLegacyRegister(caption, callback, accessKey) {
      if (arguments.length > 2 || (accessKey != null && typeof accessKey !== 'string')) {
        throw new TypeError('legacy API accepts only an optional access-key string');
      }
      commands.push({ caption, callback, argumentCount: arguments.length });
      return undefined;
    };
    global.GM_setValue = () => undefined;
    const installed = cleanCopy.install(instance.window.document, instance.window);
    assert.deepEqual(commands.map((command) => command.caption), [
      '✓ Readable text (recommended)',
      'Calculator-safe',
      'Original LaTeX',
      'Original copy/paste'
    ]);
    assert.equal(commands.every((command) => command.argumentCount === 2), true);
    for (const command of commands) command.callback();
    assert.equal(commands.length, 4);
    assert.deepEqual(installed.settings, { outputMode: 'native' });
    assert.equal(commands.filter((command) => command.caption.startsWith('✓ ')).length, 1);
  } finally {
    if (previousGM === undefined) delete global.GM;
    else global.GM = previousGM;
    if (previousGetValue === undefined) delete global.GM_getValue;
    else global.GM_getValue = previousGetValue;
    if (previousRegister === undefined) delete global.GM_registerMenuCommand;
    else global.GM_registerMenuCommand = previousRegister;
    if (previousUnregister === undefined) delete global.GM_unregisterMenuCommand;
    else global.GM_unregisterMenuCommand = previousUnregister;
    if (previousSetValue === undefined) delete global.GM_setValue;
    else global.GM_setValue = previousSetValue;
  }
});

test('menu registration falls back to the paired modern API when paired legacy registration throws', async () => {
  const instance = dom('<p>fallback menu</p>');
  const commands = new Map();
  let nextCommandId = 0;
  const previousGM = global.GM;
  const previousGetValue = global.GM_getValue;
  const previousRegister = global.GM_registerMenuCommand;
  const previousUnregister = global.GM_unregisterMenuCommand;
  try {
    global.GM_getValue = () => ({ outputMode: 'faithful' });
    global.GM_registerMenuCommand = () => { throw new Error('legacy unavailable'); };
    global.GM_unregisterMenuCommand = () => undefined;
    global.GM = {
      registerMenuCommand(caption, callback) {
        const id = ++nextCommandId;
        commands.set(id, { caption, callback });
        return id;
      },
      unregisterMenuCommand(id) {
        commands.delete(id);
      }
    };
    cleanCopy.install(instance.window.document, instance.window);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(Array.from(commands.values(), (command) => command.caption), [
      '✓ Readable text (recommended)',
      'Calculator-safe',
      'Original LaTeX',
      'Original copy/paste'
    ]);
  } finally {
    if (previousGM === undefined) delete global.GM;
    else global.GM = previousGM;
    if (previousGetValue === undefined) delete global.GM_getValue;
    else global.GM_getValue = previousGetValue;
    if (previousRegister === undefined) delete global.GM_registerMenuCommand;
    else global.GM_registerMenuCommand = previousRegister;
    if (previousUnregister === undefined) delete global.GM_unregisterMenuCommand;
    else global.GM_unregisterMenuCommand = previousUnregister;
  }
});

test('mode changes synchronize to open frames while only the top page refreshes its four menus', async () => {
  const instance = dom('<iframe></iframe><p>top</p>');
  const frame = instance.window.document.querySelector('iframe');
  frame.contentDocument.body.innerHTML = '<p>child</p>';
  const listeners = [];
  const commands = new Map();
  let nextCommandId = 0;
  const previousGetValue = global.GM_getValue;
  const previousAddValueChangeListener = global.GM_addValueChangeListener;
  const previousRegister = global.GM_registerMenuCommand;
  const previousUnregister = global.GM_unregisterMenuCommand;
  try {
    global.GM_getValue = () => ({ outputMode: 'faithful' });
    global.GM_addValueChangeListener = (_key, callback) => {
      listeners.push(callback);
      return listeners.length;
    };
    global.GM_registerMenuCommand = (caption, callback) => {
      const id = ++nextCommandId;
      commands.set(id, { caption, callback });
      return id;
    };
    global.GM_unregisterMenuCommand = (id) => commands.delete(id);
    const child = cleanCopy.install(frame.contentDocument, frame.contentWindow);
    const top = cleanCopy.install(instance.window.document, instance.window);
    assert.equal(commands.size, 4);
    assert.ok(Array.from(commands.values()).some((command) =>
      command.caption === '✓ Readable text (recommended)'));
    assert.equal(listeners.length, 2);
    for (const listener of listeners) {
      listener('cleanMathCopy.settings.v3', { outputMode: 'faithful' }, { outputMode: 'native' }, true);
    }
    assert.deepEqual(child.settings, { outputMode: 'native' });
    assert.deepEqual(top.settings, { outputMode: 'native' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(commands.size, 4);
    assert.equal(Array.from(commands.values()).filter((command) => command.caption.startsWith('✓ ')).length, 1);
    assert.ok(Array.from(commands.values()).some((command) => command.caption === '✓ Original copy/paste'));
  } finally {
    if (previousGetValue === undefined) delete global.GM_getValue;
    else global.GM_getValue = previousGetValue;
    if (previousAddValueChangeListener === undefined) delete global.GM_addValueChangeListener;
    else global.GM_addValueChangeListener = previousAddValueChangeListener;
    if (previousRegister === undefined) delete global.GM_registerMenuCommand;
    else global.GM_registerMenuCommand = previousRegister;
    if (previousUnregister === undefined) delete global.GM_unregisterMenuCommand;
    else global.GM_unregisterMenuCommand = previousUnregister;
  }
});

test('modern settings subscribe before reading so a stale snapshot cannot win', async () => {
  const instance = dom('<p>settings ordering</p>');
  const previousGM = global.GM;
  const previousGetValue = global.GM_getValue;
  const previousAddValueChangeListener = global.GM_addValueChangeListener;
  let settingsListener = null;
  let finishSubscription = null;
  let finishRead = null;
  let readCalls = 0;
  try {
    delete global.GM_getValue;
    delete global.GM_addValueChangeListener;
    global.GM = {
      addValueChangeListener(_key, callback) {
        settingsListener = callback;
        return new Promise((resolve) => { finishSubscription = resolve; });
      },
      getValue() {
        readCalls += 1;
        return new Promise((resolve) => { finishRead = resolve; });
      }
    };
    const installed = cleanCopy.install(instance.window.document, instance.window, { registerMenus: false });
    assert.equal(readCalls, 0);
    finishSubscription(1);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(readCalls, 1);
    settingsListener(
      'cleanMathCopy.settings.v3',
      { outputMode: 'faithful' },
      { outputMode: 'native' },
      true
    );
    finishRead({ outputMode: 'faithful' });
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(installed.settings, { outputMode: 'native' });
  } finally {
    if (previousGM === undefined) delete global.GM;
    else global.GM = previousGM;
    if (previousGetValue === undefined) delete global.GM_getValue;
    else global.GM_getValue = previousGetValue;
    if (previousAddValueChangeListener === undefined) delete global.GM_addValueChangeListener;
    else global.GM_addValueChangeListener = previousAddValueChangeListener;
  }
});

test('an early Google Docs child synchronizes with modern-only settings APIs', async () => {
  const instance = new JSDOM(
    '<!doctype html><html><body><div class="kix-appview-editor"></div><iframe></iframe></body></html>',
    { url: 'https://docs.google.com/document/d/test/edit' }
  );
  const frame = instance.window.document.querySelector('iframe');
  frame.contentDocument.body.innerHTML = '<div contenteditable="true">x2</div>';
  const previousGM = global.GM;
  const previousGetValue = global.GM_getValue;
  const previousAddValueChangeListener = global.GM_addValueChangeListener;
  let settingsListener = null;
  try {
    delete global.GM_getValue;
    delete global.GM_addValueChangeListener;
    global.GM = {
      getValue() { return Promise.resolve({ outputMode: 'native' }); },
      addValueChangeListener(_key, callback) {
        settingsListener = callback;
        return 1;
      }
    };
    const child = cleanCopy.install(frame.contentDocument, frame.contentWindow);
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(child.settings, { outputMode: 'native' });
    settingsListener(
      'cleanMathCopy.settings.v3',
      { outputMode: 'native' },
      { outputMode: 'calculator' },
      true
    );
    assert.deepEqual(child.settings, { outputMode: 'calculator' });
  } finally {
    if (previousGM === undefined) delete global.GM;
    else global.GM = previousGM;
    if (previousGetValue === undefined) delete global.GM_getValue;
    else global.GM_getValue = previousGetValue;
    if (previousAddValueChangeListener === undefined) delete global.GM_addValueChangeListener;
    else global.GM_addValueChangeListener = previousAddValueChangeListener;
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

test('Original copy/paste mode leaves rendered math and every site clipboard format native', () => {
  const instance = dom(
    '<div id="target" contenteditable="true">before\u200b ' +
    katex('<mrow><msup><mi>x</mi><mn>2</mn></msup><mo>=</mo><mn>4</mn></mrow>', 'x^2=4') +
    ' after</div>'
  );
  const target = instance.window.document.querySelector('#target');
  selectContents(instance.window, target);
  assert.equal(cleanCopy.getCopyPayload(
    instance.window.document,
    instance.window.getSelection(),
    { outputMode: 'native' },
    instance.window,
    target
  ), null);

  const clipboard = new Map();
  let clearCalls = 0;
  let siteHandlerCalled = false;
  const clipboardData = {
    get types() { return Array.from(clipboard.keys()); },
    clearData(type) {
      clearCalls += 1;
      if (arguments.length) clipboard.delete(type);
      else clipboard.clear();
    },
    setData(type, value) { clipboard.set(type, value); },
    getData(type) { return clipboard.get(type) || ''; }
  };
  const originalSetData = clipboardData.setData;
  const originalClearData = clipboardData.clearData;
  cleanCopy.install(instance.window.document, instance.window, {
    settingsProvider: () => ({ outputMode: 'native' }),
    registerMenus: false
  });
  target.addEventListener('copy', (event) => {
    siteHandlerCalled = true;
    assert.equal(event.clipboardData.setData, originalSetData);
    assert.equal(event.clipboardData.clearData, originalClearData);
    event.clipboardData.setData('text/plain', '  x2\n\nsite spacing  ');
    event.clipboardData.setData('text/html', '<b>  x<sup>2</sup><br><br>site spacing  </b>');
    event.clipboardData.setData('application/x-site-native', 'opaque\u0000payload');
    event.stopImmediatePropagation();
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  target.dispatchEvent(event);

  assert.equal(siteHandlerCalled, true);
  assert.equal(event.defaultPrevented, false);
  assert.equal(clearCalls, 0);
  assert.equal(clipboardData.setData, originalSetData);
  assert.equal(clipboardData.clearData, originalClearData);
  assert.equal(clipboard.get('text/plain'), '  x2\n\nsite spacing  ');
  assert.equal(clipboard.get('text/html'), '<b>  x<sup>2</sup><br><br>site spacing  </b>');
  assert.equal(clipboard.get('application/x-site-native'), 'opaque\u0000payload');
});

test('Original copy/paste mode never arms Microsoft Word staging recovery', async () => {
  const instance = dom([
    '<div id="WACViewPanel_EditingElement" contenteditable="true">native selection</div>',
    '<div id="WACViewPanel_ClipboardElement"></div>'
  ].join(''), 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const target = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  const staging = instance.window.document.querySelector('#WACViewPanel_ClipboardElement');
  selectContents(instance.window, target);
  let userscriptWrites = 0;
  const previousSetClipboard = global.GM_setClipboard;
  global.GM_setClipboard = () => { userscriptWrites += 1; };
  try {
    cleanCopy.install(instance.window.document, instance.window, {
      settingsProvider: () => ({ outputMode: 'native' }),
      registerMenus: false
    });
    target.addEventListener('copy', () => {
      staging.innerHTML = '<math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>x</mi><mn>2</mn></msup></math>';
    });
    const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { get types() { return []; }, clearData() {}, setData() {}, getData() { return ''; } }
    });
    target.dispatchEvent(event);
    await new Promise((resolve) => instance.window.setTimeout(resolve, 25));
    assert.equal(event.defaultPrevented, false);
    assert.equal(userscriptWrites, 0);
  } finally {
    if (previousSetClipboard === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previousSetClipboard;
  }
});

test('Word staging recovery preserves plain, rich HTML, and MathML clipboard representations', async () => {
  const instance = dom([
    '<div id="WACViewPanel_EditingElement" contenteditable="true">&nbsp;</div>',
    '<div id="WACViewPanel_ClipboardElement"></div>'
  ].join(''), 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const target = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  const staging = instance.window.document.querySelector('#WACViewPanel_ClipboardElement');
  selectContents(instance.window, target);
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
  const previousSetClipboard = global.GM_setClipboard;
  global.GM_setClipboard = () => { plainFallbackCalls += 1; };
  try {
    cleanCopy.install(instance.window.document, instance.window, { registerMenus: false });
    target.addEventListener('copy', () => {
      staging.innerHTML = [
        '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>1</mn>',
        '<msqrt><mi>x</mi></msqrt></mfrac></math>'
      ].join('');
    });
    const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { get types() { return []; }, clearData() {}, setData() {}, getData() { return ''; } }
    });
    target.dispatchEvent(event);
    await new Promise((resolve) => instance.window.setTimeout(resolve, 10));
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
    if (previousSetClipboard === undefined) delete global.GM_setClipboard;
    else global.GM_setClipboard = previousSetClipboard;
  }
});

test('Word staging recovery retries without custom MathML when a browser rejects it', async () => {
  const instance = dom([
    '<div id="WACViewPanel_EditingElement" contenteditable="true">&nbsp;</div>',
    '<div id="WACViewPanel_ClipboardElement"></div>'
  ].join(''), 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const target = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  const staging = instance.window.document.querySelector('#WACViewPanel_ClipboardElement');
  selectContents(instance.window, target);
  const constructorAttempts = [];
  let writtenItem = null;
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
  cleanCopy.install(instance.window.document, instance.window, { registerMenus: false });
  target.addEventListener('copy', () => {
    staging.innerHTML = '<math xmlns="http://www.w3.org/1998/Math/MathML"><msqrt><mi>x</mi></msqrt></math>';
  });
  const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { get types() { return []; }, clearData() {}, setData() {}, getData() { return ''; } }
  });
  target.dispatchEvent(event);
  await new Promise((resolve) => instance.window.setTimeout(resolve, 10));
  assert.equal(constructorAttempts.length, 2);
  assert.deepEqual(Object.keys(writtenItem.representations).sort(), ['text/html', 'text/plain']);
  assert.equal(await writtenItem.representations['text/plain'].text(), '√x');
  assert.match(await writtenItem.representations['text/html'].text(), /border-top:1px solid currentColor/);
});

test('a newer keyboard copy replays after an in-flight Word staging write', async () => {
  const instance = dom([
    '<div id="WACViewPanel_EditingElement" contenteditable="true">&nbsp;</div>',
    '<div id="WACViewPanel_ClipboardElement"></div>',
    '<p id="newer">new native text</p>'
  ].join(''), 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const officeTarget = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  const staging = instance.window.document.querySelector('#WACViewPanel_ClipboardElement');
  const newerTarget = instance.window.document.querySelector('#newer');
  selectContents(instance.window, officeTarget);
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
        return item.representations['text/plain'].text().then((text) => { finalClipboard = text; });
      }
    }
  });
  cleanCopy.install(instance.window.document, instance.window, { registerMenus: false });
  officeTarget.addEventListener('copy', () => {
    staging.innerHTML = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>';
  });
  const olderEvent = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(olderEvent, 'clipboardData', {
    value: { get types() { return []; }, clearData() {}, setData() {}, getData() { return ''; } }
  });
  officeTarget.dispatchEvent(olderEvent);
  await new Promise((resolve) => instance.window.setTimeout(resolve, 10));
  assert.equal(typeof completeOlder, 'function');

  selectContents(instance.window, newerTarget);
  const newerEvent = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  const eventClipboard = new Map();
  Object.defineProperty(newerEvent, 'clipboardData', {
    value: {
      get types() { return Array.from(eventClipboard.keys()); },
      clearData() { eventClipboard.clear(); },
      setData(type, value) { eventClipboard.set(type, value); },
      getData(type) { return eventClipboard.get(type) || ''; }
    }
  });
  newerTarget.dispatchEvent(newerEvent);
  assert.equal(newerEvent.defaultPrevented, false);
  finalClipboard = newerTarget.textContent;

  await completeOlder();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(attempts.length, 2);
  assert.equal(finalClipboard, 'new native text');
  assert.equal(await attempts[1].representations['text/plain'].text(), 'new native text');
});

test('Original copy/paste replays a newer native copy after an uncancellable older Word write', async () => {
  const instance = dom([
    '<div id="WACViewPanel_EditingElement" contenteditable="true">&nbsp;</div>',
    '<div id="WACViewPanel_ClipboardElement"></div>',
    '<p id="native">  newer native text\n\n  </p>'
  ].join(''), 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx');
  const officeTarget = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  const staging = instance.window.document.querySelector('#WACViewPanel_ClipboardElement');
  const nativeTarget = instance.window.document.querySelector('#native');
  let mode = 'faithful';
  let completeOlder = null;
  let finalClipboard = '';
  const attempts = [];
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
        return item.representations['text/plain'].text().then((text) => { finalClipboard = text; });
      }
    }
  });

  selectContents(instance.window, officeTarget);
  cleanCopy.install(instance.window.document, instance.window, {
    settingsProvider: () => ({ outputMode: mode }),
    registerMenus: false
  });
  officeTarget.addEventListener('copy', () => {
    staging.innerHTML = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>';
  });
  const olderEvent = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(olderEvent, 'clipboardData', {
    value: { get types() { return []; }, clearData() {}, setData() {}, getData() { return ''; } }
  });
  officeTarget.dispatchEvent(olderEvent);
  await new Promise((resolve) => instance.window.setTimeout(resolve, 10));
  assert.equal(typeof completeOlder, 'function');

  mode = 'native';
  selectContents(instance.window, nativeTarget);
  const nativeValues = new Map();
  let nativeTransferActive = true;
  const oversizedNativeValue = 'Z'.repeat((1024 * 1024) + 1);
  const nativeBudgetPadding = 'P'.repeat((1024 * 1024) - 512);
  nativeTarget.addEventListener('copy', (event) => {
    event.clipboardData.setData('text/plain', 'stale first listener');
    event.clipboardData.setData('application/x-native-oversized', 'stale-oversized');
    event.clipboardData.setData('application/x-native-oversized', oversizedNativeValue);
    event.clipboardData.setData('application/x-native-padding', nativeBudgetPadding);
    event.clipboardData.setData('application/x-native-over-budget', 'stale-over-budget');
    event.clipboardData.setData('application/x-native-over-budget', 'B'.repeat(600));
    event.stopPropagation();
  });
  nativeTarget.addEventListener('copy', (event) => {
    // stopImmediatePropagation() does not end the current listener; writes
    // after it must remain part of the final native snapshot.
    event.stopImmediatePropagation();
    event.clipboardData.setData('text/plain', '  newer native text\n\n  ');
    event.clipboardData.setData('text/html', '<p>  newer native text<br><br>  </p>');
    event.clipboardData.setData('application/x-native-test', 'opaque-native-format');
  });
  const nativeEvent = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(nativeEvent, 'clipboardData', {
    value: {
      get types() {
        if (!nativeTransferActive) throw new Error('DataTransfer expired');
        return Array.from(nativeValues.keys());
      },
      clearData(type) { if (arguments.length) nativeValues.delete(type); else nativeValues.clear(); },
      setData(type, value) { nativeValues.set(type, value); },
      getData(type) {
        if (!nativeTransferActive) throw new Error('DataTransfer expired');
        return nativeValues.get(type) || '';
      }
    }
  });
  nativeTarget.dispatchEvent(nativeEvent);
  nativeTransferActive = false;
  assert.equal(nativeEvent.defaultPrevented, false);
  finalClipboard = nativeValues.get('text/plain');

  await completeOlder();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(attempts.length, 2);
  assert.equal(finalClipboard, '  newer native text\n\n  ');
  assert.equal(await attempts[1].representations['text/plain'].text(), '  newer native text\n\n  ');
  assert.equal(
    await attempts[1].representations['text/html'].text(),
    '<p>  newer native text<br><br>  </p>'
  );
  assert.equal(
    await attempts[1].representations['application/x-native-test'].text(),
    'opaque-native-format'
  );
  assert.equal(Object.hasOwn(attempts[1].representations, 'application/x-native-oversized'), false);
  assert.equal(Object.hasOwn(attempts[1].representations, 'application/x-native-over-budget'), false);
  assert.equal(
    await attempts[1].representations['application/x-native-padding'].text(),
    nativeBudgetPadding
  );
});

test('isolated relay snapshots native formats before an older Word write completes', async () => {
  const instance = new JSDOM([
    '<!doctype html><html><body>',
    '<div id="WACViewPanel_EditingElement" contenteditable="true">&nbsp;</div>',
    '<div id="WACViewPanel_ClipboardElement"></div>',
    '<p id="native">new native selection</p>',
    '</body></html>'
  ].join(''), {
    url: 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx',
    runScripts: 'dangerously'
  });
  const previousInfo = Object.getOwnPropertyDescriptor(globalThis, 'GM_info');
  const previousAddElement = Object.getOwnPropertyDescriptor(globalThis, 'GM_addElement');
  Object.defineProperty(globalThis, 'GM_info', {
    value: { injectInto: 'content' }, configurable: true, writable: true
  });
  Object.defineProperty(globalThis, 'GM_addElement', {
    configurable: true,
    writable: true,
    value(parent, tagName, attributes) {
      const element = parent.ownerDocument.createElement(tagName);
      parent.appendChild(element);
      if (attributes && attributes.textContent) {
        parent.ownerDocument.defaultView.eval(String(attributes.textContent));
      }
      return element;
    }
  });

  const officeTarget = instance.window.document.querySelector('#WACViewPanel_EditingElement');
  const staging = instance.window.document.querySelector('#WACViewPanel_ClipboardElement');
  const nativeTarget = instance.window.document.querySelector('#native');
  let mode = 'faithful';
  let completeOlder = null;
  let finalClipboard = '';
  const attempts = [];
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
        return item.representations['text/plain'].text().then((text) => { finalClipboard = text; });
      }
    }
  });

  try {
    selectContents(instance.window, officeTarget);
    cleanCopy.install(instance.window.document, instance.window, {
      settingsProvider: () => ({ outputMode: mode }),
      registerMenus: false
    });
    assert.ok(instance.window.document.querySelector('[data-clean-math-copy-relay-ready="1"]'));
    officeTarget.addEventListener('copy', () => {
      staging.innerHTML = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>';
    });
    const olderEvent = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
    Object.defineProperty(olderEvent, 'clipboardData', {
      value: { get types() { return []; }, clearData() {}, setData() {}, getData() { return ''; } }
    });
    officeTarget.dispatchEvent(olderEvent);
    await new Promise((resolve) => instance.window.setTimeout(resolve, 10));
    assert.equal(typeof completeOlder, 'function');

    mode = 'native';
    const relayCarrier = instance.window.document.querySelector('[data-clean-math-copy-relay-ready="1"]');
    const derivedEventName = relayCarrier.id + '-request';
    for (const request of [
      { id: 'forged', op: 'begin', type: '', value: '', all: false },
      { id: 'forged', op: 'set', type: 'text/plain', value: 'forged clipboard', all: false },
      { id: 'forged', op: 'finalize', type: '', value: '', all: false }
    ]) {
      const encoded = JSON.stringify(request);
      relayCarrier.textContent = encoded;
      relayCarrier.dispatchEvent(new instance.window.CustomEvent(derivedEventName));
      assert.equal(relayCarrier.textContent, encoded);
    }
    relayCarrier.textContent = '';
    assert.equal(attempts.length, 1);

    selectContents(instance.window, nativeTarget);
    const nativeValues = new Map();
    let transferActive = true;
    const clipboardPrototype = {
      get types() {
        if (!transferActive) throw new Error('DataTransfer expired');
        return Array.from(nativeValues.keys());
      },
      clearData(type) { if (arguments.length) nativeValues.delete(type); else nativeValues.clear(); },
      setData(type, value) { nativeValues.set(type, value); },
      getData(type) {
        if (!transferActive) throw new Error('DataTransfer expired');
        return nativeValues.get(type) || '';
      }
    };
    const cachedSetData = clipboardPrototype.setData;
    nativeTarget.addEventListener('copy', (event) => {
      // A cached prototype call bypasses the temporary own setData wrapper.
      // stopPropagation() must harvest it without freezing out the next
      // listener on this same target.
      Reflect.apply(cachedSetData, event.clipboardData, ['text/plain', 'stale isolated text']);
      event.stopPropagation();
    });
    nativeTarget.addEventListener('copy', (event) => {
      // The current listener continues after stopImmediatePropagation().
      event.stopImmediatePropagation();
      event.clipboardData.setData('text/plain', 'isolated native text');
      event.clipboardData.setData('text/html', '<b>isolated native text</b>');
      event.clipboardData.setData('application/x-isolated-native', 'opaque-isolated');
    });
    const nativeEvent = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
    Object.defineProperty(nativeEvent, 'clipboardData', { value: Object.create(clipboardPrototype) });
    nativeTarget.dispatchEvent(nativeEvent);
    transferActive = false;
    assert.equal(nativeEvent.defaultPrevented, false);
    finalClipboard = nativeValues.get('text/plain');

    await completeOlder();
    // The page-world relay intentionally finalizes native capture in a task,
    // after every target listener has finished. Await that jsdom-window task
    // explicitly; Node's setImmediate can otherwise run first in a full suite.
    await new Promise((resolve) => instance.window.setTimeout(resolve, 5));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(Object.hasOwn(nativeEvent.clipboardData, 'setData'), false);
    assert.equal(Object.hasOwn(nativeEvent.clipboardData, 'clearData'), false);
    assert.equal(Object.hasOwn(nativeEvent, 'stopPropagation'), false);
    assert.equal(Object.hasOwn(nativeEvent, 'stopImmediatePropagation'), false);
    assert.equal(attempts.length, 3);
    assert.equal(finalClipboard, 'isolated native text');
    const finalAttempt = attempts.at(-1);
    assert.equal(await finalAttempt.representations['text/plain'].text(), 'isolated native text');
    assert.equal(
      await finalAttempt.representations['text/html'].text(),
      '<b>isolated native text</b>'
    );
    assert.equal(
      await finalAttempt.representations['application/x-isolated-native'].text(),
      'opaque-isolated'
    );
  } finally {
    if (previousInfo) Object.defineProperty(globalThis, 'GM_info', previousInfo);
    else delete globalThis.GM_info;
    if (previousAddElement) Object.defineProperty(globalThis, 'GM_addElement', previousAddElement);
    else delete globalThis.GM_addElement;
  }
});

test('native replay captures writes from later window-bubble listeners in both worlds', async () => {
  for (const isolated of [false, true]) {
    const instance = new JSDOM([
      '<!doctype html><html><body>',
      '<div id="WACViewPanel_EditingElement" contenteditable="true">&nbsp;</div>',
      '<div id="WACViewPanel_ClipboardElement"></div>',
      '<p id="native">selection fallback</p>',
      '</body></html>'
    ].join(''), {
      url: 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx',
      runScripts: 'dangerously'
    });
    const previousInfo = Object.getOwnPropertyDescriptor(globalThis, 'GM_info');
    const previousAddElement = Object.getOwnPropertyDescriptor(globalThis, 'GM_addElement');
    Object.defineProperty(globalThis, 'GM_info', {
      value: { injectInto: isolated ? 'content' : 'page' }, configurable: true, writable: true
    });
    if (isolated) {
      Object.defineProperty(globalThis, 'GM_addElement', {
        configurable: true,
        writable: true,
        value(parent, tagName, attributes) {
          const element = parent.ownerDocument.createElement(tagName);
          parent.appendChild(element);
          if (attributes && attributes.textContent) {
            parent.ownerDocument.defaultView.eval(String(attributes.textContent));
          }
          return element;
        }
      });
    } else delete globalThis.GM_addElement;

    let mode = 'faithful';
    let completeOlder = null;
    let finalClipboard = '';
    const attempts = [];
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
          return item.representations['text/plain'].text().then((text) => { finalClipboard = text; });
        }
      }
    });

    try {
      const officeTarget = instance.window.document.querySelector('#WACViewPanel_EditingElement');
      const staging = instance.window.document.querySelector('#WACViewPanel_ClipboardElement');
      const nativeTarget = instance.window.document.querySelector('#native');
      selectContents(instance.window, officeTarget);
      cleanCopy.install(instance.window.document, instance.window, {
        settingsProvider: () => ({ outputMode: mode }),
        registerMenus: false
      });
      officeTarget.addEventListener('copy', () => {
        staging.innerHTML = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>';
      }, { once: true });
      const olderEvent = new instance.window.Event('copy', { bubbles: true, cancelable: true });
      Object.defineProperty(olderEvent, 'clipboardData', {
        value: { get types() { return []; }, clearData() {}, setData() {}, getData() { return ''; } }
      });
      officeTarget.dispatchEvent(olderEvent);
      await new Promise((resolve) => instance.window.setTimeout(resolve, 10));
      assert.equal(typeof completeOlder, 'function');

      mode = 'native';
      selectContents(instance.window, nativeTarget);
      const nativeValues = new Map();
      const clipboardPrototype = {
        get types() { return Array.from(nativeValues.keys()); },
        clearData(type) { if (arguments.length) nativeValues.delete(type); else nativeValues.clear(); },
        setData(type, value) { nativeValues.set(type, value); },
        getData(type) { return nativeValues.get(type) || ''; }
      };
      const clipboardData = Object.create(clipboardPrototype);
      instance.window.addEventListener('copy', (event) => {
        event.clipboardData.setData('text/plain', 'actual window-bubble native');
        event.clipboardData.setData('text/html', '<b>actual window-bubble native</b>');
        event.clipboardData.setData('application/x-window-bubble', 'late-custom');
      }, { once: true });
      const nativeEvent = new instance.window.Event('copy', { bubbles: true, cancelable: true });
      Object.defineProperty(nativeEvent, 'clipboardData', { value: clipboardData });
      nativeTarget.dispatchEvent(nativeEvent);
      finalClipboard = nativeValues.get('text/plain');

      await completeOlder();
      await new Promise((resolve) => instance.window.setTimeout(resolve, 5));
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(finalClipboard, 'actual window-bubble native');
      const finalAttempt = attempts.at(-1);
      assert.equal(await finalAttempt.representations['text/plain'].text(), 'actual window-bubble native');
      assert.equal(
        await finalAttempt.representations['text/html'].text(),
        '<b>actual window-bubble native</b>'
      );
      assert.equal(
        await finalAttempt.representations['application/x-window-bubble'].text(),
        'late-custom'
      );
      assert.equal(Object.hasOwn(clipboardData, 'setData'), false);
      assert.equal(Object.hasOwn(clipboardData, 'clearData'), false);
      assert.equal(Object.hasOwn(nativeEvent, 'stopPropagation'), false);
      assert.equal(Object.hasOwn(nativeEvent, 'stopImmediatePropagation'), false);
    } finally {
      if (previousInfo) Object.defineProperty(globalThis, 'GM_info', previousInfo);
      else delete globalThis.GM_info;
      if (previousAddElement) Object.defineProperty(globalThis, 'GM_addElement', previousAddElement);
      else delete globalThis.GM_addElement;
    }
  }
});

test('a newer copy in another installed document invalidates an older native relay replay', async () => {
  const first = new JSDOM([
    '<!doctype html><html><body>',
    '<div id="WACViewPanel_EditingElement" contenteditable="true">&nbsp;</div>',
    '<div id="WACViewPanel_ClipboardElement"></div>',
    '<p id="native-a">native A</p>',
    '</body></html>'
  ].join(''), {
    url: 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx',
    runScripts: 'dangerously'
  });
  const second = new JSDOM('<!doctype html><html><body><p id="faithful-b">faithful B</p></body></html>', {
    url: 'https://example.test/child',
    runScripts: 'dangerously'
  });
  const previousInfo = Object.getOwnPropertyDescriptor(globalThis, 'GM_info');
  const previousAddElement = Object.getOwnPropertyDescriptor(globalThis, 'GM_addElement');
  Object.defineProperty(globalThis, 'GM_info', {
    value: { injectInto: 'content' }, configurable: true, writable: true
  });
  Object.defineProperty(globalThis, 'GM_addElement', {
    configurable: true,
    writable: true,
    value(parent, tagName, attributes) {
      const element = parent.ownerDocument.createElement(tagName);
      parent.appendChild(element);
      if (attributes && attributes.textContent) {
        parent.ownerDocument.defaultView.eval(String(attributes.textContent));
      }
      return element;
    }
  });

  let firstMode = 'faithful';
  let secondMode = 'faithful';
  let completeOlder = null;
  let finalClipboard = '';
  const attempts = [];
  class FakeClipboardItem {
    constructor(representations) { this.representations = representations; }
  }
  for (const instance of [first, second]) {
    Object.defineProperty(instance.window, 'Blob', { configurable: true, value: Blob });
    Object.defineProperty(instance.window, 'ClipboardItem', {
      configurable: true, value: FakeClipboardItem
    });
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
          return item.representations['text/plain'].text().then((text) => { finalClipboard = text; });
        }
      }
    });
  }

  try {
    const officeTarget = first.window.document.querySelector('#WACViewPanel_EditingElement');
    const staging = first.window.document.querySelector('#WACViewPanel_ClipboardElement');
    const nativeTarget = first.window.document.querySelector('#native-a');
    const faithfulTarget = second.window.document.querySelector('#faithful-b');
    cleanCopy.install(first.window.document, first.window, {
      settingsProvider: () => ({ outputMode: firstMode }), registerMenus: false
    });
    cleanCopy.install(second.window.document, second.window, {
      settingsProvider: () => ({ outputMode: secondMode }), registerMenus: false
    });

    selectContents(first.window, officeTarget);
    officeTarget.addEventListener('copy', () => {
      staging.innerHTML = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>';
    }, { once: true });
    const olderEvent = new first.window.Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(olderEvent, 'clipboardData', {
      value: { get types() { return []; }, clearData() {}, setData() {}, getData() { return ''; } }
    });
    officeTarget.dispatchEvent(olderEvent);
    await new Promise((resolve) => first.window.setTimeout(resolve, 10));
    assert.equal(typeof completeOlder, 'function');

    firstMode = 'native';
    selectContents(first.window, nativeTarget);
    const nativeValues = new Map();
    nativeTarget.addEventListener('copy', (event) => {
      event.clipboardData.setData('text/plain', 'native A');
      event.clipboardData.setData('text/html', '<b>native A</b>');
      event.stopImmediatePropagation();
    }, { once: true });
    const nativeEvent = new first.window.Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(nativeEvent, 'clipboardData', {
      value: {
        get types() { return Array.from(nativeValues.keys()); },
        clearData(type) { if (arguments.length) nativeValues.delete(type); else nativeValues.clear(); },
        setData(type, value) { nativeValues.set(type, value); },
        getData(type) { return nativeValues.get(type) || ''; }
      }
    });
    nativeTarget.dispatchEvent(nativeEvent);
    finalClipboard = nativeValues.get('text/plain');

    selectContents(second.window, faithfulTarget);
    const faithfulEvent = new second.window.Event('copy', { bubbles: true, cancelable: true });
    faithfulTarget.dispatchEvent(faithfulEvent);
    finalClipboard = 'faithful B';
    assert.equal(faithfulEvent.defaultPrevented, false);
    await new Promise((resolve) => first.window.setTimeout(resolve, 5));

    await completeOlder();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(finalClipboard, 'faithful B');
    const attemptedTexts = await Promise.all(
      attempts.map((item) => item.representations['text/plain'].text())
    );
    assert.deepEqual(attemptedTexts, ['x', 'faithful B']);
  } finally {
    if (previousInfo) Object.defineProperty(globalThis, 'GM_info', previousInfo);
    else delete globalThis.GM_info;
    if (previousAddElement) Object.defineProperty(globalThis, 'GM_addElement', previousAddElement);
    else delete globalThis.GM_addElement;
  }
});

test('deferred isolated relay cannot adopt a newer no-DataTransfer copy generation', async () => {
  for (const newerMode of ['faithful', 'native']) {
  const instance = new JSDOM('<!doctype html><html></html>', {
    url: 'https://word-edit.officeapps.live.com/we/wordeditorframe.aspx',
    runScripts: 'dangerously'
  });
  // Force installPageClipboardRelay() down its deferred-install branch. The
  // controller copy listener is registered now; the page-world relay listener
  // is registered only after a document body appears.
  instance.window.document.head.remove();
  instance.window.document.body.remove();
  const previousGlobals = new Map();
  for (const name of [
    'GM',
    'GM_info',
    'GM_addElement',
    'GM_getValue',
    'GM_setValue',
    'GM_registerMenuCommand'
  ]) {
    previousGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }
  const commands = new Map();
  Object.defineProperty(globalThis, 'GM_info', {
    value: { injectInto: 'content' }, configurable: true, writable: true
  });
  Object.defineProperty(globalThis, 'GM_addElement', {
    configurable: true,
    writable: true,
    value(parent, tagName, attributes) {
      const element = parent.ownerDocument.createElement(tagName);
      parent.appendChild(element);
      if (attributes && attributes.textContent) {
        parent.ownerDocument.defaultView.eval(String(attributes.textContent));
      }
      return element;
    }
  });
  globalThis.GM_getValue = () => ({ outputMode: 'faithful' });
  globalThis.GM_setValue = () => undefined;
  globalThis.GM_registerMenuCommand = (caption, callback) => {
    commands.set(caption, callback);
    return commands.size;
  };
  delete globalThis.GM;

  let officeTarget = null;
  let staging = null;
  let nativeTarget = null;
  let faithfulTarget = null;
  let completeOlder = null;
  let finalClipboard = '';
  const attempts = [];
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
        return item.representations['text/plain'].text().then((text) => { finalClipboard = text; });
      }
    }
  });
  const dispatchSiteCopy = (target, text) => {
    const values = new Map();
    target.addEventListener('copy', (event) => {
      event.clipboardData.setData('text/plain', text);
      event.stopImmediatePropagation();
    }, { once: true });
    const event = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
    const clipboardData = {
      get types() { return Array.from(values.keys()); },
      clearData(type) { if (arguments.length) values.delete(type); else values.clear(); },
      setData(type, value) { values.set(type, value); },
      getData(type) { return values.get(type) || ''; }
    };
    const originalSetData = clipboardData.setData;
    const originalClearData = clipboardData.clearData;
    Object.defineProperty(event, 'clipboardData', { value: clipboardData });
    target.dispatchEvent(event);
    finalClipboard = values.get('text/plain') || text;
    return { event, clipboardData, originalSetData, originalClearData };
  };

  try {
    cleanCopy.install(instance.window.document, instance.window);
    assert.equal(instance.window.document.__cleanMathCopyRelayPending, true);

    const head = instance.window.document.createElement('head');
    const body = instance.window.document.createElement('body');
    body.innerHTML = [
      '<div id="WACViewPanel_EditingElement" contenteditable="true">&nbsp;</div>',
      '<div id="WACViewPanel_ClipboardElement"></div>',
      '<p id="native-a">native A</p>',
      '<p id="faithful-c">faithful C</p>'
    ].join('');
    instance.window.document.documentElement.append(head, body);
    await new Promise((resolve) => instance.window.setTimeout(resolve, 0));
    assert.ok(instance.window.document.querySelector('[data-clean-math-copy-relay-ready="1"]'));

    officeTarget = instance.window.document.querySelector('#WACViewPanel_EditingElement');
    staging = instance.window.document.querySelector('#WACViewPanel_ClipboardElement');
    nativeTarget = instance.window.document.querySelector('#native-a');
    faithfulTarget = instance.window.document.querySelector('#faithful-c');
    selectContents(instance.window, officeTarget);
    officeTarget.addEventListener('copy', () => {
      staging.innerHTML = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>';
    }, { once: true });
    const olderEvent = new instance.window.Event('copy', { bubbles: true, cancelable: true, composed: true });
    Object.defineProperty(olderEvent, 'clipboardData', {
      value: { get types() { return []; }, clearData() {}, setData() {}, getData() { return ''; } }
    });
    officeTarget.dispatchEvent(olderEvent);
    await new Promise((resolve) => instance.window.setTimeout(resolve, 10));
    assert.equal(typeof completeOlder, 'function');

    commands.get('Original copy/paste')();
    selectContents(instance.window, nativeTarget);
    const nativeCopy = dispatchSiteCopy(nativeTarget, 'native A');
    // Dispatch the newer copy synchronously, before native A's page-relay task
    // can finalize. With no DataTransfer, the page relay never begins C, so A
    // must reject the controller generation instead of adopting it.
    const newerText = newerMode === 'faithful' ? 'faithful C' : 'native C';
    faithfulTarget.textContent = newerText;
    if (newerMode === 'faithful') commands.get('✓ Readable text (recommended)')();
    selectContents(instance.window, faithfulTarget);
    const newerEvent = new instance.window.Event('copy', {
      bubbles: true, cancelable: true, composed: true
    });
    faithfulTarget.dispatchEvent(newerEvent);
    finalClipboard = newerText;
    assert.equal(newerEvent.defaultPrevented, false);
    if (newerMode === 'faithful') commands.get('Original copy/paste')();

    await new Promise((resolve) => instance.window.setTimeout(resolve, 5));
    assert.equal(nativeCopy.clipboardData.setData, nativeCopy.originalSetData);
    assert.equal(nativeCopy.clipboardData.clearData, nativeCopy.originalClearData);
    assert.equal(Object.hasOwn(nativeCopy.event, 'stopPropagation'), false);
    assert.equal(Object.hasOwn(nativeCopy.event, 'stopImmediatePropagation'), false);

    await completeOlder();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(finalClipboard, newerText);
    const attemptedTexts = await Promise.all(
      attempts.map((item) => item.representations['text/plain'].text())
    );
    assert.deepEqual(attemptedTexts, ['x', newerText]);
  } finally {
    for (const [name, descriptor] of previousGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
  }
});

test('rewrites invisible artifacts without touching emoji joiners', () => {
  const instance = dom('<p id="target">A\u00a0B\u200bC 👩‍💻</p>');
  const target = instance.window.document.querySelector('#target');
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selectContents(instance.window, target),
    { cleanInvisibleArtifacts: false },
    instance.window,
    target
  );
  assert.equal(payload.reason, 'invisible-artifacts');
  assert.equal(payload.text, 'A BC 👩‍💻');
});

const EMBEDDED_TEST_MATHML_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';
const EMBEDDED_TEST_SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function giveEmbeddedTestRect(element, width = 28, height = 18) {
  element.getBoundingClientRect = () => ({
    left: 12,
    top: 8,
    right: 12 + width,
    bottom: 8 + height,
    width,
    height
  });
}

function selectEmbeddedTestNode(window, element) {
  const selection = window.getSelection();
  selection.removeAllRanges();
  const range = window.document.createRange();
  range.selectNode(element);
  selection.addRange(range);
  return selection;
}

function embeddedMetadataFixture(options = {}) {
  const instance = dom(
    '<p id="target">Before <span id="slot"></span> after</p>',
    options.url || 'https://embedded-math.invalid/article'
  );
  const documentObject = instance.window.document;
  const slot = documentObject.querySelector('#slot');
  const surface = documentObject.createElementNS(
    options.surfaceTag === 'svg' ? EMBEDDED_TEST_SVG_NAMESPACE : 'http://www.w3.org/1999/xhtml',
    options.surfaceTag || 'img'
  );
  surface.id = 'surface';
  let root = surface;
  if (options.wrapper) {
    root = documentObject.createElement(options.wrapperTag || 'figure');
    root.id = 'math-root';
    root.className = options.wrapperClass || 'third-party-equation-shell';
    root.appendChild(surface);
  } else {
    root.id = 'math-root';
  }
  for (const [name, value] of Object.entries(options.attributes || {})) {
    root.setAttribute(name, value);
  }
  if (options.alt != null) surface.setAttribute('alt', options.alt);
  if (options.rootStyle) root.setAttribute('style', options.rootStyle);
  slot.replaceWith(root);
  if (options.positiveRect !== false) giveEmbeddedTestRect(surface);
  return {
    instance,
    document: documentObject,
    target: documentObject.querySelector('#target'),
    root,
    surface
  };
}

function mathJaxSvgFixture(options = {}) {
  const instance = dom(
    '<p id="target">Before <mjx-container id="math-root" class="MathJax" jax="SVG"></mjx-container> after</p>',
    options.url || 'https://svg-math.invalid/article'
  );
  const documentObject = instance.window.document;
  const root = documentObject.querySelector('#math-root');
  const svg = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'svg');
  const top = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'g');
  top.setAttribute('data-mml-node', 'math');
  top.setAttribute('data-latex', options.source || 'x^{2}');
  const structure = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'g');
  structure.setAttribute('data-mml-node', options.structure || 'msup');
  structure.setAttribute('data-semantic-id', 'structure-0');
  const glyphs = options.glyphs || [{ code: '78' }, { code: '32' }];
  glyphs.forEach((definition, index) => {
    const item = typeof definition === 'string' ? { code: definition } : definition;
    const token = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'g');
    const point = Number.parseInt(item.code || '0', 16);
    const inferredCharacter = Number.isInteger(point) && point >= 0 && point <= 0x10ffff
      ? String.fromCodePoint(point)
      : '';
    token.setAttribute('data-mml-node', item.node || (/[0-9]/u.test(inferredCharacter) ? 'mn' : 'mi'));
    const glyph = documentObject.createElementNS(
      EMBEDDED_TEST_SVG_NAMESPACE,
      item.tag || 'path'
    );
    if (item.code != null) glyph.setAttribute('data-c', item.code);
    if (item.href != null) glyph.setAttribute('href', item.href);
    if ((item.tag || 'path') === 'path' && item.d !== null) {
      glyph.setAttribute('d', item.d || 'M0 0L10 0L10 10Z');
    }
    glyph.setAttribute('data-test-glyph', String(index));
    token.appendChild(glyph);
    structure.appendChild(token);
  });
  if ((options.structure || 'msup') === 'mfrac' && options.fractionRule !== false) {
    const rule = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'rect');
    rule.setAttribute('width', '10');
    rule.setAttribute('height', '1');
    structure.appendChild(rule);
  }
  top.appendChild(structure);
  for (let index = 0; index < (options.nestedMetadata || 0); index += 1) {
    const metadata = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'g');
    metadata.setAttribute('data-latex', 'x');
    top.appendChild(metadata);
  }
  svg.appendChild(top);
  root.appendChild(svg);
  if (options.rootStyle) root.setAttribute('style', options.rootStyle);
  if (options.jax) root.setAttribute('jax', options.jax);
  if (typeof options.mutate === 'function') options.mutate({ documentObject, root, svg, top, structure });
  if (options.positiveRect !== false) {
    giveEmbeddedTestRect(root, 44, 24);
    giveEmbeddedTestRect(svg, 44, 24);
  }
  return {
    instance,
    document: documentObject,
    target: documentObject.querySelector('#target'),
    root,
    svg,
    top,
    structure
  };
}

function mathJaxV4SnapshotFixture(source, build, options = {}) {
  const instance = dom(
    '<p id="target">Before <mjx-container id="math-root" class="MathJax" jax="SVG"></mjx-container> after</p>',
    options.url || 'https://mathjax-v4.invalid/article'
  );
  const documentObject = instance.window.document;
  const root = documentObject.querySelector('#math-root');
  const svg = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'svg');
  const defs = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'defs');
  const paint = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'g');
  paint.setAttribute('transform', 'scale(1,-1)');
  const top = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'g');
  top.setAttribute('data-mml-node', 'math');
  top.setAttribute('data-latex', source);
  let glyphIndex = 0;
  const group = (parent, node, latex) => {
    const element = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'g');
    if (node) element.setAttribute('data-mml-node', node);
    if (latex != null) element.setAttribute('data-latex', latex);
    parent.appendChild(element);
    return element;
  };
  const glyph = (parent, node, latex, code, optionsForGlyph = {}) => {
    const token = group(parent, node, latex);
    const use = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'use');
    const id = 'MJX-v4-test-' + glyphIndex;
    glyphIndex += 1;
    use.setAttribute('data-c', code);
    use.setAttribute('href', '#' + id);
    token.appendChild(use);
    const path = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'path');
    path.id = id;
    path.setAttribute('d', optionsForGlyph.emptyPath ? '' : 'M0 0L10 0L10 10Z');
    defs.appendChild(path);
    return token;
  };
  const nativeText = (parent, text) => {
    const element = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'text');
    element.setAttribute('data-variant', 'normal');
    element.setAttribute('transform', 'scale(1,-1)');
    element.textContent = text;
    parent.appendChild(element);
    return element;
  };
  const rect = (parent) => {
    const element = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'rect');
    element.setAttribute('width', '10');
    element.setAttribute('height', '1');
    parent.appendChild(element);
    return element;
  };
  build({ documentObject, root, svg, defs, top, group, glyph, nativeText, rect });
  paint.appendChild(top);
  svg.append(defs, paint);
  root.appendChild(svg);
  giveEmbeddedTestRect(root, 60, 28);
  giveEmbeddedTestRect(svg, 60, 28);
  return {
    instance,
    document: documentObject,
    target: documentObject.querySelector('#target'),
    root,
    svg,
    defs,
    top
  };
}

function mathJaxV4Payload(fixture, outputMode = 'faithful') {
  return cleanCopy.getCopyPayload(
    fixture.document,
    selectContents(fixture.instance.window, fixture.target),
    { outputMode },
    fixture.instance.window,
    fixture.target
  );
}

test('generic embedded MathML recovery is host-neutral for mixed and whole selections', () => {
  const rawMathML = [
    '<math xmlns="', EMBEDDED_TEST_MATHML_NAMESPACE, '"><mfrac><msup>',
    '<mi>x</mi><mn>2</mn></msup><mi>y</mi></mfrac></math>'
  ].join('');
  const expectedMixed = {
    faithful: 'Before x²/y after',
    calculator: 'Before ((x^(2))/y) after',
    latex: 'Before $\\frac{{x}^{2}}{y}$ after'
  };
  for (const url of [
    'https://alpha.invalid/lesson',
    'https://en.wikipedia.org/wiki/Example',
    'https://docs.google.com/document/d/host-neutral-test/edit',
    'https://word.cloud.microsoft/edit.aspx',
    'https://localhost.invalid:8443/custom-renderer'
  ]) {
    for (const [outputMode, expected] of Object.entries(expectedMixed)) {
      const fixture = embeddedMetadataFixture({
        url,
        attributes: { 'data-mathml': rawMathML }
      });
      const payload = cleanCopy.getCopyPayload(
        fixture.document,
        selectContents(fixture.instance.window, fixture.target),
        { outputMode },
        fixture.instance.window,
        fixture.target
      );
      assert.equal(payload.text, expected, url + ' ' + outputMode);
      assert.equal(payload.reason, 'rendered-math', url + ' ' + outputMode);
      assert.equal(payload.mathRanges, 1, url + ' ' + outputMode);
      assert.doesNotMatch(payload.html, /data-mathml|<img\b|\\frac/u, url + ' ' + outputMode);
      if (outputMode === 'faithful') assert.match(payload.html, /<sup>2<\/sup>/u, url);
    }
  }

  const whole = embeddedMetadataFixture({
    attributes: { 'data-mathml': rawMathML }
  });
  for (const [outputMode, expected] of Object.entries({
    faithful: 'x²/y',
    calculator: '((x^(2))/y)',
    latex: '$\\frac{{x}^{2}}{y}$'
  })) {
    const payload = cleanCopy.getCopyPayload(
      whole.document,
      selectEmbeddedTestNode(whole.instance.window, whole.root),
      { outputMode },
      whole.instance.window,
      whole.root
    );
    assert.equal(payload.text, expected, outputMode);
    assert.match(payload.mathML, /^<math\b/u, outputMode);
    assert.doesNotMatch(payload.mathML, /data-mathml|script|foreignObject/iu, outputMode);
  }

  const wrapped = embeddedMetadataFixture({
    wrapper: true,
    wrapperTag: 'vendor-widget',
    wrapperClass: 'vendor-formula-frame',
    attributes: { 'data-mathml': rawMathML }
  });
  assert.equal(cleanCopy.getCopyPayload(
    wrapped.document,
    selectContents(wrapped.instance.window, wrapped.target),
    { outputMode: 'faithful' },
    wrapped.instance.window,
    wrapped.target
  ).text, 'Before x²/y after');

  const encoded = embeddedMetadataFixture({
    attributes: {
      'data-mathml': '«math xmlns=¨http://www.w3.org/1998/Math/MathML¨»' +
        '«msqrt»«mi»q«/mi»«/msqrt»«/math»'
    }
  });
  assert.equal(cleanCopy.getCopyPayload(
    encoded.document,
    selectContents(encoded.instance.window, encoded.target),
    { outputMode: 'faithful' },
    encoded.instance.window,
    encoded.target
  ).text, 'Before √q after');

  const legacyWithoutNamespace = embeddedMetadataFixture({
    attributes: { 'data-mathml': '<math><msup><mi>r</mi><mn>2</mn></msup></math>' }
  });
  assert.equal(cleanCopy.getCopyPayload(
    legacyWithoutNamespace.document,
    selectContents(legacyWithoutNamespace.instance.window, legacyWithoutNamespace.target),
    { outputMode: 'faithful' },
    legacyWithoutNamespace.instance.window,
    legacyWithoutNamespace.target
  ).text, 'Before r² after');
});

test('generic embedded TeX requires all independent source metadata to agree', () => {
  const equivalent = embeddedMetadataFixture({
    attributes: { 'data-equation-content': '\\frac{x^2}{y}' },
    alt: 'LaTeX: \\frac{x^{2}}{y}'
  });
  for (const [outputMode, expected] of Object.entries({
    faithful: 'Before x²/y after',
    calculator: 'Before (x^(2))/y after',
    latex: 'Before $\\frac{x^2}{y}$ after'
  })) {
    const payload = cleanCopy.getCopyPayload(
      equivalent.document,
      selectContents(equivalent.instance.window, equivalent.target),
      { outputMode },
      equivalent.instance.window,
      equivalent.target
    );
    assert.equal(payload.text, expected, outputMode);
    assert.equal(payload.mathML, '', outputMode);
    assert.doesNotMatch(payload.html, /data-equation-content|<img\b|LaTeX:/iu, outputMode);
  }

  for (const options of [
    {
      attributes: { 'data-equation-content': 'x' },
      alt: 'LaTeX: y'
    },
    {
      attributes: { 'data-equation-content': 'x', 'data-latex': 'y' },
      alt: 'LaTeX: x'
    },
    {
      attributes: {
        'data-mathml': '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>',
        'data-latex': 'y'
      },
      alt: 'LaTeX: y'
    }
  ]) {
    const fixture = embeddedMetadataFixture(options);
    assert.equal(cleanCopy.getCopyPayload(
      fixture.document,
      selectContents(fixture.instance.window, fixture.target),
      { outputMode: 'faithful' },
      fixture.instance.window,
      fixture.target
    ), null, JSON.stringify(options.attributes));
  }
});

test('embedded math requires every accessibility representation to agree', () => {
  const fractionMathML = '<math xmlns="http://www.w3.org/1998/Math/MathML">' +
    '<mfrac><msup><mi>x</mi><mn>2</mn></msup><mi>y</mi></mfrac></math>';
  const agreeing = embeddedMetadataFixture({
    wrapper: true,
    wrapperTag: 'vendor-equation',
    wrapperClass: 'portable-equation',
    attributes: {
      'data-mathml': fractionMathML,
      'data-latex': '\\frac{x^2}{y}'
    },
    alt: 'x²/y'
  });
  agreeing.surface.setAttribute('aria-label', 'Equation: x^2/y');
  agreeing.root.setAttribute('aria-label', 'LaTeX: \\frac{x^{2}}{y}');
  assert.equal(cleanCopy.getCopyPayload(
    agreeing.document,
    selectContents(agreeing.instance.window, agreeing.target),
    { outputMode: 'faithful' },
    agreeing.instance.window,
    agreeing.target
  ).text, 'Before x²/y after');

  const staleMathImage = embeddedMetadataFixture({
    attributes: {
      'data-mathml': '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>'
    },
    alt: 'A cat'
  });
  assert.equal(cleanCopy.getCopyPayload(
    staleMathImage.document,
    selectContents(staleMathImage.instance.window, staleMathImage.target),
    { outputMode: 'faithful' },
    staleMathImage.instance.window,
    staleMathImage.target
  ), null, 'hidden MathML cannot replace a contradictory visible image description');

  const conflictingLabels = embeddedMetadataFixture({
    attributes: { 'data-equation-content': 'x' },
    alt: 'LaTeX: x'
  });
  conflictingLabels.surface.setAttribute('aria-label', 'LaTeX: y');
  assert.equal(cleanCopy.getCopyPayload(
    conflictingLabels.document,
    selectContents(conflictingLabels.instance.window, conflictingLabels.target),
    { outputMode: 'faithful' },
    conflictingLabels.instance.window,
    conflictingLabels.target
  ), null, 'alt must not hide a contradictory aria-label');

  const mutation = embeddedMetadataFixture({
    wrapper: true,
    wrapperTag: 'vendor-equation',
    wrapperClass: 'portable-equation',
    attributes: { 'data-equation-content': 'x' },
    alt: 'LaTeX: x'
  });
  mutation.root.setAttribute('aria-label', 'Formula: x');
  assert.equal(cleanCopy.getCopyPayload(
    mutation.document,
    selectContents(mutation.instance.window, mutation.target),
    { outputMode: 'faithful' },
    mutation.instance.window,
    mutation.target
  ).text, 'Before x after');
  mutation.root.setAttribute('aria-label', 'Formula: y');
  assert.equal(cleanCopy.getCopyPayload(
    mutation.document,
    selectContents(mutation.instance.window, mutation.target),
    { outputMode: 'faithful' },
    mutation.instance.window,
    mutation.target
  ), null, 'a later copy must audit a mutated lower-priority accessibility field');
});

test('embedded metadata decoding is bounded, mutation-safe, and audits every visual wrapper', () => {
  const namedEntities = embeddedMetadataFixture({
    attributes: {
      'data-mathml': '<math xmlns="http://www.w3.org/1998/Math/MathML">' +
        '<mi>&alpha;</mi><mo>&NotEqual;</mo><mi>&beta;</mi></math>'
    }
  });
  const parserPrototype = namedEntities.instance.window.DOMParser.prototype;
  const originalParse = parserPrototype.parseFromString;
  let parseCalls = 0;
  parserPrototype.parseFromString = function countedParse(...args) {
    parseCalls += 1;
    return Reflect.apply(originalParse, this, args);
  };
  try {
    assert.equal(cleanCopy.getCopyPayload(
      namedEntities.document,
      selectContents(namedEntities.instance.window, namedEntities.target),
      { outputMode: 'faithful' },
      namedEntities.instance.window,
      namedEntities.target
    ).text, 'Before α ≠ β after');
    assert.equal(parseCalls, 2,
      'all unique named entities share one inert decode parse plus one XML parse');
  } finally {
    parserPrototype.parseFromString = originalParse;
  }

  const unknownEntity = embeddedMetadataFixture({
    attributes: {
      'data-mathml': '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>&notARealEntity;</mi></math>'
    }
  });
  assert.equal(cleanCopy.getCopyPayload(
    unknownEntity.document,
    selectContents(unknownEntity.instance.window, unknownEntity.target),
    { outputMode: 'faithful' },
    unknownEntity.instance.window,
    unknownEntity.target
  ), null, 'an unknown or partially decoded entity cannot become visible math');

  const tooManyEntities = embeddedMetadataFixture({
    attributes: {
      'data-mathml': '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>' +
        Array.from({ length: 1025 }, (_value, index) => '<mi>&FakeEntity' + index + ';</mi>').join('') +
        '</mrow></math>'
    }
  });
  const oversizedParserPrototype = tooManyEntities.instance.window.DOMParser.prototype;
  const oversizedOriginalParse = oversizedParserPrototype.parseFromString;
  let oversizedParseCalls = 0;
  oversizedParserPrototype.parseFromString = function countedOversizedParse(...args) {
    oversizedParseCalls += 1;
    return Reflect.apply(oversizedOriginalParse, this, args);
  };
  try {
    assert.equal(cleanCopy.getCopyPayload(
      tooManyEntities.document,
      selectContents(tooManyEntities.instance.window, tooManyEntities.target),
      { outputMode: 'faithful' },
      tooManyEntities.instance.window,
      tooManyEntities.target
    ), null);
    assert.equal(oversizedParseCalls, 0,
      'an adversarial number of unique names is rejected before any parser allocation');
  } finally {
    oversizedParserPrototype.parseFromString = oversizedOriginalParse;
  }

  const mutation = embeddedMetadataFixture({
    attributes: {
      'data-equation-content': 'x',
      'data-latex': 'x'
    },
    alt: 'LaTeX: x'
  });
  assert.equal(cleanCopy.getCopyPayload(
    mutation.document,
    selectContents(mutation.instance.window, mutation.target),
    { outputMode: 'faithful' },
    mutation.instance.window,
    mutation.target
  ).text, 'Before x after');
  mutation.root.setAttribute('data-equation-content', 'x\u0001x');
  mutation.root.removeAttribute('data-latex');
  assert.equal(cleanCopy.getCopyPayload(
    mutation.document,
    selectContents(mutation.instance.window, mutation.target),
    { outputMode: 'faithful' },
    mutation.instance.window,
    mutation.target
  ), null, 'metadata field separators cannot alias a previously cached descriptor');

  const hiddenIntermediate = embeddedMetadataFixture({
    wrapper: true,
    wrapperTag: 'vendor-equation',
    wrapperClass: 'portable-equation',
    attributes: {
      'data-mathml': '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>'
    }
  });
  const hiddenBox = hiddenIntermediate.document.createElement('span');
  hiddenBox.style.opacity = '0';
  hiddenIntermediate.surface.before(hiddenBox);
  hiddenBox.appendChild(hiddenIntermediate.surface);
  assert.equal(cleanCopy.getCopyPayload(
    hiddenIntermediate.document,
    selectContents(hiddenIntermediate.instance.window, hiddenIntermediate.target),
    { outputMode: 'faithful' },
    hiddenIntermediate.instance.window,
    hiddenIntermediate.target
  ), null, 'a hidden wrapper between metadata owner and pixels cannot authenticate the source');

  const oversizedAccessibleText = embeddedMetadataFixture({
    attributes: { 'data-equation-content': 'x' },
    alt: 'LaTeX: ' + 'x'.repeat(50001)
  });
  assert.equal(cleanCopy.getCopyPayload(
    oversizedAccessibleText.document,
    selectContents(oversizedAccessibleText.instance.window, oversizedAccessibleText.target),
    { outputMode: 'faithful' },
    oversizedAccessibleText.instance.window,
    oversizedAccessibleText.target
  ), null, 'oversized accessibility metadata is rejected before agreement or cache work');
});

test('generic embedded metadata fails closed on hidden, malformed, oversized, or ambiguous surfaces', () => {
  const valid = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>';
  const cases = [
    { attributes: { 'data-mathml': valid }, positiveRect: false },
    { attributes: { 'data-mathml': valid }, rootStyle: 'display:none' },
    { attributes: { 'data-mathml': valid }, rootStyle: 'opacity:0' },
    { attributes: { 'data-mathml': valid }, rootStyle: 'transform:scale(0)' },
    { attributes: { 'data-mathml': '<math xmlns="urn:not-mathml"><mi>x</mi></math>' } },
    { attributes: { 'data-mathml': '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</math>' } },
    { attributes: { 'data-mathml': '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mi>x</mi></mfrac></math>' } },
    { attributes: { 'data-mathml': '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mi>x</mi><script>y</script></mfrac></math>' } },
    { attributes: { 'data-mathml': '<!DOCTYPE math><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>' } },
    { attributes: { 'data-mathml': '<?xml version="1.0"?><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>' } },
    { attributes: { 'data-mathml': '<math xmlns="http://www.w3.org/1998/Math/MathML"><unknown>x</unknown></math>' } },
    { attributes: { 'data-mathml': 'x'.repeat(1024 * 1024 + 1) } },
    { attributes: { 'data-equation-content': 'x'.repeat(50001) }, alt: 'equation image' }
  ];
  for (const [index, options] of cases.entries()) {
    const fixture = embeddedMetadataFixture(options);
    assert.equal(cleanCopy.getCopyPayload(
      fixture.document,
      selectContents(fixture.instance.window, fixture.target),
      { outputMode: 'faithful' },
      fixture.instance.window,
      fixture.target
    ), null, 'unsafe embedded metadata case ' + index);
  }

  for (const ancestorStyle of ['opacity:0', 'display:none', 'clip-path:circle(0)', 'overflow:hidden']) {
    const fixture = embeddedMetadataFixture({ attributes: { 'data-mathml': valid } });
    fixture.target.setAttribute('style', ancestorStyle);
    assert.equal(cleanCopy.getCopyPayload(
      fixture.document,
      selectContents(fixture.instance.window, fixture.target),
      { outputMode: 'faithful' },
      fixture.instance.window,
      fixture.target
    ), null, 'hidden or unmeasurable embedded-math ancestor: ' + ancestorStyle);
  }

  const transformedAncestor = embeddedMetadataFixture({
    wrapper: true,
    wrapperClass: 'portable-equation',
    attributes: { 'data-mathml': valid }
  });
  transformedAncestor.target.setAttribute('style', 'transform:translateX(2px)');
  assert.equal(cleanCopy.getCopyPayload(
    transformedAncestor.document,
    selectContents(transformedAncestor.instance.window, transformedAncestor.root),
    { outputMode: 'faithful' },
    transformedAncestor.instance.window,
    transformedAncestor.root
  ).text, 'x', 'a still-visible transformed ancestor remains supported for an exact formula');

  for (const shape of ['arbitrary-wrapper', 'two-surfaces', 'visible-wrapper-text']) {
    const fixture = embeddedMetadataFixture({
      wrapper: true,
      wrapperTag: 'div',
      wrapperClass: shape === 'arbitrary-wrapper' ? 'ordinary-card' : 'some-equation',
      attributes: { 'data-mathml': valid }
    });
    if (shape === 'arbitrary-wrapper') fixture.root.id = 'ordinary-card-root';
    if (shape === 'two-surfaces') {
      const second = fixture.document.createElement('img');
      giveEmbeddedTestRect(second);
      fixture.root.appendChild(second);
    } else if (shape === 'visible-wrapper-text') {
      fixture.root.appendChild(fixture.document.createTextNode(' ordinary prose'));
    }
    const range = fixture.document.createRange();
    range.selectNodeContents(fixture.target);
    assert.equal(cleanCopy.rootsForRange(range).includes(fixture.root), false, shape);
  }
});

test('embedded MathML is sanitized and a strict inner visual selection is never widened', () => {
  const fixture = embeddedMetadataFixture({
    wrapper: true,
    surfaceTag: 'svg',
    attributes: {
      'data-mathml': '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>x</mi>' +
        '<script>SECRET_SCRIPT</script><foreignObject>SECRET_FOREIGN</foreignObject></mrow></math>'
    }
  });
  fixture.surface.appendChild(fixture.document.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'path'));
  const whole = cleanCopy.getCopyPayload(
    fixture.document,
    selectEmbeddedTestNode(fixture.instance.window, fixture.root),
    { outputMode: 'faithful' },
    fixture.instance.window,
    fixture.root
  );
  assert.equal(whole.text, 'x');
  assert.doesNotMatch(whole.html + whole.mathML, /SECRET|script|foreignObject/iu);

  assert.equal(cleanCopy.getCopyPayload(
    fixture.document,
    selectContents(fixture.instance.window, fixture.surface),
    { outputMode: 'faithful' },
    fixture.instance.window,
    fixture.surface
  ), null, 'selecting only the visual child must not promote the whole semantic formula');
});

test('MathJax SVG recovery is host-neutral and preserves exact whole and mixed boundaries', () => {
  const expectedMixed = {
    faithful: 'Before x² after',
    calculator: 'Before x^(2) after',
    latex: 'Before $x^{2}$ after'
  };
  for (const url of [
    'https://one.invalid/a',
    'https://en.wikipedia.org/wiki/Unrelated',
    'https://docs.google.com/document/d/svg-test/edit',
    'https://word.cloud.microsoft/svg-test',
    'https://another.invalid/math'
  ]) {
    for (const [outputMode, expected] of Object.entries(expectedMixed)) {
      const fixture = mathJaxSvgFixture({ url });
      const payload = cleanCopy.getCopyPayload(
        fixture.document,
        selectContents(fixture.instance.window, fixture.target),
        { outputMode },
        fixture.instance.window,
        fixture.target
      );
      assert.equal(payload.text, expected, url + ' ' + outputMode);
      assert.equal(payload.reason, 'rendered-math', url + ' ' + outputMode);
      assert.equal(payload.mathML, '', url + ' ' + outputMode);
      assert.doesNotMatch(payload.html, /<svg|<path|data-latex|data-c/iu, url + ' ' + outputMode);
      if (outputMode === 'faithful') assert.match(payload.html, /<sup>2<\/sup>/u, url);
    }
  }

  const exact = mathJaxSvgFixture();
  for (const element of [exact.root, exact.svg]) {
    const payload = cleanCopy.getCopyPayload(
      exact.document,
      selectContents(exact.instance.window, element),
      { outputMode: 'faithful' },
      exact.instance.window,
      element
    );
    assert.equal(payload.text, 'x²', element.localName);
  }
  assert.equal(cleanCopy.getCopyPayload(
    exact.document,
    selectContents(exact.instance.window, exact.structure),
    { outputMode: 'faithful' },
    exact.instance.window,
    exact.structure
  ), null, 'an inner SVG group is a strict partial, not the whole equation');

  for (const [outputMode, expected] of Object.entries({
    faithful: 'Before x/y after',
    calculator: 'Before x/y after',
    latex: 'Before $\\frac{x}{y}$ after'
  })) {
    const fraction = mathJaxSvgFixture({
      source: '\\frac{x}{y}',
      structure: 'mfrac',
      glyphs: [{ code: '78' }, { code: '79' }]
    });
    assert.equal(cleanCopy.getCopyPayload(
      fraction.document,
      selectContents(fraction.instance.window, fraction.target),
      { outputMode },
      fraction.instance.window,
      fraction.target
    ).text, expected, outputMode);
  }
});

test('MathJax SVG recovery rejects stale structure, stale glyphs, and unsafe SVG content', () => {
  const cases = [
    { name: 'stale-structure', options: { structure: 'mfrac' } },
    { name: 'missing-structure', options: { structure: 'mrow' } },
    { name: 'stale-identifier', options: { glyphs: [{ code: '79' }, { code: '32' }] } },
    {
      name: 'stale-order',
      options: {
        source: 'x-y',
        structure: 'mrow',
        glyphs: [{ code: '79' }, { code: '2d', node: 'mo' }, { code: '78' }]
      }
    },
    {
      name: 'stale-operator',
      options: {
        source: 'x+y',
        structure: 'mrow',
        glyphs: [{ code: '78' }, { code: '2d', node: 'mo' }, { code: '79' }]
      }
    },
    {
      name: 'foreign-object',
      options: {
        mutate({ documentObject, svg }) {
          const foreign = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'foreignObject');
          foreign.textContent = 'SECRET';
          svg.appendChild(foreign);
        }
      }
    },
    {
      name: 'external-use',
      options: { glyphs: [{ code: '78', tag: 'use', href: 'https://attacker.invalid/glyph' }, { code: '32' }] }
    },
    {
      name: 'embedded-image',
      options: {
        mutate({ documentObject, svg }) {
          const image = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'image');
          image.setAttribute('href', 'data:image/svg+xml,SECRET');
          svg.appendChild(image);
        }
      }
    },
    {
      name: 'svg-text',
      options: {
        mutate({ documentObject, svg }) {
          const text = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'text');
          text.textContent = 'SECRET';
          svg.appendChild(text);
        }
      }
    },
    { name: 'invalid-codepoint', options: { glyphs: [{ code: '110000' }, { code: '32' }] } },
    { name: 'zero-geometry', options: { positiveRect: false } },
    { name: 'hidden-root', options: { rootStyle: 'opacity:0' } },
    { name: 'wrong-renderer', options: { jax: 'CHTML' } }
  ];
  for (const testCase of cases) {
    const fixture = mathJaxSvgFixture(testCase.options);
    assert.equal(cleanCopy.getCopyPayload(
      fixture.document,
      selectContents(fixture.instance.window, fixture.target),
      { outputMode: 'faithful' },
      fixture.instance.window,
      fixture.target
    ), null, testCase.name);
    assert.equal(cleanCopy.getCopyPayload(
      fixture.document,
      selectContents(fixture.instance.window, fixture.root),
      { outputMode: 'faithful' },
      fixture.instance.window,
      fixture.root
    ), null, testCase.name + ' exact root');
  }

  const localUse = mathJaxSvgFixture({
    source: 'x',
    structure: 'mrow',
    glyphs: [{ code: '78', tag: 'use', href: '#MJX-glyph-x' }],
    mutate({ documentObject, svg }) {
      const defs = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'defs');
      const path = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'path');
      path.id = 'MJX-glyph-x';
      path.setAttribute('d', 'M0 0L10 0L10 10Z');
      defs.appendChild(path);
      svg.prepend(defs);
    }
  });
  assert.equal(cleanCopy.getCopyPayload(
    localUse.document,
    selectContents(localUse.instance.window, localUse.target),
    { outputMode: 'faithful' },
    localUse.instance.window,
    localUse.target
  ).text, 'Before x after');
});

test('renderer-internal SVG metadata cannot exhaust generic math-root discovery', () => {
  const fixture = mathJaxSvgFixture({
    source: 'x',
    structure: 'mrow',
    glyphs: [{ code: '78' }],
    nestedMetadata: 4100
  });
  const selection = selectContents(fixture.instance.window, fixture.target);
  const range = selection.getRangeAt(0);
  assert.deepEqual(cleanCopy.rootsForRange(range), [fixture.root]);
  assert.equal(cleanCopy.getCopyPayload(
    fixture.document,
    selectContents(fixture.instance.window, fixture.root),
    { outputMode: 'faithful' },
    fixture.instance.window,
    fixture.root
  ).text, 'x');
});

test('genuine MathJax v4 SVG topology authenticates scripts, limits, roots, accents, braces, and native text', () => {
  const cases = [
    {
      source: 'x_i^2', expected: 'xᵢ²',
      build({ top, group, glyph }) {
        const scripts = group(top, 'msubsup', 'x_i^2');
        glyph(scripts, 'mi', 'x', '1D465');
        const upper = glyph(scripts, 'mn', '2', '32');
        upper.setAttribute('transform', 'translate(10,100) scale(0.707)');
        const lower = glyph(scripts, 'mi', 'i', '1D456');
        lower.setAttribute('transform', 'translate(10,-100) scale(0.707)');
      }
    },
    {
      source: '\\frac{x+y}{z}', expected: '(x + y)/z',
      build({ top, group, glyph, rect }) {
        const fraction = group(top, 'mfrac', '\\frac{x+y}{z}');
        const numerator = group(fraction, 'mrow', 'x+y');
        glyph(numerator, 'mi', 'x', '1D465');
        glyph(numerator, 'mo', '+', '2B');
        glyph(numerator, 'mi', 'y', '1D466');
        glyph(fraction, 'mi', 'z', '1D467');
        rect(fraction);
      }
    },
    {
      source: '\\sqrt{x+y}', expected: '√(x + y)',
      build({ top, group, glyph, rect }) {
        const root = group(top, 'msqrt', '\\sqrt{x+y}');
        glyph(root, 'mo', null, '221A');
        const body = group(root, '', null);
        glyph(body, 'mi', 'x', '1D465');
        glyph(body, 'mo', '+', '2B');
        glyph(body, 'mi', 'y', '1D466');
        rect(root);
      }
    },
    {
      source: '\\sqrt[3]{x}', expected: '∛x',
      build({ top, group, glyph, rect }) {
        const root = group(top, 'mroot', '\\sqrt[3]{x}');
        glyph(root, 'mo', null, '221A');
        glyph(root, 'mn', '3', '33');
        const body = group(root, '', null);
        glyph(body, 'mi', 'x', '1D465');
        rect(root);
      }
    },
    {
      source: '\\sum_{i=1}^{n}i', expected: '∑ᵢ₌₁ⁿ i',
      build({ top, group, glyph }) {
        const limits = group(top, 'munderover', '\\sum_{i=1}^{n}');
        glyph(limits, 'mo', '\\sum', '2211');
        const lower = group(limits, 'TeXAtom', '{i=1}');
        lower.setAttribute('transform', 'translate(0,-100) scale(0.707)');
        glyph(lower, 'mi', 'i', '1D456');
        glyph(lower, 'mo', '=', '3D');
        glyph(lower, 'mn', '1', '31');
        const upper = group(limits, 'TeXAtom', '{n}');
        upper.setAttribute('transform', 'translate(0,100) scale(0.707)');
        glyph(upper, 'mi', 'n', '1D45B');
        glyph(top, 'mi', 'i', '1D456');
      }
    },
    {
      source: '\\int_0^1 x\\,dx', expected: '∫₀¹ x dx',
      build({ top, group, glyph }) {
        const limits = group(top, 'msubsup', '\\int_0^1');
        glyph(limits, 'mo', '\\int', '222B');
        const upper = glyph(limits, 'mn', '1', '31');
        upper.setAttribute('transform', 'translate(0,100) scale(0.707)');
        const lower = glyph(limits, 'mn', '0', '30');
        lower.setAttribute('transform', 'translate(0,-100) scale(0.707)');
        glyph(top, 'mi', 'x', '1D465');
        group(top, 'mspace', '\\,');
        glyph(top, 'mi', 'd', '1D451');
        glyph(top, 'mi', 'x', '1D465');
      }
    },
    {
      source: '\\overline{xy}', expected: 'overline(xy)',
      build({ top, group, glyph }) {
        const over = group(top, 'mover', '\\overline{xy}');
        const body = group(over, 'mrow', 'xy');
        glyph(body, 'mi', 'x', '1D465');
        glyph(body, 'mi', 'y', '1D466');
        glyph(over, 'mo', null, '2015');
      }
    },
    {
      source: '\\underline{x}', expected: 'x̲',
      build({ top, group, glyph }) {
        const under = group(top, 'munder', '\\underline{x}');
        glyph(under, 'mi', 'x', '1D465');
        glyph(under, 'mo', null, '2015');
      }
    },
    {
      source: '\\overbrace{x+y}^{n}', expected: 'overbrace(x + y)ⁿ',
      build({ top, group, glyph }) {
        const outer = group(top, 'mover', '\\overbrace{x+y}^{n}');
        const atom = group(outer, 'TeXAtom', '\\overbrace{x+y}');
        const style = group(atom, 'mstyle', null);
        const inner = group(style, 'mover', null);
        const body = group(inner, 'mrow', 'x+y');
        glyph(body, 'mi', 'x', '1D465');
        glyph(body, 'mo', '+', '2B');
        glyph(body, 'mi', 'y', '1D466');
        glyph(inner, 'mo', null, '23DE');
        const upper = group(outer, 'TeXAtom', '{n}');
        glyph(upper, 'mi', 'n', '1D45B');
      }
    },
    {
      source: '\\underbrace{x+y}_{n}', expected: 'underbrace(x + y)ₙ',
      build({ top, group, glyph }) {
        const outer = group(top, 'munder', '\\underbrace{x+y}_{n}');
        const atom = group(outer, 'TeXAtom', '\\underbrace{x+y}');
        const style = group(atom, 'mstyle', null);
        const inner = group(style, 'munder', null);
        const body = group(inner, 'mrow', 'x+y');
        glyph(body, 'mi', 'x', '1D465');
        glyph(body, 'mo', '+', '2B');
        glyph(body, 'mi', 'y', '1D466');
        glyph(inner, 'mo', null, '23DF');
        const lower = group(outer, 'TeXAtom', '{n}');
        glyph(lower, 'mi', 'n', '1D45B');
      }
    },
    {
      source: '\\text{漢字}', expected: '漢字',
      build({ top, group, nativeText }) {
        nativeText(group(top, 'mtext', '\\text{漢字}'), '漢字');
      }
    },
    {
      source: '\\text{👩‍💻}', expected: '👩‍💻',
      build({ top, group, glyph, nativeText }) {
        const text = group(top, 'mtext', '\\text{👩‍💻}');
        nativeText(text, '👩');
        glyph(text, '', null, '200D', { emptyPath: true });
        nativeText(text, '💻');
      }
    }
  ];
  for (const testCase of cases) {
    const fixture = mathJaxV4SnapshotFixture(testCase.source, testCase.build);
    const payload = mathJaxV4Payload(fixture);
    assert.ok(payload, testCase.source);
    assert.equal(payload.text, 'Before ' + testCase.expected + ' after', testCase.source);
  }
});

test('MathJax SVG agreement preserves authored punctuation order and rejects stale interleaving', () => {
  const valid = [
    ['f(x)', ['66', '28', '78', '29']],
    ['1.2', ['31', '2E', '32']],
    ['|x|', ['7C', '78', '7C']],
    ['x/y', ['78', '2F', '79']],
    ['a*(b+c)', ['61', '2217', '28', '62', '2B', '63', '29']]
  ];
  for (const [source, codes] of valid) {
    const fixture = mathJaxSvgFixture({
      source,
      structure: 'mrow',
      glyphs: codes.map((code) => ({ code, node: /[0-9]/u.test(String.fromCodePoint(parseInt(code, 16))) ? 'mn' : 'mo' }))
    });
    assert.ok(mathJaxV4Payload(fixture), source);
  }

  const stale = [
    ['f(x)', ['66', '5B', '78', '5D']],
    ['1.2', ['31', '32']],
    ['|x|', ['78']],
    ['x/y', ['78', '2C', '79']],
    ['a*(b+c)', ['28', '61', '2217', '62', '29', '2B', '63']],
    ['\\clubsuit', ['2660']]
  ];
  for (const [source, codes] of stale) {
    const fixture = mathJaxSvgFixture({
      source,
      structure: 'mrow',
      glyphs: codes.map((code) => ({ code, node: 'mo' }))
    });
    assert.equal(mathJaxV4Payload(fixture), null, source + ' beside stale SVG');
  }
});

test('MathJax SVG exact topology rejects stale binomial grouping and table cell boundaries', () => {
  const binomial = (stale) => mathJaxV4SnapshotFixture(String.raw`\binom{(n)}{k}`,
    ({ top, group, glyph }) => {
      const row = group(top, 'mrow', String.raw`\binom{(n)}{k}`);
      glyph(row, 'mo', String.raw`\bigl (`, '28');
      const stack = group(row, 'mfrac', null);
      if (stale) {
        glyph(stack, 'mi', 'n', '1D45B');
        const lower = group(stack, 'mrow', '(k)');
        glyph(lower, 'mo', '(', '28');
        glyph(lower, 'mi', 'k', '1D458');
        glyph(lower, 'mo', ')', '29');
      } else {
        const upper = group(stack, 'mrow', '(n)');
        glyph(upper, 'mo', '(', '28');
        glyph(upper, 'mi', 'n', '1D45B');
        glyph(upper, 'mo', ')', '29');
        glyph(stack, 'mi', 'k', '1D458');
      }
      glyph(row, 'mo', String.raw`\bigr )`, '29');
    });
  assert.equal(mathJaxV4Payload(binomial(false)).text, 'Before C((n), k) after');
  assert.equal(mathJaxV4Payload(binomial(true)), null,
    'the same balanced parentheses cannot move from one binomial operand to the other');

  const matrix = (source, cells) => mathJaxV4SnapshotFixture(source, ({ top, group, glyph }) => {
    const row = group(top, 'mrow', source);
    glyph(row, 'mo', '(', '28');
    const table = group(row, 'mtable', null);
    for (const sourceRow of cells) {
      const renderedRow = group(table, 'mtr', null);
      for (const tokens of sourceRow) {
        const cell = group(renderedRow, 'mtd', null);
        for (const token of tokens) glyph(cell, token.node, token.text, token.code);
      }
    }
    glyph(row, 'mo', ')', '29');
  });
  const groupedSource = String.raw`\begin{pmatrix}(a+b)&c\\d&e\end{pmatrix}`;
  const token = (text, code, node = 'mi') => ({ text, code, node });
  const grouped = [
    [[token('(', '28', 'mo'), token('a', '61'), token('+', '2B', 'mo'), token('b', '62'),
      token(')', '29', 'mo')], [token('c', '63')]],
    [[token('d', '64')], [token('e', '65')]]
  ];
  assert.equal(mathJaxV4Payload(matrix(groupedSource, grouped)).text,
    'Before [(a + b), c; d, e] after');
  const movedGrouping = [
    [[token('a', '61'), token('+', '2B', 'mo'), token('(', '28', 'mo'), token('b', '62'),
      token(')', '29', 'mo')], [token('c', '63')]],
    [[token('d', '64')], [token('e', '65')]]
  ];
  assert.equal(mathJaxV4Payload(matrix(groupedSource, movedGrouping)), null,
    'balanced grouping cannot move between matching table anchors');

  const boundarySource = String.raw`\begin{pmatrix}a&bc\\d&e\end{pmatrix}`;
  const movedBoundary = [
    [[token('a', '61'), token('b', '62')], [token('c', '63')]],
    [[token('d', '64')], [token('e', '65')]]
  ];
  assert.equal(mathJaxV4Payload(matrix(boundarySource, movedBoundary)), null,
    'the same row-major glyph string cannot cross an mtd boundary');

  const repeatedSource = String.raw`\begin{pmatrix}x&y\\x&y\end{pmatrix}`;
  const changedRows = [
    [[token('x', '78')], [token('y', '79')], [token('x', '78')]],
    [[token('y', '79')]]
  ];
  assert.equal(mathJaxV4Payload(matrix(repeatedSource, changedRows)), null,
    'repeated identifiers cannot conceal changed row and cell topology');
});

test('MathJax SVG authenticates every multiscript slot from geometry', () => {
  const fixture = (positions, source = String.raw`\prescript{14}{6}{C}`) =>
    mathJaxV4SnapshotFixture(source, ({ top, group, glyph }) => {
      const scripts = group(top, 'mmultiscripts', source);
      const scriptedNumber = (value, codes, transform) => {
        const wrapper = group(scripts, '', null);
        wrapper.setAttribute('transform', transform);
        for (const code of codes) glyph(wrapper, 'mn', value, code);
      };
      scriptedNumber('14', ['31', '34'], positions.upper);
      scriptedNumber('6', ['36'], positions.lower);
      const base = glyph(scripts, 'mi', 'C', '43');
      base.setAttribute('transform', positions.base);
    });
  const validPositions = {
    upper: 'translate(0,100)',
    lower: 'translate(0,-100)',
    base: 'translate(100,0)'
  };
  assert.equal(mathJaxV4Payload(fixture(validPositions)).text, 'Before ¹⁴₆C after');
  assert.equal(mathJaxV4Payload(fixture({
    ...validPositions,
    upper: 'translate(0,-100)',
    lower: 'translate(0,100)'
  })), null, 'upper and lower slots cannot swap');
  assert.equal(mathJaxV4Payload(fixture({
    ...validPositions,
    upper: 'translate(200,100)'
  })), null, 'pre- and post-script slots cannot swap');
  assert.equal(mathJaxV4Payload(fixture({
    upper: 'translate(100,0)',
    lower: 'translate(0,-100)',
    base: 'translate(0,100)'
  })), null, 'base and script roles cannot swap while DOM text order stays unchanged');
  assert.equal(mathJaxV4Payload(fixture({
    ...validPositions,
    upper: 'scale(.707)'
  })), null, 'ambiguous geometry fails closed');
});

test('MathJax SVG combined scripts use visual offsets, never DOM-order guesses', () => {
  const fixtureFor = (stale) => mathJaxV4SnapshotFixture('x_i^2', ({ top, group, glyph }) => {
    const scripts = group(top, 'msubsup', 'x_i^2');
    glyph(scripts, 'mi', 'x', '1D465');
    const paintedUpper = glyph(scripts, stale ? 'mi' : 'mn', stale ? 'i' : '2', stale ? '1D456' : '32');
    paintedUpper.setAttribute('transform', 'translate(10,100) scale(0.707)');
    const paintedLower = glyph(scripts, stale ? 'mn' : 'mi', stale ? '2' : 'i', stale ? '32' : '1D456');
    paintedLower.setAttribute('transform', 'translate(10,-100) scale(0.707)');
  });
  assert.equal(mathJaxV4Payload(fixtureFor(false)).text, 'Before xᵢ² after');
  assert.equal(mathJaxV4Payload(fixtureFor(true)), null);

  const noOffsets = mathJaxSvgFixture({
    source: 'x_i^2', structure: 'msubsup',
    glyphs: [{ code: '78' }, { code: '32' }, { code: '69' }]
  });
  assert.equal(mathJaxV4Payload(noOffsets), null, 'ambiguous combined-script paint order fails closed');
});

test('MathJax SVG requires every painted line and every glyph source to be visible and drawable', () => {
  for (const style of [
    'display:none', 'visibility:hidden', 'opacity:0', 'clip-path:circle(0)',
    'mask-image:linear-gradient(transparent,transparent)', 'filter:opacity(0)'
  ]) {
    const fixture = mathJaxSvgFixture({ mutate({ svg }) { svg.setAttribute('style', style); } });
    assert.equal(mathJaxV4Payload(fixture), null, 'direct SVG ' + style);
  }
  for (const style of ['opacity:0', 'display:none', 'clip-path:circle(0)', 'filter:opacity(0)']) {
    const fixture = mathJaxSvgFixture();
    fixture.target.setAttribute('style', style);
    assert.equal(mathJaxV4Payload(fixture), null, 'ancestor ' + style);
  }
  const hiddenGlyph = mathJaxSvgFixture({
    mutate({ top }) { top.firstElementChild.firstElementChild.setAttribute('style', 'opacity:0'); }
  });
  assert.equal(mathJaxV4Payload(hiddenGlyph), null, 'a hidden glyph cannot authenticate metadata');

  const emptyPath = mathJaxSvgFixture({ glyphs: [{ code: '78', d: null }, { code: '32' }] });
  assert.equal(mathJaxV4Payload(emptyPath), null, 'empty path');
  const missingUse = mathJaxSvgFixture({
    source: 'x', structure: 'mrow', glyphs: [{ code: '78', tag: 'use', href: '#MJX-missing' }]
  });
  assert.equal(mathJaxV4Payload(missingUse), null, 'missing local use target');
  const emptyUse = mathJaxSvgFixture({
    source: 'x', structure: 'mrow', glyphs: [{ code: '78', tag: 'use', href: '#MJX-empty' }],
    mutate({ documentObject, svg }) {
      const defs = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'defs');
      const path = documentObject.createElementNS(EMBEDDED_TEST_SVG_NAMESPACE, 'path');
      path.id = 'MJX-empty';
      path.setAttribute('d', '');
      defs.appendChild(path);
      svg.prepend(defs);
    }
  });
  assert.equal(mathJaxV4Payload(emptyUse), null, 'empty non-joining use target');
});

test('MathJax SVG top-source work is aggregate-bounded and cloned line metadata is parsed once', () => {
  const repeatedSource = 'x'.repeat(41);
  const fixture = mathJaxSvgFixture({ source: repeatedSource, structure: 'mrow', glyphs: [{ code: '78' }] });
  const firstSvg = fixture.svg;
  for (let index = 0; index < 40; index += 1) {
    const clone = firstSvg.cloneNode(true);
    for (const path of clone.querySelectorAll('defs path')) path.id += '-line-' + index;
    for (const use of clone.querySelectorAll('use')) {
      use.setAttribute('href', use.getAttribute('href') + '-line-' + index);
    }
    giveEmbeddedTestRect(clone, 44, 24);
    fixture.root.appendChild(clone);
  }
  assert.equal(mathJaxV4Payload(fixture).text, 'Before ' + repeatedSource + ' after',
    'line glyph segments concatenate while one exact source is reused');

  const oversized = mathJaxSvgFixture({ source: 'x', structure: 'mrow', glyphs: [{ code: '78' }] });
  const top = oversized.top;
  top.setAttribute('data-latex', ' '.repeat(50001) + 'x');
  assert.equal(mathJaxV4Payload(oversized), null, 'raw metadata is bounded before trimming');
});

test('calculator aggregates bind an immediate identifier call as their complete body', () => {
  assert.equal(cleanCopy.latexToCalculator('\\lim_{x\\to0}f(x)'), 'limit(f(x),x->0)');
  assert.equal(cleanCopy.latexToCalculator('\\sum_{i=1}^n f(i)'), 'sum(f(i),i=1,n)');
  assert.equal(cleanCopy.latexToCalculator('\\int_0^1 f(x)\\,dx'), 'integral(f(x),x,0,1)');
  assert.equal(cleanCopy.latexToFaithful('\\underbrace{x}_{n}'), 'underbrace(x)ₙ');
  assert.equal(cleanCopy.latexToFaithful('\\overbrace{x+y}^{n}'), 'overbrace(x + y)ⁿ');
  assert.equal(cleanCopy.latexToCalculator('\\overbrace{x+y}^{n}'), 'x+y');
  assert.equal(cleanCopy.latexToCalculator('\\underbrace{x+y}_{n}'), 'x+y');
  assert.equal(cleanCopy.latexToCalculator('\\overbrace{x+y}z'), '(x+y)*z');
  assert.equal(cleanCopy.latexToCalculator('2\\underbrace{x+y}'), '2*(x+y)');
});

test('nested bounded CSS operators stay readable and LaTeX-safe while calculator mode fails closed', () => {
  const cases = [
    ['lim', 'x→0', 'f(x)', '(lim_(x → 0) f(x))/y', '$\\frac{\\lim_{x\\to 0} f(x)}{y}$'],
    ['∑', 'i=1', 'aᵢ', '(∑ᵢ₌₁ aᵢ)/y', '$\\frac{\\sum_{i=1} a_{i}}{y}$'],
    ['∏', 'i=1', 'aᵢ', '(∏ᵢ₌₁ aᵢ)/y', '$\\frac{\\prod_{i=1} a_{i}}{y}$'],
    ['∫', 'a', 'f(x)dx', '(∫ₐ f(x)dx)/y', '$\\frac{\\int_{a} f(x)dx}{y}$']
  ];
  const build = (operator, bound, body) => {
    const instance = dom([
      '<div id="target"><section id="outer" style="display:inline-table">',
      '<div data-test-stack-row="outer-top" style="display:table-row;border-bottom:1px solid currentColor">',
      '<span id="bounded" style="display:inline-table">',
      '<i data-test-stack-row="bounded-top" style="display:table-row">', operator, '</i>',
      '<b data-test-stack-row="bounded-bottom" style="display:table-row">', bound, '</b>',
      '</span> ', body, '</div>',
      '<div data-test-stack-row="outer-bottom" style="display:table-row">y</div>',
      '</section></div>'
    ].join(''), 'https://bounded-operators.invalid/random/path');
    giveNamedCssStackGeometry(instance.window.document, 'outer', {
      left: 10, top: 10, width: 100, rowHeight: 30, gap: 2
    });
    giveNamedCssStackGeometry(instance.window.document, 'bounded', {
      left: 15, top: 12, width: 35, rowHeight: 10, gap: 1
    });
    return instance;
  };

  for (const [operator, bound, body, faithful, latex] of cases) {
    const instance = build(operator, bound, body);
    const documentObject = instance.window.document;
    const target = documentObject.querySelector('#target');
    const outer = documentObject.querySelector('#outer');
    assert.equal(cleanCopy.getCopyPayload(
      documentObject,
      selectContents(instance.window, outer),
      { outputMode: 'faithful' },
      instance.window,
      target
    ).text, faithful, operator + ' faithful');
    assert.equal(cleanCopy.getCopyPayload(
      documentObject,
      selectContents(instance.window, outer),
      { outputMode: 'latex' },
      instance.window,
      target
    ).text, latex, operator + ' LaTeX');
    assert.equal(cleanCopy.getCopyPayload(
      documentObject,
      selectContents(instance.window, outer),
      { outputMode: 'calculator' },
      instance.window,
      target
    ), null, operator + ' calculator mode must not invent aggregate scope');
  }

  const prose = build('lim', 'x→0', 'Current plan');
  const proseTarget = prose.window.document.querySelector('#target');
  for (const outputMode of ['faithful', 'calculator', 'latex']) {
    assert.equal(cleanCopy.getCopyPayload(
      prose.window.document,
      selectContents(prose.window, prose.window.document.querySelector('#outer')),
      { outputMode },
      prose.window,
      proseTarget
    ), null, 'a nested operator cannot authenticate an ordinary prose tail in ' + outputMode);
  }
});

test('source-less role=math ancestors yield to authenticated visual stacks but source-bearing roots remain strict', () => {
  const build = (numerator, denominator, attributes = '') => {
    const instance = dom([
      '<div id="target" role="math" ', attributes, '>Equation: ',
      '<span id="fraction" style="display:inline-table">',
      '<i data-test-stack-row="role-top" style="display:table-row;border-bottom:1px solid currentColor">',
      numerator, '</i>',
      '<b data-test-stack-row="role-bottom" style="display:table-row">', denominator, '</b>',
      '</span></div>'
    ].join(''), 'https://source-less-role.invalid/lesson');
    giveNamedCssStackGeometry(instance.window.document, 'role', { width: 40, rowHeight: 10, gap: 1 });
    return instance;
  };
  for (const [numerator, denominator] of [['x', 'y'], ['1', '2']]) {
    const instance = build(numerator, denominator);
    const documentObject = instance.window.document;
    const target = documentObject.querySelector('#target');
    const expectedFormula = numerator + '/' + denominator;
    const expectedModes = {
      faithful: expectedFormula,
      calculator: expectedFormula,
      latex: '$\\frac{' + numerator + '}{' + denominator + '}$'
    };
    for (const [outputMode, formulaText] of Object.entries(expectedModes)) {
      const exact = cleanCopy.getCopyPayload(
        documentObject,
        selectContents(instance.window, documentObject.querySelector('#fraction')),
        { outputMode },
        instance.window,
        target
      );
      assert.equal(exact && exact.text, formulaText, numerator + '/' + denominator + ' exact ' + outputMode);
      const whole = cleanCopy.getCopyPayload(
        documentObject,
        selectContents(instance.window, target),
        { outputMode },
        instance.window,
        target
      );
      assert.equal(whole && whole.text, 'Equation: ' + formulaText,
        numerator + '/' + denominator + ' whole ' + outputMode);
    }
  }

  const sourceBearing = build('x', 'y', 'data-latex="z"');
  const sourceDocument = sourceBearing.window.document;
  const sourceTarget = sourceDocument.querySelector('#target');
  for (const selected of [sourceDocument.querySelector('#fraction'), sourceTarget]) {
    for (const outputMode of ['faithful', 'calculator', 'latex']) {
      assert.equal(cleanCopy.getCopyPayload(
        sourceDocument,
        selectContents(sourceBearing.window, selected),
        { outputMode },
        sourceBearing.window,
        sourceTarget
      ), null, 'independent source disagreement remains strict in ' + outputMode);
    }
  }
});

test('CSS-stack descriptor discovery is locally memoized for deeply nested formulas', () => {
  const depth = 24;
  let formula = 'x';
  let expected = 'x';
  for (let level = 1; level <= depth; level += 1) {
    formula = [
      '<span id="memo-', level, '" style="display:inline-table">',
      '<i data-test-stack-row="memo-', level, '-top" style="display:table-row;border-bottom:1px solid currentColor">',
      formula, '</i>',
      '<b data-test-stack-row="memo-', level, '-bottom" style="display:table-row">y</b>',
      '</span>'
    ].join('');
    expected = level === 1 ? expected + '/y' : '(' + expected + ')/y';
  }
  const instance = dom('<div id="target">' + formula + '</div>', 'https://memoized.invalid/formula');
  const documentObject = instance.window.document;
  for (let level = 1; level <= depth; level += 1) {
    giveNamedCssStackGeometry(documentObject, 'memo-' + level, { width: 100 });
  }
  const originalGetComputedStyle = instance.window.getComputedStyle.bind(instance.window);
  let computedStyleReads = 0;
  instance.window.getComputedStyle = (...args) => {
    computedStyleReads += 1;
    return originalGetComputedStyle(...args);
  };
  const payload = cleanCopy.getCopyPayload(
    documentObject,
    selectContents(instance.window, documentObject.querySelector('#memo-' + depth)),
    { outputMode: 'faithful' },
    instance.window,
    documentObject.querySelector('#target')
  );
  assert.equal(payload && payload.text, expected);
  assert.ok(computedStyleReads < 5000,
    'descriptor memoization should keep style reads bounded; observed ' + computedStyleReads);
});

test('CSS-stack recognition bounds a high-fanout direct child list before collection materialization', () => {
  const instance = dom([
    '<div id="target"><span id="stack" style="display:inline-table">',
    '<i data-test-stack-row="wide-css-top" style="display:table-row;border-bottom:1px solid currentColor">x</i>',
    '<b data-test-stack-row="wide-css-bottom" style="display:table-row">y</b>',
    '</span></div>'
  ].join(''), 'https://wide-layout.invalid/');
  const documentObject = instance.window.document;
  const stack = documentObject.querySelector('#stack');
  const fragment = documentObject.createDocumentFragment();
  for (let index = 0; index < 300; index += 1) fragment.appendChild(documentObject.createElement('wbr'));
  stack.appendChild(fragment);
  giveNamedCssStackGeometry(documentObject, 'wide-css');
  Object.defineProperty(stack, 'children', {
    configurable: true,
    get() {
      throw new Error('the full untrusted HTMLCollection was materialized');
    }
  });
  let payload;
  assert.doesNotThrow(() => {
    payload = cleanCopy.getCopyPayload(
      documentObject,
      selectContents(instance.window, stack),
      { outputMode: 'faithful' },
      instance.window,
      documentObject.querySelector('#target')
    );
  });
  assert.ok(!payload || payload.reason !== 'css-stacked-math');
});

test('block vertical-align is ordinary layout, while inline vertical-align remains a mathematical script', () => {
  const block = dom(
    '<div id="target">Label<div style="display:block;vertical-align:super">Value</div></div>',
    'https://ordinary-layout.invalid/'
  );
  const blockTarget = block.window.document.querySelector('#target');
  for (const outputMode of ['faithful', 'calculator', 'latex']) {
    const payload = cleanCopy.getCopyPayload(
      block.window.document,
      selectContents(block.window, blockTarget),
      { outputMode },
      block.window,
      blockTarget
    );
    assert.equal(payload && payload.text, 'Label\nValue', 'block layout in ' + outputMode);
    assert.doesNotMatch(payload.text, /[_^]/u);
  }

  const inline = dom(
    '<p id="target">x<span style="display:inline;vertical-align:super">2</span></p>',
    'https://inline-script.invalid/'
  );
  const inlineTarget = inline.window.document.querySelector('#target');
  for (const [outputMode, text] of Object.entries({
    faithful: 'x²', calculator: 'x^(2)', latex: 'x^{2}'
  })) {
    assert.equal(cleanCopy.getCopyPayload(
      inline.window.document,
      selectContents(inline.window, inlineTarget),
      { outputMode },
      inline.window,
      inlineTarget
    ).text, text, 'inline script in ' + outputMode);
  }
});

test('ambiguous UI stacks and visible numeric punctuation fail closed without explicit math semantics', () => {
  const build = (top, bottom, attributes = '') => {
    const instance = dom([
      '<div id="target"><span id="fraction" ', attributes, ' style="display:inline-table">',
      '<i data-test-stack-row="ui-top" style="display:table-row;border-bottom:1px solid currentColor">',
      top, '</i>',
      '<b data-test-stack-row="ui-bottom" style="display:table-row">', bottom, '</b>',
      '</span></div>'
    ].join(''), 'https://generic-ui.invalid/unrelated');
    giveNamedCssStackGeometry(instance.window.document, 'ui', { width: 50 });
    return instance;
  };
  const ambiguousPairs = [
    ['OK', 'NO'], ['US', 'EU'], ['AM', 'PM'], ['A1', 'B2'],
    ['Q1', 'Q2'], ['v1', 'v2'], ['kg', 'lb'],
    ['10%', '20%'], ['#1', '#2'], ['$1', '$2']
  ];
  for (const [top, bottom] of ambiguousPairs) {
    const instance = build(top, bottom);
    const documentObject = instance.window.document;
    const target = documentObject.querySelector('#target');
    for (const outputMode of ['faithful', 'calculator', 'latex']) {
      assert.equal(cleanCopy.getCopyPayload(
        documentObject,
        selectContents(instance.window, documentObject.querySelector('#fraction')),
        { outputMode },
        instance.window,
        target
      ), null, top + '/' + bottom + ' in ' + outputMode);
    }
  }

  const variables = build('a', 'b');
  const variablesTarget = variables.window.document.querySelector('#target');
  assert.equal(cleanCopy.getCopyPayload(
    variables.window.document,
    selectContents(variables.window, variables.window.document.querySelector('#fraction')),
    { outputMode: 'faithful' },
    variables.window,
    variablesTarget
  ).text, 'a/b', 'ordinary single-glyph variables remain supported');

  const explicitPercentage = build('10%', '20%', 'role="math"');
  const percentageDocument = explicitPercentage.window.document;
  const percentageTarget = percentageDocument.querySelector('#target');
  for (const [outputMode, text] of Object.entries({
    faithful: '10%/20%',
    calculator: '(10/100)/(20/100)',
    latex: '$\\frac{10\\%}{20\\%}$'
  })) {
    assert.equal(cleanCopy.getCopyPayload(
      percentageDocument,
      selectContents(explicitPercentage.window, percentageDocument.querySelector('#fraction')),
      { outputMode },
      explicitPercentage.window,
      percentageTarget
    ).text, text, 'explicit percentage fraction in ' + outputMode);
  }
});

test('bounded CSS operators bind Unicode letter-script tails in every output mode', () => {
  const cases = [
    ['∑', 'i=1', 'aᵢ', '∑ᵢ₌₁ aᵢ', 'sum(a_(i),i=1)', '$\\sum_{i=1}{a_{i}}$'],
    ['∏', 'i=1', 'aᵢ', '∏ᵢ₌₁ aᵢ', 'product(a_(i),i=1)', '$\\prod_{i=1}{a_{i}}$'],
    ['∫', 'a', 'aⁿ', '∫ₐ aⁿ', 'integral(a^(n),a)', '$\\int_{a}{a^{n}}$']
  ];
  for (const [operator, bound, body, faithful, calculator, latex] of cases) {
    const instance = dom([
      '<div id="target"><span id="operator" style="display:inline-table">',
      '<i data-test-stack-row="unicode-top" style="display:table-row">', operator, '</i>',
      '<b data-test-stack-row="unicode-bottom" style="display:table-row">', bound, '</b>',
      '</span> ', body, '</div>'
    ].join(''), 'https://unicode-script.invalid/equation');
    const documentObject = instance.window.document;
    const target = documentObject.querySelector('#target');
    giveNamedCssStackGeometry(documentObject, 'unicode', { width: 35, rowHeight: 10, gap: 1 });
    for (const [outputMode, text] of Object.entries({ faithful, calculator, latex })) {
      assert.equal(cleanCopy.getCopyPayload(
        documentObject,
        selectContents(instance.window, target),
        { outputMode },
        instance.window,
        target
      ).text, text, operator + ' Unicode tail in ' + outputMode);
    }
  }
});

test('numeric semantics survive deep neutral wrapper chains without authenticating an unmarked stack', () => {
  const semanticAttributes = [
    'role="math"',
    'aria-roledescription="formula"',
    'data-math="true"'
  ];
  const build = (attributes = '') => {
    let contents = [
      '<i data-test-stack-row="deep-top" style="display:table-row;border-bottom:1px solid currentColor">1</i>',
      '<b data-test-stack-row="deep-bottom" style="display:table-row">2</b>'
    ].join('');
    for (let depth = 11; depth >= 0; depth -= 1) {
      contents = '<span id="deep-' + depth + '" style="display:' +
        (depth % 2 ? 'contents' : 'inline-block') + '">' + contents + '</span>';
    }
    const instance = dom(
      '<div id="target"><section id="outer" ' + attributes +
      ' style="display:inline-block">' + contents + '</section></div>',
      'https://deep-semantics.invalid/random'
    );
    giveNamedCssStackGeometry(instance.window.document, 'deep', { width: 45 });
    return instance;
  };

  for (const attributes of semanticAttributes) {
    const instance = build(attributes);
    const documentObject = instance.window.document;
    const target = documentObject.querySelector('#target');
    for (const selected of [documentObject.querySelector('#outer'), documentObject.querySelector('#deep-11')]) {
      for (const [outputMode, text] of Object.entries({
        faithful: '1/2', calculator: '1/2', latex: '$\\frac{1}{2}$'
      })) {
        assert.equal(cleanCopy.getCopyPayload(
          documentObject,
          selectContents(instance.window, selected),
          { outputMode },
          instance.window,
          target
        ).text, text, attributes + ' ' + selected.id + ' ' + outputMode);
      }
    }
  }

  const unmarked = build();
  const unmarkedDocument = unmarked.window.document;
  const unmarkedTarget = unmarkedDocument.querySelector('#target');
  for (const selected of [unmarkedDocument.querySelector('#outer'), unmarkedDocument.querySelector('#deep-11')]) {
    for (const outputMode of ['faithful', 'calculator', 'latex']) {
      assert.equal(cleanCopy.getCopyPayload(
        unmarkedDocument,
        selectContents(unmarked.window, selected),
        { outputMode },
        unmarked.window,
        unmarkedTarget
      ), null, 'unmarked numeric stack ' + selected.id + ' ' + outputMode);
    }
  }
});
