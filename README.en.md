<div align="center">

<img src="docs/images/logos/logo-3-lettermark.svg" width="200" height="200" alt="Gaia Logo" />

# Gaia · Visual AI Workflow Editor

**Build AI workflows, visually. Powered by [flowgram.ai](https://github.com/bytedance/flowgram.ai).**

[![GitHub Stars](https://img.shields.io/github/stars/boommanpro/gaia-workflow-engine?style=for-the-badge&logo=github&label=Stars&color=orange)](https://github.com/boommanpro/gaia-workflow-engine/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![GitHub Release](https://img.shields.io/github/v/release/boommanpro/gaia-workflow-engine?style=for-the-badge)](https://github.com/boommanpro/gaia-workflow-engine/releases)
[![Live Demo](https://img.shields.io/badge/demo-GitHub%20Pages-blue.svg?style=for-the-badge)](https://boommanpro.github.io/gaia-workflow-engine/)

**[English](./README.en.md)** · **[简体中文](./README.md)**

</div>

---

A modern visual rule engine platform for orchestrating complex AI workflows. Design, test, and deploy AI pipelines on an infinite canvas — no code required. Combines the power of [flowgram.ai](https://flowgram.ai) with a Java backend for production-ready workflow management.

## Features

- **AI Agent Sidebar** — Conversational workflow generation: CreatePlan step-by-step planning, Canvas auto-create nodes & edges, HTTP/Query workflow lookup, live token & plan progress; sessions are renameable and reviewable.
- **Agent Config Center** — Model settings (Host/Key/Temperature/Max Tokens), Embedding vector search (Jina RAG knowledge chunks), system prompt & tool catalog (navigate/query/manage/canvas/createPlan/executeStep), and tool permission policies (allow/confirm/deny).
- **Debug Info Panel** — One DebugEntry per LLM call: raw request (with messages), raw response (with toolCalls), context details, SSE event replay, Raw JSON viewer; click a message bubble to jump and highlight the corresponding entry.
- **Visual Canvas** — Infinite, zoomable canvas with drag-and-drop nodes. Supports loops, branches, and conditional logic.
- **AI Node Types** — Built-in LLM calls, code execution, HTTP requests, string formatting, and variable management.
- **Real-time Preview** — Test individual nodes or entire workflows with live input/output inspection.
- **Version Management** — Every save creates a version. Switch, track, and roll back with one click.
- **Template System** — Create reusable workflow templates. Spin up new workflows in a single click.
- **Extensible Plugins** — Minimap, auto-layout, snap lines, node panel, and more.
- **Multi-condition Node** — Synced from official flowgram.ai for complex branching logic.

## Screenshots

### Workbench & Workflows

| Page | Preview |
|------|---------|
| **Home** — Internationalized product landing page | ![Home](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/screenshot-home.png) |
| **Live Demo** — Interactive workflow canvas (draggable, add nodes, no run) | ![Live Demo](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/screenshot-demo.png) |
| **Docs** — Quick start, prerequisites, deployment options | ![Docs](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/screenshot-docs.png) |
| **Editor** — Visual workflow editor with version management | ![Editor](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/screenshot-editor.png) |
| **Admin · Workflows** — Workflow management console | ![Admin Workflows](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/screenshot-admin-workflows.png) |
| **Admin · Templates** — Template management console | ![Admin Templates](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/screenshot-admin-templates.png) |
| **Release Log** — Version history timeline | ![Releases](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/screenshot-releases.png) |

### AI Agent

| Page | Preview |
|------|---------|
| **AI Agent Chat** — Sidebar conversational workflow generation with CreatePlan + step cards | ![AI Agent Chat](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/agent/Snipaste_2026-08-07_19-20-20.jpg) |
| **Debug Panel** — Raw request/response, SSE event stream, context, Raw JSON; click messages to jump | ![Debug Panel](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/agent/Snipaste_2026-08-07_19-20-42.jpg) |
| **Agent Config · Models** — API Host/Key, model params, BGE Embedding vector search | ![Agent Config · Models](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/agent/Snipaste_2026-08-07_19-21-14.jpg) |
| **Agent Config · Prompts** — Default system prompt + tool definitions (navigate/query/manage/canvas) | ![Agent Config · Prompts](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/agent/Snipaste_2026-08-07_19-21-29.jpg) |
| **Agent Config · Permissions** — Global tool permission policy (allow/confirm/deny) | ![Agent Config · Permissions](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/agent/Snipaste_2026-08-07_19-21-44.jpg) |
| **Agent Running Workflow** — Auto-creates nodes & edges on canvas, tests and executes step-by-step | ![Agent Running Workflow](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/agent/Snipaste_2026-08-07_19-23-25.jpg) |

## Quick Start

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js     | >= 18   |
| Java        | >= 17   |
| Maven       | 3.x     |
| Git         | any     |

### Frontend

```bash
git clone https://github.com/boommanpro/gaia-workflow-engine.git
cd gaia-workflow-engine/apps/console
npm install
npm run dev
```

Visit http://localhost:3000

### Backend

```bash
cd apps/api/gaia-workflow
mvn spring-boot:run
```

API server runs on port 48080.

## Tech Stack

| Layer       | Technology                                      |
|-------------|-------------------------------------------------|
| Frontend    | React 18, TypeScript, flowgram.ai 1.0.12       |
| Backend     | Spring Boot, MyBatis Plus, Java 17              |
| Database    | SQLite                                          |
| Build       | rsbuild (frontend), Maven (backend)             |

## Deployment Options

1. **Standalone** — Frontend and backend deployed separately for large distributed systems.
2. **All-in-One** — Bundled as a single application for small to medium teams.
3. **GitHub Pages** — Frontend deployed to GitHub Pages with configurable backend address.
4. **Containerized** — Docker images with Kubernetes support for cloud deployment.

## Documentation

Full documentation is available on the [homepage Docs section](https://boommanpro.github.io/gaia-workflow-engine/#docs).

For flowgram.ai framework docs, visit https://flowgram.ai/guide/

## Release Log

See the [Release Log page](https://boommanpro.github.io/gaia-workflow-engine/#/releases) for the full milestone history.

## Contributing

1. Fork this project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

We follow [Conventional Commits](https://www.conventionalcommits.org/).

## License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.

## Star History

[![Star History Chart](https://raw.githubusercontent.com/boommanpro/gaia-workflow-engine/main/docs/images/star-history.svg)](https://www.star-history.com/?repos=boommanpro%2Fgaia-workflow-engine&type=date)

---

<div align="center">

**[Live Demo](https://boommanpro.github.io/gaia-workflow-engine/)** · **[Admin Console](https://boommanpro.github.io/gaia-workflow-engine/#/admin/workflows)** · **[Release Log](https://boommanpro.github.io/gaia-workflow-engine/#/releases)** · **[Issues](https://github.com/boommanpro/gaia-workflow-engine/issues)** · **[Discussions](https://github.com/boommanpro/gaia-workflow-engine/discussions)**

</div>
