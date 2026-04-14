import { Router } from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { getAllPresets, CONFIG_KEY_MAP } from '../data/presets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data', 'templates');
const CANVAS_SETTINGS_FILE = join(__dirname, '..', '..', 'data', 'canvas-settings.json');
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

router.get('/config-key-map', (_req, res) => {
  res.json({ success: true, data: CONFIG_KEY_MAP });
});

router.get('/canvas-settings', (_req, res) => {
  const defaults = { safeTop: 150, safeBottom: 900, canvasWidth: 1624, canvasHeight: 1050 };
  if (existsSync(CANVAS_SETTINGS_FILE)) {
    try {
      const data = JSON.parse(readFileSync(CANVAS_SETTINGS_FILE, 'utf-8'));
      return res.json({ success: true, data: { ...defaults, ...data } });
    } catch {}
  }
  res.json({ success: true, data: defaults });
});

router.put('/canvas-settings', (req, res) => {
  const data = { ...req.body, updatedAt: Date.now() };
  writeFileSync(CANVAS_SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  res.json({ success: true, data });
});

router.post('/seed', (_req, res) => {
  const presets = getAllPresets();
  const existing = readAll();
  const existingVariants = new Set(existing.map(t => t.variant).filter(Boolean));

  let added = 0;
  for (const preset of presets) {
    if (existingVariants.has(preset.variant)) continue;
    const id = randomUUID().slice(0, 8);
    const template = {
      id,
      ...preset,
      isPreset: true,
      canvasWidth: 1624,
      canvasHeight: 1050,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    writeFileSync(join(DATA_DIR, `${id}.json`), JSON.stringify(template, null, 2), 'utf-8');
    added++;
  }
  res.json({ success: true, data: { total: presets.length, added, skipped: presets.length - added } });
});

router.get('/:id', (req, res) => {
  const fp = join(DATA_DIR, `${req.params.id}.json`);
  if (!existsSync(fp)) return res.status(404).json({ success: false, error: '模板不存在' });
  res.json({ success: true, data: JSON.parse(readFileSync(fp, 'utf-8')) });
});

router.post('/', (req, res) => {
  const id = randomUUID().slice(0, 8);
  const template = { id, ...req.body, createdAt: Date.now(), updatedAt: Date.now() };
  writeFileSync(join(DATA_DIR, `${id}.json`), JSON.stringify(template, null, 2), 'utf-8');
  res.json({ success: true, data: template });
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
