import { join, dirname } from 'path';
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { createCanvas, registerFont } from 'canvas';
import { doubaoTextToImage, geminiTextToImage, doubaoImageToImage, geminiImageToImage, gptTextToImage, gptImageToImage, downloadFile } from './modaiClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '..', '..', 'fonts');

const FONT_MAP = {
  '方正粗圆斑马英语': { file: 'FZCuYuan.ttf', family: 'FZCuYuan' },
  '思源黑体': { file: 'SourceHanSans.ttf', family: 'SourceHanSans' },
};

const registeredFonts = new Set();
function ensureFont(fontFamily) {
  const entry = FONT_MAP[fontFamily];
  if (!entry) return 'sans-serif';
  if (registeredFonts.has(entry.family)) return entry.family;
  const fp = join(FONTS_DIR, entry.file);
  if (existsSync(fp)) {
    registerFont(fp, { family: entry.family });
    registeredFonts.add(entry.family);
    console.log(`[字体] 注册: ${fontFamily} → ${entry.family}`);
    return entry.family;
  }
  console.warn(`[字体] 文件不存在: ${fp}, 使用 sans-serif`);
  return 'sans-serif';
}

function sizeToAspect(w, h) {
  const r = w / h;
  if (r > 1.4) return '16:9';
  if (r < 0.72) return '9:16';
  if (r > 1.1) return '4:3';
  if (r < 0.9) return '3:4';
  return '1:1';
}

const T2I_ENGINES = {
  doubao: { fn: (p, w, h) => doubaoTextToImage(p, w, h), label: 'Doubao' },
  gemini: { fn: (p, w, h) => geminiTextToImage(p, sizeToAspect(w, h)), label: 'Gemini' },
  gpt:    { fn: (p, w, h) => gptTextToImage(p, w, h), label: 'GPT' },
};
const I2I_ENGINES = {
  doubao: { fn: (p, refs, w, h) => doubaoImageToImage(p, refs, w, h), label: 'Doubao' },
  gemini: { fn: (p, refs, w, h) => geminiImageToImage(p, refs, sizeToAspect(w, h)), label: 'Gemini' },
  gpt:    { fn: (p, refs, w, h) => gptImageToImage(p, refs, w, h), label: 'GPT' },
};
const FALLBACK_ORDER = ['doubao', 'gemini'];

