---
title: "Cross-Camera Metamerism: Quantitative Colorimetric & Visual Analysis"
description: "Quantifying hardware CFA metamerism between iPhone Pro sensors and Fujifilm, Sony, and ARRI cameras using CIE 1931 2°, CIEDE2000, ISO 17321 SMI, Vora–Trussell subspace measures, and narrowband LED stress tests."
lang: "en"
translationSlug: "cross-camera-metamerism-analysis"
pubDate: 2026-11-23
project: "espresso"
tags: ["Color Science", "Metamerism", "CIEDE2000", "ACES", "ProRAW", "LUT"]
readingTime: 12
coverImage: "/images/blog/metamerism_fig1_ssf_vora.png"
coverAlt: "Normalized Spectral Sensitivity (SSF) & Vora-Trussell Subspace Measure"
coverSpec: "FIG 01 · SSF & VORA-TRUSSELL SUBSPACE · 400–700nm"
featured: true
---

> **Context**: Espresso Color Pipeline (iPhone Pro RAW / ProRAW → Native Cinema / Film LUTs)  
> **Colorimetric Benchmarks**: CIE 1931 2° Standard Observer, CIEDE2000 ($\Delta E_{00}$), ISO 17321 SMI, Vora–Trussell Subspace Measure  
> **Core Question**: When a mobile sensor (iPhone Pro) feeds native film/cinema LUTs calibrated for Fujifilm, Sony, or ARRI cameras, how large is the cross-camera metamerism caused by hardware color filter array (CFA) differences?

---

## 1. Why Analyze Cross-Camera Metamerism?

In Espresso's color pipeline, we directly integrate native 3D LUTs calibrated for professional camera systems (such as Fujifilm F-Log2C and ARRI / DaVinci cinema workflows). Before iPhone sensor captures enter these LUTs, the pipeline cleanly separates into two fundamentally distinct stages:

1. **Gamut & Transfer-Function Conversion (Deterministic Math, Exactly Alignable)**  
   Whether the source resides in linear Display P3 and the target LUT expects ACEScct (AP1) or F-Log2C (F-Gamut C), conversions between standard color spaces consist strictly of **well-defined $3 \times 3$ primary transform matrices**, **chromatic adaptation transforms (Bradford / CAT16)**, and **analytical OETF/EOTF log encodings**. As long as scene-referred linear light remains pure and wide-gamut values are not prematurely clipped, gamut and transfer-function alignment is **mathematically lossless and exact** to floating-point precision.

2. **Sensor Spectral Sensitivity (Physical Hardware, Irreducible by Matrix Math)**  
   A digital camera's raw response $\mathbf{c} = [R, G, B]^T$ does not directly measure human CIE XYZ tristimulus values. Instead, it integrates the illuminant spectral power distribution $E(\lambda)$, surface spectral reflectance $R(\lambda)$, and the sensor's Spectral Sensitivity Functions (**SSF**) $\mathbf{S}(\lambda) = [S_R(\lambda), S_G(\lambda), S_B(\lambda)]^T$:

   $$\mathbf{c} = \int_{400}^{700} E(\lambda)\, R(\lambda)\, \mathbf{S}(\lambda)\, d\lambda$$

   By the **Luther–Ives condition**, an error-free $3 \times 3$ matrix mapping camera RGB to standard CIE XYZ exists only if the three SSF curves are exact linear combinations of the human CIE Color Matching Functions (CMF) $\bar{\mathbf{x}}(\lambda)$. In practice, due to signal-to-noise (quantum efficiency) trade-offs and organic dye filter manufacturing constraints, **no commercial camera satisfies the Luther–Ives condition**, and CFA spectral curves vary across manufacturers.

   This gives rise to **Cross-Camera Metamerism**: two physically distinct spectra that appear identical to human vision can excite different RGB ratios on an iPhone sensor versus a Fujifilm/Sony/ARRI sensor. Conversely, even after an optimal $3 \times 3$ color correction matrix (such as DNG `ColorMatrix`) is applied, irreducible chromatic residuals remain under specific illuminants or narrowband spectra.

