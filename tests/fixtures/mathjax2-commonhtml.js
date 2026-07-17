'use strict';

// Sanitized from the real DOM emitted by the official mathjax@2.7.9 npm
// package with the TeX-AMS_CHTML-full configuration. Irrelevant measurement
// styles and internal ids were removed; the alignment filler and explicit
// mspace fixtures intentionally retain representative official ids/styles
// because those attributes are part of their narrow parser grammar. The
// output-frame/script id pair remains MathJax 2's authoritative source
// association. Element nesting, class names, glyph text, and sibling order
// are retained exactly.

// Exact relevant rules from MathJax 2.7.9 CommonHTML's generated stylesheet.
// In particular, glyphs are blocks inside inline math. Keeping these rules in
// the fixture prevents JSDOM's default all-inline layout from making raw
// textContent look safer than it is in a live browser.
const commonHtmlCss = [
  '.mjx-chtml{display:inline-block;line-height:0;white-space:nowrap}',
  '.mjx-math{display:inline-block;border-collapse:separate;border-spacing:0}',
  '.mjx-math *{display:inline-block;box-sizing:content-box!important;text-align:left}',
  '.mjx-stack{display:inline-block}',
  '.mjx-op{display:block}',
  '.mjx-over{display:block}',
  '.mjx-stack>.mjx-sup,.mjx-stack>.mjx-sub{display:block}',
  '.mjx-char{display:block;white-space:pre}',
  '.MJX_Assistive_MathML{position:absolute;top:0;left:0;clip:rect(1px,1px,1px,1px);padding:1px 0 0 0;border:0;height:1px;width:1px;overflow:hidden;display:block;user-select:none}',
  '.MJX_Assistive_MathML_Block{width:100%!important}'
].join('');

const mathItalic = (value) =>
  '<span class="mjx-mi"><span class="mjx-char MJXc-TeX-math-I">' + value + '</span></span>';

const number = (value) =>
  '<span class="mjx-mn"><span class="mjx-char MJXc-TeX-main-R">' + value + '</span></span>';

const operator = (value, spacing = '') =>
  '<span class="mjx-mo' + spacing + '"><span class="mjx-char MJXc-TeX-main-R">' + value + '</span></span>';

const row = (value) => '<span class="mjx-mrow">' + value + '</span>';

const vector = (value = 'V') => [
  '<span class="mjx-texatom">',
  row([
    '<span class="mjx-munderover"><span class="mjx-stack">',
    '<span class="mjx-over">',
    '<span class="mjx-mo"><span class="mjx-char MJXc-TeX-vec-R">→</span></span>',
    '</span>',
    '<span class="mjx-op">', mathItalic(value), '</span>',
    '</span></span>'
  ].join('')),
  '</span>'
].join('');

const subscript = (base, sub, spacing = '') => [
  '<span class="mjx-msubsup' + spacing + '">',
  '<span class="mjx-base">', base, '</span>',
  '<span class="mjx-sub">', mathItalic(sub), '</span>',
  '</span>'
].join('');

const superscript = (base, sup, spacing = '') => [
  '<span class="mjx-msubsup' + spacing + '">',
  '<span class="mjx-base">', base, '</span>',
  '<span class="mjx-sup">', number(sup), '</span>',
  '</span>'
].join('');

const texAtom = (value) => '<span class="mjx-texatom">' + value + '</span>';

// Official MathJax 2 CommonHTML paints U+2061 FUNCTION APPLICATION as an
// empty mo/char box. It is semantic layout scaffolding: textContent contains
// no character even though AssistiveMML retains U+2061.
const invisibleFunctionApplication = () =>
  '<span class="mjx-mo"><span class="mjx-char"></span></span>';

const functionIdentifier = (value, spacing = ' MJXc-space1') =>
  '<span class="mjx-mi' + spacing + '"><span class="mjx-char MJXc-TeX-main-R">' +
  value + '</span></span>';

const fontIdentifier = (value, font, spacing = '') =>
  '<span class="mjx-mi' + spacing + '"><span class="mjx-char MJXc-TeX-' + font + '">' +
  value + '</span></span>';

const compositeSubscript = (base, script, spacing = '') => [
  '<span class="mjx-msubsup' + spacing + '">',
  '<span class="mjx-base">', base, '</span>',
  '<span class="mjx-sub">', script, '</span>',
  '</span>'
].join('');

