import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, statSync } from 'fs';
import { generateImages } from './imageGenerator.js';
import { generateAudios } from './audioGenerator.js';
import { generateAnimations } from './animationGenerator.js';
import { generateConfigs } from './configGenerator.js';
import { generateMetadata } from './metadataGenerator.js';
import { packOutput } from './packager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TASK_DIR = join(__dirname, '..', '..', 'data', 'tasks');
const OUTPUT_DIR = join(__dirname, '..', '..', 'output');
const PRD_DIR = join(__dirname, '..', '..', 'data', 'prd-projects');
mkdirSync(TASK_DIR, { recursive: true });

function updatePrdStatus(prdId, status) {
  try {
    const fp = join(PRD_DIR, `${prdId}.json`);
    if (!existsSync(fp)) return;
    const prd = JSON.parse(readFileSync(fp, 'utf-8'));
    prd.status = status;
    prd.updatedAt = Date.now();
    writeFileSync(fp, JSON.stringify(prd, null, 2));
  } catch (e) {
    console.error(`[任务] 更新 PRD 状态失败: ${e.message}`);
  }
}

const EXPIRE_DAYS = 30;

function diagnoseSuggestion(error, type) {
  if (!error) return '请重试，如仍失败请联系技术支持';
  const e = error.toLowerCase();
  if (e.includes('sensitive') || e.includes('内容审核'))
    return '描述文字触发了内容审核，建议修改为更中性的表述';
  if (e.includes('timeout') || e.includes('超时'))
    return '生成超时，建议稍后重试';
  if (e.includes('rate') || e.includes('limit') || e.includes('429'))
    return '请求频率超限，建议等待 1-2 分钟后重试';
  if (e.includes('ffmpeg'))
    return '动效转换需要 ffmpeg';
  if (type === '图片') return '建议检查图片描述并修改后重试';
  if (type === '配音') return '建议检查配音文本后重试';
  if (type === '动效') return '建议简化动效描述后重试';
  return '请重试，如仍失败请联系技术支持';
}

function taskPath(id) { return join(TASK_DIR, `${id}.json`); }

function saveTask(task) {
  writeFileSync(taskPath(task.id), JSON.stringify(task, null, 2), 'utf-8');
}

export function loadTask(id) {
  const fp = taskPath(id);
  return existsSync(fp) ? JSON.parse(readFileSync(fp, 'utf-8')) : null;
}

