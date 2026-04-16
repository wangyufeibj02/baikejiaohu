import { Router } from 'express';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { getAllPresets, CONFIG_KEY_MAP } from '../data/presets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data', 'templates');
const ASSET_DIR = join(__dirname, '..', '..', 'data', 'template-assets');
const CANVAS_SETTINGS_FILE = join(__dirname, '..', '..', 'data', 'canvas-settings.json');
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(ASSET_DIR, { recursive: true });

const assetUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const tplDir = join(ASSET_DIR, req.params.id);
      mkdirSync(tplDir, { recursive: true });
      cb(null, tplDir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}_${randomUUID().slice(0, 6)}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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

router.put('/sync-option-states', (req, res) => {
  const { optionStates } = req.body;
  if (!optionStates) return res.status(400).json({ success: false, error: '缺少 optionStates' });
  const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  let count = 0;
  for (const f of files) {
    const fp = join(DATA_DIR, f);
    try {
      const tpl = JSON.parse(readFileSync(fp, 'utf-8'));
      tpl.optionStates = optionStates;
      tpl.updatedAt = Date.now();
      writeFileSync(fp, JSON.stringify(tpl, null, 2), 'utf-8');
      count++;
    } catch {}
  }
  res.json({ success: true, data: { updated: count } });
});

router.post('/:id/upload-asset', assetUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: '未选择文件' });
  const relPath = `/data/template-assets/${req.params.id}/${req.file.filename}`;
  const url = `/template-assets/${req.params.id}/${req.file.filename}`;
  res.json({ success: true, data: { url, path: relPath, filename: req.file.filename } });
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
