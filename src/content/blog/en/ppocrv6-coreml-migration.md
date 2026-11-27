---
title: "Migrating PP-OCRv6 from ONNX Runtime to Apple Core ML: Graph Rewrites, Parity Audit, and Counterintuitive Tuning"
description: "Engineering postmortem on migrating Cappuccino's local PP-OCRv6 OCR pipeline from ONNX Runtime to native Core ML on macOS: fixing SAME_UPPER padding overflow and frozen SVTR widths, halving footprint to 14.8 MB with FP16, and benchmarking RangeDim + .cpuAndGPU against EnumeratedShapes + .all."
lang: "en"
translationSlug: "ppocrv6-coreml-migration"
pubDate: 2026-11-27
project: "cappuccino"
tags: ["Core ML", "PP-OCRv6", "macOS", "ONNX", "Apple Silicon", "Swift"]
readingTime: 11
coverImage: "/images/blog/ppocrv6_fig1_runtime_benchmark.png"
coverAlt: "PP-OCRv6 on Apple Silicon: ONNX Runtime CPU vs. Core ML FP32/FP16 inference latency and compute unit comparison"
coverSpec: "FIG 01 · PP-OCRV6 CORE ML BENCHMARK · APPLE M1 PRO · MACOS 15+"
featured: true
faqs:
  - q: "How do you preserve dynamic [1, 3, 48, W] width when converting PP-OCRv6 recognition to Core ML?"
    a: "During torch.jit.trace, onnx2torch freezes sequence lengths computed via Shape and Reshape into static constants. Rewriting the four dynamic Reshape nodes in the two-layer SVTR head (Reshape.54, Reshape.58, Reshape.66, Reshape.73) with -1 shape initializers such as [0, 8, -1, 15] and [0, 1, -1, 120] preserves dynamic T = W / 8 outputs across W = 32 to 3200."
  - q: "Should PP-OCRv6 use FP32 or FP16 on Core ML, and does FP16 hurt OCR accuracy?"
    a: "On Apple M1 Pro, FP16 cuts combined det and rec model size from 29.5 MB to 14.8 MB, reduces 960x640 detection latency from 82.5 ms to 51.4 ms, and drops W = 320 recognition latency from 7.8 ms to 4.0 ms. Detection mask IoU against ONNX Runtime stays at 0.998511, and CTC decoding matches ONNX Runtime character-for-character (100%) across five multilingual and long-line test cases."
  - q: "Why choose RangeDim + .cpuAndGPU over EnumeratedShapes + .all for PP-OCRv6 on macOS?"
    a: "Benchmarking showed that EnumeratedShapes with .all still fails ANECCompile(), inflates recognition model load time to 3595 ms, and slows warm inference to 62.7–94.9 ms. Keeping FP16 RangeDim with .cpuAndGPU drops load time to 239.5 ms and warm inference to 10.1–24.7 ms, while Swift-side width bucketing into 9 discrete widths keeps the E5RT shader cache bounded."
  - q: "Can precompiled .mlmodelc bundles ship inside a Universal (arm64 + x86_64) macOS app?"
    a: "Yes. Inspecting coremlcompiler output for det_inference.mlmodelc and rec_inference.mlmodelc confirms they contain only model.mil, weights/weight.bin, coremldata.bin, and metadata.json—no architecture-specific Mach-O or hardware firmware blobs. Hardware kernels are compiled at runtime on the target Mac by E5RT."
---

> **Environment**: Cappuccino (macOS 15.0+ Universal), Apple M1 Pro, macOS 26.6.2, Xcode 26.2  
> **Conversion Toolchain**: `coremltools 9.0`, `onnx 1.23.2`, `onnx2torch 1.5.15`, `onnxruntime 1.32.0`, `torch 2.15.0`  
> **Core Question**: When removing external ONNX Runtime dependencies and moving PP-OCRv6 (small det + rec) onto native Apple Core ML, how do you prevent silent dynamic-shape regressions and outperform CPU execution?

