import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import sharp from 'sharp';
import { createCanvas, registerFont } from 'canvas';
import { doubaoTextToImage, doubaoImageToImage, downloadFile } from './modaiClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_PATH = join(__dirname, '..', '..', 'fonts', 'FZCuYuan.ttf');

let fontRegistered = false;
function ensureFont() {
  if (fontRegistered) return;
  if (existsSync(FONT_PATH)) {
    try {
      registerFont(FONT_PATH, { family: '方正粗圆斑马英语' });
      fontRegistered = true;
      console.log('[图片] 已注册字体: 方正粗圆斑马英语');
    } catch (err) {
      console.warn('[图片] 字体注册失败:', err.message);
    }
  } else {
    console.warn('[图片] 字体文件不存在:', FONT_PATH);
  }
}

function createRoundedMask(w, h, radius) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.arcTo(w, 0, w, r, r);
  ctx.lineTo(w, h - r);
  ctx.arcTo(w, h, w - r, h, r);
  ctx.lineTo(r, h);
  ctx.arcTo(0, h, 0, h - r, r);
  ctx.lineTo(0, r);
  ctx.arcTo(0, 0, r, 0, r);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  return canvas.toBuffer('image/png');
}

function renderTextImage(text, w, h, style = {}) {
  ensureFont();

  const {
    fontFamily = '方正粗圆斑马英语',
    fontSize = 36,
    fontColor = '#1e3a8a',
    bgColor = '#ffffff',
    align = 'center',
    letterSpacing = 0,
  } = style;

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = fontColor;
  ctx.font = `${fontSize}px "${fontFamily}"`;
  ctx.textBaseline = 'middle';

  if (letterSpacing > 0 && text) {
    const chars = [...text];
    const totalTextW = chars.reduce((sum, ch) => {
      return sum + ctx.measureText(ch).width + letterSpacing;
    }, -letterSpacing);

    let startX;
    if (align === 'center') startX = (w - totalTextW) / 2;
    else if (align === 'right') startX = w - totalTextW - 10;
    else startX = 10;

    let cx = startX;
    for (const ch of chars) {
      ctx.fillText(ch, cx, h / 2);
      cx += ctx.measureText(ch).width + letterSpacing;
    }
  } else {
    ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
    const x = align === 'center' ? w / 2 : align === 'right' ? w - 10 : 10;
    ctx.fillText(text, x, h / 2);
  }

  return canvas.toBuffer('image/png');
}

function renderStateImage(baseW, baseH, stateConfig) {
  const {
    borderWidth = 4,
    borderColor = '#ffc933',
    borderOpacity = 1,
    borderStyle = 'solid',
    lineCap = 'round',
    dashLength = 12,
    dashGap = 6,
    borderGap = 20,
    borderRadius = 0,
    fillColor = '#ffc933',
    fillOpacity = 0,
  } = stateConfig;

  const expand = borderGap + borderWidth;
  const totalW = baseW + expand * 2;
  const totalH = baseH + expand * 2;

  const canvas = createCanvas(totalW, totalH);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, totalW, totalH);

  const r = Math.min(borderRadius, totalW / 2, totalH / 2);
  const halfBW = borderWidth / 2;
  const bx = halfBW;
  const by = halfBW;
  const bw = totalW - borderWidth;
  const bh = totalH - borderWidth;

  function roundedRectPath(cx, cy, cw, ch, cr) {
    ctx.beginPath();
    ctx.moveTo(cx + cr, cy);
    ctx.lineTo(cx + cw - cr, cy);
    ctx.arcTo(cx + cw, cy, cx + cw, cy + cr, cr);
    ctx.lineTo(cx + cw, cy + ch - cr);
    ctx.arcTo(cx + cw, cy + ch, cx + cw - cr, cy + ch, cr);
    ctx.lineTo(cx + cr, cy + ch);
    ctx.arcTo(cx, cy + ch, cx, cy + ch - cr, cr);
    ctx.lineTo(cx, cy + cr);
    ctx.arcTo(cx, cy, cx + cr, cy, cr);
    ctx.closePath();
  }

  // fill
  if (fillOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = fillOpacity;
    roundedRectPath(bx, by, bw, bh, r);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.restore();
  }

  // border
  if (borderWidth > 0 && borderOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = borderOpacity;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.lineCap = lineCap;

    if (borderStyle === 'dashed') {
      ctx.setLineDash([dashLength, dashGap]);
    }

    roundedRectPath(bx, by, bw, bh, r);
    ctx.stroke();
    ctx.restore();
  }

  return canvas.toBuffer('image/png');
}

