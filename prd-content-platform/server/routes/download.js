import { Router } from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '..', '..', 'output');
const TASK_DIR = join(__dirname, '..', '..', 'data', 'tasks');

const router = Router();

router.get('/:taskId', (req, res) => {
  const { taskId } = req.params;
  const zipPath = join(OUTPUT, `${taskId}.zip`);

  if (!existsSync(zipPath)) {
    return res.status(404).json({ success: false, error: '文件不存在' });
  }

  let downloadName = `${taskId}.zip`;
  try {
    const taskFile = join(TASK_DIR, `${taskId}.json`);
    if (existsSync(taskFile)) {
      const task = JSON.parse(readFileSync(taskFile, 'utf-8'));
      if (task.prdName) {
        const safeName = task.prdName.replace(/[\\/:*?"<>|]/g, '_');
        downloadName = `${safeName}.zip`;
      }
    }
  } catch {}

  res.download(zipPath, downloadName);
});

export default router;
