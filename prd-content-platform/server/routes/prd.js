import { Router } from 'express';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { geminiChat } from '../services/modaiClient.js';

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

const DEFAULT_OPTION_STATES = {
  normal:   { borderWidth: 0, borderColor: '#cccccc', borderOpacity: 0, borderStyle: 'solid', lineCap: 'butt', dashLength: 12, dashGap: 6, borderGap: 30, borderRadius: 16, fillColor: '#ffffff', fillOpacity: 0 },
  selected: { borderWidth: 4, borderColor: '#3b82f6', borderOpacity: 1, borderStyle: 'dashed', lineCap: 'round', dashLength: 12, dashGap: 6, borderGap: 8, borderRadius: 16, fillColor: '#3b82f6', fillOpacity: 0 },
  correct:  { borderWidth: 4, borderColor: '#22c55e', borderOpacity: 1, borderStyle: 'dashed', lineCap: 'round', dashLength: 12, dashGap: 6, borderGap: 8, borderRadius: 16, fillColor: '#22c55e', fillOpacity: 0.15 },
};
const DEFAULT_TEXT_STYLE = { fontSize: 36, fontColor: '#2f4d90', bgColor: '#ffffff', align: 'center', letterSpacing: 0 };

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

function matchTextLabelElement(tpl, optLabel) {
  if (!tpl) return null;
  const idx = optLabel.charCodeAt(0) - 65;
  const els = (tpl.elements || []).filter(e =>
    e.presetKey === 'text_label'
  );
  return extractElData(els[idx] || els[0]);
}

function buildOptionImagePrompt(optText, mediaType, backgroundStyle) {
  const subject = optText || '选项内容';
  const isIllustration = backgroundStyle &&
    (backgroundStyle.includes('插画') || backgroundStyle.includes('2D') || backgroundStyle.includes('2d'));
  const styleHint = isIllustration ? '2D插画风格，卡通可爱' : '自然实拍风格，高清写实';
  const noText = (mediaType && !mediaType.startsWith('文字'))
    ? '，画面中不要包含任何文字、字母或数字'
    : '';
  return `${styleHint}，${subject}${noText}`;
}

function findStemElement(tpl) {
  if (!tpl) return null;
  const el = tpl.elements?.find(e =>
    e.presetKey === 'stem_image' || (e.label || '').includes('题干')
  );
  return extractElData(el);
}

