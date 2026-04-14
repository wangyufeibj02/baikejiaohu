import { join } from 'path';
import { mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
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

async function videoToApng(videoPath, outputPath, w, h, fps = 15) {
  const scaleFilter = (w && h) ? `fps=${fps},scale=${w}:${h}:flags=lanczos` : `fps=${fps},scale=360:-1:flags=lanczos`;
  await execFileAsync('ffmpeg', [
    '-y', '-i', videoPath,
    '-vf', scaleFilter,
    '-plays', '0',
    outputPath,
  ], { timeout: 120_000 });
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
        const aw = anim.width || null;
        const ah = anim.height || null;
        const aspect = (aw && ah) ? sizeToAspect(aw, ah) : '16:9';

        console.log(`[动效] 生成 ${question.id}/${anim.name} (${duration}s, ${aw || '?'}x${ah || '?'}) ...`);
        console.log(`[动效] 描述: ${anim.description}`);

        let videoResult;
        if (anim.referenceUrl) {
          let refUrl = anim.referenceUrl;
          if (refUrl.startsWith('/')) refUrl = `http://localhost:3200${refUrl}`;
          console.log(`[动效]   使用参考帧: ${refUrl}`);
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

        console.log(`[动效] 转换 APNG (${aw || 360}x${ah || 'auto'}) ...`);
        await videoToApng(tmpVideo, outPath, aw, ah);

        try { unlinkSync(tmpVideo); } catch {}

        results.push({
          questionId: question.id, name: anim.name,
          description: anim.description, duration,
          size: (aw && ah) ? `${aw}x${ah}` : null,
          path: outPath, status: 'done',
        });
        console.log(`[动效] 完成 ${question.id}/${anim.name}.apng`);
      } catch (err) {
        console.error(`[动效] 失败 ${question.id}/${anim.name}:`, err.message);
        try { unlinkSync(tmpVideo); } catch {}
        results.push({
          questionId: question.id, name: anim.name,
          description: anim.description, status: 'failed', error: err.message,
        });
      }
    }
  }

  return results;
}
