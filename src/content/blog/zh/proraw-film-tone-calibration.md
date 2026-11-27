---
title: "Apple ProRAW 胶片显影参数标定：破除 Smart HDR 双重压缩与 EV100 三级分级策略"
description: "基于 13 组 48 MP ProRAW 实拍样本与 5 类胶片 LUT 端到端评测，量化剖析 CIRAWFilter 默认 boost=1.0 / ltm=1.0 引发的双重压缩与空间 HDR 扭曲，并给出 B3-NightAdapt 自适应曲线与三级意图分级落地实现。"
lang: "zh"
translationSlug: "proraw-film-tone-calibration"
pubDate: 2026-11-27
project: "espresso"
tags: ["Color Science", "ProRAW", "CIRAWFilter", "ACES", "LUT", "iOS"]
readingTime: 14
coverImage: "/images/blog/proraw_fig1_pareto_and_shadow_crush.png"
coverAlt: "ProRAW CIRAWFilter 参数标定：Pre-LUT 空间 HDR 扭曲与 EDR 帕累托权衡及 Post-LUT 深暗死黑率对比"
coverSpec: "FIG 01 · PRORAW CIRAWFILTER PARETO & SHADOW CRUSH · 13-SCENE BENCHMARK"
featured: true
faqs:
  - q: "为什么把 CIRAWFilter 默认的 boost=1.0、ltm=1.0 直接送入胶片 3D LUT 会导致画面发闷和死黑？"
    a: "默认配置面向即拍即用的 Smart HDR 观感，会在进 LUT 前施加 100% ProfileGainTableMap 局部提亮与全局显示级 S 曲线。实测在 7 组 48 MP ProRAW 样本上，该配置使 Pre-LUT 线性高光余量 EDRMax 压缩至 1.94x、空间扭曲 SpatialWarpEV 达 0.240 EV、高分位彩度 P90 C* 被硬推至 27.2；叠加内置 S 曲线的胶片 LUT 后触发双重压缩，Genesis 5207 与 Fuji ClassicNeg 的深暗死黑率（L* < 5）分别达到 14.97% 与 14.63%。"
  - q: "降低 localToneMapAmount 后画面变暗、变平怎么办？为什么不能锁死 exposure=0？"
    a: "Apple ProRAW 拍摄时会主动欠曝约 1.0 至 1.5 EV 以保护高光，再依赖局部增益表提亮中灰。如果锁死 exposure=0 仅调低 boost（如 0.35 / 0.70），有效伽马会跌至 0.696，抵消胶片 LUT 反差；同步拉高 boost 与 ltm（0.75 / 0.95）又会回到空间拍平与高光腰斩的死循环。破局做法是用纯线性标量曝光（exposure = +0.35 EV）补偿降 ltm（0.95 降至 0.50）减少的中灰亮度，零空间扭曲地恢复反差与 EDR 余量。"
  - q: "B3-NightAdapt 为什么要按场景 EV100 在 [1.5, 5.0] 区间做平滑收敛？"
    a: "在 EV100 = 1.96（ISO 1250）的真实夜景天际线上，固定 B3（0.35 / 0.50 / +0.35 EV）会把中灰增益推高至 +0.61 EV，导致夜空云层发灰并放大暗部噪点。在 EV100 ∈ [1.5, 5.0] 引入 C1 连续 Hermite smoothstep 将 ltm 收敛至 0.35、exposure 收敛至 +0.10 EV 后，夜景中灰回到 +0.24 EV、空间扭曲降至 0.052 EV、暗部高频噪点 ShNois 再降 10%，同时白天与常规室内（EV100 >= 5.0）保持与 B3 完全一致。"
  - q: "为什么 Espresso 要把 ProRAW 显影参数拆分为胶片模拟、显示叠加 LUT 与无滤镜直出三级策略？"
    a: "三类下游消费者的传递曲线截然不同：ACEScct 与胶片印相 LUT 自带完整 S 曲线（γ = 1.09–1.67），需要克制的 B3-NightAdapt 光学负片；Leica LUX 等显示叠加 LUT 接近线性（γ = 0.93–1.13），需要 0.55 / 0.55 / +0.30 EV 补足基础黑位；无滤镜直出没有下游曲线接管反差，直接输出 B3 会显得黑位偏灰，因此使用 NoLUT-B（0.85 / 0.65 / +0.25 EV），在恢复扎实黑位（P05 = 5.3）的同时较系统默认减少 19% 空间 HDR 扭曲与 16% 暗部噪点。"
---

> **适用背景**：Espresso 色彩与 RAW 显影管线（iOS 18.2+、`CIRAWFilter` 线性 DNG 解码、双轨 Metal 3D LUT）  
> **核心模块**：`SceneRadiometryMath.swift`、`RawDevelopmentStrategy.swift`、`FilmColorProfile.swift`  
> **核心问题**：将 Apple ProRAW 送入内置完整银盐特性曲线的 3D 胶片 LUT 前，`CIRAWFilter` 的 `boostAmount`、`localToneMapAmount` 与 `exposure` 应该如何标定，才能同时避开默认 Smart HDR 的双重压缩与低 `boost` 带来的灰平感？

## 核心结论（TL;DR）

