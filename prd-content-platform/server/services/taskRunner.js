import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { generateImages } from './imageGenerator.js';
import { generateAnimations } from './animationGenerator.js';
import { generateConfigs } from './configGenerator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TASKS_DIR = join(__dirname, '..', '..', 'data', 'tasks');
const OUTPUT_DIR = join(__dirname, '..', '..', 'output');
mkdirSync(TASKS_DIR, { recursive: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

const queue = [];
let running = false;

function updateTask(id, patch) {
  const p = join(TASKS_DIR, `${id}.json`);
  if (!existsSync(p)) return;
  const task = JSON.parse(readFileSync(p, 'utf-8'));
  Object.assign(task, patch);
  writeFileSync(p, JSON.stringify(task, null, 2), 'utf-8');
}

export function enqueue(task) {
  const p = join(TASKS_DIR, `${task.id}.json`);
  if (!existsSync(p)) {
    writeFileSync(p, JSON.stringify(task, null, 2), 'utf-8');
  }
  queue.push(task);
  if (!running) processQueue();
}

export function getQueueLength() {
  return queue.length;
}

export function isRunning() {
  return running;
}

async function processQueue() {
  if (running) return;
  running = true;

  while (queue.length > 0) {
    const task = queue.shift();
    const taskId = task.id;

    try {
      updateTask(taskId, { status: 'running', startedAt: Date.now() });
      console.log(`[taskRunner] 开始处理 ${taskId}`);

      const taskDir = join(OUTPUT_DIR, taskId);
      mkdirSync(taskDir, { recursive: true });

      const analysisResult = task.analysisResult;

      const imageResults = await generateImages(analysisResult, taskDir);
      updateTask(taskId, { progress: 'images_done' });

      const configResults = await generateConfigs(analysisResult, taskDir);
      updateTask(taskId, { progress: 'configs_done' });

      const animResults = await generateAnimations(analysisResult, taskDir);
      updateTask(taskId, { progress: 'animations_done' });

      const allResults = [...imageResults, ...configResults, ...animResults];
      const doneCount = allResults.filter(r => r.status === 'done').length;
      const failedCount = allResults.filter(r => r.status === 'failed').length;
      const skippedCount = allResults.filter(r => r.status === 'skipped').length;

      const failures = allResults
        .filter(r => r.status === 'failed')
        .map(r => ({ questionId: r.questionId, name: r.name, error: r.error }));

      const finalStatus = failedCount > 0 ? (doneCount > 0 ? 'partial' : 'failed') : 'done';

      updateTask(taskId, {
        status: finalStatus,
        finishedAt: Date.now(),
        summary: { total: allResults.length, done: doneCount, failed: failedCount, skipped: skippedCount },
        failures,
        results: { images: imageResults, configs: configResults, animations: animResults },
      });

      console.log(`[taskRunner] 完成 ${taskId}: ${finalStatus} (done=${doneCount}, failed=${failedCount})`);
    } catch (err) {
      console.error(`[taskRunner] 任务失败 ${taskId}:`, err);
      updateTask(taskId, {
        status: 'failed',
        finishedAt: Date.now(),
        error: err.message,
      });
    }
  }

  running = false;
}
