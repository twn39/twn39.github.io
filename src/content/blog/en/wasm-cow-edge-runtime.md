---
title: "Sub-Millisecond Edge Isolates: Building a Rust + Wasm Runtime with CoW Snapshots"
description: "Inside espresso-runtime: combining Wasmtime pre-initialized memory pools with Linux madvise(MADV_DONTNEED) to hit 0.38ms P99 cold starts."
lang: "en"
translationSlug: "wasm-cow-edge-runtime"
pubDate: 2026-10-28
updatedDate: 2026-11-12
project: "espresso-runtime"
tags: ["Rust", "WebAssembly", "Edge Runtime", "Linux VM"]
readingTime: 9
coverImage: "/images/blog/wasm-cow-snapshot.svg"
coverAlt: "espresso-runtime Copy-on-Write linear memory snapshot architecture diagram"
coverSpec: "FIG 01.A · COW MEMORY POOL · P99 0.38MS"
featured: true
---

In multi-tenant edge computing, every incoming HTTP request may wake a tenant function that has zero warm instances on the local POP. Container cold starts sit in the hundreds of milliseconds, and even standard V8 isolates frequently land in the `8ms–15ms` window once routing tables and cryptographic contexts initialize. In **espresso-runtime**, our goal was strict: keep **P99 cold-start latency below 0.5ms** while sustaining over 12,000 concurrent isolates per physical core.

![Copy-on-Write Linear Memory Pool and Isolate Pipeline](/images/blog/wasm-cow-snapshot.svg)

## Why Naive Wasm Instantiation Still Lags

Compiling guest code to `.wasm` does not automatically guarantee microsecond cold starts in real workloads. A production edge handler goes through three distinct phases before serving its first byte:

1. **AOT Machine Code Mapping**: Mapping a pre-compiled Cranelift `.cwasm` ELF image via `mmap` takes roughly `35μs`—genuinely fast.
2. **Linear Memory Allocation & Data Segments**: Zeroing the initial `16 pages (1MB)` of linear memory and copying static rodata segments.
3. **Guest Runtime Bootstrapping (`_initialize`)**: Compiling regex automata, building Radix router tries, and initializing allocator metadata routinely burns `3ms–6ms` of CPU time on every fresh isolate.

### Build-Time Pre-Initialization (Frozen Master Image)

Instead of re-running deterministic initialization on every edge invocation, we execute the `espresso_init()` hook once during CI artifact compilation. After the guest builds its routing tables and schema validators in memory, we freeze all non-zero linear memory pages into a content-addressed **Frozen Master Image**.

```rust
use anyhow::Result;
use wasmtime::{InstancePre, Store};

pub struct SnapshotSlot {
    /// Read-only master heap shared across all concurrent isolates
    master_heap: memmap2::Mmap,
    instance_pre: InstancePre<RequestCtx>,
}

impl SnapshotSlot {
    pub fn spawn_isolate(&self, req: IncomingRequest) -> Result<IsolateHandle> {
        let mut store = Store::new(self.instance_pre.module().engine(), RequestCtx::new(req));
        // Deterministic instruction budget prevents catastrophic regex backtracking
        store.set_fuel(500_000)?;
        let instance = self.instance_pre.instantiate(&mut store)?;
        Ok(IsolateHandle { store, instance })
    }
}
```

## Virtual Memory Pooling via `MAP_PRIVATE` & `MADV_DONTNEED`

Calling `memcpy` across megabytes of snapshot heap for 10,000 RPS would saturate memory bandwidth immediately. Instead, we lean directly on the hardware MMU.

### 4KB Page-Granular Copy-on-Write

Each worker slot maps its linear memory directly over the frozen snapshot file descriptor using `mmap(..., PROT_READ | PROT_WRITE, MAP_PRIVATE, snapshot_fd, 0)`:

- **Shared Clean Pages (94.2%)**: Static lookup tables, router tries, and constant buffers remain backed by **one single copy** of physical RAM frames across thousands of active isolates.
- **On-Demand Dirty Pages (~48KB/req)**: Physical 4KB pages are allocated via minor page faults strictly when guest code mutates stack frames or heap blocks.

### Microsecond Slot Reset Without TLB Shootdowns

When a request finishes, tearing down virtual address mappings with `munmap` + `mmap` causes severe `mmap_lock` contention and cross-core TLB shootdowns. Instead, we keep virtual slots pinned and discard only the mutated page ranges via `madvise(MADV_DONTNEED)`:

```rust
/// Instantly reverts mutated guest heap pages back to the read-only master snapshot
/// without acquiring write locks on the kernel VMA tree.
#[inline]
pub unsafe fn reset_dirty_pages(base_ptr: *mut u8, dirty_range: Range<usize>) -> io::Result<()> {
    let aligned_ptr = base_ptr.add(dirty_range.start & !4095);
    let aligned_len = (dirty_range.len() + 4095) & !4095;

    let ret = libc::madvise(
        aligned_ptr.cast::<libc::c_void>(),
        aligned_len,
        libc::MADV_DONTNEED,
    );
    if ret != 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(())
}
```

> **Engineering Note**: On Linux 6.12 across 64 cores, pinned virtual slots reset via `MADV_DONTNEED` dropped kernel lock contention from 38% down to 2.1% compared to per-request `mmap`/`munmap` cycling.

## Production Cold-Start Benchmarks

Measured across 100,000 cold invocations on AMD EPYC 9654 running a realistic gateway workload (HMAC-SHA256 verification + Radix route dispatch + streaming JSON transform):

![Edge Runtime Cold-Start P99 Benchmark](/images/blog/wasm-latency-bench.svg)

| Runtime Architecture | P50 Cold Start | P99 Cold Start | RSS Delta / Isolate | Max Isolates / Core |
| :--- | :--- | :--- | :--- | :--- |
| **espresso-runtime (CoW)** | **0.19 ms** | **0.38 ms** | **48 KB** | **12,400+** |
| Raw Wasm Instantiate | 3.10 ms | 4.92 ms | 1.1 MB | 2,800 |
| V8 Isolate Snapshot | 6.80 ms | 11.40 ms | 3.2 MB | 950 |
| MicroVM Snapshot Restore | 84.0 ms | 125.0 ms | 24.0 MB | 140 |

## Deterministic Isolation Boundaries

Speed means little without strict multi-tenant safety:

### Dual Preemption & Hard Heap Caps

1. **Hybrid Fuel + Epoch Interruption**: Loop backedges decrement a register-allocated fuel counter capped at `500,000` units per request, cleanly yielding runaway guests without starving Tokio worker threads.
2. **Bounded Linear Memory (`4 MB`)**: Custom `ResourceLimiter` hooks reject runaway allocations inside the guest allocator cleanly before host OOM conditions can ever arise.

All snapshot pool primitives and benchmark harnesses are available under Apache-2.0 in `espresso-lab/espresso-runtime`.
