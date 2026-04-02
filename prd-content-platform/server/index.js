import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';
import uploadRouter from './routes/upload.js';
import analyzeRouter from './routes/analyze.js';
import generateRouter from './routes/generate.js';
import downloadRouter from './routes/download.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

mkdirSync(join(ROOT, 'uploads'), { recursive: true });
mkdirSync(join(ROOT, 'output'), { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/uploads', express.static(join(ROOT, 'uploads')));

app.use('/api/upload', uploadRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/generate', generateRouter);
app.use('/api/download', downloadRouter);

app.use(express.static(join(ROOT, 'client', 'dist')));

const PORT = process.env.PORT || 3200;
app.listen(PORT, () => {
  console.log(`[prd-platform] 服务已启动 http://localhost:${PORT}`);
});
