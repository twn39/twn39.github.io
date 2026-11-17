---
title: "Real-Time Film Color Science: Inside Espresso's Metal 3D LUT, Scene-Referred RAW & ANE Super-Resolution Pipeline"
description: "Architecting the iOS film-simulation camera Espresso: headless EspressoCore color math, Bayer/ProRAW linear development, and CoreML PiperSR-2x."
lang: "en"
translationSlug: "espresso-metal-lut-proraw-pipeline"
pubDate: 2026-11-16
updatedDate: 2026-11-17
project: "espresso"
tags: ["Swift 6", "Metal", "Color Science", "ProRAW", "CoreML"]
readingTime: 10
coverImage: "/images/blog/espresso-metal-lut.svg"
coverAlt: "Espresso camera scene-referred RAW, Metal 3D LUT, and CoreML super-resolution pipeline"
coverSpec: "FIG 07 · METAL 3D LUT + BAYER RAW · 60FPS"
featured: true
---

Most mobile filter apps apply simple RGB color matrices on top of display-referred 8-bit sRGB frames after the system ISP has already baked in aggressive local tone-mapping and digital sharpening—producing clipped highlights and brittle digital edges. When building **[Espresso — True Color Film Cam](https://apps.apple.com/us/app/espresso-true-color-film-cam/id6802915035)** for iOS, we anchored the entire imaging pipeline on physical film sensitometry: **performing chromatic adaptation, halation scatter, and 3D LUT grading in scene-referred linear space**.

![Espresso Scene-Referred Color Science, Metal 3D LUT, and Dual GPU Pipeline](/images/blog/espresso-metal-lut.svg)

## Headless Color Mathematics: `EspressoCore`

To keep color science deterministic and testable on macOS in under `0.2s` without spinning up an iOS simulator, every colorimetric transform lives inside a zero-UIKit, zero-Metal Swift Package `EspressoCore`:

- **Bradford & CAT16 Chromatic Adaptation**: Computes white-balance temperature and tint shifts in LMS cone-response space, avoiding the green skin-tone casts caused by naive RGB channel scaling.
- **Streaming `.cube` Parser & Vectorized Texture Packing**: Streams 33³ and 65³ LUT tables straight into GPU-aligned `RGBA16Float` 3D texture buffers.
- **Physical Emulsion Optics**: Models red-layer halation scatter, highlight bloom, monotonic cubic spline tone curves, and luminance-weighted silver-halide grain as pure composable domain structs.

## Dual Metal GPU Pipeline: 60Hz Live Preview & Actor Darkroom

Live viewfinder responsiveness and full-resolution 48MP photo capture have fundamentally different latency and memory profiles:

### 1. Zero-Copy `MTKView` Live Viewfinder Pass

Incoming `CVPixelBuffer` camera frames map directly into Metal textures via `CVMetalTextureCache` with zero CPU copies, executing trilinear `MTLTextureType3D` sampling and optical vignette composition in a single 60Hz fragment pass.

### 2. Actor-Isolated Metal Compute Still Development

When the shutter fires, single-frame Bayer CFA RAW or Apple ProRAW buffers hand off asynchronously to a dedicated serial actor `PhotoCaptureProcessor`:

```swift
actor PhotoCaptureProcessor {
    private let device: MTLDevice
    private let commandQueue: MTLCommandQueue
    private let lutLibrary: LUTLibrary

    func developCapture(
        rawSample: RawPhotoPayload,
        recipe: FilmSimulationRecipe
    ) async throws -> EncodedPhoto {
        // 1. Decode scene-referred linear Bayer CFA / Apple ProRAW with highlight recovery
        let linearTexture = try RawDevelopEngine.decodeSceneLinear(rawSample, on: device)

        // 2. Fetch cached .eslx / .cube 3D texture and dispatch Metal compute pipeline
        let lut3D = try await lutLibrary.texture3D(for: recipe.simulation)
        let gradedTexture = try dispatchFilmComputePass(
            source: linearTexture,
            lut: lut3D,
            optics: recipe.opticsParameters
        )

        // 3. Compose darkroom EXIF border typography and encode Display P3 HEIC
        return try CaptureStillEncoder.encodeDisplayP3HEIC(gradedTexture, metadata: rawSample.exif)
    }
}
```

## CoreML ANE 2x Neural Super-Resolution (`PiperSR-2x`)

For cropped telephoto focal lengths (`35mm` and `50mm` equivalents), `Espresso` runs a quantized `PiperSR-2x` super-resolution network on the Apple Neural Engine (ANE) *before* applying film grain and halation—preserving crisp optical micro-contrast wrapped in authentic analog texture.
