<div align="center">

<img src="docs/images/logos/logo-3-lettermark.svg" width="200" height="200" alt="Gaia Logo" />

# Gaia · 可视化 AI 工作流编辑器

**可视化构建 AI 工作流，基于 [flowgram.ai](https://github.com/bytedance/flowgram.ai) 驱动。**

[![GitHub Stars](https://img.shields.io/github/stars/boommanpro/gaia-workflow-engine?style=for-the-badge&logo=github&label=Stars&color=orange)](https://github.com/boommanpro/gaia-workflow-engine/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![GitHub Release](https://img.shields.io/github/v/release/boommanpro/gaia-workflow-engine?style=for-the-badge)](https://github.com/boommanpro/gaia-workflow-engine/releases)
[![Live Demo](https://img.shields.io/badge/demo-GitHub%20Pages-blue.svg?style=for-the-badge)](https://boommanpro.github.io/gaia-workflow-engine/)

**[English](./README.en.md)** · **[简体中文](./README.md)**

</div>

---

一个现代化的可视化规则引擎平台，用于编排复杂的 AI 工作流。在无限画布上设计、测试和部署 AI 流程——无需编写代码。结合 [flowgram.ai](https://flowgram.ai) 的能力与 Java 服务端，提供生产级工作流管理。

## 功能特性

- **AI Agent 侧栏对话** — 对话式生成工作流：CreatePlan 分步规划、Canvas 自动创建节点/连线、HTTP/Query 查询工作流、实时预览 token 与计划进度；会话可重命名、可审查。
- **Agent 配置中心** — 模型参数（Host/Key/Temperature/Max Tokens）、Embedding 向量检索（Jina RAG 知识块）、系统提示词与工具集（navigate/query/manage/canvas/createPlan/executeStep）、工具权限策略（允许/确认/禁止）。
- **调试信息面板** — 每条 LLM 调用独立 DebugEntry：原始请求（含 messages）、原始响应（含 toolCalls）、上下文详情、SSE Event 回放、Raw JSON；点击消息气泡跳转定位到对应条目。
- **可视化画布** — 无限缩放画布，支持拖拽节点。通过循环、分支和条件逻辑设计复杂的工作流。
- **AI 节点类型** — 内置 LLM 调用、代码执行、HTTP 请求、字符串格式化和变量管理节点。
- **实时预览** — 测试单个节点或整个工作流，实时查看输入输出和执行历史。
- **版本管理** — 每次保存创建一个版本。在版本间切换、追踪变更、一键回滚。
- **模板系统** — 创建可复用的工作流模板。一键从模板创建新工作流。
- **可扩展插件** — 小地图、自动布局、吸附线、节点面板等。
- **多条件节点** — 同步官方 flowgram.ai，支持复杂分支逻辑。

## 截图

### 工作台与工作流

| 页面 | 预览 |
|------|------|
| **首页** — 国际化产品介绍页 | ![首页](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/screenshot-home.png) |
| **在线演示** — 可交互工作流画布（可拖拽、可新增节点、不可运行） | ![在线演示](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/screenshot-demo.png) |
| **文档** — 快速开始、环境准备、部署方案 | ![文档](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/screenshot-docs.png) |
| **编辑器** — 可视化工作流编辑器，含版本管理 | ![编辑器](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/screenshot-editor.png) |
| **管理后台 · 工作流** — 工作流管理控制台 | ![管理工作流](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/screenshot-admin-workflows.png) |
| **管理后台 · 模板** — 模板管理控制台 | ![管理模板](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/screenshot-admin-templates.png) |
| **发布日志** — 版本历史时间线 | ![发布日志](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/screenshot-releases.png) |

### AI Agent

| 页面 | 预览 |
|------|------|
| **AI Agent 对话** — 侧边栏对话式生成工作流，CreatePlan 分步规划 + 步骤执行卡片 | ![AI Agent 对话](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/agent/Snipaste_2026-08-07_19-20-20.jpg) |
| **调试信息面板** — 原始请求/响应、SSE Event、Context 详情、Raw JSON，点击消息跳转定位 | ![调试信息面板](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/agent/Snipaste_2026-08-07_19-20-42.jpg) |
| **Agent 配置中心 · 模型** — API Host/Key、模型参数、Embedding 向量检索（BGE） | ![Agent 模型配置](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/agent/Snipaste_2026-08-07_19-21-14.jpg) |
| **Agent 配置中心 · 提示词** — 默认系统提示词 + 工具集定义（navigate/query/manage/canvas） | ![Agent 提示词配置](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/agent/Snipaste_2026-08-07_19-21-29.jpg) |
| **Agent 配置中心 · 工具权限** — 所有工具的全局权限策略（允许/确认/禁止） | ![Agent 工具权限](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/agent/Snipaste_2026-08-07_19-21-44.jpg) |
| **Agent 执行工作流** — 在画布上自动创建节点与连线，逐步测试并执行 | ![Agent 执行工作流](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/agent/Snipaste_2026-08-07_19-23-25.jpg) |

## 快速开始

### 环境准备

| 要求       | 版本    |
|------------|---------|
| Node.js    | >= 18   |
| Java       | >= 17   |
| Maven      | 3.x     |
| Git        | 任意    |

### 前端运行

```bash
git clone https://github.com/boommanpro/gaia-workflow-engine.git
cd gaia-workflow-engine/apps/console
npm install
npm run dev
```

访问 <http://localhost:3000>

### 后端运行

```bash
cd apps/api/gaia-workflow
mvn spring-boot:run
```

API 服务运行在 48080 端口。

## 技术栈

| 层级     | 技术                                            |
|----------|-------------------------------------------------|
| 前端     | React 18, TypeScript, flowgram.ai 1.0.12        |
| 后端     | Spring Boot, MyBatis Plus, Java 17              |
| 数据库   | SQLite                                          |
| 构建     | rsbuild (前端), Maven (后端)                     |

## 部署方案

1. **独立部署** — 前后端分离部署，适用于大型分布式系统。
2. **一体化部署** — 打包为单一应用，适用于中小型企业。
3. **GitHub Pages** — 前端部署到 GitHub Pages，后端地址可配置。
4. **容器化部署** — 提供 Docker 镜像，支持 Kubernetes 部署。

## 文档

完整文档请访问[首页文档部分](https://boommanpro.github.io/gaia-workflow-engine/#docs)。

flowgram.ai 框架文档：<https://flowgram.ai/guide/>

## 发布日志

完整里程碑历史请查看[发布日志页面](https://boommanpro.github.io/gaia-workflow-engine/#/releases)。

## 贡献

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

我们遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

## 许可证

本项目采用 MIT 许可证 — 详见 [LICENSE](./LICENSE) 文件。

## Star 趋势

[![Star History Chart](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/star-history.svg)](https://www.star-history.com/?repos=boommanpro%2Fgaia-workflow-engine&type=date)

---

<div align="center">

**[在线演示](https://boommanpro.github.io/gaia-workflow-engine/)** · **[管理后台](https://boommanpro.github.io/gaia-workflow-engine/#/admin/workflows)** · **[发布日志](https://boommanpro.github.io/gaia-workflow-engine/#/releases)** · **[Issues](https://github.com/boommanpro/gaia-workflow-engine/issues)** · **[Discussions](https://github.com/boommanpro/gaia-workflow-engine/discussions)**

</div>
