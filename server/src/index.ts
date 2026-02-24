import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = join(process.cwd(), 'data');
const TASKS_FILE = join(DATA_DIR, 'tasks.json');

type TaskStatus = 'queued' | 'in-progress' | 'done' | 'failed';
type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  skill?: string;
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

function ensureStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(TASKS_FILE)) writeFileSync(TASKS_FILE, '[]', 'utf8');
}

function loadTasks(): Task[] {
  ensureStore();
  return JSON.parse(readFileSync(TASKS_FILE, 'utf8')) as Task[];
}

function saveTasks(tasks: Task[]) {
  writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
}

function now() {
  return new Date().toISOString();
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

const app = new Elysia()
  .use(cors())
  .get('/health', () => ({ ok: true, service: 'viewclaw-server', time: now() }))
  .get('/api/tasks', () => loadTasks())
  .post(
    '/api/tasks',
    ({ body }) => {
      const tasks = loadTasks();
      const task: Task = {
        id: genId(),
        title: body.title,
        description: body.description,
        priority: body.priority,
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
    const tasks = loadTasks();
    const task = tasks.find((x) => x.id === params.id);
    if (!task) {
      set.status = 404;
      return { error: 'Task not found' };
    }
    task.status = 'in-progress';
    task.updatedAt = now();
    saveTasks(tasks);
    return task;
  })
  .post(
    '/api/tasks/:id/complete',
    ({ params, body, set }) => {
      const tasks = loadTasks();
      const task = tasks.find((x) => x.id === params.id);
      if (!task) {
        set.status = 404;
        return { error: 'Task not found' };
      }
      task.status = 'done';
      task.result = body.result;
      task.updatedAt = now();
      saveTasks(tasks);
      return task;
    },
    { body: t.Object({ result: t.Optional(t.String()) }) }
  )
  .post(
    '/api/tasks/:id/fail',
    ({ params, body, set }) => {
      const tasks = loadTasks();
      const task = tasks.find((x) => x.id === params.id);
      if (!task) {
        set.status = 404;
        return { error: 'Task not found' };
      }
      task.status = 'failed';
      task.error = body.error;
      task.updatedAt = now();
      saveTasks(tasks);
      return task;
    },
    { body: t.Object({ error: t.String() }) }
  )
  .listen({ port: PORT, hostname: HOST });

console.log(`viewClaw server running at http://${HOST}:${PORT}`);
