import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createCanvas } from 'canvas';
import { seedanceTextToVideo, seedanceImageToVideo, downloadFile } from './modaiClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);

function createRoundedMask(w, h, radius, outputPath) {
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

  const buf = canvas.toBuffer('image/png');
  writeFileSync(outputPath, buf);
  return outputPath;
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

async function videoToApng(videoPath, outputPath, w, h, opts = {}) {
  const {
    fps = 15,
    borderRadius = 0,
    padding = null,
    usePalette = false,
    maxColors = 256,
    dither = 'none',
  } = opts;

  const tmpDir = dirname(outputPath);
  const maskPath = join(tmpDir, '_mask.png');
  const palettePath = join(tmpDir, '_palette.png');

  try {
    const scaleW = w || 360;
    const scaleH = h || -1;

    const filterParts = [];
    filterParts.push(`[0:v]fps=${fps},scale=${scaleW}:${scaleH}:flags=lanczos`);

    let lastLabel = '[scaled]';
    let filterComplex = '';

    if (borderRadius > 0) {
      createRoundedMask(scaleW, typeof scaleH === 'number' && scaleH > 0 ? scaleH : Math.round(scaleW * 9 / 16), borderRadius, maskPath);
      filterComplex = `[0:v]fps=${fps},scale=${scaleW}:${scaleH}:flags=lanczos[scaled];[1:v]scale=${scaleW}:${scaleH}:flags=lanczos,format=gray,geq=lum='lum(X,Y)':a='lum(X,Y)'[mask];[scaled][mask]alphamerge[masked]`;
      lastLabel = '[masked]';

      if (padding) {
        const totalW = padding.totalWidth || (scaleW + padding.left + padding.right);
        filterComplex += `;color=white:${totalW}x${scaleH > 0 ? scaleH : Math.round(scaleW * 9 / 16)}:d=1[bg];[bg]${lastLabel}overlay=${padding.left}:0[padded]`;
        lastLabel = '[padded]';
      }
    } else if (padding) {
      const totalW = padding.totalWidth || (scaleW + padding.left + padding.right);
      const actualH = scaleH > 0 ? scaleH : Math.round(scaleW * 9 / 16);
      filterComplex = `[0:v]fps=${fps},scale=${scaleW}:${scaleH}:flags=lanczos[scaled];color=white:${totalW}x${actualH}:d=1[bg];[bg][scaled]overlay=${padding.left}:0[padded]`;
      lastLabel = '[padded]';
    } else {
      filterComplex = `[0:v]fps=${fps},scale=${scaleW}:${scaleH}:flags=lanczos[scaled]`;
      lastLabel = '[scaled]';
    }

    if (usePalette) {
      // Stage 1: generate palette
      const paletteFilter = `${filterComplex};${lastLabel}palettegen=max_colors=${maxColors}:stats_mode=diff[pal]`;
      const args1 = ['-y', '-i', videoPath];
      if (borderRadius > 0) args1.push('-i', maskPath);
      args1.push('-filter_complex', paletteFilter, '-map', '[pal]', palettePath);
      await execFileAsync('ffmpeg', args1, { timeout: 180_000 });

      // Stage 2: apply palette
      const ditherOpt = dither && dither !== 'none' ? `:dither=${dither}` : '';
      const useFilter = `${filterComplex};${lastLabel}[2:v]paletteuse${ditherOpt}[out]`;
      const args2 = ['-y', '-i', videoPath];
      if (borderRadius > 0) args2.push('-i', maskPath);
      args2.push('-i', palettePath, '-filter_complex', useFilter, '-map', '[out]', '-plays', '0', outputPath);
      await execFileAsync('ffmpeg', args2, { timeout: 180_000 });
    } else {
      const finalFilter = `${filterComplex};${lastLabel}split[a][b];[a]palettegen[pal];[b][pal]paletteuse[out]`;
      const args = ['-y', '-i', videoPath];
      if (borderRadius > 0) args.push('-i', maskPath);
      args.push('-filter_complex', finalFilter, '-map', '[out]', '-plays', '0', outputPath);
      await execFileAsync('ffmpeg', args, { timeout: 180_000 });
    }
  } finally {
    try { if (existsSync(maskPath)) unlinkSync(maskPath); } catch {}
    try { if (existsSync(palettePath)) unlinkSync(palettePath); } catch {}
  }
}

export async function generateAnimations(analysisResult, taskDir) {
  const results = [];
  const questions = analysisResult.questions || analysisResult.epics?.flatMap(e => e.questions) || [];

  for (const question of questions) {
    const animations = question.assets?.animations || [];
    if (animations.length === 0) continue;

    const qDir = join(taskDir, question.id.replace(/\./g, '-'));
    mkdirSync(qDir, { recursive: true });

    for (const anim of animations) {
      const tmpVideo = join(qDir, `${anim.name}_tmp.mp4`);
      const outPath = join(qDir, `${anim.name}.apng`);

      try {
        if (!anim.description) {
          results.push({ questionId: question.id, name: anim.name, status: 'skipped', error: '无描述' });
          continue;
        }

        const duration = anim.duration || 4;
        const animW = anim.w || 360;
        const animH = anim.h || 0;
        const animFps = anim.fps || 15;
        const animBorderRadius = anim.borderRadius || 0;
        const animPadding = anim.padding || null;
        const animUsePalette = anim.usePalette ?? false;
        const animMaxColors = anim.maxColors || 256;
        const animDither = anim.dither || 'none';
        const aspectRatio = anim.aspectRatio || sizeToAspect(animW, animH);

        console.log(`[动效] 生成 ${question.id}/${anim.name} (${duration}s, ${aspectRatio}) ...`);
        console.log(`[动效] 描述: ${anim.description}`);

        let videoResult;
        if (anim.referenceUrl) {
          videoResult = await seedanceImageToVideo(anim.description, [anim.referenceUrl], {
            aspectRatio,
            duration,
            resolution: '720p',
          });
        } else {
          videoResult = await seedanceTextToVideo(anim.description, {
            aspectRatio,
            duration,
            resolution: '720p',
          });
        }

        console.log(`[动效] 视频生成完成，下载中 ...`);
        const videoBuffer = await downloadFile(videoResult.url);
        writeFileSync(tmpVideo, videoBuffer);

        console.log(`[动效] 转换 APNG (fps=${animFps}, radius=${animBorderRadius}, palette=${animUsePalette}) ...`);
        await videoToApng(tmpVideo, outPath, animW, animH, {
          fps: animFps,
          borderRadius: animBorderRadius,
          padding: animPadding,
          usePalette: animUsePalette,
          maxColors: animMaxColors,
          dither: animDither,
        });

        try { unlinkSync(tmpVideo); } catch {}

        results.push({
          questionId: question.id,
          name: anim.name,
          description: anim.description,
          duration,
          path: outPath,
          status: 'done',
        });
        console.log(`[动效] 完成 ${question.id}/${anim.name}.apng`);
      } catch (err) {
        console.error(`[动效] 失败 ${question.id}/${anim.name}:`, err.message);
        try { unlinkSync(tmpVideo); } catch {}
        results.push({
          questionId: question.id,
          name: anim.name,
          description: anim.description,
          status: 'failed',
          error: err.message,
        });
      }
    }
  }

  return results;
}
