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
  docsUrl?: string;
  version: string;
  license: string;
  stars: string;
  forks: string;
  status: 'production' | 'active' | 'experimental';
  primaryLang: string;
  primaryLangColor: string;
  installCmd: {
    uv?: string;
    pip?: string;
    cargo?: string;
    cmake?: string;
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
    slug: 'pylibheif',
    name: 'pylibheif',
    repo: 'twn39/pylibheif',
    repoUrl: 'https://github.com/twn39/pylibheif',
    docsUrl: 'https://twn39.github.io/pylibheif/',
    version: 'v1.23.1',
    license: 'LGPL-3.0',
    stars: '1',
    forks: '0',
    status: 'production',
    primaryLang: 'Python',
    primaryLangColor: '#3572A5',
    installCmd: {
      uv: 'uv add pylibheif',
      pip: 'pip install pylibheif',
      git: 'git clone https://github.com/twn39/pylibheif.git',
    },
    languages: [
      { name: 'Python', percent: 73.0, color: '#3572A5' },
      { name: 'C++', percent: 26.3, color: '#f34b7d' },
      { name: 'CMake', percent: 0.7, color: '#DA3434' },
    ],
    i18n: {
      zh: {
        category: 'Image Codec · 图像编解码',
        tagline: '基于 nanobind 构建的高性能 libheif (HEIC / AVIF / JPEG2000) Python 零拷贝绑定',
        summary:
          '面向现代高动态图像容器打造的 C++/Python 桥接库。支持通过 Python Buffer Protocol 与 NumPy 双向零拷贝共享像素平面，并提供超 300k OPS 的流式读写、Pillow 插件与命令行工具集。',
        highlights: [
          '支持生命周期解耦的只读 memoryview 零拷贝编码导出（write_to_memoryview）',
          '释放 GIL 的多线程 HEIC / AVIF / JPEG2000 编解码与 BytesIO 高吞吐流式 I/O',
          '无缝对接 NumPy 多维数组与 Pillow 图像生态，预编译跨平台独立二进制轮子',
        ],
      },
      en: {
        category: 'Image Codec · C++/Python',
        tagline: 'High-performance Python bindings for libheif (HEIC / AVIF / JPEG2000) via nanobind',
        summary:
          'Zero-copy Python/C++ bridge for modern HEIF containers featuring bidirectional NumPy Buffer Protocol access, >300k OPS streaming I/O, Pillow plugin integration, and a CLI toolkit.',
        highlights: [
          'Zero-copy encoded binary export via lifetime-decoupled read-only memoryview',
          'GIL-free multi-threaded HEIC, AVIF & JPEG2000 codecs with >300k OPS stream I/O',
          'Seamless zero-copy NumPy plane sharing, Pillow plugin, and standalone wheels',
        ],
      },
    },
  },
  {
    slug: 'pyopenxlsx',
    name: 'pyopenxlsx',
    repo: 'twn39/pyopenxlsx',
    repoUrl: 'https://github.com/twn39/pyopenxlsx',
    docsUrl: 'https://twn39.github.io/pyopenxlsx/',
    version: 'v1.6.0',
    license: 'BSD-3-Clause',
    stars: '4',
    forks: '0',
    status: 'production',
    primaryLang: 'Python',
    primaryLangColor: '#3572A5',
    installCmd: {
      uv: 'uv add pyopenxlsx',
      pip: 'pip install pyopenxlsx',
      git: 'git clone https://github.com/twn39/pyopenxlsx.git',
    },
    languages: [
      { name: 'Python', percent: 71.6, color: '#3572A5' },
      { name: 'C++', percent: 28.1, color: '#f34b7d' },
      { name: 'CMake', percent: 0.3, color: '#DA3434' },
    ],
    i18n: {
      zh: {
        category: 'Data Engine · 表格加速引擎',
        tagline: '基于 OpenXLSX-NX C++ 内核的高吞吐 Python Excel (.xlsx) 读写引擎',
        summary:
          '在保持符合直觉的 Pythonic API 的同时，由底层 C++17 OpenXLSX-NX 驱动单元格解析与序列化，相比纯 Python 实现的 openpyxl 大幅提升海量工作簿的读写速度并降低内存峰值。',
        highlights: [
          '底层 C++ 批处理读写与流式 I/O，显著超越纯 Python XML 解析方案的吞吐上限',
          '完整支持 Agile 加密文档、矢量图形、线程化批注（Threaded Comments）与自定义属性',
          '提供完备的静态类型注解（.pyi）与高覆盖率跨平台单元测试套件',
        ],
      },
      en: {
        category: 'Data Engine · C++/Python',
        tagline: 'High-throughput Python Excel (.xlsx) binding powered by the OpenXLSX-NX C++ kernel',
        summary:
          'Delivers order-of-magnitude faster .xlsx read/write throughput and lower memory overhead than pure-Python openpyxl while preserving an idiomatic Pythonic API.',
        highlights: [
          'C++17 native XML & ZIP streaming under the hood with ergonomic Pythonic wrappers',
          'Supports Agile encryption, streaming I/O, vector shapes, and threaded comments',
          'Ships full .pyi type stubs and prebuilt wheels across macOS, Linux, and Windows',
        ],
      },
    },
  },
  {
    slug: 'codegraph-gen',
    name: 'codegraph-gen',
    repo: 'twn39/codegraph-gen',
    repoUrl: 'https://github.com/twn39/codegraph-gen',
    version: 'v1.7.0',
    license: 'MIT',
    stars: '0',
    forks: '0',
    status: 'active',
    primaryLang: 'Python',
    primaryLangColor: '#3572A5',
    installCmd: {
      uv: 'uv tool install codegraph-gen',
      pip: 'pip install codegraph-gen',
      git: 'git clone https://github.com/twn39/codegraph-gen.git',
    },
    languages: [{ name: 'Python', percent: 100.0, color: '#3572A5' }],
    i18n: {
      zh: {
        category: 'AI Agent Infra · 代码知识图谱',
        tagline: '面向 Claude Code / Codex 等编码 Agent 的多语言静态代码知识图谱编译器',
        summary:
          '基于 tree-sitter 静态解析 11 种编程语言符号与调用边，通过 Louvain 模块度社区发现算法自动聚类逻辑组件，导出零数据库依赖的扁平关联 Markdown 图谱库（Obsidian Vault）。',
        highlights: [
          '原生解析 Python / TS / Go / Rust / C++ / Swift / Kotlin 等 11 种语言的跨文件调用与继承边',
          '自动识别 God Nodes 核心抽象、文件级循环导入（Circular Imports）与函数互调环路',
          '具备 Stat-First 纳秒级增量缓存与 AGENTS.md 导航协议，实现零 API 成本本地架构洞察',
        ],
      },
      en: {
        category: 'AI Agent Infra · Static Analysis',
        tagline: 'Multi-language static codebase knowledge graph compiler built for AI Coding Agents',
        summary:
          'Parses 11 languages via tree-sitter, clusters cohesive components with Louvain community detection, and exports database-free Markdown vaults (Obsidian-style) tailored for Claude Code and Codex.',
        highlights: [
          'Extracts cross-file calls, inheritance, and import edges across 11 languages via tree-sitter',
          'Detects architectural God Nodes, circular file imports, and mutual recursion cycles',
          'Stat-First incremental caching and generated AGENTS.md protocols with zero LLM API cost',
        ],
      },
    },
  },
  {
    slug: 'yt-dlp-qt-gui',
    name: 'yt-dlp-qt-gui',
    repo: 'twn39/yt-dlp-qt-gui',
    repoUrl: 'https://github.com/twn39/yt-dlp-qt-gui',
    version: 'v0.7.0',
    license: 'GPL-3.0',
    stars: '7',
    forks: '2',
    status: 'active',
    primaryLang: 'Python',
    primaryLangColor: '#3572A5',
    installCmd: {
      uv: 'uv sync && uv run python main.py',
      git: 'git clone https://github.com/twn39/yt-dlp-qt-gui.git',
    },
    languages: [{ name: 'Python', percent: 100.0, color: '#3572A5' }],
    i18n: {
      zh: {
        category: 'Desktop App · 跨平台桌面端',
        tagline: '基于 PySide6 与 yt-dlp 内核构建的轻量级现代化跨平台流媒体下载工具',
        summary:
          '采用响应式多线程后台工作队列架构，将复杂的音视频流探测、清晰度编码筛选、字幕合并与代理配置封装为简洁流畅的原生桌面体验，支持 Windows、macOS 与 Linux。',
        highlights: [
          'UI 主线程与后台多线程下载池严格解耦，多任务高并发拉流下界面始终丝滑响应',
          '支持 YouTube、Bilibili、Vimeo 等上千个音视频站点的音画分离流自动择优与 FFmpeg 混流',
          '内置中英双语界面、断点续传、剪贴板监听与格式预设管理',
        ],
      },
      en: {
        category: 'Desktop App · PySide6 GUI',
        tagline: 'Lightweight, modern cross-platform desktop client built on PySide6 and yt-dlp',
        summary:
          'Wraps yt-dlp format probing, stream muxing, subtitle embedding, and proxy routing inside a responsive multi-threaded PySide6 desktop interface across macOS, Windows, and Linux.',
        highlights: [
          'Non-blocking QThread worker architecture keeps 60fps UI responsiveness under concurrent downloads',
          'Supports 1,000+ streaming sites (YouTube, Bilibili, Vimeo) with automatic FFmpeg stream merging',
          'Bilingual UI, resumeable task queues, codec/resolution presets, and clipboard monitoring',
        ],
      },
    },
  },
  {
    slug: 'openxlsx-nx',
    name: 'OpenXLSX-NX',
    repo: 'twn39/OpenXLSX-NX',
    repoUrl: 'https://github.com/twn39/OpenXLSX-NX',
    docsUrl: 'https://twn39.github.io/OpenXLSX-NX/',
    version: 'v1.12.1',
    license: 'BSD-3-Clause',
    stars: '4',
    forks: '1',
    status: 'production',
    primaryLang: 'C++',
    primaryLangColor: '#f34b7d',
    installCmd: {
      cmake: 'cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build',
      git: 'git clone https://github.com/twn39/OpenXLSX-NX.git',
    },
    languages: [
      { name: 'C++', percent: 99.6, color: '#f34b7d' },
      { name: 'CMake', percent: 0.4, color: '#DA3434' },
    ],
    i18n: {
      zh: {
        category: 'C++ Library · 文档解析内核',
        tagline: '面向现代 C++17 安全加固与流式性能优化的下一代 .xlsx 文档引擎',
        summary:
          '在经典 OpenXLSX 基础上深度演进的零重型依赖 C++17 核心库。集成 LLVM libFuzzer 模糊测试加固、AST 公式求值引擎、样式哈希去重与高吞吐流式写入管线。',
        highlights: [
          '通过 LLVM libFuzzer 持续模糊测试与 ASan/UBSan 零内存泄漏验证的企业级安全边界',
          '新增 AST 公式解析计算、共享样式自动去重（Style Deduplication）与流式大表读写',
          '极简外部依赖，无缝跨平台编译并直接作为 pyopenxlsx 的底层高性能内核',
        ],
      },
      en: {
        category: 'C++17 Library · Document Kernel',
        tagline: 'Next-generation security-hardened C++17 library for high-speed .xlsx processing',
        summary:
          'An actively engineered C++17 continuation of OpenXLSX featuring enterprise fuzz-hardening, AST formula calculation, style deduplication, agile encryption, and low-memory streaming.',
        highlights: [
          'Hardened against malformed OOXML inputs with LLVM libFuzzer plus ASan/UBSan verification',
          'Built-in AST formula engine, automatic style deduplication, and high-throughput streaming',
          'Minimal external dependencies with clean CMake integration across all major compilers',
        ],
      },
    },
  },
  {
    slug: 'tex2math',
    name: 'tex2math',
    repo: 'twn39/tex2math',
    repoUrl: 'https://github.com/twn39/tex2math',
    docsUrl: 'https://twn39.github.io/tex2math/',
    version: 'v2.4.1',
    license: 'LGPL-3.0',
    stars: '0',
    forks: '0',
    status: 'production',
    primaryLang: 'Rust',
    primaryLangColor: '#dea584',
    installCmd: {
      cargo: 'cargo add tex2math',
      git: 'git clone https://github.com/twn39/tex2math.git',
    },
    languages: [{ name: 'Rust', percent: 100.0, color: '#dea584' }],
    i18n: {
      zh: {
        category: 'Compiler & Typesetting · 公式编译器',
        tagline: '极速、零拷贝、高容错的 Rust LaTeX 数学公式转原生 MathML 编译器与 CLI',
        summary:
          '基于 winnow 解析器组合子构建完整数学 AST，并结合 KaTeX 级符号字典直接输出符合浏览器标准的原生 MathML XML —— 无需客户端加载庞大 JS 公式运行时即可渲染复杂嵌套公式。',
        highlights: [
          '基于 winnow 的切片零拷贝完整 AST 解析，精准处理多层嵌套分式、根式与矩阵环境',
          '输出现代浏览器（Chrome / Safari / Firefox）原生直出的语义化 MathML，前端 0 JS 负担',
          '纯 Rust 无外部运行时依赖，天然适配服务端静态预渲染与 WebAssembly 边缘编译',
        ],
      },
      en: {
        category: 'Compiler & Typesetting · Rust',
        tagline: 'Blazing-fast, zero-copy Rust compiler & CLI converting LaTeX math to native MathML',
        summary:
          'Combines full AST parsing via winnow combinators with KaTeX-grade symbol dictionaries to emit standards-compliant MathML XML—rendering complex math in modern browsers with zero client JS.',
        highlights: [
          'Slice-oriented winnow parser combinator AST handles deeply nested fractions, radicals & matrices',
          'Emits native browser MathML (Chrome 109+, Safari, Firefox) eliminating heavy JS math runtimes',
          'Pure Rust with resilient error recovery—ideal for SSR pipelines, CLIs, and WebAssembly targets',
        ],
      },
    },
  },
];

