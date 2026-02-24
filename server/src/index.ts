import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = join(process.cwd(), 'data');
const TASKS_FILE = join(DATA_DIR, 'tasks.json');
const RUNS_FILE = join(DATA_DIR, 'runs.json');
const TEMPLATES_FILE = join(DATA_DIR, 'templates.json');
const AUDITS_FILE = join(DATA_DIR, 'audits.json');

const AUTO_EXECUTE = process.env.AUTO_EXECUTE === '1';
const EXECUTOR_MODE = process.env.EXECUTOR_MODE || 'mock'; // mock | openclaw
const OPENCLAW_BASE_URL = process.env.OPENCLAW_BASE_URL || '';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '';
const OPENCLAW_SPAWN_PATH = process.env.OPENCLAW_SPAWN_PATH || '/sessions_spawn';

const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY || 2);
const RETRY_LIMIT = Number(process.env.RETRY_LIMIT || 2);
const RETRY_BACKOFF_MS = Number(process.env.RETRY_BACKOFF_MS || 15000);
const NOTIFY_WEBHOOK_URL = process.env.NOTIFY_WEBHOOK_URL || '';

const AUTH_ENABLED = process.env.AUTH_ENABLED === '1';
const USER_TOKEN = process.env.USER_TOKEN || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

export type TaskStatus = 'queued' | 'in-progress' | 'done' | 'failed';
export type RunStatus = 'running' | 'done' | 'failed';

export type Role = 'viewer' | 'operator' | 'admin';

type Task = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  skill?: string;
  templateId?: string;
  result?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
  createdAt: string;
  updatedAt: string;
  pickedAt?: string;
  finishedAt?: string;
  createdBy?: string;
};

type TaskRun = {
  id: string;
  taskId: string;
  projectId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  result?: string;
  error?: string;
  executor: 'mock' | 'openclaw';
  externalSessionKey?: string;
  logs: string[];
};

type Template = {
  id: string;
  projectId: string;
  name: string;
  prompt: string;
  skill?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  updatedAt: string;
};

type AuditLog = {
  id: string;
  at: string;
  actor: string;
  role: Role;
  action: string;
  projectId: string;
  resourceId?: string;
  detail?: string;
};

function now() {
  return new Date().toISOString();
}

function ensureStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(TASKS_FILE)) writeFileSync(TASKS_FILE, '[]', 'utf8');
  if (!existsSync(RUNS_FILE)) writeFileSync(RUNS_FILE, '[]', 'utf8');
  if (!existsSync(TEMPLATES_FILE)) writeFileSync(TEMPLATES_FILE, '[]', 'utf8');
  if (!existsSync(AUDITS_FILE)) writeFileSync(AUDITS_FILE, '[]', 'utf8');
}

function loadJson<T>(path: string): T[] {
  ensureStore();
  return JSON.parse(readFileSync(path, 'utf8')) as T[];
}

function saveJson<T>(path: string, data: T[]) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}

const loadTasks = () => loadJson<Task>(TASKS_FILE);
const saveTasks = (tasks: Task[]) => saveJson(TASKS_FILE, tasks);
const loadRuns = () => loadJson<TaskRun>(RUNS_FILE);
const saveRuns = (runs: TaskRun[]) => saveJson(RUNS_FILE, runs);
const loadTemplates = () => loadJson<Template>(TEMPLATES_FILE);
const saveTemplates = (items: Template[]) => saveJson(TEMPLATES_FILE, items);
const loadAudits = () => loadJson<AuditLog>(AUDITS_FILE);
const saveAudits = (items: AuditLog[]) => saveJson(AUDITS_FILE, items);

function getProjectId(ctx: any) {
  return (ctx.headers?.['x-project-id'] as string) || (ctx.query?.projectId as string) || 'default';
}

function auth(ctx: any): { role: Role; actor: string } {
  if (!AUTH_ENABLED) return { role: 'admin', actor: 'system' };
  const token = (ctx.headers?.authorization || '').replace(/^Bearer\s+/i, '') || (ctx.headers?.['x-api-key'] as string) || '';
  if (token && token === ADMIN_TOKEN) return { role: 'admin', actor: 'admin-token' };
  if (token && token === USER_TOKEN) return { role: 'operator', actor: 'user-token' };
  return { role: 'viewer', actor: 'anonymous' };
}

