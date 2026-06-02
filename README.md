# 📄 论文阅读助手

批量分析、整理、导出学术论文的浏览器端工具。拖入 PDF 即可用 AI 提取关键信息，所有数据存储在本地浏览器，无需后端。

## 🚀 快速开始

1. 打开 https://yunbocui88-lgtm.github.io/paper-assistant/
2. 点击 **⚙️ API** → 配置大模型接口（支持 OpenAI 兼容 API）
3. 回到 **📋 论文库**，拖入 PDF 文件开始分析

## ⚙️ API 配置说明

本工具不提供 AI 服务，需要自行准备一个大模型 API Key。支持所有兼容 OpenAI 接口的服务，例如：

- **OpenAI** — `https://api.openai.com/v1/chat/completions`
- **DeepSeek** — `https://api.deepseek.com/v1/chat/completions`
- **通义千问** — 阿里云 DashScope 兼容端点
- 其他任何兼容 `/v1/chat/completions` 的 API

> 💡 每个用户在浏览器里独立配置自己的 API Key，互不可见，数据安全。

## 📊 功能

### 论文分析
- 拖入 PDF 自动解析全文，AI 提取 20+ 个预设字段（标题、作者、理论、变量等）
- 支持粘贴 arXiv / 期刊 URL 在线分析
- 支持自定义分析字段，如"参考文献数量""实验样本量"等
- 批量上传，自动排队分析

### 字段管理
- 点击 **🔧 自定义分析字段** 可启用/禁用/新增字段
- 拖拽排序字段位置，导出时列顺序同步
- 每个项目独立字段配置，互不干扰

### 复制与导出
- 单字段点击复制
- 一键复制为表格行 / 标签文本 / 自然语言摘要
- 导出 Excel (.xlsx) 或 CSV，列顺序跟随你的字段排序
- 支持中文翻译（需配置 API）

### 多项目管理
- 创建多个项目分别管理不同方向的论文
- 项目之间数据隔离

## 🛠 技术栈

React 19 + TypeScript + Vite + Tailwind CSS + Dexie (IndexedDB) + PDF.js

纯前端应用，无服务端，数据存储在浏览器 IndexedDB 中。

## 📦 本地运行

```bash
npm install
npm run dev      # 开发模式
npm run build    # 构建
npm run deploy   # 部署到 GitHub Pages
```