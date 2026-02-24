# viewClaw

一个面向移动端看板的轻量任务系统：
- **server**: Bun + Elysia API（可部署到服务器）
- **mobile**: Expo 客户端（通过配置的 API BaseURL 持久化连接）

## 目录

- `server/` 后端服务
- `mobile/` Expo 客户端
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

## 后续可扩展

- 增加 `sessions_spawn` 执行器 worker（接入 OpenClaw）
- SSE/WebSocket 实时更新
- 鉴权（Bearer token）
- 多用户/多项目隔离