Apple `CIRAWFilter` 默认的 `boost = 1.0 / ltm = 1.0` 会提前烘焙显示级 S 曲线与空间局部增益，导致后续胶片 LUT 深暗死黑率暴涨 **+75%**、线性高光余量 `EDRMax` 腰斩至 **1.94x**。经两轮 **13 组 48 MP ProRAW 实拍样本**（`EV100 = 1.96–15.04`）与 5 类跨轨道 LUT 量化标定，Espresso 落地了**三级意图分级策略**：胶片模拟 LUT 采用 **`B3-NightAdapt`**（白天 `0.35 / 0.50 / +0.35 EV`，夜景 `EV100 ∈ [1.5, 5.0]` 经 $C^1$ smoothstep 收敛至 `0.35 / 0.35 / +0.10 EV`），将 13 场景空间扭曲压低 **43%**、色相偏移削减 **64%**、暗部噪点降低 **23%**；显示叠加类 LUT（Leica LUX）采用 `0.55 / 0.55 / +0.30 EV`；无滤镜直出采用 `NoLUT-B`（`0.85 / 0.65 / +0.25 EV`）。

---

## 1. ProRAW 在双轨胶片管线中的位置

与单帧拜耳 RAW（Bayer CFA）不同，Apple ProRAW 是 12/14-bit 线性 DNG 容器（`PhotometricInterpretation == 34892`）。它在保留线性场景光与超白高光余量（EDR Headroom）的同时，在元数据中嵌入了多帧计算摄影生成的局部增益表（DNG 1.6 `ProfileGainTableMap` / DNG 1.7 `ProfileGainTableMap2`）和全局渲染意图。

在 Espresso 的零拷贝拍照管线中，ProRAW 经 `CIRAWFilter` 渲染到扩展线性 Display P3 浮点纹理（`extendedLinearDisplayP3`, `.rgba16Float`），再无损进入双轨 Metal 3D LUT 胶片冲印着色器（`LUTShader.metal`）：

```text
Apple ProRAW Linear DNG (12/14-bit + BaselineExposure + ProfileGainTableMap)
  │
  ├─► CIRAWFilter (boost / ltm / exposure, EDR = 1.0)
  │     └─► extendedLinearDisplayP3 (.rgba16Float, preserves > 1.0 EDR)
  │
  ├─► [Track B: ACEScct AP1]
  │     preLUTExposureOffsetEV --> ACEScct Log --> 65³ Film Print LUT
  │     (ARRI / DaVinci / Genesis / Fujifilm / Sony / Zero)
  │     --> applyShadowToeFlareDisplayP3 --> Display P3 10-bit HEIC
  │
  └─► [Track A: Linear Display P3]
        easeHighlightPathToWhiteP3 --> 45³ Film LUT (Dehancer / Leica LUX)
        --> srgb_encode_oetf --> Display P3 10-bit HEIC
```

前端 `CIRAWFilter` 与后端 3D LUT 构成级联非线性系统。前端如果已经提前烘焙了显示级 S 曲线与重度局部色调映射，后端再精确的胶片特性曲线也会被扭曲。

---

## 2. `boost = 1.0 / ltm = 1.0` 的物理机制与实测缺陷

`CIRAWFilter` 打开 ProRAW 时的默认配置为 `boostAmount = 1.0`、`localToneMapAmount = 1.0`、`exposure = 0.0`。这套默认值的目标是让未调色的 ProRAW 直接呈现近似系统相机 HEIC 的即拍即用观感。

### 2.1 `ltm` 与 `boost` 的真实物理行为

结合 Adobe DNG 1.6 规范与 Apple WWDC21 Session 10160，这两个参数的功能经常被字面意思误导：

1. **`localToneMapAmount`（`ltm`）控制 `ProfileGainTableMap` 空间增益表的介入强度**：  
   Apple ProRAW 在多帧融合拍摄时会主动欠曝线性传感器约 `1.0–1.5 EV` 以保护高光不溢出，再把空间分区的补偿增益存入低分辨率 2D 查表 `ProfileGainTableMap`。应用 `BaselineExposure` 后，解码器按像素位置 $(x, y)$ 与亮度指标 $I$ 查表取出标量增益 $g(x, y, I)$ 并乘回线性 RGB：
   $$\mathbf{C}_{\text{out}} = g(x, y, I) \cdot \mathbf{C}_{\text{in}}, \quad I = \operatorname{clamp}\!\big((R, G, B, \min, \max) \cdot \mathbf{w}_{\text{map}},\, 0,\, 1\big)$$
   实测显示，`ltm` 是强凹动态范围压缩算子：`ltm = 0.95`（`boost = 0`）会将深暗部抬高约 `+2.15 EV`、中灰抬高 `+1.16 EV`，高光仅微调 `+0.23 EV`，直接把物理场景的有效伽马从 `1.000` 压平至 `0.645`。
2. **`boostAmount`（`boost`）控制 Apple 全局显示级 S 曲线的介入强度**：  
   调高 `boost` 并不会提亮暗部。相反，它会把被 `ltm` 抬起的暗部重新压黑、拉陡中灰斜率，并通过通道级非线性推高 RGB 彩度，以恢复高反差的显示级观感。

### 2.2 默认配置送入胶片 LUT 的四大实测缺陷

在首轮 7 组 iPhone 17 Pro 48 MP ProRAW 样本上，把 `1.0 / 1.0` 直接送入 5 个跨轨道胶片 LUT 后，量化数据暴露出四处明显退化：

