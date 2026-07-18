// ==UserScript==
// @name         Clean Math Copy
// @namespace    https://github.com/atharvj/clean-math-copy
// @version      2.6.4
// @description  Accurately copy web math and clean messy ordinary text as readable plain text plus safe rich formatting.
// @author       Intellectual07
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
// @resource     clean_math_copy_pdfjs https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.min.mjs#sha256=4ba2f15599b03fde8755ad91349920c21dadd3e8fd6b6460a7663d46d4cf21b5
// @resource     clean_math_copy_pdfjs_worker https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs#sha256=2ab9e09667296dab1a618868b3ce6e6c23d5b8f48120ae7c5b34e7e335ed01fa
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setClipboard
// @grant        GM_addElement
// @grant        unsafeWindow
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.getResourceText
// @grant        GM.getResourceUrl
// @grant        GM.addValueChangeListener
// @grant        GM.registerMenuCommand
// @grant        GM.unregisterMenuCommand
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

  const STORAGE_KEY = 'cleanMathCopy.settings.v3';
  const PDFJS_RESOURCE = 'clean_math_copy_pdfjs';
  const PDFJS_WORKER_RESOURCE = 'clean_math_copy_pdfjs_worker';
  const PDFJS_API_SOURCE_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.min.mjs';
  const PDFJS_WORKER_SOURCE_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs';
  const PDF_VIEWER_BYPASS_KEY = 'cleanMathCopy.pdfViewerBypass.v1';
  const PDF_RENDER_SELECTION_EVENT = 'clean-math-copy-pdf-render-selection-v1';
  const PDF_SELECTION_READY_EVENT = 'clean-math-copy-pdf-selection-ready-v1';
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
  const MAX_EMBEDDED_ENTITY_NAMES = 1024;
  const MAX_RICH_SELECTION_NODES = 1000;
  const MAX_RICH_SELECTION_DEPTH = 128;
  const MAX_ORDINARY_SELECTION_MARKUP_LENGTH = 1024 * 1024;
  const MAX_ORDINARY_IMAGE_ALT_SOURCE_LENGTH = 2048;
  const MAX_ORDINARY_IMAGE_ALT_CHARACTERS = 256;
  const MAX_ORDINARY_IMAGE_ALT_WORDS = 32;
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
  const MAX_CSS_STACK_MATH_ROOTS = 128;
  const MAX_CSS_STACK_MATH_NODES = 256;
  const MAX_CSS_STACK_MATH_CHARACTERS = 2048;
  const MAX_PDF_SELECTED_PAGES = 64;
  const MAX_PDF_SELECTED_ITEMS = 12000;
  const MAX_PDF_PAGE_ITEMS = 20000;
  const MAX_PDF_PAGE_CHARACTERS = 2 * 1024 * 1024;
  const MAX_PDF_GEOMETRY_RULES = 10000;
  const MAX_PDF_GEOMETRY_WORK = 2000000;
  const MAX_PDF_FILE_BYTES = 256 * 1024 * 1024;
  const MAX_PDF_SIGNATURE_OFFSET = 1024;
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
  const PDF_VIEWER_INCOMPLETE = Symbol('clean-math-copy-pdf-viewer-incomplete');
  const CSS_STACK_MATH_UNREPRESENTABLE = Symbol('clean-math-copy-css-stack-unrepresentable');
  const CSS_STACK_MATH_DOM_UNREPRESENTABLE = Symbol('clean-math-copy-css-stack-dom-unrepresentable');
  const CSS_STACK_MATH_DESCRIPTOR_PENDING = Symbol('clean-math-copy-css-stack-descriptor-pending');
  const CSS_STACK_VISIBLE_SPECIALS = Object.freeze({
    '\\': '\ue200', '{': '\ue201', '}': '\ue202', '$': '\ue203',
    '#': '\ue204', '%': '\ue205', '&': '\ue206'
  });
  const CSS_STACK_VISIBLE_SPECIAL_LATEX = Object.freeze({
    '\ue200': '\\backslash ', '\ue201': '\\{', '\ue202': '\\}', '\ue203': '\\$',
    '\ue204': '\\#', '\ue205': '\\%', '\ue206': '\\&'
  });
  const TRUSTED_RICH_STYLE_NODES = new WeakSet();
  const TRUSTED_PDF_VIEWER_ROOTS = new WeakSet();
  const TRUSTED_TEXT_PLACEHOLDERS = new WeakMap();
  // Renderer projections can prove that a visual table came from an equation
  // alignment grammar (rather than a matrix that happens to use right/left
  // columns). Keep that proof out of page-controlled attributes and carry it
  // across only this module's sanitized MathML clones.
  const AUTHENTIC_ALIGNED_MATHML_TABLES = new WeakSet();
  // Embedded image/SVG metadata is mutable page state. Cache descriptors only
  // during one synchronous copy projection so changing an image, an
  // accessibility representation, or its metadata can never reuse a result
  // from an earlier copy and selected pages do not accumulate large cloned
  // MathML trees for their entire lifetime.
  let ACTIVE_COPY_EMBEDDED_MATH_CACHE = null;
  // SVG renderer descriptors are deliberately cached only for the lifetime
  // of one copy projection. A single selection can ask about the same root
  // through discovery, source extraction, and serialization; rescanning a
  // several-thousand-node SVG each time is wasteful. Persistent caching would
  // be unsafe because pages can mutate renderer metadata or visibility.
  let ACTIVE_COPY_MATHJAX_SVG_CACHE = null;
  // MathJax CHTML exposes a semantic custom-element tree even when a page
  // omits TeX metadata and Assistive MathML. Projecting that tree is bounded
  // but nontrivial, so reuse the authenticated projection only within the
  // synchronous copy operation that observed it. Page mutations must be
  // visible to the next copy just as they are for SVG and embedded metadata.
  let ACTIVE_COPY_MATHJAX_CHTML_CACHE = null;
  // MathJax 2 CommonHTML uses span classes instead of custom elements but
  // carries the same semantic layout. Keep its projection independently
  // cached for one copy operation so a failed modern probe cannot mask it.
  let ACTIVE_COPY_MATHJAX2_CHTML_CACHE = null;
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
    '[data-mathml]',
    '[data-equation-content]',
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

  const OUTPUT_MODES = Object.freeze(['faithful', 'calculator', 'latex', 'native']);
  const DEFAULT_SETTINGS = Object.freeze({ outputMode: 'faithful' });

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
  const SUPERSCRIPT_GLYPH_BASES = new Map(
    Object.entries(SUPERSCRIPTS).map(([base, glyph]) => [glyph, base])
  );
  const SUBSCRIPT_GLYPH_BASES = new Map(
    Object.entries(SUBSCRIPTS).map(([base, glyph]) => [glyph, base])
  );

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
    ...Object.values(DOUBLE_STRUCK), ...MATH_VARIANT_GREEK_SYMBOLS,
    'ℏ', 'ℓ', '℘', 'ℜ', 'ℑ'
  ]);

  const ASCII_SYMBOLS = Object.freeze({
    '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~=', '∼': '~=', '≃': '~=', '≅': '~=', '≡': '===',
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
  const UNSOURCED_MATH_FALLBACK_UNSAFE_TAGS = new Set([
    ...ORDINARY_DROP_CONTENT_TAGS,
    // Replaced and interactive elements can paint meaning that textContent
    // cannot authenticate. Even an image alt is page-authored metadata, not
    // independent evidence for the pixels selected by the user.
    'area', 'bdi', 'bdo', 'button', 'datalist', 'details', 'input', 'map',
    'meter', 'option', 'optgroup', 'picture', 'progress', 'rp', 'rt', 'ruby',
    'select', 'source', 'summary', 'textarea', 'track'
  ]);
  const CSS_STACK_MATH_UNSAFE_TAGS = new Set([
    'a', 'area', 'audio', 'bdo', 'br', 'button', 'canvas', 'code', 'datalist',
    'details', 'embed', 'fieldset', 'form', 'frame', 'frameset', 'hr', 'iframe',
    'img', 'input', 'label', 'legend', 'li', 'link', 'map', 'math', 'menu',
    'meta', 'meter', 'noscript', 'object', 'ol', 'optgroup', 'option', 'picture',
    'pre', 'progress', 'rp', 'rt', 'ruby', 'script', 'select', 'slot', 'source',
    'style', 'summary', 'svg', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
    'template', 'textarea', 'track', 'tr', 'ul', 'video', 'caption', 'col', 'colgroup'
  ]);
  const CSS_STACK_MATH_LAYOUT_DISPLAYS = new Set([
    'block', 'contents', 'flex', 'flow-root', 'grid', 'inline', 'inline-block',
    'inline-flex', 'inline-grid', 'inline-table', 'table', 'table-cell',
    'table-row', 'table-row-group'
  ]);
  const CSS_STACK_MATH_OPERATORS = new Map([
    // Keep this table aligned with operators the faithful, calculator, and
    // LaTeX serializers can all bind to a following body without changing
    // meaning. Unsupported visual stacks fail native rather than producing a
    // plausible-looking but false expression.
    ['lim', '\\lim'], ['∑', '\\sum'], ['∏', '\\prod'], ['∫', '\\int']
  ]);
  const CSS_STACK_MATH_OPERATOR_COMMANDS = new Set(
    Array.from(CSS_STACK_MATH_OPERATORS.values(), (value) => String(value).replace(/^\\/u, ''))
  );
  const ORDINARY_SEMANTIC_TABLE_DISPLAYS = Object.freeze({
    table: new Set(['table', 'inline-table']),
    thead: new Set(['table-header-group']),
    tbody: new Set(['table-row-group']),
    tfoot: new Set(['table-footer-group']),
    tr: new Set(['table-row']),
    td: new Set(['table-cell']),
    th: new Set(['table-cell']),
    caption: new Set(['table-caption']),
    colgroup: new Set(['table-column-group']),
    col: new Set(['table-column'])
  });

  function normalizeSettings(settings) {
    const candidate = settings && typeof settings === 'object' ? settings : {};
    const outputMode = OUTPUT_MODES.includes(candidate.outputMode)
      ? candidate.outputMode
      : DEFAULT_SETTINGS.outputMode;
    return { outputMode };
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

  function isDegreeScript(text) {
    const compact = String(text == null ? '' : text).replace(/\s+/gu, '');
    return compact === '∘' || compact === '°';
  }

  function toScript(text, map, fallbackMarker) {
    const source = String(text).trim();
    if (!source) return '';
    if (fallbackMarker === '^' && isDegreeScript(source)) return '°';
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
    if (fallbackMarker === '^' && isDegreeScript(source)) return '°';
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
    const boundedAggregate = /^(?:lim(?![\p{L}\p{N}])|[∑∏∫])/u.test(text);
    if (!text || faithfulFullyFenced(text) || (faithfulExpressionIsAtomic(text) && !boundedAggregate)) return text;
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
    // In a linear numerator or denominator, a bounded aggregate followed by
    // its body needs visible grouping. Without the fraction bar,
    // `lim_(x → 0) f(x)/y` can be read as the limit of `f(x)/y` rather than
    // `(lim_(x → 0) f(x))/y`.
    if (!settings.atomic && /^(?:lim(?![\p{L}\p{N}])|[∑∏∫])/u.test(readableText)) {
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
    if (command === 'overbrace' || command === 'underbrace') {
      return faithfulMarkedScope(command + '(' + value + ')', false);
    }
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
    const rawEnv = environment.replace(/\*$/, '');
    const env = rawEnv.toLowerCase();
    const calculatorMode = Boolean(options && options.calculatorMode);
    const agreementMode = Boolean(options && options.agreementMode);
    const svgAgreementTopology = options && options.svgAgreementTopology;
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
    if (agreementMode && svgAgreementTopology) {
      svgAgreementTopology.tables.push({
        rows: rows.map((cells) => cells.map((cell) => mathJaxSvgAgreementKey(cell)))
      });
    }
    if (agreementMode) {
      const painted = rows.flat().join('');
      if (env === 'cases' || env === 'dcases') return '{' + painted;
      if (/matrix|array|smallmatrix/.test(env)) {
        const fences = new Map([
          ['pmatrix', ['(', ')']], ['bmatrix', ['[', ']']],
          ['Bmatrix', ['{', '}']], ['vmatrix', ['|', '|']],
          ['Vmatrix', ['‖', '‖']]
        ]).get(rawEnv) || ['', ''];
        return fences[0] + painted + fences[1];
      }
      return painted;
    }
    if (env === 'cases') {
      if (calculatorMode) {
        return 'piecewise(' + rows.map((cells) => '[' + cells.join(',') + ']').join(',') + ')';
      }
      // `if` is a readability aid synthesized by the clipboard formatter; it
      // is not a glyph in MathJax's cases table. Source-versus-surface
      // authentication therefore compares only authored cell contents.
      if (agreementMode) {
        return '{ ' + rows.map((cells) => cells.join(' ')).join('; ') + ' }';
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
      this.agreementMode = Boolean(options && options.agreementMode);
      this.svgAgreementTopology = options && options.svgAgreementTopology || null;
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
          agreementMode: this.agreementMode,
          svgAgreementTopology: this.svgAgreementTopology,
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
        return ' ' + symbol;
      }

      const argument = this.parseCalculatorArgumentAtom();
      if (!argument) {
        this.position = start;
        return ' ' + symbol;
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
      // TeX operator commands are separate tokens even when the source has no
      // literal whitespace (`R\tan\phi`). Preserve that boundary until the
      // calculator formatter can turn it into explicit multiplication; plain
      // concatenation would misread `Rtan` as four variables.
      return ' ' + call;
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
      // Preserve the TeX function boundary on both sides. The apply sentinel
      // separates the function from its argument; the leading soft space
      // prevents a preceding factor from merging into the name (`R tan ϕ`,
      // not the ambiguous identifier `Rtan ϕ`). Normal faithful formatting
      // removes this space at a row/fence/operator boundary.
      return ' ' + symbol +
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
      let body = this.parseCalculatorArgumentAtom();
      // A plain identifier followed immediately by a delimited argument is
      // one aggregate body (`lim f(x)`), not `lim f` multiplied by `(x)`.
      // The generic argument parser intentionally consumes one atom, so bind
      // this common function-call shape here before formatting the aggregate.
      if (/^(?:[\p{L}\p{M}][\p{L}\p{N}\p{M}_]*|\ue100[^\ue101]+\ue101)$/u.test(body)) {
        const checkpoint = this.position;
        this.skipCalculatorSpacing();
        const callArgument = this.parseCalculatorDelimitedArgument();
        if (callArgument.matched) {
          body += '(' + callArgument.value + ')';
          while (this.input[this.position] === '^' || this.input[this.position] === '_') {
            const marker = this.input[this.position];
            this.position += 1;
            body += marker + '(' + this.parseArgument() + ')';
            this.skipCalculatorSpacing();
          }
        } else {
          this.position = checkpoint;
        }
      }
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

      if (name === 'sp' || name === 'sb') {
        const argument = this.parseArgument();
        if (this.faithfulMode) {
          return name === 'sp'
            ? toFaithfulScript(argument, SUPERSCRIPTS, '^')
            : toFaithfulScript(argument, SUBSCRIPTS, '_');
        }
        return name === 'sp'
          ? toScript(argument, SUPERSCRIPTS, '^')
          : toScript(argument, SUBSCRIPTS, '_');
      }

      if (name === 'frac' || name === 'dfrac' || name === 'tfrac' || name === 'cfrac') {
        const numerator = this.parseArgument();
        const denominatorSource = this.faithfulMode ? this.peekArgumentSource() : '';
        const denominator = this.parseArgument();
        if (this.calculatorMode) {
          return calculatorFraction(
            unicodeToCalculator(numerator, { retainDeclaredIdentifiers: true }),
            unicodeToCalculator(denominator, { retainDeclaredIdentifiers: true })
          );
        }
        if (this.faithfulMode) return faithfulFraction(
          numerator,
          denominator,
          faithfulLatexDenominatorOptions(denominatorSource)
        );
        return '(' + numerator + ')/(' + denominator + ')';
      }
      if (name === 'binom' || name === 'dbinom' || name === 'tbinom') {
        const upper = this.parseArgument();
        const lower = this.parseArgument();
        // `C` is useful in copied linear text but is not drawn by MathJax;
        // omit that label and the readability-only comma while authenticating
        // the exact painted SVG token order.
        return this.agreementMode
          ? '(' + upper + lower + ')'
          : 'C(' + upper + ', ' + lower + ')';
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
        if (this.calculatorMode && /^[A-Za-z][A-Za-z0-9_]*$/.test(value)) {
          return DECLARED_IDENTIFIER_START + value + DECLARED_IDENTIFIER_END;
        }
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
        const value = this.parseArgument();
        if (this.calculatorMode) {
          return /^[A-Za-z][A-Za-z0-9_]*$/.test(value)
            ? DECLARED_IDENTIFIER_START + value + DECLARED_IDENTIFIER_END
            : value;
        }
        return applyMathVariant(value, 'double-struck', this.faithfulMode ? name : 'double-struck');
      }
      if (['mathcal', 'mathscr', 'mathfrak'].includes(name)) {
        const variants = { mathcal: 'script', mathscr: 'script', mathfrak: 'fraktur' };
        const value = this.parseArgument();
        if (this.calculatorMode) {
          return /^[A-Za-z][A-Za-z0-9_]*$/.test(value)
            ? DECLARED_IDENTIFIER_START + value + DECLARED_IDENTIFIER_END
            : value;
        }
        return applyMathVariant(value, variants[name], this.faithfulMode ? name : variants[name]);
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
        overline: '\u0305', bar: '\u0305', overbrace: '\u23de',
        underline: '\u0332', underbrace: '\u23df', hat: '\u0302', widehat: '\u0302',
        tilde: '\u0303', widetilde: '\u0303', vec: '\u20d7', overrightarrow: '\u20d7',
        overleftarrow: '\u20d6', dot: '\u0307', ddot: '\u0308', acute: '\u0301',
        grave: '\u0300', breve: '\u0306', check: '\u030c', mathring: '\u030a'
      };
      if (Object.prototype.hasOwnProperty.call(accents, name)) {
        const value = this.parseArgument();
        if ((name === 'overbrace' || name === 'underbrace') && this.calculatorMode) {
          const checkpoint = this.position;
          this.skipCalculatorSpacing();
          const annotationMarker = name === 'overbrace' ? '^' : '_';
          if (this.input[this.position] === annotationMarker) {
            this.position += 1;
            this.parseArgument();
          } else {
            this.position = checkpoint;
          }
          // A brace is presentation-only in calculator mode, but its base is
          // one atomic operand. Retain grouping so adjacent factors cannot
          // turn overbrace{x+y}z into x+y*z.
          return '(' + value + ')';
        }
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
          agreementMode: this.agreementMode,
          svgAgreementTopology: this.svgAgreementTopology,
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
        if (this.agreementMode && this.svgAgreementTopology) {
          this.svgAgreementTopology.multiscripts.push({
            base: mathJaxSvgAgreementKey(base),
            preSub: mathJaxSvgAgreementKey(lower),
            preSup: mathJaxSvgAgreementKey(upper),
            postSub: '',
            postSup: ''
          });
        }
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
        const rows = splitLatexTopLevel(this.readRawGroup(), 'row').map((row) => this.parseUnicodeInner(row));
        if (this.agreementMode && this.svgAgreementTopology) {
          this.svgAgreementTopology.tables.push({
            rows: rows.map((row) => [mathJaxSvgAgreementKey(row)])
          });
        }
        return rows.join(this.agreementMode ? '' : ', ');
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

  function latexToVisibleAgreement(input, svgAgreementTopology) {
    try {
      const source = String(input == null ? '' : input);
      if (source.length > MAX_MATH_SOURCE_LENGTH) return '';
      return formatMathText(new LatexParser(source, {
        agreementMode: true,
        svgAgreementTopology
      }).parse());
    } catch (_error) {
      return '';
    }
  }

  function formatFaithfulMathText(input, retainProtectedText) {
    let text = resolveFaithfulScopes(cleanClipboardText(String(input == null ? '' : input)));
    const functionNames = Array.from(CALCULATOR_FUNCTIONS)
      .filter((name) => /^[A-Za-z]+$/u.test(name))
      .sort((left, right) => right.length - left.length)
      .join('|');
    // parseFaithfulFunction emits one soft leading space. Keep it only when
    // an actual preceding operand would otherwise merge into the function
    // name; operators and fences already provide an unambiguous boundary.
    const leadingFunctionSpace = new RegExp(
      '(^|\\S)[ \\t]+(?=(?:' + functionNames + ')[^\\n' +
        FAITHFUL_FUNCTION_APPLY + ']{0,128}' + FAITHFUL_FUNCTION_APPLY + ')',
      'gu'
    );
    text = text.replace(leadingFunctionSpace, (_match, previous) =>
      previous && /[\p{L}\p{N}\p{M})\]}⟩⌉⌋|‖₀-₟⁰-⁹′″‴⁗]/u.test(previous)
        ? previous + ' '
        : previous
    );
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
      .replace(/([\p{L}\p{N}\p{M})\]}⟩⌉⌋|‖°!%₀-₟⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ′″‴⁗])\s*([+−-])\s*(?=[\p{L}\p{N}\p{M}(\[{\u221a])/gu, '$1 $2 ')
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

  const CALCULATOR_FUNCTIONS = new Set([
    'C', 'abs', 'acos', 'acosh', 'arccos', 'arcsin', 'arctan', 'arg', 'asin', 'asinh',
    'atan', 'atanh', 'ceil', 'cos', 'cosh', 'cot', 'csc', 'det', 'exp', 'floor',
    'erf', 'erfc', 'gcd', 'integral', 'limit', 'ln', 'log', 'max', 'min', 'mod',
    'norm', 'product', 'piecewise', 'rank', 'round', 'sec', 'sign', 'sin', 'sinc',
    'sinh', 'sqrt', 'sum', 'tan', 'tanh', 'tr', 'trace',
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

  const CSS_STACK_MATH_WORDS = new Set([
    ...CALCULATOR_WORDS,
    'acceleration', 'amplitude', 'angle', 'area', 'capacitance', 'charge',
    'current', 'density', 'distance', 'energy', 'force', 'frequency', 'height',
    'inductance', 'length', 'mass', 'meter', 'momentum', 'power', 'pressure',
    'radius', 'resistance', 'speed', 'temperature', 'time', 'velocity',
    'voltage', 'volume', 'wavelength', 'width', 'work',
    'amp', 'amps', 'cm', 'ev', 'hz', 'joule', 'joules', 'kg', 'km', 'meters',
    'mm', 'mol', 'newton', 'newtons', 'ohm', 'ohms', 'pa', 'rad', 'rpm',
    'second', 'seconds', 'volt', 'volts', 'watt', 'watts', 'wb'
  ].map((word) => String(word).toLowerCase()));

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
    const retainDeclaredIdentifiers = Boolean(options && options.retainDeclaredIdentifiers);
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
      restorations.set(token, retainDeclaredIdentifiers
        ? DECLARED_IDENTIFIER_START + value + DECLARED_IDENTIFIER_END
        : value);
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

  function latexToCalculator(input, options) {
    try {
      const source = String(input == null ? '' : input);
      if (source.length > MAX_MATH_SOURCE_LENGTH) return '';
      return unicodeToCalculator(
        formatMathText(new LatexParser(source, { calculatorMode: true }).parse()),
        options
      );
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
      else rendered = latexToFaithful(source);
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
      // Do not materialize an untrusted element's entire child collection
      // before applying the node limit. A single forged renderer can have an
      // arbitrarily wide first level even though only a bounded prefix could
      // ever be accepted.
      for (let child = current.node.lastElementChild; child; child = child.previousElementSibling) {
        stack.push({ node: child, depth: current.depth + 1 });
        if (count + stack.length > nodeLimit) return false;
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

  function calculatorMatrixTableText(node) {
    if (!node || (node.localName || '').toLowerCase() !== 'mtable' ||
        mathMLAlignedEquationRows(node)) return '';
    const rows = elementChildren(node);
    if (!rows.length || rows.some((row) =>
      !['mtr', 'mlabeledtr'].includes((row.localName || '').toLowerCase())
    )) return '';
    const cells = rows.map((row) => elementChildren(row));
    const columns = cells[0] && cells[0].length;
    if (!columns || cells.some((row) => row.length !== columns || row.some((cell) =>
      (cell.localName || '').toLowerCase() !== 'mtd'
    ))) return '';
    return '[' + cells.map((row) => '[' + row.map((cell) =>
      serializeMathMLCalculatorNode(cell).text
    ).join(',') + ']').join(',') + ']';
  }

  function calculatorFencedMatrix(children, explicitOpen, explicitClose) {
    const meaningful = children.filter((child) =>
      !['mspace', 'mphantom', 'annotation', 'annotation-xml', 'none'].includes(
        (child.localName || '').toLowerCase()
      )
    );
    let table;
    let open = explicitOpen;
    let close = explicitClose;
    if (open != null || close != null) {
      if (meaningful.length !== 1 || (meaningful[0].localName || '').toLowerCase() !== 'mtable') return null;
      table = meaningful[0];
    } else {
      if (meaningful.length !== 3 ||
          (meaningful[0].localName || '').toLowerCase() !== 'mo' ||
          (meaningful[1].localName || '').toLowerCase() !== 'mtable' ||
          (meaningful[2].localName || '').toLowerCase() !== 'mo') return null;
      open = normalizedMathToken(meaningful[0].textContent || '');
      close = normalizedMathToken(meaningful[2].textContent || '');
      table = meaningful[1];
    }
    const matrix = calculatorMatrixTableText(table);
    if (!matrix) return null;
    const ordinaryPairs = new Map([['(', ')'], ['[', ']'], ['{', '}'], ['⟨', '⟩']]);
    if (ordinaryPairs.get(open) === close) return calculatorResult(matrix, 'operand');
    const singleBars = new Set(['|', '∣', '❘']);
    const doubleBars = new Set(['‖', '∥', '‗']);
    if (singleBars.has(open) && singleBars.has(close)) {
      return calculatorResult('det(' + matrix + ')', 'operand');
    }
    if (doubleBars.has(open) && doubleBars.has(close)) {
      return calculatorResult('norm(' + matrix + ')', 'operand');
    }
    return null;
  }

  function mathMLAlignedEquationRows(node) {
    if (!node || (node.localName || '').toLowerCase() !== 'mtable') return null;
    const rows = elementChildren(node);
    if (!rows.length || rows.some((row) =>
      !['mtr', 'mlabeledtr'].includes((row.localName || '').toLowerCase())
    )) return null;
    const cells = rows.map((row) => elementChildren(row));
    const columns = cells[0] && cells[0].length;
    if (!columns || cells.some((row) => row.length !== columns || row.some((cell) =>
      (cell.localName || '').toLowerCase() !== 'mtd'
    ))) return null;

    const columnAlign = String(node.getAttribute && node.getAttribute('columnalign') || '')
      .trim().toLowerCase().split(/\s+/u).filter(Boolean);
    const columnSpacing = String(node.getAttribute && node.getAttribute('columnspacing') || '')
      .trim().toLowerCase().split(/\s+/u).filter(Boolean);
    const paired = columns >= 2 && columns % 2 === 0 &&
      columnAlign.length === columns &&
      columnAlign.every((value, index) => value === (index % 2 ? 'left' : 'right'));
    const gathered = columns === 1 && columnAlign.length === 1 && columnAlign[0] === 'center';
    if (!paired && !gathered) return null;

    // MathML column alignment is also ordinary matrix presentation metadata.
    // It cannot, by itself, tell `aligned` from a two-column matrix whose
    // second entries happen to begin with =, <=, or another relation. Accept
    // only an independently authenticated renderer projection, explicit
    // MathML alignment markers, or KaTeX's exact display-alignment semantics.
    // Once authenticated, row content is deliberately unrestricted: a valid
    // continuation can begin with +/-, and an alignment point can use := or
    // any other authored operator.
    if (AUTHENTIC_ALIGNED_MATHML_TABLES.has(node)) return cells;
    if (node.querySelector && node.querySelector('maligngroup, malignmark')) return cells;

    const zero = /^0+(?:\.0+)?(?:px|pt|em|ex|%)?$/u;
    const zeroSpaced = columnSpacing.length > 0 && columnSpacing.every((value) => zero.test(value));
    const rowSpacing = String(node.getAttribute && node.getAttribute('rowspacing') || '')
      .trim().toLowerCase();
    const katexDisplayCells = rowSpacing === '0.25em' && zeroSpaced && cells.every((row) =>
      row.every((cell) => {
        const contents = elementChildren(cell);
        if (contents.length !== 1 || (contents[0].localName || '').toLowerCase() !== 'mstyle') return false;
        const style = contents[0];
        return String(style.getAttribute && style.getAttribute('displaystyle') || '').toLowerCase() === 'true' &&
          String(style.getAttribute && style.getAttribute('scriptlevel') || '') === '0';
      })
    );
    return katexDisplayCells ? cells : null;
  }

  function serializeMathMLAlignedEquationRows(rows, serializeCell, pairSeparator) {
    return rows.map((cells) => {
      if (cells.length === 1) return serializeCell(cells[0]);
      const pairs = [];
      for (let index = 0; index < cells.length; index += 2) {
        pairs.push(serializeCell(cells[index]) + pairSeparator + serializeCell(cells[index + 1]));
      }
      // alignedat can place several independently aligned equations on one
      // visual row. A cell-by-cell concatenation turns `x=1` beside `y=2`
      // into the false expression `x=1y=2`; keep each pair explicit.
      return pairs.join('; ');
    });
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
      const fencedMatrix = calculatorFencedMatrix(children);
      if (fencedMatrix) return fencedMatrix;
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
      if (upper && isDegreeScript(upper)) {
        const degreeBase = base.text + (lower ? '_(' + lower + ')' : '');
        const safeDegreeBase = calculatorSimpleTerm(degreeBase)
          ? degreeBase
          : '(' + degreeBase + ')';
        return calculatorResult(safeDegreeBase + '*degrees', 'operand');
      }
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
      const base = serializeMathMLCalculatorNode(children[0]);
      const overMarker = name === 'mover' && normalizedMathToken(children[1] && children[1].textContent || '') === '⏞';
      const underMarker = name === 'munder' && normalizedMathToken(children[1] && children[1].textContent || '') === '⏟';
      if (overMarker || underMarker) {
        return calculatorResult('(' + base.text + ')', 'operand', {
          braceKind: overMarker ? 'overbrace' : 'underbrace'
        });
      }
      // KaTeX represents a labelled brace as an outer mover/munder around the
      // inner brace node. The label is presentation, not an exponent or index
      // in an executable expression; retain the already-grouped base only.
      if (base.braceKind) return base;
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
      return calculatorResult(base.text, 'operand');
    }
    if (name === 'mfenced') {
      const open = node.getAttribute('open') == null ? '(' : node.getAttribute('open');
      const close = node.getAttribute('close') == null ? ')' : node.getAttribute('close');
      const fencedMatrix = calculatorFencedMatrix(children, open, close);
      if (fencedMatrix) return fencedMatrix;
      if (isVerticalBarToken(open) && isVerticalBarToken(close)) {
        return calculatorResult('abs(' + children.map((item) => serializeMathMLCalculatorNode(item).text).join(',') + ')', 'operand');
      }
      return calculatorResult(open + children.map((item) => serializeMathMLCalculatorNode(item).text).join(',') + close, 'operand');
    }
    if (name === 'mtable') {
      const alignedRows = mathMLAlignedEquationRows(node);
      if (alignedRows) {
        const rows = serializeMathMLAlignedEquationRows(
          alignedRows,
          (cell) => serializeMathMLCalculatorNode(cell).text,
          ''
        );
        return calculatorResult(joinReadableEquationRows(rows), 'operand');
      }
      const matrix = calculatorMatrixTableText(node);
      return calculatorResult(matrix || '[' + children.map((row) => '[' + elementChildren(row).map((cell) => serializeMathMLCalculatorNode(cell).text).join(',') + ']').join(',') + ']', 'operand');
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
    const result = serializeMathMLCalculatorNode(mathElement);
    const text = (result.braceKind ? stripBalancedOuterParentheses(result.text) : result.text)
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
      } else if (token.functionApplication && previous && faithfulCanEnd(previous) &&
                 output && !/\s$/u.test(output)) {
        output += ' ';
      } else if (token.fraction && previous && faithfulCanEnd(previous) &&
                 output && !/\s$/u.test(output)) {
        output += ' (' + token.text + ')';
        previous = faithfulResult('(' + token.text + ')', 'operand');
        explicitSpace = false;
        applyPending = false;
        invisibleTimesPending = false;
        continue;
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
    for (let index = 0; index + 1 < tokens.length; index += 1) {
      if (tokens[index + 1].kind !== 'apply') continue;
      const resolved = resolveFaithfulScopes(tokens[index].text || '').trim();
      const name = resolved.match(/^([A-Za-z]+)(?:[₀-₟⁰-⁹¹²³⁺⁻⁼⁽⁾ⁿⁱᵢⱼᵦ-ᵪ_^].*)?$/u);
      if (name && CALCULATOR_FUNCTIONS.has(name[1])) {
        tokens[index] = { ...tokens[index], functionApplication: true };
      }
    }
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
      '^': ['hat', '\u0302'], 'ˆ': ['hat', '\u0302'], '\u0302': ['hat', '\u0302'],
      '~': ['tilde', '\u0303'], '˜': ['tilde', '\u0303'], '\u0303': ['tilde', '\u0303'],
      '¯': ['overline', '\u0305'], '‾': ['overline', '\u0305'], 'ˉ': ['overline', '\u0305'], '\u0305': ['overline', '\u0305'],
      '→': ['vec', '\u20d7'], '\u20d7': ['vec', '\u20d7'],
      '←': ['overleftarrow', '\u20d6'], '\u20d6': ['overleftarrow', '\u20d6'],
      '˙': ['dot', '\u0307'], '\u0307': ['dot', '\u0307'],
      '¨': ['ddot', '\u0308'], '\u0308': ['ddot', '\u0308'],
      'ˊ': ['acute', '\u0301'], '\u0301': ['acute', '\u0301'],
      'ˋ': ['grave', '\u0300'], '\u0300': ['grave', '\u0300'],
      '˘': ['breve', '\u0306'], '\u0306': ['breve', '\u0306'],
      'ˇ': ['check', '\u030c'], '\u030c': ['check', '\u030c'],
      '˚': ['mathring', '\u030a'], '\u030a': ['mathring', '\u030a'],
      '⏞': ['overbrace', '⏞']
    };
    if (!accents[value]) return null;
    return faithfulAccent(accents[value][0], base && base.text || '', accents[value][1]);
  }

  function faithfulMathMLUnderAccent(base, lower) {
    const value = String(lower == null ? '' : lower).trim();
    if (value === '⏟') return faithfulAccent('underbrace', base && base.text || '', '⏟');
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
        { scriptFence: true, fraction: true }
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
        const braceKind = upper.trim() === '⏞' ? 'overbrace' : (lower.trim() === '⏟' ? 'underbrace' : '');
        return faithfulResult(accent || underAccent, 'operand', {
          variableLike: base.variableLike,
          ...(braceKind ? { braceKind } : null)
        });
      }
      const large = Boolean(mathMLLargeOperatorName(children[0]) || /^(?:∑|∏|∐|∫|∬|∭|∮|lim)$/u.test(base.text));
      if (!large) {
        const annotationKind = ['relation', 'operator'].includes(base.kind) ? base.kind : 'operand';
        if (base.braceKind) {
          return faithfulResult(
            faithfulScriptBaseText(base) +
              (lower ? toFaithfulScript(lower, SUBSCRIPTS, '_') : '') +
              (upper ? toFaithfulScript(upper, SUPERSCRIPTS, '^') : ''),
            annotationKind,
            { braceKind: base.braceKind, variableLike: base.variableLike }
          );
        }
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
      const alignedRows = mathMLAlignedEquationRows(node);
      const rows = alignedRows
        ? serializeMathMLAlignedEquationRows(
          alignedRows,
          (cell) => serializeMathMLFaithfulNode(cell).text,
          ' '
        )
        : children.map((row) => elementChildren(row)
          .map((cell) => serializeMathMLFaithfulNode(cell).text).join(', '));
      const tableText = alignedRows ? joinReadableEquationRows(rows) : rows.join('; ');
      return faithfulResult(alignedRows ? tableText : '[' + tableText + ']', 'operand', { tableText });
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

  function scriptAwareMathSelectionKey(input) {
    const superscriptMarker = '\ue130';
    const subscriptMarker = '\ue131';
    let value = Array.from(cleanClipboardText(String(input == null ? '' : input)), (character) => {
      if (SUPERSCRIPT_GLYPH_BASES.has(character)) {
        return superscriptMarker + SUPERSCRIPT_GLYPH_BASES.get(character);
      }
      if (SUBSCRIPT_GLYPH_BASES.has(character)) {
        return subscriptMarker + SUBSCRIPT_GLYPH_BASES.get(character);
      }
      if (character === '^') return superscriptMarker;
      if (character === '_') return subscriptMarker;
      return character;
    }).join('');
    try {
      value = value.normalize('NFKC');
    } catch (_error) {
      // Retaining the original code points is conservative on legacy engines.
    }
    return value
      .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2061-\u2069\ufe00-\ufe0f]/gu, '')
      .replace(/[\s\u00a0\u2000-\u200a\u202f\u205f\u3000]/gu, '')
      .replace(/[\u2212\u2010-\u2015]/gu, '-')
      .replace(/[\u00d7\u00b7\u22c5\u2217]/gu, '*')
      .replace(/\u00f7/gu, '/')
      .replace(/[\u2223\u2758]/gu, '|')
      .replaceAll(superscriptMarker, '^')
      .replaceAll(subscriptMarker, '_')
      .replace(/([_^])\(([^()])\)/gu, '$1$2');
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
    if (['mi', 'mn', 'mo', 'mtext', 'ms', 'mglyph'].includes(name) && !children.length) {
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

  // Renderer box trees have a deterministic textual order even when that
  // order differs from semantic MathML: KaTeX fractions are denominator-first,
  // indexed roots are index-first, and tables are column-major. Keep this
  // model deliberately narrow. Trying both numerator orders would make stale
  // x/y semantics indistinguishable from a visible y/x fraction.
  function rendererOrderedMathMLSurfaceVariants(node, katexOrder, rawTokenSurface = false) {
    if (!node || node.nodeType !== 1) return [''];
    const name = (node.localName || '').toLowerCase();
    const children = elementChildren(node).filter((child) =>
      !['annotation', 'annotation-xml', 'mphantom', 'none', 'mspace'].includes((child.localName || '').toLowerCase())
    );
    if (['mi', 'mn', 'mo', 'mtext', 'ms', 'mglyph'].includes(name) && !children.length) {
      return [mathSelectionKey(rawTokenSurface ? (node.textContent || '') : mathMLTokenText(node))];
    }
    if (['mspace', 'annotation', 'annotation-xml', 'mphantom', 'none'].includes(name)) return [''];
    if (name === 'semantics') {
      const presentation = presentationMathNode(node);
      return presentation ? rendererOrderedMathMLSurfaceVariants(presentation, katexOrder, rawTokenSurface) : [''];
    }
    if (name === 'maction') return children.length
      ? rendererOrderedMathMLSurfaceVariants(children[0], katexOrder, rawTokenSurface)
      : [''];
    if (name === 'mfrac' && children.length >= 2) {
      return combineSurfaceVariants([
        rendererOrderedMathMLSurfaceVariants(children[1], katexOrder, rawTokenSurface),
        rendererOrderedMathMLSurfaceVariants(children[0], katexOrder, rawTokenSurface)
      ], 32);
    }
    if (['msup', 'msub', 'msubsup'].includes(name) && children.length >= 2) {
      const normal = combineSurfaceVariants(children.map((child) =>
        rendererOrderedMathMLSurfaceVariants(child, katexOrder, rawTokenSurface)), 32);
      const base = children[0];
      const baseText = base && (base.textContent || '');
      const svgSizedVerticalBar = rawTokenSurface && isVerticalBarToken(baseText) &&
        base.getAttribute && base.getAttribute('stretchy') === 'true' &&
        Boolean(base.getAttribute('minsize') || base.getAttribute('maxsize'));
      if (!svgSizedVerticalBar) return normal;
      const scriptsOnly = combineSurfaceVariants(children.slice(1).map((child) =>
        rendererOrderedMathMLSurfaceVariants(child, katexOrder, rawTokenSurface)), 32);
      return Array.from(new Set(normal.concat(scriptsOnly))).slice(0, 32);
    }
    if (name === 'mroot' && children.length >= 2) {
      return combineSurfaceVariants([
        rendererOrderedMathMLSurfaceVariants(children[1], katexOrder, rawTokenSurface),
        rendererOrderedMathMLSurfaceVariants(children[0], katexOrder, rawTokenSurface)
      ], 32);
    }
    if (name === 'mtable') {
      const rows = children.filter((child) => ['mtr', 'mlabeledtr'].includes((child.localName || '').toLowerCase()));
      if (!rows.length) return [''];
      const cells = rows.map((row) => elementChildren(row).filter((child) =>
        (child.localName || '').toLowerCase() === 'mtd'
      ));
      const groups = [];
      const columns = Math.max(0, ...cells.map((row) => row.length));
      for (let column = 0; column < columns; column += 1) {
        for (let row = 0; row < cells.length; row += 1) {
          if (cells[row][column]) groups.push(rendererOrderedMathMLSurfaceVariants(
            cells[row][column], katexOrder, rawTokenSurface
          ));
        }
      }
      return combineSurfaceVariants(groups, 32);
    }
    if (name === 'msqrt') {
      const body = combineSurfaceVariants(children.map((child) =>
        rendererOrderedMathMLSurfaceVariants(child, katexOrder, rawTokenSurface)), 32);
      // SVG/CSS radicals contribute no text in KaTeX; a text-backed renderer
      // can expose the radical glyph without changing operand order.
      return Array.from(new Set(body.concat(body.map((value) => mathSelectionKey('√') + value)))).slice(0, 32);
    }
    if (['mover', 'munder', 'munderover'].includes(name) && children.length) {
      const base = rendererOrderedMathMLSurfaceVariants(children[0], katexOrder, rawTokenSurface);
      const marks = children.slice(1).map((child) =>
        rendererOrderedMathMLSurfaceVariants(child, katexOrder, rawTokenSurface));
      let orderedGroups = [base, ...marks];
      if (katexOrder && name === 'munder') orderedGroups = [...marks, base];
      else if (katexOrder && name === 'munderover' && marks.length >= 2) {
        orderedGroups = [marks[0], base, marks[1]];
      }
      const variants = [...combineSurfaceVariants(orderedGroups, 24), ...base];
      return Array.from(new Set(variants)).slice(0, 32);
    }
    const groups = children.map((child) =>
      rendererOrderedMathMLSurfaceVariants(child, katexOrder, rawTokenSurface));
    return groups.length ? combineSurfaceVariants(groups, 32) : [mathSelectionKey(
      rawTokenSurface ? (node.textContent || '') : mathMLTokenText(node)
    )];
  }

  // KaTeX's hidden MathML and visual HTML are separate trees. Flattened text
  // agreement alone cannot distinguish x^y from x_y, x/(y/z) from (x/y)/z,
  // or even sqrt(x) from plain x. These helpers compare stable visual layout
  // markers with bounded MathML spans in an anchor-only coordinate system.
  // Fences, radicals, and accent marks are excluded because KaTeX may draw
  // them with CSS/SVG; identifiers, numbers, and written operators remain.
  function topologyAnchorKey(input) {
    let value = cleanClipboardText(String(input == null ? '' : input));
    try { value = value.normalize('NFKC'); } catch (_error) { /* retain source */ }
    const excluded = new Set(Array.from(
      '√∛∜|∣❘∥‖()[]{}⟨⟩⌈⌉⌊⌋^~ˆ˜¯ˉ˙¨´ˊˋ˘ˇ˚ˍ'
    ));
    const output = [];
    for (const character of value) {
      if (excluded.has(character) || /[\u239b-\u23ad]/u.test(character) ||
          /^[\p{M}\p{Z}\p{Cf}]$/u.test(character) ||
          /[\ue000-\uf8ff]/u.test(character)) continue;
      if (/^[\p{L}\p{N}\p{S}]$/u.test(character) || /[=<>+−‐-―*/÷×·⋅∗±∓′-‴]/u.test(character)) {
        output.push(mathSelectionKey(character));
      }
    }
    return output.join('');
  }

  function rendererFenceKey(input) {
    return mathSelectionKey(input)
      .replace(/[\u239b-\u239d]+/gu, '(')
      .replace(/[\u239e-\u23a0]+/gu, ')')
      .replace(/[\u23a1-\u23a3]+/gu, '[')
      .replace(/[\u23a4-\u23a6]+/gu, ']')
      .replace(/[\u23a7-\u23ad]+/gu, (pieces) =>
        /[\u23a7-\u23a9]/u.test(pieces) ? '{' : (/[\u23ab-\u23ad]/u.test(pieces) ? '}' : '')
      );
  }

  function matchingFenceOpeningIndex(value, closingIndex) {
    const closing = value[closingIndex] || '';
    const openingFor = { ')': '(', ']': '[', '}': '{', '⟩': '⟨', '⌉': '⌈', '⌋': '⌊' };
    const opening = openingFor[closing];
    if (!opening) {
      if (!['|', '‖'].includes(closing)) return -1;
      return value.lastIndexOf(closing, closingIndex - 1);
    }
    let depth = 1;
    for (let index = closingIndex - 1; index >= 0; index -= 1) {
      if (value[index] === closing) depth += 1;
      else if (value[index] === opening) {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
    return -1;
  }

  function rendererOrderedMathMLTopologyLayouts(node) {
    const cache = new WeakMap();
    const budget = { work: 0, exhausted: false };
    const spend = (amount = 1) => {
      budget.work += amount;
      if (budget.work > MAX_PARTIAL_MATCH_WORK) budget.exhausted = true;
      return !budget.exhausted;
    };
    const shift = (layout, amount) => ({
      text: layout.text,
      spans: layout.spans.map((span) => ({
        node: span.node,
        start: span.start + amount,
        end: span.end + amount
      }))
    });
    const combine = (groups, limit) => {
      let combined = [{ text: '', spans: [] }];
      for (const group of groups) {
        const next = [];
        for (const prefix of combined) {
          for (const suffix of group.length ? group : [{ text: '', spans: [] }]) {
            if (!spend()) return [];
            const shifted = shift(suffix, prefix.text.length);
            next.push({
              text: prefix.text + suffix.text,
              spans: prefix.spans.concat(shifted.spans)
            });
            if (next.length >= limit) break;
          }
          if (next.length >= limit) break;
        }
        combined = next;
        if (!combined.length || budget.exhausted) break;
      }
      return combined;
    };
    const layoutsFor = (current) => {
      if (!current || current.nodeType !== 1 || !spend()) return [];
      if (cache.has(current)) return cache.get(current);
      const name = (current.localName || '').toLowerCase();
      const children = elementChildren(current).filter((child) =>
        !['annotation', 'annotation-xml', 'mphantom', 'none', 'mspace']
          .includes((child.localName || '').toLowerCase())
      );
      let layouts = [];
      if (['mi', 'mn', 'mo', 'mtext', 'ms', 'mglyph'].includes(name) && !children.length) {
        // Layout authentication compares rendered anchors, not requested
        // typographic variants. Unsupported script/fraktur Greek remains the
        // same visible Greek token rather than becoming `script(alpha)`.
        const text = topologyAnchorKey(current.textContent || '');
        layouts = [{ text, spans: [{ node: current, start: 0, end: text.length }] }];
      } else if (['mspace', 'annotation', 'annotation-xml', 'mphantom', 'none'].includes(name)) {
        layouts = [{ text: '', spans: [] }];
      } else if (name === 'semantics') {
        layouts = layoutsFor(presentationMathNode(current));
      } else if (name === 'mfrac' && children.length >= 2) {
        // KaTeX's visual vlist exposes denominator before numerator.
        layouts = combine([layoutsFor(children[1]), layoutsFor(children[0])], 32);
      } else if (name === 'mroot' && children.length >= 2) {
        layouts = combine([layoutsFor(children[1]), layoutsFor(children[0])], 32);
      } else if (name === 'mtable') {
        const rows = children.filter((child) =>
          ['mtr', 'mlabeledtr'].includes((child.localName || '').toLowerCase())
        );
        const cells = rows.map((row) => elementChildren(row).filter((child) =>
          (child.localName || '').toLowerCase() === 'mtd'
        ));
        const groups = [];
        const columns = Math.max(0, ...cells.map((row) => row.length));
        for (let column = 0; column < columns; column += 1) {
          for (let row = 0; row < cells.length; row += 1) {
            if (cells[row][column]) groups.push(layoutsFor(cells[row][column]));
          }
        }
        layouts = combine(groups, 32);
      } else if (['mover', 'munder', 'munderover'].includes(name) && children.length) {
        const base = layoutsFor(children[0]);
        const marks = children.slice(1).map(layoutsFor);
        let groups = [base, ...marks];
        if (name === 'munder') groups = [...marks, base];
        else if (name === 'munderover' && marks.length >= 2) groups = [marks[0], base, marks[1]];
        // Many accents and braces are SVG-only, so retain both the complete
        // textual layout and the independently visible base-only layout.
        layouts = combine(groups, 24).concat(base).slice(0, 32);
      } else {
        layouts = combine(children.map(layoutsFor), 32);
      }
      if (!['semantics', 'mspace', 'annotation', 'annotation-xml', 'mphantom', 'none'].includes(name)) {
        layouts = layouts.map((layout) => ({
          text: layout.text,
          spans: layout.spans.concat({ node: current, start: 0, end: layout.text.length })
        }));
      }
      cache.set(current, layouts);
      return layouts;
    };
    const layouts = layoutsFor(node);
    return budget.exhausted ? null : layouts;
  }

  const KATEX_TOPOLOGY_MATHML_SELECTOR = [
    'mfrac', 'msqrt', 'mroot', 'msup', 'msub', 'msubsup',
    'mover', 'munder', 'munderover', 'mtable', 'menclose', 'mmultiscripts'
  ].join(',');

  function katexScriptMarkerKind(marker) {
    const vlistTable = elementChildren(marker).find((child) =>
      child.classList && child.classList.contains('vlist-t')
    );
    if (!vlistTable) return '';
    const firstRow = elementChildren(vlistTable).find((child) =>
      child.classList && child.classList.contains('vlist-r')
    );
    const vlist = firstRow && elementChildren(firstRow).find((child) =>
      child.classList && child.classList.contains('vlist')
    );
    if (!vlist) return '';
    const layers = elementChildren(vlist).length;
    const hasDepthRow = vlistTable.classList.contains('vlist-t2');
    if (!hasDepthRow && layers === 1) return 'msup';
    if (hasDepthRow && layers === 1) return 'msub';
    if (hasDepthRow && layers === 2) return 'msubsup';
    return '';
  }

  function katexOverUnderMarkerKind(marker) {
    const vlistTable = elementChildren(marker).find((child) =>
      child.classList && child.classList.contains('vlist-t')
    );
    const firstRow = vlistTable && elementChildren(vlistTable).find((child) =>
      child.classList && child.classList.contains('vlist-r')
    );
    const vlist = firstRow && elementChildren(firstRow).find((child) =>
      child.classList && child.classList.contains('vlist')
    );
    if (!vlistTable || !vlist) return '';
    const layers = elementChildren(vlist);
    if (layers.length === 3) return 'munderover';
    if (layers.length === 2) {
      const baselineDistance = (layer) => {
        const top = String(layer.getAttribute('style') || '').match(/(?:^|;)\s*top:\s*(-?\d+(?:\.\d+)?)em/u);
        const pstrut = layer.querySelector && layer.querySelector('.pstrut');
        const height = String(pstrut && pstrut.getAttribute('style') || '')
          .match(/(?:^|;)\s*height:\s*(\d+(?:\.\d+)?)em/u);
        return top && height ? Math.abs(Number(top[1]) + Number(height[1])) : Number.POSITIVE_INFINITY;
      };
      const firstDistance = baselineDistance(layers[0]);
      const secondDistance = baselineDistance(layers[1]);
      if (!Number.isFinite(firstDistance) || firstDistance === secondDistance) return '';
      return firstDistance < secondDistance ? 'mover' : 'munder';
    }
    return '';
  }

  function katexTableMarkerDetail(marker) {
    const columns = elementChildren(marker).filter((child) =>
      Array.from(child.classList || []).some((name) => /^col-align-/u.test(name))
    );
    if (!columns.length) return '';
    const cellsByColumn = [];
    for (const column of columns) {
      const vlistTable = elementChildren(column).find((child) =>
        child.classList && child.classList.contains('vlist-t')
      );
      const firstRow = vlistTable && elementChildren(vlistTable).find((child) =>
        child.classList && child.classList.contains('vlist-r')
      );
      const vlist = firstRow && elementChildren(firstRow).find((child) =>
        child.classList && child.classList.contains('vlist')
      );
      const cells = vlist && elementChildren(vlist);
      if (!cells || !cells.length) return '';
      cellsByColumn.push(cells);
    }
    const rows = cellsByColumn[0].length;
    if (!rows || cellsByColumn.some((column) => column.length !== rows)) return '';
    const values = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < cellsByColumn.length; column += 1) {
        values.push(topologyAnchorKey(cellsByColumn[column][row].textContent || ''));
      }
    }
    return rows + 'x' + cellsByColumn.length + ':' + values.join('|');
  }

  function katexEnclosureMarkerDetails(visualBranch) {
    const details = new Map();
    const ownerFor = (node) => {
      const vlistTable = node && node.closest && node.closest('.vlist-t');
      const owner = vlistTable && vlistTable.parentElement;
      return owner && nodeInside(visualBranch, owner) ? owner : null;
    };
    for (const line of Array.from(visualBranch.querySelectorAll('svg line'))) {
      const owner = ownerFor(line);
      if (!owner) return null;
      const y1 = line.getAttribute('y1') || '';
      const y2 = line.getAttribute('y2') || '';
      let notation = '';
      if (y1 === '100%' && y2 === '0') notation = 'updiagonalstrike';
      else if (y1 === '0' && y2 === '100%') notation = 'downdiagonalstrike';
      else return null;
      if (!details.has(owner)) details.set(owner, new Set());
      details.get(owner).add(notation);
    }
    for (const frame of Array.from(visualBranch.querySelectorAll('.stretchy.fbox'))) {
      const owner = ownerFor(frame);
      if (!owner || !owner.querySelector('.boxpad')) return null;
      if (!details.has(owner)) details.set(owner, new Set());
      details.get(owner).add('box');
    }
    return Array.from(details, ([owner, values]) => ({
      owner,
      detail: Array.from(values).sort().join(' ')
    }));
  }

  function accentGlyphKind(value) {
    const glyph = cleanClipboardText(value || '').trim();
    return ({
      '^': 'hat', 'ˆ': 'hat', '~': 'tilde', '˜': 'tilde',
      '⃗': 'vec-right', '→': 'arrow-right', '←': 'arrow-left',
      '‾': 'overline', '¯': 'bar', 'ˉ': 'bar',
      '˙': 'dot', '¨': 'ddot', 'ˊ': 'acute', 'ˋ': 'grave',
      '˘': 'breve', 'ˇ': 'check', '˚': 'ring',
      '⏞': 'overbrace', '⏟': 'underbrace'
    })[glyph] || '';
  }

  function katexAccentMarkerDetail(marker) {
    if (marker.classList.contains('overline')) return 'overline';
    if (marker.classList.contains('underline')) return 'underline';
    const ownsBrace = Array.from(marker.querySelectorAll('.brace-left')).some((brace) =>
      brace.closest('.mover,.munder') === marker
    );
    if (marker.classList.contains('mover') && ownsBrace) return 'overbrace';
    if (marker.classList.contains('munder') && ownsBrace) return 'underbrace';
    if (!marker.classList.contains('accent')) return '';
    const ownedByMarker = (node) => node && node.closest && node.closest('.accent') === marker;
    const body = Array.from(marker.querySelectorAll('.accent-body')).find(ownedByMarker) || null;
    if (body && body.querySelector('.overlay svg')) return 'vec-right';
    const textKind = accentGlyphKind(body && body.textContent || '');
    if (textKind) return textKind;
    const path = Array.from(marker.querySelectorAll('svg path')).find(ownedByMarker) || null;
    const pathData = String(path && path.getAttribute('d') || '').trim();
    if (/^M400000\s/u.test(pathData)) return 'arrow-left';
    if (/^M0\s+241/u.test(pathData)) return 'arrow-right';
    if (/^M\d+\s+0h/u.test(pathData)) return 'widehat';
    if (/^M200\s+55/u.test(pathData)) return 'widetilde';
    return '';
  }

  function semanticAccentDetail(node) {
    const name = (node.localName || '').toLowerCase();
    const children = elementChildren(node);
    if (!['mover', 'munder'].includes(name) || children.length < 2) return '';
    const mark = children[1];
    const kind = accentGlyphKind(mark.textContent || '');
    const accent = name === 'mover'
      ? node.getAttribute('accent') === 'true'
      : node.getAttribute('accentunder') === 'true';
    if (accent && mark.getAttribute && mark.getAttribute('stretchy') === 'true') {
      if (name === 'munder' && kind === 'overline') return 'underline';
      if (kind === 'hat') return 'widehat';
      if (kind === 'tilde') return 'widetilde';
      if (kind === 'arrow-left' || kind === 'arrow-right' || kind === 'overline') return kind;
    }
    if (accent) return name === 'munder' && kind === 'overline' ? 'underline' : kind;
    if (kind === 'overbrace' || kind === 'underbrace') return kind;
    return '';
  }

  function katexVisualTopologyRecords(visualBranch) {
    if (!visualBranch || !visualBranch.matches || !visualBranch.matches('.katex-html') ||
        !domTreeWithinBudget(visualBranch, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return null;
    const documentObject = visualBranch.ownerDocument;
    const records = [];
    const add = (kind, marker, owner, detail = '') => {
      if (!kind || !marker || !owner || !nodeInside(visualBranch, marker)) return false;
      const prefix = documentObject.createRange();
      try {
        prefix.selectNodeContents(visualBranch);
        prefix.setEndBefore(marker);
      } catch (_error) {
        return false;
      }
      const prefixText = prefix.toString();
      const prefixAnchors = topologyAnchorKey(prefixText);
      const start = prefixAnchors.length;
      const end = start + topologyAnchorKey(marker.textContent || '').length;
      if (end <= start || end > MAX_SELECTION_KEY_LENGTH) return false;
      let baseStart = null;
      let baseEnd = null;
      if (['msup', 'msub', 'msubsup'].includes(kind)) {
        baseEnd = start;
        const ownerPrefixRange = documentObject.createRange();
        try {
          ownerPrefixRange.selectNodeContents(owner);
          ownerPrefixRange.setEndBefore(marker);
        } catch (_error) {
          return false;
        }
        const ownerPrefixText = ownerPrefixRange.toString();
        const ownerAnchors = topologyAnchorKey(ownerPrefixText);
        baseStart = Math.max(0, baseEnd - ownerAnchors.length);

        // Older KaTeX splits the last digit of a multi-digit <mn> into the
        // script owner (`1` + owner `0` for 10^n). Extend only across adjacent
        // digit-only siblings in this exact layout branch. Scanning the whole
        // text prefix would incorrectly cross fraction/vlist boundaries.
        if (/^\d+$/u.test(ownerAnchors)) {
          let sibling = owner.previousElementSibling;
          while (sibling) {
            const siblingAnchors = topologyAnchorKey(sibling.textContent || '');
            if (!/^\d+$/u.test(siblingAnchors) || siblingAnchors.length > baseStart) break;
            const siblingEndRange = documentObject.createRange();
            try {
              siblingEndRange.selectNodeContents(visualBranch);
              siblingEndRange.setEndAfter(sibling);
            } catch (_error) {
              return false;
            }
            if (topologyAnchorKey(siblingEndRange.toString()).length !== baseStart) break;
            baseStart -= siblingAnchors.length;
            sibling = sibling.previousElementSibling;
          }
        }

        // A script on a closing fence is attached to the whole matched group
        // in readable notation even though KaTeX makes only the close glyph
        // the DOM owner. Recover that group without treating an SVG-only
        // evaluation bar as a fence—the latter has no textual close glyph.
        const fencePrefix = rendererFenceKey(prefixText);
        const ownerFence = rendererFenceKey(ownerPrefixText).slice(-1);
        if (ownerFence && fencePrefix.endsWith(ownerFence)) {
          const openingIndex = matchingFenceOpeningIndex(fencePrefix, fencePrefix.length - 1);
          if (openingIndex >= 0) {
            baseStart = topologyAnchorKey(fencePrefix.slice(0, openingIndex + 1)).length;
          }
        }
      }
      records.push({ kind, start, end, baseStart, baseEnd, detail, node: marker, owner });
      return true;
    };
    for (const marker of Array.from(visualBranch.querySelectorAll('.mfrac'))) {
      if (!add('mfrac', marker, marker)) return null;
    }
    for (const marker of Array.from(visualBranch.querySelectorAll('.sqrt'))) {
      const indexed = elementChildren(marker).some((child) =>
        child.classList && child.classList.contains('root')
      );
      if (!add(indexed ? 'mroot' : 'msqrt', marker, marker)) return null;
    }
    for (const marker of Array.from(visualBranch.querySelectorAll('.msupsub'))) {
      if (!add(katexScriptMarkerKind(marker), marker, marker.parentElement)) return null;
    }
    for (const marker of Array.from(visualBranch.querySelectorAll('.accent, .overline'))) {
      const detail = katexAccentMarkerDetail(marker);
      if (!detail || !add('mover', marker, marker, detail)) return null;
    }
    for (const marker of Array.from(visualBranch.querySelectorAll('.underline'))) {
      const detail = katexAccentMarkerDetail(marker);
      if (!detail || !add('munder', marker, marker, detail)) return null;
    }
    for (const marker of Array.from(visualBranch.querySelectorAll('.mover'))) {
      const detail = katexAccentMarkerDetail(marker);
      const labelledBrace = !detail && Array.from(marker.querySelectorAll('.mover,.munder')).some((nested) =>
        nested !== marker && /^(?:overbrace|underbrace)$/u.test(katexAccentMarkerDetail(nested))
      );
      if ((!detail && !labelledBrace) || !add('mover', marker, marker, detail)) return null;
    }
    for (const marker of Array.from(visualBranch.querySelectorAll('.munder'))) {
      const detail = katexAccentMarkerDetail(marker);
      const labelledBrace = !detail && Array.from(marker.querySelectorAll('.mover,.munder')).some((nested) =>
        nested !== marker && /^(?:overbrace|underbrace)$/u.test(katexAccentMarkerDetail(nested))
      );
      if ((!detail && !labelledBrace) || !add('munder', marker, marker, detail)) return null;
    }
    for (const marker of Array.from(visualBranch.querySelectorAll('.op-limits'))) {
      if (!add(katexOverUnderMarkerKind(marker), marker, marker)) return null;
    }
    for (const marker of Array.from(visualBranch.querySelectorAll('.mtable'))) {
      const detail = katexTableMarkerDetail(marker);
      if (!detail || !add('mtable', marker, marker, detail)) return null;
    }
    const enclosures = katexEnclosureMarkerDetails(visualBranch);
    if (!enclosures) return null;
    for (const enclosure of enclosures) {
      if (!add('menclose', enclosure.owner, enclosure.owner, enclosure.detail)) return null;
    }
    return records;
  }

  function topologyRecordForestSignature(records, semantic) {
    if (!Array.isArray(records)) return null;
    const byNode = new Map(records.map((record) => [record.node, record]));
    const keyFor = (record) => record.kind + ':' + record.start + ':' + record.end +
      (record.baseStart == null ? '' : ':' + record.baseStart + ':' + record.baseEnd) +
      (record.detail ? '#' + record.detail : '');
    const parentFor = (record) => {
      if (semantic) {
        let ancestor = record.node.parentElement;
        while (ancestor) {
          if (byNode.has(ancestor)) return byNode.get(ancestor);
          ancestor = ancestor.parentElement;
        }
        return null;
      }
      const candidates = records.filter((candidate) => candidate !== record &&
        candidate.owner !== record.owner && candidate.owner.contains &&
        candidate.owner.contains(record.owner));
      if (!candidates.length) return null;
      candidates.sort((left, right) => {
        if (left.owner.contains(right.owner)) return 1;
        if (right.owner.contains(left.owner)) return -1;
        return 0;
      });
      const closest = candidates[0];
      if (candidates[1] && !candidates[1].owner.contains(closest.owner)) return false;
      return closest;
    };
    const children = new Map(records.map((record) => [record, []]));
    const roots = [];
    for (const record of records) {
      const parent = parentFor(record);
      if (parent === false) return null;
      if (parent) children.get(parent).push(record);
      else roots.push(record);
    }
    const active = new Set();
    const serialize = (record) => {
      if (active.has(record)) return null;
      active.add(record);
      const nested = [];
      for (const child of children.get(record) || []) {
        const value = serialize(child);
        if (value === null) return null;
        nested.push(value);
      }
      active.delete(record);
      nested.sort();
      return keyFor(record) + '[' + nested.join(',') + ']';
    };
    const values = [];
    for (const root of roots) {
      const value = serialize(root);
      if (value === null) return null;
      values.push(value);
    }
    values.sort();
    return values.join(';');
  }

  function katexMathMLTopologyAgrees(math, visualBranch) {
    const presentation = presentationMathNode(math);
    if (!presentation || !domTreeWithinBudget(presentation, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return false;
    const visualRecords = katexVisualTopologyRecords(visualBranch);
    if (!visualRecords) return false;
    const visualSignature = topologyRecordForestSignature(visualRecords, false);
    if (visualSignature === null) return false;
    const visibleKey = topologyAnchorKey(visualBranch.textContent || '');
    if (visibleKey.length > MAX_SELECTION_KEY_LENGTH) return false;
    const structureNodes = [];
    if (presentation.matches && presentation.matches(KATEX_TOPOLOGY_MATHML_SELECTOR)) structureNodes.push(presentation);
    structureNodes.push(...Array.from(presentation.querySelectorAll(KATEX_TOPOLOGY_MATHML_SELECTOR)));
    const layouts = rendererOrderedMathMLTopologyLayouts(presentation);
    if (!layouts) return false;
    for (const layout of layouts) {
      if (layout.text !== visibleKey) continue;
      const semanticRecords = [];
      let complete = true;
      for (const node of structureNodes) {
        const name = (node.localName || '').toLowerCase();
        const span = layout.spans.find((candidate) => candidate.node === node);
        if (!span) { complete = false; break; }
        let start = span.start;
        let baseStart = null;
        let baseEnd = null;
        let detail = '';
        if (['msup', 'msub', 'msubsup'].includes(name)) {
          const base = elementChildren(node)[0];
          const baseSpan = layout.spans.find((candidate) => candidate.node === base);
          if (!baseSpan) { complete = false; break; }
          start = baseSpan.end;
          baseStart = baseSpan.start;
          baseEnd = baseSpan.end;

          // KaTeX <= 0.16 can express 10^n as sibling <mn>1</mn> followed by
          // <msup><mn>0</mn>...</msup>, while its visible HTML attaches the
          // script to the complete numeric run. Mirror that representation,
          // but never cross an operator, wrapper, or layout boundary.
          let numericBase = base;
          while (numericBase && ['mrow', 'mstyle', 'mpadded'].includes(
            (numericBase.localName || '').toLowerCase()
          ) && elementChildren(numericBase).length === 1) {
            numericBase = elementChildren(numericBase)[0];
          }
          if (numericBase && (numericBase.localName || '').toLowerCase() === 'mn' &&
              /^\d+$/u.test(topologyAnchorKey(mathMLTokenText(numericBase)))) {
            let sibling = node.previousElementSibling;
            while (sibling && (sibling.localName || '').toLowerCase() === 'mn' &&
                   /^\d+$/u.test(topologyAnchorKey(mathMLTokenText(sibling)))) {
              const siblingSpan = layout.spans.find((candidate) => candidate.node === sibling);
              if (!siblingSpan || siblingSpan.end !== baseStart) break;
              baseStart = siblingSpan.start;
              sibling = sibling.previousElementSibling;
            }
          }

          let token = base;
          while (token && ['mrow', 'mstyle', 'mpadded'].includes((token.localName || '').toLowerCase()) &&
                 elementChildren(token).length === 1) token = elementChildren(token)[0];
          const tokenValue = token && (token.localName || '').toLowerCase() === 'mo'
            ? rendererFenceKey(mathMLTokenText(token))
            : '';
          const closing = tokenValue.slice(-1);
          if ([')', ']', '}', '⟩', '⌉', '⌋', '|', '‖'].includes(closing)) {
            const tokens = [];
            if (presentation.matches && presentation.matches('mo')) tokens.push(presentation);
            tokens.push(...Array.from(presentation.querySelectorAll('mo')));
            const tokenIndex = tokens.indexOf(token);
            if (tokenIndex >= 0) {
              let depth = 1;
              const openingFor = { ')': '(', ']': '[', '}': '{', '⟩': '⟨', '⌉': '⌈', '⌋': '⌊' };
              const opening = openingFor[closing] || closing;
              for (let index = tokenIndex - 1; index >= 0; index -= 1) {
                const value = rendererFenceKey(mathMLTokenText(tokens[index])).slice(-1);
                if (opening === closing) {
                  if (value !== closing) continue;
                  const openingSpan = layout.spans.find((candidate) => candidate.node === tokens[index]);
                  if (openingSpan) baseStart = openingSpan.end;
                  break;
                }
                if (value === closing) depth += 1;
                else if (value === opening) {
                  depth -= 1;
                  if (depth === 0) {
                    const openingSpan = layout.spans.find((candidate) => candidate.node === tokens[index]);
                    if (openingSpan) baseStart = openingSpan.end;
                    break;
                  }
                }
              }
            }
          }
        }
        if (name === 'mtable') {
          const rows = elementChildren(node).filter((row) =>
            ['mtr', 'mlabeledtr'].includes((row.localName || '').toLowerCase())
          );
          const cells = rows.map((row) => elementChildren(row).filter((cell) =>
            (cell.localName || '').toLowerCase() === 'mtd'
          ));
          const columns = cells.length ? cells[0].length : 0;
          if (!rows.length || !columns || cells.some((row) => row.length !== columns)) {
            complete = false;
            break;
          }
          const cellValues = [];
          for (const row of cells) {
            for (const cell of row) {
              const cellSpan = layout.spans.find((candidate) => candidate.node === cell);
              if (!cellSpan) { complete = false; break; }
              cellValues.push(layout.text.slice(cellSpan.start, cellSpan.end));
            }
            if (!complete) break;
          }
          if (!complete) break;
          detail = rows.length + 'x' + columns + ':' + cellValues.join('|');
        }
        if (name === 'menclose') {
          detail = String(node.getAttribute('notation') || '')
            .trim().split(/\s+/u).filter(Boolean).sort().join(' ');
          if (!detail) { complete = false; break; }
        }
        if (name === 'mover' || name === 'munder') detail = semanticAccentDetail(node);
        if (span.end <= start) { complete = false; break; }
        semanticRecords.push({
          kind: name, start, end: span.end, baseStart, baseEnd, detail, node, owner: node
        });
      }
      if (!complete) continue;
      const semanticSignature = topologyRecordForestSignature(semanticRecords, true);
      if (semanticSignature !== null && semanticSignature === visualSignature) return true;
    }
    return false;
  }

  function isGenuineKatexVisualBranch(visualBranch) {
    if (!visualBranch || !visualBranch.matches || !visualBranch.matches('.katex-html')) return false;
    const bases = elementChildren(visualBranch).filter((child) =>
      child.classList && child.classList.contains('base')
    );
    return Boolean(bases.length && bases.every((base) => elementChildren(base).some((child) =>
      child.classList && child.classList.contains('strut')
    )));
  }

  function cloneMathMLWithProvenance(node, deep = true) {
    if (!node || typeof node.cloneNode !== 'function') return null;
    const clone = node.cloneNode(deep);
    if (!deep || node.nodeType !== 1 || clone.nodeType !== 1) return clone;
    const sourceTables = [];
    const clonedTables = [];
    if ((node.localName || '').toLowerCase() === 'mtable') sourceTables.push(node);
    if ((clone.localName || '').toLowerCase() === 'mtable') clonedTables.push(clone);
    if (node.querySelectorAll) sourceTables.push(...node.querySelectorAll('mtable'));
    if (clone.querySelectorAll) clonedTables.push(...clone.querySelectorAll('mtable'));
    // A deep DOM clone preserves element order exactly. Refuse to transfer
    // any marker if that invariant is not true rather than guessing which
    // table inherited the renderer proof.
    if (sourceTables.length !== clonedTables.length) return clone;
    for (let index = 0; index < sourceTables.length; index += 1) {
      if (AUTHENTIC_ALIGNED_MATHML_TABLES.has(sourceTables[index])) {
        AUTHENTIC_ALIGNED_MATHML_TABLES.add(clonedTables[index]);
      }
    }
    return clone;
  }

  function sliceMathMLSurfaceNode(node, surface, start, end, documentObject) {
    if (!node || node.nodeType !== 1 || start < 0 || end <= start || end > surface.length) return null;
    if (start === 0 && end === surface.length) return cloneMathMLWithProvenance(node);
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
    for (const node of nodes) row.appendChild(cloneMathMLWithProvenance(node));
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

  function mathMLToLatexNode(node, inheritedMathVariant) {
    if (!node || node.nodeType !== 1) return '';
    const name = (node.localName || '').toLowerCase();
    const children = elementChildren(node);
    // MathML permits mathvariant on mstyle (and on the outer math element),
    // where it is inherited by descendant token elements. Carry that style
    // through structural rows instead of looking only at each mi/mn. A token's
    // own declaration remains the final override, including explicit normal.
    const declaredInheritedVariant = ['math', 'mstyle'].includes(name)
      ? canonicalMathVariant(node.getAttribute && node.getAttribute('mathvariant') || '')
      : '';
    const descendantMathVariant = declaredInheritedVariant ||
      canonicalMathVariant(inheritedMathVariant || '');
    const child = (index) => mathMLToLatexNode(children[index], descendantMathVariant);
    const all = () => children.map((item) =>
      mathMLToLatexNode(item, descendantMathVariant)
    ).join('');
    if (name === 'semantics') {
      return mathMLToLatexNode(presentationMathNode(node), descendantMathVariant);
    }
    if (name === 'mi' || name === 'mn') {
      const renderedValue = mathMLTokenText(node).trim();
      const toLatexCharacters = (value) => Array.from(value, (character) =>
        String(PDF_LATEX_CHARACTERS[character] || character)
      ).join('');
      const ownVariant = canonicalMathVariant(
        node.getAttribute && node.getAttribute('mathvariant') || ''
      );
      const variant = ownVariant || descendantMathVariant;
      if (!variant) return toLatexCharacters(renderedValue);
      // mathMLTokenText has already applied mathvariant for readable Unicode
      // output. LaTeX commands must instead wrap the unstyled token base;
      // otherwise script E becomes the double-styled `\mathcal{ℰ}`. Renderer
      // projections retain the raw base in textContent, while NFKD safely
      // recovers it when authored MathML already contains a styled glyph.
      const rawValue = normalizedMathToken(node.textContent || '');
      const baseValue = Array.from(rawValue, mathVariantBaseCharacter).join('');
      const base = toLatexCharacters(baseValue);
      const rendered = toLatexCharacters(renderedValue);
      const next = node.nextElementSibling;
      const functionApplication = name === 'mi' && CALCULATOR_FUNCTIONS.has(baseValue) &&
        next && (next.localName || '').toLowerCase() === 'mo' &&
        normalizedMathToken(next.textContent || '') === '\u2061';
      if (functionApplication) return '\\' + baseValue + ' ';
      const greek = /^[α-ωΑ-Ωϵϑϰϕϱϖ∂∇]$/u.test(baseValue);
      const wrap = (command, contents) => '\\' + command + '{' + contents + '}';
      switch (variant) {
        case 'normal': return name === 'mi' ? wrap('mathrm', base) : base;
        case 'italic': return name === 'mi' ? base : wrap('mathit', base);
        case 'bold': return wrap(greek ? 'boldsymbol' : 'mathbf', base);
        case 'bold-italic': return wrap('boldsymbol', base);
        case 'script': return wrap('mathcal', base);
        case 'bold-script': return wrap('mathbf', wrap('mathcal', base));
        case 'fraktur': return wrap('mathfrak', base);
        case 'bold-fraktur': return wrap('mathbf', wrap('mathfrak', base));
        case 'double-struck': return wrap('mathbb', base);
        case 'sans-serif': return wrap('mathsf', base);
        case 'bold-sans-serif': return wrap('mathbf', wrap('mathsf', base));
        case 'sans-serif-italic': return wrap('mathit', wrap('mathsf', base));
        case 'sans-serif-bold-italic': return wrap('boldsymbol', wrap('mathsf', base));
        case 'monospace': return wrap('mathtt', base);
        default: return rendered;
      }
    }
    if (name === 'mtext' || name === 'ms') return '\\text{' + latexEscapeText(mathMLTokenText(node)) + '}';
    if (name === 'mo') {
      const token = normalizedMathToken(mathMLTokenText(node));
      const operators = {
        '×': String.raw`\times `, '÷': String.raw`\div `, '·': String.raw`\cdot `,
        '−': '-', '±': String.raw`\pm `, '∓': String.raw`\mp `, '∝': String.raw`\propto `,
        '≤': String.raw`\le `, '≥': String.raw`\ge `, '≠': String.raw`\ne `, '≈': String.raw`\approx `,
        '∑': String.raw`\sum `, '∏': String.raw`\prod `, '∫': String.raw`\int `,
        '→': String.raw`\to `, '⇒': String.raw`\Rightarrow `, '∞': String.raw`\infty `,
        '∘': String.raw`\circ `, '∣': '|', '❘': '|', '‖': String.raw`\Vert `, '∥': String.raw`\Vert `
      };
      return operators[token] || token;
    }
    if (name === 'mspace') {
      const width = String(node.getAttribute && node.getAttribute('width') || '').trim().toLowerCase();
      const measurement = width.match(/^([+]?(?:\d+(?:\.\d*)?|\.\d+))(em|ex|px|pt)$/u);
      if (!measurement || Number(measurement[1]) <= 0) return '';
      // MathJax 2's authenticated `\,` projection is about 0.167em. Preserve
      // that authored unit/function separation; use a normal TeX control space
      // for larger positive mspace values whose exact macro is unknowable.
      return ['em', 'ex'].includes(measurement[2]) && Number(measurement[1]) <= 0.25
        ? String.raw`\,`
        : '\\ ';
    }
    if (name === 'mphantom' || name === 'annotation' || name === 'annotation-xml' || name === 'none') return '';
    if (name === 'mfrac') return '\\frac{' + child(0) + '}{' + child(1) + '}';
    if (name === 'msqrt') return '\\sqrt{' + all() + '}';
    if (name === 'mroot') return '\\sqrt[' + child(1) + ']{' + child(0) + '}';
    if (name === 'msup') {
      const upper = isDegreeScript(children[1] && children[1].textContent)
        ? String.raw`\circ`
        : child(1);
      return '{' + child(0) + '}^{' + upper + '}';
    }
    if (name === 'msub') return '{' + child(0) + '}_{' + child(1) + '}';
    if (name === 'msubsup') {
      const upper = isDegreeScript(children[2] && children[2].textContent)
        ? String.raw`\circ`
        : child(2);
      return '{' + child(0) + '}_{' + child(1) + '}^{' + upper + '}';
    }
    if (name === 'mover') return '\\overset{' + child(1) + '}{' + child(0) + '}';
    if (name === 'munder') return '\\underset{' + child(1) + '}{' + child(0) + '}';
    if (name === 'munderover') return '\\overset{' + child(2) + '}{\\underset{' + child(1) + '}{' + child(0) + '}}';
    if (name === 'mfenced') {
      const open = node.getAttribute('open') == null ? '(' : node.getAttribute('open');
      const close = node.getAttribute('close') == null ? ')' : node.getAttribute('close');
      return String.raw`\left` + open + children.map((item) =>
        mathMLToLatexNode(item, descendantMathVariant)
      ).join(',') + String.raw`\right` + close;
    }
    if (name === 'mtable') {
      const alignedRows = mathMLAlignedEquationRows(node);
      const rows = alignedRows || children.map((row) => elementChildren(row));
      return (alignedRows ? String.raw`\begin{aligned}` : String.raw`\begin{matrix}`) + rows.map((row) =>
        row.map((item) => mathMLToLatexNode(item, descendantMathVariant)).join('&')
      ).join(String.raw`\\`) + (alignedRows ? String.raw`\end{aligned}` : String.raw`\end{matrix}`);
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
    if (outputMode === 'latex') return '$' + mathMLToLatexNode(mathElement) + '$';
    return mathMLToFaithful(mathElement);
  }

  function repairLegacyKatexNumericScriptBases(mathElement) {
    if (!mathElement || typeof mathElement.cloneNode !== 'function') return null;
    const repaired = cloneMathMLWithProvenance(mathElement);
    let repairs = 0;
    for (const script of Array.from(repaired.querySelectorAll('msup, msub, msubsup'))) {
      const directBase = elementChildren(script)[0];
      let numericBase = directBase;
      while (numericBase && ['mrow', 'mstyle', 'mpadded'].includes(
        (numericBase.localName || '').toLowerCase()
      ) && elementChildren(numericBase).length === 1) {
        numericBase = elementChildren(numericBase)[0];
      }
      if (!numericBase || (numericBase.localName || '').toLowerCase() !== 'mn' ||
          !/^\d+$/u.test(topologyAnchorKey(mathMLTokenText(numericBase))) ||
          Array.from(numericBase.attributes || []).length) continue;
      const leading = [];
      let candidate = script.previousElementSibling;
      while (candidate && (candidate.localName || '').toLowerCase() === 'mn' &&
             /^\d+$/u.test(topologyAnchorKey(mathMLTokenText(candidate))) &&
             !Array.from(candidate.attributes || []).length) {
        leading.unshift(candidate);
        candidate = candidate.previousElementSibling;
      }
      if (!leading.length) continue;
      numericBase.textContent = leading.map((item) => mathMLTokenText(item).trim()).join('') +
        mathMLTokenText(numericBase).trim();
      for (const item of leading) item.remove();
      repairs += 1;
    }
    const rows = [];
    if (repaired.matches && repaired.matches('math, mrow, mstyle, mpadded')) rows.push(repaired);
    rows.push(...Array.from(repaired.querySelectorAll('math, mrow, mstyle, mpadded')));
    for (const row of rows) {
      let previous = null;
      for (const child of Array.from(row.children || [])) {
        const numeric = (child.localName || '').toLowerCase() === 'mn' &&
          /^\d+$/u.test(topologyAnchorKey(mathMLTokenText(child))) &&
          !Array.from(child.attributes || []).length;
        if (numeric && previous) {
          previous.textContent = mathMLTokenText(previous).trim() + mathMLTokenText(child).trim();
          child.remove();
          repairs += 1;
          continue;
        }
        previous = numeric ? child : null;
      }
    }
    return repairs ? repaired : null;
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
                    ? cloneMathMLWithProvenance(surfaceChildren[index])
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

  function composedParentElement(node) {
    if (!node) return null;
    if (node.assignedSlot && node.assignedSlot.nodeType === 1) return node.assignedSlot;
    if (node.parentElement) return node.parentElement;
    const parent = node.parentNode;
    return parent && parent.nodeType === 11 && parent.host && parent.host.nodeType === 1
      ? parent.host
      : null;
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

  function rendererInternalSourceAttributeNode(element) {
    if (!element || !element.matches || !element.matches(
      '[data-latex],[data-tex],[data-math-source],[data-mathml],[data-equation-content]'
    )) return false;
    const owner = element.closest && element.closest(
      'mjx-container,.katex,.katex-display,.MathJax,.MathJax_CHTML,.MathJax_SVG'
    );
    return Boolean(owner && owner !== element);
  }

  function embeddedMathOwnerShape(root) {
    if (!root || root.nodeType !== 1 || !root.getAttribute ||
        !domTreeWithinBudget(root, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return null;
    const boundedAttribute = (name, maximumLength) => {
      const value = String(root.getAttribute(name) || '');
      return value.length <= maximumLength ? value.trim() : null;
    };
    const rawMathML = boundedAttribute('data-mathml', MAX_CLIPBOARD_MARKUP_LENGTH);
    if (rawMathML == null) return { root, invalid: true };
    const sourceAttributes = ['data-equation-content', 'data-latex', 'data-tex', 'data-math-source'];
    const rawSources = [];
    for (const name of sourceAttributes) {
      const source = boundedAttribute(name, MAX_MATH_SOURCE_LENGTH);
      if (source == null) return { root, invalid: true };
      if (source) rawSources.push(source);
    }
    if (!rawMathML && !rawSources.length) return null;
    const tag = (root.localName || '').toLowerCase();
    let surface = null;
    if (tag === 'img' || tag === 'svg') surface = root;
    else {
      const surfaces = Array.from(root.querySelectorAll ? root.querySelectorAll('img,svg') : []);
      if (surfaces.length !== 1 || cleanOrdinaryCharacters(root.textContent || '').trim()) return null;
      surface = surfaces[0];
      const identity = [
        typeof root.className === 'string' ? root.className : '',
        root.id || '',
        root.getAttribute('role') || '',
        root.getAttribute('aria-roledescription') || '',
        tag.includes('-') ? tag : ''
      ].join(' ');
      if (!/(?:^|[\s_-])(?:math|latex|formula|equation)(?:$|[\s_-])/iu.test(identity)) return null;
    }
    const nestedOwners = Array.from(root.querySelectorAll ? root.querySelectorAll(
      '[data-mathml],[data-equation-content],[data-latex],[data-tex],[data-math-source]'
    ) : []).filter((candidate) => candidate !== root);
    if (nestedOwners.length) return null;
    return { root, surface, rawMathML, rawSources };
  }

  function embeddedMathSurfaceIsVisible(shape) {
    const root = shape && shape.root;
    const surface = shape && shape.surface;
    const documentObject = root && root.ownerDocument;
    const view = documentObject && documentObject.defaultView;
    if (!root || !surface || !root.isConnected || !view || typeof view.getComputedStyle !== 'function') return false;
    let reachedRoot = false;
    for (let element = surface; element; element = element.parentElement) {
      if (isVisuallyHiddenElement(element)) return false;
      let computed;
      try { computed = view.getComputedStyle(element); } catch (_error) { return false; }
      const display = String(computed && computed.display || '').trim().toLowerCase();
      const visibility = String(computed && computed.visibility || '').trim().toLowerCase();
      const opacity = Number.parseFloat(String(computed && computed.opacity || '1'));
      if (display === 'none' || /^(?:hidden|collapse)$/u.test(visibility) ||
          (Number.isFinite(opacity) && opacity <= 0) ||
          computedStyleHasUnsafeVisibleLayout(computed, false)) return false;
      if (element === root) {
        reachedRoot = true;
        break;
      }
    }
    if (!reachedRoot) return false;
    const visualRect = cssStackMathPositiveRect(surface);
    if (!visualRect) return false;
    // Visibility and opacity inherit through layout in ways that a child's
    // computed style does not always expose (notably opacity:0 on a parent).
    // Audit every ancestor, but do not reject harmless transformed or fixed
    // page chrome when the image itself still has a positive visible box.
    for (let ancestor = composedParentElement(root); ancestor; ancestor = composedParentElement(ancestor)) {
      let computed;
      try { computed = view.getComputedStyle(ancestor); } catch (_error) { return false; }
      const value = (name, property) => String(
        computed && (computed[name] || computed.getPropertyValue && computed.getPropertyValue(property || name)) || ''
      ).trim().toLowerCase();
      if (value('display') === 'none' || value('contentVisibility', 'content-visibility') === 'hidden' ||
          /^(?:hidden|collapse)$/u.test(value('visibility'))) return false;
      const opacity = Number.parseFloat(value('opacity') || '1');
      if (Number.isFinite(opacity) && opacity <= 0) return false;
      const clip = value('clip');
      const clipPath = value('clipPath', 'clip-path') || value('webkitClipPath', '-webkit-clip-path');
      const mask = value('maskImage', 'mask-image') || value('webkitMaskImage', '-webkit-mask-image');
      const filter = value('filter');
      if ((clip && clip !== 'auto') || (clipPath && clipPath !== 'none') || (mask && mask !== 'none') ||
          /(?:^|\s)opacity\(\s*0(?:[.]0*)?\s*\)/u.test(filter)) return false;
    }
    return cssStackMathClippingAncestorsExpose(surface, visualRect, view);
  }

  function normalizedEmbeddedTex(value) {
    const source = stripLatexDelimiters(String(value == null ? '' : value).trim());
    if (!source || source.length > MAX_MATH_SOURCE_LENGTH ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(source)) return '';
    const structure = latexStructuralSignature(source, false, null);
    if (!structure || structure.invalid) return '';
    const faithful = latexToFaithful(source);
    return faithful && !faithful.includes('\\') ? source : '';
  }

  function embeddedTexSourcesAgree(values) {
    const sources = values.map(normalizedEmbeddedTex).filter(Boolean);
    if (!sources.length || sources.length !== values.length) return '';
    const firstFaithful = faithfulAgreementKey(latexToFaithful(sources[0]));
    const firstCalculator = faithfulAgreementKey(latexToCalculator(sources[0], {
      preserveLongIdentifiers: true
    }));
    if (!firstFaithful || !firstCalculator) return '';
    for (const source of sources.slice(1)) {
      if (faithfulAgreementKey(latexToFaithful(source)) !== firstFaithful ||
          faithfulAgreementKey(latexToCalculator(source, { preserveLongIdentifiers: true })) !== firstCalculator) {
        return '';
      }
    }
    return sources[0];
  }

  function embeddedRepresentationAgreementKey(value, latexInput = false) {
    let source = cleanClipboardText(String(value == null ? '' : value)).trim();
    if (!source || source.length > MAX_MATH_SOURCE_LENGTH) return '';
    const label = source.match(/^\s*(latex|tex|math|mathematics|equation|formula)\s*:\s*([\s\S]+)$/iu);
    const explicitlyLatex = Boolean(label && /^(?:latex|tex)$/iu.test(label[1]));
    if (label) source = label[2].trim();
    if (!source) return '';
    if (latexInput || explicitlyLatex) {
      source = normalizedEmbeddedTex(source);
      if (!source) return '';
    }
    const faithful = latexToFaithful(source);
    if (!faithful || faithful.includes('\\')) return '';
    const calculator = unicodeToCalculator(faithful, { preserveLongIdentifiers: true });
    return calculator ? faithfulAgreementKey(calculator) : '';
  }

  function decodeEmbeddedMathML(value) {
    let source = String(value == null ? '' : value).trim();
    if (!source || source.length > MAX_CLIPBOARD_MARKUP_LENGTH ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(source) ||
        /<!\s*(?:doctype|entity)|<\?|\?>/iu.test(source)) return '';
    if (/^«\s*math(?:\s|»)/iu.test(source) && /«\s*\/\s*math\s*»\s*$/iu.test(source)) {
      source = source.replace(/[«»§¨`]/gu, (character) => ({
        '«': '<', '»': '>', '§': '&', '¨': '"', '`': "'"
      })[character]);
    }
    return /^\s*<\s*math(?:\s|>)/iu.test(source) && /<\s*\/\s*math\s*>\s*$/iu.test(source)
      ? source
      : '';
  }

  function decodeEmbeddedXmlNamedEntities(source, documentObject) {
    const standard = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);
    const input = String(source || '');
    if (/&[A-Za-z][A-Za-z0-9]{64}/u.test(input)) return '';
    const names = new Map();
    for (const match of input.matchAll(/&([A-Za-z][A-Za-z0-9]{0,63});/gu)) {
      if (standard.has(match[1]) || names.has(match[0])) continue;
      names.set(match[0], names.size);
      if (names.size > MAX_EMBEDDED_ENTITY_NAMES) return '';
    }
    if (!names.size) return input;
    const entries = Array.from(names.entries());
    const markup = '<!doctype html><html><body>' + entries.map(([entity], index) =>
      '<span data-cmc-entity="' + index + '">' + entity + '</span>').join('') + '</body></html>';
    const cache = new Map();
    try {
      // Entity names are strictly alphanumeric and length-bounded above, so
      // they cannot inject markup. Decode all unique names in one inert parse:
      // creating one document per token would turn a bounded MathML attribute
      // into thousands of heavyweight parser invocations.
      const parser = new documentObject.defaultView.DOMParser();
      const parsed = parser.parseFromString(markup, 'text/html');
      const decodedNodes = Array.from(parsed && parsed.body && parsed.body.children || []);
      if (decodedNodes.length !== entries.length) return '';
      for (let index = 0; index < entries.length; index += 1) {
        const [entity] = entries[index];
        const node = decodedNodes[index];
        if (!node || node.getAttribute('data-cmc-entity') !== String(index)) return '';
        const value = String(node.textContent || '');
        // Unknown names can be partially consumed as a shorter HTML entity
        // (for example &notSomething;). Reject any undecoded/partial suffix.
        if (!value || value === entity || /[A-Za-z0-9]+;$/u.test(value) || /&[A-Za-z]/u.test(value)) return '';
        // Numeric references are safe in either XML text or attribute context,
        // including decoded entities whose visible value contains `<` or `&`.
        cache.set(entity, Array.from(value, (character) =>
          '&#x' + character.codePointAt(0).toString(16) + ';').join(''));
      }
    } catch (_error) {
      return '';
    }
    return input.replace(/&([A-Za-z][A-Za-z0-9]{0,63});/gu, (entity, name) =>
      standard.has(name) ? entity : (cache.get(entity) || entity));
  }

  function parsedEmbeddedMathML(raw, documentObject) {
    let source = decodeEmbeddedMathML(raw);
    const view = documentObject && documentObject.defaultView;
    if (!source || !view || typeof view.DOMParser !== 'function') return null;
    source = decodeEmbeddedXmlNamedEntities(source, documentObject);
    if (!source) return null;
    const openingEnd = source.indexOf('>');
    const opening = openingEnd >= 0 ? source.slice(0, openingEnd + 1) : '';
    // Legacy image-formula integrations often store a standalone <math>
    // fragment without an explicit default namespace. It is unambiguously
    // MathML in this dedicated attribute, so supply the standard namespace
    // before XML parsing; an explicit wrong/empty namespace is still rejected.
    if (opening && !/\bxmlns\s*=/iu.test(opening)) {
      source = source.replace(/^(\s*<\s*math)(?=\s|>)/iu,
        '$1 xmlns="' + MATHML_NAMESPACE + '"');
    }
    try {
      const parsed = new view.DOMParser().parseFromString(source, 'application/xml');
      if (!parsed || parsed.querySelector('parsererror') ||
          (parsed.documentElement.localName || '').toLowerCase() !== 'math' ||
          parsed.documentElement.namespaceURI !== MATHML_NAMESPACE) return null;
      const imported = documentObject.importNode(parsed.documentElement, true);
      const safe = sanitizedMathMLClone(imported);
      return safe && embeddedMathMLStructureIsComplete(safe) && mathMLToFaithful(safe).trim()
        ? safe
        : null;
    } catch (_error) {
      return null;
    }
  }

  function embeddedMathMLStructureIsComplete(math) {
    if (!math || !domTreeWithinBudget(math, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return false;
    const fixedArity = new Map([
      ['math', [1, Infinity]], ['semantics', [1, 1]],
      ['mfrac', [2, 2]], ['mroot', [2, 2]],
      ['msub', [2, 2]], ['msup', [2, 2]], ['msubsup', [3, 3]],
      ['munder', [2, 2]], ['mover', [2, 2]], ['munderover', [3, 3]],
      ['mprescripts', [0, 0]], ['none', [0, 0]], ['mspace', [0, 0]],
      ['mi', [0, 0]], ['mn', [0, 0]], ['mo', [0, 0]], ['mtext', [0, 0]], ['ms', [0, 0]]
    ]);
    const meaningfulChildren = new Set([
      'mfrac', 'mroot', 'msub', 'msup', 'msubsup', 'munder', 'mover', 'munderover'
    ]);
    const stack = [math];
    let visited = 0;
    while (stack.length) {
      const node = stack.pop();
      if (!node || node.nodeType !== 1) return false;
      visited += 1;
      if (visited > MAX_MATHML_NODES) return false;
      const name = (node.localName || '').toLowerCase();
      const children = elementChildren(node);
      const arity = fixedArity.get(name);
      if (arity && (children.length < arity[0] || children.length > arity[1])) return false;
      if (meaningfulChildren.has(name) && children.some((child) =>
        !mathMLToFaithful(child).trim())) return false;
      if (name === 'mmultiscripts') {
        if (!children.length || children.filter((child) =>
          (child.localName || '').toLowerCase() === 'mprescripts').length > 1) return false;
        const marker = children.findIndex((child) =>
          (child.localName || '').toLowerCase() === 'mprescripts');
        const postCount = (marker < 0 ? children.length : marker) - 1;
        const preCount = marker < 0 ? 0 : children.length - marker - 1;
        if (postCount < 0 || postCount % 2 || preCount % 2) return false;
      }
      for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
    }
    return true;
  }

  function embeddedMathDescriptor(root) {
    const shape = embeddedMathOwnerShape(root);
    if (!shape || shape.invalid) return null;
    const boundedAccessibleAttribute = (element, name) => {
      const value = String(element && element.getAttribute && element.getAttribute(name) || '');
      return value.length <= MAX_MATH_SOURCE_LENGTH ? value.trim() : null;
    };
    const accessibleEntries = [];
    const addAccessible = (element, name, owner) => {
      const value = boundedAccessibleAttribute(element, name);
      if (value == null) return false;
      if (value) accessibleEntries.push({ owner, name, value });
      return true;
    };
    if (!addAccessible(shape.surface, 'alt', 'surface') ||
        !addAccessible(shape.surface, 'aria-label', 'surface') ||
        (shape.root !== shape.surface && !addAccessible(shape.root, 'aria-label', 'root'))) return null;
    const accessibleValues = accessibleEntries.map((entry) => entry.value);
    // Length-delimited JSON prevents an authored control character from
    // aliasing two different metadata layouts in the per-copy cache. Keep
    // every accessibility field distinct: precedence (`alt || aria-label`)
    // would hide a contradictory representation from the agreement audit.
    const signature = JSON.stringify([
      shape.rawMathML,
      shape.rawSources,
      accessibleEntries.map((entry) => [entry.owner, entry.name, entry.value])
    ]);
    const cache = ACTIVE_COPY_EMBEDDED_MATH_CACHE;
    const cached = cache && cache.get(root);
    if (cached && cached.signature === signature && cached.surface === shape.surface) {
      return embeddedMathSurfaceIsVisible(shape) ? cached.descriptor : null;
    }
    const sources = shape.rawSources.slice();
    const accessibleTexSources = accessibleValues.map((value) =>
      value.match(/^\s*(?:latex|tex)\s*:\s*([\s\S]+)$/iu)
    ).filter(Boolean);
    for (const match of accessibleTexSources) sources.push(match[1]);
    const source = sources.length ? embeddedTexSourcesAgree(sources) : '';
    if (sources.length && !source) {
      if (cache) cache.set(root, { signature, surface: shape.surface, descriptor: null });
      return null;
    }
    const math = shape.rawMathML ? parsedEmbeddedMathML(shape.rawMathML, root.ownerDocument) : null;
    if (shape.rawMathML && !math) {
      if (cache) cache.set(root, { signature, surface: shape.surface, descriptor: null });
      return null;
    }
    if (!math && source && !accessibleTexSources.length) {
      // Pixels alone cannot authenticate source metadata. Source-only image
      // renderers need an independently exposed TeX/LaTeX accessibility
      // representation that agrees with every source attribute; otherwise a
      // stale data-latex on an unrelated image could replace what was seen.
      if (cache) cache.set(root, {
        signature, surface: shape.surface, descriptor: null
      });
      return null;
    }
    const agreementKeys = [];
    if (math) agreementKeys.push(embeddedRepresentationAgreementKey(mathMLToFaithful(math)));
    if (source) agreementKeys.push(embeddedRepresentationAgreementKey(source, true));
    for (const value of accessibleValues) {
      agreementKeys.push(embeddedRepresentationAgreementKey(value));
    }
    if (agreementKeys.some((key) => !key) || new Set(agreementKeys).size > 1) {
      if (cache) cache.set(root, { signature, surface: shape.surface, descriptor: null });
      return null;
    }
    if (!math && !source) return null;
    const descriptor = { ...shape, math, source };
    if (cache) cache.set(root, { signature, surface: shape.surface, descriptor });
    return embeddedMathSurfaceIsVisible(shape) ? descriptor : null;
  }

  const MATHJAX_SVG_STRUCTURAL_NAMES = new Set([
    'msup', 'msub', 'msubsup', 'mmultiscripts', 'mfrac', 'msqrt', 'mroot',
    'mover', 'munder', 'munderover', 'mtable'
  ]);

  function mathJaxSvgStructuralSignature(entries) {
    const signature = emptyMathJaxChtmlStructure();
    const aggregate = {
      remainingCharacters: MAX_LATEX_PARSE_STEPS * 4,
      complete: new Map(),
      topLevel: new Map(),
      exhausted: false
    };
    const structuralSelector = Array.from(
      MATHJAX_SVG_STRUCTURAL_NAMES,
      (name) => '[data-mml-node="' + name + '"]'
    ).join(',');
    const associatedSourceFor = (candidate, top) => {
      let sourceOwner = candidate;
      while (sourceOwner && sourceOwner !== top &&
             !(sourceOwner.getAttribute && sourceOwner.getAttribute('data-latex'))) {
        sourceOwner = sourceOwner.parentElement;
      }
      return sourceOwner && sourceOwner.getAttribute && sourceOwner.getAttribute('data-latex');
    };
    for (const entry of entries) {
      const node = entry.node;
      const top = entry.top;
      const name = String(node.getAttribute('data-mml-node') || '').toLowerCase();
      if (name === 'msup') signature.sup += 1;
      else if (name === 'msub') signature.sub += 1;
      else if (name === 'msubsup') { signature.sup += 1; signature.sub += 1; }
      else if (name === 'mmultiscripts') {
        const ownSource = node.getAttribute('data-latex');
        const scripts = ownSource ? latexStructuralSignature(ownSource, true, aggregate) : null;
        if (!scripts || scripts.invalid || (!scripts.sup && !scripts.sub)) signature.invalid = true;
        else { signature.sup += scripts.sup; signature.sub += scripts.sub; }
      } else if (name === 'mfrac') signature.fraction += 1;
      else if (name === 'msqrt') signature.squareRoot += 1;
      else if (name === 'mroot') signature.indexedRoot += 1;
      else if (name === 'mtable') signature.table += 1;
      else {
        const structuralAncestor = node.parentElement && node.parentElement.closest(structuralSelector);
        const associatedSource = associatedSourceFor(node, top);
        const ownSource = node.getAttribute('data-latex');
        const wrapper = associatedSource
          ? latexStructuralSignature(associatedSource, true, aggregate)
          : null;
        const ownScripts = ownSource
          ? latexStructuralSignature(ownSource, true, aggregate)
          : null;
        if (structuralAncestor &&
            String(structuralAncestor.getAttribute('data-mml-node') || '').toLowerCase() === name && wrapper) {
          const ancestorSource = associatedSourceFor(structuralAncestor, top);
          const ancestorWrapper = ancestorSource
            ? latexStructuralSignature(ancestorSource, true, aggregate)
            : null;
          const direction = name === 'munder' ? 'under' : 'over';
          const sameWrapperKind = ancestorWrapper && !ancestorWrapper.invalid &&
            wrapper[direction + 'Kinds'].length === 1 &&
            ancestorWrapper[direction + 'Kinds'].length === 1 &&
            wrapper[direction + 'Kinds'][0] === ancestorWrapper[direction + 'Kinds'][0];
          if (sameWrapperKind && (ancestorWrapper.sup || ancestorWrapper.sub)) continue;
        }
        if (name === 'munder' && structuralAncestor &&
            String(structuralAncestor.getAttribute('data-mml-node') || '').toLowerCase() === 'munderover' &&
            (!wrapper || !wrapper.under)) continue;
        if (!wrapper || wrapper.invalid) {
          signature.invalid = true;
        } else if (name === 'mover') {
          if (wrapper.over === 1 && !wrapper.under) signature.over += 1;
          else if (!(ownScripts && !ownScripts.invalid && (ownScripts.sup || ownScripts.sub) &&
                     ((ownScripts.sup && !ownScripts.sub && !wrapper.over && !wrapper.under) ||
                      (wrapper.under === 1 && !wrapper.over)))) signature.invalid = true;
        } else if (name === 'munder') {
          if (wrapper.under === 1 && !wrapper.over) signature.under += 1;
          else if (!(ownScripts && !ownScripts.invalid && (ownScripts.sup || ownScripts.sub) &&
                     ((wrapper.over === 1 && !wrapper.under) ||
                      (ownScripts.sub && !ownScripts.sup && !wrapper.over && !wrapper.under)))) {
            signature.invalid = true;
          }
        } else if (name === 'munderover') {
          if (wrapper.over || wrapper.under) {
            signature.over += wrapper.over;
            signature.under += wrapper.under;
          } else if (!ownSource) signature.invalid = true;
        }
        if (ownScripts) {
          if (ownScripts.invalid) signature.invalid = true;
          else { signature.sup += ownScripts.sup; signature.sub += ownScripts.sub; }
        }
      }
      if (aggregate.exhausted || Object.values(signature).some((value) =>
        typeof value === 'number' && value > MAX_MATHML_NODES)) signature.invalid = true;
      if (signature.invalid) break;
    }
    return signature;
  }

  function mathJaxSvgPathDataIsDrawable(value, allowEmpty) {
    const data = String(value == null ? '' : value).trim();
    if (!data) return Boolean(allowEmpty);
    if (data.length > MAX_CLIPBOARD_MARKUP_LENGTH ||
        !/^[\sMmZzLlHhVvCcSsQqTtAaEe0-9.,+\-]+$/u.test(data) ||
        !/[Mm]/u.test(data) || !/[0-9]/u.test(data) ||
        /(?:nan|infinity)/iu.test(data)) return false;
    return true;
  }

  function mathJaxSvgUseTarget(use, svg, character) {
    const href = String(use.getAttribute('href') || use.getAttribute('xlink:href') || '');
    if (!/^#[A-Za-z][A-Za-z0-9_.:-]{0,255}$/u.test(href)) return null;
    const documentObject = svg && svg.ownerDocument;
    const target = documentObject && documentObject.getElementById(href.slice(1));
    if (!target || (target.localName || '').toLowerCase() !== 'path' ||
        target.ownerDocument !== documentObject || !target.closest('defs')) return null;
    const targetSvg = target.closest('svg');
    if (targetSvg !== svg) {
      const identity = String(targetSvg && (targetSvg.id || targetSvg.getAttribute('class')) || '');
      const siblingLineCache = targetSvg && targetSvg.parentElement === svg.parentElement &&
        svg.parentElement && svg.parentElement.matches &&
        svg.parentElement.matches('mjx-container.MathJax[jax="SVG" i]') &&
        targetSvg.parentElement === svg.parentElement;
      if (!siblingLineCache && !/^MJX-SVG-global-cache$/u.test(identity)) return null;
    }
    const invisibleJoiner = /^\p{Cf}$/u.test(character);
    return mathJaxSvgPathDataIsDrawable(target.getAttribute('d'), invisibleJoiner) ? target : null;
  }

  function mathJaxSvgSemanticGlyph(character, glyph, top) {
    const point = character.codePointAt(0);
    const structural = glyph.closest && glyph.closest(
      '[data-mml-node="mover"],[data-mml-node="munder"],[data-mml-node="munderover"]'
    );
    let source = '';
    for (let owner = structural; owner && owner !== top.parentElement; owner = owner.parentElement) {
      source = String(owner.getAttribute && owner.getAttribute('data-latex') || '');
      if (source) break;
    }
    if (point === 0x2015) {
      if (/\\underline\b/u.test(source)) return '\u0332';
      if (/\\overline\b/u.test(source)) return '\u0305';
    }
    if (point === 0x23de) return '\u23de';
    if (point === 0x23df) return '\u23df';
    const accentGlyphs = new Map([
      [0x2c6, '\u0302'], [0x2dc, '\u0303'], [0xaf, '\u0305'], [0x2c9, '\u0305'],
      [0x2d9, '\u0307'], [0xa8, '\u0308'], [0xb4, '\u0301'], [0x2ca, '\u0301'],
      [0x2cb, '\u0300'], [0x2d8, '\u0306'], [0x2c7, '\u030c'], [0x2da, '\u030a'],
      [0x2cd, '\u0332']
    ]);
    return accentGlyphs.get(point) || mathVariantBaseCharacter(character);
  }

  function mathJaxSvgAgreementKey(input) {
    let value = String(input == null ? '' : input);
    if (!value || value.length > MAX_SELECTION_KEY_LENGTH) return '';
    const withoutLinearScriptWrappers = (source) => {
      let result = '';
      for (let index = 0; index < source.length; index += 1) {
        if ((source[index] === '_' || source[index] === '^') && source[index + 1] === '(') {
          let depth = 1;
          let cursor = index + 2;
          for (; cursor < source.length && depth > 0; cursor += 1) {
            if (source[cursor] === '(') depth += 1;
            else if (source[cursor] === ')') depth -= 1;
          }
          if (depth === 0) {
            result += withoutLinearScriptWrappers(source.slice(index + 2, cursor - 1));
            index = cursor - 1;
            continue;
          }
        }
        result += source[index];
      }
      return result;
    };
    value = withoutLinearScriptWrappers(value);
    try { value = value.normalize('NFKD'); } catch (_error) { /* retain source */ }
    const canonical = new Map([
      ['-', '\u2212'], ['\u2010', '\u2212'], ['\u2011', '\u2212'],
      ['\u2012', '\u2212'], ['\u2013', '\u2212'], ['\u2212', '\u2212'],
      ['\u2217', '*'],
      ['\u2223', '|'], ['\u2758', '|'], ['\u2016', '\u2016'], ['\u2225', '\u2016']
    ]);
    let result = '';
    for (const rawCharacter of value) {
      if (/^\s$/u.test(rawCharacter)) continue;
      const character = mathVariantBaseCharacter(rawCharacter);
      result += canonical.get(character) || character;
      if (result.length > MAX_SELECTION_KEY_LENGTH) return '';
    }
    return result;
  }

  function mathJaxSvgVisibleProjection(top, svg) {
    const documentObject = top && top.ownerDocument;
    const view = documentObject && documentObject.defaultView;
    if (!documentObject || !view || typeof view.getComputedStyle !== 'function') return null;
    const state = {
      glyphs: 0,
      drawable: 0,
      characters: 0,
      invalid: false,
      tables: [],
      multiscripts: []
    };
    const visibilityCache = new WeakMap();
    const visuallySafe = (element) => {
      if (!element || element.nodeType !== 1) return false;
      if (visibilityCache.has(element)) return visibilityCache.get(element);
      let safe = true;
      try {
        const computed = view.getComputedStyle(element);
        const value = (name, property) => String(
          computed && (computed[name] || computed.getPropertyValue && computed.getPropertyValue(property || name)) || ''
        ).trim().toLowerCase();
        const opacity = Number.parseFloat(value('opacity') || '1');
        const clip = value('clip');
        const clipPath = value('clipPath', 'clip-path') || value('webkitClipPath', '-webkit-clip-path');
        const mask = value('maskImage', 'mask-image') || value('webkitMaskImage', '-webkit-mask-image');
        const filter = value('filter');
        safe = value('display') !== 'none' && value('contentVisibility', 'content-visibility') !== 'hidden' &&
          !/^(?:hidden|collapse)$/u.test(value('visibility')) &&
          !(Number.isFinite(opacity) && opacity <= 0) &&
          (!clip || clip === 'auto') && (!clipPath || clipPath === 'none') &&
          (!mask || mask === 'none') && (!filter || filter === 'none');
      } catch (_error) {
        safe = false;
      }
      const transform = String(element.getAttribute && element.getAttribute('transform') || '');
      if (/scale\(\s*0(?:[.][0]*)?(?:\s*[,)]|\s+0(?:[.][0]*)?\s*\))/u.test(transform)) safe = false;
      if (safe && element !== top && element.parentElement && element.parentElement !== svg) {
        safe = visuallySafe(element.parentElement);
      }
      visibilityCache.set(element, safe);
      return safe;
    };
    const safeAttributes = (element) => {
      for (const attribute of Array.from(element.attributes || [])) {
        const name = String(attribute.name || '').toLowerCase();
        const value = String(attribute.value || '');
        if (/^on/u.test(name) || value.length > MAX_CLIPBOARD_MARKUP_LENGTH ||
            /(?:javascript\s*:|data\s*:|url\s*\()/iu.test(value)) return false;
        if ((name === 'href' || name === 'xlink:href') &&
            (element.localName || '').toLowerCase() !== 'use') return false;
      }
      return true;
    };
    const decodedGlyph = (glyph) => {
      if (!visuallySafe(glyph) || !safeAttributes(glyph)) return null;
      const raw = String(glyph.getAttribute('data-c') || '');
      if (!/^[0-9a-f]{1,6}$/iu.test(raw)) return null;
      const point = Number.parseInt(raw, 16);
      if (!Number.isInteger(point) || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return null;
      const character = String.fromCodePoint(point);
      const tag = (glyph.localName || '').toLowerCase();
      let drawable = false;
      if (tag === 'path') {
        drawable = mathJaxSvgPathDataIsDrawable(glyph.getAttribute('d'), /^\p{Cf}$/u.test(character));
      } else if (tag === 'use') {
        const target = mathJaxSvgUseTarget(glyph, svg, character);
        if (!target) return null;
        drawable = Boolean(String(target.getAttribute('d') || '').trim());
      } else {
        return null;
      }
      if (!drawable && !/^\p{Cf}$/u.test(character)) return null;
      state.glyphs += 1;
      state.characters += 1;
      if (drawable) state.drawable += 1;
      if (state.glyphs > MAX_MATHML_NODES || state.characters > MAX_SELECTION_KEY_LENGTH) return null;
      return mathJaxSvgSemanticGlyph(character, glyph, top);
    };
    const visit = (element) => {
      if (state.invalid || !element || element.nodeType !== 1) return '';
      const tag = (element.localName || '').toLowerCase();
      if (tag === 'defs' || tag === 'rect') return '';
      if (!safeAttributes(element)) { state.invalid = true; return ''; }
      if (tag === 'path' || tag === 'use') {
        if (!element.hasAttribute('data-c')) { state.invalid = true; return ''; }
        const character = decodedGlyph(element);
        if (character == null) state.invalid = true;
        return character || '';
      }
      if (tag === 'text') {
        const owner = element.closest && element.closest('[data-mml-node="mtext"]');
        const text = String(element.textContent || '');
        if (!owner || !nodeInside(top, owner) || element.children.length || !visuallySafe(element) ||
            !text || text.length > MAX_MATH_SOURCE_LENGTH ||
            /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) {
          state.invalid = true;
          return '';
        }
        const count = Array.from(text).length;
        state.glyphs += count;
        state.characters += count;
        if (/[^\s\p{Cf}]/u.test(text)) state.drawable += 1;
        if (state.glyphs > MAX_MATHML_NODES || state.characters > MAX_SELECTION_KEY_LENGTH) {
          state.invalid = true;
          return '';
        }
        return text;
      }
      if (!['g', 'svg'].includes(tag)) { state.invalid = true; return ''; }
      const children = Array.from(element.children || []);
      const name = String(element.getAttribute('data-mml-node') || '').toLowerCase();
      if (name === 'msubsup' || name === 'munderover') {
        const semantic = children.filter((child) => child.hasAttribute && child.hasAttribute('data-mml-node'));
        if (semantic.length !== 3 || children.some((child) => !semantic.includes(child))) {
          state.invalid = true;
          return '';
        }
        const verticalOffset = (child) => {
          const transform = String(child.getAttribute('transform') || '');
          const translated = transform.match(/translate\(\s*[-+]?(?:\d+(?:[.]\d*)?|[.]\d+)\s*[, ]\s*([-+]?(?:\d+(?:[.]\d*)?|[.]\d+))/u);
          if (translated) return Number.parseFloat(translated[1]);
          const matrix = transform.match(/matrix\([^)]*[, ]\s*([-+]?(?:\d+(?:[.]\d*)?|[.]\d+))\s*\)$/u);
          return matrix ? Number.parseFloat(matrix[1]) : NaN;
        };
        const firstOffset = verticalOffset(semantic[1]);
        const secondOffset = verticalOffset(semantic[2]);
        if (!Number.isFinite(firstOffset) || !Number.isFinite(secondOffset) || firstOffset === secondOffset) {
          state.invalid = true;
          return '';
        }
        const lower = firstOffset < secondOffset ? semantic[1] : semantic[2];
        const upper = lower === semantic[1] ? semantic[2] : semantic[1];
        return visit(semantic[0]) + visit(lower) + visit(upper);
      }
      if (name === 'mmultiscripts') {
        if (children.length < 2) { state.invalid = true; return ''; }
        const translatedPosition = (child) => {
          const transform = String(child.getAttribute('transform') || '').trim();
          if (!transform) return { x: 0, y: 0, explicit: false };
          const translated = transform.match(
            /(?:^|\s)translate\(\s*([-+]?(?:\d+(?:[.]\d*)?|[.]\d+))(?:\s*,\s*|\s+)([-+]?(?:\d+(?:[.]\d*)?|[.]\d+))\s*\)/u
          );
          if (!translated) return null;
          return {
            x: Number.parseFloat(translated[1]),
            y: Number.parseFloat(translated[2]),
            explicit: true
          };
        };
        const positions = children.map(translatedPosition);
        if (positions.some((position) => !position || !Number.isFinite(position.x) ||
          !Number.isFinite(position.y))) { state.invalid = true; return ''; }
        const baseCandidates = positions.map((position, index) => ({ position, index }))
          .filter(({ position, index }) => Math.abs(position.y) < 1e-9 &&
            children[index].hasAttribute('data-mml-node'));
        if (baseCandidates.length !== 1) { state.invalid = true; return ''; }
        const baseIndex = baseCandidates[0].index;
        const baseX = baseCandidates[0].position.x;
        const outputs = children.map(visit);
        if (state.invalid) return '';
        const descriptor = {
          base: mathJaxSvgAgreementKey(outputs[baseIndex]),
          preSub: '', preSup: '', postSub: '', postSup: ''
        };
        if (!descriptor.base) { state.invalid = true; return ''; }
        for (let index = 0; index < children.length; index += 1) {
          if (index === baseIndex) continue;
          const position = positions[index];
          if (!position.explicit || Math.abs(position.y) < 1e-9 ||
              Math.abs(position.x - baseX) < 1e-9) { state.invalid = true; return ''; }
          const side = position.x < baseX ? 'pre' : 'post';
          const vertical = position.y < 0 ? 'Sub' : 'Sup';
          const slot = side + vertical;
          const key = mathJaxSvgAgreementKey(outputs[index]);
          if (!key || descriptor[slot]) { state.invalid = true; return ''; }
          descriptor[slot] = key;
        }
        state.multiscripts.push(descriptor);
        return outputs.join('');
      }
      if (name === 'mfrac') {
        const meaningful = children.filter((child) => (child.localName || '').toLowerCase() !== 'rect');
        if (meaningful.length !== 2) { state.invalid = true; return ''; }
        // MathJax paints a zero-line stack (notably \binom) without a rule.
        // Its surrounding fence glyphs remain ordinary siblings, so emit only
        // the two painted operands here. Readability punctuation is added only
        // after the independently visible topology has authenticated source.
        if (!children.some((child) => (child.localName || '').toLowerCase() === 'rect')) {
          return visit(meaningful[0]) + visit(meaningful[1]);
        }
        return '(' + visit(meaningful[0]) + ')/(' + visit(meaningful[1]) + ')';
      }
      if (name === 'msqrt') {
        const meaningful = children.filter((child) => (child.localName || '').toLowerCase() !== 'rect');
        if (meaningful.length < 2) { state.invalid = true; return ''; }
        return visit(meaningful[0]) + '(' + meaningful.slice(1).map(visit).join('') + ')';
      }
      if (name === 'mroot') {
        const meaningful = children.filter((child) => (child.localName || '').toLowerCase() !== 'rect');
        if (meaningful.length < 3) { state.invalid = true; return ''; }
        return visit(meaningful[1]) + visit(meaningful[0]) + '(' + meaningful.slice(2).map(visit).join('') + ')';
      }
      if (name === 'mtable') {
        if (!children.length || children.some((child) =>
          String(child.getAttribute('data-mml-node') || '').toLowerCase() !== 'mtr')) {
          state.invalid = true;
          return '';
        }
        const rows = [];
        const paintedRows = [];
        for (const row of children) {
          const cells = Array.from(row.children || []);
          if (!cells.length || cells.some((cell) =>
            String(cell.getAttribute('data-mml-node') || '').toLowerCase() !== 'mtd')) {
            state.invalid = true;
            return '';
          }
          const paintedCells = cells.map(visit);
          if (state.invalid) return '';
          rows.push(paintedCells.map(mathJaxSvgAgreementKey));
          paintedRows.push(paintedCells.join(''));
        }
        state.tables.push({ rows });
        return paintedRows.join('');
      }
      return children.map(visit).join('');
    };
    const text = visit(top);
    if (state.invalid || !state.glyphs || !state.drawable || !text) return null;
    return {
      text,
      glyphs: state.glyphs,
      tables: state.tables,
      multiscripts: state.multiscripts
    };
  }

  function mathJaxSvgDescriptor(root) {
    const cache = ACTIVE_COPY_MATHJAX_SVG_CACHE;
    if (cache && root && cache.has(root)) return cache.get(root);
    const reject = () => {
      if (cache && root) cache.set(root, null);
      return null;
    };
    if (!root || !root.matches ||
        !root.matches('mjx-container.MathJax[jax="SVG" i]') ||
        !root.isConnected ||
        !domTreeWithinBudget(root, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return reject();
    const children = Array.from(root.children || []);
    const svgs = children.filter((child) => (child.localName || '').toLowerCase() === 'svg');
    if (!svgs.length || children.some((child) => {
      const tag = (child.localName || '').toLowerCase();
      return tag !== 'svg' && tag !== 'mjx-break' && !isVisuallyHiddenElement(child);
    })) return reject();
    let rootComputed;
    try { rootComputed = root.ownerDocument.defaultView.getComputedStyle(root); } catch (_error) { return reject(); }
    if (isVisuallyHiddenElement(root) || computedStyleHasUnsafeVisibleLayout(rootComputed, false) ||
        !cssStackMathPositiveRect(root) ||
        svgs.some((svg) => !embeddedMathSurfaceIsVisible({ root, surface: svg }))) return reject();

    let source = '';
    let rawSource = '';
    let totalSourceCharacters = 0;
    let glyphText = '';
    let glyphs = 0;
    const visibleTopology = { tables: [], multiscripts: [] };
    const structuralEntries = [];
    const structuralIds = new Set();
    for (const svg of svgs) {
      if (svg.querySelector('foreignObject,script,style,image') ||
          Array.from(svg.querySelectorAll('use')).some((node) => {
            const href = node.getAttribute('href') || node.getAttribute('xlink:href') || '';
            return href && !href.startsWith('#');
          })) return reject();
      const topCandidates = Array.from(svg.querySelectorAll('g[data-mml-node="math"][data-latex]'))
        .filter((candidate) => {
          const parent = candidate.parentElement;
          return parent === svg || (parent && (parent.localName || '').toLowerCase() === 'g' &&
            parent.parentElement === svg);
        });
      if (topCandidates.length !== 1) return reject();
      const top = topCandidates[0];
      const untrimmedSource = String(top.getAttribute('data-latex') || '');
      totalSourceCharacters += untrimmedSource.length;
      if (!untrimmedSource || untrimmedSource.length > MAX_MATH_SOURCE_LENGTH ||
          totalSourceCharacters > MAX_CLIPBOARD_MARKUP_LENGTH) return reject();
      const candidateRawSource = untrimmedSource.trim();
      if (!candidateRawSource) return reject();
      if (!rawSource) {
        rawSource = candidateRawSource;
        source = normalizedEmbeddedTex(candidateRawSource);
        if (!source) return reject();
      } else if (candidateRawSource !== rawSource) {
        // MathJax v4 line breaking clones the exact top-level source into
        // every line SVG. Exact equality avoids reparsing dozens of identical
        // 50k metadata strings and rejects stale/mixed renderer fragments.
        return reject();
      }
      for (const node of Array.from(top.querySelectorAll('[data-mml-node]'))) {
        const name = String(node.getAttribute('data-mml-node') || '').toLowerCase();
        const semanticId = String(node.getAttribute('data-semantic-id') || '');
        const idKey = semanticId ? name + ':' + semanticId : '';
        if (idKey && structuralIds.has(idKey)) continue;
        if (idKey) structuralIds.add(idKey);
        if (MATHJAX_SVG_STRUCTURAL_NAMES.has(name)) structuralEntries.push({ node, top });
      }
      const walker = root.ownerDocument.createTreeWalker(svg, 4);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!String(node.nodeValue || '').trim()) continue;
        const parent = node.parentElement;
        const textOwner = parent && parent.closest && parent.closest('[data-mml-node="mtext"]');
        if (!parent || (parent.localName || '').toLowerCase() !== 'text' ||
            !nodeInside(top, parent) || !textOwner || !nodeInside(top, textOwner)) return reject();
      }
      const projection = mathJaxSvgVisibleProjection(top, svg);
      if (!projection) return reject();
      glyphText += projection.text;
      glyphs += projection.glyphs;
      visibleTopology.tables.push(...projection.tables);
      visibleTopology.multiscripts.push(...projection.multiscripts);
      if (glyphs > MAX_MATHML_NODES || glyphText.length > MAX_SELECTION_KEY_LENGTH) return reject();
    }
    if (!source || !glyphs) return reject();
    const structure = latexStructuralSignature(source, false, null);
    if (!structure || structure.invalid) return reject();
    const expectedTopology = { tables: [], multiscripts: [] };
    const expectedText = latexToVisibleAgreement(source, expectedTopology);
    if (!expectedText ||
        JSON.stringify(expectedTopology.tables) !== JSON.stringify(visibleTopology.tables) ||
        JSON.stringify(expectedTopology.multiscripts) !== JSON.stringify(visibleTopology.multiscripts)) {
      return reject();
    }
    const expected = semanticVisibleAnchorSignature(expectedText);
    const visible = semanticVisibleAnchorSignature(glyphText);
    if (expected.overBudget || visible.overBudget || expected.identifiers !== visible.identifiers ||
        expected.accents !== visible.accents || expected.glyphs !== visible.glyphs) return reject();
    if (!expected.uncertainOperators && !visible.uncertainOperators &&
        expected.operators !== visible.operators) return reject();
    const actualStructure = mathJaxSvgStructuralSignature(structuralEntries);
    if (actualStructure.invalid) return reject();
    for (const key of ['sup', 'sub', 'fraction', 'squareRoot', 'indexedRoot', 'over', 'under', 'table']) {
      const exact = actualStructure[key] === structure[key];
      const repeatedAcrossLines = svgs.length > 1 && structure[key] > 0 &&
        actualStructure[key] >= structure[key];
      if (!exact && !repeatedAcrossLines) return reject();
    }
    const expectedKey = mathJaxSvgAgreementKey(expectedText);
    const visibleKey = mathJaxSvgAgreementKey(glyphText);
    if (!expectedKey || expectedKey !== visibleKey) return reject();
    const descriptor = { root, source, svgs, glyphText };
    if (cache) cache.set(root, descriptor);
    return descriptor;
  }

  function getMathSource(root, pageWindow) {
    if (!root || root.nodeType !== 1 || !domTreeWithinBudget(root, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return '';
    const bounded = (value) => {
      const source = typeof value === 'string' ? value : '';
      return source && source.length <= MAX_MATH_SOURCE_LENGTH ? stripLatexDelimiters(source) : '';
    };
    const svgDescriptor = mathJaxSvgDescriptor(root);
    if (svgDescriptor) return svgDescriptor.source;
    const embedded = embeddedMathDescriptor(root);
    if (embedded && embedded.source) return embedded.source;
    const attributeNames = ['data-latex', 'data-tex', 'data-math-source', 'data-original-tex', 'alttext'];
    for (const name of attributeNames) {
      const value = root.getAttribute && root.getAttribute(name);
      if (value) {
        const source = bounded(value);
        if (source) return source;
      }
    }
    // MathJax v3 CHTML keeps the original TeX on the one direct mjx-math
    // child, while the public root is mjx-container. Userscript isolation or
    // a page CSP can make the page-world MathJax object unavailable, so use
    // this renderer-owned metadata only in that exact, bounded shape. Every
    // clipboard path still requires independent visible-anchor agreement
    // before this source may replace selected content.
    if (root.matches && root.matches('mjx-container')) {
      const directMathChildren = Array.from(root.children || []).filter((child) =>
        child.matches && child.matches('mjx-math[data-latex]')
      );
      if (directMathChildren.length === 1) {
        const source = bounded(directMathChildren[0].getAttribute('data-latex'));
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
    // MathJax 2 CommonHTML inserts each rendered frame immediately before its
    // own source script. With previews disabled, however, the preceding
    // *element* of formula N is formula N-1's script because intervening prose
    // is only a text node. The generic previous-first lookup below therefore
    // assigns stale TeX to every later inline formula and one rejection sends
    // the entire selection back to the browser. Resolve the renderer's keyed
    // frame/script pair exactly, including the outer display wrapper, and
    // cross-check it with the live v2 Hub when that API is available.
    const mathJax2Chtml = mathJax2ChtmlShape(root);
    if (mathJax2Chtml) {
      const frameId = String(root.id || '');
      const sourceId = frameId.endsWith('-Frame') ? frameId.slice(0, -6) : '';
      const display = root.parentElement && root.parentElement.matches &&
        root.parentElement.matches('span.mjx-chtml.MJXc-display') &&
        elementChildren(root.parentElement).length === 1
        ? root.parentElement
        : null;
      const candidate = (display || root).nextElementSibling;
      let adjacentSource = '';
      if (candidate && candidate.matches && candidate.matches('script[type^="math/tex"]')) {
        // Official v2 associates `MathJax-Element-N-Frame` with the script
        // `MathJax-Element-N`. An unkeyed or mismatched neighbor is ambiguous,
        // never a reason to borrow text from another formula.
        if (!sourceId || String(candidate.id || '') !== sourceId) return '';
        adjacentSource = bounded((candidate.textContent || '').trim());
      }
      const hubSource = bounded(getMathJaxSource(root, pageWindow));
      if (hubSource && adjacentSource && hubSource !== adjacentSource) return '';
      return hubSource || adjacentSource;
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
      const semantic = root.querySelector('.katex-mathml math, mjx-assistive-mml math, math');
      if (semantic) return semantic;
    }
    const embedded = embeddedMathDescriptor(root);
    return embedded && embedded.math || null;
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
      (root.matches && root.matches('.katex-display, .MathJax_Display, .MathJax_SVG_Display, span.mjx-chtml.MJXc-display, mjx-container[display="true"], mjx-container[display="block"]')) ||
      (root.closest && root.closest('.katex-display, .MathJax_Display, .MathJax_SVG_Display, span.mjx-chtml.MJXc-display')) ||
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

  function latexSourceAgreesWithProjectedMath(source, mathElement) {
    if (!source || !mathElement) return false;
    const sourceFaithful = latexToFaithful(source);
    const projectedFaithful = mathMLToFaithful(mathElement);
    // Both serializers retain script direction, fraction/radical grouping,
    // fences, accents, operators, and ordered operands. Equality of their
    // faithful forms therefore accepts harmless TeX spelling/spacing aliases
    // while rejecting a keyed-but-stale source such as visible V_C paired
    // with `V^C`. A mismatch must never win merely because the script id is
    // adjacent to the renderer frame.
    return faithfulSourceAgreesWithRendered(sourceFaithful, projectedFaithful);
  }

  function faithfulRenderedMathText(root, mathElement, pageWindow) {
    const rendered = mathElement ? mathMLToFaithful(mathElement) : '';
    const source = getMathSource(root, pageWindow);
    const faithfulSource = source ? latexToFaithful(source) : '';
    if (!faithfulSourceAgreesWithRendered(faithfulSource, rendered)) {
      return rendered || faithfulSource;
    }
    // An adjacent stacked fraction is a separate multiplicative factor. Some
    // renderers preserve that boundary while TeX source whitespace does not;
    // keep the visible separating space so `10⁻⁴³ (unit/unit)` cannot look
    // like a function call. This choice is cosmetic only: the compact forms
    // must already be identical before rendered spacing can win.
    const compact = (value) => String(value || '').replace(/\s+/gu, '');
    if (rendered !== faithfulSource && compact(rendered) === compact(faithfulSource) &&
        /\S\s+\([^\n]*\/[^\n]*\)/u.test(rendered)) return rendered;
    return faithfulSource;
  }

  function calculatorRenderedMathText(root, mathElement, pageWindow) {
    const renderedFaithful = mathElement ? mathMLToFaithful(mathElement) : '';
    const renderedCalculator = mathElement ? mathMLToCalculator(mathElement) : '';
    const source = getMathSource(root, pageWindow);
    const faithfulSource = source ? latexToFaithful(source) : '';
    const splitNumericScriptBase = mathElement && Array.from(
      mathElement.querySelectorAll('msup, msub, msubsup')
    ).some((script) => {
      let base = elementChildren(script)[0];
      while (base && ['mrow', 'mstyle', 'mpadded'].includes((base.localName || '').toLowerCase()) &&
             elementChildren(base).length === 1) base = elementChildren(base)[0];
      const previous = script.previousElementSibling;
      return base && (base.localName || '').toLowerCase() === 'mn' &&
        /^\d+$/u.test(topologyAnchorKey(mathMLTokenText(base))) &&
        previous && (previous.localName || '').toLowerCase() === 'mn' &&
        /^\d+$/u.test(topologyAnchorKey(mathMLTokenText(previous)));
    });
    // Some older renderers split a numeric base across adjacent MathML nodes
    // (for example 10^−43 becomes 1 followed by 0^−43). Use the authenticated
    // TeX source only for that legacy representation, and only when its
    // complete readable form agrees with the sanitized rendered presentation.
    // Normal MathML remains authoritative for functions, limits, and bars.
    return splitNumericScriptBase && source &&
        faithfulSourceAgreesWithRendered(faithfulSource, renderedFaithful)
      ? latexToCalculator(source)
      : (renderedCalculator || (source ? latexToCalculator(source) : ''));
  }

  function cssColorIsFullyTransparent(input) {
    const value = String(input || '').replace(/\s+/g, '').toLowerCase();
    if (!value) return false;
    if (value === 'transparent') return true;
    if (/^#[0-9a-f]{4}$/u.test(value)) return value[4] === '0';
    if (/^#[0-9a-f]{8}$/u.test(value)) return value.slice(-2) === '00';
    return /^(?:rgba|hsla|hsva)\([^)]*,0(?:\.0+)?%?\)$/u.test(value) ||
      /^(?:rgba?|hsla?|hsva?|hwb|lab|lch|oklab|oklch|color)\([^)]*\/0(?:\.0+)?%?\)$/u.test(value);
  }

  function cssPolygonHasVisibleArea(input) {
    const match = String(input || '').trim().toLowerCase().match(/^polygon\((.*)\)(?:\s+padding-box)?$/u);
    if (!match) return false;
    let body = match[1].trim();
    body = body.replace(/^(?:nonzero|evenodd)\s*,\s*/u, '');
    const rawPoints = body.split(',');
    if (rawPoints.length < 3 || rawPoints.length > 256) return false;
    const points = [];
    const number = '-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
    const coordinate = '(?:' + number + '(?:%|px)?|calc\\(\\s*100%\\s*[+-]\\s*' + number + 'px\\s*\\))';
    const pointPattern = new RegExp('^(' + coordinate + ')\\s+(' + coordinate + ')$', 'u');
    const parseCoordinate = (source) => {
      const calc = source.match(/^calc\(\s*100%\s*([+-])\s*(-?(?:\d+(?:\.\d*)?|\.\d+))px\s*\)$/u);
      if (calc) {
        const offset = Number(calc[2]) * (calc[1] === '-' ? -1 : 1);
        return Number.isFinite(offset) ? { percent: 1, px: offset } : null;
      }
      const simple = source.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))(%|px)?$/u);
      if (!simple) return null;
      const amount = Number(simple[1]);
      if (!Number.isFinite(amount)) return null;
      if (simple[2] === '%') return { percent: amount / 100, px: 0 };
      return { percent: 0, px: amount };
    };
    for (const rawPoint of rawPoints) {
      const point = rawPoint.trim().match(pointPattern);
      if (!point) return false;
      const x = parseCoordinate(point[1]);
      const y = parseCoordinate(point[2]);
      if (!x || !y) return false;
      points.push([x, y]);
    }
    const key = (coordinateValue) => coordinateValue.percent + ':' + coordinateValue.px;
    const uniqueX = new Map(points.map((point) => [key(point[0]), point[0]]));
    const uniqueY = new Map(points.map((point) => [key(point[1]), point[1]]));
    const provablySeparated = (values) => {
      if (values.size !== 2) return false;
      const [first, second] = Array.from(values.values());
      const percent = second.percent - first.percent;
      const pixels = second.px - first.px;
      return (percent >= 0 && pixels >= 0 && (percent > 0 || pixels > 0)) ||
        (percent <= 0 && pixels <= 0 && (percent < 0 || pixels < 0));
    };
    if (uniqueX.size === 2 && uniqueY.size === 2 &&
        provablySeparated(uniqueX) && provablySeparated(uniqueY)) {
      const corners = new Set(points.map((point) => key(point[0]) + '|' + key(point[1])));
      if (corners.size === 4) return true;
    }
    // A non-rectangular polygon is accepted only when all coordinates share a
    // single percentage or pixel basis and its shoelace area is nonzero.
    for (const basis of ['percent', 'px']) {
      const other = basis === 'percent' ? 'px' : 'percent';
      if (points.some((point) => point[0][other] !== 0 || point[1][other] !== 0)) continue;
      let doubledArea = 0;
      for (let index = 0; index < points.length; index += 1) {
        const next = points[(index + 1) % points.length];
        doubledArea += (points[index][0][basis] * next[1][basis]) -
          (next[0][basis] * points[index][1][basis]);
      }
      if (Math.abs(doubledArea) > 1e-9) return true;
    }
    return false;
  }

  function computedStyleHasUnsafeVisibleLayout(computed, allowNonzeroPolygonClip) {
    if (!computed) return true;
    const value = (name, property) => String(
      computed[name] || (computed.getPropertyValue && computed.getPropertyValue(property || name)) || ''
    ).trim().toLowerCase();
    const compact = (name, property) => value(name, property).replace(/\s+/g, '');
    const display = value('display');
    const visibility = value('visibility');
    const contentVisibility = value('contentVisibility', 'content-visibility');
    if (display === 'none' || contentVisibility === 'hidden' ||
        visibility === 'hidden' || visibility === 'collapse') return true;

    const opacity = Number.parseFloat(value('opacity') || '1');
    const fontSize = Number.parseFloat(value('fontSize', 'font-size'));
    if ((Number.isFinite(opacity) && opacity <= 0) ||
        (Number.isFinite(fontSize) && fontSize <= 0) ||
        cssColorIsFullyTransparent(value('color')) ||
        cssColorIsFullyTransparent(value('webkitTextFillColor', '-webkit-text-fill-color'))) return true;

    const clip = value('clip');
    const clipPath = value('clipPath', 'clip-path') || value('webkitClipPath', '-webkit-clip-path');
    if (clip && clip !== 'auto') return true;
    if (clipPath && clipPath !== 'none' &&
        !(allowNonzeroPolygonClip && cssPolygonHasVisibleArea(clipPath))) return true;

    const position = value('position');
    const floatValue = value('cssFloat', 'float') || value('float');
    const filter = compact('filter');
    const transform = compact('transform');
    const scale = compact('scale');
    const rotate = compact('rotate');
    const translate = compact('translate');
    const perspective = compact('perspective');
    const safeScale = !scale || scale === 'none' || /^(?:1|1\.0+)(?:\s+(?:1|1\.0+))?$/u.test(scale);
    const safeRotate = !rotate || rotate === 'none' || /^(?:0|0(?:deg|grad|rad|turn))$/u.test(rotate);
    const safeTranslate = !translate || translate === 'none' ||
      /^(?:0|0(?:px|em|rem|%))(?:\s+(?:0|0(?:px|em|rem|%)))?$/u.test(translate);
    if (/^(?:absolute|fixed)$/u.test(position) || (floatValue && floatValue !== 'none') ||
        (filter && filter !== 'none') || (transform && transform !== 'none') ||
        !safeScale || !safeRotate || !safeTranslate ||
        (perspective && perspective !== 'none')) return true;

    const zoom = compact('zoom');
    if (zoom && !/^(?:normal|1|1\.0+|100%)$/u.test(zoom)) return true;
    const maskImage = compact('maskImage', 'mask-image');
    const webkitMaskImage = compact('webkitMaskImage', '-webkit-mask-image');
    if ((maskImage && maskImage !== 'none') || (webkitMaskImage && webkitMaskImage !== 'none')) return true;
    const overflow = value('overflow');
    const overflowX = value('overflowX', 'overflow-x');
    const overflowY = value('overflowY', 'overflow-y');
    const clippedOverflow = [overflow, overflowX, overflowY]
      .some((item) => /^(?:hidden|clip|scroll|auto)$/u.test(item));
    const width = Number.parseFloat(value('width'));
    const height = Number.parseFloat(value('height'));
    if (clippedOverflow && ((Number.isFinite(width) && width <= 0) ||
        (Number.isFinite(height) && height <= 0))) return true;
    const contain = value('contain');
    if (contain && contain !== 'none') return true;
    const textIndent = compact('textIndent', 'text-indent');
    if (textIndent && !/^(?:0|0(?:px|em|rem|%))$/u.test(textIndent)) return true;

    const textTransform = value('textTransform', 'text-transform');
    const textSecurity = value('webkitTextSecurity', '-webkit-text-security');
    const fontVariant = value('fontVariant', 'font-variant');
    const fontVariantCaps = value('fontVariantCaps', 'font-variant-caps');
    if ((textTransform && textTransform !== 'none') || (textSecurity && textSecurity !== 'none') ||
        (fontVariant && fontVariant !== 'normal' && fontVariant !== 'none') ||
        (fontVariantCaps && fontVariantCaps !== 'normal')) return true;
    return false;
  }

  function independentVisibleMathText(root) {
    if (!root || !root.querySelector) return '';
    const candidate = (root.matches && root.matches('.katex-html, mjx-container, .visual-layout, .math-visual, svg'))
      ? root
      : root.querySelector('.katex-html, mjx-container, .visual-layout, .math-visual, svg, [aria-hidden="true"]');
    const independentlyVisibleText = (container) => {
      if (!container) return '';
      const view = container.ownerDocument && container.ownerDocument.defaultView;
      if (!view || typeof view.getComputedStyle !== 'function') return '';
      const chunks = [];
      let length = 0;
      let visited = 0;
      const stack = [container];
      while (stack.length) {
        const node = stack.pop();
        if (!node) continue;
        visited += 1;
        if (visited > MAX_MATHML_NODES) return '';
        if (node.nodeType === 3) {
          const value = node.nodeValue || '';
          length += value.length;
          if (length > MAX_MATH_SOURCE_LENGTH) return '';
          chunks.push(value);
          continue;
        }
        if (node.nodeType !== 1 && node.nodeType !== 11) continue;
        if (node.nodeType === 1) {
          if (isVisuallyHiddenElement(node)) continue;
          try {
            const computed = view.getComputedStyle(node);
            // MathJax clips each visible font glyph to a nonzero polygon. It
            // is the sole clip shape accepted here; every other clip/mask or
            // layout transform is ambiguous and must not authenticate hidden
            // source metadata.
            if (computedStyleHasUnsafeVisibleLayout(computed, true)) continue;
          } catch (_error) {
            return '';
          }
        }
        for (let child = node.lastChild; child; child = child.previousSibling) stack.push(child);
      }
      return chunks.join('');
    };
    const candidateText = cleanClipboardText(independentlyVisibleText(candidate));
    if (candidateText) return candidateText;
    // With no semantic MathML present, ordinary descendant text is the only
    // independent evidence for a data-latex/data-tex annotation. Attribute-
    // only image/ARIA formulas intentionally return empty here because their
    // source is also their sole accessible representation.
    return cleanClipboardText(independentlyVisibleText(root));
  }

  const SOURCELESS_CHTML_STRUCTURAL_TAGS = new Set([
    'mjx-msup', 'mjx-msub', 'mjx-msubsup', 'mjx-mfrac', 'mjx-msqrt',
    'mjx-mroot', 'mjx-mover', 'mjx-munder', 'mjx-munderover', 'mjx-mtable',
    'mjx-mfenced'
  ]);
  const SOURCELESS_CHTML_TRANSPARENT_TAGS = new Set([
    'mjx-math', 'mjx-mrow', 'mjx-texatom', 'mjx-row', 'mjx-base',
    'mjx-script', 'mjx-over', 'mjx-under', 'mjx-box', 'mjx-sqrt', 'mjx-frac',
    'mjx-num', 'mjx-den', 'mjx-table', 'mjx-itable', 'mjx-dbox', 'mjx-dtable',
    'mjx-mtr', 'mjx-mtd', 'mjx-label', 'mjx-labels', 'mjx-root', 'mjx-sub',
    'mjx-sup', 'mjx-utext'
  ]);
  const SOURCELESS_CHTML_EMPTY_LAYOUT_TAGS = new Set([
    'mjx-strut', 'mjx-nstrut', 'mjx-dstrut', 'mjx-line', 'mjx-spacer'
  ]);
  const SOURCELESS_CHTML_TOKEN_TAGS = new Map([
    ['mjx-mi', 'mi'], ['mjx-mn', 'mn'], ['mjx-mo', 'mo'],
    ['mjx-mtext', 'mtext'], ['mjx-ms', 'ms']
  ]);

  function canonicalChtmlOverAccent(value) {
    const textValue = cleanClipboardText(value).replace(/\s+/gu, '');
    if (/^(?:⃗|→|[−-]*→)$/u.test(textValue)) return '\u20d7';
    if (/^(?:⃖|←|←[−-]*)$/u.test(textValue)) return '\u20d6';
    if (/^(?:\^|ˆ|̂)$/u.test(textValue)) return '\u0302';
    if (/^(?:~|˜|̃)$/u.test(textValue)) return '\u0303';
    if (/^(?:¯|‾|ˉ|̅|―+)$/u.test(textValue)) return '\u0305';
    if (/^(?:˙|̇)$/u.test(textValue)) return '\u0307';
    if (/^(?:¨|̈)$/u.test(textValue)) return '\u0308';
    if (/^(?:ˊ|́)$/u.test(textValue)) return '\u0301';
    if (/^(?:ˋ|̀)$/u.test(textValue)) return '\u0300';
    if (/^(?:˘|̆)$/u.test(textValue)) return '\u0306';
    if (/^(?:ˇ|̌)$/u.test(textValue)) return '\u030c';
    if (/^(?:˚|̊)$/u.test(textValue)) return '\u030a';
    if (textValue === '⏞') return '⏞';
    return '';
  }

  function canonicalChtmlUnderAccent(value) {
    const textValue = cleanClipboardText(value).replace(/\s+/gu, '');
    if (/^(?:¯|‾|ˉ|̅|̲|―+|–+|-+|_+)$/u.test(textValue)) return '\u0332';
    if (textValue === '⏟') return '⏟';
    return '';
  }

  function sourceLessMathJaxChtmlTextIsVisible(textNode, visualMath) {
    if (!textNode || textNode.nodeType !== 3 || !visualMath) return false;
    const documentObject = visualMath.ownerDocument;
    const view = documentObject && documentObject.defaultView;
    if (!view || typeof view.getComputedStyle !== 'function') return false;
    for (let element = textNode.parentElement; element; element = element.parentElement) {
      if (isVisuallyHiddenElement(element)) return false;
      // MathJax deliberately marks its complete painted CHTML branch as
      // aria-hidden when a separate speech/assistive branch exists. A hidden
      // descendant, however, is an alternate representation and cannot be
      // allowed to contribute selected glyphs.
      if (element !== visualMath && element.getAttribute &&
          element.getAttribute('aria-hidden') === 'true') return false;
      let computed;
      try { computed = view.getComputedStyle(element); } catch (_error) { return false; }
      const display = String(computed && computed.display || '').toLowerCase();
      const visibility = String(computed && computed.visibility || '').toLowerCase();
      const contentVisibility = String(computed && computed.contentVisibility || '').toLowerCase();
      const opacity = Number.parseFloat(String(computed && computed.opacity || '1'));
      const fontSize = Number.parseFloat(String(computed && computed.fontSize || ''));
      const color = String(computed && computed.color || '').replace(/\s+/g, '').toLowerCase();
      const textFill = String(computed && (computed.webkitTextFillColor || computed.getPropertyValue &&
        computed.getPropertyValue('-webkit-text-fill-color')) || '').replace(/\s+/g, '').toLowerCase();
      if (display === 'none' || contentVisibility === 'hidden' ||
          visibility === 'hidden' || visibility === 'collapse' ||
          (Number.isFinite(opacity) && opacity <= 0) ||
          (Number.isFinite(fontSize) && fontSize <= 0) ||
          color === 'transparent' || /rgba\([^)]*,0(?:\.0+)?\)$/u.test(color) ||
          textFill === 'transparent' || /rgba\([^)]*,0(?:\.0+)?\)$/u.test(textFill)) return false;
      const clip = String(computed && computed.clip || '').trim().toLowerCase();
      const clipPath = String(computed && (computed.clipPath || computed.webkitClipPath) || '').trim().toLowerCase();
      if (clip && clip !== 'auto') return false;
      if (clipPath && clipPath !== 'none' && !cssPolygonHasVisibleArea(clipPath)) return false;
      const mask = String(computed && (computed.maskImage || computed.webkitMaskImage ||
        computed.getPropertyValue && (computed.getPropertyValue('mask-image') ||
          computed.getPropertyValue('-webkit-mask-image'))) || '').trim().toLowerCase();
      if (mask && mask !== 'none') return false;
      const transform = String(computed && computed.transform || '').replace(/\s+/g, '').toLowerCase();
      if (/scale(?:x|y)?\(0(?:\.0+)?\)|matrix\(0(?:\.0+)?,0(?:\.0+)?,0(?:\.0+)?,0(?:\.0+)?,/u.test(transform)) {
        return false;
      }
      if (element === visualMath) return true;
    }
    return false;
  }

  const SOURCELESS_CHTML_TABLE_LAYOUT_ROLES = new Map([
    ['inline-table', new Set(['mjx-mtable', 'mjx-itable', 'mjx-table'])],
    ['table', new Set(['mjx-mtable', 'mjx-itable', 'mjx-table'])],
    ['table-row', new Set(['mjx-mtr', 'mjx-row'])],
    ['table-cell', new Set(['mjx-mtd', 'mjx-cell'])]
  ]);
  const SOURCELESS_CHTML_POSITIONED_LAYOUT_ROLES = new Set([
    // MathJax deliberately positions only named pieces whose semantic role is
    // recovered structurally below. Ordinary rows and operands must remain in
    // normal flow: moving one of those would make DOM order cease to describe
    // the formula the user can see.
    'mjx-over', 'mjx-under', 'mjx-op', 'mjx-sub', 'mjx-sup', 'mjx-script',
    'mjx-root', 'mjx-surd', 'mjx-num', 'mjx-den', 'mjx-numerator',
    'mjx-denominator', 'mjx-line', 'mjx-vsize', 'mjx-strut', 'mjx-nstrut',
    'mjx-dstrut', 'mjx-spacer', 'mjx-delim-h', 'mjx-delim-v'
  ]);
  const SOURCELESS_CHTML_GLYPH_PIECE_ROLES = new Set(['mjx-char', 'mjx-charbox', 'mjx-c']);
  const SOURCELESS_CHTML_STRETCH_SCAFFOLD_ROLES = new Set([
    'mjx-surd', 'mjx-delim-h', 'mjx-delim-v', 'mjx-stretchy-h', 'mjx-stretchy-v'
  ]);
  const SOURCELESS_CHTML_TOKEN_OWNER_ROLES = new Set([
    'mjx-mi', 'mjx-mn', 'mjx-mo', 'mjx-mtext', 'mjx-ms'
  ]);

  function sourceLessChtmlComputedProperty(computed, camelName, cssName) {
    const direct = computed && computed[camelName];
    if (direct != null && String(direct).trim()) return String(direct).trim().toLowerCase();
    if (!computed || typeof computed.getPropertyValue !== 'function') return '';
    return String(computed.getPropertyValue(cssName) || '').trim().toLowerCase();
  }

  function sourceLessChtmlZeroOrAutoOffset(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return !normalized || normalized === 'auto' || normalized === 'normal' ||
      /^[-+]?0(?:\.0+)?(?:px|em|ex|rem|ch|vw|vh|vmin|vmax|%)?$/u.test(normalized);
  }

  function sourceLessChtmlElementMayBePositioned(element, role, roleOf) {
    if (SOURCELESS_CHTML_POSITIONED_LAYOUT_ROLES.has(role)) return true;
    if (!SOURCELESS_CHTML_GLYPH_PIECE_ROLES.has(role)) return false;
    // A normal token leaf is the painted operand/operator itself; shifting it
    // can silently change visible order. MathJax transforms glyph pieces only
    // inside an explicit radical or stretchy-delimiter scaffold. Stop at the
    // first token owner so a page cannot borrow a distant structural ancestor.
    let depth = 0;
    for (let current = element.parentElement; current && depth < 8;
      current = current.parentElement, depth += 1) {
      const ancestorRole = String(roleOf(current) || '').toLowerCase();
      if (SOURCELESS_CHTML_STRETCH_SCAFFOLD_ROLES.has(ancestorRole)) return true;
      if (SOURCELESS_CHTML_TOKEN_OWNER_ROLES.has(ancestorRole)) return false;
    }
    return false;
  }

  function sourceLessChtmlTransformIsSafe(computed, mayBePositioned) {
    const transform = sourceLessChtmlComputedProperty(computed, 'transform', 'transform')
      .replace(/\s+/gu, '');
    const translate = sourceLessChtmlComputedProperty(computed, 'translate', 'translate')
      .replace(/\s+/gu, '');
    const rotate = sourceLessChtmlComputedProperty(computed, 'rotate', 'rotate')
      .replace(/\s+/gu, '');
    const scale = sourceLessChtmlComputedProperty(computed, 'scale', 'scale')
      .replace(/\s+/gu, '');
    const none = (value) => !value || value === 'none';
    const zeroRotation = (value) => none(value) ||
      /^[-+]?0(?:\.0+)?(?:deg|grad|rad|turn)?$/u.test(value);
    const positiveScale = (value) => {
      if (none(value)) return true;
      const pieces = value.split(/[ ,]+/u).filter(Boolean);
      return pieces.length > 0 && pieces.length <= 3 && pieces.every((piece) => {
        const number = Number(piece);
        return Number.isFinite(number) && number > 0;
      });
    };
    if (!zeroRotation(rotate) || !positiveScale(scale)) return false;
    if (none(transform) && none(translate) && none(scale)) return true;
    if (!mayBePositioned) return false;
    if (!none(translate) && /(?:calc\(|var\(|nan|infinity)/u.test(translate)) return false;
    if (none(transform)) return true;
    // CHTML uses translations for accents/scripts and positive axis scaling
    // for stretchy glyph pieces. Rotation, reflection, skew, perspective, and
    // 3-D transforms can paint a different formula than this projector sees.
    if (/(?:rotate|skew|perspective|matrix3d)/u.test(transform)) return false;
    const matrix = transform.match(/^matrix\(([-+\d.e]+),([-+\d.e]+),([-+\d.e]+),([-+\d.e]+),([-+\d.e]+),([-+\d.e]+)\)$/u);
    if (matrix) {
      const values = matrix.slice(1).map(Number);
      return values.every(Number.isFinite) && Math.abs(values[1]) <= 1e-7 &&
        Math.abs(values[2]) <= 1e-7 && values[0] > 0 && values[3] > 0;
    }
    const functions = transform.match(/[a-z0-9]+\([^)]*\)/gu);
    if (!functions || functions.join('') !== transform) return false;
    return functions.every((part) => {
      if (/^translate(?:x|y)?\(/u.test(part)) return !/(?:calc\(|var\(|nan|infinity)/u.test(part);
      const match = part.match(/^scale(?:x|y)?\(([^)]*)\)$/u);
      return Boolean(match) && positiveScale(match[1]);
    });
  }

  function sourceLessChtmlVisualOrderIsSafe(elements, roleOf) {
    if (!Array.isArray(elements) || !elements.length ||
        elements.length > MAX_MATHML_NODES || typeof roleOf !== 'function') return false;
    const documentObject = elements[0] && elements[0].ownerDocument;
    const view = documentObject && documentObject.defaultView;
    if (!view || typeof view.getComputedStyle !== 'function') return false;
    for (const element of elements) {
      const role = String(roleOf(element) || '').toLowerCase();
      const mayBePositioned = sourceLessChtmlElementMayBePositioned(element, role, roleOf);
      let computed;
      try { computed = view.getComputedStyle(element); } catch (_error) { return false; }
      if (!computed || !cssStackMathGeneratedContentIsSafe(element, view)) return false;
      const display = sourceLessChtmlComputedProperty(computed, 'display', 'display');
      if (/^(?:flex|inline-flex|grid|inline-grid)$/u.test(display)) return false;
      if (display === 'inline-table' || display.startsWith('table')) {
        const roles = SOURCELESS_CHTML_TABLE_LAYOUT_ROLES.get(display);
        if (!roles || !roles.has(role)) return false;
      }
      const order = sourceLessChtmlComputedProperty(computed, 'order', 'order');
      if (order && !/^[-+]?0(?:\.0+)?$/u.test(order)) return false;
      const direction = sourceLessChtmlComputedProperty(computed, 'direction', 'direction');
      const unicodeBidi = sourceLessChtmlComputedProperty(computed, 'unicodeBidi', 'unicode-bidi');
      const writingMode = sourceLessChtmlComputedProperty(computed, 'writingMode', 'writing-mode');
      const textTransform = sourceLessChtmlComputedProperty(computed, 'textTransform', 'text-transform');
      const floatValue = sourceLessChtmlComputedProperty(computed, 'cssFloat', 'float') ||
        sourceLessChtmlComputedProperty(computed, 'float', 'float');
      if ((direction && direction !== 'ltr') ||
          (unicodeBidi && unicodeBidi !== 'normal' && unicodeBidi !== 'isolate') ||
          (writingMode && writingMode !== 'horizontal-tb') ||
          (textTransform && textTransform !== 'none') ||
          (floatValue && floatValue !== 'none')) return false;
      const position = sourceLessChtmlComputedProperty(computed, 'position', 'position');
      if (position === 'fixed' || position === 'sticky') return false;
      const offsets = ['top', 'right', 'bottom', 'left'].map((name) =>
        sourceLessChtmlComputedProperty(computed, name, name));
      if (position === 'absolute' && !mayBePositioned) return false;
      if (position === 'relative' && offsets.some((value) => !sourceLessChtmlZeroOrAutoOffset(value)) &&
          !mayBePositioned) return false;
      if (!sourceLessChtmlTransformIsSafe(computed, mayBePositioned)) return false;
    }
    return true;
  }

  function sourceLessMathJaxChtmlDescriptor(root, pageWindow) {
    const cache = ACTIVE_COPY_MATHJAX_CHTML_CACHE;
    if (cache && cache.has(root)) return cache.get(root);
    const finish = (value) => {
      if (cache && root && (typeof root === 'object' || typeof root === 'function')) cache.set(root, value);
      return value;
    };
    if (!root || root.nodeType !== 1 || !root.matches || !root.matches('mjx-container.MathJax') ||
        !root.isConnected || !domTreeWithinBudget(root, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) {
      return finish(null);
    }
    const rawJax = String(root.getAttribute('jax') || '');
    if (rawJax.length > 32) return finish(null);
    const jax = rawJax.trim().toLowerCase();
    // MathJax 3 and 4 both identify their CommonHTML output explicitly.
    // Requiring that renderer-owned marker keeps a page-authored collection
    // of similarly named custom elements from authenticating as source-less
    // math, especially now that a valid formula may be a single token.
    if (jax !== 'chtml') return finish(null);
    // Independent MathML or TeX is authoritative. This projection is solely
    // for genuine CHTML surfaces whose semantic custom-element tree is the
    // only exact representation available to the copy event.
    if ((root.querySelector && root.querySelector('math')) || getMathSource(root, pageWindow)) return finish(null);
    const directMath = elementChildren(root).filter((child) =>
      (child.localName || '').toLowerCase() === 'mjx-math');
    if (directMath.length !== 1) return finish(null);
    const visualMath = directMath[0];
    const visualElements = [root, visualMath].concat(Array.from(visualMath.querySelectorAll('*')));
    if (!sourceLessChtmlVisualOrderIsSafe(
      visualElements,
      (element) => (element.localName || '').toLowerCase()
    )) return finish(null);
    for (const sibling of elementChildren(root)) {
      if (sibling === visualMath) continue;
      const name = (sibling.localName || '').toLowerCase();
      if (!['mjx-speech', 'mjx-assistive-mml'].includes(name)) return finish(null);
      // Renderer-owned accessibility siblings are empty containers or carry
      // their speech through attributes/MathML. Never silently delete actual
      // selected sibling text: malformed or page-authored CHTML must remain
      // native when an alternate branch could be visibly contributing.
      if (String(sibling.textContent || '').trim()) return finish(null);
    }

    const documentObject = root.ownerDocument;
    if (!documentObject || typeof documentObject.createElementNS !== 'function') return finish(null);
    const state = {
      nodes: 0,
      characters: 0,
      tokens: 0,
      consumedText: new Set(),
      semanticIds: new Set(),
      invalid: false
    };
    const make = (name, textValue) => {
      const element = documentObject.createElementNS(MATHML_NAMESPACE, name);
      if (textValue != null) element.textContent = textValue;
      return element;
    };
    const rowFrom = (values) => {
      const items = values.filter(Boolean);
      if (!items.length) return make('mrow');
      if (items.length === 1) return items[0];
      const row = make('mrow');
      for (const item of items) row.appendChild(item);
      return row;
    };
    const markText = (owner) => {
      if (!owner) return '';
      const walker = documentObject.createTreeWalker(owner, 4);
      let value = '';
      for (let textNode = walker.nextNode(); textNode; textNode = walker.nextNode()) {
        const raw = String(textNode.nodeValue || '');
        if (!raw) continue;
        state.characters += raw.length;
        if (state.characters > MAX_MATH_SOURCE_LENGTH ||
            (!/^\s*$/u.test(raw) && !sourceLessMathJaxChtmlTextIsVisible(textNode, visualMath))) {
          state.invalid = true;
          return '';
        }
        state.consumedText.add(textNode);
        value += raw;
      }
      return cleanClipboardText(value).replace(/[\t\n\f\r ]+/g, ' ').trim();
    };
    const ownedDescendants = (owner, wanted) => {
      const values = [];
      const stack = [];
      for (let child = owner.lastElementChild; child; child = child.previousElementSibling) stack.push(child);
      while (stack.length) {
        const element = stack.pop();
        const name = (element.localName || '').toLowerCase();
        if (wanted.has(name)) {
          values.push(element);
          continue;
        }
        if (SOURCELESS_CHTML_STRUCTURAL_TAGS.has(name)) continue;
        for (let child = element.lastElementChild; child; child = child.previousElementSibling) stack.push(child);
      }
      return values;
    };
    const directSemanticChildren = (owner) => elementChildren(owner).filter((child) => {
      const name = (child.localName || '').toLowerCase();
      return !SOURCELESS_CHTML_EMPTY_LAYOUT_TAGS.has(name);
    });
    const convert = (node, depth = 0) => {
      if (!node || state.invalid || depth > MAX_MATHML_DEPTH) {
        state.invalid = true;
        return null;
      }
      state.nodes += 1;
      if (state.nodes > MAX_MATHML_NODES || node.nodeType !== 1) {
        state.invalid = true;
        return null;
      }
      const name = (node.localName || '').toLowerCase();
      const tokenName = SOURCELESS_CHTML_TOKEN_TAGS.get(name);
      if (tokenName) {
        const nestedTokens = Array.from(node.querySelectorAll ? node.querySelectorAll(
          Array.from(SOURCELESS_CHTML_TOKEN_TAGS.keys()).join(',')
        ) : []);
        if (nestedTokens.length) {
          state.invalid = true;
          return null;
        }
        const id = String(node.getAttribute('data-semantic-id') || '');
        if (id) {
          if (id.length > 16 || !/^\d+$/u.test(id) || state.semanticIds.has(id)) {
            state.invalid = true;
            return null;
          }
          state.semanticIds.add(id);
        }
        const value = normalizeOfficeGlyphs(markText(node));
        if (!value) {
          state.invalid = true;
          return null;
        }
        state.tokens += 1;
        return make(tokenName, value);
      }
      if (SOURCELESS_CHTML_EMPTY_LAYOUT_TAGS.has(name)) {
        if (markText(node)) state.invalid = true;
        return null;
      }
      if (name === 'mjx-surd') {
        // The radical glyph is renderer scaffolding; the enclosing msqrt or
        // mroot supplies its semantics. It must still be visible and bounded.
        if (!markText(node)) state.invalid = true;
        return null;
      }
      if (name === 'mjx-msub' || name === 'mjx-msup') {
        const children = directSemanticChildren(node);
        const scriptWrapper = children.find((child) =>
          (child.localName || '').toLowerCase() === 'mjx-script');
        const baseCandidates = children.filter((child) => child !== scriptWrapper);
        const baseOwner = baseCandidates.find((child) =>
          (child.localName || '').toLowerCase() === 'mjx-base') || baseCandidates[0];
        const scriptOwners = scriptWrapper ? directSemanticChildren(scriptWrapper) : baseCandidates.slice(1);
        if (!baseOwner || baseCandidates.length > (scriptWrapper ? 1 : 2) || scriptOwners.length !== 1) {
          state.invalid = true;
          return null;
        }
        const base = convert(baseOwner, depth + 1);
        const script = convert(scriptOwners[0], depth + 1);
        if (!base || !script) { state.invalid = true; return null; }
        const result = make(name === 'mjx-msub' ? 'msub' : 'msup');
        result.append(base, script);
        return result;
      }
      if (name === 'mjx-msubsup') {
        const children = directSemanticChildren(node);
        const scriptWrapper = children.find((child) =>
          (child.localName || '').toLowerCase() === 'mjx-script');
        const baseCandidates = children.filter((child) => child !== scriptWrapper);
        const baseOwner = baseCandidates.find((child) =>
          (child.localName || '').toLowerCase() === 'mjx-base') || baseCandidates[0];
        const scriptChildren = scriptWrapper ? directSemanticChildren(scriptWrapper) : baseCandidates.slice(1);
        const lower = scriptChildren.filter((child) =>
          (child.localName || '').toLowerCase() === 'mjx-sub');
        const upper = scriptChildren.filter((child) =>
          (child.localName || '').toLowerCase() === 'mjx-sup');
        // Bare children have renderer-specific visual order. Without named
        // roles or source metadata, assigning them would be an unsafe guess.
        if (!baseOwner || baseCandidates.length > (scriptWrapper ? 1 : 3) ||
            lower.length !== 1 || upper.length !== 1 || scriptChildren.length !== 2) {
          state.invalid = true;
          return null;
        }
        const base = convert(baseOwner, depth + 1);
        const sub = convert(lower[0], depth + 1);
        const sup = convert(upper[0], depth + 1);
        if (!base || !sub || !sup) { state.invalid = true; return null; }
        const result = make('msubsup'); result.append(base, sub, sup); return result;
      }
      if (name === 'mjx-mover' || name === 'mjx-munder') {
        const children = directSemanticChildren(node);
        const roleName = name === 'mjx-mover' ? 'mjx-over' : 'mjx-under';
        const role = children.filter((child) => (child.localName || '').toLowerCase() === roleName);
        const baseRole = children.filter((child) => (child.localName || '').toLowerCase() === 'mjx-base');
        const other = children.filter((child) => !role.includes(child) && !baseRole.includes(child));
        const baseOwner = baseRole[0] || (other.length === 1 ? other[0] : null);
        if (role.length !== 1 || baseRole.length > 1 || !baseOwner || other.length > (baseRole.length ? 0 : 1)) {
          state.invalid = true;
          return null;
        }
        const base = convert(baseOwner, depth + 1);
        const annotation = convert(role[0], depth + 1);
        if (!base || !annotation) { state.invalid = true; return null; }
        const raw = annotation.textContent || '';
        const canonical = name === 'mjx-mover'
          ? canonicalChtmlOverAccent(raw)
          : canonicalChtmlUnderAccent(raw);
        const result = make(name === 'mjx-mover' ? 'mover' : 'munder');
        result.setAttribute(name === 'mjx-mover' ? 'accent' : 'accentunder', canonical ? 'true' : 'false');
        if (canonical) annotation.textContent = canonical;
        result.append(base, annotation);
        return result;
      }
      if (name === 'mjx-munderover') {
        const roles = ownedDescendants(node, new Set(['mjx-base', 'mjx-under', 'mjx-over']));
        const bases = roles.filter((item) => (item.localName || '').toLowerCase() === 'mjx-base');
        const lowers = roles.filter((item) => (item.localName || '').toLowerCase() === 'mjx-under');
        const uppers = roles.filter((item) => (item.localName || '').toLowerCase() === 'mjx-over');
        if (bases.length !== 1 || lowers.length !== 1 || uppers.length !== 1) {
          state.invalid = true;
          return null;
        }
        const base = convert(bases[0], depth + 1);
        const lower = convert(lowers[0], depth + 1);
        const upper = convert(uppers[0], depth + 1);
        if (!base || !lower || !upper) { state.invalid = true; return null; }
        const result = make('munderover'); result.append(base, lower, upper); return result;
      }
      if (name === 'mjx-mfrac') {
        const roles = ownedDescendants(node, new Set(['mjx-num', 'mjx-den']));
        const numerators = roles.filter((item) => (item.localName || '').toLowerCase() === 'mjx-num');
        const denominators = roles.filter((item) => (item.localName || '').toLowerCase() === 'mjx-den');
        if (numerators.length !== 1 || denominators.length !== 1) {
          state.invalid = true;
          return null;
        }
        const numerator = convert(numerators[0], depth + 1);
        const denominator = convert(denominators[0], depth + 1);
        if (!numerator || !denominator) { state.invalid = true; return null; }
        const result = make('mfrac'); result.append(numerator, denominator); return result;
      }
      if (name === 'mjx-msqrt' || name === 'mjx-mroot') {
        const boxes = ownedDescendants(node, new Set(['mjx-box']));
        if (boxes.length !== 1) { state.invalid = true; return null; }
        const surds = ownedDescendants(node, new Set(['mjx-surd']));
        if (surds.length > 1) { state.invalid = true; return null; }
        for (const surd of surds) if (!markText(surd)) { state.invalid = true; return null; }
        const radicand = convert(boxes[0], depth + 1);
        if (!radicand) { state.invalid = true; return null; }
        if (name === 'mjx-msqrt') {
          const result = make('msqrt'); result.appendChild(radicand); return result;
        }
        const roots = ownedDescendants(node, new Set(['mjx-root']));
        if (roots.length !== 1) { state.invalid = true; return null; }
        const degree = convert(roots[0], depth + 1);
        if (!degree) { state.invalid = true; return null; }
        const result = make('mroot'); result.append(radicand, degree); return result;
      }
      if (name === 'mjx-mtable') {
        const rows = ownedDescendants(node, new Set(['mjx-mtr']));
        if (!rows.length || rows.length > MAX_MATHML_NODES) { state.invalid = true; return null; }
        const table = make('mtable');
        let columns = -1;
        for (const sourceRow of rows) {
          const cells = ownedDescendants(sourceRow, new Set(['mjx-mtd']));
          if (!cells.length || (columns >= 0 && columns !== cells.length)) {
            state.invalid = true;
            return null;
          }
          columns = cells.length;
          const row = make('mtr');
          for (const sourceCell of cells) {
            const value = convert(sourceCell, depth + 1);
            if (!value) { state.invalid = true; return null; }
            const cell = make('mtd'); cell.appendChild(value); row.appendChild(cell);
          }
          table.appendChild(row);
        }
        return table;
      }
      if (name === 'mjx-mfenced') {
        // CHTML normally paints fences as explicit mjx-mo tokens. A bare
        // mfenced attribute has no selected glyph with which to authenticate
        // its open/close characters, so it is deliberately unsupported.
        state.invalid = true;
        return null;
      }
      if (!SOURCELESS_CHTML_TRANSPARENT_TAGS.has(name)) {
        state.invalid = true;
        return null;
      }
      const converted = [];
      for (const child of directSemanticChildren(node)) {
        const value = convert(child, depth + 1);
        if (value) converted.push(value);
      }
      return rowFrom(converted);
    };

    const presentation = convert(visualMath);
    // A genuine CHTML equation is not required to contain a fraction, script,
    // radical, or accent. MathJax emits the same authenticated container and
    // token topology for a lone inline variable such as `V` or `R`. Rejecting
    // those leaf-only roots makes one harmless variable invalidate an entire
    // mixed prose selection and hands the copy back to the browser, including
    // every flattened renderer artifact and image description. Token-only
    // roots still pass all of the strict checks above: one direct mjx-math
    // branch, allowlisted CHTML elements, visible and fully consumed text,
    // bounded traversal, sanitized MathML agreement, and punctuation
    // agreement. Require at least one converted token so empty renderer
    // scaffolding cannot authenticate itself.
    if (state.invalid || !presentation || !state.tokens) return finish(null);
    const allText = documentObject.createTreeWalker(visualMath, 4);
    let nativeVisibleText = '';
    for (let textNode = allText.nextNode(); textNode; textNode = allText.nextNode()) {
      const raw = String(textNode.nodeValue || '');
      if (!raw || /^\s*$/u.test(raw)) continue;
      if (!state.consumedText.has(textNode)) return finish(null);
      nativeVisibleText += raw;
    }
    nativeVisibleText = cleanClipboardText(nativeVisibleText);
    if (!nativeVisibleText || nativeVisibleText.length > MAX_SELECTION_KEY_LENGTH) return finish(null);
    const math = make('math'); math.appendChild(presentation);
    const safeMath = sanitizedMathMLClone(math);
    if (!safeMath || !semanticMathAgreesWithVisibleText(safeMath, nativeVisibleText, false)) return finish(null);
    const semanticPunctuation = canonicalVisiblePunctuationProfile(safeMath.textContent || '');
    const visiblePunctuation = canonicalVisiblePunctuationProfile(nativeVisibleText);
    if (!punctuationProfilesAgree(semanticPunctuation, visiblePunctuation)) return finish(null);
    return finish({ root, visualMath, math: safeMath, nativeVisibleText });
  }

  const MATHJAX2_CHTML_TOKEN_CLASSES = new Map([
    ['mjx-mi', 'mi'], ['mjx-mn', 'mn'], ['mjx-mo', 'mo'],
    ['mjx-mtext', 'mtext'], ['mjx-ms', 'ms']
  ]);
  const MATHJAX2_CHTML_TRANSPARENT_CLASSES = new Set([
    'mjx-math', 'mjx-mrow', 'mjx-mstyle', 'mjx-mpadded',
    'mjx-texatom', 'mjx-semantics'
  ]);
  const MATHJAX2_CHTML_STRUCTURAL_CLASSES = new Set([
    'mjx-msubsup', 'mjx-mfrac', 'mjx-msqrt', 'mjx-mroot',
    'mjx-munderover', 'mjx-mtable'
  ]);
  const MATHJAX2_CHTML_ROLE_CLASSES = new Set([
    'mjx-base', 'mjx-sub', 'mjx-sup', 'mjx-stack', 'mjx-over',
    'mjx-under', 'mjx-op', 'mjx-numerator', 'mjx-denominator',
    'mjx-root', 'mjx-surd', 'mjx-box', 'mjx-itable', 'mjx-table',
    'mjx-row', 'mjx-cell', 'mjx-mtr', 'mjx-mtd'
  ]);
  const MATHJAX2_CHTML_GLYPH_CLASSES = new Set([
    'mjx-char', 'mjx-charbox', 'mjx-delim-h', 'mjx-delim-v'
  ]);
  const MATHJAX2_CHTML_EMPTY_CLASSES = new Set([
    'mjx-line', 'mjx-vsize', 'mjx-strut', 'mjx-spacer', 'mjx-mspace'
  ]);
  const MATHJAX2_CHTML_ALLOWED_CLASSES = new Set([
    'mjx-chtml',
    ...MATHJAX2_CHTML_TOKEN_CLASSES.keys(),
    ...MATHJAX2_CHTML_TRANSPARENT_CLASSES,
    ...MATHJAX2_CHTML_STRUCTURAL_CLASSES,
    ...MATHJAX2_CHTML_ROLE_CLASSES,
    ...MATHJAX2_CHTML_GLYPH_CLASSES,
    ...MATHJAX2_CHTML_EMPTY_CLASSES
  ]);
  const MATHJAX2_CHTML_FONT_VARIANTS = Object.freeze({
    'MJXc-TeX-main-R': 'normal',
    'MJXc-TeX-main-I': 'italic',
    'MJXc-TeX-main-B': 'bold',
    'MJXc-TeX-math-BI': 'bold-italic',
    'MJXc-TeX-cal-R': 'script',
    'MJXc-TeX-cal-B': 'bold-script',
    'MJXc-TeX-frak-R': 'fraktur',
    'MJXc-TeX-frak-B': 'bold-fraktur',
    'MJXc-TeX-ams-R': 'double-struck',
    'MJXc-TeX-sans-R': 'sans-serif',
    'MJXc-TeX-sans-I': 'sans-serif-italic',
    'MJXc-TeX-sans-B': 'bold-sans-serif',
    'MJXc-TeX-type-R': 'monospace'
  });

  function mathJax2ChtmlPrimaryClass(element) {
    if (!element || element.nodeType !== 1 || (element.localName || '').toLowerCase() !== 'span') return '';
    const values = Array.from(element.classList || []).filter((name) => /^mjx-[a-z0-9-]+$/u.test(name));
    return values.length === 1 ? values[0] : '';
  }

  function mathJax2ChtmlTokenMathVariant(token, role) {
    if (!['mjx-mi', 'mjx-mn'].includes(role)) return { variant: '' };
    const children = elementChildren(token);
    if (children.length !== 1 || mathJax2ChtmlPrimaryClass(children[0]) !== 'mjx-char' ||
        elementChildren(children[0]).length) return { variant: '' };
    const classes = Array.from(children[0].classList || []);
    const fonts = classes.filter((name) =>
      Object.prototype.hasOwnProperty.call(MATHJAX2_CHTML_FONT_VARIANTS, name)
    );
    // Font semantics are trusted only on the exact official glyph leaf. A
    // page-added class, multiple font declarations, or nested box remains an
    // ordinary visible token and cannot forge a mathematical alphabet.
    if (!fonts.length) return { variant: '' };
    if (fonts.length !== 1 || classes.some((name) => name !== 'mjx-char' && name !== fonts[0])) return null;
    return { variant: MATHJAX2_CHTML_FONT_VARIANTS[fonts[0]] };
  }

  function mathJax2ChtmlShape(root) {
    if (!root || root.nodeType !== 1 || !root.matches ||
        !root.matches('span.mjx-chtml.MathJax_CHTML') || hasSignificantDirectText(root)) return null;
    const children = elementChildren(root);
    if (!children.length || children.length > 2 ||
        mathJax2ChtmlPrimaryClass(children[0]) !== 'mjx-math') return null;
    const visualMath = children[0];
    if (children.length === 1) return { visualMath, assistiveBranch: null, assistiveMath: null };

    // AssistiveMML.js in the official v2 full configurations appends exactly
    // one clipped MathML sibling after the painted CommonHTML branch. Model
    // only that renderer-owned shape; an arbitrary second branch must never
    // be mistaken for selected glyphs or silently discarded.
    const assistiveBranch = children[1];
    const classNames = Array.from(assistiveBranch.classList || []);
    if ((assistiveBranch.localName || '').toLowerCase() !== 'span' ||
        !classNames.includes('MJX_Assistive_MathML') ||
        classNames.some((name) => !['MJX_Assistive_MathML', 'MJX_Assistive_MathML_Block'].includes(name)) ||
        assistiveBranch.getAttribute('role') !== 'presentation' ||
        hasSignificantDirectText(assistiveBranch)) return null;
    const assistiveChildren = elementChildren(assistiveBranch);
    const assistiveMath = assistiveChildren.length === 1 &&
      (assistiveChildren[0].localName || '').toLowerCase() === 'math' &&
      assistiveChildren[0].namespaceURI === MATHML_NAMESPACE
      ? assistiveChildren[0]
      : null;
    return assistiveMath ? { visualMath, assistiveBranch, assistiveMath } : null;
  }

  function mathJax2AssistiveBranchIsHidden(branch) {
    const documentObject = branch && branch.ownerDocument;
    const view = documentObject && documentObject.defaultView;
    if (!branch || !view || typeof view.getComputedStyle !== 'function') return false;
    let computed;
    try { computed = view.getComputedStyle(branch); } catch (_error) { return false; }
    const display = String(computed && computed.display || '').toLowerCase();
    const visibility = String(computed && computed.visibility || '').toLowerCase();
    if (display === 'none' || visibility === 'hidden' || visibility === 'collapse') return true;
    const position = String(computed && computed.position || '').toLowerCase();
    const clip = String(computed && computed.clip || '').trim().toLowerCase();
    const overflow = String(computed && computed.overflow || '').toLowerCase();
    const width = Number.parseFloat(String(computed && computed.width || ''));
    const height = Number.parseFloat(String(computed && computed.height || ''));
    const officialBlockBranch = branch.classList &&
      branch.classList.contains('MJX_Assistive_MathML_Block');
    // Display math deliberately gives the clipped assistive branch width
    // 100% while keeping it one pixel high. Requiring a one-pixel width
    // rejects official MathJax 2 display output even though the exact
    // renderer-owned Block class, rect clip, absolute positioning, and hidden
    // overflow prove that the branch is not painted selectable content.
    return position === 'absolute' && clip && clip !== 'auto' && overflow === 'hidden' &&
      Number.isFinite(height) && height <= 2 &&
      ((Number.isFinite(width) && width <= 2) || officialBlockBranch);
  }

  function mathJax2ChtmlDescriptor(root) {
    const cache = ACTIVE_COPY_MATHJAX2_CHTML_CACHE;
    if (cache && cache.has(root)) return cache.get(root);
    const finish = (value) => {
      if (cache && root && (typeof root === 'object' || typeof root === 'function')) cache.set(root, value);
      return value;
    };
    if (!root || root.nodeType !== 1 || !root.matches ||
        !root.matches('span.mjx-chtml.MathJax_CHTML') || !root.isConnected ||
        !domTreeWithinBudget(root, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return finish(null);
    const shape = mathJax2ChtmlShape(root);
    if (!shape) return finish(null);
    const { visualMath, assistiveBranch, assistiveMath } = shape;
    const documentObject = root.ownerDocument;
    if (!documentObject || typeof documentObject.createElementNS !== 'function') return finish(null);

    // Authenticate the complete CommonHTML vocabulary before projecting any
    // part of it. MathJax 2 emits ordinary spans with one lower-case mjx role
    // class; its additional MJXc-* classes describe fonts and spacing only.
    // Unknown elements or role combinations remain native until modeled.
    const elements = [root, visualMath].concat(Array.from(visualMath.querySelectorAll('*')));
    if (elements.length > MAX_MATHML_NODES) return finish(null);
    for (const element of elements) {
      const role = mathJax2ChtmlPrimaryClass(element);
      if (!role || !MATHJAX2_CHTML_ALLOWED_CLASSES.has(role) ||
          (element !== root && role === 'mjx-chtml')) return finish(null);
    }
    if (!sourceLessChtmlVisualOrderIsSafe(elements, mathJax2ChtmlPrimaryClass)) return finish(null);

    const state = {
      nodes: 0,
      characters: 0,
      tokens: 0,
      consumedText: new Set(),
      alignmentFillers: new Set(),
      invalid: false
    };
    const make = (name, textValue) => {
      const element = documentObject.createElementNS(MATHML_NAMESPACE, name);
      if (textValue != null) element.textContent = textValue;
      return element;
    };
    const rowFrom = (values) => {
      const items = values.filter(Boolean);
      if (!items.length) return make('mrow');
      if (items.length === 1) return items[0];
      const row = make('mrow');
      for (const item of items) row.appendChild(item);
      return row;
    };
    const markText = (owner) => {
      const walker = documentObject.createTreeWalker(owner, 4);
      let value = '';
      for (let textNode = walker.nextNode(); textNode; textNode = walker.nextNode()) {
        const raw = String(textNode.nodeValue || '');
        if (!raw) continue;
        state.characters += raw.length;
        if (state.characters > MAX_MATH_SOURCE_LENGTH ||
            (!/^\s*$/u.test(raw) && state.consumedText.has(textNode)) ||
            (!/^\s*$/u.test(raw) && !sourceLessMathJaxChtmlTextIsVisible(textNode, visualMath))) {
          state.invalid = true;
          return '';
        }
        state.consumedText.add(textNode);
        value += raw;
      }
      return cleanClipboardText(value).replace(/[\t\n\f\r ]+/g, ' ').trim();
    };
    const ownedRoles = (owner, wanted) => {
      const values = [];
      const stack = [];
      for (let child = owner.lastElementChild; child; child = child.previousElementSibling) stack.push(child);
      while (stack.length) {
        const element = stack.pop();
        const role = mathJax2ChtmlPrimaryClass(element);
        if (wanted.has(role)) {
          values.push(element);
          continue;
        }
        if (MATHJAX2_CHTML_STRUCTURAL_CLASSES.has(role)) continue;
        for (let child = element.lastElementChild; child; child = child.previousElementSibling) stack.push(child);
      }
      return values;
    };
    const convertEmptyRole = (node, role) => {
      // Official v2 CommonHTML emits an empty mjx-mspace for explicit TeX
      // spacing. A positive renderer width is authored semantic separation
      // (`120\,\mathrm V`) and must survive as MathML mspace; dropping it
      // merges units and makes source agreement fail. Unlike the older
      // rule/vsize/strut boxes, no descendant is part of this grammar.
      if (role === 'mjx-mspace') {
        const attributes = Array.from(node.attributes || []);
        const id = node.getAttribute && node.getAttribute('id') || '';
        const classesAreExact = Array.from(node.classList || []).every((name) => name === 'mjx-mspace');
        if (!classesAreExact ||
            attributes.some((attribute) => !['class', 'id', 'style'].includes(attribute.name)) ||
            (id && !/^MJXc-Node-[1-9][0-9]{0,8}$/u.test(id)) ||
            elementChildren(node).length || String(node.textContent || '') !== '') {
          state.invalid = true;
          return null;
        }
        const style = String(node.getAttribute && node.getAttribute('style') || '');
        const declarations = style.split(';').map((value) => value.trim()).filter(Boolean);
        const measurements = new Map();
        for (const declaration of declarations) {
          const match = declaration.match(/^([a-z-]+)\s*:\s*(.*?)\s*$/iu);
          if (!match || !['font-size', 'width', 'height'].includes(match[1].toLowerCase()) ||
              measurements.has(match[1].toLowerCase())) {
            state.invalid = true;
            return null;
          }
          measurements.set(match[1].toLowerCase(), match[2]);
        }
        const width = measurements.get('width') || '';
        const height = measurements.get('height') || '';
        const fontSize = measurements.get('font-size') || '';
        const widthMatch = width.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(em|ex|px|pt)$/iu);
        const heightMatch = !height || height.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(em|ex|px|pt)$/iu);
        const fontSizeMatch = !fontSize || fontSize.match(/^(?:\d+(?:\.\d*)?|\.\d+)%$/u);
        if ((style && (!widthMatch || !heightMatch || !fontSizeMatch)) ||
            (widthMatch && Math.abs(Number(widthMatch[1])) > 16) ||
            (height && Math.abs(Number(heightMatch[1])) > 16) ||
            (fontSize && (Number.parseFloat(fontSize) <= 0 || Number.parseFloat(fontSize) > 1000))) {
          state.invalid = true;
          return null;
        }
        if (!widthMatch || Number(widthMatch[1]) <= 0) return null;
        const space = make('mspace');
        space.setAttribute('width', widthMatch[1] + widthMatch[2].toLowerCase());
        return space;
      }
      if (markText(node)) state.invalid = true;
      return null;
    };
    const inlineMathJax2CellAlignment = (cell) => {
      const style = String(cell && cell.getAttribute && cell.getAttribute('style') || '');
      const declarations = style.split(';').map((value) => value.trim()).filter(Boolean);
      const alignments = declarations.filter((value) => /^text-align\s*:/iu.test(value));
      if (alignments.length !== 1) return '';
      const match = alignments[0].match(/^text-align\s*:\s*(right|left)\s*(?:!important\s*)?$/iu);
      return match ? match[1].toLowerCase() : '';
    };
    const exactMathJax2AlignmentFiller = (cell) => {
      // TeX's aligned environment is rendered as two cells per row. The
      // left-aligned relation cell starts with one exact, empty mjx-mi before
      // the equals sign. It is a renderer alignment atom, not a missing
      // identifier. Model only the official direct mtd > mrow > mi shape.
      const cellChildren = elementChildren(cell);
      if (cellChildren.length !== 1 ||
          mathJax2ChtmlPrimaryClass(cellChildren[0]) !== 'mjx-mrow') return null;
      const rowChildren = elementChildren(cellChildren[0]);
      const filler = rowChildren[0];
      const attributes = filler ? Array.from(filler.attributes || []) : [];
      const id = filler && filler.getAttribute && filler.getAttribute('id') || '';
      if (!filler || rowChildren.length < 2 ||
          mathJax2ChtmlPrimaryClass(filler) !== 'mjx-mi' ||
          Array.from(filler.classList || []).some((name) => name !== 'mjx-mi') ||
          attributes.some((attribute) => !['class', 'id'].includes(attribute.name)) ||
          (id && !/^MJXc-Node-[1-9][0-9]{0,8}$/u.test(id)) ||
          elementChildren(filler).length || String(filler.textContent || '') !== '') return null;
      return filler;
    };
    let convert;
    const convertLoose = (node, depth) => {
      if (!node || state.invalid || depth > MAX_MATHML_DEPTH) {
        state.invalid = true;
        return null;
      }
      const role = mathJax2ChtmlPrimaryClass(node);
      if (MATHJAX2_CHTML_TOKEN_CLASSES.has(role) ||
          MATHJAX2_CHTML_TRANSPARENT_CLASSES.has(role) ||
          MATHJAX2_CHTML_STRUCTURAL_CLASSES.has(role)) return convert(node, depth + 1);
      if (MATHJAX2_CHTML_EMPTY_CLASSES.has(role)) {
        return convertEmptyRole(node, role);
      }
      if (!MATHJAX2_CHTML_ROLE_CLASSES.has(role)) {
        state.invalid = true;
        return null;
      }
      const values = [];
      for (const child of elementChildren(node)) {
        const value = convertLoose(child, depth + 1);
        if (value) values.push(value);
      }
      return rowFrom(values);
    };
    const roleValue = (role, depth) => convertLoose(role, depth + 1);

    convert = (node, depth = 0) => {
      if (!node || state.invalid || depth > MAX_MATHML_DEPTH) {
        state.invalid = true;
        return null;
      }
      state.nodes += 1;
      if (state.nodes > MAX_MATHML_NODES) {
        state.invalid = true;
        return null;
      }
      const role = mathJax2ChtmlPrimaryClass(node);
      const tokenName = MATHJAX2_CHTML_TOKEN_CLASSES.get(role);
      if (tokenName) {
        const descendants = Array.from(node.querySelectorAll('*'));
        if (descendants.length > MAX_MATHML_NODES || descendants.some((element) => {
          const childRole = mathJax2ChtmlPrimaryClass(element);
          return !MATHJAX2_CHTML_GLYPH_CLASSES.has(childRole) &&
            !(MATHJAX2_CHTML_EMPTY_CLASSES.has(childRole) && childRole !== 'mjx-mspace') &&
            childRole !== 'mjx-box';
        })) {
          state.invalid = true;
          return null;
        }
        const value = normalizeOfficeGlyphs(markText(node));
        if (!value) {
          if (role === 'mjx-mi' && state.alignmentFillers.has(node) &&
              elementChildren(node).length === 0 && String(node.textContent || '') === '') {
            return null;
          }
          // MathJax 2 CommonHTML represents U+2061 FUNCTION APPLICATION with
          // exactly one empty `mjx-mo > mjx-char` glyph box. It is emitted
          // between a named function and its argument (`tan ϕ`, `cos ϕ`) but
          // contributes no painted or selectable character. Treat only that
          // exact renderer-owned empty topology as transparent. Any text,
          // nested element, additional role/font class, or other empty token
          // remains invalid and fails closed.
          const emptyGlyphs = elementChildren(node);
          const invisibleFunctionApplication = role === 'mjx-mo' &&
            emptyGlyphs.length === 1 &&
            mathJax2ChtmlPrimaryClass(emptyGlyphs[0]) === 'mjx-char' &&
            Array.from(emptyGlyphs[0].classList || []).every((name) => name === 'mjx-char') &&
            elementChildren(emptyGlyphs[0]).length === 0 &&
            String(node.textContent || '') === '';
          const previous = node.previousElementSibling;
          const functionName = invisibleFunctionApplication &&
            mathJax2ChtmlPrimaryClass(previous) === 'mjx-mi'
            ? cleanClipboardText(previous.textContent || '').trim().toLowerCase()
            : '';
          if (functionName && functionName.length <= 16 && CALCULATOR_FUNCTIONS.has(functionName) &&
              node.nextElementSibling) {
            // Preserve the semantic function boundary. U+2061 is removed from
            // ordinary visible-text keys, but the faithful/calculator
            // serializers use it to distinguish `cos ϕ` from the product of
            // four variables `c·o·s·ϕ`.
            state.tokens += 1;
            return make('mo', '\u2061');
          }
          state.invalid = true;
          return null;
        }
        state.tokens += 1;
        const token = make(tokenName, value);
        const mathVariant = mathJax2ChtmlTokenMathVariant(node, role);
        if (!mathVariant) { state.invalid = true; return null; }
        if (mathVariant.variant) token.setAttribute('mathvariant', mathVariant.variant);
        return token;
      }
      if (MATHJAX2_CHTML_EMPTY_CLASSES.has(role)) {
        return convertEmptyRole(node, role);
      }
      if (role === 'mjx-msubsup') {
        const roles = ownedRoles(node, new Set(['mjx-base', 'mjx-sub', 'mjx-sup']));
        const bases = roles.filter((item) => mathJax2ChtmlPrimaryClass(item) === 'mjx-base');
        const subs = roles.filter((item) => mathJax2ChtmlPrimaryClass(item) === 'mjx-sub');
        const sups = roles.filter((item) => mathJax2ChtmlPrimaryClass(item) === 'mjx-sup');
        if (bases.length !== 1 || subs.length > 1 || sups.length > 1 ||
            (!subs.length && !sups.length)) {
          state.invalid = true;
          return null;
        }
        const base = roleValue(bases[0], depth);
        const sub = subs.length ? roleValue(subs[0], depth) : null;
        const sup = sups.length ? roleValue(sups[0], depth) : null;
        if (!base || (subs.length && !sub) || (sups.length && !sup)) {
          state.invalid = true;
          return null;
        }
        const result = make(sub && sup ? 'msubsup' : (sub ? 'msub' : 'msup'));
        result.appendChild(base);
        if (sub) result.appendChild(sub);
        if (sup) result.appendChild(sup);
        return result;
      }
      if (role === 'mjx-munderover') {
        const names = new Set(['mjx-base', 'mjx-op', 'mjx-sub', 'mjx-sup', 'mjx-under', 'mjx-over']);
        const roles = ownedRoles(node, names);
        const byName = (name) => roles.filter((item) => mathJax2ChtmlPrimaryClass(item) === name);
        const baseRoles = byName('mjx-base').concat(byName('mjx-op'));
        const subs = byName('mjx-sub');
        const sups = byName('mjx-sup');
        const unders = byName('mjx-under');
        const overs = byName('mjx-over');
        if (baseRoles.length !== 1 || subs.length > 1 || sups.length > 1 ||
            unders.length > 1 || overs.length > 1 ||
            ((subs.length || sups.length) && (unders.length || overs.length)) ||
            (!subs.length && !sups.length && !unders.length && !overs.length)) {
          state.invalid = true;
          return null;
        }
        const base = roleValue(baseRoles[0], depth);
        if (!base) { state.invalid = true; return null; }
        if (subs.length || sups.length) {
          const sub = subs.length ? roleValue(subs[0], depth) : null;
          const sup = sups.length ? roleValue(sups[0], depth) : null;
          if ((subs.length && !sub) || (sups.length && !sup)) { state.invalid = true; return null; }
          // This renderer class is reserved for limits placed below/above a
          // large operator. Ordinary side scripts use mjx-msubsup. Preserve
          // that distinction so ∑ bounds remain limits rather than turning
          // the operator into a parenthesized scripted operand.
          const result = make(sub && sup ? 'munderover' : (sub ? 'munder' : 'mover'));
          result.appendChild(base);
          if (sub) result.appendChild(sub);
          if (sup) result.appendChild(sup);
          return result;
        }
        const under = unders.length ? roleValue(unders[0], depth) : null;
        const over = overs.length ? roleValue(overs[0], depth) : null;
        if ((unders.length && !under) || (overs.length && !over)) { state.invalid = true; return null; }
        const result = make(under && over ? 'munderover' : (under ? 'munder' : 'mover'));
        const underAccent = under && canonicalChtmlUnderAccent(under.textContent || '');
        const overAccent = over && canonicalChtmlOverAccent(over.textContent || '');
        if (under) {
          result.setAttribute('accentunder', underAccent ? 'true' : 'false');
          if (underAccent) under.textContent = underAccent;
        }
        if (over) {
          result.setAttribute('accent', overAccent ? 'true' : 'false');
          if (overAccent) over.textContent = overAccent;
        }
        result.appendChild(base);
        if (under) result.appendChild(under);
        if (over) result.appendChild(over);
        return result;
      }
      if (role === 'mjx-mfrac') {
        const roles = ownedRoles(node, new Set(['mjx-numerator', 'mjx-denominator']));
        const numerators = roles.filter((item) => mathJax2ChtmlPrimaryClass(item) === 'mjx-numerator');
        const denominators = roles.filter((item) => mathJax2ChtmlPrimaryClass(item) === 'mjx-denominator');
        if (numerators.length !== 1 || denominators.length !== 1) { state.invalid = true; return null; }
        const numerator = roleValue(numerators[0], depth);
        const denominator = roleValue(denominators[0], depth);
        if (!numerator || !denominator) { state.invalid = true; return null; }
        const result = make('mfrac'); result.append(numerator, denominator); return result;
      }
      if (role === 'mjx-msqrt' || role === 'mjx-mroot') {
        const surds = ownedRoles(node, new Set(['mjx-surd']));
        const roots = ownedRoles(node, new Set(['mjx-root']));
        if (surds.length !== 1 || (role === 'mjx-mroot' ? roots.length !== 1 : roots.length !== 0)) {
          state.invalid = true;
          return null;
        }
        if (!markText(surds[0])) { state.invalid = true; return null; }
        const radicandOwner = surds[0].nextElementSibling;
        if (!radicandOwner || mathJax2ChtmlPrimaryClass(radicandOwner) !== 'mjx-box') {
          state.invalid = true;
          return null;
        }
        const radicand = roleValue(radicandOwner, depth);
        if (!radicand) { state.invalid = true; return null; }
        if (role === 'mjx-msqrt') {
          const result = make('msqrt'); result.appendChild(radicand); return result;
        }
        const degree = roleValue(roots[0], depth);
        if (!degree) { state.invalid = true; return null; }
        const result = make('mroot'); result.append(radicand, degree); return result;
      }
      if (role === 'mjx-mtable') {
        const rows = ownedRoles(node, new Set(['mjx-mtr']));
        if (!rows.length || rows.length > MAX_MATHML_NODES) { state.invalid = true; return null; }
        const table = make('mtable');
        let columns = -1;
        const rowCells = [];
        let alignmentLayout = true;
        const alignmentFillers = [];
        for (const sourceRow of rows) {
          const cells = elementChildren(sourceRow);
          if (!cells.length || cells.some((cell) => mathJax2ChtmlPrimaryClass(cell) !== 'mjx-mtd') ||
              (columns >= 0 && columns !== cells.length)) {
            state.invalid = true;
            return null;
          }
          columns = cells.length;
          rowCells.push(cells);
          const rowFillers = [];
          if (cells.length < 2 || cells.length % 2 !== 0) {
            alignmentLayout = false;
          } else {
            for (let index = 0; index < cells.length; index += 2) {
              const filler = inlineMathJax2CellAlignment(cells[index]) === 'right' &&
                inlineMathJax2CellAlignment(cells[index + 1]) === 'left'
                ? exactMathJax2AlignmentFiller(cells[index + 1])
                : null;
              if (!filler) {
                alignmentLayout = false;
                break;
              }
              rowFillers.push(filler);
            }
          }
          alignmentFillers.push(...rowFillers);
        }
        if (alignmentLayout) {
          alignmentFillers.forEach((filler) => state.alignmentFillers.add(filler));
          table.setAttribute('columnalign', Array.from({ length: columns }, (_value, index) =>
            index % 2 ? 'left' : 'right'
          ).join(' '));
          table.setAttribute('columnspacing', Array.from({ length: columns }, (_value, index) =>
            index % 2 ? '2em' : '0em'
          ).join(' '));
          AUTHENTIC_ALIGNED_MATHML_TABLES.add(table);
        }
        for (const cells of rowCells) {
          const row = make('mtr');
          for (const sourceCell of cells) {
            const value = roleValue(sourceCell, depth);
            if (!value) { state.invalid = true; return null; }
            const cell = make('mtd'); cell.appendChild(value); row.appendChild(cell);
          }
          table.appendChild(row);
        }
        return table;
      }
      if (!MATHJAX2_CHTML_TRANSPARENT_CLASSES.has(role)) {
        state.invalid = true;
        return null;
      }
      // `semantics` renders only its first presentation child. Reject extra
      // branches rather than accidentally selecting annotation text.
      const semanticChildren = elementChildren(node).filter((child) =>
        mathJax2ChtmlPrimaryClass(child) === 'mjx-mspace' ||
        !MATHJAX2_CHTML_EMPTY_CLASSES.has(mathJax2ChtmlPrimaryClass(child))
      );
      if (role === 'mjx-semantics' && semanticChildren.length !== 1) {
        state.invalid = true;
        return null;
      }
      const converted = [];
      for (const child of semanticChildren) {
        const value = convertLoose(child, depth + 1);
        if (value) converted.push(value);
      }
      return rowFrom(converted);
    };

    const presentation = convert(visualMath);
    if (state.invalid || !presentation || !state.tokens) return finish(null);
    const walker = documentObject.createTreeWalker(visualMath, 4);
    let nativeVisibleText = '';
    for (let textNode = walker.nextNode(); textNode; textNode = walker.nextNode()) {
      const raw = String(textNode.nodeValue || '');
      if (!raw || /^\s*$/u.test(raw)) continue;
      if (!state.consumedText.has(textNode)) return finish(null);
      nativeVisibleText += raw;
    }
    nativeVisibleText = cleanClipboardText(nativeVisibleText);
    if (!nativeVisibleText || nativeVisibleText.length > MAX_SELECTION_KEY_LENGTH) return finish(null);
    const math = make('math'); math.appendChild(presentation);
    const safeMath = sanitizedMathMLClone(math);
    if (!safeMath) return finish(null);
    // This MathML was projected from every selected CommonHTML glyph above,
    // not recovered from an independent hidden branch. Generic text-order
    // agreement is deliberately inappropriate here: v2 paints an accent
    // before its base (`→V`) and paints roots/fractions with layout boxes,
    // while the projected semantics correctly store `V⃗`, msqrt, and mfrac.
    // Complete text consumption plus the exact allowlisted renderer topology
    // is the independent authentication boundary for source-less v2 output.
    const semanticPunctuation = canonicalVisiblePunctuationProfile(safeMath.textContent || '');
    const visiblePunctuation = canonicalVisiblePunctuationProfile(nativeVisibleText);
    if (!punctuationProfilesAgree(semanticPunctuation, visiblePunctuation)) return finish(null);
    let safeAssistiveMath = null;
    if (assistiveMath) {
      if (!mathJax2AssistiveBranchIsHidden(assistiveBranch)) return finish(null);
      safeAssistiveMath = sanitizedMathMLClone(assistiveMath);
      if (!safeAssistiveMath) return finish(null);
      // v2's AssistiveMML serializer emits underline as a generic
      // `<munder><mo>_</mo>` without accentunder=true, while the CHTML branch
      // paints the same mark with repeated dash glyphs. Canonicalize only the
      // small, unambiguous accent glyph allowlist before comparison.
      for (const scripted of Array.from(safeAssistiveMath.querySelectorAll('munder, mover'))) {
        const scriptedChildren = elementChildren(scripted);
        if (scriptedChildren.length !== 2) continue;
        const accent = (scripted.localName || '').toLowerCase() === 'munder'
          ? canonicalChtmlUnderAccent(scriptedChildren[1].textContent || '')
          : canonicalChtmlOverAccent(scriptedChildren[1].textContent || '');
        if (!accent) continue;
        scripted.setAttribute(
          (scripted.localName || '').toLowerCase() === 'munder' ? 'accentunder' : 'accent',
          'true'
        );
        scriptedChildren[1].textContent = accent;
      }
      const projectedFaithful = mathMLToFaithful(safeMath);
      const assistiveFaithful = mathMLToFaithful(safeAssistiveMath);
      const projectedCalculator = mathMLToCalculator(safeMath);
      const assistiveCalculator = mathMLToCalculator(safeAssistiveMath);
      const projectedSignature = semanticVisibleAnchorSignature(projectedFaithful);
      const assistiveSignature = semanticVisibleAnchorSignature(assistiveFaithful);
      const anchorAgreement = !projectedSignature.overBudget && !assistiveSignature.overBudget &&
        projectedSignature.identifiers === assistiveSignature.identifiers &&
        projectedSignature.orderedIdentifiers === assistiveSignature.orderedIdentifiers &&
        projectedSignature.accents === assistiveSignature.accents &&
        projectedSignature.orderedAccents === assistiveSignature.orderedAccents &&
        projectedSignature.glyphs === assistiveSignature.glyphs &&
        ((projectedSignature.uncertainOperators || assistiveSignature.uncertainOperators) ||
          (projectedSignature.operators === assistiveSignature.operators &&
            projectedSignature.orderedOperators === assistiveSignature.orderedOperators));
      // AssistiveMML sometimes parenthesizes a vector before adding its
      // subscript (`(V⃗)_R`) while the visual projection emits the equivalent
      // `V⃗_R`. Compare complete ordered anchors/accents and require identical
      // calculator structure so those cosmetic fences do not reject genuine
      // output while stale grouping, scripts, fractions, or operands still do.
      if (!projectedFaithful || !assistiveFaithful ||
          !anchorAgreement ||
          faithfulAgreementKey(projectedCalculator) !== faithfulAgreementKey(assistiveCalculator)) {
        return finish(null);
      }
    }
    return finish({
      root,
      visualMath,
      math: safeMath,
      nativeVisibleText,
      assistiveBranch,
      assistiveMath,
      safeAssistiveMath
    });
  }

  function sourceLessChtmlDescriptor(root, pageWindow) {
    const modern = sourceLessMathJaxChtmlDescriptor(root, pageWindow);
    if (modern) return modern;
    // A v2 frame with an authenticated adjacent/live TeX source remains a
    // source-backed renderer. Preserve that source in original-LaTeX mode;
    // use the structural projection only when v2 truly has no source.
    if (getMathSource(root, pageWindow)) return null;
    if (root && root.matches && root.matches('span.mjx-chtml.MathJax_CHTML')) {
      const display = root.parentElement && root.parentElement.matches &&
        root.parentElement.matches('span.mjx-chtml.MJXc-display') &&
        elementChildren(root.parentElement).length === 1
        ? root.parentElement
        : null;
      const adjacent = (display || root).nextElementSibling;
      // `getMathSource` returns an empty string for mismatched, unkeyed,
      // empty, or over-budget source metadata. Those are ambiguous frames,
      // not source-less frames, and must never fall through to reconstruction.
      if ((adjacent && adjacent.matches && adjacent.matches('script[type^="math/tex"]')) ||
          getMathJaxSource(root, pageWindow)) return null;
    }
    return mathJax2ChtmlDescriptor(root);
  }

  function semanticOrderedMathJaxVisibleText(root) {
    if (!root || !root.querySelectorAll) return '';
    const leaves = Array.from(root.querySelectorAll('[data-semantic-id]')).filter((element) =>
      !element.querySelector('[data-semantic-id]')
    );
    if (!leaves.length || leaves.length > MAX_MATHML_NODES) return '';
    const ordered = [];
    const ids = new Set();
    for (const leaf of leaves) {
      const id = Number(leaf.getAttribute('data-semantic-id'));
      if (!Number.isSafeInteger(id) || id < 0 || ids.has(id)) return '';
      ids.add(id);
      const raw = cleanClipboardText(leaf.textContent || '');
      if (!raw) continue;
      let visible = independentVisibleMathText(leaf);
      if (!visible) return '';
      if (leaf.closest) {
        const scripted = leaf.closest('mjx-mover, mjx-munder');
        if (scripted) {
          if (/^[―‾¯]+$/u.test(visible)) {
            visible = scripted.localName === 'mjx-munder' ? '\u0332' : '\u0305';
          } else if (/^⏞+$/u.test(visible) && scripted.localName === 'mjx-mover') {
            visible = '⏞';
          } else if (/^⏟+$/u.test(visible) && scripted.localName === 'mjx-munder') {
            visible = '⏟';
          } else if (/^[−-]*→$/u.test(visible) && scripted.localName === 'mjx-mover') {
            visible = '\u20d7';
          } else if (/^←[−-]*$/u.test(visible) && scripted.localName === 'mjx-mover') {
            visible = '\u20d6';
          }
        }
      }
      ordered.push({ id, text: visible });
    }
    ordered.sort((left, right) => left.id - right.id);
    return ordered.map((item) => item.text).join('').replace(/[\u2061-\u2064]/g, '');
  }

  const MATHJAX_CHTML_STRUCTURAL_SELECTOR = [
    'mjx-msup', 'mjx-msub', 'mjx-msubsup', 'mjx-mmultiscripts',
    'mjx-mfrac', 'mjx-msqrt', 'mjx-mroot',
    'mjx-mover', 'mjx-munder', 'mjx-munderover', 'mjx-mtable'
  ].join(',');

  const LATEX_OVER_STRUCTURE_COMMANDS = new Set([
    'acute', 'bar', 'breve', 'check', 'ddot', 'dot', 'grave', 'hat',
    'mathring', 'overbrace', 'overgroup', 'overleftarrow',
    'overleftrightarrow', 'overline', 'overlinesegment', 'overparen',
    'overrightarrow', 'overset', 'stackrel', 'tilde', 'vec', 'widehat',
    'widetilde'
  ]);

  const LATEX_UNDER_STRUCTURE_COMMANDS = new Set([
    'underbar', 'underbrace', 'undergroup', 'underleftarrow',
    'underleftrightarrow', 'underline', 'underlinesegment', 'underparen',
    'underrightarrow', 'underset'
  ]);

  const LATEX_FRACTION_STRUCTURE_COMMANDS = new Set([
    'above', 'atop', 'binom', 'brace', 'brack', 'cfrac', 'choose', 'dbinom',
    'dfrac', 'frac', 'genfrac', 'over', 'tbinom', 'tfrac'
  ]);

  const LATEX_TABLE_ENVIRONMENTS = new Set([
    'align', 'align*', 'aligned', 'alignedat', 'array', 'bmatrix', 'bmatrix*',
    'cases', 'dcases', 'displaylines', 'eqnarray', 'eqnarray*', 'gather',
    'gather*', 'gathered', 'matrix', 'matrix*', 'multline', 'multline*',
    'pmatrix', 'pmatrix*', 'smallmatrix', 'split', 'subarray', 'vmatrix',
    'vmatrix*', 'vsmallmatrix'
  ]);

  const LATEX_TEXT_STRUCTURE_COMMANDS = new Set([
    'hbox', 'mbox', 'operatorname', 'operatorname*', 'text', 'textnormal',
    'textrm', 'textsf', 'texttt'
  ]);

  function emptyMathJaxChtmlStructure() {
    return {
      sup: 0, sub: 0, fraction: 0, squareRoot: 0, indexedRoot: 0,
      over: 0, under: 0, table: 0, overKinds: [], underKinds: [], invalid: false
    };
  }

  function skipLatexBalancedStructure(source, position, opening, closing, budget) {
    if (source[position] !== opening) return position;
    let depth = 1;
    let cursor = position + 1;
    while (cursor < source.length && depth > 0) {
      budget.steps += 1;
      if (budget.steps > MAX_LATEX_PARSE_STEPS) return -1;
      const character = source[cursor];
      if (character === '\\') {
        cursor += Math.min(2, source.length - cursor);
        continue;
      }
      if (character === opening) depth += 1;
      else if (character === closing) depth -= 1;
      cursor += 1;
    }
    return depth === 0 ? cursor : -1;
  }

  function readLatexStructureCommand(source, position) {
    if (source[position] !== '\\' || position + 1 >= source.length) {
      return { name: '', end: position + 1 };
    }
    const next = source[position + 1];
    if (!/[A-Za-z]/u.test(next)) return { name: next, end: position + 2 };
    let cursor = position + 2;
    while (cursor < source.length && /[A-Za-z]/u.test(source[cursor])) cursor += 1;
    if (source[cursor] === '*') cursor += 1;
    return { name: source.slice(position + 1, cursor), end: cursor };
  }

  function latexStructuralSignature(input, topLevelOnly, aggregate) {
    if (aggregate) {
      const rawInput = String(input == null ? '' : input);
      if (aggregate.exhausted) {
        const rejected = emptyMathJaxChtmlStructure();
        rejected.invalid = true;
        return rejected;
      }
      const cache = topLevelOnly ? aggregate.topLevel : aggregate.complete;
      if (cache.has(rawInput)) return cache.get(rawInput);
      if (rawInput.length > aggregate.remainingCharacters) {
        aggregate.exhausted = true;
        const rejected = emptyMathJaxChtmlStructure();
        rejected.invalid = true;
        return rejected;
      }
      aggregate.remainingCharacters -= rawInput.length;
      const parsed = latexStructuralSignature(rawInput, topLevelOnly, null);
      cache.set(rawInput, parsed);
      return parsed;
    }
    const signature = emptyMathJaxChtmlStructure();
    const source = stripLatexDelimiters(String(input == null ? '' : input));
    if (!source || source.length > MAX_MATH_SOURCE_LENGTH) {
      signature.invalid = true;
      return signature;
    }
    const budget = { steps: 0 };
    let braceDepth = 0;
    let cursor = 0;
    const atRequestedDepth = () => !topLevelOnly || braceDepth === 0;
    const characterIsEscaped = (position) => {
      let slashes = 0;
      for (let index = position - 1; index >= 0 && source[index] === '\\'; index -= 1) slashes += 1;
      return slashes % 2 === 1;
    };
    while (cursor < source.length) {
      budget.steps += 1;
      if (budget.steps > MAX_LATEX_PARSE_STEPS) {
        signature.invalid = true;
        return signature;
      }
      const character = source[cursor];
      if (character === '%' && !characterIsEscaped(cursor)) {
        const newline = source.slice(cursor).search(/[\r\n]/u);
        cursor = newline < 0 ? source.length : cursor + newline + 1;
        continue;
      }
      if (character === '{') {
        braceDepth += 1;
        if (braceDepth > MAX_LATEX_PARSE_DEPTH) signature.invalid = true;
        cursor += 1;
        continue;
      }
      if (character === '}') {
        if (braceDepth === 0) signature.invalid = true;
        else braceDepth -= 1;
        cursor += 1;
        continue;
      }
      if ((character === '^' || character === '_') && atRequestedDepth()) {
        signature[character === '^' ? 'sup' : 'sub'] += 1;
        cursor += 1;
        continue;
      }
      if (character === "'" && atRequestedDepth()) {
        signature.sup += 1;
        do { cursor += 1; } while (source[cursor] === "'");
        continue;
      }
      if (character !== '\\') {
        cursor += 1;
        continue;
      }
      const command = readLatexStructureCommand(source, cursor);
      cursor = command.end;
      if (!command.name) continue;
      const commandAtRequestedDepth = atRequestedDepth();
      if (LATEX_TEXT_STRUCTURE_COMMANDS.has(command.name)) {
        while (cursor < source.length && /\s/u.test(source[cursor])) cursor += 1;
        if (source[cursor] === '{') {
          const end = skipLatexBalancedStructure(source, cursor, '{', '}', budget);
          if (end < 0) {
            signature.invalid = true;
            return signature;
          }
          cursor = end;
        }
        continue;
      }
      if (command.name === 'verb' || command.name === 'verb*') {
        const delimiter = source[cursor] || '';
        if (delimiter) {
          const end = source.indexOf(delimiter, cursor + 1);
          cursor = end < 0 ? source.length : end + 1;
        }
        continue;
      }
      if (command.name === 'begin' || command.name === 'end') {
        while (cursor < source.length && /\s/u.test(source[cursor])) cursor += 1;
        if (source[cursor] !== '{') {
          signature.invalid = true;
          return signature;
        }
        const end = skipLatexBalancedStructure(source, cursor, '{', '}', budget);
        if (end < 0) {
          signature.invalid = true;
          return signature;
        }
        const environment = source.slice(cursor + 1, end - 1).trim().toLowerCase();
        if (command.name === 'begin' && commandAtRequestedDepth && LATEX_TABLE_ENVIRONMENTS.has(environment)) {
          signature.table += 1;
        }
        cursor = end;
        continue;
      }
      if (!commandAtRequestedDepth) continue;
      const bareName = command.name.replace(/\*$/u, '');
      if (bareName === 'sp') signature.sup += 1;
      if (bareName === 'sb') signature.sub += 1;
      if (bareName === 'prescript') {
        signature.sup += 1;
        signature.sub += 1;
      }
      if (LATEX_FRACTION_STRUCTURE_COMMANDS.has(command.name) ||
          LATEX_FRACTION_STRUCTURE_COMMANDS.has(bareName)) signature.fraction += 1;
      if (bareName === 'sqrt') {
        let optional = cursor;
        while (optional < source.length && /\s/u.test(source[optional])) optional += 1;
        signature[source[optional] === '[' ? 'indexedRoot' : 'squareRoot'] += 1;
      }
      if (LATEX_OVER_STRUCTURE_COMMANDS.has(command.name) ||
          LATEX_OVER_STRUCTURE_COMMANDS.has(bareName)) {
        signature.over += 1;
        signature.overKinds.push(bareName);
      }
      if (LATEX_UNDER_STRUCTURE_COMMANDS.has(command.name) ||
          LATEX_UNDER_STRUCTURE_COMMANDS.has(bareName)) {
        signature.under += 1;
        signature.underKinds.push(bareName);
      }
      if (bareName === 'substack') signature.table += 1;
    }
    if (braceDepth !== 0) signature.invalid = true;
    return signature;
  }

  function mathJaxChtmlStructuralSignature(root, aggregate) {
    const signature = emptyMathJaxChtmlStructure();
    if (!root || !root.querySelectorAll ||
        !domTreeWithinBudget(root, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) {
      signature.invalid = true;
      return signature;
    }
    const nodes = Array.from(root.querySelectorAll(MATHJAX_CHTML_STRUCTURAL_SELECTOR));
    if (nodes.length > MAX_MATHML_NODES) {
      signature.invalid = true;
      return signature;
    }
    for (const node of nodes) {
      const name = String(node.localName || '').toLowerCase();
      if (name === 'mjx-msup') signature.sup += 1;
      else if (name === 'mjx-msub') signature.sub += 1;
      else if (name === 'mjx-msubsup') {
        signature.sub += 1;
        signature.sup += 1;
      } else if (name === 'mjx-mmultiscripts') {
        const ownSource = node.getAttribute && node.getAttribute('data-latex');
        const scripts = ownSource ? latexStructuralSignature(ownSource, true, aggregate) : null;
        if (!scripts || scripts.invalid || (!scripts.sup && !scripts.sub)) signature.invalid = true;
        else {
          signature.sup += scripts.sup;
          signature.sub += scripts.sub;
        }
      } else if (name === 'mjx-mfrac') signature.fraction += 1;
      else if (name === 'mjx-msqrt') signature.squareRoot += 1;
      else if (name === 'mjx-mroot') signature.indexedRoot += 1;
      else if (name === 'mjx-mtable') signature.table += 1;
      else {
        const structuralAncestor = node.parentElement &&
          node.parentElement.closest(MATHJAX_CHTML_STRUCTURAL_SELECTOR);
        const associatedSourceFor = (candidate) => {
          let sourceOwner = candidate;
          while (sourceOwner && sourceOwner !== root &&
                 !(sourceOwner.getAttribute && sourceOwner.getAttribute('data-latex'))) {
            sourceOwner = sourceOwner.parentElement;
          }
          return sourceOwner && sourceOwner.getAttribute && sourceOwner.getAttribute('data-latex');
        };
        const associatedSource = associatedSourceFor(node);
        const ownSource = node.getAttribute && node.getAttribute('data-latex');
        const wrapper = associatedSource ? latexStructuralSignature(associatedSource, true, aggregate) : null;
        const ownScripts = ownSource ? latexStructuralSignature(ownSource, true, aggregate) : null;
        if (structuralAncestor && structuralAncestor.localName === name && wrapper) {
          const ancestorSource = associatedSourceFor(structuralAncestor);
          const ancestorWrapper = ancestorSource
            ? latexStructuralSignature(ancestorSource, true, aggregate)
            : null;
          const direction = name === 'mjx-munder' ? 'under' : 'over';
          const sameWrapperKind = ancestorWrapper && !ancestorWrapper.invalid &&
            wrapper[direction + 'Kinds'].length === 1 &&
            ancestorWrapper[direction + 'Kinds'].length === 1 &&
            wrapper[direction + 'Kinds'][0] === ancestorWrapper[direction + 'Kinds'][0];
          // overbrace/underbrace with an attached annotation is represented
          // by an outer mover/munder for the annotation and an inner node for
          // the same brace. Count that authored wrapper once. Truly nested
          // accents (including hat(vec(x)) and even hat(hat(x))) have no such
          // top-level script on their ancestor and both remain structural.
          if (sameWrapperKind && (ancestorWrapper.sup || ancestorWrapper.sub)) continue;
        }
        // MathJax uses an unannotated munder inside munderover solely to place
        // a large operator's lower limit. It is not a second authored under
        // structure. A genuine nested underline/underbrace has its own
        // intervening annotated TeX atom and therefore a matching wrapper.
        if (name === 'mjx-munder' && structuralAncestor &&
            structuralAncestor.localName === 'mjx-munderover' &&
            (!wrapper || !wrapper.under)) continue;
        if (!wrapper || wrapper.invalid) {
          signature.invalid = true;
          continue;
        }
        if (name === 'mjx-mover') {
          if (wrapper.over === 1 && !wrapper.under) signature.over += 1;
          else if (!(ownScripts && !ownScripts.invalid && (ownScripts.sup || ownScripts.sub) &&
                     wrapper.under === 1 && !wrapper.over)) signature.invalid = true;
        } else if (name === 'mjx-munder') {
          if (wrapper.under === 1 && !wrapper.over) signature.under += 1;
          else if (!(ownScripts && !ownScripts.invalid && (ownScripts.sup || ownScripts.sub) &&
                     ((wrapper.over === 1 && !wrapper.under) ||
                      (ownScripts.sub && !ownScripts.sup && !wrapper.over && !wrapper.under)))) {
            signature.invalid = true;
          }
        } else if (name === 'mjx-munderover') {
          // Large operators carry authored limits in this layout tag. An
          // annotation-based over/under pair is also accepted when the root
          // metadata explicitly describes both wrappers.
          if (wrapper.over || wrapper.under) {
            signature.over += wrapper.over;
            signature.under += wrapper.under;
          } else if (!ownSource) signature.invalid = true;
        }
        if (ownScripts) {
          if (ownScripts.invalid) signature.invalid = true;
          else {
            signature.sup += ownScripts.sup;
            signature.sub += ownScripts.sub;
          }
        }
      }
      if (Object.values(signature).some((value) => typeof value === 'number' && value > MAX_MATHML_NODES)) {
        signature.invalid = true;
      }
      if (signature.invalid) break;
    }
    return signature;
  }

  const LATEX_LITERAL_PUNCTUATION_COMMANDS = new Map([
    ['lparen', '('], ['rparen', ')'], ['lbrack', '['], ['rbrack', ']'],
    ['lbrace', '{'], ['rbrace', '}'], ['langle', '⟨'], ['rangle', '⟩'],
    ['lvert', '|'], ['rvert', '|'], ['vert', '|'], ['mid', '|'],
    ['lVert', '‖'], ['rVert', '‖'], ['Vert', '‖'], ['parallel', '‖'],
    ['colon', ':'], ['slash', '/'], ['ldotp', '.']
  ]);

  const LATEX_ENVIRONMENT_PUNCTUATION = new Map([
    ['cases', ['{', '']], ['dcases', ['{', '']],
    ['pmatrix', ['(', ')']], ['pmatrix*', ['(', ')']],
    ['bmatrix', ['[', ']']], ['bmatrix*', ['[', ']']],
    ['Bmatrix', ['{', '}']], ['Bmatrix*', ['{', '}']],
    ['vmatrix', ['|', '|']], ['vmatrix*', ['|', '|']],
    ['Vmatrix', ['‖', '‖']], ['Vmatrix*', ['‖', '‖']]
  ]);

  const LATEX_GENERATED_PUNCTUATION_COMMANDS = new Map([
    ['binom', '()'], ['dbinom', '()'], ['tbinom', '()'],
    ['choose', '()'], ['brace', '{}'], ['brack', '[]']
  ]);

  function punctuationProfile(characters, orderReliable = true) {
    const ordered = characters.join('');
    return {
      ordered,
      sorted: Array.from(characters).sort().join(''),
      orderReliable
    };
  }

  function punctuationProfilesAgree(expected, visible) {
    if (!expected || !visible || expected.sorted !== visible.sorted) return false;
    if (expected.orderReliable) return expected.ordered === visible.ordered;
    // Generated fences such as \binom are encountered before their arguments
    // by this bounded scanner, so their complete punctuation order is not
    // reliable. Still reject reversed `)x(` surfaces: every delimiter family
    // that is balanced in the source profile must be balanced and oriented in
    // the independently visible sequence too.
    for (const [opening, closing] of [['(', ')'], ['[', ']'], ['{', '}'], ['⟨', '⟩']]) {
      const expectedOpening = Array.from(expected.ordered).filter((value) => value === opening).length;
      const expectedClosing = Array.from(expected.ordered).filter((value) => value === closing).length;
      if (!expectedOpening || expectedOpening !== expectedClosing) continue;
      let depth = 0;
      for (const value of visible.ordered) {
        if (value === opening) depth += 1;
        else if (value === closing) {
          depth -= 1;
          if (depth < 0) return false;
        }
      }
      if (depth !== 0) return false;
    }
    return true;
  }

  function canonicalVisiblePunctuationProfile(input) {
    let value = String(input == null ? '' : input);
    try { value = value.normalize('NFKC'); } catch (_error) { /* retain source */ }
    const punctuation = [];
    for (const character of value) {
      if (/[|∣❘]/u.test(character)) punctuation.push('|');
      else if (/[∥‖]/u.test(character)) punctuation.push('‖');
      else if ('()[]{}⟨⟩/.,:;'.includes(character)) punctuation.push(character);
    }
    return punctuationProfile(punctuation);
  }

  function latexVisiblePunctuationProfile(input) {
    const source = stripLatexDelimiters(String(input == null ? '' : input));
    if (!source || source.length > MAX_MATH_SOURCE_LENGTH) return null;
    const punctuation = [];
    let orderReliable = true;
    const ignoredSquareBrackets = new Set();
    let cursor = 0;
    let steps = 0;
    const add = (value) => {
      for (const character of value || '') punctuation.push(character);
    };
    const skipWhitespace = (position) => {
      while (position < source.length && /\s/u.test(source[position])) position += 1;
      return position;
    };
    const markOptionalSquareBrackets = (position) => {
      const opening = skipWhitespace(position);
      if (source[opening] !== '[') return;
      let depth = 1;
      let index = opening + 1;
      while (index < source.length && depth > 0) {
        steps += 1;
        if (steps > MAX_LATEX_PARSE_STEPS) return;
        if (source[index] === '\\') {
          index += Math.min(2, source.length - index);
          continue;
        }
        if (source[index] === '[') depth += 1;
        else if (source[index] === ']') depth -= 1;
        index += 1;
      }
      if (depth === 0) {
        ignoredSquareBrackets.add(opening);
        ignoredSquareBrackets.add(index - 1);
      }
    };
    while (cursor < source.length) {
      steps += 1;
      if (steps > MAX_LATEX_PARSE_STEPS) return null;
      const character = source[cursor];
      if (character === '%') {
        let slashes = 0;
        for (let index = cursor - 1; index >= 0 && source[index] === '\\'; index -= 1) slashes += 1;
        if (slashes % 2 === 0) {
          const newline = source.slice(cursor).search(/[\r\n]/u);
          cursor = newline < 0 ? source.length : cursor + newline + 1;
          continue;
        }
      }
      if (character !== '\\') {
        if (!ignoredSquareBrackets.has(cursor) && !'{}'.includes(character) &&
            '()[]⟨⟩|/.,:;'.includes(character)) add(character);
        cursor += 1;
        continue;
      }
      const command = readLatexStructureCommand(source, cursor);
      cursor = command.end;
      if (!command.name) continue;
      if (command.name.length === 1 && !/[A-Za-z]/u.test(command.name)) {
        if (command.name === '{' || command.name === '}') add(command.name);
        else if (command.name === '|') add('‖');
        continue;
      }
      const bareName = command.name.replace(/\*$/u, '');
      if (LATEX_LITERAL_PUNCTUATION_COMMANDS.has(command.name)) {
        add(LATEX_LITERAL_PUNCTUATION_COMMANDS.get(command.name));
      } else if (LATEX_LITERAL_PUNCTUATION_COMMANDS.has(bareName)) {
        add(LATEX_LITERAL_PUNCTUATION_COMMANDS.get(bareName));
      }
      // TeX supplies these fences around operands that appear before/after
      // the command or in later arguments. Count the exact generated pair,
      // then use the bounded visible-balance check above for orientation.
      const generatedPair = LATEX_GENERATED_PUNCTUATION_COMMANDS.get(bareName);
      if (generatedPair) {
        add(generatedPair);
        orderReliable = false;
      }
      // \genfrac's first two arguments carry its optional delimiters. The
      // ordinary scan below observes literal or command delimiters, but they
      // precede the numerator and denominator in source order.
      if (bareName === 'genfrac') orderReliable = false;
      if (bareName === 'sqrt') markOptionalSquareBrackets(cursor);
      if (['left', 'right', 'middle', 'big', 'Big', 'bigg', 'Bigg',
        'bigl', 'bigr', 'Bigl', 'Bigr', 'biggl', 'biggr', 'Biggl', 'Biggr'].includes(command.name)) {
        const delimiter = skipWhitespace(cursor);
        if (source[delimiter] === '.') cursor = delimiter + 1;
      }
      if (command.name === 'begin' || command.name === 'end') {
        const opening = skipWhitespace(cursor);
        if (source[opening] !== '{') return null;
        const budget = { steps };
        const end = skipLatexBalancedStructure(source, opening, '{', '}', budget);
        steps = budget.steps;
        if (end < 0) return null;
        const environment = source.slice(opening + 1, end - 1).trim();
        const generated = LATEX_ENVIRONMENT_PUNCTUATION.get(environment);
        if (generated) add(generated[command.name === 'begin' ? 0 : 1]);
        cursor = end;
      }
    }
    return punctuationProfile(punctuation, orderReliable);
  }

  function normalizeMathJaxStructuralSource(source) {
    const value = String(source == null ? '' : source).trim();
    const subarray = value.match(/^\\begin\{subarray\}\{[^{}]*\}([\s\S]*)\\end\{subarray\}$/u);
    return subarray ? '\\substack{' + subarray[1] + '}' : value;
  }

  function latexSubstackSources(input) {
    const source = stripLatexDelimiters(String(input == null ? '' : input));
    const values = [];
    let cursor = 0;
    let steps = 0;
    while (cursor < source.length && values.length < MAX_LATEX_PARSE_DEPTH) {
      steps += 1;
      if (steps > MAX_LATEX_PARSE_STEPS) return [];
      const match = source.slice(cursor).match(/\\substack\s*\{/u);
      if (!match) break;
      const start = cursor + match.index;
      const opening = start + match[0].lastIndexOf('{');
      const budget = { steps };
      const end = skipLatexBalancedStructure(source, opening, '{', '}', budget);
      steps = budget.steps;
      if (end < 0) return [];
      values.push(source.slice(start, end));
      cursor = end;
    }
    return values;
  }

  function directMathJaxChtmlTopologyAgrees(root, source, aggregate) {
    const directMath = root && root.matches && root.matches('mjx-container')
      ? Array.from(root.children || []).find((child) => child.matches && child.matches('mjx-math[data-latex]'))
      : null;
    if (!directMath) return false;
    const rootFaithful = faithfulAgreementKey(latexToFaithful(source));
    const rootCalculator = faithfulAgreementKey(latexToCalculator(source));
    if (!rootFaithful || rootFaithful.includes('\\') || !rootCalculator || rootCalculator.includes('\\')) return false;
    const nodes = Array.from(root.querySelectorAll(MATHJAX_CHTML_STRUCTURAL_SELECTOR));
    const substackSources = latexSubstackSources(source);
    const cache = new Map();
    let remainingCharacters = MAX_LATEX_PARSE_STEPS * 4;
    const canonicalCandidate = (rawSource) => {
      const normalizedSource = normalizeMathJaxStructuralSource(rawSource);
      if (cache.has(normalizedSource)) return cache.get(normalizedSource);
      if (!normalizedSource || normalizedSource.length > remainingCharacters) return null;
      remainingCharacters -= normalizedSource.length;
      const value = {
        faithful: faithfulAgreementKey(latexToFaithful(normalizedSource)),
        calculator: faithfulAgreementKey(latexToCalculator(normalizedSource))
      };
      cache.set(normalizedSource, value);
      return value;
    };
    for (const node of nodes) {
      const name = String(node.localName || '').toLowerCase();
      // MathJax emits prime scripts as layout-only msup nodes without their own
      // TeX annotation. Their visible prime glyph plus the global script count
      // and ordered anchors fully identify them; every other structural node
      // must have a renderer-owned subexpression below the direct root source.
      if (/^mjx-msu(?:p|b|bsup)$/u.test(name)) {
        const script = node.querySelector && node.querySelector('mjx-script');
        const scriptText = cleanClipboardText(script && script.textContent || '');
        if (scriptText && /^[\u2032-\u2034']+$/u.test(scriptText)) continue;
      }
      let owner = node;
      while (owner && owner !== directMath &&
             !(owner.getAttribute && owner.getAttribute('data-latex'))) owner = owner.parentElement;
      if (!owner || owner === directMath) return false;
      const rawCandidate = owner.getAttribute('data-latex');
      const hasSubarrayPlaceholder = /(?:^|[^A-Za-z])\{subarray\}/u.test(rawCandidate);
      const candidateSources = hasSubarrayPlaceholder && substackSources.length
        ? substackSources.map((substack) => rawCandidate.replace(
          /(^|[^A-Za-z])\{subarray\}/gu,
          (_match, prefix) => prefix + substack
        ))
        : [rawCandidate];
      const requiresCalculator = [
        'mjx-msup', 'mjx-msub', 'mjx-msubsup', 'mjx-mmultiscripts', 'mjx-mfrac'
      ].includes(name);
      const candidateAgrees = candidateSources.some((candidateSource) => {
        const candidate = canonicalCandidate(candidateSource);
        if (!candidate || !candidate.faithful || candidate.faithful.includes('\\') ||
            !rootFaithful.includes(candidate.faithful)) return false;
        return !requiresCalculator || (candidate.calculator && !candidate.calculator.includes('\\') &&
          rootCalculator.includes(candidate.calculator));
      });
      if (!candidateAgrees) return false;
    }
    if (aggregate && aggregate.exhausted) return false;
    return true;
  }

  function directMathJaxChtmlStructureAgrees(root, source) {
    // A root and its renderer-owned subexpression annotations often repeat
    // the same TeX. Memoize those parses, and cap the total amount of unique
    // metadata inspected so a hostile tree cannot force nodes × source-length
    // work. Exhaustion declines the rewrite instead of partially agreeing.
    const aggregate = {
      remainingCharacters: MAX_LATEX_PARSE_STEPS * 4,
      complete: new Map(),
      topLevel: new Map(),
      exhausted: false
    };
    const expected = latexStructuralSignature(source, false, aggregate);
    if (expected.invalid) return false;
    const visible = mathJaxChtmlStructuralSignature(root, aggregate);
    if (visible.invalid) return false;
    if (!['sup', 'sub', 'fraction', 'squareRoot', 'indexedRoot', 'over', 'under', 'table']
      .every((key) => expected[key] === visible[key])) return false;
    if (!directMathJaxChtmlTopologyAgrees(root, source, aggregate)) return false;
    return true;
  }

  function sourceOnlyMathAgreesWithVisible(root, pageWindow) {
    const embedded = embeddedMathDescriptor(root);
    if (embedded && !embedded.math && embedded.source) return true;
    const svgDescriptor = mathJaxSvgDescriptor(root);
    if (svgDescriptor) return true;
    const source = getMathSource(root, pageWindow);
    const mathJax2Chtml = mathJax2ChtmlDescriptor(root);
    if (source && mathJax2Chtml) {
      // v2 paints scripts and accents in box order (`→V`, `VC`) rather
      // than semantic reading order. Compare its keyed TeX source against
      // the authenticated structural projection, never raw textContent and
      // never a neighboring formula's script.
      const faithfulSource = latexToFaithful(source);
      const renderedFaithful = mathMLToFaithful(mathJax2Chtml.math);
      if (!faithfulSourceAgreesWithRendered(faithfulSource, renderedFaithful)) return false;
      const expectedPunctuation = latexVisiblePunctuationProfile(source);
      const visiblePunctuation = canonicalVisiblePunctuationProfile(mathJax2Chtml.nativeVisibleText);
      return punctuationProfilesAgree(expectedPunctuation, visiblePunctuation);
    }
    const visible = independentVisibleMathText(root);
    if (!source) return true;
    // Metadata with no independently selected surface is not a formula the
    // user could see or drag across. Never inject a hidden data-latex value
    // into otherwise ordinary prose merely because an empty renderer-shaped
    // container intersects the range.
    if (!visible) return false;
    const faithfulSource = latexToFaithful(source);
    if (!faithfulSource || faithfulSource.includes('\\')) return false;
    // Authored punctuation is semantic content too. Apply this check to every
    // source-backed renderer, not only direct MathJax CHTML: otherwise stale
    // SVG/data-latex metadata could inject a slash, decimal point, fence, or
    // separator that the selected surface did not contain. A renderer may
    // already expose this userscript's exact faithful linearization, which
    // legitimately synthesizes a fraction slash and grouping parentheses;
    // that complete text equality authenticates the surface directly.
    if (mathSelectionKey(faithfulSource) !== mathSelectionKey(visible)) {
      const expectedPunctuation = latexVisiblePunctuationProfile(source);
      const visiblePunctuation = canonicalVisiblePunctuationProfile(visible);
      if (!punctuationProfilesAgree(expectedPunctuation, visiblePunctuation)) return false;
    }
    // Unicode linearization carries the same operand anchors without adding
    // readable structural words such as `overline(...)` or `hat(...)` for a
    // compound base. Those words belong in the copied result, not in the
    // source-versus-glyph agreement signature.
    const unicodeSource = latexToVisibleAgreement(source);
    const sourceAnchorText = unicodeSource && !unicodeSource.includes('\\')
      ? unicodeSource
      : faithfulSource;
    const sourceSignature = semanticVisibleAnchorSignature(sourceAnchorText);
    const visibleSignature = semanticVisibleAnchorSignature(visible);
    if (sourceSignature.overBudget || visibleSignature.overBudget) return false;
    const directChtmlSources = root.matches && root.matches('mjx-container')
      ? Array.from(root.children || []).filter((child) =>
        child.matches && child.matches('mjx-math[data-latex]'))
      : [];
    let accentVisibleSignature = visibleSignature;
    if (directChtmlSources.length === 1) {
      if (!directMathJaxChtmlStructureAgrees(root, source)) return false;
      // MathJax CHTML keeps ordinary token order in its visible glyph tree;
      // only layout marks such as an overscript move around their base. For
      // this exact renderer shape, order-free multisets would let stale `x-y`
      // metadata replace visible `y-x`, so require the ordered anchors too.
      const layoutReordersText = Boolean(root.querySelector && root.querySelector(
        'mjx-msubsup, mjx-mmultiscripts, mjx-munderover, mjx-mover, mjx-munder'
      ));
      const orderedVisibleText = layoutReordersText
        ? semanticOrderedMathJaxVisibleText(root)
        : visible;
      if (!orderedVisibleText) return false;
      const orderedVisibleSignature = semanticVisibleAnchorSignature(orderedVisibleText);
      accentVisibleSignature = orderedVisibleSignature;
      if (orderedVisibleSignature.overBudget ||
          sourceSignature.orderedIdentifiers !== orderedVisibleSignature.orderedIdentifiers ||
          sourceSignature.orderedAccents !== orderedVisibleSignature.orderedAccents) return false;
      if (!sourceSignature.uncertainOperators && !orderedVisibleSignature.uncertainOperators &&
          sourceSignature.orderedOperators !== orderedVisibleSignature.orderedOperators) return false;
    } else {
      // SVG and generic source-backed renderers can expose vertical fraction
      // or table boxes in a different DOM order. Outside those two explicit
      // layouts, however, source order is visible order: stale x-y metadata
      // must never authenticate glyphs that actually read y-x.
      const structure = latexStructuralSignature(source, false, null);
      if (structure.invalid) return false;
      const surfaceMayReorder = Boolean(structure.fraction || structure.table);
      if (!surfaceMayReorder && (
        sourceSignature.orderedIdentifiers !== visibleSignature.orderedIdentifiers ||
        sourceSignature.orderedAccents !== visibleSignature.orderedAccents ||
        (!sourceSignature.uncertainOperators && !visibleSignature.uncertainOperators &&
         sourceSignature.orderedOperators !== visibleSignature.orderedOperators)
      )) return false;
    }
    if (sourceSignature.identifiers !== visibleSignature.identifiers) return false;
    if (sourceSignature.accents !== accentVisibleSignature.accents) return false;
    if (!sourceSignature.uncertainOperators && !accentVisibleSignature.uncertainOperators &&
        sourceSignature.operators !== accentVisibleSignature.operators) return false;
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

  function sourceOnlyFallbackLayoutIsSafe(root) {
    if (!root || root.nodeType !== 1 ||
        !domTreeWithinBudget(root, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return false;
    const visible = independentVisibleMathText(root);
    const accessible = root.getAttribute && (root.getAttribute('aria-label') || root.getAttribute('alt'));
    const documentObject = root.ownerDocument;
    const view = documentObject && documentObject.defaultView;
    if (!documentObject || !documentObject.createRange || !view ||
        typeof view.getComputedStyle !== 'function') return false;
    const computedValue = (computed, name, property) => String(
      computed && (computed[name] || (computed.getPropertyValue &&
        computed.getPropertyValue(property || name))) || ''
    ).trim().toLowerCase();
    const zeroOrAutoOffset = (input) => {
      const value = String(input || '').replace(/\s+/gu, '').toLowerCase();
      return !value || value === 'auto' ||
        /^[+-]?0(?:\.0+)?(?:%|[a-z]+)?$/u.test(value);
    };
    const strictComputedLayoutIsSafe = (computed) => {
      if (computedStyleHasUnsafeVisibleLayout(computed, false)) return false;
      const position = computedValue(computed, 'position');
      if (/^(?:relative|sticky)$/u.test(position) &&
          ['top', 'right', 'bottom', 'left'].some((name) =>
            !zeroOrAutoOffset(computedValue(computed, name)))) return false;
      const direction = computedValue(computed, 'direction');
      const unicodeBidi = computedValue(computed, 'unicodeBidi', 'unicode-bidi');
      if ((direction && direction !== 'ltr') ||
          (unicodeBidi && !['normal', 'isolate'].includes(unicodeBidi))) return false;
      // Any clipping or scrolling can make only part of descendant text
      // visible. A generic source-less root has no independent semantics with
      // which to recover whatever the clip conceals.
      return !['overflow', 'overflowX', 'overflowY'].some((name) =>
        /(?:^|\s)(?:hidden|clip|scroll|auto|overlay)(?:\s|$)/u.test(
          computedValue(computed, name, name.replace(/[A-Z]/gu, (letter) => '-' + letter.toLowerCase()))
        ));
    };

    // Non-inherited ancestor layout can hide or move a selected descendant
    // even when the descendant's own computed style looks ordinary. Audit a
    // bounded composed path through shadow hosts to the document element.
    let ancestor = composedParentElement(root);
    let ancestorDepth = 0;
    while (ancestor) {
      ancestorDepth += 1;
      if (ancestorDepth > MAX_RICH_SELECTION_DEPTH) return false;
      let computed;
      try {
        computed = view.getComputedStyle(ancestor);
      } catch (_error) {
        return false;
      }
      if (!strictComputedLayoutIsSafe(computed)) return false;
      ancestor = composedParentElement(ancestor);
    }

    const stack = [root];
    let visited = 0;
    while (stack.length) {
      const element = stack.pop();
      if (!element || element.nodeType !== 1) continue;
      visited += 1;
      if (visited > MAX_MATHML_NODES) return false;
      const tag = (element.localName || '').toLowerCase();
      // A source-less fallback cannot authenticate pixels painted by an
      // image, SVG, canvas, embedded document, form control, ruby/details
      // alternate, or other replaced surface.
      if (UNSOURCED_MATH_FALLBACK_UNSAFE_TAGS.has(tag) || tag === 'img') return false;
      if (isHiddenElement(element) && (element.textContent || '').trim()) return false;
      if (/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(element.textContent || '')) {
        return false;
      }
      if (!cssStackMathGeneratedContentIsSafe(element, view)) return false;
      let computed;
      try {
        computed = view.getComputedStyle(element);
      } catch (_error) {
        return false;
      }
      if (!strictComputedLayoutIsSafe(computed)) return false;
      for (let child = element.lastElementChild; child; child = child.previousElementSibling) stack.push(child);
    }
    const range = documentObject.createRange();
    try {
      range.selectNodeContents(root);
    } catch (_error) {
      return false;
    }
    if (ordinaryComputedLayoutRisk(range, documentObject)) return false;
    if (accessible) {
      if (accessible.length > MAX_MATH_SOURCE_LENGTH) return false;
      const fragment = cloneOrdinaryRangeWithContext(range, documentObject);
      if (!fragment) return false;
      const serialized = serializeOrdinaryFragment(fragment, 'faithful');
      if (serialized.evidence.semanticScriptUnrepresentable ||
          scriptAwareMathSelectionKey(accessible) !==
            scriptAwareMathSelectionKey(finalizeRewrittenText(serialized.text))) return false;
    }
    return Boolean(visible);
  }

  function extractMathText(root, outputMode, pageWindow) {
    const mode = OUTPUT_MODES.includes(outputMode)
      ? outputMode
      : DEFAULT_SETTINGS.outputMode;
    const source = getMathSource(root, pageWindow);
    const math = getMathElement(root);
    if (mode === 'latex' && source) {
      const projectedMathJax2 = root && root.matches &&
        root.matches('span.mjx-chtml.MathJax_CHTML')
        ? mathJax2ChtmlDescriptor(root)
        : null;
      if (projectedMathJax2 && projectedMathJax2.math &&
          !latexSourceAgreesWithProjectedMath(source, projectedMathJax2.math)) {
        const delimiter = isDisplayMath(root) ? '$$' : '$';
        return delimiter + mathMLToLatexNode(projectedMathJax2.math) + delimiter;
      }
      return isDisplayMath(root) ? '$$' + source + '$$' : '$' + source + '$';
    }
    if (mode === 'calculator') {
      if (math) return calculatorRenderedMathText(root, math, pageWindow);
      if (source) return latexToCalculator(source);
      return unicodeToCalculator(formatMathText(fallbackMathText(root)));
    }
    if (math) return faithfulRenderedMathText(root, math, pageWindow);
    if (source) return latexToFaithful(source);
    return formatFaithfulMathText(fallbackMathText(root));
  }

  function isMathRoot(element) {
    if (!element || element.nodeType !== 1 || !element.matches) return false;
    if (rendererInternalSourceAttributeNode(element)) return false;
    // Official MathJax 2 AssistiveMML adds data-mathml to the already
    // authenticated renderer frame. Do not run that frame through the generic
    // embedded-owner shape first: its intentional visual + assistive branches
    // would fail the single-surface test and discovery would promote the
    // hidden <math> all the way to an ordinary prose ancestor.
    if (element.matches('.MathJax_CHTML, .MathJax_SVG, .MathJax, mjx-container, .katex, .katex-display')) {
      return true;
    }
    if (element.matches('[data-mathml],[data-equation-content]')) {
      return Boolean(embeddedMathOwnerShape(element));
    }
    if (element.matches('[role="math"]')) {
      // ARIA's generic math role is sometimes placed on a prose wrapper that
      // contains a genuine renderer root. Treating that wrapper as the one
      // canonical formula shadows the authenticated descendant and makes one
      // harmless accessibility role poison the complete selection. Keep an
      // independently sourced wrapper as a candidate, but otherwise let the
      // renderer child be replaced while the wrapper remains ordinary,
      // layout-audited context.
      const nestedSelector = [
        '.katex', 'mjx-container', '.MathJax_Display', '.MathJax_CHTML',
        '.MathJax_SVG', '.MathJax', '.mwe-math-element', '[role="math"]',
        '[data-latex]', '[data-tex]', '[data-math-source]', '[data-mathml]',
        '[data-equation-content]'
      ].join(',');
      // Avoid a selector-engine subtree query here. Discovery calls this for
      // every candidate, and repeated `querySelector()` containment work can
      // become quadratic across a document containing many small formulas.
      // A bounded manual walk shares the discovery model's fail-closed limit.
      let nestedRenderer = null;
      const stack = [];
      for (let child = element.lastElementChild; child; child = child.previousElementSibling) {
        stack.push(child);
      }
      let inspected = 0;
      while (stack.length && inspected < MAX_MATH_DISCOVERY_CANDIDATES) {
        const candidate = stack.pop();
        inspected += 1;
        if (candidate.matches && candidate.matches(nestedSelector)) {
          nestedRenderer = candidate;
          break;
        }
        for (let child = candidate.lastElementChild; child; child = child.previousElementSibling) {
          stack.push(child);
        }
      }
      const walkExhausted = !nestedRenderer && stack.length > 0;
      const ownsSource = ['data-latex', 'data-tex', 'data-math-source', 'data-mathml',
        'data-equation-content'].some((name) => element.hasAttribute(name));
      if (walkExhausted && !ownsSource) return false;
      if (nestedRenderer && nestedRenderer !== element && !ownsSource) return false;
      return true;
    }
    if (element.matches([
      '.katex-display', '.katex', 'mjx-container', '.MathJax_Display',
      '.MathJax_SVG_Display', '.MathJax_CHTML', '.MathJax_SVG', '.MathJax',
      '.mwe-math-element', 'math', '[data-latex]', '[data-tex]',
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
      '[data-tex]', '[data-math-source]', '[data-mathml]', '[data-equation-content]'
    ].join(','));
    if (nestedRenderer && nestedRenderer !== element) return false;
    return Boolean(
      element.querySelector('math') ||
      element.getAttribute('data-latex') ||
      element.getAttribute('data-tex') ||
      element.getAttribute('data-math-source') ||
      element.getAttribute('data-mathml') ||
      element.getAttribute('data-equation-content') ||
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
    if (!element || element.nodeType !== 1) return 0;
    const cache = context && context.mathCounts;
    if (cache && cache.has(element)) return cache.get(element);
    let count = element.matches && element.matches('math') ? 1 : 0;
    const stack = [];
    let inspected = 0;
    const queueChildren = (parent) => {
      for (let child = parent.lastChild; child; child = child.previousSibling) {
        inspected += 1;
        if (inspected > MAX_MATH_DISCOVERY_CANDIDATES + MAX_MATHML_NODES) return false;
        stack.push(child);
      }
      return true;
    };
    if (!queueChildren(element)) count = 2;
    while (stack.length && count < 2) {
      const node = stack.pop();
      if (!node || node.nodeType !== 1) continue;
      if ((node.localName || '').toLowerCase() === 'math') count += 1;
      if (count < 2 && !queueChildren(node)) count = 2;
    }
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

  function canonicalMathRootDiscovery(container, contextInput, selectedRange) {
    if (!container) return { roots: [], overBudget: false };
    const context = contextInput || createMathDiscoveryContext();
    const base = container.nodeType === 1 ? container : container.parentElement || container;
    if (!base) return { roots: [], overBudget: false };
    const rangeCoversBase = selectedRange && selectedRange.startContainer === base &&
      selectedRange.startOffset === 0 && selectedRange.endContainer === base &&
      selectedRange.endOffset === base.childNodes.length;
    const restrictedRange = rangeCoversBase ? null : selectedRange;
    const candidates = new Set();
    if (isMathRootCached(base, context)) candidates.add(base);
    if (base.lastElementChild) {
      const stack = [];
      let inspected = 0;
      let scanned = 0;
      const queueChildren = (element) => {
        for (let child = element.lastChild; child; child = child.previousSibling) {
          scanned += 1;
          // Count every sibling considered, including non-elements and
          // unselected subtree roots. querySelectorAll would first materialize
          // the entire descendant result before the former limits ran, which
          // let an unrelated document-sized branch stall an ordinary copy.
          if (scanned > MAX_MATH_DISCOVERY_CANDIDATES + MAX_MATHML_NODES) return false;
          if (child.nodeType === 1 && (!restrictedRange || rangeIntersects(restrictedRange, child))) {
            stack.push(child);
          }
        }
        return true;
      };
      if (!queueChildren(base)) return { roots: [], overBudget: true };
      while (stack.length) {
        const candidate = stack.pop();
        let matches = false;
        try { matches = candidate.matches(MATH_DISCOVERY_SELECTOR); }
        catch (_error) { return { roots: [], overBudget: true }; }
        if (matches) {
        // MathJax 4 legitimately places data-latex on many internal SVG
        // nodes, so those nodes do not consume the root-candidate budget.
        // They still consume a separate traversal budget so a forged page
        // cannot make discovery walk an unbounded attribute forest.
          if (!rendererInternalSourceAttributeNode(candidate)) {
            inspected += 1;
            if (inspected > MAX_MATH_DISCOVERY_CANDIDATES) return { roots: [], overBudget: true };
            if (isMathRootCached(candidate, context)) candidates.add(candidate);
            if ((candidate.localName || '').toLowerCase() === 'math') {
              const promoted = rendererContainerForMath(candidate, context);
              if (promoted) candidates.add(promoted);
            }
          }
        }
        if (!queueChildren(candidate)) return { roots: [], overBudget: true };
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

  function rangeTraversalRoot(range) {
    const common = range && range.commonAncestorContainer;
    if (!common) return null;
    // A composed selection can legitimately be bounded by an open
    // ShadowRoot. Treat that DocumentFragment as a traversal container rather
    // than asking for parentElement (which is null at a shadow boundary).
    if (common.nodeType === 1 || common.nodeType === 11) return common;
    return common.parentElement || null;
  }

  function mathRootDiscoveryForRange(range) {
    if (!range || !range.commonAncestorContainer) return { roots: [], overBudget: false };
    const context = createMathDiscoveryContext();
    const container = rangeTraversalRoot(range);
    const canonical = canonicalMathRootDiscovery(container, context, range);
    if (canonical.overBudget) return canonical;
    const rootSet = new Set(canonical.roots.filter((root) => rangeIntersects(range, root)));
    for (const boundaryNode of [range.startContainer, range.endContainer]) {
      const ancestor = outermostMathAncestor(boundaryNode, context);
      if (ancestor) rootSet.add(ancestor);
    }
    // A renderer-ish class or ARIA role must not preempt a formula that is
    // independently authenticated by the bounded visual-stack parser. Limit
    // this extra work to the exact two/three-row candidate shape: ordinary
    // role=math content must retain the stricter source/visible agreement
    // path, and large selections must not pay for geometry on every root.
    const cssDescriptorContext = createCssStackMathDescriptorContext();
    const independentSemanticSelector = [
      'math', '[data-latex]', '[data-tex]', '[data-math-source]', '[data-mathml]',
      '[data-equation-content]', 'annotation[encoding*="tex" i]', 'script[type^="math/tex"]'
    ].join(',');
    const hasIndependentSemantics = (rendererRoot) => {
      const stack = [rendererRoot];
      let inspected = 0;
      while (stack.length) {
        const element = stack.pop();
        if (!element || element.nodeType !== 1) continue;
        inspected += 1;
        // An over-budget source-bearing renderer stays on the stricter native
        // renderer path. Never delete it merely because the bounded audit
        // could not prove the absence of independent semantics.
        if (inspected > MAX_POSITIONED_DISCOVERY_NODES) return true;
        try {
          if (element.matches(independentSemanticSelector)) return true;
        } catch (_error) {
          return true;
        }
        for (let child = element.lastElementChild; child; child = child.previousElementSibling) {
          stack.push(child);
        }
      }
      return false;
    };
    const authenticatedCssStackWithin = (rendererRoot) => {
      const authenticate = (element) => Boolean(
        element && element.nodeType === 1 && cssStackMathCandidateShape(element) &&
        cssStackMathRootDescriptor(element, element.ownerDocument, 0, cssDescriptorContext)
      );
      // Exact inner selections should not scan a large role=math wrapper just
      // to reach the already-known endpoint ancestry.
      for (const endpoint of [range.startContainer, range.endContainer]) {
        let element = endpoint && endpoint.nodeType === 1 ? endpoint : endpoint && endpoint.parentElement;
        const path = [];
        for (let depth = 0; element && depth <= MAX_RICH_SELECTION_DEPTH; depth += 1) {
          path.push(element);
          if (element === rendererRoot) {
            if (path.some(authenticate)) return true;
            break;
          }
          element = element.parentElement;
        }
      }
      const stack = [rendererRoot];
      let inspected = 0;
      while (stack.length) {
        const element = stack.pop();
        if (!element || element.nodeType !== 1 || !rangeIntersects(range, element)) continue;
        inspected += 1;
        if (inspected > MAX_POSITIONED_DISCOVERY_NODES) return false;
        if (authenticate(element)) return true;
        for (let child = element.lastElementChild; child; child = child.previousElementSibling) {
          stack.push(child);
        }
      }
      return false;
    };
    for (const root of Array.from(rootSet)) {
      if (!hasIndependentSemantics(root) && authenticatedCssStackWithin(root)) rootSet.delete(root);
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
    const previousMathJaxSvgCache = ACTIVE_COPY_MATHJAX_SVG_CACHE;
    const previousMathJaxChtmlCache = ACTIVE_COPY_MATHJAX_CHTML_CACHE;
    const previousMathJax2ChtmlCache = ACTIVE_COPY_MATHJAX2_CHTML_CACHE;
    if (!previousMathJaxSvgCache) ACTIVE_COPY_MATHJAX_SVG_CACHE = new WeakMap();
    if (!previousMathJaxChtmlCache) ACTIVE_COPY_MATHJAX_CHTML_CACHE = new WeakMap();
    if (!previousMathJax2ChtmlCache) ACTIVE_COPY_MATHJAX2_CHTML_CACHE = new WeakMap();
    try {
      const discovery = mathRootDiscoveryForRange(range);
      return discovery.overBudget ? [] : discovery.roots;
    } finally {
      ACTIVE_COPY_MATHJAX_SVG_CACHE = previousMathJaxSvgCache;
      ACTIVE_COPY_MATHJAX_CHTML_CACHE = previousMathJaxChtmlCache;
      ACTIVE_COPY_MATHJAX2_CHTML_CACHE = previousMathJax2ChtmlCache;
    }
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

  function ordinaryImageAltProjection(element) {
    if (!element || element.nodeType !== 1 || !element.getAttribute) {
      return { text: '', suppressed: false };
    }
    const raw = String(element.getAttribute('alt') || '');
    if (!raw) return { text: '', suppressed: false };
    const tag = (element.localName || '').toLowerCase();
    const role = String(element.getAttribute('role') || '').trim().toLowerCase();
    const accessibilityHidden = String(element.getAttribute('aria-hidden') || '')
      .trim().toLowerCase() === 'true';
    // <area> is never rendered as selected text. Likewise, presentation-only
    // and accessibility-hidden images do not expose their alt as a textual
    // replacement. Renderer-owned math images are replaced by their
    // authenticated semantic root before an ordinary fragment reaches here.
    if (tag !== 'img' || accessibilityHidden || role === 'none' || role === 'presentation') {
      return { text: '', suppressed: true };
    }
    // A normal page selection should retain compact inline replacements such
    // as an icon, symbol, or image formula, but not append a hidden paragraph
    // that merely describes a large diagram. Bound the raw attribute before
    // normalization or Unicode/word scans so hostile markup cannot turn this
    // distinction into unbounded clipboard work.
    if (raw.length > MAX_ORDINARY_IMAGE_ALT_SOURCE_LENGTH) {
      return { text: '', suppressed: true };
    }
    const text = cleanOrdinaryCharacters(raw).replace(/[\t\f ]+/gu, ' ').trim();
    if (!text) return { text: '', suppressed: true };
    if (/\n/u.test(text) || Array.from(text).length > MAX_ORDINARY_IMAGE_ALT_CHARACTERS) {
      return { text: '', suppressed: true };
    }
    const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'\u2019\u2013\u2014-]*/gu) || [];
    if (words.length > MAX_ORDINARY_IMAGE_ALT_WORDS && !looksLikeStandaloneUnicodeMath(text)) {
      return { text: '', suppressed: true };
    }
    return { text, suppressed: false };
  }

  function serializeDomFragment(fragment) {
    let output = '';

    const append = (text, preserveWhitespace) => {
      let value = String(text == null ? '' : text)
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000\u00ad\u200b\u2060\ufeff]/g, '')
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
        const projection = ordinaryImageAltProjection(element);
        if (projection.text) append(projection.text, false);
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
        const projection = ordinaryImageAltProjection(element);
        if (projection.text) {
          element.replaceWith(element.ownerDocument.createTextNode(projection.text));
        }
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
    // Plain rewritten text drops boundary-only trailing whitespace and leading
    // line breaks. Mirror those exact rules in rich HTML so a paste target that
    // prefers text/html cannot resurrect end-of-selection spaces. Trimming the
    // boundary text nodes (rather than serialized markup) preserves intentional
    // whitespace inside paragraphs, tables, formulas, and preformatted islands.
    const boundaryTextNodes = [];
    const boundaryStack = Array.from(fragment.childNodes || []).reverse();
    while (boundaryStack.length && boundaryTextNodes.length <= MAX_RICH_SELECTION_NODES) {
      const node = boundaryStack.pop();
      if (!node) continue;
      if (node.nodeType === 3) boundaryTextNodes.push(node);
      else {
        const children = Array.from(node.childNodes || []);
        for (let index = children.length - 1; index >= 0; index -= 1) boundaryStack.push(children[index]);
      }
    }
    if (boundaryTextNodes.length <= MAX_RICH_SELECTION_NODES) {
      for (const node of boundaryTextNodes) {
        const value = String(node.nodeValue || '').replace(/^\n+/u, '');
        if (value) {
          node.nodeValue = value;
          break;
        }
        node.remove();
      }
      for (let index = boundaryTextNodes.length - 1; index >= 0; index -= 1) {
        const node = boundaryTextNodes[index];
        if (!node.parentNode) continue;
        const value = String(node.nodeValue || '').replace(/[ \t\n]+$/u, '');
        if (value) {
          node.nodeValue = value;
          break;
        }
        node.remove();
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
      if (name === 'mtable' && AUTHENTIC_ALIGNED_MATHML_TABLES.has(node)) {
        AUTHENTIC_ALIGNED_MATHML_TABLES.add(safe);
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
      return {
        identifiers: '', orderedIdentifiers: '',
        operators: '', orderedOperators: '',
        accents: '', orderedAccents: '',
        glyphs: '', uncertainOperators: true, overBudget: true
      };
    }
    let value = rawValue;
    try { value = value.normalize('NFKD'); } catch (_error) { /* keep original */ }
    const identifiers = [];
    const operators = [];
    const accents = [];
    const glyphs = [];
    let uncertainOperators = /\ue020/u.test(rawValue);
    const canonicalOperators = {
      '-': '−', '−': '−',
      '·': '⋅', '⋅': '⋅', '∗': '*',
      '⁺': '+', '₊': '+', '⁻': '−', '₋': '−', '⁼': '=', '₌': '='
    };
    const stableOperators = new Set(Array.from(
      '=⁼₌≠≈≃≅≡<>≤≥±∓+⁺₊−-⁻₋×⋅·*∗÷∝∈∉∋∌⊂⊃⊆⊇⊊⊋⊄⊅⊈⊉∪∩∧∨∑∏∐∫∬∭∮∞%!?→←↦⇒⇔⟶⟹⟺'
    ));
    const accentNames = new Map([
      ['\u02c6', 'hat'], ['\u0302', 'hat'],
      ['\u02dc', 'tilde'], ['\u0303', 'tilde'],
      ['\u00af', 'bar'], ['\u02c9', 'bar'], ['\u0304', 'bar'], ['\u0305', 'bar'],
      ['\u20d7', 'vec-right'], ['\u20d6', 'vec-left'],
      ['\u02d9', 'dot'], ['\u0307', 'dot'],
      ['\u00a8', 'ddot'], ['\u0308', 'ddot'],
      ['\u00b4', 'acute'], ['\u02ca', 'acute'], ['\u0301', 'acute'],
      ['`', 'grave'], ['\u02cb', 'grave'], ['\u0300', 'grave'],
      ['\u02d8', 'breve'], ['\u0306', 'breve'],
      ['\u02c7', 'check'], ['\u030c', 'check'],
      ['\u02da', 'ring'], ['\u030a', 'ring'],
      ['\u02cd', 'underline'], ['\u0332', 'underline']
    ]);
    const standaloneAccentGlyphs = new Set(Array.from('ˆ˜¯ˉ˙¨´ˊˋ˘ˇ˚ˍ'));
    const characters = Array.from(value);
    const isIdentifierAnchor = (character) =>
      Boolean(character && !accentNames.has(character) && /^[\p{L}\p{N}]$/u.test(character));
    const adjacentIdentifier = (start, direction) => {
      for (let index = start + direction; index >= 0 && index < characters.length; index += direction) {
        const character = characters[index];
        if (isIdentifierAnchor(character)) return character;
        if (accentNames.has(character) || /^[\p{M}\p{Z}]$/u.test(character) ||
            (/^\p{Cf}$/u.test(character) && !/[\u2061-\u2064]/u.test(character))) continue;
        return '';
      }
      return '';
    };
    const groupedPreviousIdentifier = (start) => {
      let cursor = start - 1;
      while (cursor >= 0 && (accentNames.has(characters[cursor]) ||
             /^[\p{M}\p{Z}]$/u.test(characters[cursor]))) cursor -= 1;
      const openingFor = { ')': '(', ']': '[', '}': '{', '⟩': '⟨', '⌉': '⌈', '⌋': '⌊' };
      const closing = characters[cursor];
      const opening = openingFor[closing];
      if (!opening) return '';
      let depth = 1;
      let anchor = '';
      for (cursor -= 1; cursor >= 0; cursor -= 1) {
        const character = characters[cursor];
        if (character === closing) depth += 1;
        else if (character === opening) {
          depth -= 1;
          if (depth === 0) return anchor;
        } else if (!anchor && isIdentifierAnchor(character)) anchor = character;
      }
      return '';
    };
    for (let index = 0; index < characters.length; index += 1) {
      const character = characters[index];
      const accentName = accentNames.get(character);
      if (accentName) {
        // Faithful text stores accents after their base (`z` + U+0302), while
        // MathJax CHTML places its overscript box first (`ˆ` + `z`). Preserve
        // the base/accent association so omitted, swapped, or changed accents
        // can never pass merely because their identifier counts still match.
        // Compatibility decomposition of a spacing accent such as `¯x`
        // yields SPACE + combining-mark + `x`; that inserted space proves the
        // mark is preposed. Otherwise use the previous base when present, so
        // postposed SVG/MathML text such as `xˊ` remains equivalent too.
        const explicitlyPreposed = index > 0 && characters[index - 1] === ' ' &&
          isIdentifierAnchor(characters[index + 1]);
        const previous = explicitlyPreposed
          ? ''
          : (groupedPreviousIdentifier(index) || adjacentIdentifier(index, -1));
        const anchor = previous || adjacentIdentifier(index, 1) || '?';
        accents.push(anchor + ':' + accentName);
        if (standaloneAccentGlyphs.has(character)) continue;
      }
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
    const orderedIdentifiers = identifiers.join('');
    const orderedOperators = operators.join('');
    const orderedAccents = accents.join('|');
    identifiers.sort();
    operators.sort();
    accents.sort();
    glyphs.sort();
    return {
      identifiers: identifiers.join(''),
      orderedIdentifiers,
      operators: operators.join(''),
      orderedOperators,
      accents: accents.join('|'),
      orderedAccents,
      glyphs: glyphs.join(''),
      uncertainOperators
    };
  }

  function semanticMathAgreesWithVisibleText(math, visibleText, requireLinearOrder) {
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
    if (visible.accents && semantic.accents !== visible.accents) return false;
    if (!semantic.uncertainOperators && !visible.uncertainOperators &&
        semantic.operators !== visible.operators) return false;
    if (requireLinearOrder) {
      if (semantic.orderedIdentifiers !== visible.orderedIdentifiers) return false;
      if (semantic.orderedAccents !== visible.orderedAccents) return false;
      if (!semantic.uncertainOperators && !visible.uncertainOperators &&
          semantic.orderedOperators !== visible.orderedOperators) return false;
    }
    if (semantic.identifiers || semantic.operators || visible.identifiers || visible.operators) return true;
    return Boolean(semantic.glyphs && semantic.glyphs === visible.glyphs);
  }

  function semanticMathAgreesWithVisibleBranch(math, visualBranch) {
    if (!math || !visualBranch || nodeInside(math, visualBranch)) return true;
    const presentation = presentationMathNode(math);
    // Fractions, indexed roots, accents, tables, and multiscripts can expose a
    // renderer's vertical box order through Selection. Accept those only for
    // renderer branches whose deterministic box order we model explicitly;
    // never fall back to a sorted anchor multiset.
    const reorderedLayoutSelector = 'mfrac, mroot, mover, munder, munderover, mmultiscripts, mtable';
    const layoutCanReorder = Boolean(presentation && (
      (presentation.matches && presentation.matches(reorderedLayoutSelector)) ||
      (presentation.querySelector && presentation.querySelector(reorderedLayoutSelector))
    ));
    const visibleText = visualBranch.textContent || '';
    const isKatexVisual = Boolean(visualBranch.matches && visualBranch.matches('.katex-html'));
    const strictKatexVisual = isGenuineKatexVisualBranch(visualBranch);
    if (!semanticMathAgreesWithVisibleText(math, visibleText, !layoutCanReorder)) return false;
    if (layoutCanReorder) {
      const modeledRendererBranch = Boolean(visualBranch.matches && visualBranch.matches(
        '.katex-html, .visual-layout, .math-visual'
      ));
      if (!modeledRendererBranch || !domTreeWithinBudget(presentation, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return false;
      // KaTeX may build a tall delimiter from Unicode extender pieces next to
      // the actual semantic fence. Those pieces are renderer scaffolding, not
      // additional selected math tokens.
      const visibleKey = mathSelectionKey(visibleText)
        .replace(/[\u239b-\u239d]+/gu, '(')
        .replace(/[\u239e-\u23a0]+/gu, ')')
        .replace(/[\u23a1-\u23a3]+/gu, '[')
        .replace(/[\u23a4-\u23a6]+/gu, ']')
        .replace(/[\u23a7-\u23ad]+/gu, (pieces) =>
          /[\u23a7-\u23a9]/u.test(pieces) ? '{' : (/[\u23ab-\u23ad]/u.test(pieces) ? '}' : '')
        );
      if (!visibleKey || visibleKey.length > MAX_SELECTION_KEY_LENGTH ||
          !rendererOrderedMathMLSurfaceVariants(
            presentation,
            isKatexVisual,
            strictKatexVisual
          ).includes(visibleKey)) return false;
    }
    if (strictKatexVisual) {
      const visibleSurface = rendererFenceKey(visibleText);
      const surfaceVariants = rendererOrderedMathMLSurfaceVariants(presentation, true, true)
        .map(rendererFenceKey);
      if (!surfaceVariants.includes(visibleSurface) ||
          !katexMathMLTopologyAgrees(math, visualBranch)) return false;
    }
    return true;
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

  function isWikipediaAtomicFallbackRoot(root) {
    if (!root || !root.matches || !root.matches('.mwe-math-element') || !root.querySelector) return false;
    const image = root.querySelector('img[alt]');
    return Boolean(image && image.parentElement === root && image.matches &&
      image.matches('.mwe-math-fallback-image-inline, .mwe-math-fallback-image-display'));
  }

  function isAuthenticatedKatexWholeBoundary(root, container) {
    if (!root || !container || container.nodeType !== 1 ||
        !root.matches || !root.matches('.katex-display') ||
        !container.matches || !container.matches('.katex') ||
        container.parentElement !== root) return false;
    const rootChildren = elementChildren(root);
    if (rootChildren.length !== 1 || rootChildren[0] !== container || hasSignificantDirectText(root)) return false;
    const branches = elementChildren(container);
    if (branches.length !== 2) return false;
    const semanticBranch = branches.find((branch) => branch.matches && branch.matches('.katex-mathml'));
    const visualBranch = branches.find((branch) => branch.matches && branch.matches('.katex-html'));
    if (!semanticBranch || !visualBranch || !isGenuineKatexVisualBranch(visualBranch)) return false;
    const semanticChildren = elementChildren(semanticBranch);
    const math = semanticChildren.length === 1 &&
      (semanticChildren[0].localName || '').toLowerCase() === 'math'
      ? semanticChildren[0]
      : null;
    return Boolean(math && getMathElement(root) === math);
  }

  function semanticMathRootAgreesWithVisible(root, math, pageWindow) {
    const sourceLessChtml = sourceLessChtmlDescriptor(root, pageWindow);
    if (sourceLessChtml && sourceLessChtml.math === math) return true;
    if (root && root.matches && root.matches('span.mjx-chtml.MathJax_CHTML')) {
      const mathJax2Chtml = mathJax2ChtmlDescriptor(root);
      // A standard AssistiveMML branch is independently sanitized and
      // cross-checked against the complete painted v2 projection by the
      // descriptor. Any other MathML child or any disagreement is malformed
      // renderer output and must remain native.
      return Boolean(mathJax2Chtml &&
        (mathJax2Chtml.assistiveMath === math || mathJax2Chtml.math === math));
    }
    const embedded = embeddedMathDescriptor(root);
    if (embedded && embedded.math === math) return true;
    if (!wikipediaMathAgreesWithFallback(root, math)) return false;
    if (!root || !math || !root.querySelector) return true;
    const katexVisual = root.matches && root.matches('.katex-html')
      ? root
      : root.querySelector('.katex-html');
    return !katexVisual || !isGenuineKatexVisualBranch(katexVisual) || nodeInside(math, katexVisual) ||
      semanticMathAgreesWithVisibleBranch(math, katexVisual);
  }

  function semanticMathSelectionPayload(root, range, settings, pageWindow) {
    const nativeMath = getMathElement(root);
    const sourceLessChtml = nativeMath ? null : sourceLessChtmlDescriptor(root, pageWindow);
    const mathJax2Chtml = mathJax2ChtmlDescriptor(root);
    const math = nativeMath || (sourceLessChtml && sourceLessChtml.math);
    const rawSelectedText = String(range.toString());
    const selectedText = cleanClipboardText(rawSelectedText);
    const selectedKey = mathSelectionKey(selectedText);
    if (!selectedKey) {
      const embedded = embeddedMathDescriptor(root);
      const svgDescriptor = mathJaxSvgDescriptor(root);
      const exactRoot = range.startContainer === root && range.startOffset === 0 &&
        range.endContainer === root && range.endOffset === root.childNodes.length;
      const exactSingleSvg = svgDescriptor && svgDescriptor.svgs.length === 1 &&
        range.startContainer === svgDescriptor.svgs[0] && range.startOffset === 0 &&
        range.endContainer === svgDescriptor.svgs[0] &&
        range.endOffset === svgDescriptor.svgs[0].childNodes.length;
      return (embedded && exactRoot) || (svgDescriptor && (exactRoot || exactSingleSvg))
        ? { kind: 'whole' }
        : { kind: 'unmatched' };
    }
    if (selectedKey.length > MAX_SELECTION_KEY_LENGTH) return { kind: 'unmatched' };
    if (nativeMath && mathJax2Chtml && mathJax2Chtml.assistiveMath === nativeMath) {
      // Browser selection excludes the clipped AssistiveMML text even when
      // Range endpoints surround the entire frame. Match only the painted
      // CommonHTML glyph key so the hidden duplicate neither blocks a whole
      // formula nor lets a strict partial selection widen.
      const exactRoot = range.startContainer === root && range.startOffset === 0 &&
        range.endContainer === root && range.endOffset === root.childNodes.length;
      return exactRoot || selectedKey === mathSelectionKey(mathJax2Chtml.nativeVisibleText)
        ? { kind: 'whole' }
        : { kind: 'unmatched' };
    }
    if (sourceLessChtml) {
      // The CHTML projection is authenticated for the complete painted
      // semantic tree. It intentionally has no source-to-offset map, so an
      // inner drag may never be widened to the surrounding vector, script,
      // fraction, or row. A complete native surface match is still safe.
      return selectedKey === mathSelectionKey(sourceLessChtml.nativeVisibleText)
        ? { kind: 'whole' }
        : { kind: 'unmatched' };
    }
    if (!math) {
      // MathJax 2 positions fraction rows and large-operator limits with
      // absolute layout. The generic source-backed visibility probe rejects
      // that layout by design; its exact authenticated CHTML projector has
      // already consumed every visible glyph and is the correct surface key.
      const visibleKey = mathSelectionKey(
        mathJax2Chtml ? mathJax2Chtml.nativeVisibleText : independentVisibleMathText(root)
      );
      const source = getMathSource(root, pageWindow);
      if (!mathJax2Chtml && !source) {
        const exactRoot = range.startContainer === root && range.startOffset === 0 &&
          range.endContainer === root && range.endOffset === root.childNodes.length;
        let completeSurface = '';
        try {
          const complete = root.ownerDocument.createRange();
          complete.selectNodeContents(root);
          completeSurface = String(complete.toString());
        } catch (_error) {
          return { kind: 'unmatched' };
        }
        const exactSurface = (input) => {
          let value = String(input == null ? '' : input).replace(/\r\n?/gu, '\n');
          try { value = value.normalize('NFC'); } catch (_error) { /* retain exact code points */ }
          return value;
        };
        // Generic source-less roots have no source-to-offset map. A normalized
        // key may discard selected spaces, bidi controls, or variation marks;
        // never let that cosmetic key widen an inner drag to the whole root.
        if (!exactRoot && exactSurface(rawSelectedText) !== exactSurface(completeSurface)) {
          return { kind: 'unmatched' };
        }
      }
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
    // Native MathML is both the semantic source and the visible surface. A
    // hidden descendant must therefore invalidate every semantic rewrite of
    // that root; otherwise sanitized MathML would promote text the user could
    // not see (for example, <mi style="display:none">SECRET</mi>).
    if (root === math && nativeMathMLPresentationLayoutIsRisky(math)) {
      return { kind: 'unmatched' };
    }
    if (!semanticMathRootAgreesWithVisible(root, math, pageWindow)) return { kind: 'unmatched' };
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
    const numericRepair = visualBranch && isGenuineKatexVisualBranch(visualBranch)
      ? repairLegacyKatexNumericScriptBases(safeSelectedMath)
      : null;
    const outputMath = numericRepair && mathSelectionKey(numericRepair.textContent || '') === selectedKey
      ? numericRepair
      : safeSelectedMath;
    const text = mathMLFragmentText(outputMath, settings.outputMode);
    if (!text || !text.trim()) return { kind: 'unmatched' };
    const documentObject = root.ownerDocument;
    const richFragment = documentObject.createDocumentFragment();
    richFragment.appendChild(richMathNodeForElement(outputMath, null, documentObject));
    return {
      kind: 'payload',
      payload: {
        text: finalizeRewrittenText(text),
        html: sanitizeRichFragment(richFragment),
        mathML: serializeMathMLMarkup(outputMath),
        semanticPartial: true
      }
    };
  }

  function safeUnsourcedMathRootText(root, outputMode) {
    if (!root || !root.ownerDocument || !independentVisibleMathText(root).trim() ||
        !sourceOnlyFallbackLayoutIsSafe(root)) return '';
    try {
      const exactRootRange = root.ownerDocument.createRange();
      exactRootRange.selectNodeContents(root);
      const fragment = cloneOrdinaryRangeWithContext(exactRootRange, root.ownerDocument);
      if (!fragment) return '';
      const serialized = serializeOrdinaryFragment(fragment, outputMode);
      if (serialized.evidence.semanticScriptUnrepresentable) return '';
      const text = finalizeRewrittenText(serialized.text);
      if (!text.trim()) return '';
      return text;
    } catch (_error) {
      return '';
    }
  }

  function wholeMathRootPayload(root, settings, pageWindow) {
    const nativeMath = getMathElement(root);
    const mathJax2Chtml = mathJax2ChtmlDescriptor(root);
    const projectedMathJax2 = mathJax2Chtml && nativeMath &&
      mathJax2Chtml.assistiveMath === nativeMath
      ? mathJax2Chtml.math
      : null;
    const embedded = projectedMathJax2 ? null : embeddedMathDescriptor(root);
    const sourceLessChtml = nativeMath ? null : sourceLessChtmlDescriptor(root, pageWindow);
    const sourceMath = projectedMathJax2 || nativeMath || (sourceLessChtml && sourceLessChtml.math);
    const rejectedSourceLessChtml = !nativeMath && !sourceLessChtml && root && root.matches && (
      (root.matches('mjx-container.MathJax') && root.querySelector && root.querySelector(':scope > mjx-math')) ||
      (root.matches('span.mjx-chtml.MathJax_CHTML') && root.querySelector &&
        root.querySelector(':scope > span.mjx-math'))
    );
    // A malformed or ambiguous CHTML semantic tree must not fall through to
    // the older plain-text source-less fallback. That fallback would flatten
    // a rejected x_2 surface to x2 and erase the very topology that failed
    // authentication.
    if (rejectedSourceLessChtml && !getMathSource(root, pageWindow)) return null;
    if (!sourceMath && !domTreeWithinBudget(root, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return null;
    const sourceText = sourceMath ? '' : getMathSource(root, pageWindow);
    const safeUnsourcedText = !sourceMath && !sourceText
      ? safeUnsourcedMathRootText(root, settings.outputMode)
      : '';
    if (!sourceMath && (!sourceText
      ? !safeUnsourcedText
      : !sourceOnlyMathAgreesWithVisible(root, pageWindow))) return null;
    if (sourceMath && root === sourceMath && nativeMathMLPresentationLayoutIsRisky(sourceMath)) return null;
    if (sourceMath && !semanticMathRootAgreesWithVisible(root, sourceMath, pageWindow)) return null;
    const safeMath = sourceMath ? sanitizedMathMLClone(sourceMath) : null;
    if (sourceMath && !safeMath) return null;
    const text = safeUnsourcedText || (sourceLessChtml && safeMath
      ? mathMLFragmentText(safeMath, settings.outputMode)
      : (embedded && safeMath
      ? mathMLFragmentText(safeMath, settings.outputMode)
      : (settings.outputMode === 'faithful' && safeMath
      ? faithfulRenderedMathText(root, safeMath, pageWindow)
      : (settings.outputMode === 'calculator' && safeMath
        ? calculatorRenderedMathText(root, safeMath, pageWindow)
        : (safeMath && settings.outputMode !== 'latex'
          ? mathMLFragmentText(safeMath, settings.outputMode)
          : extractMathText(root, settings.outputMode, pageWindow))))));
    if (!text || !text.trim()) return null;
    const documentObject = root.ownerDocument;
    const richFragment = documentObject.createDocumentFragment();
    richFragment.appendChild(safeMath
      ? richMathNodeForElement(safeMath, null, documentObject)
      : semanticTextRichFragment(text, settings.outputMode, documentObject));
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

  function semanticTextRichFragment(input, outputMode, documentObject) {
    const fragment = documentObject.createDocumentFragment();
    const source = cleanClipboardText(input);
    const appendText = (value, parent) => {
      String(value || '').split('\n').forEach((line, index) => {
        if (index) parent.appendChild(documentObject.createElement('br'));
        if (line) parent.appendChild(documentObject.createTextNode(line));
      });
    };
    if (outputMode !== 'faithful') {
      appendText(source, fragment);
      return fragment;
    }
    const superscriptReverse = Object.fromEntries(
      Object.entries(SUPERSCRIPTS).map(([plain, script]) => [script, plain])
    );
    const subscriptReverse = Object.fromEntries(
      Object.entries(SUBSCRIPTS).map(([plain, script]) => [script, plain])
    );
    Object.assign(subscriptReverse, {
      'ₔ': 'ə', 'ᵦ': 'β', 'ᵧ': 'γ', 'ᵨ': 'ρ', 'ᵩ': 'φ', 'ᵪ': 'χ'
    });
    let plain = '';
    let scriptKind = '';
    let scriptText = '';
    const flushPlain = () => {
      appendText(plain, fragment);
      plain = '';
    };
    const flushScript = () => {
      if (!scriptKind) return;
      flushPlain();
      const script = documentObject.createElement(scriptKind);
      script.textContent = scriptText;
      fragment.appendChild(script);
      scriptKind = '';
      scriptText = '';
    };
    for (const character of source) {
      const nextKind = Object.prototype.hasOwnProperty.call(superscriptReverse, character)
        ? 'sup'
        : (Object.prototype.hasOwnProperty.call(subscriptReverse, character) ? 'sub' : '');
      if (!nextKind) {
        flushScript();
        plain += character;
        continue;
      }
      if (scriptKind && scriptKind !== nextKind) flushScript();
      if (!scriptKind) scriptKind = nextKind;
      scriptText += nextKind === 'sup' ? superscriptReverse[character] : subscriptReverse[character];
    }
    flushScript();
    flushPlain();
    return fragment;
  }

  function semanticTextClipboardHTML(input, outputMode) {
    const source = cleanClipboardText(input);
    if (outputMode !== 'faithful') {
      return plainTextClipboardHTML(source);
    }
    const superscriptReverse = Object.fromEntries(
      Object.entries(SUPERSCRIPTS).map(([plain, script]) => [script, plain])
    );
    const subscriptReverse = Object.fromEntries(
      Object.entries(SUBSCRIPTS).map(([plain, script]) => [script, plain])
    );
    // The conversion maps use descriptive keys for Greek subscripts. Rich
    // HTML should contain the authored glyph, not the word "beta" or "phi".
    Object.assign(subscriptReverse, {
      'ₔ': 'ə', 'ᵦ': 'β', 'ᵧ': 'γ', 'ᵨ': 'ρ', 'ᵩ': 'φ', 'ᵪ': 'χ'
    });
    const escape = (value) => String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>');
    let html = '';
    let scriptKind = '';
    let scriptText = '';
    const flushScript = () => {
      if (!scriptKind) return;
      html += '<' + scriptKind + '>' + escape(scriptText) + '</' + scriptKind + '>';
      scriptKind = '';
      scriptText = '';
    };
    for (const character of source) {
      const nextKind = Object.prototype.hasOwnProperty.call(superscriptReverse, character)
        ? 'sup'
        : (Object.prototype.hasOwnProperty.call(subscriptReverse, character) ? 'sub' : '');
      if (!nextKind) {
        flushScript();
        html += escape(character);
        continue;
      }
      if (scriptKind && scriptKind !== nextKind) flushScript();
      scriptKind = nextKind;
      scriptText += nextKind === 'sup' ? superscriptReverse[character] : subscriptReverse[character];
    }
    flushScript();
    return '<!--StartFragment-->' + html + '<!--EndFragment-->';
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
    if (startRoot !== endRoot) {
      const normalized = range.cloneRange();
      let normalizedBoundary = false;
      try {
        // A Chromium mouse drag that ends immediately after display KaTeX can
        // report the endpoint on its direct inner `.katex` wrapper, after both
        // the hidden MathML and visible HTML branches. Treat only that exact,
        // authenticated whole-renderer boundary as being after the canonical
        // `.katex-display` root. An offset between the two branches remains a
        // strict partial selection and deliberately fails closed.
        if (startRoot && isAuthenticatedKatexWholeBoundary(startRoot, range.startContainer) &&
            range.startOffset === 0) {
          normalized.setStartBefore(startRoot);
          normalizedBoundary = true;
        }
        if (endRoot && isAuthenticatedKatexWholeBoundary(endRoot, range.endContainer) &&
            range.endOffset === range.endContainer.childNodes.length) {
          normalized.setEndAfter(endRoot);
          normalizedBoundary = true;
        }
        // Chromium terminates a mouse drag around Wikipedia's indivisible
        // fallback image on the outer wrapper at offset 0/childNodes.length.
        // Move only those exact Wikipedia endpoints outside the renderer; the
        // normal serializer then preserves paragraph context and still checks
        // fallback-image alt text against sanitized MathML.
        if (startRoot && isWikipediaAtomicFallbackRoot(startRoot) &&
            range.startContainer === startRoot && range.startOffset === 0) {
          normalized.setStartBefore(startRoot);
          normalizedBoundary = true;
        }
        if (endRoot && isWikipediaAtomicFallbackRoot(endRoot) &&
            range.endContainer === endRoot &&
            range.endOffset === endRoot.childNodes.length) {
          normalized.setEndAfter(endRoot);
          normalizedBoundary = true;
        }
      } catch (_error) {
        return null;
      }
      if (normalizedBoundary) {
        return serializeRangePayloadWithMath(normalized, settings, pageWindow);
      }
    }
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
    )) return null;
    const values = originalRoots.map((root) => {
      const nativeMath = getMathElement(root);
      const mathJax2Chtml = mathJax2ChtmlDescriptor(root);
      const projectedMathJax2 = mathJax2Chtml && nativeMath &&
        mathJax2Chtml.assistiveMath === nativeMath
        ? mathJax2Chtml.math
        : null;
      const embedded = projectedMathJax2 ? null : embeddedMathDescriptor(root);
      const sourceLessChtml = nativeMath ? null : sourceLessChtmlDescriptor(root, pageWindow);
      const sourceMath = projectedMathJax2 || nativeMath || (sourceLessChtml && sourceLessChtml.math);
      const safeMath = sourceMath ? sanitizedMathMLClone(sourceMath) : null;
      const sourceText = sourceMath ? '' : getMathSource(root, pageWindow);
      const rejectedSourceLessChtml = !nativeMath && !sourceLessChtml && root && root.matches && (
        (root.matches('mjx-container.MathJax') && root.querySelector &&
          root.querySelector(':scope > mjx-math')) ||
        (root.matches('span.mjx-chtml.MathJax_CHTML') && root.querySelector &&
          root.querySelector(':scope > span.mjx-math'))
      );
      // A generic role=math surface can coexist with genuine renderer roots
      // in one selection. If it has no semantic source of its own, retain its
      // exact visible text only after the same complete subtree/layout audit
      // used for a standalone root. Malformed CHTML is deliberately excluded:
      // its stacked DOM order is not a safe ordinary-text representation.
      const safeUnsourcedText = !sourceMath && !sourceText && !rejectedSourceLessChtml
        ? safeUnsourcedMathRootText(root, settings.outputMode)
        : '';
      const safeUnsourcedFallback = Boolean(safeUnsourcedText.trim());
      const sourceAgreement = sourceMath
        ? semanticMathRootAgreesWithVisible(root, sourceMath, pageWindow)
        : (sourceText ? sourceOnlyMathAgreesWithVisible(root, pageWindow) : safeUnsourcedFallback);
      return {
        text: !sourceAgreement || (sourceMath && !safeMath)
          ? ''
          : (safeUnsourcedFallback
            ? safeUnsourcedText
            : (sourceLessChtml && safeMath
            ? mathMLFragmentText(safeMath, settings.outputMode)
            : (embedded && safeMath
            ? mathMLFragmentText(safeMath, settings.outputMode)
            : (settings.outputMode === 'faithful' && safeMath
            ? faithfulRenderedMathText(root, safeMath, pageWindow)
            : (settings.outputMode === 'calculator' && safeMath
              ? calculatorRenderedMathText(root, safeMath, pageWindow)
              : (safeMath && settings.outputMode !== 'latex'
                ? mathMLFragmentText(safeMath, settings.outputMode)
                : extractMathText(root, settings.outputMode, pageWindow))))))),
        display: isDisplayMath(root),
        root,
        safeMath,
        // Only independently sourced semantic math may bypass renderer CSS
        // inspection. A source-less element that merely resembles a math
        // container could otherwise hide arbitrary selected prose inside its
        // subtree and have that hidden text serialized.
        replaceableForLayout: Boolean(
          (sourceMath && safeMath) || (sourceText && sourceAgreement) || safeUnsourcedFallback
        ),
        semanticRewrite: Boolean(sourceAgreement && !safeUnsourcedFallback)
      };
    });
    if (values.some((value) => !value.text || !value.text.trim())) return null;

    const documentObject = expanded.startContainer.ownerDocument || null;
    const replaceableMathRoots = new Set(values
      .filter((value) => value.replaceableForLayout)
      .map((value) => value.root));
    if (ordinaryComputedLayoutRisk(expanded, documentObject, replaceableMathRoots)) return null;
    const textFragment = cloneOrdinaryRangeWithContext(expanded, documentObject, replaceableMathRoots);
    if (!textFragment) return null;
    const textRoots = canonicalMathRoots(textFragment);
    if (textRoots.length !== values.length) return null;
    textRoots.forEach((root, index) => {
      const value = values[index];
      const replacement = root.ownerDocument.createElement('span');
      TRUSTED_TEXT_PLACEHOLDERS.set(replacement, { text: value.text, display: Boolean(value.display) });
      root.replaceWith(replacement);
    });
    const text = serializeOrdinaryFragment(textFragment).text;

    const richFragment = cloneOrdinaryRangeWithContext(expanded, documentObject, replaceableMathRoots);
    if (!richFragment) return null;
    const richRoots = canonicalMathRoots(richFragment);
    if (richRoots.length !== values.length) return null;
    richRoots.forEach((root, index) => {
      const value = values[index];
      root.replaceWith(value && value.safeMath
        ? richMathNodeForElement(value.safeMath, null, root.ownerDocument)
        : semanticTextRichFragment(
          value && value.text || '',
          settings.outputMode,
          root.ownerDocument
        ));
    });
    const html = sanitizeRichFragment(richFragment);
    const onlyMath = values.length === 1 && text.trim() === values[0].text.trim();
    const mathML = onlyMath ? serializeMathMLMarkup(values[0].safeMath) : '';
    return {
      text,
      html,
      mathML,
      mathRanges: values.filter((value) => value.semanticRewrite).length
    };
  }

  function serializeRangeWithMath(range, settings, pageWindow) {
    const payload = serializeRangePayloadWithMath(range, settings, pageWindow);
    return payload && payload.text;
  }

  function cleanClipboardText(input) {
    const value = String(input == null ? '' : input)
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000\u00ad\u200b\u2060\ufeff]/g, '')
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
    return documentHasMicrosoftOfficeEditorMarker(documentObject);
  }

  function documentHasMicrosoftOfficeEditorMarker(documentObject) {
    if (!documentObject) return false;
    try {
      if (documentObject.getElementById && (
        documentObject.getElementById('WACViewPanel_EditingElement') ||
        documentObject.getElementById('WACViewPanel_ClipboardElement')
      )) return true;
      const pageImages = documentObject.getElementsByClassName &&
        documentObject.getElementsByClassName('WACPageImg');
      return Boolean(pageImages && pageImages.length);
    } catch (_error) {
      // A cross-realm or partially initialized Office document is safer left
      // on its native clipboard path.
      return true;
    }
  }

  function isMicrosoftOfficeEditorSurface(documentObject, target, selection) {
    const selector = '#WACViewPanel_EditingElement, #WACViewPanel_ClipboardElement, .WACPageImg';
    for (const endpoint of [target, selection && selection.anchorNode, selection && selection.focusNode]) {
      const element = endpoint && endpoint.nodeType === 1 ? endpoint : endpoint && endpoint.parentElement;
      if (element && element.closest && element.closest(selector)) return true;
    }
    return documentHasMicrosoftOfficeEditorMarker(documentObject);
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
      // Google Docs can put a closing literal fence inside the script
      // function while leaving its opening fence in the surrounding row. A
      // lone closing/vertical fence is already an atomic TeX script base;
      // wrapping it in `{...}` makes the faithful renderer invent parentheses.
      // Google uses raw Unicode glyphs for several of these, just as it used
      // a raw `)` in the captured clipboard slice.
      if (/^\p{Pe}$/u.test(base) || /^(?:\\\}|[|∣❘∥‖‗⌉⌋»])$/u.test(base)) return base;
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
          // When Docs moves only the closing fence into a script base, close
          // the matching raw-literal fence in this surrounding sequence too.
          // This keeps later empty-fence placeholder detection contextual.
          const scriptedClosingFence = {
            ')': '(',
            ']': '[',
            '\\}': '{'
          }[functionArgs[0]];
          if ((command === '\\superscript' || command === '\\subscript' || command === '\\subsuperscript') &&
              scriptedClosingFence && literalStack[literalStack.length - 1] === scriptedClosingFence) {
            literalStack.pop();
          }
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
      html: semanticTextClipboardHTML(text, settings.outputMode),
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
    let computed;
    let computedAttempted = false;
    const computedStyle = () => {
      if (computedAttempted) return computed;
      computedAttempted = true;
      try {
        const view = element.ownerDocument && element.ownerDocument.defaultView;
        computed = view && view.getComputedStyle && view.getComputedStyle(element);
      } catch (_error) {
        computed = null;
      }
      return computed;
    };
    const verticalAlignmentApplies = () => {
      const resolved = computedStyle();
      let display = String(resolved && resolved.display || '').trim().toLowerCase();
      if (!display) {
        const authored = style.match(/(?:^|;)\s*display\s*:\s*([^;!]+)/i);
        display = String(authored && authored[1] || '').trim().toLowerCase();
      }
      // CSS vertical-align only raises an inline-level box. On a block it is
      // ignored, and on a table cell it aligns cell contents rather than
      // denoting a mathematical script. Semantic <sup>/<sub> tags above stay
      // authoritative regardless of authored display overrides.
      if (display) return /^inline(?:$|-)/u.test(display);
      return !BLOCK_TAGS.has(tag) && !['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'].includes(tag);
    };
    const vertical = style.match(/(?:^|;)\s*vertical-align\s*:\s*(super|sub)\s*(?:!important\s*)?(?:;|$)/i);
    if (vertical && verticalAlignmentApplies()) {
      return vertical[1].toLowerCase() === 'super' ? 'sup' : 'sub';
    }
    const variant = style.match(/(?:^|;)\s*font-variant-position\s*:\s*(super|sub)\s*(?:!important\s*)?(?:;|$)/i);
    if (variant) return variant[1].toLowerCase() === 'super' ? 'sup' : 'sub';
    try {
      const resolved = computedStyle();
      const computedVertical = String(resolved && resolved.verticalAlign || '').trim().toLowerCase();
      if ((computedVertical === 'super' || computedVertical === 'sub') && verticalAlignmentApplies()) {
        return computedVertical === 'super' ? 'sup' : 'sub';
      }
      const computedVariant = String(resolved && (resolved.fontVariantPosition ||
        resolved.getPropertyValue && resolved.getPropertyValue('font-variant-position')) || '')
        .trim().toLowerCase();
      if (computedVariant === 'super' || computedVariant === 'sub') {
        return computedVariant === 'super' ? 'sup' : 'sub';
      }
    } catch (_error) {
      // Inline semantics above remain available in engines that cannot
      // compute styles for a detached clipboard document.
    }
    return '';
  }

  function richScriptClipboardPayloadFromMarkup(markup, settingsInput, documentObject) {
    const parsed = parseClipboardDocument(stripOfficeHTMLClipboardHeader(markup), documentObject, false);
    const parsedBody = parsed && (parsed.body || parsed.documentElement);
    if (!parsedBody || !domTreeWithinBudget(parsedBody, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return null;
    // Keep untrusted clipboard markup in DOMParser's inert document. Importing
    // arbitrary nodes into the live page can upgrade custom elements or trigger
    // page-owned behavior even when the imported fragment is never attached.
    const fragment = parsedBody;
    const originalText = finalizeRewrittenText(serializeOrdinaryFragment(
      fragment,
      'faithful',
      { semanticScripts: false }
    ).text);
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
      const raw = finalizeRewrittenText(serializeOrdinaryFragment(
        element,
        'faithful',
        { semanticScripts: false }
      ).text);
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
          scriptText = nestedScriptContainers.has(element) || Array.from(raw).length !== 1
            ? marker + '(' + raw + ')'
            : marker + raw;
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
    let text = finalizeRewrittenText(serializeOrdinaryFragment(
      fragment,
      'faithful',
      { semanticScripts: false }
    ).text);
    if (!text.trim() || text === originalText) return null;
    if (looksLikeStandaloneUnicodeMath(text)) {
      if (settings.outputMode === 'faithful') text = formatFaithfulMathText(text);
      else if (settings.outputMode === 'calculator') text = unicodeToCalculator(text, { preserveLongIdentifiers: true });
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

  function nativeClipboardSnapshotPayload(values, fallbackText) {
    const entries = values instanceof Map ? values : new Map();
    const find = (types) => {
      for (const type of types) {
        const entry = entries.get(type);
        if (entry && typeof entry.value === 'string') return entry;
      }
      return null;
    };
    const plain = find(['text/plain', 'text', 'unicode']);
    const html = find(['text/html']);
    const mathML = find(['application/mathml+xml', 'mathml', 'mathml presentation']);
    const text = plain && plain.value || String(fallbackText || '');
    if (!text || !text.trim()) return null;
    return {
      text,
      html: html && html.value || '',
      mathML: mathML && mathML.value || '',
      formats: Array.from(entries.values(), (entry) => ({ type: entry.type, text: entry.value })),
      reason: 'pending-native-copy-replay',
      mathRanges: 0
    };
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
    return /[\u0000\u00ad\u200b\u2060\ufeff\u00a0\r]/.test(text);
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
        const common = rangeTraversalRoot(range);
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
      .replace(/[\u0000\u00ad\u200b\u2060\ufeff]/g, '')
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

  function replaceableMathMLRootLayoutIsRisky(element, view, documentObject) {
    if (!element || element.nodeType !== 1 || isVisuallyHiddenElement(element)) return true;
    let computed;
    try {
      computed = view.getComputedStyle(element);
    } catch (_error) {
      // jsdom and a few older browser engines cannot compute a declaration
      // for native MathML. Preserve visible MathML in those engines, but still
      // parse every authored inline declaration through an HTML CSSStyleDeclaration
      // so a hidden or repositioned root cannot use that limitation as a bypass.
      try {
        const probe = documentObject.createElement('span');
        probe.setAttribute('style', String(element.getAttribute('style') || ''));
        computed = probe.style;
      } catch (_fallbackError) {
        return true;
      }
    }
    if (computedStyleHasUnsafeVisibleLayout(computed, false)) return true;
    const visibility = String(computed && computed.visibility || '').toLowerCase();
    const display = String(computed && computed.display || '').toLowerCase();
    const contentVisibility = String(computed && computed.contentVisibility || '').toLowerCase();
    if (display === 'none' || contentVisibility === 'hidden' ||
        visibility === 'hidden' || visibility === 'collapse') return true;

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
    const textSecurity = String(computed && (computed.webkitTextSecurity || computed.getPropertyValue &&
      computed.getPropertyValue('-webkit-text-security')) || '').trim().toLowerCase();
    const fontVariant = String(computed && computed.fontVariant || '').trim().toLowerCase();
    const fontVariantCaps = String(computed && computed.fontVariantCaps || '').trim().toLowerCase();
    if ((textTransform && textTransform !== 'none') || (textSecurity && textSecurity !== 'none') ||
        (fontVariant && fontVariant !== 'normal' && fontVariant !== 'none') ||
        (fontVariantCaps && fontVariantCaps !== 'normal')) return true;

    if (/^(?:flex|inline-flex|grid|inline-grid|table|list-item)$/u.test(display)) return true;
    if (display === 'block' && String(element.getAttribute('display') || '').toLowerCase() !== 'block') return true;
    return false;
  }

  function nativeMathMLPresentationLayoutIsRisky(mathElement, viewInput, documentInput) {
    if (!mathElement || mathElement.nodeType !== 1 ||
        mathElement.namespaceURI !== MATHML_NAMESPACE) return true;
    const documentObject = documentInput || mathElement.ownerDocument;
    const view = viewInput || (documentObject && documentObject.defaultView);
    if (!documentObject || !view || typeof view.getComputedStyle !== 'function') return true;
    const stack = [mathElement];
    let visited = 0;
    while (stack.length) {
      const element = stack.pop();
      if (!element || element.nodeType !== 1 || element.namespaceURI !== MATHML_NAMESPACE) return true;
      visited += 1;
      if (visited > MAX_MATHML_NODES) return true;
      const name = (element.localName || '').toLowerCase();
      // These nodes have no rendered contribution and every math serializer
      // already drops their text. TeX annotations in <semantics> must not make
      // otherwise visible native MathML fail the layout audit.
      if (['annotation', 'annotation-xml', 'mphantom', 'none', 'mspace'].includes(name)) continue;
      if (replaceableMathMLRootLayoutIsRisky(element, view, documentObject)) return true;
      const children = name === 'semantics'
        ? [presentationMathNode(element)].filter(Boolean)
        : elementChildren(element);
      for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
    }
    return false;
  }

  function cssStackMathTextSlice(node, range) {
    if (!node || node.nodeType !== 3) return '';
    const value = String(node.nodeValue || '');
    if (!range) return value;
    if (!rangeIntersects(range, node)) return '';
    let start = node === range.startContainer ? range.startOffset : 0;
    let end = node === range.endContainer ? range.endOffset : value.length;
    start = Math.max(0, Math.min(value.length, Number(start) || 0));
    end = Math.max(start, Math.min(value.length, Number(end) || 0));
    return value.slice(start, end);
  }

  function cssStackMathChildIsSelected(range, parent, child, index) {
    if (!range) return true;
    if (parent === range.startContainer && index < range.startOffset) return false;
    if (parent === range.endContainer && index >= range.endOffset) return false;
    return rangeIntersects(range, child);
  }

  function cssStackMathElementTagIsSafe(element, root = false) {
    if (!element || element.nodeType !== 1) return false;
    const tag = (element.localName || '').toLowerCase();
    if (tag === 'wbr') return true;
    if (root && ['body', 'html', 'sub', 'sup'].includes(tag)) return false;
    const namespace = String(element.namespaceURI || 'http://www.w3.org/1999/xhtml').toLowerCase();
    return namespace === 'http://www.w3.org/1999/xhtml' &&
      /^[a-z][a-z0-9._-]*$/u.test(tag) && !CSS_STACK_MATH_UNSAFE_TAGS.has(tag);
  }

  function cssStackMathStructuralChildren(element) {
    const children = [];
    let inspected = 0;
    for (let child = element && element.firstElementChild; child; child = child.nextElementSibling) {
      inspected += 1;
      if (inspected > MAX_CSS_STACK_MATH_NODES) return [element, element, element, element];
      if ((child.localName || '').toLowerCase() === 'wbr') continue;
      children.push(child);
      // A visual stack can have only two rows, or two rows plus one rule.
      // Keep a fourth sentinel element so callers reject wider shapes without
      // first materializing an attacker-controlled HTMLCollection.
      if (children.length > 3) break;
    }
    return children;
  }

  function cssStackMathBoundedDirectNodes(element) {
    const nodes = [];
    for (let child = element && element.firstChild; child; child = child.nextSibling) {
      nodes.push(child);
      if (nodes.length > MAX_CSS_STACK_MATH_NODES) return null;
    }
    return nodes;
  }

  function cssStackMathStackParts(element) {
    let container = element;
    const wrappers = [];
    let parts = cssStackMathStructuralChildren(container);
    for (let depth = 0;
      depth < Math.min(MAX_RICH_SELECTION_DEPTH, MAX_CSS_STACK_MATH_NODES) && parts.length === 1;
      depth += 1) {
      const wrapper = parts[0];
      const directNodes = cssStackMathBoundedDirectNodes(wrapper);
      if (!directNodes) return { container, parts: [], wrappers, overBudget: true };
      const directText = directNodes.some((child) =>
        child.nodeType === 3 && cleanOrdinaryCharacters(child.nodeValue || '').trim());
      if (directText || !cssStackMathElementTagIsSafe(wrapper, true)) break;
      const nested = cssStackMathStructuralChildren(wrapper);
      if (!nested.length) break;
      wrappers.push(wrapper);
      container = wrapper;
      parts = nested;
    }
    return { container, parts, wrappers, overBudget: false };
  }

  function createCssStackMathDescriptorContext() {
    return { descriptorCache: new WeakMap() };
  }

  function cssStackMathDomSource(root, range, nestedDepth = 0, contextInput) {
    if (nestedDepth > MAX_MATHML_DEPTH) return '';
    const descriptorContext = contextInput || createCssStackMathDescriptorContext();
    let nodes = 0;
    let scannedChildren = 0;
    let characters = 0;
    let invalid = false;
    const visit = (node, isRoot = false) => {
      if (!node || invalid) return '';
      nodes += 1;
      if (nodes > MAX_CSS_STACK_MATH_NODES) {
        invalid = true;
        return '';
      }
      if (node.nodeType === 3) {
        let value = cssStackMathTextSlice(node, range)
          .replace(/\r\n?/g, '\n')
          .replace(/[\u0000\u00ad\u200b\u2060\ufeff]/g, '')
          .replace(/\u00a0/g, ' ');
        // Keep visible TeX-special glyphs distinct from the trusted structure
        // synthesized below. Authored private markers are rejected first so a
        // page cannot smuggle its own braces or commands into the expression.
        if (/[\ue200-\ue206]/u.test(value) || /[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
          invalid = true;
          return '';
        }
        value = value.replace(/[\\{}$#%&]/gu, (character) => CSS_STACK_VISIBLE_SPECIALS[character]);
        characters += value.length;
        if (characters > MAX_CSS_STACK_MATH_CHARACTERS) {
          invalid = true;
          return '';
        }
        return value.replace(/[\t\n\f\r ]+/g, ' ');
      }
      if (node.nodeType !== 1 && node.nodeType !== 11) return '';
      if (node.nodeType === 1) {
        const tag = (node.localName || '').toLowerCase();
        if (tag === 'wbr') return '';
        if (!cssStackMathElementTagIsSafe(node, false) || isVisuallyHiddenElement(node)) {
          invalid = true;
          return '';
        }
        if (cssStackMathCandidateShape(node)) {
          const nested = cssStackMathRootDescriptor(
            node,
            node.ownerDocument,
            nestedDepth + 1,
            descriptorContext
          );
          if (nested) {
            const selected = range
              ? cssStackMathSelectedDescriptorSource(
                nested,
                range,
                nestedDepth + 1,
                descriptorContext
              )
              : { selectedSemanticSource: nested.source };
            if (selected === CSS_STACK_MATH_DOM_UNREPRESENTABLE) {
              invalid = true;
              return '';
            }
            const nestedSource = selected && selected.selectedSemanticSource || '';
            if (!nestedSource) return '';
            characters += nestedSource.length;
            if (characters > MAX_CSS_STACK_MATH_CHARACTERS) {
              invalid = true;
              return '';
            }
            return nestedSource;
          }
          // A visibly stacked descendant that failed authentication must not
          // be concatenated into a different formula by its parent.
          if (cssStackMathPlausibleVisualRoot(node, node.ownerDocument, true)) {
            invalid = true;
            return '';
          }
        }
      }
      let value = '';
      let index = 0;
      for (let child = node.firstChild; child && !invalid; child = child.nextSibling, index += 1) {
        scannedChildren += 1;
        if (scannedChildren > MAX_CSS_STACK_MATH_NODES) {
          invalid = true;
          break;
        }
        if (cssStackMathChildIsSelected(range, node, child, index)) value += visit(child, false);
      }
      if (node.nodeType === 1) {
        const tag = (node.localName || '').toLowerCase();
        if ((tag === 'sup' || tag === 'sub') && value.trim()) {
          value = (tag === 'sup' ? '^{' : '_{') + value.trim() + '}';
        }
      }
      return value;
    };
    const source = visit(root, true).replace(/[\t\n\f\r ]+/g, ' ').trim();
    return invalid || source.length > MAX_CSS_STACK_MATH_CHARACTERS
      ? CSS_STACK_MATH_DOM_UNREPRESENTABLE
      : source;
  }

  function cssStackMathBorderIsFractionRule(computed, edge = 'bottom') {
    const prefix = edge === 'top' ? 'borderTop' : 'borderBottom';
    const style = String(computed && computed[prefix + 'Style'] || '').trim().toLowerCase();
    const width = String(computed && computed[prefix + 'Width'] || '').trim().toLowerCase();
    const color = String(computed && computed[prefix + 'Color'] || '').trim().toLowerCase();
    if (style !== 'solid' || cssColorIsFullyTransparent(color)) return false;
    const amount = Number.parseFloat(width);
    return (Number.isFinite(amount) && amount > 0) || ['thin', 'medium', 'thick'].includes(width);
  }

  function cssStackMathDedicatedRule(element, computed, rect, topRect, bottomRect) {
    if (!element || !computed || !rect || !topRect || !bottomRect ||
        cleanOrdinaryCharacters(element.textContent || '').trim()) return false;
    const horizontalOverlap = Math.min(rect.right, topRect.right, bottomRect.right) -
      Math.max(rect.left, topRect.left, bottomRect.left);
    const maximumHeight = Math.max(4, Math.min(topRect.height, bottomRect.height) * 0.25);
    if (horizontalOverlap <= 0 || rect.height > maximumHeight ||
        rect.top < topRect.bottom - 1.5 || rect.bottom > bottomRect.top + 1.5) return false;
    if (cssStackMathBorderIsFractionRule(computed, 'top') ||
        cssStackMathBorderIsFractionRule(computed, 'bottom')) return true;
    const background = String(computed.backgroundColor || '').trim().toLowerCase();
    return Boolean(background && !cssColorIsFullyTransparent(background));
  }

  function cssStackMathPositiveRect(element) {
    try {
      const rect = element && element.getBoundingClientRect && element.getBoundingClientRect();
      if (!rect) return null;
      const left = Number(rect.left);
      const top = Number(rect.top);
      const width = Number(rect.width);
      const height = Number(rect.height);
      if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
      return {
        left,
        top,
        right: Number.isFinite(Number(rect.right)) ? Number(rect.right) : left + width,
        bottom: Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : top + height,
        width,
        height
      };
    } catch (_error) {
      return null;
    }
  }

  function cssStackMathUnionRect(left, right) {
    if (!left || !right) return null;
    const union = {
      left: Math.min(left.left, right.left),
      top: Math.min(left.top, right.top),
      right: Math.max(left.right, right.right),
      bottom: Math.max(left.bottom, right.bottom)
    };
    union.width = union.right - union.left;
    union.height = union.bottom - union.top;
    return union.width > 0 && union.height > 0 ? union : null;
  }

  function cssStackMathRectContains(outer, inner) {
    if (!outer || !inner) return false;
    const tolerance = 0.5;
    return inner.left >= outer.left - tolerance && inner.top >= outer.top - tolerance &&
      inner.right <= outer.right + tolerance && inner.bottom <= outer.bottom + tolerance;
  }

  function cssStackMathPunctuationIsSafe(source) {
    const characters = Array.from(String(source || ''));
    const operand = (value) => /[\p{L}\p{N}\p{M})\]}′″‴⁗!'"’]/u.test(value || '');
    for (let index = 0; index < characters.length; index += 1) {
      const character = characters[index];
      if (/[?“”‘]/u.test(character)) return false;
      if (/[!'"’]/u.test(character) && !operand(characters[index - 1])) return false;
      if (character === ':' || character === ';') {
        let next = index + 1;
        while (next < characters.length && /\s/u.test(characters[next])) next += 1;
        if (character === ':' && characters[next] === '=') next += 1;
        while (next < characters.length && /\s/u.test(characters[next])) next += 1;
        if (!operand(characters[index - 1]) ||
            !/[\p{L}\p{N}(\[√∛∜+\-−]/u.test(characters[next] || '')) return false;
      }
    }
    return true;
  }

  function cssStackMathSourceAnalysis(source, explicitSemantics = false) {
    let value = String(source || '');
    // Backslashes in authored row text are escaped to private markers before
    // this point. A real TeX command therefore comes only from an already
    // authenticated nested visual stack and can be safely linearized for the
    // prose-vs-math grammar check.
    if (/\\(?:frac|lim|liminf|limsup|sum|prod|coprod|int|iint|iiint|oint)(?:\s|[_^{])/u.test(value)) {
      const linear = latexToFaithful(value);
      if (linear && !linear.includes('\\')) value = linear;
    }
    // NFKC turns letter scripts such as `ᵢ` into ordinary adjacent letters
    // (`xi`), which would falsely look like an unknown prose word. Preserve
    // the script boundary structurally before compatibility normalization.
    value = decodeUnicodeScripts(value);
    try { value = value.normalize('NFKC'); } catch (_error) {}
    if (!value || !cssStackMathPunctuationIsSafe(value) || /\.$/u.test(value)) {
      return { valid: false, signal: false, numericOnly: false };
    }
    const words = Array.from(value.matchAll(/\p{L}+/gu), (match) => match[0]);
    let wordSignal = false;
    let proseLikeWord = false;
    for (const word of words) {
      const lower = word.toLowerCase();
      const length = Array.from(word).length;
      // Two adjacent variable glyphs (`ac`, `gR`, `xy`) are standard implicit
      // multiplication. Longer unknown words are prose unless a renderer
      // supplies explicit math semantics.
      const singleVariable = length <= 2 || /^[dⅆ][\p{L}]$/u.test(word);
      const known = CSS_STACK_MATH_WORDS.has(lower);
      if (!singleVariable && !known && !/^[α-ωΑ-Ω]+$/u.test(word) && !explicitSemantics) {
        return { valid: false, signal: false, numericOnly: false };
      }
      wordSignal = wordSignal || singleVariable || explicitSemantics || /^[α-ωΑ-Ω]+$/u.test(word);
      proseLikeWord = proseLikeWord || (length > 2 && !CALCULATOR_FUNCTIONS.has(lower) &&
        lower !== 'lim' && !/^(?:beta|gamma|rho|phi|chi)$/u.test(lower));
    }
    const structuralSignal = /[\p{N}^_+\-−×÷·⋅∗/*=<>≤≥≠≈≃≅≡∝∞∂∇∑∏∫±∓%√∛∜]/u.test(value);
    const numericOnly = /\p{N}/u.test(value) && !/\p{L}/u.test(value) &&
      /^[\p{N}\p{M}\s.,+\-−–—×÷·⋅∗/*=<>≤≥≠≈±∓%()[\]_{}\ue200-\ue206]+$/u.test(value);
    // A trusted nested bounded operator is a single mathematical head even
    // though its readable form contains spaces inside the bound and before
    // its body (`lim_(x → 0) f(x)`, `∑_(i = 1) a_i`). Raw page backslashes
    // were escaped before this analysis, so these commands can only have come
    // from an independently authenticated nested visual stack.
    const spacingValue = value.replace(
      /(?:\blim|[∑∏∫])(?:_\{[^{}]*\}|_\([^()]*\))?(?:\^\{[^{}]*\}|\^\([^()]*\))?\s*/gu,
      'Ω'
    );
    const spacedTokens = /[\p{L}\p{N})\]]\s+[\p{L}\p{N}([]/u.test(spacingValue);
    const longWords = words.filter((word) => Array.from(word).length > 2);
    const functionExpression = longWords.length > 0 &&
      longWords.every((word) => CALCULATOR_FUNCTIONS.has(word.toLowerCase()));
    return {
      valid: Boolean(words.length || structuralSignal),
      signal: wordSignal || structuralSignal,
      numericOnly,
      proseLikeWord,
      spacedTokens,
      functionExpression
    };
  }

  function cssStackMathPlainTailHasUnambiguousGrammar(source) {
    let value = String(source || '');
    // Preserve the boundary between an identifier and a Unicode letter
    // script before NFKC turns `aᵢ` into the unrelated two-letter word `ai`.
    value = decodeUnicodeScripts(value);
    try { value = value.normalize('NFKC'); } catch (_error) {}
    const words = Array.from(value.matchAll(/\p{L}+/gu), (match) => match[0]);
    return words.every((word) => {
      const characters = Array.from(word);
      if (characters.length === 1) return true;
      const lower = word.toLowerCase();
      return CALCULATOR_FUNCTIONS.has(lower) || /^(?:beta|gamma|rho|phi|chi)$/u.test(lower);
    });
  }

  function cssStackMathSourceLooksLikeUiValue(source) {
    const authored = String(source || '').trim();
    let value = authored;
    try { value = value.normalize('NFKC'); } catch (_error) {}
    value = value.replace(/\s+/gu, '');
    const authoredCompact = authored.replace(/\s+/gu, '');
    return /^(?:v\d+(?:\.\d+)*|\d+(?:st|nd|rd|th)|[+\-\u2212]?(?:\d+(?:\.\d*)?|\.\d+)(?:kg|km|cm|mm|ms|hz|rpm|px|pt|em|rem))$/iu.test(value) ||
      /^(?:am|pm|ok|no|yes|on|off|up|dn|down|go|us|eu|uk|kg|lb)$/iu.test(authoredCompact) ||
      /^(?:[A-Z]{2,3}|[A-Z]\d+)$/u.test(authoredCompact);
  }

  function cssStackMathHasNumericFractionSemantics(element, trustedElements) {
    const candidates = [];
    const seen = new Set();
    const add = (candidate) => {
      if (candidate && candidate.nodeType === 1 && !seen.has(candidate)) {
        seen.add(candidate);
        candidates.push(candidate);
      }
    };
    // Keep the small outside-ancestor allowance for a source-less role=math
    // label around a stack. Separately include every wrapper already audited
    // by cssStackMathStackParts, regardless of neutral wrapper depth.
    for (let current = element, depth = 0; current && depth < 5;
      current = composedParentElement(current), depth += 1) {
      add(current);
    }
    for (const candidate of trustedElements || []) add(candidate);
    for (const current of candidates) {
      const role = String(current.getAttribute && current.getAttribute('role') || '').trim().toLowerCase();
      const roleDescription = String(
        current.getAttribute && current.getAttribute('aria-roledescription') || ''
      ).trim().toLowerCase();
      if (role === 'math' || /^(?:equation|formula|math|mathematics)$/u.test(roleDescription)) return true;
      const classes = Array.from(current.classList || [], (value) => String(value).toLowerCase());
      if (classes.some((value) => /^(?:math-fraction|mathfrac|mfrac|stacked-math|stacked-fraction)$/u.test(value))) {
        return true;
      }
      for (const name of ['data-math', 'data-formula', 'data-equation']) {
        const value = String(current.getAttribute && current.getAttribute(name) || '').trim().toLowerCase();
        if (/^(?:1|true|math|formula|equation)$/u.test(value)) return true;
      }
      // Source-bearing data-latex/data-mathml nodes take the independent
      // semantic-renderer path, where their source must agree with the visible
      // formula. Merely having unrelated source text on an ancestor is not
      // enough to authenticate an otherwise ambiguous numeric UI stack.
    }
    return false;
  }

  function cssStackMathGeneratedContentIsSafe(element, view) {
    const userAgent = String(view && view.navigator && view.navigator.userAgent || '');
    // jsdom has no layout engine or pseudo-element implementation. Positive
    // row rectangles are stubbed in unit tests; real supported browsers always
    // execute the generated-content audit below.
    if (/jsdom/i.test(userAgent)) return true;
    for (const pseudo of ['::before', '::after']) {
      let content = '';
      try {
        content = String(view.getComputedStyle(element, pseudo).content || '').trim();
      } catch (_error) {
        return false;
      }
      if (!content || content === 'none' || content === 'normal') continue;
      const quoted = content.match(/^(?:"([\s\u00a0\u2000-\u200a\u202f\u205f\u3000]*)"|'([\s\u00a0\u2000-\u200a\u202f\u205f\u3000]*)')$/u);
      if (!quoted) return false;
    }
    return true;
  }

  function cssStackMathDirectionIsSafe(computed) {
    const direction = String(computed && computed.direction || '').trim().toLowerCase();
    const unicodeBidi = String(computed && (computed.unicodeBidi || computed.getPropertyValue &&
      computed.getPropertyValue('unicode-bidi')) || '').trim().toLowerCase();
    return (!direction || direction === 'ltr') &&
      (!unicodeBidi || unicodeBidi === 'normal' || unicodeBidi === 'isolate');
  }

  function cssStackMathLinearRowLayoutIsSafe(row, computed, view, nestedDepth, descriptorContext) {
    const display = String(computed && computed.display || '').trim().toLowerCase();
    const directNodes = cssStackMathBoundedDirectNodes(row);
    if (!directNodes) return false;
    const meaningful = directNodes.filter((child) => {
      if (child.nodeType === 8) return false;
      if (child.nodeType === 3) return Boolean(cleanOrdinaryCharacters(child.nodeValue || '').trim());
      return child.nodeType === 1 && (child.localName || '').toLowerCase() !== 'wbr';
    });
    if (/^(?:flex|inline-flex)$/u.test(display)) {
      const direction = String(computed.flexDirection || '').trim().toLowerCase();
      const wrap = String(computed.flexWrap || '').trim().toLowerCase();
      if (direction && direction !== 'row' || wrap && wrap !== 'nowrap') return false;
    } else if (/^(?:grid|inline-grid)$/u.test(display) && meaningful.length > 1) {
      // Grid placement can reorder siblings independently of DOM order. A
      // single transparent child is safe; multiple grid items need geometry
      // semantics this linear serializer deliberately does not guess.
      return false;
    }
    for (const child of meaningful) {
      if (child.nodeType !== 1) continue;
      if (cssStackMathCandidateShape(child) &&
          cssStackMathRootDescriptor(
            child,
            child.ownerDocument,
            nestedDepth + 1,
            descriptorContext
          )) continue;
      let childComputed;
      try { childComputed = view.getComputedStyle(child); } catch (_error) { return false; }
      const childDisplay = String(childComputed.display || '').trim().toLowerCase();
      const position = String(childComputed.position || '').trim().toLowerCase();
      const order = Number.parseFloat(String(childComputed.order || '0'));
      const gridColumn = String(childComputed.gridColumn || childComputed.getPropertyValue &&
        childComputed.getPropertyValue('grid-column') || '').trim().toLowerCase();
      const gridRow = String(childComputed.gridRow || childComputed.getPropertyValue &&
        childComputed.getPropertyValue('grid-row') || '').trim().toLowerCase();
      if (!['inline', 'inline-block', 'contents'].includes(childDisplay) ||
          /^(?:relative|sticky|absolute|fixed)$/u.test(position) ||
          (Number.isFinite(order) && order !== 0) ||
          (gridColumn && gridColumn !== 'auto') || (gridRow && gridRow !== 'auto')) return false;
    }
    return true;
  }

  function cssStackMathSourceDelimitersBalanced(source) {
    const stack = [];
    let braceDepth = 0;
    const value = String(source || '');
    for (const character of value) {
      if (character === '(' || character === '[') stack.push(character);
      else if (character === ')' || character === ']') {
        if (!stack.length) return false;
        const opening = stack.pop();
        const matches = (opening === '(' && character === ')') || (opening === '[' && character === ']');
        // Mixed interval fences such as [a,b) are valid, but a mismatch in a
        // nested structure such as ([x)] is not.
        if (!matches && (stack.length > 0 || !value.includes(','))) return false;
      } else if (character === '{') braceDepth += 1;
      else if (character === '}') {
        braceDepth -= 1;
        if (braceDepth < 0) return false;
      }
    }
    if (stack.length || braceDepth !== 0) return false;
    const trimmed = value.trim();
    const startsWithBar = /^(?:\|\||[|∣❘‖∥])/u.test(trimmed);
    const endsWithBar = /(?:\|\||[|∣❘‖∥])$/u.test(trimmed);
    const barCount = Array.from(trimmed).filter((character) => /[|∣❘‖∥]/u.test(character)).length;
    return !(barCount % 2 !== 0 && (startsWithBar || endsWithBar));
  }

  function cssStackMathSourceHasCompleteOperands(source) {
    const value = String(source || '').trim();
    if (!value) return false;
    const leading = value.replace(/^[([{]+\s*/u, '');
    if (/^(?:[\^_*/×÷·⋅∗=<>≤≥≠≈≃≅≡∝→←↔⇒⇐⇔↦∈∉⊂⊆⊃⊇∪∩∧∨~∼])/u.test(leading)) return false;
    const trailing = value.replace(/[)\]}]+$/u, '').trimEnd();
    return !/(?:[+\-−*/×÷·⋅∗=<>≤≥≠≈≃≅≡∝→←↔⇒⇐⇔↦∈∉⊂⊆⊃⊇∪∩∧∨~∼±∓])$/u.test(trailing);
  }

  function cssStackMathAncestorLayoutIsSafe(element, view) {
    for (let ancestor = element; ancestor; ancestor = composedParentElement(ancestor)) {
      const editable = String(ancestor.getAttribute && ancestor.getAttribute('contenteditable') || '').toLowerCase();
      if (ancestor.isContentEditable === true || (ancestor.hasAttribute &&
          ancestor.hasAttribute('contenteditable') && editable !== 'false')) return false;
      let computed;
      try { computed = view.getComputedStyle(ancestor); } catch (_error) { return false; }
      const value = (name, property) => String(
        computed && (computed[name] || computed.getPropertyValue && computed.getPropertyValue(property || name)) || ''
      ).trim().toLowerCase();
      const compact = (name, property) => value(name, property).replace(/\s+/g, '');
      const contentVisibility = value('contentVisibility', 'content-visibility');
      if (value('display') === 'none' || (contentVisibility && contentVisibility !== 'visible') ||
          /^(?:hidden|collapse)$/u.test(value('visibility'))) return false;
      const opacity = Number.parseFloat(value('opacity') || '1');
      const fontSize = Number.parseFloat(value('fontSize', 'font-size'));
      if ((Number.isFinite(opacity) && opacity <= 0) ||
          (Number.isFinite(fontSize) && fontSize <= 0) ||
          cssColorIsFullyTransparent(value('color')) ||
          cssColorIsFullyTransparent(value('webkitTextFillColor', '-webkit-text-fill-color'))) return false;
      const clip = value('clip');
      const clipPath = value('clipPath', 'clip-path') || value('webkitClipPath', '-webkit-clip-path');
      const mask = compact('maskImage', 'mask-image') || compact('webkitMaskImage', '-webkit-mask-image');
      const filter = compact('filter');
      const transform = compact('transform');
      const scale = compact('scale');
      const rotate = compact('rotate');
      if ((clip && clip !== 'auto') || (clipPath && clipPath !== 'none') ||
          (mask && mask !== 'none') || (filter && filter !== 'none') ||
          (transform && transform !== 'none') || (scale && scale !== 'none' && scale !== '1') ||
          (rotate && rotate !== 'none' && rotate !== '0deg' && rotate !== '0')) return false;
      const clippedOverflow = [value('overflow'), value('overflowX', 'overflow-x'), value('overflowY', 'overflow-y')]
        .some((item) => /^(?:hidden|clip|scroll|auto)$/u.test(item));
      if (clippedOverflow) {
        const rect = cssStackMathPositiveRect(ancestor);
        if (!rect) return false;
      }
      if (!cssStackMathDirectionIsSafe(computed)) return false;
    }
    return true;
  }

  function cssStackMathClippingAncestorsExpose(element, visualRect, view) {
    for (let ancestor = element; ancestor; ancestor = composedParentElement(ancestor)) {
      let computed;
      try { computed = view.getComputedStyle(ancestor); } catch (_error) { return false; }
      const value = (name, property) => String(
        computed && (computed[name] || computed.getPropertyValue && computed.getPropertyValue(property || name)) || ''
      ).trim().toLowerCase();
      const clipped = [value('overflow'), value('overflowX', 'overflow-x'), value('overflowY', 'overflow-y')]
        .some((item) => /^(?:hidden|clip|scroll|auto)$/u.test(item));
      if (!clipped) continue;
      const ancestorRect = cssStackMathPositiveRect(ancestor);
      if (!visualRect || !ancestorRect || !cssStackMathRectContains(ancestorRect, visualRect)) return false;
    }
    return true;
  }

  function cssStackMathRootDescriptor(element, documentObject, nestedDepth = 0, contextInput) {
    if (!element || element.nodeType !== 1 || !documentObject || nestedDepth > MAX_MATHML_DEPTH) return null;
    const descriptorContext = contextInput || createCssStackMathDescriptorContext();
    const cache = descriptorContext.descriptorCache;
    if (cache.has(element)) {
      const cached = cache.get(element);
      return cached === CSS_STACK_MATH_DESCRIPTOR_PENDING ? null : cached;
    }
    cache.set(element, CSS_STACK_MATH_DESCRIPTOR_PENDING);
    try {
      const descriptor = cssStackMathRootDescriptorUncached(
        element,
        documentObject,
        nestedDepth,
        descriptorContext
      );
      cache.set(element, descriptor || null);
      return descriptor;
    } catch (error) {
      cache.delete(element);
      throw error;
    }
  }

  function cssStackMathRootDescriptorUncached(element, documentObject, nestedDepth, descriptorContext) {
    if (!element || element.nodeType !== 1 || !documentObject || nestedDepth > MAX_MATHML_DEPTH) return null;
    if (!cssStackMathElementTagIsSafe(element, true) || element.hasAttribute('contenteditable')) return null;
    const directNodes = cssStackMathBoundedDirectNodes(element);
    if (!directNodes) return null;
    for (const child of directNodes) {
      if (child.nodeType === 3 && cleanOrdinaryCharacters(child.nodeValue || '').trim()) return null;
      if (![1, 3, 8].includes(child.nodeType)) return null;
    }
    const stackShape = cssStackMathStackParts(element);
    if (stackShape.overBudget) return null;
    const parts = stackShape.parts;
    if (![2, 3].includes(parts.length)) return null;
    const emptyParts = parts.filter((part) => !cleanOrdinaryCharacters(part.textContent || '').trim());
    const ruleElement = parts.length === 3 && emptyParts.length === 1 ? emptyParts[0] : null;
    if (parts.length === 3 && !ruleElement) return null;
    if (ruleElement && !cssStackMathElementTagIsSafe(ruleElement, false)) return null;
    let rows = ruleElement ? parts.filter((part) => part !== ruleElement) : parts;
    if (rows.some((row) => !cssStackMathElementTagIsSafe(row, false))) return null;
    const view = documentObject.defaultView;
    if (!view || typeof view.getComputedStyle !== 'function') return null;
    if (!cssStackMathAncestorLayoutIsSafe(element, view)) return null;

    let rootComputed;
    let rowEntries = [];
    let ruleComputed = null;
    let ruleRect = null;
    try {
      rootComputed = view.getComputedStyle(element);
      if (!CSS_STACK_MATH_LAYOUT_DISPLAYS.has(String(rootComputed.display || '').toLowerCase()) ||
          computedStyleHasUnsafeVisibleLayout(rootComputed, false) ||
          !cssStackMathDirectionIsSafe(rootComputed) ||
          !cssStackMathGeneratedContentIsSafe(element, view)) return null;
      for (const row of rows) {
        const computed = view.getComputedStyle(row);
        const display = String(computed.display || '').toLowerCase();
        if (!CSS_STACK_MATH_LAYOUT_DISPLAYS.has(display) ||
            computedStyleHasUnsafeVisibleLayout(computed, false) ||
            !cssStackMathDirectionIsSafe(computed) ||
            !cssStackMathGeneratedContentIsSafe(row, view)) return null;
        const rect = cssStackMathPositiveRect(row);
        if (!rect) return null;
        rowEntries.push({ row, computed, rect });
      }
      if (ruleElement) {
        ruleComputed = view.getComputedStyle(ruleElement);
        ruleRect = cssStackMathPositiveRect(ruleElement);
        if (!ruleRect || computedStyleHasUnsafeVisibleLayout(ruleComputed, false) ||
            !cssStackMathDirectionIsSafe(ruleComputed) ||
            !cssStackMathGeneratedContentIsSafe(ruleElement, view)) return null;
      }
      for (const wrapper of stackShape.wrappers) {
        const computed = view.getComputedStyle(wrapper);
        const display = String(computed.display || '').toLowerCase();
        if (!CSS_STACK_MATH_LAYOUT_DISPLAYS.has(display) ||
            computedStyleHasUnsafeVisibleLayout(computed, false) ||
            !cssStackMathDirectionIsSafe(computed) ||
            !cssStackMathGeneratedContentIsSafe(wrapper, view)) return null;
      }
    } catch (_error) {
      return null;
    }

    rowEntries.sort((left, right) =>
      (left.rect.top + left.rect.height / 2) - (right.rect.top + right.rect.height / 2));
    rows = rowEntries.map((entry) => entry.row);
    const rowComputed = rowEntries.map((entry) => entry.computed);
    const topRect = rowEntries[0].rect;
    const bottomRect = rowEntries[1].rect;
    const overlap = Math.min(topRect.right, bottomRect.right) - Math.max(topRect.left, bottomRect.left);
    const rowOverlapTolerance = Math.min(1.5, Math.min(topRect.height, bottomRect.height) * 0.08);
    if (overlap <= 0 || bottomRect.top < topRect.bottom - rowOverlapTolerance) return null;
    if (!rows.every((row, index) =>
      cssStackMathLinearRowLayoutIsSafe(
        row,
        rowComputed[index],
        view,
        nestedDepth,
        descriptorContext
      ))) return null;

    let visited = 0;
    const stack = [...rows];
    while (stack.length) {
      const current = stack.pop();
      visited += 1;
      if (visited > MAX_CSS_STACK_MATH_NODES) return null;
      if (!current || current.nodeType !== 1) return null;
      if (!cssStackMathElementTagIsSafe(current, false) || current.hasAttribute('hidden') ||
          current.hasAttribute('contenteditable') || current.getAttribute('aria-hidden') === 'true' ||
          current.querySelector && current.querySelector('a,button,input,select,textarea,details,summary,[contenteditable]')) {
        return null;
      }
      if (current !== rows[0] && current !== rows[1]) {
        if (cssStackMathCandidateShape(current) &&
            cssStackMathRootDescriptor(
              current,
              documentObject,
              nestedDepth + 1,
              descriptorContext
            )) continue;
        try {
          const computed = view.getComputedStyle(current);
          const display = String(computed && computed.display || '').toLowerCase();
          if (computedStyleHasUnsafeVisibleLayout(computed, false) ||
              !cssStackMathDirectionIsSafe(computed) ||
              !cssStackMathGeneratedContentIsSafe(current, view) ||
              (display && !['inline', 'inline-block', 'contents'].includes(display))) return null;
        } catch (_error) {
          return null;
        }
      }
      for (let child = current.lastElementChild; child; child = child.previousElementSibling) stack.push(child);
    }

    const topSource = cssStackMathDomSource(rows[0], null, nestedDepth, descriptorContext);
    const bottomSource = cssStackMathDomSource(rows[1], null, nestedDepth, descriptorContext);
    if (topSource === CSS_STACK_MATH_DOM_UNREPRESENTABLE ||
        bottomSource === CSS_STACK_MATH_DOM_UNREPRESENTABLE) return null;
    const linearSource = topSource + bottomSource;
    if (!topSource || !bottomSource ||
        !cssStackMathSourceDelimitersBalanced(topSource) ||
        !cssStackMathSourceDelimitersBalanced(bottomSource)) return null;
    const dedicatedRule = ruleElement && cssStackMathDedicatedRule(
      ruleElement, ruleComputed, ruleRect, topRect, bottomRect
    );
    if (ruleElement && !dedicatedRule) return null;
    const fraction = cssStackMathBorderIsFractionRule(rowComputed[0], 'bottom') ||
      cssStackMathBorderIsFractionRule(rowComputed[1], 'top') || Boolean(dedicatedRule);
    if (fraction && (!cssStackMathSourceHasCompleteOperands(topSource) ||
        !cssStackMathSourceHasCompleteOperands(bottomSource))) return null;
    // A neutral host wrapper and its innermost visual owner describe the same
    // two rows. Semantic attributes commonly live on that inner owner, so an
    // arbitrary outer tag must neither erase nor invent their authentication.
    const explicitSemantics = cssStackMathHasNumericFractionSemantics(
      stackShape.container,
      [element, ...stackShape.wrappers]
    );
    const explicitFractionSemantics = fraction && explicitSemantics;
    const topAnalysis = cssStackMathSourceAnalysis(topSource, explicitSemantics);
    const bottomAnalysis = cssStackMathSourceAnalysis(bottomSource, explicitSemantics);
    if (!topAnalysis.valid || !bottomAnalysis.valid) return null;
    if (fraction ? (!topAnalysis.signal || !bottomAnalysis.signal) : !bottomAnalysis.signal) return null;
    if (fraction && !explicitFractionSemantics && (
      cssStackMathSourceLooksLikeUiValue(topSource) || cssStackMathSourceLooksLikeUiValue(bottomSource)
    )) return null;
    if (fraction && !explicitFractionSemantics && (
      (topAnalysis.numericOnly && bottomAnalysis.numericOnly) ||
      topAnalysis.proseLikeWord || bottomAnalysis.proseLikeWord ||
      (topAnalysis.spacedTokens && !topAnalysis.functionExpression) ||
      (bottomAnalysis.spacedTokens && !bottomAnalysis.functionExpression)
    )) return null;
    const operatorKey = topSource.normalize ? topSource.normalize('NFKC').replace(/\s+/g, '').toLowerCase() :
      topSource.replace(/\s+/g, '').toLowerCase();
    const operator = CSS_STACK_MATH_OPERATORS.get(operatorKey);
    if (!fraction && !operator) return null;

    const visualRect = cssStackMathUnionRect(topRect, bottomRect);
    if (!visualRect || !cssStackMathClippingAncestorsExpose(element, visualRect, view)) return null;

    return {
      root: element,
      rows,
      kind: fraction ? 'fraction' : 'operator-under',
      source: fraction
        ? '\\frac{' + topSource + '}{' + bottomSource + '}'
        : operator + '_{' + bottomSource + '}',
      topSource,
      bottomSource,
      linearSource,
      ruleElement,
      layoutDepth: stackShape.wrappers.length,
      operator: operator || '',
      explicitSemantics,
      nestedBoundedOperator: fraction && /\\(?:lim|sum|prod|int)_\{/u.test(linearSource),
      visualRect
    };
  }

  function cssStackMathCandidateShape(element) {
    if (!element || element.nodeType !== 1 || !cssStackMathElementTagIsSafe(element, true)) return false;
    const stackShape = cssStackMathStackParts(element);
    if (stackShape.overBudget) return false;
    const parts = stackShape.parts;
    if (![2, 3].includes(parts.length)) return false;
    const directNodes = cssStackMathBoundedDirectNodes(element);
    if (!directNodes) return false;
    for (const child of directNodes) {
      if (child.nodeType === 3 && cleanOrdinaryCharacters(child.nodeValue || '').trim()) return false;
      if (![1, 3, 8].includes(child.nodeType)) return false;
    }
    if (parts.length === 3 && parts.filter((part) =>
      !cleanOrdinaryCharacters(part.textContent || '').trim()).length !== 1) return false;
    return true;
  }

  function cssStackMathPlausibleVisualRoot(element, documentObject, allowUnruledNestedStack = false) {
    if (!element || !documentObject || !cssStackMathCandidateShape(element)) return false;
    const parts = cssStackMathStackParts(element).parts;
    const emptyParts = parts.filter((part) => !cleanOrdinaryCharacters(part.textContent || '').trim());
    const ruleElement = parts.length === 3 && emptyParts.length === 1 ? emptyParts[0] : null;
    if (parts.length === 3 && !ruleElement) return false;
    const rows = ruleElement ? parts.filter((part) => part !== ruleElement) : parts;
    const view = documentObject.defaultView;
    if (!view || typeof view.getComputedStyle !== 'function') return false;
    try {
      const rowComputed = rows.map((row) => view.getComputedStyle(row));
      const entries = rows.map((row, index) => ({
        row,
        computed: rowComputed[index],
        rect: cssStackMathPositiveRect(row)
      })).sort((left, right) => left.rect && right.rect
        ? (left.rect.top + left.rect.height / 2) - (right.rect.top + right.rect.height / 2)
        : 0);
      const topRect = entries[0].rect;
      const bottomRect = entries[1].rect;
      if (!topRect || !bottomRect) return false;
      const topText = cleanOrdinaryCharacters(entries[0].row.textContent || '')
        .replace(/\s+/g, '').toLowerCase();
      const ruleComputed = ruleElement ? view.getComputedStyle(ruleElement) : null;
      const ruleRect = ruleElement ? cssStackMathPositiveRect(ruleElement) : null;
      const fractionRule = cssStackMathBorderIsFractionRule(entries[0].computed, 'bottom') ||
        cssStackMathBorderIsFractionRule(entries[1].computed, 'top') ||
        (ruleElement && cssStackMathDedicatedRule(ruleElement, ruleComputed, ruleRect, topRect, bottomRect));
      if (!fractionRule && !CSS_STACK_MATH_OPERATORS.has(topText) && !allowUnruledNestedStack) return false;
      const horizontalOverlap = Math.min(topRect.right, bottomRect.right) - Math.max(topRect.left, bottomRect.left);
      return horizontalOverlap > 0 && bottomRect.top >= topRect.bottom - 1.5;
    } catch (_error) {
      return false;
    }
  }

  function cssStackMathSelectedDescriptorSource(descriptor, range, nestedDepth = 0, contextInput) {
    if (!descriptor || !range || nestedDepth > MAX_MATHML_DEPTH) {
      return CSS_STACK_MATH_DOM_UNREPRESENTABLE;
    }
    const descriptorContext = contextInput || createCssStackMathDescriptorContext();
    const selectedTopSource = cssStackMathDomSource(
      descriptor.rows[0],
      range,
      nestedDepth,
      descriptorContext
    );
    const selectedBottomSource = cssStackMathDomSource(
      descriptor.rows[1],
      range,
      nestedDepth,
      descriptorContext
    );
    if (selectedTopSource === CSS_STACK_MATH_DOM_UNREPRESENTABLE ||
        selectedBottomSource === CSS_STACK_MATH_DOM_UNREPRESENTABLE) {
      return CSS_STACK_MATH_DOM_UNREPRESENTABLE;
    }
    const selectedSource = selectedTopSource + selectedBottomSource;
    if (!selectedSource) return {
      selectedSource: '', selectedTopSource: '', selectedBottomSource: '', selectedSemanticSource: ''
    };
    const crossRowSelection = Boolean(selectedTopSource && selectedBottomSource);
    for (const selectedPart of [selectedTopSource, selectedBottomSource]) {
      if (!selectedPart) continue;
      const unicodeScriptCharacters = new Set([
        ...Object.values(SUPERSCRIPTS), ...Object.values(SUBSCRIPTS),
        'ₔ', 'ᵦ', 'ᵧ', 'ᵨ', 'ᵩ', 'ᵪ'
      ]);
      const isolatedScript = !crossRowSelection && (
        /^[\^_]\{[^{}]+\}$/u.test(selectedPart) ||
        (Array.from(selectedPart).length > 0 &&
          Array.from(selectedPart).every((character) => unicodeScriptCharacters.has(character)))
      );
      if (!cssStackMathSourceDelimitersBalanced(selectedPart) ||
          (!isolatedScript && (!cssStackMathSourceHasCompleteOperands(selectedPart) ||
            cssStackMathHasDanglingScript(cssStackMathUnicodeScriptsToLatex(selectedPart))))) {
        return CSS_STACK_MATH_DOM_UNREPRESENTABLE;
      }
    }
    let selectedSemanticSource = '';
    if (selectedTopSource && selectedBottomSource) {
      if (descriptor.kind === 'fraction') {
        selectedSemanticSource = '\\frac{' + selectedTopSource + '}{' + selectedBottomSource + '}';
      } else if (selectedTopSource === descriptor.topSource) {
        selectedSemanticSource = descriptor.operator + '_{' + selectedBottomSource + '}';
      }
    } else if (selectedTopSource) {
      selectedSemanticSource = descriptor.kind === 'operator-under' &&
        selectedTopSource === descriptor.topSource
        ? descriptor.operator
        : selectedTopSource;
    } else selectedSemanticSource = selectedBottomSource;
    if (!selectedSemanticSource) return CSS_STACK_MATH_DOM_UNREPRESENTABLE;
    return { selectedSource, selectedTopSource, selectedBottomSource, selectedSemanticSource };
  }

  function cssStackMathDiscoveryForRange(range, documentObject) {
    if (!range || !documentObject || !range.commonAncestorContainer) {
      return { values: [], overBudget: false };
    }
    const common = rangeTraversalRoot(range);
    if (!common) return { values: [], overBudget: false };
    const candidates = new Set();
    const stack = [];
    if (common.nodeType === 1) stack.push({ element: common, depth: 0 });
    else {
      for (let child = common.lastElementChild; child; child = child.previousElementSibling) {
        stack.push({ element: child, depth: 0 });
      }
    }
    let inspected = 0;
    while (stack.length) {
      const current = stack.pop();
      const element = current && current.element;
      if (!current || current.depth > MAX_RICH_SELECTION_DEPTH) continue;
      if (!element || element.nodeType !== 1 || !rangeIntersects(range, element)) continue;
      inspected += 1;
      if (inspected > MAX_POSITIONED_DISCOVERY_NODES) {
        return { values: [], overBudget: candidates.size > 0 };
      }
      if (cssStackMathCandidateShape(element)) candidates.add(element);
      for (let child = element.lastElementChild; child; child = child.previousElementSibling) {
        stack.push({ element: child, depth: current.depth + 1 });
      }
    }
    for (const endpoint of [range.startContainer, range.endContainer]) {
      let element = endpoint && endpoint.nodeType === 1 ? endpoint : endpoint && endpoint.parentElement;
      let depth = 0;
      while (element && depth <= MAX_RICH_SELECTION_DEPTH) {
        if (cssStackMathCandidateShape(element)) candidates.add(element);
        element = element.parentElement;
        depth += 1;
      }
    }
    if (candidates.size > MAX_CSS_STACK_MATH_ROOTS) return { values: [], overBudget: true };
    const descriptorContext = createCssStackMathDescriptorContext();
    const descriptors = new Map();
    const rejectedVisualStacks = [];
    for (const candidate of candidates) {
      const descriptor = cssStackMathRootDescriptor(candidate, documentObject, 0, descriptorContext);
      if (!descriptor) {
        if (cssStackMathPlausibleVisualRoot(candidate, documentObject)) rejectedVisualStacks.push(candidate);
        continue;
      }
      const selected = cssStackMathSelectedDescriptorSource(descriptor, range, 0, descriptorContext);
      if (selected === CSS_STACK_MATH_DOM_UNREPRESENTABLE) {
        return { values: [], overBudget: false, failed: true };
      }
      const { selectedSource, selectedTopSource, selectedBottomSource, selectedSemanticSource } = selected;
      if (!selectedSource) continue;
      const value = {
        ...descriptor,
        aliases: [candidate],
        selectedSource,
        selectedTopSource,
        selectedBottomSource,
        selectedSemanticSource
      };
      const duplicate = Array.from(descriptors.entries()).find(([, existing]) =>
        existing.rows[0] === descriptor.rows[0] && existing.rows[1] === descriptor.rows[1]);
      if (duplicate) {
        // Keep the innermost element that actually owns the rows as the
        // replacement root, but remember every independently authenticated
        // wrapper as a layout alias. Replacing a semantic wrapper such as a
        // table cell would create invalid rich HTML; merely exempting its
        // already-audited layout preserves that surrounding structure.
        if ((duplicate[1].layoutDepth || 0) <= (descriptor.layoutDepth || 0)) {
          duplicate[1].aliases.push(candidate);
          continue;
        }
        value.aliases.push(...(duplicate[1].aliases || [duplicate[0]]));
        descriptors.delete(duplicate[0]);
      }
      descriptors.set(candidate, value);
    }
    const rejectedIsAuthenticatedAlias = (candidate) => {
      const parts = cssStackMathStackParts(candidate).parts;
      const emptyParts = parts.filter((part) => !cleanOrdinaryCharacters(part.textContent || '').trim());
      const ruleElement = parts.length === 3 && emptyParts.length === 1 ? emptyParts[0] : null;
      const rows = ruleElement ? parts.filter((part) => part !== ruleElement) : parts;
      return rows.length === 2 && Array.from(descriptors.values()).some((descriptor) =>
        descriptor.rows.length === 2 && rows.every((row) => descriptor.rows.includes(row)));
    };
    if (rejectedVisualStacks.some((candidate) => !rejectedIsAuthenticatedAlias(candidate))) {
      return { values: [], overBudget: false, failed: true };
    }
    const roots = sortMathRoots(Array.from(descriptors.keys()));
    return { values: roots.map((root) => descriptors.get(root)), overBudget: false };
  }

  function cssStackMathSelectsWholeVisibleRoot(range, descriptor) {
    if (!range || !descriptor) return false;
    return descriptor.selectedTopSource === descriptor.topSource &&
      descriptor.selectedBottomSource === descriptor.bottomSource;
  }

  function cssStackMathRootsAreAdjacent(left, right) {
    if (!left || !right || !left.compareDocumentPosition ||
        !(left.compareDocumentPosition(right) & 4)) return false;
    const documentObject = left.ownerDocument;
    if (!documentObject || documentObject !== right.ownerDocument || !documentObject.createRange) return false;
    try {
      const between = documentObject.createRange();
      between.setStartAfter(left);
      between.setEndBefore(right);
      if (cleanOrdinaryCharacters(between.toString()).trim()) return false;
      const fragment = between.cloneContents();
      for (const element of Array.from(fragment.querySelectorAll ? fragment.querySelectorAll('*') : [])) {
        const tag = (element.localName || '').toLowerCase();
        if (tag === 'wbr') continue;
        if (!cssStackMathElementTagIsSafe(element, true) ||
            element.matches('a,button,input,select,textarea,details,summary,[contenteditable],br,hr')) return false;
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  function cssStackMathRootsShareVisualLine(left, right) {
    const leftRect = left && left.visualRect;
    const rightRect = right && right.visualRect;
    if (!leftRect || !rightRect) return false;
    const verticalOverlap = Math.min(leftRect.bottom, rightRect.bottom) -
      Math.max(leftRect.top, rightRect.top);
    const minimumHeight = Math.min(leftRect.height, rightRect.height);
    const leftCenter = leftRect.left + leftRect.width / 2;
    const rightCenter = rightRect.left + rightRect.width / 2;
    const maximumGap = Math.max(16, Math.min(leftRect.height, rightRect.height) * 1.5);
    const overlapTolerance = Math.min(4, Math.min(leftRect.height, rightRect.height) * 0.1);
    return verticalOverlap >= minimumHeight * 0.5 && rightCenter > leftCenter &&
      rightRect.left >= leftRect.right - overlapTolerance &&
      rightRect.left - leftRect.right <= maximumGap;
  }

  function cssStackMathUnicodeScriptsToLatex(source) {
    const superscriptReverse = new Map();
    const subscriptReverse = new Map();
    for (const [plain, script] of Object.entries(SUPERSCRIPTS)) {
      superscriptReverse.set(script, plain === '−' ? '-' : plain);
    }
    for (const [plain, script] of Object.entries(SUBSCRIPTS)) {
      subscriptReverse.set(script, plain === '−' ? '-' : plain);
    }
    const scriptToken = (value) => ({
      beta: '\\beta', gamma: '\\gamma', rho: '\\rho', phi: '\\phi', chi: '\\chi', schwa: 'ə'
    })[value] || value;
    const characters = Array.from(String(source || ''));
    let output = '';
    for (let index = 0; index < characters.length;) {
      const character = characters[index];
      const map = superscriptReverse.has(character)
        ? superscriptReverse
        : (subscriptReverse.has(character) ? subscriptReverse : null);
      if (!map) {
        output += character;
        index += 1;
        continue;
      }
      const values = [];
      while (index < characters.length && map.has(characters[index])) {
        values.push(scriptToken(map.get(characters[index])));
        index += 1;
      }
      output += (map === superscriptReverse ? '^{' : '_{') + values.join('') + '}';
    }
    return output;
  }

  function cssStackMathBalancedDelimiterEnd(source, start, opening, closing) {
    if (source[start] !== opening) return -1;
    let depth = 0;
    for (let index = start; index < source.length; index += 1) {
      if (source[index] === opening) depth += 1;
      else if (source[index] === closing) {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
    return -1;
  }

  function cssStackMathBarGroup(input, start, depth) {
    const singleBars = new Set(['|', '∣', '❘']);
    const normBars = new Set(['‖', '∥']);
    let width = 1;
    let kind = '';
    if (input.startsWith('||', start)) {
      width = 2;
      kind = 'norm';
    } else if (normBars.has(input[start])) kind = 'norm';
    else if (singleBars.has(input[start])) kind = 'absolute';
    else return null;
    let close = -1;
    if (width === 2) close = input.indexOf('||', start + 2);
    else {
      const candidates = kind === 'norm' ? normBars : singleBars;
      for (let index = start + 1; index < input.length; index += 1) {
        if (candidates.has(input[index])) {
          close = index;
          break;
        }
      }
    }
    if (close <= start + width) return null;
    const inner = cssStackMathUnicodeRadicalsToLatex(input.slice(start + width, close), depth + 1);
    if (!inner) return null;
    return {
      latex: kind === 'norm' ? '\\lVert ' + inner + '\\rVert ' : '|' + inner + '|',
      end: close + width
    };
  }

  function cssStackMathBraceGroupEnd(source, start) {
    if (source[start] !== '{') return -1;
    let depth = 0;
    for (let index = start; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      else if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
    return -1;
  }

  function cssStackMathConsumeUnicodeRadical(input, index, depth) {
    if (depth > 32 || !['√', '∛', '∜'].includes(input[index])) return null;
    const root = input[index];
    let operandStart = index + 1;
    while (operandStart < input.length && /\s/u.test(input[operandStart])) operandStart += 1;
    if (operandStart >= input.length) return null;
    let operand = '';
    let end = operandStart;
    if (input[operandStart] === '(') {
      const close = cssStackMathBalancedDelimiterEnd(input, operandStart, '(', ')');
      if (close < 0) return null;
      operand = cssStackMathUnicodeRadicalsToLatex(input.slice(operandStart + 1, close), depth + 1);
      end = close + 1;
    } else if (input[operandStart] === '[') {
      const close = cssStackMathBalancedDelimiterEnd(input, operandStart, '[', ']');
      if (close < 0) return null;
      const inner = cssStackMathUnicodeRadicalsToLatex(input.slice(operandStart + 1, close), depth + 1);
      if (!inner) return null;
      // Square brackets are visual grouping here, not an optional root index.
      // TeX braces already preserve the scope; omitting the outer brackets
      // keeps calculator output executable and faithful text unambiguous.
      operand = inner;
      end = close + 1;
    } else if (input[operandStart] === CSS_STACK_VISIBLE_SPECIALS['{']) {
      const opening = CSS_STACK_VISIBLE_SPECIALS['{'];
      const closing = CSS_STACK_VISIBLE_SPECIALS['}'];
      const close = cssStackMathBalancedDelimiterEnd(input, operandStart, opening, closing);
      if (close < 0) return null;
      operand = cssStackMathUnicodeRadicalsToLatex(input.slice(operandStart + 1, close), depth + 1);
      end = close + 1;
    } else if ('|∣❘‖∥'.includes(input[operandStart])) {
      const group = cssStackMathBarGroup(input, operandStart, depth);
      if (!group) return null;
      operand = group.latex;
      end = group.end;
    } else if (['√', '∛', '∜'].includes(input[operandStart])) {
      const nested = cssStackMathConsumeUnicodeRadical(input, operandStart, depth + 1);
      if (!nested) return null;
      operand = nested.latex;
      end = nested.end;
    } else {
      const functionCall = input.slice(operandStart).match(
        /^(det|dim|sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|log|ln|exp|max|min)\s*(?=\()/u
      );
      if (functionCall) {
        const opening = operandStart + functionCall[0].length;
        const close = cssStackMathBalancedDelimiterEnd(input, opening, '(', ')');
        if (close < 0) return null;
        const inner = cssStackMathUnicodeRadicalsToLatex(input.slice(opening + 1, close), depth + 1);
        if (!inner) return null;
        operand = '\\' + functionCall[1] + ' (' + inner + ')';
        end = close + 1;
      } else {
        const numeric = input.slice(operandStart).match(/^(?:\d+(?:\.\d*)?|\.\d+)/u);
        if (numeric) {
        operand = numeric[0];
        end = operandStart + numeric[0].length;
        } else {
          const atom = Array.from(input.slice(operandStart))[0] || '';
          // Raw braces delimit trusted structure synthesized by this parser;
          // visible braces were encoded before reaching this point. A lone
          // radical at the end of a fraction row must not consume that closing
          // brace and turn into an invented empty radicand.
          if (!atom || /[+\-−=,;:)\]}]/u.test(atom)) return null;
          operand = atom;
          end = operandStart + atom.length;
        }
      }
      while (/^[\^_]\{/u.test(input.slice(end))) {
        const close = cssStackMathBraceGroupEnd(input, end + 1);
        if (close < 0) return null;
        operand += input.slice(end, close + 1);
        end = close + 1;
      }
    }
    if (!operand) return null;
    const command = root === '√' ? '\\sqrt' : (root === '∛' ? '\\sqrt[3]' : '\\sqrt[4]');
    return { latex: command + '{' + operand + '}', end };
  }

  function cssStackMathUnicodeRadicalsToLatex(source, depth = 0) {
    if (depth > 32) return '';
    const input = String(source || '');
    let output = '';
    for (let index = 0; index < input.length;) {
      const root = input[index];
      if (!['√', '∛', '∜'].includes(root)) {
        output += root;
        index += 1;
        continue;
      }
      const consumed = cssStackMathConsumeUnicodeRadical(input, index, depth);
      if (!consumed) return '';
      output += consumed.latex;
      index = consumed.end;
    }
    return output;
  }

  function cssStackMathVariantDescription(character) {
    if (!hasMathematicalStyledCharacter(character)) return null;
    const base = mathVariantBaseCharacter(character);
    for (const [variant, spec] of Object.entries(MATH_VARIANT_SPECS)) {
      if (mathematicalVariantCharacter(base, variant, spec) === character) return { base, variant };
    }
    return null;
  }

  function cssStackMathVariantLatex(character, outputMode) {
    const description = cssStackMathVariantDescription(character);
    if (!description) return null;
    if (outputMode === 'faithful') return character;
    const base = description.base;
    const baseLatex = String(PDF_LATEX_CHARACTERS[base] || base).trimEnd();
    if (outputMode === 'calculator') return baseLatex;
    const greek = /^[α-ωΑ-Ωϵϑϰϕϱϖ∂∇]$/u.test(base);
    const wrap = (command, value) => '\\' + command + '{' + value + '}';
    switch (description.variant) {
      case 'bold': return wrap(greek ? 'boldsymbol' : 'mathbf', baseLatex);
      case 'italic': return greek ? baseLatex : wrap('mathit', baseLatex);
      case 'bold-italic': return wrap('boldsymbol', baseLatex);
      case 'script': return wrap('mathcal', baseLatex);
      case 'bold-script': return wrap('mathbf', wrap('mathcal', baseLatex));
      case 'fraktur': return wrap('mathfrak', baseLatex);
      case 'bold-fraktur': return wrap('mathbf', wrap('mathfrak', baseLatex));
      case 'double-struck': return wrap('mathbb', baseLatex);
      case 'sans-serif': return wrap('mathsf', baseLatex);
      case 'bold-sans-serif': return wrap('mathbf', wrap('mathsf', baseLatex));
      case 'sans-serif-italic': return wrap('mathit', wrap('mathsf', baseLatex));
      case 'sans-serif-bold-italic': return wrap('boldsymbol', wrap('mathsf', baseLatex));
      case 'monospace': return wrap('mathtt', baseLatex);
      default: return baseLatex;
    }
  }

  function cssStackMathCombiningAccentsToLatex(source, outputMode) {
    if (outputMode === 'faithful') return String(source || '');
    let value = String(source || '');
    try { value = value.normalize('NFD'); } catch (_error) {}
    const accentCommands = Object.freeze({
      '\u0300': 'grave', '\u0301': 'acute', '\u0302': 'hat', '\u0303': 'tilde',
      '\u0305': 'bar', '\u0306': 'breve', '\u0307': 'dot', '\u0308': 'ddot',
      '\u030a': 'mathring', '\u030c': 'check', '\u20d6': 'overleftarrow', '\u20d7': 'vec'
    });
    const accentPattern = /([\p{L}\p{N}∞∂∇ℏℓ])([\u0300\u0301\u0302\u0303\u0305\u0306\u0307\u0308\u030a\u030c\u20d6\u20d7]+)/gu;
    if (outputMode === 'calculator' && accentPattern.test(value)) return '';
    accentPattern.lastIndex = 0;
    value = value.replace(accentPattern, (_match, base, marks) => {
      let result = base;
      for (const mark of marks) {
        const command = accentCommands[mark];
        if (!command) return '';
        result = '\\' + command + '{' + result + '}';
      }
      return result;
    });
    return /\p{M}/u.test(value)
      ? ''
      : value;
  }

  function cssStackMathCanonicalLatex(source, outputMode) {
    const scripted = cssStackMathUnicodeScriptsToLatex(source);
    const rooted = cssStackMathUnicodeRadicalsToLatex(scripted);
    if (!rooted) return '';
    const accented = cssStackMathCombiningAccentsToLatex(rooted, outputMode);
    if (!accented) return '';
    if (outputMode === 'calculator' && /[\ue200-\ue204\ue206]/u.test(accented)) return '';
    if (outputMode !== 'faithful' && cssStackMathHasDanglingScript(accented)) return '';
    const functional = accented.replace(
      /(det|dim|sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|log|ln|exp|max|min)(?![A-Za-z])/gu,
      (match, _name, offset, value) => offset > 0 && /[A-Za-z\\]/u.test(value[offset - 1])
        ? match
        : '\\' + match + ' '
    );
    let output = '';
    for (const character of functional) {
      const variant = cssStackMathVariantLatex(character, outputMode);
      if (variant != null) output += variant;
      else if (CSS_STACK_VISIBLE_SPECIAL_LATEX[character]) output += CSS_STACK_VISIBLE_SPECIAL_LATEX[character];
      else if (character === '~') output += '\\sim ';
      else output += PDF_LATEX_CHARACTERS[character] || character;
    }
    return output.replace(/[ \t\n\r]+/g, ' ').trim();
  }

  function cssStackMathHasDanglingScript(input) {
    const source = String(input || '');
    for (let index = 0; index < source.length - 1; index += 1) {
      if (!['^', '_'].includes(source[index]) || source[index + 1] !== '{') continue;
      let previousEnd = index;
      while (previousEnd > 0 && /\s/u.test(source[previousEnd - 1])) previousEnd -= 1;
      const previousCharacter = Array.from(source.slice(0, previousEnd)).pop() || '';
      const previousStart = previousEnd - previousCharacter.length;
      if (!previousCharacter || !/[\p{L}\p{N}\p{M})\]}|∣❘‖∥⟩⌉⌋∞∂∇ℏℓ′″‴⁗!%]/u.test(previousCharacter)) {
        return true;
      }
      if (/^[A-Za-z]$/u.test(previousCharacter)) {
        let commandStart = previousStart;
        while (commandStart > 0 && /[A-Za-z]/u.test(source[commandStart - 1])) commandStart -= 1;
        if (commandStart > 0 && source[commandStart - 1] === '\\') {
          const command = source.slice(commandStart, previousEnd);
          if (!CSS_STACK_MATH_OPERATOR_COMMANDS.has(command)) return true;
        }
      }
    }
    return false;
  }

  function cssStackMathSourceText(source, outputMode, options) {
    if (!source || source.length > MAX_CSS_STACK_MATH_CHARACTERS) return '';
    const latex = cssStackMathCanonicalLatex(source, outputMode);
    if (!latex) return '';
    if (outputMode === 'latex') return '$' + latex + '$';
    if (outputMode === 'calculator') {
      // A lower limit without a selected body is not a complete calculator
      // expression. Native copy preserves the visible bound instead of
      // silently reducing `lim_(x→1)` to the unrelated identifier `lim`.
      if (options && options.incompleteBoundedOperator) return '';
      if (options && options.nestedBoundedOperator) return '';
      return latexToCalculator(latex, {
        preserveLongIdentifiers: Boolean(options && options.preserveLongIdentifiers)
      });
    }
    return latexToFaithful(latex);
  }

  function cssStackMathIgnoredFollowingNode(node, range) {
    if (!node || node.nodeType === 8) return true;
    if (node.nodeType === 1 && (node.localName || '').toLowerCase() === 'wbr') return true;
    return node.nodeType === 3 && !cssStackMathTextSlice(node, range).trim();
  }

  function cssStackMathMeaningfulWrapperChildren(element, range) {
    const meaningful = [];
    let inspected = 0;
    for (let child = element && element.firstChild; child; child = child.nextSibling) {
      inspected += 1;
      if (inspected > MAX_CSS_STACK_MATH_NODES) return [null, null];
      if (cssStackMathIgnoredFollowingNode(child, range)) continue;
      meaningful.push(child);
      if (meaningful.length > 1) break;
    }
    return meaningful;
  }

  function cssStackMathTransparentWrapper(element, range) {
    if (!element || element.nodeType !== 1 || !cssStackMathElementTagIsSafe(element, true) ||
        ['sub', 'sup'].includes((element.localName || '').toLowerCase()) ||
        element.matches('a,button,input,select,textarea,details,summary,[contenteditable],br,hr') ||
        isVisuallyHiddenElement(element) ||
        cssStackMathMeaningfulWrapperChildren(element, range).length !== 1) return false;
    try {
      const view = element.ownerDocument && element.ownerDocument.defaultView;
      const computed = view && view.getComputedStyle && view.getComputedStyle(element);
      const display = String(computed && computed.display || '').trim().toLowerCase();
      return !display || ['inline', 'inline-block', 'contents'].includes(display);
    } catch (_error) {
      return false;
    }
  }

  function cssStackMathFollowingLeaf(anchor, range) {
    let current = anchor;
    const boundary = range && range.commonAncestorContainer;
    for (let depth = 0; current && depth < 16; depth += 1) {
      const separators = [];
      let candidate = current.nextSibling;
      while (candidate && cssStackMathIgnoredFollowingNode(candidate, range)) {
        separators.push(candidate);
        candidate = candidate.nextSibling;
      }
      if (candidate) {
        const wrappers = [];
        let leaf = candidate;
        while (leaf && leaf.nodeType === 1 && cssStackMathTransparentWrapper(leaf, range)) {
          wrappers.push(leaf);
          leaf = cssStackMathMeaningfulWrapperChildren(leaf, range)[0] || null;
        }
        if (!leaf || (range && !rangeIntersects(range, leaf))) return null;
        const consumed = wrappers.length ? wrappers[0] : leaf;
        return {
          leaf,
          resume: consumed,
          nodes: [...separators, consumed]
        };
      }
      const parent = current.parentNode;
      if (!parent || parent === boundary || parent.nodeType !== 1 ||
          !cssStackMathTransparentWrapper(parent, range)) return null;
      current = parent;
    }
    return null;
  }

  function cssStackMathSelectedFollowingScripts(root, range) {
    const nodes = [];
    let source = '';
    const kinds = new Set();
    let anchor = root;
    while (anchor) {
      const following = cssStackMathFollowingLeaf(anchor, range);
      if (!following) break;
      const node = following.leaf;
      if (node.nodeType !== 1 || !['sup', 'sub'].includes((node.localName || '').toLowerCase())) break;
      const selected = cssStackMathDomSource(node, range);
      if (selected === CSS_STACK_MATH_DOM_UNREPRESENTABLE) {
        return { invalid: true, nodes: [], source: '' };
      }
      if (!selected) break;
      const full = cssStackMathDomSource(node);
      if (full === CSS_STACK_MATH_DOM_UNREPRESENTABLE) {
        return { invalid: true, nodes: [], source: '' };
      }
      if (!full || selected !== full) return { invalid: true, nodes: [], source: '' };
      const kind = (node.localName || '').toLowerCase();
      const wrapper = full.match(/^([\^_])\{([\s\S]*)\}$/u);
      const inner = wrapper && wrapper[2] || '';
      if (!wrapper || !inner || /[\[\]]/u.test(inner) ||
          !cssStackMathSourceDelimitersBalanced(inner) ||
          !cssStackMathSourceHasCompleteOperands(inner)) break;
      if (kinds.has(kind)) return { invalid: true, nodes: [], source: '' };
      kinds.add(kind);
      nodes.push(...following.nodes);
      source += full;
      anchor = following.resume;
    }
    return { invalid: false, nodes, source };
  }

  function cssStackMathSourceWithScripts(source, scripts) {
    return scripts && scripts.source ? '{' + source + '}' + scripts.source : source;
  }

  function cssStackMathSelectedFollowingProduct(anchor, range) {
    const following = cssStackMathFollowingLeaf(anchor, range);
    const node = following && following.leaf;
    if (!node || node.nodeType !== 3) return { invalid: false, node: null, nodes: [], source: '' };
    const selected = cssStackMathTextSlice(node, range);
    const trimmed = selected.trim();
    if (/^[*/×÷·⋅∗]\s*$/u.test(trimmed)) {
      return { invalid: true, node: null, nodes: [], source: '' };
    }
    const match = trimmed.match(/^([*/×÷·⋅∗])\s*(.+)$/u);
    if (!trimmed || /^[=<>≤≥≠≈≃≅≡∝→←↔⇒⇐⇔↦]/u.test(trimmed)) {
      return { invalid: false, node: null, nodes: [], source: '' };
    }
    const operand = match ? match[2].trim() : trimmed;
    const analysis = cssStackMathSourceAnalysis(operand);
    const longWords = Array.from(operand.matchAll(/\p{L}{3,}/gu), (item) => item[0]);
    const functionsOnly = longWords.length > 0 &&
      longWords.every((word) => CALCULATOR_FUNCTIONS.has(word.toLowerCase()));
    const valid = analysis.valid && analysis.signal && (!analysis.proseLikeWord || functionsOnly) &&
      (!analysis.spacedTokens || functionsOnly) &&
      cssStackMathPlainTailHasUnambiguousGrammar(operand) &&
      cssStackMathSourceDelimitersBalanced(operand) && cssStackMathSourceHasCompleteOperands(operand);
    if (!valid) return { invalid: Boolean(match), node: null, nodes: [], source: '' };
    const canonicalOperand = operand.replace(/^([A-Za-z]+)(?=\s*(?:\(|[\p{L}\p{N}√∛∜]))/u, (value, name) =>
      CALCULATOR_FUNCTIONS.has(name.toLowerCase()) ? '\\' + name.toLowerCase() + ' ' : value);
    return {
      invalid: false,
      node: following.resume,
      nodes: following.nodes,
      source: (match ? match[1] : '') + canonicalOperand
    };
  }

  function cssStackMathSelectedFollowingLimitBody(anchor, range) {
    const following = cssStackMathFollowingLeaf(anchor, range);
    const node = following && following.leaf;
    if (!node || node.nodeType !== 3) return { invalid: false, node: null, source: '' };
    const selected = cssStackMathTextSlice(node, range).trim();
    if (!selected || /^[=<>≤≥≠≈≃≅≡∝→←↔⇒⇐⇔↦∈∉⊂⊆⊃⊇]/u.test(selected)) {
      return { invalid: false, node: null, source: '' };
    }
    let depth = 0;
    let relationIndex = -1;
    for (let index = 0; index < selected.length; index += 1) {
      const character = selected[index];
      if (character === '(' || character === '[' || character === '{') depth += 1;
      else if (character === ')' || character === ']' || character === '}') depth = Math.max(0, depth - 1);
      else if (depth === 0 && /[=<>≤≥≠≈≃≅≡∝→←↔⇒⇐⇔↦∈∉⊂⊆⊃⊇]/u.test(character)) {
        relationIndex = index;
        break;
      }
    }
    const source = (relationIndex < 0 ? selected : selected.slice(0, relationIndex)).trim();
    const suffix = relationIndex < 0 ? '' : selected.slice(relationIndex).trim();
    if (suffix) {
      const right = suffix.replace(/^[=<>≤≥≠≈≃≅≡∝→←↔⇒⇐⇔↦∈∉⊂⊆⊃⊇]+\s*/u, '');
      const rightAnalysis = cssStackMathSourceAnalysis(right);
      if (!right || !cssStackMathSourceDelimitersBalanced(right) ||
          !cssStackMathSourceHasCompleteOperands(right) || !rightAnalysis.valid || !rightAnalysis.signal ||
          rightAnalysis.proseLikeWord || !cssStackMathPlainTailHasUnambiguousGrammar(right) ||
          (rightAnalysis.spacedTokens && !rightAnalysis.functionExpression)) {
        return { invalid: true, node: null, source: '' };
      }
    }
    const analysis = cssStackMathSourceAnalysis(source);
    const longWords = Array.from(source.matchAll(/\p{L}{3,}/gu), (match) => match[0]);
    const functionsOnly = longWords.length > 0 &&
      longWords.every((word) => CALCULATOR_FUNCTIONS.has(word.toLowerCase()));
    if (relationIndex < 0 && !cssStackMathPlainTailHasUnambiguousGrammar(source)) {
      return { invalid: false, node: null, source: '' };
    }
    const valid = analysis.valid && analysis.signal && (!analysis.proseLikeWord || functionsOnly) &&
      cssStackMathPlainTailHasUnambiguousGrammar(source) &&
      cssStackMathSourceDelimitersBalanced(source) && cssStackMathSourceHasCompleteOperands(source);
    if (!valid) return { invalid: true, node: null, source: '' };
    const canonicalSource = source.replace(/^([A-Za-z]+)(?=\s*(?:\(|[\p{L}\p{N}√∛∜]))/u, (match, name) =>
      CALCULATOR_FUNCTIONS.has(name.toLowerCase()) ? '\\' + name.toLowerCase() + ' ' : match);
    return {
      invalid: false,
      node: following.resume,
      nodes: following.nodes,
      source: canonicalSource,
      suffix: suffix ? ' ' + suffix : ''
    };
  }

  function cssStackMathReplacementMap(values, range, settings) {
    const replacements = new Map();
    const grouped = new Set();
    for (let index = 0; index + 1 < values.length; index += 1) {
      const left = values[index];
      const right = values[index + 1];
      if (left.kind !== 'operator-under' || right.kind !== 'fraction' ||
          !cssStackMathSelectsWholeVisibleRoot(range, left) ||
          !cssStackMathSelectsWholeVisibleRoot(range, right) ||
          !cssStackMathRootsAreAdjacent(left.root, right.root) ||
          !cssStackMathRootsShareVisualLine(left, right)) continue;
      const scripts = cssStackMathSelectedFollowingScripts(right.root, range);
      if (scripts.invalid) return null;
      const product = cssStackMathSelectedFollowingProduct(
        scripts.nodes[scripts.nodes.length - 1] || right.root,
        range
      );
      if (product.invalid) return null;
      const source = left.source + cssStackMathSourceWithScripts(right.source, scripts) + product.source;
      const text = cssStackMathSourceText(source, settings.outputMode, {
        preserveLongIdentifiers: Boolean(left.explicitSemantics || right.explicitSemantics),
        nestedBoundedOperator: Boolean(left.nestedBoundedOperator || right.nestedBoundedOperator)
      });
      if (!text) return null;
      const group = {
        primary: true,
        roots: [left.root, right.root, ...scripts.nodes, ...product.nodes],
        source,
        text,
        whole: true,
        outputMode: settings.outputMode
      };
      replacements.set(left.root, group);
      replacements.set(right.root, { primary: false, group });
      for (const node of scripts.nodes) replacements.set(node, { primary: false, group });
      for (const node of product.nodes) replacements.set(node, { primary: false, group });
      grouped.add(left.root);
      grouped.add(right.root);
      index += 1;
    }

    for (let index = 0; index < values.length;) {
      const first = values[index];
      if (grouped.has(first.root) || first.kind !== 'fraction' ||
          !cssStackMathSelectsWholeVisibleRoot(range, first)) {
        index += 1;
        continue;
      }
      const sequence = [first];
      let cursor = index + 1;
      while (cursor < values.length) {
        const previous = sequence[sequence.length - 1];
        const next = values[cursor];
        if (grouped.has(next.root) || next.kind !== 'fraction' ||
            !cssStackMathSelectsWholeVisibleRoot(range, next) ||
            !cssStackMathRootsAreAdjacent(previous.root, next.root) ||
            !cssStackMathRootsShareVisualLine(previous, next)) break;
        sequence.push(next);
        cursor += 1;
      }
      if (sequence.length < 2) {
        index += 1;
        continue;
      }
      const scripts = cssStackMathSelectedFollowingScripts(sequence[sequence.length - 1].root, range);
      if (scripts.invalid) return null;
      const product = cssStackMathSelectedFollowingProduct(
        scripts.nodes[scripts.nodes.length - 1] || sequence[sequence.length - 1].root,
        range
      );
      if (product.invalid) return null;
      const source = sequence.slice(0, -1).map((value) => value.source).join('') +
        cssStackMathSourceWithScripts(sequence[sequence.length - 1].source, scripts) + product.source;
      const text = cssStackMathSourceText(source, settings.outputMode, {
        preserveLongIdentifiers: sequence.some((value) => value.explicitSemantics),
        nestedBoundedOperator: sequence.some((value) => value.nestedBoundedOperator)
      });
      if (!text) return null;
      const roots = [
        ...sequence.map((value) => value.root),
        ...scripts.nodes,
        ...product.nodes
      ];
      const group = { primary: true, roots, source, text, whole: true, outputMode: settings.outputMode };
      replacements.set(sequence[0].root, group);
      for (const value of sequence.slice(1)) replacements.set(value.root, { primary: false, group });
      for (const node of scripts.nodes) replacements.set(node, { primary: false, group });
      for (const node of product.nodes) replacements.set(node, { primary: false, group });
      for (const value of sequence) grouped.add(value.root);
      index = cursor;
    }
    for (const value of values) {
      if (grouped.has(value.root)) continue;
      const whole = cssStackMathSelectsWholeVisibleRoot(range, value);
      const scripts = cssStackMathSelectedFollowingScripts(value.root, range);
      if (scripts.invalid || (!whole && scripts.nodes.length)) return null;
      const body = whole && value.kind === 'operator-under'
        ? cssStackMathSelectedFollowingLimitBody(scripts.nodes[scripts.nodes.length - 1] || value.root, range)
        : { invalid: false, node: null, source: '' };
      if (body.invalid) return null;
      const bodyNodes = body.nodes || (body.node ? [body.node] : []);
      const product = cssStackMathSelectedFollowingProduct(
        body.node || scripts.nodes[scripts.nodes.length - 1] || value.root,
        range
      );
      if (product.invalid || (!whole && product.nodes.length)) return null;
      const baseSource = cssStackMathSourceWithScripts(whole ? value.source : value.selectedSemanticSource, scripts);
      const source = body.node
        ? baseSource + '{' + body.source + '}' + (body.suffix || '') + product.source
        : baseSource + product.source;
      const text = cssStackMathSourceText(source, settings.outputMode, {
        preserveLongIdentifiers: Boolean(value.explicitSemantics),
        nestedBoundedOperator: Boolean(value.nestedBoundedOperator),
        incompleteBoundedOperator: value.kind === 'operator-under' &&
          Boolean(value.selectedTopSource && value.selectedBottomSource) && !body.node
      });
      if (!text) return null;
      replacements.set(value.root, {
        primary: true,
        roots: [
          value.root,
          ...scripts.nodes,
          ...bodyNodes,
          ...product.nodes
        ],
        source,
        text,
        whole,
        outputMode: settings.outputMode
      });
      const group = replacements.get(value.root);
      for (const node of scripts.nodes) replacements.set(node, { primary: false, group });
      for (const node of bodyNodes) replacements.set(node, { primary: false, group });
      for (const node of product.nodes) replacements.set(node, { primary: false, group });
    }
    return replacements;
  }

  function cssStackMathNeutralClone(element, documentObject) {
    const sourceTag = (element.localName || '').toLowerCase();
    const tag = ORDINARY_RICH_TAGS.has(sourceTag) || ['area', 'img'].includes(sourceTag)
      ? sourceTag
      : 'span';
    const clone = documentObject.createElement(tag);
    for (const name of ['start', 'value', 'type', 'dir', 'lang', 'alt', 'colspan', 'rowspan']) {
      if (element.hasAttribute && element.hasAttribute(name)) clone.setAttribute(name, element.getAttribute(name));
    }
    if (element.hasAttribute && element.hasAttribute('reversed')) clone.setAttribute('reversed', '');
    const sourceStyle = String(element.getAttribute && element.getAttribute('style') || '');
    const retained = [];
    const whitespace = sourceStyle.match(/(?:^|;)\s*white-space\s*:\s*([^;!]+)/i);
    const display = sourceStyle.match(/(?:^|;)\s*display\s*:\s*([^;!]+)/i);
    if (whitespace && /^(?:normal|nowrap|pre|pre-wrap|pre-line|break-spaces)$/i.test(whitespace[1].trim())) {
      retained.push('white-space:' + whitespace[1].trim().toLowerCase());
    }
    if (display && /^(?:block|flex|grid|list-item|table)$/i.test(display[1].trim())) {
      retained.push('display:' + display[1].trim().toLowerCase());
    }
    if (retained.length) clone.setAttribute('style', retained.join(';'));
    return clone;
  }

  function cssStackMathSelectionFragment(range, values, replacements, documentObject) {
    const containing = values.find((value) =>
      nodeInside(value.root, range.startContainer) && nodeInside(value.root, range.endContainer));
    if (containing) {
      const replacement = replacements.get(containing.root);
      const text = replacement && replacement.primary ? replacement.text : '';
      // A grouped replacement can only be primary when both roots are selected,
      // which cannot happen while both endpoints remain inside one root.
      if (!text) return null;
      const fragment = documentObject.createDocumentFragment();
      const placeholder = documentObject.createElement('span');
      TRUSTED_TEXT_PLACEHOLDERS.set(placeholder, {
        text,
        display: false,
        richSemantic: true,
        outputMode: replacement.outputMode
      });
      fragment.appendChild(placeholder);
      return fragment;
    }

    const emitted = new Set();
    const cloneSelected = (node) => {
      if (!node) return null;
      if (node.nodeType === 3) {
        const replacement = replacements.get(node);
        if (replacement) {
          if (!replacement.primary || emitted.has(replacement)) return null;
          emitted.add(replacement);
          const placeholder = documentObject.createElement('span');
          TRUSTED_TEXT_PLACEHOLDERS.set(placeholder, {
            text: replacement.text,
            display: false,
            richSemantic: true,
            outputMode: replacement.outputMode
          });
          return placeholder;
        }
        const text = cssStackMathTextSlice(node, range);
        return text ? documentObject.createTextNode(text) : null;
      }
      if (node.nodeType !== 1 && node.nodeType !== 11) return null;
      if (node.nodeType === 1) {
        const replacement = replacements.get(node);
        if (replacement) {
          if (!replacement.primary || emitted.has(replacement)) return null;
          emitted.add(replacement);
          const placeholder = documentObject.createElement('span');
          TRUSTED_TEXT_PLACEHOLDERS.set(placeholder, {
            text: replacement.text,
            display: false,
            richSemantic: true,
            outputMode: replacement.outputMode
          });
          return placeholder;
        }
        const tag = (node.localName || '').toLowerCase();
        if (ORDINARY_DROP_CONTENT_TAGS.has(tag) || SKIP_TAGS.has(tag) || isVisuallyHiddenElement(node)) return null;
      }
      const clone = node.nodeType === 11
        ? documentObject.createDocumentFragment()
        : cssStackMathNeutralClone(node, documentObject);
      Array.from(node.childNodes || []).forEach((child, index) => {
        if (!cssStackMathChildIsSelected(range, node, child, index)) return;
        const selected = cloneSelected(child);
        if (selected) clone.appendChild(selected);
      });
      return clone;
    };

    const common = range.commonAncestorContainer;
    const selected = cloneSelected(common);
    if (!selected) return null;
    const fragment = documentObject.createDocumentFragment();
    const commonTag = common && common.nodeType === 1 ? (common.localName || '').toLowerCase() : '';
    let outer = selected;
    if (commonTag === 'tr') {
      const table = documentObject.createElement('table');
      const body = documentObject.createElement('tbody');
      body.appendChild(selected);
      table.appendChild(body);
      outer = table;
    } else if (['thead', 'tbody', 'tfoot', 'caption', 'colgroup'].includes(commonTag)) {
      const table = documentObject.createElement('table');
      table.appendChild(selected);
      outer = table;
    } else if (commonTag === 'td' || commonTag === 'th') {
      const table = documentObject.createElement('table');
      const body = documentObject.createElement('tbody');
      const row = documentObject.createElement('tr');
      row.appendChild(selected);
      body.appendChild(row);
      table.appendChild(body);
      outer = table;
    }
    fragment.appendChild(outer);
    return fragment;
  }

  function cssStackMathSelectionPayload(ranges, settings, documentObject, selection, target, pageWindow) {
    if (!ranges || !ranges.length || !documentObject || isTextControl(target) ||
        isContentEditableSelection(documentObject, target, selection) ||
        isRawLatexProtected(target, selection, true, ranges)) return null;
    const discoveries = [];
    let totalRoots = 0;
    for (const range of ranges) {
      const discovery = cssStackMathDiscoveryForRange(range, documentObject);
      if (discovery.overBudget || discovery.failed) return CSS_STACK_MATH_UNREPRESENTABLE;
      totalRoots += discovery.values.length;
      if (totalRoots > MAX_CSS_STACK_MATH_ROOTS) return null;
      discoveries.push(discovery);
    }
    if (!totalRoots) return null;

    const texts = [];
    const richFragments = [];
    for (let index = 0; index < ranges.length; index += 1) {
      const range = ranges[index];
      const values = discoveries[index].values;
      if (!values.length) {
        const fragment = cloneOrdinaryRangeWithContext(range, documentObject);
        if (!fragment) return CSS_STACK_MATH_UNREPRESENTABLE;
        texts.push(serializeOrdinaryFragment(fragment).text);
        richFragments.push(fragment);
        continue;
      }
      const replaceableRoots = new Set(values.flatMap((value) => value.aliases || [value.root]));
      const whollyInsideAuthenticatedRoot = values.some((value) =>
        nodeInside(value.root, range.startContainer) && nodeInside(value.root, range.endContainer));
      if (!whollyInsideAuthenticatedRoot &&
          ordinaryComputedLayoutRisk(range, documentObject, replaceableRoots)) {
        return CSS_STACK_MATH_UNREPRESENTABLE;
      }
      const replacements = cssStackMathReplacementMap(values, range, settings);
      if (!replacements) return CSS_STACK_MATH_UNREPRESENTABLE;
      const fragment = cssStackMathSelectionFragment(range, values, replacements, documentObject);
      if (!fragment) return CSS_STACK_MATH_UNREPRESENTABLE;
      texts.push(serializeOrdinaryFragment(fragment).text);
      richFragments.push(fragment);
    }
    // The ordinary serializer already collapses normal whitespace while
    // preserving authored `pre`/`pre-wrap` islands exactly. A global trim
    // here would erase meaningful spaces adjacent to a rewritten formula.
    const text = texts.join('\n');
    if (!text.trim()) return CSS_STACK_MATH_UNREPRESENTABLE;
    return {
      text,
      html: safeOrdinaryRichHTML(richFragments, documentObject),
      mathML: '',
      reason: 'css-stacked-math',
      mathRanges: totalRoots
    };
  }

  function ordinarySelectedLayoutItems(element, range) {
    const items = [];
    let index = 0;
    for (let child = element && element.firstChild; child; child = child.nextSibling, index += 1) {
      if (!cssStackMathChildIsSelected(range, element, child, index)) continue;
      if (child.nodeType === 3) {
        if (cssStackMathTextSlice(child, range).trim()) items.push(child);
        continue;
      }
      if (child.nodeType !== 1) continue;
      const tag = (child.localName || '').toLowerCase();
      if (tag === 'wbr' || ORDINARY_DROP_CONTENT_TAGS.has(tag) || SKIP_TAGS.has(tag) ||
          isVisuallyHiddenElement(child)) continue;
      items.push(child);
    }
    return items;
  }

  function ordinaryLayoutItemHasBlockModel(item, replaceableMathRoots) {
    if (!item || item.nodeType !== 1) return false;
    if (replaceableMathRoots && replaceableMathRoots.has(item) && isDisplayMath(item)) return true;
    const tag = (item.localName || '').toLowerCase();
    if (BLOCK_TAGS.has(tag) || ['li', 'table', 'tr', 'td', 'th', 'ul', 'ol'].includes(tag)) return true;
    return /display\s*:\s*(?:block|flex|grid|list-item|table)/i.test(
      String(item.getAttribute && item.getAttribute('style') || '')
    );
  }

  function ordinaryFlexGridLayoutIsSerializable(element, range, view, computed, display, replaceableMathRoots) {
    // Flex/grid wrappers were previously rejected before pseudo-elements
    // mattered. Keep that protection when accepting a provably ordered
    // wrapper: generated visible text is not present in a cloned Range and
    // therefore cannot be reconstructed faithfully.
    if (!cssStackMathGeneratedContentIsSafe(element, view)) return false;
    const items = ordinarySelectedLayoutItems(element, range);
    // With zero or one selected content item, flex/grid placement cannot alter
    // text order. This is the common renderer-neutral wrapper used to center a
    // display equation. The equation root's own display flag still supplies
    // the correct plain-text line boundary.
    if (items.length <= 1) return true;
    if (!/^(?:flex|inline-flex)$/u.test(display)) return false;

    // A normal, non-wrapping flex column is equivalent to DOM block order only
    // when every selected item already has a block model. This covers article
    // and Markdown columns without guessing at row wrapping or grid placement.
    const direction = String(computed && computed.flexDirection || 'row').trim().toLowerCase() || 'row';
    const wrap = String(computed && computed.flexWrap || 'nowrap').trim().toLowerCase() || 'nowrap';
    if (direction !== 'column' || wrap !== 'nowrap' ||
        !items.every((item) => ordinaryLayoutItemHasBlockModel(item, replaceableMathRoots))) return false;

    let previousOrder = -Infinity;
    for (const item of items) {
      if (item.nodeType !== 1) return false;
      const itemComputed = view.getComputedStyle(item);
      const rawOrder = String(itemComputed && itemComputed.order || '0').trim();
      const order = rawOrder === '' || rawOrder === 'normal' ? 0 : Number(rawOrder);
      if (!Number.isFinite(order) || order < previousOrder) return false;
      previousOrder = order;
    }
    return true;
  }

  function ordinaryComputedLayoutRisk(range, documentObject, replaceableMathRoots) {
    const view = documentObject && documentObject.defaultView;
    if (!range || !view || typeof view.getComputedStyle !== 'function') return true;
    const root = rangeTraversalRoot(range);
    if (!root) return true;
    const stack = [];
    if (root.nodeType === 1) stack.push(root);
    else {
      for (let child = root.lastElementChild; child; child = child.previousElementSibling) stack.push(child);
    }
    const cssDescriptorContext = createCssStackMathDescriptorContext();
    let inspected = 0;
    while (stack.length) {
      const element = stack.pop();
      if (!element || element.nodeType !== 1 || !rangeIntersects(range, element)) continue;
      inspected += 1;
      if (inspected > MAX_RICH_SELECTION_NODES) return true;
      const replaceableMathRoot = Boolean(replaceableMathRoots && replaceableMathRoots.has(element));
      // These exact roots have already passed sanitized MathML/source-visible
      // agreement and are replaced before ordinary prose serialization.
      // MathJax legitimately clips each font glyph and absolutely positions
      // its speech layer; those renderer internals do not describe the prose
      // layout and must not make an otherwise safe mixed selection fail. The
      // root itself is still inspected below so a hidden, clipped, transformed,
      // or absolutely positioned fake renderer can never gain this exemption.
      const tag = (element.localName || '').toLowerCase();
      // Semantic MathML is replaced from a separately sanitized clone before
      // ordinary prose is serialized. Its renderer-internal layout is not a
      // prose signal, and some DOM engines cannot compute MathML CSS at all.
      if (element.namespaceURI === MATHML_NAMESPACE) {
        if (replaceableMathRoot &&
            nativeMathMLPresentationLayoutIsRisky(element, view, documentObject)) return true;
        continue;
      }
      if (ORDINARY_DROP_CONTENT_TAGS.has(tag) || SKIP_TAGS.has(tag)) continue;
      if (isVisuallyHiddenElement(element)) {
        if (replaceableMathRoot) return true;
        continue;
      }
      try {
        const computed = view.getComputedStyle(element);
        if (computedStyleHasUnsafeVisibleLayout(computed, false)) return true;
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

        // A generic CSS-math root has already authenticated its visible
        // geometry, row order, rule, text, clipping, and computed layout.
        // Its implementation may intentionally change a <section>/<span>
        // into flex, grid, block, or table layout; ordinary prose modeling
        // must not reject that renderer-specific display choice afterward.
        if (replaceableMathRoot && cssStackMathRootDescriptor(
          element,
          documentObject,
          0,
          cssDescriptorContext
        )) continue;

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

        if (/^(?:flex|inline-flex|grid|inline-grid)$/.test(display) &&
            !ordinaryFlexGridLayoutIsSerializable(
              element,
              range,
              view,
              computed,
              display,
              replaceableMathRoots
            )) return true;

        if (!replaceableMathRoot && /^(?:inline-table|table-(?:row|cell|row-group|header-group|footer-group|caption|column|column-group))$/u.test(display)) {
          const allowed = ORDINARY_SEMANTIC_TABLE_DISPLAYS[tag];
          if (!allowed || !allowed.has(display)) return true;
        }

        if (!['html', 'body', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'].includes(tag) && display) {
          const computedBlock = /^(?:block|flex|grid|list-item|table)$/.test(display);
          const modeledBlock = BLOCK_TAGS.has(tag) || /display\s*:\s*(?:block|flex|grid|list-item|table)/i.test(
            String(element.getAttribute && element.getAttribute('style') || '')
          );
          // Wikipedia declares its authenticated display-math wrapper as a
          // <span> and gives it display:block from an external stylesheet.
          // The semantic MathML display flag already proves that block layout
          // is intentional. Keep rejecting every other class-driven block,
          // including CSS that tries to promote inline math or ordinary spans.
          const authenticatedDisplayMathBlock = replaceableMathRoot &&
            display === 'block' && isDisplayMath(element);
          if (computedBlock !== modeledBlock && display !== 'contents' &&
              !authenticatedDisplayMathBlock) return true;
          if (display === 'contents' && modeledBlock) return true;
        }
      } catch (_error) {
        // Layout is part of the copied meaning; an inspection failure must
        // leave the operation native instead of guessing from source markup.
        return true;
      }
      if (replaceableMathRoot) continue;
      for (let child = element.lastElementChild; child; child = child.previousElementSibling) {
        stack.push(child);
      }
    }
    return false;
  }

  function cloneOrdinaryRangeWithContext(range, documentObject, replaceableMathRoots) {
    if (!rangeDOMWithinBudget(
      range,
      MAX_RICH_SELECTION_NODES,
      MAX_RICH_SELECTION_DEPTH,
      MAX_ORDINARY_SELECTION_MARKUP_LENGTH
    ) || ordinaryComputedLayoutRisk(range, documentObject, replaceableMathRoots)) return null;
    let contents;
    try {
      contents = range.cloneContents();
    } catch (_error) {
      return null;
    }
    const common = rangeTraversalRoot(range);
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

  function serializeOrdinaryFragment(fragment, outputMode = 'faithful', optionsInput) {
    const serializerOptions = optionsInput && typeof optionsInput === 'object' ? optionsInput : {};
    const convertSemanticScripts = serializerOptions.semanticScripts !== false;
    let output = '';
    let pendingSpace = false;
    let pendingBlockBreak = 0;
    let displayBoundaryPending = false;
    const evidence = {
      artifacts: false,
      collapsibleWhitespace: false,
      hiddenOrAlternate: false,
      suppressedImageDescription: false,
      semanticScripts: false,
      semanticScriptUnrepresentable: false,
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
    const semanticScriptBody = (element, depth = 0, budget = { nodes: 0, characters: 0 }) => {
      if (!element || depth > MAX_MATHML_DEPTH) return null;
      let text = '';
      let nested = false;
      const append = (value) => {
        const cleaned = cleanOrdinaryCharacters(value).replace(/[\t\n\f\r ]+/g, ' ');
        budget.characters += cleaned.length;
        if (budget.characters > MAX_CSS_STACK_MATH_CHARACTERS) return false;
        text += cleaned;
        return true;
      };
      for (const child of Array.from(element.childNodes || [])) {
        budget.nodes += 1;
        if (budget.nodes > MAX_CSS_STACK_MATH_NODES) return null;
        if (child.nodeType === 3) {
          if (!append(child.nodeValue || '')) return null;
          continue;
        }
        if (child.nodeType !== 1) continue;
        const tag = (child.localName || '').toLowerCase();
        if (isVisuallyHiddenElement(child)) {
          evidence.hiddenOrAlternate = true;
          continue;
        }
        if (tag === 'img' || tag === 'area') {
          const projection = ordinaryImageAltProjection(child);
          if (projection.suppressed) evidence.suppressedImageDescription = true;
          if (projection.text && !append(projection.text)) return null;
          continue;
        }
        if (['script', 'style', 'noscript', 'template'].includes(tag)) {
          evidence.hiddenOrAlternate = true;
          continue;
        }
        if (ORDINARY_DROP_CONTENT_TAGS.has(tag) || SKIP_TAGS.has(tag) ||
            ['br', 'hr', 'input', 'select', 'textarea', 'button', 'meter', 'progress'].includes(tag)) {
          return null;
        }
        const kind = convertSemanticScripts ? clipboardInlineScriptKind(child) : '';
        if (kind) {
          const body = semanticScriptBody(child, depth + 1, budget);
          if (!body || !body.text) return null;
          const marker = kind === 'sub' ? '_' : '^';
          if (outputMode === 'calculator') text += marker + '(' + body.text + ')';
          else if (outputMode === 'latex') text += marker + '{' + body.text + '}';
          else {
            const atomic = !body.nested && Array.from(body.text).length === 1;
            text += marker + (atomic ? body.text : '(' + body.text + ')');
          }
          nested = true;
          continue;
        }
        const body = semanticScriptBody(child, depth + 1, budget);
        if (!body) return null;
        text += body.text;
        nested = nested || body.nested;
      }
      return { text: text.trim(), nested };
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
      const semanticScriptKind = convertSemanticScripts ? clipboardInlineScriptKind(element) : '';
      if (semanticScriptKind) {
        evidence.semanticScripts = true;
        const body = semanticScriptBody(element);
        const raw = body && body.text || '';
        if (!raw || raw.length > MAX_CSS_STACK_MATH_CHARACTERS) {
          evidence.semanticScriptUnrepresentable = true;
          return;
        }
        const citation = semanticScriptKind === 'sup' && !body.nested &&
          /^(?:\[\s*\d+(?:\s*[,;–-]\s*\d+)*\s*\]|\(\s*\d+\s*\))$/u.test(raw);
        let scriptText = raw;
        if (!citation) {
          const marker = semanticScriptKind === 'sub' ? '_' : '^';
          if (body.nested) {
            scriptText = outputMode === 'latex'
              ? marker + '{' + raw + '}'
              : marker + '(' + raw + ')';
          } else scriptText = officeScriptText(raw, semanticScriptKind, outputMode);
        }
        appendGenerated(scriptText);
        evidence.structure = true;
        return;
      }
      if (tag === 'img' || tag === 'area') {
        const projection = ordinaryImageAltProjection(element);
        if (projection.text) appendNormal(projection.text);
        if (projection.suppressed) evidence.suppressedImageDescription = true;
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
      const trustedPlaceholder = TRUSTED_TEXT_PLACEHOLDERS.get(node);
      if (trustedPlaceholder && trustedPlaceholder.richSemantic === true) {
        state.lastCollapsibleSpace = false;
        return semanticTextRichFragment(
          trustedPlaceholder.text || '',
          trustedPlaceholder.outputMode || 'faithful',
          documentObject
        );
      }
      const tag = (node.localName || '').toLowerCase();
      if (ORDINARY_DROP_CONTENT_TAGS.has(tag) || SKIP_TAGS.has(tag) || isVisuallyHiddenElement(node)) return null;
      if (tag === 'img' || tag === 'area') {
        const projection = ordinaryImageAltProjection(node);
        if (!projection.text) return null;
        const alt = inheritedMode === 'preserve'
          ? projection.text
          : cleanNormalRichText(projection.text);
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

  function ordinarySelectionPayload(documentObject, selection, pageWindow, target, capturedRanges, settingsInput) {
    if (!documentObject || !selection || selection.isCollapsed || isTextControl(target)) return null;
    const suppliedRanges = Array.isArray(capturedRanges) ? capturedRanges : null;
    const rangeCount = suppliedRanges ? suppliedRanges.length : boundedSelectionRangeCount(selection);
    if (rangeCount <= 0 || rangeCount > MAX_SELECTION_RANGES) return null;
    if (isMicrosoftOfficeEditorSurface(documentObject, target, selection) ||
        isContentEditableSelection(documentObject, target, selection) ||
        isRawLatexProtected(target, selection, false)) return null;
    const ranges = suppliedRanges || selectionRanges(documentObject, selection, rangeCount);
    if (!ranges.length) return null;
    const nativeText = ranges.map((range) => range.toString()).join('\n');
    if (!nativeText) return null;
    const settings = normalizeSettings(settingsInput);

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
      const serialized = serializeOrdinaryFragment(fragment, settings.outputMode);
      if (serialized.evidence.semanticScriptUnrepresentable) return null;
      values.push({ fragment, ...serialized });
    }
    if (settings.outputMode !== 'faithful' && values.some((value) => {
      if (!value.evidence.semanticScripts) return false;
      const source = String(value.text || '');
      for (let index = 0; index + 1 < source.length; index += 1) {
        if (!['^', '_'].includes(source[index]) || !['(', '{'].includes(source[index + 1])) continue;
        let previous = index;
        while (previous > 0 && /\s/u.test(source[previous - 1])) previous -= 1;
        const character = Array.from(source.slice(0, previous)).pop() || '';
        if (!/[\p{L}\p{N}\p{M})\]}|∣❘‖∥⟩⌉⌋∞∂∇ℏℓ′″‴⁗!%]/u.test(character)) return true;
      }
      return false;
    })) return null;
    let repairedRendererLayout = false;
    for (const value of values) {
      const repaired = repairFlattenedRendererText(value.text);
      if (repaired !== value.text) {
        value.text = repaired;
        repairedRendererLayout = true;
      }
    }
    const text = values.map((value) => value.text).join('\n');
    const suppressedImageDescription = values.some((value) =>
      value.evidence.suppressedImageDescription);
    // Range#toString normally omits loaded image alts even though a browser's
    // native clipboard projection may add them. When we deliberately removed
    // a long or non-textual alt, still take ownership of the copy even if the
    // cleaned visible string happens to equal Range#toString().
    if (!text.trim() || (text === nativeText && !suppressedImageDescription)) return null;
    const confidentlyBetter = values.some((value) =>
      value.evidence.artifacts || value.evidence.collapsibleWhitespace ||
      value.evidence.hiddenOrAlternate || value.evidence.suppressedImageDescription ||
      value.evidence.structure) || repairedRendererLayout;
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
    } else if (values.some((value) => value.evidence.semanticScripts)) {
      // Faithful rich output can retain the sanitized authored <sup>/<sub>
      // structure (and surrounding emphasis/links) because it expresses the
      // same meaning as the Unicode-or-caret plain text. Calculator/LaTeX
      // modes use explicit text so native HTML scripts cannot visually
      // disagree with ^(...) / ^{...} syntax.
      html = settings.outputMode === 'faithful'
        ? safeOrdinaryRichHTML(values.map((value) => value.fragment), documentObject)
        : semanticTextClipboardHTML(text, settings.outputMode);
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

  function selectionContainsSemanticHtmlScript(ranges) {
    const selector = 'sup,sub,[style*="vertical-align" i],[style*="font-variant-position" i],[class]';
    let inspectedCandidates = 0;
    let scanned = 0;
    for (const range of ranges || []) {
      const common = rangeTraversalRoot(range);
      if (!common) continue;
      scanned += 1;
      if (scanned > MAX_MATH_DISCOVERY_CANDIDATES + MAX_MATHML_NODES) return true;
      const stack = [common];
      while (stack.length) {
        const node = stack.pop();
        if (!node) continue;
        // An over-budget subtree must not fall through to the flat Unicode
        // detector, which could misread an uninspected visual superscript as
        // an ordinary adjacent digit. The bounded ordinary path will then
        // either model the range safely or leave native copy untouched.
        if (scanned > MAX_MATH_DISCOVERY_CANDIDATES + MAX_MATHML_NODES) return true;
        if (node.nodeType === 1 && node.matches && node.matches(selector)) {
          inspectedCandidates += 1;
          if (inspectedCandidates > MAX_RICH_SELECTION_NODES) return true;
          if (clipboardInlineScriptKind(node)) return true;
        }
        for (let child = node.lastChild; child; child = child.previousSibling) {
          scanned += 1;
          if (scanned > MAX_MATH_DISCOVERY_CANDIDATES + MAX_MATHML_NODES) return true;
          if (child.nodeType === 1 && rangeIntersects(range, child)) {
            stack.push(child);
          }
        }
      }
    }
    return false;
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
    return toFaithfulScript(
      normalized,
      kind === 'sub' ? SUBSCRIPTS : SUPERSCRIPTS,
      kind === 'sub' ? '_' : '^'
    );
  }

  function positionedTokenElementsForRange(range, documentObject) {
    const container = rangeTraversalRoot(range);
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

  // PDF.js exposes the source PDF's text geometry and original embedded-font
  // names. The browser's built-in PDF viewer exposes neither to userscripts,
  // which is why a flattened native copy can turn an integral into "Z" and
  // discard the scope of a radical. Keep this analyzer data-only so it is
  // usable both by the trusted viewer and by deterministic tests.
  function analyzePdfPageText(itemsInput, stylesInput, fontsInput, radicalSegmentsInput) {
    const sourceItems = Array.isArray(itemsInput) ? itemsInput : [];
    const styles = stylesInput && typeof stylesInput === 'object' ? stylesInput : {};
    const fonts = fontsInput && typeof fontsInput === 'object' ? fontsInput : {};
    const radicalSegments = Array.isArray(radicalSegmentsInput) ? radicalSegmentsInput : [];
    if (sourceItems.length > MAX_PDF_PAGE_ITEMS || radicalSegments.length > MAX_PDF_GEOMETRY_RULES ||
        sourceItems.length * Math.max(1, radicalSegments.length) > MAX_PDF_GEOMETRY_WORK) {
      return { items: [], lines: [], normalLineGap: 0, overBudget: true };
    }
    let sourceCharacters = 0;
    for (const item of sourceItems) {
      sourceCharacters += String(item && item.str || '').length;
      if (sourceCharacters > MAX_PDF_PAGE_CHARACTERS) {
        return { items: [], lines: [], normalLineGap: 0, overBudget: true };
      }
    }
    const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const cleanFontName = (value) => String(value || '').replace(/^[A-Z]{6}\+/, '');
    const items = sourceItems.map((source, index) => {
      const transform = Array.isArray(source && source.transform) || ArrayBuffer.isView(source && source.transform)
        ? Array.from(source.transform)
        : [];
      const fontName = String(source && source.fontName || '');
      const font = fonts[fontName] || {};
      const style = styles[fontName] || {};
      const size = Math.max(0.01, Math.hypot(number(transform[0], 0), number(transform[1], 0)) ||
        number(source && source.height, 0) || 1);
      const rawText = String(source && source.str || '');
      const x = number(transform[4], 0);
      const y = number(transform[5], 0);
      const width = Math.max(0, Math.abs(number(source && source.width, 0)));
      const originalFont = cleanFontName(font.name || font.loadedName || style.fontFamily || fontName);
      // Older PDFs without a usable ToUnicode map can expose raw TeX OMS
      // slots. In CMSY fonts slot 0 is the minus sign; leaving it as U+0000
      // produces an invisible/NUL character on the clipboard. The radical's
      // legacy `p` slot is normalized later only when its drawn overbar
      // authenticates the glyph geometrically.
      const text = /^CMSY\d+$/i.test(originalFont)
        ? rawText.replace(/\u0000/gu, '−')
        : rawText;
      let semantic = '';
      // In TeX's CMEX encoding, character 0x5a is the display integral. PDF
      // text extraction commonly maps that byte to the literal letter Z.
      if (text === 'Z' && /^CMEX(?:7|8|9|10|12)$/i.test(originalFont)) semantic = 'integral';
      return {
        index,
        text,
        x,
        y,
        width,
        height: Math.max(0, Math.abs(number(source && source.height, size))),
        size,
        fontName,
        originalFont,
        hasEOL: Boolean(source && source.hasEOL),
        semantic,
        accent: '',
        accentBase: -1,
        script: '',
        scriptBase: -1,
        effectiveY: y,
        line: -1,
        math: false,
        mathGroup: '',
        displayMath: false,
        radical: '',
        radicalEndX: NaN,
        fraction: '',
        fractionRole: '',
        fractionX1: NaN,
        fractionX2: NaN
      };
    });

    const visible = items.filter((item) => item.text && !/^\s+$/u.test(item.text));
    const accentKind = (text) => {
      const value = String(text || '').trim();
      if (/^(?:⃗|→|⇀|↼)$/u.test(value)) return 'vector';
      if (/^(?:\^|ˆ|̂)$/u.test(value)) return 'hat';
      if (/^(?:¯|‾|̅)$/u.test(value)) return 'bar';
      if (/^(?:˜|~|̃)$/u.test(value)) return 'tilde';
      if (/^(?:˙|̇)$/u.test(value)) return 'dot';
      return '';
    };
    const accentItems = visible.map((item) => ({ item, kind: accentKind(item.text) }))
      .filter((entry) => entry.kind);
    if (accentItems.length * Math.max(1, visible.length) > MAX_PDF_GEOMETRY_WORK) {
      return { items: [], lines: [], normalLineGap: 0, overBudget: true };
    }
    for (const { item: accent, kind } of accentItems) {
      const candidates = visible.filter((candidate) => candidate !== accent && !accentKind(candidate.text) &&
        candidate.y < accent.y && accent.y - candidate.y <= Math.max(accent.size, candidate.size) * 0.95 &&
        candidate.x < accent.x + Math.max(accent.width, accent.size * 0.45) &&
        candidate.x + Math.max(candidate.width, candidate.size * 0.3) > accent.x - accent.size * 0.25);
      candidates.sort((left, right) => {
        const leftCenter = Math.abs((left.x + left.width / 2) - (accent.x + accent.width / 2));
        const rightCenter = Math.abs((right.x + right.width / 2) - (accent.x + accent.width / 2));
        return leftCenter - rightCenter || (accent.y - left.y) - (accent.y - right.y);
      });
      const base = candidates[0];
      if (!base) continue;
      accent.accent = kind;
      accent.accentBase = base.index;
      accent.effectiveY = base.y;
    }
    for (let visibleIndex = 0; visibleIndex < visible.length; visibleIndex += 1) {
      const item = visible[visibleIndex];
      if (item.accent) continue;
      for (let back = visibleIndex - 1; back >= 0 && visibleIndex - back <= 12; back -= 1) {
        const base = visible[back];
        const ratio = item.size / base.size;
        if (ratio < 0.5 || ratio > 0.82) continue;
        const gap = item.x - (base.x + base.width);
        if (gap < -0.2 * base.size || gap > 0.75 * base.size) continue;
        const rise = (item.y - base.y) / base.size;
        if (rise > 0.14 && rise < 0.85) item.script = 'sup';
        else if (rise < -0.10 && rise > -0.85) item.script = 'sub';
        else continue;
        item.scriptBase = base.index;
        item.effectiveY = base.effectiveY;
        break;
      }
    }

    const horizontalRules = radicalSegments.map((segment) => ({
      x1: Math.min(number(segment && segment.x1, NaN), number(segment && segment.x2, NaN)),
      x2: Math.max(number(segment && segment.x1, NaN), number(segment && segment.x2, NaN)),
      y: number(segment && segment.y, NaN)
    })).filter((segment) => [segment.x1, segment.x2, segment.y].every(Number.isFinite) &&
      segment.x2 - segment.x1 > 0.5);

    const usedRules = new Set();
    for (const root of visible) {
      const unicodeRoot = root.text === '√';
      const legacyTexRoot = root.text === 'p' && /^CMSY\d+$/i.test(root.originalFont);
      if (!unicodeRoot && !legacyTexRoot) continue;
      let best = null;
      let bestScore = Infinity;
      for (const rule of horizontalRules) {
        const dx = Math.abs(rule.x1 - (root.x + root.width));
        const dy = Math.abs(rule.y - root.y);
        if (dx > root.size * 0.65 || dy > root.size * 0.45) continue;
        const score = dx + dy;
        if (score < bestScore) { best = rule; bestScore = score; }
      }
      if (!best) continue;
      if (legacyTexRoot) root.text = '√';
      usedRules.add(best);
      root.semantic = 'root';
      root.radical = 'root-' + root.index;
      root.radicalEndX = best.x2;
      const baselineCandidate = visible.find((candidate) =>
        candidate.index > root.index && candidate.x >= best.x1 - root.size * 0.2 &&
        candidate.x < best.x2 + root.size * 0.2 && !candidate.script);
      if (baselineCandidate) root.effectiveY = baselineCandidate.y;
    }

    for (const item of visible) {
      if (item.semantic !== 'integral') continue;
      const neighbor = visible.find((candidate) => candidate.index > item.index &&
        candidate.x >= item.x && !candidate.script && candidate.semantic !== 'integral') ||
        [...visible].reverse().find((candidate) => candidate.index < item.index && !candidate.script);
      if (neighbor) item.effectiveY = neighbor.effectiveY;
    }

    let fractionSerial = 0;
    for (const rule of horizontalRules) {
      if (usedRules.has(rule)) continue;
      const overlapping = visible.filter((item) => {
        const center = item.x + item.width / 2;
        return center >= rule.x1 - item.size * 0.12 && center <= rule.x2 + item.size * 0.12 &&
          Math.abs(item.y - rule.y) <= item.size * 1.8;
      });
      const numerators = overlapping.filter((item) => item.y > rule.y + Math.max(0.5, item.size * 0.12));
      const denominators = overlapping.filter((item) => item.y < rule.y - Math.max(0.5, item.size * 0.12));
      if (!numerators.length || !denominators.length) continue;
      const numeratorY = numerators.reduce((sum, item) => sum + item.y, 0) / numerators.length;
      const denominatorY = denominators.reduce((sum, item) => sum + item.y, 0) / denominators.length;
      const midpointY = (numeratorY + denominatorY) / 2;
      const baseline = visible.filter((item) => !overlapping.includes(item) &&
        item.x + item.width <= rule.x1 + item.size * 0.25 &&
        item.x + item.width >= rule.x1 - item.size * 3.2 &&
        item.y > denominatorY - item.size * 0.25 && item.y < numeratorY + item.size * 0.25)
        .sort((left, right) => {
          const leftScore = Math.abs(left.x + left.width - rule.x1) + Math.abs(left.y - midpointY);
          const rightScore = Math.abs(right.x + right.width - rule.x1) + Math.abs(right.y - midpointY);
          return leftScore - rightScore;
        })[0];
      const baselineY = baseline ? baseline.y : midpointY;
      const id = 'fraction-' + (++fractionSerial);
      for (const item of numerators) {
        item.fraction = id; item.fractionRole = 'numerator';
        item.fractionX1 = rule.x1; item.fractionX2 = rule.x2; item.effectiveY = baselineY;
      }
      for (const item of denominators) {
        item.fraction = id; item.fractionRole = 'denominator';
        item.fractionX1 = rule.x1; item.fractionX2 = rule.x2; item.effectiveY = baselineY;
      }
    }

    const lines = [];
    let previousVisible = null;
    for (const item of visible) {
      if (item.scriptBase >= 0 || item.accentBase >= 0) {
        const base = items[item.scriptBase >= 0 ? item.scriptBase : item.accentBase];
        if (base && base.line >= 0) item.line = base.line;
      }
      if (item.line < 0) {
        let line = lines.length ? lines[lines.length - 1] : null;
        const sameBaseline = line && Math.abs(item.effectiveY - line.y) <= Math.max(1, item.size * 0.34);
        const severeReset = sameBaseline && previousVisible && item.x < previousVisible.x - 2.5 * item.size;
        if (!sameBaseline || severeReset) {
          line = { id: lines.length, y: item.effectiveY, items: [], math: false };
          lines.push(line);
        }
        item.line = line.id;
      }
      const line = lines[item.line];
      if (line) {
        line.items.push(item.index);
        if (!item.script) line.y = (line.y * (line.items.length - 1) + item.effectiveY) / line.items.length;
      }
      previousVisible = item;
    }

    const radicalRoots = visible.filter((item) => item.radical && Number.isFinite(item.radicalEndX));
    if (radicalRoots.length * Math.max(1, visible.length) > MAX_PDF_GEOMETRY_WORK) {
      return { items: [], lines: [], normalLineGap: 0, overBudget: true };
    }
    for (const root of radicalRoots) {
      for (const item of visible) {
        if (item.index <= root.index || item.line !== root.line) continue;
        if (item.x >= root.radicalEndX + root.size * 0.12) continue;
        if (item.x + item.width <= root.x + root.width - root.size * 0.15) continue;
        item.radical = root.radical;
        item.radicalEndX = root.radicalEndX;
      }
    }

    let mathGroupSerial = 0;
    const mathFont = (item) => /^(?:CMMI|CMSY|CMEX|MSAM|MSBM|STIX.*Math)/i.test(item.originalFont);
    const mathCandidate = (item) => Boolean(item.semantic || item.accent || item.radical || item.fraction || item.script ||
      mathFont(item) || /^[\s\d.,;:()[\]{}|=+−\-*/<>≤≥≠≈∝±∓×÷√∫∑∏⇒⇔ΦΔΩμνρ]+$/u.test(item.text) ||
      /^[\p{L}\p{M}]{1,4}$/u.test(item.text.trim()) ||
      /^\s*(?:det|dim|sin|cos|tan|log|ln|exp|max|min|lim)\b/u.test(item.text));
    for (const line of lines) {
      const lineItems = line.items.map((index) => items[index]);
      const seeds = [];
      for (let position = 0; position < lineItems.length; position += 1) {
        const item = lineItems[position];
        const base = item.scriptBase >= 0 ? items[item.scriptBase] : null;
        if (item.semantic || item.accent || item.radical || item.fraction ||
            /[=≠≈≤≥<>∝±∓×÷√∫∑∏⇒⇔]/u.test(item.text) ||
            (item.script && base && mathFont(base))) seeds.push(position);
      }
      if (seeds.length * Math.max(1, lineItems.length) > MAX_PDF_GEOMETRY_WORK) {
        return { items: [], lines: [], normalLineGap: 0, overBudget: true };
      }
      const intervals = [];
      for (const seed of seeds) {
        let start = seed;
        let end = seed;
        while (start > 0) {
          const previous = lineItems[start - 1];
          const current = lineItems[start];
          const gap = current.x - (previous.x + previous.width);
          if (!mathCandidate(previous) || gap > Math.max(previous.size, current.size) * 0.72) break;
          start -= 1;
        }
        while (end + 1 < lineItems.length) {
          const current = lineItems[end];
          const next = lineItems[end + 1];
          const gap = next.x - (current.x + current.width);
          if (!mathCandidate(next) || gap > Math.max(current.size, next.size) * 0.72) break;
          end += 1;
        }
        intervals.push({ start, end });
      }
      intervals.sort((left, right) => left.start - right.start);
      const merged = [];
      for (const interval of intervals) {
        const previous = merged[merged.length - 1];
        if (previous && interval.start <= previous.end + 1) previous.end = Math.max(previous.end, interval.end);
        else merged.push({ ...interval });
      }
      for (const interval of merged) {
        const id = 'math-' + (++mathGroupSerial);
        for (let position = interval.start; position <= interval.end; position += 1) {
          lineItems[position].mathGroup = id;
          lineItems[position].math = true;
        }
      }
      line.math = merged.length > 0;
      const outside = lineItems.filter((item) => !item.mathGroup);
      line.displayMath = line.math && outside.every((item) => /^\s*[([]?\d+(?:\.\d+)*[)\]]?[,.;]?\s*$/u.test(item.text));
      for (const item of lineItems) item.displayMath = line.displayMath;
    }

    const lineGaps = [];
    for (let index = 1; index < lines.length; index += 1) {
      const gap = Math.abs(lines[index - 1].y - lines[index].y);
      if (gap > 0.5) lineGaps.push(gap);
    }
    lineGaps.sort((left, right) => left - right);
    const normalLineGap = lineGaps.length
      ? lineGaps[Math.floor((lineGaps.length - 1) / 2)]
      : 0;
    return { items, lines, normalLineGap, overBudget: false };
  }

  function selectedPdfTokenSlice(range, element, documentObject) {
    if (!rangeIntersects(range, element)) return null;
    const value = element.textContent || '';
    if (!value) return null;
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
      start = 0;
      end = value.length;
    }
    start = Math.max(0, Math.min(value.length, start));
    end = Math.max(start, Math.min(value.length, end));
    return end > start ? { start, end, text: value.slice(start, end), fullText: value } : null;
  }

  function trustedPdfRootForNode(node) {
    for (let current = node && node.nodeType === 1 ? node : node && node.parentElement;
      current; current = current.parentElement) {
      if (TRUSTED_PDF_VIEWER_ROOTS.has(current)) return current;
    }
    return null;
  }

  function registerTrustedPdfViewerRoot(root) {
    if (root && root.nodeType === 1) TRUSTED_PDF_VIEWER_ROOTS.add(root);
    return root;
  }

  const PDF_LATEX_CHARACTERS = Object.freeze({
    '−': '-', '×': '\\times ', '÷': '\\div ', '·': '\\cdot ', '±': '\\pm ', '∓': '\\mp ',
    '∫': '\\int ', '∑': '\\sum ', '∏': '\\prod ', '∞': '\\infty ', '≈': '\\approx ',
    '≠': '\\ne ', '≤': '\\le ', '≥': '\\ge ', '∝': '\\propto ', 'μ': '\\mu ',
    'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ', 'δ': '\\delta ', 'ε': '\\epsilon ',
    'ϵ': '\\varepsilon ', 'ζ': '\\zeta ', 'η': '\\eta ', 'θ': '\\theta ', 'ϑ': '\\vartheta ',
    'ι': '\\iota ', 'κ': '\\kappa ', 'λ': '\\lambda ', 'ν': '\\nu ', 'ξ': '\\xi ',
    'π': '\\pi ', 'ϖ': '\\varpi ', 'ρ': '\\rho ', 'ϱ': '\\varrho ', 'σ': '\\sigma ',
    'τ': '\\tau ', 'υ': '\\upsilon ', 'φ': '\\phi ', 'ϕ': '\\varphi ', 'χ': '\\chi ',
    'ψ': '\\psi ', 'ω': '\\omega ', 'Γ': '\\Gamma ', 'Δ': '\\Delta ', 'Θ': '\\Theta ',
    'Λ': '\\Lambda ', 'Ξ': '\\Xi ', 'Π': '\\Pi ', 'Σ': '\\Sigma ', 'Φ': '\\Phi ',
    'Ψ': '\\Psi ', 'Ω': '\\Omega ', '∂': '\\partial ', '∇': '\\nabla ', '∼': '\\sim ',
    '⇒': '\\Rightarrow ', '⇔': '\\Leftrightarrow ', '→': '\\to ', '←': '\\leftarrow ',
    '↦': '\\mapsto ', '∈': '\\in ', '∉': '\\notin ', '⊂': '\\subset ', '⊆': '\\subseteq ',
    '⊃': '\\supset ', '⊇': '\\supseteq ', '∪': '\\cup ', '∩': '\\cap ', '∅': '\\varnothing ',
    '∀': '\\forall ', '∃': '\\exists ', '¬': '\\neg ', '∧': '\\land ', '∨': '\\lor ',
    '⊥': '\\perp ', '∥': '\\parallel ', 'ℏ': '\\hbar ', 'ℓ': '\\ell ',
    'ℝ': '\\mathbb{R}', 'ℂ': '\\mathbb{C}', 'ℤ': '\\mathbb{Z}', 'ℕ': '\\mathbb{N}',
    '⟨': '\\langle ', '⟩': '\\rangle '
  });

  function pdfTextToLatex(input) {
    let output = '';
    for (const character of String(input || '')) {
      if (PDF_LATEX_CHARACTERS[character]) output += PDF_LATEX_CHARACTERS[character];
      else if (character === '\\') output += '\\backslash ';
      else if ('{}#$%&_'.includes(character)) output += '\\' + character;
      else if (character === '^') output += '\\hat{}';
      else output += character;
    }
    return output.trimEnd().replace(/\b(det|dim|sin|cos|tan|log|ln|exp|max|min|lim)\b/g, '\\$1 ');
  }

  function pdfUnitSpacing(previous, current, mathLine) {
    if (!previous || !current) return '';
    const left = previous.faithful;
    const right = current.faithful;
    if (!left || !right || /\s$/u.test(left) || /^\s/u.test(right)) return '';
    if (/^[,.;:!?\)\]\}]/u.test(right) || /[\(\[\{]$/u.test(left)) return '';
    if (mathLine) {
      if (previous.kind === 'root' && /^[\p{L}\p{N}]/u.test(right)) return ' ';
      if (/^[=≠≈≤≥<>∝±∓×÷+]/u.test(right) || /[=≠≈≤≥<>∝±∓×÷+]$/u.test(left)) return ' ';
      if ((right === '−' || right === '-') && (!left || /[=([{,]/u.test(left))) return '';
      if ((left === '−' || left === '-') && /^[\p{L}\p{N}√(]/u.test(right)) return '';
      if (previous.kind === 'integral') return ' ';
      if (/^d(?:[⁰-⁹¹²³⁺⁻⁼⁽⁾ⁿⁱ]|\^\([^)]*\))*$/u.test(left) && /^[\p{L}]/u.test(right)) return '';
    }
    const gap = current.x - previous.endX;
    const threshold = Math.max(0.7, Math.min(previous.size, current.size) * (mathLine ? 0.18 : 0.08));
    return gap > threshold ? ' ' : '';
  }

  function joinPdfUnits(units, field, mathLine) {
    let output = '';
    let previous = null;
    for (const unit of units) {
      const value = unit[field];
      if (!value) continue;
      const spacing = pdfUnitSpacing(previous, unit, mathLine);
      output += spacing + value;
      previous = unit;
    }
    return output.replace(/[ \t]{2,}/g, ' ').trim();
  }

  function pdfLineUnits(selectedItems, outputMode) {
    const segments = [];
    for (const selected of selectedItems) {
      const originalLength = Math.max(1, selected.fullText.length);
      const makeSegment = (start, end, radical) => {
        if (end <= start) return;
        const relativeStart = start / originalLength;
        const relativeEnd = end / originalLength;
        segments.push({
          ...selected,
          start,
          end,
          text: selected.fullText.slice(start, end),
          x: selected.x + selected.width * relativeStart,
          endX: selected.x + selected.width * relativeEnd,
          radical
        });
      };
      const scope = Math.max(0, Math.min(originalLength, selected.radicalChars));
      if (selected.radical && selected.semantic !== 'root' && scope > 0) {
        makeSegment(selected.start, Math.min(selected.end, scope), selected.radical);
        makeSegment(Math.max(selected.start, scope), selected.end, '');
      } else makeSegment(selected.start, selected.end, selected.semantic === 'root' ? selected.radical : '');
    }
    segments.sort((left, right) => left.index - right.index || left.start - right.start);
    const byBase = new Map();
    const accentsByBase = new Map();
    for (const segment of segments) {
      if (segment.accent && segment.accentBase >= 0) {
        const accents = accentsByBase.get(segment.accentBase) || [];
        accents.push(segment);
        accentsByBase.set(segment.accentBase, accents);
      }
      if (!segment.script || segment.scriptBase < 0) continue;
      const list = byBase.get(segment.scriptBase) || [];
      list.push(segment);
      byBase.set(segment.scriptBase, list);
    }
    const consumed = new Set();
    const selectedSegmentIndices = new Set(segments.map((segment) => segment.index));
    const makeOrdinaryUnit = (segment) => {
      let faithful = normalizeOfficeGlyphs(segment.text).replace(/\s+/gu, ' ').trim();
      let kind = '';
      if (segment.semantic === 'integral' && segment.start === 0 && segment.end === segment.fullText.length) {
        faithful = '∫';
        kind = 'integral';
      }
      let latex = pdfTextToLatex(faithful);
      let endX = segment.endX;
      const combiningAccents = {
        vector: '\u20d7', hat: '\u0302', bar: '\u0305', tilde: '\u0303', dot: '\u0307'
      };
      const latexAccents = {
        vector: '\\vec', hat: '\\hat', bar: '\\bar', tilde: '\\tilde', dot: '\\dot'
      };
      for (const accent of accentsByBase.get(segment.index) || []) {
        consumed.add(accent);
        const compactBase = Array.from(faithful.normalize('NFC')).length === 1;
        faithful = compactBase && combiningAccents[accent.accent]
          ? faithful + combiningAccents[accent.accent]
          : accent.accent + '(' + faithful + ')';
        if (latexAccents[accent.accent]) latex = latexAccents[accent.accent] + '{' + latex + '}';
        endX = Math.max(endX, accent.endX);
      }
      const scripts = byBase.get(segment.index) || [];
      for (const script of scripts) {
        if (script.radical !== segment.radical) continue;
        consumed.add(script);
        const scriptText = normalizeOfficeGlyphs(script.text).trim();
        faithful += officeScriptText(scriptText, script.script, outputMode === 'faithful' ? 'faithful' : outputMode);
        latex += script.script === 'sub'
          ? '_{' + pdfTextToLatex(scriptText) + '}'
          : '^{' + pdfTextToLatex(scriptText) + '}';
        endX = Math.max(endX, script.endX);
      }
      return { faithful, latex, x: segment.x, endX, size: segment.size, kind,
        mathGroup: segment.mathGroup || '', radical: segment.radical || '' };
    };

    const fractionStructures = [];
    const fractionSegmentsById = new Map();
    for (const segment of segments) {
      if (!segment.fraction) continue;
      const grouped = fractionSegmentsById.get(segment.fraction) || [];
      grouped.push(segment);
      fractionSegmentsById.set(segment.fraction, grouped);
    }
    for (const [fractionId, fractionSegments] of fractionSegmentsById) {
      const numeratorSegments = fractionSegments.filter((segment) => segment.fractionRole === 'numerator');
      const denominatorSegments = fractionSegments.filter((segment) => segment.fractionRole === 'denominator');
      if (!numeratorSegments.length || !denominatorSegments.length) continue;
      const unitsForFractionPart = (partSegments) => {
        const part = [];
        const partIndices = new Set(partSegments.map((segment) => segment.index));
        for (const segment of partSegments.slice().sort((left, right) => left.index - right.index)) {
          if (consumed.has(segment)) continue;
          if (segment.accent && segment.accentBase >= 0 && partIndices.has(segment.accentBase)) continue;
          if (segment.script && segment.scriptBase >= 0 && partIndices.has(segment.scriptBase)) continue;
          part.push(makeOrdinaryUnit(segment));
        }
        return part.sort((left, right) => left.x - right.x);
      };
      const numeratorUnits = unitsForFractionPart(numeratorSegments);
      const denominatorUnits = unitsForFractionPart(denominatorSegments);
      const numerator = joinPdfUnits(numeratorUnits, 'faithful', true);
      const denominator = joinPdfUnits(denominatorUnits, 'faithful', true);
      const numeratorLatex = joinPdfUnits(numeratorUnits, 'latex', true);
      const denominatorLatex = joinPdfUnits(denominatorUnits, 'latex', true);
      if (!numerator || !denominator) continue;
      const atomic = (value) => /^[\p{L}\p{N}\p{M}⁰-⁹¹²³₀-₉_]+$/u.test(value);
      const faithful = (atomic(numerator) ? numerator : '(' + numerator + ')') + '/' +
        (atomic(denominator) ? denominator : '(' + denominator + ')');
      const first = fractionSegments.slice().sort((left, right) => left.index - right.index)[0];
      const radicals = new Set(fractionSegments.map((segment) => segment.radical).filter(Boolean));
      fractionStructures.push({
        id: fractionId,
        segments: fractionSegments,
        leader: first,
        radical: radicals.size === 1 ? radicals.values().next().value : '',
        emitted: false,
        consumedByRoot: false,
        unit: {
          faithful,
          latex: '\\frac{' + numeratorLatex + '}{' + denominatorLatex + '}',
          x: Number.isFinite(first.fractionX1) ? first.fractionX1 : Math.min(...fractionSegments.map((segment) => segment.x)),
          endX: Number.isFinite(first.fractionX2) ? first.fractionX2 : Math.max(...fractionSegments.map((segment) => segment.endX)),
          size: Math.max(...fractionSegments.map((segment) => segment.size)),
          kind: 'fraction',
          mathGroup: first.mathGroup || '',
          radical: radicals.size === 1 ? radicals.values().next().value : ''
        }
      });
      for (const segment of fractionSegments) consumed.add(segment);
    }
    const fractionByLeader = new Map(fractionStructures.map((fraction) => [fraction.leader, fraction]));

    const rootSegments = segments.filter((segment) => segment.semantic === 'root');
    const rootUnits = new Map();
    for (const root of rootSegments) {
      const innerSegments = segments.filter((segment) => segment.radical === root.radical && segment !== root &&
        !consumed.has(segment));
      const innerUnits = [];
      for (const segment of innerSegments) {
        if (consumed.has(segment)) continue;
        consumed.add(segment);
        innerUnits.push(makeOrdinaryUnit(segment));
      }
      for (const fraction of fractionStructures) {
        if (fraction.radical !== root.radical) continue;
        fraction.consumedByRoot = true;
        innerUnits.push(fraction.unit);
      }
      innerUnits.sort((left, right) => left.x - right.x);
      const innerFaithful = joinPdfUnits(innerUnits, 'faithful', true);
      const innerLatex = joinPdfUnits(innerUnits, 'latex', true);
      const faithful = innerFaithful ? '√(' + innerFaithful + ')' : '√';
      const latex = innerLatex ? '\\sqrt{' + innerLatex + '}' : '\\sqrt{}';
      rootUnits.set(root, {
        faithful,
        latex,
        x: root.x,
        endX: Number.isFinite(root.radicalEndX) ? root.radicalEndX : root.endX,
        size: root.size,
        kind: 'root',
        mathGroup: root.mathGroup || '',
        radical: root.radical || ''
      });
    }

    const units = [];
    for (const segment of segments) {
      const fraction = fractionByLeader.get(segment);
      if (fraction && !fraction.emitted && !fraction.consumedByRoot) {
        units.push(fraction.unit);
        fraction.emitted = true;
        continue;
      }
      if (consumed.has(segment)) continue;
      if (segment.accent && segment.accentBase >= 0 && selectedSegmentIndices.has(segment.accentBase)) continue;
      if (rootUnits.has(segment)) {
        units.push(rootUnits.get(segment));
        consumed.add(segment);
        continue;
      }
      if (segment.script && segment.scriptBase >= 0 && selectedSegmentIndices.has(segment.scriptBase)) {
        continue;
      }
      units.push(makeOrdinaryUnit(segment));
      consumed.add(segment);
    }
    units.sort((left, right) => left.x - right.x);
    return units;
  }

  function trustedPdfViewerPayload(ranges, settings, documentObject) {
    if (!ranges.length || ranges.length > MAX_SELECTION_RANGES) return null;
    let trustedRoot = null;
    for (const range of ranges) {
      const startRoot = trustedPdfRootForNode(range.startContainer);
      const endRoot = trustedPdfRootForNode(range.endContainer);
      if (!startRoot || startRoot !== endRoot || (trustedRoot && trustedRoot !== startRoot)) return null;
      trustedRoot = startRoot;
    }
    if (!trustedRoot || !trustedRoot.querySelectorAll) return null;
    const pages = [];
    for (const page of trustedRoot.querySelectorAll('[data-cmc-pdf-page]')) {
      if (!ranges.some((range) => rangeIntersects(range, page))) continue;
      pages.push(page);
      if (pages.length > MAX_PDF_SELECTED_PAGES) return PDF_VIEWER_INCOMPLETE;
    }
    if (!pages.length) return null;

    const selected = [];
    for (const page of pages) {
      // A DOM Range can cross lazily-rendered placeholder pages. Rewriting
      // only the pages whose text layers happen to be ready would silently
      // delete part of the selection, so leave that copy to the browser.
      if (page.getAttribute('data-cmc-pdf-text-ready') !== '1') return PDF_VIEWER_INCOMPLETE;
      const pageNumber = Number(page.getAttribute('data-cmc-pdf-page')) || 0;
      const normalLineGap = Number(page.getAttribute('data-cmc-pdf-line-gap')) || 0;
      const tokens = page.querySelectorAll('[data-cmc-pdf-item]');
      if (selected.length + tokens.length > MAX_PDF_SELECTED_ITEMS) return PDF_VIEWER_INCOMPLETE;
      for (const token of tokens) {
        for (const range of ranges) {
          const slice = selectedPdfTokenSlice(range, token, documentObject);
          if (!slice) continue;
          selected.push({
            ...slice,
            page: pageNumber,
            normalLineGap,
            index: Number(token.getAttribute('data-cmc-pdf-item')) || 0,
            line: Number(token.getAttribute('data-cmc-pdf-line')) || 0,
            lineY: Number(token.getAttribute('data-cmc-pdf-line-y')) || 0,
            x: Number(token.getAttribute('data-cmc-pdf-x')) || 0,
            width: Number(token.getAttribute('data-cmc-pdf-width')) || 0,
            size: Number(token.getAttribute('data-cmc-pdf-size')) || 1,
            math: token.getAttribute('data-cmc-pdf-math') === '1',
            mathGroup: token.getAttribute('data-cmc-pdf-math-group') ||
              (token.getAttribute('data-cmc-pdf-math') === '1' ? 'line-math' : ''),
            displayMath: token.getAttribute('data-cmc-pdf-display-math') === '1',
            semantic: token.getAttribute('data-cmc-pdf-semantic') || '',
            accent: token.getAttribute('data-cmc-pdf-accent') || '',
            accentBase: Number(token.getAttribute('data-cmc-pdf-accent-base')),
            script: token.getAttribute('data-cmc-pdf-script') || '',
            scriptBase: Number(token.getAttribute('data-cmc-pdf-script-base')),
            radical: token.getAttribute('data-cmc-pdf-radical') || '',
            radicalChars: Number(token.getAttribute('data-cmc-pdf-radical-chars')) || 0,
            radicalEndX: Number(token.getAttribute('data-cmc-pdf-radical-end')),
            fraction: token.getAttribute('data-cmc-pdf-fraction') || '',
            fractionRole: token.getAttribute('data-cmc-pdf-fraction-role') || '',
            fractionX1: Number(token.getAttribute('data-cmc-pdf-fraction-x1')),
            fractionX2: Number(token.getAttribute('data-cmc-pdf-fraction-x2'))
          });
          break;
        }
      }
    }
    if (!selected.length) return PDF_VIEWER_INCOMPLETE;
    selected.sort((left, right) => left.page - right.page || left.index - right.index || left.start - right.start);
    const lineGroups = [];
    for (const item of selected) {
      let group = lineGroups[lineGroups.length - 1];
      if (!group || group.page !== item.page || group.line !== item.line) {
        group = { page: item.page, line: item.line, y: item.lineY, gap: item.normalLineGap,
          math: item.math, displayMath: item.displayMath, items: [] };
        lineGroups.push(group);
      }
      group.items.push(item);
      group.math = group.math || item.math;
      group.displayMath = group.displayMath || item.displayMath;
    }

    const lines = lineGroups.map((group) => {
      const units = pdfLineUnits(group.items, settings.outputMode);
      const runs = [];
      for (const unit of units) {
        const mathGroup = unit.mathGroup || '';
        let run = runs[runs.length - 1];
        if (!run || run.mathGroup !== mathGroup) {
          run = { mathGroup, units: [] };
          runs.push(run);
        }
        run.units.push(unit);
      }
      let text = '';
      let previousLast = null;
      for (const run of runs) {
        const isMath = Boolean(run.mathGroup);
        const faithful = joinPdfUnits(run.units, 'faithful', isMath);
        let value = faithful;
        if (isMath && settings.outputMode === 'calculator') value = unicodeToCalculator(faithful);
        else if (isMath && settings.outputMode === 'latex') {
          const latex = joinPdfUnits(run.units, 'latex', true)
            .replace(/\\([A-Za-z]+)\s+(?=[}\]^_])/g, '\\$1');
          value = latex ? '$' + latex + '$' : '';
        }
        if (!value) continue;
        const first = run.units[0];
        if (previousLast) text += pdfUnitSpacing(previousLast, first, isMath || Boolean(previousLast.mathGroup));
        text += value;
        previousLast = run.units[run.units.length - 1];
      }
      return { ...group, text: finalizeRewrittenText(text) };
    }).filter((line) => line.text);
    if (!lines.length) return PDF_VIEWER_INCOMPLETE;

    let text = lines[0].text;
    for (let index = 1; index < lines.length; index += 1) {
      const previous = lines[index - 1];
      const current = lines[index];
      const visualGap = Math.abs(previous.y - current.y);
      const paragraphBreak = previous.displayMath !== current.displayMath ||
        (current.gap > 0 && visualGap > current.gap * 1.42);
      text += paragraphBreak ? '\n\n' : ' ';
      text += current.text;
    }
    text = finalizeRewrittenText(text);
    if (!text) return null;
    return {
      text,
      html: semanticTextClipboardHTML(text, settings.outputMode),
      mathML: '',
      reason: 'trusted-pdf-text-layer',
      mathRanges: lines.filter((line) => line.math).length
    };
  }

  function isTextControl(target) {
    if (!target || target.nodeType !== 1) return false;
    const tag = (target.localName || '').toLowerCase();
    return tag === 'textarea' || (tag === 'input' && !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'color', 'range'].includes((target.type || 'text').toLowerCase()));
  }

  function resolvedCopyTargetForSelection(target, selection) {
    if (!isTextControl(target)) return target;
    if (String(target.type || '').toLowerCase() === 'password') return target;
    try {
      const start = Number(target.selectionStart);
      const end = Number(target.selectionEnd);
      // A real control selection always owns the copy, including password
      // fields. Never inspect or replace it from a stale document Range.
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) return target;
    } catch (_error) {
      return target;
    }
    // Static page text can remain selected while the last-focused composer is
    // still the ClipboardEvent target. In that case use the actual document
    // selection endpoint so a focused input cannot suppress semantic math.
    const endpoints = [selection && selection.anchorNode, selection && selection.focusNode].filter(Boolean);
    if (endpoints.some((node) => node === target || (target.contains && target.contains(node)))) {
      return target;
    }
    for (const node of endpoints) {
      const element = node.nodeType === 1 ? node : node.parentElement;
      if (element) return element;
    }
    return target;
  }

  function selectedNativeClipboardText(selection, target) {
    const resolvedTarget = resolvedCopyTargetForSelection(target, selection);
    if (isTextControl(resolvedTarget)) {
      const type = String(resolvedTarget.type || '').toLowerCase();
      // Browsers intentionally protect password values from ordinary copy;
      // an async replay must not weaken that boundary.
      if (type === 'password') return '';
      const start = Number(resolvedTarget.selectionStart);
      const end = Number(resolvedTarget.selectionEnd);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        return String(resolvedTarget.value || '').slice(start, end);
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
      const common = rangeTraversalRoot(range);
      if (!common) continue;
      const stack = [common];
      let inspected = 1;
      while (stack.length) {
        const node = stack.pop();
        if (!node) continue;
        if (inspected > MAX_MATH_DISCOVERY_CANDIDATES + MAX_MATHML_NODES) return true;
        try {
          if (node.nodeType === 1 && node.matches && node.matches(selector)) return true;
        } catch (_error) {
          return true;
        }
        for (let child = node.lastChild; child; child = child.previousSibling) {
          inspected += 1;
          if (inspected > MAX_MATH_DISCOVERY_CANDIDATES + MAX_MATHML_NODES) return true;
          if (child.nodeType === 1 && rangeIntersects(range, child)) {
            stack.push(child);
          }
        }
      }
    }
    return false;
  }

  function getCopyPayload(documentObject, selection, settingsInput, pageWindow, target, allowDeferredPdf) {
    const previousMathJaxSvgCache = ACTIVE_COPY_MATHJAX_SVG_CACHE;
    const previousMathJaxChtmlCache = ACTIVE_COPY_MATHJAX_CHTML_CACHE;
    const previousMathJax2ChtmlCache = ACTIVE_COPY_MATHJAX2_CHTML_CACHE;
    const previousEmbeddedMathCache = ACTIVE_COPY_EMBEDDED_MATH_CACHE;
    ACTIVE_COPY_MATHJAX_SVG_CACHE = new WeakMap();
    ACTIVE_COPY_MATHJAX_CHTML_CACHE = new WeakMap();
    ACTIVE_COPY_MATHJAX2_CHTML_CACHE = new WeakMap();
    ACTIVE_COPY_EMBEDDED_MATH_CACHE = new WeakMap();
    try {
    const settings = normalizeSettings(settingsInput);
    // Native mode is a hard opt-out. Do not even inspect the selection: sites
    // can expose stateful ranges or clipboard projections, and the contract of
    // this mode is exactly the browser/site's original copy operation.
    if (settings.outputMode === 'native') return null;
    target = resolvedCopyTargetForSelection(target, selection);
    if (!selection || selection.isCollapsed || isTextControl(target)) return null;
    const rangeCount = boundedSelectionRangeCount(selection);
    if (rangeCount <= 0) return null;
    const ranges = selectionRanges(documentObject, selection, rangeCount);
    if (!ranges.length) return null;
    const pdfViewer = trustedPdfViewerPayload(ranges, settings, documentObject);
    if (pdfViewer === PDF_VIEWER_INCOMPLETE) {
      if (!allowDeferredPdf) return null;
      const root = trustedPdfRootForNode(ranges[0].startContainer);
      return root ? { deferredPdf: true, root, ranges: ranges.map((range) => range.cloneRange()) } : null;
    }
    if (pdfViewer) return pdfViewer;
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
        mathRanges += serialized.mathRanges != null
          ? serialized.mathRanges
          : (discovery.roots.length ? 1 : 0);
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

    const cssStackMath = cssStackMathSelectionPayload(
      ranges,
      settings,
      documentObject,
      selection,
      target,
      pageWindow
    );
    if (cssStackMath === CSS_STACK_MATH_UNREPRESENTABLE) return null;
    if (cssStackMath) return cssStackMath;

    const nativeText = ranges.map((range) => range.toString()).join('\n');
    const rawLatexProtected = isRawLatexProtected(target, selection, true, ranges);
    if (!rawLatexProtected) {
      const converted = convertDelimitedLatexText(nativeText, settings.outputMode);
      const finalized = finalizeRewrittenText(converted.text);
      if (converted.converted > 0 && finalized.trim()) return { text: finalized, reason: 'delimited-latex', mathRanges: 0 };
    }
    if (selectionContainsSemanticHtmlScript(ranges)) {
      const semanticScripts = ordinarySelectionPayload(
        documentObject, selection, pageWindow, target, ranges, settings
      );
      if (semanticScripts) return { ...semanticScripts, reason: 'semantic-html-scripts' };
    }
    const shouldDeferStandaloneMath = isMicrosoftOfficeEditorSurface(documentObject, target, selection) ||
      isContentEditableSelection(documentObject, target, selection);
    if (!shouldDeferStandaloneMath && !rawLatexProtected) {
      const unicodeMath = standaloneUnicodeMathPayload(nativeText, ranges, settings, documentObject);
      if (unicodeMath) return unicodeMath;
    }
    const ordinary = ordinarySelectionPayload(documentObject, selection, pageWindow, target, ranges, settings);
    if (ordinary) return ordinary;
    return null;
    } finally {
      ACTIVE_COPY_MATHJAX_SVG_CACHE = previousMathJaxSvgCache;
      ACTIVE_COPY_MATHJAX_CHTML_CACHE = previousMathJaxChtmlCache;
      ACTIVE_COPY_MATHJAX2_CHTML_CACHE = previousMathJax2ChtmlCache;
      ACTIVE_COPY_EMBEDDED_MATH_CACHE = previousEmbeddedMathCache;
    }
  }

  function readUserscriptResourceText(name) {
    try {
      if (typeof GM_getResourceText === 'function') {
        return Promise.resolve(GM_getResourceText(name)).then((value) => String(value || ''));
      }
    } catch (_error) {
      // Try the modern API below.
    }
    try {
      if (global.GM && typeof global.GM.getResourceText === 'function') {
        return Promise.resolve(global.GM.getResourceText(name)).then((value) => String(value || ''));
      }
    } catch (_error) {
      // Report a single useful bootstrap error below.
    }
    return Promise.reject(new Error('This userscript manager did not provide its bundled PDF resources.'));
  }

  function readUserscriptResourceUrl(name) {
    try {
      if (typeof GM_getResourceURL === 'function') {
        return Promise.resolve(GM_getResourceURL(name)).then((value) => String(value || ''));
      }
    } catch (_error) {
      // Try the modern API below.
    }
    try {
      if (global.GM && typeof global.GM.getResourceUrl === 'function') {
        return Promise.resolve(global.GM.getResourceUrl(name)).then((value) => String(value || ''));
      }
    } catch (_error) {
      // A text-to-Blob fallback is used below.
    }
    return Promise.resolve('');
  }

  function userscriptModuleResource(name) {
    return readUserscriptResourceUrl(name).then((url) => {
      if (url) return { url, owned: false };
      return readUserscriptResourceText(name).then((source) => {
        if (!source) throw new Error('A bundled PDF resource is empty.');
        return {
          url: URL.createObjectURL(new Blob([source], { type: 'text/javascript' })),
          owned: true
        };
      });
    });
  }

  function pdfResponseHeader(responseHeaders, name) {
    const wanted = String(name || '').toLowerCase();
    const lines = String(responseHeaders || '').split(/\r?\n/);
    for (const line of lines) {
      const separator = line.indexOf(':');
      if (separator < 1 || line.slice(0, separator).trim().toLowerCase() !== wanted) continue;
      return line.slice(separator + 1).trim();
    }
    return '';
  }

  function invalidPdfResponse(message) {
    const error = new Error(message);
    error.code = 'CLEAN_MATH_COPY_INVALID_PDF_RESPONSE';
    return error;
  }

  function assertPdfResponseMetadata(responseHeaders) {
    const length = Number(pdfResponseHeader(responseHeaders, 'content-length'));
    if (Number.isFinite(length) && length > MAX_PDF_FILE_BYTES) {
      throw invalidPdfResponse('This PDF is larger than the 256 MB safety limit.');
    }
    const mediaType = pdfResponseHeader(responseHeaders, 'content-type').split(';')[0].trim().toLowerCase();
    if (/^(?:text\/html|application\/(?:json|xhtml\+xml))$/.test(mediaType)) {
      throw invalidPdfResponse('The request returned a web page instead of a PDF.');
    }
  }

  async function validatedPdfArrayBuffer(value, responseHeaders) {
    assertPdfResponseMetadata(responseHeaders);
    let buffer;
    if (value instanceof ArrayBuffer) {
      buffer = value;
    } else if (ArrayBuffer.isView(value)) {
      buffer = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    } else if (value && typeof value.arrayBuffer === 'function') {
      buffer = await Reflect.apply(value.arrayBuffer, value, []);
    } else {
      throw invalidPdfResponse('The PDF server did not return binary data.');
    }
    if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength) {
      throw invalidPdfResponse('The PDF server returned an empty file.');
    }
    if (buffer.byteLength > MAX_PDF_FILE_BYTES) {
      throw invalidPdfResponse('This PDF is larger than the 256 MB safety limit.');
    }
    const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, MAX_PDF_SIGNATURE_OFFSET + 5));
    let signatureFound = false;
    for (let offset = 0; offset < MAX_PDF_SIGNATURE_OFFSET && offset + 4 < bytes.length; offset += 1) {
      if (bytes[offset] === 0x25 && bytes[offset + 1] === 0x50 && bytes[offset + 2] === 0x44 &&
          bytes[offset + 3] === 0x46 && bytes[offset + 4] === 0x2d) {
        signatureFound = true;
        break;
      }
    }
    if (!signatureFound) throw invalidPdfResponse('The request did not return a valid PDF file.');
    return buffer;
  }

  async function requestCurrentPdfBytes(sourceUrl, pageWindow) {
    const fetchFunction = pageWindow && pageWindow.fetch;
    if (typeof fetchFunction !== 'function') throw new Error('This browser cannot request the current PDF.');
    let requestedUrl;
    let pageUrl;
    try {
      requestedUrl = new URL(sourceUrl, pageWindow.location.href);
      pageUrl = new URL(pageWindow.location.href);
    } catch (_error) {
      throw invalidPdfResponse('The current PDF URL is invalid.');
    }
    requestedUrl.hash = '';
    pageUrl.hash = '';
    const localFile = requestedUrl.protocol === 'file:' && pageUrl.protocol === 'file:';
    const sameOriginNetwork = ['http:', 'https:'].includes(requestedUrl.protocol) &&
      requestedUrl.origin === pageUrl.origin;
    // Browser-created and browser-opened PDFs commonly have a blob: URL.
    // URL#origin preserves the creator origin for nonopaque blobs, so those
    // are as safe to request as the current same-origin HTTP document. Never
    // accept blob:null, which has no origin boundary to authenticate.
    const sameOriginBlob = requestedUrl.protocol === 'blob:' && requestedUrl.origin !== 'null' &&
      requestedUrl.origin === pageUrl.origin;
    if (!sameOriginNetwork && !sameOriginBlob && !localFile) {
      throw invalidPdfResponse('The current PDF request crossed an origin boundary.');
    }
    const AbortControllerConstructor = pageWindow.AbortController || global.AbortController;
    const controller = typeof AbortControllerConstructor === 'function'
      ? new AbortControllerConstructor()
      : null;
    const schedule = pageWindow.setTimeout ? pageWindow.setTimeout.bind(pageWindow) : setTimeout;
    const cancel = pageWindow.clearTimeout ? pageWindow.clearTimeout.bind(pageWindow) : clearTimeout;
    const timeout = controller ? schedule(() => controller.abort(), 120000) : null;
    try {
      const response = await Promise.resolve(Reflect.apply(fetchFunction, pageWindow, [requestedUrl.href, {
        credentials: sameOriginBlob ? 'omit' : 'include',
        redirect: 'follow',
        signal: controller ? controller.signal : undefined,
        headers: { Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.1' }
      }]));
      if (!response || !response.ok) {
        throw new Error('The PDF server returned HTTP ' + Number(response && response.status || 0) + '.');
      }
      if (response.url) {
        let finalUrl;
        try { finalUrl = new URL(response.url); }
        catch (_error) { throw invalidPdfResponse('The PDF request returned an invalid final URL.'); }
        const safeFinal = localFile
          ? finalUrl.protocol === 'file:'
          : (sameOriginBlob
            ? finalUrl.protocol === 'blob:' && finalUrl.origin !== 'null' &&
              finalUrl.href === requestedUrl.href
            : ['http:', 'https:'].includes(finalUrl.protocol) && finalUrl.origin === requestedUrl.origin);
        if (!safeFinal || finalUrl.username || finalUrl.password) {
          throw invalidPdfResponse('The PDF request redirected across an origin boundary.');
        }
      }
      const responseHeaders = (() => {
        if (!response.headers || typeof response.headers.get !== 'function') return '';
        return 'content-length: ' + String(response.headers.get('content-length') || '') + '\n' +
          'content-type: ' + String(response.headers.get('content-type') || '');
      })();
      assertPdfResponseMetadata(responseHeaders);
      const reader = response.body && typeof response.body.getReader === 'function'
        ? response.body.getReader()
        : null;
      if (!reader) return validatedPdfArrayBuffer(await response.arrayBuffer(), responseHeaders);
      const chunks = [];
      let total = 0;
      try {
        while (true) {
          const result = await reader.read();
          if (result.done) break;
          const chunk = result.value instanceof Uint8Array ? result.value : new Uint8Array(result.value || 0);
          total += chunk.byteLength;
          if (total > MAX_PDF_FILE_BYTES) {
            try { await reader.cancel(); } catch (_error) { /* reject below */ }
            throw invalidPdfResponse('This PDF is larger than the 256 MB safety limit.');
          }
          chunks.push(chunk);
        }
      } finally {
        try { reader.releaseLock(); } catch (_error) { /* optional stream API */ }
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return validatedPdfArrayBuffer(bytes.buffer, responseHeaders);
    } finally {
      if (timeout != null) cancel(timeout);
    }
  }

  function isDirectPdfDocument(documentObject, pageWindow) {
    // Content scripts are injected separately into PDF subframes. Treat each
    // actual application/pdf document as its own viewer so embedded handouts
    // work without forcing the user to open a new tab first.
    return Boolean(documentObject &&
      String(documentObject.contentType || '').toLowerCase() === 'application/pdf' &&
      (pageWindow || documentObject.defaultView));
  }

  // The controller passes integrity-pinned PDF.js and a root authenticated by
  // its WeakSet. Rendering and copy handling then share the selected document.
  function cleanMathCopyPdfViewerMain(
    rootId, pdfjs, workerUrl, analyzePage, bypassKey, loadPdfBytes, sourceUrlInput
  ) {
    'use strict';
    const root = document.getElementById(rootId);
    if (!root || !pdfjs || typeof pdfjs.getDocument !== 'function') return;
    const sourceUrl = String(sourceUrlInput || location.href);
    const sourceHash = (() => {
      try { return new URL(sourceUrl, location.href).hash; } catch (_error) { return location.hash; }
    })();
    const packageBase = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/';
    const MAX_PDF_PAGES = 5000;
    const MAX_CANVAS_PIXELS = 8000000;
    const MAX_CANVAS_DIMENSION = 16384;
    const MAX_VIEWPORT_DIMENSION = 50000;
    const MAX_OPERATOR_STEPS = 250000;
    const MAX_SEARCH_CACHE_CHARACTERS = 32 * 1024 * 1024;
    const CANVAS_CACHE_RADIUS = 4;
    const MAX_TEXT_LAYER_PAGES = 96;
    const create = (tag, className, text) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text != null) element.textContent = text;
      return element;
    };
    const button = (label, title, handler) => {
      const element = create('button', 'cmc-pdf-button', label);
      element.type = 'button';
      element.title = title;
      element.addEventListener('click', handler);
      return element;
    };
    const openBrowserViewer = () => {
      try { sessionStorage.setItem(bypassKey, sourceUrl.split('#')[0]); } catch (_error) { /* ignore */ }
      location.reload();
    };
    const fail = (error) => {
      root.hidden = false;
      root.replaceChildren();
      const panel = create('main', 'cmc-pdf-error');
      panel.appendChild(create('h1', '', 'Clean Math Copy could not open this PDF'));
      panel.appendChild(create('p', '', String(error && error.message || error || 'Unknown PDF error')));
      panel.appendChild(button('Open browser viewer', 'Return to the built-in PDF viewer', openBrowserViewer));
      root.appendChild(panel);
    };

    try {
      const style = create('style');
      style.textContent = `
        :root { color-scheme: light dark; }
        html, body { width:100%; height:100%; margin:0; overflow:hidden; }
        body { background:#4a4d50; font:14px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
        .cmc-pdf-viewer-root { width:100%; height:100%; color:#f5f5f5; background:#4a4d50; }
        .cmc-pdf-toolbar { height:48px; box-sizing:border-box; display:flex; align-items:center; gap:7px;
          padding:6px 10px; background:#252627; border-bottom:1px solid #111; box-shadow:0 1px 5px #0008;
          position:relative; z-index:20; white-space:nowrap; }
        .cmc-pdf-title { min-width:90px; max-width:28vw; overflow:hidden; text-overflow:ellipsis; font-weight:600; margin-right:auto; }
        .cmc-pdf-button, .cmc-pdf-input { color:#f5f5f5; background:#3a3c3e; border:1px solid #626568;
          border-radius:5px; min-height:30px; box-sizing:border-box; font:inherit; }
        .cmc-pdf-button { padding:4px 9px; cursor:pointer; }
        .cmc-pdf-button:hover, .cmc-pdf-button:focus-visible { background:#505356; border-color:#9ba0a4; }
        .cmc-pdf-input { width:55px; padding:3px 5px; text-align:center; }
        .cmc-pdf-search { width:min(230px,20vw); text-align:left; }
        .cmc-pdf-status { min-width:74px; color:#d9dcdf; font-variant-numeric:tabular-nums; }
        .cmc-pdf-pages { height:calc(100% - 48px); overflow:auto; padding:22px 20px 70vh; box-sizing:border-box;
          overflow-anchor:none; }
        .cmc-pdf-page { position:relative; margin:0 auto 22px; background:white; box-shadow:0 2px 12px #000a;
          overflow:hidden; user-select:text; }
        .cmc-pdf-page canvas { position:absolute; inset:0; display:block; user-select:none; }
        .cmc-pdf-text-layer { position:absolute; inset:0; overflow:clip; opacity:1; line-height:1;
          text-size-adjust:none; forced-color-adjust:none; transform-origin:0 0; caret-color:CanvasText; z-index:2; }
        .cmc-pdf-text-layer :is(span,br) { color:transparent; position:absolute; white-space:pre; cursor:text;
          transform-origin:0 0; margin:0; padding:0; }
        .cmc-pdf-text-layer > :not(.markedContent), .cmc-pdf-text-layer .markedContent span:not(.markedContent) {
          z-index:1; font-size:calc(var(--text-scale-factor) * var(--font-height));
          transform:rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv)); }
        .cmc-pdf-text-layer { --text-scale-factor:calc(var(--total-scale-factor) * var(--min-font-size));
          --min-font-size-inv:calc(1 / var(--min-font-size)); }
        .cmc-pdf-text-layer span::selection { color:transparent; background:rgba(0,98,255,.34); }
        .cmc-pdf-text-layer br::selection { background:transparent; }
        .cmc-pdf-page-number { position:absolute; right:7px; bottom:5px; z-index:3; color:#555; background:#fffB;
          border-radius:3px; padding:1px 4px; font-size:11px; user-select:none; pointer-events:none; }
        .cmc-pdf-loading { position:fixed; inset:48px 0 0; display:grid; place-items:center; z-index:30;
          color:#fff; background:#4a4d50; font-size:16px; }
        .cmc-pdf-loading[hidden] { display:none; }
        .cmc-pdf-error { max-width:620px; margin:14vh auto; padding:28px; color:#222; background:#fff;
          border-radius:10px; box-shadow:0 4px 24px #0008; }
        @media (max-width:760px) { .cmc-pdf-title, .cmc-pdf-search-controls { display:none; }
          .cmc-pdf-toolbar { gap:4px; padding-inline:5px; } .cmc-pdf-button { padding-inline:7px; }
          .cmc-pdf-pages { padding-inline:6px; } }
        @media print { html,body,.cmc-pdf-viewer-root,.cmc-pdf-pages { height:auto; overflow:visible; background:white; }
          .cmc-pdf-toolbar,.cmc-pdf-page-number,.cmc-pdf-loading { display:none!important; }
          .cmc-pdf-pages { padding:0; } .cmc-pdf-page { box-shadow:none; margin:0; break-after:page; } }
      `;
      (document.head || document.documentElement).appendChild(style);
      if (!document.body) document.documentElement.appendChild(document.createElement('body'));
      for (const child of Array.from(document.body.children)) if (child !== root) child.remove();
      root.className = 'cmc-pdf-viewer-root';
      root.hidden = false;
      root.replaceChildren();

      const toolbar = create('header', 'cmc-pdf-toolbar');
      const filename = (() => {
        try { return decodeURIComponent(new URL(sourceUrl).pathname.split('/').pop() || 'PDF'); }
        catch (_error) { return 'PDF'; }
      })();
      toolbar.appendChild(create('div', 'cmc-pdf-title', filename));
      const previousPage = button('‹', 'Previous page', () => goToPage(currentPage - 1));
      const pageInput = create('input', 'cmc-pdf-input');
      pageInput.type = 'number'; pageInput.min = '1'; pageInput.value = '1'; pageInput.setAttribute('aria-label', 'Page number');
      const pageTotal = create('span', 'cmc-pdf-status', '/ …');
      const nextPage = button('›', 'Next page', () => goToPage(currentPage + 1));
      toolbar.append(previousPage, pageInput, pageTotal, nextPage);
      toolbar.appendChild(button('−', 'Zoom out', () => setScale(scale / 1.15)));
      const zoomLabel = create('span', 'cmc-pdf-status', '100%');
      toolbar.appendChild(zoomLabel);
      toolbar.appendChild(button('+', 'Zoom in', () => setScale(scale * 1.15)));
      toolbar.appendChild(button('Fit', 'Fit page width', () => fitWidth()));
      const searchControls = create('span', 'cmc-pdf-search-controls');
      const searchInput = create('input', 'cmc-pdf-input cmc-pdf-search');
      searchInput.type = 'search'; searchInput.placeholder = 'Find in document'; searchInput.setAttribute('aria-label', 'Find in PDF');
      const searchStatus = create('span', 'cmc-pdf-status', '');
      searchControls.append(searchInput,
        button('↑', 'Previous search result', () => moveSearch(-1)),
        button('↓', 'Next search result', () => moveSearch(1)), searchStatus);
      toolbar.appendChild(searchControls);
      const download = create('a', 'cmc-pdf-button', 'Download');
      download.href = sourceUrl; download.download = filename; download.title = 'Download original PDF';
      toolbar.appendChild(download);
      toolbar.appendChild(button('Browser viewer', 'Use the browser\'s original PDF viewer once', openBrowserViewer));
      const pagesHost = create('main', 'cmc-pdf-pages');
      pagesHost.setAttribute('aria-label', 'PDF document');
      const loading = create('div', 'cmc-pdf-loading', 'Opening PDF…');
      root.append(toolbar, pagesHost, loading);

      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const loadingOptions = {
        cMapUrl: packageBase + 'cmaps/',
        cMapPacked: true,
        standardFontDataUrl: packageBase + 'standard_fonts/',
        iccUrl: packageBase + 'iccs/',
        useWasm: false,
        enableScripting: false,
        isEvalSupported: false,
        fontExtraProperties: true
      };
      let loadingTask = null;
      const createLoadingTask = (source) => {
        const task = pdfjs.getDocument({ ...loadingOptions, ...source });
        task.onProgress = (progress) => {
          if (!progress || !progress.total) return;
          loading.textContent = 'Opening PDF… ' + Math.min(100, Math.round(progress.loaded * 100 / progress.total)) + '%';
        };
        task.onPassword = (updatePassword, reason) => {
          const value = prompt(reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD
            ? 'Incorrect password. Enter the PDF password:'
            : 'Enter the PDF password:');
          if (value == null) task.destroy();
          else updatePassword(value);
        };
        return task;
      };
      loadingTask = createLoadingTask({ url: sourceUrl.split('#')[0] });

      let pdfDocument = null;
      let scale = 1;
      let baseWidth = 612;
      let baseHeight = 792;
      let currentPage = 1;
      let renderGeneration = 0;
      let observer = null;
      let renderUseSerial = 0;
      const states = [];
      const searchTexts = [];
      let searchMatches = [];
      let searchIndex = -1;

      const matrixMultiply = (left, right) => [
        left[0] * right[0] + left[2] * right[1],
        left[1] * right[0] + left[3] * right[1],
        left[0] * right[2] + left[2] * right[3],
        left[1] * right[2] + left[3] * right[3],
        left[0] * right[4] + left[2] * right[5] + left[4],
        left[1] * right[4] + left[3] * right[5] + left[5]
      ];
      const transformPoint = (matrix, x, y) => ({
        x: matrix[0] * x + matrix[2] * y + matrix[4],
        y: matrix[1] * x + matrix[3] * y + matrix[5]
      });
      const radicalRulesFromOperatorList = (operatorList) => {
        const rules = [];
        let matrix = [1, 0, 0, 1, 0, 0];
        const stack = [];
        const fnArray = operatorList && operatorList.fnArray || [];
        const argsArray = operatorList && operatorList.argsArray || [];
        if (fnArray.length > MAX_OPERATOR_STEPS || argsArray.length > MAX_OPERATOR_STEPS) {
          throw new Error('This PDF page has too much drawing geometry to analyze safely.');
        }
        let pathSteps = 0;
        for (let index = 0; index < fnArray.length; index += 1) {
          const fn = fnArray[index];
          const args = argsArray[index] || [];
          if (fn === pdfjs.OPS.save) { stack.push(matrix.slice()); continue; }
          if (fn === pdfjs.OPS.restore) { if (stack.length) matrix = stack.pop(); continue; }
          if (fn === pdfjs.OPS.transform) { matrix = matrixMultiply(matrix, Array.from(args)); continue; }
          if (fn !== pdfjs.OPS.constructPath || args[0] !== pdfjs.OPS.stroke) continue;
          const encodedPath = args[1];
          const pathSource = Array.isArray(encodedPath) && encodedPath.length === 1 &&
            ArrayBuffer.isView(encodedPath[0]) ? encodedPath[0] : (encodedPath || []);
          if (!pathSource || Number(pathSource.length) + pathSteps > MAX_OPERATOR_STEPS) {
            throw new Error('This PDF page has too much path geometry to analyze safely.');
          }
          const path = Array.from(pathSource);
          let cursor = 0;
          let point = null;
          while (cursor < path.length) {
            pathSteps += 1;
            if (pathSteps > MAX_OPERATOR_STEPS) {
              throw new Error('This PDF page has too much path geometry to analyze safely.');
            }
            const operation = path[cursor++];
            if (operation === 0 || operation === 1) {
              if (cursor + 1 >= path.length) break;
              const next = transformPoint(matrix, Number(path[cursor++]), Number(path[cursor++]));
              if (operation === 1 && point && Math.abs(next.y - point.y) < 0.08 && Math.abs(next.x - point.x) > 0.5) {
                rules.push({ x1: point.x, x2: next.x, y: (point.y + next.y) / 2 });
                if (rules.length > MAX_PDF_GEOMETRY_RULES) {
                  throw new Error('This PDF page has too many layout rules to analyze safely.');
                }
              }
              point = next;
            } else if (operation === 2) cursor += 6;
            else if (operation === 3) cursor += 4;
            else if (operation !== 4) break;
          }
        }
        return rules;
      };

      const setPageDimensions = (state, viewport) => {
        if (!viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) ||
            !Number.isFinite(viewport.scale) || viewport.width <= 0 || viewport.height <= 0 ||
            viewport.width > MAX_VIEWPORT_DIMENSION || viewport.height > MAX_VIEWPORT_DIMENSION) {
          throw new Error('This PDF page has invalid or unsupported dimensions.');
        }
        state.element.style.width = viewport.width + 'px';
        state.element.style.height = viewport.height + 'px';
        state.element.style.setProperty('--scale-factor', String(viewport.scale));
        state.element.style.setProperty('--user-unit', '1');
        state.element.style.setProperty('--total-scale-factor', String(viewport.scale));
        state.element.style.setProperty('--scale-round-x', '1px');
        state.element.style.setProperty('--scale-round-y', '1px');
      };
      const radicalCharacterCount = (span, item, viewport, state) => {
        if (!item.radical || item.semantic === 'root' || !Number.isFinite(item.radicalEndX)) return 0;
        if (item.x >= item.radicalEndX - item.size * 0.04) return 0;
        if (item.x + item.width <= item.radicalEndX + item.size * 0.06) return item.text.length;
        const textNode = span.firstChild;
        if (textNode && textNode.nodeType === 3 && document.createRange) {
          try {
            const pageRect = state.element.getBoundingClientRect();
            const viewportEnd = viewport.convertToViewportPoint(item.radicalEndX, item.y)[0];
            const target = pageRect.left + viewportEnd;
            const range = document.createRange();
            let count = 0;
            let boundaries = [];
            try {
              if (typeof Intl.Segmenter === 'function') {
                const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
                boundaries = Array.from(segmenter.segment(textNode.data), (entry) => entry.index + entry.segment.length);
              }
            } catch (_error) { boundaries = []; }
            if (!boundaries.length) {
              let offset = 0;
              for (const character of Array.from(textNode.data)) {
                offset += character.length;
                if (offset === textNode.length || !/^[\p{M}\u200d\ufe0e\ufe0f]/u.test(textNode.data.slice(offset))) {
                  boundaries.push(offset);
                }
              }
            }
            for (const offset of boundaries) {
              range.setStart(textNode, 0); range.setEnd(textNode, offset);
              const rect = range.getBoundingClientRect();
              if (rect.right <= target + Math.max(0.8, viewport.scale * 0.35)) count = offset;
              else break;
            }
            if (count) return count;
          } catch (_error) { /* use geometric fallback */ }
        }
        const fraction = Math.max(0, Math.min(1, (item.radicalEndX - item.x) / Math.max(item.width, 0.01)));
        return Math.max(0, Math.min(item.text.length, Math.ceil(fraction * item.text.length - 0.12)));
      };

      const releaseCanvas = (state) => {
        if (!state || !state.canvasReady || state.rendering) return;
        state.canvas.width = 1;
        state.canvas.height = 1;
        state.canvasReady = false;
      };
      const evictDistantCanvases = (centerPage) => {
        for (const state of states) {
          if (Math.abs(state.number - centerPage) > CANVAS_CACHE_RADIUS) releaseCanvas(state);
        }
      };
      const evictOldTextLayers = () => {
        const ready = states.filter((state) => state.textReady);
        if (ready.length <= MAX_TEXT_LAYER_PAGES) return;
        const removable = ready.filter((state) => !state.selectionPinned && !state.rendering)
          .sort((left, right) => left.lastUsed - right.lastUsed);
        let excess = ready.length - MAX_TEXT_LAYER_PAGES;
        for (const state of removable) {
          if (excess <= 0) break;
          state.textReady = false;
          state.textLayer.replaceChildren();
          state.element.removeAttribute('data-cmc-pdf-text-ready');
          state.element.removeAttribute('data-cmc-pdf-line-gap');
          excess -= 1;
        }
      };

      const renderPage = (pageNumber, force, textOnly) => {
        const state = states[pageNumber - 1];
        if (!state) return Promise.resolve();
        if (state.rendering) {
          if (state.renderPromise) {
            const requestedGeneration = renderGeneration;
            return state.renderPromise.then(
              () => requestedGeneration === renderGeneration ? renderPage(pageNumber, force, textOnly) : undefined,
              () => requestedGeneration === renderGeneration ? renderPage(pageNumber, force, textOnly) : undefined
            );
          }
          return Promise.resolve();
        }
        if (!force && state.textReady && (textOnly || state.canvasReady)) return Promise.resolve();
        state.rendering = true;
        const generation = renderGeneration;
        const invocation = {};
        state.renderInvocation = invocation;
        const operation = (async () => {
          try {
          const page = await pdfDocument.getPage(pageNumber);
          const viewport = page.getViewport({ scale });
          setPageDimensions(state, viewport);
          if (!textOnly && (force || !state.canvasReady)) {
            const pagePixels = Math.max(1, viewport.width * viewport.height);
            const deviceRatio = Math.max(Number.EPSILON, Number(devicePixelRatio) || 1);
            const pixelRatio = Math.min(
              2,
              deviceRatio,
              Math.sqrt(MAX_CANVAS_PIXELS / pagePixels),
              MAX_CANVAS_DIMENSION / Math.max(1, viewport.width),
              MAX_CANVAS_DIMENSION / Math.max(1, viewport.height)
            );
            if (!Number.isFinite(pixelRatio) || pixelRatio <= 0) {
              throw new Error('This PDF page cannot be rasterized safely.');
            }
            const canvasWidth = Math.max(1, Math.floor(viewport.width * pixelRatio));
            const canvasHeight = Math.max(1, Math.floor(viewport.height * pixelRatio));
            if (canvasWidth > MAX_CANVAS_DIMENSION || canvasHeight > MAX_CANVAS_DIMENSION ||
                canvasWidth * canvasHeight > MAX_CANVAS_PIXELS) {
              throw new Error('This PDF page is too large to rasterize safely.');
            }
            state.canvas.width = canvasWidth;
            state.canvas.height = canvasHeight;
            state.canvas.style.width = viewport.width + 'px';
            state.canvas.style.height = viewport.height + 'px';
            const context = state.canvas.getContext('2d', { alpha: false });
            const renderTask = page.render({
              canvasContext: context,
              viewport,
              transform: Math.abs(pixelRatio - 1) < 0.001 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0]
            });
            state.renderTask = renderTask;
            await renderTask.promise;
            if (generation !== renderGeneration) return;
            state.canvasReady = true;
          }
          if (force || !state.textReady) {
            const [textContent, operatorList] = await Promise.all([
              page.getTextContent({ includeMarkedContent: false }), page.getOperatorList()
            ]);
            if (generation !== renderGeneration) return;
            if (!textContent || !Array.isArray(textContent.items) ||
                textContent.items.length > MAX_PDF_PAGE_ITEMS) {
              throw new Error('This PDF page has too many text items to analyze safely.');
            }
            let textCharacters = 0;
            for (const item of textContent.items) {
              textCharacters += String(item && item.str || '').length;
              if (textCharacters > MAX_PDF_PAGE_CHARACTERS) {
                throw new Error('This PDF page contains too much text to analyze safely.');
              }
            }
            searchTexts[pageNumber - 1] = textContent.items.map((item) => item.str || '').join(' ');
            const fontRecords = Object.create(null);
            for (const item of textContent.items) {
              if (!item.fontName || Object.prototype.hasOwnProperty.call(fontRecords, item.fontName)) continue;
              try {
                const font = page.commonObjs.get(item.fontName);
                fontRecords[item.fontName] = {
                  name: font && font.name || '', loadedName: font && font.loadedName || ''
                };
              } catch (_error) { fontRecords[item.fontName] = {}; }
            }
            const analysis = analyzePage(
              textContent.items, textContent.styles, fontRecords, radicalRulesFromOperatorList(operatorList)
            );
            if (!analysis || analysis.overBudget) {
              throw new Error('This PDF page is too complex to analyze safely.');
            }
            state.textLayer.replaceChildren();
            const textLayer = new pdfjs.TextLayer({
              textContentSource: textContent,
              container: state.textLayer,
              viewport
            });
            state.textLayerTask = textLayer;
            await textLayer.render();
            if (generation !== renderGeneration) return;
            state.element.setAttribute('data-cmc-pdf-line-gap', String(analysis.normalLineGap || 0));
            const linesById = new Map(analysis.lines.map((line) => [line.id, line]));
            for (let index = 0; index < analysis.items.length; index += 1) {
              const item = analysis.items[index];
              const span = textLayer.textDivs[index];
              if (!span || !span.isConnected || !item.text || /^\s+$/u.test(item.text)) continue;
              // Keep the selectable layer aligned with authenticated legacy
              // font normalization. The canvas remains the visual source of
              // truth; these replacements are one glyph for one glyph, so
              // TextLayer geometry and partial-selection offsets stay exact.
              if (span.textContent !== item.text && span.textContent.length === item.text.length) {
                span.textContent = item.text;
              }
              const line = linesById.get(item.line);
              span.setAttribute('data-cmc-pdf-item', String(item.index));
              span.setAttribute('data-cmc-pdf-line', String(item.line));
              span.setAttribute('data-cmc-pdf-line-y', String(line ? line.y : item.effectiveY));
              span.setAttribute('data-cmc-pdf-x', String(item.x));
              span.setAttribute('data-cmc-pdf-width', String(item.width));
              span.setAttribute('data-cmc-pdf-size', String(item.size));
              if (item.math) span.setAttribute('data-cmc-pdf-math', '1');
              if (item.mathGroup) span.setAttribute('data-cmc-pdf-math-group', item.mathGroup);
              if (item.displayMath) span.setAttribute('data-cmc-pdf-display-math', '1');
              if (item.semantic) span.setAttribute('data-cmc-pdf-semantic', item.semantic);
              if (item.accent) {
                span.setAttribute('data-cmc-pdf-accent', item.accent);
                span.setAttribute('data-cmc-pdf-accent-base', String(item.accentBase));
              }
              if (item.script) {
                span.setAttribute('data-cmc-pdf-script', item.script);
                span.setAttribute('data-cmc-pdf-script-base', String(item.scriptBase));
              }
              if (item.radical) {
                span.setAttribute('data-cmc-pdf-radical', item.radical);
                span.setAttribute('data-cmc-pdf-radical-end', String(item.radicalEndX));
                span.setAttribute('data-cmc-pdf-radical-chars', String(radicalCharacterCount(span, item, viewport, state)));
              }
              if (item.fraction) {
                span.setAttribute('data-cmc-pdf-fraction', item.fraction);
                span.setAttribute('data-cmc-pdf-fraction-role', item.fractionRole);
                span.setAttribute('data-cmc-pdf-fraction-x1', String(item.fractionX1));
                span.setAttribute('data-cmc-pdf-fraction-x2', String(item.fractionX2));
              }
            }
            state.textReady = true;
            state.lastUsed = ++renderUseSerial;
            state.element.setAttribute('data-cmc-pdf-text-ready', '1');
          }
          evictDistantCanvases(currentPage);
          evictOldTextLayers();
          } catch (error) {
            if (!error || error.name !== 'RenderingCancelledException') {
              state.element.setAttribute('data-cmc-pdf-render-error', '1');
            }
          } finally {
            if (state.renderInvocation === invocation) {
              state.rendering = false;
              state.renderTask = null;
              state.textLayerTask = null;
              state.renderPromise = null;
            }
          }
        })();
        state.renderPromise = operation;
        return operation;
      };

      const goToPage = (pageNumber) => {
        if (!pdfDocument) return;
        const normalized = Math.max(1, Math.min(pdfDocument.numPages, Number(pageNumber) || 1));
        currentPage = normalized;
        pageInput.value = String(normalized);
        renderPage(normalized);
        states[normalized - 1].element.scrollIntoView({ block: 'start', behavior: 'auto' });
      };
      const setScale = (nextScale) => {
        if (!pdfDocument) return;
        const normalized = Math.max(0.35, Math.min(3, Number(nextScale) || 1));
        if (Math.abs(normalized - scale) < 0.001) return;
        scale = normalized;
        zoomLabel.textContent = Math.round(scale * 100) + '%';
        renderGeneration += 1;
        const scaleGeneration = renderGeneration;
        for (const state of states) {
          if (state.renderTask && typeof state.renderTask.cancel === 'function') {
            try { state.renderTask.cancel(); } catch (_error) { /* ignore */ }
          }
          if (state.textLayerTask && typeof state.textLayerTask.cancel === 'function') {
            try { state.textLayerTask.cancel(); } catch (_error) { /* ignore */ }
          }
          state.canvasReady = false;
          state.textReady = false;
          state.element.removeAttribute('data-cmc-pdf-text-ready');
          const resetAtNewScale = () => {
            if (scaleGeneration !== renderGeneration) return;
            state.canvas.width = 1;
            state.canvas.height = 1;
            state.textLayer.replaceChildren();
            setPageDimensions(state, { width: baseWidth * scale, height: baseHeight * scale, scale });
            if (Math.abs(state.number - currentPage) <= 2) renderPage(state.number, true);
          };
          if (state.renderPromise) {
            Promise.resolve(state.renderPromise).then(resetAtNewScale, resetAtNewScale);
          } else resetAtNewScale();
        }
      };
      const fitWidth = () => setScale(Math.max(0.35, (pagesHost.clientWidth - 32) / baseWidth));
      const updateCurrentPage = () => {
        const hostRect = pagesHost.getBoundingClientRect();
        const hit = document.elementFromPoint(hostRect.left + Math.min(24, hostRect.width / 2), hostRect.top + 12);
        const pageElement = hit && hit.closest ? hit.closest('[data-cmc-pdf-page]') : null;
        const estimated = Math.round(pagesHost.scrollTop / Math.max(1, baseHeight * scale + 22)) + 1;
        const best = pageElement
          ? Number(pageElement.getAttribute('data-cmc-pdf-page')) || currentPage
          : Math.max(1, Math.min(pdfDocument.numPages, estimated));
        if (best !== currentPage) {
          currentPage = best; pageInput.value = String(best);
          evictDistantCanvases(currentPage);
          try {
            const address = new URL(sourceUrl, location.href);
            address.hash = 'page=' + best;
            history.replaceState(null, '', address.href);
          } catch (_error) { /* ignore */ }
        }
      };
      const searchDocument = async () => {
        if (!pdfDocument) return;
        const query = searchInput.value.trim().toLocaleLowerCase();
        searchMatches = []; searchIndex = -1;
        if (!query) { searchStatus.textContent = ''; return; }
        searchStatus.textContent = 'Searching…';
        let searchLimited = false;
        let cachedCharacters = searchTexts.reduce((total, value) => total + String(value || '').length, 0);
        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
          if (!searchTexts[pageNumber - 1]) {
            const page = await pdfDocument.getPage(pageNumber);
            const content = await page.getTextContent({ includeMarkedContent: false });
            if (!content || !Array.isArray(content.items) || content.items.length > MAX_PDF_PAGE_ITEMS) {
              searchLimited = true; break;
            }
            const pageText = content.items.map((item) => item.str || '').join(' ');
            if (pageText.length > MAX_PDF_PAGE_CHARACTERS ||
                cachedCharacters + pageText.length > MAX_SEARCH_CACHE_CHARACTERS) {
              searchLimited = true; break;
            }
            searchTexts[pageNumber - 1] = pageText;
            cachedCharacters += pageText.length;
          }
          const haystack = searchTexts[pageNumber - 1].toLocaleLowerCase();
          let offset = 0;
          while ((offset = haystack.indexOf(query, offset)) >= 0) {
            searchMatches.push(pageNumber); offset += Math.max(1, query.length);
            if (searchMatches.length >= 10000) break;
          }
          if (searchMatches.length >= 10000) break;
        }
        if (searchLimited) searchStatus.textContent = 'Search limit reached';
        else if (!searchMatches.length) searchStatus.textContent = '0 results';
        else { searchIndex = 0; searchStatus.textContent = '1 / ' + searchMatches.length; goToPage(searchMatches[0]); }
      };
      const moveSearch = (delta) => {
        if (!searchMatches.length) { searchDocument(); return; }
        searchIndex = (searchIndex + delta + searchMatches.length) % searchMatches.length;
        searchStatus.textContent = (searchIndex + 1) + ' / ' + searchMatches.length;
        goToPage(searchMatches[searchIndex]);
      };
      let selectionRenderPending = null;
      const renderSelectedTextLayers = () => {
        if (selectionRenderPending) return selectionRenderPending;
        selectionRenderPending = (async () => {
          const selection = document.getSelection ? document.getSelection() : null;
          const ranges = [];
          if (selection && !selection.isCollapsed) {
            const count = Math.min(64, Number(selection.rangeCount) || 0);
            for (let index = 0; index < count; index += 1) {
              try { ranges.push(selection.getRangeAt(index)); } catch (_error) { break; }
            }
          }
          const requested = states.filter((state) => ranges.some((range) => {
            try { return range.intersectsNode(state.element); } catch (_error) { return false; }
          }));
          if (requested.length > 64) return;
          for (const state of requested) state.selectionPinned = true;
          const previousStatus = searchStatus.textContent;
          try {
            for (let index = 0; index < requested.length; index += 1) {
              searchStatus.textContent = 'Preparing copy ' + (index + 1) + ' / ' + requested.length;
              await renderPage(requested[index].number, false, true);
            }
          } finally {
            searchStatus.textContent = previousStatus;
          }
        })().finally(() => {
          selectionRenderPending = null;
          try { root.dispatchEvent(new Event(PDF_SELECTION_READY_EVENT)); } catch (_error) { /* ignore */ }
          for (const state of states) state.selectionPinned = false;
          evictOldTextLayers();
        });
        return selectionRenderPending;
      };
      root.addEventListener(PDF_RENDER_SELECTION_EVENT, renderSelectedTextLayers, false);
      pageInput.addEventListener('change', () => goToPage(pageInput.value));
      searchInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') searchDocument(); });
      pagesHost.addEventListener('scroll', () => requestAnimationFrame(updateCurrentPage), { passive: true });
      addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
          event.preventDefault(); searchInput.focus(); searchInput.select();
        } else if ((event.ctrlKey || event.metaKey) && ['+', '='].includes(event.key)) {
          event.preventDefault(); setScale(scale * 1.15);
        } else if ((event.ctrlKey || event.metaKey) && event.key === '-') {
          event.preventDefault(); setScale(scale / 1.15);
        } else if ((event.ctrlKey || event.metaKey) && event.key === '0') {
          event.preventDefault(); fitWidth();
        }
      });

      const openPdf = async () => {
        try {
          return await loadingTask.promise;
        } catch (initialError) {
          if (typeof loadPdfBytes !== 'function') throw initialError;
          loading.textContent = 'Opening protected PDF…';
          const bytes = await loadPdfBytes();
          if (!bytes || !bytes.byteLength) throw initialError;
          loadingTask = createLoadingTask({ data: new Uint8Array(bytes) });
          return loadingTask.promise;
        }
      };
      openPdf().then(async (loadedPdf) => {
        pdfDocument = loadedPdf;
        if (!Number.isSafeInteger(pdfDocument.numPages) || pdfDocument.numPages < 1 ||
            pdfDocument.numPages > MAX_PDF_PAGES) {
          throw new Error('This PDF has too many pages for the selectable viewer. Use the browser viewer instead.');
        }
        const firstPage = await pdfDocument.getPage(1);
        const baseViewport = firstPage.getViewport({ scale: 1 });
        baseWidth = baseViewport.width; baseHeight = baseViewport.height;
        scale = Math.max(0.55, Math.min(1.75, (pagesHost.clientWidth - 34) / baseWidth));
        zoomLabel.textContent = Math.round(scale * 100) + '%';
        pageTotal.textContent = '/ ' + pdfDocument.numPages;
        pageInput.max = String(pdfDocument.numPages);
        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
          const element = create('section', 'cmc-pdf-page');
          element.setAttribute('data-cmc-pdf-page', String(pageNumber));
          element.setAttribute('aria-label', 'Page ' + pageNumber);
          const canvas = create('canvas');
          canvas.width = 1; canvas.height = 1;
          const textLayer = create('div', 'cmc-pdf-text-layer');
          const label = create('span', 'cmc-pdf-page-number', String(pageNumber));
          element.append(canvas, textLayer, label);
          const state = { number: pageNumber, element, canvas, textLayer, canvasReady: false, textReady: false, rendering: false,
            renderTask: null, textLayerTask: null, renderPromise: null, renderInvocation: null,
            lastUsed: 0, selectionPinned: false };
          states.push(state); pagesHost.appendChild(element);
          setPageDimensions(state, { width: baseWidth * scale, height: baseHeight * scale, scale });
        }
        if (typeof IntersectionObserver === 'function') {
          observer = new IntersectionObserver((entries) => {
            for (const entry of entries) if (entry.isIntersecting) {
              const pageNumber = Number(entry.target.getAttribute('data-cmc-pdf-page')) || 1;
              for (let near = Math.max(1, pageNumber - 1); near <= Math.min(pdfDocument.numPages, pageNumber + 1); near += 1) {
                renderPage(near);
              }
            }
          }, { root: pagesHost, rootMargin: '120% 0px', threshold: 0.01 });
          for (const state of states) observer.observe(state.element);
        }
        const hashMatch = sourceHash.match(/(?:^#|[&#])page=(\d+)/i);
        currentPage = Math.max(1, Math.min(pdfDocument.numPages, hashMatch ? Number(hashMatch[1]) : 1));
        pageInput.value = String(currentPage);
        loading.hidden = true;
        await Promise.all([
          renderPage(currentPage),
          currentPage > 1 ? renderPage(currentPage - 1) : Promise.resolve(),
          currentPage < pdfDocument.numPages ? renderPage(currentPage + 1) : Promise.resolve()
        ]);
        states[currentPage - 1].element.scrollIntoView({ block: 'start' });
      }).catch(fail);
    } catch (error) {
      fail(error);
    }
  }

  function showPdfViewerBootstrapError(root, error, pageWindow, sourceUrl) {
    if (!root || !root.ownerDocument) return;
    const documentObject = root.ownerDocument;
    root.hidden = false;
    root.textContent = '';
    const panel = documentObject.createElement('main');
    panel.style.cssText = 'max-width:640px;margin:12vh auto;padding:28px;background:white;color:#222;border-radius:10px;font:16px/1.45 system-ui';
    const heading = documentObject.createElement('h1');
    heading.textContent = 'Clean Math Copy could not open this PDF';
    const detail = documentObject.createElement('p');
    detail.textContent = String(error && error.message || error || 'Unknown PDF error');
    const browserViewer = documentObject.createElement('button');
    browserViewer.type = 'button';
    browserViewer.textContent = 'Open browser viewer';
    browserViewer.style.cssText = 'padding:8px 12px;font:inherit;cursor:pointer';
    browserViewer.addEventListener('click', () => {
      try {
        pageWindow.sessionStorage.setItem(PDF_VIEWER_BYPASS_KEY, String(sourceUrl || '').split('#')[0]);
      } catch (_error) { /* a reload still gives the browser another chance */ }
      pageWindow.location.reload();
    });
    panel.append(heading, detail, browserViewer);
    root.appendChild(panel);
  }

  function createPdfViewerRoot(documentObject, pageWindow) {
    let body = documentObject.body;
    if (!body) {
      body = documentObject.createElement('body');
      documentObject.documentElement.appendChild(body);
    }
    const random = new Uint32Array(4);
    try { (pageWindow.crypto || global.crypto).getRandomValues(random); }
    catch (_error) { for (let index = 0; index < random.length; index += 1) random[index] = Math.random() * 0xffffffff; }
    const root = documentObject.createElement('div');
    root.id = 'clean-math-copy-pdf-' + Array.from(random, (value) => Math.floor(value).toString(36)).join('-');
    root.hidden = true;
    body.appendChild(root);
    registerTrustedPdfViewerRoot(root);
    try {
      Object.defineProperty(documentObject, '__cleanMathCopyPdfViewerRoot', { value: root, configurable: true });
    } catch (_error) {
      documentObject.__cleanMathCopyPdfViewerRoot = root;
    }
    return root;
  }

  async function executePinnedClassicSource(classicSource, documentObject) {
    const parent = documentObject.head || documentObject.documentElement;
    let script = null;
    const attributes = { textContent: classicSource };
    const nonceSource = documentObject.querySelector && documentObject.querySelector('script[nonce]');
    if (nonceSource) {
      const nonce = nonceSource.nonce || nonceSource.getAttribute('nonce');
      if (nonce) attributes.nonce = nonce;
    }
    try {
      if (typeof GM_addElement === 'function') script = await GM_addElement(parent, 'script', attributes);
      else if (global.GM && typeof global.GM.addElement === 'function') {
        script = await global.GM.addElement(parent, 'script', attributes);
      } else {
        script = documentObject.createElement('script');
        if (attributes.nonce) script.nonce = attributes.nonce;
        script.textContent = classicSource;
        parent.appendChild(script);
      }
    } finally {
      try { if (script && typeof script.remove === 'function') script.remove(); } catch (_error) { /* ignore */ }
    }
  }

  async function executePinnedPdfJsResource(moduleSource, documentObject, pageWindow, rootId) {
    const source = String(moduleSource || '');
    if (!source || source.length > 2 * 1024 * 1024) throw new Error('The bundled PDF engine is invalid.');
    const exportOffset = source.lastIndexOf('export{');
    const exportTail = exportOffset >= 0 ? source.slice(exportOffset) : '';
    if (exportOffset < 0 || !/^export\{[\s\S]*\};\s*$/.test(exportTail) ||
        !exportTail.includes('B as OPS') || !exportTail.includes('H as PasswordResponses') ||
        !exportTail.includes('Lt as version') || !exportTail.includes('getDocument') ||
        !exportTail.includes('GlobalWorkerOptions') || !exportTail.includes('OutputScale') ||
        !exportTail.includes('TextLayer')) {
      throw new Error('The bundled PDF engine has an unexpected format.');
    }
    const key = '__cleanMathCopyPdfJs_' + rootId.replace(/[^a-z0-9_-]/gi, '') + '_' + Math.random().toString(36).slice(2);
    const classicBody = source.slice(0, exportOffset)
      .replace(/\bimport\.meta\.url\b/g, JSON.stringify(PDFJS_API_SOURCE_URL));
    const classicSource = ';(()=>{\n' + classicBody + '\nObject.defineProperty(globalThis,' + JSON.stringify(key) +
      ',{value:{GlobalWorkerOptions,OPS:B,OutputScale,PasswordResponses:H,TextLayer,getDocument,version:Lt},configurable:true});\n})();';
    try {
      await executePinnedClassicSource(classicSource, documentObject);
      const pdfjs = pageWindow[key];
      if (!pdfjs || pdfjs.version !== '6.1.200' || typeof pdfjs.getDocument !== 'function') {
        throw new Error('The pinned PDF engine was blocked by this page.');
      }
      return pdfjs;
    } finally {
      try { delete pageWindow[key]; } catch (_error) { /* random key dies with this document */ }
    }
  }

  async function executePinnedPdfJsWorkerResource(moduleSource, documentObject, pageWindow) {
    const source = String(moduleSource || '');
    if (!source || source.length > 4 * 1024 * 1024) throw new Error('The bundled PDF worker is invalid.');
    const exportOffset = source.lastIndexOf('export{');
    const exportTail = exportOffset >= 0 ? source.slice(exportOffset) : '';
    const assignment = 'globalThis.pdfjsWorker={WorkerMessageHandler};';
    const assignmentOffset = source.lastIndexOf(assignment, exportOffset);
    if (exportOffset < 0 || assignmentOffset < 0 || !/^export\{WorkerMessageHandler\};\s*$/.test(exportTail)) {
      throw new Error('The bundled PDF worker has an unexpected format.');
    }
    const classicBody = source.slice(0, assignmentOffset)
      .replace(/\bimport\.meta\.url\b/g, JSON.stringify(PDFJS_WORKER_SOURCE_URL));
    const classicSource = ';(()=>{\n' + classicBody +
      '\nObject.defineProperty(globalThis,"pdfjsWorker",{value:{WorkerMessageHandler},configurable:true,writable:true});\n})();';
    await executePinnedClassicSource(classicSource, documentObject);
    if (!pageWindow.pdfjsWorker || typeof pageWindow.pdfjsWorker.WorkerMessageHandler !== 'function') {
      throw new Error('The pinned PDF worker was blocked by this page.');
    }
  }

  function pagePdfWorkerResource(moduleSource, pageWindow) {
    try {
      const BlobConstructor = pageWindow.Blob;
      const urlObject = pageWindow.URL;
      if (typeof BlobConstructor !== 'function' || !urlObject || typeof urlObject.createObjectURL !== 'function') {
        throw new Error('Page Blob URLs are unavailable.');
      }
      const blob = Reflect.construct(BlobConstructor, [[moduleSource], { type: 'text/javascript' }]);
      const url = Reflect.apply(urlObject.createObjectURL, urlObject, [blob]);
      return Promise.resolve({
        url: String(url),
        owned: true,
        revoke: () => Reflect.apply(urlObject.revokeObjectURL, urlObject, [url])
      });
    } catch (_error) {
      return userscriptModuleResource(PDFJS_WORKER_RESOURCE);
    }
  }

  function startPdfViewer(documentObject, pageWindow, sourceUrl) {
    if (documentObject.__cleanMathCopyPdfViewerRoot && documentObject.__cleanMathCopyPdfViewerRoot.isConnected) {
      return Promise.resolve(true);
    }
    const root = createPdfViewerRoot(documentObject, pageWindow);
    let resources = [];
    const revokeOwnedResources = () => {
      for (const resource of resources) {
        if (resource && resource.owned) {
          try {
            if (typeof resource.revoke === 'function') resource.revoke();
            else URL.revokeObjectURL(resource.url);
          } catch (_error) { /* ignore */ }
        }
      }
    };

    return Promise.all([
      readUserscriptResourceText(PDFJS_RESOURCE),
      readUserscriptResourceText(PDFJS_WORKER_RESOURCE)
    ]).then(async ([apiSource, workerSource]) => {
      const workerResource = await pagePdfWorkerResource(workerSource, pageWindow);
      resources = [workerResource];
      try { pageWindow.addEventListener('pagehide', revokeOwnedResources, { once: true }); }
      catch (_error) { /* resources live until this document is discarded */ }
      const pdfjs = await executePinnedPdfJsResource(apiSource, documentObject, pageWindow, root.id);
      await executePinnedPdfJsWorkerResource(workerSource, documentObject, pageWindow);
      const loadPdfBytes = () => requestCurrentPdfBytes(sourceUrl, pageWindow);
      cleanMathCopyPdfViewerMain(
        root.id, pdfjs, workerResource.url, analyzePdfPageText, PDF_VIEWER_BYPASS_KEY, loadPdfBytes,
        sourceUrl
      );
      return true;
    }).catch((error) => {
      revokeOwnedResources();
      showPdfViewerBootstrapError(root, error, pageWindow, sourceUrl);
      return false;
    });
  }

  function startDirectPdfViewer(documentObject, pageWindow) {
    if (!isDirectPdfDocument(documentObject, pageWindow)) return Promise.resolve(false);
    if (documentObject.__cleanMathCopyPdfViewerRoot && documentObject.__cleanMathCopyPdfViewerRoot.isConnected) {
      return Promise.resolve(true);
    }
    const sourceUrl = (() => {
      try { return String(pageWindow.location.href || ''); } catch (_error) { return ''; }
    })();
    const requestUrl = sourceUrl.split('#')[0];
    try {
      if (pageWindow.sessionStorage && pageWindow.sessionStorage.getItem(PDF_VIEWER_BYPASS_KEY) === requestUrl) {
        pageWindow.sessionStorage.removeItem(PDF_VIEWER_BYPASS_KEY);
        documentObject.__cleanMathCopyPdfViewerBypassed = true;
        return Promise.resolve(false);
      }
    } catch (_error) {
      // Session storage is optional; the custom viewer still works without it.
    }
    return startPdfViewer(documentObject, pageWindow, sourceUrl);
  }

  function loadInitialSettings() {
    try {
      if (typeof GM_getValue === 'function') {
        const legacyGetValue = GM_getValue;
        const stored = legacyGetValue(STORAGE_KEY, DEFAULT_SETTINGS);
        if (stored && typeof stored.then === 'function') {
          Promise.resolve(stored).catch(() => {});
          return {
            settings: normalizeSettings(DEFAULT_SETTINGS),
            // Re-read only after the storage listener is ready. The first
            // thenable was merely capability detection and may be stale.
            pendingRead: () => legacyGetValue(STORAGE_KEY, DEFAULT_SETTINGS)
          };
        }
        return { settings: normalizeSettings(stored), pendingRead: null };
      }
    } catch (_error) {
      // Try the modern manager API after subscribing to storage changes.
    }
    const modernRead = global.GM && typeof global.GM.getValue === 'function'
      ? () => global.GM.getValue(STORAGE_KEY, DEFAULT_SETTINGS)
      : null;
    try {
      const stored = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      return {
        settings: normalizeSettings(stored ? JSON.parse(stored) : DEFAULT_SETTINGS),
        pendingRead: modernRead
      };
    } catch (_error) {
      return { settings: normalizeSettings(DEFAULT_SETTINGS), pendingRead: modernRead };
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

  function writePlainClipboard(text) {
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
  // Clipboard writes are process-wide within this userscript realm, so the
  // newest user copy intent must also be shared by every installed document
  // and observed child frame.
  let clipboardIntentGeneration = 0;

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
      ? writePlainClipboard(payload.text).then((written) => Boolean(written && isCurrent()))
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
        for (const format of Array.isArray(payload.formats) ? payload.formats : []) {
          if (!format || typeof format.type !== 'string' || typeof format.text !== 'string') continue;
          const type = format.type.toLowerCase();
          if (!/^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/i.test(type) || Object.hasOwn(representations, type)) continue;
          representations[type] = new BlobConstructor([format.text], { type });
        }
        const hasEnhancedRepresentations = Object.keys(representations).some(
          (type) => !Object.hasOwn(baseRepresentations, type)
        );
        const write = (formats) => Promise.resolve().then(() => {
          if (!isCurrent()) return false;
          return Promise.resolve(clipboard.write([new ClipboardItemConstructor(formats)])).then(() => Boolean(isCurrent()));
        });
        return write(representations).then(
          (written) => written,
          () => {
            if (!isCurrent()) return false;
            return hasEnhancedRepresentations
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
    if (semantic.orderedIdentifiers !== native.orderedIdentifiers) return false;
    if (semantic.accents !== native.accents || semantic.orderedAccents !== native.orderedAccents) return false;
    if (!semantic.uncertainOperators && !native.uncertainOperators &&
        semantic.operators !== native.operators) return false;
    if (!semantic.uncertainOperators && !native.uncertainOperators &&
        semantic.orderedOperators !== native.orderedOperators) return false;
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

  function siteSemanticRichWrites(state, includeDefaultHTML) {
    const html = state && state.semanticPayload && state.semanticPayload.html;
    if (!html) return [];
    const richTypes = new Map(state.nativeRichValues || []);
    if (includeDefaultHTML && !richTypes.has('text/html')) {
      richTypes.set('text/html', { type: 'text/html' });
    }
    return Array.from(richTypes.values(), (native) => ({
      type: native.type,
      text: native.type.toLowerCase() === 'html format'
        ? clipboardHTMLFormat(html)
        : html
    }));
  }

  function applySitePayloadDirect(clipboardData, state) {
    if (!clipboardData || !state || !state.originalSetData || !sitePayloadAgreesWithPlain(state)) return false;
    try {
      const plainTypes = new Set([state.plainType || 'text/plain', 'text/plain']);
      for (const type of plainTypes) {
        state.originalSetData.call(clipboardData, type, state.semanticPayload.text);
        markSiteInjectedPlain(state, type);
      }
      // Add text/html only when it can be removed during rollback. Existing
      // rich flavors are always safe to replace because their native values
      // were captured before the semantic rewrite.
      const richWrites = siteSemanticRichWrites(state, Boolean(state.originalClearData));
      for (const write of richWrites) {
        state.originalSetData.call(clipboardData, write.type, write.text);
        markSiteInjectedRich(state, write.type);
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
    for (const type of types.filter(siteRichHTMLType)) {
      recordSiteNativeRich(state, type, clipboardGet(event.clipboardData, type));
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
    const normalizedNativeTypes = new Set(types.map((type) => String(type || '').toLowerCase()));
    const canClear = typeof event.clipboardData.clearData === 'function';
    // Write rich formats first and plain text last. A rejection restores every
    // previously accepted flavor before the event is allowed to continue.
    const writes = siteSemanticRichWrites(state, canClear);
    writes.push({ type: plainType, text: state.semanticPayload.text });
    const nativeValues = new Map();
    const writtenTypes = [];
    try {
      for (const write of writes) {
        nativeValues.set(write.type, {
          existed: normalizedNativeTypes.has(write.type.toLowerCase()),
          value: clipboardGet(event.clipboardData, write.type)
        });
        event.clipboardData.setData(write.type, write.text);
        writtenTypes.push(write.type);
      }
      state.rewritten = true;
      event.preventDefault();
    } catch (_error) {
      for (let index = writtenTypes.length - 1; index >= 0; index -= 1) {
        const type = writtenTypes[index];
        const native = nativeValues.get(type);
        try {
          if (native && native.existed) event.clipboardData.setData(type, native.value);
          else if (canClear) event.clipboardData.clearData(type);
        } catch (_restoreError) {
          // Best effort only; the event remains uncancelled so the browser and
          // site retain control when this non-wrappable fallback is hostile.
        }
      }
      state.rewritten = false;
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
            const writes = [];
            if (injectedValues.get(requestedKey) !== response.text) {
              writes.push({ type: requestedType, key: requestedKey, text: response.text });
            }
            if (requestedKey !== 'text/plain' && injectedValues.get('text/plain') !== response.text) {
              writes.push({ type: 'text/plain', key: 'text/plain', text: response.text });
            }
            for (const item of Array.isArray(response.richWrites) ? response.richWrites.slice(0, 2) : []) {
              if (!item || typeof item.type !== 'string' || typeof item.text !== 'string') continue;
              const itemKey = normalizedType(item.type);
              if (injectedValues.get(itemKey) === item.text) continue;
              writes.push({ type: item.type, key: itemKey, text: item.text });
            }
            // Every accepted flavor is one transaction. If a browser rejects
            // a later rich write, restore the site's native values (or remove
            // newly introduced flavors) before leaving the event uncancelled.
            if (!nativeClear && writes.some((write) => !nativeValues.has(write.key))) {
              throw new TypeError('Cannot roll back relayed clipboard write');
            }
            const applied = [];
            try {
              for (const write of writes) {
                reflectApply(nativeSet, data, [write.type, write.text]);
                applied.push(write);
                injectedValues.set(write.key, write.text);
              }
            } catch (writeError) {
              const restored = new Set();
              for (let index = applied.length - 1; index >= 0; index -= 1) {
                const write = applied[index];
                if (restored.has(write.key)) continue;
                restored.add(write.key);
                const native = nativeValues.get(write.key);
                try {
                  if (native) reflectApply(nativeSet, data, [native.type, native.value]);
                  else if (nativeClear) reflectApply(nativeClear, data, [write.type]);
                } catch (_restoreError) {
                  // Best effort; never cancel an event after a failed rewrite.
                }
                injectedValues.delete(write.key);
              }
              throw writeError;
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

      const beginResponse = request('begin', '', '', false);
      if (!beginResponse) {
        // The private carrier can be removed by a document rewrite or become
        // unavailable during teardown. Without a live controller there is
        // nothing to relay, so never patch page-owned event/DataTransfer APIs.
        active = false;
        try { carrier.textContent = ''; } catch (_error) { /* ignore */ }
        return;
      }
      if (beginResponse && beginResponse.action === 'bypass') {
        // The userscript is in Original copy/paste mode. Leave DataTransfer,
        // propagation methods, clipboard formats, and default handling wholly
        // untouched for this event.
        active = false;
        carrier.textContent = '';
        return;
      }
      const captureAllNativeFormats = Boolean(beginResponse && beginResponse.action === 'capture');
      const recordNativeSet = (actualType, actualValue) => {
        if (!captureAllNativeFormats && !relayedType(actualType)) return;
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
        } else if (captureAllNativeFormats || relayedType(actualType)) {
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
          if (!captureAllNativeFormats && !relayedType(actualType)) continue;
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
        // stopPropagation() still permits later listeners on the same target.
        // Native capture must keep observing those writes and finalize from the
        // cleanup task after dispatch; semantic rewriting still has to finish
        // synchronously while DataTransfer remains writable.
        if (!captureAllNativeFormats) request('finalize', '', '', false);
        return reflectApply(nativeStop, event, []);
      };
      const wrappedStopImmediate = function cleanMathCopyRelayedStopImmediatePropagation() {
        harvestFinalClipboard();
        // The calling listener continues after stopImmediatePropagation() and
        // may still write clipboard data. Native capture therefore remains
        // active until the post-dispatch task; semantic rewriting must still
        // finalize synchronously while DataTransfer is writable.
        if (!captureAllNativeFormats) request('finalize', '', '', false);
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
      // A page can still write from a later window-bubble listener. Native
      // mode therefore keeps every wrapper live until the post-dispatch task;
      // this bubble hook only harvests cached/prototype writes seen so far.
      pageCopyEvents.set(event, captureAllNativeFormats ? harvestFinalClipboard : finishCopy);
      if (scheduleTask) {
        // A task runs after the full dispatch, unlike a microtask queued from
        // window capture (Chromium can checkpoint that before target
        // listeners). Normal semantic relay cleanup cannot write through an
        // expired DataTransfer. Native capture, however, has already recorded
        // each wrapped write and can safely queue that immutable snapshot now.
        reflectApply(scheduleTask, window, [captureAllNativeFormats ? finishCopy : cleanupCopy, 0]);
      }
    };

    const onCopyBubble = (event) => {
      const observeCopy = pageCopyEvents.get(event);
      if (observeCopy) observeCopy();
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
      const richWrites = siteSemanticRichWrites(state, true);
      for (const write of richWrites) markSiteInjectedRich(state, write.type);
      return {
        action: 'write',
        type: state.plainType || 'text/plain',
        text: state.semanticPayload.text,
        richWrites,
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
    if (state.nativeCapture) {
      const capture = state.nativeCapture;
      const normalizedType = String(request.type || '').toLowerCase();
      capture.operations += 1;
      if (capture.operations > MAX_PAGE_RELAY_OPERATIONS && request.op !== 'finalize') {
        capture.values.clear();
        capture.characters = 0;
        return { action: '', prevent: false };
      }
      if (request.op === 'set') {
        const previous = capture.values.get(normalizedType);
        if (!previous && capture.values.size >= 64) return { action: '', prevent: false };
        const previousLength = previous ? previous.value.length : 0;
        const nextLength = request.overflow ? 0 : request.value.length;
        if (request.overflow || capture.characters - previousLength + nextLength > MAX_CLIPBOARD_MARKUP_LENGTH) {
          capture.values.delete(normalizedType);
          capture.characters -= previousLength;
        } else {
          capture.values.set(normalizedType, { type: request.type, value: request.value });
          capture.characters += nextLength - previousLength;
        }
      } else if (request.op === 'clear') {
        if (request.all) {
          capture.values.clear();
          capture.characters = 0;
        } else {
          const previous = capture.values.get(normalizedType);
          if (previous) capture.characters -= previous.value.length;
          capture.values.delete(normalizedType);
        }
      } else if (request.op === 'finalize' && !capture.queued) {
        capture.queued = true;
        const payload = nativeClipboardSnapshotPayload(capture.values, capture.fallbackText);
        if (payload) capture.queue(payload);
      }
      return { action: '', prevent: false };
    }
    if (normalizeSettings(settings).outputMode === 'native') {
      return pageRelayRestoreResponse(state);
    }
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

  function installPageClipboardRelay(
    documentObject,
    userscriptGlobal,
    pageWindow,
    settingsProvider,
    googleDocs,
    copyGenerationProvider,
    modeGenerationProvider,
    relayInstallation
  ) {
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
          installPageClipboardRelay(
            documentObject,
            userscriptGlobal,
            pageWindow,
            settingsProvider,
            googleDocs,
            copyGenerationProvider,
            modeGenerationProvider,
            relayInstallation
          );
        });
        observer.observe(documentObject, { childList: true, subtree: true });
      } catch (_error) {
        try { delete documentObject.__cleanMathCopyRelayPending; } catch (_deleteError) { /* ignore */ }
      }
      return false;
    }
    const random = new Uint32Array(8);
    try {
      const cryptoObject = (userscriptGlobal && userscriptGlobal.crypto) || global.crypto;
      if (cryptoObject && typeof cryptoObject.getRandomValues === 'function') cryptoObject.getRandomValues(random);
      else throw new Error('no crypto');
    } catch (_error) {
      for (let index = 0; index < random.length; index += 1) random[index] = Math.floor(Math.random() * 0xffffffff);
    }
    const randomParts = Array.from(random, (value) => value.toString(36));
    const carrierId = 'clean-math-copy-relay-' + randomParts.slice(0, 4).join('-');
    // Do not derive the request capability from the DOM-visible carrier ID.
    // Only the injected page closure and controller closure receive this
    // independent random event name.
    const eventName = 'clean-math-copy-request-' + randomParts.slice(4).join('-');
    const carrier = documentObject.createElement('span');
    carrier.id = carrierId;
    carrier.hidden = true;
    carrier.setAttribute('aria-hidden', 'true');
    documentObject.documentElement.appendChild(carrier);
    if (relayInstallation) relayInstallation.carrier = carrier;
    const expectedControllerCopyDelta = relayInstallation && relayInstallation.controllerReady ? 0 : 1;
    const active = new Map();
    let relayCopySerial = 0;
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
          const captureSerial = ++relayCopySerial;
          const relaySettings = normalizeSettings(settingsProvider());
          const beginCopyGeneration = typeof copyGenerationProvider === 'function'
            ? copyGenerationProvider()
            : null;
          const beginModeGeneration = typeof modeGenerationProvider === 'function'
            ? modeGenerationProvider()
            : null;
          if (relaySettings.outputMode === 'native') {
            if (!hasPendingClipboardWrite()) {
              response = { id: response.id, action: 'bypass', prevent: false };
              return;
            }
            const selection = documentObject.getSelection ? documentObject.getSelection() : null;
            const state = createSiteCopyState();
            state.nativeCapture = {
              values: new Map(),
              fallbackText: selectedNativeClipboardText(selection, null),
              queued: false,
              operations: 0,
              characters: 0,
              queue: (payload) => {
                // Finalization runs after both the page-world and controller
                // capture handlers regardless of which one was registered
                // first. Bind to the generations observed now, then require
                // this to remain the newest relay event until the queued write.
                if (relayCopySerial !== captureSerial) return Promise.resolve(false);
                const captureGeneration = typeof copyGenerationProvider === 'function'
                  ? copyGenerationProvider()
                  : null;
                const captureModeGeneration = typeof modeGenerationProvider === 'function'
                  ? modeGenerationProvider()
                  : null;
                if (beginCopyGeneration != null &&
                    captureGeneration !== beginCopyGeneration + expectedControllerCopyDelta) {
                  return Promise.resolve(false);
                }
                if (beginModeGeneration != null && captureModeGeneration !== beginModeGeneration) {
                  return Promise.resolve(false);
                }
                return enqueueClipboardPayload(
                  payload,
                  pageWindow,
                  () => normalizeSettings(settingsProvider()).outputMode === 'native' &&
                    relayCopySerial === captureSerial &&
                    (captureGeneration == null || copyGenerationProvider() === captureGeneration) &&
                    (captureModeGeneration == null || modeGenerationProvider() === captureModeGeneration)
                );
              }
            };
            while (active.size >= MAX_PAGE_RELAY_ACTIVE_EVENTS) active.delete(active.keys().next().value);
            active.set(response.id, state);
            response = { id: response.id, action: 'capture', prevent: false };
            return;
          }
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
    if (relayInstallation && relayInstallation.carrier === carrier) relayInstallation.carrier = null;
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
      let earlySettingsProvider = typeof options.settingsProvider === 'function'
        ? options.settingsProvider
        : null;
      if (!earlySettingsProvider && typeof GM_getValue === 'function') {
        try {
          const legacyGetValue = GM_getValue;
          let lastStored = legacyGetValue(STORAGE_KEY, DEFAULT_SETTINGS);
          if (!lastStored || typeof lastStored.then !== 'function') {
            earlySettingsProvider = () => {
              try {
                const stored = legacyGetValue(STORAGE_KEY, lastStored);
                if (!stored || typeof stored.then !== 'function') lastStored = stored;
              } catch (_error) {
                // Keep the last synchronous value.
              }
              return normalizeSettings(lastStored);
            };
          } else {
            Promise.resolve(lastStored).catch(() => {});
          }
        } catch (_error) {
          // Promise-only/modern APIs use the normal controller below.
        }
      }
      // Managers can inject into inherited about:blank documents before Docs
      // assigns the texteventtarget class. Own that child immediately with the
      // parent editor context; a generic about:blank install would set the
      // marker first and permanently hide the equation clipboard flavors.
      options = {
        ...options,
        pageWindow: inheritedGoogleDocsHost,
        // A child can win the race before the top controller exists. Without
        // an inherited provider, let it create a normal synchronized settings
        // controller so Promise-only manager APIs work there too.
        settingsProvider: earlySettingsProvider || undefined,
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
    const initialSettings = inheritedSettingsProvider
      ? { settings: normalizeSettings(inheritedSettingsProvider()), pendingRead: null }
      : loadInitialSettings();
    let settings = initialSettings.settings;
    let modeGeneration = 0;
    let observedOutputMode = settings.outputMode;
    const observeSettings = (settingsInput) => {
      const next = normalizeSettings(settingsInput);
      if (next.outputMode !== observedOutputMode) {
        observedOutputMode = next.outputMode;
        modeGeneration += 1;
      }
      return next;
    };
    const currentSettings = () => observeSettings(inheritedSettingsProvider
      ? inheritedSettingsProvider()
      : settings);
    let settingsGeneration = 0;
    const handledEvents = new WeakSet();
    const officeCopyStates = new WeakMap();
    const siteCopyStates = new WeakMap();
    const googleDocsPage = isGoogleDocsPage(pageWindow);
    let activeOfficeState = null;
    let officeGeneration = 0;

    const invalidatePendingRewrites = () => {
      officeGeneration += 1;
      if (activeOfficeState && activeOfficeState.recovery) activeOfficeState.recovery.stop();
      activeOfficeState = null;
    };

    // The top-level menu controller is installed later, after the copy
    // listeners. Keeping this hook live now lets asynchronous settings reads
    // and cross-tab value changes update its active-mode marker once ready.
    let requestModeMenuRefresh = () => {};
    let applyDirectPdfMode = () => {};
    const applyStoredSettings = (stored, countAsChange) => {
      const next = observeSettings(stored);
      if (countAsChange) settingsGeneration += 1;
      settings = next;
      if (next.outputMode === 'native') invalidatePendingRewrites();
      requestModeMenuRefresh(next.outputMode);
      applyDirectPdfMode(next.outputMode);
    };

    const pageRelayInstallation = { carrier: null, controllerReady: false };
    installPageClipboardRelay(
      documentObject,
      userscriptGlobal || global,
      pageWindow,
      currentSettings,
      googleDocsPage,
      () => clipboardIntentGeneration,
      () => modeGeneration,
      pageRelayInstallation
    );
    const pageRelayReady = () => {
      const carrier = pageRelayInstallation.carrier;
      try {
        return Boolean(carrier && carrier.isConnected &&
          carrier.getAttribute('data-clean-math-copy-relay-ready') === '1');
      } catch (_error) {
        return false;
      }
    };

    const replayDirectPdfClipboardAfterDispatch = (payload, copyGeneration, copyModeGeneration) => {
      if (!payload || payload.reason !== 'trusted-pdf-text-layer' ||
          !isDirectPdfDocument(documentObject, pageWindow)) return;
      const isCurrent = () => clipboardIntentGeneration === copyGeneration &&
        modeGeneration === copyModeGeneration && currentSettings().outputMode !== 'native';
      const replay = () => {
        // Chromium's privileged application/pdf copy path commits after the
        // DOM ClipboardEvent. In embedded TeX fonts that late native commit can
        // replace an already-correct radical with source glyph bytes such as
        // `p` and NUL. Replay only our authenticated viewer payload in the next
        // task so it wins that browser-level race; generation checks prevent
        // an older PDF copy from overwriting any newer user copy or mode.
        if (!isCurrent()) return;
        writeClipboardPayload(payload, pageWindow, isCurrent).catch(() => {});
      };
      try {
        const schedule = pageWindow && typeof pageWindow.setTimeout === 'function'
          ? pageWindow.setTimeout.bind(pageWindow)
          : setTimeout;
        schedule(replay, 0);
      } catch (_error) {
        // The synchronous DataTransfer payload remains the safe fallback.
      }
    };

    let listenerReady = null;
    if (!inheritedSettingsProvider) {
      const onSettingsChange = (_name, _oldValue, newValue) => {
        applyStoredSettings(newValue, true);
      };
      const modernAddValueChangeListener = global.GM &&
        typeof global.GM.addValueChangeListener === 'function'
        ? global.GM.addValueChangeListener.bind(global.GM)
        : null;
      let listenerResult = null;
      let legacyListenerFailed = false;
      let listenerFromLegacy = false;
      if (typeof GM_addValueChangeListener === 'function') {
        try {
          listenerResult = GM_addValueChangeListener(STORAGE_KEY, onSettingsChange);
          listenerFromLegacy = true;
        } catch (_error) {
          legacyListenerFailed = true;
        }
      }
      if ((typeof GM_addValueChangeListener !== 'function' || legacyListenerFailed) &&
          modernAddValueChangeListener) {
        try {
          listenerResult = modernAddValueChangeListener(STORAGE_KEY, onSettingsChange);
        } catch (_error) {
          listenerResult = null;
        }
      }
      if (listenerResult && typeof listenerResult.then === 'function') {
        let ready = Promise.resolve(listenerResult);
        if (listenerFromLegacy && modernAddValueChangeListener) {
          ready = ready.catch(() => modernAddValueChangeListener(STORAGE_KEY, onSettingsChange));
        }
        listenerReady = ready.then(() => undefined, () => undefined);
      }
    }

    let settingsInitializationReady = null;
    if (!inheritedSettingsProvider && initialSettings.pendingRead) {
      const readStoredSettings = () => {
        const loadGeneration = settingsGeneration;
        let stored;
        try {
          stored = initialSettings.pendingRead();
        } catch (_error) {
          return Promise.resolve();
        }
        return Promise.resolve(stored).then((value) => {
          // A menu command or subscribed storage change can run while this
          // read is pending. Never let its older snapshot win afterward.
          if (settingsGeneration === loadGeneration) applyStoredSettings(value, false);
        }, () => {});
      };
      settingsInitializationReady = listenerReady
        ? listenerReady.then(readStoredSettings, readStoredSettings)
        : readStoredSettings();
    }

    if (isDirectPdfDocument(documentObject, pageWindow)) {
      let viewerStartPending = null;
      applyDirectPdfMode = () => {
        // Keep one stable selectable PDF surface in every mode. “Original
        // copy/paste” bypasses all rewriting inside this viewer; tearing the
        // viewer down and reviving Chromium's privileged PDF document in the
        // same tab leaves PDF.js workers permanently stalled in Chromium.
        // The toolbar's explicit browser-viewer escape lasts for this native
        // document. A normal reload starts a fresh document and restores the
        // custom viewer; a stored mode change must not replace the browser's
        // privileged viewer in place, which can strand PDF.js in Chromium.
        if (documentObject.__cleanMathCopyPdfViewerBypassed) return;
        if (!viewerStartPending) {
          viewerStartPending = startDirectPdfViewer(documentObject, pageWindow).finally(() => {
            viewerStartPending = null;
          });
        }
      };
      const startForResolvedMode = () => applyDirectPdfMode(currentSettings().outputMode);
      if (settingsInitializationReady) {
        Promise.resolve(settingsInitializationReady).then(startForResolvedMode, startForResolvedMode);
      } else startForResolvedMode();
    }

    const armNativeReplaySnapshot = (event, fallbackText) => {
      const clipboardData = event && event.clipboardData;
      if (!clipboardData || typeof clipboardData.setData !== 'function') {
        return { payload: () => nativeClipboardSnapshotPayload(new Map(), fallbackText) };
      }
      const values = new Map();
      let capturedCharacters = 0;
      const patches = [];
      const record = (type, value) => {
        const actualType = String(type == null ? '' : type);
        const actualValue = String(value == null ? '' : value);
        if (!actualType || actualType.length > 256) return;
        const key = actualType.toLowerCase();
        const previous = values.get(key);
        if (!previous && values.size >= 64) return;
        const previousLength = previous ? previous.value.length : 0;
        if (actualValue.length > MAX_CLIPBOARD_MARKUP_LENGTH ||
            capturedCharacters - previousLength + actualValue.length > MAX_CLIPBOARD_MARKUP_LENGTH) {
          // The native clipboard accepted the replacement, so retaining the
          // older captured value would replay stale data. Fail closed by
          // forgetting this flavor, matching isolated-relay overflow handling.
          if (previous) capturedCharacters -= previousLength;
          values.delete(key);
          return;
        }
        values.set(key, { type: actualType, value: actualValue });
        capturedCharacters += actualValue.length - previousLength;
      };
      const harvest = () => {
        for (const type of clipboardTypes(clipboardData).slice(0, 64)) {
          record(type, clipboardGet(clipboardData, type));
        }
      };
      const patchMethod = (target, name, replacement) => {
        let previous;
        try {
          previous = Object.getOwnPropertyDescriptor(target, name);
          Object.defineProperty(target, name, {
            value: replacement,
            configurable: true,
            enumerable: previous ? Boolean(previous.enumerable) : false,
            writable: true
          });
          patches.push({ target, name, previous, replacement });
          return true;
        } catch (_error) {
          return false;
        }
      };
      const restorePatches = () => {
        for (let index = patches.length - 1; index >= 0; index -= 1) {
          const patch = patches[index];
          try {
            const current = Object.getOwnPropertyDescriptor(patch.target, patch.name);
            if (!current || current.value !== patch.replacement) continue;
            if (patch.previous) Object.defineProperty(patch.target, patch.name, patch.previous);
            else delete patch.target[patch.name];
          } catch (_error) {
            // Do not overwrite a page replacement made during the event.
          }
        }
      };
      const state = {
        finished: false,
        payload: () => nativeClipboardSnapshotPayload(values, fallbackText),
        finish: null,
        bubbleListener: null,
        cleanupTimer: null
      };
      state.finish = () => {
        if (state.finished) return;
        harvest();
        state.finished = true;
        restorePatches();
        if (state.bubbleListener) {
          documentObject.removeEventListener('copy', state.bubbleListener, false);
        }
        if (state.cleanupTimer != null && pageWindow && typeof pageWindow.clearTimeout === 'function') {
          pageWindow.clearTimeout(state.cleanupTimer);
          state.cleanupTimer = null;
        }
      };

      const originalSetData = clipboardData.setData;
      patchMethod(clipboardData, 'setData', function cleanNativeReplaySetData(type, value) {
        const actualType = '' + type;
        const actualValue = '' + value;
        const result = Reflect.apply(originalSetData, this, [actualType, actualValue]);
        record(actualType, actualValue);
        return result;
      });
      if (typeof clipboardData.clearData === 'function') {
        const originalClearData = clipboardData.clearData;
        patchMethod(clipboardData, 'clearData', function cleanNativeReplayClearData(type) {
          const all = arguments.length === 0;
          const actualType = all ? '' : '' + type;
          const result = all
            ? Reflect.apply(originalClearData, this, [])
            : Reflect.apply(originalClearData, this, [actualType]);
          if (all) {
            values.clear();
            capturedCharacters = 0;
          } else {
            const previous = values.get(actualType.toLowerCase());
            if (previous) capturedCharacters -= previous.value.length;
            values.delete(actualType.toLowerCase());
          }
          return result;
        });
      }
      if (typeof event.stopPropagation === 'function') {
        const originalStop = event.stopPropagation;
        patchMethod(event, 'stopPropagation', function cleanNativeReplayStopPropagation() {
          // Capture cached/prototype writes made so far, but keep the wrappers
          // active because later listeners on this same target still run.
          harvest();
          return Reflect.apply(originalStop, event, arguments);
        });
      }
      if (typeof event.stopImmediatePropagation === 'function') {
        const originalStopImmediate = event.stopImmediatePropagation;
        patchMethod(event, 'stopImmediatePropagation', function cleanNativeReplayStopImmediatePropagation() {
          // stopImmediatePropagation() blocks other listeners, but the caller
          // itself keeps running and may perform additional clipboard writes.
          harvest();
          return Reflect.apply(originalStopImmediate, event, arguments);
        });
      }
      state.bubbleListener = (bubbleEvent) => {
        // Window-bubble listeners run after document bubble and may make the
        // final native clipboard write. Harvest here, but let only the task
        // restore wrappers and freeze the snapshot after dispatch completes.
        if (bubbleEvent === event) harvest();
      };
      documentObject.addEventListener('copy', state.bubbleListener, false);
      if (pageWindow && typeof pageWindow.setTimeout === 'function') {
        state.cleanupTimer = pageWindow.setTimeout(state.finish, 0);
      }
      return state;
    };

    const handleCopy = (event) => {
      if (!event || handledEvents.has(event)) return;
      handledEvents.add(event);
      const eventIntentGeneration = ++clipboardIntentGeneration;
      const eventSettings = currentSettings();
      if (eventSettings.outputMode === 'native') {
        const replayAfterPendingWrite = hasPendingClipboardWrite();
        invalidatePendingRewrites();
        if (replayAfterPendingWrite) {
          const nativeGeneration = eventIntentGeneration;
          const nativeModeGeneration = modeGeneration;
          const selection = documentObject.getSelection ? documentObject.getSelection() : null;
          const selectedNativeText = selectedNativeClipboardText(selection, event.target);
          // In an isolated userscript world, the ready page relay owns exact
          // DataTransfer capture. Layering another set of wrappers here can
          // restore the relay's inactive wrappers in reverse cleanup order.
          // Keep a selection-only fallback in case the relay cannot enqueue;
          // its exact-format replay runs later and wins when available.
          const nativeSnapshot = pageRelayReady()
            ? { payload: () => nativeClipboardSnapshotPayload(new Map(), selectedNativeText) }
            : armNativeReplaySnapshot(event, selectedNativeText);
          // A Clipboard API write that has already started cannot be aborted.
          // Replay only the newer native representations behind it so that an
          // older Office recovery cannot become the final clipboard contents.
          enqueueClipboardPayload(
            () => nativeSnapshot.payload(),
            pageWindow,
            () => currentSettings().outputMode === 'native' &&
              clipboardIntentGeneration === nativeGeneration && modeGeneration === nativeModeGeneration
          );
        }
        return;
      }
      // Any newer keyboard/context-menu copy invalidates an in-flight async
      // recovery and replays behind a write that has already started.
      const replayAfterPendingWrite = hasPendingClipboardWrite();
      const eventGeneration = eventIntentGeneration;
      const eventModeGeneration = modeGeneration;
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
          isCurrent: () => activeOfficeState === officeState &&
            officeGeneration === generation && currentSettings().outputMode !== 'native' &&
            modeGeneration === eventModeGeneration && clipboardIntentGeneration === eventGeneration
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
        : getCopyPayload(documentObject, selection, eventSettings, pageWindow, event.target, true);
      if (payload && payload.deferredPdf && payload.root && payload.root.isConnected) {
        const deferredRoot = payload.root;
        const deferredRanges = payload.ranges;
        const deferredGeneration = eventGeneration;
        const deferredModeGeneration = eventModeGeneration;
        let timeoutId = null;
        const finishDeferredPdf = () => {
          deferredRoot.removeEventListener(PDF_SELECTION_READY_EVENT, finishDeferredPdf, false);
          if (timeoutId != null && pageWindow && typeof pageWindow.clearTimeout === 'function') {
            pageWindow.clearTimeout(timeoutId);
          }
          if (clipboardIntentGeneration !== deferredGeneration || modeGeneration !== deferredModeGeneration ||
              currentSettings().outputMode === 'native') return;
          const resolved = trustedPdfViewerPayload(deferredRanges, currentSettings(), documentObject);
          if (!resolved || resolved === PDF_VIEWER_INCOMPLETE) return;
          writeClipboardPayload(
            resolved,
            pageWindow,
            () => clipboardIntentGeneration === deferredGeneration &&
              modeGeneration === deferredModeGeneration && currentSettings().outputMode !== 'native'
          );
        };
        deferredRoot.addEventListener(PDF_SELECTION_READY_EVENT, finishDeferredPdf, false);
        if (pageWindow && typeof pageWindow.setTimeout === 'function') {
          timeoutId = pageWindow.setTimeout(() => {
            deferredRoot.removeEventListener(PDF_SELECTION_READY_EVENT, finishDeferredPdf, false);
          }, 45000);
        }
        try {
          const EventConstructor = pageWindow && pageWindow.Event || global.Event;
          deferredRoot.dispatchEvent(new EventConstructor(PDF_RENDER_SELECTION_EVENT));
        } catch (_error) {
          deferredRoot.removeEventListener(PDF_SELECTION_READY_EVENT, finishDeferredPdf, false);
          if (timeoutId != null && pageWindow && typeof pageWindow.clearTimeout === 'function') {
            pageWindow.clearTimeout(timeoutId);
          }
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (!officeState && !payload && !(googleDocsPage && pageRelayReady())) {
        siteState = createSiteCopyState();
        siteState.settings = eventSettings;
        siteCopyStates.set(event, siteState);
        interceptSiteClipboardWrites(event, siteState, eventSettings, documentObject, googleDocsPage);
      }
      if (replayAfterPendingWrite) {
        const selectedNativeText = selectedNativeClipboardText(selection, event.target);
        const isReplayCurrent = () => clipboardIntentGeneration === eventGeneration;
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
      replayDirectPdfClipboardAfterDispatch(payload, eventGeneration, eventModeGeneration);
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
    pageRelayInstallation.controllerReady = true;

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

    const legacyRegisterMenuCommand = typeof GM_registerMenuCommand === 'function'
      ? GM_registerMenuCommand
      : null;
    const legacyUnregisterMenuCommand = typeof GM_unregisterMenuCommand === 'function'
      ? GM_unregisterMenuCommand
      : null;
    const modernRegisterMenuCommand = global.GM && typeof global.GM.registerMenuCommand === 'function'
      ? global.GM.registerMenuCommand.bind(global.GM)
      : null;
    const modernUnregisterMenuCommand = global.GM && typeof global.GM.unregisterMenuCommand === 'function'
      ? global.GM.unregisterMenuCommand.bind(global.GM)
      : null;
    const menuWindow = documentObject.defaultView || pageWindow;
    let topLevelMenu = true;
    try {
      topLevelMenu = !menuWindow || menuWindow.top === menuWindow;
    } catch (_error) {
      topLevelMenu = false;
    }
    if ((legacyRegisterMenuCommand || modernRegisterMenuCommand) &&
        options.registerMenus !== false && topLevelMenu) {
      const updateSettings = (nextSettings) => {
        settingsGeneration += 1;
        settings = observeSettings(saveSettings(nextSettings));
        if (settings.outputMode === 'native') invalidatePendingRewrites();
        requestModeMenuRefresh(settings.outputMode);
        applyDirectPdfMode(settings.outputMode);
      };
      const setMode = (mode) => {
        updateSettings({ outputMode: mode });
      };
      const modeMenus = [
        { mode: 'faithful', label: 'Readable text (recommended)' },
        { mode: 'calculator', label: 'Calculator-safe' },
        { mode: 'latex', label: 'Original LaTeX' },
        { mode: 'native', label: 'Original copy/paste' }
      ];
      const menuCaption = (item, activeMode) =>
        (item.mode === activeMode ? '✓ ' : '') + item.label;
      const usableMenuToken = (token) => token !== undefined && token !== null;
      const candidates = [];
      const addCandidate = (name, register, unregister) => {
        if (!register || candidates.some((candidate) => candidate.register === register)) return;
        candidates.push({ name, register, unregister });
      };

      // Prefer a completely paired API family. Mixing legacy registration
      // with modern removal (or vice versa) is not portable across managers.
      if (legacyRegisterMenuCommand && legacyUnregisterMenuCommand) {
        addCandidate('legacy', legacyRegisterMenuCommand, legacyUnregisterMenuCommand);
      }
      if (modernRegisterMenuCommand && modernUnregisterMenuCommand) {
        addCandidate('modern', modernRegisterMenuCommand, modernUnregisterMenuCommand);
      }
      if (legacyRegisterMenuCommand && !legacyUnregisterMenuCommand) {
        addCandidate('legacy-static', legacyRegisterMenuCommand, null);
      }
      if (modernRegisterMenuCommand && !modernUnregisterMenuCommand) {
        addCandidate('modern-static', modernRegisterMenuCommand, null);
      }

      let desiredMode = settings.outputMode;
      let renderedMode = null;
      let activeMenuApi = null;
      let menuTokens = [];
      let menusInitialized = false;
      let dynamicMenus = false;
      let menuControllerDisabled = false;
      let refreshRequested = false;
      let refreshScheduled = false;
      let refreshRunning = false;

      const registerMenuBatch = (api, mode) => {
        const settlements = [];
        let threw = false;
        for (const item of modeMenus) {
          try {
            const result = api.register(menuCaption(item, mode), () => setMode(item.mode));
            // Attach the rejection handler immediately: Promise-based manager
            // APIs must never produce an unhandled rejection in the page.
            settlements.push(Promise.resolve(result).then(
              (token) => ({ ok: true, token }),
              () => ({ ok: false, token: null })
            ));
          } catch (_error) {
            threw = true;
            break;
          }
        }
        return Promise.all(settlements).then((entries) => ({
          complete: !threw && entries.length === modeMenus.length &&
            entries.every((entry) => entry.ok),
          entries
        }));
      };

      const unregisterMenuBatch = (api, tokens) => {
        if (!api || !api.unregister || tokens.some((token) => !usableMenuToken(token))) {
          return Promise.resolve(false);
        }
        const settlements = tokens.map((token) => {
          try {
            return Promise.resolve(api.unregister(token)).then(() => true, () => false);
          } catch (_error) {
            return Promise.resolve(false);
          }
        });
        return Promise.all(settlements).then((results) => results.every(Boolean));
      };

      const activateMenuBatch = (api, mode, outcome) => {
        activeMenuApi = api;
        menuTokens = outcome.entries.map((entry) => entry.token);
        renderedMode = mode;
        menusInitialized = true;
        dynamicMenus = Boolean(api.unregister && menuTokens.every(usableMenuToken));
        if (dynamicMenus && desiredMode !== renderedMode) refreshRequested = true;
      };

      const cleanFailedMenuBatch = (api, outcome) => {
        const successfulTokens = outcome.entries
          .filter((entry) => entry.ok)
          .map((entry) => entry.token);
        if (!successfulTokens.length) return Promise.resolve(true);
        return unregisterMenuBatch(api, successfulTokens);
      };

      const scheduleMenuRefresh = () => {
        if (refreshScheduled || refreshRunning || menuControllerDisabled ||
            !menusInitialized || !dynamicMenus) return;
        refreshScheduled = true;
        Promise.resolve().then(() => {
          refreshScheduled = false;
          return runMenuRefresh();
        }).catch(() => {
          menuControllerDisabled = true;
          dynamicMenus = false;
        });
      };

      const runMenuRefresh = async () => {
        if (refreshRunning || menuControllerDisabled || !dynamicMenus) return;
        refreshRunning = true;
        try {
          while (refreshRequested && !menuControllerDisabled && dynamicMenus) {
            refreshRequested = false;
            if (desiredMode === renderedMode) continue;
            const api = activeMenuApi;
            const removed = await unregisterMenuBatch(api, menuTokens);
            if (!removed) {
              // Partial removal cannot be repaired without risking duplicate
              // commands. Keep clipboard behavior working and stop menu churn.
              menuControllerDisabled = true;
              dynamicMenus = false;
              break;
            }
            menuTokens = [];
            const mode = desiredMode;
            const outcome = await registerMenuBatch(api, mode);
            if (!outcome.complete) {
              await cleanFailedMenuBatch(api, outcome);
              menuControllerDisabled = true;
              dynamicMenus = false;
              break;
            }
            activateMenuBatch(api, mode, outcome);
          }
        } finally {
          refreshRunning = false;
          if (refreshRequested && !menuControllerDisabled && dynamicMenus) scheduleMenuRefresh();
        }
      };

      requestModeMenuRefresh = (mode) => {
        desiredMode = normalizeSettings({ outputMode: mode }).outputMode;
        if (!menusInitialized || !dynamicMenus || menuControllerDisabled ||
            desiredMode === renderedMode) return;
        refreshRequested = true;
        scheduleMenuRefresh();
      };

      const tryMenuCandidate = (candidateIndex) => {
        if (candidateIndex >= candidates.length || menuControllerDisabled) return;
        const api = candidates[candidateIndex];
        const mode = desiredMode;
        registerMenuBatch(api, mode).then((outcome) => {
          if (outcome.complete) {
            activateMenuBatch(api, mode, outcome);
            if (refreshRequested) scheduleMenuRefresh();
            return;
          }
          cleanFailedMenuBatch(api, outcome).then((cleaned) => {
            if (cleaned) tryMenuCandidate(candidateIndex + 1);
            else menuControllerDisabled = true;
          }, () => {
            menuControllerDisabled = true;
          });
        }, () => {
          menuControllerDisabled = true;
        });
      };

      const startModeMenus = () => tryMenuCandidate(0);
      const hasDynamicCandidate = candidates.some((candidate) => candidate.unregister);
      if (!hasDynamicCandidate && settingsInitializationReady) {
        // Greasemonkey returns no command IDs and has no removal API. Wait for
        // its asynchronous stored setting so the one safe, static registration
        // still marks the correct initial mode without ever creating duplicates.
        Promise.resolve(settingsInitializationReady).then(startModeMenus, startModeMenus);
      } else {
        startModeMenus();
      }
    }

    return { handleCopy, get settings() { return { ...currentSettings() }; } };
  }

  return Object.freeze({
    DEFAULT_SETTINGS,
    MATH_ROOT_SELECTOR,
    analyzePdfPageText,
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
    requestCurrentPdfBytes,
    registerTrustedPdfViewerRoot,
    richScriptClipboardPayloadFromMarkup,
    rootsForRange,
    serializeDomFragment,
    serializeRangePayloadWithMath,
    serializeRangeWithMath,
    looksLikeStandaloneUnicodeMath,
    unicodeToCalculator
  });
});
