// ==UserScript==
// @name         Clean Math Copy
// @namespace    https://github.com/atharvjoshi/clean-math-copy
// @version      1.2.2
// @description  Copy exact math selections from ChatGPT, KaTeX, MathJax, MathML, and Word as calculator-safe text plus clean rich formatting.
// @author       Atharv Joshi
// @license      MIT
// @match        http://*/*
// @match        https://*/*
// @match        file:///*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        unsafeWindow
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @grant        GM.setClipboard
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

  const VERSION = '1.2.2';
  const STORAGE_KEY = 'cleanMathCopy.settings.v2';
  const MATHML_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';
  const MAX_CLIPBOARD_MARKUP_LENGTH = 1024 * 1024;
  const MAX_MATHML_NODES = 5000;
  const MAX_MATHML_DEPTH = 128;
  const MAX_RICH_SELECTION_NODES = 1000;
  const MAX_RICH_SELECTION_DEPTH = 128;
  const MAX_SELECTION_KEY_LENGTH = 50000;
  const MAX_LATEX_PARSE_DEPTH = 128;
  const MAX_LATEX_PARSE_STEPS = 25000;
  const DECLARED_OPERATOR_START = '\ue100';
  const DECLARED_OPERATOR_END = '\ue101';
  const RELATIONAL_MID = '\ue102';
  const DECLARED_IDENTIFIER_START = '\ue103';
  const DECLARED_IDENTIFIER_END = '\ue104';
  const LATEX_BUDGET_ERROR = 'CLEAN_MATH_COPY_LATEX_BUDGET';
  const TRUSTED_RICH_STYLE_NODES = new WeakSet();
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
    outputMode: 'calculator',
    convertDelimitedLatex: true,
    cleanInvisibleArtifacts: true
  });

  const SYMBOLS = Object.freeze({
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ϵ',
    zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
    lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', omicron: 'ο', pi: 'π', varpi: 'ϖ',
    rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ',
    phi: 'φ', varphi: 'ϕ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
    Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
    pm: '±', mp: '∓', times: '×', div: '÷', cdot: '·', ast: '∗', star: '⋆',
    circ: '∘', bullet: '•', cap: '∩', cup: '∪', uplus: '⊎', sqcap: '⊓',
    sqcup: '⊔', vee: '∨', wedge: '∧', setminus: '∖', wr: '≀', diamond: '⋄',
    bigtriangleup: '△', bigtriangledown: '▽', triangleleft: '◁', triangleright: '▷',
    oplus: '⊕', ominus: '⊖', otimes: '⊗', oslash: '⊘', odot: '⊙',
    bigcirc: '◯', dagger: '†', ddagger: '‡', amalg: '⨿',
    le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', ne: '≠', equiv: '≡',
    approx: '≈', sim: '∼', simeq: '≃', cong: '≅', propto: '∝', doteq: '≐',
    ll: '≪', gg: '≫', prec: '≺', succ: '≻', preceq: '≼', succeq: '≽',
    subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇', sqsubset: '⊏',
    sqsupset: '⊐', sqsubseteq: '⊑', sqsupseteq: '⊒', in: '∈', ni: '∋',
    notin: '∉', vdash: '⊢', dashv: '⊣', models: '⊨', perp: '⊥', parallel: '∥',
    mid: '∣', smile: '⌣', frown: '⌢', asymp: '≍', bowtie: '⋈',
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
    triangle: '△', square: '□', prime: '′', backslash: '∖', ldots: '…',
    cdots: '⋯', vdots: '⋮', ddots: '⋱', dots: '…', therefore: '∴', because: '∵',
    degree: '°', checkmark: '✓', pounds: '£', euro: '€', yen: '¥',
    lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', langle: '⟨', rangle: '⟩',
    lvert: '|', rvert: '|', vert: '|', lVert: '‖', rVert: '‖', Vert: '‖', colon: ':',
    lt: '<', gt: '>', implies: '⇒', impliedby: '⇐', iff: '⇔',
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

  function normalizeSettings(settings) {
    const candidate = settings && typeof settings === 'object' ? settings : {};
    const outputMode = ['calculator', 'unicode', 'latex', 'ascii'].includes(candidate.outputMode)
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

  function applyMathVariant(text, variant) {
    const value = String(text);
    if (/double-struck|blackboard/i.test(variant || '')) {
      return Array.from(value, (character) => DOUBLE_STRUCK[character] || character).join('');
    }
    return value;
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
        if (isRow) index += 1;
      } else {
        current += character;
      }
    }
    parts.push(current);
    return parts;
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
    return rows.map((cells) => cells.join('  ')).join('; ');
  }

  class LatexParser {
    constructor(input, options) {
      this.input = stripLatexDelimiters(input)
        .replace(/(^|[^\\])%[^\n\r]*/g, '$1')
        .replace(/\\displaystyle\b/g, '');
      this.position = 0;
      this.calculatorMode = Boolean(options && options.calculatorMode);
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
          output += this.calculatorMode ? '(' + group + ')' : group;
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
          output += character === '^'
            ? toScript(argument, SUPERSCRIPTS, '^')
            : toScript(argument, SUBSCRIPTS, '_');
          continue;
        }
        if (character === '~') {
          output += ' ';
          this.position += 1;
          continue;
        }
        if (/\s/.test(character)) {
          output += ' ';
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

    readRawGroup() {
      while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
        this.position += 1;
      }
      if (this.input[this.position] !== '{') return this.parseArgument();
      this.position += 1;
      const start = this.position;
      let depth = 1;
      while (this.position < this.input.length && depth > 0) {
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

    parseCalculatorInner(source) {
      return new LatexParser(source, {
        calculatorMode: true,
        budget: this.budget
      }).parse();
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
      if (Object.prototype.hasOwnProperty.call(SYMBOLS, name)) {
        const symbol = SYMBOLS[name];
        if (this.calculatorMode && CALCULATOR_FUNCTIONS.has(symbol)) return this.parseCalculatorFunction(symbol);
        return symbol;
      }
      if (name === '\\') return ' ';
      if (name === ' ' || name === ',' || name === ':' || name === ';' || name === '>' || name === '!') {
        return name === '!' ? '' : ' ';
      }
      if ('%_$#&{}'.includes(name)) return name;

      if (name === 'frac' || name === 'dfrac' || name === 'tfrac' || name === 'cfrac') {
        const numerator = this.parseArgument();
        const denominator = this.parseArgument();
        if (this.calculatorMode) {
          return calculatorFraction(unicodeToCalculator(numerator), unicodeToCalculator(denominator));
        }
        return '(' + numerator + ')/(' + denominator + ')';
      }
      if (name === 'binom' || name === 'dbinom' || name === 'tbinom') {
        return 'C(' + this.parseArgument() + ', ' + this.parseArgument() + ')';
      }
      if (name === 'sqrt') {
        const index = this.parseOptionalArgument();
        const radicand = this.parseArgument();
        if (index && this.calculatorMode) return '(' + radicand + ')^(1/(' + latexToUnicode(index) + '))';
        if (this.calculatorMode) return 'sqrt(' + stripBalancedOuterParentheses(radicand) + ')';
        const root = index ? toScript(latexToUnicode(index), SUPERSCRIPTS, '^') + '√' : '√';
        return root + '(' + radicand + ')';
      }
      if (['text', 'textrm', 'textnormal', 'mbox', 'hbox'].includes(name)) {
        return this.readRawGroup().replace(/~/g, ' ').replace(/\\([%_$#&{}])/g, '$1');
      }
      if (['mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'boldsymbol', 'bm', 'operatorname'].includes(name)) {
        if (name === 'operatorname' && this.input[this.position] === '*') this.position += 1;
        const value = this.parseArgument();
        if (name === 'operatorname' && this.calculatorMode && /^[A-Za-z][A-Za-z0-9_]*$/.test(value)) {
          const declared = DECLARED_OPERATOR_START + value + DECLARED_OPERATOR_END;
          return this.parseCalculatorFunction(declared);
        }
        if (this.calculatorMode && /^[A-Za-z][A-Za-z0-9_]*$/.test(value)) {
          return DECLARED_IDENTIFIER_START + value + DECLARED_IDENTIFIER_END;
        }
        return this.calculatorMode && !calculatorSimpleTerm(unicodeToCalculator(value))
          ? '(' + value + ')'
          : value;
      }
      if (['mathbb', 'Bbb'].includes(name)) return applyMathVariant(this.parseArgument(), 'double-struck');
      if (['mathcal', 'mathscr', 'mathfrak'].includes(name)) return this.parseArgument();
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
        return this.parseDelimiter();
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
      if (name === 'quad' || name === 'qquad' || name === 'enspace' || name === 'hspace' || name === 'hspace*') {
        if (name === 'hspace' && this.input[this.position] === '*') this.position += 1;
        if (name.startsWith('hspace')) this.parseArgument();
        return ' ';
      }
      if (['displaystyle', 'textstyle', 'scriptstyle', 'scriptscriptstyle', 'limits', 'nolimits'].includes(name)) return '';
      if (name === 'kern' || name === 'mkern' || name === 'raisebox' || name === 'rule') {
        this.parseArgument();
        if (name === 'raisebox') return this.parseArgument();
        return '';
      }
      if (name === 'overline' || name === 'bar' || name === 'overbrace') return this.parseArgument() + '\u0305';
      if (name === 'underline') return this.parseArgument() + '\u0332';
      if (name === 'underbrace') return this.parseArgument() + '\u0332';
      if (name === 'hat' || name === 'widehat') return this.parseArgument() + '\u0302';
      if (name === 'tilde' || name === 'widetilde') return this.parseArgument() + '\u0303';
      if (name === 'vec' || name === 'overrightarrow') return this.parseArgument() + '\u20d7';
      if (name === 'overleftarrow') return this.parseArgument() + '\u20d6';
      if (name === 'dot') return this.parseArgument() + '\u0307';
      if (name === 'ddot') return this.parseArgument() + '\u0308';
      if (name === 'acute') return this.parseArgument() + '\u0301';
      if (name === 'grave') return this.parseArgument() + '\u0300';
      if (name === 'breve') return this.parseArgument() + '\u0306';
      if (name === 'check') return this.parseArgument() + '\u030c';
      if (name === 'overset' || name === 'stackrel') {
        const over = this.parseArgument();
        const base = this.parseArgument();
        return base + toScript(over, SUPERSCRIPTS, '^');
      }
      if (name === 'underset') {
        const under = this.parseArgument();
        const base = this.parseArgument();
        return base + toScript(under, SUBSCRIPTS, '_');
      }
      if (name === 'begin') {
        const environment = this.readRawGroup();
        const body = this.readEnvironmentBody(environment);
        return convertLatexEnvironment(environment, body, {
          calculatorMode: this.calculatorMode,
          convertCell: (cell) => this.calculatorMode ? this.parseCalculatorInner(cell) : latexToUnicode(cell)
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
      if (['boxed', 'cancel', 'bcancel', 'xcancel', 'cancelto'].includes(name)) {
        if (name === 'cancelto') this.parseArgument();
        const value = this.parseArgument();
        return name === 'boxed' ? 'boxed(' + value + ')' : value;
      }
      if (name === 'substack') {
        return splitLatexTopLevel(this.readRawGroup(), 'row').map(latexToUnicode).join(', ');
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
      .replace(/\s+([)\]}⟩⌉⌋,;])/g, '$1')
      .replace(/[ ]{2,}/g, ' ')
      .trim();
    return text.normalize ? text.normalize('NFC') : text;
  }

  function latexToUnicode(input) {
    try {
      return formatMathText(new LatexParser(input).parse());
    } catch (error) {
      if (error && error.code === LATEX_BUDGET_ERROR) return '';
      throw error;
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
      return unicodeToCalculator(formatMathText(new LatexParser(input, { calculatorMode: true }).parse()));
    } catch (error) {
      if (error && error.code === LATEX_BUDGET_ERROR) return '';
      throw error;
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

  function convertDelimitedLatexText(input, outputMode) {
    const text = String(input);
    let output = '';
    let converted = 0;
    let cursor = 0;

    const emit = (source, display, original) => {
      let rendered;
      if (outputMode === 'latex') rendered = display ? '$$' + source + '$$' : '$' + source + '$';
      else if (outputMode === 'calculator') rendered = latexToCalculator(source);
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
      } else if (text[cursor] === '$' && !isEscaped(text, cursor)) {
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
    return applyMathVariant(value, node.getAttribute && node.getAttribute('mathvariant'));
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
    return calculatorResult(rowText() || calculatorIdentifier(node.textContent || ''), name === 'math' || name === 'mrow' ? 'operand' : 'operand');
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
    if (outputMode === 'latex') return '$' + mathMLToLatexNode(mathElement) + '$';
    const unicode = mathMLToUnicode(mathElement);
    return outputMode === 'ascii' ? unicodeToAscii(unicode) : unicode;
  }

  function findSelectedMathMLFragment(mathElement, selectedText, selectedOffset, visualText, preferredStructures, preferVisualFractions) {
    const selectedKey = mathSelectionKey(selectedText);
    const presentation = presentationMathNode(mathElement);
    if (!selectedKey || selectedKey.length > MAX_SELECTION_KEY_LENGTH || !presentation ||
        !domTreeWithinBudget(presentation, MAX_MATHML_NODES, MAX_MATHML_DEPTH)) return null;
    const visualKey = mathSelectionKey(visualText || '');
    const structureHints = preferredStructures instanceof Set ? preferredStructures : new Set(preferredStructures || []);
    const candidates = [];
    const seen = new Set();
    const candidateIds = new WeakMap();
    const surfaceCache = new WeakMap();
    const rowNames = new Set(['math', 'mrow', 'mstyle', 'mpadded', 'menclose', 'mtd', 'mtr', 'mlabeledtr']);
    const structuralNames = new Set(['mfrac', 'msqrt', 'mroot', 'msup', 'msub', 'msubsup', 'mover', 'munder', 'munderover', 'mfenced']);

    const variantsFor = (node) => {
      if (surfaceCache.has(node)) return surfaceCache.get(node);
      const variants = mathMLSurfaceVariants(node);
      surfaceCache.set(node, variants);
      return variants;
    };
    let candidateId = 0;
    const assignCandidateIds = (node) => {
      if (!node || node.nodeType !== 1 || candidateIds.has(node)) return;
      candidateIds.set(node, String(candidateId++));
      for (const child of elementChildren(node)) assignCandidateIds(child);
    };
    assignCandidateIds(presentation);

    const addCandidate = (nodes, coherent, depth, knownVariants) => {
      if (!nodes.length || candidates.length >= 4096) return;
      const variants = knownVariants || (nodes.length === 1
        ? variantsFor(nodes[0])
        : combineSurfaceVariants(nodes.map(variantsFor), 24));
      if (!variants.includes(selectedKey)) return;
      const firstRange = semanticRanges.get(nodes[0]);
      const signature = nodes.map((node) => candidateIds.get(node) || '').join(':');
      if (seen.has(signature)) return;
      seen.add(signature);
      const wrapper = wrapMathMLFragment(nodes, mathElement.ownerDocument);
      if (!wrapper) return;
      const structure = nodes.length === 1 ? (nodes[0].localName || '').toLowerCase() : '';
      candidates.push({
        math: wrapper,
        nodes: nodes.slice(),
        coherent,
        depth,
        structure,
        preferredStructure: structureHints.has(structure),
        nodeCount: wrapper.querySelectorAll('*').length,
        semanticOffset: firstRange ? firstRange.start : Number.POSITIVE_INFINITY,
        visualDistance: Number.POSITIVE_INFINITY,
        surfaceRank: Number.POSITIVE_INFINITY
      });
    };
    const addSlicedCandidate = (nodes, depth, occurrence, signature) => {
      const selectedNodes = nodes.filter(Boolean);
      if (!selectedNodes.length || candidates.length >= 4096 || seen.has(signature)) return;
      const wrapper = wrapMathMLFragment(selectedNodes, mathElement.ownerDocument);
      if (!wrapper || mathSelectionKey(wrapper.textContent || '') !== selectedKey) return;
      seen.add(signature);
      candidates.push({
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
        sliced: true
      });
    };

    const semanticRanges = new WeakMap();
    let semanticCursor = 0;
    const indexSemanticRanges = (node) => {
      if (!node || node.nodeType !== 1) return;
      const start = semanticCursor;
      const name = (node.localName || '').toLowerCase();
      if (['mi', 'mn', 'mo', 'mtext', 'ms', 'mglyph'].includes(name)) {
        semanticCursor += mathSelectionKey(mathMLTokenText(node)).length;
      } else if (!['annotation', 'annotation-xml', 'mphantom', 'none', 'mspace'].includes(name)) {
        for (const child of elementChildren(node)) indexSemanticRanges(child);
      }
      semanticRanges.set(node, { start, end: semanticCursor });
    };
    indexSemanticRanges(presentation);

    const walk = (node, depth) => {
      if (!node || node.nodeType !== 1) return;
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
          const childVariants = variantsFor(child).length ? variantsFor(child) : [''];
          const next = [];
          for (const sequence of sequences) {
            for (const variant of childVariants) {
              const text = sequence.text + variant;
              if (next.some((item) => item.text === text)) continue;
              next.push({
                text,
                boundaries: sequence.boundaries.concat(text.length),
                variants: sequence.variants.concat(variant)
              });
              if (next.length >= 24) break;
            }
            if (next.length >= 24) break;
          }
          sequences = next;
        }
        for (const sequence of sequences) {
          let occurrence = sequence.text.indexOf(selectedKey);
          while (occurrence >= 0) {
            const finish = occurrence + selectedKey.length;
            const starts = [];
            const ends = [];
            sequence.boundaries.forEach((offset, index) => {
              if (offset === occurrence && index < surfaceChildren.length) starts.push(index);
              if (offset === finish && index > 0) ends.push(index);
            });
            for (const start of starts) {
              for (const end of ends) {
                if (end <= start) continue;
                addCandidate(surfaceChildren.slice(start, end), end - start > 1 ? 1 : 2, depth, [selectedKey]);
              }
            }
            if (!starts.length || !ends.length) {
              const startIndex = sequence.boundaries.findIndex((offset, index) =>
                index < surfaceChildren.length && offset <= occurrence && occurrence < sequence.boundaries[index + 1]
              );
              const endIndex = sequence.boundaries.findIndex((offset, index) =>
                index < surfaceChildren.length && offset < finish && finish <= sequence.boundaries[index + 1]
              );
              if (startIndex >= 0 && endIndex >= startIndex) {
                const sliced = [];
                for (let index = startIndex; index <= endIndex; index += 1) {
                  const variant = sequence.variants[index];
                  const localStart = Math.max(0, occurrence - sequence.boundaries[index]);
                  const localEnd = Math.min(variant.length, finish - sequence.boundaries[index]);
                  const piece = localStart === 0 && localEnd === variant.length
                    ? surfaceChildren[index].cloneNode(true)
                    : sliceMathMLSurfaceNode(surfaceChildren[index], variant, localStart, localEnd, mathElement.ownerDocument);
                  if (!piece) { sliced.length = 0; break; }
                  sliced.push(piece);
                }
                addSlicedCandidate(
                  sliced,
                  depth,
                  occurrence,
                  'slice|' + candidateIds.get(node) + '|' + occurrence + '|' + finish + '|' + sequence.text
                );
              }
            }
            occurrence = sequence.text.indexOf(selectedKey, occurrence + 1);
          }
        }
      }
      for (const child of children) walk(child, depth + 1);
    };
    walk(presentation, 0);

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
    if (!container) return [];
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
    return roots.filter((root, index) =>
      !roots.some((other, otherIndex) => otherIndex !== index && other.contains && other.contains(root))
    ).sort((left, right) => {
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
      if (encoding.includes('tex') || encoding.includes('latex')) return (annotation.textContent || '').trim();
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
    if (!root || root.nodeType !== 1) return '';
    const attributeNames = ['data-latex', 'data-tex', 'data-math-source', 'data-original-tex', 'alttext'];
    for (const name of attributeNames) {
      const value = root.getAttribute && root.getAttribute(name);
      if (value) return stripLatexDelimiters(value);
    }
    const annotated = findTexAnnotation(root);
    if (annotated) return stripLatexDelimiters(annotated);
    const math = (root.matches && root.matches('math')) ? root : (root.querySelector && root.querySelector('math'));
    if (math) {
      const altText = math.getAttribute('alttext');
      if (altText) return stripLatexDelimiters(altText);
      const mathAnnotation = findTexAnnotation(math);
      if (mathAnnotation) return stripLatexDelimiters(mathAnnotation);
    }
    if (root.matches && root.matches('script[type^="math/tex"]')) return (root.textContent || '').trim();
    const embeddedScript = root.querySelector && root.querySelector('script[type^="math/tex"]');
    if (embeddedScript && embeddedScript.textContent) return embeddedScript.textContent.trim();
    for (const sibling of [root.previousElementSibling, root.nextElementSibling]) {
      if (sibling && sibling.matches && sibling.matches('script[type^="math/tex"]')) return (sibling.textContent || '').trim();
    }
    return stripLatexDelimiters(getMathJaxSource(root, pageWindow));
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
    if (aria) return aria;
    const image = root.querySelector && root.querySelector('img[alt]');
    if (image && image.getAttribute('alt')) return image.getAttribute('alt');
    const visual = root.querySelector && root.querySelector('.katex-html, mjx-container, svg');
    return cleanClipboardText((visual || root).textContent || '');
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

  function extractMathText(root, outputMode, pageWindow) {
    const mode = ['calculator', 'unicode', 'latex', 'ascii'].includes(outputMode) ? outputMode : 'calculator';
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
      '.MathJax', '[role="math"]', '[data-latex]', '[data-tex]', '[data-math-source]'
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

  function mathElementCount(element) {
    if (!element || !element.querySelectorAll) return 0;
    return element.matches && element.matches('math') ? 1 : element.querySelectorAll('math').length;
  }

  function isAccessibilityMath(mathElement) {
    let element = mathElement;
    let levels = 0;
    while (element && levels < 6) {
      const className = typeof element.className === 'string' ? element.className : '';
      const style = (element.getAttribute && element.getAttribute('style') || '').toLowerCase();
      if (/katex-mathml|assistive|sr-only|visually-hidden|screen-reader|mathml/i.test(className) ||
          /clip\s*:|clip-path\s*:|position\s*:\s*absolute/.test(style) ||
          element.hidden) return true;
      if (element.parentElement && element.parentElement.querySelector(':scope > [aria-hidden="true"]')) return true;
      element = element.parentElement;
      levels += 1;
    }
    return false;
  }

  function rendererContainerForMath(mathElement) {
    if (!mathElement || mathElement.nodeType !== 1) return null;
    let found = mathElement;
    let element = mathElement.parentElement;
    let levels = 0;
    const accessibilityTree = isAccessibilityMath(mathElement);
    while (element && levels < 8 && mathElementCount(element) === 1) {
      const recognized = isMathRoot(element);
      if (!recognized && !accessibilityTree) break;
      if (['body', 'html'].includes((element.localName || '').toLowerCase())) break;
      if (hasSignificantDirectText(element) && !recognized) break;
      found = element;
      if (recognized) {
        const parent = element.parentElement;
        if (!parent || !isMathRoot(parent) || mathElementCount(parent) !== 1) break;
      }
      element = element.parentElement;
      levels += 1;
    }
    return found;
  }

  function implicitMathContainerFromNode(node) {
    const original = node && node.nodeType === 1 ? node : node && node.parentElement;
    let element = original;
    let levels = 0;
    while (element && levels < 8) {
      const mathElements = element.querySelectorAll ? element.querySelectorAll('math') : [];
      if (mathElements.length === 1 && !mathElements[0].contains(node)) {
        const promoted = rendererContainerForMath(mathElements[0]);
        if (promoted && promoted.contains(node)) return promoted;
      }
      if (hasSignificantDirectText(element) && element !== original) break;
      element = element.parentElement;
      levels += 1;
    }
    return null;
  }

  function outermostMathAncestor(node) {
    let element = node && node.nodeType === 1 ? node : node && node.parentElement;
    let found = null;
    while (element) {
      if (isMathRoot(element)) found = element;
      element = element.parentElement;
    }
    return found || implicitMathContainerFromNode(node);
  }

  function canonicalMathRoots(container) {
    if (!container) return [];
    const base = container.nodeType === 1 ? container : container.parentElement || container;
    const candidates = [];
    if (isMathRoot(base)) candidates.push(base);
    if (base.querySelectorAll) {
      for (const candidate of base.querySelectorAll(MATH_DISCOVERY_SELECTOR)) {
        if (isMathRoot(candidate)) candidates.push(candidate);
      }
      for (const math of base.querySelectorAll('math')) {
        const promoted = rendererContainerForMath(math);
        if (promoted) candidates.push(promoted);
      }
    }
    return candidates.filter((candidate, index) => {
      if (candidates.indexOf(candidate) !== index) return false;
      return !candidates.some((other) => other !== candidate && other.contains && other.contains(candidate));
    });
  }

  function rangeIntersects(range, node) {
    try {
      return range.intersectsNode(node);
    } catch (_error) {
      return false;
    }
  }

  function rootsForRange(range) {
    const container = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    const roots = canonicalMathRoots(container).filter((root) => rangeIntersects(range, root));
    for (const boundaryNode of [range.startContainer, range.endContainer]) {
      const ancestor = outermostMathAncestor(boundaryNode);
      if (ancestor && !roots.includes(ancestor)) roots.push(ancestor);
    }
    roots.sort((left, right) => {
      if (left === right || !left.compareDocumentPosition) return 0;
      const position = left.compareDocumentPosition(right);
      return position & 2 ? 1 : -1;
    });
    return roots.filter((root) => !roots.some((other) => other !== root && other.contains(root)));
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

  function isHiddenElement(element) {
    if (!element || element.nodeType !== 1) return false;
    if (element.hidden || element.getAttribute('aria-hidden') === 'true') return true;
    const style = (element.getAttribute('style') || '').toLowerCase();
    if (/display\s*:\s*none|visibility\s*:\s*hidden/.test(style)) return true;
    const className = typeof element.className === 'string' ? element.className : '';
    return /(?:^|\s)(?:sr-only|visually-hidden|screen-reader-only|MJX_Assistive_MathML)(?:\s|$)/i.test(className);
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
      if (element.hasAttribute('data-clean-math-copy-value')) {
        const display = element.getAttribute('data-clean-math-copy-display') === 'true';
        if (display) newline(1);
        append(element.getAttribute('data-clean-math-copy-value') || '', false);
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

  function mathematicalItalicText(input) {
    return Array.from(String(input), (character) => {
      const code = character.codePointAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x1d434 + code - 65);
      if (code >= 97 && code <= 122) return character === 'h'
        ? '\u210e'
        : String.fromCodePoint(0x1d44e + code - 97);
      return character;
    }).join('');
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
      const variant = (node.getAttribute('mathvariant') || '').toLowerCase();
      const rendered = !variant && Array.from(value).length === 1 ? mathematicalItalicText(value) : value;
      return documentObject.createTextNode(rendered);
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
      const fraction = setRichStyle(span(), 'display:inline-block;vertical-align:middle;text-align:center;line-height:1.08;margin:0 0.12em;');
      const numerator = setRichStyle(span(), 'display:block;padding:0 0.18em 0.08em;');
      const denominator = setRichStyle(span(), 'display:block;border-top:1px solid currentColor;padding:0.08em 0.18em 0;');
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
    const elements = Array.from(fragment.querySelectorAll ? fragment.querySelectorAll('*') : []);
    for (const element of elements) {
      if (!element.isConnected && !fragment.contains(element)) continue;
      const tag = (element.localName || '').toLowerCase();
      if (SKIP_TAGS.has(tag) || isHiddenElement(element)) {
        element.remove();
        continue;
      }
      if (tag === 'img' || tag === 'area') {
        element.replaceWith(element.ownerDocument.createTextNode(element.getAttribute('alt') || ''));
        continue;
      }
      // Page content can forge attributes, so style retention is authorized
      // only for nodes created by this module in the current realm.
      const keepStyle = TRUSTED_RICH_STYLE_NODES.has(element);
      for (const attribute of Array.from(element.attributes || [])) {
        const name = attribute.name.toLowerCase();
        const keep = (keepStyle && name === 'style') || name === 'role' || name === 'colspan' || name === 'rowspan' || name === 'start';
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
      if (node.namespaceURI && node.namespaceURI !== MATHML_NAMESPACE) return null;
      if (name === 'mglyph') return documentObject.createTextNode(cleanXMLText(node.getAttribute('alt') || ''));
      if (!allowedElements.has(name)) {
        if (!removableForeignElements.has(name)) unsupportedMathML = true;
        return null;
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

  function semanticMathSelectionPayload(root, range, settings) {
    const math = getMathElement(root);
    if (!math) return { kind: 'unmatched' };
    const selectedText = cleanClipboardText(range.toString());
    const selectedKey = mathSelectionKey(selectedText);
    if (!selectedKey) return { kind: 'unmatched' };
    const visualBranch = visibleMathBranchForRange(root, range);
    if (visualBranch && selectedKey === mathSelectionKey(visualBranch.textContent || '')) {
      return { kind: 'whole' };
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
    const selectedMath = findSelectedMathMLFragment(
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
    const safeMath = sourceMath ? sanitizedMathMLClone(sourceMath) : null;
    if (sourceMath && !safeMath) return null;
    const text = safeMath && settings.outputMode !== 'latex'
      ? mathMLFragmentText(safeMath, settings.outputMode)
      : extractMathText(root, settings.outputMode, pageWindow);
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
    const semantic = semanticMathSelectionPayload(root, selected, settings);
    if (semantic.kind === 'payload') {
      semantic.payload.display = isDisplayMath(root);
      semantic.payload.mathRanges = 1;
      return semantic.payload;
    }
    if (semantic.kind === 'whole') return wholeMathRootPayload(root, settings, pageWindow);
    return null;
  }

  function rawRangePayload(range) {
    if (!range || range.collapsed) return null;
    const textFragment = range.cloneContents();
    const text = serializeDomFragment(textFragment);
    if (!text && !range.toString()) return null;
    const richFragment = range.cloneContents();
    return {
      text,
      html: sanitizeRichFragment(richFragment),
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
      const serialized = serializeRangePayloadWithMath(prefix, settings, pageWindow) || rawRangePayload(prefix);
      if (serialized) pieces.push(serialized);
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
        const serialized = serializeRangePayloadWithMath(middle, settings, pageWindow) || rawRangePayload(middle);
        if (serialized) pieces.push(serialized);
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
      const serialized = serializeRangePayloadWithMath(suffix, settings, pageWindow) || rawRangePayload(suffix);
      if (serialized) pieces.push(serialized);
    }
    return combineClipboardPayloads(pieces);
  }

  function serializeRangePayloadWithMath(range, settings, pageWindow) {
    const originalRoots = rootsForRange(range);
    if (!originalRoots.length) return null;
    const startRoot = outermostMathAncestor(range.startContainer);
    const endRoot = outermostMathAncestor(range.endContainer);
    if (originalRoots.length === 1 && startRoot && startRoot === endRoot &&
        nodeInside(startRoot, range.startContainer) && nodeInside(startRoot, range.endContainer)) {
      const semanticSelection = semanticMathSelectionPayload(startRoot, range, settings);
      if (semanticSelection.kind === 'payload') return semanticSelection.payload;
      // An exact but unrecognized partial selection must remain exact. Native
      // copying is preferable to silently adding the rest of the equation.
      if (semanticSelection.kind === 'unmatched') return null;
    }
    if (startRoot !== endRoot && (startRoot || endRoot)) {
      return serializePartialBoundaryRange(range, startRoot, endRoot, settings, pageWindow);
    }
    const expanded = expandedMathRange(range, originalRoots);
    const values = originalRoots.map((root) => {
      const sourceMath = getMathElement(root);
      const safeMath = sourceMath ? sanitizedMathMLClone(sourceMath) : null;
      return {
        text: sourceMath && !safeMath
          ? ''
          : (safeMath && settings.outputMode !== 'latex'
          ? mathMLFragmentText(safeMath, settings.outputMode)
          : extractMathText(root, settings.outputMode, pageWindow)),
        display: isDisplayMath(root),
        root,
        safeMath
      };
    });
    if (values.some((value) => !value.text || !value.text.trim())) return null;

    const textFragment = expanded.cloneContents();
    canonicalMathRoots(textFragment).forEach((root, index) => {
      const value = values[index] || {
        text: extractMathText(root, settings.outputMode, pageWindow),
        display: isDisplayMath(root)
      };
      const replacement = root.ownerDocument.createElement('span');
      replacement.setAttribute('data-clean-math-copy-value', value.text);
      replacement.setAttribute('data-clean-math-copy-display', String(value.display));
      root.replaceWith(replacement);
    });
    const text = serializeDomFragment(textFragment);

    const richFragment = expanded.cloneContents();
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
      let normalized = trimmed;
      try {
        normalized = normalized.normalize('NFKC');
      } catch (_error) {
        // Preserve the styled source if compatibility normalization is absent.
      }
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
      '#WACViewPanel_EditingElement, #WACViewPanel_ClipboardElement, .WACPageImg, .react-pdf__Page__textContent.textLayer'
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
      replacement.setAttribute('data-clean-math-copy-value', value.payload.text);
      replacement.setAttribute('data-clean-math-copy-display', String(value.display));
      placeholder.replaceWith(replacement);
    }
    const text = finalizeRewrittenText(serializeDomFragment(textFragment));

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

  function escapeClipboardHTML(input) {
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
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

  function rangeDOMWithinBudget(range, nodeLimit, depthLimit) {
    if (!range || !range.commonAncestorContainer) return false;
    const root = range.commonAncestorContainer;
    const stack = [{ node: root, depth: 0 }];
    let inspected = 1;
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
        if (intersects) stack.push({ node: child, depth: current.depth + 1 });
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

  function selectionRanges(documentObject, selection) {
    const ranges = [];
    if (!selection) return ranges;
    try {
      if (typeof selection.getComposedRanges === 'function') {
        const shadowRoots = [];
        for (const endpoint of [selection.anchorNode, selection.focusNode]) {
          const root = endpoint && endpoint.getRootNode ? endpoint.getRootNode() : null;
          if (root && root.nodeType === 11 && root.host && !shadowRoots.includes(root)) shadowRoots.push(root);
        }
        const staticRanges = selection.getComposedRanges({ shadowRoots });
        for (const staticRange of staticRanges) {
          const range = documentObject.createRange();
          range.setStart(staticRange.startContainer, staticRange.startOffset);
          range.setEnd(staticRange.endContainer, staticRange.endOffset);
          ranges.push(range);
        }
        if (ranges.length) return ranges;
      }
    } catch (_error) {
      // Older browsers expose getComposedRanges with a different signature.
    }
    for (let index = 0; index < selection.rangeCount; index += 1) {
      ranges.push(selection.getRangeAt(index).cloneRange());
    }
    return ranges;
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
      value = value.normalize('NFKC');
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
    return toScript(normalized, kind === 'sub' ? SUBSCRIPTS : SUPERSCRIPTS, kind === 'sub' ? '_' : '^');
  }

  function serializePositionedOfficeRange(range, settings, documentObject) {
    const container = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    const page = container && container.closest && container.closest('.react-pdf__Page, .textLayer');
    const searchRoot = page || documentObject;
    const tokenElements = Array.from(searchRoot.querySelectorAll(
      '.react-pdf__Page__textContent.textLayer .markedContent span[role="presentation"] > span[tabindex], ' +
      '.textLayer .markedContent span[role="presentation"] > span[tabindex]'
    ));
    const items = [];
    tokenElements.forEach((element, order) => {
      const selected = selectedTokenText(range, element, documentObject);
      if (!selected) return;
      const positioned = element.parentElement;
      const size = positionedStyleNumber(positioned, 'font-size');
      const left = positionedStyleNumber(positioned, 'left');
      const top = positionedStyleNumber(positioned, 'top');
      if (![size, left, top].every(Number.isFinite)) return;
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
    });
    if (items.length < 2) return null;

    let scriptCount = 0;
    for (const item of items) {
      const possibleBases = items.filter((base) =>
        base !== item && base.marked === item.marked && base.order < item.order &&
        item.size / base.size <= 0.82 && item.size / base.size >= 0.55
      );
      possibleBases.sort((left, right) => right.order - left.order);
      for (const base of possibleBases) {
        const gap = item.left - (base.left + base.width);
        const delta = (item.top - base.top) / base.size;
        if (gap < -0.25 * base.size || gap > 0.65 * base.size) continue;
        if (delta >= 0.18) item.script = 'sub';
        else if (delta <= -0.08) item.script = 'sup';
        else continue;
        item.attachedTo = base;
        scriptCount += 1;
        break;
      }
    }
    if (!scriptCount) return null;
    const styledMath = items.some((item) => hasMathematicalStyledCharacter(item.text));
    const mathSignal = styledMath || items.some((item) => /[=≠≈≤≥∝×÷Ωμ]/u.test(item.text));
    if (!mathSignal) return null;

    const baseItems = items.filter((item) => !item.attachedTo).sort((left, right) => left.order - right.order);
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
      const scripts = items.filter((candidate) => candidate.attachedTo === item).sort((left, right) => left.order - right.order);
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

  function positionedOfficePayload(ranges, settings, documentObject) {
    const payloads = ranges.map((range) => serializePositionedOfficeRange(range, settings, documentObject));
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

  function isRawLatexProtected(target, selection) {
    const element = target && target.nodeType === 1 ? target : target && target.parentElement;
    if (element && element.closest && element.closest('pre, code, textarea, input, [data-clean-math-copy-preserve]')) return true;
    const anchor = selection && selection.anchorNode;
    const anchorElement = anchor && anchor.nodeType === 1 ? anchor : anchor && anchor.parentElement;
    return Boolean(anchorElement && anchorElement.closest && anchorElement.closest('pre, code, textarea, input, [data-clean-math-copy-preserve]'));
  }

  function getCopyPayload(documentObject, selection, settingsInput, pageWindow, target) {
    const settings = normalizeSettings(settingsInput);
    if (!selection || selection.isCollapsed || selection.rangeCount === 0 || isTextControl(target)) return null;
    const ranges = selectionRanges(documentObject, selection);
    if (!ranges.length) return null;
    if (!ranges.some((range) => rootsForRange(range).length)) {
      const positioned = positionedOfficePayload(ranges, settings, documentObject);
      if (positioned) return positioned;
    }
    const rewritten = [];
    const rich = [];
    const mathMLPayloads = [];
    let mathRanges = 0;
    for (const range of ranges) {
      const serialized = serializeRangePayloadWithMath(range, settings, pageWindow);
      if (serialized != null) {
        rewritten.push(serialized.text);
        rich.push(serialized.html);
        if (serialized.mathML) mathMLPayloads.push(serialized.mathML);
        mathRanges += 1;
      } else {
        const nativeRangeText = range.toString();
        rewritten.push(nativeRangeText);
        rich.push(escapeClipboardHTML(nativeRangeText));
      }
    }
    if (mathRanges > 0) {
      const finalized = finalizeRewrittenText(rewritten.join('\n'));
      if (!finalized.trim()) return null;
      return {
        text: finalized,
        html: rich.join('<br>'),
        mathML: ranges.length === 1 && mathMLPayloads.length === 1 ? mathMLPayloads[0] : '',
        reason: 'rendered-math',
        mathRanges
      };
    }

    const nativeText = ranges.map((range) => range.toString()).join('\n');
    if (settings.convertDelimitedLatex && !isRawLatexProtected(target, selection)) {
      const converted = convertDelimitedLatexText(nativeText, settings.outputMode);
      const finalized = finalizeRewrittenText(converted.text);
      if (converted.converted > 0 && finalized.trim()) return { text: finalized, reason: 'delimited-latex', mathRanges: 0 };
    }
    const shouldDeferStandaloneMath = isMicrosoftOfficeWebPage(documentObject, pageWindow) ||
      isContentEditableSelection(documentObject, target, selection);
    if (!shouldDeferStandaloneMath && !isRawLatexProtected(target, selection)) {
      const unicodeMath = standaloneUnicodeMathPayload(nativeText, ranges, settings, documentObject);
      if (unicodeMath) return unicodeMath;
    }
    if (settings.cleanInvisibleArtifacts && hasCleanableArtifacts(nativeText)) {
      const cleaned = cleanClipboardText(nativeText);
      // Editors such as Word for the web populate their real clipboard payload
      // in their own copy handler even though Selection.toString() is only an
      // NBSP placeholder. Never preempt that handler with an empty clipboard.
      if (!cleaned.trim()) return null;
      return { text: cleaned, reason: 'invisible-artifacts', mathRanges: 0 };
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

  function writeClipboardPayload(payload, pageWindow, isCurrentInput) {
    const isCurrent = typeof isCurrentInput === 'function' ? isCurrentInput : () => true;
    if (!payload || !payload.text || !payload.text.trim() || !isCurrent()) return Promise.resolve(false);
    const writePlainFallback = () => isCurrent()
      ? setClipboardFromMenu(payload.text)
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
          return Promise.resolve(clipboard.write([new ClipboardItemConstructor(formats)])).then(() => true);
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
    if (payload.html) write('text/html', payload.html);
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
          if (semantic.html) event.clipboardData.setData('text/html', semantic.html);
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

  function install(documentObject, userscriptGlobal) {
    if (!documentObject || documentObject.__cleanMathCopyInstalled) return;
    Object.defineProperty(documentObject, '__cleanMathCopyInstalled', { value: true, configurable: true });
    const pageWindow = getPageWindow(userscriptGlobal || global);
    let settings = loadSettings();
    const handledEvents = new WeakSet();
    const officeCopyStates = new WeakMap();
    let activeOfficeState = null;
    let officeGeneration = 0;
    let manualClipboardGeneration = 0;

    try {
      if (global.GM && typeof global.GM.getValue === 'function') {
        Promise.resolve(global.GM.getValue(STORAGE_KEY, DEFAULT_SETTINGS)).then((stored) => {
          settings = normalizeSettings(stored);
        }, () => {});
      }
    } catch (_error) {
      // Synchronous manager APIs or defaults remain active.
    }

    const handleCopy = (event) => {
      if (!event || handledEvents.has(event)) return;
      handledEvents.add(event);
      // Any newer keyboard/context-menu copy invalidates an in-flight manual
      // Clipboard API retry just as another manual command would.
      manualClipboardGeneration += 1;
      let officeState = null;
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
          isCurrent: () => activeOfficeState === officeState && officeGeneration === generation
        };
        activeOfficeState = officeState;
        officeCopyStates.set(event, officeState);
        interceptOfficeClipboardWrites(event, officeState, settings, documentObject);
        officeState.recovery = armOfficeClipboardStagingRecovery(documentObject, settings, pageWindow, officeState);
      }
      const selection = documentObject.getSelection ? documentObject.getSelection() : null;
      const payload = getCopyPayload(documentObject, selection, settings, pageWindow, event.target);
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
      postprocessOfficeCopyEvent(event, settings, documentObject, state);
    };

    const view = documentObject.defaultView || userscriptGlobal;
    if (view && view.addEventListener) view.addEventListener('copy', handleCopy, true);
    documentObject.addEventListener('copy', handleCopy, true);
    if (view && view.addEventListener) view.addEventListener('copy', handleOfficeCopyBubble, false);

    const registerMenuCommand = typeof GM_registerMenuCommand === 'function'
      ? GM_registerMenuCommand
      : (global.GM && typeof global.GM.registerMenuCommand === 'function'
        ? global.GM.registerMenuCommand.bind(global.GM)
        : null);
    if (registerMenuCommand) {
      const setMode = (mode) => {
        settings = saveSettings({ ...settings, outputMode: mode });
      };
      registerMenuCommand('Clean Math Copy: calculator-safe output (recommended)', () => setMode('calculator'));
      registerMenuCommand('Clean Math Copy: readable Unicode output', () => setMode('unicode'));
      registerMenuCommand('Clean Math Copy: original LaTeX output', () => setMode('latex'));
      registerMenuCommand('Clean Math Copy: ASCII-only output', () => setMode('ascii'));
      registerMenuCommand('Clean Math Copy: toggle raw $...$ conversion', () => {
        settings = saveSettings({ ...settings, convertDelimitedLatex: !settings.convertDelimitedLatex });
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
        return text && isCurrent() ? setClipboardFromMenu(text) : Promise.resolve(false);
      });
      registerMenuCommand('Clean Math Copy: show current settings', () => {
        const message = 'Clean Math Copy v' + VERSION + '\nOutput: ' + settings.outputMode +
          '\nConvert selected $...$ / \\(...\\): ' + (settings.convertDelimitedLatex ? 'on' : 'off') +
          '\nClean invisible copy artifacts: ' + (settings.cleanInvisibleArtifacts ? 'on' : 'off');
        if (typeof global.alert === 'function') global.alert(message);
      });
    }

    return { handleCopy, get settings() { return { ...settings }; } };
  }

  return Object.freeze({
    VERSION,
    DEFAULT_SETTINGS,
    MATH_ROOT_SELECTOR,
    cleanClipboardText,
    cleanOfficeClipboardText,
    convertDelimitedLatexText,
    extractMathText,
    formatMathText,
    getCopyPayload,
    hasCleanableArtifacts,
    install,
    latexToCalculator,
    latexToUnicode,
    mathMLToCalculator,
    mathMLToLatex: mathMLToLatexNode,
    mathMLToUnicode,
    normalizeSettings,
    ommlToMathML,
    positionedOfficePayload,
    rootsForRange,
    serializeDomFragment,
    serializeRangePayloadWithMath,
    serializeRangeWithMath,
    looksLikeStandaloneUnicodeMath,
    unicodeToAscii,
    unicodeToCalculator
  });
});
