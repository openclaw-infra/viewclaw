# viewClaw

一个面向移动端看板的轻量任务系统：
- **server**: Bun + Elysia API（可部署到服务器）
- **mobile**: Expo 客户端（通过配置的 API BaseURL 持久化连接）

## 目录

- `server/` 后端服务
- `mobile/` Expo 客户端（Tamagui Tabs + Zustand 持久化）
- `docs/` 部署说明

## 快速开始

### 1) 启动后端（本地）

```bash
cd server
bun install
bun run dev
```

默认监听 `0.0.0.0:8787`。

### 2) 启动移动端

```bash
cd mobile
npm install
npm run start
```

在 App 内 Settings 页面设置 `API BaseURL`（例如 `http://<server-ip>:8787`），会持久化保存。

---

## API（MVP）

- `GET /health`
- `GET /api/tasks`
- `GET /api/tasks/queue`
- `GET /api/tasks/:id`（含 runs）
- `GET /api/runs`
- `POST /api/tasks`
- `POST /api/tasks/:id/pickup`
- `POST /api/tasks/:id/complete`
- `POST /api/tasks/:id/fail`
- `POST /api/worker/tick`（手动触发一次 worker 调度）
- `POST /api/runs/:id/finalize`（外部回调收敛 run 与 task 状态）

> 任务执行支持两种模式：
> - `EXECUTOR_MODE=mock`：本地模拟执行（默认）
> - `EXECUTOR_MODE=openclaw`：通过 `OPENCLAW_BASE_URL + OPENCLAW_SPAWN_PATH` 调用 OpenClaw 子会话
>
> 设置 `AUTO_EXECUTE=1` 可让服务端自动轮询执行 queued 任务。

## 服务端能力（当前）

- V1: 任务 CRUD + 状态流转 + run 记录
- V2: 自动调度、并发控制、失败重试、OpenClaw 执行适配、Webhook 通知
- V3: 多项目隔离、RBAC（viewer/operator/admin）、审计日志、任务模板

详见：`docs/server-v2-v3.md`

## 后续可扩展

- SSE/WebSocket 实时更新
- 成本统计与报表
- 更细粒度权限模型
