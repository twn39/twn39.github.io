---
title: "Calibrating Apple ProRAW for Film Simulation: Breaking Smart HDR Double Compression & EV100 Three-Tier Scheduling"
description: "Quantifying why CIRAWFilter's default boost=1.0 / ltm=1.0 triggers double compression and spatial HDR warping under 3D film LUTs across 13 real 48 MP ProRAW scenes, and detailing Espresso's B3-NightAdapt C1 taper and three-tier tone intent architecture."
lang: "en"
translationSlug: "proraw-film-tone-calibration"
pubDate: 2026-11-27
project: "espresso"
tags: ["Color Science", "ProRAW", "CIRAWFilter", "ACES", "LUT", "iOS"]
readingTime: 14
coverImage: "/images/blog/proraw_fig1_pareto_and_shadow_crush.png"
coverAlt: "ProRAW CIRAWFilter calibration: Pre-LUT spatial HDR warp vs. EDR headroom Pareto frontier and Post-LUT deep shadow crush comparison"
coverSpec: "FIG 01 · PRORAW CIRAWFILTER PARETO & SHADOW CRUSH · 13-SCENE BENCHMARK"
featured: true
faqs:
  - q: "Why does feeding CIRAWFilter's default boost=1.0, ltm=1.0 directly into 3D film LUTs crush shadows and flatten lighting?"
    a: "Apple's default settings target ready-to-share Smart HDR rendering by baking 100% ProfileGainTableMap local lift and a display-referred S-curve before the LUT runs. Across 7 paired 48 MP ProRAW scenes, this compresses Pre-LUT EDRMax to 1.94x, drives SpatialWarpEV to 0.240 EV, and pushes P90 C* to 27.2. Stacking a film print LUT's own S-curve on top triggers double compression, pushing deep shadow crush (L* < 5) to 14.97% on Genesis 5207 and 14.63% on Fuji ClassicNeg."
  - q: "How do you avoid dark, flat renders when lowering localToneMapAmount without locking exposure to 0 EV?"
    a: "ProRAW intentionally underexposes linear frames by 1.0–1.5 EV to protect highlights and relies on ProfileGainTableMap to lift midtones. Keeping exposure=0 while dialing down boost (0.35 / 0.70) drops effective gamma to 0.696 and cancels film LUT contrast, while raising both (0.75 / 0.95) recreates Smart HDR flattening. Replacing the midtone lift lost from lowering ltm (0.95 to 0.50) with a pure scalar linear gain (exposure = +0.35 EV) restores contrast and EDR headroom with zero added spatial warping."
  - q: "Why does B3-NightAdapt apply a C1 smoothstep taper over EV100 in [1.5, 5.0]?"
    a: "On a true night skyline (EV100 = 1.96, ISO 1250), fixed B3 (0.35 / 0.50 / +0.35 EV) pushes midtone gain to +0.61 EV, lifting night clouds to gray and amplifying shadow noise. Tapering ltm from 0.50 to 0.35 and exposure from +0.35 to +0.10 EV via a C1 Hermite smoothstep brings night midtone gain back to +0.24 EV, cuts SpatialWarpEV to 0.052 EV, and reduces shadow HF noise (ShNois) by another 10%, while keeping all EV100 >= 5.0 daylight and indoor scenes bit-identical to B3."
  - q: "Why does Espresso split ProRAW tone parameters into three downstream intents?"
    a: "Downstream consumers have distinct transfer curves: ACEScct and film print LUTs embed full S-curves (γ = 1.09–1.67) and require a restrained B3-NightAdapt negative; display-referred overlay LUTs like Leica LUX are near-linear (γ = 0.93–1.13) and need 0.55 / 0.55 / +0.30 EV for solid blacks; unfiltered straight-out-of-camera ProRAW has no LUT to supply contrast, so NoLUT-B (0.85 / 0.65 / +0.25 EV) anchors crisp blacks (P05 = 5.3) while still cutting spatial HDR warp by 19% and shadow noise by 16% versus Apple defaults."
---

> **Context**: Espresso Color & RAW Development Pipeline (iOS 18.2+, `CIRAWFilter` Linear DNG Decoding, Dual-Track Metal 3D LUT)  
> **Core Modules**: `SceneRadiometryMath.swift`, `RawDevelopmentStrategy.swift`, `FilmColorProfile.swift`  
> **Core Question**: Before feeding Apple ProRAW into 3D film print LUTs that already contain full photochemical S-curves, how should `CIRAWFilter`'s `boostAmount`, `localToneMapAmount`, and `exposure` be calibrated to eliminate both Smart HDR double compression and flat midtone contrast?

## TL;DR: Key Takeaways