1. **双重 S 曲线压缩（Double Compression）与暗部死黑**：`boost = 1.0` 在进 LUT 前就把暗部分位 `P05` 压低至 `5.2`（对比 `B3` 为 `11.5`）。叠加内置 $\gamma = 1.09\text{–}1.67$ 的胶片印相 LUT 后，暗部二次塌陷：`Genesis 5207` 的深暗死黑率（$L^* < 5$）飙升至 **14.97%**（较 `B3` 的 `8.57%` 高出 **+75%**），`Fujifilm ClassicNeg` 达 **14.63%**，`ARRI Classic` 达 **14.12%**，`Dehancer Portra 400` 达 **11.58%**（`B3` 仅 `5.59%`）。
2. **重度 Smart HDR 空间扭曲与宏观光影拍平**：`ltm = 1.0` 产生了全场最高的空间增益畸变（`SpatialWarpEV = 0.240 EV`，较 `B3` 高 **+63%**），宏观立体度指标 `Loc/Mac` 攀升至 **0.363**（全场最差）。强光晴天下，大面积阴影被异常提灰、亮暗纵深感塌陷，同时局部边缘锐度偏硬。
3. **EDR 高光余量腰斩**：进入 LUT 前的线性峰值 `EDRMax` 被压至 **1.94x**（仅为纯线性 `+0.90 EV` 的 32%，比 `B3` 的 `3.12x` 少 **38%**），浪费了 ACEScct 电影 LUT 本身最核心的 `+5.2` 至 `+11.3 L*` 对数高光肩部空间。
4. **前端数码增艳覆盖胶片发色（Chroma Override）**：`boost = 1.0` 在进 LUT 前就把高分位彩度 `P90 C*` 从纯光学线性的 `18.9` 硬推到 **27.2**（+44%），导致不同银盐胶片卷原有的肤色与绿色染料区分度被前端数码高饱和掩盖。

### 2.3 三个容易踩坑的中间方案

在调优过程中，我们先后排除了三个看似合理、实则存在结构缺陷的参数点：

- **误区 A：锁死 `exposure = 0.0` 仅调低 `boost`（`0.35 / 0.70 / e0`）**：`ltm = 0.70` 已把底图有效反差压低至 $\gamma_{\text{eff}} = 0.696$，乘以胶片 LUT 斜率后（如 `ARRI Classic`：$0.696 \times 1.09 = 0.76$；`Genesis 5207`：$0.696 \times 1.33 = 0.93$），总反差低于线性，画面整体发灰发平。
- **误区 B：在 `exposure = 0.0` 下同步拉高（`0.70–0.75 / 0.95 / e0`）**：先用 95% 局部色调映射拍平大光比，再用 75% Apple 显示 S 曲线硬拽回反差与饱和度。其 `SpatialWarpEV = 0.214 EV`、`EDRMax = 1.99x`、`Loc/Mac = 0.362` 与 `1.0 / 1.0` 几乎处于同一区间，属于手机高反差滤镜观感。
- **误区 C：彻底归零（`0.00 / 0.00 / +0.90 EV`）**：虽然 `EffGam = 1.000`、`SpatialWarpEV = 0.000`，但 Apple ProRAW 的欠曝测光策略假设解码时会部分启用局部增益表。完全关闭 `ltm` 后，大光比逆光与正午强光场景中灰跌至 `P50 = 23.3`（强光高楼场景 `S05` 仅 `11.7`），地铁人像场景 `S03` 还出现了 `0.83%` 高光硬裁。

> **破局关键**：把调参逼入死胡同的约束是“锁死 `exposure = 0.0`，只靠 `ltm` 提亮画面”。当把降低 `ltm`（`0.95` 降至 `0.50`）减少的中灰亮度，改由**纯线性标量曝光（`exposure = +0.35 EV`）**补偿后，既不引入额外空间扭曲，也不压缩反差与 EDR 余量，同时解开了“发平”与“数码 HDR 味”的对立。

---

## 3. 四层解耦评测体系与核心量化指标

靠一两张实拍图目测，或者只看 Post-LUT 全局直方图，极易被 `ltm` 提亮与 `boost` 压黑的反向抵消蒙蔽。因此我们建立了四层解耦评测框架。

### 3.1 客观三角参照系与跨光照样本库

早期迭代曾尝试让 ProRAW 解码底图去拟合系统相机 SDR HEIC 的 `RMS_L` 与 `P90 C*`。这个方向存在根本偏差：SDR HEIC 已经历不可逆的动态范围压缩并丢失超白高光余量，以它为拟合目标只会把 ProRAW 拉回 `1.0 / 1.0` 的双重压缩轨道。

合理的评测基准由三组参照共同锚定：
1. **物理光学参照（`b=0, l=0, exp=0` 纯线性 ProRAW）**：用于回归有效伽马 $\gamma_{\text{eff}}$、空间增益扭曲 `SpatialWarpEV` 与 `EDRMax` 保留率；
2. **Apple 默认渲染参照（`b=1.0, l=1.0, exp=0`）**：作为系统 Smart HDR 意图基线，锚定合理的中灰落点（`P50`）并对照双重压缩代价；
3. **全库 3D LUT 1D 敏感度测绘**：在 `-6 EV` 至 `+4 EV`（相对 18% 中灰 `0.18`）区间测绘各家族 LUT 的真实中灰锚点、对比度斜率与高光肩部容量。

首轮标定选取 7 组跨度近 10 档的 48 MP ProRAW 实拍样本（下表以 `S01`–`S07` 脱敏编号）：