function findStemTextElement(tpl) {
  if (!tpl) return null;
  const el = tpl.elements?.find(e => e.presetKey === 'stem_text');
  return el ? { w: el.w, h: el.h, borderRadius: 0 } : null;
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

      let bgIdx = 1;
      if (q.stemImage && q.stemImage !== '无') {
        const stemEl = findStemElement(tpl);
        assets.images.push({
          name: `bg${bgIdx}`,
          description: q.stemOptimizedPrompt || buildOptionImagePrompt(q.stemImageDesc || q.stem || '题干配图', q.stemImage, prd.backgroundStyle),
          mediaType: 'image',
          source: q.stemSource || 'ai',
          uploadUrl: q.stemUploadUrl || null,
          referenceUrl: q.stemReferenceUrl || null,
          size: stemEl ? `${stemEl.w}x${stemEl.h}` : null,
          borderRadius: stemEl?.borderRadius || 0,
        });
        bgIdx++;
      }

      if (tpl?.stemType === 'text' && q.stem) {
        const stemTxtEl = findStemTextElement(tpl);
        assets.images.push({
          name: `bg${bgIdx}`,
          mediaType: '文字',
          source: 'text_render',
          text: q.stem,
          size: stemTxtEl ? `${stemTxtEl.w}x${stemTxtEl.h}` : '1000x80',
          textStyle: tpl?.textStyle || DEFAULT_TEXT_STYLE,
        });
        bgIdx++;
      }

      const ts = tpl?.textStyle || DEFAULT_TEXT_STYLE;
      const os = tpl?.optionStates || DEFAULT_OPTION_STATES;
      const isMulti = q.type === '多选题' || q.type === 'multiChoice';
      const isSingle = q.type === '单选题' || q.type === 'singleChoice';

      (q.options || []).forEach((opt) => {
        const mt = opt.mediaType || '';
        const isTextOnly = mt === '文字' || mt === '文字+拼音';
        const hasImage = mt && !mt.startsWith('文字');
        const optIdx = opt.label.charCodeAt(0) - 64;

        if (hasImage || isTextOnly) {
          const imgEl = matchOptionElement(tpl, opt.label);
          const txtEl = matchOptionTextElement(tpl, opt.label);
          const lblEl = isTextOnly ? matchTextLabelElement(tpl, opt.label) : null;
          const sizeEl = isTextOnly ? (lblEl || txtEl || imgEl) : imgEl;
          const baseName = `option${optIdx}`;

          const normalCfg = os?.normal || DEFAULT_OPTION_STATES.normal;
          const normalExpand = (normalCfg.borderGap || 0) + (normalCfg.borderWidth || 0);
          const imgW = sizeEl ? sizeEl.w : 360;
          const imgH = sizeEl ? sizeEl.h : 360;
          const txtH = ((opt.text || '').trim() && txtEl) ? (txtEl.h || 0) : 0;
          const totalContentH = imgH + txtH;
          const cardSizeStr = normalExpand > 0
            ? `${imgW + normalExpand * 2}x${totalContentH + normalExpand * 2}`
            : null;

          assets.images.push({
            name: baseName,
            description: opt.optimizedImagePrompt || buildOptionImagePrompt(opt.imageDesc || opt.text, mt, prd.backgroundStyle),
            mediaType: mt,
            source: isTextOnly ? 'text_render' : (opt.source || 'ai'),
            uploadUrl: opt.uploadUrl || null,
            referenceUrl: opt.referenceUrl || null,
            size: sizeEl ? `${sizeEl.w}x${sizeEl.h}` : null,
            cardSize: cardSizeStr,
            normalStateConfig: normalExpand > 0 ? normalCfg : null,
            borderRadius: sizeEl?.borderRadius || 0,
            text: opt.text || '',
            textAreaSize: txtEl ? `${txtEl.w}x${txtEl.h}` : null,
            textStyle: ts,
          });

          if (os && (isSingle || isMulti)) {
            if (os.selected) {
              assets.images.push({
                name: `${baseName}_select`,
                stateType: 'selected',
                baseImageName: baseName,
                stateConfig: os.selected,
                cardSize: cardSizeStr,
                source: '_state_variant',
              });
            }
            const correctLabels = (q.correctAnswer || '').toUpperCase().split(/[,\s、]+/).filter(Boolean);
            if (os.correct && correctLabels.includes(opt.label.toUpperCase())) {
              assets.images.push({
                name: `${baseName}_right`,
                stateType: 'correct',
                baseImageName: baseName,
                stateConfig: os.correct,
                cardSize: cardSizeStr,
                source: '_state_variant',
              });
            }
          }
        }
      });

      let audioIdx = 1;
      if (q.stem && (!q.voiceLines || q.voiceLines.length === 0)) {
        assets.audios.push({ name: `audio${audioIdx}`, text: q.stem });
        audioIdx++;
      }
      (q.voiceLines || []).forEach((line) => {
        if (line) {
          assets.audios.push({ name: `audio${audioIdx}`, text: line });
          audioIdx++;
        }
      });
      if (q.analysis) {
        assets.audios.push({ name: 'analysis_wrong', text: q.analysis });
      }

      const ANIM_TYPE_MAP = { opening: 'openApng', correct: 'rightApng', wrong: 'wrongApng' };
      const buildAnim = (key, eff) => {
        if (!eff?.description) return;
        const info = findElementInfo(tpl, eff.target);
        const as = tpl?.animationSettings || {};

        let sourceImageName = null;
        if (eff.sourceImage) {
          if (eff.sourceImage === 'stem') sourceImageName = 'bg1';
          else if (eff.sourceImage.startsWith('option_')) {
            const lbl = eff.sourceImage.replace('option_', '');
            sourceImageName = `option${lbl.charCodeAt(0) - 64}`;
          }
        }

        const suffix = ANIM_TYPE_MAP[key] || key;
        let animName;
        const target = eff.target || '';
        const optMatch = target.match(/选项([A-D])/);
        if (optMatch) {
          const oi = optMatch[1].charCodeAt(0) - 64;
          animName = `option${oi}_${suffix}`;
        } else {
          animName = suffix;
        }

        const animData = {
          name: animName,
          animType: key,
          description: eff.optimizedPrompt || eff.description,
          duration: eff.duration || 4,
          target: eff.target,
          referenceUrl: eff.referenceUrl || null,
          sourceImageName,
          width: info?.w || null,
          height: info?.h || null,
          borderRadius: info?.borderRadius || 0,
          padding: null,
          plays: q.effects?.plays ?? 0,
          fps: as.fps || 10,
          maxColors: as.maxColors ?? 256,
          dither: as.dither || 'none',
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

      const widgetEls = (tpl?.elements || []).filter(e => e.presetKey === 'control_widget' && e.assetUrl);
      assets.controlWidgets = widgetEls.map((el, i) => ({
        name: el.widgetName || `widget${i + 1}`,
        assetUrl: el.assetUrl,
        assetPath: el.assetPath,
        x: el.x, y: el.y, w: el.w, h: el.h,
      }));

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
    ttsEngine: prd.ttsEngine || 'doubao',
    ttsVoiceId: prd.ttsVoiceId || 'zh_female_vv_uranus_bigtts',
    questions,
    sourcePrdId: prd.id,
  };

  res.json({ success: true, data: analysisResult });
});

