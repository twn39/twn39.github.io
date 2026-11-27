---
title: "Film Bloom Optical Diffusion Architecture: Mie Scattering, Metal Pyramids & Pre-LUT EDR Pipelines"
description: "Inside Espresso's optical bloom architecture on Apple Silicon Metal: modeling Cauchy-Lorentzian heavy-tail PSF from forward Mie scattering, an adaptive 11-level FP16 in-place pyramid with Bridge-Fine scale invariance, and why bloom belongs in the Pre-LUT scene-referred EDR domain."
lang: "en"
translationSlug: "film-bloom-optical-diffusion-architecture"
pubDate: 2026-11-27
project: "espresso"
tags: ["Color Science", "Metal", "Bloom", "ACES", "EDR", "Apple Silicon"]
readingTime: 13
coverImage: "/images/blog/bloom_fig1_psf_radial_decay.png"
coverAlt: "Optical Point Spread Function (PSF) radial decay comparison: Bridge-Fine multi-scale pyramid vs. single-scale Gaussian"
coverSpec: "FIG 01 · CAUCHY-LORENTZIAN PSF · 11-LEVEL FP16 METAL PYRAMID"
featured: true
faqs:
  - q: "Why can't a single-scale Gaussian blur replicate physical diffusion filters like Black Pro-Mist?"
    a: "A single Gaussian kernel drops super-exponentially past 3σ, producing harsh sticker-like halos while hitting severe bandwidth limits on 48 MP stills. Physical diffusion filters rely on forward Mie scattering across multi-scale particulates, splitting light into a sharp ballistic Dirac delta transmission and a Cauchy-Lorentzian heavy-tail halo that requires a multi-octave pyramid to reproduce."
  - q: "How does Espresso maintain identical bloom scale across 1512 px previews, 12 MP, and 48 MP captures?"
    a: "Through Bridge-Fine scheduling: each pyramid level's measured full-resolution equivalent sigma is 1.18 × 2^(k+1) px. Combining an adaptive 11-level ceiling with a 0.2% short-side fine-scale floor (fineScaleFloorFraction = 0.002) zeroes ultra-fine weights so all three resolutions activate the exact same relative octave band. Measured 90% encircled energy radius (EE90) drift is 0.00%, and 48 MP exports stop upsampling at L2—skipping 97.5 MB (half-res) and 24 MB (quarter-res) writes."
  - q: "How does the pipeline suppress diffuse white shirts while keeping micro-specular glints bright and large lights solid?"
    a: "Pass 1 combines three orthogonal mechanisms inside the existing 4×4 extraction footprint: an asymmetric quartic specular-toe gate t³(4 - 3t) (C2 at the lower toe) cuts diffuse-white leakage by 38%–74%; an additive-only micro-specular prominence factor 1 + 0.35p² (zero extra texture reads) lifts compact glints without hollowing out large lamps; and normalized Partial Karis Average in scene-linear mode suppresses isolated 1 px fireflies by >3.5× while canceling identically across uniform HDR emitters."
  - q: "Why must optical bloom run in the Pre-LUT scene-referred EDR domain rather than after SDR tone mapping?"
    a: "Physically, lens filter diffusion occurs before film exposure and print development. Running bloom in Pre-LUT .rgba16Float linear space lets scattered glow pass through the 3D LUT alongside the base image, inheriting authentic film shoulder/toe color response without Double Compression. Clipping to SDR [0, 1] first causes radiometric energy collapse, sub-pixel specular annihilation, chromatic hue bleaching, and hard-clipped plateau halos."
---

> **Context**: Espresso Color & Optics Pipeline (iOS 18.2+, Apple Silicon Metal Compute, Scene-Referred Display P3 & Darkroom Editor)  
> **Core Modules**: `BloomMath.swift`, `BloomShader.metal`, `MetalBloomEngine.swift`, `MetalOpticalEngine.swift`  
> **Core Question**: How do you reproduce the heavy-tail optical veil of physical black-mist diffusion filters (Black Pro-Mist / CineBloom) on Apple Silicon Metal without softening focal-plane hair or skin microcontrast, while keeping halo scale strictly invariant from 1512 px previews to 48 MP RAW exports?

## TL;DR: Key Takeaways

Espresso replaces single-scale Gaussian blur with an **adaptive 11-level FP16 in-place Metal compute pyramid** featuring zero 1D Gaussian passes and zero ping-pong scratch textures. Pairing **Bridge-Fine relative fine-scale cutoff (`0.002`)**, **$\kappa = 0.78$ isotropic 9-tap tent upsampling**, an **asymmetric quartic specular-toe gate**, and **$C^1$ inverted energy gating + hue-preserving scalar soft clipping** yields **0.00%** cross-resolution EE90 drift across 1512 px / 12 MP / 48 MP, **0.000000** midtone leakage across all presets, **+1.2%** diagonal anisotropy at $2\sigma$, and **121.5 MB** saved upsample write bandwidth at 48 MP.

---

## 1. Optical Physics: Forward Mie Scattering & Heavy-Tail PSF

