---
title: "胶片光学泛光（Bloom）架构解析：米氏散射建模、Metal 金字塔与 EDR 线性管线"
description: "解析 iOS 胶片相机 Espresso 的光学泛光（Bloom）架构：以 Cauchy-Lorentzian 幂律重尾复刻黑柔滤镜，在 Apple Silicon Metal 上构建 11 级 FP16 原地金字塔与 Bridge-Fine 混合，并论证 Pre-LUT EDR 场景线性管线的物理必要性。"
lang: "zh"
translationSlug: "film-bloom-optical-diffusion-architecture"
pubDate: 2026-11-27
project: "espresso"
tags: ["Color Science", "Metal", "Bloom", "ACES", "EDR", "Apple Silicon"]
readingTime: 13
coverImage: "/images/blog/bloom_fig1_psf_radial_decay.png"
coverAlt: "光学点扩散函数（PSF）径向衰减对比：Bridge-Fine 多尺度金字塔与单尺度高斯"
coverSpec: "FIG 01 · CAUCHY-LORENTZIAN PSF · 11-LEVEL FP16 METAL PYRAMID"
featured: true
faqs:
  - q: "为什么单尺度高斯模糊无法还原 Black Pro-Mist 等物理柔光滤镜的观感？"
    a: "单尺度高斯核在超过 3σ 后呈超指数断崖截断，在 48 MP 图像上大半径 1D 卷积不仅面临带宽瓶颈，视觉上还会呈现生硬的贴纸状光圈。物理柔光滤镜通过多尺度微粒的前向米氏散射，将能量拆分为保留焦平面锐度的弹道透射分量与呈 Cauchy-Lorentzian 幂律重尾的散射光晕，必须借助多八度金字塔混合才能复现。"
  - q: "Espresso 如何在 1512 px 预览、12 MP 与 48 MP 成片之间保持完全一致的泛光尺度？"
    a: "通过 Bridge-Fine 调度机制：每级等效全分辨率尺度经实测标定为 1.18 × 2^(k+1) px，同时设置最高 11 级自适应上限与 0.2% 短边相对细尺度下限（fineScaleFloorFraction = 0.002），将更细层级的权重置零。三种分辨率因此激活完全相同的相对八度频带，实测 90% 能量包围半径（EE90）占短边比例偏差为 0.00%，且 48 MP 成片在 L2 即可终止上采样，跳过 97.5 MB 半分辨率与 24 MB 四分之一分辨率写入。"
  - q: "如何在压制白衬衫等大面积漫反射白的同时，保留细小金属高光与大面积路灯的实心光晕？"
    a: "在 Pass 1 的 4×4 提取窗口内叠加三项正交机制：第一，用下端 C2 连续的非对称四次趾部曲线 t³(4 - 3t) 将漫反射白下沿杂散激发压低 38% 至 74%；第二，复用同一 4×4 窗口计算纯增量式微镜面显著度因子 1 + 0.35p²（零额外采样），只增强紧凑高光而不掏空大光源内部；第三，在场景线性路径使用归一化 Partial Karis Average，对孤立单像素火点施加超过 3.5 倍衰减，同时在均匀 HDR 光源上精确抵消权重以保留真实倍率。"
  - q: "为什么光学泛光必须放在 3D LUT 之前的 EDR 场景线性域执行？"
    a: "在物理光路中，镜头柔光散射发生在胶片感光与显影印相之前。前置到 Pre-LUT 场景线性域（.rgba16Float）后，散射光晕会与底图一起进入 3D LUT，自然继承胶片的肩部暖调与趾部色彩响应，并避免后级二次压缩。如果提前在 SDR [0, 1] 截断后再做泛光，会引发光源与白墙能级坍缩、亚像素波光湮灭、高饱和光源色相漂白以及平顶硬边光环四个物理退化。"
---

> **适用背景**：Espresso 色彩与光学管线（iOS 18.2+、Apple Silicon Metal Compute、Display P3 场景线性与暗房编辑）  
> **核心模块**：`BloomMath.swift`、`BloomShader.metal`、`MetalBloomEngine.swift`、`MetalOpticalEngine.swift`  
> **核心问题**：如何在不损伤焦平面发丝与肤色微对比度的前提下，用 Apple Silicon Metal 复现黑柔滤镜（Black Pro-Mist / CineBloom）的幂律重尾光晕，并在 1512 px 预览、12 MP 与 48 MP 成片间维持精确尺度不变？

## 核心结论（TL;DR）

Espresso 的光学泛光放弃单尺度高斯模糊，在 Metal Compute 上实现了一套**零 1D 高斯卷积、零 Ping-Pong 暂存纹理的自适应 11 级 FP16 原地金字塔**。借助 **Bridge-Fine 相对细尺度下限（`0.002`）**、**$\kappa = 0.78$ 各向同性 9-Tap 帐篷上采样**、**非对称四次高光趾部门控**与 **$C^1$ 反相能量门控 + 保色相标量软拐点**，管线在 1512 px、12 MP 与 48 MP 下的 EE90 占比偏差收敛至 **0.00%**，全预设中灰泄漏恒为 **0.000000**，$2\sigma$ 对角各向异性压低至 **+1.2%**，且在 48 MP 导出时直接省去 **121.5 MB** 高分辨率上采样写带宽。

---

## 1. 物理光学模型：前向米氏散射与重尾 PSF

许多移动端的“柔光滤镜”本质上是对高亮区做一次大半径高斯模糊再叠回原图，甚至顺手降低底图清晰度来模仿老镜头球差。Espresso 的产品边界截然不同：只模拟高解析度现代镜头搭配物理柔光滤镜（如 Tiffen Black Pro-Mist、Moment CineBloom）的微散射特性，拒绝廉价老旧硬件的全局散焦涂抹。

真实光学柔光滤镜在光学玻璃基质中悬浮粒径 $d \approx 5\text{–}30\,\mu\text{m}$ 的透明散射微粒与吸光碳黑微粒（粒径远大于可见光波长 $\lambda \approx 0.4\text{–}0.7\,\mu\text{m}$）。入射光波穿过介质时，总光通量分裂为两个空间正交的分量：

