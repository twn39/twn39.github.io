import { localizePath, type Lang } from '../i18n/ui';

export interface RepoLanguage {
  name: string;
  percent: number;
  color: string;
}

export interface EspressoProject {
  slug: string;
  name: string;
  repo: string;
  repoUrl: string;
  demoUrl?: string;
  version: string;
  license: string;
  stars: string;
  forks: string;
  status: 'production' | 'active' | 'experimental';
  primaryLang: string;
  primaryLangColor: string;
  installCmd: {
    pnpm?: string;
    cargo?: string;
    git: string;
  };
  languages: RepoLanguage[];
  i18n: {
    zh: {
      tagline: string;
      summary: string;
      highlights: string[];
      category: string;
    };
    en: {
      tagline: string;
      summary: string;
      highlights: string[];
      category: string;
    };
  };
}

export const ESPRESSO_PROJECTS: EspressoProject[] = [
  {
    slug: 'espresso-runtime',
    name: 'espresso-runtime',
    repo: 'espresso-lab/espresso-runtime',
    repoUrl: 'https://github.com/espresso-lab/espresso-runtime',
    version: 'v0.9.4',
    license: 'Apache-2.0',
    stars: '3.4k',
    forks: '218',
    status: 'production',
    primaryLang: 'Rust',
    primaryLangColor: '#dea584',
    installCmd: {
      cargo: 'cargo add espresso-runtime --features wasm-component',
      git: 'git clone https://github.com/espresso-lab/espresso-runtime.git',
    },
    languages: [
      { name: 'Rust', percent: 78.4, color: '#dea584' },
      { name: 'WebAssembly', percent: 14.2, color: '#654ff0' },
      { name: 'TypeScript', percent: 7.4, color: '#3178c6' },
    ],
    i18n: {
      zh: {
        category: 'Edge Runtime · 边缘计算',
        tagline: '亚毫秒级冷启动的 Rust + WebAssembly Component 边缘函数运行时',
        summary:
          '基于 Wasmtime 预实例化内存快照（CoW Linear Memory Snapshot）与零拷贝 Host ABI 构建的轻量级隔离执行引擎，单核可维持 12,000+ 并发沙箱。',
        highlights: [
          '0.38ms P99 冷启动耗时（基于 mmap 写时复制线性内存池）',
          '内置确定性 CPU Fuel 计量与每请求 4MB 弹性堆上限保护',
          '原生兼容 WinterCG Fetch 流式响应与 WASI Preview 2 组件模型',
        ],
      },
      en: {
        category: 'Edge Runtime · Systems',
        tagline: 'Sub-millisecond cold-start Rust + WebAssembly Component edge isolate engine',
        summary:
          'A lightweight sandboxed execution engine built on Copy-on-Write linear memory snapshots and zero-copy Host ABI, sustaining 12,000+ concurrent isolates per core.',
        highlights: [
          '0.38ms P99 cold-start latency via mmap CoW linear memory pools',
          'Deterministic CPU fuel metering and 4MB elastic per-request heap cap',
          'Native WinterCG Fetch streaming & WASI Preview 2 Component Model support',
        ],
      },
    },
  },
  {
    slug: 'barista-kv',
    name: 'barista-kv',
    repo: 'espresso-lab/barista-kv',
    repoUrl: 'https://github.com/espresso-lab/barista-kv',
    version: 'v1.2.0',
    license: 'MIT',
    stars: '2.1k',
    forks: '146',
    status: 'production',
    primaryLang: 'Rust',
    primaryLangColor: '#dea584',
    installCmd: {
      cargo: 'cargo add barista-kv',
      git: 'git clone https://github.com/espresso-lab/barista-kv.git',
    },
    languages: [
      { name: 'Rust', percent: 89.6, color: '#dea584' },
      { name: 'C', percent: 6.1, color: '#555555' },
      { name: 'Python', percent: 4.3, color: '#3572A5' },
    ],
    i18n: {
      zh: {
        category: 'Storage Engine · 存储内核',
        tagline: '面向 NVMe SSD 优化的无停顿嵌入式 LSM-Tree 键值存储引擎',
        summary:
          '采用键值分离（WiscKey Value Log）与速率自适应后台 Compaction 调度器，彻底消除传统 LSM-Tree 在高吞吐写入下的 P999 尾延迟毛刺。',
        highlights: [
          '分区 Ribbon Filter 替代经典 Bloom Filter，节省 31% 常驻内存',
          '基于 io_uring Direct I/O 的异步 SSTable 预读与校验流水线',
          '支持 MVCC 无锁快照读与确定性崩溃恢复故障注入测试（DST）',
        ],
      },
      en: {
        category: 'Storage Engine · Kernel',
        tagline: 'Zero-stall embedded LSM-Tree key-value engine tuned for modern NVMe SSDs',
        summary:
          'Combines WiscKey value separation with rate-adaptive background compaction pacing to eliminate P999 write-stall tail latency spikes under heavy ingestion.',
        highlights: [
          'Partitioned Ribbon Filters save 31% resident RAM vs standard Bloom filters',
          'io_uring Direct I/O asynchronous SSTable prefetch and CRC32C pipeline',
          'Lock-free MVCC snapshot reads verified by deterministic simulation testing',
        ],
      },
    },
  },
  {
    slug: 'crema-trace',
    name: 'crema-trace',
    repo: 'espresso-lab/crema-trace',
    repoUrl: 'https://github.com/espresso-lab/crema-trace',
    version: 'v0.8.1',
    license: 'Apache-2.0',
    stars: '4.6k',
    forks: '312',
    status: 'active',
    primaryLang: 'C',
    primaryLangColor: '#555555',
    installCmd: {
      cargo: 'cargo install crema-trace-cli',
      git: 'git clone https://github.com/espresso-lab/crema-trace.git',
    },
    languages: [
      { name: 'C (eBPF)', percent: 52.4, color: '#555555' },
      { name: 'Rust', percent: 39.6, color: '#dea584' },
      { name: 'Go', percent: 8.0, color: '#00ADD8' },
    ],
    i18n: {
      zh: {
        category: 'Observability · 内核观测',
        tagline: '基于 eBPF CO-RE 与 DWARF 栈回溯的零侵入生产环境持续剖析器',
        summary:
          '无需重编译开启帧指针（Frame Pointer），直接在内核态通过预解析 .eh_frame 表完成混合栈回溯，以低于 0.6% 的 CPU 开销实时生成差分火焰图。',
        highlights: [
          '支持无 Frame Pointer 的 Rust / C++ / Go 与 Wasm JIT 混合调用栈统一回溯',
          '内核态 BPF RingBuf 聚合去重，守护进程常驻内存低于 20 MB',
          '原生导出 Google pprof 与 Parquet 列式存储，支持版本间回归差分比对',
        ],
      },
      en: {
        category: 'Observability · eBPF',
        tagline: 'Zero-instrumentation continuous profiler powered by eBPF CO-RE & DWARF unwinding',
        summary:
          'Unwinds stripped native binaries directly in kernel context via pre-indexed .eh_frame tables without requiring frame pointers, maintaining under 0.6% CPU overhead.',
        highlights: [
          'Unified stack unwinding across Rust, C++, Go, and Wasm JIT frames without recompilation',
          'In-kernel BPF RingBuf stack deduplication keeps agent RSS below 20 MB',
          'Exports standard pprof and Apache Arrow/Parquet for release-over-release diffing',
        ],
      },
    },
  },
  {
    slug: 'tamp-llms-index',
    name: 'tamp-llms-index',
    repo: 'espresso-lab/tamp-llms-index',
    repoUrl: 'https://github.com/espresso-lab/tamp-llms-index',
    demoUrl: '/llms.txt',
    version: 'v0.6.2',
    license: 'MIT',
    stars: '1.5k',
    forks: '94',
    status: 'active',
    primaryLang: 'TypeScript',
    primaryLangColor: '#3178c6',
    installCmd: {
      pnpm: 'pnpm add -D @espresso-lab/tamp-llms-index',
      git: 'git clone https://github.com/espresso-lab/tamp-llms-index.git',
    },
    languages: [
      { name: 'TypeScript', percent: 91.5, color: '#3178c6' },
      { name: 'Shell', percent: 8.5, color: '#89e051' },
    ],
    i18n: {
      zh: {
        category: 'AI Infra · 文档与检索',
        tagline: '面向开发者文档与技术博客的编译期 llms.txt 与语义切片生成器',
        summary:
          '在静态构建阶段将 AST 级技术文章编译为符合 llmstxt.org 标准的分层索引、全量语料库与精确 Token 预算的纯净 Markdown 端点。',
        highlights: [
          '自动生成 /llms.txt、/llms-full.txt 与每篇文章同路径 .md 镜像端点',
          '剥离 HTML 导航噪音，保留代码块语言标记、表格结构与项目双向引用图谱',
          '平均降低编码 Agent 与 AI 搜索引擎 68% 的上下文 Token 消耗',
        ],
      },
      en: {
        category: 'AI Infra · Documentation',
        tagline: 'Build-time llms.txt & token-efficient Markdown compiler for technical docs',
        summary:
          'Compiles technical blogs and project docs at build time into llmstxt.org-compliant hierarchical indexes, full-corpus bundles, and clean per-article .md endpoints.',
        highlights: [
          'Emits /llms.txt, /llms-full.txt, and canonical .md mirror routes automatically',
          'Strips HTML chrome while preserving fenced code ASTs, tables & repo graphs',
          'Reduces coding agent & AI search context token consumption by 68% on average',
        ],
      },
    },
  },
];