// Exact structural classes and child order emitted by mathjax@2.7.9 for a
// stacked CommonHTML fraction. Styles and measurement-only nodes are reduced
// to the two empty renderer roles that affect parser traversal.
const fraction = (numerator, denominator, spacing = '') => [
  '<span class="mjx-mfrac' + spacing + '">',
  '<span class="mjx-box MJXc-stacked">',
  '<span class="mjx-numerator">', numerator, '</span>',
  '<span class="mjx-denominator">', denominator, '</span>',
  '<span class="mjx-line"></span>',
  '</span>',
  '<span class="mjx-vsize"></span>',
  '</span>'
].join('');

const explicitSpace = (id = 'MJXc-Node-135') =>
  '<span id="' + id + '" class="mjx-mspace" ' +
  'style="font-size: 141.4%; width: 0.167em; height: 0px;"></span>';

const alignedTable = (rows) => [
  '<span class="mjx-mtable"><span class="mjx-itable">',
  rows.map((cells, rowIndex) => [
    '<span class="mjx-mtr">',
    '<span class="mjx-mtd" style="width: 0px; padding: 0px; text-align: right;">',
    row(cells[0] + '<span class="mjx-strut"></span>'),
    '</span>',
    '<span class="mjx-mtd" style="width: 0px; padding: 0px; text-align: left;">',
    row('<span id="MJXc-Node-' + (51 + rowIndex * 12) + '" class="mjx-mi"></span>' +
      cells[1] + '<span class="mjx-strut"></span>'),
    '</span>',
    '</span>'
  ].join('')).join(''),
  '</span></span>'
].join('');

const commonHtmlRoot = (contents, sourceId) => [
  '<span id="', sourceId, '-Frame" class="mjx-chtml MathJax_CHTML">',
  '<span class="mjx-math">', row(contents), '</span>',
  '</span>'
].join('');

const roots = Object.freeze({
  leaf: commonHtmlRoot(mathItalic('V'), 'MathJax-Element-1'),
  subscript: commonHtmlRoot(subscript(mathItalic('V'), 'C'), 'MathJax-Element-2'),
  subscriptL: commonHtmlRoot(subscript(mathItalic('V'), 'L'), 'MathJax-Element-6'),
  subscriptR: commonHtmlRoot(subscript(mathItalic('V'), 'R'), 'MathJax-Element-7'),
  vector: commonHtmlRoot(vector(), 'MathJax-Element-3'),
  equation: commonHtmlRoot([
    vector(),
    operator('=', ' MJXc-space3'),
    subscript(vector(), 'R', ' MJXc-space3'),
    operator('+', ' MJXc-space2'),
    operator('(', ' MJXc-space2'),
    subscript(vector(), 'L'),
    operator('+', ' MJXc-space2'),
    subscript(vector(), 'C', ' MJXc-space2'),
    operator(')')
  ].join(''), 'MathJax-Element-4'),
  degree: commonHtmlRoot([
    '<span class="mjx-msubsup"><span class="mjx-base">', number('180'), '</span>',
    '<span class="mjx-sup">', operator('∘'), '</span></span>'
  ].join(''), 'MathJax-Element-5'),
  sum: commonHtmlRoot([
    '<span class="mjx-munderover"><span class="mjx-base">', operator('∑'), '</span>',
    '<span class="mjx-stack"><span class="mjx-sup">', mathItalic('n'), '</span>',
    '<span class="mjx-sub">', row(mathItalic('i') + operator('=') + number('1')),
    '</span></span></span>',
    superscript(mathItalic('i'), '2', ' MJXc-space1')
  ].join(''), 'MathJax-Element-8')
});

