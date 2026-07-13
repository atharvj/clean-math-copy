# Clean Math Copy

Clean Math Copy is a self-contained userscript that reconstructs the structure of selected mathematics instead of copying the visual glyph order. It places calculator-safe text, clean rich HTML, and MathML (when available) on the clipboard, eliminating reversed fractions, missing roots, duplicated accessibility text, and surprise whitespace.

The installable file is [`clean-math-copy.user.js`](./clean-math-copy.user.js). It has no runtime package, CDN, network, analytics, or update dependency.

## What it does

The default plain-text output is calculator-safe:

| Selected content | Pasted text |
| --- | --- |
| Rendered `\sqrt{m/\lvert q\rvert}` | `sqrt(m/abs(q))` |
| Rendered `\frac{1}{0.452}\sqrt{\frac{2(0.666\times10^{-25})(2464)}{1.602\times10^{-19}}}` | `(1/0.452)*sqrt((2*(0.666*10^(-25))*(2464))/(1.602*10^(-19)))` |
| Only `0.666\times10^{-25}` highlighted inside `m=0.666\times10^{-25}\,kg` | `0.666*10^(-25)` |
| Plain Unicode `r ∝ √(m/\lvert q\rvert)` with no renderer metadata | `r ∝ sqrt(m/abs(q))` |
| Only plain Unicode `0.666 × 10⁻²⁵` highlighted | `0.666*10^(-25)` |
| Rendered `\sin(\lvert x\rvert)+\cos^2(y)` | `sin(abs(x))+cos(y)^(2)` |
| Rendered `\sum_{i=1}^n i^2` | `sum(i^(2),i,1,n)` |
| Rendered `\lim_{x\to0}\frac{\sin x}{x}` | `limit((sin(x)/x),x->0)` |
| Rendered `\begin{cases}x^2&x>0\\-x&x\le0\end{cases}` | `piecewise([x^(2),x>0],[-x,x<=0])` |
| Raw `$\mathrm{speed}=2\mathrm{time}$` | `speed=2*time` |
| Raw `$\sum_{i=1}^n i^2$` | `sum(i^(2),i=1,n)` |
| Word for the web positioned `R_1, R_2 = 4.7kΩ, 10kΩ and C = 220μF` | `R_(1), R_(2)=4.7*kOmega, 10*kOmega and C=220*muF` plus rich `<sub>` formatting |
| Rendered `\frac{-b \pm \sqrt{b^2-4ac}}{2a}` | `(-b+/-sqrt(b^(2)-4*a*c))/(2*a)` |
| Prose containing `$x^2 + 1$` | `Prose containing x^(2)+1` |
| A KaTeX expression with two DOM renderings | One expression, not duplicated text |

It understands:

- KaTeX, including its visual HTML plus hidden MathML pair
- renderer wrappers whose visual layout and accessibility MathML live in separate sibling branches, including the structure used by current ChatGPT math
- MathJax 2, 3, and 4 DOM conventions and MathItem metadata
- native presentation and basic content MathML
- TeX annotations such as `application/x-tex`
- common LaTeX structures: fractions, roots, scripts, Greek letters, operators, arrows, sets, accents, matrices, cases, aligned equations, text, font wrappers, and more
- calculator precedence in raw LaTeX, including grouped and nested fractions, braced bases, styled multi-letter identifiers, nested absolute values, indexed roots, implicit products, conventional and declared functions, inverse trig notation, logarithm bases, postfix factors, piecewise cases, and binomials
- coherent raw-LaTeX set relations and aggregates, including membership/union/intersection, divisibility, bounded sums/products/integrals, and limits
- rendered literal operators, scripted groups/fences, norms, functions, inverse functions, bounded operators, limits, and value-condition pairings in cases
- equations exposed through `data-latex`, `data-tex`, `data-math-source`, `alttext`, ARIA labels, and useful image alt text
- exact partial selections inside rendered equations, including contiguous MathML subtrees, fractions, roots, powers, repeated-looking scripts, and single-token substrings
- selections that cross from prose into only part of an equation, without silently adding the unselected remainder
- Microsoft Word for the web copy staging, MathML and OMML clipboard data, native duplicate-run cleanup, and its PDF.js-style positioned accessibility text layer
- multiple selection ranges and current open Shadow DOM selection APIs
- surrounding paragraphs, headings, line breaks, lists, tables, preformatted text, and image descriptions
- compact standalone Unicode equations and subexpressions when no renderer metadata exists, guarded by a math-specific detector that declines ordinary prose
- ordinary symbols, emoji sequences, combining marks, right-to-left control characters, code indentation, text fields, and intentional line breaks

It also removes copy-only artifacts that have no visible pasted meaning: soft hyphens, zero-width spaces, word joiners, stray byte-order marks, CRLF inconsistency, and non-breaking spaces copied as the wrong kind of whitespace. Emoji zero-width joiners are deliberately preserved.

