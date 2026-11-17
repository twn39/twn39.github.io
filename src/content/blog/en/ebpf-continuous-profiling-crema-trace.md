---
title: "Sub-0.6% Overhead Profiling: In-Kernel eBPF DWARF Stack Unwinding in crema-trace"
description: "How crema-trace unwinds stripped Rust, C++, and Wasm JIT stacks directly inside eBPF using pre-indexed .eh_frame tables without frame pointers."
lang: "en"
translationSlug: "ebpf-continuous-profiling-crema-trace"
pubDate: 2026-09-29
updatedDate: 2026-11-15
project: "crema-trace"
tags: ["eBPF", "Linux Kernel", "Observability", "Profiling"]
readingTime: 9
coverImage: "/images/blog/ebpf-profiler-pipeline.svg"
coverAlt: "crema-trace in-kernel eBPF DWARF stack unwinder and symbolizer pipeline"
coverSpec: "FIG 03.A · EBPF DWARF UNWINDER · < 0.6% CPU"
featured: true
---

Diagnosing transient P99 CPU spikes in production often hits two walls: on-demand `perf record` sessions arrive minutes after the anomaly has already dissipated, and release-grade Rust/C++ binaries plus system shared libraries typically compile with `-fomit-frame-pointer`—turning `RBP` / `X29` into a general-purpose register and breaking naive frame-pointer stack walkers after two frames.

We built **crema-trace** around an uncompromising goal: **zero code instrumentation, zero binary recompilation, and continuous 24/7 fleet-wide profiling at under 0.6% CPU overhead**.

![crema-trace In-Kernel eBPF DWARF Unwinder and Symbolizer Pipeline](/images/blog/ebpf-profiler-pipeline.svg)

## Why Copying Raw User Stacks Fails at Scale

Traditional DWARF profilers copy `8 KB – 64 KB` of raw user-space stack memory out of the kernel on every PMU timer interrupt so `libunwind` can parse DWARF expressions in user space. Under heavy concurrency, copying megabytes of stack bytes per second saturates ring buffers and burns 4–6% CPU.

### Compiling `.eh_frame` into Compact BPF Lookup Tables

Every modern ELF binary already carries an `.eh_frame` section describing how to recover the Canonical Frame Address (CFA) and return address from any program counter (`PC`). Whenever `crema-trace` observes a new executable `mmap`, it Ahead-of-Time flattens `.eh_frame` CIE/FDE bytecode into sorted 8-byte rows stored inside `BPF_MAP_TYPE_ARRAY`:

```c
// Compact 8-byte unwind rule sorted by relative PC offset
struct unwind_row {
    __u32 pc_offset;
    __u8  cfa_reg;     // RSP / RBP / PLT expression tag
    __u8  ra_mode;     // Stack slot offset or direct link register
    __s16 cfa_offset;  // Compressed 8-byte aligned offset
};

SEC("perf_event")
int profile_cpu_sample(struct bpf_perf_event_data *ctx) {
    __u64 ip = PT_REGS_IP(&ctx->regs);
    __u64 sp = PT_REGS_SP(&ctx->regs);
    __u64 bp = PT_REGS_FP(&ctx->regs);

    #pragma unroll
    for (int depth = 0; depth < MAX_STACK_DEPTH; depth++) {
        const struct unwind_row *row = bsearch_eh_table(ip);
        if (!row) break;
        if (step_frame(row, &ip, &sp, &bp) < 0) break;
        record_frame(depth, ip);
    }
    return 0;
}
```

## Verifier-Friendly Bounded Binary Search

To satisfy the Linux BPF verifier's strict instruction bounds even on large monoliths containing 250,000+ unwind entries, our in-kernel lookup executes a fixed-depth 18-step binary search (`2^18 = 262,144 rows`), resolving each stack frame in ~`45ns` entirely inside kernel context.

## Production Overhead Comparison (99 Hz All-Core)

Measured across a 32-core production API gateway node:

| Unwinding Strategy | Requires `-fno-omit-fp` Rebuild | Agent CPU Cost | Agent RSS Memory | Stack Completeness |
| :--- | :--- | :--- | :--- | :--- |
| Frame Pointers (`bpf_get_stackid`) | Yes (entire dependency tree) | **0.35%** | 12.0 MB | 61% (truncated in libc/ssl) |
| Raw Stack Copy + User `libunwind` | No | 4.80% | 145.0 MB | 99.1% |
| **crema-trace (In-Kernel .eh_frame)** | **No** | **0.54%** | **18.4 MB** | **99.4%** |

## Build-ID Deferred Symbolization & Differential Flamegraphs

Rather than loading gigabytes of `.debug_info` symbols onto production hosts, the `crema-trace` node agent emits deduplicated `(GNU Build-ID, FileOffset, Count)` tuples over Arrow IPC, enabling instant release-over-release differential flamegraphs in CI and production.