1. **零阶弹道透射分量（Ballistic Unscattered Transmission）**：占总透射能量的 85%–95%。这部分光线未与散射微粒发生碰撞，沿原几何光路成像，空间脉冲响应为狄拉克 $\delta(r)$ 函数。睫毛、发丝与织物纹理的高频 MTF50 保持率能超过 90%，物理根源就在这里。
2. **前向小角度米氏散射分量（Forward Mie Scattering Halo）**：占总透射能量的 5%–15%。受连续多尺度微粒粒径分布支配，散射光强随径向距离 $r$ 的衰减遵循 **Cauchy-Lorentzian（柯西-洛伦兹）幂律重尾分布**，而非在 $r > 3\sigma$ 处超指数断崖归零的单尺度高斯分布：

$$h_{\text{optical}}(r) = (1 - \alpha)\,\delta(r) + \alpha \, h_{\text{scatter}}(r), \quad h_{\text{scatter}}(r) \propto \frac{1}{\left(1 + (r / r_0)^2\right)^{\gamma}} \approx \sum_{k=1}^{K-1} W_k \, G(r;\,\sigma_k)$$

该点扩散函数（PSF）包含三层嵌套结构：
- **紧致亮核（Tight Core，$r \lesssim 8\text{ px}$）**：紧贴光源边缘的高梯度光晕，柔和亮部硬边界；
- **中程包络层（Mid-Range Mantle，$8\text{ px} \lesssim r \lesssim 25\text{ px}$）**：承载主体的彩色光晕扩散；
- **大气重尾层（Atmospheric Heavy Tail，$r \gtrsim 55\text{ px}$）**：以极低能量缓慢衰减的远端尾翼，形成空气包裹感（Atmospheric Veil）。

> **工程定位与 Trade-off**：严格物理散射模型（例如 Unreal Engine `Threshold = -1` 或能量守恒 `lerp` 模式）会对所有亮度执行无阈值线性散射，并从底图扣除 $(1 - \alpha)$ 的弹道能量。但在静态摄影与 SDR/混合暗房场景下，摄影师要求中灰肤色保留 100% 原始微反差且暗部不发灰。Espresso 因此采用**物理启发的感知近似模型**：空间 PSF 严格遵循多尺度能量守恒重尾卷积，提取阈值、微镜面显著度、反相核心门控与保色相软拐点则作为显式非线性感知算子独立控制。

---

## 2. Metal 计算管线：FP16 11 级原地金字塔与 Bridge-Fine 混合

在全分辨率图像上直接运行大半径可分离 1D 高斯卷积（例如 49-Tap 核）有两个硬伤：第一，截断半径上限仅 24 px，在 48 MP 图像上不足短边的 0.4%；第二，高能点光源会在核边界暴露盒状截断伪影，且显存读写带宽极高。

`BloomMath.swift`、`BloomShader.metal` 与 `MetalBloomEngine.swift` 联合构建了一套 4 Pass Compute 金字塔，全程无 1D 高斯核、无 Ping-Pong 暂存纹理：

```text
Input Texture (RAW Scene-Linear .rgba16Float / Display P3)
  │
  ├─► [Pass 1] bloomExtract / bloomExtractLinear (4x4 Tent -> L0, 1/2 Res)
  │     E_opt = max(Y_P3, peakRGB) | w = t^3(4 - 3t) | Normalized Karis + promBoost
  │
  ├─► [Pass 2] bloomDownsample13Tap (FP16 half3, L0 -> L1 -> ... -> L_{K-1})
  │     Ceil-division dimensions, adaptive up to 11 levels (12 MP / 48 MP full range)
  │
  ├─► [Pass 3] bloomUpsampleTent9TapInPlace (FP16 half3, κ = 0.78)
  │     c_k * L_k + h_k * Up(L_{k+1}), stops at outputLevelIndex (Bridge-Fine)
  │     48 MP stops at L2 (1/8 Res), 12 MP stops at L1 (1/4 Res), terminal Write-Only
  │
  └─► [Pass 4] bloomComposite / linearOpticsComposite / preLUTOpticsScatterComposite
        Bilinear sample outputLevel + C1 invGate + huePreservingSoftClip -> Output
```

在 Apple Silicon 上，Compute Pass 不经过 TBDR Tiler 与片上 Tile Memory，同时带 `.shaderWrite` 标志的纹理会关闭硬件无损压缩。为压低显存带宽与寄存器占用，管线落实了四项 Metal 工程实践：

1. **金字塔全链路原生 FP16**：下采样与上采样核全部使用 `half3` 与 `texture2d<half>`（仅纹理坐标保留 FP32 `float2`），精确匹配 `.rgba16Float` 纹理存储，寄存器压力减半并释放 2x FP16 ALU 吞吐。
2. **移除冗余全局纹理屏障**：依赖默认串行 `MTLComputeCommandEncoder` 与 `.tracked` 纹理的自动 Hazard Tracking，去掉手工插入的全局 `memoryBarrier(scope: .textures)`。
3. **规避 `.shared` 布局解压惩罚**：凡涉及 CPU 上传或读回的 `.shared` 纹理显式设置 `allowGPUOptimizedContents = false`。
4. **Bridge-Fine 提前终止上采样**：48 MP 下上采样止于 `L2`（1/8 分辨率），跳过 `L2 -> L1`（24 MB）与 `L1 -> L0`（97.5 MB）两级大尺寸写入，合计省去 121.5 MB 显存写带宽。

### 2.1 Pass 1：光学辐射能量与逐像素门控提取

传统 Bloom 常以 CIE 亮度 $Y = 0.2290 R + 0.6917 G + 0.0793 B$ 作为阈值输入。在 Display P3 下，满饱和纯红霓虹灯的亮度仅 $Y = 0.2290$，纯蓝霓虹灯仅 $Y = 0.0793$，单靠亮度阈值根本无法激发窄带彩色光源。

`BloomMath.opticalRadiantEnergy` 定义统一的光学辐射能量：

$$E_{\text{opt}}(R, G, B) = \max\left(Y_{\text{P3}},\, \max(R, G, B)\right)$$

宽光谱白光遵循光度学亮度积分，窄带高饱和单色光源则按峰值通道辐射强度公平触发。