| 样本编号 | 场景与挑战维度 | `EV100` | ISO | 快门 | `BaselineExposure` | 线性中灰 `LinP50` | 场景跨度 (`P99/P05`) | 线性峰值 `LinMax` | `LTM=1.0` 中灰增益 |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `S01` | 室内弱光人像（地板镜面反光） | `4.7` | 400 | 1/33 s | `+0.65` | `34.1` | `5.68 EV` | `6.33x` | `+1.35 EV` |
| `S02` | 地铁侧颜人像（肤色 + 黑大衣 + 亮屏） | `6.6` | 200 | 1/60 s | `-0.06` | `14.4` | `6.60 EV` | `1.31x` | `+1.50 EV` |
| `S03` | 地铁人像（顶灯高光 + 暗发纹理） | `6.9` | 160 | 1/60 s | `+0.25` | `15.4` | `8.56 EV` | `3.06x` | `+1.56 EV` |
| `S04` | 极限逆光窗景（暗桌盆栽 + 室外亮天井） | `7.3` | 100 | 1/50 s | `+0.09` | `23.2` | `9.95 EV` | `1.92x` | `+1.58 EV` |
| `S05` | 正午强光高楼（深阴影树丛 + 日光白楼） | `13.7` | 64 | 1/2747 s | `+0.41` | `15.3` | `7.26 EV` | `2.07x` | `+1.15 EV` |
| `S06` | 正午硬光街景（单车硬影 + 浓密树荫） | `13.8` | 80 | 1/3650 s | `+0.79` | `26.9` | `6.47 EV` | `6.67x` | `+1.56 EV` |
| `S07` | 正午强光街道（蓝天白云 + 阴面砖墙） | `14.2` | 64 | 1/3759 s | `+0.56` | `25.9` | `6.53 EV` | `1.04x` | `+1.33 EV` |

### 3.2 三类 LUT 曲线原型普查

按生产着色器配置（含 `FilmColorProfile.swift` 中的 `preLUTExposureOffsetEV` 与 `shadowToeFlare`）普查全库 8 大胶片家族后，111 个预设收敛为三类截然不同的曲线原型：

| 胶片原型与代表 LUT | 轨道 | `0 EV` 中灰 $L^*$ | 中灰 $\gamma_{\text{LUT}}$ | EDR 高光肩部 (`1.0x -> +4 EV`) | 对前端底图的核心诉求 |
| :--- | :---: | ---: | ---: | ---: | :--- |
| **原型 I：场景参考 ACEScct（35 个）**（`ARRI Classic` / `Genesis 5207` / `DaVinci 2383` / `Fuji ClassicNeg` / `Zero Zephyr`） | B | `49.0–50.4`（Zero: `42–43`） | `1.09–1.62` | `+5.2` 至 `+11.3 L*` | 自带完整 S 曲线与对数肩部；需要高 EDR 余量、低空间扭曲、低 `boost` |
| **原型 II：有界线性 P3 胶片（49 个）**（`Dehancer Portra 400` / `Gold 200` / `Vision3 250D`） | A | `39.0–46.3` | `1.26–1.67` | `+0.00`（`[0, 1]` 有界） | 自身 S 曲线陡峭且无对数肩部；需适度 `ltm` 收敛超高光、低 `boost` 护暗部 |
| **原型 III：显示参考叠加（27 个）**（`Leica Natural` / `Classic` / `Vivid`） | A | `49.0–61.1` | `0.93–1.13` | `+0.00`（`[0, 1]` 有界） | 曲线接近线性，依赖前端提供基础反差，但同样无需 95% 以上 Smart HDR 拍平 |

端到端测试强制覆盖 5 个代表 LUT（`Genesis 5207`、`Fujifilm ClassicNeg`、`ARRI Classic`、`Dehancer Portra 400`、`Leica Classic`），1:1 复现生产链路的 `preLUTExposureOffsetEV`（如 Genesis `+0.60 EV`、ARRI `+0.65 EV`）与 `applyShadowToeFlareDisplayP3`，同时隔离颗粒、Halation、Bloom 等随机空间后效，确保光度学数据零噪声干扰。

### 3.3 核心量化指标定义

| 指标 | 数学定义 | 视觉与物理含义 | 目标导向 |
| :--- | :--- | :--- | :--- |
| **`EffGam`（有效中灰伽马）** | 在中灰线性区 $Y_0 \in [0.02, 0.45]$ 上，$\log_2 Y_{\text{dev}}$ 对 $\log_2 Y_{\text{lin}(0,0)}$ 最小二乘回归斜率 | 衡量 `CIRAWFilter` 对物理场景反差的压缩程度；真实光学为 `1.000`，低于 `0.72` 进 LUT 易发平 | `>= 0.75`，避开 `< 0.70` |
| **`MidEV`（中灰增益）** | $Y_0 \in [0.05, 0.25]$ 的 $\operatorname{mean}(\log_2(Y_{\text{dev}} / Y_{\text{lin}}))$ | 解码器把欠曝线性数据整体提亮的档数，决定成片中灰曝光落点 | 稳定在 `+1.05` 至 `+1.15 EV` |
| **`SpatialWarpEV`（空间 HDR 扭曲）** | 上述对数回归的残差标准差 $\operatorname{std}\!\big(\log_2 Y_{\text{dev}} - (\gamma_{\text{eff}}\log_2 Y_0 + b)\big)$ | 剥离全局曲线后，纯粹由 2D 局部色调映射引起的空间亮度非均匀性 | 越低越纯净（`<= 0.15 EV`） |
| **`EDRMax`（线性高光余量）** | 进 LUT 前 `.rgba16Float` 线性纹理的最大通道峰值 $\max(R, G, B)$ | 留给 ACEScct 对数高光肩部的超白动态范围 | Track B 越高越好（`>= 3.0x`） |
| **`Loc/Mac`（局部 / 宏观对比度比）** | $\operatorname{mean}(\lvert L^* - G_\sigma(L^*)\rvert) / \operatorname{std}(G_\sigma(L^*))$（$\sigma \approx 5\%$ 短边） | 重度 LTM 拍平宏观光影（分母缩小）却保留局部锐边（分子不变），使比值偏高、画面平而脆 | 越低越具光学立体纵深 |
| **`P95 - P25`（影调张力跨度）** | 成片 CIE $L^*$ 的 95 分位与 25 分位之差 | 直观对应画面反差张力与通透度，抗极端死黑噪点干扰 | 追平或超越 `0.70 / 0.95` |
| **`L* < 5%` 与 `MaxClip7`** | 深暗像素占比（$L^* < 5$）与 7 场景最坏高光过曝率（$L^* > 98$） | 守住“避免双重压缩死黑”与“零高光硬裁”两条红线 | `MaxClip7 = 0.00%`（Track B / Dehancer） |
| **`P90 C*`（90 分位彩度）** | CIELAB 色度 $C^* = \sqrt{a^{*2} + b^{*2}}$ 的 90 分位 | 监测前端 `boost` 是否过度推高彩度覆盖 LUT 原生发色 | Pre-LUT 保持 `21–23` |

