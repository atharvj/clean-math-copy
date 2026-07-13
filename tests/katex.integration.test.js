'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const katex = require('katex');
const { JSDOM } = require('jsdom');
const cleanCopy = require('../clean-math-copy.user.js');

function copyVisibleKaTeX(source, outputMode = 'calculator', renderOptions) {
  const rendered = katex.renderToString(source, {
    displayMode: true,
    output: 'htmlAndMathml',
    throwOnError: true,
    ...(renderOptions || {})
  });
  const instance = new JSDOM('<!doctype html><html><body><div id="fixture">' + rendered + '</div></body></html>');
  const visual = instance.window.document.querySelector('.katex-html');
  const range = instance.window.document.createRange();
  range.selectNodeContents(visual);
  const selection = instance.window.getSelection();
  selection.addRange(range);
  return cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    { ...cleanCopy.DEFAULT_SETTINGS, outputMode },
    instance.window,
    visual
  );
}

test('real KaTeX DOM: faithful mode reproduces the two target visual formulas', () => {
  assert.equal(
    copyVisibleKaTeX(String.raw`(y')^2=20x'`, 'faithful').text,
    '(y′)² = 20x′'
  );
  assert.equal(
    copyVisibleKaTeX(String.raw`F_g=G\left(\frac{m_1m_2}{r^2}\right)`, 'faithful').text,
    'F_g = G((m₁m₂)/r²)'
  );
});

test('real KaTeX DOM: faithful mode uses readable roots, fences, scripts, and minimal fraction grouping', () => {
  assert.equal(
    copyVisibleKaTeX(String.raw`r\propto\sqrt{\frac{m}{\lvert q\rvert}}`, 'faithful').text,
    'r ∝ √(m/|q|)'
  );
  assert.equal(copyVisibleKaTeX(String.raw`\lVert x\rVert_2`, 'faithful').text, '‖x‖₂');
  assert.equal(copyVisibleKaTeX(String.raw`\frac{a+b}{c+d}`, 'faithful').text, '(a + b)/(c + d)');
  assert.equal(
    copyVisibleKaTeX(String.raw`\frac{-b\pm\sqrt{b^2-4ac}}{2a}`, 'faithful').text,
    '(−b ± √(b² − 4ac))/(2a)'
  );
  assert.equal(copyVisibleKaTeX(String.raw`\sin\lvert x\rvert`, 'faithful').text, 'sin |x|');
  assert.equal(copyVisibleKaTeX(String.raw`\sin^2(x)`, 'faithful').text, 'sin²(x)');
  assert.equal(copyVisibleKaTeX(String.raw`\sqrt{x}`, 'faithful').text, '√x');
  assert.equal(copyVisibleKaTeX(String.raw`\sqrt{x^2}`, 'faithful').text, '√(x²)');
  assert.equal(copyVisibleKaTeX(String.raw`\sqrt{x'}`, 'faithful').text, '√(x′)');
  assert.equal(copyVisibleKaTeX(String.raw`\sqrt{x_1}`, 'faithful').text, '√x₁');
  assert.equal(copyVisibleKaTeX(String.raw`\sqrt{x}y`, 'faithful').text, '√(x)y');
  assert.equal(copyVisibleKaTeX(String.raw`\frac1{\sqrt{x}y}`, 'faithful').text, '1/(√(x)y)');
  assert.equal(copyVisibleKaTeX(String.raw`\sqrt{xy}`, 'faithful').text, '√(xy)');
  assert.equal(copyVisibleKaTeX(String.raw`\sqrt[3]{x}`, 'faithful').text, '∛x');
});

test('real KaTeX DOM: faithful mode retains invisible group and compound-operator scope', () => {
  const cases = new Map([
    [String.raw`\frac1{abcd}`, '1/(abcd)'],
    [String.raw`\frac1{2ab}`, '1/(2ab)'],
    [String.raw`{a+b}^2`, '(a + b)²'],
    [String.raw`{ab}^2`, '(ab)²'],
    [String.raw`\sqrt{x}^2`, '(√x)²'],
    [String.raw`2{a+b}`, '2(a + b)'],
    [String.raw`{a+b}c`, '(a + b)c'],
    [String.raw`\sin{x+y}`, 'sin(x + y)'],
    [String.raw`\overline{a+b}`, 'overline(a + b)'],
    [String.raw`\hat{xy}`, 'hat(xy)'],
    [String.raw`a\parallel b`, 'a ∥ b'],
    [String.raw`\text{time-dependent; don't}`, 'time-dependent; don’t']
  ]);
  for (const [source, expected] of cases) {
    assert.equal(copyVisibleKaTeX(source, 'faithful').text, expected, source);
  }
});