async function tryTextToImage(prompt, w, h, engine) {
  const order = engine && T2I_ENGINES[engine] ? [engine, ...FALLBACK_ORDER.filter(e => e !== engine)] : FALLBACK_ORDER;
  let lastErr;
  for (const key of order) {
    const eng = T2I_ENGINES[key];
    try {
      console.log(`[图片]   尝试 ${eng.label} text-to-image ...`);
      const url = await eng.fn(prompt, w, h);
      return { url, model: key };
    } catch (err) {
      console.warn(`[图片]   ${eng.label} 失败: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr;
}

async function tryImageToImage(prompt, refUrls, w, h, engine) {
  const order = engine && I2I_ENGINES[engine] ? [engine, ...FALLBACK_ORDER.filter(e => e !== engine)] : FALLBACK_ORDER;
  let lastErr;
  for (const key of order) {
    const eng = I2I_ENGINES[key];
    try {
      console.log(`[图片]   尝试 ${eng.label} image-to-image ...`);
      const url = await eng.fn(prompt, refUrls, w, h);
      return { url, model: `${key}-i2i` };
    } catch (err) {
      console.warn(`[图片]   ${eng.label} i2i 失败: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr;
}

function drawTextWithSpacing(ctx, text, x, y, letterSpacing) {
  if (!letterSpacing || letterSpacing === 0) {
    ctx.fillText(text, x, y);
    return;
  }
  const chars = [...text];
  let totalW = 0;
  const widths = chars.map(c => {
    const w = ctx.measureText(c).width;
    totalW += w;
    return w;
  });
  totalW += letterSpacing * (chars.length - 1);
  let cx = x - totalW / 2;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx + widths[i] / 2, y);
    cx += widths[i] + letterSpacing;
  }
}

function renderTextBlock(text, w, h, textStyle) {
  const ts = textStyle || {};
  const fontFamily = ensureFont(ts.fontFamily || '方正粗圆斑马英语');
  const fontSize = ts.fontSize || 36;
  const fontWeight = ts.fontWeight || 'normal';
  const fontColor = ts.fontColor || '#2f4d90';
  const bgColor = ts.bgColor || '#ffffff';
  const letterSpacing = ts.letterSpacing || 0;

  const cvs = createCanvas(w, h);
  const ctx = cvs.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  const align = ts.textAlign || 'center';
  const textX = align === 'left' ? 8 : align === 'right' ? w - 8 : w / 2;

  ctx.fillStyle = fontColor;
  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  drawTextWithSpacing(ctx, text, textX, h / 2, letterSpacing);

  return cvs.toBuffer('image/png');
}

async function compositeWithText(imageBuffer, imgW, imgH, text, textAreaW, textAreaH, textStyle) {
  const textBuf = renderTextBlock(text, textAreaW, textAreaH, textStyle);
  const totalH = imgH + textAreaH;

  return sharp({
    create: { width: imgW, height: totalH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      { input: imageBuffer, top: 0, left: 0 },
      { input: textBuf, top: imgH, left: Math.round((imgW - textAreaW) / 2) },
    ])
    .png()
    .toBuffer();
}

async function applyRoundedCorners(buffer, w, h, radius) {
  if (!radius || radius <= 0) return buffer;
  const r = Math.min(radius, w / 2, h / 2);
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="white"/></svg>`
  );
  return sharp(buffer)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r || 0, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y); ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius); ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h); ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius); ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

async function renderFramedImage(contentBuffer, frameConfig, cardW, cardH) {
  const { borderWidth = 0, borderColor = '#cccccc', borderStyle = 'solid',
    dashLength = 12, dashGap = 6, borderRadius = 16,
    fillColor = 'transparent', fillOpacity = 0 } = frameConfig;

  const { loadImage } = await import('canvas');
  const img = await loadImage(contentBuffer);

  const cvs = createCanvas(cardW, cardH);
  const ctx = cvs.getContext('2d');

  const offsetX = Math.round((cardW - img.width) / 2);
  const offsetY = Math.round((cardH - img.height) / 2);
  ctx.drawImage(img, offsetX, offsetY, img.width, img.height);

  const bw = borderWidth || 0;
  if (fillOpacity > 0 && fillColor && fillColor !== 'transparent') {
    ctx.save();
    ctx.globalAlpha = fillOpacity;
    ctx.fillStyle = fillColor;
    roundRectPath(ctx, bw / 2, bw / 2, cardW - bw, cardH - bw, borderRadius);
    ctx.fill();
    ctx.restore();
  }

  if (bw > 0 && (frameConfig.borderOpacity ?? 1) > 0) {
    ctx.save();
    ctx.globalAlpha = frameConfig.borderOpacity ?? 1;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = bw;
    if (borderStyle === 'dashed') {
      ctx.setLineDash([dashLength, dashGap]);
      ctx.lineCap = frameConfig.lineCap || 'butt';
    }
    roundRectPath(ctx, bw / 2, bw / 2, cardW - bw, cardH - bw, borderRadius);
    ctx.stroke();
    ctx.restore();
  }

  return cvs.toBuffer('image/png');
}

async function renderStateImage(normalImagePath, stateConfig) {
  const imgBuf = readFileSync(normalImagePath);
  const meta = await sharp(imgBuf).metadata();
  const expand = (stateConfig.borderGap || 8) + (stateConfig.borderWidth || 4);
  return renderFramedImage(imgBuf, stateConfig, meta.width + expand * 2, meta.height + expand * 2);
}

const IMG_CONCURRENCY = 3;

async function runWithConcurrency(taskFns, concurrency) {
  const results = [];
  const executing = new Set();
  for (const fn of taskFns) {
    const p = fn().then(r => { executing.delete(p); return r; });
    executing.add(p);
    results.push(p);
    if (executing.size >= concurrency) await Promise.race(executing);
  }
  return Promise.all(results);
}

async function processOneImage(question, img, qDir, taskDir, imageEngine) {
  const [w, h] = (img.size || '360x360').split('x').map(Number);
  const outPath = join(qDir, `${img.name}.png`);
  const hasText = img.text && img.textAreaSize;
  const radius = img.borderRadius || 0;
  const hasFrame = !!img.normalStateConfig && !!img.cardSize;
  const contentPath = hasFrame ? join(qDir, `${img.name}_content.png`) : null;

  try {
    let finalBuf;
    let model = '';

    if (img.source === 'text_render') {
      const tw = hasText ? parseInt(img.textAreaSize.split('x')[0]) : w;
      const th = hasText ? parseInt(img.textAreaSize.split('x')[1]) : h;
      console.log(`[图片] 纯文字渲染 ${question.id}/${img.name} "${img.text}" (${tw}x${th})`);
      finalBuf = renderTextBlock(img.text, tw, th, img.textStyle);
      if (radius > 0) finalBuf = await applyRoundedCorners(finalBuf, tw, th, radius);
      model = 'text_render';
      if (hasFrame) {
        writeFileSync(contentPath, finalBuf);
        const [cw, ch] = img.cardSize.split('x').map(Number);
        finalBuf = await renderFramedImage(finalBuf, img.normalStateConfig, cw, ch);
      }
      writeFileSync(outPath, finalBuf);
      console.log(`[图片]   ✓ ${img.name} (text_render${hasFrame ? ', framed' : ''})`);
      return { questionId: question.id, name: img.name, path: outPath, size: hasFrame ? img.cardSize : `${tw}x${th}`, model, status: 'done' };
    }

    if (img.source === 'upload' && img.uploadUrl) {
      console.log(`[图片] 直接提供 ${question.id}/${img.name} → 裁切至 ${w}x${h}`);
      let buf;
      if (img.uploadUrl.startsWith('/uploads/')) {
        const localPath = join(taskDir, '..', '..', img.uploadUrl);
        buf = readFileSync(localPath);
      } else if (img.uploadUrl.startsWith('/')) {
        buf = readFileSync(img.uploadUrl);
      } else {
        buf = await downloadFile(img.uploadUrl);
      }
      finalBuf = await sharp(buf).resize(w, h, { fit: 'cover' }).png().toBuffer();

      if (hasText) {
        const [tw, th2] = img.textAreaSize.split('x').map(Number);
        finalBuf = await compositeWithText(finalBuf, w, h, img.text, tw, th2, img.textStyle);
        const totalH = h + th2;
        if (radius > 0) finalBuf = await applyRoundedCorners(finalBuf, w, totalH, radius);
        console.log(`[图片]   + 合成文字 "${img.text}"`);
      } else if (radius > 0) {
        finalBuf = await applyRoundedCorners(finalBuf, w, h, radius);
      }

      model = 'upload';
      if (hasFrame) {
        writeFileSync(contentPath, finalBuf);
        const [cw, ch] = img.cardSize.split('x').map(Number);
        finalBuf = await renderFramedImage(finalBuf, img.normalStateConfig, cw, ch);
      }
      writeFileSync(outPath, finalBuf);
      console.log(`[图片]   ✓ ${img.name} (upload, ${w}x${h}${hasFrame ? ', framed' : ''})`);
      return { questionId: question.id, name: img.name, path: outPath, size: hasFrame ? img.cardSize : `${w}x${h}`, model, status: 'done' };
    }

    let prompt = img.prompt || img.description;
    if (!prompt) return null;

    if (hasText && !prompt.includes('不') && !prompt.includes('no text')) {
      prompt += '，画面中不要出现任何文字';
    }

    console.log(`[图片] 生成 ${question.id}/${img.name} ...`);
    let genResult;

    if (img.referenceUrl) {
      let refUrl = img.referenceUrl;
      if (refUrl.startsWith('/')) {
        let rel = refUrl.slice(1);
        if (rel.startsWith('workspace-assets/')) rel = 'data/' + rel;
        else if (rel.startsWith('prd-assets/')) rel = 'data/' + rel;
        const localPath = join(__dirname, '..', '..', rel);
        if (existsSync(localPath)) {
          const buf = readFileSync(localPath);
          refUrl = `data:image/png;base64,${buf.toString('base64')}`;
        } else {
          refUrl = `http://localhost:3200${img.referenceUrl}`;
        }
      }
      genResult = await tryImageToImage(prompt, [refUrl], w, h, imageEngine);
    } else {
      genResult = await tryTextToImage(prompt, w, h, imageEngine);
    }

    const imageBuffer = await downloadFile(genResult.url);
    finalBuf = await sharp(imageBuffer).resize(w, h, { fit: 'cover' }).png().toBuffer();

    if (hasText) {
      const [tw, th2] = img.textAreaSize.split('x').map(Number);
      finalBuf = await compositeWithText(finalBuf, w, h, img.text, tw, th2, img.textStyle);
      const totalH = h + th2;
      if (radius > 0) finalBuf = await applyRoundedCorners(finalBuf, w, totalH, radius);
      console.log(`[图片]   + 合成文字 "${img.text}"`);
    } else if (radius > 0) {
      finalBuf = await applyRoundedCorners(finalBuf, w, h, radius);
    }

    model = genResult.model;
    if (hasFrame) {
      writeFileSync(contentPath, finalBuf);
      const [cw, ch] = img.cardSize.split('x').map(Number);
      finalBuf = await renderFramedImage(finalBuf, img.normalStateConfig, cw, ch);
    }
    writeFileSync(outPath, finalBuf);
    console.log(`[图片]   ✓ ${img.name} (via ${model}, ${w}x${h}${hasFrame ? ', framed' : ''})`);
    return { questionId: question.id, name: img.name, path: outPath, size: hasFrame ? img.cardSize : `${w}x${h}`, model, status: 'done' };
  } catch (err) {
    console.error(`[图片] 全部模型失败 ${question.id}/${img.name}:`, err.message);
    return { questionId: question.id, name: img.name, status: 'failed', error: err.message };
  }
}

