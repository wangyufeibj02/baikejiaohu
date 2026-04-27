import { Router } from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { parsePdf } from '../services/pdfParser.js';
import { extractPdfPages } from '../services/pdfImageExtractor.js';
import { analyzePrd } from '../services/aiAnalyzer.js';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const UPLOADS = join(ROOT, 'uploads');

const AI_BASE = 'https://conan-modai-studio.zhenguanyu.com/conan-modai-studio/api/web/ai';
function aiHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` };
}

const router = Router();

/**
 * Step 2: 提取 PDF 文本 + 渲染页面为图片
 */
router.post('/extract', async (req, res) => {
  try {
    const { pdfs } = req.body;
    if (!pdfs || pdfs.length === 0) {
      return res.status(400).json({ success: false, error: '缺少 PDF 文件信息' });
    }

    let combinedText = '';
    const pageImages = [];

    for (const pdf of pdfs) {
      const pdfPath = join(UPLOADS, pdf.savedName);
      if (!existsSync(pdfPath)) {
        return res.status(400).json({ success: false, error: `文件不存在: ${pdf.originalName}` });
      }

      const text = await parsePdf(pdfPath);
      combinedText += `\n=== ${pdf.originalName} ===\n${text}\n`;

      const pdfId = pdf.savedName.replace(/\.[^.]+$/, '');
      const pagesDir = join(UPLOADS, `${pdfId}_pages`);

      try {
        const pages = await extractPdfPages(pdfPath, pagesDir, 1.5);
        for (const pagePath of pages) {
          const fileName = pagePath.split(/[\\/]/).pop();
          pageImages.push({
            originalName: `${pdf.originalName} - ${fileName}`,
            savedName: `${pdfId}_pages/${fileName}`,
            path: pagePath,
          });
        }
      } catch (renderErr) {
        console.error(`[提取] PDF页面渲染失败:`, renderErr.message);
      }
    }

    res.json({
      success: true,
      data: {
        text: combinedText.trim(),
        pageImages,
        pageCount: pageImages.length,
      },
    });
  } catch (err) {
    console.error('[提取] 错误:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Step 3: AI 解析 (文本 + 图片 → 结构化 JSON)
 */
router.post('/parse', async (req, res) => {
  try {
    const { text, images } = req.body;
    if (!text) return res.status(400).json({ success: false, error: '缺少 text' });

    const imagePaths = (images || [])
      .map(img => join(UPLOADS, img.savedName))
      .filter(p => existsSync(p));

    console.log(`[解析] 文本长度: ${text.length}, 图片数: ${imagePaths.length}`);

    const result = await analyzePrd(text, imagePaths);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[解析] 错误:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 通用图片分析 — 用于风格训练等场景
 * POST { prompt, imageUrls: ['/workspace-assets/xxx/yyy.png', ...] }
 */
router.post('/analyze-media', async (req, res) => {
  try {
    const { prompt, imageUrls } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: '缺少 prompt' });
    if (!imageUrls?.length) return res.status(400).json({ success: false, error: '缺少图片' });

    const buffers = [];
    for (const url of imageUrls) {
      let rel = url.startsWith('/') ? url.slice(1) : url;
      if (rel.startsWith('workspace-assets/')) rel = 'data/' + rel;
      const localPath = join(ROOT, rel);
      if (!existsSync(localPath)) { console.log(`[analyze-media] 文件不存在: ${localPath}`); continue; }
      buffers.push(readFileSync(localPath));
    }
    if (buffers.length === 0) return res.status(400).json({ success: false, error: '没有有效的图片文件' });

    const images = [];
    for (const buf of buffers) {
      const resized = await sharp(buf).resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
      images.push(resized);
    }

    const totalH = images.length * 800;
    const composite = [];
    let y = 0;
    const metas = [];
    for (const img of images) {
      const meta = await sharp(img).metadata();
      metas.push(meta);
    }
    const maxW = Math.max(...metas.map(m => m.width || 800));
    let totalHeight = 0;
    for (const m of metas) totalHeight += (m.height || 600);

    const stitched = sharp({ create: { width: maxW, height: totalHeight, channels: 3, background: '#ffffff' } });
    const composites = [];
    let offsetY = 0;
    for (let i = 0; i < images.length; i++) {
      composites.push({ input: images[i], left: 0, top: offsetY });
      offsetY += metas[i].height || 600;
    }
    const stitchedBuf = await stitched.composite(composites).jpeg({ quality: 80 }).toBuffer();

    const uploadRes = await fetch(`${AI_BASE}/gemini/upload-media`, {
      method: 'POST',
      headers: aiHeaders(),
      body: JSON.stringify({ fileName: 'style_ref.jpg', mimeType: 'image/jpeg', fileSize: stitchedBuf.length }),
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.success) throw new Error('上传初始化失败: ' + (uploadData.error || ''));

    await fetch(uploadData.data.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: stitchedBuf,
    });

    const analyzeRes = await fetch(`${AI_BASE}/gemini/analyze-media`, {
      method: 'POST',
      headers: aiHeaders(),
      body: JSON.stringify({
        fileUri: uploadData.data.fileUri,
        mimeType: 'image/jpeg',
        prompt,
        model: 'gemini-2.5-flash',
        stream: false,
      }),
    });
    const analyzeData = await analyzeRes.json();
    if (!analyzeData.success) throw new Error('AI 分析失败: ' + (analyzeData.error || ''));

    res.json({ success: true, data: { description: analyzeData.data.analysis } });
  } catch (err) {
    console.error('[analyze-media] 错误:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