test('real KaTeX DOM: faithful mode preserves explicit alphabets and enclosures', () => {
  const cases = new Map([
    [String.raw`\mathbf{x}`, '𝐱'],
    [String.raw`\boldsymbol{\alpha}`, '𝜶'],
    [String.raw`\mathcal{B}`, 'ℬ'],
    [String.raw`\mathscr{x}`, '𝓍'],
    [String.raw`\mathfrak{C}`, 'ℭ'],
    [String.raw`\mathsf{x}`, '𝗑'],
    [String.raw`\mathtt{x}`, '𝚡'],
    [String.raw`\mathbb{R}`, 'ℝ'],
    [String.raw`\mathcal{\alpha}`, 'script(α)'],
    [String.raw`\mathbf{x+1}`, '𝐱 + 𝟏'],
    [String.raw`\boldsymbol{\alpha+\Gamma}`, '𝜶 + 𝚪'],
    [String.raw`\cancel{x}`, 'cancel(x)'],
    [String.raw`\bcancel{x}`, 'bcancel(x)'],
    [String.raw`\xcancel{x}`, 'xcancel(x)'],
    [String.raw`\boxed{x}`, 'boxed(x)']
  ]);
  for (const [source, expected] of cases) {
    assert.equal(copyVisibleKaTeX(source, 'faithful').text, expected, source);
  }
});

test('real KaTeX DOM: faithful Greek variants agree with TeX glyph conventions', () => {
  assert.equal(
    copyVisibleKaTeX(String.raw`\phi,\varphi,\epsilon,\varepsilon`, 'faithful').text,
    'ϕ, φ, ϵ, ε'
  );
});

test('real KaTeX DOM: faithful symbols agree with canonical renderer glyphs', () => {
  const cases = new Map([
    [String.raw`\varkappa`, 'ϰ'], [String.raw`\nparallel`, '∦'],
    [String.raw`\nmid`, '∤'], [String.raw`\owns`, '∋'],
    [String.raw`\subsetneq`, '⊊'], [String.raw`\supsetneq`, '⊋'],
    [String.raw`\smallsetminus`, '∖'], [String.raw`\land`, '∧'],
    [String.raw`\lor`, '∨'], [String.raw`\Box`, '□'],
    [String.raw`\Diamond`, '◊'], [String.raw`\clubsuit`, '♣'],
    [String.raw`\diamondsuit`, '♢'], [String.raw`\heartsuit`, '♡'],
    [String.raw`\spadesuit`, '♠'], [String.raw`\cdot`, '⋅'],
    [String.raw`\bullet`, '∙'], [String.raw`\iff`, '⟺'],
    [String.raw`\implies`, '⟹'], [String.raw`\impliedby`, '⟸']
  ]);
  for (const [source, expected] of cases) {
    assert.equal(copyVisibleKaTeX(String.raw`x=` + source, 'faithful').text, 'x = ' + expected, source);
    assert.equal(copyVisibleKaTeX(source, 'faithful').text, expected, 'standalone ' + source);
  }
});

test('real KaTeX DOM: faithful whole-copy follows rendered semantics over divergent source', () => {
  assert.equal(
    copyVisibleKaTeX(String.raw`\foo+1`, 'faithful', { macros: { '\\foo': 'x^2' } }).text,
    'x² + 1'
  );
  assert.equal(
    copyVisibleKaTeX(String.raw`\alpha+1`, 'faithful', { macros: { '\\alpha': 'x' } }).text,
    'x + 1'
  );
  assert.equal(copyVisibleKaTeX(String.raw`\pmb{x}`, 'faithful').text, 'x');
  assert.equal(copyVisibleKaTeX(String.raw`x\kern1em y`, 'faithful').text, 'x y');
  assert.equal(
    copyVisibleKaTeX(String.raw`\htmlClass{foo}{x}`, 'faithful', { trust: true, strict: false }).text,
    'x'
  );
});

