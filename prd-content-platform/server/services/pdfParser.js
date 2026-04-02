import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export async function parsePdf(filePath) {
  const buffer = readFileSync(filePath);
  const data = await pdfParse(buffer);
  return cleanText(data.text);
}

function cleanText(raw) {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\t+/g, ' ')
    .replace(/ {3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
