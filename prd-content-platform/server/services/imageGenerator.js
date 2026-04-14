import { join, dirname } from 'path';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { createCanvas, registerFont } from 'canvas';
import { doubaoTextToImage, geminiTextToImage, doubaoImageToImage, geminiImageToImage, downloadFile } from './modaiClient.js';

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

async function tryTextToImage(prompt, w, h) {
  try {
    console.log(`[图片]   尝试 Doubao text-to-image ...`);
    const url = await doubaoTextToImage(prompt, w, h);
    return { url, model: 'doubao' };
  } catch (err) {
    console.warn(`[图片]   Doubao 失败: ${err.message}`);
    console.log(`[图片]   降级到 Gemini text-to-image ...`);
    const url = await geminiTextToImage(prompt, sizeToAspect(w, h));
    return { url, model: 'gemini' };
  }
}

async function tryImageToImage(prompt, refUrls, w, h) {
  try {
    console.log(`[图片]   尝试 Doubao image-to-image ...`);
    const url = await doubaoImageToImage(prompt, refUrls, w, h);
    return { url, model: 'doubao-i2i' };
  } catch (err) {
    console.warn(`[图片]   Doubao i2i 失败: ${err.message}`);
    console.log(`[图片]   降级到 Gemini image-to-image ...`);
    const url = await geminiImageToImage(prompt, refUrls, sizeToAspect(w, h));
    return { url, model: 'gemini-i2i' };
  }
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
  const fontColor = ts.fontColor || '#2f4d90';
  const bgColor = ts.bgColor || '#ffffff';
  const letterSpacing = ts.letterSpacing || 0;

  const cvs = createCanvas(w, h);
  const ctx = cvs.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = fontColor;
  ctx.font = `${fontSize}px "${fontFamily}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawTextWithSpacing(ctx, text, w / 2, h / 2, letterSpacing);

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

async function renderStateImage(normalImagePath, stateConfig) {
  const { borderWidth = 4, borderColor = '#22c55e', borderStyle = 'dashed',
    dashLength = 12, dashGap = 6, borderGap = 8, borderRadius = 16,
    fillColor = 'transparent', fillOpacity = 0 } = stateConfig;

  const imgBuf = readFileSync(normalImagePath);
  const meta = await sharp(imgBuf).metadata();
  const imgW = meta.width;
  const imgH = meta.height;

  const expand = borderGap + borderWidth;
  const totalW = imgW + expand * 2;
  const totalH = imgH + expand * 2;

  const cvs = createCanvas(totalW, totalH);
  const ctx = cvs.getContext('2d');

  const bx = borderWidth / 2;
  const by = borderWidth / 2;
  const bw = totalW - borderWidth;
  const bh = totalH - borderWidth;

  const { loadImage } = await import('canvas');
  const img = await loadImage(imgBuf);
  ctx.drawImage(img, expand, expand, imgW, imgH);

  if (fillOpacity > 0 && fillColor && fillColor !== 'transparent') {
    ctx.save();
    ctx.globalAlpha = fillOpacity;
    ctx.fillStyle = fillColor;
    roundRectPath(ctx, bx, by, bw, bh, borderRadius);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = stateConfig.borderOpacity ?? 1;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  if (borderStyle === 'dashed') {
    ctx.setLineDash([dashLength, dashGap]);
    ctx.lineCap = stateConfig.lineCap || 'butt';
  }
  roundRectPath(ctx, bx, by, bw, bh, borderRadius);
  ctx.stroke();
  ctx.restore();

  return cvs.toBuffer('image/png');
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

async function processOneImage(question, img, qDir, taskDir) {
  const [w, h] = (img.size || '360x360').split('x').map(Number);
  const outPath = join(qDir, `${img.name}.png`);
  const hasText = img.text && img.textAreaSize;
  const radius = img.borderRadius || 0;

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
      writeFileSync(outPath, finalBuf);
      console.log(`[图片]   ✓ ${img.name} (text_render)`);
      return { questionId: question.id, name: img.name, path: outPath, size: `${tw}x${th}`, model, status: 'done' };
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
      writeFileSync(outPath, finalBuf);
      console.log(`[图片]   ✓ ${img.name} (upload, ${w}x${h}, r=${radius})`);
      return { questionId: question.id, name: img.name, path: outPath, size: `${w}x${h}`, model, status: 'done' };
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
      if (refUrl.startsWith('/')) refUrl = `http://localhost:3200${refUrl}`;
      genResult = await tryImageToImage(prompt, [refUrl], w, h);
    } else {
      genResult = await tryTextToImage(prompt, w, h);
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
    writeFileSync(outPath, finalBuf);
    console.log(`[图片]   ✓ ${img.name} (via ${model}, ${w}x${h}, r=${radius})`);
    return { questionId: question.id, name: img.name, path: outPath, size: `${w}x${h}`, model, status: 'done' };
  } catch (err) {
    console.error(`[图片] 全部模型失败 ${question.id}/${img.name}:`, err.message);
    return { questionId: question.id, name: img.name, status: 'failed', error: err.message };
  }
}

export async function generateImages(analysisResult, taskDir) {
  const questions = analysisResult.questions || analysisResult.epics?.flatMap(e => e.questions) || [];

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
        normalTasks.push(() => processOneImage(question, img, qDir, taskDir));
      }
    }
  }

  console.log(`[图片] 共 ${normalTasks.length} 张普通图 + ${variantTasks.length} 张状态变体，并发数 ${IMG_CONCURRENCY}`);
  const normalResults = await runWithConcurrency(normalTasks, IMG_CONCURRENCY);

  const variantResults = [];
  for (const { question, img, qDir } of variantTasks) {
    const outPath = join(qDir, `${img.name}.png`);
    try {
      const basePath = join(qDir, `${img.baseImageName}.png`);
      if (!existsSync(basePath)) {
        console.warn(`[图片] 状态变体跳过 — 常态图不存在: ${img.baseImageName}`);
        variantResults.push({ questionId: question.id, name: img.name, status: 'failed', error: '常态图未生成' });
        continue;
      }
      console.log(`[图片] 状态变体 ${question.id}/${img.name} (${img.stateType})`);
      const finalBuf = await renderStateImage(basePath, img.stateConfig);
      writeFileSync(outPath, finalBuf);
      console.log(`[图片]   ✓ ${img.name} (${img.stateType})`);
      variantResults.push({ questionId: question.id, name: img.name, path: outPath, model: 'state_variant', status: 'done' });
    } catch (err) {
      console.error(`[图片] 状态变体失败 ${question.id}/${img.name}:`, err.message);
      variantResults.push({ questionId: question.id, name: img.name, status: 'failed', error: err.message });
    }
  }

  return [...normalResults.filter(Boolean), ...variantResults];
}