test('real KaTeX DOM: faithful mode preserves binomial stacks, accents, and isotope prescripts', () => {
  const cases = new Map([
    [String.raw`\binom{n}{k}`, 'C(n, k)'],
    [String.raw`\dbinom{n}{k}`, 'C(n, k)'],
    [String.raw`\tbinom{n}{k}`, 'C(n, k)'],
    [String.raw`{n\choose k}`, 'C(n, k)'],
    [String.raw`{n\atop k}`, 'stack(n, k)'],
    [String.raw`\vec v`, 'v⃗'],
    [String.raw`\bar x`, 'x̅'],
    [String.raw`{}^{14}_{6}C`, '¹⁴₆C']
  ]);
  for (const [source, expected] of cases) {
    assert.equal(copyVisibleKaTeX(source, 'faithful').text, expected, source);
  }
  const binomial = copyVisibleKaTeX(String.raw`\binom{n}{k}`, 'faithful');
  assert.doesNotMatch(binomial.html, /border-top:1px solid currentColor/u);
  assert.match(copyVisibleKaTeX(String.raw`\vec v`, 'faithful').html, /v⃗/u);
  assert.match(copyVisibleKaTeX(String.raw`{}^{14}_{6}C`, 'faithful').html, /¹⁴₆C/u);

  const cancelled = copyVisibleKaTeX(String.raw`\cancel{x}`, 'faithful');
  assert.match(cancelled.html, /background-image:linear-gradient/u);
  assert.match(cancelled.html, /aria-label="cancel\(x\)"/u);
  const boxed = copyVisibleKaTeX(String.raw`\boxed{x}`, 'faithful');
  assert.match(boxed.html, /border:1px solid currentColor/u);
  assert.match(boxed.html, /aria-label="boxed\(x\)"/u);
});

test('real KaTeX DOM: faithful mode recognizes renderer accent glyphs without losing semantic braces', () => {
  const cases = new Map([
    [String.raw`\acute x`, 'x́'], [String.raw`\grave x`, 'x̀'],
    [String.raw`\breve x`, 'x̆'], [String.raw`\check x`, 'x̌'],
    [String.raw`\mathring x`, 'x̊'], [String.raw`\underline x`, 'x̲'],
    [String.raw`\overbrace{x}`, 'overset(⏞, x)'],
    [String.raw`\underbrace{x}`, 'underset(⏟, x)']
  ]);
  for (const [source, expected] of cases) {
    assert.equal(copyVisibleKaTeX(source, 'faithful').text, expected, source);
  }
});

test('real KaTeX DOM: sanitizer retains nested token structures and rich presentation', () => {
  const modulo = copyVisibleKaTeX(String.raw`a\bmod n`, 'faithful');
  assert.equal(modulo.text, 'a mod n');
  assert.match(modulo.mathML, /<mi mathvariant="normal">m<\/mi>/u);
  assert.match(modulo.html, />mod<\/span>/u);

  const annotatedArrow = copyVisibleKaTeX(String.raw`A\overset f\longrightarrow B`, 'faithful');
  assert.equal(annotatedArrow.text, 'A overset(f, ⟶) B');
  assert.match(annotatedArrow.mathML, /<mover>/u);
  assert.match(annotatedArrow.html, /⟶<\/span><sup>f<\/sup>/u);

  assert.equal(
    copyVisibleKaTeX(String.raw`A\underset f\longrightarrow B`, 'faithful').text,
    'A underset(f, ⟶) B'
  );
});

test('real KaTeX DOM: faithful exact selections remain exact and retain visual scripts', () => {
  const numeric = String.raw`m = 0.666 \times 10^{-25}\,\mathrm{kg}`;
  assert.equal(copyVisibleSubstring(numeric, '0.666×10−25', 'faithful').text, '0.666 × 10⁻²⁵');
  assert.equal(copyVisibleSubstring(numeric, '10−25', 'faithful').text, '10⁻²⁵');
  assert.equal(
    copyVisibleSubstring(String.raw`r\propto\sqrt{\frac{m}{\lvert q\rvert}}`, 'q', 'faithful').text,
    'q'
  );
  assert.equal(
    copyVisibleSubstring(String.raw`r\propto\sqrt{\frac{m}{\lvert q\rvert}}`, '∣', 'faithful').text,
    '|'
  );
});

