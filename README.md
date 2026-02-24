# viewClaw

viewClaw is a mobile-oriented task orchestration and observability system designed to work with OpenClaw-style agent execution.

It provides:
- A deployable backend service based on **Bun + Elysia**
- A mobile client based on **Expo + Tamagui + Zustand**
- End-to-end task lifecycle visibility (task queue, runs, templates, audits)

---

## 1. Project Status

- Server: **V1 / V2 / V3 completed**
- Mobile client: core pages and server capability integration completed
- CI/CD: Expo Android build and GitHub Release workflow configured

---

## 2. Repository Structure

```text
viewClaw/
  server/   Backend service (Bun + Elysia)
  mobile/   Mobile application (Expo)
  docs/     Technical and deployment documentation
```

---

## 3. Quick Start

### 3.1 Start Backend

```bash
cd server
bun install
cp .env.example .env
bun run dev
```

Default binding: `0.0.0.0:8787`

### 3.2 Start Mobile App

```bash
cd mobile
npm install
npm run start
```

Configure the following in **Settings**:
- `API Base URL` (e.g., `http://<server-ip>:8787`)
- `Project ID` (default: `default`)
- `Token` (required when RBAC is enabled)

These values are persisted locally.

---

## 4. Server Capabilities

### V1 — Task Fundamentals
- Task CRUD and lifecycle states: `queued / in-progress / done / failed`
- Run records
- Manual worker dispatch

### V2 — Execution Enhancements
- Auto scheduler (`AUTO_EXECUTE=1`)
- Concurrency control (`MAX_CONCURRENCY`)
- Retry strategy with backoff (`RETRY_LIMIT`, `RETRY_BACKOFF_MS`)
- OpenClaw executor adapter (`EXECUTOR_MODE=openclaw`)
- Optional webhook notifications (`NOTIFY_WEBHOOK_URL`)

### V3 — Governance and Operations
- Multi-project isolation (`x-project-id` / `projectId`)
- RBAC (`viewer / operator / admin`)
- Audit logs
- Task templates

For details, see: `docs/server-v2-v3.md`

---

## 5. Primary API Endpoints

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
- `GET /api/audits` (admin role)

---

## 6. Mobile Pages

- **Board**: task board, dispatch trigger, task details, state operations
- **Runs**: run records and manual finalize actions
- **Templates**: template management and task creation from template
- **Audits**: audit stream view (admin)
- **Settings**: connection config, project switching, token, health check

UX features include loading skeletons, toast feedback, empty states, and user-friendly error mapping.

---

## 7. CI/CD (Mobile)

Configured workflow includes:
- automatic version bump
- EAS Android APK build
- structured release notes generation
- GitHub Release publication

Key files:
- `.github/workflows/mobile-release.yml`
- `mobile/eas.json`
- `mobile/scripts/bump-version.mjs`

Required repository secret:
- `EXPO_TOKEN`

---

## 8. Environment Configuration (Server)

Refer to `server/.env.example`.

Core variables include:
- Scheduler and retry: `AUTO_EXECUTE`, `MAX_CONCURRENCY`, `RETRY_LIMIT`, `RETRY_BACKOFF_MS`
- Executor: `EXECUTOR_MODE`, `OPENCLAW_BASE_URL`, `OPENCLAW_TOKEN`, `OPENCLAW_SPAWN_PATH`
- Governance: `AUTH_ENABLED`, `USER_TOKEN`, `ADMIN_TOKEN`
- Notification: `NOTIFY_WEBHOOK_URL`

---

## 9. Roadmap

- Real-time updates via SSE/WebSocket
- Cost analytics and reporting
- Finer-grained permission model
- Task dependency graph and orchestration
