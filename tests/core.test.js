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

test('faithful mode preserves visual notation while making linear structure unambiguous', () => {
  assert.equal(cleanCopy.latexToFaithful(String.raw`(y')^2=20x'`), '(y′)² = 20x′');
  assert.equal(
    cleanCopy.latexToFaithful(String.raw`F_g=G\left(\frac{m_1m_2}{r^2}\right)`),
    'F_g = G((m₁m₂)/r²)'
  );
  assert.equal(
    cleanCopy.latexToFaithful(String.raw`r\propto\sqrt{\frac{m}{\lvert q\rvert}}`),
    'r ∝ √(m/|q|)'
  );
  assert.equal(cleanCopy.latexToFaithful(String.raw`\lVert x\rVert_2`), '‖x‖₂');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\frac{a+b}{c+d}`), '(a + b)/(c + d)');
  assert.equal(
    cleanCopy.latexToFaithful(String.raw`\frac{-b\pm\sqrt{b^2-4ac}}{2a}`),
    '(−b ± √(b² − 4ac))/(2a)'
  );
  assert.equal(cleanCopy.latexToFaithful(String.raw`\frac{\sin x}{x}`), '(sin x)/x');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\frac{1}{2}`), '1/2');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\sqrt{x}`), '√x');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\sqrt{x^2}`), '√(x²)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\sqrt{x'}`), '√(x′)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\sqrt{x_1}`), '√x₁');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\sqrt{x}y`), '√(x)y');
  assert.equal(cleanCopy.latexToFaithful(String.raw`y\sqrt{x}`), 'y√x');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\sqrt{x}\sqrt{y}`), '√x√y');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\frac1{\sqrt{x}y}`), '1/(√(x)y)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\frac1{y\sqrt{x}}`), '1/(y√x)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\frac1{\sqrt{x}\sqrt{y}}`), '1/(√x√y)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\sqrt{\lvert q\rvert}`), '√|q|');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\sqrt{xy}`), '√(xy)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\sqrt[3]{x}`), '∛x');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\sqrt[4]{x+1}`), '∜(x + 1)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`x^y+F_g+x_{out}`), 'x^y + F_g + xₒᵤₜ');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\Delta x=\alpha\times 2`), 'Δx = α × 2');
});

test('degree scripts stay degrees without changing the composition operator', () => {
  for (const source of [
    String.raw`180^\circ`,
    String.raw`180^{\circ}`,
    String.raw`180\sp\circ`
  ]) {
    assert.equal(cleanCopy.latexToFaithful(source), '180°', source);
    assert.equal(cleanCopy.latexToCalculator(source), '180*degrees', source);
  }
  for (const source of [String.raw`90^\degree`, String.raw`90^{\degree}`]) {
    assert.equal(cleanCopy.latexToFaithful(source), '90°', source);
    assert.equal(cleanCopy.latexToCalculator(source), '90*degrees', source);
  }
  assert.equal(cleanCopy.latexToFaithful(String.raw`f\circ g`), 'f∘g');
  assert.equal(cleanCopy.latexToFaithful(String.raw`x^{\circ+1}`), 'x^(∘+1)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`A_\circ`), 'A_∘');
  assert.equal(cleanCopy.latexToFaithful(String.raw`x^2`), 'x²');
});

test('faithful mode preserves invisible TeX group, denominator, function, and script scope', () => {
  const cases = new Map([
    [String.raw`\frac1{abcd}`, '1/(abcd)'],
    [String.raw`\frac1{2ab}`, '1/(2ab)'],
    [String.raw`\frac1{2(a+b)}`, '1/(2(a + b))'],
    [String.raw`\frac1{\sin x}`, '1/(sin x)'],
    [String.raw`{a+b}^2`, '(a + b)²'],
    [String.raw`{ab}^2`, '(ab)²'],
    [String.raw`{\frac ab}^2`, '(a/b)²'],
    [String.raw`{ab}_i`, '(ab)ᵢ'],
    [String.raw`\sqrt{x}^2`, '(√x)²'],
    [String.raw`2{a+b}`, '2(a + b)'],
    [String.raw`{a+b}c`, '(a + b)c'],
    [String.raw`{a+b}!`, '(a + b)!'],
    [String.raw`-{a+b}`, '−(a + b)'],
    [String.raw`\sin{x+y}`, 'sin(x + y)'],
    [String.raw`\exp{x+1}`, 'exp(x + 1)'],
    [String.raw`\sin{x}`, 'sin x']
  ]);
  for (const [source, expected] of cases) assert.equal(cleanCopy.latexToFaithful(source), expected, source);
});

test('faithful mode protects prose punctuation, relations, accents, and authored private-use text', () => {
  assert.equal(cleanCopy.latexToFaithful(String.raw`\text{time-dependent; don't}`), "time-dependent; don't");
  assert.equal(cleanCopy.latexToFaithful(String.raw`a\parallel b`), 'a ∥ b');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\lVert x\rVert`), '‖x‖');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\overline{a+b}`), 'overline(a + b)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\vec{a+b}`), 'vec(a + b)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\hat{xy}`), 'hat(xy)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\hat{x}`), 'x̂');
  assert.equal(cleanCopy.latexToFaithful(String.raw`x_{\beta}`), 'xᵦ');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\phi,\varphi,\epsilon,\varepsilon`), 'ϕ, φ, ϵ, ε');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\acute x`), 'x́');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\grave x`), 'x̀');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\breve x`), 'x̆');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\check x`), 'x̌');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\mathring x`), 'x̊');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\underline x`), 'x̲');
  for (let codePoint = 0xe10a; codePoint <= 0xe10f; codePoint += 1) {
    const authored = String.fromCodePoint(codePoint);
    assert.equal(cleanCopy.latexToFaithful('x' + authored + 'y'), 'x' + authored + 'y');
  }
});

test('raw TeX symbols follow canonical TeX and KaTeX glyph conventions', () => {
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
  for (const [source, expected] of cases) assert.equal(cleanCopy.latexToFaithful(source), expected, source);
  assert.equal(cleanCopy.latexToFaithful(String.raw`a\bullet b`), 'a ∙ b');
  assert.equal(cleanCopy.latexToFaithful(String.raw`A\smallsetminus B`), 'A ∖ B');
});

test('faithful mode preserves explicit mathematical alphabets with readable fallbacks', () => {
  const cases = new Map([
    [String.raw`\mathbf{ABCxyz123}`, '𝐀𝐁𝐂𝐱𝐲𝐳𝟏𝟐𝟑'],
    [String.raw`\boldsymbol{x}`, '𝒙'],
    [String.raw`\mathbf{\alpha}`, '𝛂'],
    [String.raw`\boldsymbol{\alpha}`, '𝜶'],
    [String.raw`\mathit{h}`, 'ℎ'],
    [String.raw`\mathcal{BEgo}`, 'ℬℰℊℴ'],
    [String.raw`\mathscr{x}`, '𝓍'],
    [String.raw`\mathfrak{CHIRZxyz}`, 'ℭℌℑℜℨ𝔵𝔶𝔷'],
    [String.raw`\mathsf{Ab9}`, '𝖠𝖻𝟫'],
    [String.raw`\mathtt{Ab9}`, '𝙰𝚋𝟿'],
    [String.raw`\mathbb{CHNPQRZx9}`, 'ℂℍℕℙℚℝℤ𝕩𝟡'],
    [String.raw`\mathcal{\alpha}`, 'mathcal(α)'],
    [String.raw`\mathbf{x+1}`, '𝐱 + 𝟏'],
    [String.raw`\mathcal{F+G}`, 'ℱ + 𝒢'],
    [String.raw`\boldsymbol{\alpha+\Gamma}`, '𝜶 + 𝜞'],
    [String.raw`\mathcal{F+\alpha+G}`, 'ℱ + mathcal(α) + 𝒢']
  ]);
  for (const [source, expected] of cases) assert.equal(cleanCopy.latexToFaithful(source), expected, source);
});

test('faithful mode retains cancellation, boxes, and prescript structure', () => {
  assert.equal(cleanCopy.latexToFaithful(String.raw`\cancel{x}`), 'cancel(x)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\bcancel{x}`), 'bcancel(x)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\xcancel{x}`), 'xcancel(x)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\cancelto{0}{x}`), 'cancelto(0, x)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\boxed{x}`), 'boxed(x)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\prescript{14}{6}{C}`), '¹⁴₆C');
  assert.equal(cleanCopy.latexToFaithful(String.raw`{}^{14}_{6}C`), '¹⁴₆C');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\binom{n}{k}`), 'C(n, k)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\dbinom{n}{k}`), 'C(n, k)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\tbinom{n}{k}`), 'C(n, k)');
});