## TL;DR: Key Takeaways

Migrating Cappuccino's local PP-OCRv6 detection and recognition pipeline from ONNX Runtime to Core ML (`MLProgram`) eliminated all third-party C++ runtime dependencies. Normalizing three `SAME_UPPER` padding nodes, preventing FP16 `MaxPool` negative-infinity overflow, and rewriting four dynamic SVTR `Reshape` nodes preserved 100% Top-1 parity with ONNX Runtime from `W = 32` to `3200`. Combining **FP16 + `RangeDim` + `.cpuAndGPU` + 9 Swift-side width buckets** cut model footprint from **29.4 MB to 14.8 MB** while running **1.8x–3.2x faster** than ONNX Runtime CPU.

---

## 1. Motivation and Model Contracts

Cappuccino runs a single local PP-OCRv6 pipeline for screenshot text extraction, the OCR translation panel, and pinned-image text selection. Previously, the app depended on `onnxruntime-swift-package-manager` on CPU. When the upstream SwiftPM repository began returning HTTP 404 and the binary archive host failed TLS SAN verification, clean builds broke completely.

Because macOS already ships `CoreML.framework` backed by Metal and MPSGraph, moving PP-OCRv6 to Core ML removes a heavy third-party C++ XCFramework while shifting convolution and attention workloads off the CPU.

Before touching any conversion scripts, we inspected both original ONNX graphs:

| Model | Opset | Input `x` | Output `fetch_name_0` | Ops | Structural Characteristics |
| :--- | ---: | :--- | :--- | ---: | :--- |
| `det_inference.onnx` | 14 | `[N, 3, H, W]` | `[N, 1, H, W]` | 14 | DBNet head with 6 `Resize` upsamples and 3 `SAME_UPPER` nodes |
| `rec_inference.onnx` | 11 | `[N, 3, 48, W]` | `[N, T, 18710]` | 25 | Backbone + 2-layer SVTR attention head + 18,710-class CTC head ($T = W/8$) |

Because recent `coremltools` releases dropped direct ONNX ingestion, we built a five-stage pipeline:

```text
Original ONNX (.onnx)
  --> Graph Normalization (SAME_UPPER -> pads / SVTR Reshape -> -1)
  --> onnx2torch (PyTorch FX)
  --> torch.jit.trace + coremltools (FP16 MLProgram)
  --> xcrun coremlcompiler compile (.mlmodelc)
```

---

## 2. Four Conversion Pitfalls and Exact Fixes

Most backbone operators translated cleanly. Every real failure or subtle numerical risk came from asymmetric padding, FP16 constant casting, and dynamic shape tracing.

### 2.1 `onnx2torch` Rejects `auto_pad="SAME_UPPER"`

Running `onnx2torch.convert` directly fails immediately on the first auto-padded convolution:

```text
NotImplementedError: "SAME_UPPER" auto_pad is not implemented
```

PaddlePaddle exports `padding="SAME"` layers as ONNX `auto_pad="SAME_UPPER"`. Inspecting both graphs revealed only three such nodes per model (`Conv.1`, `Conv.2`, `MaxPool.0`), all sharing identical parameters: `kernel_shape = [2, 2]`, `strides = [1, 1]`, and `dilations = [1, 1]`.

Under the ONNX `SAME_UPPER` formula, total padding along any spatial dimension $N$ is:

$$\text{pad\_total} = \left(\lceil N / 1 \rceil - 1\right) \cdot 1 + \left((2 - 1) \cdot 1 + 1\right) - N = 1$$

Because stride is 1 and kernel size is 2, total padding is invariant to input height and width. Splitting asymmetrically (less before, more after) gives exact `pads = [0, 0, 1, 1]` with `auto_pad = "NOTSET"`.

### 2.2 `MaxPool` Pad Value (`0` vs. $-\infty$) and FP16 Cast Overflow

