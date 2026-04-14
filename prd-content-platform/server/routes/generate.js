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

function diagnoseSuggestion(error, type) {
  if (!error) return '请重试，如仍失败请联系技术支持';
  const e = error.toLowerCase();
  if (e.includes('sensitive') || e.includes('内容审核'))
    return '描述文字触发了内容审核，建议修改为更中性的表述。例如将"交配"改为"繁殖行为"';
  if (e.includes('timeout') || e.includes('超时'))
    return '生成超时，可能是服务器繁忙，建议稍后重试';
  if (e.includes('rate') || e.includes('limit') || e.includes('429'))
    return '请求频率超限，建议等待 1-2 分钟后重试';
  if (e.includes('api') && e.includes('key'))
    return 'API 密钥异常，请检查 OPENAI_API_KEY 环境变量配置';
  if (e.includes('网络') || e.includes('network') || e.includes('econnrefused'))
    return '网络连接失败，请检查网络状态或魔搭平台是否可用';
  if (e.includes('ffmpeg'))
    return '动效转换需要 ffmpeg，请确认已安装：https://ffmpeg.org/download.html';
  if (type === '图片')
    return '建议检查图片描述是否过于模糊或包含不支持的内容，修改后重试';
  if (type === '配音')
    return '建议检查配音文本是否过长或包含特殊字符，简化后重试';
  if (type === '动效')
    return '建议简化动效描述或缩短时长，然后重试';
  return '请重试，如仍失败请联系技术支持';
}

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

    console.log('[生成] 1/4 图片+配音（并行）...');
    const [imageResults, audioResults] = await Promise.all([
      generateImages(analysisResult, taskDir),
      generateAudios(analysisResult, taskDir),
    ]);

    console.log('[生成] 2/4 动效视频 → APNG ...');
    const animResults = await generateAnimations(analysisResult, taskDir);

    console.log('[生成] 3/4 配置文件 ...');
    const configResults = await generateConfigs(analysisResult, taskDir);

    console.log('[生成] 4/4 元数据清单 ...');
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
    const failedItems = (arr, type) => arr
      .filter(r => r.status === 'failed')
      .map(r => ({ type, questionId: r.questionId, name: r.name, error: r.error || '未知错误', suggestion: diagnoseSuggestion(r.error, type) }));

    console.log(`[生成] 完成! 图片=${done(imageResults)}/${imageResults.length} 音频=${done(audioResults)}/${audioResults.length} 动效=${done(animResults)}/${animResults.length} 配置=${done(configResults)}/${configResults.length}`);

    const failures = [
      ...failedItems(imageResults, '图片'),
      ...failedItems(audioResults, '配音'),
      ...failedItems(animResults, '动效'),
    ];

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
        failures,
      },
    });
  } catch (err) {
    console.error('[生成] 顶层错误:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