---

## 4. 7 场景实测数据与帕累托最优解 `B3`

![图 1：ProRAW CIRAWFilter 参数标定：Pre-LUT 空间 HDR 扭曲与 EDR 帕累托权衡及 Post-LUT 深暗死黑率对比](/images/blog/proraw_fig1_pareto_and_shadow_crush.png)

### 4.1 Pre-LUT 线性底片横评（7 场景均值）

| 参数方案 (`boost / ltm / exp`) | `EffGam` | `MidEV` | `WarpEV` | `EDRMax` | `P05 / P25 / P50 / P95` | `RMS_L` | `Loc/Mac` | `P90 C*` |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `1.00 / 1.00 / e0.00`（Apple 默认） | `0.785` | `+1.17` | `0.240` | `1.94x` | `5.2 / 21.8 / 39.5 / 80.3` | `24.1` | `0.363` | `27.2` |
| `0.35 / 0.70 / e0.00`（旧版扁平） | `0.696` | `+1.02` | `0.168` | `2.25x` | `11.6 / 25.1 / 39.4 / 75.1` | `20.6` | `0.353` | `21.7` |
| `0.70 / 0.95 / e0.00`（前版） | `0.720` | `+1.20` | `0.210` | `1.99x` | `9.7 / 25.0 / 41.2 / 79.3` | `22.4` | `0.362` | `25.0` |
| `0.75 / 0.95 / e0.00` | `0.732` | `+1.19` | `0.214` | `1.99x` | `9.0 / 24.4 / 40.8 / 79.3` | `22.7` | `0.362` | `25.3` |
| **`B3: 0.35 / 0.50 / +0.35`（采用）** | **`0.753`** | **`+1.11`** | **`0.147`** | **`3.12x`** | **`11.5 / 24.8 / 39.2 / 79.1`** | `21.8` | **`0.343`** | **`22.0`** |
| `B4: 0.45 / 0.55 / +0.30`（浓重备选） | `0.760` | `+1.09` | `0.158` | `2.93x` | `10.6 / 24.2 / 38.9 / 78.8` | `22.0` | `0.346` | `22.6` |
| `B2: 0.35 / 0.40 / +0.45`（硬光备选） | `0.791` | `+1.05` | `0.132` | `3.50x` | `10.8 / 23.6 / 37.8 / 79.4` | `22.1` | `0.337` | `21.8` |
| `C1: 0.00 / 0.00 / +0.90`（纯线性极限） | `1.000` | `+0.90` | `0.000` | `5.97x` | `8.7 / 18.6 / 31.0 / 82.0` | `24.1` | `0.299` | `18.9` |

### 4.2 Post-LUT 跨 5 类胶片曲线端到端表现（7 场景均值）

每格依次为：**影调张力 `P95-P25` / 深暗死黑 `L* < 5%` / 立体度 `Loc/Mac` / 最坏高光硬裁 `MaxClip7`**。

| 方案 | `Genesis 5207` (B) | `Fuji ClassicNeg` (B) | `ARRI Classic` (B) | `Dehancer Portra400` (A) | `Leica Classic` (A) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `1.00 / 1.00 / e0`（默认） | `66.6` / `14.97%` / `.344` / `0%` | `71.8` / `14.63%` / `.335` / `0%` | `58.6` / `14.12%` / `.354` / `0%` | `59.4` / `11.58%` / `.347` / `0%` | `67.2` / `9.12%` / `.357` / `1.06%` |
| `0.35 / 0.70 / e0`（旧版） | `60.3` / `8.37%` / `.340` / `0%` | `66.1` / `7.94%` / `.329` / `0%` | `51.8` / `7.50%` / `.348` / `0%` | `51.0` / `5.41%` / `.339` / `0%` | `59.5` / `3.40%` / `.351` / `1.04%` |
| `0.70 / 0.95 / e0`（前版） | `62.9` / `10.21%` / `.348` / `0%` | `68.6` / `9.76%` / `.336` / `0%` | `54.5` / `9.31%` / `.358` / `0%` | `55.8` / `6.99%` / `.348` / `0%` | `62.2` / `4.85%` / `.360` / `1.05%` |
| `0.75 / 0.95 / e0` | `63.6` / `11.02%` / `.347` / `0%` | `69.2` / `10.58%` / `.336` / `0%` | `55.2` / `10.11%` / `.357` / `0%` | `56.3` / `7.67%` / `.347` / `0%` | `63.1` / `5.43%` / `.359` / `1.05%` |
| **`B3: 0.35 / 0.50 / +0.35`** | **`63.1` / `8.57%` / `.331` / `0%`** | **`68.7` / `8.21%` / `.320` / `0%`** | **`54.7` / `7.69%` / `.341` / `0%`** | **`55.9` / `5.59%` / `.330` / `0%`** | **`62.5` / `3.49%` / `.343` / `1.08%`** |
| `B4: 0.45 / 0.55 / +0.30` | `63.6` / `9.48%` / `.332` / `0%` | `69.2` / `9.05%` / `.321` / `0%` | `55.4` / `8.52%` / `.342` / `0%` | `56.0` / `6.28%` / `.332` / `0%` | `63.2` / `4.07%` / `.344` / `1.07%` |
| `B2: 0.35 / 0.40 / +0.45` | `64.5` / `9.48%` / `.323` / `0.14%` | `70.0` / `9.02%` / `.312` / `0.08%` | `56.3` / `8.50%` / `.333` / `0%` | `57.3` / `6.27%` / `.324` / `0%` | `64.3` / `4.04%` / `.335` / `1.10%` |
| `C1: 0.00 / 0.00 / +0.90` | `70.2` / `15.44%` / `.282` / `0.83%` | `75.1` / `14.51%` / `.274` / `0.36%` | `62.7` / `13.44%` / `.288` / `0%` | `64.1` / `9.74%` / `.288` / `0%` | `72.2` / `6.87%` / `.292` / `1.29%` |