test('real KaTeX DOM: faithful matrices, cases, and bounds keep readable linear structure', () => {
  assert.equal(
    copyVisibleKaTeX(String.raw`\begin{bmatrix}a&b\\c&d\end{bmatrix}`, 'faithful').text,
    '[a, b; c, d]'
  );
  assert.equal(
    copyVisibleKaTeX(String.raw`\begin{cases}x^2&x>0\\-x&x\le0\end{cases}`, 'faithful').text,
    '{x² if x > 0; −x if x ≤ 0}'
  );
  assert.equal(copyVisibleKaTeX(String.raw`\sum_{i=1}^n i^2`, 'faithful').text, '∑ᵢ₌₁ⁿ i²');
  assert.equal(
    copyVisibleKaTeX(String.raw`\lim_{x\to0}\frac{\sin x}{x}`, 'faithful').text,
    'lim_(x → 0) (sin x)/x'
  );
  assert.equal(
    copyVisibleKaTeX(String.raw`\begin{aligned}x&=1\\y&=2\end{aligned}`, 'faithful').text,
    'x = 1; y = 2'
  );
  assert.equal(
    copyVisibleKaTeX(String.raw`\begin{gathered}x=1\\y=2\end{gathered}`, 'faithful').text,
    'x = 1; y = 2'
  );
});

test('faithful MathML keeps invisible products invisible unless operands would merge falsely', () => {
  const parse = (body) => new JSDOM(
    '<!doctype html><math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>' + body + '</mrow></math>'
  ).window.document.querySelector('math');
  assert.equal(cleanCopy.mathMLToFaithful(parse('<mi>x</mi><mo>⁢</mo><mi>y</mi>')), 'xy');
  assert.equal(cleanCopy.mathMLToFaithful(parse('<mn>2</mn><mo>⁢</mo><mn>3</mn>')), '2 ⋅ 3');
  assert.equal(
    cleanCopy.mathMLToFaithful(parse('<mi>speed</mi><mo>⁢</mo><mi>time</mi>')),
    'speed ⋅ time'
  );
});

function copyVisibleSubstring(source, substring, outputMode = 'calculator', occurrenceIndex = 0) {
  const rendered = katex.renderToString(source, {
    displayMode: true,
    output: 'htmlAndMathml',
    throwOnError: true
  });
  const instance = new JSDOM('<!doctype html><html><body><div id="fixture">' + rendered + '</div></body></html>');
  const visual = instance.window.document.querySelector('.katex-html');
  const walker = instance.window.document.createTreeWalker(visual, instance.window.NodeFilter.SHOW_TEXT);
  const nodes = [];
  let flattened = '';
  while (walker.nextNode()) {
    const value = walker.currentNode.nodeValue || '';
    nodes.push({ node: walker.currentNode, start: flattened.length, end: flattened.length + value.length });
    flattened += value;
  }
  let start = -1;
  let searchFrom = 0;
  for (let occurrence = 0; occurrence <= occurrenceIndex; occurrence += 1) {
    start = flattened.indexOf(substring, searchFrom);
    if (start < 0) break;
    searchFrom = start + Math.max(1, substring.length);
  }
  assert.notEqual(start, -1, 'substring must exist in KaTeX visual text');
  const end = start + substring.length;
  const first = nodes.find((item) => start >= item.start && start < item.end);
  const last = nodes.find((item) => end > item.start && end <= item.end);
  const range = instance.window.document.createRange();
  range.setStart(first.node, start - first.start);
  range.setEnd(last.node, end - last.start);
  const selection = instance.window.getSelection();
  selection.addRange(range);
  return cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    { ...cleanCopy.DEFAULT_SETTINGS, outputMode },
    instance.window,
    visual
  );
}

test('real KaTeX DOM: reconstructs the proportional square-root expression', () => {
  const payload = copyVisibleKaTeX(String.raw`r \propto \sqrt{\frac{m}{\lvert q \rvert}}`);
  assert.equal(payload.text, 'r ∝ sqrt(m/abs(q))');
  assert.equal(/\s$/.test(payload.text), false);
  assert.match(payload.html, /border-top:1px solid currentColor/);
});

