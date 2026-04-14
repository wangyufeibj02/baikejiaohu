import { Router } from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import * as taskRunner from '../services/taskRunner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TASKS_DIR = join(__dirname, '..', '..', 'data', 'tasks');
mkdirSync(TASKS_DIR, { recursive: true });

function loadAll() {
  return readdirSync(TASKS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(readFileSync(join(TASKS_DIR, f), 'utf-8')); } catch { return null; }
    })
    .filter(Boolean);
}

function loadTask(id) {
  const p = join(TASKS_DIR, `${id}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

const router = Router();

router.post('/', (req, res) => {
  const { prdId, prdName, analysisResult } = req.body;
  if (!analysisResult) return res.status(400).json({ success: false, error: '缺少 analysisResult' });

  const task = {
    id: `task_${Date.now()}`,
    prdId: prdId || '',
    prdName: prdName || '',
    analysisResult,
    status: 'queued',
    createdAt: Date.now(),
  };

  writeFileSync(join(TASKS_DIR, `${task.id}.json`), JSON.stringify(task, null, 2), 'utf-8');
  taskRunner.enqueue(task);

  res.json({ success: true, data: task });
});

router.get('/', (_req, res) => {
  const tasks = loadAll().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  res.json({
    success: true,
    data: {
      tasks,
      queueLength: taskRunner.getQueueLength(),
      running: taskRunner.isRunning(),
    },
  });
});

router.get('/:id', (req, res) => {
  const task = loadTask(req.params.id);
  if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
  res.json({ success: true, data: task });
});

router.delete('/:id', (req, res) => {
  const p = join(TASKS_DIR, `${req.params.id}.json`);
  if (!existsSync(p)) return res.status(404).json({ success: false, error: '任务不存在' });
  unlinkSync(p);
  res.json({ success: true });
});

export default router;
