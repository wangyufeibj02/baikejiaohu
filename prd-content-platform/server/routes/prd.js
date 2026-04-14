import { Router } from 'express';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, copyFileSync } from 'fs';
import { randomUUID } from 'crypto';
import multer from 'multer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRD_DIR = join(__dirname, '..', '..', 'data', 'prd-projects');
const TRASH_DIR = join(__dirname, '..', '..', 'data', 'prd-trash');
const TPL_DIR = join(__dirname, '..', '..', 'data', 'templates');
const UPLOAD_DIR = join(__dirname, '..', '..', 'uploads', 'prd-assets');

mkdirSync(PRD_DIR, { recursive: true });
mkdirSync(TRASH_DIR, { recursive: true });
mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname);
      cb(null, `${Date.now()}_${randomUUID().slice(0, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function loadAll(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(readFileSync(join(dir, f), 'utf-8')); } catch { return null; }
    })
    .filter(Boolean);
}

function loadPrd(id) {
  const p = join(PRD_DIR, `${id}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

function savePrd(prd) {
  writeFileSync(join(PRD_DIR, `${prd.id}.json`), JSON.stringify(prd, null, 2), 'utf-8');
}

function loadTemplate(id) {
  const p = join(TPL_DIR, `${id}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

// ── produce helpers ──

function normRadius(br) {
  if (br == null) return 0;
  if (typeof br === 'number') return br;
  if (typeof br === 'object') return Math.max(br.tl || 0, br.tr || 0, br.br || 0, br.bl || 0);
  return 0;
}

function findElementInfo(tpl, targetLabel) {
  if (!tpl || !targetLabel) return null;
  const lower = targetLabel.toLowerCase();
  const el = tpl.elements?.find(e => e.label && e.label.toLowerCase().includes(lower));
  if (!el) return null;
  return { x: el.x, y: el.y, w: el.w, h: el.h, borderRadius: normRadius(el.borderRadius), presetKey: el.presetKey };
}

function extractElData(el) {
  if (!el) return { w: 0, h: 0, borderRadius: 0 };
  return { w: el.w, h: el.h, borderRadius: normRadius(el.borderRadius) };
}

function matchOptionElement(tpl, optLabel) {
  if (!tpl) return null;
  const idx = optLabel.charCodeAt(0) - 65; // A=0, B=1 ...
  const optEls = (tpl.elements || []).filter(e => e.presetKey === 'option_image');
  return optEls[idx] || null;
}

function matchOptionTextElement(tpl, optLabel) {
  if (!tpl) return null;
  const idx = optLabel.charCodeAt(0) - 65;
  const textEls = (tpl.elements || []).filter(e => e.presetKey === 'text_label');
  return textEls[idx] || null;
}

function sizeToAspect(w, h) {
  if (!w || !h) return '16:9';
  const r = w / h;
  if (Math.abs(r - 1) < 0.15) return '1:1';
  if (Math.abs(r - 16 / 9) < 0.2) return '16:9';
  if (Math.abs(r - 9 / 16) < 0.2) return '9:16';
  if (Math.abs(r - 4 / 3) < 0.2) return '4:3';
  if (Math.abs(r - 3 / 4) < 0.2) return '3:4';
  return '16:9';
}

function buildAnim(key, eff, tpl) {
  if (!eff || !eff.description) return null;

  const targetInfo = findElementInfo(tpl, eff.target);
  const elData = targetInfo ? extractElData(targetInfo) : { w: 0, h: 0, borderRadius: 0 };

  const animSettings = tpl?.animationSettings || {};
  const fps = animSettings.fps || 15;
  const usePalette = animSettings.usePalette ?? false;
  const maxColors = animSettings.maxColors || 256;
  const dither = animSettings.dither || 'none';

  let padding = null;
  if (targetInfo && targetInfo.presetKey === 'animation_area') {
    const cover = (tpl.elements || []).find(e => e.presetKey === 'anim_cover');
    if (cover) {
      const leftPad = targetInfo.x - cover.x;
      const rightPad = (cover.x + cover.w) - (targetInfo.x + targetInfo.w);
      padding = { left: leftPad, right: rightPad, totalWidth: cover.w, coverH: cover.h };
    }
  }

  return {
    name: `${key}`,
    description: eff.description,
    duration: eff.duration || 4,
    target: eff.target || '',
    w: elData.w,
    h: elData.h,
    borderRadius: elData.borderRadius,
    aspectRatio: sizeToAspect(elData.w, elData.h),
    fps,
    usePalette,
    maxColors,
    dither,
    padding,
  };
}

function produceQuestion(q, tpl) {
  const images = [];
  const animations = [];

  // stem image
  if (q.stemImage && q.stemImage !== '无') {
    const stemEl = findElementInfo(tpl, '题干');
    const stemData = stemEl ? extractElData(stemEl) : { w: 700, h: 400, borderRadius: 0 };
    images.push({
      name: `${q.id}_stem`,
      prompt: q.stemImageDesc || q.stemImage,
      size: `${stemData.w}x${stemData.h}`,
      borderRadius: stemData.borderRadius,
      source: 'generate',
      artStyle: q.artStyle || '',
    });
  }

  // options
  for (const opt of (q.options || [])) {
    const optEl = matchOptionElement(tpl, opt.label);
    const textEl = matchOptionTextElement(tpl, opt.label);

    if (opt.mediaType && opt.mediaType.includes('图')) {
      const data = optEl ? extractElData(optEl) : { w: 300, h: 300, borderRadius: 0 };
      images.push({
        name: `${q.id}_option_${opt.label}`,
        prompt: opt.imageDesc || opt.text,
        size: `${data.w}x${data.h}`,
        borderRadius: data.borderRadius,
        source: 'generate',
        artStyle: q.artStyle || '',
      });
    }

    if (textEl && (opt.mediaType === '文字' || opt.mediaType?.includes('文字'))) {
      const tData = extractElData(textEl);
      const ts = tpl?.textStyle || {};
      images.push({
        name: `${q.id}_option_${opt.label}`,
        prompt: opt.text,
        size: `${tData.w}x${tData.h}`,
        borderRadius: tData.borderRadius,
        source: 'text_render',
        textStyle: {
          fontFamily: ts.fontFamily || textEl.fontFamily || '',
          fontSize: ts.fontSize || textEl.fontSize || 36,
          fontColor: ts.fontColor || textEl.textColor || '#1e3a8a',
          bgColor: ts.bgColor || textEl.color || '#ffffff',
          align: ts.align || 'center',
          letterSpacing: ts.letterSpacing || 0,
        },
        textAreaSize: { w: tData.w, h: tData.h },
      });
    }

    // state variants: selected for ALL options, correct only for matching correctAnswer
    const optionStates = tpl?.optionStates;
    if (optionStates) {
      const groupEls = [optEl, textEl].filter(Boolean);
      const groupW = groupEls.length > 0 ? Math.max(...groupEls.map(e => e.w)) : 300;
      const minY = groupEls.length > 0 ? Math.min(...groupEls.map(e => e.y)) : 0;
      const maxYH = groupEls.length > 0 ? Math.max(...groupEls.map(e => e.y + e.h)) : 300;
      const groupH = maxYH - minY;

      if (optionStates.selected) {
        images.push({
          name: `${q.id}_option_${opt.label}_selected`,
          source: '_state_variant',
          baseSize: { w: groupW, h: groupH },
          stateConfig: optionStates.selected,
        });
      }

      const correctLabels = (q.correctAnswer || '').split(/[、,]/).map(s => s.trim());
      if (optionStates.correct && correctLabels.includes(opt.label)) {
        images.push({
          name: `${q.id}_option_${opt.label}_correct`,
          source: '_state_variant',
          baseSize: { w: groupW, h: groupH },
          stateConfig: optionStates.correct,
        });
      }
    }
  }

  // animations from effects
  if (q.effects) {
    for (const [key, eff] of Object.entries(q.effects)) {
      const anim = buildAnim(`${q.id}_anim_${key}`, eff, tpl);
      if (anim) animations.push(anim);
    }
  }

  return {
    id: q.id,
    type: q.type,
    stem: q.stem,
    correctAnswer: q.correctAnswer,
    templateId: q.templateId,
    options: q.options,
    assets: { images, animations },
  };
}

// ── Router ──

const router = Router();

router.get('/', (_req, res) => {
  const prds = loadAll(PRD_DIR).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  res.json({ success: true, data: prds });
});

router.get('/trash', (_req, res) => {
  const trashed = loadAll(TRASH_DIR).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  res.json({ success: true, data: trashed });
});

router.get('/:id', (req, res) => {
  const prd = loadPrd(req.params.id);
  if (!prd) return res.status(404).json({ success: false, error: 'PRD 不存在' });
  res.json({ success: true, data: prd });
});

router.post('/', (req, res) => {
  const prd = {
    id: randomUUID().slice(0, 8),
    name: req.body.name || '新项目',
    productLine: req.body.productLine || '',
    episode: req.body.episode || '',
    theme: req.body.theme || '',
    backgroundStyle: req.body.backgroundStyle || '',
    voiceStyle: req.body.voiceStyle || '',
    status: req.body.status || 'draft',
    themeId: req.body.themeId || '',
    episodeTitle: req.body.episodeTitle || '',
    epics: req.body.epics || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  savePrd(prd);
  res.json({ success: true, data: prd });
});

router.put('/:id', (req, res) => {
  const prd = loadPrd(req.params.id);
  if (!prd) return res.status(404).json({ success: false, error: 'PRD 不存在' });
  const reserved = new Set(['id', 'createdAt']);
  for (const [k, v] of Object.entries(req.body)) {
    if (!reserved.has(k)) prd[k] = v;
  }
  prd.updatedAt = Date.now();
  savePrd(prd);
  res.json({ success: true, data: prd });
});

router.delete('/:id', (req, res) => {
  const src = join(PRD_DIR, `${req.params.id}.json`);
  if (!existsSync(src)) return res.status(404).json({ success: false, error: 'PRD 不存在' });
  const prd = JSON.parse(readFileSync(src, 'utf-8'));
  prd.deletedAt = Date.now();
  writeFileSync(join(TRASH_DIR, `${prd.id}.json`), JSON.stringify(prd, null, 2), 'utf-8');
  unlinkSync(src);
  res.json({ success: true });
});

router.post('/:id/restore', (req, res) => {
  const trashPath = join(TRASH_DIR, `${req.params.id}.json`);
  if (!existsSync(trashPath)) return res.status(404).json({ success: false, error: '回收站中不存在该 PRD' });
  const prd = JSON.parse(readFileSync(trashPath, 'utf-8'));
  delete prd.deletedAt;
  prd.updatedAt = Date.now();
  savePrd(prd);
  unlinkSync(trashPath);
  res.json({ success: true, data: prd });
});

router.delete('/:id/permanent', (req, res) => {
  const trashPath = join(TRASH_DIR, `${req.params.id}.json`);
  if (!existsSync(trashPath)) return res.status(404).json({ success: false, error: '回收站中不存在该 PRD' });
  unlinkSync(trashPath);
  res.json({ success: true });
});

router.post('/:id/upload-asset', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: '未上传文件' });
  const url = `/uploads/prd-assets/${req.file.filename}`;
  res.json({ success: true, data: { url, filename: req.file.filename, originalname: req.file.originalname } });
});

router.post('/:id/produce', (req, res) => {
  try {
    const prd = loadPrd(req.params.id);
    if (!prd) return res.status(404).json({ success: false, error: 'PRD 不存在' });

    const questions = [];
    for (const epic of (prd.epics || [])) {
      for (const q of (epic.questions || [])) {
        const tpl = q.templateId ? loadTemplate(q.templateId) : null;
        questions.push(produceQuestion(q, tpl));
      }
    }

    const analysisResult = {
      prdId: prd.id,
      prdName: prd.name,
      productLine: prd.productLine,
      episode: prd.episode,
      theme: prd.theme,
      backgroundStyle: prd.backgroundStyle,
      voiceStyle: prd.voiceStyle,
      questions,
    };

    res.json({ success: true, data: analysisResult });
  } catch (err) {
    console.error('[produce] 失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
