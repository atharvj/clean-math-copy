# Clean Math Copy

Clean Math Copy is a self-contained userscript that turns visually rendered equations into faithful, readable text and cleans copy-broken ordinary prose. It reconstructs semantic math structure instead of trusting flattened glyph order, so roots, fractions, scripts, primes, bars, matrices, and exact partial selections paste in the order the user actually selected.

Version 2.0 defaults to faithful readable output. Calculator-safe syntax remains one menu click away. The installable artifact is [`clean-math-copy.user.js`](./clean-math-copy.user.js); it has no runtime package, CDN, analytics, network, or `@require` dependency.

## Default output

The faithful mode preserves real mathematical notation while adding only the grouping needed to make two-dimensional structures unambiguous:

| Selected math | Default pasted text |
| --- | --- |
| `(y')^2=20x'` | `(y′)² = 20x′` |
| `F_g=G\left(\frac{m_1m_2}{r^2}\right)` | `F_g = G((m₁m₂)/r²)` |
| `r\propto\sqrt{\frac{m}{\lvert q\rvert}}` | `r ∝ √(m/\|q\|)` |
| Only `0.666×10−25` inside a longer rendered line | `0.666 × 10⁻²⁵` |
| `\sin^2(x)+\log_2 x` | `sin²(x) + log₂ x` |
| `\lVert x\rVert_2` | `‖x‖₂` |
| `\sum_{i=1}^n i^2` | `∑ᵢ₌₁ⁿ i²` |
| `\begin{bmatrix}a&b\\c&d\end{bmatrix}` | `[a, b; c, d]` |
| `\binom{n}{k}` | `C(n, k)` |
| `\vec v,\;\bar x` | `v⃗, x̅` |
| `\begin{aligned}x&=1\\y&=2\end{aligned}` | `x = 1; y = 2` |
| Word for the web equation `R_1, R_2 = 4.7kΩ, 10kΩ and C = 220μF` | `R₁, R₂ = 4.7kΩ, 10kΩ and C = 220μF` plus rich `<sub>` formatting |

Primes become real `′`, `″`, and `‴` characters; supported superscripts and subscripts become Unicode scripts; explicit `×`, `·`, roots, absolute-value bars, norms, Greek letters, and relations remain visible. Fractions use `/` with minimal grouping, so `m₁m₂/r²` stays compact while `(a + b)/(c + d)` remains unambiguous.

An exact-selection invariant applies before every override: recognized partial math copies only that partial, and an empty or unmatched fragment never widens to the containing line or equation. Selecting only `q`, a radicand, one scientific-number fragment, or one side of a fence cannot silently add the rest. A source-only MathJax/SVG surface is promoted only when the selection covers its complete visible token sequence; every strict partial stays native.

## Ordinary-text cleanup

Version 2.0 also repairs ordinary copied text when the DOM provides concrete evidence that the browser's raw selection is messy. It can:

- join accidental source-code or layout wraps inside a visual prose line;
- collapse repeated collapsible spaces while preserving real paragraph and `<br>` boundaries;
- retain nested list markers, ordered-list numbering, table rows/cells, headings, and image descriptions;
- preserve preformatted islands, code spacing, emoji ZWJ sequences, combining marks, and right-to-left text;
- remove copy-only soft hyphens, zero-width artifacts, word joiners, stray BOMs, and renderer duplicates;
- generate sanitized rich HTML without copying scripts, event handlers, hostile styles, hidden alternate trees, or custom executable elements.

Clean text stays on the browser-native path. Text controls, editable surfaces, `<pre>`, and `<code>` also stay native unless they are part of a larger safely reconstructed selection. Oversized, over-deep, or layout-ambiguous selections are never cloned or rewritten; they stay on the browser-native copy path.

## Calculator-safe mode

Choose **Clean Math Copy: calculator-safe output** from the userscript menu when the destination needs executable syntax. The same structures then become explicit `sqrt(...)`, `abs(...)`, `*`, `/`, and grouped powers:

| Selected math | Calculator-safe text |
| --- | --- |
| `r ∝ √(m/\|q\|)` | `r ∝ sqrt(m/abs(q))` |
| `0.666 × 10⁻²⁵` | `0.666*10^(-25)` |
| `\frac{1}{0.452}\sqrt{\frac{2(0.666\times10^{-25})(2464)}{1.602\times10^{-19}}}` | `(1/0.452)*sqrt((2*(0.666*10^(-25))*(2464))/(1.602*10^(-19)))` |

A copy event cannot know which application will eventually receive the paste, so one `text/plain` value cannot be both visually faithful and accepted by every calculator. The persistent menu mode makes that tradeoff explicit instead of guessing incorrectly.

## Supported sources

Clean Math Copy understands:

- KaTeX visual HTML plus hidden MathML, including separate ChatGPT visual/accessibility branches;
- MathJax 2, 3, and 4 containers, MathItem source, and assistive MathML;
- native Presentation MathML and supported Content MathML;
- TeX annotations and `data-latex`, `data-tex`, `data-math-source`, `alttext`, ARIA, and useful image-alt sources;
- raw `$...$`, `$$...$$`, `\(...\)`, and `\[...\]` selections outside protected code and text controls;
- Microsoft Word for the web OMML/MathML clipboard data, private staging markup, positioned Accessibility Mode tokens, and high-confidence native duplicate recovery;
- compact standalone Unicode formulas when no renderer metadata exists;
- multiple ranges and current open-Shadow-DOM composed selections.

Math structure includes fractions, indexed roots, scripts and prescripts, primes, accents, functions, products, sets, aggregates and limits, absolute values versus relational bars, matrices, cases, aligned equations, text runs, and mathematical alphabet variants. Sanitized rendered structure remains authoritative when hidden MathML or TeX metadata disagrees with stable visible anchors or grouping. Parser, matcher, clipboard-markup, range-count, node, depth, root-total, and candidate budgets keep hostile input bounded.

## Clipboard representations

For rewritten math, the clipboard can carry several representations simultaneously:

- `text/plain`: faithful readable text by default, or the selected alternate mode;
- `text/html`: newly generated, sanitized rich fractions and zero-line stacks, radicals, scripts/prescripts, accents, cancellation/boxes, matrices, and surrounding document structure;
- MathML clipboard flavors when the selection is exactly one MathML-backed equation.

Document editors can choose the rich or MathML representation, while plain editors receive the readable linear form. Microsoft 365 documents MathML clipboard support. Google Docs accepts rich HTML but does not document a public clipboard format for constructing a native editable equation, so visual preservation is possible but conversion into a native Docs equation cannot be guaranteed.

## Install

1. Install Tampermonkey, Violentmonkey, Greasemonkey, or another compatible userscript manager.
2. Open the [raw userscript](https://raw.githubusercontent.com/atharvj/clean-math-copy/main/clean-math-copy.user.js), or create a new userscript and paste in [`clean-math-copy.user.js`](./clean-math-copy.user.js).
3. Save and enable it.
4. Reload already-open ChatGPT and Word for the web tabs. Word's editor frame must receive the new document-start listener.
5. Select normally and copy with `Ctrl+C`, `⌘C`, or the browser context menu.

To use local fixtures, allow the userscript manager access to `file://` pages. The script runs in frames when the manager permits them.

## Menu and settings

The userscript menu exposes:

- **Faithful readable output (recommended):** the version 2 default;
- **Calculator-safe output:** explicit executable linear syntax;
- **Original LaTeX output:** renderer source wrapped in `$...$` or `$$...$$` when available;
- **ASCII-only output:** portable approximations such as `<=`, `alpha`, `sqrt(x)`, and `x_2`;
- **Toggle raw `$...$` conversion**;
- **Toggle ordinary-text cleanup**;
- **Copy current selection now** for sites that do not dispatch a standard copy event;
- **Show current settings**.

Settings use userscript-manager storage, with local storage as a fallback. Version 2 uses a new settings key so upgrades start in faithful mode; users who prefer calculator output can select it once and keep it persistently.

## Word, races, and fail-safe behavior

Word for the web may expose a page image, positioned accessibility tokens, semantic OMML/MathML, or a delayed private staging element. Clean Math Copy prefers semantic data, reconstructs scripts only when geometry and mathematical evidence agree, and folds only provable duplicate accessibility runs. It never replaces the clipboard with a blank placeholder.

Office recovery and manual clipboard writes share a generation-scoped serialized queue. A delayed older copy cannot overwrite a newer keyboard, menu, or Office copy, including when the older browser write had already started and could no longer be cancelled. If a browser rejects a custom MathML format, the manual command retries with plain plus rich HTML. A deferred userscript-manager settings read is similarly guarded, so it cannot undo a mode selected from the menu while startup is still resolving.

## Deliberate boundaries

- Userscripts cannot run on protected browser UI, extension pages, or every built-in PDF viewer.
- Canvas pixels, raster images, and SVG paths without selectable text, MathML, source metadata, ARIA, or alt text require OCR, which this structure-first userscript deliberately does not guess.
- A site's direct `navigator.clipboard.writeText()` call does not emit a user copy event.
- Closed Shadow DOM can only be handled to the extent the browser exposes its composed selection.
- Rich HTML and MathML are rebuilt through allowlists and strict budgets; the source renderer tree is never pasted wholesale.
- Password fields remain native.

## Test and inspect

Node 20.19 or newer is required only for development:

```sh
cd clean-math-copy
npm install
npm run check
npm run browser-smoke
```

`npm run check` runs the syntax and Node suites. `npm run browser-smoke` drives a permanent fixture through a locally installed Chromium-family browser and real `ClipboardEvent`/`DataTransfer`; set `CHROME_BIN` for a nonstandard browser path.

For manual verification, open [`demo/manual-test.html`](./demo/manual-test.html). The complete validation grid is in [`docs/TEST-MATRIX.md`](./docs/TEST-MATRIX.md), and primary-source design references are in [`docs/RESEARCH.md`](./docs/RESEARCH.md).

## License

MIT. See [`LICENSE`](./LICENSE).
