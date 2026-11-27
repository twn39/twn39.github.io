---
title: "PP-OCRv6 迁移至 Apple Core ML 实战：图改写、数值审计与反直觉调优"
description: "记录 macOS 截图工具 Cappuccino 将 PP-OCRv6 从 ONNX Runtime 迁移至 Core ML 的工程复盘：解决 SAME_UPPER 填充溢出与 SVTR 动态宽度固化，以 FP16 将模型体积减半至 14.8 MB，并通过实测推翻 EnumeratedShapes 与 .all 默认配置。"
lang: "zh"
translationSlug: "ppocrv6-coreml-migration"
pubDate: 2026-11-27
project: "cappuccino"
tags: ["Core ML", "PP-OCRv6", "macOS", "ONNX", "Apple Silicon", "Swift"]
readingTime: 11
coverImage: "/images/blog/ppocrv6_fig1_runtime_benchmark.png"
coverAlt: "Apple Silicon 上 PP-OCRv6 的 ONNX Runtime CPU、Core ML FP32 与 FP16 推理耗时及计算单元对比"
coverSpec: "FIG 01 · PP-OCRV6 CORE ML BENCHMARK · APPLE M1 PRO · MACOS 15+"
featured: true
faqs:
  - q: "PP-OCRv6 识别模型转为 Core ML 后，如何保留 [1, 3, 48, W] 动态宽度？"
    a: "onnx2torch 在 torch.jit.trace 阶段会把 Shape 与 Reshape 推导出的序列长度固化为静态常量。定位 SVTR 注意力头中的 4 处动态 Reshape 节点（Reshape.54、Reshape.58、Reshape.66、Reshape.73），将其目标形状改写为含 -1 的静态张量（如 [0, 8, -1, 15] 与 [0, 1, -1, 120]）后，模型即可在 W = 32 至 3200 全范围内保持 T = W / 8 的动态输出。"
  - q: "PP-OCRv6 在 Core ML 上应该用 FP32 还是 FP16？精度会下降吗？"
    a: "在 Apple M1 Pro 实测中，FP16 将 det 与 rec 模型总体积从 29.5 MB 降至 14.8 MB，960x640 检测耗时从 82.5 ms 降至 51.4 ms，W = 320 识别耗时从 7.8 ms 降至 4.0 ms。数值对齐上，FP16 检测掩码与 ONNX Runtime 的 IoU 达到 0.998511，5 组中英文与超长文本样本的 CTC 解码逐字一致率保持 100%。"
  - q: "为什么 PP-OCRv6 在 macOS 上选择 RangeDim + .cpuAndGPU，而非 EnumeratedShapes + .all？"
    a: "实测显示 PP-OCRv6 识别模型在 EnumeratedShapes 与 .all 下仍会触发 ANECCompile() 失败并回落，加载耗时飙升至 3595 ms，热身推理退化至 62.7 至 94.9 ms。改用 FP16 RangeDim 配合 .cpuAndGPU 后，加载降至 239.5 ms，热身推理降至 10.1 至 24.7 ms；再由 Swift 侧将输入宽度收敛至 9 档离散桶，兼顾高速推理与 E5RT 缓存边界。"
  - q: "预编译的 .mlmodelc 目录可以直接随 macOS 通用架构（arm64 + x86_64）应用分发吗？"
    a: "可以。核查 coremlcompiler 输出的 det_inference.mlmodelc 与 rec_inference.mlmodelc，内部仅包含 model.mil、weights/weight.bin、coremldata.bin 与 metadata.json，不含架构绑定的 Mach-O 或硬件固件二进制；硬件内核由目标机运行期 E5RT 按当前芯片编译。"
---

> **适用环境**：Cappuccino（macOS 15.0+ 通用架构）、Apple M1 Pro、macOS 26.6.2、Xcode 26.2  
> **转换工具链**：`coremltools 9.0`、`onnx 1.23.2`、`onnx2torch 1.5.15`、`onnxruntime 1.32.0`、`torch 2.15.0`  
> **核心问题**：移除外部 ONNX Runtime 依赖、将 PP-OCRv6（small det + rec）完整迁移至系统原生 Core ML 时，如何解决动态图算子语义偏差并跑出优于 CPU 的推理延迟？

## 核心结论（TL;DR）

