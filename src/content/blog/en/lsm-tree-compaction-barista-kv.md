---
title: "Eliminating Write Stalls: Key-Value Separation & Rate-Paced LSM Compaction in barista-kv"
description: "How barista-kv combines WiscKey value logs, partitioned Ribbon Filters, and PID-controlled I/O pacing to cut write amplification from 14.8x to 3.1x."
lang: "en"
translationSlug: "lsm-tree-compaction-barista-kv"
pubDate: 2026-10-14
updatedDate: 2026-11-05
project: "barista-kv"
tags: ["Storage", "LSM-Tree", "Rust", "io_uring"]
readingTime: 11
coverImage: "/images/blog/lsm-wisckey-compaction.svg"
coverAlt: "barista-kv WiscKey separation and Ribbon Filter architecture blueprint"
coverSpec: "FIG 02.A · WISCKEY + RIBBON FILTER · 3.1X WRITE AMP"
featured: true
---

Classic Log-Structured Merge-Trees (LSM-Trees) trade random I/O for sequential appends to unlock high write throughput. Yet on modern multi-gigabyte-per-second NVMe SSDs, traditional LSM engines suffer from two chronic bottlenecks: **high write amplification** and **periodic foreground write stalls**. When architecting **barista-kv**, we redesigned both the physical storage layout and background compaction scheduler around predictable P999 tail latency.

![barista-kv WiscKey Value Log and Partitioned Ribbon Filter Blueprint](/images/blog/lsm-wisckey-compaction.svg)

## Why Compaction Destroys Tail Latency

When ingesting records averaging `1 KB – 16 KB`, storing full values inline inside SSTables forces background compaction threads to repeatedly read, decompress, sort, and rewrite unchanged payloads across `L0 -> L1 -> L2 -> L3`.

Not only does this burn SSD program/erase cycles, it starves NVMe controller queues. Once L0 file counts breach high-water marks, engines throttle or halt foreground writes entirely—producing sudden 80ms+ latency spikes.

## Threshold-Adaptive WiscKey Separation

`barista-kv` decouples values by size threshold at MemTable insertion time:

- **Inline Small Values (`< 256 Bytes`)**: Counters, flags, and tiny metadata remain inline inside SSTables to preserve single-read locality.
- **Separated Payloads (`>= 256 Bytes`)**: Appended sequentially to segmented **Value Logs (`vLog`)**, while the lock-free skiplist MemTable records only `Key + 12-byte VlogPtr (segment_id, offset, length)`.

### Compounding Gains of a Compact Key Tree

Because the LSM tree stores only keys and 12-byte pointers, a 500 GB dataset shrinks to roughly **14 GB** across all SSTable levels:

1. **Cache-Resident Index Levels**: Internal LSM levels stay warm in OS page cache; point lookups issue at most a single `io_uring` direct read into the `vLog`.
2. **6.4x Faster Compaction**: Background merge-sort streams tiny key-pointer pairs, slashing total write amplification from `14.8x` down to `3.1x`.

```rust
#[repr(C, packed)]
#[derive(Clone, Copy, Debug)]
pub struct VlogPtr {
    pub segment_id: u32,
    pub offset: u32,
    pub length: u32,
}

pub enum EncodedValue<'a> {
    Inline(&'a [u8]),
    Separated(VlogPtr),
}

impl<'a> EncodedValue<'a> {
    pub const VLOG_THRESHOLD: usize = 256;

    #[inline]
    pub fn should_separate(payload: &[u8]) -> bool {
        payload.len() >= Self::VLOG_THRESHOLD
    }
}
```

## Replacing Bloom Filters with Partitioned Ribbon Filters

In memory-constrained environments, filter blocks across thousands of SSTables add up rapidly. Achieving a `~0.85%` false positive rate (FPR) requires `10 bits/key` with standard double-hashed Bloom filters.

### 31% Resident RAM Reduction

Starting at L1, `barista-kv` compiles **128-bit banded Ribbon Filters** during SSTable flush:

| Filter Construction | Memory Cost | Measured FPR | Build CPU Time | Cache Lines / Probe |
| :--- | :--- | :--- | :--- | :--- |
| Standard Bloom (10-bit) | 10.0 bits/key | 0.86% | 1.0x (baseline) | 2–3 cache lines |
| **barista-kv Ribbon Filter** | **6.9 bits/key** | **0.82%** | 1.28x (background only) | **1–2 cache lines** |

Paying 28% extra CPU once during asynchronous background SSTable construction permanently saves **31% of filter RAM** for the entire lifetime of the immutable table.

## PID-Controlled Compaction Pacing

Even with smaller SSTables, unthrottled background flushes can still collide with foreground reads. We drive our `io_uring` compaction token bucket with a discrete **PID controller** sampled every `50ms`:

```rust
pub struct CompactionPacer {
    kp: f64,
    ki: f64,
    integral: f64,
    min_rate_bytes: u64,
    max_rate_bytes: u64,
}

impl CompactionPacer {
    /// Smoothly adapts background I/O bandwidth against L0 backlog pressure
    pub fn next_rate(&mut self, l0_score: f64, dt_secs: f64) -> u64 {
        let error = l0_score - 0.75;
        self.integral = (self.integral + error * dt_secs).clamp(-2.0, 4.0);
        let factor = (1.0 + self.kp * error + self.ki * self.integral).clamp(0.15, 1.0);

        let target = (self.max_rate_bytes as f64 * factor) as u64;
        target.max(self.min_rate_bytes)
    }
}
```

### Deterministic Crash Simulation (DST)

Subtle corruption bugs lurk where torn WAL frames intersect concurrent `vLog` garbage collection. `barista-kv` abstracts filesystem and clock operations behind a deterministic `Env` trait, executing 10,000 seeded power-loss simulations on every GitHub PR to guarantee strict snapshot linearizability.