Converting `MaxPool.0` to explicit asymmetric `pads = [0, 0, 1, 1]` introduces a classic semantic hazard. ONNX defines `MaxPool` out-of-bounds padding as $-\infty$ so boundary regions never win a max over negative activations, whereas native PyTorch `nn.MaxPool2d` zero-pads.

Checking `onnx2torch/node_converters/max_pool.py` confirmed that it inserts `OnnxPadStatic` with `constant_value = float("-inf")`. In FP32 `model.mil`, `Conv` pads with `0.0` and `MaxPool` pads with `-3.40e38` (`-FLT_MAX`), matching ONNX semantics exactly.

Switching to FP16, however, triggered an overflow warning during MIL lowering:

```text
coremltools/converters/mil/mil/ops/defs/iOS15/elementwise_unary.py:889:
RuntimeWarning: overflow encountered in cast
```

`-FLT_MAX` exceeds FP16 range ($[-65504, 65504]$). Checking the producer graph showed that `MaxPool.0` in both models is directly preceded by `Relu` ($x \ge 0$). For non-negative inputs, $\max(x, -\infty) \equiv \max(x, 0.0)$. Patching `OnnxPadStatic(constant_value=-inf)` to `0.0` preserved mathematical equivalence and eliminated the FP16 cast overflow warning.

### 2.3 `torch.jit.trace` Freezes Dynamic SVTR Widths in `PPOCRv6Rec`

After fixing `SAME_UPPER`, `det` passed every dynamic shape test, while `rec` threw an E5RT validation exception on any width other than the trace shape:

```text
E5RT encountered an STL exception. msg = Failed to PropagateInputTensorShapes:
Validation error during type inference for ios18.reshape:
cannot reshape tensor of size 48000 into shape [1, 8, 40, 15].
```

In `onnx2torch`, `OnnxShape` and `OnnxReshape` construct target sizes via `torch.tensor(input.shape)` and `torch.Size(shape)`. Tracing at `W = 320` ($T = 40$) baked `40` into the graph as a static constant.

Appending tail intermediate tensors to the ONNX graph outputs and running ONNX Runtime at `W = 128`, `320`, and `960` pinpointed all four dynamic `Reshape` nodes inside the two-layer SVTR head:

| Node | Input Shape | Original Shape Input | Rewritten Static Initializer |
| :--- | :--- | :--- | :--- |
| `Reshape.54` | `[1, 120, 1, T]` | `Shape -> Slice -> Concat` | `[0, 120, -1]` |
| `Reshape.58` | `[1, 8, T, 15]` | `Shape(slice.1)` | `[0, 8, -1, 15]` |
| `Reshape.66` | `[1, 8, T, 15]` | `Shape(slice.4)` | `[0, 8, -1, 15]` |
| `Reshape.73` | `[1, T, 120]` | `Concat([0, 1, T, 120])` | `[0, 1, -1, 120]` |

In ONNX `Reshape`, `0` copies the input axis dimension and `-1` infers the dynamic sequence length $T$. After replacing these four inputs, `rec` generalized cleanly across `[1, 3, 48, RangeDim(32, 3200)]`.

### 2.4 Auditing `Resize` Tracer Warnings in `det`

Tracing `det_inference.onnx` emitted a `TracerWarning` from `onnx2torch/node_converters/resize.py` on `scales = scales.tolist()`. If a `Resize` op used dynamic `sizes`, freezing it would corrupt non-square aspect ratios. Inspecting all six `Resize` nodes verified that every one uses `mode = nearest`, `coordinate_transformation_mode = asymmetric`, `nearest_mode = floor`, and constant `scales` (`2x`, `4x`, `8x`), lowering cleanly to `upsample_nearest_neighbor` in MIL.

### Minimal Conversion Script Core