For a rewritten equation, the clipboard contains several representations at once:

- `text/plain`: explicit calculator syntax using `sqrt(...)`, `abs(...)`, `*`, `/`, parentheses, and `10^(-n)`
- `text/html`: a sanitized rich representation with stacked fractions, radical bars, superscripts, and subscripts
- MathML clipboard formats when the selection is exactly one MathML-backed equation

The destination chooses the representation it supports. A calculator or plain editor receives the executable linear form; a compatible document editor receives structured rich math.

Rich identifiers use mathematical Unicode characters rather than italic/bold HTML tags. This preserves the mathematical appearance in document editors without causing Markdown-aware paste targets to manufacture literal `*q*` or `**q**` markers.

## Why ordinary text is safe

The script does not serialize every selection indiscriminately. If a selection contains no rendered math, no recognized `$...$`/`\(...\)` expression, no compact Unicode equation, and no known invisible copy artifact, it leaves the browser's native copy behavior completely alone. The Unicode fallback requires a genuinely transformative math glyph, compact math-like tokens, structural equation evidence, and no prose signals; comparisons used as ordinary labels or sentences—such as `Plan A ≠ Plan B`—remain native. Browser-native copying is still the most faithful path for code, rich editors, tables, language-specific spacing, and arbitrary prose.

When a rewrite is necessary, the userscript replaces only equation roots and performs structural serialization. It does not globally collapse all whitespace or delete all newlines. Intentional paragraph, list, table, `<br>`, and preformatted boundaries remain; renderer-generated duplication, zero-width glyphs, and trailing spaces/newlines do not.

An exactness rule applies before every override: a rewritten payload must contain non-whitespace content, and an unrecognized partial equation selection is never widened to a whole equation. Empty visual LaTeX constructs likewise remain on the native path. If a site such as Word has not populated its clipboard staging area yet, the script allows the site's own copy handler to run and postprocesses the resulting data afterward.

Vertical bars are interpreted structurally, not by glyph alone. Paired fences around an operand become `abs(...)`; divisibility, conditional-probability, set-builder, and evaluation bars remain relational separators. A lone or ambiguous bar is preserved instead of being guessed into an absolute value. Raw-LaTeX parsing, MathML matching, and rich-selection cloning are all bounded by input, depth, node, and work limits; an over-budget or malformed selection stays on the safe native/source path.

## Install

1. Install a userscript manager such as Tampermonkey, Violentmonkey, or Greasemonkey.
2. Open [`clean-math-copy.user.js`](./clean-math-copy.user.js) as a raw/local file in the manager, or create a new script and replace its contents with that file.
3. Save and enable it.
4. If you want it on local HTML/PDF helper pages, allow the manager access to `file://` URLs in the browser's extension settings.
5. Reload any already-open ChatGPT tabs after installing or updating the script.
   For Word for the web, reload the document tab too; its editor frame must receive the updated document-start listener.
6. Select content normally and use Copy (`Ctrl+C` or `⌘C`).

No page-specific setup is required. The script runs in frames as well as top-level pages when the userscript manager permits them.

## Output modes and controls

Open the userscript manager's menu while viewing any page. Clean Math Copy adds these commands:

- **Calculator-safe output (recommended and default):** explicit `sqrt`, `abs`, multiplication, division, grouping, and powers
- **Readable Unicode output:** symbols such as `≤`, `α`, `√`, `x²`, and `a₁`
- **Original LaTeX output:** uses the renderer's original source when available, wrapped in `$...$` or `$$...$$`
- **ASCII-only output:** substitutes portable forms such as `<=`, `alpha`, `sqrt(x)`, `x^2`, and `a_1`
- **Toggle raw `$...$` conversion:** controls conversion of delimited LaTeX found in ordinary prose; code, preformatted blocks, and text controls are always protected
- **Copy current selection now:** an explicit fallback for a page whose own UI does not dispatch a standard copy event; it retains the same plain-text, rich-HTML, and MathML representations as normal copying when the browser permits them
- **Show current settings:** reports the active persistent settings

Settings are stored through the userscript manager and work with both legacy `GM_*` and modern promise-based `GM.*` APIs. Local storage is a fallback when those APIs are not present.

## Resolution pipeline

For each equation, the script chooses the strongest available representation:

1. Embedded MathML, which preserves the rendered structure without copying the renderer twice
2. Office Math (OMML) supplied by Microsoft 365 clipboard or staging markup
3. Original TeX annotations or renderer metadata
4. Renderer data attributes
5. Accessible labels or image alt text
6. High-confidence positioned-script reconstruction for Word's accessibility text layer
7. Conservative standalone-Unicode equation conversion for source text with no renderer metadata
8. Guarded native clipboard cleanup as the final, non-destructive fallback

In calculator mode, MathML structure determines operand order and every implicit product is made explicit. In LaTeX output mode, original source takes priority. Unknown LaTeX commands are retained visibly instead of being silently discarded.

