/**
 * 将 PDF 每一页渲染为 PNG 图片
 * 使用 pdf-to-img + sharp 压缩
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { pdf } from 'pdf-to-img';
import sharp from 'sharp';

const MAX_WIDTH = 1600;
const JPEG_QUALITY = 85;

/**
 * 渲染 PDF 每页为压缩后的 JPG，保存到 outputDir
 * @param {string} pdfPath PDF 文件路径
 * @param {string} outputDir 输出目录
 * @param {number} scale 渲染缩放(默认 1.5)
 * @returns {Promise<string[]>} 生成的图片文件路径数组
 */
export async function extractPdfPages(pdfPath, outputDir, scale = 1.5) {
  mkdirSync(outputDir, { recursive: true });
  const pageImages = [];

  const document = await pdf(pdfPath, { scale });

  let pageNum = 0;
  for await (const rawImage of document) {
    pageNum++;

    const compressed = await sharp(rawImage)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();

    const outPath = join(outputDir, `page_${String(pageNum).padStart(3, '0')}.jpg`);
    writeFileSync(outPath, compressed);
    pageImages.push(outPath);

    const sizeKB = Math.round(compressed.length / 1024);
    console.log(`[PDF渲染] 第 ${pageNum} 页 → ${outPath} (${sizeKB}KB)`);
  }

  console.log(`[PDF渲染] 完成，共 ${pageNum} 页`);
  return pageImages;
}