空间降采样顺序同样关键。如果先对 $2 \times 2$ 像素求均值再过阈值，1 px 宽的远景路灯或金属反光点（$E = 1.0$）会被周围 3 个暗部像素（$E = 0.05$）拉低至 $0.287$，在阈值 $T = 0.75$ 下直接归零，并随取景器微动剧烈闪烁。`bloomExtract` 与 `bloomExtractLinear` 在 $4 \times 4$ 窗口内**先对 16 个源像素逐一计算阈值门控**，再以各向同性帐篷核 $[1, 2, 2, 1] \otimes [1, 2, 2, 1]$（权重和 36）写入半分辨率 `L0`。

### 2.2 Pass 2：Jimenez 13-Tap FP16 下采样与向上取整尺寸链

每一级下采样采用 Jorge Jimenez（SIGGRAPH 2014）的 13-Tap 双线性核，在原生 `half3` 精度下等价于 5 个重叠的 $2 \times 2$ 双线性块加权组合：4 个内层对角块（各 0.125）、4 个外层角点（各 0.03125）、4 个外层十字边点（各 0.0625）与 1 个中心点（0.125）。总能量严格守恒：

$$4 \times 0.125 + 4 \times 0.03125 + 4 \times 0.0625 + 1 \times 0.125 \equiv 1.000000$$

实测全链脉冲能量恒为 `1.00000`。

每一级纹理尺寸采用向上取整 $D_k = \max(1, \lfloor (D_{k-1} + 1) / 2 \rfloor)$，而非硬件 mipmap 默认的向下取整（floor）。奇数分辨率图像逐级向下取整会在右边界与下边界累积半像素截断偏移，这也是 `MetalBloomEngine` 分配独立 `.private` `MTLTexture` 数组（`mipmapped: false`）而非单张硬件 mipmapped 纹理的原因。

### 2.3 Pass 3：Bridge-Fine 尺度不变混合与各向同性 9-Tap 帐篷上采样

要让 1512 px 暗房预览、12 MP（短边 3024 px）与 48 MP（短边 6048 px）呈现完全一致的光晕比例，单纯把目标半径 $\sigma_{\text{target}}$ 设为短边百分比还不够。如果细尺度端固定从 `L1` 开始加权，48 MP 相比 1512 px 会额外混入更靠近源像素的超高频八度，拉紧光晕核心并改变整体轮廓。

实测标定这套 13-Tap + 9-Tap 级联链在第 $k$ 级的等效全分辨率标准差为 $\sigma_k \approx 1.18 \cdot 2^{k+1}\text{ px}$。`BloomMath.pyramidSchedule` 同时约束两头：
- **粗尺度上限**：自适应最高 `maxPyramidLevels = 11` 级，截止于 $10 \times \sigma_{\text{target}}$；
- **细尺度下限（Bridge-Fine）**：设定 `fineScaleFloorFraction = 0.002`，凡 $\sigma_k < 0.2\% \times \text{shortSide}$ 的极细层级一律置 $W_k = 0$。

设首个非零权重层级为 $k_{\text{first}}$，上采样只需回推至 `outputLevelIndex` $= k_{\text{first}} - 1$ 即可结束。该输出层自身 $W = 0$，对应的凸组合系数自动退化为 $c = 0,\; h = 1$，在着色器中命中 Write-Only 快速路径，无需读取目标层旧值。这一设计同时保证了 100% 的辉光能量至少经历一次 13-Tap 下采样与一次 9-Tap 上采样，杜绝未卷积像素的锯齿泄漏。

对于有效加权层级 $k \in \{k_{\text{first}}, \dots, K - 1\}$，非对称洛伦兹包络锚定在核心比 $u_0 = 0.35$，再通过自顶向下累积和 $S_k = \sum_{j=k}^{K-1} W_j$ 转换为原地凸组合系数：

$$x_k = \frac{\sigma_k / \sigma_{\text{target}}}{0.35}, \quad \tilde{W}_k = \frac{x_k^{1.20}}{\left(1 + x_k^{1.60}\right)^{1.85 - 0.25 d}}, \quad W_k = \frac{\tilde{W}_k}{\sum_{j} \tilde{W}_j}$$

$$c_k = \frac{W_k}{S_k}, \quad h_k = \frac{S_{k+1}}{S_k}, \quad c_k + h_k \equiv 1.000$$

原地更新时，`bloomUpsampleTent9TapInPlace` 仅从跨层的 `higherLevel` 做邻域采样，对 `targetLevel` 只在当前线程坐标 `gid` 读写一次，从而零竞态、零暂存纹理完成整条上采样链。

另一个容易被忽略的几何伪影来自标准可分离 9-Tap 帐篷核。二维旋转各向同性的四阶矩判据要求 $E[x^4] = 3 E[x^2 y^2]$。标准可分离核（角点位于 $\pm 1.0$）经多级级联后，实测 $2\sigma$ 处 $45^\circ$ 对角线亮度比轴向高出 **+8.4%**（四阶矩比仅 `0.922`），点光源光晕会隐约呈现菱形或星芒方格。将 4 个角点采样坐标径向收缩至 $\kappa = 0.78$ 且维持 `1:2:4` 能量守恒权重后，四阶各向同性提升至 **0.972**，$1\sigma$ 对角/轴向比达到 **1.000**，$2\sigma$ 处压低至 **1.012**（+1.2%）：

```cpp
// Espresso/Infrastructure/Edit/BloomShader.metal
inline half3 bloom_sample_isotropic_tent9(
    texture2d<half, access::sample> higherLevel,
    float2 uv,
    float radius
) {
    constexpr sampler linearSampler(coord::normalized, address::clamp_to_edge, filter::linear);
    constexpr float corner = 0.78f;
    float2 texelSize = (1.0f / float2(higherLevel.get_width(), higherLevel.get_height())) * radius;

    return (
        higherLevel.sample(linearSampler, uv + float2(-corner, -corner) * texelSize).rgb +
        higherLevel.sample(linearSampler, uv + float2(   0.0f,   -1.0f) * texelSize).rgb * 2.0h +
        higherLevel.sample(linearSampler, uv + float2( corner, -corner) * texelSize).rgb +
        higherLevel.sample(linearSampler, uv + float2(  -1.0f,    0.0f) * texelSize).rgb * 2.0h +
        higherLevel.sample(linearSampler, uv + float2(   0.0f,    0.0f) * texelSize).rgb * 4.0h +
        higherLevel.sample(linearSampler, uv + float2(   1.0f,    0.0f) * texelSize).rgb * 2.0h +
        higherLevel.sample(linearSampler, uv + float2(-corner,  corner) * texelSize).rgb +
        higherLevel.sample(linearSampler, uv + float2(   0.0f,    1.0f) * texelSize).rgb * 2.0h +
        higherLevel.sample(linearSampler, uv + float2( corner,  corner) * texelSize).rgb
    ) * 0.0625h;
}
```

