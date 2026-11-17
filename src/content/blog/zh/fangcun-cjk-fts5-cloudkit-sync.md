---
title: "方寸之间的本地优先架构：邮票相机中的自研 CJK FTS5 分词、无损几何与 CloudKit 同步"
description: "复盘 iOS 应用「方寸 · 邮票相机」的工程细节：三阶段 Saga 落盘保证、内嵌 SQLite CJK 分词器与 CKSyncEngine 软删同步。"
lang: "zh"
translationSlug: "fangcun-cjk-fts5-cloudkit-sync"
pubDate: 2026-11-08
updatedDate: 2026-11-16
project: "fangcun"
tags: ["Swift 6", "GRDB", "SQLite FTS5", "CloudKit", "iOS"]
readingTime: 9
coverImage: "/images/blog/fangcun-local-first.svg"
coverAlt: "方寸邮票相机三阶段 Saga 存储、自研 cjkfts5 分词与 CloudKit 同步管线"
coverSpec: "FIG 08 · LOCAL-FIRST GRDB + CJK FTS5 · IOS 18+"
featured: true
---

**[方寸 — 邮票相机](https://apps.apple.com/cn/app/id6795181081)** 是一款将日常影像转化为可收藏手账邮票的 iOS 原生应用。看似轻盈浪漫的集邮体验背后，隐藏着三个严肃的客户端数据工程命题：**如何保证拍摄瞬间绝不丢图？如何支持中英日韩多语种手账笔记的毫秒级离线全文搜索？以及如何在本地 SQLite 与 iCloud 私有库之间优雅解决删除冲突？**

![方寸邮票相机本地优先存储、CJK FTS5 检索与 CloudKit 同步架构](/images/blog/fangcun-local-first.svg)

## 无损归一化坐标与程序化齿孔几何

如果拍摄时直接把锯齿白边「烤死」在位图文件里，用户后续就永远无法更改齿孔粗细或重新构图。`方寸` 采用了非破坏性存档模型：

1. **原图与归一化变换解耦**：磁盘保存完整高清原图，数据库仅记录 `[0, 1]` 归一化空间下的裁切矩形与齿孔档位（小 / 中 / 大）。
2. **`UIBezierPath` 程序化半圆布尔齿孔**：无论是在时间线缩略图、桌面 Widget 还是导出 4K 分享海报时，均按目标物理像素实时计算精确等距半圆齿孔路径，边缘永远锐利无锯齿。

## 三阶段 Saga 拍摄落盘与唯一变更广播

文件 I/O 与 SQLite 事务分属两个独立存储系统。为了彻底杜绝「数据库有记录但图片未写完」或「产生孤儿文件」，`StampCapturePipeline` 严格执行三阶段 Saga 协议：

```
Stage 1: 写入临时沙盒文件 (.tmp) 并完成 fsync 校验
Stage 2: 原子 rename 提升至正式图片目录
Stage 3: 写入 GRDB SQLite WAL 事务（若 DB 失败则自动触发补偿清理删除已提升文件）
```

写操作成功后，由 `StampStorageService` 作为全局**唯一扇出点（Single Fan-Out）**触发 `StampDataChange.notify`，同步刷新 UI 时间线并将「今日邮票」序列化为无锁 JSON 快照写入 App Group 供 `WidgetKit` 读取，彻底规避多进程共享 SQLite WAL 文件常见的 `0xdead10cc` 挂起崩溃。

## 内嵌 `cjkfts5` 分词器与 `CKSyncEngine` 墓碑同步

SQLite 内置的默认 `unicode61` 分词器按空格切词，面对不加空格的中文、日文手账札记几乎无法完成精确子串召回。我们以本地 Swift Package 形式内嵌了 C 语言编写的 **`cjkfts5` 自定义分词器**，配合 Keyset 游标分页，即使集邮册累积上万枚邮票也能首屏瞬出检索结果。

在多设备 iCloud 同步层，`方寸` 基于 Apple 现代同步引擎 `CKSyncEngine` 实现了**软删除墓碑（Tombstone + Last-Write-Wins）**机制：用户删除邮票时仅标记 `isDeleted = true` 并等待墓碑状态同步至远端 CloudKit 后，再由后台维护任务在 30 天窗口期后安全执行物理文件 GC 回收。