export interface EspressoClosedProject {
  slug: string;
  name: string;
  codeName: string;
  version: string;
  deliveryModel: 'Cloud SaaS' | 'Enterprise SDK' | 'On-Premise';
  slaMetric: string;
  scaleMetric: string;
  status: 'production' | 'active' | 'experimental';
  primaryLang: string;
  primaryLangColor: string;
  languages: RepoLanguage[];
  specs: {
    labelZh: string;
    labelEn: string;
    value: string;
  }[];
  i18n: {
    zh: {
      category: string;
      accessTier: string;
      tagline: string;
      summary: string;
      highlights: string[];
    };
    en: {
      category: string;
      accessTier: string;
      tagline: string;
      summary: string;
      highlights: string[];
    };
  };
}

export const CLOSED_SOURCE_PROJECTS: EspressoClosedProject[] = [
  {
    slug: 'espresso-cloud-mesh',
    name: 'Espresso Cloud Mesh',
    codeName: 'INTERNAL / MESH-CTRL',
    version: 'v3.4 Enterprise',
    deliveryModel: 'Cloud SaaS',
    slaMetric: '99.995% SLA',
    scaleMetric: '38 Global POPs · 1.8M RPS',
    status: 'production',
    primaryLang: 'Rust',
    primaryLangColor: '#dea584',
    languages: [
      { name: 'Rust', percent: 68.0, color: '#dea584' },
      { name: 'Go', percent: 24.5, color: '#00ADD8' },
      { name: 'TypeScript', percent: 7.5, color: '#3178c6' },
    ],
    specs: [
      { labelZh: '一致性协议', labelEn: 'Consensus', value: 'Hierarchical Multi-Raft + CRDT Delta' },
      { labelZh: '安全隔离边界', labelEn: 'Security', value: 'Hardware SEV-SNP + SPIFFE mTLS' },
      { labelZh: '全球配置收敛', labelEn: 'Propagation', value: 'P99 < 420ms across 38 Edge POPs' },
    ],
    i18n: {
      zh: {
        category: 'Control Plane · 全球调度控制面',
        accessTier: '商业托管 · Proprietary',
        tagline: '跨 38 个全球边缘节点的 Anycast 零信任控制面与亚秒级状态同步网络',
        summary:
          '驱动 espresso-runtime 生产集群的商业调度底座。负责全球边缘流量实时健康探测、租户快照热迁移、多区域配额令牌桶协同及硬件级机密计算认证。',
        highlights: [
          '采用分层 Multi-Raft 与增量状态流（Delta State Stream），全球路由规则 420ms 内收敛',
          '基于 BGP Anycast 与实时 RTT 矩阵的故障自动摘除，单区域断网零人工介入切换',
          '内置细粒度多租户计费计量流水线与零停机密钥轮转（Zero-Downtime Key Rotation）',
        ],
      },
      en: {
        category: 'Control Plane · Global Edge',
        accessTier: 'Commercial · Proprietary',
        tagline: 'Zero-trust Anycast control plane & sub-second delta state mesh across 38 POPs',
        summary:
          'The commercial orchestration backbone powering managed espresso-runtime clusters—handling live Anycast traffic steering, snapshot warm-migration, distributed rate-limiting, and hardware mTLS attestation.',
        highlights: [
          'Hierarchical Multi-Raft + CRDT delta streams converge global routing config in <420ms P99',
          'Autonomous BGP Anycast health steering survives full-region blackouts with zero manual intervention',
          'Built-in multi-tenant metering pipeline and zero-downtime SPIFFE certificate rotation',
        ],
      },
    },
  },
  {
    slug: 'ristretto-quant-engine',
    name: 'Ristretto Quant Engine',
    codeName: 'PROPRIETARY / RST-VEC',
    version: 'v2.1 SDK',
    deliveryModel: 'Enterprise SDK',
    slaMetric: 'P99 1.9ms @ 1B Vec',
    scaleMetric: '8.4x DRAM Compression',
    status: 'production',
    primaryLang: 'C++',
    primaryLangColor: '#f34b7d',
    languages: [
      { name: 'C++20 / SIMD', percent: 61.2, color: '#f34b7d' },
      { name: 'CUDA', percent: 26.8, color: '#76B900' },
      { name: 'Rust Bindings', percent: 12.0, color: '#dea584' },
    ],
    specs: [
      { labelZh: '指令集加速', labelEn: 'Instruction Set', value: 'AVX-512 VNNI / ARM SVE2 / CUDA Tensor' },
      { labelZh: '量化精度保持', labelEn: 'Recall@10', value: '98.7% vs FP32 Exact Search' },
      { labelZh: '存储介质流水', labelEn: 'Storage I/O', value: 'NVMe Direct DiskANN + Pinned DMA' },
    ],
    i18n: {
      zh: {
        category: 'Vector & AI Kernel · 高性能检索内核',
        accessTier: '企业授权 · Enterprise SDK',
        tagline: '面向十亿级向量的 AVX-512 / CUDA 混合非对称量化检索引擎',
        summary:
          '专为大规模企业私有 RAG 与多模态混合检索打造的闭源加速库。利用残差乘积量化（Residual PQ）与 NVMe 零拷贝图遍历，在单机 64GB 内存下承载十亿级高维索引。',
        highlights: [
          '手写 AVX-512 VNNI 与 ARM Neon/SVE2 距离算子，单核吞吐较通用实现提升 4.7 倍',
          '非对称混合精度重排（1.5-bit 粗筛 + FP16 NVMe 按需精排），内存成本直降 88%',
          '支持混合标量谓词下推（Filtered HNSW/Vamana），彻底解决高过滤率下的召回断崖问题',
        ],
      },
      en: {
        category: 'Vector & AI Kernel · Acceleration',
        accessTier: 'Commercial License · SDK',
        tagline: 'Billion-scale AVX-512 & CUDA asymmetric quantized vector retrieval engine',
        summary:
          'A proprietary C++20/CUDA acceleration library for enterprise RAG and multimodal search—serving 1B+ high-dimensional embeddings on a single 64GB node via Residual PQ and NVMe-direct graph traversal.',
        highlights: [
          'Hand-tuned AVX-512 VNNI & ARM SVE2 distance kernels deliver 4.7x higher single-core QPS',
          'Two-stage 1.5-bit coarse scan + NVMe DMA FP16 reranking slashes DRAM footprint by 88%',
          'Predicate-aware graph navigation prevents recall collapse under selective metadata filters',
        ],
      },
    },
  },
  {
    slug: 'crema-studio',
    name: 'Crema Replay Studio',
    codeName: 'COMMERCIAL / CRM-PRO',
    version: 'v1.6 On-Prem',
    deliveryModel: 'On-Premise',
    slaMetric: '120 FPS Timeline',
    scaleMetric: '50M+ Spans / Session',
    status: 'active',
    primaryLang: 'Rust',
    primaryLangColor: '#dea584',
    languages: [
      { name: 'Rust (WebGPU)', percent: 58.5, color: '#dea584' },
      { name: 'TypeScript', percent: 34.0, color: '#3178c6' },
      { name: 'WGSL Shaders', percent: 7.5, color: '#563d7c' },
    ],
    specs: [
      { labelZh: '图形渲染管线', labelEn: 'Rendering', value: 'Native WebGPU Instanced Canvas (120Hz)' },
      { labelZh: '数据安全合规', labelEn: 'Compliance', value: '100% Air-Gapped On-Premise Deployment' },
      { labelZh: '故障根因定位', labelEn: 'Correlation', value: 'Automated Syscall ↔ Lock Contention Diff' },
    ],
    i18n: {
      zh: {
        category: 'Developer Suite · 时间旅行诊断台',
        accessTier: '私有化部署 · On-Premise',
        tagline: '基于 WebGPU 硬件加速的分布式全链路时间旅行回放与火焰图工作台',
        summary:
          '与开源采集端 crema-trace 配套的企业级可视化分析平台。支持离线内网私有化部署，单画布流畅渲染五千万级跨节点调用栈与内核锁争用时序图。',
        highlights: [
          'WebGPU 实例化渲染引擎，5,000 万级采样跨度下仍保持 120 FPS 丝滑缩放与平移',
          '内置自动根因归因算法，一键高亮新旧版本间退化最显著的锁等待与尾延迟路径',
          '纯内网离线符号服务器集成，确保核心交易与政企生产二进制符号零外泄',
        ],
      },
      en: {
        category: 'Developer Suite · Diagnostics',
        accessTier: 'Air-Gapped · On-Premise',
        tagline: 'WebGPU-accelerated time-travel trace replay & differential flamegraph workbench',
        summary:
          'The commercial companion workbench to open-source crema-trace—engineered for air-gapped enterprise environments to interactively scrub 50M+ cross-service kernel & user-space spans at 120 FPS.',
        highlights: [
          'Custom WebGPU instanced flamegraph renderer sustains 120 FPS across 50M+ trace spans',
          'Automated regression attribution surfaces lock-contention and syscall anomalies between releases',
          '100% air-gapped symbol server integration keeps proprietary debug symbols strictly on-premise',
        ],
      },
    },
  },
];