```python
# convert_ppocr_to_coreml.py (core normalization and FP16 lowering)
import numpy as np
import onnx
import torch
import coremltools as ct
from onnx2torch import convert as onnx_to_torch
from onnx2torch.node_converters.pad import OnnxPadStatic


def normalize_onnx(onnx_path: str, fix_rec_reshapes: bool) -> onnx.ModelProto:
    model = onnx.load(onnx_path)
    for node in model.graph.node:
        attrs = {a.name: a for a in node.attribute}
        if "auto_pad" in attrs and attrs["auto_pad"].s == b"SAME_UPPER":
            k = list(attrs["kernel_shape"].ints)
            s = list(attrs["strides"].ints)
            d = list(attrs["dilations"].ints) if "dilations" in attrs else [1, 1]
            assert k == [2, 2] and s == [1, 1] and d == [1, 1]
            node.attribute.remove(attrs["auto_pad"])
            if "pads" in attrs:
                node.attribute.remove(attrs["pads"])
            node.attribute.append(onnx.helper.make_attribute("auto_pad", "NOTSET"))
            node.attribute.append(onnx.helper.make_attribute("pads", [0, 0, 1, 1]))

    if fix_rec_reshapes:
        static_shapes = {
            "Reshape.54": [0, 120, -1],
            "Reshape.58": [0, 8, -1, 15],
            "Reshape.66": [0, 8, -1, 15],
            "Reshape.73": [0, 1, -1, 120],
        }
        for node in model.graph.node:
            if node.op_type == "Reshape" and node.name in static_shapes:
                name = f"__static_shape_{node.name}"
                arr = np.array(static_shapes[node.name], dtype=np.int64)
                model.graph.initializer.append(onnx.numpy_helper.from_array(arr, name=name))
                node.input[1] = name
    return model


def convert_fp16(onnx_path: str, trace_shape, ct_shape, fix_rec: bool):
    proto = normalize_onnx(onnx_path, fix_rec_reshapes=fix_rec)
    torch_model = onnx_to_torch(proto).eval()
    # MaxPool.0 follows Relu (>= 0); 0.0 padding matches -inf and prevents FP16 overflow.
    for mod in torch_model.modules():
        if isinstance(mod, OnnxPadStatic) and mod.constant_value == float("-inf"):
            mod.constant_value = 0.0
    with torch.no_grad():
        traced = torch.jit.trace(torch_model, torch.randn(*trace_shape))
    return ct.convert(
        traced,
        inputs=[ct.TensorType(name="x", shape=ct_shape, dtype=np.float32)],
        outputs=[ct.TensorType(name="fetch_name_0", dtype=np.float32)],
        convert_to="mlprogram",
        minimum_deployment_target=ct.target.macOS15,
        compute_precision=ct.precision.FLOAT16,
    )
```

---

## 3. Numerical Parity and Multilingual Verification

Every output was validated directly against the original ONNX models running on `onnxruntime` (`CPUExecutionProvider`) with identical tensors and preprocessing.

### 3.1 Detection Model Extreme Aspect Ratios

Across five asymmetric and extreme shapes (uniform random inputs in `[-2.5, 2.5]`), Core ML FP32 stayed within single-precision floating-point tolerance with zero NaNs:

| Input Shape `[1, 3, H, W]` | `max_abs` | `mean_abs` | NaN |
| :--- | ---: | ---: | :--- |
| `[1, 3, 32, 32]` | `1.25e-07` | `2.51e-08` | None |
| `[1, 3, 32, 960]` | `1.38e-07` | `2.40e-08` | None |
| `[1, 3, 960, 32]` | `1.29e-07` | `2.54e-08` | None |
| `[1, 3, 480, 736]` | `2.19e-04` | `4.90e-06` | None |
| `[1, 3, 960, 960]` | `5.16e-05` | `4.29e-06` | None |

On a rendered `960x640` four-line Chinese and English document image (threshold `> 0.3`, `23,492` reference positive pixels):

- **Core ML FP32**: `max_diff = 6.92e-05`, binary mask **IoU = 1.000000**;
- **Core ML FP16**: `max_diff = 3.24e-02`, binary mask **IoU = 0.998511** with stable post-processed boxes.

