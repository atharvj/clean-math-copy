# Clean Math Copy

Clean Math Copy is a self-contained userscript that copies rendered web equations as accurate, readable text and cleans accidental spacing or line breaks from ordinary copied text. It supports Google Docs, KaTeX, MathJax, MathML, Microsoft Word for the web, raw LaTeX, and exact partial selections.

## Examples

- Gravity formula → `F_g = G((m₁m₂)/r²)`
- Radical and absolute value → `r ∝ √(m/|q|)`
- Selected scientific notation → `0.666 × 10⁻²⁵`

The default mode keeps visible mathematical symbols and adds grouping only when needed. Clean prose keeps intentional paragraphs, lists, tables, code spacing, and line breaks.

## Install or update

1. Install Tampermonkey or Violentmonkey.
2. Open the [raw userscript](https://raw.githubusercontent.com/atharvj/clean-math-copy/main/clean-math-copy.user.js) and confirm installation.
3. Reload pages that were already open.

Opening the same link updates an existing installation. Compatible managers can also update it automatically.

## Menu modes

- **Faithful readable:** visual Unicode math, recommended and enabled by default.
- **Calculator-safe:** explicit `sqrt(...)`, `abs(...)`, operators, and grouping.
- **Original LaTeX:** source LaTeX when the page exposes it.
- **ASCII-only:** portable plain-ASCII notation.

The menu also controls raw-LaTeX conversion and ordinary-text cleanup, and can copy the current selection manually.

## Limits

- Images, canvas pixels, and SVG paths without selectable or accessible math need OCR and remain unchanged.
- Protected browser pages and some built-in PDF viewers do not allow userscripts.
- Programmatic clipboard writes may bypass browser copy events.
- Rich formatting depends on what the destination accepts; Google Docs may preserve appearance without creating a native editable equation.
- When a selection is ambiguous or exceeds safety limits, the browser's original copy behavior is preserved.

## Development

Node.js 20.19 or newer is required.

```sh
npm install
npm run check
npm run browser-smoke
```

The browser smoke test uses an installed Chromium-family browser. Set `CHROME_BIN` when needed.

## License

[MIT](./LICENSE)