export function getProjectBySlug(slug: string): EspressoProject | undefined {
  return ESPRESSO_PROJECTS.find((p) => p.slug === slug);
}

export function getClosedProjectBySlug(slug: string): EspressoClosedProject | undefined {
  return CLOSED_SOURCE_PROJECTS.find((p) => p.slug === slug);
}

export interface UnifiedProjectMeta {
  slug: string;
  name: string;
  label: string;
  isClosed: boolean;
  primaryLang: string;
  primaryLangColor: string;
  version: string;
  badgeText: string;
  tagline: string;
  href: string;
  externalRepoUrl?: string;
}

export function resolveProjectMeta(slug: string, lang: Lang): UnifiedProjectMeta | undefined {
  const openProj = getProjectBySlug(slug);
  if (openProj) {
    return {
      slug: openProj.slug,
      name: openProj.name,
      label: openProj.repo,
      isClosed: false,
      primaryLang: openProj.primaryLang,
      primaryLangColor: openProj.primaryLangColor,
      version: openProj.version,
      badgeText: `★ ${openProj.stars}`,
      tagline: openProj.i18n[lang].tagline,
      href: `${localizePath('/projects/', lang)}#${openProj.slug}`,
      externalRepoUrl: openProj.repoUrl,
    };
  }

  const closedProj = getClosedProjectBySlug(slug);
  if (closedProj) {
    return {
      slug: closedProj.slug,
      name: closedProj.name,
      label: closedProj.name,
      isClosed: true,
      primaryLang: closedProj.primaryLang,
      primaryLangColor: closedProj.primaryLangColor,
      version: closedProj.version,
      badgeText: closedProj.i18n[lang].accessTier,
      tagline: closedProj.i18n[lang].tagline,
      href: `${localizePath('/closed-source/', lang)}#${closedProj.slug}`,
    };
  }

  return undefined;
}

export function getStatusLabel(status: EspressoProject['status'], lang: Lang): string {
  const map = {
    zh: {
      production: '生产就绪',
      active: '活跃演进',
      experimental: '实验探索',
    },
    en: {
      production: 'Production',
      active: 'Active',
      experimental: 'Experimental',
    },
  };
  return map[lang][status];
}