const derivationSources = Object.freeze({
  voltage: 'V_{L,\\max}=I_m X_L=I_m\\omega L',
  inductance: 'L=\\frac{R\\tan\\phi+\\frac{1}{\\omega C}}{\\omega}',
  current: 'I_m=\\frac{E_m}{Z}=\\frac{E_m}{R/\\cos\\phi}=\\frac{E_m\\cos\\phi}{R}',
  evaluation: 'V_{L,\\max}=\\frac{E_m\\cos\\phi}{R}' +
    '\\left(R\\tan\\phi+\\frac{1}{\\omega C}\\right)',
  alignedCurrent: '\\begin{aligned}I_m&=\\frac{E_m}{Z}\\\\' +
    '&=\\frac{E_m}{R/\\cos\\phi}\\\\&=\\frac{E_m\\cos\\phi}{R}\\end{aligned}',
  spacedUnits: '120\\,\\mathrm V',
  calligraphicInline: '\\mathcal{E}_m',
  calligraphicFraction: '\\frac{\\mathcal{E}_m\\cos\\phi}{R}',
  calligraphicAligned: '\\begin{aligned}I_m&=\\frac{\\mathcal{E}_m}{Z}\\\\' +
    '&=\\frac{\\mathcal{E}_m\\cos\\phi}{R}\\end{aligned}',
  fontVariants: '\\mathbf{x}+\\mathrm{x}+\\mathit{x}+\\boldsymbol{x}+' +
    '\\mathbb{R}+\\mathfrak{g}+\\mathsf{s}+\\mathtt{t}'
});

const subscriptMax = () => compositeSubscript(mathItalic('V'), texAtom(row([
  mathItalic('L'), operator(','), operator('max')
].join(''))));
const currentM = () => subscript(mathItalic('I'), 'm');
const emfM = () => subscript(mathItalic('E'), 'm');
const calligraphicEmfM = () => subscript(fontIdentifier('E', 'cal-R'), 'm');
const reactanceL = () => subscript(mathItalic('X'), 'L');
const applyFunction = (name, argument) =>
  functionIdentifier(name) + invisibleFunctionApplication() + mathItalic(argument);
const reciprocalOmegaC = () => fraction(
  number('1'),
  row(mathItalic('ω') + mathItalic('C')),
  ' MJXc-space2'
);
const emfCosOverR = () => fraction(
  row(emfM() + applyFunction('cos', 'ϕ')),
  mathItalic('R'),
  ' MJXc-space3'
);

// Sanitized from the official mathjax@2.7.9 TeX-AMS_CHTML-full output for the
// reported multi-line RLC derivation. These roots deliberately retain nested
// mfrac boxes and empty function-application tokens, the combination that
// caused one formula to invalidate an otherwise valid full-page selection.
const derivationRoots = Object.freeze({
  voltage: commonHtmlRoot([
    subscriptMax(), operator('=', ' MJXc-space3'), currentM(), reactanceL(),
    operator('=', ' MJXc-space3'), currentM(), mathItalic('ω'), mathItalic('L')
  ].join(''), 'MathJax-Element-20'),
  inductance: commonHtmlRoot([
    mathItalic('L'), operator('=', ' MJXc-space3'), fraction(
      row(mathItalic('R') + applyFunction('tan', 'ϕ') + operator('+', ' MJXc-space2') +
        reciprocalOmegaC()),
      mathItalic('ω'),
      ' MJXc-space3'
    )
  ].join(''), 'MathJax-Element-21'),
  current: commonHtmlRoot([
    currentM(), operator('=', ' MJXc-space3'),
    fraction(emfM(), mathItalic('Z'), ' MJXc-space3'),
    operator('=', ' MJXc-space3'),
    fraction(
      emfM(),
      row(mathItalic('R') + texAtom(row(operator('/'))) + applyFunction('cos', 'ϕ')),
      ' MJXc-space3'
    ),
    operator('=', ' MJXc-space3'), emfCosOverR()
  ].join(''), 'MathJax-Element-22'),
  evaluation: commonHtmlRoot([
    subscriptMax(), operator('=', ' MJXc-space3'), emfCosOverR(),
    row(operator('(') + mathItalic('R') + applyFunction('tan', 'ϕ') +
      operator('+', ' MJXc-space2') + reciprocalOmegaC() + operator(')'))
  ].join(''), 'MathJax-Element-23'),
  alignedCurrent: commonHtmlRoot(alignedTable([
    [currentM(), operator('=', ' MJXc-space3') + fraction(emfM(), mathItalic('Z'), ' MJXc-space3')],
    ['', operator('=', ' MJXc-space3') + fraction(
      emfM(),
      row(mathItalic('R') + texAtom(row(operator('/'))) + applyFunction('cos', 'ϕ')),
      ' MJXc-space3'
    )],
    ['', operator('=', ' MJXc-space3') + emfCosOverR()]
  ]), 'MathJax-Element-24'),
  spacedUnits: commonHtmlRoot(
    number('120') + explicitSpace() + texAtom(row(functionIdentifier('V', ''))),
    'MathJax-Element-25'
  ),
  calligraphicInline: commonHtmlRoot(calligraphicEmfM(), 'MathJax-Element-26'),
  calligraphicFraction: commonHtmlRoot(fraction(
    row(calligraphicEmfM() + applyFunction('cos', 'ϕ')),
    mathItalic('R')
  ), 'MathJax-Element-27'),
  calligraphicAligned: commonHtmlRoot(alignedTable([
    [currentM(), operator('=', ' MJXc-space3') + fraction(
      calligraphicEmfM(),
      mathItalic('Z'),
      ' MJXc-space3'
    )],
    ['', operator('=', ' MJXc-space3') + fraction(
      row(calligraphicEmfM() + applyFunction('cos', 'ϕ')),
      mathItalic('R'),
      ' MJXc-space3'
    )]
  ]), 'MathJax-Element-28'),
  fontVariants: commonHtmlRoot([
    fontIdentifier('x', 'main-B'), operator('+'),
    fontIdentifier('x', 'main-R'), operator('+'),
    fontIdentifier('x', 'main-I'), operator('+'),
    fontIdentifier('x', 'math-BI'), operator('+'),
    fontIdentifier('R', 'ams-R'), operator('+'),
    fontIdentifier('g', 'frak-R'), operator('+'),
    fontIdentifier('s', 'sans-R'), operator('+'),
    fontIdentifier('t', 'type-R')
  ].join(''), 'MathJax-Element-29')
});

