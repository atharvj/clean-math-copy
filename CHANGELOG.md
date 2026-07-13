# Changelog

## 1.2.2 — 2026-07-13

- Added a conservative standalone-Unicode math path, so exact selections such as `0.666 × 10⁻²⁵`, `|q|`, and `r ∝ √(m/|q|)` convert even without renderer metadata while ordinary symbol-bearing prose, code, ambiguous bars, and editor-owned semantic selections remain native.
- Preserved the strict partial-selection contract across renderer and standalone paths: a recognized fragment copies only that fragment, while an empty or unmatched fragment never widens to the containing line or equation.
- Corrected raw-LaTeX grouping and tokenization for compound/nested fractions, braced bases, styled multi-letter identifiers, nested absolute values, indexed roots, adjacent Greek variables, implicit products, conventional/declared/inverse functions, logarithm bases, postfix factors, piecewise cases, and binomials.
- Added coherent calculator forms for raw-LaTeX set relations and bounded sums, products, integrals, and limits, with parser depth/work budgets that preserve malformed or adversarial source instead of failing or hanging.
- Corrected rendered MathML/KaTeX literal division, scripted groups and closing fences, absolute-value powers, indexed norms, function application, inverse/powered/based functions, aggregate and limit bounds, and piecewise case row pairings.
- Distinguished paired absolute-value fences from divisibility, conditional-probability, set-builder, evaluation, lone, and ambiguous vertical bars, including exact one-sided bar selections.
- Hardened Word for the web recovery across semantic OMML/MathML, positioned equation tokens, and native duplicate accessibility text so the reported `R₁, R₂ = 4.7kΩ, 10kΩ and C = 220μF` selection cannot collapse to blank or doubled text.
- Made the manual “copy current selection now” command retain rich HTML and MathML, including a plain-plus-rich retry when a browser rejects a custom MathML clipboard format.
- Made every delayed Office recovery and manual clipboard retry generation-aware across normal, manual, and Office copy paths, so stale asynchronous work cannot overwrite the user's newest selection.
- Hardened generated rich HTML with out-of-band style trust and pre-clone node/depth budgets; retained MathML input, candidate, sanitization, and serialization limits.
- Added a permanent Chromium-family smoke runner using real `ClipboardEvent`/`DataTransfer`, alongside regressions for comparative-prose rejection, styled identifiers, parser budgets, rendered operators/functions/aggregates/limits/cases/bars, rich-tree limits, and clipboard races.

## 1.2.1 — 2026-07-13

- Mapped duplicate-looking partial selections through the renderer's actual surface order, including denominator-first KaTeX fractions, and distinguished a selected whole radical from its radicand text.
- Made Office semantic recovery independent of event bubbling, preserved prose and multiple equations in mixed HTML/oMathPara payloads, kept semantic data ahead of later plain writes, and isolated delayed staging recovery by copy generation.
- Corrected the reported Word `R₁, R₂ = 4.7kΩ, 10kΩ and C = 220μF` paths across positioned tokens, OMML, and native duplicate text, including standalone `R₁`, calculator symbols/units, and punctuation grouping.
- Prevented empty LaTeX conversions and whitespace-only semantic data from ever clearing or suppressing the native clipboard.
- Added sanitized, valid single-namespace MathML output, input/tree/candidate limits, and a bounded matcher for zero-surface MathML nodes.
- Added adversarial regressions for stopped propagation, both Office write orders, semantic staging after temporary plain text, mixed equations, copy races, malicious/deep MathML, and exact visual partials.

## 1.2.0 — 2026-07-13

- Replaced whole-equation widening with exact semantic partial-selection matching. Selecting `0.666×10−25` now copies only `0.666*10^(-25)`, and selecting `q` copies only `q`.
- Added coherent MathML subtree and contiguous-row matching, renderer surface-order variants, mid-token selection support, and exact boundaries for selections crossing between prose and math.
- Fixed absolute-value fences mislabeled as `<mi>`/`<mtext>` or decorated with bidi/variation controls, preventing `|*q*|` and related stray-asterisk output.
- Removed italic/bold HTML markup from generated rich identifiers and replaced it with mathematical Unicode glyphs, preventing Markdown-aware targets from producing literal emphasis asterisks.
- Added Word for the web support for positioned Accessibility Mode tokens, including measured superscript/subscript geometry and sanitized rich `<sub>`/`<sup>` output.
- Added OMML-to-MathML conversion for Office fractions, radicals, scripts, delimiters, n-ary operators, functions, limits, accents, matrices, and equation arrays.
- Added an Office-specific clipboard pipeline that allows Word's native handler to run, cleans provable duplicate mathematical runs, prefers semantic MathML/OMML, and recovers from Word's clipboard staging element when necessary.
- Enforced a global nonempty-payload invariant: whitespace-only renderer or Word placeholders never clear, replace, or suppress the native clipboard.
- Expanded the automated suite with the exact reported partial formula, mislabeled bars, Word's real positioned text-layer shape, native duplicate payload, delayed copy handler, semantic clipboard priority, OMML structures, and blank fail-safe cases.

## 1.1.0 — 2026-07-13

- Fixed current ChatGPT/KaTeX selections whose visual and accessible math live in separate DOM branches.
- Added renderer-independent promotion from hidden MathML to its complete visual equation wrapper.
- Added calculator-safe default output with structural `sqrt`, `abs`, fractions, explicit multiplication, grouped powers, and correct scientific notation.
- Added simultaneous sanitized `text/html` with rich fractions, roots, superscripts, and subscripts plus MathML clipboard flavors for compatible editors.
- Removed trailing spaces/newlines and zero-width artifacts from every rewritten selection.
- Added exact regressions for `r ∝ sqrt(m/abs(q))` and the reported nested numeric radical, including numerical evaluation of the latter.
- Added integration tests against real KaTeX 0.17 `htmlAndMathml` output.

## 1.0.0 — 2026-07-13

- Initial complete userscript release.
- Added selective capture-phase clipboard rewriting with native pass-through for ordinary selections.
- Added KaTeX, MathJax 2/3/4, native MathML, TeX annotation, renderer metadata, ARIA, and alt-text extraction.
- Added structural MathML and LaTeX-to-Unicode/ASCII linearization.
- Added partial equation expansion, multiple ranges, open Shadow DOM range support, semantic document serialization, artifact cleanup, persistent output modes, and userscript menu controls.
- Added automated tests, a browser fixture, a validation matrix, primary-source research notes, and installation/usage documentation.
