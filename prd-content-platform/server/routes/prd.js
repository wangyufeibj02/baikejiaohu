import { Router } from 'express';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { randomUUID } from 'crypto';
import multer from 'multer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data', 'prd-projects');
const TRASH_DIR = join(__dirname, '..', '..', 'data', 'prd-trash');
const ASSET_DIR = join(__dirname, '..', '..', 'uploads', 'prd-assets');
const TPL_DIR = join(__dirname, '..', '..', 'data', 'templates');
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(TRASH_DIR, { recursive: true });
mkdirSync(ASSET_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ASSET_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}_${randomUUID().slice(0, 6)}${extname(file.originalname)}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function loadTemplate(id) {
  if (!id) return null;
  const fp = join(TPL_DIR, `${id}.json`);
  return existsSync(fp) ? JSON.parse(readFileSync(fp, 'utf-8')) : null;
}

function findElementInfo(tpl, targetLabel) {
  if (!tpl || !targetLabel) return null;
  const el = tpl.elements?.find(e => {
    const l = (e.label || '').toLowerCase();
    const t = targetLabel.toLowerCase();
    return l.includes(t) || t.includes(l);
  });
  if (!el) return null;
  const br = el.borderRadius;
  let radius = 0;
  if (typeof br === 'number') radius = br;
  else if (br && typeof br === 'object') radius = Math.max(br.tl || 0, br.tr || 0, br.br || 0, br.bl || 0);
  return { x: el.x, y: el.y, w: el.w, h: el.h, borderRadius: radius, presetKey: el.presetKey || '' };
}

function extractElData(el) {
  if (!el) return null;
  const br = el.borderRadius;
  let radius = 0;
  if (typeof br === 'number') radius = br;
  else if (br && typeof br === 'object') radius = Math.max(br.tl || 0, br.tr || 0, br.br || 0, br.bl || 0);
  return { w: el.w, h: el.h, borderRadius: radius };
}

function matchOptionElement(tpl, optLabel) {
  if (!tpl) return null;
  const idx = optLabel.charCodeAt(0) - 65;
  const optEls = (tpl.elements || []).filter(e =>
    e.presetKey === 'option_image' || (e.label || '').includes('选项图')
  );
  return extractElData(optEls[idx] || optEls[0]);
}

function matchOptionTextElement(tpl, optLabel) {
  if (!tpl) return null;
  const idx = optLabel.charCodeAt(0) - 65;
  const textEls = (tpl.elements || []).filter(e =>
    e.presetKey === 'option_text' || (e.label || '').match(/选项[A-Z]/)
  );
  return extractElData(textEls[idx] || textEls[0]);
}

function findStemElement(tpl) {
  if (!tpl) return null;
  const el = tpl.elements?.find(e =>
    e.presetKey === 'stem_image' || (e.label || '').includes('题干')
  );
  return extractElData(el);
}

function readAll() {
  try {
    return readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(readFileSync(join(DATA_DIR, f), 'utf-8')))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch { return []; }
}

function newProject() {
  return {
    id: randomUUID().slice(0, 8),
    name: '',
    productLine: '',
    episode: '',
    theme: '',
    backgroundStyle: '自然纪录片实拍风格',
    voiceStyle: '儿童科普风格，语速适中，亲切活泼',
    epics: [],
    status: 'draft',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const router = Router();

router.get('/', (_req, res) => {
  const all = readAll();
  res.json({ success: true, data: all });
});

router.get('/trash/list', (_req, res) => {
  try {
    const items = readdirSync(TRASH_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(readFileSync(join(TRASH_DIR, f), 'utf-8')))
      .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
    res.json({ success: true, data: items });
  } catch { res.json({ success: true, data: [] }); }
});

router.get('/:id', (req, res) => {
  const fp = join(DATA_DIR, `${req.params.id}.json`);
  if (!existsSync(fp)) return res.status(404).json({ success: false, error: 'PRD 项目不存在' });
  res.json({ success: true, data: JSON.parse(readFileSync(fp, 'utf-8')) });
});

router.post('/', (req, res) => {
  const project = { ...newProject(), ...req.body };
  project.createdAt = Date.now();
  project.updatedAt = Date.now();
  writeFileSync(join(DATA_DIR, `${project.id}.json`), JSON.stringify(project, null, 2), 'utf-8');
  res.json({ success: true, data: project });
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
  if (!existsSync(fp)) return res.json({ success: true });
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  data.deletedAt = Date.now();
  writeFileSync(join(TRASH_DIR, `${req.params.id}.json`), JSON.stringify(data, null, 2), 'utf-8');
  unlinkSync(fp);
  res.json({ success: true });
});

router.post('/:id/restore', (req, res) => {
  const trashFp = join(TRASH_DIR, `${req.params.id}.json`);
  if (!existsSync(trashFp)) return res.status(404).json({ success: false, error: '回收站中无此项目' });
  const data = JSON.parse(readFileSync(trashFp, 'utf-8'));
  delete data.deletedAt;
  data.updatedAt = Date.now();
  writeFileSync(join(DATA_DIR, `${data.id}.json`), JSON.stringify(data, null, 2), 'utf-8');
  unlinkSync(trashFp);
  res.json({ success: true, data });
});

router.delete('/:id/permanent', (req, res) => {
  const trashFp = join(TRASH_DIR, `${req.params.id}.json`);
  if (existsSync(trashFp)) unlinkSync(trashFp);
  res.json({ success: true });
});

router.post('/:id/upload-asset', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: '未上传文件' });
  const url = `/uploads/prd-assets/${req.file.filename}`;
  res.json({ success: true, data: { url, filename: req.file.filename } });
});

