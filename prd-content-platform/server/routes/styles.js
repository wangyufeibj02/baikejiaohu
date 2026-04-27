import { Router } from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const STYLES_FILE = join(DATA_DIR, 'styles.json');
mkdirSync(DATA_DIR, { recursive: true });

function loadStyles() {
  if (!existsSync(STYLES_FILE)) return [];
  try { return JSON.parse(readFileSync(STYLES_FILE, 'utf-8')); } catch { return []; }
}
function saveStyles(arr) { writeFileSync(STYLES_FILE, JSON.stringify(arr, null, 2), 'utf-8'); }

const router = Router();

router.get('/', (_req, res) => {
  res.json({ success: true, data: loadStyles() });
});

router.post('/', (req, res) => {
  const styles = loadStyles();
  const name = (req.body.name || '').trim();
  const description = (req.body.description || '').trim();
  if (!name) return res.status(400).json({ success: false, error: '缺少风格名称' });
  if (!description) return res.status(400).json({ success: false, error: '缺少风格描述' });

  const existing = styles.find(s => s.name === name);
  if (existing) {
    existing.description = description;
    existing.updatedAt = Date.now();
    saveStyles(styles);
    return res.json({ success: true, data: existing, updated: true });
  }

  const s = {
    id: 's_' + randomUUID().slice(0, 8),
    name,
    description,
    createdAt: Date.now(),
  };
  styles.push(s);
  saveStyles(styles);
  res.json({ success: true, data: s });
});

router.put('/:id', (req, res) => {
  const styles = loadStyles();
  const idx = styles.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: '风格不存在' });
  if (req.body.name !== undefined) styles[idx].name = req.body.name.trim();
  if (req.body.description !== undefined) styles[idx].description = req.body.description.trim();
  styles[idx].updatedAt = Date.now();
  saveStyles(styles);
  res.json({ success: true, data: styles[idx] });
});

router.delete('/:id', (req, res) => {
  let styles = loadStyles();
  styles = styles.filter(s => s.id !== req.params.id);
  saveStyles(styles);
  res.json({ success: true });
});

export default router;