Many mobile diffusion effects blur highlights with a single Gaussian pass or deliberately soften base acutance to imitate vintage lens spherical aberration. Espresso draws a strict engineering boundary: replicate modern high-resolution glass paired with physical optical diffusion filters (Tiffen Black Pro-Mist, Moment CineBloom) while rejecting artificial lens degradation.

A real optical diffusion filter suspends micron-scale transparent scattering particulates ($d \approx 5\text{–}30\,\mu\text{m}$, much larger than visible wavelengths $\lambda \approx 0.4\text{–}0.7\,\mu\text{m}$) alongside light-absorbing black carbon flecks inside clear glass. Incident light splits into two spatially orthogonal components:

1. **Ballistic Unscattered Transmission (85%–95% of energy)**: Photons pass through without colliding with particulates, preserving the geometric optical path as a Dirac $\delta(r)$ impulse. That is why eyelashes, hair, and fabric maintain >90% high-frequency MTF50 sharpness.
2. **Forward Small-Angle Mie Scattering Halo (5%–15% of energy)**: Driven by a continuous multi-scale particulate distribution, radial intensity decay follows a **Cauchy-Lorentzian heavy-tail power law** rather than a single Gaussian ($e^{-r^2 / 2\sigma^2}$ collapses super-exponentially past $3\sigma$ into a plastic sticker halo):

$$h_{\text{optical}}(r) = (1 - \alpha)\,\delta(r) + \alpha \, h_{\text{scatter}}(r), \quad h_{\text{scatter}}(r) \propto \frac{1}{\left(1 + (r / r_0)^2\right)^{\gamma}} \approx \sum_{k=1}^{K-1} W_k \, G(r;\,\sigma_k)$$

This point spread function (PSF) exhibits three nested regimes:
- **Tight Core ($r \lesssim 8\text{ px}$)**: Steep halo hugging highlight boundaries to soften harsh digital edges;
- **Mid-Range Mantle ($8\text{ px} \lesssim r \lesssim 25\text{ px}$)**: Primary chromatic glow spread;
- **Atmospheric Heavy Tail ($r \gtrsim 55\text{ px}$)**: Low-energy outer veil decaying gradually across the frame.

> **Engineering Scope & Trade-off**: Strictly physical scattering (e.g., Unreal Engine `Threshold = -1` or energy-conserving `lerp` scatter) scatters every luminance level without a threshold and deducts $(1 - \alpha)$ ballistic energy from the base image. In still photography and SDR/hybrid darkroom editing, photographers expect skin midtones to keep 100% original microcontrast and shadows to remain clear. Espresso therefore uses a **physics-inspired perceptual approximation**: the spatial PSF strictly obeys energy-conserving multi-scale heavy-tail convolution, while extraction thresholding, micro-specular prominence, inverted core gating, and hue-preserving soft clipping act as explicit perceptual operators.

---

## 2. Metal Compute Architecture: Adaptive 11-Level FP16 In-Place Pyramid

Running large separable 1D Gaussian kernels (e.g., 49-tap) at full resolution hits two hard walls: truncation radius tops out at 24 px (<0.4% of the short side on a 48 MP image), and bright point sources expose boxy cutoff artifacts at high memory bandwidth cost.

`BloomMath.swift`, `BloomShader.metal`, and `MetalBloomEngine.swift` implement a 4-pass Metal compute pyramid with zero 1D Gaussian passes and zero ping-pong scratch buffers:

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

On Apple Silicon, Compute Passes bypass the TBDR tiler and on-chip Tile Memory, and `.shaderWrite` disables lossless hardware texture compression. To keep memory bandwidth and register pressure low without adding render-pass complexity, the engine applies four Metal practices:

1. **Native FP16 Pyramid Arithmetic**: Both downsample and upsample kernels operate in `half3` / `texture2d<half>` (keeping texture coordinates in FP32 `float2`), matching `.rgba16Float` storage to halve register pressure and unlock 2x FP16 ALU throughput.
2. **Zero Redundant Global Barriers**: Relying on a default serial `MTLComputeCommandEncoder` and `.tracked` texture hazard tracking removes manual `memoryBarrier(scope: .textures)` stalls.
3. **No `.shared` Layout Decompression Tax**: Any `.shared` texture used for CPU upload/readback explicitly sets `allowGPUOptimizedContents = false`.
4. **Bridge-Fine Early Upsample Stop**: At 48 MP, upsampling terminates at `L2` (1/8 resolution), skipping `L2 -> L1` (24 MB) and `L1 -> L0` (97.5 MB)—saving 121.5 MB of high-resolution write traffic.

### 2.1 Pass 1: Optical Radiant Energy & Per-Pixel Gated Extraction

Traditional bloom gates exclusively on CIE luminance $Y = 0.2290 R + 0.6917 G + 0.0793 B$. In Display P3, a fully saturated red neon sign registers only $Y = 0.2290$ and pure blue only $Y = 0.0793$, starving narrowband emitters regardless of threshold.

`BloomMath.opticalRadiantEnergy` unifies broadband luminance and narrowband peak radiance:

$$E_{\text{opt}}(R, G, B) = \max\left(Y_{\text{P3}},\, \max(R, G, B)\right)$$

Order of operations matters just as much. Averaging a $2 \times 2$ block before thresholding drags a 1 px distant streetlight or metallic glint ($E = 1.0$) flanked by three dark pixels ($E = 0.05$) down to $0.287$—eliminating it completely under $T = 0.75$ and causing severe temporal shimmer. `bloomExtract` and `bloomExtractLinear` evaluate the threshold gate **independently on all 16 source pixels** inside a $4 \times 4$ window before integrating with the isotropic $[1, 2, 2, 1] \otimes [1, 2, 2, 1]$ tent kernel (sum = 36) directly into half-resolution `L0`.

### 2.2 Pass 2: Jimenez 13-Tap FP16 Downsample & Ceil-Division Chain

Each downsample pass runs Jorge Jimenez's (SIGGRAPH 2014) 13-tap bilinear kernel in native `half3`, equivalent to five overlapping $2 \times 2$ bilinear boxes: 4 inner diagonal taps (0.125 each), 4 outer corners (0.03125 each), 4 outer cross taps (0.0625 each), and 1 center tap (0.125). Energy conservation is exact:

$$4 \times 0.125 + 4 \times 0.03125 + 4 \times 0.0625 + 1 \times 0.125 \equiv 1.000000$$

Measured full-chain impulse energy is `1.00000`.

Dimensions follow ceiling division $D_k = \max(1, \lfloor (D_{k-1} + 1) / 2 \rfloor)$ rather than hardware mipmap floor division. Floor division on odd dimensions accumulates half-texel truncation along the right and bottom borders, which is why `MetalBloomEngine` allocates an explicit array of `.private` `MTLTexture` levels (`mipmapped: false`).

### 2.3 Pass 3: Bridge-Fine Scale-Invariant Mixing & Isotropic 9-Tap Tent Upsample

Scaling $\sigma_{\text{target}}$ with the image short side alone does not guarantee cross-resolution parity. If fine octaves always start at `L1`, a 48 MP export mixes much finer high-frequency octaves than a 1512 px preview, tightening the core and altering halo shape.

Empirically, the 13-tap + 9-tap chain exhibits an effective full-resolution standard deviation of $\sigma_k \approx 1.18 \cdot 2^{k+1}\text{ px}$ per level. `BloomMath.pyramidSchedule` bounds both ends:
- **Coarse ceiling**: Adaptive up to `maxPyramidLevels = 11`, stopping past $10 \times \sigma_{\text{target}}$;
- **Fine floor (Bridge-Fine)**: With `fineScaleFloorFraction = 0.002`, any ultra-fine level satisfying $\sigma_k < 0.2\% \times \text{shortSide}$ receives $W_k = 0$.

Let $k_{\text{first}}$ be the finest level with non-zero weight. Upsampling stops at `outputLevelIndex` $= k_{\text{first}} - 1$. Because $W_{\text{out}} = 0$, the terminal blend step resolves to $c = 0,\; h = 1$ and takes a write-only fast path without reading the target texture. Every weighted octave is guaranteed at least one 13-tap downsample and one 9-tap tent upsample, eliminating unconvolved aliasing.

For active weighted levels $k \in \{k_{\text{first}}, \dots, K - 1\}$, asymmetric Lorentzian weights anchored at $u_0 = 0.35$ convert via top-down cumulative sums $S_k = \sum_{j=k}^{K-1} W_j$ into in-place convex blend coefficients:

$$x_k = \frac{\sigma_k / \sigma_{\text{target}}}{0.35}, \quad \tilde{W}_k = \frac{x_k^{1.20}}{\left(1 + x_k^{1.60}\right)^{1.85 - 0.25 d}}, \quad W_k = \frac{\tilde{W}_k}{\sum_{j} \tilde{W}_j}$$

$$c_k = \frac{W_k}{S_k}, \quad h_k = \frac{S_{k+1}}{S_k}, \quad c_k + h_k \equiv 1.000$$

Because `bloomUpsampleTent9TapInPlace` samples only the disjoint `higherLevel` neighborhood and reads/writes `targetLevel` strictly at `gid`, the entire upsample chain runs in place with zero race conditions and zero scratch textures.

A standard separable 9-tap tent kernel ($\kappa = 1.0$) also introduces subtle geometric anisotropy. True 2D rotational isotropy requires the fourth-moment identity $E[x^4] = 3 E[x^2 y^2]$. Cascading a standard separable tent produces a **+8.4%** intensity excess along the $45^\circ$ diagonal at $2\sigma$ (moment ratio `0.922`), creating faint diamond halos around point lights. Contracting the four corner offsets radially to $\kappa = 0.78$ while keeping the energy-conserving `1:2:4` weights raises the fourth-moment isotropy ratio to **0.972**, bringing diagonal/axial parity to **1.000** at $1\sigma$ and **1.012** (+1.2%) at $2\sigma$:

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

### 2.4 Pass 4: $C^1$ Inverted Energy Gating & Hue-Preserving Scalar Soft Clip