### 4.3 逐场景稳定性检验（`Genesis 5207`）

每格格式为：`P50` / `P95-P25` / `L* > 98%` / `Loc/Mac`。

| 样本 | `0.75 / 0.95 / e0` | **`B3 (0.35 / 0.50 / +0.35)`** | `B2 (0.35 / 0.40 / +0.45)` | `C1 (0.00 / 0.00 / +0.90)` |
| :--- | :--- | :--- | :--- | :--- |
| `S01`（室内弱光） | `47.0 / 58.5 / 0.00% / .508` | **`46.7 / 56.3 / 0.00% / .497`** | `45.6 / 57.5 / 0.14% / .493` | `43.4 / 59.5 / 0.44% / .470` |
| `S02`（地铁侧颜） | `19.4 / 69.5 / 0.00% / .308` | **`19.1 / 68.2 / 0.00% / .295`** | `17.3 / 69.5 / 0.00% / .286` | `10.9 / 74.4 / 0.00% / .244` |
| `S03`（地铁人像） | `25.3 / 68.5 / 0.00% / .358` | **`23.8 / 67.4 / 0.00% / .340`** | `21.4 / 68.9 / 0.00% / .330` | `12.1 / 74.8 / 0.83% / .279` |
| `S04`（10 档逆光） | `47.6 / 77.1 / 0.00% / .333` | **`43.3 / 78.7 / 0.00% / .312`** | `40.7 / 79.7 / 0.00% / .304` | `24.7 / 83.8 / 0.00% / .254` |
| `S05`（强光高楼） | `30.3 / 58.6 / 0.00% / .243` | **`26.8 / 59.8 / 0.00% / .224`** | `24.2 / 61.8 / 0.00% / .216` | `11.7 / 71.7 / 0.00% / .170` |
| `S06`（强光单车） | `44.1 / 57.9 / 0.00% / .418` | **`41.6 / 56.4 / 0.00% / .402`** | `39.5 / 57.9 / 0.00% / .394` | `30.8 / 63.1 / 0.00% / .349` |
| `S07`（蓝天街景） | `44.9 / 54.8 / 0.00% / .261` | **`41.7 / 54.8 / 0.00% / .247`** | `39.5 / 56.4 / 0.00% / .241` | `29.5 / 63.9 / 0.00% / .206` |

从图 1 与三张实测表可以看出，`B3`（`0.35 / 0.50 / +0.35 EV`）处在所有维度的帕累托拐点上：
- 相比扁平旧版 `0.35 / 0.70`，`EffGam` 从 `0.696` 回升至 `0.753`，5 个 LUT 的影调张力 `P95 - P25` 全面追平甚至略高于 `0.70 / 0.95`；
- 相比默认 `1.0 / 1.0`，`SpatialWarpEV` 下降 **39%**（`0.240 -> 0.147 EV`），`EDRMax` 提升 **+61%**（`1.94x -> 3.12x`），Track B 与 Dehancer 在全部 7 组场景中均实现 `0.00%` 高光硬裁（而 `B2` 在 `S01` 开始出现 `0.14%` 硬裁）；
- 深暗部死黑率较 `1.0 / 1.0` 削减 **43%–52%**，同时避免 `C1` 在强光逆光场景中灰塌陷的问题；
- Pre-LUT 彩度收敛在 `22.0`，把发色主导权完整交还给下游胶片 LUT。

---

## 5. 13 场景扩展验证与三级意图分级落地

首轮 7 组样本最低光照停留在 `EV100 = 4.7`（室内弱光），尚未覆盖高 ISO 真夜景、饱和色相恒定性压力测试以及无滤镜直出场景。第二轮将评测集扩充至 **13 组 48 MP ProRAW（`EV100 = 1.96–15.04`）**，新增 6 组边界样本：
- `S08`：真夜景天际线（`EV100 = 1.96`，ISO 1250）
- `S09`：蓝调夜景路灯（`EV100 = 4.02`）
- `S10`：人像肤色 + 高饱和大红马甲（`EV100 = 5.06`）
- `S11`：地铁拥挤人群（`EV100 = 6.23`）
- `S12`：MUJI 全光谱彩色笔架（`EV100 = 9.34`）
- `S13`：正午极限硬光商铺（`EV100 = 15.04`）

同时新增两项诊断指标：**饱和色相偏移（`HueDeg`）**与**暗部高频噪点（`ShNois`）**。

![图 2：13 场景扩展验证：B3-NightAdapt 的 C1 平滑过渡曲线与饱和色相偏移及暗部高频噪点对比](/images/blog/proraw_fig2_night_adapt_and_13scene.png)