export async function generateImages(analysisResult, taskDir) {
  const questions = analysisResult.questions || analysisResult.epics?.flatMap(e => e.questions) || [];
  const imageEngine = analysisResult.imageEngine || '';

  const normalTasks = [];
  const variantTasks = [];

  for (const question of questions) {
    const qDir = join(taskDir, question.id.replace(/\./g, '-'));
    mkdirSync(qDir, { recursive: true });
    const images = question.assets?.images || question.imagePrompts || [];
    for (const img of images) {
      if (img.source === '_state_variant') {
        variantTasks.push({ question, img, qDir });
      } else {
        normalTasks.push(() => processOneImage(question, img, qDir, taskDir, imageEngine));
      }
    }
  }

  console.log(`[图片] 共 ${normalTasks.length} 张普通图 + ${variantTasks.length} 张状态变体，并发数 ${IMG_CONCURRENCY}`);
  const normalResults = await runWithConcurrency(normalTasks, IMG_CONCURRENCY);

  const variantResults = [];
  const contentFilesToClean = new Set();
  for (const { question, img, qDir } of variantTasks) {
    const outPath = join(qDir, `${img.name}.png`);
    try {
      const contentPath = join(qDir, `${img.baseImageName}_content.png`);
      const basePath = join(qDir, `${img.baseImageName}.png`);
      const useContent = img.cardSize && existsSync(contentPath);
      const srcPath = useContent ? contentPath : basePath;

      if (!existsSync(srcPath)) {
        console.warn(`[图片] 状态变体跳过 — 源图不存在: ${srcPath}`);
        variantResults.push({ questionId: question.id, name: img.name, status: 'failed', error: '源图未生成' });
        continue;
      }

      console.log(`[图片] 状态变体 ${question.id}/${img.name} (${img.stateType}, from ${useContent ? 'content' : 'base'})`);
      let finalBuf;
      if (useContent) {
        const contentBuf = readFileSync(contentPath);
        const [cw, ch] = img.cardSize.split('x').map(Number);
        finalBuf = await renderFramedImage(contentBuf, img.stateConfig, cw, ch);
        contentFilesToClean.add(contentPath);
      } else {
        finalBuf = await renderStateImage(basePath, img.stateConfig);
      }
      writeFileSync(outPath, finalBuf);
      console.log(`[图片]   ✓ ${img.name} (${img.stateType})`);
      variantResults.push({ questionId: question.id, name: img.name, path: outPath, model: 'state_variant', status: 'done' });
    } catch (err) {
      console.error(`[图片] 状态变体失败 ${question.id}/${img.name}:`, err.message);
      variantResults.push({ questionId: question.id, name: img.name, status: 'failed', error: err.message });
    }
  }

  for (const f of contentFilesToClean) {
    try { unlinkSync(f); } catch (_) { /* ignore */ }
  }

  const widgetResults = [];
  for (const question of questions) {
    const widgets = question.assets?.controlWidgets || [];
    if (widgets.length === 0) continue;
    const qDir = join(taskDir, question.id.replace(/\./g, '-'));
    for (const w of widgets) {
      const ext = (w.assetUrl || '').split('.').pop() || 'png';
      const outPath = join(qDir, `${w.name}.${ext}`);
      try {
        let srcPath = w.assetPath;
        if (srcPath && srcPath.startsWith('/data/')) {
          srcPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', srcPath);
        } else if (w.assetUrl && w.assetUrl.startsWith('/')) {
          const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
          srcPath = join(rootDir, 'data', w.assetUrl.replace(/^\//, ''));
        }
        if (srcPath && existsSync(srcPath)) {
          const buf = readFileSync(srcPath);
          writeFileSync(outPath, buf);
          console.log(`[控件] ✓ ${question.id}/${w.name}.${ext}`);
          widgetResults.push({ questionId: question.id, name: w.name, path: outPath, model: 'widget_copy', status: 'done' });
        } else if (w.assetUrl && !w.assetUrl.startsWith('/')) {
          const buf = await downloadFile(w.assetUrl);
          writeFileSync(outPath, buf);
          console.log(`[控件] ✓ ${question.id}/${w.name}.${ext} (remote)`);
          widgetResults.push({ questionId: question.id, name: w.name, path: outPath, model: 'widget_copy', status: 'done' });
        } else {
          console.warn(`[控件] 跳过 ${question.id}/${w.name} — 素材不存在`);
          widgetResults.push({ questionId: question.id, name: w.name, status: 'failed', error: '素材文件不存在' });
        }
      } catch (err) {
        console.error(`[控件] 失败 ${question.id}/${w.name}:`, err.message);
        widgetResults.push({ questionId: question.id, name: w.name, status: 'failed', error: err.message });
      }
    }
  }

  return [...normalResults.filter(Boolean), ...variantResults, ...widgetResults];
}