test('faithful mode consumes layout dimensions and distinguishes annotations from scripts', () => {
  for (const source of [
    String.raw`x\kern1em y`, String.raw`x\kern-0.2em y`, String.raw`x\kern{1em}y`,
    String.raw`x\mkern3mu y`, String.raw`x\hskip 1em y`, String.raw`x\mskip3mu y`,
    String.raw`x\space y`
  ]) {
    assert.equal(cleanCopy.latexToFaithful(source), 'x y', source);
  }
  assert.equal(cleanCopy.latexToFaithful(String.raw`\overset{!}{=}`), 'overset(!, =)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\stackrel{!}{=}`), 'overset(!, =)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\underset{i}{x}`), 'underset(i, x)');
  assert.equal(
    cleanCopy.latexToFaithful(String.raw`A\underset{f}{\longrightarrow}B`),
    'A underset(f, ⟶) B'
  );
  assert.equal(cleanCopy.latexToFaithful(String.raw`\overset{n}{\sum}`), '∑ⁿ');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\underset{i=1}{\sum}`), '∑ᵢ₌₁');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\int^\infty`), '∫^∞');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\vec v`), 'v⃗');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\bar x`), 'x̅');
});

test('faithful mode retains functions, aggregates, cases, matrices, and authored multiplication', () => {
  assert.equal(cleanCopy.latexToFaithful(String.raw`\sin\lvert x\rvert`), 'sin |x|');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\sin^2(x)`), 'sin²(x)');
  assert.equal(cleanCopy.latexToFaithful(String.raw`\sum_{i=1}^n i^2`), '∑ᵢ₌₁ⁿ i²');
  assert.equal(
    cleanCopy.latexToFaithful(String.raw`\lim_{x\to0}\frac{\sin x}{x}`),
    'lim_(x → 0) (sin x)/x'
  );
  assert.equal(
    cleanCopy.latexToFaithful(String.raw`\begin{cases}x^2&x>0\\-x&x\le0\end{cases}`),
    '{x² if x > 0; −x if x ≤ 0}'
  );
  assert.equal(
    cleanCopy.latexToFaithful(String.raw`\begin{bmatrix}a&b\\c&d\end{bmatrix}`),
    '[a, b; c, d]'
  );
  assert.equal(
    cleanCopy.latexToFaithful(String.raw`\begin{aligned}x&=1\\[3mu]y&=2\end{aligned}`),
    'x = 1; y = 2'
  );
  assert.equal(
    cleanCopy.latexToFaithful(String.raw`\begin{alignedat}{3}x_1&=1&&=2\\x_2&=3&&=4\end{alignedat}`),
    'x₁ = 1 = 2; x₂ = 3 = 4'
  );
  assert.equal(
    cleanCopy.latexToFaithful(String.raw`\begin{aligned}x&=1,\\y&=2.\end{aligned}`),
    'x = 1, y = 2.'
  );
  assert.equal(
    cleanCopy.latexToFaithful(String.raw`\frac{b^2-4ac}{4a^2}`),
    '(b² − 4ac)/(4a²)'
  );
  assert.equal(cleanCopy.latexToFaithful(String.raw`m_1\,m_2`), 'm₁ m₂');
  assert.equal(cleanCopy.latexToFaithful(String.raw`m_1\cdot m_2`), 'm₁ ⋅ m₂');
  assert.equal(cleanCopy.latexToFaithful(String.raw`m_1*m_2`), 'm₁*m₂');
  assert.equal(/\s$/u.test(cleanCopy.latexToFaithful(String.raw`x^2\quad`)), false);
});

