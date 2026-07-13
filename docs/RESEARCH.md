# Research and design basis

This package was designed against primary browser, Unicode, MathML, renderer, and editor documentation rather than against one site's current markup. Version 2 separates faithful readable transcription from opt-in calculator serialization instead of forcing one plain-text spelling to serve incompatible destinations.

## Clipboard interception

- [MDN: `copy` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/copy_event) documents that the event is cancelable and that a handler can replace clipboard formats with `clipboardData.setData()` before calling `preventDefault()`.
- [MDN: `ClipboardEvent.clipboardData`](https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent/clipboardData) documents the synchronous `DataTransfer` available on real copy events.

Design consequence: the userscript performs its replacement synchronously in an early capture listener. It takes over only selections that need rewriting and leaves all other copy events untouched.

## Selection and Shadow DOM

- [MDN: `Selection.getRangeAt()`](https://developer.mozilla.org/en-US/docs/Web/API/Selection/getRangeAt) describes its established behavior and its limitations at shadow boundaries.
- [MDN: `Selection.getComposedRanges()`](https://developer.mozilla.org/en-US/docs/Web/API/Selection/getComposedRanges) documents the newer composed-range API and its `shadowRoots` option.

Design consequence: current composed ranges are preferred when available, with standard cloned ranges as the compatible fallback. Unlike KaTeX's Copy-tex extension, Clean Math Copy does not automatically widen every partial formula selection. It compares the exact visual selection with Presentation MathML surface variants and serializes the smallest exact semantic subtree. An unmatched partial selection remains on the native path instead of silently gaining unselected content.

## KaTeX

- [KaTeX options](https://katex.org/docs/options) documents that its default `htmlAndMathml` output includes both visual HTML and accessibility MathML.
- [KaTeX extensions](https://katex.org/docs/libs.html) identifies the official Copy-tex extension.
- [KaTeX Copy-tex README](https://github.com/KaTeX/KaTeX/tree/main/contrib/copy-tex) explains why copying the renderer directly needs special handling and notes expansion of partial formula selections.

Design consequence: the outer KaTeX root is replaced once for a complete selection. For a partial selection, contiguous MathML rows and coherent structures such as scripts, fractions, and roots are matched against the selected visual glyph sequence; the parallel visual HTML is never allowed to produce duplicate output.

## MathJax

- [MathJax: Typesetting Mathematics](https://docs.mathjax.org/en/latest/web/typeset.html) documents `MathJax.startup.document.math`, `getMathItemsWithin()`, and the original `MathItem.math` input.
- [MathJax: Accessibility Components](https://docs.mathjax.org/en/v4.0/web/components/accessibility.html) documents assistive MathML and the version 4 accessibility changes.
- [MathJax: MathML support](https://docs.mathjax.org/en/v4.0/output/mathml.html) describes MathJax's internal MathML output and its browser limitations.

Design consequence: embedded MathML is used when present; otherwise MathItem original input is queried without mutating MathJax or waiting asynchronously during the copy event. Source-only SVG/CHTML is trusted only when its visible identifier, number, and stable-operator anchors agree; an exact complete visual drag is reconstructed, while a strict partial remains native. MathJax 2's `getJaxFor()`/`originalText` convention is included as a compatibility fallback.

## MathML semantics

- [W3C MathML 4: annotating MathML](https://www.w3.org/TR/mathml4/#contm-annotation) defines `semantics`, `annotation`, and `annotation-xml`, including TeX encodings such as `application/x-tex`.
- [W3C MathML Core](https://www.w3.org/TR/mathml-core/) specifies that only the first presentation child of `semantics` is rendered by default and shows TeX annotations intended for alternate use such as clipboard transfer.

Design consequence: presentation MathML is linearized structurally for Unicode output; TeX annotations are used for original-source mode and only as a verified structural fallback. Parentheses remain semantic during agreement checks, and stale hidden trees whose visible anchors disagree are declined. Annotation nodes themselves are never concatenated with the rendered presentation.

## Faithful Unicode linearization

- [Unicode Standard, Chapter 22: Symbols](https://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-22/) describes superscript/subscript characters and explains why markup remains the general rich-text representation.
- [Unicode Technical Report #25: Unicode Support for Mathematics](https://www.unicode.org/reports/tr25/) distinguishes mathematical operators, primes, scripts, fraction/division slashes, invisible operators, and mathematical alphanumeric symbols. It warns that NFKC/NFKD erase mathematically meaningful alphabet distinctions.
- [Unicode Technical Note #28: Nearly Plain-Text Encoding of Mathematics](https://www.unicode.org/notes/tn28/UTN28-PlainTextMath.pdf) documents readable linear fractions, roots, scripts, primes, matrices, functions, and aggregates, and is also the basis of Microsoft UnicodeMath.
- [W3C MathML Core](https://www.w3.org/TR/mathml-core/) defines numerator/denominator order, roots, script positions, prescripts, operator roles, and table/row/cell structure independently of a renderer's visual DOM order.
- [W3C MathML 4: invisible operators](https://www.w3.org/TR/mathml4/#presm_opattrs) identifies U+2061 FUNCTION APPLICATION and U+2062 INVISIBLE TIMES as semantic distinctions that have no visible glyph.

Design consequence: faithful mode uses real `′`, superscript/subscript characters, `√`, `×`, bars, norms, relations, Greek letters, and authored spacing where representable. It uses minimal parentheses only when a two-dimensional fraction or root would otherwise become ambiguous. Invisible function application and multiplication guide token boundaries but are not leaked as invisible clipboard characters. Final output uses NFC, never NFKC. Calculator mode remains a separate serializer with explicit `sqrt`, `abs`, multiplication, division, and powers.

The copy event has no information about the application that will eventually receive a paste. Consequently, destination guessing cannot reliably choose between visually faithful notation and executable calculator syntax. Version 2 makes faithful output the default and exposes calculator-safe output as a persistent menu choice while continuing to place rich HTML and MathML alongside plain text.

## Ordinary rendered text

- [MDN: `HTMLElement.innerText`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/innerText) describes rendered text and notes that it approximates what a user obtains by selecting and copying an element, unlike raw `textContent`.
- [MDN: `Range.cloneContents()`](https://developer.mozilla.org/en-US/docs/Web/API/Range/cloneContents) specifies that first and last partially selected children are cloned with only their selected contents.
- [MDN: handling whitespace](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Text/Whitespace) documents browser collapsing and preservation behavior across ordinary and preformatted whitespace modes.
- [MDN: HTML text elements](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements) identifies paragraphs, list items, preformatted text, and two-dimensional table rows/cells as distinct document structures.

Design consequence: ordinary cleanup is DOM-aware rather than a global whitespace regular expression. Collapsible inline source wraps become one space; explicit `<br>` and block boundaries become intentional newlines; list markers, numbering, tabs between table cells, and preformatted/code islands remain structural. Already-clean prose, text controls, editable surfaces, and standalone code stay on the native copy path. Cloning is preceded by markup, node, and depth budgets, and cleaned rich HTML passes a strict allowlist.

## Userscript APIs

- [Tampermonkey documentation](https://www.tampermonkey.net/documentation.php) documents `@run-at document-start`, menu commands, persistent values, and clipboard helpers.

Design consequence: installation occurs at document start so the capture listener normally precedes page copy handlers. Both legacy `GM_*` and modern promise-based `GM.*` forms are supported, with platform APIs as fallbacks.

## Document-editor interoperability

- [Google Docs: use equations in a document](https://support.google.com/docs/answer/160749) documents native equation creation through Insert → Equation and keyboard shortcuts, but does not document an external equation clipboard-import format.
- [Microsoft 365 MathML support](https://learn.microsoft.com/en-us/office/math/mathml) documents MathML clipboard formats and MathML embedded in imported HTML.

Design consequence: rewritten selections carry faithful readable plain text by default, a newly generated rich HTML representation, and exact MathML flavors when one equation is selected. Calculator-safe plain text is an explicit alternate mode. This lets each destination choose its strongest supported representation without putting the source page's duplicated renderer DOM back on the clipboard. It cannot manufacture a proprietary native Google Docs equation object because Google exposes no documented clipboard representation for one.

## Microsoft Word for the web

- [Microsoft Support: copy and paste in Office for the web](https://support.microsoft.com/en-us/office/copy-and-paste-in-office-for-the-web-682704da-8360-464c-9a26-ff44abf4c4fe) documents that Office web copy behavior differs from desktop Office because of browser clipboard constraints.
- [Microsoft Learn: `Word.Range.getOoxml()`](https://learn.microsoft.com/en-us/javascript/api/word/word.range?view=word-js-preview) documents the supported semantic Office Open XML route available to an Office add-in. A page userscript is not an Office add-in and cannot assume this API is authorized or present.
- [Mozilla Bug 1829624](https://bugzilla.mozilla.org/show_bug.cgi?id=1829624) records Word Online's generated `WACViewPanel_EditingElement` and `WACViewPanel_ClipboardElement`, corroborating the editor/staging split observed in the live application.
- Microsoft's [MathML support documentation](https://learn.microsoft.com/en-us/office/math/mathml) states that Office Math can export MathML clipboard formats and maps OMML fractions, radicals, scripts, matrices, functions, and delimiters to Presentation MathML. It also notes that the web DOM/HTML export is not guaranteed to contain MathML.

Live validation against public OMML `.docx` files in the Office viewer found two distinct source representations. Normal view rendered a page image. Accessibility Mode used a `react-pdf` text layer with absolutely positioned tokens: real subscripts measured at an 8/11 font ratio and a `+4.65px` vertical offset, while a real superscript used the same ratio and a negative vertical offset. Ordinary prose used identical wrappers, so class names alone cannot identify math.

Design consequence: the capture listener never suppresses Word merely because `Selection.toString()` is an NBSP or blank placeholder. The implementation allows Word's handler to populate the clipboard, wraps or postprocesses its synchronous plain-text write when possible, prefers any resulting MathML/OMML, and observes the staging element briefly as an async recovery path. Positioned text is reconstructed only when script geometry and a mathematical signal agree; otherwise native copying wins. Every path rejects an empty replacement.
