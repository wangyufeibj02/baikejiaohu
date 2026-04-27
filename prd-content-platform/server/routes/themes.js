import { Router } from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const THEMES_FILE = join(DATA_DIR, 'themes.json');
mkdirSync(DATA_DIR, { recursive: true });

function loadThemes() {
  if (!existsSync(THEMES_FILE)) return [];
  try { return JSON.parse(readFileSync(THEMES_FILE, 'utf-8')); } catch { return []; }
}
function saveThemes(arr) { writeFileSync(THEMES_FILE, JSON.stringify(arr, null, 2), 'utf-8'); }

const router = Router();

router.get('/', (_req, res) => {
  res.json({ success: true, data: loadThemes() });
});

router.post('/', (req, res) => {
  const themes = loadThemes();
  const t = {
    id: randomUUID().slice(0, 8),
    name: req.body.name || '新主题',
    color: req.body.color || '#6366f1',
    productLine: req.body.productLine || '',
    backgroundStyle: req.body.backgroundStyle || '自然纪录片实拍',
    voiceStyle: req.body.voiceStyle || '儿童科普风格，语速适中，亲切活泼',
    status: 'active',
    createdAt: Date.now(),
  };
  themes.push(t);
  saveThemes(themes);
  res.json({ success: true, data: t });
});

router.put('/:id', (req, res) => {
  const themes = loadThemes();
  const idx = themes.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: '主题不存在' });
  const allowed = ['name', 'color', 'productLine', 'backgroundStyle', 'voiceStyle', 'status'];
  for (const k of allowed) { if (req.body[k] !== undefined) themes[idx][k] = req.body[k]; }
  saveThemes(themes);
  res.json({ success: true, data: themes[idx] });
});

router.delete('/:id', (req, res) => {
  let themes = loadThemes();
  themes = themes.filter(t => t.id !== req.params.id);
  saveThemes(themes);
  res.json({ success: true });
});

export default router;
