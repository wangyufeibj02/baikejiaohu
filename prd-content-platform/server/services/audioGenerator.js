import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { doubaoTTS, downloadFile } from './modaiClient.js';

const DEFAULT_VOICE = 'zh_female_vv_uranus_bigtts';
const AUDIO_CONCURRENCY = 5;

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

async function processOneAudio(question, audio, qDir) {
  try {
    if (!audio.text) return null;
    console.log(`[音频] 生成 ${question.id}/${audio.name} "${audio.text}" ...`);
    const audioUrl = await doubaoTTS(audio.text, DEFAULT_VOICE);
    const audioBuffer = await downloadFile(audioUrl);
    const outPath = join(qDir, `${audio.name}.mp3`);
    writeFileSync(outPath, audioBuffer);
    return { questionId: question.id, name: audio.name, text: audio.text, path: outPath, status: 'done' };
  } catch (err) {
    console.error(`[音频] 生成失败 ${question.id}/${audio.name}:`, err.message);
    return { questionId: question.id, name: audio.name, text: audio.text, status: 'failed', error: err.message };
  }
}

export async function generateAudios(analysisResult, taskDir) {
  const questions = analysisResult.questions || analysisResult.epics?.flatMap(e => e.questions) || [];
  const tasks = [];

  for (const question of questions) {
    const qDir = join(taskDir, question.id.replace(/\./g, '-'));
    mkdirSync(qDir, { recursive: true });
    const audios = question.assets?.audios || question.audioAssets || [];
    for (const audio of audios) {
      tasks.push(() => processOneAudio(question, audio, qDir));
    }
  }

  console.log(`[音频] 共 ${tasks.length} 条音频，并发数 ${AUDIO_CONCURRENCY}`);
  const results = await runWithConcurrency(tasks, AUDIO_CONCURRENCY);
  return results.filter(Boolean);
}