将 PP-OCRv6 的检测与识别模型从 ONNX Runtime 迁移至 Core ML（`MLProgram`）后，Cappuccino 彻底移除了第三方 C++ 运行时依赖。通过规范化 3 处 `SAME_UPPER` 填充、消除 FP16 下的 `MaxPool` 负无穷溢出、改写 4 处 SVTR 动态 `Reshape`，模型在 `W = 32` 至 `3200` 全宽度下与 ONNX Runtime 保持 100% Top-1 对齐。最终采用 **FP16 + `RangeDim` + `.cpuAndGPU` + Swift 侧 9 档宽度分桶**，模型总体积从 **29.4 MB 降至 14.8 MB**，热身推理较原版 CPU 快 **1.8x 至 3.2x**。

---

## 1. 迁移起因与模型契约

Cappuccino 的截图取字、OCR 翻译面板与贴图划词功能均运行同一套本地 PP-OCRv6 管线。旧版本通过 `onnxruntime-swift-package-manager` 在 CPU 上执行推理，上游 SPM 仓库突发 404 且二进制分发域名出现 TLS 证书 SAN 不匹配后，全新环境直接无法拉取依赖构建。

从 macOS 原生架构审视，系统已内置 `CoreML.framework` 与 Metal/MPSGraph 后端。把 29.4 MB 的 ONNX 模型转为 Core ML，既能消除外部 XCFramework 供应链风险，也能把原本吃 CPU 的卷积与注意力算子迁到 GPU 上执行。

动手前，先提取两个原版 ONNX 模型的算子与输入输出契约：

| 模型 | Opset | 输入 `x` | 输出 `fetch_name_0` | 算子数 | 结构特征 |
| :--- | ---: | :--- | :--- | ---: | :--- |
| `det_inference.onnx` | 14 | `[N, 3, H, W]` | `[N, 1, H, W]` | 14 | DBNet 检测头，含 6 个 `Resize` 与 3 个 `SAME_UPPER` 节点 |
| `rec_inference.onnx` | 11 | `[N, 3, 48, W]` | `[N, T, 18710]` | 25 | 骨干网络 + 2 层 SVTR 注意力头 + 18,710 类 CTC 输出（$T = W/8$） |

新版 `coremltools` 已移除直接的 ONNX 前端，整体转换链路按以下 5 步展开：

```text
ONNX 原模型 (.onnx)
  --> 图规范化 (SAME_UPPER -> pads / SVTR Reshape -> -1)
  --> onnx2torch (PyTorch FX)
  --> torch.jit.trace + coremltools (FP16 MLProgram)
  --> xcrun coremlcompiler compile (.mlmodelc)
```

---

## 2. 转换链路中的四个核心坑与解法

`det` 与 `rec` 的主干算子都很常规，真正卡住转换或静默引入 Bug 的点集中在图规范化、边界填充值与动态形状追踪。

### 2.1 `onnx2torch` 拒绝 `auto_pad="SAME_UPPER"`

直接调用 `onnx2torch.convert` 会在第一个带自动填充的卷积节点中断：

```text
NotImplementedError: "SAME_UPPER" auto_pad is not implemented
```

PaddlePaddle 导出 `padding="SAME"` 时会写入 `auto_pad="SAME_UPPER"`。遍历两个 ONNX 图确认，各自仅有 3 个节点触发该属性（`Conv.1`、`Conv.2`、`MaxPool.0`），且超参数完全一致：`kernel_shape = [2, 2]`、`strides = [1, 1]`、`dilations = [1, 1]`。

代入 ONNX `SAME_UPPER` 定义计算任意空间维度 $N$ 的总填充量：

$$\text{pad\_total} = \left(\lceil N / 1 \rceil - 1\right) \cdot 1 + \left((2 - 1) \cdot 1 + 1\right) - N = 1$$

步长为 1、核宽为 2 时，总填充量恒等于 1，与输入尺寸无关。按 `SAME_UPPER` 前少后多规则拆分，将 3 个节点的属性改写为 `auto_pad = "NOTSET"` 与固定非对称 `pads = [0, 0, 1, 1]`，数学上与原图严格等价。

### 2.2 `MaxPool` 边界填充值与 FP16 溢出陷阱

把 `MaxPool.0` 改成显式非对称 `pads = [0, 0, 1, 1]` 后，必须核查边界填充值。ONNX 规范要求 `MaxPool` 的越界填充视为 $-\infty$，否则特征图为负值时，零填充会被误选为局部最大值。

