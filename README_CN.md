# viewClaw

中文 | [English (README.md)](./README.md)

viewClaw 是一个面向移动端的任务编排与可观测系统，适配 OpenClaw 风格的 Agent 执行场景。

核心组成：
- 基于 **Bun + Elysia** 的可部署后端服务
- 基于 **Expo + Tamagui + Zustand** 的移动客户端
- 覆盖任务全生命周期的可视化能力（任务、执行记录、模板、审计）

---

## 1. 项目状态

- 服务端：**V1 / V2 / V3 已完成**
- 客户端：核心页面与服务端能力已完成联调
- CI/CD：已配置 Expo Android 自动打包与 GitHub Release

---

## 2. 目录结构

```text
viewClaw/
  server/   后端服务（Bun + Elysia）
  mobile/   移动端应用（Expo）
  docs/     技术与部署文档
```

---

## 3. 快速开始

### 3.1 启动后端

```bash
cd server
bun install
cp .env.example .env
bun run dev
```

默认监听：`0.0.0.0:8787`

### 3.2 启动移动端

```bash
cd mobile
npm install
npm run start
```

在移动端 **Settings** 页面配置：
- `API Base URL`（如 `http://<server-ip>:8787`）
- `Project ID`（默认 `default`）
- `Token`（开启 RBAC 时必填）

上述配置会本地持久化。

---

## 4. 服务端能力

### V1（任务基础）
- 任务 CRUD 与状态流转：`queued / in-progress / done / failed`
- 运行记录（runs）
- Worker 手动调度

### V2（执行增强）
- 自动调度（`AUTO_EXECUTE=1`）
- 并发控制（`MAX_CONCURRENCY`）
- 重试与退避（`RETRY_LIMIT`、`RETRY_BACKOFF_MS`）
- OpenClaw 执行适配（`EXECUTOR_MODE=openclaw`）
- 可选 Webhook 通知（`NOTIFY_WEBHOOK_URL`）

### V3（治理能力）
- 多项目隔离（`x-project-id` / `projectId`）
- 角色权限（`viewer / operator / admin`）
- 审计日志
- 任务模板

详细说明见：`docs/server-v2-v3.md`

---

## 5. 主要 API

### Health
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
- `GET /api/audits`（admin 角色）

---

## 6. 移动端页面

- **Board**：任务看板、调度触发、任务详情、状态操作
- **Runs**：执行记录、手动 finalize
- **Templates**：模板管理与一键建任务
- **Audits**：审计日志查看（admin）
- **Settings**：连接配置、项目切换、token、健康检查

体验增强包括：
- skeleton loading
- toast 反馈
- 空态引导
- 统一错误提示映射

---

## 7. CI/CD（移动端）

已配置流程：
- 自动版本号递增
- EAS Android APK 构建
- 结构化 Release Notes 生成
- GitHub Release 发布

关键文件：
- `.github/workflows/mobile-release.yml`
- `mobile/eas.json`
- `mobile/scripts/bump-version.mjs`

仓库需配置 Secret：
- `EXPO_TOKEN`

---

## 8. 环境变量（Server）

请参考 `server/.env.example`。

核心变量：
- 调度与重试：`AUTO_EXECUTE`、`MAX_CONCURRENCY`、`RETRY_LIMIT`、`RETRY_BACKOFF_MS`
- 执行器：`EXECUTOR_MODE`、`OPENCLAW_BASE_URL`、`OPENCLAW_TOKEN`、`OPENCLAW_SPAWN_PATH`
- 权限治理：`AUTH_ENABLED`、`USER_TOKEN`、`ADMIN_TOKEN`
- 通知：`NOTIFY_WEBHOOK_URL`

---

## 9. Roadmap

- SSE/WebSocket 实时订阅
- 成本统计与报表
- 更细粒度权限模型
- 任务依赖图与编排能力