test('real KaTeX DOM: reconstructs the nested numeric expression in executable order', () => {
  const payload = copyVisibleKaTeX(
    String.raw`r=\frac{1}{0.452}\sqrt{\frac{2(0.666\times10^{-25})(2464)}{1.602\times10^{-19}}}`
  );
  assert.equal(
    payload.text,
    'r=(1/0.452)*sqrt((2*(0.666*10^(-25))*(2464))/(1.602*10^(-19)))'
  );
  assert.equal(/[\s\u200b\u2060]$/.test(payload.text), false);
});

test('real KaTeX DOM: copies only the highlighted scientific-number subexpression', () => {
  const source = String.raw`m = 0.666 \times 10^{-25}\,\mathrm{kg}`;
  const payload = copyVisibleSubstring(source, '0.666×10−25');
  assert.equal(payload.text, '0.666*10^(-25)');
  assert.doesNotMatch(payload.text, /m=|kg/);
  assert.equal(/[\s\u200b\u2060]$/.test(payload.text), false);
  assert.match(payload.html, /<sup>/);
  assert.doesNotMatch(payload.html, /font-style\s*:\s*italic|<em|<strong/i);
});

test('real KaTeX DOM: preserves exponent semantics and exact one-token selections', () => {
  const numeric = String.raw`m = 0.666 \times 10^{-25}\,\mathrm{kg}`;
  assert.equal(copyVisibleSubstring(numeric, '10−25').text, '10^(-25)');
  assert.equal(copyVisibleSubstring(numeric, '666×10−25').text, '666*10^(-25)');
  assert.equal(copyVisibleSubstring(numeric, '10−2').text, '10^(-2)');
  assert.equal(copyVisibleSubstring(numeric, '0.66').text, '0.66');
  assert.equal(
    copyVisibleSubstring(String.raw`r \propto \sqrt{\frac{m}{\lvert q \rvert}}`, 'q').text,
    'q'
  );
  assert.equal(
    copyVisibleSubstring(String.raw`r \propto \sqrt{\frac{m}{\lvert q \rvert}}`, '∣').text,
    '|'
  );
});

test('real KaTeX DOM: keeps mixed prose-to-partial-math selections exact at the boundary', () => {
  const source = String.raw`m = 0.666 \times 10^{-25}\,\mathrm{kg}`;
  const rendered = katex.renderToString(source, { output: 'htmlAndMathml', throwOnError: true });
  const instance = new JSDOM('<!doctype html><html><body><p id="line">Before ' + rendered + ' after</p></body></html>');
  const line = instance.window.document.querySelector('#line');
  const visual = line.querySelector('.katex-html');
  const before = line.firstChild;
  const walker = instance.window.document.createTreeWalker(visual, instance.window.NodeFilter.SHOW_TEXT);
  const visualNodes = [];
  let flat = '';
  while (walker.nextNode()) {
    const value = walker.currentNode.nodeValue || '';
    visualNodes.push({ node: walker.currentNode, start: flat.length, end: flat.length + value.length });
    flat += value;
  }
  const selectedEnd = flat.indexOf('25') + 2;
  const last = visualNodes.find((item) => selectedEnd > item.start && selectedEnd <= item.end);
  const range = instance.window.document.createRange();
  range.setStart(before, 0);
  range.setEnd(last.node, selectedEnd - last.start);
  const selection = instance.window.getSelection();
  selection.addRange(range);
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    line
  );
  assert.equal(payload.text, 'Before m = 0.666 × 10⁻²⁵');
  assert.doesNotMatch(payload.text, /kg|after/);
});

test('real KaTeX DOM: a selected visual fraction is restored from denominator-first DOM order', () => {
  const payload = copyVisibleSubstring(String.raw`z+\frac{m}{q}+w`, 'qm');
  assert.equal(payload.text, '(m/q)');
  assert.match(payload.html, /border-top:1px solid currentColor/);
  assert.doesNotMatch(payload.text, /z|w/);
});

test('real KaTeX DOM: repeated-looking scripts resolve to the highlighted occurrence', () => {
  const source = String.raw`x_2+x^2`;
  assert.equal(copyVisibleSubstring(source, 'x2', 'calculator', 0).text, 'x_(2)');
  assert.equal(copyVisibleSubstring(source, 'x2', 'calculator', 1).text, 'x^(2)');
  assert.equal(copyVisibleSubstring(String.raw`a+\sqrt{x}+b`, 'x').text, 'x');
});