Adding unfiltered glow directly onto bright emitter cores washes out bulb filaments and neon lettering. Pass 4 computes scaled radiant energy $e_s = E_{\text{opt}} \cdot s_{\text{save}}$ ($s_{\text{save}} \in [0, 1]$) and attenuates core addition with a piecewise linear-to-hyperbolic gate:

$$g_{\text{inv}}(e_s) = \begin{cases} 1 - e_s, & 0 \le e_s \le 0.80 \\ \dfrac{0.04}{e_s - 0.60}, & e_s > 0.80 \end{cases}$$

At the junction $e_s = 0.80$, both sides equal $0.20$ and both first derivatives equal $-1.0$. Strict $C^1$ continuity preserves intuitive linear control across SDR while providing a positive asymptotic tail inside super-luminous ($E_{\text{opt}} > 1.0$) EDR emitters—eliminating $C^0$ clamping rings or dark core inversions.

When compositing additive glow $\boldsymbol{\Delta}$, naive per-channel soft clipping compresses the dominant channel (e.g., $R$ in warm tungsten) while leaving secondary channels ($G, B$) untouched, distorting $\Delta R : \Delta G : \Delta B$ into Abney hue shifts (amber shifting toward pale lemon/white) and even darkening pixels when `basePeak > knee`. `BloomMath.huePreservingSoftClip` instead compresses only the scalar peak increment $\Delta_{\text{peak}} = P_{\text{raw}} - P_{\text{base}}$ above knee $k = 0.82$, then multiplies all three delta channels by the same scalar factor $s = \tilde{\Delta}_{\text{peak}} / \Delta_{\text{peak}} \in [0, 1]$:

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

This guarantees exact chromatic ratio preservation ($\Delta h = 0.000^\circ$) and strict channel monotonicity ($C_{\text{out}, c} \ge C_{\text{base}, c}$).

---

## 3. Separating Diffuse White, Secondary Speculars & Direct Emitters

In SDR or mildly compressed photography, bright pixels come from three physically distinct radiator classes that overlap heavily in scalar brightness:

| Radiator Class | Physical Mechanism | Scene-Linear Radiance $E_{\text{linear}}$ | SDR $[0, 1]$ Encoded | Spatial & Gradient Signature | Desired Optical Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Lambertian Diffuse White** (white walls, shirts, clouds) | Lambertian diffuse reflection (albedo $\rho \le 0.90$) | $0.65\text{–}0.88$ | $0.80\text{–}0.94$ | Large continuous region, $E_{\text{core}} \approx E_{\text{ring}}$ | Minimal or zero bloom; no white-shirt fogging |
| **Secondary Specular** (metal glints, water sparkles, catchlights) | Fresnel / microfacet directional reflection | $0.85\text{–}6.0+$ | $0.88\text{–}1.00$ (diluted by AA) | Compact (1–4 px), $E_{\text{core}} \gg E_{\text{ring}}$ | Crisp, responsive micro-bloom |
| **Direct Emitter** (streetlights, headlights, neon tubes) | Self-luminous radiator (unbounded albedo) | $0.92\text{–}16.0+$ | $0.95\text{–}1.00$ | 2–200 px, high border gradient, uniform interior | Full solid multi-scale halo; zero hollowing |

Without adding any render pass or extra texture reads, Pass 1 separates these three classes via three orthogonal mechanisms.

### 3.1 Asymmetric Quartic Specular-Toe Gate

Pass 1 upgrades the symmetric cubic Hermite curve $t^2(3 - 2t)$ to an asymmetric quartic specular-toe polynomial (retaining the `hermiteWeight` symbol for call-site compatibility):

$$w_{\text{spec}}(t) = t^3(4 - 3t) = 4t^3 - 3t^4, \quad t = \operatorname{clamp}\left(\frac{E_{\text{opt}} - T}{\Delta T},\, 0.0,\, 1.0\right)$$

At the lower boundary $t = 0$, $w(0) = w'(0) = w''(0) = 0$ ($C^2$ continuous with zero curvature), forming a flat suppression toe across diffuse white surfaces. At $t = 1$, $w(1) = 1,\; w'(1) = 0$ ($C^1$ continuous), saturating smoothly for real emitters:

| Normalized Position $t = (E - T) / \Delta T$ | Typical Scene Subject | Cubic $t^2(3 - 2t)$ | Quartic Toe $t^3(4 - 3t)$ | Leakage Reduction |
| :---: | :--- | :---: | :---: | :---: |
| $0.00$ | Midtones & skin tones ($E \le T$) | `0.0000` | `0.0000` | 100% immune |
| $0.20$ | Indoor white wall / paper | `0.1040` | `0.0272` | -73.8% |
| $0.25$ | Sunlit white shirt | `0.1563` | `0.0508` | -67.5% |
| $0.35$ | Bright wall / sunlit clouds | `0.2818` | `0.1265` | -55.1% |
| $0.50$ | Transition midpoint | `0.5000` | `0.3125` | -37.5% |
| $0.85$ | Secondary specular / lamp shade edge | `0.9393` | `0.8905` | -5.2% (high response kept) |
| $1.00$ | Direct emitter core / strong specular | `1.0000` | `1.0000` | 0.0% (full excitation) |

