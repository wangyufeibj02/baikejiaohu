import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { doubaoTTS, downloadFile } from './modaiClient.js';

const DEFAULT_VOICE = 'zh_female_vv_uranus_bigtts';

export async function generateAudios(analysisResult, taskDir) {
  const results = [];
  const questions = analysisResult.questions || analysisResult.epics?.flatMap(e => e.questions) || [];

  for (const question of questions) {
    const qDir = join(taskDir, question.id.replace(/\./g, '-'));
    mkdirSync(qDir, { recursive: true });

    const audios = question.assets?.audios || question.audioAssets || [];

    for (const audio of audios) {
      try {
        if (!audio.text) continue;

        console.log(`[音频] 生成 ${question.id}/${audio.name} "${audio.text}" ...`);

        const audioUrl = await doubaoTTS(audio.text, DEFAULT_VOICE);
        const audioBuffer = await downloadFile(audioUrl);

        const outPath = join(qDir, `${audio.name}.mp3`);
        writeFileSync(outPath, audioBuffer);

        results.push({
          questionId: question.id,
          name: audio.name,
          text: audio.text,
          path: outPath,
          status: 'done',
        });
      } catch (err) {
        console.error(`[音频] 生成失败 ${question.id}/${audio.name}:`, err.message);
        results.push({
          questionId: question.id,
          name: audio.name,
          text: audio.text,
          status: 'failed',
          error: err.message,
        });
      }
    }
  }

  return results;
}