router.post('/:id/produce', (req, res) => {
  const fp = join(DATA_DIR, `${req.params.id}.json`);
  if (!existsSync(fp)) return res.status(404).json({ success: false, error: 'PRD 不存在' });
  const prd = JSON.parse(readFileSync(fp, 'utf-8'));

  const questions = [];
  for (const epic of (prd.epics || [])) {
    for (const q of (epic.questions || [])) {
      const assets = { images: [], audios: [], animations: [] };
      const tpl = loadTemplate(q.templateId);

      if (q.stemImage && q.stemImage !== '无') {
        const stemEl = findStemElement(tpl);
        assets.images.push({
          name: `${q.id}_stem`,
          description: q.stemImageDesc || `${q.stemImage}风格的题干配图`,
          mediaType: 'image',
          source: q.stemSource || 'ai',
          uploadUrl: q.stemUploadUrl || null,
          referenceUrl: q.stemReferenceUrl || null,
          size: stemEl ? `${stemEl.w}x${stemEl.h}` : null,
          borderRadius: stemEl?.borderRadius || 0,
        });
      }

      const ts = tpl?.textStyle || null;
      const os = tpl?.optionStates || null;
      const isMulti = q.type === '多选题' || q.type === 'multiChoice';
      const isSingle = q.type === '单选题' || q.type === 'singleChoice';

      (q.options || []).forEach((opt) => {
        const mt = opt.mediaType || '';
        const isTextOnly = mt === '文字' || mt === '文字+拼音';
        const hasImage = mt && !mt.startsWith('文字');

        if (hasImage || isTextOnly) {
          const imgEl = matchOptionElement(tpl, opt.label);
          const txtEl = matchOptionTextElement(tpl, opt.label);
          const baseName = `${q.id}_option_${opt.label}`;
          assets.images.push({
            name: baseName,
            description: opt.imageDesc || `${mt} — ${opt.text || opt.label}`,
            mediaType: mt,
            source: isTextOnly ? 'text_render' : (opt.source || 'ai'),
            uploadUrl: opt.uploadUrl || null,
            referenceUrl: opt.referenceUrl || null,
            size: imgEl ? `${imgEl.w}x${imgEl.h}` : null,
            borderRadius: imgEl?.borderRadius || 0,
            text: opt.text || '',
            textAreaSize: txtEl ? `${txtEl.w}x${txtEl.h}` : null,
            textStyle: ts,
          });

          if (os && (isSingle || isMulti)) {
            if (os.selected) {
              assets.images.push({
                name: `${baseName}_selected`,
                stateType: 'selected',
                baseImageName: baseName,
                stateConfig: os.selected,
                source: '_state_variant',
              });
            }
            const correctLabels = (q.correctAnswer || '').toUpperCase().split(/[,\s、]+/).filter(Boolean);
            if (os.correct && correctLabels.includes(opt.label.toUpperCase())) {
              assets.images.push({
                name: `${baseName}_correct`,
                stateType: 'correct',
                baseImageName: baseName,
                stateConfig: os.correct,
                source: '_state_variant',
              });
            }
          }
        }
      });

      (q.voiceLines || []).forEach((line, i) => {
        if (line) {
          assets.audios.push({ name: `${q.id}_voice_${i + 1}`, text: line });
        }
      });

      if (q.stem && (!q.voiceLines || q.voiceLines.length === 0)) {
        assets.audios.push({ name: `${q.id}_stem_audio`, text: q.stem });
      }
      if (q.analysis) {
        assets.audios.push({ name: `${q.id}_analysis_audio`, text: q.analysis });
      }

      const buildAnim = (key, eff) => {
        if (!eff?.description) return;
        const info = findElementInfo(tpl, eff.target);
        const animData = {
          name: `${q.id}_${key}_anim`,
          description: eff.description,
          duration: eff.duration || 4,
          target: eff.target,
          referenceUrl: eff.referenceUrl || null,
          width: info?.w || null,
          height: info?.h || null,
          borderRadius: info?.borderRadius || 0,
          padding: null,
        };
        if (info?.presetKey === 'animation_area' && tpl?.elements) {
          const cover = tpl.elements.find(e => e.presetKey === 'anim_cover');
          if (cover) {
            const lp = Math.max(0, info.x - cover.x);
            const rp = Math.max(0, (cover.x + cover.w) - (info.x + info.w));
            if (lp > 0 || rp > 0) {
              animData.padding = { leftPad: lp, rightPad: rp, totalWidth: lp + info.w + rp };
            }
          }
        }
        assets.animations.push(animData);
      };
      buildAnim('opening', q.effects?.opening);
      buildAnim('correct', q.effects?.correct);
      buildAnim('wrong', q.effects?.wrong);

      questions.push({
        id: q.id,
        type: q.type,
        stem: q.stem,
        correctAnswer: q.correctAnswer,
        options: q.options,
        analysis: q.analysis,
        templateId: q.templateId,
        assets,
      });
    }
  }

  const analysisResult = {
    productLine: prd.productLine,
    episode: prd.episode,
    theme: prd.theme,
    backgroundStyle: prd.backgroundStyle,
    voiceStyle: prd.voiceStyle,
    questions,
    sourcePrdId: prd.id,
  };

  res.json({ success: true, data: analysisResult });
});

export default router;