### 3.2 Zero-Bandwidth Additive Micro-Specular Prominence

A common pitfall when using local high-pass filters to reject diffuse white is applying a subtractive weight like $\max(0, E_{\text{core}} - E_{\text{ring}})$. Inside a 20–200 px streetlight, headlight, or wide neon tube, $E_{\text{core}} \approx E_{\text{ring}}$ everywhere—hollowing out the entire interior into a 1 px bright shell ("hollow donut ring") whose ring width even shifts between 12 MP and 48 MP.

Local spatial contrast must therefore be **strictly additive ($g_{\text{prom}} \ge 1.0$)**. Reusing the 16 samples already loaded in the $4 \times 4$ Pass 1 window, the kernel averages the inner $2 \times 2$ core ($E_{\text{core}}$) against the outer 12-pixel ring ($E_{\text{ring}}$):

$$p = \operatorname{clamp}\left(E_{\text{core}} - E_{\text{ring}},\, 0.0,\, 1.0\right), \qquad g_{\text{prom}}(p) = 1.0 + 0.35 \, p^2 \in [1.00,\, 1.35]$$

At zero extra texture reads, each radiator behaves cleanly:
- **Large diffuse white**: Flat interior ($p = 0 \implies g_{\text{prom}} = 1.0$), no boost, still suppressed 38%–74% by the quartic toe;
- **Large direct emitters**: Solid interior ($g_{\text{prom}} = 1.0$, zero hollowing), plus +20% to +35% edge scatter lift along high-contrast night borders;
- **Compact specular glints**: Concentrated in the center 1–2 px against a darker surround ($p \approx 0.80 \implies g_{\text{prom}} \approx 1.22\text{–}1.35\times$), compensating for anti-aliasing dilution.

### 3.3 Scene-Linear Normalized Partial Karis Average

In `bloomExtractLinear` (RAW / ProRAW scene-referred path), Espresso applies Jimenez's (SIGGRAPH 2014) normalized Partial Karis Average:

$$k_w(E_{\text{opt}}) = \frac{1.0}{1.0 + 0.25 \cdot \max(E_{\text{opt}} - 1.0,\, 0.0)}, \qquad \mathbf{L}_0 = \frac{\sum_{i=1}^{16} \mathbf{c}_i \cdot g_i \cdot k_{w,i} w_{\text{tent},i}}{\sum_{i=1}^{16} k_{w,i} w_{\text{tent},i}}$$

Dividing by the actual weight sum $\sum k_{w,i} w_{\text{tent},i}$ instead of constant 36 ensures that across uniform large HDR emitters (such as an $E = 16$ headlight), $k_w$ cancels identically between numerator and denominator—preserving 100% of physical radiance ratios—while isolated single-pixel super-luminous fireflies (surrounded by 15 pixels with $k_w = 1$) are attenuated by **>3.5x**.

---

## 4. Quantitative Verification & Four Diagnostic Plots

Every optical pipeline change in Espresso is gated by three automated verification layers: pure-Swift math contracts (`OpticsMathTests`), Metal GPU execution tests (`BloomTests`, `MetalOpticalEngineTests`), and a synchronized Python optical verification suite.

| Verification Dimension | Test Suite | Acceptance Metric | Measured Result |
| :--- | :--- | :--- | :--- |
| **Filter Energy Conservation** | `OpticsMathTests` | 13-tap & 9-tap weight sum error; full-chain impulse sum | $< 1.0 \times 10^{-9}$ (impulse `1.00000`) |
| **Cross-Resolution EE50 / EE90** | `OpticsMathTests` | Encircled energy radius fraction delta across 1512 px, 12 MP, 48 MP | EE90 drift **0.00%** (all presets `< 0.002`) |
| **Bridge-Fine Zero-Weight Contract** | `OpticsMathTests` | $W_{\text{out}} \equiv 0.0$, terminal $c_{\text{out}} = 0, h_{\text{out}} = 1$, 48 MP `outputLevelIndex >= 2` | 100% satisfied |
| **Normalized Karis Average** | `OpticsMathTests` | Uniform $E = 16$ area emitter fidelity; isolated 1 px $E = 16$ firefly attenuation | Area emitter exact `16.0`; firefly suppressed $> 3.5\times$ |
| **Midtone & Skin Zero Leakage** | `OpticsMathTests` | Excitation weight across $E \in [0.12, 0.65]$ for all presets (`threshold >= 0.40`, $T \ge 0.66$) | Strictly `0.000000` |
| **$C^1$ Inverted Gate Continuity** | `OpticsMathTests` | Value & first-derivative gap across $e_s = 0.80$ | Value gap $< 2 \times 10^{-5}$, slope gap $< 10^{-3}$ |
| **Hue-Preserving Clip & Orthogonality** | `OpticsMathTests` / `MetalOpticalEngineTests` | Above-knee $\Delta R' / \Delta G'$ ratio drift; EDR amber `(3.2, 1.8, 0.4)` stability | Ratio drift $< 10^{-9}$; zero white bleaching |
| **GPU Radial Monotonicity** | `BloomTests` | Point-source radial gradient $\Delta I(r)$ at $r \in \{0, 2, 4, 8, 16, 24\}\text{ px}$ | Strictly non-increasing, zero ringing |
| **GPU Circular Isotropy** | `BloomTests` | Axial $r = 10\text{ px}$ vs. diagonal $r \approx 9.9\text{ px}$ luminance difference | Axial $\le 2 / 255$, axial vs. diagonal $\le 6 / 255$ ($2\sigma$ ratio `1.012`) |
| **GPU Sub-Block Point & Solid Area** | `BloomTests` | $1 \times 1$ point-source spill; $24 \times 24$ area center vs. inner rim | 1 px spill active; center $\ge$ inner rim (no hollowing) |