### 3.2 Recognition Width Sweep and Multilingual CTC Parity

Sweeping `W = 32, 64, 160, 320, 480, 960, 1600, 3200` confirmed exact timestep scaling $T = W / 8$ (`4` to `400`), FP32 `max_abs` between `1.97e-05` and `1.08e-04`, and **100.00% Top-1 argmax agreement** across all 18,710 classes.

![PP-OCRv6 dynamic width numerical drift and shape strategy comparison](/images/blog/ppocrv6_fig2_width_parity.png)

Using the exact Swift preprocessing (BGR channel order, `H = 48` aspect-preserving resize, black right padding, `(x / 255 - 0.5) / 0.5`) and greedy CTC decoding, we evaluated five realistic rendered lines:

| Sample Category | Width `W` | FP32 vs. ORT | FP16 vs. ORT | Bucketed FP16 vs. ORT |
| :--- | ---: | :--- | :--- | :--- |
| Chinese + digits + punctuation | `608` (bucket `768`) | 100% match (`3.46e-6`) | 100% match (`2.25e-3`) | 100% match |
| English + version string | `672` (bucket `768`) | 100% match (`4.77e-6`) | 100% match (`3.30e-3`) | 100% match |
| Mixed CJK/English + parentheses | `736` (bucket `768`) | 100% match (`3.04e-6`) | 100% match (`4.49e-3`) | 100% match |
| Ultra-short token (`"OK"`) | `96` (bucket `128`) | 100% match (`3.58e-7`) | 100% match (`1.10e-6`) | 100% match |
| Long mixed line (`W > 1600`) | `1920` (bucket `2048`) | 100% match (`1.86e-5`) | 100% match (`2.65e-3`) | 100% match |

---

## 4. Three Counterintuitive Performance Findings

Our first FP32 Core ML unit test took `8.358 s` on a cold process launch. Benchmarking precision (FP32 vs. FP16), dynamic shape modes (`RangeDim` vs. `EnumeratedShapes`), and `computeUnits` (`.all` vs. `.cpuAndGPU`) on Apple M1 Pro overturned two common Core ML rules of thumb.

### 4.1 FP16 Halves Footprint and Speeds Up Every Stage

| Metric | ONNX Runtime (CPU) | Core ML FP32 | Core ML FP16 |
| :--- | ---: | ---: | ---: |
| Combined Model Size (det + rec) | `29.4 MB` | `29.5 MB` | **`14.8 MB`** |
| DET `960x640` Warm Latency | `95.0 ms` | `82.5 ms` | **`51.4 ms`** |
| REC `W = 320` Warm Latency | `12.9 ms` | `7.8 ms` | **`4.0 ms`** |
| REC `W = 1600` Warm Latency | `51.3 ms` | `20.4 ms` | **`15.1 ms`** |

FP16 reduced bundled model storage from `29.5 MB` to `14.8 MB` (`4.8 MB` det + `10.0 MB` rec) while keeping 100% multilingual CTC parity.

### 4.2 `EnumeratedShapes` Regressed `PPOCRv6Rec` Instead of Enabling ANE

Standard Core ML guidance favors `ct.EnumeratedShapes` over `ct.RangeDim` so static graphs can pre-compile for the Apple Neural Engine. Converting `rec` with 9 enumerated buckets (`[128, 256, 384, 512, 768, 1024, 1536, 2048, 3200]`) backfired:

1. Loading still threw `MILCompilerForANE error: ANECCompile() FAILED` (constrained by the `18,710`-channel CTC classifier and SVTR attention blocks).
2. Model load latency jumped to **`3595.0 ms`**, and warm inference degraded to **`62.7–94.9 ms`**—4x to 6x slower than `RangeDim`.

### 4.3 `.cpuAndGPU` Outperformed `.all` Across Load and Inference

When a model cannot compile for the ANE, leaving `computeUnits = .all` forces Core ML to attempt ANE compilation on every load, unwind an internal exception, and fall back with cross-device transfer overhead.

