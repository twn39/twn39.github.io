---
title: "Zero-Copy Image Bridging: Engineering pylibheif with nanobind and Python Buffer Protocol"
description: "Inside pylibheif: decoupling C++ plane lifetimes via nanobind capsules, PEP 3118 stride-aware NumPy views, and >300k OPS GIL-free streaming I/O."
lang: "en"
translationSlug: "nanobind-zero-copy-pylibheif"
pubDate: 2026-11-12
updatedDate: 2026-11-16
project: "pylibheif"
tags: ["Python", "C++", "nanobind", "HEIC", "AVIF"]
readingTime: 9
coverImage: "/images/blog/pylibheif-zero-copy.svg"
coverAlt: "pylibheif nanobind zero-copy buffer protocol and streaming I/O diagram"
coverSpec: "FIG 01 · NANOBIND ZERO-COPY · >300K OPS"
featured: true
---

Decoding high-resolution HEIC captures, AVIF web assets, or JPEG2000 containers in Python traditionally forces painful memory copies across language boundaries (`libheif C heap -> temporary C++ vector -> Python bytes -> NumPy ndarray`). On a single 48-megapixel 10-bit RGB frame, redundant copies burn nearly `280 MB` of memory bandwidth before any vision model or image filter even runs.

In **[twn39/pylibheif](https://github.com/twn39/pylibheif)**, we re-engineered the Python/C++ boundary on top of `nanobind` to deliver true bidirectional zero-copy plane sharing and multi-threaded streaming codecs.

![pylibheif Zero-Copy Capsule Bridge and Streaming Architecture](/images/blog/pylibheif-zero-copy.svg)

## Why `nanobind` Over Legacy Binding Generators

Compared with older `pybind11` or `CFFI` wrappers, `nanobind` targets modern C++17 and Python 3.11+ Vectorcall conventions directly:

1. **Compact Binaries & Nanosecond Dispatch**: Stripped shared library size drops by over 60% with minimal per-call type-lookup overhead.
2. **Native Stride-Aware `nb::ndarray`**: Exposes PEP 3118 Buffer Protocol and DLPack views directly to NumPy and PyTorch without compile-time NumPy C-API coupling.

## Decoupling Cross-Language Memory Lifetimes

Passing raw pointers across C++ and Python is trivial; preventing dangling pointers when SIMD row-stride padding is present is the real engineering challenge.

### Decode Path: Stride-Preserving NumPy Views

SIMD-aligned decoders in `libheif` frequently allocate scanlines where `stride > width * channels`. Rather than copying rows to pack them contiguously, `pylibheif` ties a reference-counted C++ guard to a `nanobind::capsule` owner and exposes the exact hardware stride tuple directly to NumPy:

```cpp
int stride = 0;
const uint8_t* plane_ptr = heif_image_get_plane_readonly(img_ptr, heif_channel_interleaved, &stride);

// Capsule retains the underlying heif_image alive for as long as any Python view references it
nb::capsule owner(new std::shared_ptr<HeifImageGuard>(guard), [](void* p) noexcept {
    delete static_cast<std::shared_ptr<HeifImageGuard>*>(p);
});

size_t shape[3] = { height, width, channels };
int64_t strides[3] = { stride, channels, 1 };
return nb::ndarray<nb::numpy, const uint8_t>(plane_ptr, 3, shape, owner, strides);
```

### Encode Path: `write_to_memoryview()`

For transcoding services writing AVIF or HEIC payloads straight to sockets or object-store SDKs, `write_to_memoryview()` wraps the C++ encoder output buffer as a read-only Python `memoryview` with decoupled ownership—bypassing `PyBytesObject` allocation completely.

## GIL-Free Multi-Core Codecs & >300k OPS Stream I/O

- **Uncontended Parallelism (`nb::gil_scoped_release`)**: Heavy HEVC and AV1 entropy coding runs entirely outside the Python GIL, scaling linearly across `ThreadPoolExecutor` workers.
- **Custom Virtual Stream Readers/Writers**: Custom `heif_reader` and `heif_writer` dispatchers stream directly over Python `BytesIO` and file-like objects at over **300,000 I/O operations per second**.
