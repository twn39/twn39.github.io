---
title: "Zero-JS Math Typesetting: Compiling LaTeX to Native MathML in Rust with tex2math"
description: "How tex2math combines zero-copy winnow parser combinators with KaTeX-grade symbol dictionaries to emit standards-compliant browser MathML in microseconds."
lang: "en"
translationSlug: "tex2math-winnow-mathml"
pubDate: 2026-10-04
updatedDate: 2026-11-11
project: "tex2math"
tags: ["Rust", "Compiler", "LaTeX", "MathML", "WebAssembly"]
readingTime: 8
coverImage: "/images/blog/tex2math-winnow-ast.svg"
coverAlt: "tex2math zero-copy Rust winnow AST compiler to native browser MathML diagram"
coverSpec: "FIG 06 · RUST WINNOW PARSER · 0 KB CLIENT JS"
featured: true
---

Rendering mathematical notation on the web has historically forced an awkward trade-off: naive regex-based Markdown plugins choke on nested constructs like `\sqrt{\frac{a_1 + b_2}{1 + \sum_{i=1}^n x_i^2}}`, while full client engines like MathJax or KaTeX ship hundreds of kilobytes of JavaScript and custom font bundles.

With **MathML Core** now natively supported across Chrome 109+, Safari, and Firefox, browsers can typeset complex equations directly in layout engines without a single line of client script. **[twn39/tex2math](https://github.com/twn39/tex2math)** bridges that gap: **a blazing-fast, zero-copy, resilient Rust library and CLI that compiles LaTeX math into structured MathML XML**.

![tex2math Zero-Copy winnow Parser Combinator AST to MathML Pipeline](/images/blog/tex2math-winnow-ast.svg)

## True Combinator AST Parsing via `winnow`

LaTeX math syntax relies heavily on recursive brace groups (`{...}`), operator precedence in sub/superscripts, stretchy delimiters (`\left( ... \right)`), and tabular matrix environments.

Inspired by `texmath`'s AST discipline and `KaTeX`'s comprehensive Unicode symbol dictionaries, `tex2math` parses directly over `&str` slices using **`winnow`** parser combinators:

1. **Zero-Copy Lexical Slicing**: Tokens, numbers, and control sequences borrow `&'a str` slices directly from the input buffer, avoiding per-token heap allocations.
2. **Resilient Error Recovery**: Malformed braces or unknown macros degrade gracefully into localized `<merror>` annotations rather than aborting compilation of the surrounding document.

```rust
use tex2math::{DisplayMode, render_to_mathml};

fn main() {
    let latex = r"\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}";

    // Emits standards-compliant <math display="block">...</math> in microseconds
    let mathml = render_to_mathml(latex, DisplayMode::Block)
        .expect("valid mathml output");

    println!("{mathml}");
}
```

## Built for SSG Pipelines, Unix CLIs, and WebAssembly

Because `tex2math` is pure Rust with zero system dependencies, it drops effortlessly into three environments:

- **Build-Time Static Rendering (SSG / SSR)**: Emits semantic `<math>` markup at compile time with **0 KB client JS and zero Cumulative Layout Shift (CLS)**;
- **Standalone Unix CLI**: Streams thousands of formulas per second across technical books and documentation suites;
- **WebAssembly Live Editors**: Compiles to a compact `.wasm` binary for instant sub-millisecond equation previews right inside browser editors.