test('faithful delimited conversion is separate from unchanged calculator conversion', () => {
  assert.deepEqual(
    cleanCopy.convertDelimitedLatexText(String.raw`Use $F_g=G\left(\frac{m_1m_2}{r^2}\right)$.`, 'faithful'),
    { text: 'Use F_g = G((m₁m₂)/r²).', converted: 1 }
  );
  const source = String.raw`r=\frac{1}{0.452}\sqrt{\frac{2(0.666\times10^{-25})(2464)}{1.602\times10^{-19}}}`;
  assert.equal(
    cleanCopy.latexToCalculator(source),
    'r=(1/0.452)*sqrt((2*(0.666*10^(-25))*(2464))/(1.602*10^(-19)))'
  );
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
    'faithful'
  );
  assert.equal(result.converted, 1);
  assert.equal(result.text, 'Costs $5 and formula x² + 1; another costs $10.');
  for (const source of ['$5 + $10 = $15', '$5 - $3 = $2', '$5 × 2 = $10']) {
    assert.deepEqual(cleanCopy.convertDelimitedLatexText(source, 'faithful'), { text: source, converted: 0 });
  }
  assert.deepEqual(
    cleanCopy.convertDelimitedLatexText('$5 + 3$ is a numeric formula.', 'faithful'),
    { text: '5 + 3 is a numeric formula.', converted: 1 }
  );
});

