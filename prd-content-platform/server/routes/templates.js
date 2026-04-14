import { Router } from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data', 'templates');
mkdirSync(DATA_DIR, { recursive: true });

function readAll() {
  try {
    return readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(readFileSync(join(DATA_DIR, f), 'utf-8')))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch { return []; }
}

const router = Router();

router.get('/', (_req, res) => {
  res.json({ success: true, data: readAll() });
});

router.get('/:id', (req, res) => {
  const fp = join(DATA_DIR, `${req.params.id}.json`);
  if (!existsSync(fp)) return res.status(404).json({ success: false, error: '模板不存在' });
  res.json({ success: true, data: JSON.parse(readFileSync(fp, 'utf-8')) });
});

router.post('/', (req, res) => {
  const id = randomUUID().slice(0, 8);
  const tpl = { id, ...req.body, createdAt: Date.now(), updatedAt: Date.now() };
  writeFileSync(join(DATA_DIR, `${id}.json`), JSON.stringify(tpl, null, 2), 'utf-8');
  res.json({ success: true, data: tpl });
});

router.put('/:id', (req, res) => {
  const fp = join(DATA_DIR, `${req.params.id}.json`);
  let existing = {};
  if (existsSync(fp)) existing = JSON.parse(readFileSync(fp, 'utf-8'));
  const updated = { ...existing, ...req.body, id: req.params.id, updatedAt: Date.now() };
  writeFileSync(fp, JSON.stringify(updated, null, 2), 'utf-8');
  res.json({ success: true, data: updated });
});

router.delete('/:id', (req, res) => {
  const fp = join(DATA_DIR, `${req.params.id}.json`);
  if (existsSync(fp)) unlinkSync(fp);
  res.json({ success: true });
});

export default router;
