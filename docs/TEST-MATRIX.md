# Validation matrix

The automated suite lives in `tests/` and runs with `npm run check`. A real Chromium-family clipboard smoke runs with `npm run browser-smoke`. The local interactive fixture is [`../demo/manual-test.html`](../demo/manual-test.html).

## Automated coverage

| Area | Cases |
| --- | --- |
| LaTeX structure | fractions with compound/nested operands, braced bases, styled multi-letter identifiers, indexed roots, nested absolute values and scripts, implicit multiplication, adjacent Greek tokens, conventional/declared/inverse functions, function spacing/fences/arguments/powers, logarithm bases, postfix factors, binomials, calculator-safe piecewise cases, matrices, text blocks, accents, and unknown-command preservation |
| LaTeX relations and aggregates | membership/non-membership, subset, union/intersection, divisibility, quantifiers, bounded sums/products/integrals, limits, and coherent calculator argument order |
| Raw delimiter detection | `$...$`, `$$...$$`, `\(...\)`, `\[...\]`, escaped delimiters, adjacent currency, empty visual constructs, prose conversion, code/pre/input protection, malformed source, parser depth/work exhaustion with source preservation |
| MathML | tokens, rows, literal operators/division, fractions, roots, absolute values and norms, implicit multiplication, functions and invisible apply operators, inverse/powered/based functions, bounded aggregates and limits, scripted closing fences, piecewise tables, under/over, fenced groups, semantics annotations, basic content MathML, safe XML round-trip, allowlist sanitization, node/depth limits |
| Vertical-bar semantics | nested paired absolute values, mislabeled fence tokens, exact left/right/token selections, divisibility (`\mid`), conditional probability, set-builder notation, evaluation bars, and ambiguous/lone-bar preservation |
| Calculator output | explicit products, grouped division, `sqrt`, nested `abs`, indexed powers, function calls and powers, log bases, coherent aggregate forms, negative scientific powers, precedence, removal of trailing whitespace, executable numeric-result verification |
| KaTeX | real KaTeX 0.17 output, HTML+MathML duplication removal, separate visual/accessibility branches, current ChatGPT failure regressions, exact scientific-number/exponent/token and one-sided-bar selections, denominator-first repeated scripts, whole-radical versus radicand selection, rendered functions/aggregates/relational bars, zero-surface-node performance, mixed prose/partial-math boundaries, safe unmatched-partial fallback, source extraction, inline/display detection |
| MathJax | direct MathItem lookup, iterable MathItem fallback after lookup failure, original TeX conversion |
| Surrounding content | paragraphs, blank-line boundaries, lists, ordered numbering, tables, tabs, preformatted indentation, image alt text, hidden accessibility nodes |
| Standalone Unicode math | whole root/fraction expressions, exact scientific-number partials, superscripts and indexed roots, uppercase/lowercase Greek tokens, nested functions/absolute values, Markdown-emphasis cleanup around bars, structurally supported long identifiers, original-symbol rich HTML, ambiguous-bar/prose/comparative-label false-positive rejection, code/pre/editor protection |
| Ordinary text | browser-native pass-through, symbol-containing prose rejection, emoji ZWJ preservation, combining text, intentional whitespace, text-control pass-through |
| Clipboard behavior | capture-phase replacement, calculator `text/plain`, sanitized rich `text/html`, exact-selection MathML flavors, rich manual-copy command, custom-MathML rejection retry, newest-copy-wins invalidation across normal/manual/Office writes, prevention of later conflicting page handlers only on rewritten selections |
| Rich clipboard security | element/attribute allowlists, non-forgeable generated-style trust, pre-clone selection node/depth limits, MathML markup/tree/candidate budgets, oversized-tree native/text fallback |
| Word for the web | measured positioned subscript geometry, calculator operators/units, exact partial and multiline positioned-token ranges, sanitized `<sub>` rich output, exact reported native/OMML line, duplicate accessibility-run cleanup, OMML fraction/root/script conversion, mixed HTML and multi-oMathPara preservation, stopped-propagation writes, both semantic/plain write orders, delayed semantic staging, generation-scoped recovery, blank safeguards |
| Hygiene | CRLF, NBSP, soft hyphen, zero-width space, word joiner, BOM, NFC normalization |
| Packaging | userscript metadata, document-start injection, HTTPS matching, no `@require`, no runtime network calls, JavaScript syntax |
| Real browser runner | permanent local Chromium-family launch, loopback-only DevTools connection, real `ClipboardEvent`/`DataTransfer`, exact rendered partials, standalone Unicode, native pass-through, rich clipboard flavors, deterministic shutdown/cleanup |

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
3. Switch through Calculator, Unicode, LaTeX, and ASCII modes and repeat the mode-specific cards.
4. Copy ordinary prose, the code block, emoji, and the textarea; confirm native content is unchanged.
5. Drag-select only a meaningful visible subexpression inside a rendered equation; confirm only that subexpression is pasted with its semantic power/fraction/root structure. Repeat with one visually repeated token and each side of an absolute-value fence. An arbitrary unmatched glyph fragment must not expand to the complete equation.
6. Select across several cards; confirm block boundaries, list lines, table tabs, and preformatted indentation.
7. Use the fixture's paste inspector to check that rewritten selections expose calculator-safe `text/plain` and generated `text/html` without a duplicated renderer tree.
8. Copy a paired absolute value, then conditional-probability, divisibility, and set-builder bars. Confirm only the paired fence becomes `abs(...)`; relational bars remain bars or descriptive relations.
9. In Word for the web, copy the complete `R₁, R₂ = 4.7kΩ, 10kΩ and C = 220μF` equation, either single `R` subscript, and a numeric fragment. Confirm no blank payload, duplicate accessibility run, or selection widening.
10. Trigger “copy current selection now,” immediately make a different keyboard copy, and paste. Confirm the newer keyboard selection wins even if the earlier asynchronous write completes later.

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

Record the URL, browser, manager version, output mode, copied selection, expected output, and actual output for any failure. The source-first fallbacks make that report directly actionable.