// ── AI 优化描述语 ──

router.post('/optimize-prompt', async (req, res) => {
  try {
    const { description, type, backgroundStyle, duration } = req.body;
    if (!description) return res.status(400).json({ success: false, error: '缺少描述内容' });

    let systemPrompt;
    if (type === 'animation') {
      systemPrompt = `你是一个视频生成 prompt 优化专家。用户会给你一段简短的动效/视频描述，你需要将它优化成适合 AI 视频生成引擎（如 Seedance）的高质量英文 prompt。

要求：
1. 输出为英文，因为视频引擎对英文理解更好
2. 描述要具体、生动，包含动作细节、镜头运动、光影效果
3. 画面风格要与背景风格一致：${backgroundStyle || '自然实拍风格'}
4. 视频时长约 ${duration || 4} 秒，动作节奏要合理
5. 避免出现文字、UI元素
6. 只输出优化后的 prompt，不要解释

用户描述：${description}`;
    } else if (type === 'image') {
      systemPrompt = `你是一个图片生成 prompt 优化专家。用户会给你一段简短的图片描述，你需要将它优化成适合 AI 图片生成引擎的高质量 prompt。

要求：
1. 描述要具体、生动，包含主体细节、构图、光影、色调
2. 画面风格要与背景风格一致：${backgroundStyle || '自然实拍风格'}
3. 画面中不要出现任何文字
4. 只输出优化后的 prompt，不要解释

用户描述：${description}`;
    } else {
      return res.status(400).json({ success: false, error: '不支持的类型' });
    }

    const optimized = await geminiChat(systemPrompt);
    res.json({ success: true, data: { original: description, optimized: typeof optimized === 'string' ? optimized.trim() : String(optimized).trim() } });
  } catch (err) {
    console.error('[优化prompt] 失败:', err.message);
    res.json({ success: false, error: err.message });
  }
});

// ── Prompt 翻译 / 同步 ──

router.post('/translate-prompt', async (req, res) => {
  try {
    const { text, direction, type, backgroundStyle, duration } = req.body;
    if (!text) return res.status(400).json({ success: false, error: '缺少文本内容' });

    let prompt;
    if (direction === 'en2zh') {
      prompt = `将以下 AI 生成的英文 prompt 翻译为中文，保留所有细节描述，只输出翻译结果，不要解释：

${text}`;
    } else if (direction === 'zh2en') {
      if (type === 'animation') {
        prompt = `你是一个视频生成 prompt 优化专家。用户会给你一段中文的动效/视频描述，你需要将它优化成适合 AI 视频生成引擎（如 Seedance）的高质量英文 prompt。

要求：
1. 输出为英文，因为视频引擎对英文理解更好
2. 描述要具体、生动，包含动作细节、镜头运动、光影效果
3. 画面风格要与背景风格一致：${backgroundStyle || '自然实拍风格'}
4. 视频时长约 ${duration || 4} 秒，动作节奏要合理
5. 避免出现文字、UI元素
6. 只输出优化后的 prompt，不要解释

用户描述：${text}`;
      } else {
        prompt = `你是一个图片生成 prompt 优化专家。用户会给你一段中文的图片描述，你需要将它优化成适合 AI 图片生成引擎的高质量英文 prompt。

要求：
1. 输出为英文，描述要具体、生动，包含主体细节、构图、光影、色调
2. 画面风格要与背景风格一致：${backgroundStyle || '自然实拍风格'}
3. 画面中不要出现任何文字
4. 只输出优化后的 prompt，不要解释

用户描述：${text}`;
      }
    } else {
      return res.status(400).json({ success: false, error: '不支持的方向，请使用 en2zh 或 zh2en' });
    }

    const result = await geminiChat(prompt);
    const output = typeof result === 'string' ? result.trim() : String(result).trim();
    res.json({ success: true, data: { result: output } });
  } catch (err) {
    console.error('[翻译prompt] 失败:', err.message);
    res.json({ success: false, error: err.message });
  }
});

export default router;
