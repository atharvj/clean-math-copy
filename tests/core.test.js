'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const cleanCopy = require('../clean-math-copy.user.js');

test('converts common LaTeX structures into readable Unicode math', () => {
  assert.equal(
    cleanCopy.latexToUnicode(String.raw`\frac{-b \pm \sqrt{b^2-4ac}}{2a}`),
    '(-b ± √(b² - 4ac))/(2a)'
  );
  assert.equal(cleanCopy.latexToUnicode(String.raw`\sum_{i=1}^{n} i^2`), '∑ᵢ₌₁ⁿ i²');
  assert.equal(cleanCopy.latexToUnicode(String.raw`\mathbb{R} \subseteq \mathbb{C}`), 'ℝ ⊆ ℂ');
  assert.equal(cleanCopy.latexToUnicode(String.raw`\left\langle x, y \right\rangle`), '⟨x, y⟩');
  assert.equal(cleanCopy.latexToUnicode(String.raw`\operatorname*{arg\,max}_{x \in \mathbb{R}}`), 'arg max_(x ∈ ℝ)');
});

test('linearizes matrices, cases, text, accents, and indexed roots without stray lines', () => {
  assert.equal(
    cleanCopy.latexToUnicode(String.raw`\begin{bmatrix}a&b\\c&d\end{bmatrix}`),
    '[a, b; c, d]'
  );
  assert.equal(
    cleanCopy.latexToUnicode(String.raw`\begin{cases}x^2 & \text{if } x>0\\0 & \text{otherwise}\end{cases}`),
    '{x² if x > 0; 0 otherwise}'
  );
  assert.equal(cleanCopy.latexToUnicode(String.raw`\sqrt[3]{x} + \vec{v}`), '³√(x) + v⃗');
});

test('preserves unknown LaTeX commands instead of silently deleting content', () => {
  assert.equal(cleanCopy.latexToUnicode(String.raw`x + \custommacro{value}`), 'x + \\custommacro(value)');
});

test('converts delimited LaTeX but does not mistake currency for math', () => {
  const result = cleanCopy.convertDelimitedLatexText(
    String.raw`Costs $5 and formula $x^2 + 1$; another costs $10.`,
    'unicode'
  );
  assert.equal(result.converted, 1);
  assert.equal(result.text, 'Costs $5 and formula x² + 1; another costs $10.');
});

test('preserves delimiters when a LaTeX construct has no visible output', () => {
  for (const source of [String.raw`$\quad$`, String.raw`$\phantom{x}$`, String.raw`\(\displaystyle\)`]) {
    assert.deepEqual(cleanCopy.convertDelimitedLatexText(source, 'calculator'), { text: source, converted: 0 });
  }
});

test('supports display delimiters, original LaTeX mode, and ASCII mode', () => {
  assert.deepEqual(
    cleanCopy.convertDelimitedLatexText(String.raw`Use \[\alpha \leq \beta\].`, 'unicode'),
    { text: 'Use α ≤ β.', converted: 1 }
  );
  assert.deepEqual(
    cleanCopy.convertDelimitedLatexText(String.raw`Use \(x^2\).`, 'latex'),
    { text: 'Use $x^2$.', converted: 1 }
  );
  assert.equal(cleanCopy.unicodeToAscii('α ≤ β → ∞'), 'alpha <= beta -> infinity');
});

test('produces calculator-safe syntax with explicit multiplication and scientific powers', () => {
  const source = String.raw`r=\frac{1}{0.452}\sqrt{\frac{2(0.666\times10^{-25})(2464)}{1.602\times10^{-19}}}`;
  assert.equal(
    cleanCopy.latexToCalculator(source),
    'r=(1/0.452)*sqrt((2*(0.666*10^(-25))*(2464))/(1.602*10^(-19)))'
  );
  assert.equal(cleanCopy.latexToCalculator(String.raw`r\propto\sqrt{\frac{m}{\lvert q\rvert}}`), 'r ∝ sqrt(m/abs(q))');
});

test('keeps raw LaTeX grouping, nesting, functions, and token boundaries executable', () => {
  assert.equal(cleanCopy.latexToCalculator(String.raw`\frac{a+b}{c+d}`), '(a+b)/(c+d)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\lvert x+\lvert y\rvert\rvert`), 'abs(x+abs(y))');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\left|x+\left|y\right|\right|`), 'abs(x+abs(y))');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sqrt[3]{x}`), '(x)^(1/(3))');
  assert.equal(cleanCopy.latexToCalculator(String.raw`2\sqrt[3]{x}`), '2*(x)^(1/(3))');
  assert.equal(cleanCopy.latexToCalculator(String.raw`x y`), 'x*y');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\alpha x`), 'alpha*x');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\alpha\beta`), 'alpha*beta');
  assert.equal(cleanCopy.latexToCalculator(String.raw`2\pi r`), '2*pi*r');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin x`), 'sin(x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`2\sin x`), '2*sin(x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin x y`), 'sin(x)*y');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\exp x`), 'exp(x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\binom{n}{k}`), 'C(n,k)');
});