查阅 `onnx2torch/node_converters/max_pool.py` 源码可知，它在遇到非对称填充时会自动在池化前插入 `OnnxPadStatic` 并设置 `constant_value = float("-inf")`。在 FP32 生成的 `model.mil` 中，`Conv` 使用 `0.0`，`MaxPool` 使用 `-3.40e38`（`-FLT_MAX`），语义准确。

问题出现在切换至 FP16 时，`coremltools` 报出常量类型转换溢出警告：

```text
coremltools/converters/mil/mil/ops/defs/iOS15/elementwise_unary.py:889:
RuntimeWarning: overflow encountered in cast
```

`-FLT_MAX` 远超 FP16 表示下限（$-65504$）。回查两个模型的拓扑结构，发现 `MaxPool.0` 的直接前驱算子均是 `Relu`，其输出恒满足 $x \ge 0$。在非负输入前提下，$\max(x, -\infty)$ 与 $\max(x, 0.0)$ 完全等价。我们在转换阶段将前驱为 `Relu` 的 `OnnxPadStatic(constant_value=-inf)` 显式改为 `0.0`，彻底消除溢出警告且零精度损失。

### 2.3 `torch.jit.trace` 固化 SVTR 识别头动态宽度

解决填充问题后，`det` 模型一次通过多分辨率校验，但 `rec` 模型在推理非 trace 宽度时触发 E5RT 运行时崩溃：

```text
E5RT encountered an STL exception. msg = Failed to PropagateInputTensorShapes:
Validation error during type inference for ios18.reshape:
cannot reshape tensor of size 48000 into shape [1, 8, 40, 15].
```

根因位于 `onnx2torch` 的 `OnnxShape` 与 `OnnxReshape`：二者使用 `torch.tensor(input.shape)` 与 `torch.Size(shape)` 构造目标形状。当以 `W = 320`（$T = 40$）执行 `torch.jit.trace` 时，动态长度 `40` 被固化为常量 `[1, 8, 40, 15]`。

在 ONNX Runtime 中将尾部中间张量挂出为输出节点，分别运行 `W = 128`、`320`、`960` 抓取真实形状后，锁定 2 层 SVTR 注意力头中的全部 4 处动态 `Reshape`：

| 节点名 | 输入形状 | 原动态目标形状 | 改写后的 `-1` 静态目标 |
| :--- | :--- | :--- | :--- |
| `Reshape.54` | `[1, 120, 1, T]` | `Shape -> Slice -> Concat` | `[0, 120, -1]` |
| `Reshape.58` | `[1, 8, T, 15]` | `Shape(slice.1)` | `[0, 8, -1, 15]` |
| `Reshape.66` | `[1, 8, T, 15]` | `Shape(slice.4)` | `[0, 8, -1, 15]` |
| `Reshape.73` | `[1, T, 120]` | `Concat([0, 1, T, 120])` | `[0, 1, -1, 120]` |

ONNX `Reshape` 中 `0` 表示沿用对应轴输入维度，`-1` 表示按元素总数自动推导动态时间步 $T$。改写后，`rec` 模型在 `[1, 3, 48, RangeDim(32, 3200)]` 范围内完整保留了动态宽度能力。

### 2.4 `det` 中 `Resize` 追踪警告的核查

追踪 `det_inference.onnx` 时，`onnx2torch/node_converters/resize.py` 会发出 `scales = scales.tolist()` 警告。如果原图依赖动态 `sizes`，固化后会在非方形截图上发生错位。逐一检查全部 6 个 `Resize` 节点后确认，它们均为 `mode = nearest`、`coordinate_transformation_mode = asymmetric`、`nearest_mode = floor`，且全部使用常量倍率（`2x`、`4x`、`8x`），在 MIL 中生成精确的 `upsample_nearest_neighbor`，可安全适配任意截图尺寸。

### 核心转换脚本片段

