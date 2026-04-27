import { Router } from 'express';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { randomUUID } from 'crypto';
import multer from 'multer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data', 'workspaces');
const ASSET_DIR = join(__dirname, '..', '..', 'data', 'workspace-assets');
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(ASSET_DIR, { recursive: true });

function sanitizeKey(key) {
  return (key || 'default').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 100);
}

function wsPath(key) {
  return join(DATA_DIR, `${sanitizeKey(key)}.json`);
}

function loadWorkspace(key) {
  const fp = wsPath(key);
  if (existsSync(fp)) {
    const ws = JSON.parse(readFileSync(fp, 'utf-8'));
    const imgIds = new Set((ws.images || []).map(i => i.id));
    ws.styleImages = (ws.styleImages || []).filter(id => imgIds.has(id));
    return ws;
  }
  return { key: sanitizeKey(key), memo: '', images: [], stylePrompt: '', styleImages: [], documents: [], updatedAt: Date.now() };
}

function saveWorkspace(key, data) {
  data.updatedAt = Date.now();
  writeFileSync(wsPath(key), JSON.stringify(data, null, 2), 'utf-8');
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = join(ASSET_DIR, sanitizeKey(req.params.key));
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname) || '.png';
    cb(null, `${randomUUID().slice(0, 8)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();

router.get('/:key', (req, res) => {
  const ws = loadWorkspace(req.params.key);
  res.json({ success: true, data: ws });
});

router.put('/:key', (req, res) => {
  const key = req.params.key;
  const existing = loadWorkspace(key);
  const updated = { ...existing, ...req.body, key: sanitizeKey(key) };
  saveWorkspace(key, updated);
  res.json({ success: true, data: updated });
});

router.post('/:key/upload', upload.array('files', 50), (req, res) => {
  const key = sanitizeKey(req.params.key);
  const ws = loadWorkspace(key);
  const results = [];
  for (const file of (req.files || [])) {
    const id = randomUUID().slice(0, 8);
    const url = `/workspace-assets/${key}/${file.filename}`;
    const entry = {
      id,
      name: Buffer.from(file.originalname, 'latin1').toString('utf-8'),
      filename: file.filename,
      url,
      x: 50 + Math.random() * 300,
      y: 50 + Math.random() * 300,
      w: 200, h: 200,
      addedAt: Date.now(),
    };
    ws.images.push(entry);
    results.push(entry);
  }
  saveWorkspace(key, ws);
  res.json({ success: true, data: results });
});

router.post('/:key/upload-paste', upload.single('file'), (req, res) => {
  const key = sanitizeKey(req.params.key);
  if (!req.file) return res.status(400).json({ success: false, error: 'No file' });
  const ws = loadWorkspace(key);
  const id = randomUUID().slice(0, 8);
  const url = `/workspace-assets/${key}/${req.file.filename}`;
  const entry = {
    id,
    name: req.body.name || req.file.originalname || 'pasted.png',
    filename: req.file.filename,
    url,
    x: parseFloat(req.body.x) || 100,
    y: parseFloat(req.body.y) || 100,
    w: 200, h: 200,
    addedAt: Date.now(),
  };
  ws.images.push(entry);
  saveWorkspace(key, ws);
  res.json({ success: true, data: entry });
});

router.delete('/:key/assets/:assetId', (req, res) => {
  const key = sanitizeKey(req.params.key);
  const ws = loadWorkspace(key);
  const img = ws.images.find(i => i.id === req.params.assetId);
  if (img) {
    const filePath = join(ASSET_DIR, key, img.filename);
    try { unlinkSync(filePath); } catch (_) {}
    ws.images = ws.images.filter(i => i.id !== req.params.assetId);
    ws.styleImages = (ws.styleImages || []).filter(id => id !== req.params.assetId);
    saveWorkspace(key, ws);
  }
  res.json({ success: true });
});

router.post('/:key/upload-doc', upload.single('file'), (req, res) => {
  const key = sanitizeKey(req.params.key);
  if (!req.file) return res.status(400).json({ success: false, error: 'No file' });
  const ws = loadWorkspace(key);
  const id = randomUUID().slice(0, 8);
  const url = `/workspace-assets/${key}/${req.file.filename}`;
  const rawName = Buffer.from(req.file.originalname, 'latin1').toString('utf-8');
  const entry = {
    id,
    name: rawName,
    filename: req.file.filename,
    url,
    ext: extname(rawName).toLowerCase().replace('.', ''),
    addedAt: Date.now(),
  };
  ws.documents.push(entry);
  saveWorkspace(key, ws);
  res.json({ success: true, data: entry });
});

router.delete('/:key/docs/:docId', (req, res) => {
  const key = sanitizeKey(req.params.key);
  const ws = loadWorkspace(key);
  const doc = ws.documents.find(d => d.id === req.params.docId);
  if (doc) {
    const filePath = join(ASSET_DIR, key, doc.filename);
    try { unlinkSync(filePath); } catch (_) {}
    ws.documents = ws.documents.filter(d => d.id !== req.params.docId);
    saveWorkspace(key, ws);
  }
  res.json({ success: true });
});

router.get('/:key/parse-doc/:docId', async (req, res) => {
  const key = sanitizeKey(req.params.key);
  const ws = loadWorkspace(key);
  const doc = ws.documents.find(d => d.id === req.params.docId);
  if (!doc) return res.status(404).json({ success: false, error: 'Document not found' });

  const filePath = join(ASSET_DIR, key, doc.filename);
  if (!existsSync(filePath)) return res.status(404).json({ success: false, error: 'File not found' });

  try {
    let content = '';
    let type = 'text';
    const ext = doc.ext;

    if (ext === 'md' || ext === 'txt') {
      content = readFileSync(filePath, 'utf-8');
      type = ext === 'md' ? 'markdown' : 'text';
    } else if (ext === 'docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.default.convertToHtml({ path: filePath });
      content = result.value;
      type = 'html';
    } else if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = await import('xlsx');
      const workbook = XLSX.default.readFile(filePath);
      const sheets = {};
      for (const name of workbook.SheetNames) {
        sheets[name] = XLSX.default.utils.sheet_to_html(workbook.Sheets[name]);
      }
      content = JSON.stringify(sheets);
      type = 'excel';
    } else if (ext === 'pdf') {
      const pdfParse = await import('pdf-parse/lib/pdf-parse.js');
      const buf = readFileSync(filePath);
      const data = await pdfParse.default(buf);
      content = data.text;
      type = 'text';
    } else {
      content = readFileSync(filePath, 'utf-8');
      type = 'text';
    }

    res.json({ success: true, data: { content, type, name: doc.name } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
