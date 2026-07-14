# Clean Math Copy

A self-contained userscript that copies rendered equations as accurate, readable text and cleans accidental spacing or line breaks from ordinary copied text. It supports Google Docs, KaTeX, MathJax, MathML, Microsoft Word for the web, raw LaTeX, and exact partial selections.

Examples: `F_g = G((m₁m₂)/r²)`, `r ∝ √(m/|q|)`, and `0.666 × 10⁻²⁵`.

## Install or update

1. Install Tampermonkey or Violentmonkey.
2. Open the [raw userscript](https://raw.githubusercontent.com/atharvj/clean-math-copy/main/clean-math-copy.user.js) and confirm installation.
3. Fully quit and reopen the browser so open pages cannot keep an older copy listener.

The default **Faithful readable** mode keeps visible symbols and adds grouping only when needed. The userscript menu also offers calculator-safe, original-LaTeX, and ASCII-only modes.

Images or canvas/SVG drawings without selectable or accessible math require OCR and are left unchanged. Protected browser pages may block userscripts. Ambiguous selections stay on the browser's native copy path.

## Development

Requires Node.js 20.19+.

```sh
npm install
npm run check
npm run browser-smoke
```

[MIT License](./LICENSE)
