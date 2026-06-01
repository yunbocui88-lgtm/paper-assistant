# Paper Assistant — 设计规格说明书

**日期:** 2026-06-01
**状态:** 待审核
**版本:** 1.0

---

## 1. 项目概述

论文阅读分析工具。用户拖入 PDF 论文（或粘贴网页链接），工具自动调用 LLM 大模型提取论文关键信息（标题、作者、变量、理论、方法等 20+ 字段），结果存入本地数据库，支持搜索筛选和导出 Excel。

**目标用户:** 个人学术研究者
**平台策略:** 先做网页版（PWA），后续包装 Electron 桌面应用和微信小程序

---

## 2. 核心功能

### 2.1 论文导入

- **PDF 拖拽上传:** 拖入浏览器窗口，pdf.js 前端解析文字 + 提取图片
- **网页链接输入:** 粘贴 arXiv / 期刊链接，通过 Vercel Edge Function 代理抓取页面文本
- **批量导入:** 一次拖入多篇（支持几十篇），自动排队处理

### 2.2 论文分析

- **LLM 驱动:** 将论文全文 + 结构化 prompt 发送给用户配置的大模型 API
- **固定字段提取（20 个）:** 序号、年份、期刊级别、作者、标题、摘要、模型图（截图+描述）、模型类型、结论(一句话)、研究理论、研究方法、自变量、因变量、因变量方向、中介变量、调节变量、领域、研究主体、前因/结果、文章类型、特色
- **智能适配:** 论文中缺失的字段返回 null，不强行编造
- **用户自定义字段:** 支持新增额外需要提取的字段
- **流式输出:** 边分析边显示结果
- **批量队列:** 多篇论文自动排队，显示整体进度和单篇状态

### 2.3 结果管理

- **本地存储:** IndexedDB 存储所有分析结果
- **搜索筛选:** 按标题、作者、年份、领域等字段搜索和过滤
- **结果展示:** 网格卡片布局，标签栏快速概览，点击展开完整字段
- **模型图提取:** pdf.js 逐页渲染为 canvas，通过非文本区域检测自动定位图表位置并裁剪；LLM 同时给出文字描述。两者并存展示

### 2.4 复制与导出

- **点击即复制:** 每个字段值点击即可复制到剪贴板
- **批量复制有三种格式:**
  - 表格行（Tab 分隔，粘贴到 Excel 自动成列）
  - 标签文本（每行一个字段，适合 Word/笔记）
  - 自然语言摘要（段落形式，适合论文引用）
- **文件导出:** 导出为 Excel (.xlsx) 或 CSV
- **多选批量导出:** 选中多篇论文，每篇一行，自动生成完整表格

### 2.5 API 配置

- **完全自定义:** 用户填写 endpoint URL、模型名、API Key
- **多 API 并存:** 可配置多个 API，标签切换
- **高级选项:** Temperature、Max Tokens、流式输出开关
- **测试连接:** 一键验证 API 是否可用
- **本地安全存储:** Key 存储在浏览器 localStorage，不上传服务器

---

## 3. 技术架构

### 3.1 技术选型

| 层 | 选型 | 理由 |
|----|------|------|
| 前端框架 | React 19 + TypeScript | 成熟稳定，生态丰富 |
| 构建工具 | Vite | 快速开发，HMR 秒级 |
| 样式 | Tailwind CSS | 快速构建 UI，一致性好 |
| PDF 解析 | pdf.js (pdfjs-dist) | 纯前端，文字提取 + 图片渲染 |
| 网页代理 | Vercel Edge Function | 免费部署，50 行代码，绕过跨域 |
| 本地数据库 | Dexie.js (IndexedDB 封装) | API 简洁，支持索引和查询 |
| LLM 调用 | 浏览器 fetch 直连 | 无需中间层，用户 Key 自己持有 |
| Excel 导出 | SheetJS (xlsx) | 成熟的 xlsx 生成库 |
| PWA | vite-plugin-pwa | 离线缓存，可安装到桌面 |

### 3.2 页面结构（单页应用，Tab 导航）

```
┌─────────────────────────────────┐
│  📋 论文库  │  ⚙️ API  │  📊 导出 │
├─────────────────────────────────┤
│                                 │
│   ┌───────────────────────┐     │
│   │  📄 拖拽 PDF / 粘贴链接  │     │
│   └───────────────────────┘     │
│                                 │
│   ┌─ 论文列表 ─────────────────┐  │
│   │ ✅ 论文A  已完成            │  │
│   │ ⚡ 论文B  分析中...         │  │
│   │ ⏳ 论文C  等待中            │  │
│   └────────────────────────────┘  │
│                                 │
│   ┌─ 选中论文的详情卡片 ────────┐  │
│   │ 标签行: 2024 | SSCI Q1 ... │  │
│   │ 字段网格 / 点击复制         │  │
│   └────────────────────────────┘  │
└─────────────────────────────────┘
```

