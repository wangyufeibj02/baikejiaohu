import { readFileSync } from 'fs';
import { extname } from 'path';
import sharp from 'sharp';

const BASE = 'https://conan-modai-studio.zhenguanyu.com/conan-modai-studio/api/web/ai';
const API_KEY = process.env.OPENAI_API_KEY;

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
  };
}

const ANALYSIS_PROMPT = `你是一个交互题 PRD 分析专家。你的核心任务是：从 PRD 文档中提取所有需要"实际生产"的素材需求，输出结构化 JSON。

核心原则：PRD 里写了什么，就产出什么。每一条需求都要对应一个实际文件。

请严格按照以下 JSON 格式输出，不要输出任何其他文字、不要用 markdown 代码块包裹：

{
  "productLine": "产品线名称，如果PRD没写则填 未指定",
  "episode": "集数，如 E1",
  "backgroundStyle": "美术风格，如 实拍 或 2d插画",
  "questions": [
    {
      "id": "E1-1-1",
      "type": "singleChoice | multiChoice | dragDrop | lineMatch | hotspot",
      "stem": "题干文字（如果有）",
      "correctAnswers": ["A"],
      "correctDescription": "正确解析（如果有）",

      "assets": {
        "images": [
          {
            "name": "option1",
            "prompt": "AI绘图提示词",
            "description": "PRD中对这张图的原始描述"
          },
          {
            "name": "option2",
            "prompt": "AI绘图提示词",
            "description": "PRD中对这张图的原始描述"
          },
          {
            "name": "bg",
            "prompt": "背景图绘图提示词",
            "description": "背景图"
          }
        ],
        "audios": [
          {
            "name": "stem_audio",
            "text": "需要TTS朗读的文字",
            "source": "PRD中哪个字段提取的，如 配音 或 题干"
          }
        ],
        "animations": [
          {
            "name": "animation",
            "prompt": "AI视频生成提示词，基于PRD中动效描述扩写",
            "description": "PRD中对动效的原始描述",
            "duration": 4
          }
        ]
      }
    }
  ]
}

=== 提取规则 ===

1. 图片(images)提取：
   - PRD中标注了【美术素材】的选项 → 生成 option1/option2/option3...
   - PRD中有"题干图"或"题干：实拍图/2d"描述 → 生成 stem
   - 每道题自动补一张背景图 → 生成 bg
   - name 命名：option1/option2/option3(选项图), stem(题干图), bg(背景图), bg_right(正确反馈背景)
   - prompt 生成：结合美术风格 + 选项文字/描述 → 详细的AI绘图提示词
   - 如果美术风格是"实拍"，prompt以"自然纪录片风格，真实高清照片，"开头
   - 如果美术风格是"2d"，prompt以"儿童教育风格，卡通2D插画，色彩明快，"开头

2. 配音(audios)提取：
   - PRD中有"配音：xxx"字段 → 提取文字，name 为 stem_audio
   - PRD中有"正确解析"或"正确解析配音" → 提取文字，name 为 correct_audio
   - PRD中有"错误提示配音" → 提取文字，name 为 wrong_audio
   - PRD中选项媒体类型包含"语音" → 为每个选项生成配音，name 为 option1_audio/option2_audio...
   - 如果PRD没有明确写配音内容，但有题干文字，也为题干生成配音

3. 动效(animations)提取：
   - PRD中有"动效：xxx"描述 → 提取并扩写为详细的AI视频生成提示词
   - PRD中有"正确反馈：题干动画/选项动画" → 提取动效描述
   - name 命名：animation(通用), start_animation(开场), correct_animation(正确反馈), wrong_animation(错误反馈)
   - duration 默认4秒，PRD有指定则按指定
   - prompt 要求：在PRD原始描述基础上，补充镜头运动、光线、环境细节，使其适合AI视频生成

4. 题型判断：
   - "单选题" → singleChoice
   - "多选题" → multiChoice
   - "拖拽题" → dragDrop
   - "连线题" → lineMatch
   - "点选题" → hotspot

5. 缺失信息处理：
   - 正确答案没写 → correctAnswers 设为空数组 []
   - 正确解析没写 → correctDescription 设为 null
   - 没有动效 → animations 设为空数组 []
   - 没有配音 → audios 仍然从题干文字生成一条 stem_audio`;

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) text = fenced[1];
  text = text.trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    text = text.slice(start, end + 1);
  }
  return JSON.parse(text);
}

