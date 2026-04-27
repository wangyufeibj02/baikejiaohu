import { join, dirname } from 'path';
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync, copyFileSync } from 'fs';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { createCanvas } from 'canvas';
import { seedanceTextToVideo, seedanceImageToVideo, downloadFile } from './modaiClient.js';

const execFileAsync = promisify(execFile);

function sizeToAspect(w, h) {
  const r = w / h;
  if (r > 1.4) return '16:9';
  if (r < 0.72) return '9:16';
  if (r > 1.1) return '4:3';
  if (r < 0.9) return '3:4';
  return '1:1';
}

function createRoundedMask(w, h, radius, outputPath) {
  const cvs = createCanvas(w, h);
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(w - radius, 0);
  ctx.arcTo(w, 0, w, radius, radius);
  ctx.lineTo(w, h - radius);
  ctx.arcTo(w, h, w - radius, h, radius);
  ctx.lineTo(radius, h);
  ctx.arcTo(0, h, 0, h - radius, radius);
  ctx.lineTo(0, radius);
  ctx.arcTo(0, 0, radius, 0, radius);
  ctx.closePath();
  ctx.fill();
  writeFileSync(outputPath, cvs.toBuffer('image/png'));
}

async function videoToApng(videoPath, outputPath, w, h, opts = {}) {
  const fps = opts.fps || 10;
  const borderRadius = opts.borderRadius || 0;
  const padding = opts.padding || null;
  const maxColors = opts.maxColors ?? 256;
  const dither = opts.dither || 'none';
  const plays = String(opts.plays ?? 0);
  const usePalette = maxColors > 0 && maxColors <= 256;

  const needsMask = borderRadius > 0 && w && h;
  const needsPad = padding && padding.totalWidth > 0;
  const scaleFilter = (w && h) ? `fps=${fps},scale=${w}:${h}:flags=lanczos` : `fps=${fps},scale=360:-1:flags=lanczos`;

  if (!needsMask && !needsPad) {
    if (usePalette) {
      const palettePath = outputPath.replace(/\.png$/, '_palette.png');
      await execFileAsync('ffmpeg', [
        '-y', '-i', videoPath,
        '-vf', `${scaleFilter},palettegen=max_colors=${maxColors}`,
        palettePath,
      ], { timeout: 120_000 });
      const ditherOpt = dither === 'none' ? 'none' : dither;
      await execFileAsync('ffmpeg', [
        '-y', '-i', videoPath, '-i', palettePath,
        '-filter_complex', `[0:v]${scaleFilter}[v];[v][1:v]paletteuse=dither=${ditherOpt}`,
        '-plays', plays, '-f', 'apng',
        outputPath,
      ], { timeout: 120_000 });
      try { unlinkSync(palettePath); } catch {}
    } else {
      await execFileAsync('ffmpeg', [
        '-y', '-i', videoPath,
        '-vf', scaleFilter,
        '-plays', plays, '-f', 'apng',
        outputPath,
      ], { timeout: 120_000 });
    }
    return;
  }

  const maskPath = outputPath.replace(/\.png$/, '_mask.png');
  let filterParts = [];
  let inputs = ['-y', '-i', videoPath];

  if (needsMask) {
    createRoundedMask(w, h, borderRadius, maskPath);
    inputs.push('-i', maskPath);
  }

  const maskInputIdx = needsMask ? 1 : -1;
  filterParts.push(`[0:v]fps=${fps},scale=${w}:${h}:flags=lanczos,format=rgba[scaled]`);

  if (needsMask) {
    filterParts.push(`[${maskInputIdx}:v]format=rgba,alphaextract[alpha]`);
    filterParts.push(`[scaled][alpha]alphamerge[masked]`);
  }

  const maskedLabel = needsMask ? 'masked' : 'scaled';

  if (needsPad) {
    const tw = padding.totalWidth;
    const lp = padding.leftPad;
    filterParts.push(`color=white:s=${tw}x${h}:d=999,format=rgba[bg]`);
    filterParts.push(`[bg][${maskedLabel}]overlay=${lp}:0:shortest=1[out]`);
  } else {
    filterParts.push(`color=white:s=${w}x${h}:d=999,format=rgba[wbg]`);
    filterParts.push(`[wbg][${maskedLabel}]overlay=0:0:shortest=1[out]`);
  }

  if (usePalette) {
    const palettePath = outputPath.replace(/\.png$/, '_palette.png');
    const paletteFilter = filterParts.join(';') + ';[out]palettegen=max_colors=' + maxColors + '[pal]';
    await execFileAsync('ffmpeg', [
      ...inputs,
      '-filter_complex', paletteFilter,
      '-map', '[pal]',
      palettePath,
    ], { timeout: 120_000 });

    const palInputIdx = inputs.filter(a => a === '-i').length;
    inputs.push('-i', palettePath);
    const ditherOpt = dither === 'none' ? 'none' : dither;
    const useFilter = filterParts.join(';') + `;[out][${palInputIdx}:v]paletteuse=dither=${ditherOpt}[final]`;
    await execFileAsync('ffmpeg', [
      ...inputs,
      '-filter_complex', useFilter,
      '-map', '[final]',
      '-plays', plays, '-f', 'apng',
      outputPath,
    ], { timeout: 120_000 });
    try { unlinkSync(palettePath); } catch {}
  } else {
    const filterComplex = filterParts.join(';');
    await execFileAsync('ffmpeg', [
      ...inputs,
      '-filter_complex', filterComplex,
      '-map', '[out]',
      '-plays', plays, '-f', 'apng',
      outputPath,
    ], { timeout: 120_000 });
  }

  try { unlinkSync(maskPath); } catch {}
}