### 3.3 数据流

```
PDF 文件 / 网页链接
    ↓
pdf.js 解析 → 文本 + Canvas 渲染 → 提取图片
    ↓
构建分析 Prompt（论文全文 + 结构化指令）
    ↓
fetch → 用户配置的 LLM API（OpenAI 兼容格式）
    ↓
流式 JSON 解析 → 逐字段填充
    ↓
结果存入 IndexedDB → UI 实时更新
    ↓
用户浏览 / 复制 / 导出
```

### 3.4 IndexedDB 数据模型

**表: papers**
```
id: uuid (主键)
title: string
year: number | null
journal_level: string | null
authors: string | null
abstract: string | null
model_diagram_images: string[] (base64 data URL 数组)
model_diagram_description: string | null
model_type: string | null
conclusion: string | null
research_theory: string | null
research_method: string | null
iv: string | null (自变量)
dv: string | null (因变量)
dv_direction: string | null (因变量方向)
mediator: string | null (中介变量)
moderator: string | null (调节变量)
field: string | null (领域)
research_subject: string | null (研究主体)
antecedent_outcome: string | null (前因/结果)
article_type: string | null (文章类型)
features: string | null (特色)
custom_fields: Record<string, string | null> (用户自定义字段)
status: 'pending' | 'analyzing' | 'completed' | 'error'
source_type: 'pdf' | 'url'
source_name: string (原始文件名或 URL)
created_at: Date
analyzed_at: Date | null
```

**表: api_configs**
```
id: uuid (主键)
name: string (自定义标签)
endpoint: string
model: string
api_key: string (存储 localStorage，IndexedDB 仅存引用)
temperature: number
max_tokens: number
streaming: boolean
is_active: boolean
created_at: Date
```

### 3.5 LLM Prompt 设计（核心）

```
你是一个学术论文分析助手。请阅读以下论文全文，提取以下信息并以 JSON 格式返回。

## 提取字段
- title: 论文标题
- year: 发表年份（数字）
- journal_level: 期刊级别（如 SSCI Q1, SCI Q2, CSSCI 等）
- authors: 作者列表
- abstract: 摘要
- model_diagram_description: 论文中理论模型/框架图的文字描述
- model_type: 模型类型（如结构方程模型、回归模型、TAM、UTAUT 等）
- conclusion: 一句话核心结论
- research_theory: 研究理论（如 TAM 理论、资源基础观等）
- research_method: 研究方法（如问卷调查、实验法、案例研究等）
- iv: 自变量
- dv: 因变量
- dv_direction: 因变量方向（正向/负向/U型等）
- mediator: 中介变量
- moderator: 调节变量
- field: 研究领域
- research_subject: 研究主体（如大学生、企业员工等）
- antecedent_outcome: 前因/结果
- article_type: 文章类型（实证论文、综述、理论分析等）
- features: 论文特色/创新点

## 规则
1. 如果论文中没有提到某个字段，该字段返回 null
2. 不要编造信息
3. 只返回 JSON，不要其他文字
4. 作者之间用逗号分隔

## 论文全文
{paper_text}
```

---

## 4. 非功能需求

- **性能:** 单篇 PDF 解析 + LLM 分析应在 30-120 秒内完成（取决于 API 速度和论文长度）
- **存储:** IndexedDB 通常支持数百 MB，可存储数千篇论文的分析结果
- **安全:** API Key 仅存浏览器 localStorage，不经过任何服务端；Vercel 代理仅转发抓取请求，不存储内容
- **兼容性:** 支持 Chrome、Edge、Firefox 最新版；Safari 需测试
- **PWA:** 支持离线访问已分析论文，Service Worker 缓存静态资源

---

## 5. 后续迭代（非本期）

- Electron 桌面应用包装
- 微信小程序版本
- 预设 API 配置模板（便于新手）
- 论文之间的对比分析
- 自定义字段模板（多套配置切换）
- 批量导出为 Word/LaTeX 参考文献格式

---

## 6. UI 设计决策记录

| 决策 | 选择 | 说明 |
|------|------|------|
| 主界面布局 | C - 单栏布局 | 拖拽区在顶，论文列表 + 详情在下方 |
| 结果展示 | 网格卡片 | 标签行 + 两列字段网格 + 结论行 |
| 复制方式 | A - 点击即复制 + 批量按钮 | 三种格式：表格行/标签文本/自然语言 |
| 批量处理 | A - 列表式队列 | 垂直列表，颜色标记状态 |
| API 配置 | 完全自定义 | 多 API 并存，OpenAI 兼容格式 |