### 2.4 Pass 4：$C^1$ 反相能量门控与保色相标量软拐点

将辉光直接叠加到已经高亮的光源中心会冲毁灯泡钨丝或霓虹灯管文字细节。合成阶段按当前像素的基准光学能量 $E_{\text{opt}}$ 与高光保护系数 $s_{\text{save}} \in [0, 1]$ 计算 $e_s = E_{\text{opt}} \cdot s_{\text{save}}$，通过分段线性-有理双曲门控衰减核心叠加量：

$$g_{\text{inv}}(e_s) = \begin{cases} 1 - e_s, & 0 \le e_s \le 0.80 \\ \dfrac{0.04}{e_s - 0.60}, & e_s > 0.80 \end{cases}$$

在衔接点 $e_s = 0.80$ 处，左右函数值均为 $0.20$，左右一阶导数均为 $-1.0$。严格的 $C^1$ 连续性既保留了 SDR 区间的线性直觉，又在 $E_{\text{opt}} > 1.0$ 的 EDR 超白光源内部维持平滑渐近的正向残余增益，避免 `max(0, 1 - e_s)` 硬截断在光源核心形成 $C^0$ 环带或暗核反转。

叠加增量 $\boldsymbol{\Delta}$ 后，传统逐通道软裁切会强力压缩高能主通道（如暖黄灯光中的 $R$）而放过次通道（$G, B$），直接扭曲 $\Delta R : \Delta G : \Delta B$ 比例，诱发阿布尼效应（暖黄高光偏青或褪为死白），在底图峰值本身高于拐点时还可能把像素压得比原图更暗。`BloomMath.huePreservingSoftClip` 改为只对标量峰值增量 $\Delta_{\text{peak}} = P_{\text{raw}} - P_{\text{base}}$ 在拐点 $k = 0.82$ 之上做有理压缩，再以同一标量比例 $s = \tilde{\Delta}_{\text{peak}} / \Delta_{\text{peak}} \in [0, 1]$ 等比缩放三通道增量：

```swift
// Packages/EspressoCore/Sources/EspressoColor/Optics/BloomMath.swift
public static func huePreservingSoftClip(
    base: SIMD3<Double>,
    delta: SIMD3<Double>,
    knee: Double = 0.82
) -> SIMD3<Double> {
    let safeBase = SIMD3<Double>(max(0.0, base.x), max(0.0, base.y), max(0.0, base.z))
    let safeDelta = SIMD3<Double>(max(0.0, delta.x), max(0.0, delta.y), max(0.0, delta.z))
    let basePeak = max(safeBase.x, max(safeBase.y, safeBase.z))
    let rawResult = safeBase + safeDelta
    let rawPeak = max(rawResult.x, max(rawResult.y, rawResult.z))
    let deltaPeak = rawPeak - basePeak
    guard deltaPeak > 1.0e-7 else { return safeBase }

    let clippedDeltaPeak: Double
    if rawPeak <= knee {
        clippedDeltaPeak = deltaPeak
    } else if basePeak < knee {
        let linearPart = knee - basePeak
        let excess = rawPeak - knee
        let headroom = max(1.0 - knee, 0.04)
        clippedDeltaPeak = linearPart + excess / (1.0 + excess / headroom)
    } else {
        let headroom = max(1.0 - basePeak, 0.04)
        clippedDeltaPeak = deltaPeak / (1.0 + deltaPeak / headroom)
    }

    let scale = max(0.0, min(1.0, clippedDeltaPeak / deltaPeak))
    return safeBase + safeDelta * scale
}
```

这种标量缩放从代数上锁定两条硬性质：增量通道比严格不变（色相偏移 $\Delta h = 0.000^\circ$），且任意通道恒满足 $C_{\text{out}, c} \ge C_{\text{base}, c}$。

---

## 3. 区分漫反射白、镜面高光与直接光源

在 SDR 或轻度压缩图像中，高亮区域混杂着三类物理性质迥异的辐射源，单纯依赖像素亮度阈值会出现两难：阈值压低会把阳光下的白衬衫晕成一团白雾，阈值拉高又会把水面波光与金属反光全部抹掉。

| 辐射源类别 | 物理反射 / 辐射机制 | 场景线性辐射能量 $E_{\text{linear}}$ | SDR $[0, 1]$ 编码能量 | 空间几何与梯度特征 | 目标光学响应 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **朗伯漫反射白**（白墙、白衬衫、白云） | 朗伯漫反射（反照率 $\rho \le 0.90$） | $0.65\text{–}0.88$ | $0.80\text{–}0.94$ | 大面积连续分布，$E_{\text{core}} \approx E_{\text{ring}}$ | 极低或零泛光，防止白色衣物发雾 |
| **次光源镜面反射**（金属高光、波光、眼神光） | 菲涅尔 / 微表面定向反射 | $0.85\text{–}6.0+$ | $0.88\text{–}1.00$（受抗锯齿稀释） | 尺度紧凑（1–4 px），$E_{\text{core}} \gg E_{\text{ring}}$ | 明确激发，保留微高光通透感 |
| **直接发光体**（路灯、车灯、霓虹灯管） | 自发光辐射，无反照率上限 | $0.92\text{–}16.0+$ | $0.95\text{–}1.00$ | 2–200 px 不等，边缘梯度高、内部均匀 | 饱满实心的多尺度光晕，绝不空心 |