/**
 * 将多张图片拼接为一张竖排长图 (用于发给 AI 一次分析所有页面)
 */
async function stitchImages(imagePaths) {
  if (imagePaths.length === 1) return readFileSync(imagePaths[0]);

  const buffers = imagePaths.map(p => readFileSync(p));
  const metas = await Promise.all(buffers.map(b => sharp(b).metadata()));

  const maxWidth = Math.max(...metas.map(m => m.width));
  const totalHeight = metas.reduce((sum, m) => sum + m.height, 0);

  const composites = [];
  let yOffset = 0;
  for (let i = 0; i < buffers.length; i++) {
    composites.push({ input: buffers[i], left: 0, top: yOffset });
    yOffset += metas[i].height;
  }

  return sharp({
    create: {
      width: maxWidth,
      height: totalHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .jpeg({ quality: 85 })
    .toBuffer();
}

/**
 * 上传图片到 GCS 并返回 fileUri
 */
async function uploadToGCS(imageBuffer, fileName = 'prd_page.jpg') {
  const uploadRes = await fetch(`${BASE}/gemini/upload-media`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      fileName,
      mimeType: 'image/jpeg',
      fileSize: imageBuffer.length,
    }),
  });
  const uploadData = await uploadRes.json();
  if (!uploadData.success) throw new Error(`上传初始化失败: ${uploadData.error}`);

  const putRes = await fetch(uploadData.data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: imageBuffer,
  });
  if (!putRes.ok) throw new Error(`GCS 上传失败: ${putRes.status}`);

  return uploadData.data.fileUri;
}

/**
 * 分析 PRD 文档
 * @param {string} text 提取的 PDF 文本
 * @param {string[]} imagePaths PDF 页面渲染图路径
 */
export async function analyzePrd(text, imagePaths = []) {
  const model = process.env.OPENAI_MODEL || 'gemini-2.5-flash';

  const prompt = `${ANALYSIS_PROMPT}

以下是 PRD 文档的文本内容（从 PDF 提取）：
---
${text}
---

请结合上方文本和图片中的视觉内容（包括截图中的表格、插图描述、UI 截图等），输出完整的结构化 JSON。`;

  if (imagePaths.length > 0) {
    console.log(`[AI解析] 拼接 ${imagePaths.length} 张页面图片...`);
    const stitchedImage = await stitchImages(imagePaths);
    console.log(`[AI解析] 拼接完成 (${Math.round(stitchedImage.length / 1024)}KB), 上传到 GCS...`);

    const fileUri = await uploadToGCS(stitchedImage);
    console.log(`[AI解析] 上传完成: ${fileUri}`);
    console.log(`[AI解析] 调用 analyze-media, 模型: ${model}...`);

    const analyzeRes = await fetch(`${BASE}/gemini/analyze-media`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        fileUri,
        mimeType: 'image/jpeg',
        prompt,
        model,
        stream: false,
      }),
    });
    const analyzeData = await analyzeRes.json();
    if (!analyzeData.success) throw new Error(`AI 分析失败: ${analyzeData.error}`);

    console.log(`[AI解析] 分析完成, tokens: ${JSON.stringify(analyzeData.data.usage)}`);
    console.log(`[AI解析] 原始响应(前500字): ${analyzeData.data.analysis.substring(0, 500)}`);

    return extractJson(analyzeData.data.analysis);
  }

  throw new Error('需要至少一张图片（PDF 页面）进行分析');
}
