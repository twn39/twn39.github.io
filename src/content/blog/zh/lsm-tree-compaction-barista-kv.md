---
title: "消除写入停顿：barista-kv 中的键值分离与自适应 LSM Compaction"
description: "剖析嵌入式存储引擎 barista-kv 如何结合 WiscKey 思想、分区 Ribbon Filter 与 PID 后台限速调度，将写放大从 14.8x 降至 3.1x。"
lang: "zh"
translationSlug: "lsm-tree-compaction-barista-kv"
pubDate: 2026-10-14
updatedDate: 2026-11-05
project: "barista-kv"
tags: ["Storage", "LSM-Tree", "Rust", "io_uring"]
readingTime: 11
coverImage: "/images/blog/lsm-wisckey-compaction.svg"
coverAlt: "barista-kv WiscKey 键值分离与 Ribbon Filter 架构图"
coverSpec: "FIG 02.A · WISCKEY + RIBBON FILTER · 3.1X WRITE AMP"
featured: true
---

经典 LSM-Tree（Log-Structured Merge-Tree）通过将随机写转化为顺序追加写，换取了极高的写入吞吐。然而在现代高带宽 NVMe SSD 上，经典 LSM-Tree 暴露出两大顽疾：**严重的写放大（Write Amplification）** 与 **周期性的前台写入停顿（Write Stalls）**。在设计开源存储内核 **barista-kv** 时，我们围绕「零停顿尾延迟」重构了存储布局与后台合并管线。

![barista-kv 键值分离与分区 Ribbon Filter 架构蓝图](/images/blog/lsm-wisckey-compaction.svg)

## 为什么传统 Compaction 会拖垮 P999 延迟

当业务写入平均大小为 `1 KB – 16 KB` 的记录时，若将 Key 与完整的 Value 一同打包进 SSTable，每当数据从 `L0 -> L1 -> L2 -> L3` 逐层归并排序，同一份未曾修改过的 Value 载荷会被反复读取、解压、重编码并落盘十余次。

这种无效搬运不仅加速消耗 SSD 擦写寿命，更会占满 NVMe 控制器的内部垃圾回收带宽，一旦 L0 文件堆积超过阈值，存储引擎不得不主动阻塞前台写入线程，导致业务侧观测到数十甚至上百毫秒的 P999 毛刺。

## WiscKey 阈值式键值分离设计

`barista-kv` 引入了阈值自适应的键值分离策略：

- **内联小值 (`< 256 Bytes`)**：计数器、状态位与短元数据直接内联存储在 LSM-Tree 的 SSTable 中，保持单次 I/O 点查局部性。
- **分离大值 (`>= 256 Bytes`)**：直接顺序追加写入独立的环形段文件 **Value Log (`vLog`)**，而在 LSM-Tree 的无锁跳表（MemTable）中仅写入 `Key + 12字节 vLog 指针 (SegmentID: u32, Offset: u32, Len: u32)`。

### 紧凑索引树的链式收益

由于整棵 LSM-Tree 只保存定长指针与紧凑键，原本 500 GB 的数据集在 LSM 索引树中仅占约 **14 GB**：

1. **整棵 LSM 索引可常驻 Page Cache**：点查与范围定位几乎不触发多层磁盘随机读，仅最后一步通过 `io_uring` 直接按偏移量读取一次 `vLog`。
2. **Compaction 吞吐提升 6.4 倍**：后台线程归并排序时只需搬运轻量级指针，写放大系数从 `14.8x` 骤降至 `3.1x`。

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

## 用分区 Ribbon Filter 替代经典 Bloom Filter

在内存受限的边缘与嵌入式设备上，每张 SSTable 的过滤器内存开销不容忽视。若维持约 `0.85%` 的假阳性率（FPR），标准双哈希 Bloom Filter 需要约 `10 bits/key`。

### 节省 31% 内存的线性方程组过滤器

`barista-kv` 在 L1 及更深层级默认启用 **Band-width 128 Ribbon Filter**（Rapid Incremental Boolean Banding ON the fly）：

| 过滤器类型 | 每键内存开销 | 实测假阳性率 (FPR) | 构建 CPU 耗时 | 点查缓存行访问 |
| :--- | :--- | :--- | :--- | :--- |
| Standard Bloom (10-bit) | 10.0 bits/key | 0.86% | 1.0x (基准) | 2–3 cache lines |
| **barista-kv Ribbon Filter** | **6.9 bits/key** | **0.82%** | 1.28x (仅后台构建) | **1–2 cache lines** |

由于 SSTable 是在后台 Compaction 阶段一次性静态构建的，多付出 28% 的一次性高斯消元构建 CPU 时间，即可换取生命周期内 **永久降低 31% 的常驻内存占用**，这笔工程账极其划算。

## 基于 PID 控制器的无停顿 I/O 限速器

即便写放大显著降低，突发流量下的 L0 刷盘与 vLog 垃圾回收如果毫无节制地争抢磁盘队列，依然会干扰前台点查。我们在后台调度器中实现了一个每 `50ms` 采样一次的 **离散 PID 速率控制器**：

```rust
pub struct CompactionPacer {
    kp: f64,
    ki: f64,
    integral: f64,
    min_rate_bytes: u64,
    max_rate_bytes: u64,
}

impl CompactionPacer {
    /// 根据当前 L0 待合并积压分值动态平滑后台 I/O 令牌桶速率
    pub fn next_rate(&mut self, l0_score: f64, dt_secs: f64) -> u64 {
        // 目标水位线：保持 L0 score 稳定在 0.75，既不积压也不抢占前台带宽
        let error = l0_score - 0.75;
        self.integral = (self.integral + error * dt_secs).clamp(-2.0, 4.0);
        let factor = (1.0 + self.kp * error + self.ki * self.integral).clamp(0.15, 1.0);

        let target = (self.max_rate_bytes as f64 * factor) as u64;
        target.max(self.min_rate_bytes)
    }
}
```

### 确定性故障注入测试 (DST)

存储引擎最危险的缺陷往往隐藏在「断电瞬间 WAL 半页写入」与「vLog 垃圾回收并发崩溃」的交界处。`barista-kv` 将文件系统与时钟完全抽象为 `Env` Trait，在每次 GitHub Actions 提交时以随机种子运行 10,000 轮模拟断电恢复验证，确保任何时刻杀掉进程都不会破坏已提交快照的线性一致性。