test('parses TeX function spacing, powers, arguments, and logarithm bases with correct precedence', () => {
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin\!x`), 'sin(x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin\,x`), 'sin(x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin\quad x`), 'sin(x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin\hspace{1em}x`), 'sin(x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin^2 x`), 'sin(x)^(2)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin x^2`), 'sin(x^(2))');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin^2(x)`), 'sin(x)^(2)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\log_2 x`), 'log(x)/log(2)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\operatorname{sin} x`), 'sin(x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\operatorname{sin}^2 x`), 'sin(x)^(2)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin -x`), 'sin(-x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin\sqrt{x}`), 'sin(sqrt(x))');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin\cos x`), 'sin(cos(x))');
});

test('preserves compound fraction and braced-base precedence', () => {
  assert.equal(cleanCopy.latexToCalculator(String.raw`\frac{ab}{cd}`), '(a*b)/(c*d)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\frac{2x}{3y}`), '(2*x)/(3*y)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`8/\frac{2+2}{1+1}`), '8/((2+2)/(1+1))');
  assert.equal(cleanCopy.latexToCalculator(String.raw`{2+3}^2`), '(2+3)^(2)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`{ab}^2`), '(a*b)^(2)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\mathbf{x+y}^2`), '(x+y)^(2)');
  const executable = cleanCopy.latexToCalculator(String.raw`8/\frac{2+2}{1+1}`).replace(/\^/g, '**');
  assert.equal(Function('return ' + executable)(), 4);
});

test('parses function fences, declared operators, postfix factors, and double-bar norms', () => {
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin\lvert x\rvert`), 'sin(abs(x))');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin\left|x\right|`), 'sin(abs(x))');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\cos[x+y]`), 'cos(x+y)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\exp\left[-x\right]`), 'exp(-x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\max\{a,b\}`), 'max(a,b)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\min\left\{x,y\right\}`), 'min(x,y)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin^2\left(x\right)`), 'sin(x)^(2)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\log_2\bigl(x\bigr)`), 'log(x)/log(2)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\operatorname{erf} x`), 'erf(x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\operatorname{foo}(x)`), 'foo(x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`2\operatorname{foo}(x)`), '2*foo(x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`n!x`), 'n!*x');
  assert.equal(cleanCopy.latexToCalculator(String.raw`n!(x+1)`), 'n!*(x+1)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`n!\sin x`), 'n!*sin(x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`50\%x`), '50/100*x');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\lVert x\rVert`), 'abs(x)');
});

test('preserves styled identifiers, conventional functions, inverse trig, and calculator-safe cases', () => {
  assert.equal(
    cleanCopy.latexToCalculator(String.raw`\mathrm{speed}=2\mathrm{time}`),
    'speed=2*time'
  );
  assert.equal(cleanCopy.latexToCalculator(String.raw`2\mathrm{kg}`), '2*kg');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\mathrm{kg}x`), 'kg*x');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\mathrm{speed}\mathrm{time}`), 'speed*time');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\mathrm{x}_1`), 'x_(1)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`f(x)`), 'f(x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`x(y+1)`), 'x*(y+1)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sin^{-1}x`), 'asin(x)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`(\sin x)^{-1}`), '(sin(x))^(-1)');
  assert.equal(
    cleanCopy.latexToCalculator(String.raw`\begin{cases}x&x>0\\0&x\le0\end{cases}`),
    'piecewise([x,x>0],[0,x<=0])'
  );
  assert.equal(
    cleanCopy.latexToCalculator(
      String.raw`\begin{cases}\begin{cases}x&x>0\\0&x\le0\end{cases}&z>0\\-1&z\le0\end{cases}`
    ),
    'piecewise([piecewise([x,x>0],[0,x<=0]),z>0],[-1,z<=0])'
  );
  const literalPrivateUse = String.fromCodePoint(0xf0000);
  assert.equal(
    cleanCopy.latexToCalculator(String.raw`\mathrm{kg}` + literalPrivateUse),
    'kg*' + literalPrivateUse
  );
});