Benchmarking the clean FP16 `RangeDim` models on Apple M1 Pro:

| Model & Stage | `computeUnits = .all` | `computeUnits = .cpuAndGPU` | Speedup |
| :--- | ---: | ---: | :--- |
| DET Load | `999.0 ms` | **`251.8 ms`** | 4.0x faster |
| DET Cold `(480x640)` | `465.2 ms` | **`45.9 ms`** | 10.1x faster |
| DET Warm `(480x640)` | `30.9 ms` | **`29.2 ms`** | 1.06x faster |
| REC Load | `1570.8 ms` | **`239.5 ms`** | 6.6x faster |
| REC Warm `W = 320` | `55.3 ms` | **`10.1 ms`** | 5.5x faster |
| REC Warm `W = 1600` | `69.4 ms` | **`24.7 ms`** | 2.8x faster |

### 4.4 Final Design: `RangeDim` in the Model + Width Bucketing in Swift

To keep `RangeDim`'s Metal performance without letting 100 arbitrary 32-pixel increments bloat `com.apple.e5rt.e5bundlecache`, `PPOCRv6Engine.swift` quantizes recognition canvas width to 9 discrete buckets:

```swift
// Cappuccino/OCR/PPOCRv6/PPOCRv6Engine.swift
static let recWidthBuckets: [Int] = [128, 256, 384, 512, 768, 1024, 1536, 2048, 3200]

static func recBucketWidth(for contentWidth: Int) -> Int {
    for bucket in recWidthBuckets where contentWidth <= bucket {
        return bucket
    }
    return recWidthBuckets.last ?? 3_200
}
```

This bounds MPSGraph cache cardinality to at most 9 shapes for recognition without paying the 3.6-second `EnumeratedShapes` load cost.

---

## 5. macOS Integration and Repository Hygiene

### 5.1 Stride-Safe `MLMultiArray` Marshalling Under Strict Concurrency

Cappuccino compiles with `SWIFT_STRICT_CONCURRENCY = complete`. On Metal paths, Core ML may pad `MLMultiArray` row strides for hardware alignment, so assuming compact buffers causes subtle corruption. We use a fast contiguous `memcpy` path with a stride-aware fallback:

```swift
// Cappuccino/OCR/PPOCRv6/PPOCRv6Engine.swift (tensor marshalling)
private func makeInputArray(from data: Data, shape: [Int]) throws -> MLMultiArray {
    let array = try MLMultiArray(shape: shape.map { NSNumber(value: $0) }, dataType: .float32)
    let count = shape.reduce(1, *)
    let strides = array.strides.map(\.intValue)
    let compact = Self.compactStrides(for: shape)

    try data.withUnsafeBytes { srcRaw in
        let src = srcRaw.bindMemory(to: Float.self)
        guard src.count >= count else {
            throw OCRServiceError.inferenceFailed("input tensor byte count mismatch")
        }
        array.withUnsafeMutableBytes { dstRaw, dstStrides in
            let dst = dstRaw.bindMemory(to: Float.self)
            if strides == compact, let srcBase = src.baseAddress, let dstBase = dst.baseAddress {
                dstBase.update(from: srcBase, count: count)
                return
            }
            for flatIndex in 0..<count {
                let offset = Self.stridedOffset(
                    for: flatIndex,
                    shape: shape,
                    compactStrides: compact,
                    actualStrides: dstStrides
                )
                dst[offset] = src[flatIndex]
            }
        }
    }
    return array
}
```

Predictions are serialized behind an internal `NSLock` on `PPOCRv6Engine`, with each line crop wrapped in `autoreleasepool` to release transient `CGImage` and `MLMultiArray` allocations immediately.

### 5.2 Precompiled `.mlmodelc` and Universal (`arm64` + `x86_64`) Distribution

Because `project.yml` bundles `Resources/PPOCRv6` as a folder reference (`type: folder`) and tests load directly from that directory, precompiling with `xcrun coremlcompiler compile` avoids runtime `MLModel.compileModel(at:)` latency on first launch.