test('real KaTeX DOM: repeated scripts inside denominator-first fractions map to the visual occurrence', () => {
  const source = String.raw`\frac{x_1}{x^1}`;
  assert.equal(copyVisibleSubstring(source, 'x1', 'calculator', 0).text, 'x^(1)');
  assert.equal(copyVisibleSubstring(source, 'x1', 'calculator', 1).text, 'x_(1)');
});

test('real KaTeX DOM: selecting a whole radical keeps the root while selecting its text keeps only the radicand', () => {
  const rendered = katex.renderToString(String.raw`a+\sqrt{x}+b`, {
    displayMode: true,
    output: 'htmlAndMathml',
    throwOnError: true
  });
  const instance = new JSDOM('<!doctype html><html><body>' + rendered + '</body></html>');
  const visual = instance.window.document.querySelector('.katex-html');
  const radical = visual.querySelector('.sqrt');
  const range = instance.window.document.createRange();
  range.selectNode(radical);
  const selection = instance.window.getSelection();
  selection.addRange(range);
  const payload = cleanCopy.getCopyPayload(
    instance.window.document,
    selection,
    cleanCopy.DEFAULT_SETTINGS,
    instance.window,
    radical
  );
  assert.equal(payload.text, '√x');
  assert.equal(copyVisibleSubstring(String.raw`a+\sqrt{x}+b`, 'x').text, 'x');
});

test('real KaTeX DOM: completed radicals multiply adjacent factors and nested absolute values stay nested', () => {
  assert.equal(copyVisibleKaTeX(String.raw`\sqrt{x}y`).text, 'sqrt(x)*y');
  assert.equal(copyVisibleKaTeX(String.raw`2\sqrt{x}y`).text, '2*sqrt(x)*y');
  assert.equal(copyVisibleKaTeX(String.raw`\sqrt{x}\sqrt{y}`).text, 'sqrt(x)*sqrt(y)');
  assert.equal(copyVisibleKaTeX(String.raw`\sqrt{(x)+(y)}`).text, 'sqrt((x)+(y))');
  assert.equal(copyVisibleKaTeX(String.raw`\sqrt{(x)(y)}`).text, 'sqrt((x)*(y))');
  assert.equal(copyVisibleKaTeX(String.raw`\lvert x+\lvert y\rvert\rvert`).text, 'abs(x+abs(y))');
});

test('real KaTeX DOM: plain operators and scripted closing fences retain their structure', () => {
  assert.equal(copyVisibleKaTeX(String.raw`(x+1)^2`).text, '(x+1)^(2)');
  assert.equal(copyVisibleKaTeX(String.raw`a/b`).text, 'a/b');
  assert.equal(copyVisibleKaTeX(String.raw`\lvert x\rvert^2`).text, 'abs(x)^(2)');
  // Double vertical fences denote a norm; a following subscript indexes that
  // norm rather than becoming multiplication or an unmatched bar.
  assert.equal(copyVisibleKaTeX(String.raw`\lVert x\rVert_2`).text, 'norm(x)_(2)');
});

test('real KaTeX DOM: function application keeps arguments, powers, bases, and absolute values attached', () => {
  assert.equal(copyVisibleKaTeX(String.raw`\sin(x+y)`).text, 'sin(x+y)');
  assert.equal(copyVisibleKaTeX(String.raw`\sin x`).text, 'sin(x)');
  assert.equal(copyVisibleKaTeX(String.raw`\max(a,b)`).text, 'max(a,b)');
  assert.equal(copyVisibleKaTeX(String.raw`\cos^2(x)`).text, 'cos(x)^(2)');
  assert.equal(copyVisibleKaTeX(String.raw`\cos^2 x`).text, 'cos(x)^(2)');
  assert.equal(copyVisibleKaTeX(String.raw`\sin^{-1}x`).text, 'asin(x)');
  assert.equal(copyVisibleKaTeX(String.raw`\cosh^{-1}(x)`).text, 'acosh(x)');
  assert.equal(copyVisibleKaTeX(String.raw`\log_2(x)`).text, '(log(x)/log(2))');
  assert.equal(copyVisibleKaTeX(String.raw`\log_2 x`).text, '(log(x)/log(2))');
  assert.equal(copyVisibleKaTeX(String.raw`\sin\lvert x\rvert`).text, 'sin(abs(x))');
  assert.equal(copyVisibleKaTeX(String.raw`\sin^2\lvert x\rvert`).text, 'sin(abs(x))^(2)');
  assert.equal(copyVisibleKaTeX(String.raw`f(x)`).text, 'f(x)');
  assert.equal(copyVisibleKaTeX(String.raw`\operatorname{foo}(x)`).text, 'foo(x)');
  assert.equal(copyVisibleKaTeX(String.raw`\sin\cos x`).text, 'sin(cos(x))');
  assert.equal(copyVisibleKaTeX(String.raw`\sin\operatorname{foo} x`).text, 'sin(foo(x))');
  assert.equal(copyVisibleKaTeX(String.raw`x(y+1)`).text, 'x*(y+1)');
});