test('keeps set relations and aggregate bounds as coherent calculator tokens', () => {
  assert.equal(cleanCopy.latexToCalculator(String.raw`a\mid b\mid c`), 'a divides b divides c');
  assert.equal(cleanCopy.latexToCalculator(String.raw`x\in A`), 'x in A');
  assert.equal(cleanCopy.latexToCalculator(String.raw`x\notin A`), 'x not in A');
  assert.equal(cleanCopy.latexToCalculator(String.raw`A\subseteq B`), 'A subseteq B');
  assert.equal(cleanCopy.latexToCalculator(String.raw`A\cup B`), 'A union B');
  assert.equal(cleanCopy.latexToCalculator(String.raw`A\cap B`), 'A intersection B');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\neg p`), '!p');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\forall x\in A`), 'for all x in A');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\sum_{i=1}^n i^2`), 'sum(i^(2),i=1,n)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\prod_{i=1}^n i`), 'product(i,i=1,n)');
  assert.equal(cleanCopy.latexToCalculator(String.raw`\int_0^1 x^2\,dx`), 'integral(x^(2),x,0,1)');
  assert.equal(
    cleanCopy.latexToCalculator(String.raw`\lim_{x\to0}\frac{\sin x}{x}`),
    'limit((sin(x)/x),x->0)'
  );
});

test('bounds adversarial LaTeX nesting and preserves the original delimited source', () => {
  const source = '$' + String.raw`\sin`.repeat(2000) + ' x$';
  assert.deepEqual(cleanCopy.convertDelimitedLatexText(source, 'calculator'), { text: source, converted: 0 });
});

test('normalizes nested Unicode absolute values without leaking Markdown emphasis', () => {
  assert.equal(cleanCopy.unicodeToCalculator('∣**q**∣'), 'abs(q)');
  assert.equal(cleanCopy.unicodeToCalculator('|x+|y||'), 'abs(x+abs(y))');
  assert.equal(cleanCopy.unicodeToCalculator('2|x|'), '2*abs(x)');
  assert.equal(cleanCopy.unicodeToCalculator('|x||y|'), 'abs(x)*abs(y)');
  assert.equal(cleanCopy.unicodeToCalculator('αβ'), 'alpha*beta');
  assert.equal(cleanCopy.unicodeToCalculator('sin x'), 'sin(x)');
  assert.equal(cleanCopy.unicodeToCalculator('Ω'), 'Omega');
  assert.equal(cleanCopy.unicodeToCalculator('Γ + Δ = Ω'), 'Gamma+Delta=Omega');
  assert.equal(cleanCopy.unicodeToCalculator('∛8'), '(8)^(1/(3))');
  assert.equal(cleanCopy.unicodeToCalculator('∜16'), '(16)^(1/(4))');
  assert.equal(cleanCopy.unicodeToCalculator('³√x'), '(x)^(1/(3))');
  assert.equal(cleanCopy.unicodeToCalculator('√|q|'), 'sqrt(abs(q))');
  assert.equal(cleanCopy.unicodeToCalculator('sin √x'), 'sin(sqrt(x))');
  assert.equal(cleanCopy.unicodeToCalculator('A | B | C'), 'A | B | C');
});

test('standalone Unicode classification distinguishes formulas from comparative prose', () => {
  assert.equal(cleanCopy.looksLikeStandaloneUnicodeMath('Plan A ≠ Plan B'), false);
  assert.equal(cleanCopy.looksLikeStandaloneUnicodeMath('Temperature ≥ room temperature'), false);
  assert.equal(cleanCopy.looksLikeStandaloneUnicodeMath('speed = 2 × time'), true);
  assert.equal(cleanCopy.looksLikeStandaloneUnicodeMath('initial_velocity ∝ final_velocity²'), true);
  assert.equal(cleanCopy.looksLikeStandaloneUnicodeMath('x ≥ 0'), true);
});

test('cleans copy artifacts without breaking emoji joiners or intentional newlines', () => {
  const family = '👨‍👩‍👧‍👦';
  assert.equal(cleanCopy.cleanClipboardText('A\u00a0B\u200bC\u00adD\u2060\r\n' + family), 'A BCD\n' + family);
  assert.equal(cleanCopy.hasCleanableArtifacts('plain text'), false);
  assert.equal(cleanCopy.hasCleanableArtifacts('zero\u200bwidth'), true);
});

test('normalizes invalid settings safely', () => {
  assert.deepEqual(cleanCopy.normalizeSettings({ outputMode: 'bogus' }), {
    outputMode: 'calculator',
    convertDelimitedLatex: true,
    cleanInvisibleArtifacts: true
  });
});
