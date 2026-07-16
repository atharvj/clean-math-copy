# Clean Math Copy

Copies equations as accurate, readable text and removes accidental spacing or line breaks from ordinary copied text. It supports rendered web math, Google Docs, Word for the web, and selectable PDFs opened in the browser.
Math recognition follows the selected structure and visible layout, not a website allowlist.

## Install

Install the [raw userscript](https://raw.githubusercontent.com/atharvj/clean-math-copy/main/clean-math-copy.user.js) with Tampermonkey or Violentmonkey.
That one userscript is the entire install; no companion extension is required.

## Modes

- ✓ **Readable text** — closest clear plain-text version, such as `S = ∫ d⁴x √(−g) R`
- **Calculator-safe** — executable syntax where possible
- **Original LaTeX** — LaTeX output
- **Original copy/paste** — no rewriting

The active mode always has a checkmark.

PDFs open normally; on Chromium, the userscript replaces supported PDF tabs with a selectable view. Browsers that block userscripts inside their protected PDF viewer cannot be changed by a userscript. Image-only PDFs require OCR.

[MIT License](./LICENSE)