## Word, Google Docs, and document editors

The script supplies sanitized rich HTML so document editors can preserve the visible fraction, root, superscript, and subscript structure instead of receiving the flattened renderer order. It also supplies embedded MathML formats for applications that import MathML, including current Microsoft 365.

Word for the web needs special handling on the source side. Its normal page view can be a page image, while Accessibility Mode can expose individually positioned text tokens; its editing surface also uses a private clipboard staging element. Clean Math Copy supports all three usable paths: semantic MathML/OMML when Word provides it, measured subscript/superscript reconstruction for selected positioned tokens, and a late native-copy cleanup that folds only high-confidence mathematical-alphanumeric duplicates. That duplicate recovery turns Word's repeated baseline/script accessibility text into one coherent equation instead of a blank or doubled paste. Semantic data always outranks Word's temporary plain-text flavor—even if Word stops event propagation or fills its staging element afterward—and mixed Office HTML keeps all surrounding prose and equations. Recovery operations and asynchronous clipboard retries are generation-scoped: the newest copy wins, so an older delayed write cannot replace a newer keyboard or menu copy.

Google Docs can accept the rich HTML representation, but Google only documents creation of native editable equations through **Insert → Equation** and equation shortcuts; it does not expose a public clipboard format for constructing a native Google Docs equation object. Consequently, the rich paste can preserve visual formatting, but it cannot be guaranteed to become a native editable Docs equation. The simultaneous calculator-safe plain text remains mathematically correct if Docs chooses its plain-text clipboard flavor.

## Deliberate boundaries

Browser security establishes a few hard limits:

- Userscripts cannot run on protected browser UI such as `chrome://`, `about:`, browser extension pages, or some built-in PDF viewers.
- A canvas, raster image, or SVG path with no selectable DOM text, MathML, source metadata, ARIA label, or alt text has no equation data for a userscript to recover. OCR would require a separate image-recognition system and would be less reliable than the source-first behavior here.
- Programmatic calls made by a site directly to `navigator.clipboard.writeText()` do not emit the user-initiated `copy` event. Normal keyboard/menu copying does.
- Closed Shadow DOM contents can only be addressed to the extent the browser's composed selection API exposes or re-scopes them.
- Rewritten selections include clean plain text and newly generated, sanitized rich HTML. MathML is rebuilt through a Presentation MathML element/attribute allowlist, generated style trust is held out-of-band rather than accepted from page attributes, and oversized or over-deep semantic and rich-selection trees are rejected before cloning. The page's original hidden or duplicated renderer trees are never copied.
- Password fields and ordinary text controls remain on the browser-native path.

These are capability boundaries, not known corruption cases in the supported selection path.

## Test and inspect

Node 20.19 or newer is required only for development tests; the userscript itself has no runtime dependencies.

```sh
cd /Users/atharvjoshi/Downloads/coding/clean-math-copy
npm install
npm run check
npm run browser-smoke
```

`npm run check` performs a syntax check and runs the Node test suite. The suite includes the reported ChatGPT equations, exact scientific-number and one-token selections, whole-root versus radicand-only selection, denominator-first repeated-script disambiguation, selections crossing prose/math boundaries, standalone Unicode equations and comparative-prose rejection, raw-LaTeX precedence/styled identifiers/functions/inverse trig/cases/sets/aggregates and parser budgets, executable-result verification, real KaTeX 0.17-generated markup, rendered literal division, scripted fences, norms, functions, limits, cases, and bounded operators, absolute versus relational vertical bars, separate visual/accessibility branches, Word positioned subscripts, exact reported OMML content and native-duplicate recovery, mixed/multiple Office equations, stopped-event and delayed-staging recovery, cross-pipeline newest-copy-wins races, empty-payload rejection, MathML/rich-HTML sanitization and tree limits, rich clipboard formats and fallback retries, trailing-whitespace rejection, MathJax fallbacks, native-copy pass-through, and packaging checks. `npm run browser-smoke` is a permanent end-to-end runner that additionally drives the fixture through a locally installed Chromium-family browser and its real `ClipboardEvent`/`DataTransfer` implementation; set `CHROME_BIN` if the browser is in a nonstandard location.

For hands-on browser verification, open [`demo/manual-test.html`](./demo/manual-test.html) after installing the userscript. The larger validation grid is in [`docs/TEST-MATRIX.md`](./docs/TEST-MATRIX.md).

## Technical basis

The implementation follows the standard cancelable `copy` event and writes `text/plain`, `text/html`, and available MathML through `ClipboardEvent.clipboardData`. KaTeX's default combined output includes HTML and MathML, while MathJax exposes original input through MathItem metadata and may provide assistive MathML. MathML semantics explicitly supports alternate TeX annotations. See [`docs/RESEARCH.md`](./docs/RESEARCH.md) for the primary references and the design conclusions taken from them.

## License

MIT. See [`LICENSE`](./LICENSE).