Espresso 在不新增 Render Pass、不增加一次纹理采样的约束下，用三项正交机制解开这一矛盾。

### 3.1 非对称四次高光趾部门控

Pass 1 将提取门控从对称三次 Hermite 曲线 $t^2(3 - 2t)$ 替换为非对称四次高光趾部曲线（代码沿用 `hermiteWeight` 函数名以保持接口兼容）：

$$w_{\text{spec}}(t) = t^3(4 - 3t) = 4t^3 - 3t^4, \quad t = \operatorname{clamp}\left(\frac{E_{\text{opt}} - T}{\Delta T},\, 0.0,\, 1.0\right)$$

下界 $t = 0$ 满足 $w(0) = w'(0) = w''(0) = 0$（$C^2$ 连续，二阶曲率为零），在过渡区下沿形成平坦的抑制趾部；上界 $t = 1$ 满足 $w(1) = 1,\; w'(1) = 0$（$C^1$ 连续），平顺饱和至满激发。对比两条曲线在各归一化位置的权重差异：

| 归一化位置 $t = (E - T) / \Delta T$ | 典型场景对象 | 传统三次 $t^2(3 - 2t)$ | 四次趾部 $t^3(4 - 3t)$ | 杂散激发压制率 |
| :---: | :--- | :---: | :---: | :---: |
| $0.00$ | 中灰与人物肤色（$E \le T$） | `0.0000` | `0.0000` | 100% 免疫 |
| $0.20$ | 室内白墙 / 纸张 | `0.1040` | `0.0272` | -73.8% |
| $0.25$ | 晴天顺光白衬衫 | `0.1563` | `0.0508` | -67.5% |
| $0.35$ | 亮面墙体 / 白云 | `0.2818` | `0.1265` | -55.1% |
| $0.50$ | 过渡区中点 | `0.5000` | `0.3125` | -37.5% |
| $0.85$ | 次光源镜面反光 / 灯罩边缘 | `0.9393` | `0.8905` | -5.2%（维持高响应） |
| $1.00$ | 直接发光体核心 / 强镜面高光 | `1.0000` | `1.0000` | 0.0%（满激发） |

### 3.2 零额外带宽的纯增量微镜面显著度

用局部高通滤波区分漫反射白与镜面高光时，有一个常见陷阱：如果采用减法式权重 $\max(0, E_{\text{core}} - E_{\text{ring}})$，直径 20–200 px 的路灯、车灯或宽幅霓虹灯管内部处处满足 $E_{\text{core}} \approx E_{\text{ring}}$，整个光源中心会被掏空，退化为只有 1 px 外壳发光的空心圆环，且同一盏灯在 12 MP 与 48 MP 下的空心比例还会随像素尺寸漂移。

因此，空间对比度项必须严格限制为**纯增量（$g_{\text{prom}} \ge 1.0$）**。`bloomExtract` 与 `bloomExtractLinear` 在原本就已读取的 $4 \times 4$ 窗口中，直接累加中心 $2 \times 2$ 均值 $E_{\text{core}}$ 与外圈 12 像素均值 $E_{\text{ring}}$：

$$p = \operatorname{clamp}\left(E_{\text{core}} - E_{\text{ring}},\, 0.0,\, 1.0\right), \qquad g_{\text{prom}}(p) = 1.0 + 0.35 \, p^2 \in [1.00,\, 1.35]$$

额外纹理采样数为 0，仅在寄存器循环里多做两次加法，三类目标的行为自然分化：
- **大面积漫反射白**：内部平坦，$p = 0 \implies g_{\text{prom}} = 1.0$，无任何加成，继续由四次趾部压制 38%–74%；
- **大面积直接发光体**：内部保持 $g_{\text{prom}} = 1.0$（实心无空洞），仅光源与暗夜交界边缘获得 +20% 至 +35% 散射激励；
- **紧凑镜面高光**：高光落在中心 1–2 px、周围 12 像素偏暗，$p \approx 0.80 \implies g_{\text{prom}} \approx 1.22\text{–}1.35\times$，补偿抗锯齿带来的峰值稀释。

### 3.3 场景线性归一化 Partial Karis Average

在 RAW / ProRAW 场景线性核 `bloomExtractLinear` 中，采用 Jimenez（SIGGRAPH 2014）的归一化 Partial Karis Average：

$$k_w(E_{\text{opt}}) = \frac{1.0}{1.0 + 0.25 \cdot \max(E_{\text{opt}} - 1.0,\, 0.0)}, \qquad \mathbf{L}_0 = \frac{\sum_{i=1}^{16} \mathbf{c}_i \cdot g_i \cdot k_{w,i} w_{\text{tent},i}}{\sum_{i=1}^{16} k_{w,i} w_{\text{tent},i}}$$

分母除以实际权重和 $\sum k_{w,i} w_{\text{tent},i}$ 而非常数 36，原因很直接：面对大面积均匀 HDR 光源（如 $E = 16$ 的车灯），窗口内 16 个像素的 $k_w$ 相等，在分子分母间精确抵消，100% 保留物理辐射倍率；面对周围 15 像素为常规亮度（$k_w = 1$）的孤立单像素超白火点（Firefly），$k_w$ 会大幅拉低该点权重，实测抑制倍率超过 **3.5x**。

---

## 4. 量化契约验证与四组光学诊断图

Espresso 色彩管线执行“数据未验证则改动不可信”的测试门槛。Bloom 模块配套了纯 Swift 数学契约测试（`OpticsMathTests`）、Metal GPU 硬件单测（`BloomTests`、`MetalOpticalEngineTests`）以及与着色器公式逐行对齐的 Python 光学仿真脚本，全部验收指标如下：

