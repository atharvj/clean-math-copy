'use strict';

// Sanitized from the real DOM emitted by the official mathjax@2.7.9 npm
// package with the TeX-AMS_CHTML-full configuration. Measurement-only styles,
// tabindex, and internal MJXc-Node ids were removed. The output-frame/script
// id pair is normalized but retained because it is MathJax 2's authoritative
// source association. Element nesting, class names, glyph text, and sibling
// order are retained exactly.

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
  '.MJX_Assistive_MathML{position:absolute;top:0;left:0;clip:rect(1px,1px,1px,1px);padding:1px 0 0 0;border:0;height:1px;width:1px;overflow:hidden;display:block;user-select:none}'
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

module.exports = Object.freeze({
  commonHtmlCss,
  longDiagramAlt,
  phasorPage,
  roots,
  withSource
});
