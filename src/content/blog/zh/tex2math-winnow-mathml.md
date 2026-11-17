---
title: "零客户端 JS 数学排版：基于 Rust winnow 组合子构建极速公式编译器 tex2math"
description: "剖析 tex2math 如何利用零拷贝切片解析器 winnow 与完备符号表，在微秒级将复杂嵌套 LaTeX 公式编译为浏览器原生 MathML。"
lang: "zh"
translationSlug: "tex2math-winnow-mathml"
pubDate: 2026-10-04
updatedDate: 2026-11-11
project: "tex2math"
tags: ["Rust", "Compiler", "LaTeX", "MathML", "WebAssembly"]
readingTime: 8
coverImage: "/images/blog/tex2math-winnow-ast.svg"
coverAlt: "tex2math 从零拷贝 LaTeX 字符串切片到浏览器原生 MathML 的编译管线"
coverSpec: "FIG 06 · RUST WINNOW PARSER · 0 KB CLIENT JS"
featured: true
---

在技术博客、学术文档静态站与 Markdown 渲染管线中，数学公式长期处于两难境地：如果使用基于正则表达式的简易替换器，一旦遇到 `\sqrt{\frac{a_1 + b_2}{1 + \sum_{i=1}^n x_i^2}}` 这类多层嵌套结构就会彻底失效；而如果引入 MathJax 或 KaTeX，往往需要在前端打包数百 KB 的 JavaScript 运行时与巨量专用 Web 字体，拖慢首屏加载与 DOM 体积。

随着 Chrome 109+、Safari 与 Firefox 全面原生支持 **MathML Core** 标准，浏览器本身已经具备了原生排版数学公式的能力。**[twn39/tex2math](https://github.com/twn39/tex2math)** 正是为此而生：**一个纯 Rust 编写、零拷贝、高容错的 LaTeX 到标准 MathML XML 编译器与命令行工具**。

![tex2math 零拷贝 winnow AST 解析与原生 MathML 代码生成架构](/images/blog/tex2math-winnow-ast.svg)

## 为什么基于 `winnow` 构建真实 AST

LaTeX 数学语法充满了上下文相关的分组（`{...}`）、可选参数（`[...]`）、上下标结合优先级以及像 `\left( ... \right)` 和 `\begin{pmatrix} ... \end{pmatrix}` 这样的定界环境。

`tex2math` 借鉴了 `texmath` 的严谨 AST 结构与 `KaTeX` 级别的丰富符号映射字典，采用 Rust 高性能解析器组合子库 **`winnow`** 直接在输入 `&str` 切片上游走：

1. **零堆拷贝词法切片（Slice-Oriented Zero-Copy）**：标识符、数字字面量与控制序列直接引用输入源码的生命周期切片 `&'a str`，避免在解析阶段频繁分配 `String`。
2. **高容错局部恢复（Resilient Recovery）**：面对用户输入中未闭合的花括号或未知的宏指令，编译器不会整段崩溃退出，而是将异常片段局部降级为带标注的 `<merror>` 或文本节点，保证文档其余公式正常呈现。

```rust
use tex2math::{DisplayMode, render_to_mathml};

fn main() {
    let latex = r"\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}";

    // 微秒级编译输出标准语义化 <math display="block">...</math> XML
    let mathml = render_to_mathml(latex, DisplayMode::Block)
        .expect("valid mathml output");

    println!("{mathml}");
}
```

## 天然契合 SSR、CLI 与 WebAssembly

得益于纯 Rust 零外部 C 依赖的精简架构，`tex2math` 可以无缝嵌入三类典型工程管线：

- **静态站点构建期预编译（SSG / SSR）**：构建阶段直接输出纯净 `<math>` 标签，前端浏览器 **0 KB JavaScript、0 布局偏移（CLS）** 原生渲染；
- **独立 CLI 批处理管道**：配合 Unix 管道高速转换整本 Markdown 技术书稿或学术讲义；
- **WebAssembly 边缘/本地编辑器实时预览**：编译为极小体积的 `.wasm` 模块，在毫秒内完成整篇长文的实时公式排版预览。
