import { Router } from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { parsePdf } from '../services/pdfParser.js';
import { extractPdfPages } from '../services/pdfImageExtractor.js';
import { analyzePrd } from '../services/aiAnalyzer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const UPLOADS = join(ROOT, 'uploads');

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

export default router;
