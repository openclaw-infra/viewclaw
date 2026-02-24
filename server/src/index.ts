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
const AUTO_EXECUTE = process.env.AUTO_EXECUTE === '1';
const EXECUTOR_MODE = process.env.EXECUTOR_MODE || 'mock'; // mock | openclaw
const OPENCLAW_BASE_URL = process.env.OPENCLAW_BASE_URL || '';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '';
const OPENCLAW_SPAWN_PATH = process.env.OPENCLAW_SPAWN_PATH || '/sessions_spawn';

export type TaskStatus = 'queued' | 'in-progress' | 'done' | 'failed';
export type RunStatus = 'running' | 'done' | 'failed';

type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  skill?: string;
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  pickedAt?: string;
  finishedAt?: string;
};

type TaskRun = {
  id: string;
  taskId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  result?: string;
  error?: string;
  executor: 'mock' | 'openclaw';
  externalSessionKey?: string;
  logs: string[];
};

function now() {
  return new Date().toISOString();
}

function ensureStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(TASKS_FILE)) writeFileSync(TASKS_FILE, '[]', 'utf8');
  if (!existsSync(RUNS_FILE)) writeFileSync(RUNS_FILE, '[]', 'utf8');
}

function loadTasks(): Task[] {
  ensureStore();
  return JSON.parse(readFileSync(TASKS_FILE, 'utf8')) as Task[];
}

function saveTasks(tasks: Task[]) {
  writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
}

function loadRuns(): TaskRun[] {
  ensureStore();
  return JSON.parse(readFileSync(RUNS_FILE, 'utf8')) as TaskRun[];
}

function saveRuns(runs: TaskRun[]) {
  writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2), 'utf8');
}

function getTaskById(id: string) {
  const tasks = loadTasks();
  return tasks.find((x) => x.id === id);
}