| 校验维度 | 测试载体 | 核心验收指标 | 实测结果 |
| :--- | :--- | :--- | :--- |
| **滤波器能量守恒** | `OpticsMathTests` | 13-Tap 与 9-Tap 权重和误差、全链脉冲能量 | $< 1.0 \times 10^{-9}$（脉冲能量 `1.00000`） |
| **跨分辨率 EE50 / EE90 尺度不变** | `OpticsMathTests` | 1512 px、12 MP（3024 px）、48 MP（6048 px）能量包围半径占比差 | EE90 偏差 **0.00%**（全档位 `< 0.002`） |
| **Bridge-Fine 零权重契约** | `OpticsMathTests` | 输出层 $W_{\text{out}} \equiv 0.0$、终步 $c_{\text{out}} = 0, h_{\text{out}} = 1$、48 MP `outputLevelIndex >= 2` | 100% 满足 |
| **归一化 Karis Average** | `OpticsMathTests` | 均匀 $E = 16$ 面光源保真；孤立 1 px $E = 16$ 火点抑制 | 面光源保留 `16.0`；火点抑制 $> 3.5\times$ |
| **中灰与肤色零污染** | `OpticsMathTests` | 全预设区间（`threshold >= 0.40`，即 $T \ge 0.66$）在 $E \in [0.12, 0.65]$ 的激发权重 | 恒等于 `0.000000` |
| **$C^1$ 反相门控连续性** | `OpticsMathTests` | $e_s = 0.80$ 处左右函数值差与一阶导数差 | 值差 $< 2 \times 10^{-5}$，导数差 $< 10^{-3}$ |
| **保色相软拐点与正交性** | `OpticsMathTests` / `MetalOpticalEngineTests` | 超拐点通道比 $\Delta R' / \Delta G'$ 偏差；EDR 琥珀高光 `(3.2, 1.8, 0.4)` 不漂白 | 通道比偏差 $< 10^{-9}$；不退化为死白 |
| **GPU 径向单调衰减** | `BloomTests` | 点光源 $r \in \{0, 2, 4, 8, 16, 24\}\text{ px}$ 径向梯度 $\Delta I(r)$ | 严格单调非增，无振铃 |
| **GPU 圆对称各向同性** | `BloomTests` | 轴向 $r = 10\text{ px}$ 与对角线 $r \approx 9.9\text{ px}$ 亮度差 | 轴向差 $\le 2 / 255$，轴向/对角差 $\le 6 / 255$（$2\sigma$ 比 `1.012`） |
| **GPU 点光源与面光源抗空心** | `BloomTests` | $1 \times 1$ 点光源邻域激发；$24 \times 24$ 面光源中心 vs 内缘亮度 | 1 px 邻域显著激发；面光源中心 $\ge$ 内缘 |

### 4.1 光学点扩散函数径向衰减

![图 1：光学点扩散函数（PSF）径向衰减对比：Bridge-Fine 多尺度金字塔与单尺度高斯](/images/blog/bloom_fig1_psf_radial_decay.png)

左图线性坐标显示，生产金字塔（蓝线）从中心 $(r = 0, h = 1.0)$ 圆滑过渡，由于 Bridge-Fine 置零了未卷积的 `L0` 权重并锚定 $u_0 = 0.35$，早期混入 `L0` 时在 $r = 5\text{ px}$ 附近出现的斜率折角已彻底消失；单尺度高斯（红虚线）则在 $r \approx 15\text{ px}$ 处急速归零。

右图半对数 $\log_{10}$ 坐标把尾翼差异拉开：单尺度高斯 $\log_{10}(e^{-r^2 / 2\sigma^2}) \propto -r^2$ 呈向下弯曲的抛物线，很快跌入 $10^{-4}$ 噪底；多尺度金字塔依次跨过 Core、Mantle 与 Atmospheric Tail 三个区域。在双对数 log-log 坐标下，$r \in [\sigma_t / 4,\, 2\sigma_t]$ 区间实测斜率为 $-2.1 \to -3.2$，超出最高八度后再自然过渡到高斯截断（图示为 256 px 合成点源，实际 12 MP / 48 MP 成片按短边等比缩放）。

### 4.2 刀口阶跃响应与高光核心保护

![图 2：刀口阶跃响应（Knife-Edge Step Response）与高光核心保护剖面](/images/blog/bloom_fig2_knife_edge_profile.png)

实验在 $X = 0$ 处构造从左侧深暗部（0.05 sRGB）到右侧高亮区（0.88 sRGB）的高反差刀口边界。在右侧高光内部（$X > 0$），旧版方案（橙虚线）缺少精确的反相能量压制，亮区整体上冲，实拍中容易冲白灯牌文字；生产方案（蓝实线）借由 $C^1$ 反相门控与保色相软拐点把高光核心过冲压回可控区间。在左侧暗部溢光区（$X < 0$），蓝线从边界向外展开 50 px 的多尺度渐进溢光，到 $X \le -60\text{ px}$ 处准确回落到 0.05 原始黑位，远端暗部无黑位抬升。

### 4.3 阈值传递函数与中灰免疫区

![图 3：阈值传递函数对比：非对称四次高光趾部曲线与中灰零污染保护区](/images/blog/bloom_fig3_threshold_midtone_protection.png)

金色阴影标出的 $E \in [0.12, 0.65]$ 对应人像肤色（$E \approx 0.25\text{–}0.45$）与场景中灰。旧版分段线性斜坡（洋红虚线）在阈值下方仍有泄漏，导致画面像蒙上一层白雾；四次趾部曲线（绿实线）在 $E \le 0.80$ 全程恒为 `0.000`。进入 $E \in [0.80, 0.88]$ 的漫反射白区间后，对比对称三次 Hermite（灰点线），绿线平坦的二阶零曲率趾部将杂散激发压低 38%–68%，同时在 $E \ge 0.92$ 处平滑收敛到 1.0 满激发。

### 4.4 三类光学场景渲染与差分热力图

![图 4：夜间路灯、高饱和霓虹灯管与逆光窗格的光学泛光对比与差分热力图](/images/blog/bloom_fig4_visual_renderings.png)

三组合成场景覆盖了最容易暴露算法缺陷的极端工况：
1. **夜间路灯**：生产渲染（第 3 列）在保持灯芯明亮的同时形成由浓转淡的同心圆晕染；第 4 列差分热力图（`Max Delta: 0.41`）呈正圆对称，验证了 $\kappa = 0.78$ 角点收缩消除了十字 / 方格伪影。
2. **高饱和霓虹灯管**：青色与品红灯管周围呈现饱和彩色光晕，灯管内部色彩未向死白漂移（保色相软拐点），灯管中心紧实无空洞（纯增量显著度 $g_{\text{prom}} \ge 1.0$）。
3. **逆光高反差窗格**：亮窗光线沿 20 px 宽的十字窗棂边缘形成柔光绕射包裹，窗棂实体结构仍保持分明边界（`Max Delta: 0.55`）。