### 4.1 Optical PSF Radial Decay

![Figure 1: Optical Point Spread Function (PSF) radial decay comparison: Bridge-Fine multi-scale pyramid vs. single-scale Gaussian](/images/blog/bloom_fig1_psf_radial_decay.png)

In the linear-scale profile (left), the production Bridge-Fine pyramid (solid blue) transitions smoothly from $(r = 0, h = 1.0)$. Zeroing unconvolved `L0` and anchoring at $u_0 = 0.35$ removes the $r = 5\text{ px}$ slope kink seen when mixing `L0` directly, whereas the single-scale Gaussian (dashed red) collapses to zero near $r \approx 15\text{ px}$.

In the semi-log $\log_{10}$ profile (right), the single Gaussian follows a downward parabola ($\propto -r^2$) straight into the $10^{-4}$ noise floor. The multi-scale pyramid spans the Core, Mantle, and Atmospheric Tail regimes cleanly; in log-log coordinates, measured slope across $r \in [\sigma_t / 4,\, 2\sigma_t]$ runs from $-2.1$ to $-3.2$ before tapering naturally beyond the coarsest octave (plotted on a 256 px synthetic impulse; 12 MP / 48 MP captures scale proportionally with the short side).

### 4.2 Knife-Edge Step Response & Highlight Core Protection

![Figure 2: Knife-Edge Step Response and highlight core protection profile](/images/blog/bloom_fig2_knife_edge_profile.png)

Across a high-contrast step from deep shadow (0.05 sRGB) to bright highlight (0.88 sRGB) at $X = 0$, the legacy bloom (dashed orange) overshoots inside the bright half ($X > 0$), washing out neon signage or bulb filaments in real photographs. The production pipeline (solid blue) suppresses internal overshoot via $C^1$ inverted gating and scalar soft clipping while extending a 50 px multi-scale optical spill into the dark side ($X < 0$), converging back to exact `0.05` black floor by $X \le -60\text{ px}$ with zero shadow lift.

### 4.3 Threshold Transfer Function & Midtone Immunity

![Figure 3: Threshold transfer function comparison: asymmetric quartic specular-toe curve and midtone zero-leakage zone](/images/blog/bloom_fig3_threshold_midtone_protection.png)

The shaded $E \in [0.12, 0.65]$ band covers human skin tones ($E \approx 0.25\text{–}0.45$) and scene midtones. Where the legacy piecewise linear ramp (dashed magenta) leaks energy into midtones and fogs portraits, the quartic toe curve (solid green) stays strictly at `0.000` through $E \le 0.80$. Inside the diffuse-white band $E \in [0.80, 0.88]$, its flat zero-curvature toe suppresses stray excitation by 38%–68% relative to symmetric cubic Hermite (dotted gray) while climbing smoothly to full `1.0` excitation at $E \ge 0.92$.

### 4.4 Visual Renderings & Difference Heatmaps

![Figure 4: Visual renderings and difference heatmaps across night streetlight, saturated neon tubes, and backlit window scenarios](/images/blog/bloom_fig4_visual_renderings.png)

1. **Night Streetlight**: The production render (column 3) keeps the lamp core defined while building a layered atmospheric halo; the difference heatmap (column 4, `Max Delta: 0.41`) forms concentric circles, confirming $\kappa = 0.78$ eliminates cross/diamond anisotropy.
2. **Saturated Neon Tubes**: Cyan and magenta tubes radiate rich chromatic halos without bleaching internal tube color (hue-preserving soft clip) or hollowing out the core (additive-only prominence $g_{\text{prom}} \ge 1.0$).
3. **Backlit High-Contrast Window**: Bright window light wraps gently around the 20 px dark mullions (`Max Delta: 0.55`) without washing away the structural silhouette.

Side-by-side comparison against single-scale Gaussian blur and physical glass diffusion filters:

| Optical Property | Single-Scale Gaussian | Physical Diffusion Filter (Black Pro-Mist / CineBloom) | Espresso 11-Level FP16 Pyramid Bloom |
| :--- | :--- | :--- | :--- |
| **Midtone / Skin Sharpness** | Threshold leakage or global softening degrades fine detail | Ballistic $\delta(r)$ preserves most focal-plane acutance | Zero leakage for $E \le 0.65$ across all presets (`threshold >= 0.40`), `microcontrastDamp = 0.0` |
| **PSF Shape** | Hard drop past $r > 3\sigma$ | Tight core + wide heavy-tail veil | Bridge-Fine asymmetric Lorentzian, `0.00%` cross-resolution EE90 drift |
| **Core & Black Floor** | Core burnout or global shadow fog | Carbon flecks absorb stray dark-field scatter | $C^1$ inverted gate + quartic toe; zero far-field shadow lift |
| **Rotational Isotropy** | Separable tent +8.4% diagonal bias at $2\sigma$ | Naturally circular random particulates | $\kappa = 0.78$ contraction: `1.000` at $1\sigma$, `+1.2%` at $2\sigma$ |
| **Chromatic Hue Stability** | Per-channel clipping induces hue shift | Linear photon superposition preserves wavelength | Scalar peak soft clip, channel ratio drift $< 10^{-9}$ |

*Note: The non-Metal gallery fallback (`UIImage+Bloom.swift`) uses single-scale CoreImage Gaussian blur strictly for hardware compatibility and does not provide multi-scale heavy-tail diffusion.*

---

## 5. Pipeline Topology & Four Degradations Without EDR

Real optical capture follows a fixed physical order: **Scene Photons → Lens Diffusion Filter (Bloom) → Film Emulsion & Antihalation Layer (Halation & Latent Image) → Development & Print Non-Linearity (3D LUT / AgX Tone Mapping) → Display OETF Encoding**.

Following ACES 2.0 separation between scene-referred linear light and display rendering, Espresso runs two distinct topologies:

```text
[1. Camera Capture & RAW Development (Scene-Referred Pre-LUT)]
Bayer RAW / Apple ProRAW (BaselineExposure anchored at 18% middle gray)
  --> RawDevelopEngine (.rgba16Float, EDR > 1.0 preserved)
  --> Scene-Linear Display P3
  --> bloomExtractLinear (Normalized Karis, kw coeff 0.25) + 11-Level In-Place Pyramid
  --> preLUTOpticsScatterComposite (Halation + Bloom linear superposition)
  --> 3D Film Print LUT (Track A: Linear P3 / Track B: ACEScct AP1)
  --> srgb_encode_oetf + Display P3 --> HEIC / JPEG

[2. Gallery Darkroom Editor]
Saved Still Image
  --> bloom_srgb_decode to Linear Display P3
  --> MetalOpticalEngine / MetalBloomEngine (Quartic Toe + Prominence Boost)
  --> C1 Inverted Gate + huePreservingSoftClip
  --> bloom_srgb_encode --> Darkroom Output
```

Placing bloom in the **Pre-LUT scene-referred linear domain (`preLUTOpticsScatterComposite`)** yields two structural advantages:
1. **Halos Inherit Film Color Science**: Scattered light enters the 3D film LUT alongside the base image, naturally adopting Kodak Portra or Fujifilm Classic Neg shoulder warmth and toe character instead of floating on top like digital fog.
2. **Zero Double Compression**: Highlight roll-off happens once inside the film LUT, avoiding washed-out highlights caused by stacked compression curves.

Running bloom after clipping to 8-bit SDR $[0.0, 1.0]$ (without `.rgba16Float` EDR headroom) triggers four irreversible physical failures:

1. **Radiometric Energy Collapse**: A sunlit white shirt reflects around $E \approx 0.85$, whereas car headlights or solar water reflections reach $E \approx 4.0\text{–}16.0$ (+2.2 to +4.2 EV higher). SDR clipping crushes both an $E = 0.95$ white wall and an $E = 12.0$ headlight into `[0.95, 1.00]`, erasing the 12x photon flux advantage. Headlights either bloom weakly or force lowering the threshold until every white wall fogs over.
2. **Sub-Pixel Specular Annihilation**: Distant water sparkles or jewelry facets often span $1 / 8$ of a pixel solid angle at $E_{\text{true}} = 8.0$. In EDR linear space, pixel integration gives $\frac{1}{8} \times 8.0 = 1.00 > T$, firing cleanly. If clipped to `1.0` beforehand, anti-aliasing or $2 \times 2$ averaging dilutes it to $0.25 \ll T$, wiping out micro-specular sparkle across the frame. That is why even the SDR editor path requires per-pixel gating before $4 \times 4$ tent integration plus prominence boost $g_{\text{prom}}$.
3. **Chromatic Bleaching & Hue Skew**: A warm tungsten streetlight at linear RGB $[3.2,\, 1.8,\, 0.4]$ carries an $8 : 4.5 : 1$ ratio. SDR hard clipping flattens it to $[1.0,\, 1.0,\, 0.4]$, collapsing the red-to-green ratio from `1.78:1` to `1:1`—turning amber gold into harsh lemon white and desaturating the entire surrounding halo.
4. **Hard-Clipped Plateau Halo**: A real point light peaks sharply from $E = 10.0$ down to $E = 1.0$, convolving into a continuous outward gradient. SDR clipping shaves $E \in [1.0, 10.0]$ into a flat `1.0` plateau; convolving a flat disk yields a step drop at the disk edge, looking like a pasted ring around a dead-white disc.