test('real KaTeX DOM: bounded sums, products, and integrals remain coherent calls', () => {
  assert.equal(copyVisibleKaTeX(String.raw`\sum_{i=1}^{n} i^2`).text, 'sum(i^(2),i,1,n)');
  assert.equal(copyVisibleKaTeX(String.raw`\prod_{k=1}^{n} k`).text, 'product(k,k,1,n)');
  assert.equal(copyVisibleKaTeX(String.raw`\int_0^1 x\,dx`).text, 'integral(x,x,0,1)');
  assert.equal(
    copyVisibleKaTeX(String.raw`\lim_{x\to0}\frac{\sin x}{x}`).text,
    'limit((sin(x)/x),x->0)'
  );
});

test('real KaTeX DOM: cases preserve value-condition row pairings', () => {
  const payload = copyVisibleKaTeX(
    String.raw`\begin{cases}x^2&x>0\\-x&x\le0\end{cases}`
  );
  assert.equal(payload.text, 'piecewise([x^(2),x>0],[-x,x<=0])');
  assert.equal(
    copyVisibleKaTeX(String.raw`2\begin{cases}x&x>0\\0&x\le0\end{cases}y`).text,
    '2*piecewise([x,x>0],[0,x<=0])*y'
  );
  assert.equal(
    copyVisibleKaTeX(
      String.raw`\begin{cases}\begin{cases}x&x>0\\0&x\le0\end{cases}&z>0\\-1&z\le0\end{cases}`
    ).text,
    'piecewise([piecewise([x,x>0],[0,x<=0]),z>0],[-1,z<=0])'
  );
});

test('real KaTeX DOM: an exact visible selection inside a radical does not widen to the radical', () => {
  const payload = copyVisibleSubstring(String.raw`z+\sqrt{a+b}+w`, 'a+b');
  assert.equal(payload.text, 'a+b');
  assert.doesNotMatch(payload.text, /sqrt|z|w/);
});

test('real KaTeX DOM: partial fences stay literal and relational bars never become absolute values', () => {
  const absolute = String.raw`\lvert q\rvert`;
  assert.equal(copyVisibleSubstring(absolute, 'q∣').text, 'q|');
  assert.equal(copyVisibleSubstring(absolute, '∣q').text, '|q');
  assert.equal(copyVisibleKaTeX(String.raw`a\mid b`).text, 'a | b');
  assert.equal(copyVisibleKaTeX(String.raw`P(A\mid B)`).text, 'P(A | B)');
  assert.equal(copyVisibleKaTeX(String.raw`\{x\mid x>0\}`).text, '{x | x>0}');
  assert.equal(copyVisibleKaTeX(String.raw`F(x)\big\rvert_0^1`).text, 'F(x)|_(0)^(1)');
  assert.equal(copyVisibleKaTeX(String.raw`\left.f(x)\right|_0^1`).text, 'f(x)|_(0)^(1)');
});

test('real KaTeX DOM: postfix factorial and percent remain attached while following factors multiply', () => {
  assert.equal(copyVisibleKaTeX(String.raw`n!x`).text, 'n!*x');
  assert.equal(copyVisibleKaTeX(String.raw`n!(x+1)`).text, 'n!*(x+1)');
  assert.equal(copyVisibleKaTeX(String.raw`50\%x`).text, '50/100*x');
});