```python
# convert_ppocr_to_coreml.py (精简核心逻辑)
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
    # MaxPool.0 前驱均为 Relu (>= 0)，0.0 填充与 -inf 数学等价且避免 FP16 常量溢出
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

## 3. 数值对齐与多语言端到端审计

所有精度评估均以原版 ONNX Runtime（`CPUExecutionProvider`）为基准，在相同输入张量与预处理管线下逐项校验。

### 3.1 检测模型极端比例校验

在 5 组非对称与极端分辨率下（随机均匀分布输入 `[-2.5, 2.5]`），Core ML FP32 与 ONNX Runtime 的输出误差全部落在单精度浮点噪声区间内，零 NaN：

| 输入形状 `[1, 3, H, W]` | `max_abs` | `mean_abs` | NaN |
| :--- | ---: | ---: | :--- |
| `[1, 3, 32, 32]` | `1.25e-07` | `2.51e-08` | 无 |
| `[1, 3, 32, 960]` | `1.38e-07` | `2.40e-08` | 无 |
| `[1, 3, 960, 32]` | `1.29e-07` | `2.54e-08` | 无 |
| `[1, 3, 480, 736]` | `2.19e-04` | `4.90e-06` | 无 |
| `[1, 3, 960, 960]` | `5.16e-05` | `4.29e-06` | 无 |

在 `960x640` 真实 4 行中英文文档渲染图上（概率阈值 `> 0.3`，基准有效像素 `23,492`）：

- **Core ML FP32**：`max_diff = 6.92e-05`，二值掩码 **IoU = 1.000000**；
- **Core ML FP16**：`max_diff = 3.24e-02`，二值掩码 **IoU = 0.998511**，检测框与后处理结果稳定。

### 3.2 识别模型全宽度扫描与多语言 CTC 解码

覆盖 `W = 32, 64, 160, 320, 480, 960, 1600, 3200` 共 8 档宽度测试，输出时间步 $T = W / 8$（`4` 至 `400`）与 ONNX Runtime 全部一致，FP32 最大绝对误差处于 `1.97e-05` 至 `1.08e-04`，18,710 类 argmax Top-1 匹配率全部为 **100.00%**。

![PP-OCRv6 识别模型全动态宽度数值误差与形状策略对比](/images/blog/ppocrv6_fig2_width_parity.png)

使用与 Swift 端完全一致的预处理（BGR 通道顺序、`H = 48` 等比缩放、右侧黑边填充、`(x / 255 - 0.5) / 0.5` 归一化）与 CTC 贪婪解码，测试 5 组真实渲染文本样本：

| 样本内容类型 | 宽度 `W` | FP32 vs ORT | FP16 vs ORT | 分桶填充 (FP16) vs ORT |
| :--- | ---: | :--- | :--- | :--- |
| 中文 + 数字 + 标点 | `608`（桶 `768`） | 100% 一致 (`3.46e-6`) | 100% 一致 (`2.25e-3`) | 100% 一致 |
| 英文 + 版本号 | `672`（桶 `768`） | 100% 一致 (`4.77e-6`) | 100% 一致 (`3.30e-3`) | 100% 一致 |
| 中英混排 + 百分比括号 | `736`（桶 `768`） | 100% 一致 (`3.04e-6`) | 100% 一致 (`4.49e-3`) | 100% 一致 |
| 极短文本（`"OK"`） | `96`（桶 `128`） | 100% 一致 (`3.58e-7`) | 100% 一致 (`1.10e-6`) | 100% 一致 |
| 超长混排长句（`W > 1600`） | `1920`（桶 `2048`） | 100% 一致 (`1.86e-5`) | 100% 一致 (`2.65e-3`) | 100% 一致 |

---

## 4. 三个反直觉的性能实测结论

首次接入 FP32 Core ML 模型后，单测在冷启动下跑完一张合成图耗时 `8.358 s`。随后我们在 Apple M1 Pro 上系统测量了精度（FP32 / FP16）、动态形状策略（`RangeDim` / `EnumeratedShapes`）与计算单元（`.all` / `.cpuAndGPU`），得到三组与常见经验相反的数据。

### 4.1 FP16 体积减半且全面提速

| 指标 | ONNX Runtime (CPU) | Core ML FP32 | Core ML FP16 |
| :--- | ---: | ---: | ---: |
| 模型总体积（det + rec） | `29.4 MB` | `29.5 MB` | **`14.8 MB`** |
| DET `960x640` 热身耗时 | `95.0 ms` | `82.5 ms` | **`51.4 ms`** |
| REC `W = 320` 热身耗时 | `12.9 ms` | `7.8 ms` | **`4.0 ms`** |
| REC `W = 1600` 热身耗时 | `51.3 ms` | `20.4 ms` | **`15.1 ms`** |

在保持多语言 CTC 逐字 100% 一致的前提下，FP16 把两个模型打包体积直接减半（`det 4.8 MB + rec 10.0 MB`），GPU 原生 FP16 吞吐也将推理延迟进一步压低。

### 4.2 `EnumeratedShapes` 在 `PPOCRv6Rec` 上反而更慢

Core ML 常规最佳实践建议用 `ct.EnumeratedShapes` 替代 `ct.RangeDim`，期望在加载时预编译离散形状以命中 Apple Neural Engine（ANE）。实际测试将 `rec` 转为 9 档 `EnumeratedShapes([128, 256, 384, 512, 768, 1024, 1536, 2048, 3200])` 后，出现了两项严重退化：

1. 加载阶段依然触发 `MILCompilerForANE error: ANECCompile() FAILED`（受限因素包括 `18,710` 维分类头输出通道与 SVTR 注意力结构）。
2. 模型加载时间暴涨至 **`3595.0 ms`**，热身推理退化到 **`62.7 ms` 至 `94.9 ms`**，远慢于 `RangeDim`。

### 4.3 `.cpuAndGPU` 在加载与推理上全面优于 `.all`

既然动态 PP-OCRv6 在当前 ANE 编译器上无法通过编译，保持默认 `computeUnits = .all` 会迫使运行时每次加载先走一遍失败的 ANE 编译、抛出内部异常，再把子图切分回落并引入额外的设备间同步开销。

在 Apple M1 Pro 上对比清理后的 FP16 `RangeDim` 模型：

| 模型与阶段 | `computeUnits = .all` | `computeUnits = .cpuAndGPU` | 变化 |
| :--- | ---: | ---: | :--- |
| DET 模型加载 | `999.0 ms` | **`251.8 ms`** | 快 4.0x |
| DET 首次 `(480x640)` | `465.2 ms` | **`45.9 ms`** | 快 10.1x |
| DET 热身 `(480x640)` | `30.9 ms` | **`29.2 ms`** | 略快 |
| REC 模型加载 | `1570.8 ms` | **`239.5 ms`** | 快 6.6x |
| REC 热身 `W = 320` | `55.3 ms` | **`10.1 ms`** | 快 5.5x |
| REC 热身 `W = 1600` | `69.4 ms` | **`24.7 ms`** | 快 2.8x |

### 4.4 最终折中：模型侧 `RangeDim` + Swift 侧宽度分桶

为了兼顾 `RangeDim` 的 Metal 推理速度与 E5RT 缓存健康度，我们在 Swift 侧（`Cappuccino/OCR/PPOCRv6/PPOCRv6Engine.swift`）把原本按 32 像素步进的 100 种可能宽度向上对齐至 9 档离散桶：

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

这套组合把 MPSGraph 与 `com.apple.e5rt.e5bundlecache` 中的 `rec` 形状基数封顶在 9 种，既避免长期使用导致缓存持续膨胀，又没有引入 `EnumeratedShapes` 的 3.6 秒加载惩罚。

---

## 5. macOS 工程集成与仓库治理细节

### 5.1 `MLMultiArray` 步长安全读写与严格并发

项目启用了 `SWIFT_STRICT_CONCURRENCY = complete`。接入 `CoreML` 时容易踩坑的一点是直接把 `MLMultiArray` 底层指针当成紧凑数组做 `memcpy`。Metal 路径下 Core ML 可能为行对齐填充额外步长（`strides`），我们按实际步长做了双路径封装：

```swift
// Cappuccino/OCR/PPOCRv6/PPOCRv6Engine.swift (核心读写逻辑)
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

