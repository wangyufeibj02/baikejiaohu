import { Router } from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '..', '..', 'output');

const router = Router();

router.get('/:taskId', (req, res) => {
  const { taskId } = req.params;
  const zipPath = join(OUTPUT, `${taskId}.zip`);

  if (!existsSync(zipPath)) {
    return res.status(404).json({ success: false, error: '文件不存在' });
  }

  res.download(zipPath, `${taskId}.zip`);
});

export default router;
