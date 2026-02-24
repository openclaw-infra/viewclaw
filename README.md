# viewClaw 🌌

面向移动端的任务执行与可视化系统（OpenClaw-friendly）：
- **Server**: Bun + Elysia（可部署到服务器）
- **Mobile**: Expo + Tamagui Tabs + Zustand 持久化

支持：任务看板、执行记录、模板、审计、项目隔离、权限控制、重试与并发调度。

---

## 当前状态

- ✅ Server V1 / V2 / V3 已落地
- ✅ Mobile 客户端已接入服务端核心能力
- ✅ 已配置移动端自动打包与 Release（EAS + GitHub Actions）

---

## 仓库结构

```txt
viewClaw/
  server/   # Bun + Elysia API
  mobile/   # Expo app (Tamagui + Zustand)
  docs/     # 设计与部署文档
```

---

## 快速开始

### 1) 启动服务端

```bash
cd server
bun install
cp .env.example .env
bun run dev
```

默认监听：`0.0.0.0:8787`

### 2) 启动移动端

```bash
cd mobile
npm install
npm run start
```

在移动端 **Settings** 页面填写：
- `API Base URL`（例如 `http://<server-ip>:8787`）
- `Project ID`（默认 `default`）
- `Token`（开启 RBAC 时必填）

这些配置会持久化保存。

---

## 服务端能力

## V1（任务基础）
- 任务 CRUD 与状态流转：`queued / in-progress / done / failed`
- 运行记录（runs）
- Worker 手动调度

## V2（执行增强）
- 自动调度（`AUTO_EXECUTE=1`）
- 并发控制（`MAX_CONCURRENCY`）
- 重试与退避（`RETRY_LIMIT` + `RETRY_BACKOFF_MS`）
- OpenClaw 执行适配（`EXECUTOR_MODE=openclaw`）
- Webhook 通知（`NOTIFY_WEBHOOK_URL`）

## V3（治理能力）
- 多项目隔离（`x-project-id` / `projectId`）
- RBAC（viewer/operator/admin）
- 审计日志（audits）
- 任务模板（templates）

详细说明见：`docs/server-v2-v3.md`

---

## 主要 API

### 健康与概览
- `GET /health`

### Tasks
- `GET /api/tasks`
- `GET /api/tasks/queue`
- `GET /api/tasks/:id`
- `POST /api/tasks`
- `POST /api/tasks/:id/pickup`
- `POST /api/tasks/:id/complete`
- `POST /api/tasks/:id/fail`

### Runs
- `GET /api/runs`
- `POST /api/runs/:id/finalize`

### Worker
- `POST /api/worker/tick`

### Templates
- `GET /api/templates`
- `POST /api/templates`

### Audits
- `GET /api/audits`（admin）

---

## 移动端页面（已实现）

- **Board**：任务看板、手动调度、任务详情、状态操作（含二次确认）
- **Runs**：执行记录、运行态 finalize（done/failed）
- **Templates**：模板管理 + 一键生成任务
- **Audits**：审计日志查看（admin）
- **Settings**：连接配置、项目切换、token、健康检查

体验增强：
- skeleton loading
- toast 反馈
- 空态引导
- 错误信息可读化映射

---

## CI/CD（移动端）

已配置工作流：
- 自动 bump 版本号
- 触发 EAS 构建 APK
- 自动生成结构化 Release Notes
- 发布 GitHub Release

相关文件：
- `.github/workflows/mobile-release.yml`
- `mobile/eas.json`
- `mobile/scripts/bump-version.mjs`

> 需要配置仓库 Secret：`EXPO_TOKEN`

---

## 环境变量（server）

见 `server/.env.example`，核心项：
- `AUTO_EXECUTE`
- `MAX_CONCURRENCY`
- `RETRY_LIMIT`
- `EXECUTOR_MODE`
- `OPENCLAW_BASE_URL`
- `AUTH_ENABLED`
- `USER_TOKEN` / `ADMIN_TOKEN`

---

## 后续路线（可选）

- WebSocket/SSE 实时订阅
- 成本统计与报表
- 更细粒度权限模型
- 任务依赖 DAG / 编排能力