模型调用由 `PPOCRv6Engine` 内部 `NSLock` 串行化保护，并在逐行识别循环内包裹 `autoreleasepool`，及时释放临时 `CGImage` 与 `MLMultiArray`。

### 5.2 预编译 `.mlmodelc` 与通用架构分发

Cappuccino 的 `project.yml` 将 `Resources/PPOCRv6` 声明为文件夹引用（`type: folder`），且单元测试与 SPM 环境需直接从该目录加载模型。使用 `xcrun coremlcompiler compile` 预编译为 `.mlmodelc` 放入目录后，App 首次启动无需再调用 `MLModel.compileModel(at:)`。

核查 `det_inference.mlmodelc` 与 `rec_inference.mlmodelc` 的产物结构，目录内仅含 `model.mil`、`weights/weight.bin`、`coremldata.bin`、`metadata.json` 与 `analytics/coremldata.bin`，不含绑定特定 CPU 指令集或 ANE 固件的二进制，最终 Release 通用归档（`x86_64 arm64`）整包体积收敛至 `61 MB`，其中 `Resources/PPOCRv6` 占 `15 MB`。

### 5.3 容易遗漏的 Git LFS 规则

旧仓库的 `.gitattributes` 只跟踪了 `*.onnx`。删除 `.onnx` 换入 `.mlmodelc` 后，如果直接提交，两个 `weights/weight.bin`（合计 14.8 MB）会绕过 LFS 写入普通 Git 对象库。迁移时必须补齐规则并用 `git check-attr` 验证：