| 13 场景 Pre-LUT 均值 | `EffGam` | `MidEV` | `WarpEV` | `EDRMax` | `P05 / P50 / P95` | `Loc/Mac` | `P90 C*` | `HueDeg` | `ShNois` |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `Default (1.00/1.00/e0)` | `0.919` | `+1.10` | `0.222` | `2.13x` | `4.8 / 39.0 / 78.4` | `0.380` | `27.5` | `2.22°` | `6.426` |
| `B3 (0.35/0.50/+0.35)` | `0.835` | `+1.07` | `0.128` | `4.08x` | `11.2 / 39.7 / 77.0` | `0.366` | `22.8` | `0.81°` | `4.979` |
| **`B3-NightAdapt`** | `0.836` | `+1.03` | **`0.126`** | **`4.14x`** | `11.1 / 39.4 / 76.4` | `0.366` | `22.7` | **`0.81°`** | **`4.949`** |
| **`Leica (0.55/0.55/+0.30)`** | `0.876` | `+1.00` | `0.144` | `3.69x` | `9.1 / 38.2 / 76.4` | `0.367` | `23.7` | `1.28°` | `5.047` |
| **`NoLUT-B (0.85/0.65/+0.25)`** | `0.945` | `+0.90` | `0.179` | `3.09x` | `5.3 / 36.0 / 75.6` | `0.370` | `25.4` | `1.98°` | `5.405` |

扩展实验揭示了三项必须靠分级策略才能同时解决的现象：

1. **高饱和色相恒定性优势明确**：在人像 + 大红马甲（`S10`）上，`Default` 产生 **3.92°** 色相漂移，而 `B3` 仅 **1.08°**（降幅 72%）；在 MUJI 全光谱彩色笔架（`S12`）上，`Default` 偏移 `2.13°`，`B3` 仅 `0.87°`。13 场景均值从 `2.22°` 降至 `0.81°`（-64%）。
2. **真夜景需要 `EV100` 自适应收敛（`B3-NightAdapt`）**：在 `S08`（`EV100 = 1.96`, ISO 1250）上，固定 `B3` 的 `+0.35 EV` 线性增益会把中灰推高至 `+0.61 EV`，使深邃夜空云层提灰。经 `EV100 ∈ [1.5, 5.0]` 的 $C^1$ 三次 Hermite smoothstep 收敛至 `ltm = 0.35, exp = +0.10 EV` 后，`S08` 的 `MidEV` 精准回到 `+0.24 EV`（贴合系统夜景意图），`WarpEV` 降至 `0.052`，`ShNois` 再降 10%（`3.268 -> 2.931`），且 `EV100 >= 5.0` 的全部白天与室内场景维持与原 `B3` 零差异。
3. **显示叠加 LUT 与无滤镜直出必须解耦**：
   - 无滤镜直出（`simulation == nil`）缺少下游胶片 S 曲线承接，若沿用 `B3` 会出现黑位偏灰（`P05 = 11.2`）的负片观感。改用 **`NoLUT-B`（`0.85 / 0.65 / +0.25 EV`）** 后，黑位回落至扎实的 `P05 = 5.3`，同时仍比 `Default` 减少 **19%** 空间 HDR 扭曲（`0.222 -> 0.179`）和 **16%** 暗部噪点（`6.426 -> 5.405`）。
   - 显示叠加类 LUT（Leica LUX，原型 III，$\gamma \approx 0.93\text{–}1.13$）改用 **`0.55 / 0.55 / +0.30 EV`**，将黑位从 `8.2` 收紧至 `6.5`，同时深暗死黑率仅 `6.52%`，不到系统默认 `12.19%` 的一半。

最终生产路由与平滑调度代码固化在无 UI 依赖的核心数学包中：

```swift
// Packages/EspressoCore/Sources/EspressoColor/Color/SceneRadiometryMath.swift
public static func resolveProRawToneParameters(
    intent: ProRawToneIntent,
    sceneEV100: Float?
) -> ProRawToneParameters {
    switch intent {
    case .unfiltered:
        return ProRawToneParameters(
            boostAmount: 0.85,
            localToneMapAmount: 0.65,
            exposureEV: 0.25
        )
    case .displayOverlay:
        return ProRawToneParameters(
            boostAmount: 0.55,
            localToneMapAmount: 0.55,
            exposureEV: 0.30
        )
    case .filmSimulation:
        guard let ev = sceneEV100, ev.isFinite else {
            return ProRawToneParameters(
                boostAmount: 0.35,
                localToneMapAmount: 0.50,
                exposureEV: 0.35
            )
        }
        let t = min(max((ev - 1.5) / 3.5, 0.0), 1.0)
        let w = t * t * (3.0 - 2.0 * t)
        let ltm = 0.35 + (0.50 - 0.35) * w
        let exp = 0.10 + (0.35 - 0.10) * w
        return ProRawToneParameters(
            boostAmount: 0.35,
            localToneMapAmount: ltm,
            exposureEV: exp
        )
    }
}
```

上游策略类 `ProRawDevelopmentStrategy.resolveToneIntent(for:)` 则只需三行映射即可完成解耦：`nil -> .unfiltered`、`.leica -> .displayOverlay`，其余胶片模拟统一路由至 `.filmSimulation`。

---

## 6. 工程边界与参考文献

