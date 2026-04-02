import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import sharp from 'sharp';
import { doubaoTextToImage, downloadFile } from './modaiClient.js';

export async function generateImages(analysisResult, taskDir) {
  const results = [];
  const questions = analysisResult.questions || analysisResult.epics?.flatMap(e => e.questions) || [];

  for (const question of questions) {
    const qDir = join(taskDir, question.id.replace(/\./g, '-'));
    mkdirSync(qDir, { recursive: true });

    const images = question.assets?.images || question.imagePrompts || [];

    for (const img of images) {
      try {
        const prompt = img.prompt;
        if (!prompt) continue;

        console.log(`[图片] 生成 ${question.id}/${img.name} ...`);

        const [w, h] = (img.size || '360x360').split('x').map(Number);
        const imageUrl = await doubaoTextToImage(prompt, w, h);
        const imageBuffer = await downloadFile(imageUrl);

        const processed = await sharp(imageBuffer)
          .resize(w, h, { fit: 'cover' })
          .png()
          .toBuffer();

        const outPath = join(qDir, `${img.name}.png`);
        writeFileSync(outPath, processed);

        results.push({
          questionId: question.id,
          name: img.name,
          path: outPath,
          size: `${w}x${h}`,
          status: 'done',
        });
      } catch (err) {
        console.error(`[图片] 生成失败 ${question.id}/${img.name}:`, err.message);
        results.push({
          questionId: question.id,
          name: img.name,
          status: 'failed',
          error: err.message,
        });
      }
    }
  }

  return results;
}
