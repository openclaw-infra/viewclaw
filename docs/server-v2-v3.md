# viewClaw 服务端 V2/V3 能力说明

## V2（执行层增强）

- 并发控制：`MAX_CONCURRENCY`
- 重试机制：`RETRY_LIMIT` + `RETRY_BACKOFF_MS`
- 自动调度：`AUTO_EXECUTE=1`
- OpenClaw 执行适配：`EXECUTOR_MODE=openclaw`
- 通知：`NOTIFY_WEBHOOK_URL`

## V3（治理与可观测）

- 多项目隔离：通过 `x-project-id` / `projectId`
- 角色权限（RBAC）：`viewer/operator/admin`
- 审计日志：`/api/audits` + `data/audits.json`
- 任务模板：`/api/templates` + `templateId` 创建任务

## 新增 API

- `GET /api/templates`
- `POST /api/templates`
- `GET /api/audits`（admin）
- `POST /api/runs/:id/finalize`

## 关键配置

见 `server/.env.example`
