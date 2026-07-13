// ==UserScript==
// @name         Clean Math Copy
// @namespace    https://github.com/atharvj/clean-math-copy
// @version      2.1.2
// @description  Faithfully copy web math and clean messy ordinary text as readable plain text plus safe rich formatting.
// @author       Atharv Joshi
// @license      MIT
// @homepageURL  https://github.com/atharvj/clean-math-copy
// @supportURL   https://github.com/atharvj/clean-math-copy/issues
// @downloadURL  https://raw.githubusercontent.com/atharvj/clean-math-copy/main/clean-math-copy.user.js
// @updateURL    https://raw.githubusercontent.com/atharvj/clean-math-copy/main/clean-math-copy.user.js
// @match        http://*/*
// @match        https://*/*
// @match        file:///*
// @run-at       document-start
// @sandbox      raw
// @inject-into  auto
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_addElement
// @grant        unsafeWindow
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @grant        GM.setClipboard
// @grant        GM.addElement
// ==/UserScript==

(function cleanMathCopyModule(global, factory) {
  'use strict';

  const api = factory(global);

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (global && global.document) {
    api.install(global.document, global);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function cleanMathCopyFactory(global) {
  'use strict';

  const VERSION = '2.1.2';
  const STORAGE_KEY = 'cleanMathCopy.settings.v3';
  const MATHML_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';
  const MAX_CLIPBOARD_MARKUP_LENGTH = 1024 * 1024;
  const GOOGLE_DOCS_SLICE_TYPE = 'application/x-vnd.google-docs-document-slice-clip+wrapped';
  const GOOGLE_DOCS_CLIPBOARD_FRAME_SELECTOR =
    'iframe.docs-texteventtarget-iframe, iframe[class*="docs-texteventtarget-iframe"]';
  const MAX_GOOGLE_DOCS_STYLE_SLICES = 256;
  const MAX_GOOGLE_DOCS_EQUATIONS = 128;
  const MAX_GOOGLE_DOCS_PARSE_STEPS = 25000;
  const MAX_SITE_SEMANTIC_PARSE_ATTEMPTS = 8;
  const MAX_SITE_SEMANTIC_PARSE_CHARACTERS = 2 * MAX_CLIPBOARD_MARKUP_LENGTH;
  const MAX_PAGE_RELAY_ACTIVE_EVENTS = 4;
  const MAX_PAGE_RELAY_OPERATIONS = 64;
  const MAX_MATHML_NODES = 5000;
  const MAX_MATHML_DEPTH = 128;
  const MAX_RICH_SELECTION_NODES = 1000;
  const MAX_RICH_SELECTION_DEPTH = 128;
  const MAX_ORDINARY_SELECTION_MARKUP_LENGTH = 1024 * 1024;
  const MAX_SELECTION_KEY_LENGTH = 50000;
  const MAX_MATH_SOURCE_LENGTH = 50000;
  const MAX_MATH_ROOTS_PER_SELECTION = 128;
  const MAX_MATH_DISCOVERY_CANDIDATES = 4096;
  const MAX_PARTIAL_MATCH_CANDIDATES = 256;
  const MAX_PARTIAL_MATCH_NODES = 1200;
  const MAX_PARTIAL_MATCH_OCCURRENCES = 64;
  const MAX_PARTIAL_MATCH_WORK = 30000;
  const MAX_POSITIONED_DISCOVERY_NODES = 1200;
  const MAX_POSITIONED_TOKEN_CANDIDATES = 512;
  const MAX_POSITIONED_SELECTED_TOKENS = 128;
  const MAX_POSITIONED_BASE_LOOKBACK = 24;
  const MAX_SELECTION_RANGES = 64;
  const MAX_LATEX_PARSE_DEPTH = 128;
  const MAX_LATEX_PARSE_STEPS = 25000;
  const DECLARED_OPERATOR_START = '\ue100';
  const DECLARED_OPERATOR_END = '\ue101';
  const RELATIONAL_MID = '\ue102';
  const DECLARED_IDENTIFIER_START = '\ue103';
  const DECLARED_IDENTIFIER_END = '\ue104';
  const FAITHFUL_FUNCTION_APPLY = '\ue105';
  const FAITHFUL_ABS_OPEN = '\ue106';
  const FAITHFUL_ABS_CLOSE = '\ue107';
  const FAITHFUL_NORM_OPEN = '\ue108';
  const FAITHFUL_NORM_CLOSE = '\ue109';
  const FAITHFUL_GROUP_OPEN = '\ue10a';
  const FAITHFUL_GROUP_CLOSE = '\ue10b';
  const FAITHFUL_SCOPE_OPEN = '\ue10c';
  const FAITHFUL_SCOPE_CLOSE = '\ue10d';
  const FAITHFUL_TEXT_OPEN = '\ue10e';
  const FAITHFUL_TEXT_CLOSE = '\ue10f';
  const LATEX_BUDGET_ERROR = 'CLEAN_MATH_COPY_LATEX_BUDGET';
  const POSITIONED_OVER_BUDGET = Symbol('clean-math-copy-positioned-over-budget');
  const TRUSTED_RICH_STYLE_NODES = new WeakSet();
  const TRUSTED_TEXT_PLACEHOLDERS = new WeakMap();
  const MATH_ROOT_SELECTOR = [
    '.katex-display',
    '.katex',
    'mjx-container',
    '.MathJax_Display',
    '.MathJax_SVG_Display',
    '.MathJax_CHTML',
    '.MathJax_SVG',
    '.MathJax',
    '.mwe-math-element',
    '.math-inline',
    '.math-display',
    '.math-block',
    '.math-container',
    '.markdown-math',
    '.formula',
    '.equation',
    'math',
    '[role="math"]',
    '[data-latex]',
    '[data-tex]',
    '[data-math-source]',
    '[data-automation-id*="equation" i]',
    '[aria-roledescription="equation" i]',
    'latex-js',
    'katex-element'
  ].join(',');

  const MATH_DISCOVERY_SELECTOR = [
    MATH_ROOT_SELECTOR,
    '[class*="math"]',
    '[class*="Math"]',
    '[class*="katex"]',
    '[class*="latex"]',
    '[class*="formula"]',
    '[class*="equation"]',
    '[id*="math"]',
    '[id*="Math"]',
    '[data-testid*="math"]',
    '[data-testid*="formula"]'
  ].join(',');

  const DEFAULT_SETTINGS = Object.freeze({
    outputMode: 'faithful',
    convertDelimitedLatex: true,
    cleanInvisibleArtifacts: true
  });

  const SYMBOLS = Object.freeze({
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε',
    zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', varkappa: 'ϰ',
    lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', omicron: 'ο', pi: 'π', varpi: 'ϖ',
    rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ',
    phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
    Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
    pm: '±', mp: '∓', times: '×', div: '÷', cdot: '⋅', ast: '∗', star: '⋆',
    circ: '∘', bullet: '∙', cap: '∩', cup: '∪', uplus: '⊎', sqcap: '⊓',
    sqcup: '⊔', vee: '∨', wedge: '∧', land: '∧', lor: '∨',
    setminus: '∖', smallsetminus: '∖', wr: '≀', diamond: '⋄',
    bigtriangleup: '△', bigtriangledown: '▽', triangleleft: '◁', triangleright: '▷',
    oplus: '⊕', ominus: '⊖', otimes: '⊗', oslash: '⊘', odot: '⊙',
    bigcirc: '◯', dagger: '†', ddagger: '‡', amalg: '⨿',
    le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', ne: '≠', equiv: '≡',
    approx: '≈', sim: '∼', simeq: '≃', cong: '≅', propto: '∝', doteq: '≐',
    ll: '≪', gg: '≫', prec: '≺', succ: '≻', preceq: '≼', succeq: '≽',
    subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇', subsetneq: '⊊', supsetneq: '⊋', sqsubset: '⊏',
    sqsupset: '⊐', sqsubseteq: '⊑', sqsupseteq: '⊒', in: '∈', ni: '∋', owns: '∋',
    notin: '∉', vdash: '⊢', dashv: '⊣', models: '⊨', perp: '⊥', parallel: '∥', nparallel: '∦',
    mid: '∣', nmid: '∤', smile: '⌣', frown: '⌢', asymp: '≍', bowtie: '⋈',
    leftarrow: '←', gets: '←', rightarrow: '→', to: '→', leftrightarrow: '↔',
    Leftarrow: '⇐', Rightarrow: '⇒', Leftrightarrow: '⇔', mapsto: '↦',
    hookleftarrow: '↩', hookrightarrow: '↪', leftharpoonup: '↼',
    leftharpoondown: '↽', rightharpoonup: '⇀', rightharpoondown: '⇁',
    rightleftharpoons: '⇌', longleftarrow: '⟵', longrightarrow: '⟶',
    longleftrightarrow: '⟷', Longleftarrow: '⟸', Longrightarrow: '⟹',
    Longleftrightarrow: '⟺', longmapsto: '⟼', uparrow: '↑', downarrow: '↓',
    updownarrow: '↕', Uparrow: '⇑', Downarrow: '⇓', Updownarrow: '⇕',
    sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬', iiint: '∭',
    oint: '∮', bigcap: '⋂', bigcup: '⋃', bigvee: '⋁', bigwedge: '⋀',
    bigoplus: '⨁', bigotimes: '⨂', bigodot: '⨀', lim: 'lim', limsup: 'lim sup',
    liminf: 'lim inf', max: 'max', min: 'min', sup: 'sup', inf: 'inf',
    sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec', csc: 'csc',
    arcsin: 'arcsin', arccos: 'arccos', arctan: 'arctan', sinh: 'sinh',
    cosh: 'cosh', tanh: 'tanh', log: 'log', ln: 'ln', lg: 'lg', exp: 'exp',
    det: 'det', dim: 'dim', gcd: 'gcd', hom: 'hom', ker: 'ker', Pr: 'Pr',
    partial: '∂', nabla: '∇', infty: '∞', ell: 'ℓ', hbar: 'ℏ', imath: 'ı',
    jmath: 'ȷ', Re: 'ℜ', Im: 'ℑ', wp: '℘', aleph: 'ℵ', beth: 'ℶ', gimel: 'ℷ',
    emptyset: '∅', varnothing: '∅', forall: '∀', exists: '∃', nexists: '∄',
    neg: '¬', lnot: '¬', top: '⊤', bot: '⊥', angle: '∠', measuredangle: '∡',
    triangle: '△', square: '□', Box: '□', Diamond: '◊', prime: '′', backslash: '∖', ldots: '…',
    cdots: '⋯', vdots: '⋮', ddots: '⋱', dots: '…', therefore: '∴', because: '∵',
    degree: '°', checkmark: '✓', clubsuit: '♣', diamondsuit: '♢', heartsuit: '♡', spadesuit: '♠',
    pounds: '£', euro: '€', yen: '¥',
    lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', langle: '⟨', rangle: '⟩',
    lvert: '|', rvert: '|', vert: '|', lVert: '‖', rVert: '‖', Vert: '‖', colon: ':',
    lt: '<', gt: '>', implies: '⟹', impliedby: '⟸', iff: '⟺',
    AA: 'Å', ae: 'æ', AE: 'Æ', oe: 'œ', OE: 'Œ', ss: 'ß', o: 'ø', O: 'Ø'
  });

  const NEGATED_SYMBOLS = Object.freeze({
    '=': '≠', equiv: '≢', approx: '≉', sim: '≁', simeq: '≄', cong: '≇',
    in: '∉', ni: '∌', subset: '⊄', supset: '⊅', subseteq: '⊈', supseteq: '⊉',
    le: '≰', leq: '≰', ge: '≱', geq: '≱', prec: '⊀', succ: '⊁',
    preceq: '⋠', succeq: '⋡', parallel: '∦', mid: '∤', vdash: '⊬', models: '⊭'
  });

  const SUPERSCRIPTS = Object.freeze({
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵',
    '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻',
    '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ'
  });

  const SUBSCRIPTS = Object.freeze({
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅',
    '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋',
    '−': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', h: 'ₕ',
    i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ',
    r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ', schwa: 'ₔ',
    beta: 'ᵦ', gamma: 'ᵧ', rho: 'ᵨ', phi: 'ᵩ', chi: 'ᵪ'
  });

  const DOUBLE_STRUCK = Object.freeze({
    C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ'
  });
  const MATH_VARIANT_GREEK_UPPER = Array.from('ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡϴΣΤΥΦΧΨΩ');
  const MATH_VARIANT_GREEK_LOWER = Array.from('αβγδεζηθικλμνξοπρςστυφχψω');
  const MATH_VARIANT_GREEK_SYMBOLS = Array.from('∂ϵϑϰϕϱϖ');
  const MATH_VARIANT_SPECS = Object.freeze({
    bold: { upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce, greekUpper: 0x1d6a8, greekLower: 0x1d6c2 },
    italic: { upper: 0x1d434, lower: 0x1d44e, greekUpper: 0x1d6e2, greekLower: 0x1d6fc },
    'bold-italic': { upper: 0x1d468, lower: 0x1d482, greekUpper: 0x1d71c, greekLower: 0x1d736 },
    script: { upper: 0x1d49c, lower: 0x1d4b6 },
    'bold-script': { upper: 0x1d4d0, lower: 0x1d4ea },
    fraktur: { upper: 0x1d504, lower: 0x1d51e },
    'bold-fraktur': { upper: 0x1d56c, lower: 0x1d586 },
    'double-struck': { upper: 0x1d538, lower: 0x1d552, digit: 0x1d7d8 },
    'sans-serif': { upper: 0x1d5a0, lower: 0x1d5ba, digit: 0x1d7e2 },
    'bold-sans-serif': { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec, greekUpper: 0x1d756, greekLower: 0x1d770 },
    'sans-serif-italic': { upper: 0x1d608, lower: 0x1d622 },
    'sans-serif-bold-italic': { upper: 0x1d63c, lower: 0x1d656, greekUpper: 0x1d790, greekLower: 0x1d7aa },
    monospace: { upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 }
  });
  const MATH_VARIANT_EXCEPTIONS = Object.freeze({
    italic: { h: 'ℎ' },
    script: {
      B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ',
      e: 'ℯ', g: 'ℊ', o: 'ℴ'
    },
    fraktur: { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' },
    'double-struck': { ...DOUBLE_STRUCK }
  });
  const OFFICE_SEMANTIC_LETTERLIKE = new Set([
    ...Object.values(DOUBLE_STRUCK), 'ℏ', 'ℓ', '℘', 'ℜ', 'ℑ'
  ]);

  const ASCII_SYMBOLS = Object.freeze({
    '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~=', '≃': '~=', '≅': '~=', '≡': '===',
    '−': '-', '±': '+/-', '∓': '-/+', '×': '*', '÷': '/', '·': '*', '∗': '*',
    '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '⇐': '<=', '⇔': '<=>', '↦': '|->',
    '⟵': '<--', '⟶': '-->', '⟷': '<-->', '⟹': '==>', '⟸': '<==', '⟺': '<==>',
    '∞': 'infinity', '∂': 'partial ', '∇': 'nabla ', '∑': 'sum', '∏': 'product',
    '∫': 'integral', '∬': 'double integral', '∭': 'triple integral', '∮': 'contour integral',
    '√': 'sqrt', '∈': ' in ', '∉': ' not in ', '∋': ' contains ', '⊂': ' subset ',
    '⊆': ' subseteq ', '⊃': ' superset ', '⊇': ' superseteq ', '∪': ' union ',
    '∩': ' intersection ', '∅': 'empty set', '∀': 'for all ', '∃': 'there exists ',
    '∄': 'there does not exist ', '¬': 'not ', '∧': ' and ', '∨': ' or ',
    '⊕': ' (+) ', '⊗': ' (x) ', '⊥': ' perpendicular ', '∥': ' parallel ',
    '…': '...', '⋯': '...', '′': "'", '″': "''", '°': ' degrees',
    'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon',
    'ϵ': 'epsilon', 'ζ': 'zeta', 'η': 'eta', 'θ': 'theta', 'ϑ': 'theta',
    'ι': 'iota', 'κ': 'kappa', 'λ': 'lambda', 'μ': 'mu', 'ν': 'nu', 'ξ': 'xi',
    'π': 'pi', 'ρ': 'rho', 'σ': 'sigma', 'ς': 'sigma', 'τ': 'tau', 'υ': 'upsilon',
    'φ': 'phi', 'ϕ': 'phi', 'χ': 'chi', 'ψ': 'psi', 'ω': 'omega',
    'Γ': 'Gamma', 'Δ': 'Delta', 'Θ': 'Theta', 'Λ': 'Lambda', 'Ξ': 'Xi',
    'Π': 'Pi', 'Σ': 'Sigma', 'Υ': 'Upsilon', 'Φ': 'Phi', 'Ψ': 'Psi', 'Ω': 'Omega'
  });

  const BLOCK_TAGS = new Set([
    'address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'div', 'dl',
    'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4',
    'h5', 'h6', 'header', 'hgroup', 'main', 'nav', 'p', 'pre', 'section', 'summary'
  ]);
  const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'canvas']);
  const PRESERVE_TAGS = new Set(['pre', 'textarea']);
  const ORDINARY_RICH_TAGS = new Set([
    'a', 'abbr', 'article', 'aside', 'b', 'bdi', 'bdo', 'blockquote', 'br',
    'caption', 'cite', 'code', 'col', 'colgroup', 'dd', 'del', 'details', 'dfn',
    'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'hr',
    'h4', 'h5', 'h6', 'header', 'hgroup', 'i', 'ins', 'kbd', 'li', 'main',
    'mark', 'nav', 'ol', 'p', 'pre', 'q', 'rp', 'rt', 'ruby', 's', 'samp',
    'section', 'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table',
    'tbody', 'td', 'tfoot', 'th', 'thead', 'time', 'tr', 'u', 'ul', 'var', 'wbr'
  ]);
  const ORDINARY_DROP_CONTENT_TAGS = new Set([
    'applet', 'audio', 'canvas', 'embed', 'frame', 'frameset', 'iframe', 'link',
    'meta', 'noscript', 'object', 'script', 'style', 'svg', 'template', 'video'
  ]);

  function normalizeSettings(settings) {
    const candidate = settings && typeof settings === 'object' ? settings : {};
    const outputMode = ['calculator', 'faithful', 'unicode', 'latex', 'ascii'].includes(candidate.outputMode)
      ? candidate.outputMode
      : DEFAULT_SETTINGS.outputMode;
    return {
      outputMode,
      convertDelimitedLatex: candidate.convertDelimitedLatex !== false,
      cleanInvisibleArtifacts: candidate.cleanInvisibleArtifacts !== false
    };
  }

  function stripLatexDelimiters(input) {
    const text = String(input == null ? '' : input).trim();
    if (text.startsWith('$$') && text.endsWith('$$') && text.length >= 4) {
      return text.slice(2, -2).trim();
    }
    if (text.startsWith('$') && text.endsWith('$') && text.length >= 2) {
      return text.slice(1, -1).trim();
    }
    if ((text.startsWith('\\(') && text.endsWith('\\)')) ||
        (text.startsWith('\\[') && text.endsWith('\\]'))) {
      return text.slice(2, -2).trim();
    }
    return text;
  }

  function toScript(text, map, fallbackMarker) {
    const source = String(text).trim();
    if (!source) return '';
    let converted = '';
    for (const character of source) {
      if (!Object.prototype.hasOwnProperty.call(map, character)) {
        return fallbackMarker + '(' + source + ')';
      }
      converted += map[character];
    }
    return converted;
  }

  function toFaithfulScript(text, map, fallbackMarker) {
    const source = String(text == null ? '' : text).trim();
    if (!source) return '';
    if (fallbackMarker === '^' && /^[′″‴']+$/u.test(source)) {
      return source.replace(/'/g, '′');
    }
    const compact = source.replace(/\s+/g, '');
    const aliases = map === SUBSCRIPTS
      ? { β: 'ᵦ', γ: 'ᵧ', ρ: 'ᵨ', φ: 'ᵩ', χ: 'ᵪ' }
      : {};
    let converted = '';
    for (const character of compact) {
      if (!Object.prototype.hasOwnProperty.call(map, character) && !Object.prototype.hasOwnProperty.call(aliases, character)) {
        return Array.from(source).length === 1 && /^[\p{L}\p{N}\p{M}\p{S}]$/u.test(source)
          ? fallbackMarker + source.replace('−', '-')
          : fallbackMarker + '(' + source + ')';
      }
      converted += map[character] || aliases[character];
    }
    return converted;
  }

  function protectFaithfulText(input) {
    const encoded = Array.from(String(input == null ? '' : input), (character) =>
      character.codePointAt(0).toString(16)
    ).join('.');
    return FAITHFUL_TEXT_OPEN + encoded + FAITHFUL_TEXT_CLOSE;
  }

  function escapeFaithfulSentinelCollisions(input) {
    const sentinels = new Set([
      DECLARED_OPERATOR_START, DECLARED_OPERATOR_END, RELATIONAL_MID,
      DECLARED_IDENTIFIER_START, DECLARED_IDENTIFIER_END,
      FAITHFUL_FUNCTION_APPLY, FAITHFUL_ABS_OPEN, FAITHFUL_ABS_CLOSE,
      FAITHFUL_NORM_OPEN, FAITHFUL_NORM_CLOSE, FAITHFUL_GROUP_OPEN,
      FAITHFUL_GROUP_CLOSE, FAITHFUL_SCOPE_OPEN, FAITHFUL_SCOPE_CLOSE,
      FAITHFUL_TEXT_OPEN, FAITHFUL_TEXT_CLOSE
    ]);
    return Array.from(String(input == null ? '' : input), (character) =>
      sentinels.has(character) ? protectFaithfulText(character) : character
    ).join('');
  }

  function restoreFaithfulText(input) {
    const source = String(input == null ? '' : input);
    let output = '';
    for (let position = 0; position < source.length;) {
      if (source[position] === FAITHFUL_TEXT_CLOSE) {
        position += 1;
        continue;
      }
      if (source[position] !== FAITHFUL_TEXT_OPEN) {
        output += source[position];
        position += 1;
        continue;
      }
      const close = source.indexOf(FAITHFUL_TEXT_CLOSE, position + 1);
      if (close < 0) {
        position += 1;
        continue;
      }
      const encoded = source.slice(position + 1, close);
      if (/^(?:[0-9a-f]+(?:\.[0-9a-f]+)*)?$/iu.test(encoded)) {
        try {
          output += encoded
            ? encoded.split('.').map((value) => String.fromCodePoint(parseInt(value, 16))).join('')
            : '';
        } catch (_error) {
          // Invalid code points are discarded with their private framing.
        }
      }
      position = close + 1;
    }
    return output;
  }

  function faithfulMarkedScope(input, strong) {
    const text = String(input == null ? '' : input);
    return (strong ? FAITHFUL_SCOPE_OPEN : FAITHFUL_GROUP_OPEN) + text +
      (strong ? FAITHFUL_SCOPE_CLOSE : FAITHFUL_GROUP_CLOSE);
  }

  function faithfulHasBalancedOuterParentheses(input) {
    const text = String(input == null ? '' : input).trim();
    if (text.length < 2 || text[0] !== '(' || text[text.length - 1] !== ')') return false;
    let depth = 0;
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] === '(') depth += 1;
      else if (text[index] === ')') depth -= 1;
      if (depth < 0 || (depth === 0 && index < text.length - 1)) return false;
    }
    return depth === 0;
  }

  function faithfulExpressionIsAtomic(input) {
    const text = String(input == null ? '' : input).trim();
    if (!text) return false;
    if (faithfulFullyFenced(text) || faithfulAtomicRadicand(text)) return true;
    if (new RegExp('^' + FAITHFUL_TEXT_OPEN + '[0-9a-f.]*' + FAITHFUL_TEXT_CLOSE + '$', 'i').test(text)) {
      return true;
    }
    const root = text.match(/^(?:[⁰¹²³⁴⁵⁶⁷⁸⁹]+√|√|∛|∜)(.+)$/u);
    if (root && faithfulAtomicRadicand(root[1])) return true;
    return /^[\p{L}\p{M}][\p{L}\p{N}\p{M}_]*[₀-₟⁰-⁹⁺⁻⁼⁽⁾ⁿⁱᵢⱼᵦ-ᵪ′″‴⁗]*\([^\n]+\)$/u.test(text);
  }

  function faithfulTopLevelTraits(input) {
    const text = String(input == null ? '' : input);
    const pairs = { '(': ')', '[': ']', '{': '}', '⟨': '⟩', '⌈': '⌉', '⌊': '⌋' };
    const closing = new Set(Object.values(pairs));
    const stack = [];
    let lowPrecedence = false;
    let division = false;
    for (const character of text) {
      if (pairs[character]) {
        stack.push(pairs[character]);
        continue;
      }
      if (closing.has(character)) {
        if (stack[stack.length - 1] === character) stack.pop();
        continue;
      }
      if (stack.length) continue;
      if (character === '/' || character === '÷' || character === '∕' || character === '⁄') division = true;
      if (/[+−±∓-]/u.test(character) || /[=≠≈≃≅≡≤≥<>∈∉∋∌⊂⊃⊆⊇⊊⊋≺≻≼≽∝⇐⇒⇔↔→←↦∣-∦⟵-⟺]/u.test(character)) {
        lowPrecedence = true;
      }
    }
    return { lowPrecedence, division };
  }

  function faithfulScopeNeedsParentheses(content, strong, before, after) {
    const text = String(content == null ? '' : content).trim();
    if (!text || faithfulFullyFenced(text)) return false;
    const previous = String(before == null ? '' : before).match(/\S$/u);
    const next = String(after == null ? '' : after).match(/^\s*(\S)/u);
    const previousCharacter = previous ? previous[0] : '';
    const nextCharacter = next ? next[1] : '';
    const atomic = faithfulExpressionIsAtomic(text);
    const scriptOrPostfix = /^[₀-₟⁰-⁹¹²³⁺⁻⁼⁽⁾ⁿⁱᵢⱼᵦ-ᵪ′″‴⁗'!_^]/u.test(nextCharacter);
    if (scriptOrPostfix && (strong || !atomic)) return true;
    if (previousCharacter === FAITHFUL_FUNCTION_APPLY && (strong || !atomic)) return true;

    const traits = faithfulTopLevelTraits(text);
    const previousIsLargeOperator = /(?:lim(?:_\([^)]*\)|[₀-₟ᵢⱼᵦ-ᵪ]+)?(?:\^\([^)]*\)|[⁰-⁹¹²³⁺⁻⁼⁽⁾ⁿⁱ]+)?|[∑∏∐∫∬∭∮](?:_\([^)]*\)|[₀-₟ᵢⱼᵦ-ᵪ]+)?(?:\^\([^)]*\)|[⁰-⁹¹²³⁺⁻⁼⁽⁾ⁿⁱ]+)?)$/u.test(String(before == null ? '' : before).trim());
    const previousOperand = !previousIsLargeOperator && /[\p{L}\p{N}\p{M})\]}⟩⌉⌋₀-₟⁰-⁹′″‴⁗]/u.test(previousCharacter);
    const nextOperand = /[\p{L}\p{N}\p{M}([{⟨⌈⌊√∛∜]/u.test(nextCharacter);
    const previousBinding = previousOperand || /[*/×·⋅∗÷∕⁄−-]/u.test(previousCharacter);
    const nextBinding = nextOperand || /[*/×·⋅∗÷∕⁄]/u.test(nextCharacter);
    if (traits.lowPrecedence && (previousBinding || nextBinding)) return true;
    if (traits.division && (previousOperand || nextOperand)) return true;
    return false;
  }

  function resolveFaithfulScopes(input) {
    const source = String(input == null ? '' : input);
    const parse = (start, closingMarker) => {
      const nodes = [];
      let buffer = '';
      let position = start;
      const flush = () => {
        if (buffer) nodes.push(buffer);
        buffer = '';
      };
      while (position < source.length) {
        const character = source[position];
        if (closingMarker && character === closingMarker) {
          flush();
          return { nodes, position: position + 1 };
        }
        if (character === FAITHFUL_GROUP_OPEN || character === FAITHFUL_SCOPE_OPEN) {
          flush();
          const strong = character === FAITHFUL_SCOPE_OPEN;
          const nested = parse(position + 1, strong ? FAITHFUL_SCOPE_CLOSE : FAITHFUL_GROUP_CLOSE);
          nodes.push({ nodes: nested.nodes, strong });
          position = nested.position;
          continue;
        }
        buffer += character;
        position += 1;
      }
      flush();
      return { nodes, position };
    };
    const preview = (nodes) => nodes.map((node) =>
      typeof node === 'string' ? node : preview(node.nodes)
    ).join('');
    const render = (nodes, prefix) => {
      let output = prefix || '';
      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        if (typeof node === 'string') {
          output += node;
          continue;
        }
        let content = render(node.nodes, '');
        const suffix = preview(nodes.slice(index + 1));
        const next = suffix.match(/^\s*(\S)/u);
        const nextCharacter = next ? next[1] : '';
        const radical = content.match(/^((?:[⁰¹²³⁴⁵⁶⁷⁸⁹]+√|√(?:\[[^\]]+\])?|∛|∜))(.+)$/u);
        const nextIsScriptOrPostfix = /^[₀-₟⁰-⁹¹²³⁺⁻⁼⁽⁾ⁿⁱᵢⱼᵦ-ᵪ′″‴⁗'!_^]/u.test(nextCharacter);
        // A plain Unicode radical has no vinculum. If a separate following
        // factor could be swallowed into an atomic radicand, fence the
        // radicand itself (`√(x)y`) rather than the completed root
        // (`(√x)y`). This stays closest to the displayed radical while making
        // its original two-dimensional boundary explicit.
        if (node.strong && radical && !nextIsScriptOrPostfix &&
            /[\p{L}\p{N}\p{M}([{⟨⌈⌊]/u.test(nextCharacter) &&
            !faithfulHasBalancedOuterParentheses(radical[2])) {
          content = radical[1] + '(' + radical[2] + ')';
        }
        output += faithfulScopeNeedsParentheses(content, node.strong, output, suffix)
          ? '(' + content + ')'
          : content;
      }
      return output;
    };
    return render(parse(0, '').nodes, '');
  }

  function faithfulFractionPart(input, denominator, options) {
    const text = resolveFaithfulScopes(String(input == null ? '' : input)).trim();
    if (!text || faithfulFullyFenced(text) || faithfulExpressionIsAtomic(text)) return text;
    const readableText = text.replace(new RegExp(FAITHFUL_FUNCTION_APPLY, 'g'), ' ');
    let depth = 0;
    const settings = options || {};
    let needsGrouping = Boolean(denominator && (settings.forceGrouping || /^[+−-]/u.test(text)));
    if (denominator && !settings.atomic && /^(?:[\p{L}\p{M}]{2,}|\d+(?:[.,]\d+)?[\p{L}\p{M}]+|[\p{L}\p{M}]+\s+[\p{L}\p{M}]+)$/u.test(text)) {
      needsGrouping = true;
    }
    if (denominator && !settings.atomic &&
        /(?:[\p{L}\p{N}\p{M})\]}₀-₟⁰-⁹′″‴⁗])\s*[(\[{⟨⌈⌊]/u.test(text)) needsGrouping = true;
    if (denominator && !settings.atomic &&
        /[)\]}⟩⌉⌋|‖]\s*[\p{L}\p{N}\p{M}√∛∜]/u.test(text)) needsGrouping = true;
    if (denominator && !settings.atomic &&
        /[\p{L}\p{N}\p{M}₀-₟⁰-⁹′″‴⁗]\s*(?:√|∛|∜)/u.test(text)) needsGrouping = true;
    if (denominator && !settings.atomic &&
        (text.match(/[√∛∜]/gu) || []).length > 1) needsGrouping = true;
    if (denominator && !settings.atomic && !needsGrouping) {
      try {
        const calculatorText = unicodeToCalculator(text);
        let calculatorDepth = 0;
        for (const character of calculatorText) {
          if (character === '(' || character === '[' || character === '{') calculatorDepth += 1;
          else if (character === ')' || character === ']' || character === '}') {
            calculatorDepth = Math.max(0, calculatorDepth - 1);
          } else if (character === '*' && calculatorDepth === 0) {
            needsGrouping = true;
            break;
          }
        }
      } catch (_error) {
        needsGrouping = true;
      }
    }
    if (!settings.atomic &&
        /^(?:sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|log|ln|lg|exp|det|dim|gcd|hom|ker|Pr)\S*\s+\S/iu.test(readableText)) {
      needsGrouping = true;
    }
    if (/[\p{L}\p{M}](?:[\u2080-\u209cᵢⱼᵦ-ᵪ]+|_[\p{L}\p{N}\p{M}])\s*[\p{Ll}\p{Lu}]/u.test(text)) {
      needsGrouping = true;
    }
    for (let index = 0; index < text.length && !needsGrouping; index += 1) {
      const character = text[index];
      if ('([{'.includes(character)) { depth += 1; continue; }
      if (')]}'.includes(character)) { depth = Math.max(0, depth - 1); continue; }
      if (depth !== 0) continue;
      if ('*/×·⋅∗÷∕⁄=<>'.includes(character) ||
          /[≠≈≃≅≡≤≥∝∈∉⊂⊃⊆⊇∪∩]/u.test(character)) {
        needsGrouping = true;
        continue;
      }
      if ((character === '+' || character === '-' || character === '−' || character === '±' || character === '∓') && index > 0) needsGrouping = true;
    }
    return needsGrouping ? '(' + text + ')' : text;
  }

  function faithfulFraction(numerator, denominator, options) {
    const settings = options || {};
    const fraction = faithfulFractionPart(numerator, false) + '/' + faithfulFractionPart(denominator, true, {
      forceGrouping: Boolean(settings.denominatorForceGrouping),
      atomic: Boolean(settings.denominatorAtomic)
    });
    return faithfulMarkedScope(fraction, true);
  }

  function faithfulFullyFenced(input) {
    const text = String(input == null ? '' : input).trim();
    if (faithfulHasBalancedOuterParentheses(text)) return true;
    const pairs = { '[': ']', '{': '}', '⟨': '⟩', '⌈': '⌉', '⌊': '⌋' };
    const close = pairs[text[0]];
    if (close && text[text.length - 1] === close) {
      let depth = 0;
      for (let index = 0; index < text.length; index += 1) {
        if (text[index] === text[0]) depth += 1;
        else if (text[index] === close) depth -= 1;
        if (depth < 0 || (depth === 0 && index < text.length - 1)) return false;
      }
      return depth === 0;
    }
    if ((text[0] === FAITHFUL_ABS_OPEN && text[text.length - 1] === FAITHFUL_ABS_CLOSE) ||
        (text[0] === FAITHFUL_NORM_OPEN && text[text.length - 1] === FAITHFUL_NORM_CLOSE)) return true;
    return (/^\|[^|\n]+\|$/u.test(text) || /^‖[^‖\n]+‖$/u.test(text));
  }

  function faithfulAtomicRadicand(input) {
    const text = String(input == null ? '' : input).trim();
    if (!text) return false;
    if (faithfulFullyFenced(text)) return true;
    // Decimal/integer literals and a single identifier with attached scripts
    // are unambiguous after a radical. Products, functions, sums, fractions,
    // and signed expressions retain parentheses so the missing vinculum can
    // never change the scope when pasted as plain text.
    if (/^\d+(?:[.,]\d+)?(?:[⁰-₟²³¹]+)?$/u.test(text)) return true;
    const characters = Array.from(text);
    if (characters.length === 0 || !/^[\p{L}\p{M}∞]$/u.test(characters[0])) return false;
    const scriptGlyphs = new Set([
      ...Object.values(SUPERSCRIPTS),
      ...Object.values(SUBSCRIPTS),
      '′', '″', '‴', '⁗'
    ]);
    let index = 1;
    while (index < characters.length) {
      if (scriptGlyphs.has(characters[index])) {
        index += 1;
        continue;
      }
      if (characters[index] !== '_' && characters[index] !== '^') return false;
      index += 1;
      if (index >= characters.length) return false;
      if (characters[index] !== '(') {
        if (!/^[\p{L}\p{N}\p{M}]$/u.test(characters[index])) return false;
        index += 1;
        continue;
      }
      let depth = 0;
      do {
        if (characters[index] === '(') depth += 1;
        else if (characters[index] === ')') depth -= 1;
        index += 1;
      } while (index < characters.length && depth > 0);
      if (depth !== 0) return false;
    }
    return true;
  }

  function faithfulRoot(index, radicand) {
    const degree = String(index == null ? '' : index).trim();
    const value = resolveFaithfulScopes(String(radicand == null ? '' : radicand)).trim();
    let prefix = '√';
    if (degree === '3') prefix = '∛';
    else if (degree === '4') prefix = '∜';
    else if (degree) {
      prefix = /^[0-9]+$/u.test(degree)
        ? toFaithfulScript(degree, SUPERSCRIPTS, '^') + '√'
        : '√[' + degree + ']';
    }
    // A Unicode radical has no vinculum in plain text. A superscript or prime
    // after its operand can therefore be read as applying to the completed
    // root (`(√x)²`) instead of belonging under it (`√(x²)`). Subscripts are
    // part of the identifier and remain unambiguous, but superscripted and
    // primed radicands need explicit scope just like sums and products do.
    const superscriptOrPrime = new Set([...Object.values(SUPERSCRIPTS), '′', '″', '‴', '⁗', '^']);
    const ambiguousPostfix = !faithfulFullyFenced(value) &&
      Array.from(value).some((character) => superscriptOrPrime.has(character));
    const atomic = faithfulAtomicRadicand(value) && !ambiguousPostfix;
    return faithfulMarkedScope(prefix + (atomic ? value : '(' + value + ')'), true);
  }

  function faithfulLatexDenominatorOptions(source) {
    const raw = String(source == null ? '' : source).trim();
    const atomicWrapper = /^\\(?:mathrm|mathbf|mathit|mathsf|mathtt|mathbb|mathcal|mathscr|mathfrak|operatorname)\*?\s*\{[\s\S]*\}$/u.test(raw);
    const functionProduct = /^\\(?:sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|log|ln|lg|exp|det|dim|gcd|hom|ker|Pr)\b[\s\S]+$/u.test(raw);
    return {
      denominatorAtomic: atomicWrapper,
      denominatorForceGrouping: functionProduct
    };
  }

  function faithfulAccent(command, input, combiningMark) {
    const value = resolveFaithfulScopes(String(input == null ? '' : input)).trim();
    if (faithfulAtomicRadicand(value)) return value + combiningMark;
    const names = {
      bar: 'overline', overline: 'overline', overbrace: 'overbrace',
      underline: 'underline', underbrace: 'underbrace',
      hat: 'hat', widehat: 'hat', tilde: 'tilde', widetilde: 'tilde',
      vec: 'vec', overrightarrow: 'vec', overleftarrow: 'overleftarrow',
      dot: 'dot', ddot: 'ddot', acute: 'acute', grave: 'grave',
      breve: 'breve', check: 'check', mathring: 'mathring'
    };
    return faithfulMarkedScope((names[command] || command) + '(' + value + ')', true);
  }

  function canonicalMathVariant(variant) {
    const value = String(variant == null ? '' : variant).trim().toLowerCase()
      .replace(/_/g, '-');
    return ({
      blackboard: 'double-struck', 'blackboard-bold': 'double-struck',
      'sans-serif-bold': 'bold-sans-serif',
      'bold-sans-serif-italic': 'sans-serif-bold-italic'
    })[value] || value;
  }

  function mathVariantBaseCharacter(character) {
    try {
      const normalized = character.normalize('NFKD');
      return Array.from(normalized).length === 1 ? normalized : character;
    } catch (_error) {
      return character;
    }
  }

  function mathematicalVariantCharacter(character, variant, spec) {
    const base = mathVariantBaseCharacter(character);
    const exceptions = MATH_VARIANT_EXCEPTIONS[variant] || {};
    if (Object.prototype.hasOwnProperty.call(exceptions, base)) return exceptions[base];
    const code = base.codePointAt(0);
    if (code >= 65 && code <= 90 && spec.upper != null) {
      return String.fromCodePoint(spec.upper + code - 65);
    }
    if (code >= 97 && code <= 122 && spec.lower != null) {
      return String.fromCodePoint(spec.lower + code - 97);
    }
    if (code >= 48 && code <= 57 && spec.digit != null) {
      return String.fromCodePoint(spec.digit + code - 48);
    }
    if (spec.greekUpper != null) {
      const upper = MATH_VARIANT_GREEK_UPPER.indexOf(base);
      if (upper >= 0) return String.fromCodePoint(spec.greekUpper + upper);
      if (base === '∇') return String.fromCodePoint(spec.greekUpper + MATH_VARIANT_GREEK_UPPER.length);
    }
    if (spec.greekLower != null) {
      const lower = MATH_VARIANT_GREEK_LOWER.indexOf(base);
      if (lower >= 0) return String.fromCodePoint(spec.greekLower + lower);
      const symbol = MATH_VARIANT_GREEK_SYMBOLS.indexOf(base);
      if (symbol >= 0) return String.fromCodePoint(spec.greekLower + MATH_VARIANT_GREEK_LOWER.length + symbol);
    }
    if (/^\s$/u.test(base) || /^\p{M}$/u.test(base)) return base;
    const point = character.codePointAt(0);
    if (point >= 0xe100 && point <= 0xe10f) return character;
    if (MATH_VARIANT_GREEK_UPPER.includes(base) || MATH_VARIANT_GREEK_LOWER.includes(base) ||
        MATH_VARIANT_GREEK_SYMBOLS.includes(base) || base === '∇' || /^[\p{L}\p{N}]$/u.test(base)) {
      return null;
    }
    return base;
  }

  function applyMathVariant(text, variant, fallbackLabel) {
    const value = String(text == null ? '' : text);
    const canonical = canonicalMathVariant(variant);
    if (!canonical) return value;
    if (canonical === 'normal') {
      return Array.from(value, (character) =>
        MATH_VARIANT_GREEK_SYMBOLS.includes(character) || character === 'ϴ'
          ? character
          : mathVariantBaseCharacter(character)
      ).join('');
    }
    const spec = MATH_VARIANT_SPECS[canonical];
    const label = String(fallbackLabel || canonical || 'mathvariant').replace(/[^a-z0-9_-]+/gi, '') || 'mathvariant';
    if (!spec) return label + '(' + value + ')';
    let converted = '';
    const characters = Array.from(value);
    for (let index = 0; index < characters.length;) {
      const styled = mathematicalVariantCharacter(characters[index], canonical, spec);
      if (styled != null) {
        converted += styled;
        index += 1;
        continue;
      }
      let unsupported = characters[index];
      index += 1;
      while (index < characters.length && mathematicalVariantCharacter(characters[index], canonical, spec) == null) {
        unsupported += characters[index];
        index += 1;
      }
      converted += label + '(' + unsupported + ')';
    }
    return converted;
  }

  function splitLatexTopLevel(input, kind) {
    const parts = [];
    let current = '';
    let depth = 0;
    let environmentDepth = 0;
    for (let index = 0; index < input.length; index += 1) {
      const character = input[index];
      if (character === '\\') {
        const environment = input.slice(index).match(/^\\(begin|end)\s*\{[^{}]+\}/);
        if (environment) {
          current += environment[0];
          environmentDepth = environment[1] === 'begin'
            ? environmentDepth + 1
            : Math.max(0, environmentDepth - 1);
          index += environment[0].length - 1;
          continue;
        }
      }
      if (character === '{' && (index === 0 || input[index - 1] !== '\\')) depth += 1;
      if (character === '}' && (index === 0 || input[index - 1] !== '\\')) depth = Math.max(0, depth - 1);

      const isCell = kind === 'cell' && character === '&' && depth === 0 && environmentDepth === 0;
      const isRow = kind === 'row' && character === '\\' && input[index + 1] === '\\' &&
        depth === 0 && environmentDepth === 0;
      if (isCell || isRow) {
        parts.push(current);
        current = '';
        if (isRow) {
          index += 1;
          // TeX permits optional vertical spacing after a row break, such as
          // `\\[3mu]`. It affects layout only and must never leak as text.
          const spacing = input.slice(index + 1).match(
            /^\s*\[\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*(?:mu|pt|pc|in|bp|cm|mm|dd|cc|sp|em|ex)\s*\]/i
          );
          if (spacing) index += spacing[0].length;
        }
      } else {
        current += character;
      }
    }
    parts.push(current);
    return parts;
  }

  function joinReadableEquationRows(rows) {
    return rows.reduce((output, row) => {
      if (!output) return row;
      return output + (/[,:;.]\s*$/u.test(output) ? ' ' : '; ') + row;
    }, '');
  }

  function convertLatexEnvironment(environment, body, options) {
    const env = environment.replace(/\*$/, '').toLowerCase();
    const calculatorMode = Boolean(options && options.calculatorMode);
    const convertCell = options && typeof options.convertCell === 'function'
      ? options.convertCell
      : latexToUnicode;
    let content = body;
    if (env === 'array' && /^\s*\{[^}]*\}/.test(content)) {
      content = content.replace(/^\s*\{[^}]*\}/, '');
    }
    if (env === 'alignedat' && /^\s*\{\s*\d{1,3}\s*\}/.test(content)) {
      // The mandatory alignedat column count controls layout only.
      content = content.replace(/^\s*\{\s*\d{1,3}\s*\}/, '');
    }
    const rows = splitLatexTopLevel(content, 'row').map((row) =>
      splitLatexTopLevel(row, 'cell').map((cell) => convertCell(cell.trim()))
    );
    if (env === 'cases') {
      if (calculatorMode) {
        return 'piecewise(' + rows.map((cells) => '[' + cells.join(',') + ']').join(',') + ')';
      }
      return '{ ' + rows.map((cells) => {
        if (cells.length < 2) return cells[0] || '';
        const condition = cells.slice(1).join(' ').trim();
        const separator = /^(?:if|when|for|otherwise)\b/i.test(condition) ? ' ' : ' if ';
        return cells[0] + separator + condition;
      }).join('; ') + ' }';
    }
    if (/matrix|array|smallmatrix/.test(env)) {
      if (calculatorMode) return '[' + rows.map((cells) => '[' + cells.join(',') + ']').join(',') + ']';
      return '[' + rows.map((cells) => cells.join(', ')).join('; ') + ']';
    }
    return joinReadableEquationRows(rows.map((cells) => cells.join('  ')));
  }

  class LatexParser {
    constructor(input, options) {
      this.calculatorMode = Boolean(options && options.calculatorMode);
      this.faithfulMode = Boolean(options && options.faithfulMode);
      const source = stripLatexDelimiters(input);
      this.input = (this.faithfulMode ? escapeFaithfulSentinelCollisions(source) : source)
        .replace(/(^|[^\\])%[^\n\r]*/g, '$1')
        .replace(/\\displaystyle\b/g, '');
      this.position = 0;
      this.budget = options && options.budget || { depth: 0, steps: 0 };
    }

    consumeStep() {
      this.budget.steps += 1;
      if (this.budget.steps > MAX_LATEX_PARSE_STEPS) {
        const error = new Error('LaTeX parse budget exceeded');
        error.code = LATEX_BUDGET_ERROR;
        throw error;
      }
    }

    nested(callback) {
      this.budget.depth += 1;
      if (this.budget.depth > MAX_LATEX_PARSE_DEPTH) {
        this.budget.depth -= 1;
        const error = new Error('LaTeX nesting budget exceeded');
        error.code = LATEX_BUDGET_ERROR;
        throw error;
      }
      try {
        return callback();
      } finally {
        this.budget.depth -= 1;
      }
    }

    parse(stopCharacter) {
      let output = '';
      while (this.position < this.input.length) {
        this.consumeStep();
        const character = this.input[this.position];
        if (stopCharacter && character === stopCharacter) {
          this.position += 1;
          break;
        }
        if (character === '{') {
          this.position += 1;
          const group = this.nested(() => this.parse('}'));
          output += this.calculatorMode
            ? '(' + group + ')'
            : (this.faithfulMode ? faithfulMarkedScope(group, false) : group);
          continue;
        }
        if (character === '}') {
          this.position += 1;
          if (stopCharacter) break;
          output += '}';
          continue;
        }
        if (character === '\\') {
          output += this.parseCommand();
          continue;
        }
        if (character === '^' || character === '_') {
          this.position += 1;
          const argument = this.parseArgument();
          output += this.faithfulMode
            ? (character === '^'
              ? toFaithfulScript(argument, SUPERSCRIPTS, '^')
              : toFaithfulScript(argument, SUBSCRIPTS, '_'))
            : (character === '^'
              ? toScript(argument, SUPERSCRIPTS, '^')
              : toScript(argument, SUBSCRIPTS, '_'));
          continue;
        }
        if (character === '~') {
          output += ' ';
          this.position += 1;
          continue;
        }
        if (/\s/.test(character)) {
          if (!this.faithfulMode) output += ' ';
          this.position += 1;
          while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
            this.position += 1;
          }
          continue;
        }
        output += character;
        this.position += 1;
      }
      return output;
    }

    parseArgument(rawText) {
      while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
        this.position += 1;
      }
      if (this.input[this.position] === '{') {
        if (rawText) return this.readRawGroup();
        this.position += 1;
        return this.nested(() => this.parse('}'));
      }
      if (this.input[this.position] === '\\') return this.nested(() => this.parseCommand());
      const character = this.input[this.position] || '';
      this.position += character ? 1 : 0;
      return character;
    }

    peekArgumentSource() {
      let cursor = this.position;
      while (cursor < this.input.length && /\s/.test(this.input[cursor])) cursor += 1;
      if (this.input[cursor] !== '{') {
        if (this.input[cursor] !== '\\') return this.input[cursor] || '';
        const command = this.input.slice(cursor).match(/^\\(?:[A-Za-z]+|.)/);
        return command ? command[0] : '';
      }
      const start = cursor + 1;
      cursor = start;
      let depth = 1;
      while (cursor < this.input.length && depth > 0) {
        const character = this.input[cursor];
        const escaped = cursor > start && this.input[cursor - 1] === '\\';
        if (!escaped && character === '{') depth += 1;
        else if (!escaped && character === '}') depth -= 1;
        cursor += 1;
      }
      return this.input.slice(start, depth === 0 ? cursor - 1 : cursor);
    }

    consumeDimension() {
      while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
        this.consumeStep();
        this.position += 1;
      }
      if (this.input[this.position] === '{') {
        this.readRawGroup();
        return;
      }
      const dimension = this.input.slice(this.position).match(
        /^[+\-]?(?:(?:\d+(?:\.\d*)?|\.\d+))(?:\s*true\s*)?[A-Za-z]+/
      );
      if (!dimension) return;
      for (let index = 0; index < dimension[0].length; index += 1) this.consumeStep();
      this.position += dimension[0].length;
    }

    readRawGroup() {
      while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
        this.position += 1;
      }
      if (this.input[this.position] !== '{') return this.parseArgument();
      this.position += 1;
      const start = this.position;
      let depth = 1;
      while (this.position < this.input.length && depth > 0) {
        this.consumeStep();
        const character = this.input[this.position];
        const escaped = this.position > 0 && this.input[this.position - 1] === '\\';
        if (!escaped && character === '{') depth += 1;
        if (!escaped && character === '}') depth -= 1;
        this.position += 1;
      }
      return this.input.slice(start, depth === 0 ? this.position - 1 : this.position);
    }

    parseOptionalArgument() {
      while (this.position < this.input.length && /\s/.test(this.input[this.position])) this.position += 1;
      if (this.input[this.position] !== '[') return '';
      this.position += 1;
      const start = this.position;
      let depth = 1;
      while (this.position < this.input.length && depth > 0) {
        this.consumeStep();
        if (this.input[this.position] === '[') depth += 1;
        if (this.input[this.position] === ']') depth -= 1;
        this.position += 1;
      }
      return this.input.slice(start, this.position - 1);
    }

    readCommandName() {
      this.position += 1;
      if (this.position >= this.input.length) return '';
      if (!/[A-Za-z]/.test(this.input[this.position])) {
        const symbol = this.input[this.position];
        this.position += 1;
        return symbol;
      }
      const start = this.position;
      while (this.position < this.input.length && /[A-Za-z]/.test(this.input[this.position])) {
        this.consumeStep();
        this.position += 1;
      }
      return this.input.slice(start, this.position);
    }

    readEnvironmentBody(environment) {
      const start = this.position;
      const beginToken = '\\begin{' + environment + '}';
      const endToken = '\\end{' + environment + '}';
      let depth = 1;
      let cursor = this.position;
      while (cursor < this.input.length) {
        this.consumeStep();
        const nextBegin = this.input.indexOf(beginToken, cursor);
        const nextEnd = this.input.indexOf(endToken, cursor);
        if (nextEnd < 0) {
          this.position = this.input.length;
          return this.input.slice(start);
        }
        if (nextBegin >= 0 && nextBegin < nextEnd) {
          depth += 1;
          cursor = nextBegin + beginToken.length;
        } else {
          depth -= 1;
          if (depth === 0) {
            const body = this.input.slice(start, nextEnd);
            this.position = nextEnd + endToken.length;
            return body;
          }
          cursor = nextEnd + endToken.length;
        }
      }
      this.position = this.input.length;
      return this.input.slice(start);
    }

    parseDelimiter() {
      while (this.position < this.input.length && /\s/.test(this.input[this.position])) this.position += 1;
      if (this.input[this.position] === '\\') {
        const name = this.readCommandName();
        const delimiters = {
          lbrace: '{', rbrace: '}', langle: '⟨', rangle: '⟩',
          lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉',
          vert: '|', Vert: '‖', '{': '{', '}': '}', '|': '|', '.': ''
        };
        return Object.prototype.hasOwnProperty.call(delimiters, name) ? delimiters[name] : (SYMBOLS[name] || name);
      }
      const delimiter = this.input[this.position] || '';
      this.position += delimiter ? 1 : 0;
      return delimiter === '.' ? '' : delimiter;
    }

    skipCalculatorSpacing() {
      let skipped = false;
      while (this.position < this.input.length) {
        const rest = this.input.slice(this.position);
        const whitespace = rest.match(/^(?:\s+|~+)/);
        if (whitespace) {
          this.position += whitespace[0].length;
          skipped = true;
          continue;
        }
        const shortCommand = rest.match(/^\\[,!:; >\/]/);
        if (shortCommand) {
          this.position += shortCommand[0].length;
          skipped = true;
          continue;
        }
        const namedCommand = rest.match(/^\\(?:quad|qquad|enspace)\b/);
        if (namedCommand) {
          this.position += namedCommand[0].length;
          skipped = true;
          continue;
        }
        const hspace = rest.match(/^\\hspace\*?\s*\{[^{}]*\}/);
        if (hspace) {
          this.position += hspace[0].length;
          skipped = true;
          continue;
        }
        break;
      }
      return skipped;
    }

    parseNestedSource(source, mode) {
      return this.nested(() => {
        const parsed = new LatexParser(source, {
          calculatorMode: mode === 'calculator',
          faithfulMode: mode === 'faithful',
          budget: this.budget
        }).parse();
        if (mode === 'faithful') return formatFaithfulMathText(parsed);
        if (mode === 'unicode') return formatMathText(parsed);
        return parsed;
      });
    }

    parseCalculatorInner(source) {
      return this.parseNestedSource(source, 'calculator');
    }

    parseUnicodeInner(source) {
      return this.parseNestedSource(source, 'unicode');
    }

    parseFaithfulInner(source) {
      return this.parseNestedSource(source, 'faithful');
    }

    rawDelimiterAt(position) {
      let cursor = position;
      while (cursor < this.input.length && /\s/.test(this.input[cursor])) cursor += 1;
      if (this.input[cursor] !== '\\') {
        return { value: this.input[cursor] || '', end: cursor + (this.input[cursor] ? 1 : 0) };
      }
      const match = this.input.slice(cursor).match(/^\\([A-Za-z]+|.)/);
      if (!match) return { value: '', end: cursor };
      const delimiters = {
        lbrace: '{', rbrace: '}', lbrack: '[', rbrack: ']', lparen: '(', rparen: ')',
        lvert: '|', rvert: '|', vert: '|', lVert: '‖', rVert: '‖', Vert: '‖',
        '{': '{', '}': '}', '[': '[', ']': ']', '(': '(', ')': ')', '|': '|', '.': ''
      };
      return {
        value: Object.prototype.hasOwnProperty.call(delimiters, match[1]) ? delimiters[match[1]] : match[1],
        end: cursor + match[0].length
      };
    }

    parseCalculatorDelimitedArgument() {
      const original = this.position;
      const sizePrefix = this.input.slice(this.position).match(/^\\(?:big|Big|bigg|Bigg|bigl|Bigl|biggl|Biggl)\b/);
      if (sizePrefix) this.position += sizePrefix[0].length;

      if (this.input.slice(this.position).startsWith('\\left')) {
        this.position += '\\left'.length;
        const opening = this.rawDelimiterAt(this.position);
        this.position = opening.end;
        const innerStart = this.position;
        const matcher = /\\(left|right)\b/g;
        matcher.lastIndex = innerStart;
        let depth = 1;
        let match;
        while ((match = matcher.exec(this.input))) {
          depth += match[1] === 'left' ? 1 : -1;
          if (depth !== 0) continue;
          const inner = this.input.slice(innerStart, match.index);
          const closing = this.rawDelimiterAt(matcher.lastIndex);
          this.position = closing.end;
          const value = this.parseCalculatorInner(inner);
          const bars = /^(?:\||‖)$/.test(opening.value) && /^(?:\||‖)$/.test(closing.value);
          return { matched: true, value: bars ? 'abs(' + value + ')' : value };
        }
        this.position = original;
        return { matched: false, value: '' };
      }

      const commandFence = this.input.slice(this.position).match(/^\\(lvert|vert|lVert|Vert|lbrace|\{)/);
      if (commandFence) {
        const openName = commandFence[1];
        const closingPattern = /^(?:lvert|vert)$/.test(openName)
          ? /\\(?:rvert|vert)\b/g
          : (/^(?:lVert|Vert)$/.test(openName) ? /\\(?:rVert|Vert)\b/g : /\\(?:rbrace|\})/g);
        const innerStart = this.position + commandFence[0].length;
        closingPattern.lastIndex = innerStart;
        const closing = closingPattern.exec(this.input);
        if (closing) {
          const value = this.parseCalculatorInner(this.input.slice(innerStart, closing.index));
          this.position = closing.index + closing[0].length;
          return {
            matched: true,
            value: /vert/i.test(openName) ? 'abs(' + value + ')' : value
          };
        }
      }

      const open = this.input[this.position];
      const pairs = { '(': ')', '[': ']', '|': '|', '‖': '‖' };
      if (!Object.prototype.hasOwnProperty.call(pairs, open)) {
        this.position = original;
        return { matched: false, value: '' };
      }
      const close = pairs[open];
      this.position += 1;
      const innerStart = this.position;
      let depth = 1;
      while (this.position < this.input.length && depth > 0) {
        const character = this.input[this.position];
        const escaped = this.position > innerStart && this.input[this.position - 1] === '\\';
        if (!escaped && open !== close && character === open) depth += 1;
        if (!escaped && character === close) depth -= 1;
        this.position += 1;
      }
      if (depth !== 0) {
        this.position = original;
        return { matched: false, value: '' };
      }
      let inner = this.input.slice(innerStart, this.position - 1);
      if (sizePrefix) inner = inner.replace(/\\(?:bigr|Bigr|biggr|Biggr)\s*$/, '');
      const value = this.parseCalculatorInner(inner);
      return { matched: true, value: open === '|' || open === '‖' ? 'abs(' + value + ')' : value };
    }

    parseCalculatorArgumentAtom() {
      let unary = '';
      if (/[+\-−]/.test(this.input[this.position] || '')) {
        unary = this.input[this.position] === '−' ? '-' : this.input[this.position];
        this.position += 1;
        this.skipCalculatorSpacing();
      }
      const delimited = this.parseCalculatorDelimitedArgument();
      let argument = delimited.matched ? delimited.value : this.parseArgument();
      if (!argument) return '';
      argument = unary + argument;
      while (this.position < this.input.length) {
        const checkpoint = this.position;
        while (this.position < this.input.length && /\s/.test(this.input[this.position])) this.position += 1;
        const marker = this.input[this.position];
        if (marker !== '^' && marker !== '_') {
          this.position = checkpoint;
          break;
        }
        this.position += 1;
        const script = this.parseArgument();
        argument += marker + '(' + script + ')';
      }
      return argument;
    }

    parseCalculatorFunction(symbol) {
      const start = this.position;
      const scripts = { '^': '', '_': '' };
      this.skipCalculatorSpacing();
      while (this.input[this.position] === '^' || this.input[this.position] === '_') {
        const marker = this.input[this.position];
        this.position += 1;
        scripts[marker] = this.parseArgument();
        this.skipCalculatorSpacing();
      }

      const next = this.input[this.position] || '';
      const delimitedStart = /^(?:[([|‖]|\\(?:left\b|lvert\b|vert\b|lVert\b|Vert\b|lbrace\b|\{|big\b|Big\b|bigg\b|Bigg\b|bigl\b|Bigl\b|biggl\b|Biggl\b))/.test(this.input.slice(this.position));
      const callable = delimitedStart || (next && !/[=,;:)}\]]/.test(next) && !/[*/^_]/.test(next));
      if (!callable) {
        this.position = start;
        return symbol;
      }

      const argument = this.parseCalculatorArgumentAtom();
      if (!argument) {
        this.position = start;
        return symbol;
      }
      const plainSymbol = symbol.startsWith(DECLARED_OPERATOR_START) && symbol.endsWith(DECLARED_OPERATOR_END)
        ? symbol.slice(DECLARED_OPERATOR_START.length, -DECLARED_OPERATOR_END.length)
        : symbol;
      const inverseName = scripts['^'] === '-1' && CALCULATOR_INVERSE_FUNCTIONS[plainSymbol];
      let call = (inverseName || symbol) + '(' + argument + ')';
      if (scripts['_']) {
        call = plainSymbol === 'log'
          ? '(' + symbol + '(' + argument + ')/' + symbol + '(' + scripts['_'] + '))'
          : call + '_(' + scripts['_'] + ')';
      }
      if (scripts['^'] && !inverseName) call += '^(' + scripts['^'] + ')';
      return call;
    }

    parseFaithfulFunction(symbol) {
      const scripts = { '^': '', '_': '' };
      this.skipCalculatorSpacing();
      while (this.input[this.position] === '^' || this.input[this.position] === '_') {
        const marker = this.input[this.position];
        this.position += 1;
        scripts[marker] = this.parseArgument();
        this.skipCalculatorSpacing();
      }
      return symbol +
        (scripts['_'] ? toFaithfulScript(scripts['_'], SUBSCRIPTS, '_') : '') +
        (scripts['^'] ? toFaithfulScript(scripts['^'], SUPERSCRIPTS, '^') : '') +
        FAITHFUL_FUNCTION_APPLY;
    }

    parseCalculatorAggregate(name) {
      const scripts = { '^': '', '_': '' };
      this.skipCalculatorSpacing();
      while (this.input[this.position] === '^' || this.input[this.position] === '_') {
        const marker = this.input[this.position];
        this.position += 1;
        scripts[marker] = this.parseArgument();
        this.skipCalculatorSpacing();
      }
      const body = this.parseCalculatorArgumentAtom();
      const functionNames = {
        sum: 'sum', prod: 'product', int: 'integral', iint: 'double_integral',
        iiint: 'triple_integral', oint: 'contour_integral', lim: 'limit'
      };
      if (!body) return SYMBOLS[name] || name;
      if (name === 'lim') return 'limit(' + body + (scripts['_'] ? ',' + scripts['_'] : '') + ')';
      if (['sum', 'prod'].includes(name)) {
        return functionNames[name] + '(' + [body, scripts['_'], scripts['^']].filter(Boolean).join(',') + ')';
      }
      const checkpoint = this.position;
      this.skipCalculatorSpacing();
      let variable = '';
      if (this.input[this.position] === 'd') {
        this.position += 1;
        variable = this.parseArgument();
      } else this.position = checkpoint;
      return functionNames[name] + '(' + [body, variable, scripts['_'], scripts['^']].filter(Boolean).join(',') + ')';
    }

    parseCommand() {
      const name = this.readCommandName();
      if (!name) return '\\';
      if (this.calculatorMode && ['sum', 'prod', 'int', 'iint', 'iiint', 'oint', 'lim'].includes(name)) {
        return this.parseCalculatorAggregate(name);
      }
      if (this.calculatorMode && name === 'mid') return RELATIONAL_MID;
      if (this.faithfulMode && name === 'lvert') return FAITHFUL_ABS_OPEN;
      if (this.faithfulMode && name === 'rvert') return FAITHFUL_ABS_CLOSE;
      if (this.faithfulMode && name === 'lVert') return FAITHFUL_NORM_OPEN;
      if (this.faithfulMode && name === 'rVert') return FAITHFUL_NORM_CLOSE;
      if (Object.prototype.hasOwnProperty.call(SYMBOLS, name)) {
        const symbol = SYMBOLS[name];
        if (this.calculatorMode && CALCULATOR_FUNCTIONS.has(symbol)) return this.parseCalculatorFunction(symbol);
        if (this.faithfulMode && CALCULATOR_FUNCTIONS.has(symbol)) return this.parseFaithfulFunction(symbol);
        return symbol;
      }
      if (name === '\\') return ' ';
      if (name === ' ' || name === ',' || name === ':' || name === ';' || name === '>' || name === '!') {
        return name === '!' ? '' : ' ';
      }
      if ('%_$#&{}'.includes(name)) return name;

      if (name === 'frac' || name === 'dfrac' || name === 'tfrac' || name === 'cfrac') {
        const numerator = this.parseArgument();
        const denominatorSource = this.faithfulMode ? this.peekArgumentSource() : '';
        const denominator = this.parseArgument();
        if (this.calculatorMode) {
          return calculatorFraction(unicodeToCalculator(numerator), unicodeToCalculator(denominator));
        }
        if (this.faithfulMode) return faithfulFraction(
          numerator,
          denominator,
          faithfulLatexDenominatorOptions(denominatorSource)
        );
        return '(' + numerator + ')/(' + denominator + ')';
      }
      if (name === 'binom' || name === 'dbinom' || name === 'tbinom') {
        return 'C(' + this.parseArgument() + ', ' + this.parseArgument() + ')';
      }
      if (name === 'sqrt') {
        const index = this.parseOptionalArgument();
        const radicand = this.parseArgument();
        if (index && this.calculatorMode) return '(' + radicand + ')^(1/(' + this.parseUnicodeInner(index) + '))';
        if (this.calculatorMode) return 'sqrt(' + stripBalancedOuterParentheses(radicand) + ')';
        if (this.faithfulMode) {
          const faithfulIndex = index ? this.parseFaithfulInner(index) : '';
          return faithfulRoot(faithfulIndex, radicand);
        }
        const root = index ? toScript(this.parseUnicodeInner(index), SUPERSCRIPTS, '^') + '√' : '√';
        return root + '(' + radicand + ')';
      }
      if (['text', 'textrm', 'textnormal', 'mbox', 'hbox'].includes(name)) {
        const value = this.readRawGroup().replace(/~/g, ' ').replace(/\\([%_$#&{}])/g, '$1');
        return this.faithfulMode ? protectFaithfulText(value) : value;
      }
      if (['mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'boldsymbol', 'bm', 'operatorname'].includes(name)) {
        if (name === 'operatorname' && this.input[this.position] === '*') this.position += 1;
        const value = this.parseArgument();
        if (name === 'operatorname' && this.calculatorMode && /^[A-Za-z][A-Za-z0-9_]*$/.test(value)) {
          const declared = DECLARED_OPERATOR_START + value + DECLARED_OPERATOR_END;
          return this.parseCalculatorFunction(declared);
        }
        if (name === 'operatorname' && this.faithfulMode && /^[A-Za-z][A-Za-z0-9_]*$/.test(value)) {
          return this.parseFaithfulFunction(value);
        }
        if (this.faithfulMode && name !== 'operatorname') {
          const variants = {
            mathrm: 'normal', mathbf: 'bold', mathit: 'italic',
            mathsf: 'sans-serif', mathtt: 'monospace',
            boldsymbol: 'bold-italic', bm: 'bold-italic'
          };
          return applyMathVariant(value, variants[name], name);
        }
        if (this.calculatorMode && /^[A-Za-z][A-Za-z0-9_]*$/.test(value)) {
          return DECLARED_IDENTIFIER_START + value + DECLARED_IDENTIFIER_END;
        }
        return this.calculatorMode && !calculatorSimpleTerm(unicodeToCalculator(value))
          ? '(' + value + ')'
          : value;
      }
      if (['mathbb', 'Bbb'].includes(name)) {
        return applyMathVariant(this.parseArgument(), 'double-struck', this.faithfulMode ? name : 'double-struck');
      }
      if (['mathcal', 'mathscr', 'mathfrak'].includes(name)) {
        const variants = { mathcal: 'script', mathscr: 'script', mathfrak: 'fraktur' };
        return applyMathVariant(this.parseArgument(), variants[name], this.faithfulMode ? name : variants[name]);
      }
      if (['color', 'class', 'cssId', 'style'].includes(name)) {
        this.parseArgument();
        return this.parseArgument();
      }
      if (name === 'textcolor' || name === 'colorbox' || name === 'fcolorbox') {
        this.parseArgument();
        if (name === 'fcolorbox') this.parseArgument();
        return this.parseArgument();
      }
      if (name === 'href') {
        this.parseArgument();
        return this.parseArgument();
      }
      if (name === 'url') return this.readRawGroup();
      if (name === 'phantom' || name === 'hphantom' || name === 'vphantom') {
        this.parseArgument();
        return '';
      }
      if (name === 'left' || name === 'right' || name === 'middle' || name === 'big' ||
          name === 'Big' || name === 'bigg' || name === 'Bigg' || name === 'bigl' ||
          name === 'bigr' || name === 'Bigl' || name === 'Bigr' || name === 'biggl' ||
          name === 'biggr' || name === 'Biggl' || name === 'Biggr') {
        const delimiter = this.parseDelimiter();
        if (this.faithfulMode && name === 'left' && delimiter === '|') return FAITHFUL_ABS_OPEN;
        if (this.faithfulMode && name === 'right' && delimiter === '|') return FAITHFUL_ABS_CLOSE;
        if (this.faithfulMode && name === 'left' && delimiter === '‖') return FAITHFUL_NORM_OPEN;
        if (this.faithfulMode && name === 'right' && delimiter === '‖') return FAITHFUL_NORM_CLOSE;
        return delimiter;
      }
      if (name === 'not') {
        while (this.position < this.input.length && /\s/.test(this.input[this.position])) this.position += 1;
        if (this.input[this.position] === '\\') {
          const nextName = this.readCommandName();
          return NEGATED_SYMBOLS[nextName] || ('not ' + (SYMBOLS[nextName] || nextName));
        }
        const character = this.input[this.position] || '';
        this.position += character ? 1 : 0;
        return NEGATED_SYMBOLS[character] || ('not ' + character);
      }
      if (name === 'pmod' || name === 'pod') return '(' + (name === 'pmod' ? 'mod ' : '') + this.parseArgument() + ')';
      if (name === 'mod' || name === 'bmod') return ' mod ';
      if (name === 'space') return ' ';
      if (name === 'quad' || name === 'qquad' || name === 'enspace' || name === 'hspace' || name === 'hspace*') {
        if (name === 'hspace' && this.input[this.position] === '*') this.position += 1;
        if (name.startsWith('hspace')) this.parseArgument();
        return ' ';
      }
      if (['displaystyle', 'textstyle', 'scriptstyle', 'scriptscriptstyle', 'limits', 'nolimits'].includes(name)) return '';
      if (name === 'kern' || name === 'mkern' || name === 'hskip' || name === 'mskip') {
        this.consumeDimension();
        return this.faithfulMode ? ' ' : '';
      }
      if (name === 'raisebox' || name === 'rule') {
        this.parseArgument();
        if (name === 'raisebox') return this.parseArgument();
        return '';
      }
      const accents = {
        overline: '\u0305', bar: '\u0305', overbrace: '\u0305',
        underline: '\u0332', underbrace: '\u0332', hat: '\u0302', widehat: '\u0302',
        tilde: '\u0303', widetilde: '\u0303', vec: '\u20d7', overrightarrow: '\u20d7',
        overleftarrow: '\u20d6', dot: '\u0307', ddot: '\u0308', acute: '\u0301',
        grave: '\u0300', breve: '\u0306', check: '\u030c', mathring: '\u030a'
      };
      if (Object.prototype.hasOwnProperty.call(accents, name)) {
        const value = this.parseArgument();
        return this.faithfulMode ? faithfulAccent(name, value, accents[name]) : value + accents[name];
      }
      if (name === 'overset' || name === 'stackrel') {
        const over = this.parseArgument();
        const base = this.parseArgument();
        if (this.faithfulMode) {
          const readableBase = resolveFaithfulScopes(base).trim();
          if (/^(?:∑|∏|∐|∫|∬|∭|∮|lim)$/u.test(readableBase)) {
            return base + toFaithfulScript(over, SUPERSCRIPTS, '^');
          }
          const annotation = 'overset(' + over + ', ' + base + ')';
          return /^[=+−±∓<>≠≈≃≅≡≤≥∈∉∋∌⊂⊃⊆⊇⊊⊋∣-∦∝←-⇿⟵-⟺]$/u.test(readableBase)
            ? ' ' + annotation + ' '
            : annotation;
        }
        return base + toScript(over, SUPERSCRIPTS, '^');
      }
      if (name === 'underset') {
        const under = this.parseArgument();
        const base = this.parseArgument();
        if (this.faithfulMode) {
          const readableBase = resolveFaithfulScopes(base).trim();
          if (/^(?:∑|∏|∐|∫|∬|∭|∮|lim)$/u.test(readableBase)) {
            return base + toFaithfulScript(under, SUBSCRIPTS, '_');
          }
          const annotation = 'underset(' + under + ', ' + base + ')';
          return /^[=+−±∓<>≠≈≃≅≡≤≥∈∉∋∌⊂⊃⊆⊇⊊⊋∣-∦∝←-⇿⟵-⟺]$/u.test(readableBase)
            ? ' ' + annotation + ' '
            : annotation;
        }
        return base + toScript(under, SUBSCRIPTS, '_');
      }
      if (name === 'begin') {
        const environment = this.readRawGroup();
        const body = this.readEnvironmentBody(environment);
        return convertLatexEnvironment(environment, body, {
          calculatorMode: this.calculatorMode,
          faithfulMode: this.faithfulMode,
          convertCell: (cell) => this.calculatorMode
            ? this.parseCalculatorInner(cell)
            : (this.faithfulMode ? this.parseFaithfulInner(cell) : this.parseUnicodeInner(cell))
        });
      }
      if (name === 'end') {
        this.readRawGroup();
        return '';
      }
      if (name === 'tag' || name === 'label') {
        if (name === 'tag' && this.input[this.position] === '*') this.position += 1;
        const value = this.parseArgument();
        return name === 'tag' ? ' (' + value + ')' : '';
      }
      if (name === 'prescript') {
        const upper = this.parseArgument();
        const lower = this.parseArgument();
        const base = this.parseArgument();
        if (this.faithfulMode) {
          const upperScript = toFaithfulScript(upper, SUPERSCRIPTS, '^');
          const lowerScript = toFaithfulScript(lower, SUBSCRIPTS, '_');
          if (upperScript.startsWith('^') || lowerScript.startsWith('_')) {
            return 'prescript(' + upper + ', ' + lower + ', ' + base + ')';
          }
          return upperScript + lowerScript + base;
        }
        return toScript(upper, SUPERSCRIPTS, '^') + toScript(lower, SUBSCRIPTS, '_') + base;
      }
      if (['boxed', 'cancel', 'bcancel', 'xcancel', 'cancelto'].includes(name)) {
        const target = name === 'cancelto' ? this.parseArgument() : '';
        const value = this.parseArgument();
        if (this.faithfulMode) {
          return name === 'cancelto'
            ? 'cancelto(' + target + ', ' + value + ')'
            : name + '(' + value + ')';
        }
        return name === 'boxed' ? 'boxed(' + value + ')' : value;
      }
      if (name === 'substack') {
        return splitLatexTopLevel(this.readRawGroup(), 'row').map((row) => this.parseUnicodeInner(row)).join(', ');
      }
      if (name === 'ce' || name === 'pu') return this.readRawGroup();

      if (this.input[this.position] === '{') {
        return '\\' + name + '(' + this.parseArgument() + ')';
      }
      return '\\' + name;
    }
  }

  function formatMathText(input) {
    let text = cleanClipboardText(String(input == null ? '' : input));
    text = text
      .replace(/[\u2061]/g, ' ')
      .replace(/[\u2062]/g, '·')
      .replace(/[\u2063]/g, ', ')
      .replace(/[\u2064]/g, '+')
      .replace(/[\t\r\n ]+/g, ' ')
      .replace(/\s*([=≠≈≃≅≡≤≥<>∈∉∋⊂⊃⊆⊇≺≻≼≽∝⇒⇔↔→←↦])\s*/g, ' $1 ')
      .replace(/([\p{L}\p{N}\p{M})\]}])\s*([+−-])\s*(?=[\p{L}\p{N}\p{M}(\[{√])/gu, '$1 $2 ')
      .replace(/\s*([×÷±∓∪∩∧∨⊕⊗])\s*/g, ' $1 ')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s*;\s*/g, '; ')
      .replace(/([([{⟨⌈⌊])\s+/g, '$1')
      .replace(/([\p{L}\p{N}])\s+\(/gu, '$1(')
      .replace(/\s+([)\]}⟩⌉⌋,.;:!?])/g, '$1')
      .replace(/[ ]{2,}/g, ' ')
      .trim();
    return text.normalize ? text.normalize('NFC') : text;
  }

  function latexToUnicode(input) {
    try {
      const source = String(input == null ? '' : input);
      if (source.length > MAX_MATH_SOURCE_LENGTH) return '';
      return formatMathText(new LatexParser(source).parse());
    } catch (_error) {
      // Page-authored TeX must never be able to abort a copy event. Budget,
      // stack, parser, and host-object failures all decline conversion.
      return '';
    }
  }

  function formatFaithfulMathText(input, retainProtectedText) {
    let text = resolveFaithfulScopes(cleanClipboardText(String(input == null ? '' : input)));
    text = text
      .replace(/([0-9])\u2062(?=[0-9])/g, '$1⋅')
      .replace(/[\u2061]/g, '')
      .replace(/[\u2062]/g, '')
      .replace(/[\u2063]/g, ', ')
      .replace(/[\u2064]/g, '+')
      .replace(new RegExp(FAITHFUL_FUNCTION_APPLY + '(?=\\s*\\()', 'g'), '')
      .replace(new RegExp(FAITHFUL_FUNCTION_APPLY, 'g'), ' ')
      .replace(new RegExp(FAITHFUL_ABS_OPEN + '\\s*', 'g'), '|')
      .replace(new RegExp('\\s*' + FAITHFUL_ABS_CLOSE, 'g'), '|')
      .replace(new RegExp(FAITHFUL_NORM_OPEN + '\\s*', 'g'), '‖')
      .replace(new RegExp('\\s*' + FAITHFUL_NORM_CLOSE, 'g'), '‖')
      .replace(/([\p{L}\p{N}\p{M})\]}\u2032-\u2034])('+)/gu,
        (_match, base, primes) => base + primes.replace(/'/g, '′'))
      .replace(/[\t\r\n ]+/g, ' ')
      .replace(/-/g, '−')
      .replace(/\s*([=≠≈≃≅≡≤≥<>∈∉∋∌⊂⊃⊆⊇⊊⊋≺≻≼≽∝⇐⇒⇔↔→←↦∣-∦⟵-⟺])\s*/g, ' $1 ')
      .replace(/([|∣∥‖])\s+(?=[₀-₟⁰-⁹¹²³⁺⁻⁼⁽⁾ⁿⁱᵢⱼᵦ-ᵪ_^])/gu, '$1')
      .replace(/([\p{L}\p{N}\p{M})\]}])\s*([+−-])\s*(?=[\p{L}\p{N}\p{M}(\[{\u221a])/gu, '$1 $2 ')
      .replace(/\s*([×÷·⋅∗∙∖±∓∪∩∧∨⊕⊗])\s*/g, ' $1 ')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s*;\s*/g, '; ')
      .replace(/([([{\u27e8\u2308\u230a])\s+/g, '$1')
      .replace(/\s+([)\]}\u27e9\u2309\u230b,.;:!?])/g, '$1')
      .replace(/√\s+\(/g, '√(')
      .replace(/(lim(?![\p{Ll}\p{Lu}])(?:_\([^)]*\)|[\u2080-\u209cᵢⱼᵦ-ᵪ]+)?(?:\^\([^)]*\)|[⁰-⁹⁺⁻⁼⁽⁾ⁿⁱ]+)?)(?=[\p{Ll}\p{Lu}\p{Nd}√(|‖])/gu, '$1 ')
      .replace(/((?:∑|∏|∐|∫|∬|∭|∮)(?:_\([^)]*\)|[\u2080-\u209cᵢⱼᵦ-ᵪ]+)?(?:\^\([^)]*\)|[⁰-⁹⁺⁻⁼⁽⁾ⁿⁱ¹²³]+)?)(?=[\p{Ll}\p{Lu}\p{Nd}√(|‖])/gu, '$1 ')
      .replace(/[ ]{2,}/g, ' ')
      .trim();
    text = text.replace(/[\ue100-\ue10d]/g, '');
    if (!retainProtectedText) text = restoreFaithfulText(text);
    return text.normalize ? text.normalize('NFC') : text;
  }

  function latexToFaithful(input) {
    try {
      const source = String(input == null ? '' : input);
      if (source.length > MAX_MATH_SOURCE_LENGTH) return '';
      return formatFaithfulMathText(new LatexParser(source, { faithfulMode: true }).parse());
    } catch (_error) {
      return '';
    }
  }

  function unicodeToAscii(input) {
    let text = '';
    for (const character of String(input)) {
      if (Object.prototype.hasOwnProperty.call(ASCII_SYMBOLS, character)) {
        text += ASCII_SYMBOLS[character];
        continue;
      }
      const superscriptEntry = Object.entries(SUPERSCRIPTS).find((entry) => entry[1] === character);
      if (superscriptEntry) {
        text += '^' + superscriptEntry[0];
        continue;
      }
      const subscriptEntry = Object.entries(SUBSCRIPTS).find((entry) => entry[1] === character);
      if (subscriptEntry) {
        text += '_' + subscriptEntry[0];
        continue;
      }
      text += character;
    }
    return text.replace(/[ ]{2,}/g, ' ').trim();
  }

  const CALCULATOR_FUNCTIONS = new Set([
    'C', 'abs', 'acos', 'acosh', 'arccos', 'arcsin', 'arctan', 'arg', 'asin', 'asinh',
    'atan', 'atanh', 'ceil', 'cos', 'cosh', 'cot', 'csc', 'det', 'exp', 'floor',
    'gcd', 'integral', 'limit', 'ln', 'log', 'max', 'min', 'mod', 'norm', 'product',
    'piecewise', 'round', 'sec', 'sign', 'sin', 'sinh', 'sqrt', 'sum', 'tan', 'tanh',
    'double_integral', 'triple_integral', 'contour_integral'
  ]);

  const CALCULATOR_IMPLICIT_FUNCTIONS = new Set(['f', 'g', 'h', 'F', 'G', 'H', 'P']);

  const CALCULATOR_INVERSE_FUNCTIONS = Object.freeze({
    sin: 'asin', cos: 'acos', tan: 'atan',
    sinh: 'asinh', cosh: 'acosh', tanh: 'atanh'
  });

  const CALCULATOR_WORDS = new Set([
    ...CALCULATOR_FUNCTIONS,
    ...Object.values(ASCII_SYMBOLS).flatMap((value) => String(value).match(/[A-Za-z]+/g) || []),
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota',
    'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma', 'tau',
    'upsilon', 'phi', 'chi', 'psi', 'omega', 'infinity', 'partial', 'nabla',
    'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi',
    'Psi', 'Omega', 'propto', 'boxed', 'lim', 'limsup', 'liminf', 'sup', 'inf'
  ]);

  const CALCULATOR_WORD_OPERATOR_GLYPHS = Object.freeze({
    '∈': ' in ', '∉': ' not in ', '∋': ' contains ',
    '⊂': ' subset ', '⊆': ' subseteq ', '⊃': ' superset ', '⊇': ' superseteq ',
    '∪': ' union ', '∩': ' intersection ', '∧': ' && ', '∨': ' || ', '¬': '!',
    '∀': 'for all ', '∃': 'exists ', '∄': 'not exists ', '∥': ' parallel '
  });

  function decodeUnicodeScripts(input) {
    const superscriptReverse = Object.fromEntries(Object.entries(SUPERSCRIPTS).map(([plain, script]) => [script, plain]));
    const subscriptReverse = Object.fromEntries(Object.entries(SUBSCRIPTS).map(([plain, script]) => [script, plain]));
    let output = '';
    for (let index = 0; index < input.length;) {
      const character = input[index];
      const map = superscriptReverse[character] != null
        ? superscriptReverse
        : (subscriptReverse[character] != null ? subscriptReverse : null);
      if (!map) {
        output += character;
        index += 1;
        continue;
      }
      let decoded = '';
      while (index < input.length && map[input[index]] != null) {
        decoded += map[input[index]];
        index += 1;
      }
      output += map === superscriptReverse ? '^(' + decoded + ')' : '_(' + decoded + ')';
    }
    return output;
  }

  function replaceNestedAbsoluteBars(input) {
    const source = String(input)
      // Markdown renderers occasionally leak their bold markers into the
      // accessibility text around a single identifier: |**q**|. Remove only
      // double emphasis markers touching a fence; a real multiplication '*'
      // elsewhere remains untouched.
      .replace(/([|∣❘])\s*\*{2}/g, '$1')
      .replace(/\*{2}\s*([|∣❘])/g, '$1');
    const barCount = (source.match(/[|∣❘‖∥]/g) || []).length;
    if (!barCount || barCount % 2 !== 0) return source;
    // When a paired bar sequence has operands on both outer sides it is
    // lexically ambiguous (conditional probability, set-builder notation,
    // divisibility, or multiplication by an absolute value). Structural
    // MathML handles true fences; raw Unicode is safer left unchanged here.
    const firstBar = source.search(/[|∣❘‖∥]/);
    let lastBar = -1;
    for (let index = source.length - 1; index >= 0; index -= 1) {
      if (/[|∣❘‖∥]/.test(source[index])) { lastBar = index; break; }
    }
    const beforeOuter = source.slice(0, firstBar).trimEnd().slice(-1);
    const afterOuter = source.slice(lastBar + 1).trimStart().slice(0, 1);
    if (/[\p{L}\p{N}\p{M})\]}]/u.test(beforeOuter) && /[\p{L}\p{N}\p{M}([{]/u.test(afterOuter)) return source;

    let output = '';
    let depth = 0;
    const canEndOperand = (character) => Boolean(character && /[\p{L}\p{N}\p{M})\]}!%]/u.test(character));
    const previousSignificant = () => {
      for (let index = output.length - 1; index >= 0; index -= 1) {
        if (!/\s/.test(output[index])) return output[index];
      }
      return '';
    };

    for (const character of source) {
      if (!/[|∣❘‖∥]/.test(character)) {
        output += character;
        continue;
      }
      const previous = previousSignificant();
      if (depth > 0 && canEndOperand(previous)) {
        output += ')';
        depth -= 1;
      } else {
        if (depth === 0 && canEndOperand(previous)) output += '*';
        output += 'abs(';
        depth += 1;
      }
    }
    // A malformed or non-fence use of vertical bars is safer left intact than
    // rewritten into an unbalanced calculator expression.
    return depth === 0 ? output : source;
  }

  function applyBareCalculatorFunctions(input) {
    const names = Array.from(CALCULATOR_FUNCTIONS)
      .filter((name) => name !== 'C')
      .sort((left, right) => right.length - left.length)
      .join('|');
    const pattern = new RegExp(
      '\\b(' + names + ')\\s+(?!(?:' + names + ')\\s)((' + names + ')\\([^()]*\\)|[A-Za-z0-9_.]+(?:[_^]\\([^()]+\\))?)',
      'g'
    );
    let output = String(input);
    for (let pass = 0; pass < 32; pass += 1) {
      const next = output.replace(pattern, '$1($2)');
      if (next === output) break;
      output = next;
    }
    return output;
  }

  function replaceUnicodeIndexedRoots(input) {
    const source = String(input);
    let output = '';
    for (let index = 0; index < source.length;) {
      let rootIndex = '';
      let operandStart = index;
      if (source[index] === '∛' || source[index] === '∜') {
        rootIndex = source[index] === '∛' ? '3' : '4';
        operandStart = index + 1;
      } else if (source.startsWith('^(', index)) {
        const closeIndex = source.indexOf(')', index + 2);
        if (closeIndex > index + 2) {
          let cursor = closeIndex + 1;
          while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
          if (source[cursor] === '√') {
            rootIndex = source.slice(index + 2, closeIndex);
            operandStart = cursor + 1;
          }
        }
      }
      if (!rootIndex) {
        output += source[index];
        index += 1;
        continue;
      }

      while (operandStart < source.length && /\s/.test(source[operandStart])) operandStart += 1;
      let operand = '';
      let end = operandStart;
      if (source[operandStart] === '(') {
        let depth = 1;
        end = operandStart + 1;
        while (end < source.length && depth > 0) {
          if (source[end] === '(') depth += 1;
          else if (source[end] === ')') depth -= 1;
          end += 1;
        }
        if (depth === 0) operand = source.slice(operandStart + 1, end - 1);
      } else {
        const number = source.slice(operandStart).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
        if (number) {
          operand = number[0];
          end = operandStart + number[0].length;
        } else {
          const atom = Array.from(source.slice(operandStart))[0] || '';
          operand = atom;
          end = operandStart + atom.length;
        }
        while (/^[_^]\(/.test(source.slice(end))) {
          let cursor = end + 2;
          let depth = 1;
          while (cursor < source.length && depth > 0) {
            if (source[cursor] === '(') depth += 1;
            else if (source[cursor] === ')') depth -= 1;
            cursor += 1;
          }
          if (depth !== 0) break;
          operand += source.slice(end, cursor);
          end = cursor;
        }
      }
      if (!operand) {
        output += source.slice(index, operandStart);
        index = operandStart;
        continue;
      }
      output += '(' + operand + ')^(1/(' + rootIndex + '))';
      index = end;
    }
    return output;
  }

  function unicodeToCalculator(input, options) {
    const preserveLongIdentifiers = Boolean(options && options.preserveLongIdentifiers);
    let text = replaceUnicodeIndexedRoots(decodeUnicodeScripts(cleanClipboardText(input)));
    text = replaceNestedAbsoluteBars(text)
      .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufe00-\ufe0f]/g, '')
      .replace(/√\s*\(/g, 'sqrt(')
      .replace(/[×·⋅∗]/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/±/g, '+/-')
      .replace(/∓/g, '-/+')
      .replace(/%/g, '/100');

    const restorations = new Map();
    let declaredCount = 0;
    let nextIdentifierCodePoint = 0xf0000;
    let operatorCount = 0;
    const occupiedIdentifierCodePoints = new Set(
      Array.from(text, (character) => character.codePointAt(0))
        .filter((codePoint) => codePoint >= 0xf0000 && codePoint <= 0xffffd)
    );
    const protectDeclared = (value) => {
      const token = String.fromCharCode(0xe400 + declaredCount++);
      restorations.set(token, value);
      return token;
    };
    const protectIdentifier = (value) => {
      // Supplementary private-use code points survive the calculator cleanup
      // as one opaque token, so an explicitly grouped identifier such as
      // \mathrm{speed} cannot be mistaken for s*p*e*e*d. Allocate around
      // literal private-use input so a page cannot alias a generated token.
      while (nextIdentifierCodePoint <= 0xffffd &&
             occupiedIdentifierCodePoints.has(nextIdentifierCodePoint)) {
        nextIdentifierCodePoint += 1;
      }
      if (nextIdentifierCodePoint > 0xffffd) {
        const error = new Error('LaTeX identifier token budget exceeded');
        error.code = LATEX_BUDGET_ERROR;
        throw error;
      }
      const token = String.fromCodePoint(nextIdentifierCodePoint);
      occupiedIdentifierCodePoints.add(nextIdentifierCodePoint);
      nextIdentifierCodePoint += 1;
      restorations.set(token, value);
      return token;
    };
    const protectOperator = (value) => {
      const token = String.fromCharCode(0xe800 + operatorCount++);
      restorations.set(token, value);
      return ' ' + token + ' ';
    };
    text = text
      .replace(new RegExp(DECLARED_OPERATOR_START + '([A-Za-z][A-Za-z0-9_]*)' + DECLARED_OPERATOR_END, 'g'),
        (_match, name) => protectDeclared(name))
      .replace(new RegExp(DECLARED_IDENTIFIER_START + '([A-Za-z][A-Za-z0-9_]*)' + DECLARED_IDENTIFIER_END, 'g'),
        (_match, name) => protectIdentifier(name))
      .replace(new RegExp(RELATIONAL_MID, 'g'), () => protectOperator(' divides '));

    let ascii = '';
    for (const character of text) {
      if (Object.prototype.hasOwnProperty.call(CALCULATOR_WORD_OPERATOR_GLYPHS, character)) {
        ascii += protectOperator(CALCULATOR_WORD_OPERATOR_GLYPHS[character]);
        continue;
      }
      const mapped = ASCII_SYMBOLS[character];
      // Word-valued glyphs need an explicit token boundary. Without it,
      // adjacent commands such as \alpha\beta collapse into "alphabeta".
      ascii += mapped && /^[A-Za-z]+$/.test(mapped) ? ' ' + mapped + ' ' : (mapped || character);
    }
    text = applyBareCalculatorFunctions(ascii)
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .replace(/\s+(?=[_^]\s*\()/g, '')
      .replace(/sqrt\(\(([^()]*)\)\/\(abs\(([^()]*)\)\)\)/g, 'sqrt($1/abs($2))')
      .replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, (_match, numerator, denominator) =>
        calculatorSimpleTerm(numerator) && calculatorSimpleTerm(denominator)
          ? '(' + numerator + '/' + denominator + ')'
          : '(' + numerator + ')/(' + denominator + ')'
      )
      .replace(/\)\s*(?=\()/g, ')*')
      .replace(/([0-9])\s*(?=\()/g, '$1*')
      .replace(/\)\s*(?=(?:sqrt|abs|sin|cos|tan|log|ln|exp)\b)/g, ')*')
      .replace(/!\s*(?=[A-Za-z0-9_(])/g, '!*')
      .replace(/([0-9)])\s*(?=[A-Za-z])/g, '$1*')
      .replace(/([A-Za-z])\s*(?=[0-9])/g, '$1*')
      .replace(/([A-Za-z0-9_)!])\s*(?=[\ue400-\ue7ff]\s*\()/g, '$1*')
      .replace(/([A-Za-z0-9_)!])\s*(?=[\u{f0000}-\u{ffffd}])/gu, '$1*')
      .replace(/([\u{f0000}-\u{ffffd}])\s*(?=[A-Za-z0-9(])/gu, '$1*')
      .replace(/([\u{f0000}-\u{ffffd}])\s*(?=[\u{f0000}-\u{ffffd}])/gu, '$1*')
      .replace(/([\u{f0000}-\u{ffffd}])\s*(?=[\ue400-\ue7ff]\s*\()/gu, '$1*')
      .replace(/([A-Za-z]+|[0-9]+(?:\.[0-9]+)?|\))\s*(?=\()/g, (match, token) =>
        CALCULATOR_FUNCTIONS.has(token) || CALCULATOR_IMPLICIT_FUNCTIONS.has(token) ? token : token + '*'
      )
      .replace(/[A-Za-z]{2,}/g, (word) =>
        CALCULATOR_WORDS.has(word) || (preserveLongIdentifiers && word.length > 2)
          ? word
          : word.split('').join('*')
      )
      .replace(/([A-Za-z0-9_)!%])\s+(?=[A-Za-z0-9_(])/g, '$1*')
      .replace(/\s*,\s*/g, ',')
      .replace(/\s*([-+=*/^<>])\s*/g, '$1')
      .replace(/\s*∝\s*/g, ' ∝ ')
      .replace(/\s+/g, ' ')
      .trim();
    for (const [token, value] of restorations) text = text.split(token).join(value);
    text = text.replace(/!\s+/g, '!').replace(/\s+/g, ' ').trim();
    return stripBalancedOuterParentheses(text);
  }

  function latexToCalculator(input) {
    try {
      const source = String(input == null ? '' : input);
      if (source.length > MAX_MATH_SOURCE_LENGTH) return '';
      return unicodeToCalculator(formatMathText(new LatexParser(source, { calculatorMode: true }).parse()));
    } catch (_error) {
      return '';
    }
  }

  function isEscaped(text, index) {
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) slashes += 1;
    return slashes % 2 === 1;
  }

  function looksLikeLatex(expression) {
    const value = expression.trim();
    if (!value || value.length > 10000 || /[\r\n]/.test(value)) return false;
    if (/\\[A-Za-z]+|[_^{}]|[=<>±∑∫√∞α-ωΑ-Ω]/u.test(value)) return true;
    if (/^[A-Za-z]$/.test(value)) return true;
    if (/^[A-Za-z0-9().]+\s*[+\-*/]\s*[A-Za-z0-9().]+$/.test(value)) return true;
    return false;
  }

  function isCurrencyDollar(text, index) {
    if (text[index] !== '$' || text[index + 1] === '$' || !/^\d/u.test(text.slice(index + 1))) return false;
    let end = index + 1;
    while (end < text.length) {
      end = text.indexOf('$', end);
      if (end < 0) return true;
      if (!isEscaped(text, end)) break;
      end += 1;
    }
    if (end < 0) return true;
    const source = text.slice(index + 1, end);
    // A numeric LaTeX expression such as `$5 + 3$` has one real closing
    // delimiter. In ordinary currency arithmetic (`$5 + $10 = $15`), the
    // next dollar starts another amount, so none of those currency signs may
    // be paired as TeX delimiters.
    const nextStartsAmount = /^\$\d/u.test(text.slice(end));
    return nextStartsAmount || !looksLikeLatex(source);
  }

  function convertDelimitedLatexText(input, outputMode) {
    const text = String(input);
    let output = '';
    let converted = 0;
    let cursor = 0;

    const emit = (source, display, original) => {
      let rendered;
      if (outputMode === 'latex') rendered = display ? '$$' + source + '$$' : '$' + source + '$';
      else if (outputMode === 'calculator') rendered = latexToCalculator(source);
      else if (outputMode === 'faithful') rendered = latexToFaithful(source);
      else {
        const unicode = latexToUnicode(source);
        rendered = outputMode === 'ascii' ? unicodeToAscii(unicode) : unicode;
      }
      if (!rendered || !rendered.trim()) return original;
      converted += 1;
      return rendered;
    };

    while (cursor < text.length) {
      let opener = '';
      let closer = '';
      let display = false;
      if (text.startsWith('$$', cursor) && !isEscaped(text, cursor)) {
        opener = '$$'; closer = '$$'; display = true;
      } else if (text.startsWith('\\[', cursor) && !isEscaped(text, cursor)) {
        opener = '\\['; closer = '\\]'; display = true;
      } else if (text.startsWith('\\(', cursor) && !isEscaped(text, cursor)) {
        opener = '\\('; closer = '\\)';
      } else if (text[cursor] === '$' && !isEscaped(text, cursor) && !isCurrencyDollar(text, cursor)) {
        opener = '$'; closer = '$';
      }

      if (!opener) {
        output += text[cursor];
        cursor += 1;
        continue;
      }

      let end = cursor + opener.length;
      while (end < text.length) {
        const found = text.indexOf(closer, end);
        if (found < 0) {
          end = -1;
          break;
        }
        if (!isEscaped(text, found)) {
          end = found;
          break;
        }
        end = found + closer.length;
      }
      if (end < 0) {
        output += opener;
        cursor += opener.length;
        continue;
      }
      const source = text.slice(cursor + opener.length, end);
      if (!looksLikeLatex(source)) {
        output += opener;
        cursor += opener.length;
        continue;
      } else {
        output += emit(source, display, text.slice(cursor, end + closer.length));
      }
      cursor = end + closer.length;
    }
    return { text: cleanClipboardText(output), converted };
  }

  function elementChildren(node) {
    return Array.from(node && node.children ? node.children : []);
  }

  function domTreeWithinBudget(root, nodeLimit, depthLimit) {
    if (!root) return false;
    const stack = [{ node: root, depth: 0 }];
    let count = 0;
    while (stack.length) {
      const current = stack.pop();
      if (!current || !current.node || current.node.nodeType !== 1) continue;
      count += 1;
      if (count > nodeLimit || current.depth > depthLimit) return false;
      const children = elementChildren(current.node);
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push({ node: children[index], depth: current.depth + 1 });
      }
    }
    return true;
  }

  function mathMLTokenText(node) {
    let value = node.textContent || '';
    value = value.replace(/[\u2061-\u2064]/g, (character) => ({
      '\u2061': ' ', '\u2062': '·', '\u2063': ', ', '\u2064': '+'
    })[character]);
    let variant = '';
    for (let current = node; current && current.nodeType === 1; current = current.parentElement) {
      if (current.hasAttribute && current.hasAttribute('mathvariant')) {
        variant = current.getAttribute('mathvariant') || '';
        break;
      }
      if ((current.localName || '').toLowerCase() === 'math') break;
    }
    return applyMathVariant(value, variant);
  }

  function serializeContentMathML(node) {
    const name = (node.localName || node.nodeName || '').toLowerCase();
    const children = elementChildren(node);
    if (name === 'ci' || name === 'cn' || name === 'csymbol') return mathMLTokenText(node).trim();
    if (name !== 'apply' && name !== 'bind') {
      return children.map(serializeContentMathML).join('') || mathMLTokenText(node);
    }
    if (!children.length) return '';
    const operatorName = (children[0].localName || '').toLowerCase();
    const args = children.slice(1).map(serializeContentMathML);
    const infix = {
      plus: ' + ', minus: ' − ', times: ' × ', divide: '/', eq: ' = ', neq: ' ≠ ',
      lt: ' < ', gt: ' > ', leq: ' ≤ ', geq: ' ≥ ', equivalent: ' ≡ ', approx: ' ≈ ',
      in: ' ∈ ', notin: ' ∉ ', subset: ' ⊂ ', union: ' ∪ ', intersect: ' ∩ ',
      and: ' ∧ ', or: ' ∨ '
    };
    if (operatorName === 'power') return (args[0] || '') + toScript(args[1] || '', SUPERSCRIPTS, '^');
    if (operatorName === 'root') return (args.length > 1 ? toScript(args[0], SUPERSCRIPTS, '^') : '') + '√(' + args[args.length - 1] + ')';
    if (operatorName === 'not') return '¬' + (args[0] || '');
    if (Object.prototype.hasOwnProperty.call(infix, operatorName)) return args.join(infix[operatorName]);
    return operatorName + '(' + args.join(', ') + ')';
  }

  function calculatorIdentifier(value) {
    let output = '';
    for (const character of String(value).trim()) output += ASCII_SYMBOLS[character] || character;
    return output.replace(/\s+/g, '_');
  }

  function calculatorResult(text, kind, options) {
    return { text: String(text == null ? '' : text), kind: kind || 'operand', ...(options || {}) };
  }

  function normalizedMathToken(input) {
    return cleanClipboardText(String(input == null ? '' : input))
      .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufe00-\ufe0f]/g, '')
      .trim();
  }

  function isVerticalBarToken(input) {
    return /^(?:\||∣|❘|‖|∥|‗)$/.test(normalizedMathToken(input));
  }

  function calculatorOperator(node) {
    const raw = normalizedMathToken(node.textContent || '');
    if (!raw) return calculatorResult('', 'space');
    if (raw === '\u2061') return calculatorResult('', 'apply');
    if (raw === '\u2062') return calculatorResult('*', 'operator');
    if (raw === '\u2063') return calculatorResult(',', 'separator');
    if (raw === '\u2064') return calculatorResult('+', 'operator');
    if (isVerticalBarToken(raw)) {
      const fence = (node.getAttribute && node.getAttribute('fence') || '').toLowerCase();
      const stretchy = (node.getAttribute && node.getAttribute('stretchy') || '').toLowerCase();
      const explicitFence = fence === 'true' || stretchy === 'false';
      const explicitRelation = fence === 'false';
      const doubled = /[‖∥‗]/u.test(raw);
      return calculatorResult(doubled ? '||' : '|', 'bar', {
        barRole: explicitFence ? 'fence' : (explicitRelation ? 'relation' : 'ambiguous'),
        spacedBar: !explicitFence
      });
    }
    if ('([{⟨⌈⌊'.includes(raw)) return calculatorResult(raw === '⟨' ? '(' : raw, 'open');
    if (')]}⟩⌉⌋'.includes(raw)) return calculatorResult(raw === '⟩' ? ')' : raw, 'close');
    if (raw === ',' || raw === ';' || raw === ':') return calculatorResult(raw, 'separator');
    const operators = {
      '×': '*', '·': '*', '⋅': '*', '∗': '*', '÷': '/', '∕': '/', '⁄': '/', '−': '-', '±': '+/-', '∓': '-/+',
      '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~=', '≃': '~=', '≅': '~=',
      '∧': '&&', '∨': '||', '¬': '!', '→': '->', '⇒': '=>'
    };
    return calculatorResult(operators[raw] || raw, 'operator');
  }

  function calculatorCanEnd(result) {
    return result && (result.kind === 'operand' || result.kind === 'close');
  }

  function calculatorCanStart(result) {
    return result && (result.kind === 'operand' || result.kind === 'open' || result.kind === 'function');
  }

  function calculatorSignificantToken(tokens, start, direction) {
    for (let index = start; index >= 0 && index < tokens.length; index += direction) {
      if (!['space', 'apply'].includes(tokens[index].kind)) return { token: tokens[index], index };
    }
    return null;
  }

  function calculatorAbsoluteBarPairs(tokens) {
    const stack = [];
    const tentative = [];
    const closingBars = new Set();
    let overflow = false;
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token.kind !== 'bar' || token.barRole === 'relation') continue;
      const previous = calculatorSignificantToken(tokens, index - 1, -1);
      const previousCanEnd = previous && (
        calculatorCanEnd(previous.token) || previous.token.kind === 'postfix' || closingBars.has(previous.index)
      );
      if (stack.length && previousCanEnd && tokens[stack[stack.length - 1]].text === token.text) {
        const open = stack.pop();
        tentative.push({ open, close: index });
        closingBars.add(index);
      } else if (stack.length < MAX_MATHML_DEPTH) {
        stack.push(index);
      } else {
        overflow = true;
      }
    }
    if (overflow) return new Map();

    const boundaryOnLeft = (entry) => !entry ||
      ['operator', 'open', 'separator', 'relation'].includes(entry.token.kind) || entry.token.kind === 'bar';
    const boundaryOnRight = (entry) => !entry ||
      ['operator', 'close', 'separator', 'relation', 'postfix'].includes(entry.token.kind) || entry.token.kind === 'bar';
    const pairs = new Map();
    for (const pair of tentative) {
      const openToken = tokens[pair.open];
      const closeToken = tokens[pair.close];
      const explicit = openToken.barRole === 'fence' && closeToken.barRole === 'fence';
      const left = calculatorSignificantToken(tokens, pair.open - 1, -1);
      const right = calculatorSignificantToken(tokens, pair.close + 1, 1);
      // Ambiguous glyph-only bars are absolute-value fences only when at least
      // one outer side is a syntactic boundary. This retains |x| and 2|x| but
      // leaves A|B|C and P(A|B)|C relational.
      if (explicit || boundaryOnLeft(left) || boundaryOnRight(right)) pairs.set(pair.open, pair.close);
    }
    return pairs;
  }

  function calculatorBoundedBodyEnd(tokens, start) {
    let depth = 0;
    for (let index = start; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token.kind === 'open') {
        depth += 1;
        continue;
      }
      if (token.kind === 'close') {
        if (depth === 0) return index;
        depth -= 1;
        continue;
      }
      if (depth !== 0 || index === start) continue;
      if (token.kind === 'separator' || token.kind === 'relation') return index;
      if (token.kind === 'operator' && /^(?:\+|-|=|!=|~=|<=|>=|<|>|∝)$/u.test(token.text.trim())) return index;
    }
    return tokens.length;
  }

  function calculatorBoundedExpression(token, bodyTokens, depth) {
    const body = bodyTokens.slice();
    const hadBody = body.length > 0;
    let differential = '';
    if (/integral$/.test(token.operatorName || '') && body.length >= 2) {
      const variable = body[body.length - 1];
      const differentialToken = body[body.length - 2];
      if (differentialToken.kind === 'operand' && differentialToken.text === 'd' &&
          variable.kind === 'operand' && /^[A-Za-z][A-Za-z0-9_]*$/.test(variable.text)) {
        differential = variable.text;
        body.splice(-2, 2);
      }
    }
    let expression = serializeMathMLCalculatorTokens(body, depth + 1);
    const lower = token.lower || '';
    const upper = token.upper || '';
    if (!expression && !hadBody) {
      return calculatorResult(token.operatorName + (lower ? '_(' + lower + ')' : '') +
        (upper ? '^(' + upper + ')' : ''), 'operand');
    }
    if (!expression) expression = '1';
    const args = [expression];
    if (token.operatorName === 'sum' || token.operatorName === 'product') {
      const assignment = lower.match(/^([A-Za-z][A-Za-z0-9_]*)=(.+)$/);
      if (assignment) args.push(assignment[1], assignment[2]);
      else if (lower) args.push(lower);
      if (upper) args.push(upper);
    } else {
      if (differential) args.push(differential);
      if (lower) args.push(lower);
      if (upper) args.push(upper);
    }
    return calculatorResult(token.operatorName + '(' + args.join(',') + ')', 'operand');
  }

  function serializeMathMLCalculatorLinear(tokens, depth) {
    if (depth > MAX_MATHML_DEPTH) return tokens.map((token) => token.text || '').join('');
    let output = '';
    let previous = null;
    let applyPending = false;
    const callSuffixes = [];
    const beginFunctionCall = (value, functionToken) => {
      if (!functionToken || !functionToken.callText || functionToken.callText === functionToken.text) return value;
      return value.endsWith(functionToken.text)
        ? value.slice(0, -functionToken.text.length) + functionToken.callText
        : value;
    };
    const nestFunctionCall = (value, outer, inner) => {
      const functionToken = {
        ...inner,
        kind: 'function',
        functionName: inner.functionName || inner.text,
        callText: inner.callText || inner.text,
        callSuffix: (inner.callSuffix || '') + ')' + (outer.callSuffix || '')
      };
      return {
        output: beginFunctionCall(value, outer) + '(' + inner.text,
        token: functionToken
      };
    };

    for (let index = 0; index < tokens.length; index += 1) {
      let token = tokens[index];
      if (token.kind === 'space') continue;
      if (token.kind === 'bounded') {
        const end = calculatorBoundedBodyEnd(tokens, index + 1);
        token = calculatorBoundedExpression(token, tokens.slice(index + 1, end), depth);
        index = end - 1;
      }
      if (token.kind === 'apply') {
        if (previous && previous.kind === 'operand') previous = { ...previous, kind: 'function' };
        applyPending = true;
        continue;
      }
      if (token.kind === 'postfix') {
        output += token.text;
        previous = calculatorResult('', 'operand');
        continue;
      }
      if (applyPending && previous && previous.kind === 'function') {
        let following = null;
        for (let lookahead = index + 1; lookahead < tokens.length; lookahead += 1) {
          if (tokens[lookahead].kind !== 'space') {
            following = tokens[lookahead];
            break;
          }
        }
        if (token.kind === 'function' ||
            (token.kind === 'operand' && following && following.kind === 'apply' &&
             /^[A-Za-z][A-Za-z0-9_]*$/.test(token.text))) {
          const nested = nestFunctionCall(output, previous, token);
          output = nested.output;
          previous = nested.token;
          applyPending = false;
          continue;
        }
        output = beginFunctionCall(output, previous);
        if (token.kind === 'open' || /^\s*\(/.test(token.text)) {
          output += token.text;
          callSuffixes.push(previous.callSuffix || '');
          previous = token;
        } else {
          output += '(' + token.text + ')' + (previous.callSuffix || '');
          previous = calculatorResult('', 'operand');
        }
        applyPending = false;
        continue;
      }
      if (previous && previous.kind === 'function' && previous.autoApply && calculatorCanStart(token) && token.kind !== 'open') {
        if (token.kind === 'function') {
          const nested = nestFunctionCall(output, previous, token);
          output = nested.output;
          previous = nested.token;
          applyPending = false;
          continue;
        }
        output = beginFunctionCall(output, previous);
        output += '(' + token.text + ')' + (previous.callSuffix || '');
        previous = calculatorResult('', 'operand');
        applyPending = false;
        continue;
      }
      if (token.kind === 'open') {
        const functionCall = previous && (previous.kind === 'function' || previous.callable);
        if (functionCall) output = beginFunctionCall(output, previous);
        if (!functionCall && calculatorCanEnd(previous)) output += '*';
        output += token.text;
        callSuffixes.push(functionCall ? previous.callSuffix || '' : '');
        previous = token;
        applyPending = false;
        continue;
      }
      if (token.kind === 'close') {
        output += token.text;
        output += callSuffixes.length ? callSuffixes.pop() : '';
        previous = calculatorResult('', 'close');
        applyPending = false;
        continue;
      }
      if (!applyPending && calculatorCanEnd(previous) && calculatorCanStart(token)) {
        output += '*';
      }
      output += token.text;
      previous = token;
      applyPending = false;
    }
    return output;
  }

  function serializeMathMLCalculatorTokens(tokens, depth) {
    const level = depth || 0;
    if (level > MAX_MATHML_DEPTH) return tokens.map((token) => token.text || '').join('');
    const pairs = calculatorAbsoluteBarPairs(tokens);
    const collapse = (start, end, nestedDepth) => {
      if (nestedDepth > MAX_MATHML_DEPTH) return tokens.slice(start, end);
      const collapsed = [];
      for (let index = start; index < end; index += 1) {
        const token = tokens[index];
        const close = pairs.get(index);
        if (close != null && close < end) {
          const innerTokens = collapse(index + 1, close, nestedDepth + 1);
          const inner = serializeMathMLCalculatorLinear(innerTokens, level + nestedDepth + 1);
          // A doubled vertical fence denotes a norm, not two nested absolute
          // values. Scripts on the closing fence apply to the completed fence.
          const fenceFunction = token.text === '||' ? 'norm' : 'abs';
          collapsed.push(calculatorResult(
            fenceFunction + '(' + inner + ')' + (tokens[close].scriptSuffix || ''),
            'operand'
          ));
          index = close;
          continue;
        }
        if (token.kind === 'bar') {
          const spaced = token.spacedBar || token.barRole === 'relation';
          const barText = token.text + (token.scriptSuffix || '');
          collapsed.push(calculatorResult(spaced ? ' ' + barText + ' ' : barText, 'relation'));
        } else collapsed.push(token);
      }
      return collapsed;
    };
    return serializeMathMLCalculatorLinear(collapse(0, tokens.length, 0), level);
  }

  function serializeMathMLCalculatorRow(children) {
    const transparentRows = new Set(['math', 'mrow', 'mstyle', 'mpadded']);
    const flatten = (node) => {
      const name = String(node && (node.localName || node.nodeName) || '').toLowerCase();
      if (transparentRows.has(name)) {
        // A cases environment is represented by a transparent row containing
        // an opening brace and a table. Preserve it as one operand even when
        // it is nested in another case or adjacent to ordinary factors.
        const piecewise = calculatorPiecewiseRow(elementChildren(node));
        return piecewise ? [piecewise] : elementChildren(node).flatMap(flatten);
      }
      if (name === 'semantics') {
        const presentation = presentationMathNode(node);
        return presentation ? flatten(presentation) : [];
      }
      return [serializeMathMLCalculatorNode(node)];
    };
    const tokens = children.flatMap(flatten).filter((token) => token.text || token.kind === 'apply' || token.kind === 'space');
    return serializeMathMLCalculatorTokens(tokens, 0);
  }

  function mathMLLargeOperatorName(node) {
    const token = normalizedMathToken(node && node.textContent || '').replace(/\u2061/g, '');
    return ({
      '∑': 'sum', '∏': 'product', '∐': 'product', '∫': 'integral',
      '∬': 'double_integral', '∭': 'triple_integral', '∮': 'contour_integral',
      lim: 'limit'
    })[token] || '';
  }

  function calculatorFunctionApplicationBase(node) {
    if (!node || node.nodeType !== 1) return null;
    const name = (node.localName || node.nodeName || '').toLowerCase();
    if (!['math', 'mrow', 'mstyle', 'mpadded'].includes(name)) return null;
    const children = elementChildren(node).filter((child) =>
      (child.localName || '').toLowerCase() !== 'mspace'
    );
    if (children.length !== 2) return null;
    const first = serializeMathMLCalculatorNode(children[0]);
    const second = serializeMathMLCalculatorNode(children[1]);
    if (second.kind !== 'apply' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(first.text)) return null;
    return {
      ...first,
      kind: 'function',
      functionName: first.functionName || first.text,
      callText: first.callText || first.text,
      callSuffix: first.callSuffix || '',
      autoApply: true
    };
  }

  function calculatorEvaluationBase(node) {
    if (!node || node.nodeType !== 1) return null;
    if (!elementChildren(node).length && isVerticalBarToken(node.textContent || '')) {
      const bar = calculatorOperator(node);
      // A standalone explicitly relational bar is KaTeX's usual evaluation
      // marker. A fence bar can be the scripted close of |x|^2 or ||x||_2 and
      // must remain visible to the row-level fence matcher.
      return bar.barRole === 'relation' ? bar.text : null;
    }
    const name = (node.localName || node.nodeName || '').toLowerCase();
    if (!['math', 'mrow', 'mstyle', 'mpadded'].includes(name)) return null;
    const children = elementChildren(node).filter((child) =>
      !['mspace', 'annotation', 'annotation-xml', 'mphantom', 'none'].includes((child.localName || '').toLowerCase())
    );
    if (!children.length || !isVerticalBarToken(children[children.length - 1].textContent || '')) return null;
    return serializeMathMLCalculatorRow(children.slice(0, -1)) + '|';
  }

  function calculatorFunctionWithScripts(base, lower, upper) {
    if (!base || base.kind !== 'function') return null;
    let result = { ...base };
    let exponent = upper;
    if (exponent === '-1' && CALCULATOR_INVERSE_FUNCTIONS[base.functionName]) {
      const inverse = CALCULATOR_INVERSE_FUNCTIONS[base.functionName];
      result = {
        ...result,
        text: inverse,
        functionName: inverse,
        callText: inverse,
        callSuffix: ''
      };
      exponent = '';
    }
    if (lower) {
      if (base.functionName === 'log') {
        result = {
          ...result,
          text: 'log_(' + lower + ')',
          callText: '(log',
          callSuffix: '/log(' + lower + '))' + (result.callSuffix || ''),
          functionName: 'log'
        };
      } else {
        result.text += '_(' + lower + ')';
      }
    }
    if (exponent) {
      result.callText = result.callText || base.text;
      result.text += '^(' + exponent + ')';
      result.callSuffix = (result.callSuffix || '') + '^(' + exponent + ')';
    }
    return result;
  }

  function calculatorSimpleTerm(text) {
    if (/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(text)) return true;
    if (/^[A-Za-z]$/.test(text) || CALCULATOR_WORDS.has(text)) return true;
    return /^[A-Za-z]+\([^()]+\)$/.test(text) && CALCULATOR_FUNCTIONS.has(text.slice(0, text.indexOf('(')));
  }

  function calculatorFraction(numerator, denominator) {
    const top = calculatorSimpleTerm(numerator) ? numerator : '(' + numerator + ')';
    const bottom = calculatorSimpleTerm(denominator) ? denominator : '(' + denominator + ')';
    return '(' + top + '/' + bottom + ')';
  }

  function calculatorPower(base, exponent) {
    const safeBase = calculatorSimpleTerm(base) ? base : '(' + base + ')';
    return safeBase + '^(' + exponent + ')';
  }

  function stripBalancedOuterParentheses(input) {
    const text = String(input == null ? '' : input);
    if (text.length < 2 || text[0] !== '(' || text[text.length - 1] !== ')') return text;
    let depth = 0;
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] === '(') depth += 1;
      else if (text[index] === ')') depth -= 1;
      if (depth < 0 || (depth === 0 && index < text.length - 1)) return text;
    }
    return depth === 0 ? text.slice(1, -1) : text;
  }

  function calculatorPiecewiseRow(children) {
    const meaningful = children.filter((child) =>
      !['mspace', 'annotation', 'annotation-xml', 'mphantom', 'none'].includes((child.localName || '').toLowerCase())
    );
    if (meaningful.length !== 2 || normalizedMathToken(meaningful[0].textContent || '') !== '{' ||
        (meaningful[1].localName || '').toLowerCase() !== 'mtable') return null;
    const rows = elementChildren(meaningful[1]).filter((row) =>
      ['mtr', 'mlabeledtr'].includes((row.localName || '').toLowerCase())
    );
    if (!rows.length) return null;
    const branches = rows.map((row) => {
      const cells = elementChildren(row).filter((cell) => (cell.localName || '').toLowerCase() === 'mtd');
      return '[' + cells.map((cell) => serializeMathMLCalculatorNode(cell).text).join(',') + ']';
    });
    return calculatorResult('piecewise(' + branches.join(',') + ')', 'operand');
  }

  function serializeMathMLCalculatorNode(node) {
    if (!node) return calculatorResult('', 'space');
    if (node.nodeType === 3) return calculatorResult(calculatorIdentifier(node.nodeValue || ''), 'operand');
    if (node.nodeType !== 1) return calculatorResult('', 'space');
    const name = (node.localName || node.nodeName || '').toLowerCase();
    const children = elementChildren(node);
    const childText = (index) => serializeMathMLCalculatorNode(children[index]).text;
    const rowText = () => serializeMathMLCalculatorRow(children);
    if (['math', 'mrow', 'mstyle', 'mpadded'].includes(name)) {
      const piecewise = calculatorPiecewiseRow(children);
      if (piecewise) return piecewise;
    }
    const functionBase = calculatorFunctionApplicationBase(node);
    if (functionBase) return functionBase;

    // Some renderers incorrectly expose absolute-value fences as identifiers or
    // text instead of operators. Classify the glyph before dispatching by tag so
    // row serialization cannot turn |q| into |*q*|.
    if (!children.length && isVerticalBarToken(node.textContent || '')) {
      if (name === 'mo') return calculatorOperator(node);
      const raw = normalizedMathToken(node.textContent || '');
      return calculatorResult(/[‖∥‗]/u.test(raw) ? '||' : '|', 'bar', {
        barRole: 'ambiguous',
        spacedBar: false
      });
    }
    if (!children.length && /^!+$/.test(normalizedMathToken(node.textContent || ''))) {
      return calculatorResult(normalizedMathToken(node.textContent || ''), 'postfix');
    }
    if (!children.length && normalizedMathToken(node.textContent || '') === '%') {
      return calculatorResult('/100', 'postfix');
    }

    if (name === 'mi') {
      if (/[|∣❘].*[|∣❘]/.test(normalizedMathToken(node.textContent || ''))) {
        return calculatorResult(unicodeToCalculator(node.textContent || ''), 'operand');
      }
      const raw = normalizedMathToken(node.textContent || '');
      if (/^(?:[+*/=<>-]|[−×·⋅∗÷∕⁄±∓≤≥≠≈≃≅→⇒∝])$/u.test(raw)) {
        return calculatorOperator(node);
      }
      const value = calculatorIdentifier(node.textContent || '');
      const callable = CALCULATOR_IMPLICIT_FUNCTIONS.has(value);
      return calculatorResult(value, CALCULATOR_FUNCTIONS.has(value) ? 'function' : 'operand',
        CALCULATOR_FUNCTIONS.has(value)
          ? { functionName: value, callText: value, callSuffix: '' }
          : (callable ? { callable: true } : null));
    }
    if (name === 'mn') return calculatorResult(calculatorIdentifier(node.textContent || ''), 'operand');
    if (name === 'mo') return calculatorOperator(node);
    if (name === 'mtext' || name === 'ms') {
      const value = normalizedMathToken(node.textContent || '');
      return calculatorResult(/[|∣❘].*[|∣❘]/.test(value)
        ? unicodeToCalculator(value)
        : calculatorIdentifier(value), 'operand');
    }
    if (name === 'mspace') return calculatorResult('', 'space');
    if (name === 'mphantom' || name === 'annotation' || name === 'annotation-xml' || name === 'none') return calculatorResult('', 'space');
    if (name === 'semantics') {
      const presentation = children.find((item) => !['annotation', 'annotation-xml'].includes((item.localName || '').toLowerCase()));
      return serializeMathMLCalculatorNode(presentation);
    }
    if (name === 'mfrac') return calculatorResult(calculatorFraction(childText(0), childText(1)), 'operand');
    if (name === 'msqrt') {
      const radicand = rowText();
      return calculatorResult('sqrt(' + stripBalancedOuterParentheses(radicand) + ')', 'operand');
    }
    if (name === 'mroot') return calculatorResult('(' + childText(0) + ')^(1/(' + childText(1) + '))', 'operand');
    if (name === 'msup' || name === 'msub' || name === 'msubsup') {
      const evaluation = calculatorEvaluationBase(children[0]);
      const lower = name === 'msup' ? '' : childText(1);
      const upper = name === 'msub' ? '' : childText(name === 'msup' ? 1 : 2);
      if (evaluation != null) {
        return calculatorResult(evaluation + (lower ? '_(' + lower + ')' : '') +
          (upper ? '^(' + upper + ')' : ''), 'postfix');
      }
      const operatorName = mathMLLargeOperatorName(children[0]);
      if (operatorName) return calculatorResult(operatorName + (lower ? '_(' + lower + ')' : '') +
        (upper ? '^(' + upper + ')' : ''), 'bounded', { operatorName, lower, upper });
      const base = serializeMathMLCalculatorNode(children[0]);
      const scriptSuffix = (lower ? '_(' + lower + ')' : '') + (upper ? '^(' + upper + ')' : '');
      if (base.kind === 'bar') return { ...base, scriptSuffix };
      if (base.kind === 'open' || base.kind === 'close') return { ...base, text: base.text + scriptSuffix };
      const scriptedFunction = calculatorFunctionWithScripts(base, lower, upper);
      if (scriptedFunction) return scriptedFunction;
      if (name === 'msup') return calculatorResult(calculatorPower(base.text, upper), 'operand');
      if (name === 'msub') return calculatorResult(base.text + '_(' + lower + ')', 'operand');
      return calculatorResult(calculatorPower(base.text + '_(' + lower + ')', upper), 'operand');
    }
    if (name === 'mover' || name === 'munder' || name === 'munderover') {
      const evaluation = calculatorEvaluationBase(children[0]);
      const lower = name === 'mover' ? '' : childText(1);
      const upper = name === 'munder' ? '' : childText(name === 'mover' ? 1 : 2);
      if (evaluation != null) {
        return calculatorResult(evaluation + (lower ? '_(' + lower + ')' : '') +
          (upper ? '^(' + upper + ')' : ''), 'postfix');
      }
      const operatorName = mathMLLargeOperatorName(children[0]);
      if (operatorName) return calculatorResult(operatorName + (lower ? '_(' + lower + ')' : '') +
        (upper ? '^(' + upper + ')' : ''), 'bounded', { operatorName, lower, upper });
      return calculatorResult(childText(0), 'operand');
    }
    if (name === 'mfenced') {
      const open = node.getAttribute('open') == null ? '(' : node.getAttribute('open');
      const close = node.getAttribute('close') == null ? ')' : node.getAttribute('close');
      if (isVerticalBarToken(open) && isVerticalBarToken(close)) {
        return calculatorResult('abs(' + children.map((item) => serializeMathMLCalculatorNode(item).text).join(',') + ')', 'operand');
      }
      return calculatorResult(open + children.map((item) => serializeMathMLCalculatorNode(item).text).join(',') + close, 'operand');
    }
    if (name === 'mtable') {
      return calculatorResult('[' + children.map((row) => '[' + elementChildren(row).map((cell) => serializeMathMLCalculatorNode(cell).text).join(',') + ']').join(',') + ']', 'operand');
    }
    if (name === 'mtr' || name === 'mlabeledtr' || name === 'mtd') return calculatorResult(rowText(), 'operand');
    if (name === 'menclose') return calculatorResult(rowText(), 'operand');
    if (name === 'maction') return serializeMathMLCalculatorNode(children[0]);
    if (name === 'apply' || name === 'bind' || name === 'ci' || name === 'cn' || name === 'csymbol') {
      return calculatorResult(unicodeToCalculator(serializeContentMathML(node)), 'operand');
    }
    if (['math', 'mrow', 'mstyle', 'mpadded'].includes(name) && children.length === 1) {
      return serializeMathMLCalculatorNode(children[0]);
    }
    return calculatorResult(rowText() || calculatorIdentifier(node.textContent || ''), 'operand');
  }

  function mathMLToCalculator(mathElement) {
    const text = serializeMathMLCalculatorNode(mathElement).text
      .replace(/\s*([-+=*/^<>])\s*/g, '$1')
      .replace(/\s*∝\s*/g, ' ∝ ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleanClipboardText(text);
  }

  function serializeMathMLNode(node) {
    if (!node) return '';
    if (node.nodeType === 3) return node.nodeValue || '';
    if (node.nodeType !== 1) return '';
    const name = (node.localName || node.nodeName || '').toLowerCase();
    const children = elementChildren(node);
    const child = (index) => serializeMathMLNode(children[index]);
    const all = () => children.map(serializeMathMLNode).join('');

    if (['mi', 'mn', 'mo', 'mtext', 'ms', 'mglyph'].includes(name)) return mathMLTokenText(node);
    if (name === 'mspace') return ' ';
    if (name === 'mphantom') return '';
    if (name === 'semantics') {
      const presentation = children.find((item) => !['annotation', 'annotation-xml'].includes((item.localName || '').toLowerCase()));
      return serializeMathMLNode(presentation);
    }
    if (name === 'annotation' || name === 'annotation-xml') return '';
    if (name === 'mfrac') return '(' + child(0) + ')/(' + child(1) + ')';
    if (name === 'msqrt') return '√(' + all() + ')';
    if (name === 'mroot') return toScript(child(1), SUPERSCRIPTS, '^') + '√(' + child(0) + ')';
    if (name === 'msup') return child(0) + toScript(formatMathText(child(1)), SUPERSCRIPTS, '^');
    if (name === 'msub') return child(0) + toScript(formatMathText(child(1)), SUBSCRIPTS, '_');
    if (name === 'msubsup') {
      return child(0) + toScript(formatMathText(child(1)), SUBSCRIPTS, '_') + toScript(formatMathText(child(2)), SUPERSCRIPTS, '^');
    }
    if (name === 'mover') {
      const base = child(0);
      const over = child(1).trim();
      const accents = { '^': '\u0302', 'ˆ': '\u0302', '~': '\u0303', '˜': '\u0303', '¯': '\u0305', '→': '\u20d7', '˙': '\u0307', '¨': '\u0308' };
      return accents[over] ? base + accents[over] : base + toScript(over, SUPERSCRIPTS, '^');
    }
    if (name === 'munder') return child(0) + toScript(formatMathText(child(1)), SUBSCRIPTS, '_');
    if (name === 'munderover') {
      return child(0) + toScript(formatMathText(child(1)), SUBSCRIPTS, '_') + toScript(formatMathText(child(2)), SUPERSCRIPTS, '^');
    }
    if (name === 'mfenced') {
      const open = node.getAttribute('open') == null ? '(' : node.getAttribute('open');
      const close = node.getAttribute('close') == null ? ')' : node.getAttribute('close');
      const separators = node.getAttribute('separators') || ',';
      return open + children.map(serializeMathMLNode).join(separators[0] + ' ') + close;
    }
    if (name === 'mtable') {
      return '[' + children.map(serializeMathMLNode).join('; ') + ']';
    }
    if (name === 'mtr' || name === 'mlabeledtr') return children.map(serializeMathMLNode).join(', ');
    if (name === 'mtd') return all();
    if (name === 'menclose') {
      const notation = node.getAttribute('notation') || '';
      if (notation.includes('radical')) return '√(' + all() + ')';
      if (notation.includes('box') || notation.includes('roundedbox')) return 'boxed(' + all() + ')';
      return all();
    }
    if (name === 'mmultiscripts') {
      const base = child(0);
      const post = children.slice(1).filter((item) => (item.localName || '').toLowerCase() !== 'mprescripts');
      let result = base;
      for (let index = 0; index < post.length; index += 2) {
        if ((post[index].localName || '').toLowerCase() !== 'none') result += toScript(serializeMathMLNode(post[index]), SUBSCRIPTS, '_');
        if (post[index + 1] && (post[index + 1].localName || '').toLowerCase() !== 'none') result += toScript(serializeMathMLNode(post[index + 1]), SUPERSCRIPTS, '^');
      }
      return result;
    }
    if (name === 'none') return '';
    if (name === 'apply' || name === 'bind' || name === 'ci' || name === 'cn' || name === 'csymbol') {
      return serializeContentMathML(node);
    }
    if (name === 'maction') return child(0);
    return all() || mathMLTokenText(node);
  }

  function mathMLToUnicode(mathElement) {
    return formatMathText(serializeMathMLNode(mathElement));
  }

  function faithfulResult(text, kind, options) {
    return { text: String(text == null ? '' : text), kind: kind || 'operand', ...(options || {}) };
  }

  function faithfulOperator(node) {
    const raw = normalizedMathToken(node.textContent || '');
    if (!raw) return faithfulResult('', 'space');
    const escapedRaw = escapeFaithfulSentinelCollisions(raw);
    if (escapedRaw !== raw) return faithfulResult(escapedRaw, 'operator', { compact: true });
    if (raw === '\u2061') return faithfulResult('', 'apply');
    if (raw === '\u2062') return faithfulResult('', 'invisibleTimes');
    if (raw === '\u2063') return faithfulResult(',', 'separator');
    if (raw === '\u2064') return faithfulResult('+', 'operator');
    if (isVerticalBarToken(raw)) {
      const fence = (node.getAttribute && node.getAttribute('fence') || '').toLowerCase();
      const stretchy = (node.getAttribute && node.getAttribute('stretchy') || '').toLowerCase();
      const explicitFence = fence === 'true' || stretchy === 'false';
      const explicitRelation = fence === 'false';
      const doubled = /[‖∥‗]/u.test(raw);
      if (raw === '∥' && (explicitRelation || !explicitFence)) return faithfulResult('∥', 'relation');
      return faithfulResult(doubled ? '‖' : (raw === '∣' ? '∣' : '|'), 'bar', {
        barRole: explicitFence ? 'fence' : (explicitRelation ? 'relation' : 'ambiguous'),
        fenceText: doubled ? '‖' : '|'
      });
    }
    if ('([{⟨⌈⌊'.includes(raw)) return faithfulResult(raw, 'open');
    if (')]}\u27e9\u2309\u230b'.includes(raw)) return faithfulResult(raw, 'close');
    if (raw === ',' || raw === ';' || raw === ':') return faithfulResult(raw, 'separator');
    if (/^[′″‴!]+$/u.test(raw)) return faithfulResult(raw.replace(/'/g, '′'), 'postfix');
    const relations = /^[=≠≈≃≅≡≤≥<>∈∉∋∌⊂⊃⊆⊇⊊⊋≺≻≼≽∣∤∥∦∝⇐⇒⇔↔→←↦⟵-⟺]$/u;
    return faithfulResult(raw, relations.test(raw) ? 'relation' : 'operator', {
      compact: /^[/*]$/u.test(raw)
    });
  }

  function faithfulCanEnd(token) {
    return token && ['identifier', 'number', 'operand', 'close', 'postfix', 'large'].includes(token.kind);
  }

  function faithfulCanStart(token) {
    return token && ['identifier', 'number', 'operand', 'open', 'large'].includes(token.kind);
  }

  function faithfulSignificantToken(tokens, start, direction) {
    for (let index = start; index >= 0 && index < tokens.length; index += direction) {
      if (!['space', 'apply'].includes(tokens[index].kind)) return { token: tokens[index], index };
    }
    return null;
  }

  function faithfulBarPairs(tokens) {
    const stacks = { '|': [], '‖': [] };
    const tentative = [];
    const closing = new Set();
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token.kind !== 'bar' || token.barRole === 'relation') continue;
      const fenceText = token.fenceText || '|';
      const stack = stacks[fenceText];
      const previous = faithfulSignificantToken(tokens, index - 1, -1);
      const previousCanEnd = previous && (faithfulCanEnd(previous.token) || closing.has(previous.index));
      if (stack.length && previousCanEnd) {
        const open = stack.pop();
        tentative.push({ open, close: index });
        closing.add(index);
      } else if (stack.length < MAX_MATHML_DEPTH) stack.push(index);
    }
    const leftBoundary = (entry) => !entry || ['operator', 'relation', 'open', 'separator', 'bar'].includes(entry.token.kind);
    const rightBoundary = (entry) => !entry || ['operator', 'relation', 'close', 'separator', 'postfix', 'bar'].includes(entry.token.kind);
    const pairs = new Map();
    for (const pair of tentative) {
      const left = faithfulSignificantToken(tokens, pair.open - 1, -1);
      const right = faithfulSignificantToken(tokens, pair.close + 1, 1);
      const explicit = tokens[pair.open].barRole === 'fence' && tokens[pair.close].barRole === 'fence';
      if (explicit || leftBoundary(left) || rightBoundary(right)) pairs.set(pair.open, pair.close);
    }
    return pairs;
  }

  function serializeMathMLFaithfulTokens(tokens, depth) {
    const level = depth || 0;
    if (level > MAX_MATHML_DEPTH) return tokens.map((token) => token.text || '').join('');
    const pairs = faithfulBarPairs(tokens);
    const collapse = (start, end, nestedDepth) => {
      const collapsed = [];
      if (nestedDepth > MAX_MATHML_DEPTH) return tokens.slice(start, end);
      for (let index = start; index < end; index += 1) {
        const token = tokens[index];
        const close = pairs.get(index);
        if (close != null && close < end) {
          const inner = serializeMathMLFaithfulLinear(collapse(index + 1, close, nestedDepth + 1));
          const fence = token.fenceText || '|';
          collapsed.push(faithfulResult(fence + inner + fence + (tokens[close].scriptSuffix || ''), 'operand', {
            subscripted: Boolean(tokens[close].subscripted),
            variableLike: false
          }));
          index = close;
          continue;
        }
        if (token.kind === 'bar') {
          collapsed.push(faithfulResult(
            (token.barRole === 'fence' ? token.fenceText : token.text) + (token.scriptSuffix || ''),
            'relation'
          ));
        } else collapsed.push(token);
      }
      return collapsed;
    };
    return serializeMathMLFaithfulLinear(collapse(0, tokens.length, 0));
  }

  function serializeMathMLFaithfulLinear(tokens) {
    let output = '';
    let previous = null;
    let applyPending = false;
    let invisibleTimesPending = false;
    let explicitSpace = false;
    const trimEnd = () => { output = output.replace(/\s+$/u, ''); };
    for (const token of tokens) {
      if (!token || token.kind === 'space') {
        explicitSpace = Boolean(output);
        continue;
      }
      if (token.kind === 'apply') {
        applyPending = true;
        continue;
      }
      if (token.kind === 'invisibleTimes') {
        invisibleTimesPending = true;
        continue;
      }
      if (token.kind === 'relation') {
        trimEnd();
        output += ' ' + token.text + ' ';
        previous = token;
        explicitSpace = false;
        applyPending = false;
        continue;
      }
      if (token.kind === 'separator') {
        trimEnd();
        output += token.text + (token.text === ',' || token.text === ';' ? ' ' : ' ');
        previous = token;
        explicitSpace = false;
        applyPending = false;
        continue;
      }
      if (token.kind === 'operator') {
        const unary = !previous || ['operator', 'relation', 'open', 'separator'].includes(previous.kind);
        trimEnd();
        if (token.compact) output += token.text;
        else if (unary && /^[+−±∓¬-]$/u.test(token.text)) output += token.text;
        else output += ' ' + token.text + ' ';
        previous = token;
        explicitSpace = false;
        applyPending = false;
        continue;
      }
      if (token.kind === 'postfix') {
        trimEnd();
        output += token.text;
        previous = token;
        explicitSpace = false;
        applyPending = false;
        continue;
      }
      if (applyPending) {
        if ((token.functionArgumentScope && !faithfulExpressionIsAtomic(resolveFaithfulScopes(token.text))) ||
            token.scriptFence) {
          trimEnd();
          output += '(' + resolveFaithfulScopes(token.text) + ')';
          previous = token;
          explicitSpace = false;
          applyPending = false;
          invisibleTimesPending = false;
          continue;
        }
        if (token.kind !== 'open' && output && !/\s$/u.test(output)) output += ' ';
      } else if (invisibleTimesPending) {
        const numericMerge = previous && previous.kind === 'number' && token.kind === 'number';
        const wordMerge = previous && previous.kind === 'identifier' && token.kind === 'identifier' &&
          (Array.from(previous.text).length > 1 || Array.from(token.text).length > 1);
        if (numericMerge || wordMerge) output += '⋅';
      } else if (previous && previous.kind === 'large') {
        if (output && !/\s$/u.test(output)) output += ' ';
      } else if (explicitSpace && previous && faithfulCanEnd(previous) && faithfulCanStart(token) &&
                 !/\s$/u.test(output)) {
        output += ' ';
      }
      output += token.text;
      previous = token;
      explicitSpace = false;
      applyPending = false;
      invisibleTimesPending = false;
    }
    return formatFaithfulMathText(output, true);
  }

  function faithfulPiecewiseRow(children) {
    const meaningful = children.filter((child) =>
      !['mspace', 'annotation', 'annotation-xml', 'mphantom', 'none'].includes((child.localName || '').toLowerCase())
    );
    if (meaningful.length !== 2 || normalizedMathToken(meaningful[0].textContent || '') !== '{' ||
        (meaningful[1].localName || '').toLowerCase() !== 'mtable') return null;
    const rows = elementChildren(meaningful[1]).filter((row) =>
      ['mtr', 'mlabeledtr'].includes((row.localName || '').toLowerCase())
    );
    if (!rows.length) return null;
    const branches = rows.map((row) => {
      const cells = elementChildren(row).filter((cell) => (cell.localName || '').toLowerCase() === 'mtd')
        .map((cell) => serializeMathMLFaithfulNode(cell).text);
      if (cells.length < 2) return cells[0] || '';
      const condition = cells.slice(1).join(' ').trim();
      return cells[0] + (/^(?:if|when|for|otherwise)\b/iu.test(condition) ? ' ' : ' if ') + condition;
    });
    return faithfulResult('{' + branches.join('; ') + '}', 'operand');
  }

  function serializeMathMLFaithfulRow(children) {
    const transparent = new Set(['math', 'mrow', 'mstyle', 'mpadded']);
    const flattenSequence = (nodes) => {
      const flattened = [];
      for (const node of nodes) {
        const name = String(node && (node.localName || node.nodeName) || '').toLowerCase();
        if (transparent.has(name)) {
          const nestedChildren = elementChildren(node);
          const piecewise = faithfulPiecewiseRow(nestedChildren);
          if (piecewise) {
            flattened.push(piecewise);
          } else if (name === 'mrow') {
            const single = nestedChildren.length === 1
              ? serializeMathMLFaithfulNode(nestedChildren[0])
              : null;
            if (single && ['operator', 'relation', 'bar', 'postfix', 'open', 'close', 'separator'].includes(single.kind)) {
              flattened.push(single);
              continue;
            }
            // A nested presentation row is often the only surviving evidence
            // of an invisible TeX group. Keep it as a soft scope: the scope
            // resolver adds parentheses only when adjacent factors, scripts,
            // or division would otherwise change the rendered meaning.
            flattened.push(faithfulResult(
              faithfulMarkedScope(serializeMathMLFaithfulRow(nestedChildren), false),
              'operand',
              {
                functionArgumentScope: Boolean(
                  flattened.length && flattened[flattened.length - 1].kind === 'apply'
                )
              }
            ));
          } else {
            flattened.push(...flattenSequence(nestedChildren));
          }
          continue;
        }
        if (name === 'semantics') {
          const presentation = presentationMathNode(node);
          if (presentation) flattened.push(...flattenSequence([presentation]));
          continue;
        }
        flattened.push(serializeMathMLFaithfulNode(node));
      }
      return flattened;
    };
    const tokens = flattenSequence(children).filter((token) =>
      token.text || ['space', 'apply', 'invisibleTimes'].includes(token.kind)
    );
    for (let index = 1; index + 1 < tokens.length; index += 1) {
      if (!tokens[index].zeroLineFraction || tokens[index - 1].kind !== 'open' ||
          tokens[index - 1].text !== '(' || tokens[index + 1].kind !== 'close' ||
          tokens[index + 1].text !== ')') continue;
      tokens.splice(index - 1, 3, faithfulResult(
        'C(' + tokens[index].numerator + ', ' + tokens[index].denominator + ')',
        'operand'
      ));
      index -= 1;
    }
    for (let index = 1; index + 1 < tokens.length; index += 1) {
      if (tokens[index].tableText == null || tokens[index - 1].kind !== 'open' || tokens[index + 1].kind !== 'close') continue;
      tokens[index] = { ...tokens[index], text: tokens[index].tableText };
    }
    return serializeMathMLFaithfulTokens(tokens, 0);
  }

  function faithfulMathMLDenominatorOptions(node) {
    if (!node || node.nodeType !== 1) return {};
    const name = String(node.localName || node.nodeName || '').toLowerCase();
    if (['mi', 'mn', 'msqrt', 'mroot', 'mfenced'].includes(name)) return { denominatorAtomic: true };
    if (['msup', 'msub', 'msubsup', 'mmultiscripts', 'mover', 'munder', 'munderover'].includes(name)) {
      return faithfulMathMLDenominatorOptions(elementChildren(node)[0]);
    }
    if (['math', 'mrow', 'mstyle', 'mpadded', 'semantics'].includes(name)) {
      const meaningful = elementChildren(node).filter((child) =>
        !['mspace', 'annotation', 'annotation-xml', 'mphantom', 'none'].includes(
          String(child.localName || child.nodeName || '').toLowerCase()
        )
      );
      if (meaningful.length === 1) return faithfulMathMLDenominatorOptions(meaningful[0]);
    }
    return {};
  }

  function faithfulScriptBaseText(base) {
    const text = resolveFaithfulScopes(base && base.text || '').trim();
    if (!text || faithfulFullyFenced(text)) return text;
    if (base && base.scriptFence) return '(' + text + ')';
    if (base && (base.kind === 'identifier' || base.kind === 'number' || base.variableLike)) return text;
    return faithfulExpressionIsAtomic(text) ? text : '(' + text + ')';
  }

  function faithfulMathMLAccent(base, upper) {
    const value = String(upper == null ? '' : upper).trim();
    const accents = {
      '^': ['hat', '\u0302'], 'ˆ': ['hat', '\u0302'],
      '~': ['tilde', '\u0303'], '˜': ['tilde', '\u0303'],
      '¯': ['overline', '\u0305'], '‾': ['overline', '\u0305'], 'ˉ': ['overline', '\u0305'], '\u0305': ['overline', '\u0305'],
      '→': ['vec', '\u20d7'], '\u20d7': ['vec', '\u20d7'],
      '←': ['overleftarrow', '\u20d6'], '\u20d6': ['overleftarrow', '\u20d6'],
      '˙': ['dot', '\u0307'], '\u0307': ['dot', '\u0307'],
      '¨': ['ddot', '\u0308'], '\u0308': ['ddot', '\u0308'],
      'ˊ': ['acute', '\u0301'], '\u0301': ['acute', '\u0301'],
      'ˋ': ['grave', '\u0300'], '\u0300': ['grave', '\u0300'],
      '˘': ['breve', '\u0306'], '\u0306': ['breve', '\u0306'],
      'ˇ': ['check', '\u030c'], '\u030c': ['check', '\u030c'],
      '˚': ['mathring', '\u030a'], '\u030a': ['mathring', '\u030a']
    };
    if (!accents[value]) return null;
    return faithfulAccent(accents[value][0], base && base.text || '', accents[value][1]);
  }

  function faithfulMathMLUnderAccent(base, lower) {
    const value = String(lower == null ? '' : lower).trim();
    if (!['‾', '¯', 'ˉ', '\u0305', '\u0332'].includes(value)) return null;
    return faithfulAccent('underline', base && base.text || '', '\u0332');
  }

  function faithfulMathMLSemanticBase(node) {
    let current = node;
    while (current && ['math', 'mrow', 'mstyle', 'mpadded'].includes(
      String(current.localName || current.nodeName || '').toLowerCase()
    )) {
      const meaningful = elementChildren(current).filter((child) =>
        !['mspace', 'annotation', 'annotation-xml', 'mphantom', 'none'].includes(
          String(child.localName || child.nodeName || '').toLowerCase()
        )
      );
      if (meaningful.length !== 1) break;
      current = meaningful[0];
    }
    return current || node;
  }

  function faithfulMenclose(notation, input) {
    const names = String(notation == null ? '' : notation).toLowerCase().match(/[a-z]+/g) || [];
    const remaining = new Set(names);
    let value = String(input == null ? '' : input);
    const up = remaining.delete('updiagonalstrike');
    const down = remaining.delete('downdiagonalstrike');
    if (up && down) value = 'xcancel(' + value + ')';
    else if (up) value = 'cancel(' + value + ')';
    else if (down) value = 'bcancel(' + value + ')';
    if (remaining.delete('radical')) value = faithfulRoot('', value);
    const box = remaining.delete('box');
    const roundedBox = remaining.delete('roundedbox');
    if (box || roundedBox) value = 'boxed(' + value + ')';
    if (remaining.size) value = 'enclose(' + Array.from(remaining).join(' ') + ', ' + value + ')';
    return value;
  }

  function serializeMathMLFaithfulNode(node) {
    if (!node) return faithfulResult('', 'space');
    if (node.nodeType === 3) return faithfulResult(escapeFaithfulSentinelCollisions(node.nodeValue || ''), 'operand');
    if (node.nodeType !== 1) return faithfulResult('', 'space');
    const name = (node.localName || node.nodeName || '').toLowerCase();
    const children = elementChildren(node);
    const childResult = (index) => serializeMathMLFaithfulNode(children[index]);
    const childText = (index) => childResult(index).text;
    const rowText = () => serializeMathMLFaithfulRow(children);

    if (['math', 'mrow', 'mstyle', 'mpadded'].includes(name)) {
      const piecewise = faithfulPiecewiseRow(children);
      if (piecewise) return piecewise;
    }
    if (name === 'mi') {
      const rawValue = mathMLTokenText(node).trim();
      const value = escapeFaithfulSentinelCollisions(rawValue);
      if (value !== rawValue) return faithfulResult(value, 'identifier', { variableLike: true });
      if (isVerticalBarToken(value)) return faithfulOperator(node);
      return faithfulResult(value, 'identifier', { variableLike: true });
    }
    if (name === 'mn') return faithfulResult(escapeFaithfulSentinelCollisions(mathMLTokenText(node).trim()), 'number');
    if (name === 'mo') return faithfulOperator(node);
    if (name === 'mtext' || name === 'ms' || name === 'mglyph') {
      return faithfulResult(protectFaithfulText(mathMLTokenText(node)), 'operand');
    }
    if (name === 'mspace') return faithfulResult('', 'space');
    if (name === 'mphantom' || name === 'annotation' || name === 'annotation-xml' || name === 'none') {
      return faithfulResult('', 'space');
    }
    if (name === 'semantics') {
      const presentation = children.find((item) => !['annotation', 'annotation-xml'].includes((item.localName || '').toLowerCase()));
      return serializeMathMLFaithfulNode(presentation);
    }
    if (name === 'mfrac') {
      const lineThickness = String(node.getAttribute && node.getAttribute('linethickness') || '').trim().toLowerCase();
      if (/^(?:0|0+(?:\.0+)?(?:px|pt|em|ex|%)?)$/u.test(lineThickness)) {
        const numerator = childText(0);
        const denominator = childText(1);
        return faithfulResult('stack(' + numerator + ', ' + denominator + ')', 'operand', {
          zeroLineFraction: true,
          numerator,
          denominator,
          scriptFence: true
        });
      }
      return faithfulResult(
        faithfulFraction(childText(0), childText(1), faithfulMathMLDenominatorOptions(children[1])),
        'operand',
        { scriptFence: true }
      );
    }
    if (name === 'msqrt') return faithfulResult(faithfulRoot('', rowText()), 'operand', { scriptFence: true });
    if (name === 'mroot') {
      return faithfulResult(faithfulRoot(childText(1), childText(0)), 'operand', { scriptFence: true });
    }
    if (name === 'msup' || name === 'msub' || name === 'msubsup') {
      const base = childResult(0);
      const lower = name === 'msup' ? '' : childText(1);
      const upper = name === 'msub' ? '' : childText(name === 'msup' ? 1 : 2);
      const lowerSuffix = lower ? toFaithfulScript(lower, SUBSCRIPTS, '_') : '';
      const upperSuffix = upper ? toFaithfulScript(upper, SUPERSCRIPTS, '^') : '';
      if (!resolveFaithfulScopes(base.text).trim()) {
        return faithfulResult(upperSuffix + lowerSuffix, 'operand', { prescript: true });
      }
      if (base.kind === 'bar') {
        return { ...base, scriptSuffix: lowerSuffix + upperSuffix, subscripted: Boolean(lower) };
      }
      if (base.kind === 'open' || base.kind === 'close') {
        return { ...base, text: base.text + lowerSuffix + upperSuffix, subscripted: Boolean(lower) };
      }
      const large = Boolean(mathMLLargeOperatorName(children[0]) || base.kind === 'large' || /^(?:∑|∏|∐|∫|∬|∭|∮|lim)$/u.test(base.text));
      const scriptedBase = calculatorFunctionApplicationBase(children[0])
        ? { ...base, variableLike: true }
        : base;
      return faithfulResult(faithfulScriptBaseText(scriptedBase) + lowerSuffix + upperSuffix, large ? 'large' : 'operand', {
        subscripted: Boolean(lower),
        variableLike: Boolean(base.variableLike)
      });
    }
    if (name === 'mover' || name === 'munder' || name === 'munderover') {
      const base = serializeMathMLFaithfulNode(faithfulMathMLSemanticBase(children[0]));
      const lower = name === 'mover' ? '' : childText(1);
      const upper = name === 'munder' ? '' : childText(name === 'mover' ? 1 : 2);
      const accentAttribute = String(node.getAttribute && node.getAttribute('accent') || '').toLowerCase();
      const accent = name === 'mover' && accentAttribute !== 'false'
        ? faithfulMathMLAccent(base, upper)
        : null;
      const accentUnderAttribute = String(node.getAttribute && node.getAttribute('accentunder') || '').toLowerCase();
      const underAccent = name === 'munder' && accentUnderAttribute !== 'false'
        ? faithfulMathMLUnderAccent(base, lower)
        : null;
      if (accent || underAccent) {
        return faithfulResult(accent || underAccent, 'operand', { variableLike: base.variableLike });
      }
      const large = Boolean(mathMLLargeOperatorName(children[0]) || /^(?:∑|∏|∐|∫|∬|∭|∮|lim)$/u.test(base.text));
      if (!large) {
        const annotationKind = ['relation', 'operator'].includes(base.kind) ? base.kind : 'operand';
        if (name === 'mover') return faithfulResult('overset(' + upper + ', ' + base.text + ')', annotationKind);
        if (name === 'munder') return faithfulResult('underset(' + lower + ', ' + base.text + ')', annotationKind);
        return faithfulResult(
          'overset(' + upper + ', underset(' + lower + ', ' + base.text + '))',
          annotationKind
        );
      }
      return faithfulResult(
        base.text + (lower ? toFaithfulScript(lower, SUBSCRIPTS, '_') : '') +
          (upper ? toFaithfulScript(upper, SUPERSCRIPTS, '^') : ''),
        large ? 'large' : 'operand',
        { subscripted: Boolean(lower), variableLike: base.variableLike }
      );
    }
    if (name === 'mfenced') {
      const open = node.getAttribute('open') == null ? '(' : node.getAttribute('open');
      const close = node.getAttribute('close') == null ? ')' : node.getAttribute('close');
      const separator = (node.getAttribute('separators') || ',')[0];
      const contents = children.map((child) => serializeMathMLFaithfulNode(child).text)
        .join(separator + (separator === ',' || separator === ';' ? ' ' : ''));
      if (isVerticalBarToken(open) && isVerticalBarToken(close)) {
        const fence = /[‖∥‗]/u.test(open + close) ? '‖' : '|';
        return faithfulResult(fence + contents + fence, 'operand');
      }
      return faithfulResult(open + contents + close, 'operand');
    }
    if (name === 'mtable') {
      const columnAlign = String(node.getAttribute && node.getAttribute('columnalign') || '')
        .trim().toLowerCase().split(/\s+/u).filter(Boolean);
      const columnSpacing = String(node.getAttribute && node.getAttribute('columnspacing') || '')
        .trim().toLowerCase().split(/\s+/u).filter(Boolean);
      const rowCellCounts = children.map((row) => elementChildren(row).length);
      const zeroSpaced = columnSpacing.length > 0 && columnSpacing.every((value) =>
        /^0+(?:\.0+)?(?:px|pt|em|ex|%)?$/u.test(value)
      );
      const pairedAlignmentSpacing = columnSpacing.length > 0 && columnSpacing.every((value, index) =>
        index % 2 === 1 || /^0+(?:\.0+)?(?:px|pt|em|ex|%)?$/u.test(value)
      );
      const alignmentLayout = (zeroSpaced || pairedAlignmentSpacing) && (
        (rowCellCounts.length > 0 && rowCellCounts.every((count) => count === 1) && columnAlign[0] === 'center') ||
        (columnAlign.length >= 2 && columnAlign.every((value, index) => value === (index % 2 ? 'left' : 'right')))
      );
      const rows = children.map((row) => elementChildren(row)
        .map((cell) => serializeMathMLFaithfulNode(cell).text)
        .join(alignmentLayout ? ' ' : ', '));
      const tableText = alignmentLayout ? joinReadableEquationRows(rows) : rows.join('; ');
      return faithfulResult(alignmentLayout ? tableText : '[' + tableText + ']', 'operand', { tableText });
    }
    if (name === 'mtr' || name === 'mlabeledtr') {
      return faithfulResult(children.map((child) => serializeMathMLFaithfulNode(child).text).join(', '), 'operand');
    }
    if (name === 'mtd') return faithfulResult(rowText(), 'operand');
    if (name === 'menclose') {
      const notation = node.getAttribute('notation') || '';
      return faithfulResult(faithfulMenclose(notation, rowText()), 'operand');
    }
    if (name === 'mmultiscripts') {
      const result = childResult(0);
      let preText = '';
      let postText = '';
      let prescripts = false;
      let subscripted = false;
      for (let index = 1; index < children.length;) {
        if ((children[index].localName || '').toLowerCase() === 'mprescripts') {
          prescripts = true;
          index += 1;
          continue;
        }
        const lowerNode = children[index];
        const upperNode = children[index + 1];
        const lower = lowerNode && (lowerNode.localName || '').toLowerCase() !== 'none'
          ? toFaithfulScript(serializeMathMLFaithfulNode(lowerNode).text, SUBSCRIPTS, '_')
          : '';
        const upper = upperNode && (upperNode.localName || '').toLowerCase() !== 'none'
          ? toFaithfulScript(serializeMathMLFaithfulNode(upperNode).text, SUPERSCRIPTS, '^')
          : '';
        if (lower) {
          subscripted = true;
        }
        if (prescripts) preText = upper + lower + preText;
        else postText += lower + upper;
        index += 2;
      }
      const text = preText + faithfulScriptBaseText(result) + postText;
      return faithfulResult(text, 'operand', { subscripted, variableLike: result.variableLike });
    }
    if (name === 'maction') return childResult(0);
    if (name === 'apply' || name === 'bind' || name === 'ci' || name === 'cn' || name === 'csymbol') {
      return faithfulResult(formatFaithfulMathText(escapeFaithfulSentinelCollisions(serializeContentMathML(node)), true), 'operand');
    }
    return faithfulResult(rowText() || escapeFaithfulSentinelCollisions(mathMLTokenText(node)), 'operand');
  }

  function mathMLToFaithful(mathElement) {
    return formatFaithfulMathText(serializeMathMLFaithfulNode(mathElement).text);
  }

  function mathSelectionKey(input) {
    let value = cleanClipboardText(String(input == null ? '' : input));
    try {
      value = value.normalize('NFKC');
    } catch (_error) {
      // Normalization is present in supported browsers; retaining the source is safe.
    }
    return value
      .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2061-\u2069\ufe00-\ufe0f]/g, '')
      .replace(/[\s\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, '')
      .replace(/[\u2212\u2010-\u2015]/g, '-')
      .replace(/[\u00d7\u00b7\u22c5\u2217]/g, '*')
      .replace(/\u00f7/g, '/')
      .replace(/[\u2223\u2758]/g, '|');
  }

  function presentationMathNode(mathElement) {
    if (!mathElement || mathElement.nodeType !== 1) return null;
    const name = (mathElement.localName || '').toLowerCase();
    if (name === 'semantics') {
      return elementChildren(mathElement).find((item) =>
        !['annotation', 'annotation-xml'].includes((item.localName || '').toLowerCase())
      ) || null;
    }
    if (name === 'math') {
      const semantics = elementChildren(mathElement).find((item) => (item.localName || '').toLowerCase() === 'semantics');
      return semantics ? presentationMathNode(semantics) : mathElement;
    }
    return mathElement;
  }

  function combineSurfaceVariants(groups, limit) {
    let combined = [''];
    for (const group of groups) {
      const next = [];
      for (const prefix of combined) {
        for (const suffix of group.length ? group : ['']) {
          const value = prefix + suffix;
          if (!next.includes(value)) next.push(value);
          if (next.length >= limit) break;
        }
        if (next.length >= limit) break;
      }
      combined = next;
    }
    return combined;
  }

  // Surface variants model the order a visual renderer can expose through a
  // Selection. KaTeX, for example, places a denominator before a numerator in
  // DOM text order even though its MathML retains the correct fraction order.
  function mathMLSurfaceVariants(node) {
    if (!node || node.nodeType !== 1) return [''];
    const name = (node.localName || '').toLowerCase();
    const children = elementChildren(node).filter((child) =>
      !['annotation', 'annotation-xml', 'mphantom', 'none'].includes((child.localName || '').toLowerCase())
    );
    if (['mi', 'mn', 'mo', 'mtext', 'ms', 'mglyph'].includes(name)) {
      return [mathSelectionKey(mathMLTokenText(node))];
    }
    if (name === 'mspace' || name === 'annotation' || name === 'annotation-xml' || name === 'mphantom' || name === 'none') {
      return [''];
    }
    if (name === 'semantics') {
      const presentation = presentationMathNode(node);
      return presentation ? mathMLSurfaceVariants(presentation) : [''];
    }
    if (name === 'mfrac' && children.length >= 2) {
      const numerator = mathMLSurfaceVariants(children[0]);
      const denominator = mathMLSurfaceVariants(children[1]);
      return Array.from(new Set([
        ...combineSurfaceVariants([numerator, denominator], 16),
        ...combineSurfaceVariants([denominator, numerator], 16)
      ])).slice(0, 24);
    }
    if (name === 'mroot' && children.length >= 2) {
      const radicand = mathMLSurfaceVariants(children[0]);
      const degree = mathMLSurfaceVariants(children[1]);
      return Array.from(new Set([
        ...combineSurfaceVariants([degree, radicand], 16),
        ...combineSurfaceVariants([radicand, degree], 16),
        ...radicand.map((value) => mathSelectionKey('√') + value)
      ])).slice(0, 24);
    }
    const childGroups = children.map(mathMLSurfaceVariants);
    const normal = combineSurfaceVariants(childGroups, 24);
    if (name === 'msqrt') {
      return Array.from(new Set(normal.concat(normal.map((value) => mathSelectionKey('√') + value)))).slice(0, 32);
    }
    if (name === 'mover' || name === 'munder' || name === 'munderover') {
      return Array.from(new Set(normal.concat(mathSelectionKey(serializeMathMLNode(node))))).slice(0, 32);
    }
    return normal.length ? normal : [mathSelectionKey(mathMLTokenText(node))];
  }

  function sliceMathMLSurfaceNode(node, surface, start, end, documentObject) {
    if (!node || node.nodeType !== 1 || start < 0 || end <= start || end > surface.length) return null;
    if (start === 0 && end === surface.length) return node.cloneNode(true);
    const name = (node.localName || '').toLowerCase();
    if (['mi', 'mn', 'mo', 'mtext', 'ms'].includes(name)) {
      const clone = node.cloneNode(false);
      const raw = cleanClipboardText(mathMLTokenText(node));
      let cursor = 0;
      let sliced = '';
      for (const character of Array.from(raw)) {
        const key = mathSelectionKey(character);
        const next = cursor + key.length;
        if (next > start && cursor < end) {
          if (start <= cursor && end >= next) sliced += character;
          else sliced += key.slice(Math.max(0, start - cursor), Math.min(key.length, end - cursor));
        }
        cursor = next;
      }
      if (!sliced) sliced = surface.slice(start, end);
      clone.textContent = sliced;
      return clone;
    }
    const children = elementChildren(node).filter((child) =>
      !['annotation', 'annotation-xml', 'mphantom', 'none', 'mspace'].includes((child.localName || '').toLowerCase())
    );
    if (!children.length) return null;
    const groups = children.map((child) => mathMLSurfaceVariants(child).filter((variant) => variant.length > 0));
    let selectedVariants = null;
    const choose = (index, cursor, chosen) => {
      if (selectedVariants || index === groups.length) {
        if (!selectedVariants && index === groups.length && cursor === surface.length) selectedVariants = chosen.slice();
        return;
      }
      for (const variant of groups[index]) {
        if (!surface.startsWith(variant, cursor)) continue;
        chosen.push(variant);
        choose(index + 1, cursor + variant.length, chosen);
        chosen.pop();
        if (selectedVariants) return;
      }
    };
    choose(0, 0, []);
    if (!selectedVariants) return null;
    const pieces = [];
    let cursor = 0;
    for (let index = 0; index < children.length; index += 1) {
      const variant = selectedVariants[index];
      const next = cursor + variant.length;
      const localStart = Math.max(0, start - cursor);
      const localEnd = Math.min(variant.length, end - cursor);
      pieces[index] = localEnd > localStart
        ? sliceMathMLSurfaceNode(children[index], variant, localStart, localEnd, documentObject)
        : null;
      cursor = next;
    }
    if (['msup', 'msub'].includes(name) && pieces[0] && pieces[1]) {
      const script = documentObject.createElementNS(MATHML_NAMESPACE, name);
      script.append(pieces[0], pieces[1]);
      return script;
    }
    if (name === 'msubsup' && pieces[0] && (pieces[1] || pieces[2])) {
      if (pieces[1] && pieces[2]) {
        const script = documentObject.createElementNS(MATHML_NAMESPACE, 'msubsup');
        script.append(pieces[0], pieces[1], pieces[2]);
        return script;
      }
      const script = documentObject.createElementNS(MATHML_NAMESPACE, pieces[1] ? 'msub' : 'msup');
      script.append(pieces[0], pieces[1] || pieces[2]);
      return script;
    }
    const selectedPieces = pieces.filter(Boolean);
    if (selectedPieces.length === 1) return selectedPieces[0];
    if (!selectedPieces.length) return null;
    const row = documentObject.createElementNS(MATHML_NAMESPACE, 'mrow');
    row.append(...selectedPieces);
    return row;
  }

  function wrapMathMLFragment(nodes, documentObject) {
    if (!nodes || !nodes.length || !documentObject) return null;
    const math = documentObject.createElementNS(MATHML_NAMESPACE, 'math');
    const row = documentObject.createElementNS(MATHML_NAMESPACE, 'mrow');
    for (const node of nodes) row.appendChild(node.cloneNode(true));
    math.appendChild(row);
    return math;
  }

  function latexEscapeText(input) {
    return String(input == null ? '' : input)
      .replace(/\\/g, String.raw`\textbackslash{}`)
      .replace(/([{}#$%&_])/g, '\\$1')
      .replace(/\^/g, String.raw`\^{}`)
      .replace(/~/g, String.raw`\~{}`);
  }

  function mathMLToLatexNode(node) {
    if (!node || node.nodeType !== 1) return '';
    const name = (node.localName || '').toLowerCase();
    const children = elementChildren(node);
    const child = (index) => mathMLToLatexNode(children[index]);
    const all = () => children.map(mathMLToLatexNode).join('');
    if (name === 'semantics') return mathMLToLatexNode(presentationMathNode(node));
    if (name === 'mi' || name === 'mn') return mathMLTokenText(node).trim();
    if (name === 'mtext' || name === 'ms') return '\\text{' + latexEscapeText(mathMLTokenText(node)) + '}';
    if (name === 'mo') {
      const token = normalizedMathToken(mathMLTokenText(node));
      const operators = {
        '×': String.raw`\times `, '÷': String.raw`\div `, '·': String.raw`\cdot `,
        '−': '-', '±': String.raw`\pm `, '∓': String.raw`\mp `, '∝': String.raw`\propto `,
        '≤': String.raw`\le `, '≥': String.raw`\ge `, '≠': String.raw`\ne `, '≈': String.raw`\approx `,
        '∑': String.raw`\sum `, '∏': String.raw`\prod `, '∫': String.raw`\int `,
        '→': String.raw`\to `, '⇒': String.raw`\Rightarrow `, '∞': String.raw`\infty `,
        '∣': '|', '❘': '|', '‖': String.raw`\Vert `, '∥': String.raw`\Vert `
      };
      return operators[token] || token;
    }
    if (name === 'mspace' || name === 'mphantom' || name === 'annotation' || name === 'annotation-xml' || name === 'none') return '';
    if (name === 'mfrac') return '\\frac{' + child(0) + '}{' + child(1) + '}';
    if (name === 'msqrt') return '\\sqrt{' + all() + '}';
    if (name === 'mroot') return '\\sqrt[' + child(1) + ']{' + child(0) + '}';
    if (name === 'msup') return '{' + child(0) + '}^{' + child(1) + '}';
    if (name === 'msub') return '{' + child(0) + '}_{' + child(1) + '}';
    if (name === 'msubsup') return '{' + child(0) + '}_{' + child(1) + '}^{' + child(2) + '}';
    if (name === 'mover') return '\\overset{' + child(1) + '}{' + child(0) + '}';
    if (name === 'munder') return '\\underset{' + child(1) + '}{' + child(0) + '}';
    if (name === 'munderover') return '\\overset{' + child(2) + '}{\\underset{' + child(1) + '}{' + child(0) + '}}';
    if (name === 'mfenced') {
      const open = node.getAttribute('open') == null ? '(' : node.getAttribute('open');
      const close = node.getAttribute('close') == null ? ')' : node.getAttribute('close');
      return String.raw`\left` + open + children.map(mathMLToLatexNode).join(',') + String.raw`\right` + close;
    }
    if (name === 'mtable') {
      return String.raw`\begin{matrix}` + children.map((row) =>
        elementChildren(row).map(mathMLToLatexNode).join('&')
      ).join(String.raw`\\`) + String.raw`\end{matrix}`;
    }
    if (name === 'maction') return child(0);
    return all();
  }

  function mathMLFragmentText(mathElement, outputMode) {
    if (outputMode === 'calculator') {
      let single = presentationMathNode(mathElement);
      while (single && ['math', 'mrow', 'mstyle', 'mpadded'].includes((single.localName || '').toLowerCase()) &&
             elementChildren(single).length === 1) {
        single = elementChildren(single)[0];
      }
      if (single && !elementChildren(single).length && isVerticalBarToken(single.textContent || '')) return '|';
      return mathMLToCalculator(mathElement);
    }
    if (outputMode === 'faithful') return mathMLToFaithful(mathElement);
    if (outputMode === 'latex') return '$' + mathMLToLatexNode(mathElement) + '$';
    const unicode = mathMLToUnicode(mathElement);
    return outputMode === 'ascii' ? unicodeToAscii(unicode) : unicode;
  }

  function findSelectedMathMLFragment(mathElement, selectedText, selectedOffset, visualText, preferredStructures, preferVisualFractions) {
    const selectedKey = mathSelectionKey(selectedText);
    const presentation = presentationMathNode(mathElement);
    if (!selectedKey || selectedKey.length > MAX_SELECTION_KEY_LENGTH || !presentation ||
        !domTreeWithinBudget(presentation, MAX_PARTIAL_MATCH_NODES, MAX_MATHML_DEPTH)) return null;
    const visualKey = mathSelectionKey(visualText || '');
    const structureHints = preferredStructures instanceof Set ? preferredStructures : new Set(preferredStructures || []);
    const candidates = [];
    const seen = new Set();
    const candidateIds = new WeakMap();
    const surfaceCache = new WeakMap();
    const rowNames = new Set(['math', 'mrow', 'mstyle', 'mpadded', 'menclose', 'mtd', 'mtr', 'mlabeledtr']);
    const structuralNames = new Set(['mfrac', 'msqrt', 'mroot', 'msup', 'msub', 'msubsup', 'mover', 'munder', 'munderover', 'mfenced']);
    let partialMatchWork = 0;
    let partialMatchBudgetExceeded = false;
    let directVisualCandidate = null;

    const spendPartialMatchWork = (amount = 1) => {
      partialMatchWork += amount;
      if (partialMatchWork > MAX_PARTIAL_MATCH_WORK) partialMatchBudgetExceeded = true;
      return !partialMatchBudgetExceeded;
    };

    const variantsFor = (node) => {
      if (surfaceCache.has(node)) return surfaceCache.get(node);
      const variants = mathMLSurfaceVariants(node);
      surfaceCache.set(node, variants);
      return variants;
    };
    let candidateId = 0;
    const assignCandidateIds = (node) => {
      if (!node || node.nodeType !== 1 || candidateIds.has(node) ||
          !spendPartialMatchWork()) return;
      candidateIds.set(node, String(candidateId++));
      for (const child of elementChildren(node)) {
        assignCandidateIds(child);
        if (partialMatchBudgetExceeded) break;
      }
    };
    assignCandidateIds(presentation);
    if (partialMatchBudgetExceeded) return null;

    const addCandidate = (nodes, coherent, depth, knownVariants) => {
      if (!nodes.length || !spendPartialMatchWork()) return null;
      if (candidates.length >= MAX_PARTIAL_MATCH_CANDIDATES) {
        partialMatchBudgetExceeded = true;
        return null;
      }
      const variants = knownVariants || (nodes.length === 1
        ? variantsFor(nodes[0])
        : combineSurfaceVariants(nodes.map(variantsFor), 24));
      if (!variants.includes(selectedKey)) return null;
      const firstRange = semanticRanges.get(nodes[0]);
      const signature = nodes.map((node) => candidateIds.get(node) || '').join(':');
      if (seen.has(signature)) return null;
      seen.add(signature);
      const wrapper = wrapMathMLFragment(nodes, mathElement.ownerDocument);
      if (!wrapper) return null;
      const structure = nodes.length === 1 ? (nodes[0].localName || '').toLowerCase() : '';
      const candidate = {
        math: wrapper,
        nodes: nodes.slice(),
        coherent,
        depth,
        structure,
        preferredStructure: structureHints.has(structure),
        nodeCount: wrapper.querySelectorAll('*').length,
        semanticOffset: firstRange ? firstRange.start : Number.POSITIVE_INFINITY,
        visualDistance: Number.POSITIVE_INFINITY,
        surfaceRank: Number.POSITIVE_INFINITY,
        directOffsetSafe: nodes.every((item) =>
          ['mi', 'mn', 'mo', 'mtext', 'ms', 'mglyph'].includes((item.localName || '').toLowerCase())
        )
      };
      candidates.push(candidate);
      return candidate;
    };
    const addSlicedCandidate = (nodes, depth, occurrence, signature) => {
      const selectedNodes = nodes.filter(Boolean);
      if (!selectedNodes.length || seen.has(signature) || !spendPartialMatchWork()) return null;
      if (candidates.length >= MAX_PARTIAL_MATCH_CANDIDATES) {
        partialMatchBudgetExceeded = true;
        return null;
      }
      const wrapper = wrapMathMLFragment(selectedNodes, mathElement.ownerDocument);
      if (!wrapper || mathSelectionKey(wrapper.textContent || '') !== selectedKey) return null;
      seen.add(signature);
      const candidate = {
        math: wrapper,
        nodes: [],
        coherent: 1,
        depth,
        structure: '',
        preferredStructure: false,
        nodeCount: wrapper.querySelectorAll('*').length,
        semanticOffset: occurrence,
        visualDistance: Number.isFinite(selectedOffset) ? Math.abs(occurrence - selectedOffset) : 0,
        surfaceRank: 0,
        sliced: true,
        directOffsetSafe: selectedNodes.every((item) =>
          ['mi', 'mn', 'mo', 'mtext', 'ms', 'mglyph'].includes((item.localName || '').toLowerCase())
        )
      };
      candidates.push(candidate);
      return candidate;
    };

    const semanticRanges = new WeakMap();
    let semanticCursor = 0;
    const indexSemanticRanges = (node) => {
      if (!node || node.nodeType !== 1 || !spendPartialMatchWork()) return;
      const start = semanticCursor;
      const name = (node.localName || '').toLowerCase();
      if (['mi', 'mn', 'mo', 'mtext', 'ms', 'mglyph'].includes(name)) {
        semanticCursor += mathSelectionKey(mathMLTokenText(node)).length;
      } else if (!['annotation', 'annotation-xml', 'mphantom', 'none', 'mspace'].includes(name)) {
        for (const child of elementChildren(node)) {
          indexSemanticRanges(child);
          if (partialMatchBudgetExceeded) break;
        }
      }
      semanticRanges.set(node, { start, end: semanticCursor });
    };
    indexSemanticRanges(presentation);
    if (partialMatchBudgetExceeded) return null;

    const walk = (node, depth) => {
      if (!node || node.nodeType !== 1 || directVisualCandidate ||
          partialMatchBudgetExceeded || !spendPartialMatchWork()) return;
      const name = (node.localName || '').toLowerCase();
      if (['annotation', 'annotation-xml', 'mphantom', 'none'].includes(name)) return;
      if (!['math', 'semantics'].includes(name)) addCandidate([node], structuralNames.has(name) ? 3 : 2, depth);
      const children = elementChildren(node).filter((child) =>
        !['annotation', 'annotation-xml', 'mphantom', 'none'].includes((child.localName || '').toLowerCase())
      );
      const surfaceChildren = children.filter((child) =>
        (child.localName || '').toLowerCase() !== 'mspace' && variantsFor(child).some((variant) => variant.length > 0)
      );
      if (rowNames.has(name) && surfaceChildren.length) {
        let sequences = [{ text: '', boundaries: [0], variants: [] }];
        for (const child of surfaceChildren) {
          if (!spendPartialMatchWork()) break;
          const childVariants = variantsFor(child).length ? variantsFor(child) : [''];
          const next = [];
          for (const sequence of sequences) {
            for (const variant of childVariants) {
              if (!spendPartialMatchWork()) break;
              const text = sequence.text + variant;
              if (next.some((item) => item.text === text)) continue;
              next.push({
                text,
                boundaries: sequence.boundaries.concat(text.length),
                variants: sequence.variants.concat(variant)
              });
              if (next.length >= 24) break;
            }
            if (partialMatchBudgetExceeded) break;
            if (next.length >= 24) break;
          }
          sequences = next;
          if (partialMatchBudgetExceeded) break;
        }
        if (partialMatchBudgetExceeded) return;
        for (const sequence of sequences) {
          const boundaryIndex = new Map(sequence.boundaries.map((offset, index) => [offset, index]));
          const directOccurrence = Number.isFinite(selectedOffset) && visualKey &&
            sequence.text === visualKey &&
            sequence.text.slice(selectedOffset, selectedOffset + selectedKey.length) === selectedKey
            ? selectedOffset
            : -1;
          let occurrence = directOccurrence >= 0 ? directOccurrence : sequence.text.indexOf(selectedKey);
          let occurrenceCount = 0;
          while (occurrence >= 0) {
            if (!spendPartialMatchWork()) return;
            occurrenceCount += 1;
            if (directOccurrence < 0 && occurrenceCount > MAX_PARTIAL_MATCH_OCCURRENCES) {
              partialMatchBudgetExceeded = true;
              return;
            }
            const finish = occurrence + selectedKey.length;
            const alignedStart = boundaryIndex.get(occurrence);
            const alignedEnd = boundaryIndex.get(finish);
            let candidate = null;
            if (alignedStart != null && alignedEnd != null && alignedEnd > alignedStart) {
              candidate = addCandidate(
                surfaceChildren.slice(alignedStart, alignedEnd),
                alignedEnd - alignedStart > 1 ? 1 : 2,
                depth,
                [selectedKey]
              );
            } else {
              const childIndexAt = (offset, endBoundary) => {
                let low = 0;
                let high = sequence.boundaries.length - 2;
                let found = -1;
                while (low <= high) {
                  const middle = (low + high) >> 1;
                  const before = endBoundary
                    ? sequence.boundaries[middle] < offset
                    : sequence.boundaries[middle] <= offset;
                  if (before) {
                    found = middle;
                    low = middle + 1;
                  } else high = middle - 1;
                }
                return found < surfaceChildren.length ? found : -1;
              };
              const startIndex = childIndexAt(occurrence, false);
              const endIndex = childIndexAt(finish, true);
              if (startIndex >= 0 && endIndex >= startIndex) {
                const sliced = [];
                for (let index = startIndex; index <= endIndex; index += 1) {
                  if (!spendPartialMatchWork()) return;
                  const variant = sequence.variants[index];
                  const localStart = Math.max(0, occurrence - sequence.boundaries[index]);
                  const localEnd = Math.min(variant.length, finish - sequence.boundaries[index]);
                  const piece = localStart === 0 && localEnd === variant.length
                    ? surfaceChildren[index].cloneNode(true)
                    : sliceMathMLSurfaceNode(surfaceChildren[index], variant, localStart, localEnd, mathElement.ownerDocument);
                  if (!piece) { sliced.length = 0; break; }
                  sliced.push(piece);
                }
                candidate = addSlicedCandidate(
                  sliced,
                  depth,
                  occurrence,
                  'slice|' + candidateIds.get(node) + '|' + occurrence + '|' + finish + '|' + sequence.text
                );
              }
            }
            if (directOccurrence >= 0) {
              // Offset-only matching is authoritative for flat token rows. A
              // structural node may expose an elided surface (for example an
              // <msqrt> whose DOM text is just its radicand), so those still
              // go through structural/layout ranking before being returned.
              if (candidate && candidate.directOffsetSafe) directVisualCandidate = candidate;
              break;
            }
            if (partialMatchBudgetExceeded) return;
            occurrence = sequence.text.indexOf(selectedKey, occurrence + 1);
          }
          if (directVisualCandidate || partialMatchBudgetExceeded) return;
        }
      }
      for (const child of children) {
        walk(child, depth + 1);
        if (directVisualCandidate || partialMatchBudgetExceeded) break;
      }
    };
    walk(presentation, 0);
    if (directVisualCandidate) return directVisualCandidate.math;
    if (partialMatchBudgetExceeded) return null;

    // Build bounded surface layouts only when two semantic candidates look the
    // same. Layout spans retain which MathML node occupies each visual offset,
    // including KaTeX's denominator-first fraction DOM.
    const layoutCache = new WeakMap();
    const shiftLayout = (layout, amount) => ({
      text: layout.text,
      spans: layout.spans.map((span) => ({ node: span.node, start: span.start + amount, end: span.end + amount })),
      rank: layout.rank
    });
    const combineLayouts = (groups, limit) => {
      let combined = [{ text: '', spans: [], rank: 0 }];
      for (const group of groups) {
        const next = [];
        for (const prefix of combined) {
          for (const suffix of group.length ? group : [{ text: '', spans: [], rank: 0 }]) {
            const shifted = shiftLayout(suffix, prefix.text.length);
            next.push({
              text: prefix.text + suffix.text,
              spans: prefix.spans.concat(shifted.spans),
              rank: prefix.rank + suffix.rank
            });
            if (next.length >= limit) break;
          }
          if (next.length >= limit) break;
        }
        combined = next;
      }
      return combined;
    };
    const layoutsFor = (node) => {
      if (!node || node.nodeType !== 1) return [{ text: '', spans: [], rank: 0 }];
      if (layoutCache.has(node)) return layoutCache.get(node);
      const name = (node.localName || '').toLowerCase();
      const children = elementChildren(node).filter((child) =>
        !['annotation', 'annotation-xml', 'mphantom', 'none', 'mspace'].includes((child.localName || '').toLowerCase())
      );
      let layouts;
      if (['mi', 'mn', 'mo', 'mtext', 'ms', 'mglyph'].includes(name)) {
        const text = mathSelectionKey(mathMLTokenText(node));
        layouts = [{ text, spans: text ? [{ node, start: 0, end: text.length }] : [], rank: 0 }];
      } else if (['mspace', 'annotation', 'annotation-xml', 'mphantom', 'none'].includes(name)) {
        layouts = [{ text: '', spans: [], rank: 0 }];
      } else if (name === 'semantics') {
        layouts = layoutsFor(presentationMathNode(node));
      } else if (name === 'mfrac' && children.length >= 2) {
        const normal = combineLayouts([layoutsFor(children[0]), layoutsFor(children[1])], 16)
          .map((layout) => ({ ...layout, rank: layout.rank + (preferVisualFractions ? 1 : 0) }));
        const reversed = combineLayouts([layoutsFor(children[1]), layoutsFor(children[0])], 16)
          .map((layout) => ({ ...layout, rank: layout.rank + (preferVisualFractions ? 0 : 1) }));
        layouts = normal.concat(reversed).slice(0, 32);
      } else if (name === 'mroot' && children.length >= 2) {
        layouts = combineLayouts([layoutsFor(children[1]), layoutsFor(children[0])], 16)
          .concat(combineLayouts([layoutsFor(children[0]), layoutsFor(children[1])], 16).map((layout) => ({ ...layout, rank: layout.rank + 1 })))
          .slice(0, 32);
      } else {
        layouts = combineLayouts(children.map(layoutsFor), 32);
        if (name === 'msqrt') {
          layouts = layouts.concat(layouts.map((layout) => {
            const shifted = shiftLayout(layout, 1);
            return { text: mathSelectionKey('√') + layout.text, spans: shifted.spans, rank: layout.rank + 1 };
          })).slice(0, 32);
        }
      }
      if (!['semantics', 'mspace', 'annotation', 'annotation-xml', 'mphantom', 'none'].includes(name)) {
        layouts = layouts.map((layout) => ({
          ...layout,
          spans: layout.text ? layout.spans.concat({ node, start: 0, end: layout.text.length }) : layout.spans
        }));
      }
      layoutCache.set(node, layouts);
      return layouts;
    };

    if (candidates.length && Number.isFinite(selectedOffset)) {
      const allLayouts = layoutsFor(presentation);
      const layouts = visualKey ? allLayouts.filter((layout) => layout.text === visualKey) : allLayouts;
      const usableLayouts = layouts.length ? layouts : allLayouts;
      for (const candidate of candidates) {
        if (candidate.sliced) continue;
        for (const layout of usableLayouts) {
          const spans = candidate.nodes.map((node) => layout.spans.find((span) => span.node === node));
          if (spans.some((span) => !span)) continue;
          const start = Math.min(...spans.map((span) => span.start));
          const end = Math.max(...spans.map((span) => span.end));
          if (layout.text.slice(start, end) !== selectedKey) continue;
          const distance = Math.abs(start - selectedOffset);
          if (distance < candidate.visualDistance ||
              (distance === candidate.visualDistance && layout.rank < candidate.surfaceRank)) {
            candidate.visualDistance = distance;
            candidate.surfaceRank = layout.rank;
          }
        }
      }
    }

    candidates.sort((left, right) => {
      const leftDistance = Number.isFinite(left.visualDistance)
        ? left.visualDistance
        : (Number.isFinite(selectedOffset) ? Math.abs(left.semanticOffset - selectedOffset) : 0);
      const rightDistance = Number.isFinite(right.visualDistance)
        ? right.visualDistance
        : (Number.isFinite(selectedOffset) ? Math.abs(right.semanticOffset - selectedOffset) : 0);
      return leftDistance - rightDistance || left.surfaceRank - right.surfaceRank ||
        Number(right.preferredStructure) - Number(left.preferredStructure) || right.depth - left.depth ||
        left.nodeCount - right.nodeCount || right.coherent - left.coherent;
    });
    if (candidates.length) return candidates[0].math;

    // A drag may begin or end in the middle of a single MathML token. Preserve
    // that exact visible substring instead of widening it to the whole token.
    const tokenCandidates = Array.from(presentation.querySelectorAll('mi, mn, mo, mtext, ms')).filter((item) =>
      mathSelectionKey(mathMLTokenText(item)).includes(selectedKey)
    );
    const token = tokenCandidates.sort((left, right) => {
      const leftRange = semanticRanges.get(left);
      const rightRange = semanticRanges.get(right);
      return Math.abs((leftRange ? leftRange.start : 0) - selectedOffset) -
        Math.abs((rightRange ? rightRange.start : 0) - selectedOffset);
    })[0];
    if (!token) return null;
    const clone = token.cloneNode(false);
    clone.textContent = cleanClipboardText(selectedText).trim();
    return wrapMathMLFragment([clone], mathElement.ownerDocument);
  }

  function officeElementName(node) {
    return String(node && (node.localName || node.nodeName) || '').split(':').pop().toLowerCase();
  }

  function findOfficeMathRoots(container) {
    if (!container || !domTreeWithinBudget(container, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return [];
    const elements = [];
    if (container.nodeType === 1) elements.push(container);
    if (container.querySelectorAll) elements.push(...container.querySelectorAll('*'));
    const roots = elements.filter((element) => {
      const name = officeElementName(element);
      if (name === 'math' || name === 'omath') return true;
      if (name !== 'omathpara') return false;
      return !Array.from(element.querySelectorAll ? element.querySelectorAll('*') : [])
        .some((child) => officeElementName(child) === 'omath');
    });
    const rootSet = new Set(roots);
    return roots.filter((root) => {
      let ancestor = root.parentElement;
      while (ancestor && ancestor !== container) {
        if (rootSet.has(ancestor)) return false;
        ancestor = ancestor.parentElement;
      }
      return !ancestor || !rootSet.has(ancestor);
    }).sort((left, right) => {
      if (left === right || !left.compareDocumentPosition) return 0;
      return left.compareDocumentPosition(right) & 2 ? 1 : -1;
    });
  }

  function officePropertyValue(node, propertyName, fallback) {
    const element = Array.from(node && node.querySelectorAll ? node.querySelectorAll('*') : [])
      .find((item) => officeElementName(item) === propertyName.toLowerCase());
    if (!element) return fallback;
    for (const attribute of Array.from(element.attributes || [])) {
      if (attribute.name.split(':').pop().toLowerCase() === 'val') return attribute.value;
    }
    return (element.textContent || '').trim() || fallback;
  }

  function appendMathMLTokens(target, input, documentObject) {
    const pieces = String(input == null ? '' : input).match(/\s+|\d+(?:\.\d+)?|[A-Za-z\p{L}]+|./gu) || [];
    for (const piece of pieces) {
      let tag = 'mi';
      if (/^\s+$/u.test(piece)) tag = 'mspace';
      else if (/^\d+(?:\.\d+)?$/u.test(piece)) tag = 'mn';
      else if (/^[=+\-−×÷±∓∝<>≤≥≠,;:()[\]{}|∣∑∏∫√]+$/u.test(piece)) tag = 'mo';
      const token = documentObject.createElementNS(MATHML_NAMESPACE, tag);
      if (tag !== 'mspace') token.textContent = piece;
      target.appendChild(token);
    }
  }

  function ommlToMathML(officeRoot, documentObject) {
    if (!officeRoot || !documentObject ||
        !domTreeWithinBudget(officeRoot, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return null;
    const make = (name) => documentObject.createElementNS(MATHML_NAMESPACE, name);
    const meaningfulChildren = (node) => elementChildren(node).filter((child) => {
      const name = officeElementName(child);
      return name && !/pr$/.test(name) && name !== 'ctrlpr';
    });
    const childNamed = (node, name) => meaningfulChildren(node).find((child) => officeElementName(child) === name) || null;
    const convertChildren = (node, target) => {
      for (const child of meaningfulChildren(node)) {
        const converted = convert(child);
        if (converted) target.appendChild(converted);
      }
      return target;
    };
    const convertContainer = (node) => convertChildren(node, make('mrow'));
    const convert = (node) => {
      if (!node || node.nodeType !== 1) return null;
      const name = officeElementName(node);
      if (!name || /pr$/.test(name) || name === 'ctrlpr') return null;
      if (name === 't') {
        const row = make('mrow');
        appendMathMLTokens(row, node.textContent || '', documentObject);
        return row;
      }
      if (name === 'r') {
        const row = make('mrow');
        const textNodes = Array.from(node.querySelectorAll ? node.querySelectorAll('*') : [])
          .filter((item) => officeElementName(item) === 't');
        appendMathMLTokens(row, textNodes.length ? textNodes.map((item) => item.textContent || '').join('') : node.textContent || '', documentObject);
        return row;
      }
      if (name === 'f') {
        const fraction = make('mfrac');
        fraction.appendChild(convert(childNamed(node, 'num')) || make('mrow'));
        fraction.appendChild(convert(childNamed(node, 'den')) || make('mrow'));
        return fraction;
      }
      if (name === 'rad') {
        const radicand = convert(childNamed(node, 'e')) || make('mrow');
        const degreeNode = childNamed(node, 'deg');
        const degree = degreeNode && cleanClipboardText(degreeNode.textContent || '').trim();
        if (!degree) {
          const root = make('msqrt');
          root.appendChild(radicand);
          return root;
        }
        const root = make('mroot');
        root.appendChild(radicand);
        root.appendChild(convert(degreeNode) || make('mrow'));
        return root;
      }
      if (name === 'ssub' || name === 'ssup' || name === 'ssubsup') {
        const script = make(name === 'ssub' ? 'msub' : (name === 'ssup' ? 'msup' : 'msubsup'));
        script.appendChild(convert(childNamed(node, 'e')) || make('mrow'));
        if (name !== 'ssup') script.appendChild(convert(childNamed(node, 'sub')) || make('mrow'));
        if (name !== 'ssub') script.appendChild(convert(childNamed(node, 'sup')) || make('mrow'));
        return script;
      }
      if (name === 'd') {
        const row = make('mrow');
        const open = officePropertyValue(node, 'begchr', '(');
        const close = officePropertyValue(node, 'endchr', ')');
        const separator = officePropertyValue(node, 'sepchr', ',');
        const opener = make('mo'); opener.textContent = open; row.appendChild(opener);
        const expressions = meaningfulChildren(node).filter((child) => officeElementName(child) === 'e');
        expressions.forEach((expression, index) => {
          if (index) { const sep = make('mo'); sep.textContent = separator; row.appendChild(sep); }
          row.appendChild(convert(expression));
        });
        const closer = make('mo'); closer.textContent = close; row.appendChild(closer);
        return row;
      }
      if (name === 'nary') {
        const operator = make('mo');
        operator.textContent = officePropertyValue(node, 'chr', '∑');
        const sub = childNamed(node, 'sub');
        const sup = childNamed(node, 'sup');
        let scripted = operator;
        if (sub && sup) {
          scripted = make('munderover'); scripted.append(operator, convert(sub), convert(sup));
        } else if (sub) {
          scripted = make('munder'); scripted.append(operator, convert(sub));
        } else if (sup) {
          scripted = make('mover'); scripted.append(operator, convert(sup));
        }
        const row = make('mrow');
        row.appendChild(scripted);
        const expression = childNamed(node, 'e');
        if (expression) row.appendChild(convert(expression));
        return row;
      }
      if (name === 'func') {
        const row = make('mrow');
        const functionName = childNamed(node, 'fname');
        if (functionName) row.appendChild(convert(functionName));
        const apply = make('mo'); apply.textContent = '\u2061'; row.appendChild(apply);
        const expression = childNamed(node, 'e');
        if (expression) row.appendChild(convert(expression));
        return row;
      }
      if (name === 'limlow' || name === 'limupp') {
        const limit = make(name === 'limlow' ? 'munder' : 'mover');
        limit.appendChild(convert(childNamed(node, 'e')) || make('mrow'));
        limit.appendChild(convert(childNamed(node, 'lim')) || make('mrow'));
        return limit;
      }
      if (name === 'acc' || name === 'bar' || name === 'groupchr') {
        const over = make('mover');
        over.appendChild(convert(childNamed(node, 'e')) || make('mrow'));
        const accent = make('mo');
        accent.textContent = officePropertyValue(node, 'chr', name === 'bar' ? '¯' : '^');
        over.appendChild(accent);
        over.setAttribute('accent', 'true');
        return over;
      }
      if (name === 'm') {
        const table = make('mtable');
        for (const rowNode of meaningfulChildren(node).filter((child) => officeElementName(child) === 'mr')) {
          const row = make('mtr');
          for (const expression of meaningfulChildren(rowNode).filter((child) => officeElementName(child) === 'e')) {
            const cell = make('mtd'); cell.appendChild(convert(expression)); row.appendChild(cell);
          }
          table.appendChild(row);
        }
        return table;
      }
      if (name === 'eqarr') {
        const table = make('mtable');
        for (const expression of meaningfulChildren(node).filter((child) => officeElementName(child) === 'e')) {
          const row = make('mtr'); const cell = make('mtd');
          cell.appendChild(convert(expression)); row.appendChild(cell); table.appendChild(row);
        }
        return table;
      }
      return convertContainer(node);
    };

    const math = make('math');
    const converted = convert(officeRoot);
    if (!converted) return null;
    math.appendChild(converted);
    return math;
  }

  function findTexAnnotation(root) {
    if (!root || !root.querySelectorAll) return '';
    const annotations = root.querySelectorAll('annotation[encoding], annotation-xml[encoding]');
    for (const annotation of annotations) {
      const encoding = (annotation.getAttribute('encoding') || '').toLowerCase();
      if (encoding.includes('tex') || encoding.includes('latex')) {
        const value = annotation.textContent || '';
        if (value.length <= MAX_MATH_SOURCE_LENGTH) return value.trim();
      }
    }
    return '';
  }

  function nodeContainsOrIs(container, candidate) {
    return Boolean(container && candidate && (container === candidate || (container.contains && container.contains(candidate)) || (candidate.contains && candidate.contains(container))));
  }

  function getMathJaxSource(root, pageWindow) {
    const mathJax = pageWindow && pageWindow.MathJax;
    if (!mathJax) return '';
    try {
      const mathDocument = mathJax.startup && mathJax.startup.document;
      if (mathDocument && typeof mathDocument.getMathItemsWithin === 'function') {
        try {
          const items = mathDocument.getMathItemsWithin(root) || [];
          for (const item of items) if (item && typeof item.math === 'string') return item.math;
        } catch (_error) {
          // Some integrations expose this method but accept only source containers.
        }
      }
      if (mathDocument) {
        if (mathDocument.math && Symbol.iterator in Object(mathDocument.math)) {
          for (const item of mathDocument.math) {
            if (!item || typeof item.math !== 'string') continue;
            const rendered = item.typesetRoot || (item.start && item.start.node);
            if (!rendered || nodeContainsOrIs(root, rendered)) return item.math;
          }
        }
      }
    } catch (_error) {
      // Fall through to the MathJax v2 API and DOM metadata.
    }
    try {
      if (mathJax.Hub && typeof mathJax.Hub.getJaxFor === 'function') {
        const candidates = [root].concat(root.querySelectorAll ? Array.from(root.querySelectorAll('[id], .MathJax')) : []);
        for (const candidate of candidates) {
          const jax = mathJax.Hub.getJaxFor(candidate);
          if (jax && (jax.originalText || jax.math)) return jax.originalText || jax.math;
        }
      }
    } catch (_error) {
      // A page can expose a partial MathJax object; DOM fallbacks still work.
    }
    return '';
  }

  function getPageWindow(userscriptGlobal) {
    try {
      if (typeof unsafeWindow !== 'undefined') return unsafeWindow;
    } catch (_error) {
      // Access can be denied by a userscript manager.
    }
    return userscriptGlobal && userscriptGlobal.wrappedJSObject
      ? userscriptGlobal.wrappedJSObject
      : userscriptGlobal;
  }

  function getMathSource(root, pageWindow) {
    if (!root || root.nodeType !== 1 || !domTreeWithinBudget(root, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return '';
    const bounded = (value) => {
      const source = typeof value === 'string' ? value : '';
      return source && source.length <= MAX_MATH_SOURCE_LENGTH ? stripLatexDelimiters(source) : '';
    };
    const attributeNames = ['data-latex', 'data-tex', 'data-math-source', 'data-original-tex', 'alttext'];
    for (const name of attributeNames) {
      const value = root.getAttribute && root.getAttribute(name);
      if (value) {
        const source = bounded(value);
        if (source) return source;
      }
    }
    const annotated = findTexAnnotation(root);
    if (annotated) return bounded(annotated);
    const math = (root.matches && root.matches('math')) ? root : (root.querySelector && root.querySelector('math'));
    if (math) {
      const altText = math.getAttribute('alttext');
      if (altText) {
        const source = bounded(altText);
        if (source) return source;
      }
      const mathAnnotation = findTexAnnotation(math);
      if (mathAnnotation) return bounded(mathAnnotation);
    }
    if (root.matches && root.matches('script[type^="math/tex"]')) return bounded((root.textContent || '').trim());
    const embeddedScript = root.querySelector && root.querySelector('script[type^="math/tex"]');
    if (embeddedScript && embeddedScript.textContent) {
      const source = bounded(embeddedScript.textContent.trim());
      if (source) return source;
    }
    for (const sibling of [root.previousElementSibling, root.nextElementSibling]) {
      if (sibling && sibling.matches && sibling.matches('script[type^="math/tex"]')) {
        const source = bounded((sibling.textContent || '').trim());
        if (source) return source;
      }
    }
    return bounded(getMathJaxSource(root, pageWindow));
  }

  function getMathElement(root) {
    if (!root || root.nodeType !== 1) return null;
    if (root.matches && root.matches('math')) return root;
    if (root.querySelector) {
      return root.querySelector('.katex-mathml math, mjx-assistive-mml math, math');
    }
    return null;
  }

  function fallbackMathText(root) {
    if (!root) return '';
    const aria = root.getAttribute && (root.getAttribute('aria-label') || root.getAttribute('alt'));
    if (aria) return aria.length <= MAX_MATH_SOURCE_LENGTH ? aria : '';
    const image = root.querySelector && root.querySelector('img[alt]');
    if (image && image.getAttribute('alt')) {
      const value = image.getAttribute('alt');
      return value.length <= MAX_MATH_SOURCE_LENGTH ? value : '';
    }
    const visual = root.querySelector && root.querySelector('.katex-html, mjx-container, svg');
    const value = (visual || root).textContent || '';
    return value.length <= MAX_MATH_SOURCE_LENGTH ? cleanClipboardText(value) : '';
  }

  function isDisplayMath(root) {
    if (!root || root.nodeType !== 1) return false;
    const math = getMathElement(root);
    return Boolean(
      (root.matches && root.matches('.katex-display, .MathJax_Display, .MathJax_SVG_Display, mjx-container[display="true"], mjx-container[display="block"]')) ||
      (root.closest && root.closest('.katex-display, .MathJax_Display, .MathJax_SVG_Display')) ||
      (math && math.getAttribute('display') === 'block')
    );
  }

  function faithfulAgreementKey(input) {
    const value = cleanClipboardText(String(input == null ? '' : input))
      .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2061-\u2069\ufe00-\ufe0f\s]/gu, '');
    return value.normalize ? value.normalize('NFC') : value;
  }

  function faithfulSourceAgreesWithRendered(sourceText, renderedText) {
    const source = String(sourceText == null ? '' : sourceText);
    const rendered = String(renderedText == null ? '' : renderedText);
    if (!source || !rendered || source.includes('\\')) return false;
    // Parentheses are semantic scope, not cosmetic punctuation. A source
    // annotation may be stale, macro-expanded differently, or page-forged;
    // it is allowed to influence the clipboard only when its linearized
    // structure actually agrees with the sanitized rendered MathML.
    return faithfulAgreementKey(source) === faithfulAgreementKey(rendered);
  }

  function faithfulRenderedMathText(root, mathElement, pageWindow) {
    const rendered = mathElement ? mathMLToFaithful(mathElement) : '';
    const source = getMathSource(root, pageWindow);
    const faithfulSource = source ? latexToFaithful(source) : '';
    return faithfulSourceAgreesWithRendered(faithfulSource, rendered)
      ? faithfulSource
      : (rendered || faithfulSource);
  }

  function independentVisibleMathText(root) {
    if (!root || !root.querySelector) return '';
    const candidate = (root.matches && root.matches('.katex-html, mjx-container, .visual-layout, .math-visual, svg'))
      ? root
      : root.querySelector('.katex-html, mjx-container, .visual-layout, .math-visual, svg, [aria-hidden="true"]');
    const candidateText = cleanClipboardText(candidate && candidate.textContent || '');
    if (candidateText) return candidateText;
    // With no semantic MathML present, ordinary descendant text is the only
    // independent evidence for a data-latex/data-tex annotation. Attribute-
    // only image/ARIA formulas intentionally return empty here because their
    // source is also their sole accessible representation.
    return cleanClipboardText(root.textContent || '');
  }

  function sourceOnlyMathAgreesWithVisible(root, pageWindow) {
    const source = getMathSource(root, pageWindow);
    const visible = independentVisibleMathText(root);
    if (!source || !visible) return true;
    const faithfulSource = latexToFaithful(source);
    if (!faithfulSource || faithfulSource.includes('\\')) return false;
    const sourceSignature = semanticVisibleAnchorSignature(faithfulSource);
    const visibleSignature = semanticVisibleAnchorSignature(visible);
    if (sourceSignature.overBudget || visibleSignature.overBudget) return false;
    if (sourceSignature.identifiers !== visibleSignature.identifiers) return false;
    if (!sourceSignature.uncertainOperators && !visibleSignature.uncertainOperators &&
        sourceSignature.operators !== visibleSignature.operators) return false;
    if (sourceSignature.identifiers || visibleSignature.identifiers) {
      // Grouping symbols such as a fraction slash or radical are synthesized
      // from TeX but often drawn only with CSS/SVG, so compare the order-free
      // identifier/number anchors here. Stable authored operators must agree
      // too; only structure-only slash/root/fence marks are excluded.
      return true;
    }
    if (!sourceSignature.uncertainOperators && !visibleSignature.uncertainOperators &&
        (sourceSignature.operators || visibleSignature.operators)) {
      return sourceSignature.operators === visibleSignature.operators;
    }
    if (sourceSignature.glyphs || visibleSignature.glyphs) {
      return Boolean(sourceSignature.glyphs && sourceSignature.glyphs === visibleSignature.glyphs);
    }
    const sourceKey = mathSelectionKey(faithfulSource);
    const visibleKey = mathSelectionKey(visible);
    return Boolean(sourceKey && sourceKey === visibleKey);
  }

  function extractMathText(root, outputMode, pageWindow) {
    const mode = ['calculator', 'faithful', 'unicode', 'latex', 'ascii'].includes(outputMode)
      ? outputMode
      : DEFAULT_SETTINGS.outputMode;
    const source = getMathSource(root, pageWindow);
    const math = getMathElement(root);
    if (mode === 'latex' && source) {
      return isDisplayMath(root) ? '$$' + source + '$$' : '$' + source + '$';
    }
    if (mode === 'calculator') {
      if (math) return mathMLToCalculator(math);
      if (source) return latexToCalculator(source);
      return unicodeToCalculator(formatMathText(fallbackMathText(root)));
    }
    if (mode === 'faithful') {
      if (math) return faithfulRenderedMathText(root, math, pageWindow);
      if (source) return latexToFaithful(source);
      return formatFaithfulMathText(fallbackMathText(root));
    }
    let unicode = math ? mathMLToUnicode(math) : '';
    if (!unicode && source) unicode = latexToUnicode(source);
    if (!unicode) unicode = formatMathText(fallbackMathText(root));
    return mode === 'ascii' ? unicodeToAscii(unicode) : unicode;
  }

  function isMathRoot(element) {
    if (!element || element.nodeType !== 1 || !element.matches) return false;
    if (element.matches([
      '.katex-display', '.katex', 'mjx-container', '.MathJax_Display',
      '.MathJax_SVG_Display', '.MathJax_CHTML', '.MathJax_SVG', '.MathJax',
      '.mwe-math-element', 'math', '[role="math"]', '[data-latex]', '[data-tex]',
      '[data-math-source]', '[data-automation-id*="equation" i]',
      '[aria-roledescription="equation" i]', 'latex-js', 'katex-element'
    ].join(','))) return true;
    const identity = [
      typeof element.className === 'string' ? element.className : '',
      element.id || '',
      element.getAttribute('data-testid') || ''
    ].join(' ');
    const mathNamed = /(?:^|[\s_-])(?:math|katex|latex|formula|equation)(?:$|[\s_-])/i.test(identity);
    if (!mathNamed) return false;
    const nestedRenderer = element.querySelector([
      '.katex', 'mjx-container', '.MathJax_Display', '.MathJax_CHTML', '.MathJax_SVG',
      '.MathJax', '.mwe-math-element', '[role="math"]', '[data-latex]',
      '[data-tex]', '[data-math-source]'
    ].join(','));
    if (nestedRenderer && nestedRenderer !== element) return false;
    return Boolean(
      element.querySelector('math') ||
      element.getAttribute('data-latex') ||
      element.getAttribute('data-tex') ||
      element.getAttribute('data-math-source') ||
      element.getAttribute('role') === 'math'
    );
  }

  function hasSignificantDirectText(element) {
    return Array.from(element.childNodes || []).some((node) => node.nodeType === 3 && /\S/.test(node.nodeValue || ''));
  }

  function createMathDiscoveryContext() {
    return {
      mathCounts: new WeakMap(),
      mathRoots: new WeakMap(),
      directHiddenVisualChildren: new WeakMap()
    };
  }

  function isMathRootCached(element, context) {
    const cache = context && context.mathRoots;
    if (cache && cache.has(element)) return cache.get(element);
    const result = isMathRoot(element);
    if (cache && element && (typeof element === 'object' || typeof element === 'function')) {
      cache.set(element, result);
    }
    return result;
  }

  function mathElementCount(element, context) {
    if (!element || !element.querySelectorAll) return 0;
    const cache = context && context.mathCounts;
    if (cache && cache.has(element)) return cache.get(element);
    const count = (element.matches && element.matches('math') ? 1 : 0) +
      element.querySelectorAll('math').length;
    if (cache) cache.set(element, count);
    return count;
  }

  function hasDirectHiddenVisualChild(element, context) {
    if (!element || !element.querySelector) return false;
    const cache = context && context.directHiddenVisualChildren;
    if (cache && cache.has(element)) return cache.get(element);
    const result = Boolean(element.querySelector(':scope > [aria-hidden="true"]'));
    if (cache) cache.set(element, result);
    return result;
  }

  function isAccessibilityMath(mathElement, context) {
    let element = mathElement;
    let levels = 0;
    while (element && levels < 6) {
      const className = typeof element.className === 'string' ? element.className : '';
      const style = (element.getAttribute && element.getAttribute('style') || '').toLowerCase();
      if (/katex-mathml|assistive|sr-only|visually-hidden|screen-reader|mathml/i.test(className) ||
          /clip\s*:|clip-path\s*:|position\s*:\s*absolute/.test(style) ||
          element.hidden) return true;
      if (hasDirectHiddenVisualChild(element.parentElement, context)) return true;
      element = element.parentElement;
      levels += 1;
    }
    return false;
  }

  function rendererContainerForMath(mathElement, context) {
    if (!mathElement || mathElement.nodeType !== 1) return null;
    let found = mathElement;
    let element = mathElement.parentElement;
    let levels = 0;
    const accessibilityTree = isAccessibilityMath(mathElement, context);
    while (element && levels < 8 && mathElementCount(element, context) === 1) {
      const recognized = isMathRootCached(element, context);
      if (!recognized && !accessibilityTree) break;
      if (['body', 'html'].includes((element.localName || '').toLowerCase())) break;
      if (hasSignificantDirectText(element) && !recognized) break;
      found = element;
      if (recognized) {
        const parent = element.parentElement;
        if (!parent || !isMathRootCached(parent, context) || mathElementCount(parent, context) !== 1) break;
      }
      element = element.parentElement;
      levels += 1;
    }
    return found;
  }

  function implicitMathContainerFromNode(node, context) {
    const original = node && node.nodeType === 1 ? node : node && node.parentElement;
    let element = original;
    let levels = 0;
    while (element && levels < 8) {
      const oneMath = mathElementCount(element, context) === 1 && element.querySelector
        ? element.querySelector('math')
        : null;
      if (oneMath && !oneMath.contains(node)) {
        const promoted = rendererContainerForMath(oneMath, context);
        if (promoted && promoted.contains(node)) return promoted;
      }
      if (hasSignificantDirectText(element) && element !== original) break;
      element = element.parentElement;
      levels += 1;
    }
    return null;
  }

  function outermostMathAncestor(node, context) {
    let element = node && node.nodeType === 1 ? node : node && node.parentElement;
    let found = null;
    while (element) {
      if (isMathRootCached(element, context)) found = element;
      element = element.parentElement;
    }
    return found || implicitMathContainerFromNode(node, context);
  }

  function sortMathRoots(roots) {
    return roots.sort((left, right) => {
      if (left === right || !left.compareDocumentPosition) return 0;
      return left.compareDocumentPosition(right) & 2 ? 1 : -1;
    });
  }

  function canonicalMathRootDiscovery(container, contextInput) {
    if (!container) return { roots: [], overBudget: false };
    const context = contextInput || createMathDiscoveryContext();
    const base = container.nodeType === 1 ? container : container.parentElement || container;
    if (!base) return { roots: [], overBudget: false };
    const candidates = new Set();
    if (isMathRootCached(base, context)) candidates.add(base);
    if (base.querySelectorAll) {
      const discovered = base.querySelectorAll(MATH_DISCOVERY_SELECTOR);
      if (discovered.length > MAX_MATH_DISCOVERY_CANDIDATES) {
        return { roots: [], overBudget: true };
      }
      for (const candidate of discovered) {
        if (isMathRootCached(candidate, context)) candidates.add(candidate);
        if ((candidate.localName || '').toLowerCase() === 'math') {
          const promoted = rendererContainerForMath(candidate, context);
          if (promoted) candidates.add(promoted);
        }
      }
    }
    // A Set removes promoted/root duplicates. Walking ancestors against that
    // Set keeps only canonical outer roots without the former all-pairs scan.
    const roots = [];
    for (const candidate of candidates) {
      let ancestor = candidate.parentElement;
      let nested = false;
      while (ancestor) {
        if (candidates.has(ancestor)) {
          nested = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (!nested) roots.push(candidate);
    }
    return { roots: sortMathRoots(roots), overBudget: false };
  }

  function canonicalMathRoots(container) {
    const discovery = canonicalMathRootDiscovery(container);
    return discovery.overBudget ? [] : discovery.roots;
  }

  function rangeIntersects(range, node) {
    try {
      return range.intersectsNode(node);
    } catch (_error) {
      return false;
    }
  }

  function mathRootDiscoveryForRange(range) {
    if (!range || !range.commonAncestorContainer) return { roots: [], overBudget: false };
    const context = createMathDiscoveryContext();
    const container = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    const canonical = canonicalMathRootDiscovery(container, context);
    if (canonical.overBudget) return canonical;
    const rootSet = new Set(canonical.roots.filter((root) => rangeIntersects(range, root)));
    for (const boundaryNode of [range.startContainer, range.endContainer]) {
      const ancestor = outermostMathAncestor(boundaryNode, context);
      if (ancestor) rootSet.add(ancestor);
    }
    if (rootSet.size > MAX_MATH_ROOTS_PER_SELECTION) return { roots: [], overBudget: true };
    const roots = [];
    for (const root of rootSet) {
      let ancestor = root.parentElement;
      let nested = false;
      while (ancestor) {
        if (rootSet.has(ancestor)) {
          nested = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (!nested) roots.push(root);
    }
    return { roots: sortMathRoots(roots), overBudget: false };
  }

  function rootsForRange(range) {
    const discovery = mathRootDiscoveryForRange(range);
    return discovery.overBudget ? [] : discovery.roots;
  }

  function expandedMathRange(range, roots) {
    const expanded = range.cloneRange();
    const startRoot = outermostMathAncestor(range.startContainer);
    const endRoot = outermostMathAncestor(range.endContainer);
    try {
      if (startRoot && startRoot.parentNode) expanded.setStartBefore(startRoot);
      if (endRoot && endRoot.parentNode) expanded.setEndAfter(endRoot);
      if (!startRoot && roots.length && range.startContainer === roots[0]) expanded.setStartBefore(roots[0]);
      if (!endRoot && roots.length && range.endContainer === roots[roots.length - 1]) expanded.setEndAfter(roots[roots.length - 1]);
    } catch (_error) {
      return range.cloneRange();
    }
    return expanded;
  }

  function isVisuallyHiddenElement(element) {
    if (!element || element.nodeType !== 1) return false;
    if (element.hidden) return true;
    const style = (element.getAttribute('style') || '').toLowerCase();
    if (/display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden/.test(style)) return true;
    return false;
  }

  function isHiddenElement(element) {
    if (isVisuallyHiddenElement(element)) return true;
    if (!element || element.nodeType !== 1) return false;
    const className = typeof element.className === 'string' ? element.className : '';
    return element.getAttribute('aria-hidden') === 'true' ||
      /(?:^|\s)(?:sr-only|visually-hidden|screen-reader-only|MJX_Assistive_MathML)(?:\s|$)/i.test(className);
  }

  function serializeDomFragment(fragment) {
    let output = '';

    const append = (text, preserveWhitespace) => {
      let value = String(text == null ? '' : text)
        .replace(/\r\n?/g, '\n')
        .replace(/[\u00ad\u200b\u2060\ufeff]/g, '')
        .replace(/\u00a0/g, ' ');
      if (!preserveWhitespace) value = value.replace(/[\t\n\f\r ]+/g, ' ');
      output += value;
    };
    const newline = (count) => {
      output = output.replace(/[ \t]+$/g, '');
      const existing = (output.match(/\n*$/) || [''])[0].length;
      if (existing < count) output += '\n'.repeat(count - existing);
    };
    const visitChildren = (node, context) => {
      for (const child of Array.from(node.childNodes || [])) visit(child, context);
    };
    const visit = (node, context) => {
      if (node.nodeType === 3) {
        append(node.nodeValue || '', context.preserve);
        return;
      }
      if (node.nodeType !== 1 && node.nodeType !== 11) return;
      if (node.nodeType === 11) {
        visitChildren(node, context);
        return;
      }
      const element = node;
      const tag = (element.localName || '').toLowerCase();
      if (SKIP_TAGS.has(tag) || isHiddenElement(element)) return;
      const trustedPlaceholder = TRUSTED_TEXT_PLACEHOLDERS.get(element);
      if (trustedPlaceholder) {
        const display = trustedPlaceholder.display === true;
        if (display) newline(1);
        append(trustedPlaceholder.text || '', false);
        if (display) newline(1);
        return;
      }
      if (tag === 'br') {
        newline(1);
        return;
      }
      if (tag === 'hr') {
        newline(2);
        return;
      }
      if (tag === 'img' || tag === 'area') {
        append(element.getAttribute('alt') || '', false);
        return;
      }
      if (tag === 'wbr') return;
      if (tag === 'table') {
        newline(output ? 1 : 0);
        const rows = element.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr');
        Array.from(rows).forEach((row, rowIndex) => {
          if (rowIndex) newline(1);
          const cells = Array.from(row.children).filter((cell) => ['td', 'th'].includes((cell.localName || '').toLowerCase()));
          cells.forEach((cell, cellIndex) => {
            if (cellIndex) append('\t', true);
            visitChildren(cell, context);
          });
        });
        newline(1);
        return;
      }
      if (tag === 'ul' || tag === 'ol') {
        newline(output ? 1 : 0);
        let number = Number(element.getAttribute('start') || 1);
        for (const child of Array.from(element.children)) {
          if ((child.localName || '').toLowerCase() !== 'li') continue;
          append(tag === 'ol' ? String(number) + '. ' : '• ', false);
          visitChildren(child, context);
          newline(1);
          number += 1;
        }
        return;
      }
      if (tag === 'li') {
        visitChildren(element, context);
        return;
      }
      const style = (element.getAttribute('style') || '').toLowerCase();
      const preserve = context.preserve || PRESERVE_TAGS.has(tag) || /white-space\s*:\s*(?:pre|pre-wrap|break-spaces)/.test(style);
      const block = BLOCK_TAGS.has(tag) || /display\s*:\s*(?:block|flex|grid|list-item|table)/.test(style);
      if (block && output && !/\n$/.test(output)) newline(1);
      visitChildren(element, { preserve });
      if (block) newline(tag === 'p' || /^h[1-6]$/.test(tag) ? 2 : 1);
    };

    visit(fragment, { preserve: false });
    return cleanClipboardText(output)
      .replace(/^[ \t\n]+|[ \t\n]+$/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  }

  function setRichStyle(element, declarations) {
    element.setAttribute('style', declarations);
    TRUSTED_RICH_STYLE_NODES.add(element);
    return element;
  }

  function richMathNodeFromMathML(node, documentObject) {
    if (!node) return documentObject.createTextNode('');
    if (node.nodeType === 3) return documentObject.createTextNode(node.nodeValue || '');
    if (node.nodeType !== 1) return documentObject.createTextNode('');
    const name = (node.localName || node.nodeName || '').toLowerCase();
    const children = elementChildren(node);
    const span = () => documentObject.createElement('span');
    const appendChildren = (target, items) => {
      for (const item of items) target.appendChild(richMathNodeFromMathML(item, documentObject));
      return target;
    };

    if (name === 'mi') {
      const value = mathMLTokenText(node);
      return documentObject.createTextNode(value);
    }
    if (['mn', 'mtext', 'ms'].includes(name)) return documentObject.createTextNode(mathMLTokenText(node));
    if (name === 'mo') {
      const value = mathMLTokenText(node).replace(/[\u2061]/g, '').replace(/[\u2062]/g, '·').replace(/[\u2063]/g, ',').replace(/[\u2064]/g, '+');
      return documentObject.createTextNode(value);
    }
    if (name === 'mspace') return documentObject.createTextNode(' ');
    if (name === 'mphantom' || name === 'annotation' || name === 'annotation-xml' || name === 'none') return documentObject.createTextNode('');
    if (name === 'semantics') {
      const presentation = children.find((item) => !['annotation', 'annotation-xml'].includes((item.localName || '').toLowerCase()));
      return richMathNodeFromMathML(presentation, documentObject);
    }
    if (name === 'mfrac') {
      const lineThickness = String(node.getAttribute && node.getAttribute('linethickness') || '').trim().toLowerCase();
      const zeroLine = /^(?:0|0+(?:\.0+)?(?:px|pt|em|ex|%)?)$/u.test(lineThickness);
      const fraction = setRichStyle(span(), 'display:inline-block;vertical-align:middle;text-align:center;line-height:1.08;margin:0 0.12em;');
      const numerator = setRichStyle(span(), 'display:block;padding:0 0.18em 0.08em;');
      // A zero-thickness MathML fraction is a stack (for example \binom or
      // \atop), not division. Preserve that visual distinction in rich HTML
      // instead of inventing a fraction bar during paste.
      const denominator = setRichStyle(span(), zeroLine
        ? 'display:block;padding:0.08em 0.18em 0;'
        : 'display:block;border-top:1px solid currentColor;padding:0.08em 0.18em 0;');
      numerator.appendChild(richMathNodeFromMathML(children[0], documentObject));
      denominator.appendChild(richMathNodeFromMathML(children[1], documentObject));
      fraction.append(numerator, denominator);
      return fraction;
    }
    if (name === 'msqrt' || name === 'mroot') {
      const root = setRichStyle(span(), 'display:inline-flex;align-items:flex-start;vertical-align:middle;');
      if (name === 'mroot') {
        const index = documentObject.createElement('sup');
        index.appendChild(richMathNodeFromMathML(children[1], documentObject));
        root.appendChild(index);
      }
      root.appendChild(documentObject.createTextNode('√'));
      const radicand = setRichStyle(span(), 'display:inline-block;border-top:1px solid currentColor;padding:0 0.12em;');
      const radicandChildren = name === 'mroot' ? [children[0]] : children;
      appendChildren(radicand, radicandChildren);
      root.appendChild(radicand);
      return root;
    }
    if (name === 'msup' || name === 'msub' || name === 'msubsup') {
      // TeX renders an empty scripted base before the following nucleus for
      // isotope-style prescripts ({}^{14}_{6}C). Literal <sub>/<sup> nodes
      // would serialize in the opposite order in rich-text consumers, so use
      // the same portable Unicode/caret representation as plain text here.
      if (!mathMLTokenText(children[0]).trim()) {
        return documentObject.createTextNode(mathMLToFaithful(node));
      }
      const wrapper = span();
      wrapper.appendChild(richMathNodeFromMathML(children[0], documentObject));
      if (name === 'msub' || name === 'msubsup') {
        const sub = documentObject.createElement('sub');
        sub.appendChild(richMathNodeFromMathML(children[1], documentObject));
        wrapper.appendChild(sub);
      }
      if (name === 'msup' || name === 'msubsup') {
        const sup = documentObject.createElement('sup');
        sup.appendChild(richMathNodeFromMathML(children[name === 'msup' ? 1 : 2], documentObject));
        wrapper.appendChild(sup);
      }
      return wrapper;
    }
    if (name === 'mmultiscripts') {
      // HTML has no native prescript element. Unicode scripts (with ^/_
      // fallback when necessary) preserve both side and order everywhere.
      return documentObject.createTextNode(mathMLToFaithful(node));
    }
    if (name === 'mfenced') {
      const wrapper = span();
      wrapper.appendChild(documentObject.createTextNode(node.getAttribute('open') == null ? '(' : node.getAttribute('open')));
      children.forEach((item, index) => {
        if (index) wrapper.appendChild(documentObject.createTextNode(', '));
        wrapper.appendChild(richMathNodeFromMathML(item, documentObject));
      });
      wrapper.appendChild(documentObject.createTextNode(node.getAttribute('close') == null ? ')' : node.getAttribute('close')));
      return wrapper;
    }
    if (name === 'mtable') {
      const table = setRichStyle(span(), 'display:inline-table;vertical-align:middle;border-collapse:collapse;margin:0 0.12em;');
      for (const rowNode of children) {
        const row = setRichStyle(span(), 'display:table-row;');
        for (const cellNode of elementChildren(rowNode)) {
          const cell = setRichStyle(span(), 'display:table-cell;padding:0.08em 0.3em;text-align:center;');
          cell.appendChild(richMathNodeFromMathML(cellNode, documentObject));
          row.appendChild(cell);
        }
        table.appendChild(row);
      }
      return table;
    }
    if (name === 'mover' || name === 'munder' || name === 'munderover') {
      if (name === 'mover' && String(node.getAttribute && node.getAttribute('accent') || '').toLowerCase() !== 'false') {
        const base = serializeMathMLFaithfulNode(children[0]);
        const upper = serializeMathMLFaithfulNode(children[1]).text;
        const accent = faithfulMathMLAccent(base, upper);
        if (accent) return documentObject.createTextNode(formatFaithfulMathText(accent));
      }
      if (name === 'munder' && String(node.getAttribute && node.getAttribute('accentunder') || '').toLowerCase() !== 'false') {
        const base = serializeMathMLFaithfulNode(faithfulMathMLSemanticBase(children[0]));
        const lower = serializeMathMLFaithfulNode(children[1]).text;
        const accent = faithfulMathMLUnderAccent(base, lower);
        if (accent) return documentObject.createTextNode(formatFaithfulMathText(accent));
      }
      const wrapper = span();
      wrapper.appendChild(richMathNodeFromMathML(children[0], documentObject));
      if (name === 'munder' || name === 'munderover') {
        const sub = documentObject.createElement('sub');
        sub.appendChild(richMathNodeFromMathML(children[1], documentObject));
        wrapper.appendChild(sub);
      }
      if (name === 'mover' || name === 'munderover') {
        const sup = documentObject.createElement('sup');
        sup.appendChild(richMathNodeFromMathML(children[name === 'mover' ? 1 : 2], documentObject));
        wrapper.appendChild(sup);
      }
      return wrapper;
    }
    if (name === 'menclose') {
      const notation = String(node.getAttribute && node.getAttribute('notation') || '').toLowerCase();
      const labels = faithfulMenclose(notation, serializeMathMLFaithfulRow(children));
      const names = new Set(notation.match(/[a-z]+/g) || []);
      const supported = new Set([
        'updiagonalstrike', 'downdiagonalstrike', 'horizontalstrike', 'verticalstrike',
        'box', 'roundedbox', 'circle', 'top', 'bottom', 'left', 'right'
      ]);
      if (!names.size || Array.from(names).some((item) => !supported.has(item))) {
        return documentObject.createTextNode(formatFaithfulMathText(labels));
      }
      const declarations = ['display:inline-block', 'position:relative', 'padding:0.04em 0.12em'];
      const backgrounds = [];
      if (names.has('updiagonalstrike')) {
        backgrounds.push('linear-gradient(to top right,transparent 47%,currentColor 48%,currentColor 52%,transparent 53%)');
      }
      if (names.has('downdiagonalstrike')) {
        backgrounds.push('linear-gradient(to bottom right,transparent 47%,currentColor 48%,currentColor 52%,transparent 53%)');
      }
      if (names.has('verticalstrike')) {
        backgrounds.push('linear-gradient(to right,transparent 47%,currentColor 48%,currentColor 52%,transparent 53%)');
      }
      if (backgrounds.length) declarations.push('background-image:' + backgrounds.join(','));
      if (names.has('horizontalstrike')) declarations.push('text-decoration:line-through');
      if (names.has('box') || names.has('roundedbox')) declarations.push('border:1px solid currentColor');
      if (names.has('roundedbox')) declarations.push('border-radius:0.22em');
      if (names.has('circle')) declarations.push('border:1px solid currentColor', 'border-radius:50%');
      if (names.has('top')) declarations.push('border-top:1px solid currentColor');
      if (names.has('bottom')) declarations.push('border-bottom:1px solid currentColor');
      if (names.has('left')) declarations.push('border-left:1px solid currentColor');
      if (names.has('right')) declarations.push('border-right:1px solid currentColor');
      const wrapper = setRichStyle(span(), declarations.join(';') + ';');
      wrapper.setAttribute('aria-label', formatFaithfulMathText(labels));
      appendChildren(wrapper, children);
      return wrapper;
    }
    if (name === 'maction') return richMathNodeFromMathML(children[0], documentObject);
    return appendChildren(span(), children);
  }

  function richMathNode(root, documentObject) {
    const math = getMathElement(root);
    return richMathNodeForElement(math, root, documentObject);
  }

  function richMathNodeForElement(math, fallbackRoot, documentObject) {
    const wrapper = setRichStyle(documentObject.createElement('span'), 'font-family:"Cambria Math","Times New Roman",serif;white-space:nowrap;');
    wrapper.setAttribute('role', 'math');
    if (math && math.querySelector && math.querySelector('apply, bind')) {
      wrapper.textContent = mathMLToUnicode(math);
    } else if (math) wrapper.appendChild(richMathNodeFromMathML(math, documentObject));
    else if (fallbackRoot) wrapper.textContent = latexToUnicode(getMathSource(fallbackRoot, getPageWindow(global)) || fallbackMathText(fallbackRoot));
    return wrapper;
  }

  function sanitizeRichFragment(fragment) {
    const stack = Array.from(fragment && fragment.childNodes || []);
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      if (node.nodeType === 8) {
        node.remove();
        continue;
      }
      if (node.nodeType === 3) {
        const cleaned = cleanOrdinaryCharacters(node.nodeValue || '');
        if (cleaned) node.nodeValue = cleaned;
        else node.remove();
        continue;
      }
      stack.push(...Array.from(node.childNodes || []));
    }
    const elements = Array.from(fragment.querySelectorAll ? fragment.querySelectorAll('*') : []);
    for (const element of elements) {
      if (!element.isConnected && !fragment.contains(element)) continue;
      const tag = (element.localName || '').toLowerCase();
      if (SKIP_TAGS.has(tag) || isVisuallyHiddenElement(element)) {
        element.remove();
        continue;
      }
      if (tag === 'img' || tag === 'area') {
        const alt = cleanOrdinaryCharacters(element.getAttribute('alt') || '');
        if (alt) element.replaceWith(element.ownerDocument.createTextNode(alt));
        else element.remove();
        continue;
      }
      if (!ORDINARY_RICH_TAGS.has(tag)) {
        const parent = element.parentNode;
        if (parent) {
          while (element.firstChild) parent.insertBefore(element.firstChild, element);
          element.remove();
        }
        continue;
      }
      // Page content can forge attributes, so style retention is authorized
      // only for nodes created by this module in the current realm.
      const keepStyle = TRUSTED_RICH_STYLE_NODES.has(element);
      for (const attribute of Array.from(element.attributes || [])) {
        const name = attribute.name.toLowerCase();
        const keep = (keepStyle && (name === 'style' || name === 'aria-label')) ||
          name === 'role' || name === 'colspan' || name === 'rowspan' || name === 'start';
        if (!keep) element.removeAttribute(attribute.name);
      }
    }
    const documentObject = fragment.ownerDocument;
    const wrapper = documentObject.createElement('div');
    wrapper.appendChild(fragment);
    return '<!--StartFragment-->' + wrapper.innerHTML + '<!--EndFragment-->';
  }

  function sanitizedMathMLClone(mathElement) {
    if (!mathElement || !domTreeWithinBudget(mathElement, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return null;
    const allowedElements = new Set([
      'math', 'semantics', 'mrow', 'mi', 'mn', 'mo', 'mtext', 'ms', 'mspace',
      'mfrac', 'msqrt', 'mroot', 'msub', 'msup', 'msubsup', 'munder', 'mover',
      'munderover', 'mmultiscripts', 'mprescripts', 'none', 'mfenced', 'menclose',
      'mpadded', 'mphantom', 'mstyle', 'mtable', 'mtr', 'mlabeledtr', 'mtd',
      'maligngroup', 'malignmark', 'maction', 'merror', 'apply', 'bind', 'ci',
      'cn', 'csymbol', 'plus', 'minus', 'times', 'divide', 'power', 'root',
      'eq', 'neq', 'lt', 'gt', 'leq', 'geq', 'equivalent', 'approx', 'in',
      'notin', 'subset', 'union', 'intersect', 'and', 'or', 'not'
    ]);
    const allowedAttributes = new Set([
      'display', 'displaystyle', 'scriptlevel', 'mathvariant', 'mathsize', 'dir',
      'open', 'close', 'separators', 'notation', 'accent', 'accentunder',
      'linethickness', 'bevelled', 'numalign', 'denomalign', 'fence', 'separator',
      'stretchy', 'symmetric', 'maxsize', 'minsize', 'largeop', 'movablelimits',
      'form', 'linebreak', 'lspace', 'rspace', 'rowalign', 'columnalign',
      'rowspacing', 'columnspacing', 'rowlines', 'columnlines', 'frame',
      'framespacing', 'equalrows', 'equalcolumns', 'rowspan', 'columnspan',
      'width', 'height', 'depth', 'voffset', 'selection'
    ]);
    const documentObject = mathElement.ownerDocument;
    const removableForeignElements = new Set([
      'script', 'style', 'foreign', 'foreignobject', 'svg', 'iframe', 'object',
      'embed', 'link', 'meta', 'img', 'audio', 'video', 'source'
    ]);
    let unsupportedMathML = false;
    const cleanXMLText = (value) => String(value == null ? '' : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
    const rebuild = (node) => {
      if (!node) return null;
      if (node.nodeType === 3) return documentObject.createTextNode(cleanXMLText(node.nodeValue));
      if (node.nodeType !== 1) return null;
      const name = (node.localName || '').toLowerCase();
      if (name === 'annotation' || name === 'annotation-xml') return null;
      if (name === 'mglyph') return documentObject.createTextNode(cleanXMLText(node.getAttribute('alt') || ''));
      if (!allowedElements.has(name)) {
        if (!removableForeignElements.has(name)) unsupportedMathML = true;
        return null;
      }
      // HTML's MathML parser intentionally switches descendants of token
      // elements (mi/mo/mn/mtext/ms) back to the HTML namespace. KaTeX uses
      // such wrappers for constructs including \bmod, \boldsymbol, and nested
      // oversets. The names are still an explicit MathML allowlist and every
      // attribute is rebuilt below, so accepting only MathML/HTML namespaces
      // preserves that safe structure without admitting arbitrary foreign DOM.
      if (node.namespaceURI && node.namespaceURI !== MATHML_NAMESPACE &&
          node.namespaceURI !== 'http://www.w3.org/1999/xhtml') return null;
      const structuralToken = ['mi', 'mn', 'mo', 'mtext', 'ms'].includes(name) &&
        elementChildren(node).length > 0;
      if (structuralToken) {
        const row = documentObject.createElementNS(MATHML_NAMESPACE, 'mrow');
        for (const attribute of Array.from(node.attributes || [])) {
          const attributeName = attribute.name.split(':').pop().toLowerCase();
          if (['mathvariant', 'mathsize', 'dir', 'displaystyle', 'scriptlevel'].includes(attributeName)) {
            row.setAttribute(attributeName, cleanXMLText(attribute.value));
          }
        }
        for (const child of Array.from(node.childNodes || [])) {
          const rebuilt = rebuild(child);
          if (rebuilt) row.appendChild(rebuilt);
        }
        return row;
      }
      const safe = documentObject.createElementNS(MATHML_NAMESPACE, name);
      for (const attribute of Array.from(node.attributes || [])) {
        const attributeName = attribute.name.split(':').pop().toLowerCase();
        if (allowedAttributes.has(attributeName)) safe.setAttribute(attributeName, cleanXMLText(attribute.value));
      }
      for (const child of Array.from(node.childNodes || [])) {
        const rebuilt = rebuild(child);
        if (rebuilt) safe.appendChild(rebuilt);
      }
      return safe;
    };
    const clone = rebuild(mathElement);
    return !unsupportedMathML && clone && (clone.localName || '').toLowerCase() === 'math' ? clone : null;
  }

  function serializeMathMLMarkup(mathElement) {
    const clone = sanitizedMathMLClone(mathElement);
    if (!clone) return '';
    const view = mathElement.ownerDocument && mathElement.ownerDocument.defaultView;
    if (!view || typeof view.XMLSerializer !== 'function') return '';
    return new view.XMLSerializer().serializeToString(clone)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  }

  function nodeInside(root, node) {
    if (!root || !node) return false;
    return root === node || Boolean(root.contains && root.contains(node));
  }

  function visibleMathBranchForRange(root, range) {
    if (!root || !range) return null;
    const endpoints = [range.startContainer, range.endContainer];
    const explicitSelector = [
      '.katex-html',
      'mjx-container > :not(mjx-assistive-mml)',
      '.visual-layout',
      '.math-visual',
      '[aria-hidden="true"]'
    ].join(',');
    for (const endpoint of endpoints) {
      let element = endpoint && endpoint.nodeType === 1 ? endpoint : endpoint && endpoint.parentElement;
      if (!element || !nodeInside(root, element)) continue;
      const explicit = element.closest && element.closest(explicitSelector);
      if (explicit && nodeInside(root, explicit) &&
          !(explicit.matches && explicit.matches('.katex-mathml, mjx-assistive-mml, .a11y-mathml, .sr-only, .visually-hidden'))) {
        return explicit;
      }
      while (element && element.parentElement && element.parentElement !== root) element = element.parentElement;
      if (element && element.parentElement === root && !isAccessibilityMath(element)) return element;
    }
    if ((root.localName || '').toLowerCase() === 'math') return root;
    return root.querySelector && root.querySelector('.katex-html, .visual-layout, .math-visual, [aria-hidden="true"]');
  }

  function visualBranchRepresentsWholeMath(root, branch) {
    if (!root || !branch) return false;
    if (branch === root) return true;
    // Native MathML children are semantic subexpressions, not alternate
    // renderings of the entire root. Treating a direct <mi> as a whole visual
    // branch silently widens an exact one-token selection to the full formula.
    if ((root.localName || '').toLowerCase() === 'math') return false;
    return Boolean(branch.matches && branch.matches([
      '.katex-html',
      '.visual-layout',
      '.math-visual',
      'mjx-container > :not(mjx-assistive-mml)',
      '[aria-hidden="true"]'
    ].join(',')));
  }

  function selectedVisualStructureHints(range, visualBranch) {
    const hints = new Set();
    if (!range || !visualBranch) return hints;
    let selected = null;
    if (range.startContainer === range.endContainer && range.startContainer.nodeType === 1) {
      const container = range.startContainer;
      if (range.endOffset === range.startOffset + 1) selected = container.childNodes[range.startOffset] || null;
      else if (range.startOffset === 0 && range.endOffset === container.childNodes.length) selected = container;
    }
    if (!selected || selected.nodeType !== 1 || !nodeInside(visualBranch, selected)) return hints;
    const className = typeof selected.className === 'string' ? selected.className : '';
    if (/(?:^|\s)sqrt(?:\s|$)/i.test(className)) {
      hints.add('msqrt');
      hints.add('mroot');
    }
    if (/(?:^|\s)(?:mfrac|frac)(?:\s|$)/i.test(className)) hints.add('mfrac');
    if (/(?:^|\s)msupsub(?:\s|$)/i.test(className)) {
      hints.add('msub');
      hints.add('msup');
      hints.add('msubsup');
    }
    return hints;
  }

  function semanticVisibleAnchorSignature(input) {
    const rawValue = String(input == null ? '' : input);
    if (rawValue.length > MAX_SELECTION_KEY_LENGTH) {
      return { identifiers: '', operators: '', glyphs: '', uncertainOperators: true, overBudget: true };
    }
    let value = rawValue;
    try { value = value.normalize('NFKD'); } catch (_error) { /* keep original */ }
    const identifiers = [];
    const operators = [];
    const glyphs = [];
    let uncertainOperators = /\ue020/u.test(rawValue);
    const canonicalOperators = {
      '-': '−', '−': '−',
      '·': '⋅', '⋅': '⋅', '∗': '*'
    };
    const stableOperators = new Set(Array.from(
      '=≠≈≃≅≡<>≤≥±∓+−-×⋅·*∗÷∝∈∉∋∌⊂⊃⊆⊇⊊⊋⊄⊅⊈⊉∪∩∧∨∑∏∐∫∬∭∮∞%!?→←↦⇒⇔⟶⟹⟺'
    ));
    for (const character of Array.from(value)) {
      if (/^[\p{L}\p{N}]$/u.test(character)) {
        identifiers.push(character);
      }
    }
    // Inspect operators before compatibility decomposition. Otherwise `≠`
    // becomes `=` plus a combining slash and can falsely agree with a stale
    // plain equals sign. Styled identifiers still use the NFKD pass above.
    const operatorCharacters = Array.from(rawValue);
    for (let index = 0; index < operatorCharacters.length; index += 1) {
      const character = operatorCharacters[index];
      if (/^[\p{M}\p{Cf}]$/u.test(character) || /[\ue000-\uf8ff]/u.test(character)) continue;
      if (!stableOperators.has(character)) continue;
      if (character === '/' && index > 0 && /[∈∋⊂⊃⊆⊇<>=|∣∥]/u.test(operatorCharacters[index - 1])) {
        uncertainOperators = true;
      }
      operators.push(canonicalOperators[character] || character);
    }
    const structuralGlyphs = new Set(Array.from('√∛∜/|∣∥‖()[]{}⟨⟩⌈⌉⌊⌋,;:_^'));
    for (const character of operatorCharacters) {
      if (/^[\p{L}\p{N}\p{M}\p{Z}\p{Cf}]$/u.test(character) ||
          /[\ue000-\uf8ff]/u.test(character) || stableOperators.has(character) ||
          structuralGlyphs.has(character)) continue;
      glyphs.push(character);
    }
    identifiers.sort();
    operators.sort();
    glyphs.sort();
    return {
      identifiers: identifiers.join(''),
      operators: operators.join(''),
      glyphs: glyphs.join(''),
      uncertainOperators
    };
  }

  function semanticMathAgreesWithVisibleText(math, visibleText) {
    if (!math) return true;
    const presentation = presentationMathNode(math);
    if (!presentation) return true;
    const semantic = semanticVisibleAnchorSignature(presentation.textContent || '');
    const visible = semanticVisibleAnchorSignature(visibleText || '');
    if (semantic.overBudget || visible.overBudget) return false;
    // Separate accessibility/presentation trees may flatten fractions and
    // roots in a different order, but they must still describe the same
    // identifiers, numbers, and stable written operators. This catches stale
    // or forged hidden MathML (`x` behind visible `y`) without reintroducing
    // the exact-order bug this userscript exists to repair.
    if (semantic.identifiers !== visible.identifiers) return false;
    if (!semantic.uncertainOperators && !visible.uncertainOperators &&
        semantic.operators !== visible.operators) return false;
    if (semantic.identifiers || semantic.operators || visible.identifiers || visible.operators) return true;
    return Boolean(semantic.glyphs && semantic.glyphs === visible.glyphs);
  }

  function semanticMathAgreesWithVisibleBranch(math, visualBranch) {
    if (!math || !visualBranch || nodeInside(math, visualBranch)) return true;
    return semanticMathAgreesWithVisibleText(math, visualBranch.textContent || '');
  }

  function wikipediaMathAgreesWithFallback(root, math) {
    if (!root || !math || !root.matches || !root.matches('.mwe-math-element')) return true;
    const image = root.querySelector && root.querySelector('img[alt]');
    if (!image) return true;
    const rawValue = image.getAttribute('alt') || '';
    if (!rawValue || rawValue.length > MAX_MATH_SOURCE_LENGTH) return false;
    const rawAlt = cleanClipboardText(rawValue);
    const visible = latexToFaithful(rawAlt);
    if (!visible || visible.includes('\\')) return false;
    const presentation = presentationMathNode(math);
    const semantic = presentation ? mathMLToFaithful(presentation) : '';
    if (!semantic) return false;
    // Wikipedia's image alt and MathML can express the same layout through
    // different but equivalent surface forms (Unicode scripts vs ^(...), or
    // a linear slash vs a fraction). Calculator normalization preserves
    // operand/operator order and grouping while removing those cosmetic
    // differences, so stale x/y versus y/x content still fails closed.
    return faithfulAgreementKey(unicodeToCalculator(visible)) ===
      faithfulAgreementKey(unicodeToCalculator(semantic));
  }

  function semanticMathSelectionPayload(root, range, settings, pageWindow) {
    const math = getMathElement(root);
    const selectedText = cleanClipboardText(range.toString());
    const selectedKey = mathSelectionKey(selectedText);
    if (!selectedKey || selectedKey.length > MAX_SELECTION_KEY_LENGTH) return { kind: 'unmatched' };
    if (!math) {
      const visibleKey = mathSelectionKey(independentVisibleMathText(root));
      // Source-only SVG/CHTML renderers still support a typical mouse drag
      // whose endpoints live inside the visual branch. Promote only an exact
      // complete surface match; every strict partial remains native so source
      // metadata can never widen what the user highlighted.
      return visibleKey && selectedKey === visibleKey && sourceOnlyMathAgreesWithVisible(root, pageWindow)
        ? { kind: 'whole' }
        : { kind: 'unmatched' };
    }
    if (!domTreeWithinBudget(math, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) {
      return { kind: 'unmatched' };
    }
    if (!wikipediaMathAgreesWithFallback(root, math)) return { kind: 'unmatched' };
    const visualBranch = visibleMathBranchForRange(root, range);
    const selectsWholeVisualBranch = visualBranch && visualBranchRepresentsWholeMath(root, visualBranch) &&
      range.startContainer === visualBranch && range.startOffset === 0 &&
      range.endContainer === visualBranch && range.endOffset === visualBranch.childNodes.length;
    if (selectsWholeVisualBranch) {
      return semanticMathAgreesWithVisibleBranch(math, visualBranch)
        ? { kind: 'whole' }
        : { kind: 'unmatched' };
    }
    const presentation = presentationMathNode(math);
    if (!presentation || !domTreeWithinBudget(
      presentation,
      MAX_PARTIAL_MATCH_NODES,
      MAX_MATHML_DEPTH
    )) return { kind: 'unmatched' };
    if (visualBranch && selectedKey === mathSelectionKey(visualBranch.textContent || '')) {
      if (visualBranchRepresentsWholeMath(root, visualBranch)) {
        return semanticMathAgreesWithVisibleBranch(math, visualBranch)
          ? { kind: 'whole' }
          : { kind: 'unmatched' };
      }
    }
    let selectedOffset = NaN;
    if (visualBranch && nodeInside(visualBranch, range.startContainer)) {
      try {
        const prefix = root.ownerDocument.createRange();
        prefix.selectNodeContents(visualBranch);
        prefix.setEnd(range.startContainer, range.startOffset);
        selectedOffset = mathSelectionKey(prefix.toString()).length;
      } catch (_error) {
        selectedOffset = NaN;
      }
    }
    const structureHints = selectedVisualStructureHints(range, visualBranch);
    const katexVisualOrder = Boolean(root.matches && root.matches('.katex, .katex-display')) ||
      Boolean(root.closest && root.closest('.katex, .katex-display'));
    const directMathMLBranch = visualBranch && visualBranch !== math && nodeInside(math, visualBranch) &&
      selectedKey === mathSelectionKey(visualBranch.textContent || '')
      ? wrapMathMLFragment([visualBranch], math.ownerDocument)
      : null;
    const selectedMath = directMathMLBranch || findSelectedMathMLFragment(
      math,
      selectedText,
      selectedOffset,
      visualBranch && visualBranch.textContent || '',
      structureHints,
      katexVisualOrder
    );
    if (!selectedMath) return { kind: 'unmatched' };
    const safeSelectedMath = sanitizedMathMLClone(selectedMath);
    if (!safeSelectedMath) return { kind: 'unmatched' };
    const text = mathMLFragmentText(safeSelectedMath, settings.outputMode);
    if (!text || !text.trim()) return { kind: 'unmatched' };
    const documentObject = root.ownerDocument;
    const richFragment = documentObject.createDocumentFragment();
    richFragment.appendChild(richMathNodeForElement(safeSelectedMath, null, documentObject));
    return {
      kind: 'payload',
      payload: {
        text: finalizeRewrittenText(text),
        html: sanitizeRichFragment(richFragment),
        mathML: serializeMathMLMarkup(safeSelectedMath),
        semanticPartial: true
      }
    };
  }

  function wholeMathRootPayload(root, settings, pageWindow) {
    const sourceMath = getMathElement(root);
    if (!sourceMath && !domTreeWithinBudget(root, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return null;
    if (!sourceMath && !sourceOnlyMathAgreesWithVisible(root, pageWindow)) return null;
    if (sourceMath && !wikipediaMathAgreesWithFallback(root, sourceMath)) return null;
    const safeMath = sourceMath ? sanitizedMathMLClone(sourceMath) : null;
    if (sourceMath && !safeMath) return null;
    const text = settings.outputMode === 'faithful' && safeMath
      ? faithfulRenderedMathText(root, safeMath, pageWindow)
      : (safeMath && settings.outputMode !== 'latex'
        ? mathMLFragmentText(safeMath, settings.outputMode)
        : extractMathText(root, settings.outputMode, pageWindow));
    if (!text || !text.trim()) return null;
    const documentObject = root.ownerDocument;
    const richFragment = documentObject.createDocumentFragment();
    richFragment.appendChild(safeMath
      ? richMathNodeForElement(safeMath, null, documentObject)
      : richMathNode(root, documentObject));
    return {
      text: finalizeRewrittenText(text),
      html: sanitizeRichFragment(richFragment),
      mathML: serializeMathMLMarkup(safeMath),
      display: isDisplayMath(root),
      mathRanges: 1
    };
  }

  function boundaryMathPayload(root, range, side, settings, pageWindow) {
    const branch = visibleMathBranchForRange(root, range);
    if (!branch) return null;
    const selected = root.ownerDocument.createRange();
    selected.selectNodeContents(branch);
    try {
      if (side === 'start' && nodeInside(branch, range.startContainer)) {
        selected.setStart(range.startContainer, range.startOffset);
      }
      if (side === 'end' && nodeInside(branch, range.endContainer)) {
        selected.setEnd(range.endContainer, range.endOffset);
      }
    } catch (_error) {
      return null;
    }
    if (selected.collapsed) return null;
    const semantic = semanticMathSelectionPayload(root, selected, settings, pageWindow);
    if (semantic.kind === 'payload') {
      semantic.payload.display = isDisplayMath(root);
      semantic.payload.mathRanges = 1;
      return semantic.payload;
    }
    if (semantic.kind === 'whole') return wholeMathRootPayload(root, settings, pageWindow);
    return null;
  }

  function safeCompanionRangePayload(range, retainRichContext) {
    if (!range || range.collapsed) return null;
    const documentObject = range.startContainer && range.startContainer.ownerDocument;
    if (!documentObject) return null;
    const fragment = cloneOrdinaryRangeWithContext(range, documentObject);
    if (!fragment) return null;
    const text = serializeOrdinaryFragment(fragment).text;
    if (!text && !range.toString()) return null;
    let richFragment = fragment;
    if (retainRichContext === false) {
      try {
        richFragment = range.cloneContents();
      } catch (_error) {
        return null;
      }
    }
    return {
      text,
      html: safeOrdinaryRichHTML([richFragment], documentObject),
      mathML: '',
      display: false,
      mathRanges: 0
    };
  }

  function clipboardHTMLBody(html) {
    return String(html || '')
      .replace(/^<!--StartFragment-->/, '')
      .replace(/<!--EndFragment-->$/, '');
  }

  function plainTextClipboardHTML(input) {
    const escaped = cleanClipboardText(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>');
    return '<!--StartFragment-->' + escaped + '<!--EndFragment-->';
  }

  function utf8ByteLength(input) {
    let length = 0;
    for (const character of String(input == null ? '' : input)) {
      const point = character.codePointAt(0);
      length += point <= 0x7f ? 1 : (point <= 0x7ff ? 2 : (point <= 0xffff ? 3 : 4));
    }
    return length;
  }

  function clipboardHTMLFormat(html) {
    const startMarker = '<!--StartFragment-->';
    const endMarker = '<!--EndFragment-->';
    const prefix = '<!doctype html><html><body>' + startMarker;
    const content = clipboardHTMLBody(html);
    const suffix = endMarker + '</body></html>';
    const body = prefix + content + suffix;
    const placeholder = [
      'Version:1.0',
      'StartHTML:0000000000',
      'EndHTML:0000000000',
      'StartFragment:0000000000',
      'EndFragment:0000000000',
      ''
    ].join('\r\n');
    const startHTML = utf8ByteLength(placeholder);
    const startFragment = startHTML + utf8ByteLength(prefix);
    const endFragment = startFragment + utf8ByteLength(content);
    const endHTML = startHTML + utf8ByteLength(body);
    const field = (value) => String(value).padStart(10, '0');
    const header = [
      'Version:1.0',
      'StartHTML:' + field(startHTML),
      'EndHTML:' + field(endHTML),
      'StartFragment:' + field(startFragment),
      'EndFragment:' + field(endFragment),
      ''
    ].join('\r\n');
    return header + body;
  }

  function clipboardPieceSeparator(left, right) {
    if (!left || !right || !left.text || !right.text) return '';
    if (left.display || right.display) return '\n';
    if (/\s$/u.test(left.text) || /^\s/u.test(right.text)) return '';
    if (/^[,.;:!?\)\]\}]/u.test(right.text) || /[([{]$/u.test(left.text)) return '';
    if (/[\p{L}\p{N}\p{M})\]}]$/u.test(left.text) && /^[\p{L}\p{N}\p{M}(√]/u.test(right.text)) return ' ';
    return '';
  }

  function combineClipboardPayloads(pieces) {
    const values = pieces.filter((piece) => piece && (piece.text || piece.html));
    if (!values.length) return null;
    let text = '';
    let html = '';
    for (let index = 0; index < values.length; index += 1) {
      const separator = index ? clipboardPieceSeparator(values[index - 1], values[index]) : '';
      text += separator + (values[index].text || '');
      html += (separator === '\n' ? '<br>' : separator) + clipboardHTMLBody(values[index].html);
    }
    text = finalizeRewrittenText(text);
    if (!text.trim()) return null;
    const mathRanges = values.reduce((sum, value) => sum + (value.mathRanges || 0), 0);
    return {
      text,
      html: '<!--StartFragment-->' + html + '<!--EndFragment-->',
      mathML: values.length === 1 ? values[0].mathML || '' : '',
      reason: 'rendered-math',
      mathRanges
    };
  }

  function serializePartialBoundaryRange(range, startRoot, endRoot, settings, pageWindow) {
    const documentObject = range.startContainer.ownerDocument || (range.startContainer.nodeType === 9 ? range.startContainer : null);
    if (!documentObject) return null;
    const pieces = [];
    if (!startRoot) {
      const prefix = documentObject.createRange();
      prefix.setStart(range.startContainer, range.startOffset);
      try { prefix.setEndBefore(endRoot); } catch (_error) { return null; }
      if (!prefix.collapsed) {
        const serialized = serializeRangePayloadWithMath(prefix, settings, pageWindow) || safeCompanionRangePayload(prefix, false);
        if (!serialized) return null;
        pieces.push(serialized);
      }
    } else {
      const partial = boundaryMathPayload(startRoot, range, 'start', settings, pageWindow);
      if (!partial) return null;
      pieces.push(partial);
    }

    if (startRoot && endRoot && startRoot !== endRoot) {
      const middle = documentObject.createRange();
      try {
        middle.setStartAfter(startRoot);
        middle.setEndBefore(endRoot);
      } catch (_error) {
        return null;
      }
      if (!middle.collapsed) {
        const serialized = serializeRangePayloadWithMath(middle, settings, pageWindow) || safeCompanionRangePayload(middle, false);
        if (!serialized) return null;
        pieces.push(serialized);
      }
    }

    if (endRoot && endRoot !== startRoot) {
      const partial = boundaryMathPayload(endRoot, range, 'end', settings, pageWindow);
      if (!partial) return null;
      pieces.push(partial);
    } else if (!endRoot) {
      const suffix = documentObject.createRange();
      try { suffix.setStartAfter(startRoot); } catch (_error) { return null; }
      suffix.setEnd(range.endContainer, range.endOffset);
      if (!suffix.collapsed) {
        const serialized = serializeRangePayloadWithMath(suffix, settings, pageWindow) || safeCompanionRangePayload(suffix, false);
        if (!serialized) return null;
        pieces.push(serialized);
      }
    }
    return combineClipboardPayloads(pieces);
  }

  function serializeRangePayloadWithMath(range, settings, pageWindow, rootDiscoveryInput) {
    const rootDiscovery = rootDiscoveryInput || mathRootDiscoveryForRange(range);
    if (rootDiscovery.overBudget) return null;
    const originalRoots = rootDiscovery.roots;
    if (!originalRoots.length) return null;
    const startRoot = outermostMathAncestor(range.startContainer);
    const endRoot = outermostMathAncestor(range.endContainer);
    if (originalRoots.length === 1 && startRoot && startRoot === endRoot &&
        nodeInside(startRoot, range.startContainer) && nodeInside(startRoot, range.endContainer)) {
      const semanticSelection = semanticMathSelectionPayload(startRoot, range, settings, pageWindow);
      if (semanticSelection.kind === 'payload') return semanticSelection.payload;
      if (semanticSelection.kind === 'whole') {
        const whole = wholeMathRootPayload(startRoot, settings, pageWindow);
        if (whole) return whole;
      }
      // An exact but unrecognized partial selection must remain exact. Native
      // copying is preferable to silently adding the rest of the equation.
      if (semanticSelection.kind === 'unmatched') return null;
    }
    if (startRoot !== endRoot && (startRoot || endRoot)) {
      return serializePartialBoundaryRange(range, startRoot, endRoot, settings, pageWindow);
    }
    const expanded = expandedMathRange(range, originalRoots);
    if (!rangeDOMWithinBudget(
      expanded,
      MAX_RICH_SELECTION_NODES,
      MAX_RICH_SELECTION_DEPTH,
      MAX_ORDINARY_SELECTION_MARKUP_LENGTH
    ) || ordinaryComputedLayoutRisk(expanded, expanded.startContainer.ownerDocument || null)) return null;
    const values = originalRoots.map((root) => {
      const sourceMath = getMathElement(root);
      const safeMath = sourceMath ? sanitizedMathMLClone(sourceMath) : null;
      const sourceAgreement = sourceMath
        ? wikipediaMathAgreesWithFallback(root, sourceMath)
        : sourceOnlyMathAgreesWithVisible(root, pageWindow);
      return {
        text: !sourceAgreement || (sourceMath && !safeMath)
          ? ''
          : (settings.outputMode === 'faithful' && safeMath
            ? faithfulRenderedMathText(root, safeMath, pageWindow)
            : (safeMath && settings.outputMode !== 'latex'
              ? mathMLFragmentText(safeMath, settings.outputMode)
              : extractMathText(root, settings.outputMode, pageWindow))),
        display: isDisplayMath(root),
        root,
        safeMath
      };
    });
    if (values.some((value) => !value.text || !value.text.trim())) return null;

    const documentObject = expanded.startContainer.ownerDocument || null;
    const textFragment = cloneOrdinaryRangeWithContext(expanded, documentObject);
    if (!textFragment) return null;
    canonicalMathRoots(textFragment).forEach((root, index) => {
      const value = values[index] || {
        text: extractMathText(root, settings.outputMode, pageWindow),
        display: isDisplayMath(root)
      };
      const replacement = root.ownerDocument.createElement('span');
      TRUSTED_TEXT_PLACEHOLDERS.set(replacement, { text: value.text, display: Boolean(value.display) });
      root.replaceWith(replacement);
    });
    const text = serializeOrdinaryFragment(textFragment).text;

    const richFragment = cloneOrdinaryRangeWithContext(expanded, documentObject);
    if (!richFragment) return null;
    canonicalMathRoots(richFragment).forEach((root, index) => {
      const value = values[index];
      root.replaceWith(value && value.safeMath
        ? richMathNodeForElement(value.safeMath, null, root.ownerDocument)
        : richMathNode(value && value.root || root, root.ownerDocument));
    });
    const html = sanitizeRichFragment(richFragment);
    const onlyMath = values.length === 1 && text.trim() === values[0].text.trim();
    const mathML = onlyMath ? serializeMathMLMarkup(values[0].safeMath) : '';
    return { text, html, mathML };
  }

  function serializeRangeWithMath(range, settings, pageWindow) {
    const payload = serializeRangePayloadWithMath(range, settings, pageWindow);
    return payload && payload.text;
  }

  function cleanClipboardText(input) {
    const value = String(input == null ? '' : input)
      .replace(/\r\n?/g, '\n')
      .replace(/[\u00ad\u200b\u2060\ufeff]/g, '')
      .replace(/\u00a0/g, ' ');
    return value.normalize ? value.normalize('NFC') : value;
  }

  function repairFlattenedRendererText(input) {
    const untouched = String(input == null ? '' : input);
    const original = cleanClipboardText(untouched);
    const repairStart = '\ue120';
    const repairEnd = '\ue121';
    if (original.includes(repairStart) || original.includes(repairEnd)) return untouched;
    let repairs = 0;
    // A few visual math renderers put an accent in its own layout box before
    // the base glyph. Native selection then exposes visual box order instead
    // of mathematical order, for example `\n⃗\n𝐽` and `\nˆ\n𝑧`. Restrict this
    // recovery to an accent-only line next to one identifier: ordinary arrows,
    // carets, prose line breaks, and authored multi-line text stay untouched.
    const accent = '[\\u20d6\\u20d7\\u02c6]';
    const identifier = '[\\p{L}\\p{N}]';
    const combiningFor = (value) => ({
      '\u20d6': '\u20d6',
      '\u20d7': '\u20d7',
      '\u02c6': '\u0302'
    })[value] || value;
    let value = original.replace(new RegExp(
      '(^|\\n)[ \\t]*(' + accent + ')[ \\t]*\\n[ \\t]*(' + identifier + ')(?=$|[\\s=+\\-\\u2212\\u00d7\\u22c5\\u2061-\\u2064,.;:!?()])',
      'gu'
    ), (_match, boundary, mark, base) => {
      repairs += 1;
      return boundary + repairStart + base + combiningFor(mark) + repairEnd;
    });
    value = value.replace(new RegExp(
      '(' + identifier + ')[ \\t]*\\n[ \\t]*(' + accent + ')[ \\t]*(?=\\n|$)',
      'gu'
    ), (_match, base, mark) => {
      repairs += 1;
      return repairStart + base + combiningFor(mark) + repairEnd;
    });
    if (!repairs) return untouched;

    // Collapse only the layout break immediately touching the recovered
    // accent. Do not flatten any other single newline in the selection, and
    // leave blank-line paragraph boundaries exact.
    value = value.replace(new RegExp('([ \\t]*)\\n([ \\t]*)' + repairStart, 'gu'),
      (match, _before, _after, offset, source) => {
        if (offset > 0 && source[offset - 1] === '\n') return match;
        // The match begins before its captured horizontal whitespace, so the
        // preceding significant code unit is available in O(1). Never slice
        // the growing prefix once per accent: a long selection with many
        // renderer boxes must remain linear.
        const previous = offset > 0 ? source[offset - 1] : '';
        return /[\u2061\u2062]/u.test(previous) ? repairStart : ' ' + repairStart;
      });
    value = value.replace(new RegExp(repairEnd + '([ \\t]*)\\n([ \\t]*)([^\\n])', 'gu'),
      (_match, _before, after, next) => {
        if (after || /[=\u2260\u2248\u2264\u2265\u221d+\-\u2212]/u.test(next)) {
          return repairEnd + ' ' + next;
        }
        if (/[,.;:!?\)\]\}]/u.test(next)) return repairEnd + next;
        if (/\p{L}/u.test(next)) return repairEnd + ' ' + next;
        return repairEnd + next;
      });
    value = value.replace(new RegExp(repairEnd + '[ \\t]*\\n[ \\t]*$', 'u'), repairEnd);
    // Mathematical Alphanumeric Symbols are a renderer font choice here, not
    // an authored alphabet choice. Return ordinary identifiers just as the
    // semantic MathML/TeX paths do for implicit italic variables. Scope that
    // compatibility normalization to the recovered sentence: an unrelated
    // authored mathematical alphabet elsewhere in the selection is content.
    value = value.split(/([.!?。！？]+|\n+)/u).map((part) => {
      if (!part.includes(repairStart) && !part.includes(repairEnd)) return part;
      return Array.from(part, (character) => /[\u{1d400}-\u{1d7ff}]/u.test(character)
        ? character.normalize('NFKC')
        : character).join('');
    }).join('');
    value = value.replaceAll(repairStart, '').replaceAll(repairEnd, '');
    const repaired = value
      .replace(/[ \t]*\u2061[ \t]*/gu, '')
      .replace(/[ \t]*\u2062[ \t]*/gu, '')
      .replace(/[ \t]*\u2063[ \t]*/gu, ', ')
      .replace(/[ \t]*\u2064[ \t]*/gu, ' + ')
      .replace(/[ \t]*([=\u2260\u2248\u2264\u2265\u221d])[ \t]*/gu, ' $1 ')
      .replace(/[ \t]{2,}/g, ' ');
    return finalizeRewrittenText(repaired.normalize ? repaired.normalize('NFC') : repaired);
  }

  function finalizeRewrittenText(input) {
    return cleanClipboardText(input)
      .replace(/[ \t]+\n/g, '\n')
      .replace(/^\n+|[ \t\n]+$/g, '');
  }

  function compatibilityMathText(input) {
    let value = cleanClipboardText(String(input == null ? '' : input));
    try {
      value = value.normalize('NFKC');
    } catch (_error) {
      // Keep the original text on legacy engines.
    }
    return value.replace(/[\s\u00a0]/g, '');
  }

  function hasMathematicalStyledCharacter(input) {
    const value = String(input == null ? '' : input);
    if (/[\u{1d400}-\u{1d7ff}]/u.test(value)) return true;
    const letterlikeExceptions = new Set(Array.from('ℂℊℋℌℍℎℐℑℒℓℕ℘ℙℚℛℜℝℤℨℬℭℯℰℱℳℴ'));
    return Array.from(value).some((character) => letterlikeExceptions.has(character));
  }

  function cleanOfficeClipboardText(input) {
    const lines = cleanClipboardText(input).split('\n');
    const output = [];
    const foldedFlags = [];
    let folded = 0;
    for (let index = 0; index < lines.length; index += 1) {
      const source = lines[index];
      const trimmed = source.trim();
      if (!hasMathematicalStyledCharacter(trimmed)) {
        output.push(source);
        foldedFlags.push(false);
        continue;
      }
      let styledCompatibility = trimmed;
      try { styledCompatibility = styledCompatibility.normalize('NFKC'); } catch (_error) { /* retain source */ }
      if (!/[0-9=+\-−×÷±∓∝<>≤≥≠,;:()[\]{}|∣]/u.test(styledCompatibility) &&
          Array.from(styledCompatibility).length !== 1) {
        output.push(source);
        foldedFlags.push(false);
        continue;
      }
      const sourceKey = compatibilityMathText(trimmed);
      let assembled = '';
      let cursor = index + 1;
      let matchedAt = -1;
      while (cursor < lines.length && cursor <= index + 16) {
        const fragment = lines[cursor].trim();
        if (!fragment) {
          cursor += 1;
          continue;
        }
        const key = compatibilityMathText(fragment);
        if (!key || !sourceKey.startsWith(assembled + key)) break;
        assembled += key;
        if (assembled === sourceKey) {
          matchedAt = cursor;
          break;
        }
        cursor += 1;
      }
      if (matchedAt < 0) {
        output.push(source);
        foldedFlags.push(false);
        continue;
      }
      let normalized = normalizeOfficeGlyphs(trimmed);
      normalized = normalized.replace(/^(\p{L})(\d+)$/u, (_match, letter, digits) =>
        letter + toScript(digits, SUBSCRIPTS, '_')
      );
      output.push(normalized);
      foldedFlags.push(true);
      folded += 1;
      index = matchedAt;
      let nextNonblank = index + 1;
      while (nextNonblank < lines.length && !lines[nextNonblank].trim()) nextNonblank += 1;
      const continuation = nextNonblank < lines.length &&
        /^[,.;:!?=\u2260\u2248\u2264\u2265\u221d\)\]\}]/u.test(lines[nextNonblank].trim());
      if (continuation) index = nextNonblank - 1;
    }

    let text = output.length ? output[0] : '';
    for (let index = 1; index < output.length; index += 1) {
      const previous = output[index - 1].trim();
      const current = output[index].trim();
      const rendererBoundary = Boolean(previous && current) && (foldedFlags[index - 1] || foldedFlags[index] ||
        /^[,.;:!?=\u2260\u2248\u2264\u2265\u221d\)\]\}]/u.test(current) ||
        /[,;:=\u2260\u2248\u2264\u2265\u221d([{]$/u.test(previous));
      text += rendererBoundary ? ' ' + output[index] : '\n' + output[index];
    }
    if (folded) {
      text = text
        .replace(/\s+([,.;:!?\)\]\}])/g, '$1')
        .replace(/([,;:])(?=\S)/g, '$1 ')
        .replace(/\s*([=\u2260\u2248\u2264\u2265\u221d])\s*/g, ' $1 ')
        .replace(/[ ]{2,}/g, ' ');
      text = text.replace(/\b([A-Za-z])(\d+)((?:\s*,\s*\1\d+)+)\b/g, (_match, letter, first, rest) => {
        const convert = (digits) => toScript(digits, SUBSCRIPTS, '_');
        return letter + convert(first) + rest.replace(new RegExp(letter + '(\\d+)', 'g'), (_item, digits) => letter + convert(digits));
      });
    }
    return finalizeRewrittenText(text);
  }

  function isMicrosoftOfficeWebPage(documentObject, pageWindow) {
    const host = String(pageWindow && pageWindow.location && pageWindow.location.hostname || '').toLowerCase();
    if (/(?:^|\.)(?:officeapps\.live\.com|office\.com|microsoft365\.com|cloud\.microsoft)$/.test(host) ||
        host === 'word.cloud.microsoft') return true;
    return Boolean(documentObject && documentObject.querySelector && documentObject.querySelector(
      '#WACViewPanel_EditingElement, #WACViewPanel_ClipboardElement, .WACPageImg'
    ));
  }

  function isGoogleDocsPage(pageWindow) {
    const location = pageWindow && pageWindow.location;
    const host = String(location && location.hostname || '').toLowerCase();
    const path = String(location && location.pathname || '');
    return host === 'docs.google.com' && path.startsWith('/document/');
  }

  function isGoogleDocsEditorPage(documentObject, pageWindow) {
    if (!isGoogleDocsPage(pageWindow)) return false;
    const path = String(pageWindow && pageWindow.location && pageWindow.location.pathname || '');
    if (/^\/document\/(?:u\/\d+\/)?d\/[^/]+\/edit(?:\/|$)/i.test(path)) return true;
    return Boolean(documentObject && documentObject.querySelector && documentObject.querySelector(
      '.kix-appview-editor, .docs-editor, [role="textbox"][contenteditable="true"]'
    ));
  }

  function parseClipboardDocument(markup, documentObject, xml) {
    if (!markup || !documentObject || !documentObject.defaultView || !documentObject.defaultView.DOMParser) return null;
    const source = String(markup).replace(/^\ufeff/, '').replace(/\u0000/g, '');
    if (source.length > MAX_CLIPBOARD_MARKUP_LENGTH) return null;
    try {
      const parsed = new documentObject.defaultView.DOMParser().parseFromString(source, xml ? 'application/xml' : 'text/html');
      if (xml && parsed.querySelector && parsed.querySelector('parsererror')) return null;
      return parsed;
    } catch (_error) {
      return null;
    }
  }

  function googleDocsStyleSlice(styleSlices, type, spacerLength) {
    if (!Array.isArray(styleSlices) || styleSlices.length > MAX_GOOGLE_DOCS_STYLE_SLICES) {
      return { valid: false, styles: null };
    }
    let styles = null;
    for (const slice of styleSlices) {
      if (!slice || typeof slice !== 'object' || Array.isArray(slice)) continue;
      if (slice.stsl_type !== type) continue;
      if (styles) return { valid: false, styles: null };
      if (!Array.isArray(slice.stsl_styles) || slice.stsl_styles.length > spacerLength + 1) {
        return { valid: false, styles: null };
      }
      styles = slice.stsl_styles;
    }
    return { valid: true, styles: styles || [] };
  }

  function googleDocsEquationCommand(styles, index) {
    const entry = styles && styles[index];
    const command = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? entry.eqfs_c
      : '';
    return typeof command === 'string' && /^\\[A-Za-z]{1,48}$/.test(command)
      ? command
      : '';
  }

  function googleDocsLiteralLatex(input) {
    let output = '';
    for (const character of String(input == null ? '' : input)) {
      if (/\s/u.test(character)) {
        // A LaTeX control-space inside \text{...} is parsed literally by the
        // bundled faithful converter. A nonbreaking-space token is safe both
        // in text functions and ordinary equation rows and normalizes back to
        // a regular visible space in the final clipboard text.
        output += '~';
        continue;
      }
      if (character === '\\') {
        output += '\\backslash ';
        continue;
      }
      if ('%_$#&{}'.includes(character)) {
        output += '\\' + character;
        continue;
      }
      // Google represents authored powers and indices structurally. A raw
      // caret here would be ambiguous LaTeX rather than visible source text.
      if (character === '^' || /[\u0019-\u001f]/u.test(character)) return '';
      output += character;
    }
    return output;
  }

  function googleDocsFunctionLatex(command, args, hasArguments) {
    const name = command.slice(1);
    const exact = (count) => Array.isArray(args) && args.length === count;
    const scriptBase = (value) => {
      const base = String(value == null ? '' : value).trim();
      if (/^(?:[\p{L}\p{N}\p{M}.]+|\\[A-Za-z]+\s*)$/u.test(base) ||
          (/^\([\s\S]*\)$/u.test(base)) || (/^\[[\s\S]*\]$/u.test(base))) return base;
      return '{' + base + '}';
    };
    if (name === 'rootof') return exact(2) ? '\\sqrt[' + args[0] + ']{' + args[1] + '}' : '';
    if (name === 'superscript') return exact(2) ? scriptBase(args[0]) + '^{' + args[1] + '}' : '';
    if (name === 'subscript') return exact(2) ? scriptBase(args[0]) + '_{' + args[1] + '}' : '';
    if (name === 'subsuperscript') {
      return exact(3) ? scriptBase(args[0]) + '_{' + args[1] + '}^{' + args[2] + '}' : '';
    }
    if (name === 'abs') return exact(1) ? '\\left|' + args[0] + '\\right|' : '';
    if (name === 'rbracelr') return exact(1) ? '\\left(' + args[0] + '\\right)' : '';
    if (name === 'sbracelr') return exact(1) ? '\\left\\{' + args[0] + '\\right\\}' : '';
    if (name === 'bracelr') return exact(1) ? '\\left[' + args[0] + '\\right]' : '';
    const boundedOperators = {
      bigcupab: 'bigcup', bigcapab: 'bigcap', prodab: 'prod', coprodab: 'coprod',
      intab: 'int', ointab: 'oint', sumab: 'sum'
    };
    if (Object.prototype.hasOwnProperty.call(boundedOperators, name)) {
      return exact(2)
        ? '\\' + boundedOperators[name] + '\\limits_{' + args[0] + '}^{' + args[1] + '}'
        : '';
    }
    if (name === 'limab') {
      return exact(2) ? '\\lim\\limits_{' + args[0] + '\\to ' + args[1] + '}' : '';
    }
    if (!hasArguments) return command + ' ';
    return command + args.map((argument) => '{' + argument + '}').join('');
  }

  function googleDocsEquationLatex(spacers, start, styles, budget) {
    if (spacers[start] !== '\u001a') return null;
    let position = start + 1;
    const parseSequence = (closing, splitArguments, depth) => {
      if (depth > MAX_MATHML_DEPTH) throw new Error('Google Docs equation depth exceeded');
      const args = [''];
      // Track only literal delimiters from this sequence. Delimiters produced
      // by nested equation functions belong to that function and cannot close
      // a raw literal fence in the surrounding sequence.
      const literalFenceStacks = [[]];
      const updateLiteralFences = (literal) => {
        const stack = literalFenceStacks[literalFenceStacks.length - 1];
        const matchingOpen = { ')': '(', ']': '[', '}': '{' };
        for (const character of literal) {
          if (character === '(' || character === '[' || character === '{') stack.push(character);
          else if (matchingOpen[character] && stack[stack.length - 1] === matchingOpen[character]) stack.pop();
        }
      };
      const append = (value) => {
        args[args.length - 1] += value;
        if (args[args.length - 1].length > MAX_MATH_SOURCE_LENGTH) {
          throw new Error('Google Docs equation source exceeded');
        }
      };
      while (position < spacers.length) {
        budget.steps += 1;
        if (budget.steps > MAX_GOOGLE_DOCS_PARSE_STEPS) throw new Error('Google Docs equation steps exceeded');
        const character = spacers[position];
        if (character === closing) {
          position += 1;
          return args;
        }
        if (character === '\u001d') {
          if (!splitArguments) throw new Error('Unexpected Google Docs equation argument');
          args.push('');
          literalFenceStacks.push([]);
          position += 1;
          continue;
        }
        if (character === '\u0019') {
          const command = googleDocsEquationCommand(styles, position);
          if (!command) throw new Error('Missing Google Docs equation command');
          position += 1;
          const functionArgs = parseSequence('\u001b', true, depth + 1);
          // Docs sometimes serializes the closing edge of a literal fence as
          // an empty paired-fence function immediately before the real raw
          // closing character. Suppress only that contextual layout marker.
          // A standalone/authored empty pair remains visible.
          const emptyFence = {
            '\\rbracelr': ['(', ')'],
            '\\sbracelr': ['{', '}'],
            '\\bracelr': ['[', ']']
          }[command];
          const literalStack = literalFenceStacks[literalFenceStacks.length - 1];
          if (functionArgs.length === 1 && functionArgs[0] === '' && emptyFence &&
              literalStack[literalStack.length - 1] === emptyFence[0] &&
              spacers[position] === emptyFence[1]) {
            continue;
          }
          const latex = googleDocsFunctionLatex(command, functionArgs, true);
          if (!latex) throw new Error('Invalid Google Docs equation function');
          append(latex);
          continue;
        }
        if (character === '\u001f') {
          const command = googleDocsEquationCommand(styles, position);
          if (!command) throw new Error('Missing Google Docs equation symbol');
          const latex = googleDocsFunctionLatex(command, [], false);
          if (!latex) throw new Error('Invalid Google Docs equation symbol');
          append(latex);
          position += 1;
          continue;
        }
        if (/[\u0019-\u001f]/u.test(character)) throw new Error('Unbalanced Google Docs equation');
        let end = position + 1;
        while (end < spacers.length && !/[\u0019-\u001f]/u.test(spacers[end])) end += 1;
        const literalSource = spacers.slice(position, end);
        const literal = googleDocsLiteralLatex(literalSource);
        if (!literal && end > position) throw new Error('Invalid Google Docs equation text');
        append(literal);
        updateLiteralFences(literalSource);
        budget.steps += end - position - 1;
        if (budget.steps > MAX_GOOGLE_DOCS_PARSE_STEPS) throw new Error('Google Docs equation steps exceeded');
        position = end;
      }
      throw new Error('Unterminated Google Docs equation');
    };
    try {
      const values = parseSequence('\u001e', false, 0);
      const latex = values.length === 1 ? values[0] : '';
      if (!latex || latex.length > MAX_MATH_SOURCE_LENGTH) return null;
      return { latex, end: position };
    } catch (_error) {
      return null;
    }
  }

  function googleDocsEquationText(latex, outputMode) {
    let text = '';
    if (outputMode === 'calculator') text = latexToCalculator(latex);
    else if (outputMode === 'unicode') text = latexToUnicode(latex);
    else if (outputMode === 'ascii') text = unicodeToAscii(latexToFaithful(latex));
    else if (outputMode === 'latex') text = '$' + latex + '$';
    else text = latexToFaithful(latex);
    text = finalizeRewrittenText(text);
    if (!text || (outputMode !== 'latex' && text.includes('\\'))) return '';
    return text;
  }

  function googleDocsTextStyleKinds(styles, length) {
    const kinds = new Array(length);
    let current = 'normal';
    for (let index = 0; index < length; index += 1) {
      const entry = styles[index];
      if (entry != null) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
        const value = entry.ts_va;
        if (value != null) {
          const normalized = String(value).toLowerCase();
          if (normalized === 'nor' || normalized === 'normal' || normalized === 'baseline') current = 'normal';
          else if (normalized === 'sup' || normalized === 'super') current = 'sup';
          else if (normalized === 'sub') current = 'sub';
          else return null;
        }
      }
      kinds[index] = current;
    }
    return kinds;
  }

  function googleDocsStyledRun(input, kind, outputMode) {
    if (kind !== 'sup' && kind !== 'sub') return { text: input, scripted: 0 };
    let scripted = 0;
    const text = String(input).split(/(\n+)/).map((line) => {
      if (!line || /^\n+$/u.test(line)) return line;
      const match = line.match(/^(\s*)([\s\S]*?\S)(\s*)$/u);
      if (!match) return line;
      scripted += 1;
      return match[1] + officeScriptText(match[2], kind, outputMode) + match[3];
    }).join('');
    return { text, scripted };
  }

  function googleDocsSlicePayload(rawSlice, settingsInput) {
    const source = typeof rawSlice === 'string' ? rawSlice : '';
    if (!source || source.length > MAX_CLIPBOARD_MARKUP_LENGTH) return null;
    let wrapper;
    let data;
    try {
      wrapper = JSON.parse(source);
      if (!wrapper || typeof wrapper !== 'object' || Array.isArray(wrapper) ||
          typeof wrapper.data !== 'string' || wrapper.data.length > MAX_CLIPBOARD_MARKUP_LENGTH) return null;
      data = JSON.parse(wrapper.data);
    } catch (_error) {
      return null;
    }
    const resolved = data && typeof data === 'object' && !Array.isArray(data) && data.resolved;
    const spacers = resolved && resolved.dsl_spacers;
    const styleSlices = resolved && resolved.dsl_styleslices;
    if (typeof spacers !== 'string' || !spacers || spacers.length > MAX_MATH_SOURCE_LENGTH) return null;
    const equationSlice = googleDocsStyleSlice(styleSlices, 'equation_function', spacers.length);
    const textSlice = googleDocsStyleSlice(styleSlices, 'text', spacers.length);
    if (!equationSlice.valid || !textSlice.valid) return null;
    const textKinds = googleDocsTextStyleKinds(textSlice.styles, spacers.length);
    if (!textKinds) return null;
    const settings = normalizeSettings(settingsInput);
    const budget = { steps: 0 };
    let output = '';
    let position = 0;
    let equations = 0;
    let scriptedRuns = 0;
    while (position < spacers.length) {
      if (spacers[position] === '\u001a') {
        equations += 1;
        if (equations > MAX_GOOGLE_DOCS_EQUATIONS) return null;
        const equation = googleDocsEquationLatex(spacers, position, equationSlice.styles, budget);
        if (!equation) return null;
        const text = googleDocsEquationText(equation.latex, settings.outputMode);
        if (!text) return null;
        output += text;
        position = equation.end;
        continue;
      }
      if (/[\u0019-\u001f]/u.test(spacers[position])) return null;
      const kind = textKinds[position];
      let end = position + 1;
      while (end < spacers.length && spacers[end] !== '\u001a' &&
             !/[\u0019-\u001f]/u.test(spacers[end]) && textKinds[end] === kind) end += 1;
      const styled = googleDocsStyledRun(spacers.slice(position, end), kind, settings.outputMode);
      output += styled.text;
      scriptedRuns += styled.scripted;
      position = end;
    }
    if (!equations && !scriptedRuns) return null;
    const text = finalizeRewrittenText(output);
    if (!text.trim()) return null;
    return {
      text,
      html: '',
      mathML: '',
      reason: 'google-docs-semantic-clipboard',
      mathRanges: equations
    };
  }

  function payloadFromMathElement(math, settings, documentObject) {
    if (!math || !domTreeWithinBudget(math, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return null;
    const importedMath = math.ownerDocument === documentObject
      ? math
      : documentObject.importNode(math, true);
    const localMath = sanitizedMathMLClone(importedMath);
    if (!localMath) return null;
    const text = finalizeRewrittenText(mathMLFragmentText(localMath, settings.outputMode));
    if (!text.trim()) return null;
    const richFragment = documentObject.createDocumentFragment();
    richFragment.appendChild(richMathNodeForElement(localMath, null, documentObject));
    return {
      text,
      html: sanitizeRichFragment(richFragment),
      mathML: serializeMathMLMarkup(localMath),
      reason: 'office-semantic-math',
      mathRanges: 1
    };
  }

  function stripOfficeHTMLClipboardHeader(markup) {
    const source = String(markup == null ? '' : markup);
    if (source.length > MAX_CLIPBOARD_MARKUP_LENGTH) return '';
    const fragment = source.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/i);
    if (fragment) return fragment[1];
    const start = source.match(/^StartHTML:\s*(\d+)/mi);
    const end = source.match(/^EndHTML:\s*(\d+)/mi);
    if (start) {
      const startIndex = Number(start[1]);
      const endIndex = end ? Number(end[1]) : source.length;
      if (Number.isFinite(startIndex) && startIndex >= 0 && startIndex < source.length &&
          Number.isFinite(endIndex) && endIndex > startIndex) return source.slice(startIndex, Math.min(endIndex, source.length));
    }
    return source;
  }

  function clipboardPlainAgreementKey(input) {
    let value = cleanClipboardText(String(input == null ? '' : input));
    try { value = value.normalize('NFKC'); } catch (_error) { /* retain source */ }
    return value.replace(/\s+/gu, '').replace(/\u2212/g, '-');
  }

  function clipboardInlineScriptKind(element) {
    if (!element || element.nodeType !== 1) return '';
    const tag = (element.localName || '').toLowerCase();
    if (tag === 'sup') return 'sup';
    if (tag === 'sub') return 'sub';
    const style = String(element.getAttribute && element.getAttribute('style') || '');
    const vertical = style.match(/(?:^|;)\s*vertical-align\s*:\s*(super|sub)\s*(?:!important\s*)?(?:;|$)/i);
    if (vertical) return vertical[1].toLowerCase() === 'super' ? 'sup' : 'sub';
    const variant = style.match(/(?:^|;)\s*font-variant-position\s*:\s*(super|sub)\s*(?:!important\s*)?(?:;|$)/i);
    return variant ? (variant[1].toLowerCase() === 'super' ? 'sup' : 'sub') : '';
  }

  function richScriptClipboardPayloadFromMarkup(markup, settingsInput, documentObject) {
    const parsed = parseClipboardDocument(stripOfficeHTMLClipboardHeader(markup), documentObject, false);
    const parsedBody = parsed && (parsed.body || parsed.documentElement);
    if (!parsedBody || !domTreeWithinBudget(parsedBody, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return null;
    // Keep untrusted clipboard markup in DOMParser's inert document. Importing
    // arbitrary nodes into the live page can upgrade custom elements or trigger
    // page-owned behavior even when the imported fragment is never attached.
    const fragment = parsedBody;
    const originalText = finalizeRewrittenText(serializeOrdinaryFragment(fragment).text);
    if (!originalText.trim()) return null;
    const candidates = Array.from(fragment.querySelectorAll ? fragment.querySelectorAll('sup, sub, [style]') : [])
      .filter((element) => clipboardInlineScriptKind(element));
    if (!candidates.length || candidates.length > MAX_RICH_SELECTION_NODES) return null;
    const depth = (element) => {
      let value = 0;
      for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) value += 1;
      return value;
    };
    const nestedScriptContainers = new WeakSet(candidates.filter((element) =>
      candidates.some((candidate) => candidate !== element && element.contains(candidate))
    ));
    const nestedScriptChildren = new WeakSet(candidates.filter((element) => {
      for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (candidates.includes(ancestor)) return true;
      }
      return false;
    }));
    // Inner-first replacement preserves nested scripts. For example,
    // x<sup>2<sup>3</sup></sup> becomes x^(2³), never the ambiguous x²³.
    candidates.sort((left, right) => depth(right) - depth(left));
    const settings = normalizeSettings(settingsInput);
    let scripts = 0;
    for (const element of candidates) {
      const kind = clipboardInlineScriptKind(element);
      // Reuse the bounded ordinary serializer so executable/hidden descendants
      // inside untrusted clipboard HTML can never become newly visible text.
      const raw = finalizeRewrittenText(serializeOrdinaryFragment(element).text);
      if (!kind || !raw.trim() || raw.length > MAX_MATH_SOURCE_LENGTH) continue;
      const replacement = parsed.createElement('span');
      let scriptText = officeScriptText(raw, kind, settings.outputMode);
      if (nestedScriptContainers.has(element) || nestedScriptChildren.has(element)) {
        const marker = kind === 'sub' ? '_' : '^';
        if (settings.outputMode === 'calculator') {
          scriptText = marker + '(' + unicodeToCalculator(raw, { preserveLongIdentifiers: true }) + ')';
        } else if (settings.outputMode === 'latex') {
          scriptText = marker + '{' + raw + '}';
        } else {
          const explicit = settings.outputMode === 'ascii' ? unicodeToAscii(raw) : raw;
          scriptText = nestedScriptContainers.has(element) || Array.from(explicit).length !== 1
            ? marker + '(' + explicit + ')'
            : marker + explicit;
        }
      }
      TRUSTED_TEXT_PLACEHOLDERS.set(replacement, {
        text: scriptText,
        display: false
      });
      element.replaceWith(replacement);
      scripts += 1;
    }
    if (!scripts) return null;
    let text = finalizeRewrittenText(serializeOrdinaryFragment(fragment).text);
    if (!text.trim() || text === originalText) return null;
    if (looksLikeStandaloneUnicodeMath(text)) {
      if (settings.outputMode === 'faithful') text = formatFaithfulMathText(text);
      else if (settings.outputMode === 'unicode') text = formatMathText(text);
      else if (settings.outputMode === 'calculator') text = unicodeToCalculator(text, { preserveLongIdentifiers: true });
      else if (settings.outputMode === 'ascii') text = unicodeToAscii(formatMathText(text));
    }
    text = finalizeRewrittenText(text);
    if (!text.trim()) return null;
    return {
      text,
      sourceText: originalText,
      html: '',
      mathML: '',
      reason: 'rich-clipboard-scripts',
      mathRanges: 0
    };
  }

  function officeSemanticPayloadFromMarkup(markup, settings, documentObject, xml) {
    const source = xml ? markup : stripOfficeHTMLClipboardHeader(markup);
    const parsed = parseClipboardDocument(source, documentObject, xml);
    if (!parsed) return null;
    const roots = findOfficeMathRoots(xml ? parsed : (parsed.body || parsed));
    if (!roots.length || roots.length > 256) return null;
    const values = roots.map((root) => {
      const name = officeElementName(root);
      const math = name === 'math'
        ? documentObject.importNode(root, true)
        : ommlToMathML(root, documentObject);
      const payload = payloadFromMathElement(math, settings, documentObject);
      if (!payload) return null;
      let ancestor = root.parentElement;
      let officeParagraph = name === 'omathpara';
      while (ancestor && !officeParagraph) {
        officeParagraph = officeElementName(ancestor) === 'omathpara';
        ancestor = ancestor.parentElement;
      }
      return {
        root,
        math,
        payload,
        display: officeParagraph || (math.getAttribute && math.getAttribute('display') === 'block')
      };
    });
    if (values.some((value) => !value)) return null;

    if (xml) {
      if (values.length === 1) return { ...values[0].payload, semanticScope: 'single' };
      const text = finalizeRewrittenText(values.map((value) => value.payload.text).join('\n'));
      if (!text.trim()) return null;
      return {
        text,
        html: '<!--StartFragment-->' + values.map((value) => clipboardHTMLBody(value.payload.html)).join('<br>') + '<!--EndFragment-->',
        mathML: '',
        reason: 'office-semantic-markup',
        mathRanges: values.length,
        semanticScope: 'mixed'
      };
    }

    const marker = 'data-clean-math-copy-office-index';
    // Clipboard HTML is untrusted. Remove page-authored lookalike markers
    // before marking the exact semantic roots discovered in this operation.
    for (const forged of Array.from((parsed.body || parsed).querySelectorAll('[' + marker + ']'))) {
      forged.removeAttribute(marker);
    }
    values.forEach((value, index) => value.root.setAttribute(marker, String(index)));
    const cloneBody = () => {
      const fragment = documentObject.createDocumentFragment();
      for (const child of Array.from((parsed.body || parsed.documentElement).childNodes || [])) {
        fragment.appendChild(documentObject.importNode(child, true));
      }
      return fragment;
    };
    const textFragment = cloneBody();
    for (const placeholder of Array.from(textFragment.querySelectorAll('[' + marker + ']'))) {
      const value = values[Number(placeholder.getAttribute(marker))];
      if (!value) continue;
      const replacement = documentObject.createElement('span');
      TRUSTED_TEXT_PLACEHOLDERS.set(replacement, { text: value.payload.text, display: Boolean(value.display) });
      placeholder.replaceWith(replacement);
    }
    const text = finalizeRewrittenText(serializeOrdinaryFragment(textFragment).text);

    const richFragment = cloneBody();
    for (const placeholder of Array.from(richFragment.querySelectorAll('[' + marker + ']'))) {
      const value = values[Number(placeholder.getAttribute(marker))];
      if (value) placeholder.replaceWith(richMathNodeForElement(value.math, null, documentObject));
    }
    for (const wrapper of Array.from(richFragment.querySelectorAll('*')).reverse()) {
      const qualifiedName = String(wrapper.nodeName || '').toLowerCase();
      const namespace = String(wrapper.namespaceURI || '').toLowerCase();
      if (!qualifiedName.startsWith('m:') && !namespace.includes('officedocument/2006/math')) continue;
      wrapper.replaceWith(...Array.from(wrapper.childNodes));
    }
    values.forEach((value) => value.root.removeAttribute(marker));
    if (!text.trim()) return values.length === 1 ? { ...values[0].payload, semanticScope: 'single' } : null;
    const onlyMath = values.length === 1 && text.trim() === values[0].payload.text.trim();
    return {
      text,
      html: sanitizeRichFragment(richFragment),
      mathML: onlyMath ? values[0].payload.mathML : '',
      reason: 'office-semantic-markup',
      mathRanges: values.length,
      semanticScope: onlyMath ? 'single' : 'mixed'
    };
  }

  function clipboardTypes(clipboardData) {
    try {
      return Array.from(clipboardData && clipboardData.types || []);
    } catch (_error) {
      return [];
    }
  }

  function clipboardGet(clipboardData, type) {
    try {
      return clipboardData && typeof clipboardData.getData === 'function' ? clipboardData.getData(type) : '';
    } catch (_error) {
      return '';
    }
  }

  function officeSemanticPayloadFromClipboard(clipboardData, settings, documentObject) {
    const types = clipboardTypes(clipboardData);
    const mathTypes = ['application/mathml+xml', 'MathML', 'MathML Presentation'];
    for (const requested of mathTypes) {
      const actual = types.find((type) => type.toLowerCase() === requested.toLowerCase()) || requested;
      const markup = clipboardGet(clipboardData, actual);
      if (!markup) continue;
      const payload = officeSemanticPayloadFromMarkup(markup, settings, documentObject, true);
      if (payload) return payload;
    }
    for (const requested of ['text/html', 'HTML Format']) {
      const actual = types.find((type) => type.toLowerCase() === requested.toLowerCase()) || requested;
      const markup = clipboardGet(clipboardData, actual);
      if (!markup) continue;
      const payload = officeSemanticPayloadFromMarkup(markup, settings, documentObject, false);
      if (payload) return payload;
    }
    return null;
  }

  function hasCleanableArtifacts(text) {
    return /[\u00ad\u200b\u2060\ufeff\u00a0\r]/.test(text);
  }

  function looksLikeStandaloneUnicodeMath(input) {
    const value = finalizeRewrittenText(input);
    if (!value || value.length > 10000 || /[\r\n]/.test(value)) return false;
    if (/[!?;:"'“”‘’]/u.test(value) || /\.$/.test(value)) return false;
    if (!/[\p{L}\p{N}]/u.test(value)) return false;
    const syntaxOnly = value.replace(/[\p{L}\p{N}\p{M}\s]/gu, '');
    if (/[^()[\]{},.=+\-\u2212×÷·⋅∗\/*^_|∣❘√∛∜<>\u2264≥≠≈≃≅≡∝∞∂∇∑∏∫±∓%°⁺⁻⁼⁽⁾₊₋₌₍₎]/u.test(syntaxOnly)) return false;

    // Require a glyph whose calculator spelling is materially different. This
    // deliberately avoids intercepting normal prose or an ordinary ASCII-only
    // selection merely because it contains a plus sign.
    const transformativeGlyph = /[√∛∜×÷·⋅∗−±∓≤≥≠≈≃≅≡∝∞∂∇∑∏∫∣❘⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓα-ωΑ-Ω]/u.test(value);
    const hasBars = /[|∣❘‖∥]/u.test(value);
    const pairedBars = hasBars && replaceNestedAbsoluteBars(value) !== value;
    if (hasBars && !pairedBars) return false;
    if (!transformativeGlyph && !pairedBars) return false;

    // Without a relation, unknown identifiers must be visibly compact parts of
    // an expression (for example `dx/dt²`), not whitespace-separated short
    // prose such as `go × up`. An explicit relation is stronger evidence and
    // permits descriptive identifiers such as `velocity = 2 × time`.
    const hasRelation = /(?:[=<>]|≤|≥|≠|≈|≃|≅|≡|∝)/u.test(value);
    // A comparison glyph by itself is common in ordinary prose: `Plan A ≠
    // Plan B` and `Temperature ≥ room temperature` are labels/sentences,
    // not calculator expressions. Long descriptive identifiers are accepted
    // only when another structural math signal is present. This still admits
    // named formulas such as `speed = 2 × time` and scripted identifiers such
    // as `initial_velocity ∝ final_velocity²`.
    const hasStructuralMathEvidence = /[()[\]{},+\-\u2212×÷·⋅∗/*^_|∣❘‖∥√∛∜∞∂∇∑∏∫±∓%⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙᵣₛₜᵤᵥₓ]/u.test(value);
    const allowedWords = new Set([
      ...CALCULATOR_WORDS,
      'Hz', 'Pa', 'Wb', 'cd', 'deg', 'eV', 'kg', 'mol', 'ohm', 'rad', 'rpm'
    ].map((word) => word.toLowerCase()));
    const proseStopWords = new Set([
      'am', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'did', 'do',
      'for', 'from', 'go', 'has', 'have', 'he', 'if', 'in', 'is', 'it', 'me',
      'my', 'no', 'not', 'now', 'of', 'on', 'or', 'so', 'that', 'the', 'then',
      'this', 'to', 'up', 'us', 'use', 'was', 'we', 'were', 'will', 'with',
      'you', 'your'
    ]);
    const words = Array.from(value.matchAll(/\p{L}+/gu));
    for (const match of words) {
      const word = match[0];
      const lower = word.toLowerCase();
      if (proseStopWords.has(lower)) return false;
      const length = Array.from(word).length;
      if (length === 1 || allowedWords.has(lower) || /^[α-ωΑ-Ω]+$/u.test(word)) continue;
      if (hasRelation && hasStructuralMathEvidence) continue;
      if (hasRelation) return false;
      const before = match.index > 0 ? value[match.index - 1] : '';
      const afterIndex = match.index + word.length;
      const after = afterIndex < value.length ? value[afterIndex] : '';
      const tightlyBound = (before && !/\s/u.test(before)) || (after && !/\s/u.test(after));
      if (length <= 2 && tightlyBound) continue;
      return false;
    }
    return true;
  }

  function rangeDOMWithinBudget(range, nodeLimit, depthLimit, characterLimit) {
    if (!range || !range.commonAncestorContainer) return false;
    const root = range.commonAncestorContainer;
    const stack = [{ node: root, depth: 0 }];
    let inspected = 1;
    let characters = 0;
    const countNode = (node) => {
      if (!characterLimit || !node) return true;
      if (node.nodeType === 3) characters += String(node.nodeValue || '').length;
      if (node.nodeType === 1) {
        for (const attribute of Array.from(node.attributes || [])) {
          characters += String(attribute.name || '').length + String(attribute.value || '').length;
        }
      }
      return characters <= characterLimit;
    };
    if (!countNode(root)) return false;
    while (stack.length) {
      const current = stack.pop();
      if (!current || !current.node) continue;
      if (current.depth > depthLimit) return false;
      let child = current.node.lastChild;
      while (child) {
        const previous = child.previousSibling;
        inspected += 1;
        if (inspected > nodeLimit) return false;
        let intersects = false;
        try {
          if (typeof range.intersectsNode !== 'function') return false;
          intersects = range.intersectsNode(child);
        } catch (_error) {
          return false;
        }
        if (intersects) {
          if (!countNode(child)) return false;
          stack.push({ node: child, depth: current.depth + 1 });
        }
        child = previous;
      }
    }
    return true;
  }

  function richHTMLForSelectionRanges(ranges, documentObject) {
    const fragment = documentObject.createDocumentFragment();
    for (let index = 0; index < ranges.length; index += 1) {
      if (index > 0) fragment.appendChild(documentObject.createElement('br'));
      const range = ranges[index];
      if (!rangeDOMWithinBudget(range, MAX_RICH_SELECTION_NODES, MAX_RICH_SELECTION_DEPTH)) {
        fragment.appendChild(documentObject.createTextNode(range.toString()));
        continue;
      }
      try {
        const contents = range.cloneContents();
        const common = range.commonAncestorContainer && range.commonAncestorContainer.nodeType === 1
          ? range.commonAncestorContainer
          : range.commonAncestorContainer && range.commonAncestorContainer.parentElement;
        const tag = common && (common.localName || '').toLowerCase();
        if (common && tag && !['html', 'body'].includes(tag)) {
          const context = common.cloneNode(false);
          context.appendChild(contents);
          fragment.appendChild(context);
        } else fragment.appendChild(contents);
      } catch (_error) {
        fragment.appendChild(documentObject.createTextNode(ranges[index].toString()));
      }
    }
    return sanitizeRichFragment(fragment);
  }

  function standaloneUnicodeMathPayload(nativeText, ranges, settings, documentObject) {
    const value = finalizeRewrittenText(nativeText);
    if (!looksLikeStandaloneUnicodeMath(value)) return null;
    let text = value;
    if (settings.outputMode === 'calculator') text = unicodeToCalculator(value, { preserveLongIdentifiers: true });
    else if (settings.outputMode === 'ascii') text = unicodeToAscii(value);
    else if (settings.outputMode === 'latex') return null;
    text = finalizeRewrittenText(text);
    if (!text.trim() || text === nativeText) return null;
    return {
      text,
      html: richHTMLForSelectionRanges(ranges, documentObject),
      mathML: '',
      reason: 'unicode-math',
      mathRanges: 0
    };
  }

  function boundedSelectionRangeCount(selection) {
    if (!selection) return 0;
    try {
      const count = Number(selection.rangeCount);
      if (!Number.isFinite(count) || count < 0 || count > MAX_SELECTION_RANGES) return -1;
      return Math.floor(count);
    } catch (_error) {
      return -1;
    }
  }

  function selectionRanges(documentObject, selection, capturedRangeCount) {
    const ranges = [];
    const reportedRangeCount = Number.isInteger(capturedRangeCount)
      ? capturedRangeCount
      : boundedSelectionRangeCount(selection);
    if (reportedRangeCount < 0) return ranges;
    try {
      if (typeof selection.getComposedRanges === 'function') {
        const shadowRoots = [];
        for (const endpoint of [selection.anchorNode, selection.focusNode]) {
          const root = endpoint && endpoint.getRootNode ? endpoint.getRootNode() : null;
          if (root && root.nodeType === 11 && root.host && !shadowRoots.includes(root)) shadowRoots.push(root);
        }
        const staticRanges = selection.getComposedRanges({ shadowRoots });
        for (const staticRange of staticRanges) {
          if (ranges.length >= MAX_SELECTION_RANGES) return [];
          const range = documentObject.createRange();
          range.setStart(staticRange.startContainer, staticRange.startOffset);
          range.setEnd(staticRange.endContainer, staticRange.endOffset);
          ranges.push(range);
        }
        if (ranges.length) return ranges;
      }
    } catch (_error) {
      // Older browsers expose getComposedRanges with a different signature.
      // Discard any partial composed result before trying native ranges.
      ranges.length = 0;
    }
    try {
      for (let index = 0; index < reportedRangeCount; index += 1) {
        ranges.push(selection.getRangeAt(index).cloneRange());
      }
    } catch (_error) {
      return [];
    }
    return ranges;
  }

  function cleanOrdinaryCharacters(input) {
    return String(input == null ? '' : input)
      .replace(/\r\n?/g, '\n')
      // U+200D is intentionally absent: it joins emoji and several writing
      // systems. Bidi controls and combining marks are also meaningful text.
      .replace(/[\u00ad\u200b\u2060\ufeff]/g, '')
      .replace(/\u00a0/g, ' ');
  }

  function ordinaryWhitespaceMode(element, inheritedMode) {
    if (!element || element.nodeType !== 1) return inheritedMode || 'normal';
    const tag = (element.localName || '').toLowerCase();
    if (tag === 'pre' || tag === 'code' || tag === 'textarea') return 'preserve';
    const style = String(element.getAttribute && element.getAttribute('style') || '');
    const declaration = style.match(/(?:^|;)\s*white-space\s*:\s*([^;!]+)/i);
    if (!declaration) return inheritedMode || 'normal';
    const value = declaration[1].trim().toLowerCase();
    if (/^(?:pre|pre-wrap|break-spaces)$/.test(value)) return 'preserve';
    if (value === 'pre-line') return 'pre-line';
    if (/^(?:normal|nowrap)$/.test(value)) return 'normal';
    return inheritedMode || 'normal';
  }

  function ordinaryModeledListStyle(element) {
    if (!element || element.nodeType !== 1) return null;
    let list = element;
    let tag = (list.localName || '').toLowerCase();
    if (tag === 'li') {
      list = element.parentElement;
      tag = (list && list.localName || '').toLowerCase();
    }
    if (!list || !['ul', 'ol'].includes(tag)) return null;
    if (tag === 'ul') return { type: 'disc', authoredType: false };
    const authored = list.hasAttribute && list.hasAttribute('type');
    const type = String(list.getAttribute && list.getAttribute('type') || '1');
    return {
      type: ({ '1': 'decimal', a: 'lower-alpha', A: 'upper-alpha', i: 'lower-roman', I: 'upper-roman' })[type] || 'decimal',
      authoredType: Boolean(authored)
    };
  }

  function ordinaryComputedLayoutRisk(range, documentObject) {
    const view = documentObject && documentObject.defaultView;
    if (!range || !view || typeof view.getComputedStyle !== 'function') return true;
    const root = range.commonAncestorContainer && range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer && range.commonAncestorContainer.parentElement;
    if (!root) return true;
    const stack = [root];
    let inspected = 0;
    while (stack.length) {
      const element = stack.pop();
      if (!element || element.nodeType !== 1 || !rangeIntersects(range, element)) continue;
      inspected += 1;
      if (inspected > MAX_RICH_SELECTION_NODES) return true;
      const tag = (element.localName || '').toLowerCase();
      // Semantic MathML is replaced from a separately sanitized clone before
      // ordinary prose is serialized. Its renderer-internal layout is not a
      // prose signal, and some DOM engines cannot compute MathML CSS at all.
      if (element.namespaceURI === MATHML_NAMESPACE) continue;
      if (ORDINARY_DROP_CONTENT_TAGS.has(tag) || SKIP_TAGS.has(tag) || isVisuallyHiddenElement(element)) continue;
      try {
        const computed = view.getComputedStyle(element);
        const visibility = String(computed && computed.visibility || '').toLowerCase();
        const display = String(computed && computed.display || '').toLowerCase();
        const contentVisibility = String(computed && computed.contentVisibility || '').toLowerCase();
        if (display === 'none' || contentVisibility === 'hidden' || visibility === 'hidden' || visibility === 'collapse') return true;

        const opacity = Number.parseFloat(String(computed && computed.opacity || '1'));
        const fontSize = Number.parseFloat(String(computed && computed.fontSize || ''));
        const color = String(computed && computed.color || '').replace(/\s+/g, '').toLowerCase();
        const textFill = String(computed && (computed.webkitTextFillColor || computed.getPropertyValue &&
          computed.getPropertyValue('-webkit-text-fill-color')) || '').replace(/\s+/g, '').toLowerCase();
        if ((Number.isFinite(opacity) && opacity <= 0) || (Number.isFinite(fontSize) && fontSize <= 0) ||
            color === 'transparent' || /rgba\([^)]*,0(?:\.0+)?\)$/u.test(color) ||
            textFill === 'transparent' || /rgba\([^)]*,0(?:\.0+)?\)$/u.test(textFill)) return true;

        const clip = String(computed && computed.clip || '').trim().toLowerCase();
        const clipPath = String(computed && (computed.clipPath || computed.webkitClipPath) || '').trim().toLowerCase();
        const filter = String(computed && computed.filter || '').trim().toLowerCase();
        const transform = String(computed && computed.transform || '').trim().toLowerCase();
        const position = String(computed && computed.position || '').trim().toLowerCase();
        const floatValue = String(computed && (computed.cssFloat || computed.float) || '').trim().toLowerCase();
        if ((clip && clip !== 'auto') || (clipPath && clipPath !== 'none') ||
            (filter && filter !== 'none') || (transform && transform !== 'none') ||
            /^(?:absolute|fixed)$/u.test(position) || (floatValue && floatValue !== 'none')) return true;

        const textTransform = String(computed && computed.textTransform || '').toLowerCase();
        if (textTransform && textTransform !== 'none') return true;
        const textSecurity = String(computed && (computed.webkitTextSecurity || computed.getPropertyValue &&
          computed.getPropertyValue('-webkit-text-security')) || '').trim().toLowerCase();
        const fontVariant = String(computed && computed.fontVariant || '').trim().toLowerCase();
        const fontVariantCaps = String(computed && computed.fontVariantCaps || '').trim().toLowerCase();
        if ((textSecurity && textSecurity !== 'none') ||
            (fontVariant && fontVariant !== 'normal' && fontVariant !== 'none') ||
            (fontVariantCaps && fontVariantCaps !== 'normal')) return true;

        const whiteSpace = String(computed && computed.whiteSpace || '').toLowerCase();
        const computedMode = /^(?:pre|pre-wrap|break-spaces)$/.test(whiteSpace)
          ? 'preserve'
          : (whiteSpace === 'pre-line' ? 'pre-line' : (/^(?:normal|nowrap)$/.test(whiteSpace) ? 'normal' : ''));
        const modeledMode = ordinaryWhitespaceMode(element, 'normal');
        if (computedMode && computedMode !== modeledMode) return true;

        const modeledList = ordinaryModeledListStyle(element);
        if (modeledList) {
          if (tag === 'li' && display && display !== 'list-item') return true;
          const listStyleImage = String(computed && computed.listStyleImage || '').trim().toLowerCase();
          if (listStyleImage && listStyleImage !== 'none') return true;
          const listStyleType = String(computed && computed.listStyleType || '').trim().toLowerCase();
          const compatibleBullet = modeledList.type === 'disc' && ['disc', 'circle', 'square'].includes(listStyleType);
          if (listStyleType && listStyleType !== modeledList.type && !compatibleBullet) {
            // jsdom and a few older engines do not reflect HTML <ol type> in
            // computed style and report the default decimal. Non-default CSS
            // values are still distinguishable and must defer to native copy.
            if (!(modeledList.authoredType && listStyleType === 'decimal')) return true;
          }
        }

        if (/^(?:flex|inline-flex|grid|inline-grid)$/.test(display)) return true;

        if (!['html', 'body', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'].includes(tag) && display) {
          const computedBlock = /^(?:block|flex|grid|list-item|table)$/.test(display);
          const modeledBlock = BLOCK_TAGS.has(tag) || /display\s*:\s*(?:block|flex|grid|list-item|table)/i.test(
            String(element.getAttribute && element.getAttribute('style') || '')
          );
          if (computedBlock !== modeledBlock && display !== 'contents') return true;
          if (display === 'contents' && modeledBlock) return true;
        }
      } catch (_error) {
        // Layout is part of the copied meaning; an inspection failure must
        // leave the operation native instead of guessing from source markup.
        return true;
      }
      for (let child = element.lastElementChild; child; child = child.previousElementSibling) {
        stack.push(child);
      }
    }
    return false;
  }

  function cloneOrdinaryRangeWithContext(range, documentObject) {
    if (!rangeDOMWithinBudget(
      range,
      MAX_RICH_SELECTION_NODES,
      MAX_RICH_SELECTION_DEPTH,
      MAX_ORDINARY_SELECTION_MARKUP_LENGTH
    ) || ordinaryComputedLayoutRisk(range, documentObject)) return null;
    let contents;
    try {
      contents = range.cloneContents();
    } catch (_error) {
      return null;
    }
    const common = range.commonAncestorContainer && range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer && range.commonAncestorContainer.parentElement;
    const tag = common && (common.localName || '').toLowerCase();
    if (!common || !tag || ['html', 'body'].includes(tag)) return contents;
    try {
      const safeContextTag = ORDINARY_RICH_TAGS.has(tag) || ['area', 'hr', 'img'].includes(tag) ? tag : 'span';
      const context = documentObject.createElement(safeContextTag);
      for (const name of ['start', 'value', 'type', 'dir', 'lang', 'alt']) {
        if (common.hasAttribute && common.hasAttribute(name)) context.setAttribute(name, common.getAttribute(name));
      }
      if (common.hasAttribute && common.hasAttribute('reversed')) context.setAttribute('reversed', '');
      const sourceStyle = String(common.getAttribute && common.getAttribute('style') || '');
      const retainedStyle = [];
      const whitespace = sourceStyle.match(/(?:^|;)\s*white-space\s*:\s*([^;!]+)/i);
      const display = sourceStyle.match(/(?:^|;)\s*display\s*:\s*([^;!]+)/i);
      if (whitespace && /^(?:normal|nowrap|pre|pre-wrap|pre-line|break-spaces)$/i.test(whitespace[1].trim())) {
        retainedStyle.push('white-space:' + whitespace[1].trim().toLowerCase());
      }
      if (display && /^(?:block|flex|grid|list-item|table)$/i.test(display[1].trim())) {
        retainedStyle.push('display:' + display[1].trim().toLowerCase());
      }
      if (retainedStyle.length) context.setAttribute('style', retainedStyle.join(';'));
      context.appendChild(contents);
      const fragment = documentObject.createDocumentFragment();
      let outerContext = context;
      if (tag === 'tr') {
        const table = documentObject.createElement('table');
        const body = documentObject.createElement('tbody');
        body.appendChild(context);
        table.appendChild(body);
        outerContext = table;
      } else if (['thead', 'tbody', 'tfoot', 'caption', 'colgroup'].includes(tag)) {
        const table = documentObject.createElement('table');
        table.appendChild(context);
        outerContext = table;
      } else if (tag === 'td' || tag === 'th') {
        const table = documentObject.createElement('table');
        const body = documentObject.createElement('tbody');
        const row = documentObject.createElement('tr');
        row.appendChild(context);
        body.appendChild(row);
        table.appendChild(body);
        outerContext = table;
      }
      fragment.appendChild(outerContext);
      return fragment;
    } catch (_error) {
      return contents;
    }
  }

  function ordinaryRows(table) {
    if ((table && table.localName || '').toLowerCase() === 'tr') return [table];
    const rows = [];
    const collect = (container) => {
      for (const child of Array.from(container.children || [])) {
        const tag = (child.localName || '').toLowerCase();
        if (tag === 'tr') rows.push(child);
        else if (['thead', 'tbody', 'tfoot'].includes(tag)) collect(child);
      }
    };
    collect(table);
    return rows;
  }

  function ordinaryOrderedListMarker(number, type) {
    const value = Math.trunc(Number(number));
    const style = String(type || '1');
    if (!Number.isFinite(value) || value <= 0 || style === '1') return String(value);
    if (style === 'A' || style === 'a') {
      let current = value;
      let letters = '';
      while (current > 0) {
        current -= 1;
        letters = String.fromCharCode(65 + (current % 26)) + letters;
        current = Math.floor(current / 26);
      }
      return style === 'a' ? letters.toLowerCase() : letters;
    }
    if ((style === 'I' || style === 'i') && value <= 3999) {
      const numerals = [
        [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'],
        [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'],
        [4, 'IV'], [1, 'I']
      ];
      let current = value;
      let roman = '';
      for (const [amount, glyph] of numerals) {
        while (current >= amount) {
          roman += glyph;
          current -= amount;
        }
      }
      return style === 'i' ? roman.toLowerCase() : roman;
    }
    return String(value);
  }

  function serializeOrdinaryFragment(fragment) {
    let output = '';
    let pendingSpace = false;
    let pendingBlockBreak = 0;
    let displayBoundaryPending = false;
    const evidence = {
      artifacts: false,
      collapsibleWhitespace: false,
      hiddenOrAlternate: false,
      structure: false
    };

    const ensureNewlines = (count) => {
      pendingSpace = false;
      const existing = (output.match(/\n*$/) || [''])[0].length;
      if (existing < count) output += '\n'.repeat(count - existing);
    };
    const flushBlock = () => {
      if (pendingBlockBreak && output) ensureNewlines(pendingBlockBreak);
      pendingBlockBreak = 0;
    };
    const flushSpace = () => {
      if (!pendingSpace) return;
      flushBlock();
      if (output && !/[\s]$/u.test(output)) output += ' ';
      pendingSpace = false;
    };
    const appendNormal = (raw) => {
      const source = String(raw == null ? '' : raw);
      const cleaned = cleanOrdinaryCharacters(source);
      if (cleaned !== source) evidence.artifacts = true;
      const parts = cleaned.split(/([\t\n\f ]+)/);
      for (const part of parts) {
        if (!part) continue;
        if (/^[\t\n\f ]+$/.test(part)) {
          if (part !== ' ' || pendingSpace) evidence.collapsibleWhitespace = true;
          pendingSpace = true;
          continue;
        }
        flushSpace();
        flushBlock();
        output += part;
        displayBoundaryPending = false;
      }
    };
    const appendPreserved = (raw) => {
      const value = String(raw == null ? '' : raw);
      if (!value) return;
      flushSpace();
      flushBlock();
      output += value;
      displayBoundaryPending = false;
    };
    const appendGenerated = (value) => {
      pendingSpace = false;
      flushBlock();
      output += String(value == null ? '' : value);
      displayBoundaryPending = false;
    };
    const appendPreLine = (raw) => {
      const source = String(raw == null ? '' : raw);
      const cleaned = cleanOrdinaryCharacters(source);
      if (cleaned !== source) evidence.artifacts = true;
      const lines = cleaned.split('\n');
      lines.forEach((line, index) => {
        if (index) {
          pendingSpace = false;
          flushBlock();
          output += '\n';
          evidence.structure = true;
        }
        appendNormal(line);
      });
    };
    const appendSeparator = (separator) => {
      pendingSpace = false;
      pendingBlockBreak = 0;
      output += separator;
      evidence.structure = true;
    };
    const enterBlock = (separation) => {
      if (output) pendingBlockBreak = Math.max(pendingBlockBreak, displayBoundaryPending ? 1 : separation);
    };

    const visitChildren = (node, context) => {
      for (const child of Array.from(node.childNodes || [])) visit(child, context);
    };
    const visitList = (element, context, tag) => {
      evidence.structure = true;
      enterBlock(1);
      const items = Array.from(element.children || []).filter((item) =>
        (item.localName || '').toLowerCase() === 'li');
      const reversed = tag === 'ol' && element.hasAttribute('reversed');
      const hasStart = element.hasAttribute('start');
      let number = Number(hasStart ? element.getAttribute('start') : (reversed ? items.length : 1));
      if (!Number.isFinite(number)) number = 1;
      const numberType = element.getAttribute('type') || '1';
      let itemIndex = 0;
      for (const item of items) {
        if (itemIndex) appendSeparator('\n');
        const explicitValue = item.hasAttribute('value') ? Number(item.getAttribute('value')) : NaN;
        if (tag === 'ol' && Number.isFinite(explicitValue)) number = explicitValue;
        const prefix = '  '.repeat(context.listDepth || 0) +
          (tag === 'ol' ? ordinaryOrderedListMarker(number, numberType) + '. ' : '• ');
        appendGenerated(prefix);
        visitChildren(item, {
          ...context,
          listDepth: (context.listDepth || 0) + 1,
          inListItem: true,
          listParagraphs: 0
        });
        itemIndex += 1;
        number += reversed ? -1 : 1;
      }
      pendingBlockBreak = Math.max(pendingBlockBreak, 1);
    };
    const visitTable = (element, context) => {
      evidence.structure = true;
      enterBlock(1);
      const caption = Array.from(element.children || []).find((child) =>
        (child.localName || '').toLowerCase() === 'caption');
      if (caption) {
        visitChildren(caption, context);
        appendSeparator('\n');
      }
      let spanningColumns = [];
      ordinaryRows(element).forEach((row, rowIndex) => {
        if (rowIndex) appendSeparator('\n');
        const cells = Array.from(row.children || []).filter((cell) =>
          ['td', 'th'].includes((cell.localName || '').toLowerCase()));
        const newSpans = [];
        let column = 0;
        let lastWrittenColumn = -1;
        let furthestColumn = spanningColumns.reduce((furthest, remaining, index) =>
          remaining > 0 ? Math.max(furthest, index) : furthest, -1);
        cells.forEach((cell) => {
          const colspan = Math.max(1, Math.min(1000, Number(cell.getAttribute('colspan')) || 1));
          const rowspan = Math.max(1, Math.min(1000, Number(cell.getAttribute('rowspan')) || 1));
          while (true) {
            let available = true;
            for (let offset = 0; offset < colspan; offset += 1) {
              if ((spanningColumns[column + offset] || 0) > 0) {
                available = false;
                break;
              }
            }
            if (available) break;
            column += 1;
          }
          const tabsBefore = lastWrittenColumn < 0 ? column : column - lastWrittenColumn;
          if (tabsBefore > 0) appendSeparator('\t'.repeat(tabsBefore));
          visitChildren(cell, { ...context, inTableCell: true, tableBlocks: 0 });
          pendingSpace = false;
          pendingBlockBreak = 0;
          for (let offset = 0; offset < colspan; offset += 1) {
            if (rowspan > 1) newSpans[column + offset] = Math.max(newSpans[column + offset] || 0, rowspan - 1);
          }
          lastWrittenColumn = column;
          furthestColumn = Math.max(furthestColumn, column + colspan - 1);
          column += colspan;
        });
        const trailingTabs = lastWrittenColumn < 0 ? furthestColumn : furthestColumn - lastWrittenColumn;
        if (trailingTabs > 0) appendSeparator('\t'.repeat(trailingTabs));
        const nextSpans = [];
        const spanWidth = Math.max(spanningColumns.length, newSpans.length);
        for (let index = 0; index < spanWidth; index += 1) {
          nextSpans[index] = Math.max(Math.max(0, (spanningColumns[index] || 0) - 1), newSpans[index] || 0);
        }
        spanningColumns = nextSpans;
      });
      pendingBlockBreak = Math.max(pendingBlockBreak, 1);
    };
    const visit = (node, context) => {
      if (!node) return;
      if (node.nodeType === 3) {
        if (context.mode === 'preserve') appendPreserved(node.nodeValue || '');
        else if (context.mode === 'pre-line') appendPreLine(node.nodeValue || '');
        else appendNormal(node.nodeValue || '');
        return;
      }
      if (node.nodeType !== 1 && node.nodeType !== 11) return;
      if (node.nodeType === 11) {
        visitChildren(node, context);
        return;
      }
      const element = node;
      const tag = (element.localName || '').toLowerCase();
      const trustedPlaceholder = TRUSTED_TEXT_PLACEHOLDERS.get(element);
      if (trustedPlaceholder) {
        if (trustedPlaceholder.display) {
          enterBlock(1);
          pendingSpace = false;
          flushBlock();
          output += trustedPlaceholder.text || '';
          pendingBlockBreak = Math.max(pendingBlockBreak, 1);
          displayBoundaryPending = true;
        } else {
          flushSpace();
          flushBlock();
          output += trustedPlaceholder.text || '';
          displayBoundaryPending = false;
        }
        return;
      }
      if (ORDINARY_DROP_CONTENT_TAGS.has(tag) || SKIP_TAGS.has(tag) || isVisuallyHiddenElement(element)) {
        evidence.hiddenOrAlternate = true;
        return;
      }
      if (tag === 'img' || tag === 'area') {
        const alt = element.getAttribute('alt') || '';
        if (alt) appendNormal(alt);
        evidence.hiddenOrAlternate = true;
        return;
      }
      if (tag === 'wbr') return;
      if (tag === 'br') {
        pendingSpace = false;
        flushBlock();
        output += '\n';
        evidence.structure = true;
        return;
      }
      if (tag === 'hr') {
        pendingSpace = false;
        flushBlock();
        ensureNewlines(2);
        evidence.structure = true;
        return;
      }
      const mode = ordinaryWhitespaceMode(element, context.mode);
      const nextContext = { ...context, mode };
      if (tag === 'ul' || tag === 'ol') {
        visitList(element, nextContext, tag);
        return;
      }
      if (tag === 'table' || ['thead', 'tbody', 'tfoot', 'tr'].includes(tag)) {
        visitTable(element, nextContext);
        return;
      }
      if (tag === 'li') {
        visitChildren(element, nextContext);
        return;
      }

      const style = String(element.getAttribute('style') || '').toLowerCase();
      const block = BLOCK_TAGS.has(tag) || /display\s*:\s*(?:block|flex|grid|list-item|table)/.test(style);
      if (!block) {
        visitChildren(element, nextContext);
        return;
      }
      evidence.structure = true;
      let separation = tag === 'p' || /^h[1-6]$/.test(tag) ? 2 : 1;
      if (context.inListItem || context.inTableCell) separation = 1;
      enterBlock(separation);
      visitChildren(element, nextContext);
      pendingBlockBreak = Math.max(pendingBlockBreak, separation);
    };

    visit(fragment, { mode: 'normal', listDepth: 0, inListItem: false, inTableCell: false });
    // Collapsible trailing whitespace and structural breaks generated after the
    // final block are not part of the user's visible selection. Preserved code
    // text was appended directly and is therefore left untouched.
    pendingSpace = false;
    pendingBlockBreak = 0;
    return { text: output, evidence };
  }

  function safeOrdinaryRichHTML(fragments, documentObject) {
    const destination = documentObject.createDocumentFragment();
    const state = { lastCollapsibleSpace: false };

    const copySafeAttributes = (source, target) => {
      const dir = String(source.getAttribute('dir') || '').toLowerCase();
      if (['ltr', 'rtl', 'auto'].includes(dir)) target.setAttribute('dir', dir);
      const lang = String(source.getAttribute('lang') || '');
      if (/^[A-Za-z0-9-]{1,35}$/.test(lang)) target.setAttribute('lang', lang);
      for (const name of ['colspan', 'rowspan', 'start', 'value']) {
        const value = String(source.getAttribute(name) || '');
        if (/^-?\d{1,6}$/.test(value)) target.setAttribute(name, value);
      }
      if ((source.localName || '').toLowerCase() === 'ol' && source.hasAttribute('reversed')) {
        target.setAttribute('reversed', '');
      }
      const type = String(source.getAttribute('type') || '');
      if (/^(?:1|a|A|i|I)$/.test(type)) target.setAttribute('type', type);
    };
    const cleanNormalRichText = (raw) => {
      let value = cleanOrdinaryCharacters(raw).replace(/[\t\n\f ]+/g, ' ');
      if (state.lastCollapsibleSpace) value = value.replace(/^ /, '');
      state.lastCollapsibleSpace = / $/.test(value);
      return value;
    };
    const rebuild = (node, inheritedMode) => {
      if (!node) return null;
      if (node.nodeType === 3) {
        if (inheritedMode === 'preserve') return documentObject.createTextNode(node.nodeValue || '');
        let value;
        if (inheritedMode === 'pre-line') {
          value = cleanOrdinaryCharacters(node.nodeValue || '')
            .split('\n').map((line) => line.replace(/[\t\f ]+/g, ' ')).join('\n');
          state.lastCollapsibleSpace = / $/.test(value);
        } else value = cleanNormalRichText(node.nodeValue || '');
        return value ? documentObject.createTextNode(value) : null;
      }
      if (node.nodeType !== 1 && node.nodeType !== 11) return null;
      if (node.nodeType === 11) {
        const result = documentObject.createDocumentFragment();
        for (const child of Array.from(node.childNodes || [])) {
          const rebuilt = rebuild(child, inheritedMode);
          if (rebuilt) result.appendChild(rebuilt);
        }
        return result;
      }
      const tag = (node.localName || '').toLowerCase();
      if (ORDINARY_DROP_CONTENT_TAGS.has(tag) || SKIP_TAGS.has(tag) || isVisuallyHiddenElement(node)) return null;
      if (tag === 'img' || tag === 'area') {
        const rawAlt = cleanOrdinaryCharacters(node.getAttribute('alt') || '');
        if (!rawAlt) return null;
        let alt = rawAlt;
        if (inheritedMode === 'pre-line') {
          alt = rawAlt.split('\n').map((line) => line.replace(/[\t\f ]+/g, ' ')).join('\n');
          state.lastCollapsibleSpace = / $/.test(alt);
        } else if (inheritedMode !== 'preserve') alt = cleanNormalRichText(rawAlt);
        return alt ? documentObject.createTextNode(alt) : null;
      }
      const mode = ordinaryWhitespaceMode(node, inheritedMode);
      if (tag === 'br' || BLOCK_TAGS.has(tag) || ['li', 'table', 'tr', 'td', 'th', 'ul', 'ol'].includes(tag)) {
        state.lastCollapsibleSpace = false;
      }
      const container = ORDINARY_RICH_TAGS.has(tag)
        ? documentObject.createElement(tag)
        : documentObject.createDocumentFragment();
      if (container.nodeType === 1) {
        copySafeAttributes(node, container);
        // This style is generated from an enumerated whitespace mode, never
        // copied from page CSS. It keeps intentional preformatted selections
        // intact when an inline element supplied their whitespace semantics.
        if (!['pre', 'code'].includes(tag) && mode !== inheritedMode && mode !== 'normal') {
          container.setAttribute('style', 'white-space:' + (mode === 'preserve' ? 'pre-wrap' : 'pre-line') + ';');
        }
      }
      for (const child of Array.from(node.childNodes || [])) {
        const rebuilt = rebuild(child, mode);
        if (rebuilt) container.appendChild(rebuilt);
      }
      if (tag === 'br' || BLOCK_TAGS.has(tag) || ['li', 'table', 'tr', 'td', 'th', 'ul', 'ol'].includes(tag)) {
        state.lastCollapsibleSpace = false;
      }
      return container;
    };

    fragments.forEach((fragment, index) => {
      if (index) destination.appendChild(documentObject.createElement('br'));
      const rebuilt = rebuild(fragment, 'normal');
      if (rebuilt) destination.appendChild(rebuilt);
    });
    const wrapper = documentObject.createElement('div');
    wrapper.appendChild(destination);
    return '<!--StartFragment-->' + wrapper.innerHTML + '<!--EndFragment-->';
  }

  function ordinarySelectionPayload(documentObject, selection, pageWindow, target, capturedRanges) {
    if (!documentObject || !selection || selection.isCollapsed || isTextControl(target)) return null;
    const suppliedRanges = Array.isArray(capturedRanges) ? capturedRanges : null;
    const rangeCount = suppliedRanges ? suppliedRanges.length : boundedSelectionRangeCount(selection);
    if (rangeCount <= 0 || rangeCount > MAX_SELECTION_RANGES) return null;
    if (isMicrosoftOfficeWebPage(documentObject, pageWindow) ||
        isContentEditableSelection(documentObject, target, selection) ||
        isRawLatexProtected(target, selection, false)) return null;
    const ranges = suppliedRanges || selectionRanges(documentObject, selection, rangeCount);
    if (!ranges.length) return null;
    const nativeText = ranges.map((range) => range.toString()).join('\n');
    if (!nativeText) return null;

    const values = [];
    for (const range of ranges) {
      const fragment = cloneOrdinaryRangeWithContext(range, documentObject);
      if (!fragment) {
        // A null clone means the selection was over budget, its computed
        // layout contained semantics our bounded serializer cannot model, or
        // cloning failed. Range#toString can include CSS-hidden text, so even
        // character-only cleanup would risk copying content the user never
        // saw. Leave the clipboard completely native in every such case.
        return null;
      }
      const serialized = serializeOrdinaryFragment(fragment);
      values.push({ fragment, ...serialized });
    }
    let repairedRendererLayout = false;
    for (const value of values) {
      const repaired = repairFlattenedRendererText(value.text);
      if (repaired !== value.text) {
        value.text = repaired;
        repairedRendererLayout = true;
      }
    }
    const text = values.map((value) => value.text).join('\n');
    if (!text.trim() || text === nativeText) return null;
    const confidentlyBetter = values.some((value) =>
      value.evidence.artifacts || value.evidence.collapsibleWhitespace ||
      value.evidence.hiddenOrAlternate || value.evidence.structure) || repairedRendererLayout;
    if (!confidentlyBetter) return null;
    const onlyInvisibleArtifacts = hasCleanableArtifacts(nativeText) && cleanOrdinaryCharacters(nativeText) === text;
    let html;
    if (repairedRendererLayout) {
      const fragment = documentObject.createDocumentFragment();
      text.split('\n').forEach((line, index) => {
        if (index) fragment.appendChild(documentObject.createElement('br'));
        if (line) fragment.appendChild(documentObject.createTextNode(line));
      });
      html = sanitizeRichFragment(fragment);
    } else html = safeOrdinaryRichHTML(values.map((value) => value.fragment), documentObject);
    return {
      text,
      html,
      mathML: '',
      reason: repairedRendererLayout
        ? 'flattened-renderer-math'
        : (onlyInvisibleArtifacts ? 'invisible-artifacts' : 'ordinary-text-cleanup'),
      mathRanges: 0
    };
  }

  function positionedStyleNumber(element, property) {
    if (!element) return NaN;
    const rect = element.getBoundingClientRect && element.getBoundingClientRect();
    if (rect) {
      if (property === 'left' && Number.isFinite(rect.left) && rect.left !== 0) return rect.left;
      if (property === 'top' && Number.isFinite(rect.top) && rect.top !== 0) return rect.top;
      if (property === 'width' && Number.isFinite(rect.width) && rect.width !== 0) return rect.width;
    }
    const style = element.getAttribute && element.getAttribute('style') || '';
    const declaration = style.match(new RegExp(property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*([^;]+)', 'i'));
    if (!declaration) return NaN;
    const values = Array.from(declaration[1].matchAll(/(-?\d+(?:\.\d+)?)px/gi));
    return values.length ? Number(values[values.length - 1][1]) : NaN;
  }

  function selectedTokenText(range, element, documentObject) {
    if (!rangeIntersects(range, element)) return '';
    const value = element.textContent || '';
    if (!value) return '';
    let start = 0;
    let end = value.length;
    try {
      if (nodeInside(element, range.startContainer)) {
        const prefix = documentObject.createRange();
        prefix.selectNodeContents(element);
        prefix.setEnd(range.startContainer, range.startOffset);
        start = prefix.toString().length;
      }
      if (nodeInside(element, range.endContainer)) {
        const prefix = documentObject.createRange();
        prefix.selectNodeContents(element);
        prefix.setEnd(range.endContainer, range.endOffset);
        end = prefix.toString().length;
      }
    } catch (_error) {
      return value;
    }
    return value.slice(Math.max(0, start), Math.max(start, end));
  }

  function normalizeOfficeGlyphs(input) {
    let value = cleanClipboardText(String(input == null ? '' : input));
    try {
      value = Array.from(value, (character) =>
        OFFICE_SEMANTIC_LETTERLIKE.has(character) ? character : character.normalize('NFKC')
      ).join('');
    } catch (_error) {
      // Use the original characters on engines without compatibility normalization.
    }
    return value;
  }

  function officeScriptText(value, kind, outputMode) {
    const normalized = normalizeOfficeGlyphs(value).trim();
    if (outputMode === 'calculator') return kind === 'sub' ? '_(' + normalized + ')' : '^(' + normalized + ')';
    if (outputMode === 'latex') return kind === 'sub' ? '_{' + normalized + '}' : '^{' + normalized + '}';
    if (outputMode === 'ascii') return kind === 'sub' ? '_' + normalized : '^' + normalized;
    if (outputMode === 'faithful') {
      return toFaithfulScript(normalized, kind === 'sub' ? SUBSCRIPTS : SUPERSCRIPTS, kind === 'sub' ? '_' : '^');
    }
    return toScript(normalized, kind === 'sub' ? SUBSCRIPTS : SUPERSCRIPTS, kind === 'sub' ? '_' : '^');
  }

  function positionedTokenElementsForRange(range, documentObject) {
    const container = range && range.commonAncestorContainer && range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range && range.commonAncestorContainer && range.commonAncestorContainer.parentElement;
    if (!container || !container.matches) return [];
    const contextSelector = '.react-pdf__Page, .react-pdf__Page__textContent.textLayer, .textLayer';
    const inPositionedContext = container.matches(contextSelector) ||
      Boolean(container.closest && container.closest(contextSelector)) ||
      Boolean(container.querySelector && container.querySelector(contextSelector));
    if (!inPositionedContext) return [];

    const tokenSelector =
      '.react-pdf__Page__textContent.textLayer .markedContent span[role="presentation"] > span[tabindex], ' +
      '.textLayer .markedContent span[role="presentation"] > span[tabindex]';
    const candidates = [];
    const collect = (element) => {
      if (!element || !element.matches || !element.matches(tokenSelector)) return true;
      candidates.push(element);
      return candidates.length <= MAX_POSITIONED_TOKEN_CANDIDATES;
    };

    // querySelectorAll must traverse an entire page before its length can be
    // inspected. A bounded TreeWalker can abandon a hostile or accidental
    // text layer as soon as either the node or token ceiling is reached.
    if (documentObject && typeof documentObject.createTreeWalker === 'function') {
      const walker = documentObject.createTreeWalker(container, 1);
      let inspected = 1;
      if (!collect(container)) return POSITIONED_OVER_BUDGET;
      for (let element = walker.nextNode(); element; element = walker.nextNode()) {
        inspected += 1;
        if (inspected > MAX_POSITIONED_DISCOVERY_NODES || !collect(element)) return POSITIONED_OVER_BUDGET;
      }
      return candidates;
    }

    const fallback = Array.from(container.querySelectorAll ? container.querySelectorAll(tokenSelector) : []);
    return fallback.length <= MAX_POSITIONED_TOKEN_CANDIDATES ? fallback : POSITIONED_OVER_BUDGET;
  }

  function serializePositionedOfficeRange(range, settings, documentObject) {
    const tokenElements = positionedTokenElementsForRange(range, documentObject);
    if (tokenElements === POSITIONED_OVER_BUDGET) return POSITIONED_OVER_BUDGET;
    if (!tokenElements || tokenElements.length < 2) return null;
    const items = [];
    for (let order = 0; order < tokenElements.length; order += 1) {
      const element = tokenElements[order];
      const selected = selectedTokenText(range, element, documentObject);
      if (!selected) continue;
      const positioned = element.parentElement;
      const size = positionedStyleNumber(positioned, 'font-size');
      const left = positionedStyleNumber(positioned, 'left');
      const top = positionedStyleNumber(positioned, 'top');
      if (![size, left, top].every(Number.isFinite)) continue;
      const width = positionedStyleNumber(positioned, 'width');
      items.push({
        element,
        marked: element.closest('.markedContent'),
        text: selected,
        normalized: normalizeOfficeGlyphs(selected),
        size,
        left,
        top,
        width: Number.isFinite(width) ? width : Math.max(size * 0.42, Array.from(selected).length * size * 0.52),
        order,
        script: null,
        attachedTo: null
      });
      if (items.length > MAX_POSITIONED_SELECTED_TOKENS) return POSITIONED_OVER_BUDGET;
    }
    if (items.length < 2) return null;

    const styledMath = items.some((item) => hasMathematicalStyledCharacter(item.text));
    const mathSignal = styledMath || items.some((item) => /[=≠≈≤≥∝×÷Ωμ]/u.test(item.text));
    if (!mathSignal) return null;

    let scriptCount = 0;
    const recentByMarkedContent = new Map();
    const scriptsByBase = new Map();
    for (const item of items) {
      const recent = recentByMarkedContent.get(item.marked) || [];
      for (let index = recent.length - 1; index >= 0; index -= 1) {
        const base = recent[index];
        const ratio = item.size / base.size;
        if (ratio > 0.82 || ratio < 0.55) continue;
        const gap = item.left - (base.left + base.width);
        const delta = (item.top - base.top) / base.size;
        if (gap < -0.25 * base.size || gap > 0.65 * base.size) continue;
        if (delta >= 0.18) item.script = 'sub';
        else if (delta <= -0.08) item.script = 'sup';
        else continue;
        item.attachedTo = base;
        const scripts = scriptsByBase.get(base) || [];
        scripts.push(item);
        scriptsByBase.set(base, scripts);
        scriptCount += 1;
        break;
      }
      recent.push(item);
      if (recent.length > MAX_POSITIONED_BASE_LOOKBACK) recent.shift();
      recentByMarkedContent.set(item.marked, recent);
    }
    if (!scriptCount) return null;

    const baseItems = items.filter((item) => !item.attachedTo);
    let plain = '';
    let previous = null;
    const rich = documentObject.createDocumentFragment();
    const richWrapper = documentObject.createElement('span');
    rich.appendChild(richWrapper);
    const appendSpacing = (item, value) => {
      if (!plain || /^\s/u.test(value) || /\s$/u.test(plain) || /^[,.;:!?\)\]\}]/u.test(value)) return '';
      if (/[([{]$/u.test(plain) || /^[([{]/u.test(value)) return '';
      if (/[,;:]$/u.test(plain) || /^[=\u2260\u2248\u2264\u2265\u221d]/u.test(value) || /[=\u2260\u2248\u2264\u2265\u221d]$/u.test(plain)) return ' ';
      if (!previous) return '';
      const visualGap = item.left - (previous.left + previous.width);
      return visualGap > Math.max(1.2, previous.size * 0.18) ? ' ' : '';
    };
    for (const item of baseItems) {
      const value = item.normalized;
      const richValue = hasMathematicalStyledCharacter(item.text) ? cleanClipboardText(item.text) : value;
      if (previous && item.marked !== previous.marked) {
        plain += '\n';
        richWrapper.appendChild(documentObject.createElement('br'));
      }
      const spacing = appendSpacing(item, value);
      if (spacing) { plain += spacing; richWrapper.appendChild(documentObject.createTextNode(spacing)); }
      plain += value;
      richWrapper.appendChild(documentObject.createTextNode(richValue));
      const scripts = scriptsByBase.get(item) || [];
      for (const script of scripts) {
        plain += officeScriptText(script.normalized, script.script, settings.outputMode);
        const scriptNode = documentObject.createElement(script.script === 'sub' ? 'sub' : 'sup');
        scriptNode.textContent = script.normalized.trim();
        richWrapper.appendChild(scriptNode);
      }
      previous = item;
    }
    plain = finalizeRewrittenText(plain)
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\s*([=\u2260\u2248\u2264\u2265\u221d])\s*/g, ' $1 ')
      .replace(/[ ]{2,}/g, ' ');
    if (settings.outputMode === 'calculator') {
      plain = Array.from(plain, (character) => ASCII_SYMBOLS[character] || character).join('')
        .replace(/\s*([-+=*/^<>])\s*/g, '$1')
        .replace(/([0-9)])\s*(?=[A-Za-z])/g, '$1*')
        .replace(/[ ]{2,}/g, ' ')
        .trim();
    }
    if (!plain.trim()) return null;
    return { text: plain, html: sanitizeRichFragment(rich), mathML: '' };
  }

  function positionedOfficePayload(ranges, settings, documentObject, reportOverBudget) {
    const payloads = ranges.map((range) => serializePositionedOfficeRange(range, settings, documentObject));
    if (payloads.includes(POSITIONED_OVER_BUDGET)) return reportOverBudget ? POSITIONED_OVER_BUDGET : null;
    if (!payloads.some(Boolean)) return null;
    if (payloads.some((payload) => !payload)) return null;
    const text = finalizeRewrittenText(payloads.map((payload) => payload.text).join('\n'));
    if (!text.trim()) return null;
    return {
      text,
      html: payloads.map((payload) => payload.html).join('<br>'),
      mathML: '',
      reason: 'office-positioned-math',
      mathRanges: payloads.length
    };
  }

  function isTextControl(target) {
    if (!target || target.nodeType !== 1) return false;
    const tag = (target.localName || '').toLowerCase();
    return tag === 'textarea' || (tag === 'input' && !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'color', 'range'].includes((target.type || 'text').toLowerCase()));
  }

  function selectedNativeClipboardText(selection, target) {
    if (isTextControl(target)) {
      const type = String(target.type || '').toLowerCase();
      // Browsers intentionally protect password values from ordinary copy;
      // an async replay must not weaken that boundary.
      if (type === 'password') return '';
      const start = Number(target.selectionStart);
      const end = Number(target.selectionEnd);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        return String(target.value || '').slice(start, end);
      }
      return '';
    }
    try {
      return selection ? String(selection.toString()) : '';
    } catch (_error) {
      return '';
    }
  }

  function isContentEditableSelection(documentObject, target, selection) {
    if (documentObject && String(documentObject.designMode || '').toLowerCase() === 'on') return true;
    const endpoints = [target, selection && selection.anchorNode, selection && selection.focusNode];
    for (const endpoint of endpoints) {
      const element = endpoint && endpoint.nodeType === 1 ? endpoint : endpoint && endpoint.parentElement;
      if (!element) continue;
      if (element.isContentEditable === true) return true;
      const declared = element.closest && element.closest('[contenteditable]');
      if (!declared) continue;
      const value = String(declared.getAttribute('contenteditable') || '').toLowerCase();
      if (value !== 'false') return true;
    }
    return false;
  }

  function isRawLatexProtected(target, selection, inspectSelectedRanges, capturedRanges) {
    const selector = 'pre, code, textarea, input, [data-clean-math-copy-preserve]';
    for (const endpoint of [target, selection && selection.anchorNode, selection && selection.focusNode]) {
      const element = endpoint && endpoint.nodeType === 1 ? endpoint : endpoint && endpoint.parentElement;
      if (element && element.closest && element.closest(selector)) return true;
    }
    if (inspectSelectedRanges === false) return false;
    let ranges = Array.isArray(capturedRanges) ? capturedRanges : null;
    if (!ranges) {
      const rangeCount = boundedSelectionRangeCount(selection);
      if (rangeCount < 0) return true;
      if (!rangeCount) return false;
      ranges = [];
      try {
        for (let index = 0; index < rangeCount; index += 1) ranges.push(selection.getRangeAt(index));
      } catch (_error) {
        return true;
      }
    }
    for (const range of ranges) {
      const common = range.commonAncestorContainer && range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer && range.commonAncestorContainer.parentElement;
      if (!common || !common.querySelectorAll) continue;
      try {
        if (common.matches && common.matches(selector) && rangeIntersects(range, common)) return true;
        for (const protectedNode of common.querySelectorAll(selector)) {
          if (rangeIntersects(range, protectedNode)) return true;
        }
      } catch (_error) {
        return true;
      }
    }
    return false;
  }

  function getCopyPayload(documentObject, selection, settingsInput, pageWindow, target) {
    const settings = normalizeSettings(settingsInput);
    if (!selection || selection.isCollapsed || isTextControl(target)) return null;
    const rangeCount = boundedSelectionRangeCount(selection);
    if (rangeCount <= 0) return null;
    const ranges = selectionRanges(documentObject, selection, rangeCount);
    if (!ranges.length) return null;
    const positioned = positionedOfficePayload(ranges, settings, documentObject, true);
    if (positioned === POSITIONED_OVER_BUDGET) return null;
    if (positioned) return positioned;
    // An adversarial or document-wide selection with hundreds of independent
    // formulas is safer left to the browser than synchronously rewriting it.
    const rootDiscoveries = [];
    let totalMathRoots = 0;
    for (const range of ranges) {
      const discovery = mathRootDiscoveryForRange(range);
      if (discovery.overBudget) return null;
      totalMathRoots += discovery.roots.length;
      if (totalMathRoots > MAX_MATH_ROOTS_PER_SELECTION) return null;
      rootDiscoveries.push(discovery);
    }
    const hasRenderedMath = rootDiscoveries.some((discovery) => discovery.roots.length);
    if (hasRenderedMath) {
      const rewritten = [];
      const rich = [];
      const mathMLPayloads = [];
      let mathRanges = 0;
      for (let index = 0; index < ranges.length; index += 1) {
        const range = ranges[index];
        const discovery = rootDiscoveries[index];
        const serialized = discovery.roots.length
          ? serializeRangePayloadWithMath(range, settings, pageWindow, discovery)
          : safeCompanionRangePayload(range);
        // A failed math rewrite, over-budget companion, or computed layout we
        // cannot faithfully model must make the entire multi-range operation
        // native. Raw Range#toString can include CSS-hidden text.
        if (!serialized) return null;
        rewritten.push(serialized.text);
        rich.push(serialized.html);
        if (serialized.mathML) mathMLPayloads.push(serialized.mathML);
        mathRanges += serialized.mathRanges || (discovery.roots.length ? 1 : 0);
      }
      const finalized = finalizeRewrittenText(rewritten.join('\n'));
      if (!finalized.trim() || !mathRanges) return null;
      return {
        text: finalized,
        html: '<!--StartFragment-->' + rich.map(clipboardHTMLBody).join('<br>') + '<!--EndFragment-->',
        mathML: ranges.length === 1 && mathMLPayloads.length === 1 ? mathMLPayloads[0] : '',
        reason: 'rendered-math',
        mathRanges
      };
    }

    const nativeText = ranges.map((range) => range.toString()).join('\n');
    const rawLatexProtected = isRawLatexProtected(target, selection, true, ranges);
    if (settings.convertDelimitedLatex && !rawLatexProtected) {
      const converted = convertDelimitedLatexText(nativeText, settings.outputMode);
      const finalized = finalizeRewrittenText(converted.text);
      if (converted.converted > 0 && finalized.trim()) return { text: finalized, reason: 'delimited-latex', mathRanges: 0 };
    }
    const shouldDeferStandaloneMath = isMicrosoftOfficeWebPage(documentObject, pageWindow) ||
      isContentEditableSelection(documentObject, target, selection);
    if (!shouldDeferStandaloneMath && !rawLatexProtected) {
      const unicodeMath = standaloneUnicodeMathPayload(nativeText, ranges, settings, documentObject);
      if (unicodeMath) return unicodeMath;
    }
    if (settings.cleanInvisibleArtifacts) {
      const ordinary = ordinarySelectionPayload(documentObject, selection, pageWindow, target, ranges);
      if (ordinary) return ordinary;
    }
    return null;
  }

  function loadSettings() {
    try {
      if (typeof GM_getValue === 'function') {
        const stored = GM_getValue(STORAGE_KEY, DEFAULT_SETTINGS);
        if (stored && typeof stored.then === 'function') return normalizeSettings(DEFAULT_SETTINGS);
        return normalizeSettings(stored);
      }
    } catch (_error) {
      // Use localStorage or defaults below.
    }
    try {
      const stored = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      return normalizeSettings(stored ? JSON.parse(stored) : DEFAULT_SETTINGS);
    } catch (_error) {
      return normalizeSettings(DEFAULT_SETTINGS);
    }
  }

  function saveSettings(settings) {
    const normalized = normalizeSettings(settings);
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(STORAGE_KEY, normalized);
        return normalized;
      }
    } catch (_error) {
      // Use localStorage if the manager API is unavailable.
    }
    try {
      if (global.GM && typeof global.GM.setValue === 'function') {
        Promise.resolve(global.GM.setValue(STORAGE_KEY, normalized)).catch(() => {});
        return normalized;
      }
    } catch (_error) {
      // Use localStorage below.
    }
    try {
      if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (_error) {
      // Some privacy modes prohibit storage. The in-memory setting still applies.
    }
    return normalized;
  }

  function setClipboardFromMenu(text) {
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text, 'text');
        return Promise.resolve(true);
      }
    } catch (_error) {
      // Fall through to the standard async clipboard API.
    }
    try {
      if (global.GM && typeof global.GM.setClipboard === 'function') {
        return Promise.resolve(global.GM.setClipboard(text, 'text')).then(() => true, () => false);
      }
    } catch (_error) {
      // Fall through to the standard async clipboard API.
    }
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      return global.navigator.clipboard.writeText(text).then(() => true, () => false);
    }
    return Promise.resolve(false);
  }

  let clipboardWriteTail = Promise.resolve();
  let pendingClipboardWrites = 0;

  function enqueueClipboardWrite(operation) {
    pendingClipboardWrites += 1;
    const previous = clipboardWriteTail;
    const result = previous.then(operation, operation);
    clipboardWriteTail = result.then(
      () => { pendingClipboardWrites -= 1; },
      () => { pendingClipboardWrites -= 1; }
    );
    return result.then((value) => value, () => false);
  }

  function hasPendingClipboardWrite() {
    return pendingClipboardWrites > 0;
  }

  function writeClipboardPayloadNow(payload, pageWindow, isCurrent) {
    if (!payload || !payload.text || !payload.text.trim() || !isCurrent()) return Promise.resolve(false);
    const writePlainFallback = () => isCurrent()
      ? setClipboardFromMenu(payload.text).then((written) => Boolean(written && isCurrent()))
      : Promise.resolve(false);
    try {
      const ClipboardItemConstructor = pageWindow && pageWindow.ClipboardItem;
      const BlobConstructor = pageWindow && pageWindow.Blob;
      const clipboard = pageWindow && pageWindow.navigator && pageWindow.navigator.clipboard;
      if (ClipboardItemConstructor && BlobConstructor && clipboard && typeof clipboard.write === 'function') {
        const baseRepresentations = {
          'text/plain': new BlobConstructor([payload.text], { type: 'text/plain' })
        };
        if (payload.html) baseRepresentations['text/html'] = new BlobConstructor([payload.html], { type: 'text/html' });
        const representations = { ...baseRepresentations };
        if (payload.mathML) representations['application/mathml+xml'] = new BlobConstructor([payload.mathML], { type: 'application/mathml+xml' });
        const write = (formats) => Promise.resolve().then(() => {
          if (!isCurrent()) return false;
          return Promise.resolve(clipboard.write([new ClipboardItemConstructor(formats)])).then(() => Boolean(isCurrent()));
        });
        return write(representations).then(
          (written) => written,
          () => {
            if (!isCurrent()) return false;
            return payload.mathML
              ? write(baseRepresentations).then(
                (written) => written,
                () => writePlainFallback()
              )
              : writePlainFallback();
          }
        );
      }
    } catch (_error) {
      // Fall through to the userscript/plain-text clipboard helper.
    }
    return writePlainFallback();
  }

  function enqueueClipboardPayload(resolvePayload, pageWindow, isCurrentInput) {
    const isCurrent = typeof isCurrentInput === 'function' ? isCurrentInput : () => true;
    return enqueueClipboardWrite(() => {
      if (!isCurrent()) return false;
      let payload;
      try {
        payload = typeof resolvePayload === 'function' ? resolvePayload() : resolvePayload;
      } catch (_error) {
        return false;
      }
      return writeClipboardPayloadNow(payload, pageWindow, isCurrent);
    });
  }

  function writeClipboardPayload(payload, pageWindow, isCurrentInput) {
    if (!payload || !payload.text || !payload.text.trim()) return Promise.resolve(false);
    return enqueueClipboardPayload(payload, pageWindow, isCurrentInput);
  }

  function payloadFromOfficeStagingElement(element, settings, documentObject) {
    if (!element) return null;
    const markup = element.innerHTML || '';
    const semantic = officeSemanticPayloadFromMarkup(markup, settings, documentObject, false);
    if (semantic) return semantic;
    const raw = element.innerText || element.textContent || '';
    const text = cleanOfficeClipboardText(raw);
    if (!text.trim()) return null;
    return { text, html: '', mathML: '', reason: 'office-staging-text', mathRanges: 0 };
  }

  function armOfficeClipboardStagingRecovery(documentObject, settings, pageWindow, state) {
    const MutationObserverConstructor = pageWindow && pageWindow.MutationObserver;
    if (!MutationObserverConstructor || !documentObject || !documentObject.documentElement) return null;
    let stagingObserver = null;
    let discoveryObserver = null;
    let stopped = false;
    let timeoutId = null;
    const stop = () => {
      stopped = true;
      if (stagingObserver) stagingObserver.disconnect();
      if (discoveryObserver) discoveryObserver.disconnect();
      if (timeoutId != null && pageWindow && typeof pageWindow.clearTimeout === 'function') {
        pageWindow.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    const inspect = (element) => {
      if (stopped || state.primaryHandled || state.semanticHandled || (state.isCurrent && !state.isCurrent())) return;
      const payload = payloadFromOfficeStagingElement(element, settings, documentObject);
      if (!payload || !payload.text.trim()) return;
      if (!payload.mathRanges && state.nativeTextSeen) return;
      state.semanticHandled = payload.mathRanges > 0;
      state.semanticPayload = payload.mathRanges > 0 ? payload : state.semanticPayload;
      writeClipboardPayload(payload, pageWindow, state.isCurrent).finally(stop);
    };
    const observeStaging = (element, inspectImmediately) => {
      if (!element || stagingObserver || stopped) return;
      stagingObserver = new MutationObserverConstructor(() => inspect(element));
      stagingObserver.observe(element, { childList: true, subtree: true, characterData: true });
      if (inspectImmediately) inspect(element);
    };
    observeStaging(documentObject.querySelector('#WACViewPanel_ClipboardElement'), false);
    if (!stagingObserver) {
      discoveryObserver = new MutationObserverConstructor(() => {
        const element = documentObject.querySelector('#WACViewPanel_ClipboardElement');
        if (element) {
          observeStaging(element, true);
          if (discoveryObserver) discoveryObserver.disconnect();
        }
      });
      discoveryObserver.observe(documentObject.documentElement, { childList: true, subtree: true });
    }
    const timer = pageWindow && typeof pageWindow.setTimeout === 'function' ? pageWindow.setTimeout.bind(pageWindow) : setTimeout;
    timeoutId = timer(stop, 1500);
    return { stop };
  }

  function applyOfficePayloadDirect(clipboardData, state, payload) {
    if (!clipboardData || !state || !state.originalSetData || !payload || !payload.text || !payload.text.trim()) return false;
    const write = (type, value) => {
      try {
        state.originalSetData.call(clipboardData, type, value);
        return true;
      } catch (_error) {
        return false;
      }
    };
    const mathTypes = ['application/mathml+xml', 'MathML', 'MathML Presentation'];
    if (!payload.mathML && state.lastSemanticMathML) {
      for (const type of mathTypes) {
        let cleared = false;
        if (state.originalClearData) {
          try {
            state.originalClearData.call(clipboardData, type);
            cleared = true;
          } catch (_error) {
            // Fall back to an empty flavor only on nonstandard clipboard shims.
          }
        }
        if (!cleared) write(type, '');
      }
      state.lastSemanticMathML = false;
    }
    write('text/plain', payload.text);
    if (payload.html) {
      write('text/html', payload.html);
      // Windows/Office exposes CF_HTML as "HTML Format" and some consumers
      // prefer it over text/html. Never leave a page-authored unsafe flavor
      // beside the sanitized representation.
      write('HTML Format', clipboardHTMLFormat(payload.html));
    }
    if (payload.mathML) {
      for (const type of mathTypes) write(type, payload.mathML);
      state.lastSemanticMathML = true;
    }
    return true;
  }

  function interceptOfficeClipboardWrites(event, state, settings, documentObject) {
    const clipboardData = event && event.clipboardData;
    if (!clipboardData || typeof clipboardData.setData !== 'function' || state.wrapped) return false;
    const original = clipboardData.setData;
    state.originalSetData = original;
    const wrapped = function cleanOfficeSetData(type, value) {
      const normalizedType = String(type).toLowerCase();
      let writtenValue = value;
      if (/^(?:text\/plain|text|unicode)$/i.test(normalizedType)) {
        const cleaned = cleanOfficeClipboardText(value);
        if (cleaned.trim()) {
          state.nativeTextSeen = true;
          state.nativePlain = cleaned;
          writtenValue = cleaned;
        }
      }
      const result = original.call(this, type, writtenValue);
      let semantic = null;
      if (['application/mathml+xml', 'mathml', 'mathml presentation'].includes(normalizedType)) {
        state.lastSemanticMathML = true;
        semantic = officeSemanticPayloadFromMarkup(value, settings, documentObject, true);
      } else if (normalizedType === 'text/html' || normalizedType === 'html format') {
        semantic = officeSemanticPayloadFromMarkup(value, settings, documentObject, false);
      }
      const priority = semantic ? (semantic.semanticScope === 'mixed' ? 30 : 20) : 0;
      if (semantic && semantic.text.trim() && priority >= state.semanticPriority) {
        state.semanticPayload = semantic;
        state.semanticPriority = priority;
        state.semanticHandled = true;
        applyOfficePayloadDirect(clipboardData, state, semantic);
        if (state.recovery) state.recovery.stop();
        event.preventDefault();
      } else if (state.semanticPayload) {
        applyOfficePayloadDirect(clipboardData, state, state.semanticPayload);
      }
      return result;
    };
    let installed = false;
    try {
      Object.defineProperty(clipboardData, 'setData', { value: wrapped, configurable: true, writable: true });
      installed = true;
    } catch (_error) {
      try {
        clipboardData.setData = wrapped;
        installed = clipboardData.setData === wrapped;
      } catch (_assignmentError) {
        installed = false;
      }
    }
    if (!installed) return false;
    state.wrapped = true;
    if (typeof clipboardData.clearData === 'function') {
      const originalClearData = clipboardData.clearData;
      state.originalClearData = originalClearData;
      const wrappedClearData = function cleanOfficeClearData(...args) {
        const result = originalClearData.apply(this, args);
        if (state.semanticPayload) applyOfficePayloadDirect(clipboardData, state, state.semanticPayload);
        return result;
      };
      try {
        Object.defineProperty(clipboardData, 'clearData', { value: wrappedClearData, configurable: true, writable: true });
      } catch (_error) {
        try { clipboardData.clearData = wrappedClearData; } catch (_assignmentError) { /* bubble recovery remains */ }
      }
    }
    return true;
  }

  function postprocessOfficeCopyEvent(event, settings, documentObject, state) {
    if (!event || !event.clipboardData || state.primaryHandled) return;
    const semantic = officeSemanticPayloadFromClipboard(event.clipboardData, settings, documentObject);
    if (semantic && semantic.text.trim()) {
      try {
        state.semanticPayload = semantic;
        state.semanticHandled = true;
        state.semanticPriority = semantic.semanticScope === 'mixed' ? 30 : 20;
        if (!applyOfficePayloadDirect(event.clipboardData, state, semantic)) {
          event.clipboardData.setData('text/plain', semantic.text);
          if (semantic.html) {
            event.clipboardData.setData('text/html', semantic.html);
            event.clipboardData.setData('HTML Format', clipboardHTMLFormat(semantic.html));
          }
        }
        if (state.recovery) state.recovery.stop();
        event.preventDefault();
      } catch (_error) {
        // Staging recovery remains armed.
      }
      return;
    }
    const available = clipboardTypes(event.clipboardData);
    const plainType = available.find((type) => /^(?:text\/plain|text|unicode)$/i.test(type)) || 'text/plain';
    const raw = clipboardGet(event.clipboardData, plainType);
    const cleaned = cleanOfficeClipboardText(raw);
    if (!cleaned.trim() || cleaned === raw) return;
    try {
      event.clipboardData.setData(plainType, cleaned);
      state.nativeTextSeen = true;
      state.nativePlain = cleaned;
      event.preventDefault();
    } catch (_error) {
      // Staging recovery remains armed.
    }
  }

  function siteSemanticClipboardType(normalizedType, googleDocs) {
    return (googleDocs && normalizedType === GOOGLE_DOCS_SLICE_TYPE) ||
      ['application/mathml+xml', 'mathml', 'mathml presentation', 'text/html', 'html format'].includes(normalizedType);
  }

  function createSiteCopyState() {
    return {
      wrapped: false,
      rewritten: false,
      nativePlainSeen: false,
      nativePlainRaw: '',
      nativePlain: '',
      repairedRendererPlain: '',
      plainType: 'text/plain',
      nativePlainValues: new Map(),
      injectedPlainTypes: new Map(),
      nativeRichValues: new Map(),
      injectedRichTypes: new Map(),
      semanticCandidates: new Map(),
      semanticPayload: null,
      semanticPriority: 0,
      semanticAgreement: '',
      semanticSourceType: '',
      semanticParseAttempts: 0,
      semanticParseCharacters: 0,
      originalSetData: null,
      originalClearData: null
    };
  }

  function recordSiteNativePlain(state, type, value) {
    const actualType = String(type || 'text/plain');
    const normalizedType = actualType.toLowerCase();
    const raw = String(value == null ? '' : value);
    state.nativePlainValues.delete(normalizedType);
    state.nativePlainValues.set(normalizedType, { type: actualType, value: raw });
    state.nativePlainSeen = true;
    state.nativePlainRaw = raw;
    state.nativePlain = cleanClipboardText(raw);
    const repaired = repairFlattenedRendererText(state.nativePlain);
    state.repairedRendererPlain = repaired !== state.nativePlain ? finalizeRewrittenText(repaired) : '';
    state.plainType = actualType;
  }

  function forgetSiteNativePlain(state, type) {
    const normalizedType = String(type || 'text/plain').toLowerCase();
    state.nativePlainValues.delete(normalizedType);
    const remaining = Array.from(state.nativePlainValues.values());
    const latest = remaining.length ? remaining[remaining.length - 1] : null;
    state.nativePlainSeen = Boolean(latest);
    state.nativePlainRaw = latest ? latest.value : '';
    state.nativePlain = latest ? cleanClipboardText(latest.value) : '';
    const repaired = repairFlattenedRendererText(state.nativePlain);
    state.repairedRendererPlain = repaired !== state.nativePlain ? finalizeRewrittenText(repaired) : '';
    state.plainType = latest ? latest.type : 'text/plain';
  }

  function markSiteInjectedPlain(state, type) {
    const actualType = String(type || 'text/plain');
    state.injectedPlainTypes.set(actualType.toLowerCase(), actualType);
    state.rewritten = true;
  }

  function siteRichHTMLType(type) {
    const normalized = String(type || '').toLowerCase();
    return normalized === 'text/html' || normalized === 'html format';
  }

  function recordSiteNativeRich(state, type, value) {
    const actualType = String(type || 'text/html');
    const normalizedType = actualType.toLowerCase();
    state.nativeRichValues.delete(normalizedType);
    state.nativeRichValues.set(normalizedType, {
      type: actualType,
      value: String(value == null ? '' : value)
    });
    state.injectedRichTypes.delete(normalizedType);
    state.rewritten = state.injectedPlainTypes.size > 0 || state.injectedRichTypes.size > 0;
  }

  function forgetSiteNativeRich(state, type) {
    const normalizedType = String(type || 'text/html').toLowerCase();
    state.nativeRichValues.delete(normalizedType);
    state.injectedRichTypes.delete(normalizedType);
    state.rewritten = state.injectedPlainTypes.size > 0 || state.injectedRichTypes.size > 0;
  }

  function markSiteInjectedRich(state, type) {
    const actualType = String(type || 'text/html');
    state.injectedRichTypes.set(actualType.toLowerCase(), actualType);
    state.rewritten = true;
  }

  function siteSemanticPayload(type, value, settings, documentObject, googleDocs, state) {
    const normalizedType = String(type || '').toLowerCase();
    if (!siteSemanticClipboardType(normalizedType, googleDocs)) return null;
    const source = typeof value === 'string' ? value : String(value == null ? '' : value);
    if (!source || source.length > MAX_CLIPBOARD_MARKUP_LENGTH) return null;
    if (state) {
      state.semanticParseAttempts += 1;
      state.semanticParseCharacters += source.length;
      if (state.semanticParseAttempts > MAX_SITE_SEMANTIC_PARSE_ATTEMPTS ||
          state.semanticParseCharacters > MAX_SITE_SEMANTIC_PARSE_CHARACTERS) return null;
    }
    if (googleDocs && normalizedType === GOOGLE_DOCS_SLICE_TYPE) {
      const payload = googleDocsSlicePayload(source, settings);
      return payload ? { payload, priority: 30, agreement: 'trusted' } : null;
    }
    if (['application/mathml+xml', 'mathml', 'mathml presentation'].includes(normalizedType)) {
      const payload = officeSemanticPayloadFromMarkup(source, settings, documentObject, true);
      return payload ? { payload, priority: 25, agreement: 'anchors' } : null;
    }
    if (normalizedType === 'text/html' || normalizedType === 'html format') {
      const math = officeSemanticPayloadFromMarkup(source, settings, documentObject, false);
      if (math) {
        return {
          payload: math,
          priority: math.semanticScope === 'mixed' ? 24 : 20,
          agreement: 'anchors'
        };
      }
      const scripts = richScriptClipboardPayloadFromMarkup(source, settings, documentObject);
      if (scripts) return { payload: scripts, priority: 10, agreement: 'exact' };
    }
    return null;
  }

  function recomputeSiteSemanticPayload(state) {
    state.semanticPayload = null;
    state.semanticPriority = 0;
    state.semanticAgreement = '';
    state.semanticSourceType = '';
    for (const [type, semantic] of state.semanticCandidates || []) {
      if (!semantic || semantic.priority < state.semanticPriority) continue;
      state.semanticPayload = semantic.payload;
      state.semanticPriority = semantic.priority;
      state.semanticAgreement = semantic.agreement;
      state.semanticSourceType = type;
    }
  }

  function replaceSiteSemanticCandidate(state, type, semantic) {
    if (!state.semanticCandidates) state.semanticCandidates = new Map();
    const normalizedType = String(type || '').toLowerCase();
    state.semanticCandidates.delete(normalizedType);
    if (semantic) state.semanticCandidates.set(normalizedType, semantic);
    recomputeSiteSemanticPayload(state);
  }

  function semanticClipboardAnchorsAgree(semanticText, nativeText) {
    const semantic = semanticVisibleAnchorSignature(semanticText);
    const native = semanticVisibleAnchorSignature(nativeText);
    if (semantic.overBudget || native.overBudget) return false;
    if (semantic.identifiers !== native.identifiers) return false;
    if (!semantic.uncertainOperators && !native.uncertainOperators &&
        semantic.operators !== native.operators) return false;
    if (semantic.identifiers || native.identifiers || semantic.operators || native.operators) return true;
    return clipboardPlainAgreementKey(semanticText) === clipboardPlainAgreementKey(nativeText);
  }

  function sitePayloadAgreesWithPlain(state) {
    if (!state || !state.semanticPayload || !state.semanticPayload.text) return false;
    if (state.semanticAgreement === 'trusted') return true;
    if (!state.nativePlainSeen) return false;
    if (state.semanticAgreement === 'anchors') {
      return semanticClipboardAnchorsAgree(state.semanticPayload.text, state.nativePlain);
    }
    const sourceText = state.semanticPayload.sourceText || '';
    return state.semanticAgreement === 'exact' && Boolean(sourceText) &&
      clipboardPlainAgreementKey(sourceText) === clipboardPlainAgreementKey(state.nativePlain);
  }

  function discardMismatchedSiteCandidates(state) {
    let remaining = state.semanticCandidates ? state.semanticCandidates.size : 0;
    while (state.semanticPayload && !sitePayloadAgreesWithPlain(state) && remaining > 0) {
      // Rich HTML/MathML is often written before text/plain. Without the plain
      // anchor yet, keep the candidate pending; absence is not a mismatch.
      if (!state.nativePlainSeen && state.semanticAgreement !== 'trusted') return;
      state.semanticCandidates.delete(state.semanticSourceType);
      recomputeSiteSemanticPayload(state);
      remaining -= 1;
    }
  }

  function applySitePayloadDirect(clipboardData, state) {
    if (!clipboardData || !state || !state.originalSetData || !sitePayloadAgreesWithPlain(state)) return false;
    try {
      const plainTypes = new Set([state.plainType || 'text/plain', 'text/plain']);
      for (const type of plainTypes) {
        state.originalSetData.call(clipboardData, type, state.semanticPayload.text);
        markSiteInjectedPlain(state, type);
      }
      return true;
    } catch (_error) {
      // A browser can accept one alias and reject the next. Roll back every
      // alias already written so a partial semantic rewrite never escapes.
      restoreSiteNativePlain(clipboardData, state);
      return false;
    }
  }

  function applySiteRendererPlainDirect(clipboardData, state) {
    if (!clipboardData || !state || !state.originalSetData || !state.repairedRendererPlain) return false;
    try {
      const plainTypes = new Set([state.plainType || 'text/plain', 'text/plain']);
      for (const type of plainTypes) {
        state.originalSetData.call(clipboardData, type, state.repairedRendererPlain);
        markSiteInjectedPlain(state, type);
      }
      const html = plainTextClipboardHTML(state.repairedRendererPlain);
      for (const native of state.nativeRichValues.values()) {
        const value = native.type.toLowerCase() === 'html format'
          ? clipboardHTMLFormat(html)
          : html;
        state.originalSetData.call(clipboardData, native.type, value);
        markSiteInjectedRich(state, native.type);
      }
      return true;
    } catch (_error) {
      restoreSiteNativePlain(clipboardData, state);
      return false;
    }
  }

  function restoreSiteNativePlain(clipboardData, state) {
    if (!clipboardData || !state || !state.originalSetData ||
        (!state.injectedPlainTypes.size && !state.injectedRichTypes.size)) return false;
    try {
      for (const [normalizedType, actualType] of state.injectedPlainTypes) {
        const native = state.nativePlainValues.get(normalizedType);
        if (native) state.originalSetData.call(clipboardData, native.type, native.value);
        else {
          if (!state.originalClearData) return false;
          state.originalClearData.call(clipboardData, actualType);
        }
      }
      for (const [normalizedType, actualType] of state.injectedRichTypes) {
        const native = state.nativeRichValues.get(normalizedType);
        if (native) state.originalSetData.call(clipboardData, native.type, native.value);
        else {
          if (!state.originalClearData) return false;
          state.originalClearData.call(clipboardData, actualType);
        }
      }
      state.injectedPlainTypes.clear();
      state.injectedRichTypes.clear();
      state.rewritten = false;
      return true;
    } catch (_error) {
      return false;
    }
  }

  function synchronizeSiteClipboard(clipboardData, state) {
    discardMismatchedSiteCandidates(state);
    if (sitePayloadAgreesWithPlain(state)) return applySitePayloadDirect(clipboardData, state);
    if (state && state.repairedRendererPlain) return applySiteRendererPlainDirect(clipboardData, state);
    restoreSiteNativePlain(clipboardData, state);
    return false;
  }

  function interceptSiteClipboardWrites(event, state, settings, documentObject, googleDocs) {
    const clipboardData = event && event.clipboardData;
    if (!clipboardData || typeof clipboardData.setData !== 'function' || state.wrapped) return false;
    const original = clipboardData.setData;
    state.originalSetData = original;
    const wrapped = function cleanSiteSetData(type, value) {
      const actualType = '' + type;
      const actualValue = '' + value;
      const normalizedType = actualType.toLowerCase();
      const plain = /^(?:text\/plain|text|unicode)$/i.test(normalizedType);
      if (plain) {
        recordSiteNativePlain(state, actualType, actualValue);
      }
      const result = original.call(this, actualType, actualValue);
      if (siteRichHTMLType(normalizedType)) recordSiteNativeRich(state, actualType, actualValue);
      if (plain) {
        // The site's new plain write replaced any earlier rewrite. Re-evaluate
        // candidates without changing defaultPrevented in the middle of the
        // site's own handler; bubble finalization handles cancellation.
        state.injectedPlainTypes.delete(normalizedType);
        state.rewritten = state.injectedPlainTypes.size > 0 || state.injectedRichTypes.size > 0;
        synchronizeSiteClipboard(clipboardData, state);
        return result;
      }
      if (siteSemanticClipboardType(normalizedType, googleDocs)) {
        const semantic = siteSemanticPayload(
          actualType, actualValue, settings, documentObject, googleDocs, state
        );
        // An overwrite with malformed or non-semantic data invalidates the old
        // candidate from this exact flavor instead of leaving stale math live.
        replaceSiteSemanticCandidate(state, normalizedType, semantic);
        synchronizeSiteClipboard(clipboardData, state);
      }
      return result;
    };
    let installed = false;
    try {
      Object.defineProperty(clipboardData, 'setData', { value: wrapped, configurable: true, writable: true });
      installed = true;
    } catch (_error) {
      try {
        clipboardData.setData = wrapped;
        installed = clipboardData.setData === wrapped;
      } catch (_assignmentError) {
        installed = false;
      }
    }
    if (!installed) return false;
    state.wrapped = true;
    if (typeof clipboardData.clearData === 'function') {
      const originalClearData = clipboardData.clearData;
      state.originalClearData = originalClearData;
      const wrappedClearData = function cleanSiteClearData(type) {
        const all = arguments.length === 0;
        const actualType = all ? '' : '' + type;
        const result = all
          ? originalClearData.call(this)
          : originalClearData.call(this, actualType);
        const normalizedType = actualType.toLowerCase();
        if (all) {
          state.semanticCandidates.clear();
          recomputeSiteSemanticPayload(state);
          state.nativePlainValues.clear();
          state.injectedPlainTypes.clear();
          state.nativeRichValues.clear();
          state.injectedRichTypes.clear();
          state.nativePlainSeen = false;
          state.nativePlainRaw = '';
          state.nativePlain = '';
          state.repairedRendererPlain = '';
          state.plainType = 'text/plain';
          state.rewritten = false;
          return result;
        }
        if (/^(?:text\/plain|text|unicode)$/i.test(normalizedType)) {
          forgetSiteNativePlain(state, normalizedType);
          state.injectedPlainTypes.delete(normalizedType);
          state.rewritten = state.injectedPlainTypes.size > 0 || state.injectedRichTypes.size > 0;
          restoreSiteNativePlain(clipboardData, state);
          return result;
        }
        if (siteSemanticClipboardType(normalizedType, googleDocs)) {
          if (siteRichHTMLType(normalizedType)) forgetSiteNativeRich(state, normalizedType);
          replaceSiteSemanticCandidate(state, normalizedType, null);
          synchronizeSiteClipboard(clipboardData, state);
        }
        return result;
      };
      try {
        Object.defineProperty(clipboardData, 'clearData', { value: wrappedClearData, configurable: true, writable: true });
      } catch (_error) {
        try { clipboardData.clearData = wrappedClearData; } catch (_assignmentError) { /* bubble fallback remains */ }
      }
    }
    return true;
  }

  function postprocessSiteCopyEvent(event, settings, documentObject, state, googleDocs) {
    if (!event || !event.clipboardData || !state) return;
    if (state.wrapped) {
      discardMismatchedSiteCandidates(state);
      if (!sitePayloadAgreesWithPlain(state)) {
        if (state.repairedRendererPlain && applySiteRendererPlainDirect(event.clipboardData, state)) {
          event.preventDefault();
          return;
        }
        restoreSiteNativePlain(event.clipboardData, state);
        return;
      }
      // Never cancel native copy when the browser rejects the replacement.
      if (applySitePayloadDirect(event.clipboardData, state)) event.preventDefault();
      return;
    }
    const types = clipboardTypes(event.clipboardData);
    const plainType = types.find((type) => /^(?:text\/plain|text|unicode)$/i.test(type)) || 'text/plain';
    state.plainType = plainType;
    const nativePlainSeen = types.some((type) => /^(?:text\/plain|text|unicode)$/i.test(type));
    if (nativePlainSeen) recordSiteNativePlain(state, plainType, clipboardGet(event.clipboardData, plainType));
    else {
      state.nativePlainRaw = '';
      state.nativePlain = '';
      state.repairedRendererPlain = '';
      state.nativePlainSeen = false;
    }
    state.semanticCandidates.clear();
    recomputeSiteSemanticPayload(state);
    for (const type of types) {
      const semantic = siteSemanticPayload(
        type,
        clipboardGet(event.clipboardData, type),
        settings,
        documentObject,
        googleDocs,
        state
      );
      if (siteSemanticClipboardType(String(type || '').toLowerCase(), googleDocs)) {
        replaceSiteSemanticCandidate(state, type, semantic);
      }
    }
    discardMismatchedSiteCandidates(state);
    if (!sitePayloadAgreesWithPlain(state)) {
      if (!state.repairedRendererPlain) return;
      const nativeValues = new Map();
      const writtenTypes = [];
      try {
        const html = plainTextClipboardHTML(state.repairedRendererPlain);
        const writes = [{ type: plainType, value: state.repairedRendererPlain }];
        for (const type of types.filter(siteRichHTMLType)) {
          writes.push({
            type,
            value: type.toLowerCase() === 'html format' ? clipboardHTMLFormat(html) : html
          });
        }
        for (const write of writes) {
          nativeValues.set(write.type, clipboardGet(event.clipboardData, write.type));
          event.clipboardData.setData(write.type, write.value);
          writtenTypes.push(write.type);
        }
        state.rewritten = true;
        event.preventDefault();
      } catch (_error) {
        // This path is used only when the DataTransfer methods could not be
        // wrapped. Restore each flavor that was already accepted so a rich
        // destination can never see stale HTML beside repaired plain text.
        for (let index = writtenTypes.length - 1; index >= 0; index -= 1) {
          const type = writtenTypes[index];
          try { event.clipboardData.setData(type, nativeValues.get(type) || ''); } catch (_restoreError) { /* best effort */ }
        }
      }
      return;
    }
    try {
      event.clipboardData.setData(plainType, state.semanticPayload.text);
      state.rewritten = true;
      event.preventDefault();
    } catch (_error) {
      // Preserve the site's native clipboard when a browser rejects rewriting.
    }
  }

  // Userscript managers normally honor @sandbox raw / page injection, but can
  // fall back to an isolated world under a strict CSP. In that world an own
  // method installed on the isolated DataTransfer wrapper is invisible to a
  // page listener that calls stopImmediatePropagation(). This tiny page-world
  // relay forwards only clipboard write operations through a private DOM
  // carrier; all parsing and settings remain in the userscript world.
  function cleanMathCopyPageRelayMain(carrierId, eventName, relayGoogleDocs) {
    'use strict';
    const carrier = document.getElementById(carrierId);
    if (!carrier || carrier.getAttribute('data-clean-math-copy-relay-ready') === '1') return;
    const objectDefineProperty = Object.defineProperty;
    const objectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    const reflectApply = Reflect.apply;
    const reflectDeleteProperty = Reflect.deleteProperty;
    const jsonParse = JSON.parse;
    const jsonStringify = JSON.stringify;
    const dispatchEvent = EventTarget.prototype.dispatchEvent;
    const addEventListener = EventTarget.prototype.addEventListener;
    const CustomEventConstructor = CustomEvent;
    const scheduleTask = typeof setTimeout === 'function' ? setTimeout : null;
    const valueLimit = 1024 * 1024;
    // Clipboard events from the Google Docs editor fire in an about:blank
    // iframe, so the child location cannot identify which site owns it.
    const googleDocs = Boolean(relayGoogleDocs);
    const relayedType = (type) => {
      const normalized = String(type || '').toLowerCase();
      return /^(?:text\/plain|text|unicode)$/i.test(normalized) ||
        ['application/mathml+xml', 'mathml', 'mathml presentation', 'text/html', 'html format'].includes(normalized) ||
        (googleDocs && normalized === 'application/x-vnd.google-docs-document-slice-clip+wrapped');
    };
    let serial = 0;
    const pageCopyEvents = new WeakMap();

    const patchMethod = (target, name, replacement) => {
      let previous;
      try {
        previous = objectGetOwnPropertyDescriptor(target, name);
        objectDefineProperty(target, name, {
          value: replacement,
          configurable: true,
          enumerable: previous ? Boolean(previous.enumerable) : false,
          writable: true
        });
        return { target, name, previous, replacement };
      } catch (_error) {
        return null;
      }
    };
    const restoreMethod = (record) => {
      if (!record) return;
      try {
        const current = objectGetOwnPropertyDescriptor(record.target, record.name);
        if (!current || current.value !== record.replacement) return;
        if (record.previous) objectDefineProperty(record.target, record.name, record.previous);
        else reflectDeleteProperty(record.target, record.name);
      } catch (_error) {
        // Never overwrite a page replacement made after this relay installed.
      }
    };

    const onCopy = (event) => {
      const data = event && event.clipboardData;
      if (!data || typeof data.setData !== 'function') return;
      const nativeSet = data.setData;
      const nativeGet = typeof data.getData === 'function' ? data.getData : null;
      const nativeClear = typeof data.clearData === 'function' ? data.clearData : null;
      const eventId = String(++serial) + '-' + String(Date.now());
      let active = true;
      // Some editors (notably the current Google Docs canvas editor) call a
      // cached DataTransfer prototype method. That bypasses an own setData
      // wrapper even though the final MIME values remain readable on the
      // event. Keep the page's values separate from relay-injected rewrites so
      // a final snapshot can forward only writes the wrappers did not observe.
      const nativeValues = new Map();
      const injectedValues = new Map();
      const normalizedType = (type) => String(type == null ? '' : type).toLowerCase();

      const request = (op, type, value, all) => {
        if (!active || !carrier.isConnected) return null;
        let source = '';
        let overflow = false;
        try {
          source = typeof value === 'string' ? value : String(value == null ? '' : value);
          if (source.length > valueLimit) {
            source = '';
            overflow = true;
          }
          carrier.textContent = jsonStringify({
            id: eventId,
            op,
            type: String(type == null ? '' : type).slice(0, 256),
            value: source,
            overflow,
            all: Boolean(all)
          });
          reflectApply(dispatchEvent, carrier, [new CustomEventConstructor(eventName)]);
          const response = jsonParse(carrier.textContent || '{}');
          carrier.textContent = '';
          if (!response || response.id !== eventId) return null;
          if (response.action === 'write' && typeof response.text === 'string') {
            const requestedType = response.type || 'text/plain';
            const requestedKey = normalizedType(requestedType);
            if (injectedValues.get(requestedKey) !== response.text) {
              reflectApply(nativeSet, data, [requestedType, response.text]);
              injectedValues.set(requestedKey, response.text);
              if (requestedKey !== 'text/plain') {
                reflectApply(nativeSet, data, ['text/plain', response.text]);
                injectedValues.set('text/plain', response.text);
              }
            }
            for (const item of Array.isArray(response.richWrites) ? response.richWrites.slice(0, 2) : []) {
              if (!item || typeof item.type !== 'string' || typeof item.text !== 'string') continue;
              const itemKey = normalizedType(item.type);
              if (injectedValues.get(itemKey) === item.text) continue;
              reflectApply(nativeSet, data, [item.type, item.text]);
              injectedValues.set(itemKey, item.text);
            }
          } else if (response.action === 'restore') {
            for (const item of Array.isArray(response.writes) ? response.writes.slice(0, 4) : []) {
              if (item && typeof item.type === 'string' && typeof item.text === 'string') {
                reflectApply(nativeSet, data, [item.type, item.text]);
                injectedValues.delete(normalizedType(item.type));
              }
            }
            if (nativeClear) {
              for (const plainType of Array.isArray(response.clears) ? response.clears.slice(0, 4) : []) {
                if (typeof plainType === 'string') {
                  reflectApply(nativeClear, data, [plainType]);
                  injectedValues.delete(normalizedType(plainType));
                }
              }
            }
          } else if (response.action === 'clear' && nativeClear) {
            for (const plainType of ['text/plain', 'text', 'unicode']) {
              try { reflectApply(nativeClear, data, [plainType]); } catch (_error) { /* try remaining aliases */ }
              injectedValues.delete(plainType);
            }
          }
          if (response.prevent) event.preventDefault();
          return response;
        } catch (_error) {
          try { carrier.textContent = ''; } catch (_carrierError) { /* ignore */ }
          return null;
        }
      };

      request('begin', '', '', false);
      const recordNativeSet = (actualType, actualValue) => {
        if (!relayedType(actualType)) return;
        const key = normalizedType(actualType);
        nativeValues.set(key, { type: actualType, value: actualValue });
        injectedValues.delete(key);
        request('set', actualType, actualValue, false);
      };
      const recordNativeClear = (actualType, all) => {
        if (all) {
          nativeValues.clear();
          injectedValues.clear();
          request('clear', actualType, '', true);
        } else if (relayedType(actualType)) {
          const key = normalizedType(actualType);
          nativeValues.delete(key);
          injectedValues.delete(key);
          request('clear', actualType, '', false);
        }
      };
      const wrappedSet = function cleanMathCopyRelayedSetData(type, value) {
        // WebIDL DOMString conversion occurs before the native call. Reuse the
        // exact coerced strings so a stateful toString cannot desynchronize the
        // clipboard from the semantic parser.
        const actualType = '' + type;
        const actualValue = '' + value;
        const result = reflectApply(nativeSet, this, [actualType, actualValue]);
        recordNativeSet(actualType, actualValue);
        return result;
      };
      const wrappedClear = function cleanMathCopyRelayedClearData(type) {
        const all = arguments.length === 0;
        const actualType = all ? '' : '' + type;
        const result = all
          ? reflectApply(nativeClear, this, [])
          : reflectApply(nativeClear, this, [actualType]);
        recordNativeClear(actualType, all);
        return result;
      };
      const setRecord = patchMethod(data, 'setData', wrappedSet);
      if (!setRecord) {
        request('end', '', '', false);
        active = false;
        carrier.textContent = '';
        return;
      }
      const clearRecord = nativeClear ? patchMethod(data, 'clearData', wrappedClear) : null;
      if (nativeClear && !clearRecord) {
        restoreMethod(setRecord);
        request('end', '', '', false);
        active = false;
        carrier.textContent = '';
        return;
      }
      const harvestFinalClipboard = () => {
        if (!nativeGet) return;
        let rawTypes;
        try {
          rawTypes = data.types;
          if (!rawTypes) return;
          rawTypes = Array.from(rawTypes);
        } catch (_error) {
          return;
        }
        const completeTypeList = rawTypes.length <= 256;
        rawTypes = rawTypes.slice(0, 256);
        // Read every value before forwarding any of them: a relay response can
        // rewrite text/plain, which must not contaminate this native snapshot.
        const snapshot = [];
        const present = new Set();
        for (const rawType of rawTypes) {
          const actualType = String(rawType == null ? '' : rawType).slice(0, 256);
          if (!relayedType(actualType)) continue;
          if (snapshot.length >= 32) break;
          const key = normalizedType(actualType);
          present.add(key);
          try {
            snapshot.push({
              key,
              type: actualType,
              value: String(reflectApply(nativeGet, data, [actualType]))
            });
          } catch (_error) {
            // Keep an earlier wrapper-observed value when this MIME flavor is
            // listed but the browser refuses to expose it through getData.
          }
        }
        for (const item of snapshot) {
          if (injectedValues.get(item.key) === item.value) continue;
          const previous = nativeValues.get(item.key);
          if (previous && previous.type === item.type && previous.value === item.value) continue;
          nativeValues.set(item.key, { type: item.type, value: item.value });
          injectedValues.delete(item.key);
          request('set', item.type, item.value, false);
        }
        // A cached clearData call bypasses the wrappers just like a cached
        // setData call. Remove any previously forwarded flavor now absent from
        // the authoritative final snapshot.
        if (completeTypeList && snapshot.length < 32) {
          for (const [key, previous] of Array.from(nativeValues)) {
            if (present.has(key)) continue;
            nativeValues.delete(key);
            injectedValues.delete(key);
            request('clear', previous.type, '', false);
          }
        }
      };
      const nativeStop = typeof event.stopPropagation === 'function' ? event.stopPropagation : null;
      const nativeStopImmediate = typeof event.stopImmediatePropagation === 'function'
        ? event.stopImmediatePropagation
        : null;
      const wrappedStop = function cleanMathCopyRelayedStopPropagation() {
        harvestFinalClipboard();
        request('finalize', '', '', false);
        return reflectApply(nativeStop, event, []);
      };
      const wrappedStopImmediate = function cleanMathCopyRelayedStopImmediatePropagation() {
        harvestFinalClipboard();
        request('finalize', '', '', false);
        return reflectApply(nativeStopImmediate, event, []);
      };
      const stopRecord = nativeStop ? patchMethod(event, 'stopPropagation', wrappedStop) : null;
      const stopImmediateRecord = nativeStopImmediate
        ? patchMethod(event, 'stopImmediatePropagation', wrappedStopImmediate)
        : null;

      const cleanupCopy = () => {
        if (!active) return;
        request('end', '', '', false);
        active = false;
        pageCopyEvents.delete(event);
        try { carrier.textContent = ''; } catch (_error) { /* ignore */ }
        restoreMethod(stopImmediateRecord);
        restoreMethod(stopRecord);
        restoreMethod(clearRecord);
        restoreMethod(setRecord);
      };
      const finishCopy = () => {
        if (!active) return;
        harvestFinalClipboard();
        request('finalize', '', '', false);
        cleanupCopy();
      };
      pageCopyEvents.set(event, finishCopy);
      if (scheduleTask) {
        // A task runs after the full dispatch, unlike a microtask queued from
        // window capture (Chromium can checkpoint that before target
        // listeners). It is cleanup-only because DataTransfer has expired by
        // then; the page-world bubble listener performs the final harvest.
        reflectApply(scheduleTask, window, [cleanupCopy, 0]);
      }
    };

    const onCopyBubble = (event) => {
      const finishCopy = pageCopyEvents.get(event);
      if (finishCopy) finishCopy();
    };

    reflectApply(addEventListener, window, ['copy', onCopy, true]);
    reflectApply(addEventListener, window, ['copy', onCopyBubble, false]);
    carrier.setAttribute('data-clean-math-copy-relay-ready', '1');
  }

  function pageRelayExecutionIsIsolated(userscriptGlobal, pageWindow, documentObject) {
    let injectInto = '';
    try {
      if (typeof GM_info === 'object' && GM_info) injectInto = String(GM_info.injectInto || '');
      else if (global.GM && global.GM.info) injectInto = String(global.GM.info.injectInto || '');
    } catch (_error) {
      // Realm comparison below is the portable fallback.
    }
    if (injectInto.toLowerCase() === 'content') return true;
    const executionWindow = documentObject && documentObject.defaultView || userscriptGlobal;
    return Boolean(pageWindow && executionWindow && pageWindow !== executionWindow);
  }

  function pageRelayResponse(state, finalize) {
    discardMismatchedSiteCandidates(state);
    if (sitePayloadAgreesWithPlain(state)) {
      for (const type of new Set([state.plainType || 'text/plain', 'text/plain'])) {
        markSiteInjectedPlain(state, type);
      }
      return {
        action: 'write',
        type: state.plainType || 'text/plain',
        text: state.semanticPayload.text,
        prevent: Boolean(finalize)
      };
    }
    if (state && state.repairedRendererPlain) {
      for (const type of new Set([state.plainType || 'text/plain', 'text/plain'])) {
        markSiteInjectedPlain(state, type);
      }
      const html = plainTextClipboardHTML(state.repairedRendererPlain);
      const richTypes = new Map(state.nativeRichValues);
      if (!richTypes.has('text/html')) richTypes.set('text/html', { type: 'text/html' });
      const richWrites = [];
      for (const native of richTypes.values()) {
        const text = native.type.toLowerCase() === 'html format'
          ? clipboardHTMLFormat(html)
          : html;
        richWrites.push({ type: native.type, text });
        markSiteInjectedRich(state, native.type);
      }
      return {
        action: 'write',
        type: state.plainType || 'text/plain',
        text: state.repairedRendererPlain,
        richWrites,
        prevent: Boolean(finalize)
      };
    }
    return pageRelayRestoreResponse(state);
  }

  function pageRelayRestoreResponse(state) {
    if (!state.injectedPlainTypes.size && !state.injectedRichTypes.size) return { action: '', prevent: false };
    const writes = [];
    const clears = [];
    for (const [normalizedType, actualType] of state.injectedPlainTypes) {
      const native = state.nativePlainValues.get(normalizedType);
      if (native) writes.push({ type: native.type, text: native.value });
      else clears.push(actualType);
    }
    for (const [normalizedType, actualType] of state.injectedRichTypes) {
      const native = state.nativeRichValues.get(normalizedType);
      if (native) writes.push({ type: native.type, text: native.value });
      else clears.push(actualType);
    }
    state.injectedPlainTypes.clear();
    state.injectedRichTypes.clear();
    state.rewritten = false;
    return { action: 'restore', writes, clears, prevent: false };
  }

  function recordPageRelayOperation(state, request, settings, documentObject, googleDocs) {
    if (state.relayDisabled) return { action: '', prevent: false };
    state.relayOperations = (state.relayOperations || 0) + 1;
    const disableAfterOperation = state.relayOperations > MAX_PAGE_RELAY_OPERATIONS;
    const finish = (response) => {
      if (!disableAfterOperation) return response;
      state.relayDisabled = true;
      return response;
    };
    const normalizedType = String(request.type || '').toLowerCase();
    const plain = /^(?:text\/plain|text|unicode)$/i.test(normalizedType);
    if (request.op === 'set') {
      if (request.overflow) {
        if (plain) {
          forgetSiteNativePlain(state, normalizedType);
          state.injectedPlainTypes.delete(normalizedType);
          state.rewritten = state.injectedPlainTypes.size > 0 || state.injectedRichTypes.size > 0;
          state.semanticCandidates.clear();
          recomputeSiteSemanticPayload(state);
        } else if (siteSemanticClipboardType(normalizedType, googleDocs)) {
          if (siteRichHTMLType(normalizedType)) forgetSiteNativeRich(state, normalizedType);
          replaceSiteSemanticCandidate(state, normalizedType, null);
        }
      } else if (plain) {
        recordSiteNativePlain(state, request.type, request.value);
        state.injectedPlainTypes.delete(normalizedType);
        state.rewritten = state.injectedPlainTypes.size > 0 || state.injectedRichTypes.size > 0;
      } else if (siteSemanticClipboardType(normalizedType, googleDocs)) {
        if (siteRichHTMLType(normalizedType)) recordSiteNativeRich(state, request.type, request.value);
        const semantic = disableAfterOperation ? null : siteSemanticPayload(
          request.type, request.value, settings, documentObject, googleDocs, state
        );
        replaceSiteSemanticCandidate(state, normalizedType, semantic);
      }
      return finish(disableAfterOperation ? pageRelayRestoreResponse(state) : pageRelayResponse(state, false));
    }
    if (request.op === 'clear') {
      if (request.all) {
        state.semanticCandidates.clear();
        recomputeSiteSemanticPayload(state);
        state.nativePlainValues.clear();
        state.injectedPlainTypes.clear();
        state.nativeRichValues.clear();
        state.injectedRichTypes.clear();
        state.nativePlainSeen = false;
        state.nativePlainRaw = '';
        state.nativePlain = '';
        state.repairedRendererPlain = '';
        state.plainType = 'text/plain';
        state.rewritten = false;
        return finish({ action: '', prevent: false });
      }
      if (plain) {
        forgetSiteNativePlain(state, normalizedType);
        state.injectedPlainTypes.delete(normalizedType);
        state.rewritten = state.injectedPlainTypes.size > 0 || state.injectedRichTypes.size > 0;
        return finish(pageRelayRestoreResponse(state));
      }
      if (siteSemanticClipboardType(normalizedType, googleDocs)) {
        if (siteRichHTMLType(normalizedType)) forgetSiteNativeRich(state, normalizedType);
        replaceSiteSemanticCandidate(state, normalizedType, null);
      }
      return finish(disableAfterOperation ? pageRelayRestoreResponse(state) : pageRelayResponse(state, false));
    }
    return finish(disableAfterOperation
      ? pageRelayRestoreResponse(state)
      : pageRelayResponse(state, request.op === 'finalize'));
  }

  function installPageClipboardRelay(documentObject, userscriptGlobal, pageWindow, settingsProvider, googleDocs) {
    if (!documentObject || !pageRelayExecutionIsIsolated(userscriptGlobal, pageWindow, documentObject)) return false;
    if (!documentObject.documentElement || (!documentObject.head && !documentObject.body)) {
      if (documentObject.__cleanMathCopyRelayPending) return false;
      try {
        Object.defineProperty(documentObject, '__cleanMathCopyRelayPending', { value: true, configurable: true });
        const Observer = (userscriptGlobal && userscriptGlobal.MutationObserver) || global.MutationObserver;
        const observer = new Observer(() => {
          if (!documentObject.documentElement || (!documentObject.head && !documentObject.body)) return;
          observer.disconnect();
          try { delete documentObject.__cleanMathCopyRelayPending; } catch (_error) { /* ignore */ }
          installPageClipboardRelay(documentObject, userscriptGlobal, pageWindow, settingsProvider, googleDocs);
        });
        observer.observe(documentObject, { childList: true, subtree: true });
      } catch (_error) {
        try { delete documentObject.__cleanMathCopyRelayPending; } catch (_deleteError) { /* ignore */ }
      }
      return false;
    }
    const random = new Uint32Array(4);
    try {
      const cryptoObject = (userscriptGlobal && userscriptGlobal.crypto) || global.crypto;
      if (cryptoObject && typeof cryptoObject.getRandomValues === 'function') cryptoObject.getRandomValues(random);
      else throw new Error('no crypto');
    } catch (_error) {
      for (let index = 0; index < random.length; index += 1) random[index] = Math.floor(Math.random() * 0xffffffff);
    }
    const token = Array.from(random, (value) => value.toString(36)).join('-');
    const carrierId = 'clean-math-copy-relay-' + token;
    const eventName = carrierId + '-request';
    const carrier = documentObject.createElement('span');
    carrier.id = carrierId;
    carrier.hidden = true;
    carrier.setAttribute('aria-hidden', 'true');
    documentObject.documentElement.appendChild(carrier);
    const active = new Map();
    const onRequest = () => {
      let request;
      let response = { id: '' };
      try {
        const rawRequest = carrier.textContent || '';
        // JSON can expand each decoded character to a six-character escape.
        // Bound the envelope separately, then enforce the decoded value limit.
        if (!rawRequest || rawRequest.length > (6 * MAX_CLIPBOARD_MARKUP_LENGTH) + 4096) return;
        request = JSON.parse(rawRequest);
        response.id = typeof request.id === 'string' ? request.id : '';
        if (!response.id || response.id.length > 128 ||
            !['begin', 'set', 'clear', 'finalize', 'end'].includes(request.op)) return;
        if (typeof request.type !== 'string' || request.type.length > 256) request.type = '';
        if (request.op === 'set' &&
            (typeof request.value !== 'string' || request.value.length > MAX_CLIPBOARD_MARKUP_LENGTH)) {
          request.value = '';
          request.overflow = true;
        }
        if (request.op === 'begin') {
          while (active.size >= MAX_PAGE_RELAY_ACTIVE_EVENTS) active.delete(active.keys().next().value);
          active.set(response.id, createSiteCopyState());
          return;
        }
        const state = active.get(response.id);
        if (!state) return;
        if (request.op === 'end') {
          active.delete(response.id);
          return;
        }
        response = {
          id: response.id,
          ...recordPageRelayOperation(state, request, settingsProvider(), documentObject, googleDocs)
        };
      } catch (_error) {
        response = { id: response.id || '', action: '', prevent: false };
      } finally {
        try { carrier.textContent = JSON.stringify(response); } catch (_error) { carrier.textContent = ''; }
      }
    };
    carrier.addEventListener(eventName, onRequest, false);
    const source = '(function(){try{(' + cleanMathCopyPageRelayMain.toString() + ')(' +
      JSON.stringify(carrierId) + ',' + JSON.stringify(eventName) + ',' + JSON.stringify(Boolean(googleDocs)) +
      ');}catch(error){}})();';
    let injected = null;
    const injectionParent = documentObject.head || documentObject.documentElement;
    try {
      if (typeof GM_addElement === 'function') {
        injected = GM_addElement(injectionParent, 'script', { textContent: source });
      } else if (global.GM && typeof global.GM.addElement === 'function') {
        injected = global.GM.addElement(injectionParent, 'script', { textContent: source });
      } else {
        injected = documentObject.createElement('script');
        injected.textContent = source;
        injectionParent.appendChild(injected);
      }
    } catch (_error) {
      injected = null;
    }
    try { if (injected && typeof injected.remove === 'function') injected.remove(); } catch (_error) { /* ignore */ }
    if (carrier.getAttribute('data-clean-math-copy-relay-ready') === '1') return true;
    carrier.removeEventListener(eventName, onRequest, false);
    carrier.remove();
    return false;
  }

  function googleDocsClipboardFrameHost(documentObject) {
    const view = documentObject && documentObject.defaultView;
    try {
      const frame = view && view.frameElement;
      const parent = view && view.parent;
      return frame && parent && parent !== view && isGoogleDocsPage(parent)
        ? parent
        : null;
    } catch (_error) {
      return null;
    }
  }

  function observeGoogleDocsClipboardFrames(documentObject, attachDocument) {
    if (!documentObject || typeof attachDocument !== 'function') return null;
    const observedFrames = new WeakSet();
    const attachFrame = (frame) => {
      if (!frame || !frame.matches || !frame.matches(GOOGLE_DOCS_CLIPBOARD_FRAME_SELECTOR)) return;
      if (!observedFrames.has(frame)) {
        observedFrames.add(frame);
        frame.addEventListener('load', () => attachFrame(frame), true);
      }
      try {
        const childDocument = frame.contentDocument;
        const childWindow = frame.contentWindow;
        if (childDocument && childWindow && childDocument !== documentObject) {
          attachDocument(childDocument, childWindow);
        }
      } catch (_error) {
        // A future same-origin load or replacement can still be attached.
      }
    };
    const inspect = (node) => {
      if (!node || node.nodeType !== 1) return;
      attachFrame(node);
      if (!node.querySelectorAll) return;
      for (const frame of node.querySelectorAll(GOOGLE_DOCS_CLIPBOARD_FRAME_SELECTOR)) attachFrame(frame);
    };
    if (documentObject.documentElement) inspect(documentObject.documentElement);
    const view = documentObject.defaultView;
    const Observer = view && view.MutationObserver || global.MutationObserver;
    if (typeof Observer !== 'function') return null;
    try {
      const observer = new Observer((records) => {
        for (const record of records) {
          if (record.type === 'attributes') attachFrame(record.target);
          else for (const node of Array.from(record.addedNodes || [])) inspect(node);
        }
      });
      observer.observe(documentObject, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'src']
      });
      return observer;
    } catch (_error) {
      return null;
    }
  }

  function install(documentObject, userscriptGlobal, installOptions) {
    let options = installOptions && typeof installOptions === 'object' ? installOptions : {};
    if (!documentObject) return;
    const inheritedGoogleDocsHost = options.pageWindow
      ? null
      : googleDocsClipboardFrameHost(documentObject);
    if (inheritedGoogleDocsHost) {
      // Managers can inject into inherited about:blank documents before Docs
      // assigns the texteventtarget class. Own that child immediately with the
      // parent editor context; a generic about:blank install would set the
      // marker first and permanently hide the equation clipboard flavors.
      options = {
        ...options,
        pageWindow: inheritedGoogleDocsHost,
        // A child can win the race before the top controller exists. Read the
        // manager's shared setting at copy time so later menu changes still
        // apply to that already-installed frame.
        settingsProvider: typeof options.settingsProvider === 'function'
          ? options.settingsProvider
          : loadSettings,
        registerMenus: false,
        observeGoogleDocsFrames: false
      };
    }
    if (documentObject.__cleanMathCopyInstalled) return;
    Object.defineProperty(documentObject, '__cleanMathCopyInstalled', { value: true, configurable: true });
    const inheritedSettingsProvider = typeof options.settingsProvider === 'function'
      ? options.settingsProvider
      : null;
    const pageWindow = options.pageWindow || getPageWindow(userscriptGlobal || global);
    let settings = inheritedSettingsProvider
      ? normalizeSettings(inheritedSettingsProvider())
      : loadSettings();
    const currentSettings = () => inheritedSettingsProvider
      ? normalizeSettings(inheritedSettingsProvider())
      : settings;
    let settingsGeneration = 0;
    const handledEvents = new WeakSet();
    const officeCopyStates = new WeakMap();
    const siteCopyStates = new WeakMap();
    const googleDocsPage = isGoogleDocsPage(pageWindow);
    let activeOfficeState = null;
    let officeGeneration = 0;
    let manualClipboardGeneration = 0;

    const pageRelayInstalled = installPageClipboardRelay(
      documentObject,
      userscriptGlobal || global,
      pageWindow,
      currentSettings,
      googleDocsPage
    );

    try {
      if (!inheritedSettingsProvider && global.GM && typeof global.GM.getValue === 'function') {
        const loadGeneration = settingsGeneration;
        Promise.resolve(global.GM.getValue(STORAGE_KEY, DEFAULT_SETTINGS)).then((stored) => {
          // A menu command can run while an asynchronous manager read is
          // pending. Never let that stale startup value overwrite the newer
          // in-memory choice the user has already made and persisted.
          if (settingsGeneration === loadGeneration) settings = normalizeSettings(stored);
        }, () => {});
      }
    } catch (_error) {
      // Synchronous manager APIs or defaults remain active.
    }

    const handleCopy = (event) => {
      if (!event || handledEvents.has(event)) return;
      handledEvents.add(event);
      const eventSettings = currentSettings();
      // Any newer keyboard/context-menu copy invalidates an in-flight manual
      // Clipboard API retry just as another manual command would.
      const replayAfterPendingWrite = hasPendingClipboardWrite();
      const clipboardGeneration = ++manualClipboardGeneration;
      let officeState = null;
      let siteState = null;
      if (isMicrosoftOfficeWebPage(documentObject, pageWindow)) {
        if (activeOfficeState && activeOfficeState.recovery) activeOfficeState.recovery.stop();
        const generation = ++officeGeneration;
        officeState = {
          primaryHandled: false,
          nativeTextSeen: false,
          nativePlain: '',
          semanticHandled: false,
          semanticPayload: null,
          semanticPriority: 0,
          lastSemanticMathML: false,
          wrapped: false,
          recovery: null,
          generation,
          originalSetData: null,
          originalClearData: null,
          settings: eventSettings,
          isCurrent: () => activeOfficeState === officeState && officeGeneration === generation
        };
        activeOfficeState = officeState;
        officeCopyStates.set(event, officeState);
        interceptOfficeClipboardWrites(event, officeState, eventSettings, documentObject);
        officeState.recovery = armOfficeClipboardStagingRecovery(documentObject, eventSettings, pageWindow, officeState);
      }
      const selection = documentObject.getSelection ? documentObject.getSelection() : null;
      // Google Docs draws and selects document content through its own editor
      // model. Its later clipboard flavors contain exact equation structure;
      // the DOM selection can be only a flattened accessibility projection.
      // Published/preview documents are ordinary rendered pages; defer only
      // inside the editor where the DOM is a flattened accessibility view.
      const payload = isGoogleDocsEditorPage(documentObject, pageWindow)
        ? null
        : getCopyPayload(documentObject, selection, eventSettings, pageWindow, event.target);
      if (!officeState && !payload && !(googleDocsPage && pageRelayInstalled)) {
        siteState = createSiteCopyState();
        siteState.settings = eventSettings;
        siteCopyStates.set(event, siteState);
        interceptSiteClipboardWrites(event, siteState, eventSettings, documentObject, googleDocsPage);
      }
      if (replayAfterPendingWrite) {
        const selectedNativeText = selectedNativeClipboardText(selection, event.target);
        const isReplayCurrent = () => manualClipboardGeneration === clipboardGeneration;
        // A Clipboard API call that already started cannot be cancelled. Queue
        // a replay behind it so its late completion cannot become the final
        // clipboard state. Resolve Office/site data only when the replay runs,
        // after the rest of this copy event has had a chance to populate it.
        enqueueClipboardPayload(() => {
          if (officeState && officeState.semanticPayload) return officeState.semanticPayload;
          if (siteState && siteState.semanticPayload && sitePayloadAgreesWithPlain(siteState)) {
            return siteState.semanticPayload;
          }
          if (payload && payload.text && payload.text.trim()) return payload;
          const types = clipboardTypes(event.clipboardData);
          const plainType = types.find((type) => /^(?:text\/plain|text|unicode)$/i.test(type)) || 'text/plain';
          const eventText = clipboardGet(event.clipboardData, plainType);
          const text = eventText || (officeState && officeState.nativePlain) || selectedNativeText;
          return text && text.trim()
            ? { text, html: '', mathML: '', reason: 'pending-copy-replay', mathRanges: 0 }
            : null;
        }, pageWindow, isReplayCurrent);
      }
      if (!payload || !payload.text || !payload.text.trim() || !event.clipboardData) return;
      try {
        if (typeof event.clipboardData.clearData === 'function') event.clipboardData.clearData();
        event.clipboardData.setData('text/plain', payload.text);
      } catch (_error) {
        return;
      }
      if (payload.html) {
        try {
          event.clipboardData.setData('text/html', payload.html);
        } catch (_error) {
          // Plain text is still complete when a browser rejects rich clipboard HTML.
        }
      }
      if (payload.mathML) {
        for (const format of ['application/mathml+xml', 'MathML', 'MathML Presentation']) {
          try {
            event.clipboardData.setData(format, payload.mathML);
          } catch (_error) {
            // Web clipboard implementations vary in the custom formats they permit.
          }
        }
      }
      if (officeState) {
        officeState.primaryHandled = true;
        if (officeState.recovery) officeState.recovery.stop();
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const handleOfficeCopyBubble = (event) => {
      const state = officeCopyStates.get(event);
      if (!state) return;
      postprocessOfficeCopyEvent(event, state.settings || currentSettings(), documentObject, state);
    };

    const handleSiteCopyBubble = (event) => {
      const state = siteCopyStates.get(event);
      if (!state) return;
      postprocessSiteCopyEvent(event, state.settings || currentSettings(), documentObject, state, googleDocsPage);
    };

    const view = documentObject.defaultView || userscriptGlobal;
    if (view && view.addEventListener) view.addEventListener('copy', handleCopy, true);
    documentObject.addEventListener('copy', handleCopy, true);
    if (view && view.addEventListener) view.addEventListener('copy', handleOfficeCopyBubble, false);
    if (view && view.addEventListener) view.addEventListener('copy', handleSiteCopyBubble, false);

    if (googleDocsPage && options.observeGoogleDocsFrames !== false) {
      observeGoogleDocsClipboardFrames(documentObject, (childDocument, childWindow) => {
        install(childDocument, childWindow, {
          pageWindow,
          settingsProvider: currentSettings,
          registerMenus: false,
          observeGoogleDocsFrames: false
        });
      });
    }

    const registerMenuCommand = typeof GM_registerMenuCommand === 'function'
      ? GM_registerMenuCommand
      : (global.GM && typeof global.GM.registerMenuCommand === 'function'
        ? global.GM.registerMenuCommand.bind(global.GM)
        : null);
    if (registerMenuCommand && options.registerMenus !== false) {
      const updateSettings = (nextSettings) => {
        settingsGeneration += 1;
        settings = saveSettings(nextSettings);
      };
      const setMode = (mode) => {
        updateSettings({ ...settings, outputMode: mode });
      };
      registerMenuCommand('Clean Math Copy: faithful readable output (recommended)', () => setMode('faithful'));
      registerMenuCommand('Clean Math Copy: calculator-safe output', () => setMode('calculator'));
      registerMenuCommand('Clean Math Copy: original LaTeX output', () => setMode('latex'));
      registerMenuCommand('Clean Math Copy: ASCII-only output', () => setMode('ascii'));
      registerMenuCommand('Clean Math Copy: toggle raw $...$ conversion', () => {
        updateSettings({ ...settings, convertDelimitedLatex: !settings.convertDelimitedLatex });
      });
      registerMenuCommand('Clean Math Copy: toggle ordinary-text cleanup', () => {
        updateSettings({ ...settings, cleanInvisibleArtifacts: !settings.cleanInvisibleArtifacts });
      });
      registerMenuCommand('Clean Math Copy: copy current selection now', () => {
        // A manual copy is newer than any pending Office staging recovery.
        // Stop the observer/timer and advance the Office generation so an
        // already-queued callback also fails its isCurrent guard.
        if (activeOfficeState && activeOfficeState.recovery) activeOfficeState.recovery.stop();
        activeOfficeState = null;
        officeGeneration += 1;
        const generation = ++manualClipboardGeneration;
        const isCurrent = () => manualClipboardGeneration === generation;
        const selection = documentObject.getSelection();
        const payload = getCopyPayload(documentObject, selection, settings, pageWindow, selection && selection.anchorNode);
        if (payload) return writeClipboardPayload(payload, pageWindow, isCurrent);
        const text = cleanClipboardText(selection ? selection.toString() : '');
        return text && isCurrent()
          ? writeClipboardPayload({ text, html: '', mathML: '', reason: 'manual-plain', mathRanges: 0 }, pageWindow, isCurrent)
          : Promise.resolve(false);
      });
      registerMenuCommand('Clean Math Copy: show current settings', () => {
        const message = 'Clean Math Copy v' + VERSION + '\nOutput: ' + settings.outputMode +
          '\nConvert selected $...$ / \\(...\\): ' + (settings.convertDelimitedLatex ? 'on' : 'off') +
          '\nClean ordinary copied text: ' + (settings.cleanInvisibleArtifacts ? 'on' : 'off');
        if (typeof global.alert === 'function') global.alert(message);
      });
    }

    return { handleCopy, get settings() { return { ...currentSettings() }; } };
  }

  return Object.freeze({
    VERSION,
    DEFAULT_SETTINGS,
    MATH_ROOT_SELECTOR,
    cleanClipboardText,
    repairFlattenedRendererText,
    cleanMathCopyPageRelayMain,
    cleanOfficeClipboardText,
    convertDelimitedLatexText,
    extractMathText,
    formatMathText,
    getCopyPayload,
    googleDocsSlicePayload,
    hasCleanableArtifacts,
    install,
    latexToCalculator,
    latexToFaithful,
    latexToUnicode,
    mathMLToCalculator,
    mathMLToFaithful,
    mathMLToLatex: mathMLToLatexNode,
    mathMLToUnicode,
    normalizeSettings,
    ordinarySelectionPayload,
    ommlToMathML,
    positionedOfficePayload,
    richScriptClipboardPayloadFromMarkup,
    rootsForRange,
    serializeDomFragment,
    serializeRangePayloadWithMath,
    serializeRangeWithMath,
    looksLikeStandaloneUnicodeMath,
    unicodeToAscii,
    unicodeToCalculator
  });
});