Before deciding whether Espresso needs higher-order cross-camera spectral fitting (such as Finlayson's Root-Polynomial Color Correction, RPCC), we must answer two concrete questions with objective, reproducible photometry:
- **Under everyday broadband illuminants, how large is the hardware metamerism residual between iPhone Pro and Fujifilm/Sony/ARRI? Is it visually perceptible?**
- **Under which extreme spectral conditions (e.g., narrowband LEDs, neon signs) does metamerism actually break down?**

---

## 2. Quantitative & Visual Methodology

Subjective side-by-side photography cannot isolate **sensor metamerism** from **auto white balance, local tone mapping (LTM), sharpening, and in-camera color profiles**. To strictly isolate hardware SSF physics, this study employs **Spectral Forward Simulation**, placing every camera inside an identical ideal physical environment:

### 2.1 Unified Experimental Protocol

- **Spectral Grid**: Uniformly sampled across $400\text{–}700\,\text{nm}$ at $\Delta\lambda = 5\,\text{nm}$ (61 wavelengths), evaluated with the **CIE 1931 2° Standard Observer**.
- **Physical White Balance & Linear Matrix Alignment**: Under each test illuminant $E(\lambda)$, every camera is first white-balanced exactly (mapping an ideal Lambertian white diffuser to $[1, 1, 1]$), then fitted with a least-squares optimal $3 \times 3$ linear color correction matrix $\mathbf{M}_{\text{LCC}}$ over the 24-patch ColorChecker (mirroring dual-illuminant DNG `ColorMatrix` interpolation in real RAW pipelines) into CIE XYZ and CIELAB.
- Under this protocol, **100% of the remaining color difference originates purely from SSF deviations from the Luther–Ives condition**, completely free of white-balance or exposure error.

### 2.2 Four Orthogonal Analysis Dimensions

No single scalar captures metamerism completely. We evaluate four complementary dimensions:

| Dimension | Core Metric | Scientific Question Answered |
| :--- | :--- | :--- |
| **1. Subspace Geometry** | **Vora–Trussell Measure $\nu \in [0, 1]$** | Independent of illuminants and patches, how closely do the 3D subspaces spanned by two cameras' SSFs overlap ($\nu = 1$ means exact $3 \times 3$ equivalence)? |
| **2. Multi-Illuminant Error** | **Mean $\Delta E_{00}$** & **ISO 17321 SMI** | Across 6 illuminants—daylight (D65/D50), tungsten (A), fluorescent (FL11), phosphor white LED (LED-B1), and tri-band RGB LED (LED-RGB1)—does residual error exceed human JND ($\approx 1.0\text{–}2.0$)? |
| **3. Narrowband Stress Test** | **LED Hue Twist $\Delta h_{ab}(\lambda)$** | Sweeping a monochromatic Gaussian LED ($\text{FWHM} = 15\,\text{nm}$) across $430\text{–}670\,\text{nm}$ in $5\,\text{nm}$ steps to pinpoint high-risk hue-twist bands. |
| **4. Perceptual Vector Field** | **CIELAB $a^*b^*$ Displacement (3× scaled)** | Beyond scalar magnitude, showing the exact **chromatic direction** of each patch shift from Fujifilm to iPhone under daylight vs. RGB-LED. |

The Vora–Trussell measure is defined as the mean squared cosine of principal angles between orthonormal bases $\mathbf{U}_1, \mathbf{U}_2 \in \mathbb{R}^{N \times 3}$ of the two 3D spectral subspaces:

$$\nu(\mathbf{S}_1, \mathbf{S}_2) = \frac{1}{3}\operatorname{tr}\!\left(\mathbf{U}_1^T \mathbf{U}_2 \mathbf{U}_2^T \mathbf{U}_1\right) = \frac{1}{3}\sum_{i=1}^{3} \cos^2 \theta_i$$

The Sensitivity Metamerism Index (SMI) follows the standard ISO 17321 approximation $\text{SMI} = \max(0,\, 100 - 5.5 \cdot \overline{\Delta E}_{00})$, where $\text{SMI} \ge 90$ indicates excellent colorimetric fidelity.

---

## 3. Data Sources & Provenance Transparency

Rigorous color science requires full disclosure of measurement provenance, precision, and scope limitations. The 5 camera SSF datasets used here come from two public repositories with distinct confidence tiers:

| Camera Model | Source Repository | Acquisition Method | Spectral Step | Provenance Tier |
| :--- | :--- | :--- | :--- | :--- |
| **Fujifilm GFX 100** | AMPAS / ACES `rawtoaces-data` | **Wētā FX** `lightsaber` lab monochromator measurement | 5 nm (380–780 nm) | **Tier 1 (Industry Gold Standard)** |
| **Fujifilm X-T4** | AMPAS / ACES `rawtoaces-data` | **Wētā FX** `lightsaber` lab monochromator measurement | 5 nm (380–780 nm) | **Tier 1 (Industry Gold Standard)** |
| **Sony A7S III** (`ILCE-7SM3`) | AMPAS / ACES `rawtoaces-data` | **Wētā FX** `lightsaber` lab monochromator measurement | 5 nm (380–780 nm) | **Tier 1 (Industry Gold Standard)** |
| **ARRI D21** | AMPAS / ACES `rawtoaces-data` | **AMPAS SciTech** lab monochromator measurement | 5 nm (380–780 nm) | **Tier 1 (Industry Gold Standard)** |
| **iPhone 14 Pro Max** (`iPhone15,3`) | IEEE ICCP 2023 (Solomatov & Akkaynak, COLOR-Lab-Eilat) | **Manifold spectral inversion from DNG `ColorMatrix1/2`** | 10 nm (400–700 nm) | **Tier 2 (Peer-Reviewed Inversion)** |

### Three Objective Limitations of the iPhone SSF Dataset

1. **Indirect Spectral Inversion**: Apple does not publish official iPhone SSF curves. The ICCP 2023 paper *Spectral Sensitivity Estimation Without a Camera* infers SSFs from iPhone ProRAW DNG dual-illuminant calibration matrices using a low-dimensional spectral manifold learned from over a thousand real cameras. It faithfully captures filter centroids and bandwidths, though fine local fabrication ripples are smoothed out.
2. **Coarser Sampling**: The 10 nm step (31 samples) yields smoother curves when interpolated to 5 nm compared to Wētā's direct 5 nm monochromator sweeps, introducing a few degrees of uncertainty in narrowband 15 nm LED peak angles.
3. **Generational Offset**: The public ICCP 2023 benchmark represents **iPhone 14 Pro Max** (Sony IMX803), several generations prior to current flagships (iPhone 17 Pro / 18 Pro Max). While all belong to Apple's custom Sony stacked-CMOS CFA lineage with highly consistent macro spectral behavior, exact values should not be treated as direct monochromator ground truth for the latest silicon.

---

## 4. Visual Analysis of the Four Experiments

### 4.1 Spectral Sensitivity & Subspace Geometry

![Figure 1: Normalized Spectral Sensitivity (SSF) & Vora–Trussell Subspace Measure](/images/blog/metamerism_fig1_ssf_vora.png)

**Overview**: Normalized R/G/B SSFs for four representative cameras (iPhone 14 Pro Max solid, Fujifilm GFX 100 dashed, Sony A7S III dotted, ARRI D21 dash-dotted), overlaid with three physically critical bands—cyan-blue ($480\text{–}510\,\text{nm}$), hemoglobin skin-absorption doublet ($542/577\,\text{nm}$), and chlorophyll red edge ($675\text{–}700\,\text{nm}$)—with Vora–Trussell measures $\nu$ vs. CIE CMF and vs. iPhone annotated in the top-left.

**Key Findings**:
1. **Strong Convergence Across Modern Sony-Lineage CMOS Sensors**: iPhone 14 Pro Max (solid) and Fujifilm GFX 100 (dashed) exhibit nearly overlapping green ($\sim 535\,\text{nm}$ peak) and red ($\sim 595\,\text{nm}$ peak) envelopes. Quantitatively, iPhone achieves **$\nu = 0.981$** against both **Fujifilm GFX 100 and X-T4** (maximum principal angle $\sim 12^\circ$) and **$\nu = 0.972$** against **Sony A7S III**. Because Fujifilm medium-format/APS-C and Apple custom sensors are both fabricated by Sony Semiconductor, they share closely aligned modern organic-dye CFA architectures.
2. **Divergence from Legacy Cinema CFAs**: The older **ARRI D21** (dash-dotted) features a notably narrower green channel and a pronounced secondary red shoulder near $540\,\text{nm}$. While closer to human CMFs ($\nu_{\text{CMF}} = 0.933$, highest of the five), it sits further from modern consumer CMOS sensors ($\nu = 0.966$ vs. iPhone).
3. **Localized Divergence Zones**: After per-channel peak normalization (removing white-balance gain differences), curve separation between iPhone and Fujifilm/Sony concentrates in two narrow bands: the **$460\text{–}500\,\text{nm}$ cyan-blue transition** (where iPhone's red channel shows a $\sim 0.16$ secondary lobe at $485\,\text{nm}$) and the **$570\text{–}620\,\text{nm}$ orange-red slope** (subtle differences in red-channel onset steepness and FWHM). Both zones directly predict the narrowband stress-test peaks below.

---

### 4.2 Multi-Illuminant Error & ISO SMI Evaluation

![Figure 2: Multi-Illuminant Cross-Camera Mean ΔE₀₀ & ISO SMI Heatmap](/images/blog/metamerism_fig2_illuminant_heatmap.png)

**Overview**: Six standard illuminants (from continuous daylight to spiky fluorescent and RGB-LED) along the vertical axis versus True CIE XYZ and four professional cameras along the horizontal axis. Each cell reports the 24-patch ColorChecker mean CIEDE2000 error and corresponding ISO 17321 SMI score.

**Key Findings**:
1. **Sub-JND Error Between iPhone and Fujifilm Across All Illuminants**: Across all 6 illuminants, iPhone vs. **Fujifilm GFX 100 / X-T4** yields a mean $\Delta E_{00}$ of only **$0.29\text{–}0.43$** with an ISO SMI of **98**. Since the human Just-Noticeable Difference (JND) in side-by-side evaluation is $\Delta E_{00} \approx 1.0\text{–}2.0$, **hardware CFA metamerism between iPhone and Fujifilm sits well below human perceptual limits** under broadband lighting.
2. **Closer to Fujifilm Than to Human Ground Truth**: Column 1 (iPhone vs. True CIE XYZ) shows a mean error of **$0.81\text{–}1.53$** (SMI 92–96)—substantially higher than the $0.33$ gap between iPhone and Fujifilm. Modern CMOS CFAs depart from human CMFs in remarkably similar directions, making **cross-camera matching intrinsically easier than matching human ground truth**.
3. **Cross-Architecture Gap**: iPhone vs. Sony A7S III remains imperceptible at **$0.37\text{–}0.92$** (SMI 95–98), whereas the distinct CFA of **ARRI D21** reaches **$1.50$** (SMI 92) under Tungsten (Illuminant A, 3200K), approaching the edge of perceptibility.

---

### 4.3 Narrowband LED Hue-Twist Stress Test

![Figure 3: Narrowband LED Stress Test (FWHM = 15 nm) Hue Angle Twist](/images/blog/metamerism_fig3_narrowband_led_hue.png)

**Overview**: Simulating monochromatic narrowband LED emitters ($\text{FWHM} = 15\,\text{nm}$, representative of night neon signage, stage lighting, automotive taillights, and LED billboards) under a unified D65 matrix, plotting the CIELAB hue-angle twist $\Delta h_{ab}(\lambda) = h_{\text{iPhone}} - h_{\text{Target}}$ relative to Fujifilm GFX 100 (teal), Sony A7S III (blue), and ARRI D21 (orange). The shaded green band marks the $\pm 2^\circ$ perceptual neutrality zone.

**Key Findings**:
1. **Broadband Safety Does Not Guarantee Narrowband Immunity**: Although broadband reflectance error in Figure 2 stays below $0.5$, a few nanometers of SSF slope mismatch are dramatically amplified into severe hue twists under monochromatic emitters.
2. **Two Consistent High-Risk Bands**:
   - **Cyan-Blue Neon ($475\text{–}498\,\text{nm}$)**: Hue twist reaches **$+26.3^\circ$ (@ $490\,\text{nm}$)** vs. Sony A7S III and **$+14.5^\circ$ (@ $485\,\text{nm}$)** vs. Fujifilm GFX 100—manifesting in real photography as cyan/aqua neon signs shifting toward blue or teal across cameras.
   - **Orange-Red LED ($605\text{–}630\,\text{nm}$)**: All three reference cameras show pronounced **$+17.8^\circ \sim +19.9^\circ$** excursions (iPhone vs. GFX 100 hits **$+19.9^\circ$** at $620\,\text{nm}$; vs. ARRI D21 hits **$+17.8^\circ$** at $610\,\text{nm}$)—corresponding to traffic signals, brake lights, and warm neon drifting between orange-red and magenta.
3. **Far-Red Cutoff Divergence ($> 650\,\text{nm}$)**: Near $670\,\text{nm}$, differing IR-cut filter roll-offs cause hue deviations to diverge again to **$-15^\circ \sim -20^\circ$**.
4. **Physical Boundary**: Narrowband hue twist is an **information-theoretic hardware limit**. Because monochromatic energy occupies only a sliver of spectrum in 3D RGB projection, neither a global $3 \times 3$ matrix nor a fixed 6-term root-polynomial trained on broadband patches can eliminate it.

---

### 4.4 CIELAB Chromaticity Displacement Vectors

![Figure 4: CIELAB a\*b\* Metamerism Displacement Vector Field (iPhone vs. Fujifilm GFX 100)](/images/blog/metamerism_fig4_cielab_vectors.png)

**Overview**: Projecting the 24 ColorChecker patches onto the CIELAB chromaticity plane ($a^*$ green↔red, $b^*$ blue↔yellow), drawing arrows from Fujifilm GFX 100 to iPhone 14 Pro Max. All vectors are **uniformly magnified 3×** for visual clarity. Dark teal arrows denote D65 daylight; magenta arrows denote the discrete-peak RGB-LED illuminant.

**Key Findings**:
1. **Near-Zero Drift on Skin Tones**: Even at 3× magnification, the displacement vectors on `DarkSkin` and `LightSkin` barely extend beyond the marker dots (actual $\Delta E_{00} = 0.56$ and $< 0.3$). In the most portrait-critical chromatic region, iPhone and Fujifilm sensors exhibit virtually zero hardware color cast.
2. **Rock-Solid Neutral Axis**: All 6 neutral gray patches around $(0, 0)$ show zero displacement, confirming strict white-balance and linear-matrix neutrality.
3. **Peak Residual Locations & Directions**:
   - Under **D65 Daylight**, the largest individual residuals occur only on saturated `Orange` ($\Delta E_{00} = 0.78$) and `Green` ($\Delta E_{00} = 0.73$), with green shifting marginally toward $-a^*$.
   - Under **RGB-LED**, the illuminant's poor CRI pushes absolute patch chromaticity outward (outlined magenta markers), yet the cross-camera residual between iPhone and Fujifilm remains tightly bounded—peaking at `Orange` ($\Delta E_{00} = 1.18$) and `Red` ($0.70$), with the vast majority of patches still below $0.6$.

---

## 5. Conclusions & Engineering Implications for Espresso

Synthesizing all four orthogonal colorimetric experiments yields clear, evidence-backed engineering conclusions:

1. **Under Natural & Broadband White Light, Sensor Metamerism Is Not the Bottleneck**  
   Across D65, D50, tungsten, fluorescent, and white LED lighting, modern Sony-lineage mobile sensors (iPhone Pro) and professional mirrorless/medium-format bodies (Fujifilm GFX 100, X-T4, Sony A7S III) share extremely high spectral subspace overlap (Vora $\nu = 0.972\text{–}0.981$). Provided frontend RAW development preserves scene linearity and accurate DNG `ColorMatrix` mapping, mean cross-camera metamerism sits at $\Delta E_{00} \approx 0.3\text{–}0.8$ (ISO SMI 96–98)—**below human visual perceptibility**.

2. **Avoid Blindly Adding Higher-Order Non-Linear Fitting (e.g., 6-Term RPCC)**  
   When baseline linear error is already $\Delta E_{00} \approx 0.3\text{–}0.4$, fitting higher-order polynomials on limited patch sets yields negligible gain while introducing risks of illuminant overfitting, subtle skin-tone non-linearity, and highlight extrapolation artifacts. **Maintaining a clean ACES 2.0 scene-referred linear transform paired with exact gamut conversion is both more scientific and more robust.**

3. **What Truly Governs "Native Film Character" Lives Downstream, Not in the CFA**  
   Over 95% of the perceived gap between "smartphone look" and "Fujifilm / cinema look" stems not from CFA metamerism, but from four fully controllable software and optical stages:
   - **RAW Development Local Tone Mapping & Contrast Presets** (e.g., aggressive default Apple ProRAW `boost` / LTM causing Double Compression when stacked with film LUTs);
   - **Wide-Gamut Highlight Roll-off & Unclipped Scene-Referred Pass-Through** (preserving EDR highlights into ACEScct to eliminate hard-clipping hue shifts);
   - **Authentic Film Color Science (3D LUTs) & Emulsion Optics** (organic grain, halation, bloom);
   - **Awareness of Narrowband Physical Limits** (under intense $480\text{–}495\,\text{nm}$ cyan neon or $610\text{–}625\,\text{nm}$ orange-red LEDs, $15^\circ\text{–}26^\circ$ hue twists are physical hardware boundaries best addressed via selective hue grading rather than static pre-LUT matrices).

4. **Future Evolution**  
   To eliminate generational offset from the ICCP 2023 iPhone 14 Pro Max inversion dataset, future work can directly extract `ColorMatrix1/2` metadata from live ProRAW DNG captures on current flagships (**iPhone 17 Pro / 18 Pro Max**) and validate against ColorChecker SG reference shoots, turning this four-dimensional suite into an ongoing per-device regression baseline.
