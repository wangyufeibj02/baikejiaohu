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
import prdRouter from './routes/prd.js';
import themesRouter from './routes/themes.js';
import tasksRouter from './routes/tasks.js';
import canvasPresetsRouter from './routes/canvasPresets.js';
import templatesRouter from './routes/templates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

mkdirSync(join(ROOT, 'uploads'), { recursive: true });
mkdirSync(join(ROOT, 'output'), { recursive: true });
mkdirSync(join(ROOT, 'data'), { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/uploads', express.static(join(ROOT, 'uploads')));
app.use('/output', express.static(join(ROOT, 'output')));

app.use('/api/upload', uploadRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/generate', generateRouter);
app.use('/api/download', downloadRouter);
app.use('/api/prd', prdRouter);
app.use('/api/themes', themesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/canvas-presets', canvasPresetsRouter);
app.use('/api/templates', templatesRouter);

app.use(express.static(join(ROOT, 'client', 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(join(ROOT, 'client', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3200;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[prd-platform] 服务已启动 http://0.0.0.0:${PORT}`);
  console.log(`[prd-platform] 局域网访问请使用本机 IP 地址`);
});