Apple `CIRAWFilter`'s default `boost = 1.0 / ltm = 1.0` bakes a display-referred S-curve and full local tone mapping before the 3D LUT runs, inflating Post-LUT deep shadow crush by **+75%** and cutting linear `EDRMax` headroom to **1.94x**. Based on two rounds of calibration across **13 real 48 MP ProRAW scenes** (`EV100 = 1.96–15.04`) and 5 cross-track LUTs, Espresso deploys a **three-tier tone intent policy**: film simulation LUTs use **`B3-NightAdapt`** (`0.35 / 0.50 / +0.35 EV` at `EV100 >= 5.0`, tapering smoothly via $C^1$ smoothstep over `EV100 ∈ [1.5, 5.0]` to `0.35 / 0.35 / +0.10 EV`), cutting 13-scene spatial HDR warp by **43%**, saturated hue shift by **64%**, and shadow noise by **23%**; display overlay LUTs (Leica LUX) use `0.55 / 0.55 / +0.30 EV`; unfiltered captures use `NoLUT-B` (`0.85 / 0.65 / +0.25 EV`).

---

## 1. Where ProRAW Sits in Espresso's Dual-Track Pipeline

Unlike single-frame Bayer CFA RAW, Apple ProRAW is a 12/14-bit Linear DNG container (`PhotometricInterpretation == 34892`). It preserves scene-linear light and Extended Dynamic Range (EDR) highlight headroom while embedding Apple's multi-frame local gain map (DNG 1.6 `ProfileGainTableMap` / DNG 1.7 `ProfileGainTableMap2`) and global rendering intent inside container metadata.

In Espresso's zero-copy capture pipeline, `CIRAWFilter` renders ProRAW directly into an `extendedLinearDisplayP3` floating-point Metal texture (`.rgba16Float`), feeding the dual-track 3D LUT shader (`LUTShader.metal`) losslessly:

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

Frontend `CIRAWFilter` decoding and backend 3D LUT grading form a cascaded nonlinear system. Any display curve or aggressive local compression baked in upstream distorts every film stock downstream.

---

## 2. What Breaks Under Default `boost = 1.0, ltm = 1.0`

Opening ProRAW in `CIRAWFilter` defaults to `boostAmount = 1.0`, `localToneMapAmount = 1.0`, and `exposure = 0.0`—tuned so ungraded ProRAW resembles the stock Camera app's Smart HDR HEIC output.

### 2.1 Physical Behavior of `ltm` and `boost`

Per the Adobe DNG 1.6 specification and Apple WWDC21 Session 10160, neither parameter behaves like a simple brightness slider:

1. **`localToneMapAmount` (`ltm`) scales `ProfileGainTableMap`**:  
   ProRAW intentionally underexposes linear sensor frames by roughly `1.0–1.5 EV` to prevent highlight clipping, recording spatially varying gain recovery in a low-resolution 2D lookup table (`ProfileGainTableMap`). After `BaselineExposure`, the decoder evaluates a scalar gain $g(x, y, I)$ per pixel location $(x, y)$ and intensity metric $I$:
   $$\mathbf{C}_{\text{out}} = g(x, y, I) \cdot \mathbf{C}_{\text{in}}, \quad I = \operatorname{clamp}\!\big((R, G, B, \min, \max) \cdot \mathbf{w}_{\text{map}},\, 0,\, 1\big)$$
   Empirical regression shows `ltm` is a strongly concave dynamic-range compressor: `ltm = 0.95` (`boost = 0`) lifts deep shadows by `+2.15 EV` and midtones by `+1.16 EV` while nudging highlights only `+0.23 EV`, collapsing effective physical gamma from `1.000` down to `0.645`.
2. **`boostAmount` (`boost`) scales Apple's global display-referred S-curve**:  
   Contrary to its name, raising `boost` on ProRAW does not brighten shadows. It pushes LTM-lifted shadows back down toward black, steepens midtone contrast, and boosts RGB chroma through per-channel nonlinearity.

### 2.2 Four Measured Failure Modes Under `1.0 / 1.0`

Running all 7 paired 48 MP ProRAW captures through 5 cross-track film LUTs at `1.0 / 1.0` exposes four quantifiable defects:

1. **Double S-Curve Compression & Crushed Shadows**: `boost = 1.0` drives Pre-LUT shadow floor `P05` down to `5.2` (vs. `11.5` for `B3`). Passing that pre-crushed negative into film print LUTs with $\gamma = 1.09\text{–}1.67$ triggers secondary shadow collapse: deep shadow crush ($L^* < 5$) hits **14.97%** on `Genesis 5207` (+75% over `B3`'s `8.57%`), **14.63%** on `Fujifilm ClassicNeg`, **14.12%** on `ARRI Classic`, and **11.58%** on `Dehancer Portra 400` (vs. `5.59%` on `B3`).
2. **Heavy Spatial HDR Warping & Flattened Macro Lighting**: `ltm = 1.0` produces the highest spatial gain distortion in the entire benchmark (`SpatialWarpEV = 0.240 EV`, +63% higher than `B3`) and the worst macro-depth ratio (`Loc/Mac = 0.363`). Hard-sun shadows lift into gray while local edges look brittle.
3. **Halved EDR Highlight Headroom**: Pre-LUT linear peak `EDRMax` drops to **1.94x** (only 32% of pure linear `+0.90 EV` and 38% below `B3`'s `3.12x`), starving ACEScct cinema LUTs of their `+5.2` to `+11.3 L*` logarithmic shoulder roll-off.
4. **Upstream Chroma Override**: `boost = 1.0` pushes Pre-LUT `P90 C*` from pure linear `18.9` up to **27.2** (+44%), overriding subtle photochemical dye differences between `Portra 400`, `ARRI Classic`, and `Classic Neg` with uniform digital saturation.

### 2.3 Three Common Dead-End Parameter Traps

While searching for alternatives to `1.0 / 1.0`, three intuitive candidates failed under objective measurement:

- **Trap A — Lowering `boost` with `exposure = 0.0` (`0.35 / 0.70 / e0`)**: `ltm = 0.70` suppresses base contrast to $\gamma_{\text{eff}} = 0.696$. Multiplied by film LUT slopes (`ARRI Classic`: $0.696 \times 1.09 = 0.76$; `Genesis 5207`: $0.696 \times 1.33 = 0.93$), net contrast drops below unity and renders look washed out.
- **Trap B — Raising both at `exposure = 0.0` (`0.70–0.75 / 0.95 / e0`)**: This flattens macro contrast with 95% Smart HDR and then yanks contrast and saturation back with a 75% display S-curve. Its `SpatialWarpEV = 0.214 EV`, `EDRMax = 1.99x`, and `Loc/Mac = 0.362` remain clustered right next to `1.0 / 1.0`.
- **Trap C — Zeroing everything (`0.00 / 0.00 / +0.90 EV`)**: Despite `EffGam = 1.000` and `SpatialWarpEV = 0.000`, ProRAW's underexposed capture metering assumes partial `ProfileGainTableMap` assistance. Disabling `ltm` entirely drops backlit/harsh-sun midtones to `P50 = 23.3` (`11.7` on `S05`) and clips `0.83%` of highlights on `S03`.

> **Core Breakthrough**: The real bottleneck was locking `exposure = 0.0` and forcing `ltm` to carry all midtone lift. Replacing the midtone brightness lost when lowering `ltm` (`0.95` to `0.50`) with a **pure scalar linear multiplier (`exposure = +0.35 EV`)** breaks the false choice between flat renders and Smart HDR warping—preserving EDR headroom while cutting spatial distortion.

---

## 3. Four-Layer Decoupled Benchmark Methodology

Inspecting one or two subjective frames—or checking only Post-LUT histograms—easily masks opposing distortions between `ltm` lift and `boost` crush. We built a four-layer, reproducible photometric protocol instead.

### 3.1 Objective Triangulated Reference & Stratified 7-Scene Set

Fitting ProRAW pre-LUT curves to stock SDR HEIC targets (`RMS_L`, `P90 C*`) is a color-science trap: SDR HEIC has already discarded EDR highlights and baked full Smart HDR compression, so matching it drags ProRAW straight back to `1.0 / 1.0`.

Our reference frame anchors on three independent baselines:
1. **Pure Physical Linear Reference (`b=0, l=0, exp=0`)**: Regresses effective gamma $\gamma_{\text{eff}}$, `SpatialWarpEV`, and `EDRMax` retention;
2. **Apple Default Baseline (`b=1.0, l=1.0, exp=0`)**: Anchors expected midtone placement (`P50`) and quantifies Smart HDR distortion and shadow crush;
3. **Full-Library 1D LUT Sensitometry**: Measures `-6 EV` to `+4 EV` (relative to 18% gray `0.18`) curves across all 8 film LUT families.

Round 1 used 7 paired 48 MP ProRAW captures spanning nearly 10 stops of scene illumination (anonymized as `S01`–`S07`):

| Scene ID | Scenario & Optical Challenge | `EV100` | ISO | Shutter | `BaselineExposure` | Linear `LinP50` | Dynamic Span (`P99/P05`) | Linear Peak `LinMax` | `LTM=1.0` Midtone Gain |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `S01` | Indoor low-light portrait (specular floor) | `4.7` | 400 | 1/33 s | `+0.65` | `34.1` | `5.68 EV` | `6.33x` | `+1.35 EV` |
| `S02` | Subway side portrait (skin + black coat + screen) | `6.6` | 200 | 1/60 s | `-0.06` | `14.4` | `6.60 EV` | `1.31x` | `+1.50 EV` |
| `S03` | Subway portrait (overhead lamp + dark hair) | `6.9` | 160 | 1/60 s | `+0.25` | `15.4` | `8.56 EV` | `3.06x` | `+1.56 EV` |
| `S04` | Extreme backlit window (dark desk + bright courtyard) | `7.3` | 100 | 1/50 s | `+0.09` | `23.2` | `9.95 EV` | `1.92x` | `+1.58 EV` |
| `S05` | Midday high-rise (deep shaded trees + sunlit wall) | `13.7` | 64 | 1/2747 s | `+0.41` | `15.3` | `7.26 EV` | `2.07x` | `+1.15 EV` |
| `S06` | Hard-sun street (hard bike shadow + dense canopy) | `13.8` | 80 | 1/3650 s | `+0.79` | `26.9` | `6.47 EV` | `6.67x` | `+1.56 EV` |
| `S07` | Midday sunlit street (blue sky + shaded brick wall) | `14.2` | 64 | 1/3759 s | `+0.56` | `25.9` | `6.53 EV` | `1.04x` | `+1.33 EV` |

### 3.2 Three LUT Curve Archetypes

Measuring all 111 presets with production `preLUTExposureOffsetEV` and `shadowToeFlare` (`FilmColorProfile.swift`) partitions the library into three distinct tonal consumers:

| Archetype & Representative LUTs | Track | `0 EV` Gray $L^*$ | Midtone $\gamma_{\text{LUT}}$ | EDR Shoulder (`1.0x -> +4 EV`) | Frontend Negative Requirement |
| :--- | :---: | ---: | ---: | ---: | :--- |
| **Archetype I: Scene-Referred ACEScct (35)** (`ARRI Classic`, `Genesis 5207`, `DaVinci 2383`, `Fuji ClassicNeg`, `Zero Zephyr`) | B | `49.0–50.4` (Zero: `42–43`) | `1.09–1.62` | `+5.2` to `+11.3 L*` | Full internal S-curve & log shoulder; needs high EDR headroom, low spatial warp, low `boost` |
| **Archetype II: Bounded Linear P3 Film (49)** (`Dehancer Portra 400`, `Gold 200`, `Vision3 250D`) | A | `39.0–46.3` | `1.26–1.67` | `+0.00` (`[0, 1]` bounded) | Steep internal S-curve with no log shoulder; needs moderate `ltm` for extreme highlights and low `boost` for shadows |
| **Archetype III: Display Overlay (27)** (`Leica Natural`, `Classic`, `Vivid`) | A | `49.0–61.1` | `0.93–1.13` | `+0.00` (`[0, 1]` bounded) | Near-linear curve relying on upstream base contrast, still harmed by >95% Smart HDR flattening |

End-to-end validation spans 5 representative LUTs (`Genesis 5207`, `Fujifilm ClassicNeg`, `ARRI Classic`, `Dehancer Portra 400`, `Leica Classic`), matching production `preLUTExposureOffsetEV` (e.g., Genesis `+0.60 EV`, ARRI `+0.65 EV`) and `applyShadowToeFlareDisplayP3` while disabling stochastic spatial effects (grain, halation, bloom) for clean radiometric readings.

### 3.3 Core Metric Definitions

| Metric | Mathematical Definition | Physical & Visual Meaning | Target Direction |
| :--- | :--- | :--- | :--- |
| **`EffGam`** | OLS slope of $\log_2 Y_{\text{dev}}$ vs. $\log_2 Y_{\text{lin}(0,0)}$ over $Y_0 \in [0.02, 0.45]$ | Contrast compression introduced by `CIRAWFilter` (`1.000` = pure optical; `< 0.72` flattens film LUTs) | `>= 0.75`, avoid `< 0.70` |
| **`MidEV`** | $\operatorname{mean}(\log_2(Y_{\text{dev}} / Y_{\text{lin}}))$ over $Y_0 \in [0.05, 0.25]$ | Net midtone lift applied to underexposed ProRAW linear data | Stable near `+1.05` to `+1.15 EV` |
| **`SpatialWarpEV`** | Residual std $\operatorname{std}\!\big(\log_2 Y_{\text{dev}} - (\gamma_{\text{eff}}\log_2 Y_0 + b)\big)$ | Pure 2D spatial exposure non-uniformity from `ProfileGainTableMap` after removing global tone curve | Lower is cleaner (`<= 0.15 EV`) |
| **`EDRMax`** | Max channel peak $\max(R, G, B)$ in Pre-LUT `.rgba16Float` linear texture | Super-white highlight headroom available to ACEScct film shoulders | Higher is better (`>= 3.0x`) |
| **`Loc/Mac`** | $\operatorname{mean}(\lvert L^* - G_\sigma(L^*)\rvert) / \operatorname{std}(G_\sigma(L^*))$ ($\sigma \approx 5\%$ short side) | Heavy LTM shrinks macro lighting variance (denominator) while keeping local edges sharp, creating flat/brittle HDR look | Lower yields deeper 3D falloff |
| **`P95 - P25`** | Difference between 95th and 25th CIE $L^*$ percentiles | Perceived tonal tension and punch, insensitive to extreme black noise | Match or beat `0.70 / 0.95` |
| **`L* < 5%` & `MaxClip7`** | Deep shadow fraction ($L^* < 5$) & worst single-scene clip ($L^* > 98$) across 7 scenes | Guards against double-compression shadow crush and highlight clipping | `MaxClip7 = 0.00%` (Track B / Dehancer) |
| **`P90 C*`** | 90th percentile CIELAB chroma $C^* = \sqrt{a^{*2} + b^{*2}}$ | Detects premature upstream saturation overpowering LUT dye character | Restrained `21–23` Pre-LUT |

---

## 4. Seven-Scene Benchmark Results & Pareto Optimum `B3`

![Figure 1: ProRAW CIRAWFilter calibration: Pre-LUT spatial HDR warp vs. EDR headroom Pareto frontier and Post-LUT deep shadow crush comparison](/images/blog/proraw_fig1_pareto_and_shadow_crush.png)

### 4.1 Pre-LUT Linear Negative Comparison (7-Scene Mean)

| Candidate (`boost / ltm / exp`) | `EffGam` | `MidEV` | `WarpEV` | `EDRMax` | `P05 / P25 / P50 / P95` | `RMS_L` | `Loc/Mac` | `P90 C*` |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `1.00 / 1.00 / e0.00` (Apple Default) | `0.785` | `+1.17` | `0.240` | `1.94x` | `5.2 / 21.8 / 39.5 / 80.3` | `24.1` | `0.363` | `27.2` |
| `0.35 / 0.70 / e0.00` (Legacy Flat) | `0.696` | `+1.02` | `0.168` | `2.25x` | `11.6 / 25.1 / 39.4 / 75.1` | `20.6` | `0.353` | `21.7` |
| `0.70 / 0.95 / e0.00` (Prior) | `0.720` | `+1.20` | `0.210` | `1.99x` | `9.7 / 25.0 / 41.2 / 79.3` | `22.4` | `0.362` | `25.0` |
| `0.75 / 0.95 / e0.00` | `0.732` | `+1.19` | `0.214` | `1.99x` | `9.0 / 24.4 / 40.8 / 79.3` | `22.7` | `0.362` | `25.3` |
| **`B3: 0.35 / 0.50 / +0.35` (Adopted)** | **`0.753`** | **`+1.11`** | **`0.147`** | **`3.12x`** | **`11.5 / 24.8 / 39.2 / 79.1`** | `21.8` | **`0.343`** | **`22.0`** |
| `B4: 0.45 / 0.55 / +0.30` (Richer Alt) | `0.760` | `+1.09` | `0.158` | `2.93x` | `10.6 / 24.2 / 38.9 / 78.8` | `22.0` | `0.346` | `22.6` |
| `B2: 0.35 / 0.40 / +0.45` (Hard-Light Alt) | `0.791` | `+1.05` | `0.132` | `3.50x` | `10.8 / 23.6 / 37.8 / 79.4` | `22.1` | `0.337` | `21.8` |
| `C1: 0.00 / 0.00 / +0.90` (Pure Linear) | `1.000` | `+0.90` | `0.000` | `5.97x` | `8.7 / 18.6 / 31.0 / 82.0` | `24.1` | `0.299` | `18.9` |

### 4.2 Post-LUT End-to-End Comparison Across 5 Film LUTs (7-Scene Mean)

Cell format: **Tonal Span `P95-P25` / Shadow Crush `L* < 5%` / Depth `Loc/Mac` / Worst Clip `MaxClip7`**.

| Candidate | `Genesis 5207` (B) | `Fuji ClassicNeg` (B) | `ARRI Classic` (B) | `Dehancer Portra400` (A) | `Leica Classic` (A) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `1.00 / 1.00 / e0` (Default) | `66.6` / `14.97%` / `.344` / `0%` | `71.8` / `14.63%` / `.335` / `0%` | `58.6` / `14.12%` / `.354` / `0%` | `59.4` / `11.58%` / `.347` / `0%` | `67.2` / `9.12%` / `.357` / `1.06%` |
| `0.35 / 0.70 / e0` (Legacy) | `60.3` / `8.37%` / `.340` / `0%` | `66.1` / `7.94%` / `.329` / `0%` | `51.8` / `7.50%` / `.348` / `0%` | `51.0` / `5.41%` / `.339` / `0%` | `59.5` / `3.40%` / `.351` / `1.04%` |
| `0.70 / 0.95 / e0` (Prior) | `62.9` / `10.21%` / `.348` / `0%` | `68.6` / `9.76%` / `.336` / `0%` | `54.5` / `9.31%` / `.358` / `0%` | `55.8` / `6.99%` / `.348` / `0%` | `62.2` / `4.85%` / `.360` / `1.05%` |
| `0.75 / 0.95 / e0` | `63.6` / `11.02%` / `.347` / `0%` | `69.2` / `10.58%` / `.336` / `0%` | `55.2` / `10.11%` / `.357` / `0%` | `56.3` / `7.67%` / `.347` / `0%` | `63.1` / `5.43%` / `.359` / `1.05%` |
| **`B3: 0.35 / 0.50 / +0.35`** | **`63.1` / `8.57%` / `.331` / `0%`** | **`68.7` / `8.21%` / `.320` / `0%`** | **`54.7` / `7.69%` / `.341` / `0%`** | **`55.9` / `5.59%` / `.330` / `0%`** | **`62.5` / `3.49%` / `.343` / `1.08%`** |
| `B4: 0.45 / 0.55 / +0.30` | `63.6` / `9.48%` / `.332` / `0%` | `69.2` / `9.05%` / `.321` / `0%` | `55.4` / `8.52%` / `.342` / `0%` | `56.0` / `6.28%` / `.332` / `0%` | `63.2` / `4.07%` / `.344` / `1.07%` |
| `B2: 0.35 / 0.40 / +0.45` | `64.5` / `9.48%` / `.323` / `0.14%` | `70.0` / `9.02%` / `.312` / `0.08%` | `56.3` / `8.50%` / `.333` / `0%` | `57.3` / `6.27%` / `.324` / `0%` | `64.3` / `4.04%` / `.335` / `1.10%` |
| `C1: 0.00 / 0.00 / +0.90` | `70.2` / `15.44%` / `.282` / `0.83%` | `75.1` / `14.51%` / `.274` / `0.36%` | `62.7` / `13.44%` / `.288` / `0%` | `64.1` / `9.74%` / `.288` / `0%` | `72.2` / `6.87%` / `.292` / `1.29%` |

### 4.3 Per-Scene Stability Audit (`Genesis 5207`)

Cell format: `P50` / `P95-P25` / `L* > 98%` / `Loc/Mac`.

| Scene | `0.75 / 0.95 / e0` | **`B3 (0.35 / 0.50 / +0.35)`** | `B2 (0.35 / 0.40 / +0.45)` | `C1 (0.00 / 0.00 / +0.90)` |
| :--- | :--- | :--- | :--- | :--- |
| `S01` (Indoor Low-Light) | `47.0 / 58.5 / 0.00% / .508` | **`46.7 / 56.3 / 0.00% / .497`** | `45.6 / 57.5 / 0.14% / .493` | `43.4 / 59.5 / 0.44% / .470` |
| `S02` (Subway Side) | `19.4 / 69.5 / 0.00% / .308` | **`19.1 / 68.2 / 0.00% / .295`** | `17.3 / 69.5 / 0.00% / .286` | `10.9 / 74.4 / 0.00% / .244` |
| `S03` (Subway Portrait) | `25.3 / 68.5 / 0.00% / .358` | **`23.8 / 67.4 / 0.00% / .340`** | `21.4 / 68.9 / 0.00% / .330` | `12.1 / 74.8 / 0.83% / .279` |
| `S04` (10-Stop Backlit) | `47.6 / 77.1 / 0.00% / .333` | **`43.3 / 78.7 / 0.00% / .312`** | `40.7 / 79.7 / 0.00% / .304` | `24.7 / 83.8 / 0.00% / .254` |
| `S05` (Midday High-Rise) | `30.3 / 58.6 / 0.00% / .243` | **`26.8 / 59.8 / 0.00% / .224`** | `24.2 / 61.8 / 0.00% / .216` | `11.7 / 71.7 / 0.00% / .170` |
| `S06` (Hard-Sun Street) | `44.1 / 57.9 / 0.00% / .418` | **`41.6 / 56.4 / 0.00% / .402`** | `39.5 / 57.9 / 0.00% / .394` | `30.8 / 63.1 / 0.00% / .349` |
| `S07` (Midday Blue Sky) | `44.9 / 54.8 / 0.00% / .261` | **`41.7 / 54.8 / 0.00% / .247`** | `39.5 / 56.4 / 0.00% / .241` | `29.5 / 63.9 / 0.00% / .206` |

`B3` (`0.35 / 0.50 / +0.35 EV`) sits cleanly at the Pareto knee:
- Relative to flat `0.35 / 0.70`, `EffGam` recovers from `0.696` to `0.753` and `P95 - P25` matches or exceeds `0.70 / 0.95` across all 5 LUTs;
- Relative to Apple default `1.0 / 1.0`, `SpatialWarpEV` drops **39%** (`0.240 -> 0.147 EV`), `EDRMax` rises **+61%** (`1.94x -> 3.12x`), and Track B / Dehancer hold `0.00%` highlight hard clipping across every scene (`B2` begins clipping `0.14%` on `S01`);
- Deep shadow crush falls **43%–52%** vs. `1.0 / 1.0` without triggering `C1`'s shadow underexposure;
- Pre-LUT `P90 C*` settles at `22.0`, handing color personality back to each film LUT.

---

## 5. 13-Scene Extension & Three-Tier Intent Architecture

Round 1 stopped at `EV100 = 4.7`, leaving true high-ISO night skies, narrow chromatic hue constancy, and unfiltered ProRAW captures untested. Round 2 expanded the dataset to **13 scenes (`EV100 = 1.96–15.04`)** by adding 6 boundary captures:
- `S08`: True night skyline (`EV100 = 1.96`, ISO 1250)
- `S09`: Blue-hour streetlamps (`EV100 = 4.02`)
- `S10`: Portrait skin + saturated red vest (`EV100 = 5.06`)
- `S11`: Crowded subway interior (`EV100 = 6.23`)
- `S12`: Full-spectrum pen display rack (`EV100 = 9.34`)
- `S13`: Extreme midday sunlit storefront (`EV100 = 15.04`)

We also added two diagnostic metrics: **Saturated Hue Shift (`HueDeg`)** and **Shadow High-Frequency Noise (`ShNois`)**.

![Figure 2: 13-scene validation: B3-NightAdapt C1 smoothstep schedule alongside Pre-LUT saturated hue shift and shadow HF noise](/images/blog/proraw_fig2_night_adapt_and_13scene.png)

| 13-Scene Pre-LUT Mean | `EffGam` | `MidEV` | `WarpEV` | `EDRMax` | `P05 / P50 / P95` | `Loc/Mac` | `P90 C*` | `HueDeg` | `ShNois` |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `Default (1.00/1.00/e0)` | `0.919` | `+1.10` | `0.222` | `2.13x` | `4.8 / 39.0 / 78.4` | `0.380` | `27.5` | `2.22°` | `6.426` |
| `B3 (0.35/0.50/+0.35)` | `0.835` | `+1.07` | `0.128` | `4.08x` | `11.2 / 39.7 / 77.0` | `0.366` | `22.8` | `0.81°` | `4.979` |
| **`B3-NightAdapt`** | `0.836` | `+1.03` | **`0.126`** | **`4.14x`** | `11.1 / 39.4 / 76.4` | `0.366` | `22.7` | **`0.81°`** | **`4.949`** |
| **`Leica (0.55/0.55/+0.30)`** | `0.876` | `+1.00` | `0.144` | `3.69x` | `9.1 / 38.2 / 76.4` | `0.367` | `23.7` | `1.28°` | `5.047` |
| **`NoLUT-B (0.85/0.65/+0.25)`** | `0.945` | `+0.90` | `0.179` | `3.09x` | `5.3 / 36.0 / 75.6` | `0.370` | `25.4` | `1.98°` | `5.405` |

Three findings drove the final three-tier architecture:

1. **Decisive Hue Constancy Advantage**: On `S10` (skin + red vest), `Default` shifts hue by **3.92°** vs. **1.08°** on `B3` (-72%); on `S12` (full-spectrum pens), `Default` shifts `2.13°` vs. `0.87°` on `B3`. Across all 13 scenes, mean `HueDeg` falls from `2.22°` to `0.81°` (-64%).
2. **`EV100` Night Adaptation (`B3-NightAdapt`)**: On `S08` (`EV100 = 1.96`, ISO 1250), fixed `B3`'s `+0.35 EV` linear lift pushes `MidEV` to `+0.61 EV`, fogging dark night clouds. Applying a $C^1$ cubic Hermite smoothstep over `EV100 ∈ [1.5, 5.0]` (`ltm: 0.50 -> 0.35`, `exposure: +0.35 -> +0.10 EV`) restores `S08`'s `MidEV` to `+0.24 EV`, cuts `WarpEV` to `0.052`, and drops `ShNois` by another 10% (`3.268 -> 2.931`), while every `EV100 >= 5.0` daylight/indoor scene stays identical to `B3`.
3. **Decoupling Display Overlays & Unfiltered Captures**:
   - Without a downstream film LUT (`simulation == nil`), raw `B3` leaves shadows lifted (`P05 = 11.2`). **`NoLUT-B` (`0.85 / 0.65 / +0.25 EV`)** restores crisp blacks (`P05 = 5.3`) while cutting Apple default spatial HDR warp by **19%** (`0.222 -> 0.179`) and shadow noise by **16%** (`6.426 -> 5.405`).
   - Near-linear display overlays (Leica LUX, Archetype III, $\gamma \approx 0.93\text{–}1.13$) use **`0.55 / 0.55 / +0.30 EV`**, tightening blacks (`P05: 8.2 -> 6.5`) while holding shadow crush at `6.52%`—half of Apple default's `12.19%`.

The complete resolver lives inside the headless `EspressoCore` color package:

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

Upstream, `ProRawDevelopmentStrategy.resolveToneIntent(for:)` maps `nil -> .unfiltered`, `.leica -> .displayOverlay`, and all other film stocks to `.filmSimulation`.

---

## 6. Operational Boundaries & References

Three explicit constraints bound this calibration:
- **EXIF Radiometry Fallback**: `B3-NightAdapt` computes $EV_{100} = \log_2(N^2 / t) - \log_2(\text{ISO} / 100)$. If an imported DNG omits aperture, shutter, or ISO metadata, the resolver falls back safely to fixed `B3` (`0.35 / 0.50 / +0.35 EV`).
- **Separate Single-Frame Bayer Strategy**: Single-frame Bayer CFA RAW lacks `ProfileGainTableMap` (`isLocalToneMapSupported == false`) and runs through `NativeBayerRawDevelopmentStrategy` with its own noise-aware boost (`0.12–0.25`) and adaptive shadow toe bias.
- **No Double Exposure Bias Injection**: User `ExposureBiasValue` is already baked into hardware AE shutter/ISO during capture and is never re-injected into `CIRAWFilter.exposure`.

### References & Standards

1. **Apple Inc. (WWDC21 Session 10160)** — *Capture and process ProRAW images*: ProRAW Linear DNG container, `BaselineExposure` anchoring, and `CIRAWFilter` linear extraction.
2. **Apple Developer Documentation** — [`CIRAWFilter`](https://developer.apple.com/documentation/coreimage/cirawfilter) (`boostAmount`, `localToneMapAmount`, `extendedDynamicRangeAmount`, `isGamutMappingEnabled`).
3. **Adobe Inc.** — *Digital Negative (DNG) Specification v1.6 (`ProfileGainTableMap`) & v1.7 / 1.7.1 (`ProfileGainTableMap2`, Tag `52544`)*.
4. **AMPAS** — *ACES 2.0 Output Transform* & Hellwig, L., & Fairchild, M. D. (2022), *Brightness, lightness, colorfulness, and chroma in CIECAM02 and CAM16*, Color Research & Application.
5. **Hasinoff, S. W. et al. (ACM SIGGRAPH Asia 2016)** — *Burst photography for high dynamic range and low-light imaging on mobile cameras*.
6. **Paris, S., Hasinoff, S. W., & Kautz, J. (SIGGRAPH 2011)** / **Aubry, M. et al. (ACM TOG 2014)** — *Local Laplacian Filters*.
7. **Yeganeh, H., & Wang, Z. (IEEE TIP 2013)** — *Objective Quality Assessment of Tone-Mapped Images (TMQI)*.

---

## FAQ

### Why does feeding CIRAWFilter's default boost=1.0, ltm=1.0 directly into 3D film LUTs crush shadows and flatten lighting?
Apple's default settings target ready-to-share Smart HDR rendering by baking 100% `ProfileGainTableMap` local lift and a display-referred S-curve before the LUT runs. Across 7 paired 48 MP ProRAW scenes, this compresses Pre-LUT `EDRMax` to 1.94x, drives `SpatialWarpEV` to 0.240 EV, and pushes `P90 C*` to 27.2. Stacking a film print LUT's own S-curve on top triggers double compression, pushing deep shadow crush ($L^* < 5$) to 14.97% on `Genesis 5207` and 14.63% on `Fuji ClassicNeg`.

### How do you avoid dark, flat renders when lowering localToneMapAmount without locking exposure to 0 EV?
ProRAW intentionally underexposes linear frames by 1.0–1.5 EV to protect highlights and relies on `ProfileGainTableMap` to lift midtones. Keeping `exposure=0` while dialing down `boost` (`0.35 / 0.70`) drops effective gamma to 0.696 and cancels film LUT contrast, while raising both (`0.75 / 0.95`) recreates Smart HDR flattening. Replacing the midtone lift lost from lowering `ltm` (0.95 to 0.50) with a pure scalar linear gain (`exposure = +0.35 EV`) restores contrast and EDR headroom with zero added spatial warping.

### Why does B3-NightAdapt apply a C1 smoothstep taper over EV100 in [1.5, 5.0]?
On a true night skyline (`EV100 = 1.96`, ISO 1250), fixed `B3` (`0.35 / 0.50 / +0.35 EV`) pushes midtone gain to +0.61 EV, lifting night clouds to gray and amplifying shadow noise. Tapering `ltm` from 0.50 to 0.35 and `exposure` from +0.35 to +0.10 EV via a $C^1$ Hermite smoothstep brings night midtone gain back to +0.24 EV, cuts `SpatialWarpEV` to 0.052 EV, and reduces shadow HF noise (`ShNois`) by another 10%, while keeping all `EV100 >= 5.0` daylight and indoor scenes bit-identical to `B3`.

### Why does Espresso split ProRAW tone parameters into three downstream intents?
Downstream consumers have distinct transfer curves: ACEScct and film print LUTs embed full S-curves ($\gamma = 1.09\text{–}1.67$) and require a restrained `B3-NightAdapt` negative; display-referred overlay LUTs like Leica LUX are near-linear ($\gamma = 0.93\text{–}1.13$) and need `0.55 / 0.55 / +0.30 EV` for solid blacks; unfiltered straight-out-of-camera ProRAW has no LUT to supply contrast, so `NoLUT-B` (`0.85 / 0.65 / +0.25 EV`) anchors crisp blacks (`P05 = 5.3`) while still cutting spatial HDR warp by 19% and shadow noise by 16% versus Apple defaults.