```text
# .gitattributes
*.onnx filter=lfs diff=lfs merge=lfs -text
Resources/PPOCRv6/**/*.bin filter=lfs diff=lfs merge=lfs -text
```

---

## 6. 适用边界与权衡

这次迁移解决了 Cappuccino 的依赖阻断与包体冗余，但方案本身有明确边界：

- **硬件部署前提**：模型目标版本为 `macOS 15.0+`；若需兼容更早的 macOS 12/13，需重新验证 MIL opset 与 `MLMultiArray.withUnsafeMutableBytes` 行为。
- **检测模型仍受动态形状缓存影响**：截图长宽比变化范围广，`det` 保留了 `RangeDim(32, 1920)`；首次遇到未缓存分辨率时仍会出现数十毫秒级的 MPSGraph 特化耗时。
- **未启用 ANE**：针对带 18,710 类输出头的 SVTR 识别模型，在当前 macOS ANE 编译器下强行追求 ANE 反而得不偿失；后续若升级新版操作系统或更换更小词表模型，可重新基准测试 `.all`。

---

## FAQ

### PP-OCRv6 识别模型转为 Core ML 后，如何保留 [1, 3, 48, W] 动态宽度？

`onnx2torch` 在 `torch.jit.trace` 阶段会把 `Shape` 与 `Reshape` 推导出的序列长度固化为静态常量。定位 SVTR 注意力头中的 4 处动态 `Reshape` 节点（`Reshape.54`、`Reshape.58`、`Reshape.66`、`Reshape.73`），将其目标形状改写为含 `-1` 的静态张量（如 `[0, 8, -1, 15]` 与 `[0, 1, -1, 120]`）后，模型即可在 `W = 32` 至 `3200` 全范围内保持 `T = W / 8` 的动态输出。

### PP-OCRv6 在 Core ML 上应该用 FP32 还是 FP16？精度会下降吗？

在 Apple M1 Pro 实测中，FP16 将 `det` 与 `rec` 模型总体积从 `29.5 MB` 降至 `14.8 MB`，`960x640` 检测耗时从 `82.5 ms` 降至 `51.4 ms`，`W = 320` 识别耗时从 `7.8 ms` 降至 `4.0 ms`。数值对齐上，FP16 检测掩码与 ONNX Runtime 的 IoU 达到 `0.998511`，5 组中英文与超长文本样本的 CTC 解码逐字一致率保持 `100%`。

### 为什么 PP-OCRv6 在 macOS 上选择 RangeDim + .cpuAndGPU，而非 EnumeratedShapes + .all？

实测显示 PP-OCRv6 识别模型在 `EnumeratedShapes` 与 `.all` 下仍会触发 `ANECCompile()` 失败并回落，加载耗时飙升至 `3595 ms`，热身推理退化至 `62.7` 至 `94.9 ms`。改用 FP16 `RangeDim` 配合 `.cpuAndGPU` 后，加载降至 `239.5 ms`，热身推理降至 `10.1` 至 `24.7 ms`；再由 Swift 侧将输入宽度收敛至 9 档离散桶，兼顾高速推理与 E5RT 缓存边界。

### 预编译的 .mlmodelc 目录可以直接随 macOS 通用架构（arm64 + x86_64）应用分发吗？

可以。核查 `coremlcompiler` 输出的 `det_inference.mlmodelc` 与 `rec_inference.mlmodelc`，内部仅包含 `model.mil`、`weights/weight.bin`、`coremldata.bin` 与 `metadata.json`，不含架构绑定的 Mach-O 或硬件固件二进制；硬件内核由目标机运行期 E5RT 按当前芯片编译。