test('preserves delimiters when a LaTeX construct has no visible output', () => {
  for (const source of [String.raw`$\quad$`, String.raw`$\phantom{x}$`, String.raw`\(\displaystyle\)`]) {
    assert.deepEqual(cleanCopy.convertDelimitedLatexText(source, 'calculator'), { text: source, converted: 0 });
  }
});

test('supports display delimiters and original LaTeX mode', () => {
  assert.deepEqual(
    cleanCopy.convertDelimitedLatexText(String.raw`Use \[\alpha \leq \beta\].`, 'faithful'),
    { text: 'Use α ≤ β.', converted: 1 }
  );
  assert.deepEqual(
    cleanCopy.convertDelimitedLatexText(String.raw`Use \(x^2\).`, 'latex'),
    { text: 'Use $x^2$.', converted: 1 }
  );
  assert.deepEqual(
    cleanCopy.convertDelimitedLatexText(String.raw`Angle $180^\circ$.`, 'latex'),
    { text: String.raw`Angle $180^\circ$.`, converted: 1 }
  );
});

test('produces calculator-safe syntax with explicit multiplication and scientific powers', () => {
  const source = String.raw`r=\frac{1}{0.452}\sqrt{\frac{2(0.666\times10^{-25})(2464)}{1.602\times10^{-19}}}`;
  assert.equal(
    cleanCopy.latexToCalculator(source),
    'r=(1/0.452)*sqrt((2*(0.666*10^(-25))*(2464))/(1.602*10^(-19)))'
  );
  assert.equal(cleanCopy.latexToCalculator(String.raw`r\propto\sqrt{\frac{m}{\lvert q\rvert}}`), 'r ∝ sqrt(m/abs(q))');
  assert.equal(
    cleanCopy.latexToCalculator(String.raw`10^{-43}\frac{\text{meter}^{-2}}{\text J/\text{meter}^3}`),
    '10^(-43)*((meter^(-2))/(J/meter^(3)))'
  );
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

test('shares budgets across nested LaTeX environments and nested function parsers', () => {
  const nestedEnvironment = String.raw`\begin{x}`.repeat(1000) + 'a' + String.raw`\end{x}`.repeat(1000);
  for (const converter of [
    cleanCopy.latexToFaithful,
    cleanCopy.latexToCalculator,
    cleanCopy.latexToUnicode
  ]) {
    let result;
    assert.doesNotThrow(() => { result = converter(nestedEnvironment); });
    assert.equal(result, '');
  }

  const nestedFunction = String.raw`\sin(`.repeat(1000) + 'x' + ')'.repeat(1000);
  let functionResult;
  assert.doesNotThrow(() => { functionResult = cleanCopy.latexToCalculator(nestedFunction); });
  assert.equal(functionResult, '');

  const hostileSource = { toString() { throw new Error('page getter failed'); } };
  assert.equal(cleanCopy.latexToFaithful(hostileSource), '');
  assert.equal(cleanCopy.latexToCalculator(hostileSource), '');
  assert.equal(cleanCopy.latexToUnicode(hostileSource), '');
});

test('bounds hidden or direct LaTeX source length before parsing', () => {
  const oversized = String.raw`\text{` + 'x'.repeat(50001) + '}';
  assert.equal(cleanCopy.latexToFaithful(oversized), '');
  assert.equal(cleanCopy.latexToCalculator(oversized), '');
  assert.equal(cleanCopy.latexToUnicode(oversized), '');
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
  assert.equal(cleanCopy.cleanClipboardText('A\u00a0B\u200bC\u00adD\u2060\u0000\r\n' + family), 'A BCD\n' + family);
  assert.equal(cleanCopy.hasCleanableArtifacts('plain text'), false);
  assert.equal(cleanCopy.hasCleanableArtifacts('zero\u200bwidth'), true);
  assert.equal(cleanCopy.hasCleanableArtifacts('legacy\u0000glyph'), true);
});

test('normalizes invalid settings safely', () => {
  assert.deepEqual(cleanCopy.normalizeSettings({ outputMode: 'native' }), { outputMode: 'native' });
  assert.deepEqual(cleanCopy.normalizeSettings({ outputMode: 'bogus' }), { outputMode: 'faithful' });
  assert.deepEqual(cleanCopy.normalizeSettings({
    outputMode: 'ascii',
    convertDelimitedLatex: false,
    cleanInvisibleArtifacts: false
  }), { outputMode: 'faithful' });
});
