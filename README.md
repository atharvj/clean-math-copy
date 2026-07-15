# Clean Math Copy

Copies equations as accurate, readable text and removes accidental spacing or line breaks from ordinary copied text. It supports rendered web math, Google Docs, Word for the web, and selectable PDFs.

## Modes

- ✓ **Faithful readable** — closest clear plain-text version, such as `S = ∫ d⁴x √(−g) R`
- **Calculator-safe** — executable syntax where possible
- **Original LaTeX** — LaTeX output
- **Original copy/paste** — no rewriting

The active mode always has a checkmark.

## Install

For full web and PDF support, download the extension ZIP from [Releases](https://github.com/atharvj/clean-math-copy/releases), unzip it, then use **Load unpacked** on your browser's extensions page. Disable the userscript if you install the extension so two copy handlers do not run together.

For regular web pages only, install the [raw userscript](https://raw.githubusercontent.com/atharvj/clean-math-copy/main/clean-math-copy.user.js) with Tampermonkey or Violentmonkey. Chromium does not let userscript managers run inside its native PDF tabs, which is why the companion extension is required for PDFs.

Images without selectable or accessible text are left unchanged; they require OCR.

## Development

Requires Node.js 20.19+.

```sh
npm install
npm run check
npm run browser-smoke
npm run pdf-extension-smoke
```

[MIT License](./LICENSE)
