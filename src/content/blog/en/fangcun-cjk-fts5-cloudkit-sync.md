---
title: "Local-First Craft in Fangcun: Custom CJK FTS5 Tokenization, Procedural Stamp Geometry & CKSyncEngine"
description: "Inside the iOS stamp camera Fangcun: three-phase Saga crash-safe storage, embedded SQLite CJK FTS5 search, and CloudKit tombstone sync."
lang: "en"
translationSlug: "fangcun-cjk-fts5-cloudkit-sync"
pubDate: 2026-11-08
updatedDate: 2026-11-16
project: "fangcun"
tags: ["Swift 6", "GRDB", "SQLite FTS5", "CloudKit", "iOS"]
readingTime: 9
coverImage: "/images/blog/fangcun-local-first.svg"
coverAlt: "Fangcun stamp camera three-phase Saga storage, cjkfts5 search, and CloudKit sync diagram"
coverSpec: "FIG 08 · LOCAL-FIRST GRDB + CJK FTS5 · IOS 18+"
featured: true
---

**[Fangcun — Stamp Camera](https://apps.apple.com/us/app/fangcun-stamp-camera/id6795181081)** turns everyday photography into collectible vintage postage stamps on iOS. Beneath its tactile journal aesthetic sit three classic local-first engineering challenges: **guaranteeing zero lost captures across filesystem and database writes, delivering instant offline CJK full-text search, and resolving multi-device deletion conflicts over iCloud**.

![Fangcun Local-First GRDB Storage, CJK FTS5 Search, and CKSyncEngine Architecture](/images/blog/fangcun-local-first.svg)

## Non-Destructive Coordinates & Procedural Perforations

Baking jagged stamp borders permanently into raster bitmaps at capture time would lock users out of re-framing or changing perforation gauges later. `Fangcun` decouples master assets from geometry:

1. **Master Image + Normalized `[0, 1]` Crop Rects**: Full-resolution originals stay untouched on disk while SQLite stores normalized crop projections and perforation pitch presets.
2. **Resolution-Independent `UIBezierPath` Boolean Arcs**: Semicircular stamp perforations are synthesized procedurally at target pixel density—staying razor-sharp from compact Widget thumbnails up to 4K print exports.

## Three-Phase Capture Saga & Single Fan-Out Snapshots

Because filesystem writes and SQLite transactions span two distinct storage engines, `StampCapturePipeline` enforces a strict compensating Saga:

```
Stage 1: Write captured asset to sandboxed .tmp file and flush
Stage 2: Atomically promote asset into permanent storage directory
Stage 3: Commit GRDB 7 SQLite WAL record (running compensating file rollback on DB failure)
```

Upon commit, `StampStorageService` acts as the sole mutation fan-out broadcaster—notifying `@Observable` timelines and writing a lock-free JSON snapshot into the App Group container for `WidgetKit`, completely avoiding multi-process SQLite WAL lock contention (`0xdead10cc` crashes).

## Embedded `cjkfts5` Tokenizer & Tombstone `CKSyncEngine`

SQLite's stock `unicode61` tokenizer splits on whitespace, failing to recall unspaced Chinese, Japanese, and Korean journal notes. We embedded a custom C-level **`cjkfts5` SQLite tokenizer** packaged via SwiftPM alongside keyset cursor pagination for sub-millisecond search across tens of thousands of stamps.

For multi-device iCloud sync, `Fangcun` pairs Apple's `CKSyncEngine` with **deferred 30-day tombstone garbage collection**: deletions record `isDeleted = true` first so soft-delete tombstones propagate reliably across offline devices before background maintenance reclaims physical image files.