const withSource = (root, source, options = {}) => {
  const match = root.match(/\bid="([^"]+)-Frame"/u);
  if (!match) throw new Error('MathJax 2 fixture root is missing its normalized frame id');
  return [
  options.preview === false ? '' : '<span class="MathJax_Preview"></span>',
  root,
  '<script id="' + match[1] + '" type="math/tex' +
    (options.display === true ? '; mode=display' : '') + '">',
  source,
  '</script>'
  ].join('');
};

const longDiagramAlt = [
  'Three sequential phasor diagrams, labeled A, B, and C. ',
  'Each phasor diagram has an unlabeled 2 D coordinate system and several labeled vectors. ',
  'In diagram A, vector V sub L points into the first quadrant and vector V sub C points ',
  'in the opposite direction. In diagram B, a new vector forms a parallelogram. In diagram C, ',
  'the voltage sum vector includes the parallelogram guidelines from diagram B.'
].join('');

function phasorPage(options = {}) {
  const sources = options.sources !== false;
  const formula = (root, source) => sources
    ? withSource(root, source, { preview: options.previews === true })
    : root;
  return [
    '<main id="target">',
    '<p>A phasor diagram visualizes the voltage drops across a capacitor ',
    formula(roots.subscript, 'V_C'), ', inductor ',
    formula(roots.subscriptL, 'V_L'), ', and resistor ',
    formula(roots.subscriptR, 'V_R'), '.</p>',
    '<p>The output voltage vector ', formula(roots.vector, '\\vec V'), ' is the vector sum</p>',
    '<p>', formula(roots.equation, '\\vec V = \\vec V_R + (\\vec V_L + \\vec V_C)'), '</p>',
    '<p>The drops are ', formula(roots.degree, '180^\\circ'), ' out of phase.</p>',
    '<figure><img src="phasor.png" alt="', longDiagramAlt, '"></figure>',
    '<p>From the options, the correct result is Figure D.</p>',
    '</main>'
  ].join('');
}

function derivationPage(options = {}) {
  const sources = options.sources !== false;
  const formula = (name) => sources
    ? withSource(derivationRoots[name], derivationSources[name], {
      preview: options.previews === true,
      display: true
    })
    : derivationRoots[name];
  return [
    '<main id="target">',
    '<p>The maximum inductor voltage is</p><p>', formula('voltage'), '</p>',
    '<p>Solving for the inductance gives</p><p>', formula('inductance'), '</p>',
    '<p>The current amplitude can be written as</p><p>', formula('current'), '</p>',
    '<p>Substitution produces</p><p>', formula('evaluation'), '</p>',
    '<figure><img src="derivation.png" alt="', longDiagramAlt, '"></figure>',
    '<p>This completes the derivation.</p>',
    '</main>'
  ].join('');
}

module.exports = Object.freeze({
  commonHtmlCss,
  derivationPage,
  derivationRoots,
  derivationSources,
  longDiagramAlt,
  phasorPage,
  roots,
  withSource
});
