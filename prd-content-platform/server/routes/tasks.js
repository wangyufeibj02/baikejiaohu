import { Router } from 'express';
import { createTask, loadTask, listTasks, deleteTask, getQueueInfo } from '../services/taskRunner.js';

const router = Router();

router.post('/', (req, res) => {
  try {
    const { prdId, prdName, analysisResult } = req.body;
    if (!analysisResult) return res.status(400).json({ success: false, error: '缺少 analysisResult' });
    const task = createTask(prdId, prdName, analysisResult);
    res.json({ success: true, data: { id: task.id, status: task.status } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', (_req, res) => {
  const tasks = listTasks().map(t => {
    const { analysisResult, ...rest } = t;
    return rest;
  });
  const qi = getQueueInfo();
  res.json({ success: true, data: { tasks, queueLength: qi.queueLength, running: qi.running } });
});

router.get('/:id', (req, res) => {
  const task = loadTask(req.params.id);
  if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
  const { analysisResult, ...rest } = task;
  res.json({ success: true, data: rest });
});

router.delete('/:id', (req, res) => {
  deleteTask(req.params.id);
  res.json({ success: true });
});

export default router;