function requireRole(ctx: any, need: Role) {
  const rank: Record<Role, number> = { viewer: 1, operator: 2, admin: 3 };
  const user = auth(ctx);
  if (rank[user.role] < rank[need]) {
    ctx.set.status = 403;
    return { ok: false as const, error: `Need role ${need}` };
  }
  return { ok: true as const, user };
}

function audit(entry: Omit<AuditLog, 'id' | 'at'>) {
  const audits = loadAudits();
  audits.unshift({ id: randomUUID(), at: now(), ...entry });
  saveAudits(audits.slice(0, 5000));
}

async function notify(event: string, payload: object) {
  if (!NOTIFY_WEBHOOK_URL) return;
  try {
    await fetch(NOTIFY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, at: now(), ...payload }),
    });
  } catch {
    // ignore notification failures
  }
}

function getTaskById(id: string) {
  return loadTasks().find((x) => x.id === id);
}

function createRun(task: Task): TaskRun {
  const runs = loadRuns();
  const run: TaskRun = {
    id: randomUUID(),
    taskId: task.id,
    projectId: task.projectId,
    status: 'running',
    startedAt: now(),
    executor: EXECUTOR_MODE === 'openclaw' ? 'openclaw' : 'mock',
    logs: ['Task picked by worker'],
  };
  runs.unshift(run);
  saveRuns(runs);
  return run;
}

function updateRun(runId: string, patch: Partial<TaskRun>) {
  const runs = loadRuns();
  const run = runs.find((x) => x.id === runId);
  if (!run) return null;
  Object.assign(run, patch);
  saveRuns(runs);
  return run;
}

function pickupTask(taskId: string) {
  const tasks = loadTasks();
  const task = tasks.find((x) => x.id === taskId);
  if (!task) return null;
  if (task.status === 'done' || task.status === 'failed') return task;
  task.status = 'in-progress';
  task.pickedAt = now();
  task.updatedAt = now();
  saveTasks(tasks);
  return task;
}

function completeTask(taskId: string, result?: string) {
  const tasks = loadTasks();
  const task = tasks.find((x) => x.id === taskId);
  if (!task) return null;
  task.status = 'done';
  task.result = result;
  task.error = undefined;
  task.finishedAt = now();
  task.updatedAt = now();
  saveTasks(tasks);
  return task;
}

function failTask(taskId: string, error: string) {
  const tasks = loadTasks();
  const task = tasks.find((x) => x.id === taskId);
  if (!task) return null;

  task.retryCount += 1;
  const canRetry = task.retryCount <= task.maxRetries;

  if (canRetry) {
    task.status = 'queued';
    task.error = `Retry #${task.retryCount}: ${error}`;
    task.nextRetryAt = new Date(Date.now() + RETRY_BACKOFF_MS * task.retryCount).toISOString();
    task.updatedAt = now();
  } else {
    task.status = 'failed';
    task.error = error;
    task.finishedAt = now();
    task.updatedAt = now();
  }

  saveTasks(tasks);
  return task;
}

async function runMockExecutor(task: Task, runId: string) {
  updateRun(runId, { logs: [`Start executing: ${task.title}`, 'Running mock execution...'] });
  await new Promise((r) => setTimeout(r, 2500));
  const result = `Mock completed: ${task.title}`;
  completeTask(task.id, result);
  const existing = loadRuns().find((x) => x.id === runId);
  updateRun(runId, {
    status: 'done',
    finishedAt: now(),
    result,
    logs: [...(existing?.logs || []), 'Execution finished successfully'],
  });
}