export async function generateImages(analysisResult, taskDir) {
  ensureFont();
  const results = [];
  const questions = analysisResult.questions || analysisResult.epics?.flatMap(e => e.questions) || [];

  for (const question of questions) {
    const qDir = join(taskDir, question.id.replace(/\./g, '-'));
    mkdirSync(qDir, { recursive: true });

    const images = question.assets?.images || question.imagePrompts || [];

    for (const img of images) {
      try {
        const outPath = join(qDir, `${img.name}.png`);

        // State variant: render border/fill overlay
        if (img.source === '_state_variant') {
          const { baseSize, stateConfig } = img;
          const buf = renderStateImage(baseSize.w, baseSize.h, stateConfig);
          writeFileSync(outPath, buf);
          results.push({ questionId: question.id, name: img.name, path: outPath, status: 'done' });
          continue;
        }

        // Text render: canvas-based text drawing
        if (img.source === 'text_render') {
          const [w, h] = (img.size || '300x70').split('x').map(Number);
          const buf = renderTextImage(img.prompt, w, h, img.textStyle);

          if (img.borderRadius > 0) {
            const mask = createRoundedMask(w, h, img.borderRadius);
            const processed = await sharp(buf)
              .composite([{ input: mask, blend: 'dest-in' }])
              .png()
              .toBuffer();
            writeFileSync(outPath, processed);
          } else {
            writeFileSync(outPath, buf);
          }

          results.push({ questionId: question.id, name: img.name, path: outPath, size: img.size, status: 'done' });
          continue;
        }

        // Uploaded image: download and process
        if (img.source === 'upload' && img.uploadUrl) {
          console.log(`[图片] 下载上传素材 ${question.id}/${img.name} ...`);
          const imageBuffer = await downloadFile(img.uploadUrl);
          const [w, h] = (img.size || '360x360').split('x').map(Number);
          let processed = await sharp(imageBuffer).resize(w, h, { fit: 'cover' }).png().toBuffer();

          if (img.borderRadius > 0) {
            const mask = createRoundedMask(w, h, img.borderRadius);
            processed = await sharp(processed).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
          }

          writeFileSync(outPath, processed);
          results.push({ questionId: question.id, name: img.name, path: outPath, size: img.size, status: 'done' });
          continue;
        }

        // Reference image: image-to-image API
        if (img.source === 'reference' && img.referenceUrl) {
          console.log(`[图片] 参考图生成 ${question.id}/${img.name} ...`);
          const [w, h] = (img.size || '360x360').split('x').map(Number);
          const imageUrl = await doubaoImageToImage(img.prompt, [img.referenceUrl], w, h);
          const imageBuffer = await downloadFile(imageUrl);
          let processed = await sharp(imageBuffer).resize(w, h, { fit: 'cover' }).png().toBuffer();

          if (img.borderRadius > 0) {
            const mask = createRoundedMask(w, h, img.borderRadius);
            processed = await sharp(processed).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
          }

          writeFileSync(outPath, processed);
          results.push({ questionId: question.id, name: img.name, path: outPath, size: `${w}x${h}`, status: 'done' });
          continue;
        }

        // Regular text-to-image generation
        const prompt = img.prompt;
        if (!prompt) continue;

        console.log(`[图片] 生成 ${question.id}/${img.name} ...`);
        const [w, h] = (img.size || '360x360').split('x').map(Number);
        const imageUrl = await doubaoTextToImage(prompt, w, h);
        const imageBuffer = await downloadFile(imageUrl);

        let processed = await sharp(imageBuffer).resize(w, h, { fit: 'cover' }).png().toBuffer();

        if (img.borderRadius > 0) {
          const mask = createRoundedMask(w, h, img.borderRadius);
          processed = await sharp(processed).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
        }

        writeFileSync(outPath, processed);
        results.push({ questionId: question.id, name: img.name, path: outPath, size: `${w}x${h}`, status: 'done' });
      } catch (err) {
        console.error(`[图片] 生成失败 ${question.id}/${img.name}:`, err.message);
        results.push({ questionId: question.id, name: img.name, status: 'failed', error: err.message });
      }
    }
  }

  return results;
}