export function listTasks() {
  try {
    return readdirSync(TASK_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(readFileSync(join(TASK_DIR, f), 'utf-8')))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch { return []; }
}

export function deleteTask(id) {
  const fp = taskPath(id);
  if (existsSync(fp)) unlinkSync(fp);
}

export function createTask(prdId, prdName, analysisResult) {
  const questions = analysisResult.questions || [];
  let totalAssets = 0;
  for (const q of questions) {
    totalAssets += (q.assets?.images?.length || 0) + (q.assets?.audios?.length || 0) + (q.assets?.animations?.length || 0) + (q.assets?.controlWidgets?.length || 0);
  }

  const task = {
    id: `task_${Date.now()}`,
    prdId,
    prdName: prdName || prdId,
    status: 'queued',
    progress: { total: totalAssets, done: 0, failed: 0, current: '排队中...' },
    summary: null,
    failures: [],
    downloadUrl: null,
    analysisResult,
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
  };
  saveTask(task);
  enqueue(task.id);
  return task;
}

const queue = [];
let running = false;

function enqueue(taskId) {
  queue.push(taskId);
  processQueue();
}

async function processQueue() {
  if (running || queue.length === 0) return;
  running = true;
  const taskId = queue.shift();
  try {
    await runTask(taskId);
  } catch (err) {
    console.error(`[任务] 顶层错误 ${taskId}:`, err.message);
    const task = loadTask(taskId);
    if (task) {
      task.status = 'failed';
      task.progress.current = `错误: ${err.message}`;
      task.finishedAt = Date.now();
      saveTask(task);
      updatePrdStatus(task.prdId, 'ready');
    }
  }
  running = false;
  processQueue();
}

async function runTask(taskId) {
  const task = loadTask(taskId);
  if (!task || task.status === 'cancelled') return;

  task.status = 'running';
  task.startedAt = Date.now();
  task.progress.current = '准备中...';
  saveTask(task);
  updatePrdStatus(task.prdId, 'producing');

  const taskDir = join(OUTPUT_DIR, taskId);
  mkdirSync(taskDir, { recursive: true });

  const ar = task.analysisResult;
  console.log(`[任务] ${taskId} 开始 — ${task.prdName} (${(ar.questions || []).length} 题)`);

  task.progress.current = '1/4 生成图片+配音...';
  saveTask(task);
  const [imageResults, audioResults] = await Promise.all([
    generateImages(ar, taskDir),
    generateAudios(ar, taskDir),
  ]);

  task.progress.done = imageResults.filter(r => r.status === 'done').length
                     + audioResults.filter(r => r.status === 'done').length;
  task.progress.failed = imageResults.filter(r => r.status === 'failed').length
                       + audioResults.filter(r => r.status === 'failed').length;
  task.progress.current = '2/4 生成动效...';
  saveTask(task);
  const animResults = await generateAnimations(ar, taskDir);

  task.progress.done += animResults.filter(r => r.status === 'done').length;
  task.progress.failed += animResults.filter(r => r.status === 'failed').length;
  task.progress.current = '3/4 生成配置...';
  saveTask(task);
  const configResults = await generateConfigs(ar, taskDir);

  task.progress.current = '4/4 生成元数据...';
  saveTask(task);
  await generateMetadata(ar, taskDir, {
    images: imageResults, audios: audioResults, animations: animResults, configs: configResults,
  });

  task.progress.current = '打包中...';
  saveTask(task);
  await packOutput(taskDir, taskId);

  const done = (arr) => arr.filter(r => r.status === 'done').length;
  const failed = (arr) => arr.filter(r => r.status === 'failed').length;
  const failedItems = (arr, type) => arr
    .filter(r => r.status === 'failed')
    .map(r => ({ type, questionId: r.questionId, name: r.name, error: r.error || '未知错误', suggestion: diagnoseSuggestion(r.error, type) }));

  task.summary = {
    images: imageResults.length, imagesDone: done(imageResults), imagesFailed: failed(imageResults),
    audios: audioResults.length, audiosDone: done(audioResults), audiosFailed: failed(audioResults),
    animations: animResults.length, animationsDone: done(animResults), animationsFailed: failed(animResults),
    configs: configResults.length,
  };
  task.failures = [
    ...failedItems(imageResults, '图片'),
    ...failedItems(audioResults, '配音'),
    ...failedItems(animResults, '动效'),
  ];
  task.downloadUrl = `/api/download/${taskId}`;
  task.status = task.failures.length > 0 ? 'partial' : 'done';
  task.finishedAt = Date.now();
  task.progress.current = '完成';
  delete task.analysisResult;
  saveTask(task);
  updatePrdStatus(task.prdId, task.status === 'done' ? 'done' : 'ready');

  console.log(`[任务] ${taskId} 完成! 图片=${done(imageResults)}/${imageResults.length} 音频=${done(audioResults)}/${audioResults.length} 动效=${done(animResults)}/${animResults.length}`);
}

export function retryTask(taskId, analysisResult) {
  const task = loadTask(taskId);
  if (!task) return null;
  task.status = 'queued';
  task.progress = { total: task.progress.total, done: 0, failed: 0, current: '排队中（重试）...' };
  task.summary = null;
  task.failures = [];
  task.downloadUrl = null;
  task.finishedAt = null;
  if (analysisResult) task.analysisResult = analysisResult;
  saveTask(task);
  enqueue(taskId);
  return task;
}

export function getQueueInfo() {
  return { queueLength: queue.length, running };
}