async function runOpenClawExecutor(task: Task, runId: string) {
  if (!OPENCLAW_BASE_URL) throw new Error('OPENCLAW_BASE_URL is required for openclaw mode');
  const url = `${OPENCLAW_BASE_URL.replace(/\/+$/, '')}${OPENCLAW_SPAWN_PATH}`;
  const prompt = [task.title, task.description, task.skill ? `Skill: ${task.skill}` : ''].filter(Boolean).join('\n\n');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(OPENCLAW_TOKEN ? { Authorization: `Bearer ${OPENCLAW_TOKEN}` } : {}),
    },
    body: JSON.stringify({ task: prompt, label: `viewclaw-${task.id}`, cleanup: 'keep' }),
  });
  if (!res.ok) throw new Error(`openclaw spawn failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as any;
  const sessionKey = data?.sessionKey || data?.session?.key || data?.key;
  const summary = data?.summary || data?.result || data?.message;
  const existing = loadRuns().find((x) => x.id === runId);
  const logs = [...(existing?.logs || []), `Spawned OpenClaw via ${OPENCLAW_SPAWN_PATH}`];

  if (summary) {
    completeTask(task.id, String(summary));
    updateRun(runId, {
      status: 'done',
      finishedAt: now(),
      result: String(summary),
      externalSessionKey: sessionKey,
      logs: [...logs, 'OpenClaw execution completed (sync result)'],
    });
  } else {
    updateRun(runId, {
      externalSessionKey: sessionKey,
      logs: [...logs, `Sub-session: ${sessionKey || 'n/a'}`],
    });
  }
}

function runningCount(projectId?: string) {
  return loadTasks().filter((x) => x.status === 'in-progress' && (!projectId || x.projectId === projectId)).length;
}

function assertSameProject(resourceProjectId: string, requestProjectId: string) {
  return resourceProjectId === requestProjectId;
}

async function dispatchNextTask(projectId?: string) {
  if (runningCount(projectId) >= MAX_CONCURRENCY) {
    return { ok: true, message: 'Concurrency limit reached', maxConcurrency: MAX_CONCURRENCY };
  }

  const tasks = loadTasks();
  const current = Date.now();
  const target = tasks
    .filter((x) => x.status === 'queued')
    .filter((x) => !projectId || x.projectId === projectId)
    .filter((x) => !x.nextRetryAt || new Date(x.nextRetryAt).getTime() <= current)
    .sort((a, b) => {
      const rank = { urgent: 4, high: 3, medium: 2, low: 1 } as const;
      return rank[b.priority] - rank[a.priority] || a.createdAt.localeCompare(b.createdAt);
    })[0];

  if (!target) return { ok: true, message: 'No queued task' };

  pickupTask(target.id);
  const run = createRun(target);

  try {
    if (EXECUTOR_MODE === 'openclaw') await runOpenClawExecutor(target, run.id);
    else await runMockExecutor(target, run.id);

    const latestTask = getTaskById(target.id);
    const isDone = latestTask?.status === 'done';

    audit({
      actor: 'worker',
      role: 'operator',
      action: isDone ? 'task.dispatch.success' : 'task.dispatch.spawned',
      projectId: target.projectId,
      resourceId: target.id,
      detail: `run=${run.id}`,
    });

    await notify(isDone ? 'task.done' : 'task.spawned', {
      taskId: target.id,
      projectId: target.projectId,
      runId: run.id,
      status: latestTask?.status || 'in-progress',
    });

    return { ok: true, taskId: target.id, runId: run.id, executor: EXECUTOR_MODE, status: latestTask?.status || 'in-progress' };
  } catch (e: any) {
    const failed = failTask(target.id, e?.message ?? 'Unknown worker error');
    const finalStatus = failed?.status === 'failed' ? 'failed' : 'queued';
    updateRun(run.id, { status: 'failed', finishedAt: now(), error: e?.message ?? 'Unknown worker error' });
    audit({ actor: 'worker', role: 'operator', action: 'task.dispatch.fail', projectId: target.projectId, resourceId: target.id, detail: `${finalStatus}: ${e?.message ?? 'Unknown'}` });
    await notify('task.failed', { taskId: target.id, projectId: target.projectId, runId: run.id, error: e?.message ?? 'Unknown worker error', finalStatus });
    return { ok: false, taskId: target.id, runId: run.id, error: e?.message ?? 'Unknown worker error', finalStatus };
  }
}

const app = new Elysia()
  .use(cors())
  .get('/health', () => ({
    ok: true,
    service: 'viewclaw-server',
    time: now(),
    autoExecute: AUTO_EXECUTE,
    executorMode: EXECUTOR_MODE,
    maxConcurrency: MAX_CONCURRENCY,
    authEnabled: AUTH_ENABLED,
  }))
  .get('/api/tasks', ({ query, headers }) => {
    const projectId = (query.projectId as string) || (headers['x-project-id'] as string) || 'default';
    return loadTasks().filter((x) => x.projectId === projectId);
  })
  .get('/api/tasks/queue', ({ query, headers }) => {
    const projectId = (query.projectId as string) || (headers['x-project-id'] as string) || 'default';
    return loadTasks().filter((x) => x.projectId === projectId && x.status === 'queued');
  })
  .get('/api/tasks/:id', (ctx) => {
    const task = getTaskById(ctx.params.id);
    if (!task) {
      ctx.set.status = 404;
      return { error: 'Task not found' };
    }

    const projectId = getProjectId(ctx);
    if (!assertSameProject(task.projectId, projectId)) {
      ctx.set.status = 403;
      return { error: 'Cross-project access denied' };
    }

    return { ...task, runs: loadRuns().filter((r) => r.taskId === task.id) };
  })
  .get('/api/runs', ({ query, headers }) => {
    const projectId = (query.projectId as string) || (headers['x-project-id'] as string) || 'default';
    return loadRuns().filter((x) => x.projectId === projectId);
  })
  .get('/api/audits', (ctx) => {
    const gate = requireRole(ctx, 'admin');
    if (!gate.ok) return gate;
    const projectId = getProjectId(ctx);
    return loadAudits().filter((x) => x.projectId === projectId).slice(0, 300);
  })
  .get('/api/templates', ({ query, headers }) => {
    const projectId = (query.projectId as string) || (headers['x-project-id'] as string) || 'default';
    return loadTemplates().filter((x) => x.projectId === projectId);
  })
  .post(
    '/api/templates',
    (ctx) => {
      const gate = requireRole(ctx, 'operator');
      if (!gate.ok) return gate;
      const projectId = getProjectId(ctx);
      const items = loadTemplates();
      const item: Template = {
        id: randomUUID(),
        projectId,
        name: ctx.body.name,
        prompt: ctx.body.prompt,
        skill: ctx.body.skill,
        priority: ctx.body.priority ?? 'medium',
        createdAt: now(),
        updatedAt: now(),
      };
      items.unshift(item);
      saveTemplates(items);
      audit({ actor: gate.user.actor, role: gate.user.role, action: 'template.create', projectId, resourceId: item.id, detail: item.name });
      return item;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        prompt: t.String({ minLength: 1 }),
        skill: t.Optional(t.String()),
        priority: t.Optional(t.Union([t.Literal('low'), t.Literal('medium'), t.Literal('high'), t.Literal('urgent')])),
      }),
    }
  )
  .post(
    '/api/tasks',
    (ctx) => {
      const gate = requireRole(ctx, 'operator');
      if (!gate.ok) return gate;

      const projectId = getProjectId(ctx);
      const tasks = loadTasks();
      let title = ctx.body.title;
      let description = ctx.body.description;
      let skill = ctx.body.skill;
      let priority = ctx.body.priority ?? 'medium';

      if (ctx.body.templateId) {
        const tpl = loadTemplates().find((x) => x.id === ctx.body.templateId && x.projectId === projectId);
        if (!tpl) {
          ctx.set.status = 404;
          return { error: 'Template not found' };
        }
        title = title || tpl.name;
        description = description || tpl.prompt;
        skill = skill || tpl.skill;
        priority = priority || tpl.priority;
      }

      if (!title || !title.trim()) {
        ctx.set.status = 400;
        return { error: 'title is required (or provide a valid templateId)' };
      }

      const task: Task = {
        id: randomUUID(),
        projectId,
        title: title.trim(),
        description,
        priority,
        skill,
        templateId: ctx.body.templateId,
        status: 'queued',
        retryCount: 0,
        maxRetries: ctx.body.maxRetries ?? RETRY_LIMIT,
        createdAt: now(),
        updatedAt: now(),
        createdBy: gate.user.actor,
      };

      tasks.unshift(task);
      saveTasks(tasks);
      audit({ actor: gate.user.actor, role: gate.user.role, action: 'task.create', projectId, resourceId: task.id, detail: task.title });
      return task;
    },
    {
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1 })),
        description: t.Optional(t.String()),
        priority: t.Optional(t.Union([t.Literal('low'), t.Literal('medium'), t.Literal('high'), t.Literal('urgent')])),
        skill: t.Optional(t.String()),
        templateId: t.Optional(t.String()),
        maxRetries: t.Optional(t.Number()),
      }),
    }
  )
  .post('/api/tasks/:id/pickup', (ctx) => {
    const gate = requireRole(ctx, 'operator');
    if (!gate.ok) return gate;
    const task = pickupTask(ctx.params.id);
    if (!task) {
      ctx.set.status = 404;
      return { error: 'Task not found' };
    }
    audit({ actor: gate.user.actor, role: gate.user.role, action: 'task.pickup', projectId: task.projectId, resourceId: task.id });
    return task;
  })
  .post('/api/tasks/:id/complete', (ctx) => {
    const gate = requireRole(ctx, 'operator');
    if (!gate.ok) return gate;
    const task = completeTask(ctx.params.id, ctx.body?.result);
    if (!task) {
      ctx.set.status = 404;
      return { error: 'Task not found' };
    }
    audit({ actor: gate.user.actor, role: gate.user.role, action: 'task.complete', projectId: task.projectId, resourceId: task.id });
    return task;
  }, { body: t.Object({ result: t.Optional(t.String()) }) })
  .post('/api/tasks/:id/fail', (ctx) => {
    const gate = requireRole(ctx, 'operator');
    if (!gate.ok) return gate;
    const task = failTask(ctx.params.id, ctx.body.error);
    if (!task) {
      ctx.set.status = 404;
      return { error: 'Task not found' };
    }
    audit({ actor: gate.user.actor, role: gate.user.role, action: 'task.fail', projectId: task.projectId, resourceId: task.id, detail: task.error });
    return task;
  }, { body: t.Object({ error: t.String() }) })
  .post('/api/runs/:id/finalize', (ctx) => {
    const gate = requireRole(ctx, 'operator');
    if (!gate.ok) return gate;

    const runs = loadRuns();
    const run = runs.find((x) => x.id === ctx.params.id);
    if (!run) {
      ctx.set.status = 404;
      return { error: 'Run not found' };
    }

    const projectId = getProjectId(ctx);
    if (!assertSameProject(run.projectId, projectId)) {
      ctx.set.status = 403;
      return { error: 'Cross-project access denied' };
    }

    if (run.finishedAt) {
      return { ok: true, idempotent: true, status: run.status };
    }

    if (ctx.body.status === 'done') {
      completeTask(run.taskId, ctx.body.result);
      updateRun(run.id, {
        status: 'done',
        result: ctx.body.result,
        finishedAt: now(),
        logs: [...run.logs, ctx.body.log || 'Run finalized as done'],
      });
    } else {
      failTask(run.taskId, ctx.body.error || 'Unknown error');
      updateRun(run.id, {
        status: 'failed',
        error: ctx.body.error || 'Unknown error',
        finishedAt: now(),
        logs: [...run.logs, ctx.body.log || 'Run finalized as failed'],
      });
    }

    audit({ actor: gate.user.actor, role: gate.user.role, action: 'run.finalize', projectId: run.projectId, resourceId: run.id, detail: ctx.body.status });
    return { ok: true };
  }, {
    body: t.Object({
      status: t.Union([t.Literal('done'), t.Literal('failed')]),
      result: t.Optional(t.String()),
      error: t.Optional(t.String()),
      log: t.Optional(t.String()),
    }),
  })
  .post('/api/worker/tick', async (ctx) => {
    const gate = requireRole(ctx, 'operator');
    if (!gate.ok) return gate;
    const projectId = getProjectId(ctx);
    return dispatchNextTask(projectId);
  })
  .listen({ port: PORT, hostname: HOST });

if (AUTO_EXECUTE) {
  setInterval(() => {
    const projects = [...new Set(loadTasks().filter((x) => x.status === 'queued').map((x) => x.projectId))];
    if (projects.length === 0) {
      dispatchNextTask('default').catch(() => undefined);
      return;
    }
    projects.forEach((p) => {
      dispatchNextTask(p).catch(() => undefined);
    });
  }, 5000);
}

console.log(`viewClaw server running at http://${HOST}:${PORT}`);