将上述实测指标与单尺度高斯、真实物理柔光滤镜并排对照：

| 光学特性维度 | 单尺度高斯模糊 | 物理柔光滤镜（Black Pro-Mist / CineBloom） | Espresso 11 级 FP16 金字塔 Bloom |
| :--- | :--- | :--- | :--- |
| **中灰 / 肤色锐度** | 阈值泄漏或全局模糊损伤微纹理 | 弹道透射 $\delta(r)$ 保留焦平面绝大部分细节 | `threshold >= 0.40` 全预设下 $E \le 0.65$ 零泄漏，`microcontrastDamp = 0.0` |
| **PSF 形态** | $r > 3\sigma$ 断崖截断 | 紧致亮核 + 宽广重尾光晕 | Bridge-Fine 非对称洛伦兹，跨分辨率 EE90 偏差 `0.00%` |
| **高光核心与黑位** | 亮部易冲白或暗部发灰 | 碳黑微粒吸收远端杂散光，暗部保持通透 | $C^1$ 反相门控 + 四次趾部，Knife-Edge 远端无黑位抬升 |
| **旋转各向同性** | 可分离帐篷核 $2\sigma$ 对角偏高 +8.4% | 随机微粒天然圆对称 | $\kappa = 0.78$ 收缩，$1\sigma$ 比 `1.000`，$2\sigma$ 仅 `+1.2%` |
| **高饱和色相稳定** | 逐通道软裁切诱发色相漂移 | 光子线性叠加不改变波长 | 标量峰值软拐点，通道比偏差 $< 10^{-9}$ |

*注：图库暗房的离线无 Metal 回退路径（`UIImage+Bloom.swift`）采用 CoreImage 单尺度高斯，仅作设备兼容兜底，不具备多尺度重尾特征。*

---

## 5. 管线拓扑位置与未开启 EDR 的四个退化

真实胶片摄影的物理光路顺序不可逆：**场景光子 → 镜头柔光滤镜（Bloom 散射）→ 胶片感光乳剂与背反射层（Halation 红晕与潜影）→ 显影印相非线性响应（3D LUT / AgX 色调映射）→ 显示器 OETF 编码**。

遵循 ACES 2.0 场景线性与显示呈现严格解耦的原则，Espresso 维护两条清晰的光学处理路径：

```text
[1. 相机成片与 RAW 显影管线 (Scene-Referred Pre-LUT)]
Bayer RAW / Apple ProRAW (BaselineExposure 锚定 18% 中灰)
  --> RawDevelopEngine (.rgba16Float, 保留 EDR > 1.0)
  --> 场景线性 Display P3
  --> bloomExtractLinear (Normalized Karis, kw 系数 0.25) + 11 级原地金字塔
  --> preLUTOpticsScatterComposite (Halation + Bloom 线性叠加)
  --> 3D 胶片冲印 LUT (Track A: Linear P3 / Track B: ACEScct AP1)
  --> srgb_encode_oetf + Display P3 --> HEIC / JPEG

[2. 图库暗房后期编辑管线 (Gallery Darkroom Editor)]
已保存静态图像
  --> bloom_srgb_decode 还原至线性 Display P3
  --> MetalOpticalEngine / MetalBloomEngine (四次趾部 + 微镜面显著度)
  --> C1 反相门控 + huePreservingSoftClip
  --> bloom_srgb_encode --> 暗房输出
```

把 Bloom 放在 **Pre-LUT 场景线性域（`preLUTOpticsScatterComposite`）** 带来两个直接收益：
1. **光晕继承胶片色彩科学**：散射到暗部与中灰过渡区的辉光光子会连同底图一起进入下游 3D LUT。套用 Kodak Portra 或 Fujifilm Classic Neg 模拟时，光晕亮核与暗尾自然带上对应胶片的肩部暖调与趾部色偏，而非浮在画面表面的数码白雾。
2. **杜绝 Double Compression**：线性散射完成后统一交由胶片 LUT 处理最终高光滚降，避免后级重复叠加色调压缩导致高光泛白。

一旦输入被提前压平或硬裁切到 8-bit SDR $[0.0, 1.0]$（未开启 `.rgba16Float` EDR 超白动态范围），光学泛光会出现四个不可逆的物理退化：

1. **高光能级坍缩（Radiometric Energy Collapse）**：真实阳光下白衬衫的线性反射率约 $E \approx 0.85$，汽车大灯或水面太阳反光可达 $E \approx 4.0\text{–}16.0$（高出 +2.2 至 +4.2 EV）。SDR 截断把 $E = 0.95$ 的白墙和 $E = 12.0$ 的车灯一并拍扁进 `[0.95, 1.00]`。原本 12 倍的散射通量差距消失，车灯泛光要么微弱无力，要么为救车灯压低阈值而让整片白墙发雾。
2. **亚像素微高光湮灭（Sub-Pixel Specular Annihilation）**：远景水面波光或珠宝切面常只占单个像素的 $1 / 8$ 立体角，但真实辐射度高达 $E_{\text{true}} = 8.0$。EDR 线性积分后像素能量为 $\frac{1}{8} \times 8.0 = 1.00 > T$，可正常激发星芒；一旦前端先把峰值钳位到 1.0，再经抗锯齿或 $2 \times 2$ 降采样稀释为 $0.25 \ll T$，整片水面波光就会彻底消失。这也是 SDR 图库路径必须引入“逐像素门控先于 $4 \times 4$ 积分”和微镜面显著度 $g_{\text{prom}}$ 做补偿的原因。
3. **高饱和光源色相漂白（Chromatic Bleaching）**：暖黄钨丝路灯在线性域的 RGB 为 $[3.2,\, 1.8,\, 0.4]$，通道比 $R : G : B = 8 : 4.5 : 1$。SDR 硬裁切将其截断为 $[1.0,\, 1.0,\, 0.4]$，红绿比从 `1.78:1` 坍缩为 `1:1`，醇厚琥珀瞬间退化为柠檬死白，扩散出的整圈光晕也跟着失去暖调色彩。
4. **平顶硬边光环（Hard-Clipped Plateau Halo）**：真实点光源在传感器上呈中心 $E = 10.0$ 向边缘 $E = 1.0$ 陡降的尖峰，卷积后由内向外自然涌出渐变光晕。SDR 截断把 $E \in [1.0, 10.0]$ 整段削成一块平顶 `1.0` 台地，卷积平顶方波只会在几何边缘产生阶跃溢光，视觉上像在死白圆盘外贴了一圈生硬光环。