const ANIM_CONCURRENCY = 2;

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

const __animDir = dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = join(__animDir, '..', '..');

async function processOneAnimation(question, anim, qDir, taskId) {
  const tmpVideo = join(qDir, `${anim.name}_tmp.mp4`);
  const outPath = join(qDir, `${anim.name}.png`);

  try {
    if (anim.customApngUrl) {
      let localPath = anim.customApngUrl;
      if (localPath.startsWith('/')) localPath = localPath.slice(1);
      if (localPath.startsWith('uploads/')) { /* already correct */ }
      const absPath = join(DATA_ROOT, localPath);
      if (existsSync(absPath)) {
        copyFileSync(absPath, outPath);
        console.log(`[动效] 使用自定义APNG ${question.id}/${anim.name}`);
        return { questionId: question.id, name: anim.name, description: '自定义上传', path: outPath, status: 'done' };
      }
      console.warn(`[动效] 自定义APNG文件不存在: ${absPath}，降级为AI生成`);
    }

    if (!anim.description) {
      return { questionId: question.id, name: anim.name, status: 'skipped', error: '无描述' };
    }

    const duration = anim.duration || 4;
    const aw = anim.width || null;
    const ah = anim.height || null;
    const aspect = (aw && ah) ? sizeToAspect(aw, ah) : '16:9';

    console.log(`[动效] 生成 ${question.id}/${anim.name} (${duration}s, ${aw || '?'}x${ah || '?'}) ...`);
    console.log(`[动效] 描述: ${anim.description}`);

    let videoResult;
    let refUrl = null;

    if (anim.sourceImageName) {
      const imgPath = join(qDir, `${anim.sourceImageName}.png`);
      if (existsSync(imgPath)) {
        const imgBuf = readFileSync(imgPath);
        refUrl = `data:image/png;base64,${imgBuf.toString('base64')}`;
        console.log(`[动效]   首帧来源: ${anim.sourceImageName} (base64, ${Math.round(imgBuf.length/1024)}KB)`);
      } else {
        console.warn(`[动效]   首帧图片未找到: ${imgPath}，降级为文生视频`);
      }
    } else if (anim.referenceUrl) {
      refUrl = anim.referenceUrl;
      if (refUrl.startsWith('/')) {
        try {
          let rel = refUrl.slice(1);
          if (rel.startsWith('workspace-assets/')) rel = 'data/' + rel;
          else if (rel.startsWith('prd-assets/')) rel = 'data/' + rel;
          const localPath = join(qDir, '..', '..', '..', rel);
          if (existsSync(localPath)) {
            const imgBuf = readFileSync(localPath);
            refUrl = `data:image/png;base64,${imgBuf.toString('base64')}`;
            console.log(`[动效]   参考帧已转为 base64`);
          } else {
            console.warn(`[动效]   参考帧文件不存在: ${localPath}，降级为文生视频`);
            refUrl = null;
          }
        } catch (readErr) {
          console.warn(`[动效]   参考帧读取失败: ${readErr.message}，降级为文生视频`);
          refUrl = null;
        }
      }
      if (refUrl) console.log(`[动效]   使用参考帧`);
    }

    if (refUrl) {
      videoResult = await seedanceImageToVideo(anim.description, [refUrl], {
        aspectRatio: aspect, duration, resolution: '720p',
      });
    } else {
      videoResult = await seedanceTextToVideo(anim.description, {
        aspectRatio: aspect, duration, resolution: '720p',
      });
    }

    console.log(`[动效] 视频生成完成，下载中 ...`);
    const videoBuffer = await downloadFile(videoResult.url);
    writeFileSync(tmpVideo, videoBuffer);

    const borderRadius = anim.borderRadius || 0;
    const padding = anim.padding || null;
    const finalW = padding ? padding.totalWidth : (aw || 360);
    const animFps = anim.fps || 10;
    const animMaxColors = anim.maxColors ?? 256;
    const animDither = anim.dither || 'none';
    console.log(`[动效] 转换 APNG (${aw || 360}x${ah || 'auto'}, r=${borderRadius}, ${animFps}fps, ${animMaxColors > 0 ? animMaxColors + '色' : '不压缩'}${padding ? `, pad=${padding.leftPad}+${padding.rightPad}→${padding.totalWidth}` : ''}) ...`);
    await videoToApng(tmpVideo, outPath, aw, ah, { fps: animFps, borderRadius, padding, maxColors: animMaxColors, dither: animDither, plays: anim.plays ?? 0 });

    try { unlinkSync(tmpVideo); } catch {}

    console.log(`[动效] 完成 ${question.id}/${anim.name}.png`);
    return {
      questionId: question.id, name: anim.name,
      description: anim.description, duration,
      size: (aw && ah) ? `${finalW}x${ah}` : null,
      path: outPath, status: 'done',
    };
  } catch (err) {
    console.error(`[动效] 失败 ${question.id}/${anim.name}:`, err.message);
    try { unlinkSync(tmpVideo); } catch {}
    return {
      questionId: question.id, name: anim.name,
      description: anim.description, status: 'failed', error: err.message,
    };
  }
}

export { videoToApng };

export async function generateAnimations(analysisResult, taskDir) {
  const questions = analysisResult.questions || analysisResult.epics?.flatMap(e => e.questions) || [];
  const taskId = taskDir.split(/[\\/]/).pop();
  const tasks = [];

  for (const question of questions) {
    const animations = question.assets?.animations || [];
    if (animations.length === 0) continue;
    const qDir = join(taskDir, question.id.replace(/\./g, '-'));
    mkdirSync(qDir, { recursive: true });
    for (const anim of animations) {
      tasks.push(() => processOneAnimation(question, anim, qDir, taskId));
    }
  }

  console.log(`[动效] 共 ${tasks.length} 个动效，并发数 ${ANIM_CONCURRENCY}`);
  return runWithConcurrency(tasks, ANIM_CONCURRENCY);
}