这套标定策略也有明确边界：
- **依赖 EXIF 辐射度元数据**：`B3-NightAdapt` 通过 $EV_{100} = \log_2(N^2 / t) - \log_2(\text{ISO} / 100)$ 判定夜景，当外部导入 DNG 缺失光圈、快门或 ISO 任一字段时，代码安全回落至固定 `B3`（`0.35 / 0.50 / +0.35 EV`）。
- **单帧 Bayer RAW 不共享此套参数**：单帧 Bayer CFA RAW 不支持 `ProfileGainTableMap`（`isLocalToneMapSupported == false`），由独立的 `NativeBayerRawDevelopmentStrategy` 管理其噪声感知 `boost`（`0.12–0.25`）与暗部趾部偏置，不混用 ProRAW 的三级表。
- **不向 `CIRAWFilter.exposure` 注入用户 `ExposureBiasValue`**：硬件 AE 拍摄时已将曝光补偿落实在物理快门与 ISO 上，解码端若重复叠加会造成二次曝光偏移。

### 参考文献与标准

1. **Apple Inc. (WWDC21 Session 10160)** — *Capture and process ProRAW images*：ProRAW Linear DNG 架构、`BaselineExposure` 中灰锚定与 `CIRAWFilter` 线性提取规范。
2. **Apple Developer Documentation** — [`CIRAWFilter`](https://developer.apple.com/documentation/coreimage/cirawfilter)（`boostAmount`、`localToneMapAmount`、`extendedDynamicRangeAmount`、`isGamutMappingEnabled`）。
3. **Adobe Inc.** — *Digital Negative (DNG) Specification v1.6 (`ProfileGainTableMap`) & v1.7 / 1.7.1 (`ProfileGainTableMap2`, Tag `52544`)*：空间分区增益表的插值与超范围值（`> 1.0`）保留规范。
4. **AMPAS** — *ACES 2.0 Output Transform* & Hellwig, L., & Fairchild, M. D. (2022), *Brightness, lightness, colorfulness, and chroma in CIECAM02 and CAM16*, Color Research & Application。
5. **Hasinoff, S. W. et al. (ACM SIGGRAPH Asia 2016)** — *Burst photography for high dynamic range and low-light imaging on mobile cameras*：移动端多帧欠曝保高光与局部/全局色调压缩耦合机制。
6. **Paris, S., Hasinoff, S. W., & Kautz, J. (SIGGRAPH 2011)** / **Aubry, M. et al. (ACM TOG 2014)** — *Local Laplacian Filters*：多尺度局部动态范围压缩的细节保留与光晕边界。
7. **Yeganeh, H., & Wang, Z. (IEEE TIP 2013)** — *Objective Quality Assessment of Tone-Mapped Images (TMQI)*：色调映射结构保真与自然度客观评价框架。

---

## 常见问题（FAQ）

### 为什么把 CIRAWFilter 默认的 boost=1.0、ltm=1.0 直接送入胶片 3D LUT 会导致画面发闷和死黑？
默认配置面向即拍即用的 Smart HDR 观感，会在进 LUT 前施加 100% `ProfileGainTableMap` 局部提亮与全局显示级 S 曲线。实测在 7 组 48 MP ProRAW 样本上，该配置使 Pre-LUT 线性高光余量 `EDRMax` 压缩至 1.94x、空间扭曲 `SpatialWarpEV` 达 0.240 EV、高分位彩度 `P90 C*` 被硬推至 27.2；叠加内置 S 曲线的胶片 LUT 后触发双重压缩，`Genesis 5207` 与 `Fuji ClassicNeg` 的深暗死黑率（$L^* < 5$）分别达到 14.97% 与 14.63%。

### 降低 localToneMapAmount 后画面变暗、变平怎么办？为什么不能锁死 exposure=0？
Apple ProRAW 拍摄时会主动欠曝约 1.0 至 1.5 EV 以保护高光，再依赖局部增益表提亮中灰。如果锁死 `exposure=0` 仅调低 `boost`（如 `0.35 / 0.70`），有效伽马会跌至 0.696，抵消胶片 LUT 反差；同步拉高 `boost` 与 `ltm`（`0.75 / 0.95`）又会回到空间拍平与高光腰斩的死循环。破局做法是用纯线性标量曝光（`exposure = +0.35 EV`）补偿降 `ltm`（0.95 降至 0.50）减少的中灰亮度，零空间扭曲地恢复反差与 EDR 余量。

### B3-NightAdapt 为什么要按场景 EV100 在 [1.5, 5.0] 区间做平滑收敛？
在 `EV100 = 1.96`（ISO 1250）的真实夜景天际线上，固定 `B3`（`0.35 / 0.50 / +0.35 EV`）会把中灰增益推高至 +0.61 EV，导致夜空云层发灰并放大暗部噪点。在 `EV100 ∈ [1.5, 5.0]` 引入 $C^1$ 连续 Hermite smoothstep 将 `ltm` 收敛至 0.35、`exposure` 收敛至 +0.10 EV 后，夜景中灰回到 +0.24 EV、空间扭曲降至 0.052 EV、暗部高频噪点 `ShNois` 再降 10%，同时白天与常规室内（`EV100 >= 5.0`）保持与 `B3` 完全一致。

### 为什么 Espresso 要把 ProRAW 显影参数拆分为胶片模拟、显示叠加 LUT 与无滤镜直出三级策略？
三类下游消费者的传递曲线截然不同：ACEScct 与胶片印相 LUT 自带完整 S 曲线（$\gamma = 1.09\text{–}1.67$），需要克制的 `B3-NightAdapt` 光学负片；Leica LUX 等显示叠加 LUT 接近线性（$\gamma = 0.93\text{–}1.13$），需要 `0.55 / 0.55 / +0.30 EV` 补足基础黑位；无滤镜直出没有下游曲线接管反差，直接输出 `B3` 会显得黑位偏灰，因此使用 `NoLUT-B`（`0.85 / 0.65 / +0.25 EV`），在恢复扎实黑位（`P05 = 5.3`）的同时较系统默认减少 19% 空间 HDR 扭曲与 16% 暗部噪点。
