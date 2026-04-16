import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { doubaoTTS, minimaxTTS, geminiTTS, azureTTS, ttsHubTTS, downloadFile } from './modaiClient.js';

const DEFAULT_ENGINE = 'ttshub';
const DEFAULT_VOICE = 'xiaoyuan';
const AUDIO_CONCURRENCY = 5;

async function callTTS(text, engine, voiceId) {
  switch (engine) {
    case 'ttshub':
      return ttsHubTTS(text, voiceId || 'xiaoyuan');
    case 'minimax':
      return minimaxTTS(text, voiceId || 'male-qn-qingse');
    case 'gemini':
      return geminiTTS(text, voiceId || 'Kore');
    case 'azure':
      return azureTTS(text, voiceId || 'zh-CN-XiaoxiaoNeural');
    case 'doubao':
    default:
      return doubaoTTS(text, voiceId || 'zh_female_vv_uranus_bigtts');
  }
}

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

async function processOneAudio(question, audio, qDir, engine, voiceId) {
  try {
    if (!audio.text) return null;
    console.log(`[音频] 生成 ${question.id}/${audio.name} [${engine}/${voiceId}] "${audio.text}" ...`);
    const result = await callTTS(audio.text, engine, voiceId);
    const audioBuffer = Buffer.isBuffer(result) ? result : await downloadFile(result);
    const outPath = join(qDir, `${audio.name}.mp3`);
    writeFileSync(outPath, audioBuffer);
    return { questionId: question.id, name: audio.name, text: audio.text, engine, voiceId, path: outPath, status: 'done' };
  } catch (err) {
    console.error(`[音频] 生成失败 ${question.id}/${audio.name} [${engine}]:`, err.message);
    return { questionId: question.id, name: audio.name, text: audio.text, status: 'failed', error: err.message };
  }
}

export async function generateAudios(analysisResult, taskDir) {
  const engine = analysisResult.ttsEngine || DEFAULT_ENGINE;
  const voiceId = analysisResult.ttsVoiceId || DEFAULT_VOICE;
  const questions = analysisResult.questions || analysisResult.epics?.flatMap(e => e.questions) || [];
  const tasks = [];

  for (const question of questions) {
    const qDir = join(taskDir, question.id.replace(/\./g, '-'));
    mkdirSync(qDir, { recursive: true });
    const audios = question.assets?.audios || question.audioAssets || [];
    for (const audio of audios) {
      tasks.push(() => processOneAudio(question, audio, qDir, engine, voiceId));
    }
  }

  console.log(`[音频] 共 ${tasks.length} 条音频，引擎 ${engine}，音色 ${voiceId}，并发数 ${AUDIO_CONCURRENCY}`);
  const results = await runWithConcurrency(tasks, AUDIO_CONCURRENCY);
  return results.filter(Boolean);
}
