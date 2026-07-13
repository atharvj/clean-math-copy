# Validation matrix

The automated suite lives in `tests/` and runs with `npm run check`. A real Chromium-family clipboard smoke runs with `npm run browser-smoke`. The local interactive fixture is [`../demo/manual-test.html`](../demo/manual-test.html).

## Automated coverage

| Area | Cases |
| --- | --- |
| Faithful default | exact target outputs `(y′)² = 20x′`, `F_g = G((m₁m₂)/r²)`, and `r ∝ √(m/\|q\|)` from raw LaTeX and real KaTeX; real primes; Unicode scripts; visible roots/bars/norms; minimal fraction grouping; authored multiplication; no synthetic trailing whitespace |
| LaTeX structure | fractions with compound/nested operands, invisible braced groups, styled multi-letter identifiers and full supported mathematical alphabets, indexed roots, nested absolute values and scripts/prescripts, implicit multiplication, canonical Greek/symbol variants, conventional/declared/inverse functions, function spacing/fences/arguments/powers, logarithm bases, postfix factors, binomials/zero-line stacks, cancellation/boxes, calculator-safe piecewise cases, matrices, aligned/gathered rows, text blocks, accents, and unknown-command preservation |
| LaTeX relations and aggregates | membership/non-membership, subset, union/intersection, divisibility, quantifiers, bounded sums/products/integrals, limits, and coherent calculator argument order |
| Raw delimiter detection | `$...$`, `$$...$$`, `\(...\)`, `\[...\]`, escaped delimiters, adjacent currency, empty visual constructs, prose conversion, code/pre/input protection, malformed source, parser depth/work exhaustion with source preservation |
| MathML | tokens, rows, literal operators/division, ordinary and zero-line fractions, roots, absolute values/norms/evaluation bars, implicit multiplication, functions and invisible apply operators, inverse/powered/based functions, bounded aggregates and limits, scripts/prescripts, renderer accents/underlines, enclosures, matrix versus relation-table classification, fenced groups, semantics annotations, basic content MathML, safe XML round-trip, allowlist sanitization, node/depth limits |
| Vertical-bar semantics | nested paired absolute values, mislabeled fence tokens, exact left/right/token selections, divisibility (`\mid`), conditional probability, set-builder notation, evaluation bars, and ambiguous/lone-bar preservation |
| Calculator output | opt-in explicit products, grouped division, `sqrt`, nested `abs`, indexed powers, function calls and powers, log bases, coherent aggregate forms, negative scientific powers, precedence, removal of trailing whitespace, executable numeric-result verification, unchanged results from the 1.x implementation |
| KaTeX | real KaTeX 0.17 output, faithful and calculator modes, HTML+MathML duplication removal, separate visual/accessibility branches, browser-renamespaced nested tokens (`\bmod`, overset arrows, bold symbols), binomial/accent/enclosure/prescript/alignment rich fidelity, current ChatGPT failure regressions, exact scientific-number/exponent/token and one-sided-bar selections, denominator-first repeated scripts, whole-radical versus radicand selection, rendered functions/aggregates/relational bars, zero-surface-node performance, mixed prose/partial-math boundaries, safe unmatched-partial fallback, source extraction, inline/display detection |
| MathJax | direct MathItem lookup, iterable MathItem fallback after lookup failure, original TeX conversion, exact root/SVG/text-node whole-surface drags, strict-partial non-widening, and source/visible identifier plus stable-operator agreement |
| Surrounding content | paragraphs, headings, explicit and consecutive `<br>` boundaries, nested lists, ordered `start`/`value`/`reversed`/type numbering, tables and tabs, preformatted indentation, inline code spacing, image alt text, removal of CSS-hidden alternate trees, and retention of visible prose that is merely ARIA-marked |
| Standalone Unicode math | whole root/fraction expressions, exact scientific-number partials, superscripts and indexed roots, uppercase/lowercase Greek tokens, nested functions/absolute values, Markdown-emphasis cleanup around bars, structurally supported long identifiers, original-symbol rich HTML, ambiguous-bar/prose/comparative-label false-positive rejection, code/pre/editor protection |
| Ordinary text cleanup | source-wrap and repeated-space cleanup, uneven inline spans, complex Unicode, paragraphs/headings/breaks, nested and ordered lists, tables, `pre-line`, preformatted/code islands, multiple ranges, clean native pass-through, contenteditable/text-control/code protection |
| Ordinary rich security | sanitization of scripts, SVG, iframes, event attributes, hostile URLs/styles, hidden alternates, unknown custom elements; markup-length, node, depth, total-range, and cross-range math-root budgets; native fallback for over-budget, throwing Selection-like, or computed-layout-ambiguous selections without cloning |
| Clipboard behavior | faithful `text/plain` default, opt-in calculator text, sanitized rich `text/html`, exact-selection MathML flavors, rich manual-copy command, custom-MathML rejection retry, serialized newest-copy-wins behavior across normal/manual/Office writes including already-started writes, prevention of later conflicting page handlers only on rewritten selections, deferred-settings-read race protection |
| Rich math security | element/attribute allowlists, non-forgeable generated-style trust, safe reconstruction of KaTeX's HTML-namespaced nested token structures, visible-anchor/grouping agreement for hidden semantics and source metadata, pre-clone selection node/depth limits, MathML markup/tree/candidate budgets, oversized-tree native/text fallback |
| Word for the web | faithful Unicode scripts and opt-in calculator operators/units, measured positioned script geometry, exact partial and multiline positioned-token ranges, sanitized `<sub>` rich output, exact reported native/OMML line, duplicate accessibility-run cleanup, OMML fraction/root/script conversion, mixed HTML and multi-oMathPara preservation, stopped-propagation writes, both semantic/plain write orders, delayed semantic staging, generation-scoped recovery, blank safeguards |
| Hygiene | CRLF, NBSP, soft hyphen, zero-width space, word joiner, BOM, NFC normalization |
| Packaging | version 2.0.0 userscript metadata, atharvj homepage/support/download/update URLs, v3 storage key, faithful default, document-start injection, HTTPS matching, no `@require`, no runtime network calls, JavaScript syntax |
| Real browser runner | permanent local Chromium-family launch, loopback-only DevTools connection, real `ClipboardEvent`/`DataTransfer`, all three exact faithful target formulas, exact rendered partials, ordinary cleanup/native pass-through, rich clipboard flavors, deterministic shutdown/cleanup |

