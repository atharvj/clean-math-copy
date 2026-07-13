# Research and design basis

This package was designed against primary browser and renderer documentation rather than against one site's current markup.

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

Design consequence: embedded MathML is used when present; otherwise MathItem original input is queried without mutating MathJax or waiting asynchronously during the copy event. MathJax 2's `getJaxFor()`/`originalText` convention is included as a compatibility fallback.

## MathML semantics

- [W3C MathML 4: annotating MathML](https://www.w3.org/TR/mathml4/#contm-annotation) defines `semantics`, `annotation`, and `annotation-xml`, including TeX encodings such as `application/x-tex`.
- [W3C MathML Core](https://www.w3.org/TR/mathml-core/) specifies that only the first presentation child of `semantics` is rendered by default and shows TeX annotations intended for alternate use such as clipboard transfer.

Design consequence: presentation MathML is linearized structurally for Unicode output; TeX annotations are used for original-source mode and as a structural fallback. Annotation nodes themselves are never concatenated with the rendered presentation.

## Userscript APIs

- [Tampermonkey documentation](https://www.tampermonkey.net/documentation.php) documents `@run-at document-start`, menu commands, persistent values, and clipboard helpers.

Design consequence: installation occurs at document start so the capture listener normally precedes page copy handlers. Both legacy `GM_*` and modern promise-based `GM.*` forms are supported, with platform APIs as fallbacks.

## Document-editor interoperability

- [Google Docs: use equations in a document](https://support.google.com/docs/answer/160749) documents native equation creation through Insert → Equation and keyboard shortcuts, but does not document an external equation clipboard-import format.
- [Microsoft 365 MathML support](https://learn.microsoft.com/en-us/office/math/mathml) documents MathML clipboard formats and MathML embedded in imported HTML.

Design consequence: rewritten selections carry calculator-safe plain text, a newly generated rich HTML representation, and exact MathML flavors when one equation is selected. This lets each destination choose its strongest supported representation without putting the source page's duplicated renderer DOM back on the clipboard. It cannot manufacture a proprietary native Google Docs equation object because Google exposes no documented clipboard representation for one.

## Microsoft Word for the web

- [Microsoft Support: copy and paste in Office for the web](https://support.microsoft.com/en-us/office/copy-and-paste-in-office-for-the-web-682704da-8360-464c-9a26-ff44abf4c4fe) documents that Office web copy behavior differs from desktop Office because of browser clipboard constraints.
- [Microsoft Learn: `Word.Range.getOoxml()`](https://learn.microsoft.com/en-us/javascript/api/word/word.range?view=word-js-preview) documents the supported semantic Office Open XML route available to an Office add-in. A page userscript is not an Office add-in and cannot assume this API is authorized or present.
- [Mozilla Bug 1829624](https://bugzilla.mozilla.org/show_bug.cgi?id=1829624) records Word Online's generated `WACViewPanel_EditingElement` and `WACViewPanel_ClipboardElement`, corroborating the editor/staging split observed in the live application.
- Microsoft's [MathML support documentation](https://learn.microsoft.com/en-us/office/math/mathml) states that Office Math can export MathML clipboard formats and maps OMML fractions, radicals, scripts, matrices, functions, and delimiters to Presentation MathML. It also notes that the web DOM/HTML export is not guaranteed to contain MathML.

Live validation against public OMML `.docx` files in the Office viewer found two distinct source representations. Normal view rendered a page image. Accessibility Mode used a `react-pdf` text layer with absolutely positioned tokens: real subscripts measured at an 8/11 font ratio and a `+4.65px` vertical offset, while a real superscript used the same ratio and a negative vertical offset. Ordinary prose used identical wrappers, so class names alone cannot identify math.

Design consequence: the capture listener never suppresses Word merely because `Selection.toString()` is an NBSP or blank placeholder. The implementation allows Word's handler to populate the clipboard, wraps or postprocesses its synchronous plain-text write when possible, prefers any resulting MathML/OMML, and observes the staging element briefly as an async recovery path. Positioned text is reconstructed only when script geometry and a mathematical signal agree; otherwise native copying wins. Every path rejects an empty replacement.