function createRun(taskId: string): TaskRun {
  const runs = loadRuns();
  const run: TaskRun = {
    id: randomUUID(),
    taskId,
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
  task.status = 'failed';
  task.error = error;
  task.finishedAt = now();
  task.updatedAt = now();
  saveTasks(tasks);
  return task;
}

async function runMockExecutor(taskId: string, runId: string) {
  const task = getTaskById(taskId);
  if (!task) {
    updateRun(runId, {
      status: 'failed',
      finishedAt: now(),
      error: 'Task not found before execution',
      logs: ['Task not found before execution'],
    });
    return;
  }

  updateRun(runId, {
    logs: [`Start executing: ${task.title}`, 'Running mock execution...'],
  });

  await new Promise((r) => setTimeout(r, 3000));

  const result = `Mock completed: ${task.title}`;
  completeTask(taskId, result);
  const existing = loadRuns().find((x) => x.id === runId);
  updateRun(runId, {
    status: 'done',
    finishedAt: now(),
    result,
    logs: [...(existing?.logs || []), 'Execution finished successfully'],
  });
}

async function runOpenClawExecutor(taskId: string, runId: string) {
  const task = getTaskById(taskId);
  if (!task) throw new Error('Task not found before execution');
  if (!OPENCLAW_BASE_URL) throw new Error('OPENCLAW_BASE_URL is required for openclaw executor mode');

  const url = `${OPENCLAW_BASE_URL.replace(/\/+$/, '')}${OPENCLAW_SPAWN_PATH}`;
  const prompt = [task.title, task.description, task.skill ? `Skill: ${task.skill}` : ''].filter(Boolean).join('\n\n');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(OPENCLAW_TOKEN ? { Authorization: `Bearer ${OPENCLAW_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      task: prompt,
      label: `viewclaw-${task.id}`,
      cleanup: 'keep',
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`openclaw spawn failed: ${res.status} ${txt}`);
  }

  const data = (await res.json()) as any;
  const sessionKey = data?.sessionKey || data?.session?.key || data?.key;
  const summary = data?.summary || data?.result || data?.message;

  const existing = loadRuns().find((x) => x.id === runId);
  const logs = [...(existing?.logs || []), `Spawned OpenClaw task via ${OPENCLAW_SPAWN_PATH}`];

  if (sessionKey && !summary) {
    updateRun(runId, {
      externalSessionKey: sessionKey,
      logs: [...logs, `Sub-session: ${sessionKey}`],
    });
    return;
  }

  const finalResult = summary || `Spawn requested successfully. sessionKey=${sessionKey || 'n/a'}`;
  completeTask(taskId, finalResult);
  updateRun(runId, {
    status: 'done',
    finishedAt: now(),
    result: finalResult,
    externalSessionKey: sessionKey,
    logs: [...logs, 'OpenClaw execution completed (sync result)'],
  });
}

async function dispatchNextTask() {
  const tasks = loadTasks();
  const target = tasks
    .filter((x) => x.status === 'queued')
    .sort((a, b) => {
      const rank = { urgent: 4, high: 3, medium: 2, low: 1 } as const;
      return rank[b.priority] - rank[a.priority] || a.createdAt.localeCompare(b.createdAt);
    })[0];

  if (!target) return { ok: true, message: 'No queued task' };

  pickupTask(target.id);
  const run = createRun(target.id);

  try {
    if (EXECUTOR_MODE === 'openclaw') {
      await runOpenClawExecutor(target.id, run.id);
    } else {
      await runMockExecutor(target.id, run.id);
    }
    return { ok: true, taskId: target.id, runId: run.id, executor: EXECUTOR_MODE };
  } catch (e: any) {
    failTask(target.id, e?.message ?? 'Unknown worker error');
    updateRun(run.id, {
      status: 'failed',
      finishedAt: now(),
      error: e?.message ?? 'Unknown worker error',
    });
    return { ok: false, taskId: target.id, runId: run.id, error: e?.message ?? 'Unknown worker error' };
  }
}

const app = new Elysia()
  .use(cors())
  .get('/health', () => ({ ok: true, service: 'viewclaw-server', time: now(), autoExecute: AUTO_EXECUTE, executorMode: EXECUTOR_MODE }))
  .get('/api/tasks', () => loadTasks())
  .get('/api/tasks/queue', () => loadTasks().filter((x) => x.status === 'queued'))
  .get('/api/tasks/:id', ({ params, set }) => {
    const task = getTaskById(params.id);
    if (!task) {
      set.status = 404;
      return { error: 'Task not found' };
    }
    const runs = loadRuns().filter((r) => r.taskId === task.id);
    return { ...task, runs };
  })
  .get('/api/runs', () => loadRuns())
  .post(
    '/api/tasks',
    ({ body }) => {
      const tasks = loadTasks();
      const task: Task = {
        id: randomUUID(),
        title: body.title,
        description: body.description,
        priority: body.priority ?? 'medium',
        skill: body.skill,
        status: 'queued',
        createdAt: now(),
        updatedAt: now(),
      };
      tasks.unshift(task);
      saveTasks(tasks);
      return task;
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
        priority: t.Optional(t.Union([t.Literal('low'), t.Literal('medium'), t.Literal('high'), t.Literal('urgent')])),
        skill: t.Optional(t.String()),
      }),
    }
  )
  .post('/api/tasks/:id/pickup', ({ params, set }) => {
    const task = pickupTask(params.id);
    if (!task) {
      set.status = 404;
      return { error: 'Task not found' };
    }
    return task;
  })
  .post(
    '/api/tasks/:id/complete',
    ({ params, body, set }) => {
      const task = completeTask(params.id, body.result);
      if (!task) {
        set.status = 404;
        return { error: 'Task not found' };
      }
      return task;
    },
    { body: t.Object({ result: t.Optional(t.String()) }) }
  )
  .post(
    '/api/tasks/:id/fail',
    ({ params, body, set }) => {
      const task = failTask(params.id, body.error);
      if (!task) {
        set.status = 404;
        return { error: 'Task not found' };
      }
      return task;
    },
    { body: t.Object({ error: t.String() }) }
  )
  .post(
    '/api/runs/:id/finalize',
    ({ params, body, set }) => {
      const runs = loadRuns();
      const run = runs.find((x) => x.id === params.id);
      if (!run) {
        set.status = 404;
        return { error: 'Run not found' };
      }

      const task = getTaskById(run.taskId);
      if (!task) {
        set.status = 404;
        return { error: 'Task not found' };
      }

      if (body.status === 'done') {
        completeTask(run.taskId, body.result);
        updateRun(run.id, {
          status: 'done',
          result: body.result,
          finishedAt: now(),
          logs: [...run.logs, body.log || 'Run finalized as done'],
        });
      } else {
        failTask(run.taskId, body.error || 'Unknown error');
        updateRun(run.id, {
          status: 'failed',
          error: body.error || 'Unknown error',
          finishedAt: now(),
          logs: [...run.logs, body.log || 'Run finalized as failed'],
        });
      }

      return { ok: true };
    },
    {
      body: t.Object({
        status: t.Union([t.Literal('done'), t.Literal('failed')]),
        result: t.Optional(t.String()),
        error: t.Optional(t.String()),
        log: t.Optional(t.String()),
      }),
    }
  )
  .post('/api/worker/tick', async () => dispatchNextTask())
  .listen({ port: PORT, hostname: HOST });

if (AUTO_EXECUTE) {
  setInterval(() => {
    dispatchNextTask().catch(() => undefined);
  }, 5000);
}

console.log(`viewClaw server running at http://${HOST}:${PORT}`);
