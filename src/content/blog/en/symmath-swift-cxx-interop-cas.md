---
title: "Bringing a C++ Computer Algebra System to SwiftUI: Native Swift-C++ Interop & LaTeX in SymMath"
description: "How SymMath bridges the C++ symengine CAS library directly into Swift via .interoperabilityMode(.Cxx) alongside live Latin Modern LaTeX typesetting."
lang: "en"
translationSlug: "symmath-swift-cxx-interop-cas"
pubDate: 2026-10-16
updatedDate: 2026-11-12
project: "symmath"
tags: ["Swift", "C++ Interop", "Symbolic Math", "LaTeX", "SwiftUI"]
readingTime: 9
coverImage: "/images/blog/symmath-cxx-cas.svg"
coverAlt: "SymMath Swift-C++ interop SymEngine CAS core and Latin Modern LaTeX pipeline"
coverSpec: "FIG 10 · SWIFT/C++ INTEROP CAS · IOS & MACOS"
featured: true
---

Standard scientific calculators approximate everything in IEEE-754 floating point—turning $\sqrt{8}$ into `2.828427...` and offering zero help with symbolic polynomial roots or partial derivatives. In **[SymMath — Symbolic Calculator](https://apps.apple.com/us/app/symmath-symbolic-calculator/id6765642699)** for iOS and macOS, we embedded a true **Computer Algebra System (CAS)** inside a native SwiftUI interface—computing exact radicals ($\sqrt{8} = 2\sqrt{2}$), multivariable partial derivatives ($\frac{\partial}{\partial x}, \frac{\partial}{\partial y}$), algebraic expansions, and interactive curves.

![SymMath Input Layer, Swift-C++ SymEngineKit Core, and LaTeX Rendering Pipeline](/images/blog/symmath-cxx-cas.svg)

## Eliminating Objective-C++ Glue via Native Swift-C++ Interop

At SymMath's core sits `symengine`, a fast C++ symbolic manipulation engine built around reference-counted expression trees (`RCP<const Basic>`) and dense matrix templates. Historically, calling C++ templates from Swift required maintaining thousands of lines of brittle Objective-C++ (`.mm`) wrapper classes and opaque C pointers.

In our **`SymEngineKit`** Swift Package, we enabled the Swift compiler's native bidirectional C++ interoperability directly:

```swift
// Direct C++ interoperability in Package.swift eliminates Objective-C++ shims
.target(
    name: "SymEngineKit",
    dependencies: ["CSymEngine"],
    swiftSettings: [
        .interoperabilityMode(.Cxx)
    ]
)
```

`SymEngineKit` wraps underlying C++ expression lifetimes into memory-safe Swift types (`SymExpression`, `SymSymbol`, `SymDenseMatrix`, `SymSet`) while catching malformed user input (such as `x + * 2`) at the boundary so invalid syntax never triggers uncaught C++ exceptions.

## Publication-Grade LaTeX Typesetting & Auto-Scaling Plots

Exact symbolic algebra deserves textbook-quality typography:

1. **True Latin Modern LaTeX via `SwiftTexMath`**: Every simplified expression, matrix, and exact polynomial root formats directly to LaTeX and renders natively with classic *Latin Modern* math glyphs.
2. **Custom Mathematical Ribbon & `Swift Charts` Plotter**: Pairs a dedicated trigonometric, hyperbolic, and calculus input ribbon with an auto-scaling `Swift Charts` curve plotter.
3. **Git-LFS Visual Snapshot Testing**: Verified continuously via `swift-snapshot-testing` baselines across deterministic simulator targets to prevent layout regressions across OS updates.