Inspecting `det_inference.mlmodelc` and `rec_inference.mlmodelc` confirmed they contain only `model.mil`, `weights/weight.bin`, `coremldata.bin`, `metadata.json`, and `analytics/coremldata.bin`—no architecture-locked binaries. The resulting Universal Release app (`x86_64 arm64`) measures `61 MB` total, with `Resources/PPOCRv6` accounting for `15 MB`.

### 5.3 Updating Git LFS Rules for `.mlmodelc` Weights

Previously, `.gitattributes` tracked only `*.onnx`. Committing `.mlmodelc` bundles without updating `.gitattributes` would check `14.8 MB` of `weights/weight.bin` directly into standard Git history. Adding the bin rule and confirming with `git check-attr` prevented repository bloat:

```text
# .gitattributes
*.onnx filter=lfs diff=lfs merge=lfs -text
Resources/PPOCRv6/**/*.bin filter=lfs diff=lfs merge=lfs -text
```

---

## 6. Trade-offs and Limitations

- **OS Floor**: The models target `macOS 15.0+`. Backporting to macOS 12 or 13 requires re-verifying MIL opset support and `MLMultiArray.withUnsafeMutableBytes`.
- **Detection Cache Variance**: Screenshot aspect ratios vary widely, so `det` retains `RangeDim(32, 1920)`. Unseen dimensions still incur tens of milliseconds of first-time MPSGraph specialization.
- **No ANE Execution**: With an 18,710-class CTC head and dynamic SVTR attention, forcing ANE hurts rather than helps on current macOS. Future OS releases or smaller-vocabulary models warrant re-benchmarking `.all`.

---

## FAQ

### How do you preserve dynamic [1, 3, 48, W] width when converting PP-OCRv6 recognition to Core ML?

During `torch.jit.trace`, `onnx2torch` freezes sequence lengths computed via `Shape` and `Reshape` into static constants. Rewriting the four dynamic `Reshape` nodes in the two-layer SVTR head (`Reshape.54`, `Reshape.58`, `Reshape.66`, `Reshape.73`) with `-1` shape initializers such as `[0, 8, -1, 15]` and `[0, 1, -1, 120]` preserves dynamic `T = W / 8` outputs across `W = 32` to `3200`.

### Should PP-OCRv6 use FP32 or FP16 on Core ML, and does FP16 hurt OCR accuracy?

On Apple M1 Pro, FP16 cuts combined `det` and `rec` model size from `29.5 MB` to `14.8 MB`, reduces `960x640` detection latency from `82.5 ms` to `51.4 ms`, and drops `W = 320` recognition latency from `7.8 ms` to `4.0 ms`. Detection mask IoU against ONNX Runtime stays at `0.998511`, and CTC decoding matches ONNX Runtime character-for-character (`100%`) across five multilingual and long-line test cases.

### Why choose RangeDim + .cpuAndGPU over EnumeratedShapes + .all for PP-OCRv6 on macOS?

Benchmarking showed that `EnumeratedShapes` with `.all` still fails `ANECCompile()`, inflates recognition model load time to `3595 ms`, and slows warm inference to `62.7–94.9 ms`. Keeping FP16 `RangeDim` with `.cpuAndGPU` drops load time to `239.5 ms` and warm inference to `10.1–24.7 ms`, while Swift-side width bucketing into 9 discrete widths keeps the E5RT shader cache bounded.

### Can precompiled .mlmodelc bundles ship inside a Universal (arm64 + x86_64) macOS app?

Yes. Inspecting `coremlcompiler` output for `det_inference.mlmodelc` and `rec_inference.mlmodelc` confirms they contain only `model.mil`, `weights/weight.bin`, `coremldata.bin`, and `metadata.json`—no architecture-specific Mach-O or hardware firmware blobs. Hardware kernels are compiled at runtime on the target Mac by E5RT.
