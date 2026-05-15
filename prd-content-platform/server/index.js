import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { networkInterfaces } from 'os';
import uploadRouter from './routes/upload.js';
import analyzeRouter from './routes/analyze.js';
import generateRouter from './routes/generate.js';
import downloadRouter from './routes/download.js';
import templatesRouter from './routes/templates.js';
import canvasPresetsRouter from './routes/canvasPresets.js';
import prdRouter from './routes/prd.js';
import tasksRouter from './routes/tasks.js';
import themesRouter from './routes/themes.js';
import workspacesRouter from './routes/workspaces.js';
import stylesRouter from './routes/styles.js';
import toolsRouter from './routes/tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

mkdirSync(join(ROOT, 'uploads'), { recursive: true });
mkdirSync(join(ROOT, 'output'), { recursive: true });
mkdirSync(join(ROOT, 'data', 'tasks'), { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/uploads', express.static(join(ROOT, 'uploads')));
app.use('/output', express.static(join(ROOT, 'output')));
app.use('/template-assets', express.static(join(ROOT, 'data', 'template-assets')));
app.use('/widget-library', express.static(join(ROOT, 'data', 'widget-library')));
app.use('/workspace-assets', express.static(join(ROOT, 'data', 'workspace-assets')));

app.use('/api/upload', uploadRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/generate', generateRouter);
app.use('/api/download', downloadRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/canvas-presets', canvasPresetsRouter);
app.use('/api/prd', prdRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/themes', themesRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/styles', stylesRouter);
app.use('/api/tools', toolsRouter);

const DIST = join(ROOT, 'client', 'dist');
app.use(express.static(DIST));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return res.status(404).end();
  const indexPath = join(DIST, 'index.html');
  if (existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).send('前端未构建，请先运行 npm run build');
});

const PREFERRED_PORT = parseInt(process.env.PORT) || 3200;
const MAX_PORT_ATTEMPTS = 10;

function tryListen(port, attempt) {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[prd-platform] 服务已启动 http://localhost:${port}`);
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`[prd-platform] 局域网访问 http://${net.address}:${port}`);
        }
      }
    }
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      console.log(`[prd-platform] 端口 ${port} 被占用，尝试 ${port + 1}...`);
      tryListen(port + 1, attempt + 1);
    } else {
      console.error(`[prd-platform] 启动失败:`, err.message);
      process.exit(1);
    }
  });
}

tryListen(PREFERRED_PORT, 0);