export interface EspressoClosedProject {
  slug: string;
  name: string;
  codeName: string;
  bundleId: string;
  appStoreId: string;
  appStoreUrl: {
    zh: string;
    en: string;
  };
  brewCmd?: string;
  iconPath: string;
  version: string;
  deliveryModel: 'iOS' | 'macOS' | 'iOS & macOS';
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
      displayName: string;
      category: string;
      accessTier: string;
      tagline: string;
      summary: string;
      highlights: string[];
    };
    en: {
      displayName: string;
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
    slug: 'espresso',
    name: 'Espresso',
    codeName: 'APP STORE · ID 6802915035',
    bundleId: 'com.curry.tang.espresso',
    appStoreId: '6802915035',
    appStoreUrl: {
      zh: 'https://apps.apple.com/cn/app/espresso-%E7%9C%9F%E5%AE%9E%E8%89%B2%E5%BD%A9%E8%83%B6%E7%89%87%E7%9B%B8%E6%9C%BA/id6802915035',
      en: 'https://apps.apple.com/us/app/espresso-true-color-film-cam/id6802915035',
    },
    iconPath: '/images/apps/espresso.png',
    version: 'v1.7.18',
    deliveryModel: 'iOS',
    slaMetric: 'com.curry.tang.espresso',
    scaleMetric: 'Swift 6 · Metal 3D LUT · Bayer RAW · CoreML ANE',
    status: 'production',
    primaryLang: 'Swift',
    primaryLangColor: '#F05138',
    languages: [
      { name: 'Swift 6 / SwiftUI', percent: 79.5, color: '#F05138' },
      { name: 'Metal Shaders', percent: 14.0, color: '#8f57e6' },
      { name: 'CoreML / Color Math', percent: 6.5, color: '#10b981' },
    ],
    specs: [
      { labelZh: '色彩与渲染管线', labelEn: 'Color & GPU Pipeline', value: 'Metal 3D .cube LUT Render + Compute Shaders' },
      { labelZh: '底片显影引擎', labelEn: 'RAW Development', value: 'Scene-Referred Bayer CFA & Apple ProRAW Linear' },
      { labelZh: '端侧神经网络', labelEn: 'Neural Engine', value: 'CoreML ANE PiperSR-2x Telephoto Super-Resolution' },
    ],
    i18n: {
      zh: {
        displayName: 'Espresso — 真实色彩胶片相机',
        category: 'Computational Photography · 计算摄影',
        accessTier: 'iOS · App Store',
        tagline: '基于 Metal 3D LUT 实时渲染与场景线性 Bayer RAW 显影的专业胶片模拟相机',
        summary:
          '将严谨色彩科学（Bradford / CAT16 色适应、OETF 曲线、卤化高光溢出 Halation 与物理颗粒模型）注入 iOS 实时取景器与 Metal 计算着色器成片管线，还原富士、柯达、徕卡与理光经典胶片质感。',
        highlights: [
          '实时 MTKView Metal 渲染管线与后台 Actor 隔离的 Metal Compute 全分辨率暗房成片引擎',
          '自研无 UI 依赖色彩数学核心包 EspressoCore（支持单帧 Bayer RAW 与 Apple ProRAW 线性解码）',
          '集成 CoreML ANE 2x 神经超分（PiperSR-2x）、相机控制扩展（Camera Control）与暗房画框排印引擎',
        ],
      },
      en: {
        displayName: 'Espresso — True Color Film Cam',
        category: 'Computational Photography · iOS',
        accessTier: 'iOS · App Store',
        tagline: 'Real-time Metal 3D LUT film-simulation camera with scene-referred Bayer RAW development',
        summary:
          'Brings color-accurate film science (Bradford/CAT16 chromatic adaptation, halation, bloom, organic grain, and spline tone curves) to both a 60fps Metal live viewfinder and full-resolution Metal compute photo processing.',
        highlights: [
          'Dual GPU architecture: MTKView live render pass + actor-isolated Metal compute darkroom pipeline',
          'Headless EspressoCore color-science engine with scene-referred Bayer CFA & Apple ProRAW strategies',
          'CoreML ANE PiperSR-2x neural super-resolution, iOS Camera Control widget & EXIF border typography',
        ],
      },
    },
  },
  {
    slug: 'fangcun',
    name: 'Fangcun',
    codeName: 'APP STORE · ID 6795181081',
    bundleId: 'com.curry.tang.fangcun',
    appStoreId: '6795181081',
    appStoreUrl: {
      zh: 'https://apps.apple.com/cn/app/%E6%96%B9%E5%AF%B8-%E9%82%AE%E7%A5%A8%E7%9B%B8%E6%9C%BA/id6795181081',
      en: 'https://apps.apple.com/us/app/fangcun-stamp-camera/id6795181081',
    },
    iconPath: '/images/apps/fangcun.png',
    version: 'v1.1.0',
    deliveryModel: 'iOS',
    slaMetric: 'com.curry.tang.fangcun',
    scaleMetric: 'Swift 6 · GRDB WAL · CJK FTS5 · CKSyncEngine',
    status: 'production',
    primaryLang: 'Swift',
    primaryLangColor: '#F05138',
    languages: [
      { name: 'Swift 6 / SwiftUI', percent: 84.2, color: '#F05138' },
      { name: 'C (cjkfts5 SQLite)', percent: 11.4, color: '#555555' },
      { name: 'WidgetKit / CloudKit', percent: 4.4, color: '#3178c6' },
    ],
    specs: [
      { labelZh: '本地搜索引擎', labelEn: 'Full-Text Search', value: 'Custom Embedded CJK FTS5 SQLite Tokenizer' },
      { labelZh: '存储与云同步', labelEn: 'Storage & Sync', value: 'GRDB 7 SQLite WAL + CloudKit CKSyncEngine (LWW)' },
      { labelZh: '无损几何重建', labelEn: 'Stamp Geometry', value: 'Normalized Coordinates + Procedural Perforation' },
    ],
    i18n: {
      zh: {
        displayName: '方寸 — 邮票相机',
        category: 'Creative Camera · 影像手账',
        accessTier: 'iOS 18+ · App Store',
        tagline: '拍摄即创作：融合程序化齿孔几何、本地优先 GRDB 存储与 iCloud 同步的复古邮票相机',
        summary:
          '将日常瞬间定格为可收藏的专属邮票。采用原图与归一化裁切坐标分离的无损存档设计，支持任意分辨率完美重建三档邮票锯齿边缘，并内置地图足迹聚合、日历集邮册与桌面小组件。',
        highlights: [
          '三阶段 Saga 拍摄落盘流水线（Temp → Commit → GRDB WAL + 补偿回滚），确保极端断电零丢图',
          '内嵌自研 cjkfts5 中日韩分词器与 Keyset 游标分页，海量手账札记毫秒级全文检索',
          '基于 CloudKit CKSyncEngine 的软删除墓碑（Tombstone LWW）多端同步与 App Group 小组件快照',
        ],
      },
      en: {
        displayName: 'Fangcun — Stamp Camera',
        category: 'Creative Camera · Local-First',
        accessTier: 'iOS 18+ · App Store',
        tagline: 'Vintage stamp camera combining procedural perforation geometry, CJK FTS5 & CloudKit sync',
        summary:
          'Turns everyday captures into collectible postage stamps using non-destructive normalized crop coordinates, procedural UIBezierPath perforations, viewport-clustered GPS maps, and tactile stamp albums.',
        highlights: [
          'Three-phase Saga capture pipeline over GRDB 7 SQLite WAL guarantees crash-safe photo persistence',
          'Embedded custom cjkfts5 SQLite tokenizer + keyset pagination for instant CJK full-text search',
          'CloudKit CKSyncEngine tombstone LWW multi-device sync paired with lock-free App Group WidgetKit snapshots',
        ],
      },
    },
  },
  {
    slug: 'cappuccino',
    name: 'Cappuccino',
    codeName: 'MAC APP STORE · ID 6792465311',
    bundleId: 'com.curry.tang.Cappuccino',
    appStoreId: '6792465311',
    appStoreUrl: {
      zh: 'https://apps.apple.com/cn/app/cappuccino-%E6%88%AA%E5%B1%8F%E7%A5%9E%E5%A5%87-ai/id6792465311?mt=12',
      en: 'https://apps.apple.com/us/app/cappuccino-smart-screen-ai/id6792465311?mt=12',
    },
    brewCmd: 'brew install --cask twn39/apps/cappuccino',
    iconPath: '/images/apps/cappuccino.png',
    version: 'v1.3.0',
    deliveryModel: 'macOS',
    slaMetric: 'com.curry.tang.Cappuccino',
    scaleMetric: 'AppKit · ScreenCaptureKit · Vision OCR & AI',
    status: 'production',
    primaryLang: 'Swift',
    primaryLangColor: '#F05138',
    languages: [
      { name: 'Swift (Strict Concurrency)', percent: 94.0, color: '#F05138' },
      { name: 'AppKit / CoreGraphics', percent: 6.0, color: '#00ADD8' },
    ],
    specs: [
      { labelZh: '原生桌面框架', labelEn: 'Desktop Architecture', value: 'Pure Programmatic AppKit (Zero Storyboard/XIB)' },
      { labelZh: '并发安全等级', labelEn: 'Concurrency Model', value: 'SWIFT_STRICT_CONCURRENCY = complete (Actor-Isolated)' },
      { labelZh: '采集与视觉引擎', labelEn: 'Capture & Vision', value: 'ScreenCaptureKit + Scroll Merge + Vision OCR / AI' },
    ],
    i18n: {
      zh: {
        displayName: 'Cappuccino — 截屏神器 & AI',
        category: 'macOS Productivity · 原生效率工具',
        accessTier: 'macOS 15+ · Mac App Store',
        tagline: '基于纯代码 AppKit、ScreenCaptureKit 与端侧视觉 AI 构建的 macOS 菜单栏截屏利器',
        summary:
          '摒弃一切 Storyboard/XIB 历史包袱，以 100% 纯代码 AppKit 与 Swift 6 完整数据竞争检查（Strict Concurrency Complete）打造。集区域捕捉、滚动长截图拼接、贴图钉选、矢量标注、端侧 OCR 与多语种 AI 翻译于一体。',
        highlights: [
          '全链路 Actor 隔离与 autoreleasepool 精细内存池控制，常驻菜单栏极低内存占用',
          '基于 ScreenCaptureKit 的高帧率 Retina 窗口捕获与自适应特征点长截图无缝拼接（ImageMerge）',
          '集成 Apple Vision 离线文字识别、智能视觉问答/翻译以及原生矢量标注编辑器',
        ],
      },
      en: {
        displayName: 'Cappuccino — Smart Screen & AI',
        category: 'macOS Productivity · AppKit',
        accessTier: 'macOS 15+ · Mac App Store',
        tagline: 'Menu-bar macOS capture, scroll-stitching, OCR & AI suite built in pure programmatic AppKit',
        summary:
          'Engineered from scratch in 100% programmatic AppKit (zero Storyboards/XIBs) under complete Swift 6 strict concurrency checking—unifying Retina capture, scrolling screenshot merge, vector markup, Vision OCR, and AI translation.',
        highlights: [
          'Complete actor-isolated pipeline with deterministic autoreleasepool scoping for minimal menu-bar RSS',
          'High-DPI ScreenCaptureKit window/region capture paired with seamless scrolling image stitching',
          'On-device Apple Vision OCR, AI visual translation, floating pin windows & universal macOS binary',
        ],
      },
    },
  },
  {
    slug: 'symmath',
    name: 'SymMath',
    codeName: 'APP STORE · ID 6765642699',
    bundleId: 'com.curry.tang.SymMath',
    appStoreId: '6765642699',
    appStoreUrl: {
      zh: 'https://apps.apple.com/cn/app/symmath-%E4%BB%A3%E6%95%B0%E7%A7%91%E5%AD%A6%E8%AE%A1%E7%AE%97%E5%99%A8/id6765642699',
      en: 'https://apps.apple.com/us/app/symmath-symbolic-calculator/id6765642699',
    },
    iconPath: '/images/apps/symmath.png',
    version: 'v1.2.3',
    deliveryModel: 'iOS & macOS',
    slaMetric: 'com.curry.tang.SymMath',
    scaleMetric: 'Swift/C++ Interop · SymEngine · SwiftTexMath',
    status: 'production',
    primaryLang: 'Swift',
    primaryLangColor: '#F05138',
    languages: [
      { name: 'SwiftUI', percent: 62.5, color: '#F05138' },
      { name: 'C++ (SymEngine CAS)', percent: 29.0, color: '#f34b7d' },
      { name: 'LaTeX Typesetting', percent: 8.5, color: '#3178c6' },
    ],
    specs: [
      { labelZh: '跨语言互操作', labelEn: 'C++ Bridge', value: 'Native Swift C++ Interop (.interoperabilityMode(.Cxx))' },
      { labelZh: '符号代数内核', labelEn: 'CAS Kernel', value: 'SymEngineKit (Exact Symbolic Roots, Calculus & Matrices)' },
      { labelZh: '数学排版与绘图', labelEn: 'Typesetting & Plot', value: 'SwiftTexMath (Latin Modern LaTeX) + Swift Charts' },
    ],
    i18n: {
      zh: {
        displayName: 'SymMath — 代数科学计算器',
        category: 'Computer Algebra · 符号计算科学',
        accessTier: 'iOS & macOS · App Store',
        tagline: '通过 Swift 原生 C++ 互操作驱动 SymEngine 的 Apple 跨平台符号代数计算器与函数绘图仪',
        summary:
          '将高性能计算机代数系统（CAS）带入 iOS 与 macOS。支持精确根式与三角恒等化简（如 √8 = 2√2）、多元偏导微积分、多项式精确代数求根、矩阵运算，并以经典 Latin Modern 字体实时渲染原生 LaTeX 公式。',
        highlights: [
          '基于 Swift 5.9+ 原生 C++ 互操作封装 SymEngineKit，零胶水层安全暴露符号表达式与稠密矩阵',
          '通过 SwiftTexMath 实现出版级 LaTeX 数学公式实时排版，搭配专属三角/双曲/微积分快捷键盘',
          '内置基于 Swift Charts 的自适应缩放函数曲线绘制引擎与高容错语法安全求值器',
        ],
      },
      en: {
        displayName: 'SymMath — Symbolic Calculator',
        category: 'Computer Algebra · iOS & macOS',
        accessTier: 'iOS & macOS · App Store',
        tagline: 'Native Apple Computer Algebra System powered by Swift-C++ interop, SymEngine & LaTeX typesetting',
        summary:
          'Brings exact symbolic computation to iOS and macOS via SymEngineKit—solving exact polynomial roots, partial derivatives (∂/∂x), algebraic expansions, and interactive function plots rendered in true Latin Modern LaTeX.',
        highlights: [
          'Uses native Swift C++ interoperability (.interoperabilityMode(.Cxx)) over the C++ symengine CAS core',
          'Publication-grade live LaTeX rendering via SwiftTexMath paired with a custom mathematical ribbon keyboard',
          'Interactive auto-scaling function curve plotter powered by Swift Charts plus snapshot-tested UI stability',
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
  iconPath?: string;
  primaryLang: string;
  primaryLangColor: string;
  version: string;
  badgeText: string;
  tagline: string;
  href: string;
  externalRepoUrl?: string;
  appStoreUrl?: string;
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
      label: closedProj.i18n[lang].displayName,
      isClosed: true,
      iconPath: closedProj.iconPath,
      primaryLang: closedProj.primaryLang,
      primaryLangColor: closedProj.primaryLangColor,
      version: closedProj.version,
      badgeText: closedProj.i18n[lang].accessTier,
      tagline: closedProj.i18n[lang].tagline,
      href: `${localizePath('/closed-source/', lang)}#${closedProj.slug}`,
      appStoreUrl: closedProj.appStoreUrl[lang],
    };
  }

  return undefined;
}

export function getStatusLabel(status: EspressoProject['status'], lang: Lang): string {
  const map = {
    zh: {
      production: '生产就绪',
      active: '活跃维护',
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