> **Current SDR Darkroom Boundary**: Plain 8-bit SDR gallery files decoded via `bloom_srgb_decode` remain display-referred ($E \le 1.0$); only RAW / ProRAW captures carry full scene-referred EDR headroom today. For iPhone HEIC stills carrying ISO 21496-1 gain maps, iOS 18's native `CIImageOption.expandToHDR: true` provides a direct path to reconstruct $> 1.0$ linear highlights inside the darkroom editor.

---

## 6. Architecture Summary & Engineering Trade-Offs

| Module | Mathematical Model & Implementation | Problem Solved | Code Anchor |
| :--- | :--- | :--- | :--- |
| **Radiant Energy Metric** | $E_{\text{opt}} = \max(Y_{\text{P3}}, \max(R, G, B))$ | Fires narrowband pure red/blue neon emitters missed by CIE $Y$ | `BloomMath.swift` |
| **Threshold Gate** | $w_{\text{spec}}(t) = t^3(4 - 3t)$ ($C^2$ toe, $C^1$ shoulder) | 100% midtone/skin immunity; cuts diffuse-white toe leakage 38%–74% | `BloomMath.swift` |
| **Prominence & Karis** | $g_{\text{prom}} = 1 + 0.35 p^2$ + Normalized Partial Karis | Lifts tiny glints without hollowing lamps; preserves HDR ratio & suppresses 1 px fireflies | `BloomShader.metal` |
| **Downsample Chain** | Adaptive up to 11 ceil-div levels + FP16 Jimenez 13-tap | Zero 1D Gaussians, exact `1.00000` impulse energy, no odd-size border clipping | `BloomShader.metal` |
| **Mixing & In-Place Up** | Bridge-Fine (`0.002`) Lorentzian + FP16 9-tap ($\kappa = 0.78$) | `0.00%` cross-res EE90 drift, `+1.2%` $2\sigma$ anisotropy, 121.5 MB saved at 48 MP | `BloomMath.swift` |
| **Core Protection** | $C^1$ linear-hyperbolic gate + scalar peak soft clip | Eliminates EDR $C^0$ rings and white bleaching with exact delta hue constancy | `BloomMath.swift` |

The trade-off is deliberate: extra scheduling complexity (ceil-division private texture pools, Bridge-Fine early termination, and cumulative convex weight recursion) buys strict cross-resolution scale parity, substantially lower 48 MP memory traffic, and verifiable protection of skin midtones and highlight hues. For fixed low-resolution UI glows, a basic 4-level hardware mipmap suffices; once a pipeline spans 12 MP / 48 MP photography and Pre-LUT EDR film emulation, scale-invariant octave scheduling, asymmetric quartic toes, and hue-preserving soft clipping become necessary to avoid plastic halos and fogged whites.

---

## FAQ

### Why can't a single-scale Gaussian blur replicate physical diffusion filters like Black Pro-Mist?
A single Gaussian kernel drops super-exponentially past 3σ, producing harsh sticker-like halos while hitting severe bandwidth limits on 48 MP stills. Physical diffusion filters rely on forward Mie scattering across multi-scale particulates, splitting light into a sharp ballistic Dirac delta transmission and a Cauchy-Lorentzian heavy-tail halo that requires a multi-octave pyramid to reproduce.

### How does Espresso maintain identical bloom scale across 1512 px previews, 12 MP, and 48 MP captures?
Through Bridge-Fine scheduling: each pyramid level's measured full-resolution equivalent sigma is 1.18 × 2^(k+1) px. Combining an adaptive 11-level ceiling with a 0.2% short-side fine-scale floor (`fineScaleFloorFraction = 0.002`) zeroes ultra-fine weights so all three resolutions activate the exact same relative octave band. Measured 90% encircled energy radius (EE90) drift is 0.00%, and 48 MP exports stop upsampling at L2—skipping 97.5 MB (half-res) and 24 MB (quarter-res) writes.

### How does the pipeline suppress diffuse white shirts while keeping micro-specular glints bright and large lights solid?
Pass 1 combines three orthogonal mechanisms inside the existing 4×4 extraction footprint: an asymmetric quartic specular-toe gate t³(4 - 3t) (C2 at the lower toe) cuts diffuse-white leakage by 38%–74%; an additive-only micro-specular prominence factor 1 + 0.35p² (zero extra texture reads) lifts compact glints without hollowing out large lamps; and normalized Partial Karis Average in scene-linear mode suppresses isolated 1 px fireflies by >3.5× while canceling identically across uniform HDR emitters.

### Why must optical bloom run in the Pre-LUT scene-referred EDR domain rather than after SDR tone mapping?
Physically, lens filter diffusion occurs before film exposure and print development. Running bloom in Pre-LUT `.rgba16Float` linear space lets scattered glow pass through the 3D LUT alongside the base image, inheriting authentic film shoulder/toe color response without Double Compression. Clipping to SDR [0, 1] first causes radiometric energy collapse, sub-pixel specular annihilation, chromatic hue bleaching, and hard-clipped plateau halos.
