import { Router } from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { generateImages } from '../services/imageGenerator.js';
import { generateAudios } from '../services/audioGenerator.js';
import { generateAnimations } from '../services/animationGenerator.js';
import { generateConfigs } from '../services/configGenerator.js';
import { generateMetadata } from '../services/metadataGenerator.js';
import { packOutput } from '../services/packager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '..', '..', 'output');

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { analysisResult } = req.body;
    if (!analysisResult) {
      return res.status(400).json({ success: false, error: '缺少 analysisResult' });
    }

    const taskId = `task_${Date.now()}`;
    const taskDir = join(OUTPUT, taskId);
    mkdirSync(taskDir, { recursive: true });

    console.log(`[生成] 任务 ${taskId} 开始`);

    console.log('[生成] 1/5 图片素材 ...');
    const imageResults = await generateImages(analysisResult, taskDir);

    console.log('[生成] 2/5 配音音频 ...');
    const audioResults = await generateAudios(analysisResult, taskDir);

    console.log('[生成] 3/5 动效视频 → APNG ...');
    const animResults = await generateAnimations(analysisResult, taskDir);

    console.log('[生成] 4/5 配置文件 ...');
    const configResults = await generateConfigs(analysisResult, taskDir);

    console.log('[生成] 5/5 元数据清单 ...');
    const metadataResults = await generateMetadata(analysisResult, taskDir, {
      images: imageResults,
      audios: audioResults,
      animations: animResults,
      configs: configResults,
    });

    console.log('[生成] 打包 ZIP ...');
    const zipPath = await packOutput(taskDir, taskId);

    const done = (arr) => arr.filter(r => r.status === 'done').length;
    const failed = (arr) => arr.filter(r => r.status === 'failed').length;

    console.log(`[生成] 完成! 图片=${done(imageResults)}/${imageResults.length} 音频=${done(audioResults)}/${audioResults.length} 动效=${done(animResults)}/${animResults.length} 配置=${done(configResults)}/${configResults.length}`);

    res.json({
      success: true,
      data: {
        taskId,
        downloadUrl: `/api/download/${taskId}`,
        summary: {
          images: imageResults.length,
          imagesDone: done(imageResults),
          imagesFailed: failed(imageResults),
          audios: audioResults.length,
          audiosDone: done(audioResults),
          audiosFailed: failed(audioResults),
          animations: animResults.length,
          animationsDone: done(animResults),
          animationsFailed: failed(animResults),
          configs: configResults.length,
        },
      },
    });
  } catch (err) {
    console.error('[生成] 顶层错误:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