## Manual browser grid

Run the fixture in every browser/userscript-manager combination you care about:

| Browser | Manager | Keyboard copy | Context-menu copy | Menu “copy now” | Local file permission |
| --- | --- | --- | --- | --- | --- |
| Chrome/Chromium | Tampermonkey | ☐ | ☐ | ☐ | ☐ |
| Chrome/Chromium | Violentmonkey | ☐ | ☐ | ☐ | ☐ |
| Firefox | Tampermonkey | ☐ | ☐ | ☐ | ☐ |
| Firefox | Violentmonkey | ☐ | ☐ | ☐ | ☐ |
| Firefox | Greasemonkey | ☐ | ☐ | ☐ | ☐ |
| Edge | Tampermonkey | ☐ | ☐ | ☐ | ☐ |
| Safari | a compatible userscript manager | ☐ | ☐ | ☐ | ☐ |

For each combination:

1. Copy every green fixture card into a plain-text editor.
2. Confirm the pasted value matches the expected text shown under the card.
3. Confirm faithful readable output is the initial mode. Then switch through Calculator, LaTeX, and ASCII modes and repeat the mode-specific cards.
4. Copy hard-wrapped or multiply spaced ordinary prose and confirm it is cleaned. Copy already-clean prose, the code block, editable content, emoji, and the textarea; confirm their native content is unchanged.
5. Drag-select only a meaningful visible subexpression inside a rendered equation; confirm only that subexpression is pasted with its semantic power/fraction/root structure. Repeat with one visually repeated token and each side of an absolute-value fence. An arbitrary unmatched glyph fragment must not expand to the complete equation.
6. Select across several cards; confirm block boundaries, list lines, table tabs, and preformatted indentation.
7. Use the fixture's paste inspector to check that rewritten selections expose faithful `text/plain` plus generated `text/html` without a duplicated renderer tree. In calculator mode, confirm the same selection exposes executable syntax.
8. Copy a paired absolute value, norm, conditional-probability, divisibility, and set-builder bar. In faithful mode, confirm their visible bars remain faithful; in calculator mode, confirm only the paired absolute fence becomes `abs(...)` and the norm becomes `norm(...)`.
9. In Word for the web, copy the complete `R₁, R₂ = 4.7kΩ, 10kΩ and C = 220μF` equation, either single `R` subscript, and a numeric fragment. Confirm no blank payload, duplicate accessibility run, or selection widening.
10. Trigger “copy current selection now,” immediately make a different keyboard copy, and paste. Confirm the newer keyboard selection wins even if the earlier asynchronous write completes later.
11. Toggle ordinary-text cleanup off and confirm messy prose uses native copy; turn it back on and confirm the DOM-aware cleaned result returns.

## High-value live-site checks

The implementation is renderer-based rather than site-specific. Still, these are useful smoke targets when available:

- a KaTeX documentation expression
- a MathJax 4 documentation expression without assistive MathML enabled
- a MathJax 3 page with assistive MathML
- a Wikipedia native/MathML equation
- a notebook or Q&A page containing prose plus several inline and display equations
- a page with a custom copy/citation handler
- content inside an open web component Shadow DOM
- Word for the web in editing mode and Accessibility Mode, including an equation with subscript/superscript tokens

Record the URL, browser, manager version, output mode, copied selection, expected output, and actual output for any failure. The renderer-aware structural fallbacks make that report directly actionable.