> **SDR 图库路径的当前边界**：纯 8-bit SDR 图库文件经 `bloom_srgb_decode` 还原后仍属于已色调映射的显示线性域（$E \le 1.0$），唯有 RAW / ProRAW 路径具备完整场景线性动态范围。对于含增益图的 iPhone HEIC 照片，后续可通过 iOS 18 原生 `CIImageOption.expandToHDR: true`（ISO 21496-1）在暗房编辑器中还原 $> 1.0$ 线性高光，彻底补齐后期路径的 EDR 动态范围。

---

## 6. 架构速查与工程边界

| 架构模块 | 核心数学模型与实现 | 解决的具体问题 | 代码锚点 |
| :--- | :--- | :--- | :--- |
| **辐射能量度量** | $E_{\text{opt}} = \max(Y_{\text{P3}}, \max(R, G, B))$ | 窄带纯红 / 纯蓝霓虹灯因 CIE $Y$ 权重低无法激发 | `BloomMath.swift` |
| **阈值提取门控** | $w_{\text{spec}}(t) = t^3(4 - 3t)$（下端 $C^2$、上端 $C^1$） | 100% 保护中灰肤色，漫反射白下沿杂散激发降 38%–74% | `BloomMath.swift` |
| **显著度与 Karis** | $g_{\text{prom}} = 1 + 0.35 p^2$ + 归一化 Partial Karis | 补足细小镜面高光且不掏空大光源；保 HDR 倍率并抑 1 px 火点 | `BloomShader.metal` |
| **多尺度下采样链** | 最高 11 级向上取整尺寸 + FP16 Jimenez 13-Tap | 零 1D 高斯，脉冲能量 `1.00000`，规避奇数尺寸半像素裁切 | `BloomShader.metal` |
| **权重与原地融合** | Bridge-Fine（`0.002`）洛伦兹 + FP16 9-Tap（$\kappa = 0.78$） | 跨分辨率 EE90 偏差 `0.00%`，$2\sigma$ 各向异性 `+1.2%`，48 MP 省 121.5 MB 写带宽 | `BloomMath.swift` |
| **高光保护与合成** | $C^1$ 线性-双曲反相门控 + 标量峰值软拐点 | 消除 EDR 核心 $C^0$ 断层与死白漂白，保持增量色相恒定 | `BloomMath.swift` |

这套架构的设计取舍很明确：它以略微复杂的金字塔调度逻辑（向上取整独立纹理池、Bridge-Fine 动态止步与逐层凸组合递推）换取了跨分辨率严格尺度不变、高分辨率显著更低的写带宽，以及对中灰肤色与高光色相的可量化保护。如果你的应用仅面向固定低分辨率实时 UI 模糊，标准 4 级 mipmap 足够胜任；一旦涉及 12 MP / 48 MP 静态摄影与 Pre-LUT EDR 胶片管线，本文中的尺度不变调度、非对称四次趾部与保色相软拐点则是避开“塑料光圈”与“白衬衫发雾”的必要基础设施。

---

## 常见问题（FAQ）

### 为什么单尺度高斯模糊无法还原 Black Pro-Mist 等物理柔光滤镜的观感？
单尺度高斯核在超过 3σ 后呈超指数断崖截断，在 48 MP 图像上大半径 1D 卷积不仅面临带宽瓶颈，视觉上还会呈现生硬的贴纸状光圈。物理柔光滤镜通过多尺度微粒的前向米氏散射，将能量拆分为保留焦平面锐度的弹道透射分量与呈 Cauchy-Lorentzian 幂律重尾的散射光晕，必须借助多八度金字塔混合才能复现。

### Espresso 如何在 1512 px 预览、12 MP 与 48 MP 成片之间保持完全一致的泛光尺度？
通过 Bridge-Fine 调度机制：每级等效全分辨率尺度经实测标定为 1.18 × 2^(k+1) px，同时设置最高 11 级自适应上限与 0.2% 短边相对细尺度下限（`fineScaleFloorFraction = 0.002`），将更细层级的权重置零。三种分辨率因此激活完全相同的相对八度频带，实测 90% 能量包围半径（EE90）占短边比例偏差为 0.00%，且 48 MP 成片在 L2 即可终止上采样，跳过 97.5 MB 半分辨率与 24 MB 四分之一分辨率写入。

### 如何在压制白衬衫等大面积漫反射白的同时，保留细小金属高光与大面积路灯的实心光晕？
在 Pass 1 的 4×4 提取窗口内叠加三项正交机制：第一，用下端 C2 连续的非对称四次趾部曲线 t³(4 - 3t) 将漫反射白下沿杂散激发压低 38% 至 74%；第二，复用同一 4×4 窗口计算纯增量式微镜面显著度因子 1 + 0.35p²（零额外采样），只增强紧凑高光而不掏空大光源内部；第三，在场景线性路径使用归一化 Partial Karis Average，对孤立单像素火点施加超过 3.5 倍衰减，同时在均匀 HDR 光源上精确抵消权重以保留真实倍率。

### 为什么光学泛光必须放在 3D LUT 之前的 EDR 场景线性域执行？
在物理光路中，镜头柔光散射发生在胶片感光与显影印相之前。前置到 Pre-LUT 场景线性域（`.rgba16Float`）后，散射光晕会与底图一起进入 3D LUT，自然继承胶片的肩部暖调与趾部色彩响应，并避免后级二次压缩。如果提前在 SDR [0, 1] 截断后再做泛光，会引发光源与白墙能级坍缩、亚像素波光湮灭、高饱和光源色相漂白以及平顶硬边光环四个物理退化。
