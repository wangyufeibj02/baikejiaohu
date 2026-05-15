import { Router } from 'express';
import multer from 'multer';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, unlinkSync, readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const TEMP_DIR = join(ROOT, 'uploads', 'tools-temp');
mkdirSync(TEMP_DIR, { recursive: true });

setInterval(() => {
  try {
    const now = Date.now();
    for (const f of readdirSync(TEMP_DIR)) {
      try {
        const p = join(TEMP_DIR, f);
        if (now - statSync(p).mtimeMs > 2 * 3600_000) unlinkSync(p);
      } catch {}
    }
  } catch {}
}, 30 * 60_000);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TEMP_DIR),
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}_${randomUUID().slice(0, 6)}${ext}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
});

const router = Router();

function resultInfo(filePath, extras) {
  const stat = statSync(filePath);
  return {
    url: '/uploads/tools-temp/' + basename(filePath),
    filename: basename(filePath),
    size: stat.size,
    ...extras,
  };
}

// ── 1. Video → APNG ──────────────────────────────────────────────
router.post('/video-to-apng', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, error: '请上传视频文件' });
    const { width = 360, height, fps = 10, borderRadius = 0, maxColors = 256, plays = 0, start, end } = req.body;
    const w = parseInt(width), h = height ? parseInt(height) : -1;
    const outName = `apng_${Date.now()}_${randomUUID().slice(0, 6)}.png`;
    const outPath = join(TEMP_DIR, outName);

    const timeArgs = [];
    if (start && +start > 0) timeArgs.push('-ss', String(start));
    if (end && +end > 0) timeArgs.push('-t', String(+end - (+start || 0)));

    const scaleFilter = h > 0
      ? `fps=${fps},scale=${w}:${h}:flags=lanczos`
      : `fps=${fps},scale=${w}:-1:flags=lanczos`;
    const mc = Math.min(256, Math.max(8, parseInt(maxColors) || 256));

    if (+borderRadius > 0 && h > 0) {
      const r = Math.min(+borderRadius, w / 2, h / 2);
      const maskPath = outPath.replace(/\.png$/, '_mask.png');
      const maskSvg = Buffer.from(
        `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="white"/></svg>`
      );
      await sharp(maskSvg).png().toFile(maskPath);
      const palPath = outPath.replace(/\.png$/, '_pal.png');
      await execFileAsync('ffmpeg', [
        '-y', ...timeArgs, '-i', req.file.path, '-i', maskPath,
        '-vf', `${scaleFilter},palettegen=max_colors=${mc}`, palPath,
      ], { timeout: 120_000 });
      await execFileAsync('ffmpeg', [
        '-y', ...timeArgs, '-i', req.file.path, '-i', palPath, '-i', maskPath,
        '-lavfi', `${scaleFilter} [v]; [v][2:v]alphamerge [masked]; [masked][1:v] paletteuse=dither=none`,
        '-plays', String(plays), '-f', 'apng', outPath,
      ], { timeout: 120_000 });
      try { unlinkSync(maskPath); } catch {}
      try { unlinkSync(palPath); } catch {}
    } else {
      const palPath = outPath.replace(/\.png$/, '_pal.png');
      await execFileAsync('ffmpeg', [
        '-y', ...timeArgs, '-i', req.file.path,
        '-vf', `${scaleFilter},palettegen=max_colors=${mc}`, palPath,
      ], { timeout: 120_000 });
      await execFileAsync('ffmpeg', [
        '-y', ...timeArgs, '-i', req.file.path, '-i', palPath,
        '-lavfi', `${scaleFilter} [x]; [x][1:v] paletteuse=dither=none`,
        '-plays', String(plays), '-f', 'apng', outPath,
      ], { timeout: 120_000 });
      try { unlinkSync(palPath); } catch {}
    }

    const origSize = req.file.size;
    try { unlinkSync(req.file.path); } catch {}
    res.json({ success: true, data: resultInfo(outPath, { originalSize: origSize }) });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── 2. GIF → APNG ────────────────────────────────────────────────
router.post('/gif-to-apng', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, error: '请上传GIF文件' });
    const { plays = 0 } = req.body;
    const outName = `apng_${Date.now()}_${randomUUID().slice(0, 6)}.png`;
    const outPath = join(TEMP_DIR, outName);

    await execFileAsync('ffmpeg', [
      '-y', '-i', req.file.path,
      '-plays', String(plays), '-f', 'apng', outPath,
    ], { timeout: 60_000 });

    const origSize = req.file.size;
    try { unlinkSync(req.file.path); } catch {}
    res.json({ success: true, data: resultInfo(outPath, { originalSize: origSize }) });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── 3. APNG Compress ─────────────────────────────────────────────
router.post('/apng-compress', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, error: '请上传APNG文件' });
    const { maxColors = 128, plays = 0 } = req.body;
    const mc = Math.min(256, Math.max(8, parseInt(maxColors) || 128));
    const outName = `apng_c_${Date.now()}_${randomUUID().slice(0, 6)}.png`;
    const outPath = join(TEMP_DIR, outName);
    const palPath = outPath.replace(/\.png$/, '_pal.png');

    await execFileAsync('ffmpeg', [
      '-y', '-i', req.file.path,
      '-vf', `palettegen=max_colors=${mc}`, palPath,
    ], { timeout: 120_000 });
    await execFileAsync('ffmpeg', [
      '-y', '-i', req.file.path, '-i', palPath,
      '-lavfi', `[0:v][1:v] paletteuse=dither=none`,
      '-plays', String(plays), '-f', 'apng', outPath,
    ], { timeout: 120_000 });
    try { unlinkSync(palPath); } catch {}

    const origSize = req.file.size;
    try { unlinkSync(req.file.path); } catch {}
    const info = resultInfo(outPath, { originalSize: origSize });
    info.compressionRatio = ((1 - info.size / origSize) * 100).toFixed(1) + '%';
    res.json({ success: true, data: info });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── 4. Image Process (crop / resize / format / rounded corners) ──
router.post('/image-process', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, error: '请上传图片' });
    const { cropX, cropY, cropW, cropH, resizeW, resizeH, fit = 'cover', format = 'png', quality = 90, borderRadius = 0 } = req.body;
    let pipeline = sharp(req.file.path);

    if (cropW && cropH && +cropW > 0 && +cropH > 0) {
      pipeline = pipeline.extract({ left: +cropX || 0, top: +cropY || 0, width: +cropW, height: +cropH });
    }
    if (resizeW || resizeH) {
      pipeline = pipeline.resize({
        width: resizeW ? +resizeW : undefined,
        height: resizeH ? +resizeH : undefined,
        fit: fit || 'cover',
      });
    }

    const fmt = format || 'png';
    const q = Math.min(100, Math.max(1, parseInt(quality) || 90));
    const outExt = fmt === 'jpg' || fmt === 'jpeg' ? '.jpg' : fmt === 'webp' ? '.webp' : '.png';
    const outName = `img_${Date.now()}_${randomUUID().slice(0, 6)}${outExt}`;
    const outPath = join(TEMP_DIR, outName);

    if (+borderRadius > 0) {
      const tmpBuf = await pipeline.png().toBuffer();
      const meta = await sharp(tmpBuf).metadata();
      const w = meta.width, h = meta.height;
      const r = Math.min(+borderRadius, w / 2, h / 2);
      const mask = Buffer.from(
        `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="white"/></svg>`
      );
      let rounded = sharp(tmpBuf).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]);
      if (fmt === 'jpg' || fmt === 'jpeg') rounded = rounded.flatten({ background: '#ffffff' }).jpeg({ quality: q });
      else if (fmt === 'webp') rounded = rounded.webp({ quality: q });
      else rounded = rounded.png();
      await rounded.toFile(outPath);
    } else {
      if (fmt === 'jpg' || fmt === 'jpeg') pipeline = pipeline.jpeg({ quality: q });
      else if (fmt === 'webp') pipeline = pipeline.webp({ quality: q });
      else pipeline = pipeline.png();
      await pipeline.toFile(outPath);
    }

    const origSize = req.file.size;
    try { unlinkSync(req.file.path); } catch {}
    res.json({ success: true, data: resultInfo(outPath, { originalSize: origSize }) });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── 5. Image Remove Background ───────────────────────────────────
router.post('/image-remove-bg', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, error: '请上传图片' });
    const tolerance = Math.min(200, Math.max(1, parseInt(req.body.tolerance) || 30));

    const { data, info } = await sharp(req.file.path)
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const pixels = Buffer.from(data);

    const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
    let bgR = 0, bgG = 0, bgB = 0;
    for (const [x, y] of corners) {
      const i = (y * width + x) * channels;
      bgR += pixels[i]; bgG += pixels[i + 1]; bgB += pixels[i + 2];
    }
    bgR = Math.round(bgR / 4); bgG = Math.round(bgG / 4); bgB = Math.round(bgB / 4);

    for (let i = 0; i < pixels.length; i += channels) {
      const dr = pixels[i] - bgR, dg = pixels[i + 1] - bgG, db = pixels[i + 2] - bgB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < tolerance) pixels[i + 3] = 0;
      else if (dist < tolerance * 1.8) pixels[i + 3] = Math.round(255 * (dist - tolerance) / (tolerance * 0.8));
    }

    const outName = `nobg_${Date.now()}_${randomUUID().slice(0, 6)}.png`;
    const outPath = join(TEMP_DIR, outName);
    await sharp(pixels, { raw: { width, height, channels } }).png().toFile(outPath);

    try { unlinkSync(req.file.path); } catch {}
    res.json({ success: true, data: resultInfo(outPath, { bgColor: `rgb(${bgR},${bgG},${bgB})` }) });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── 6. Batch Resize ──────────────────────────────────────────────
router.post('/batch-resize', upload.array('files', 50), async (req, res) => {
  try {
    if (!req.files?.length) return res.json({ success: false, error: '请上传图片' });
    const { width, height, fit = 'cover', format = 'png', quality = 90 } = req.body;
    if (!width && !height) return res.json({ success: false, error: '请指定宽度或高度' });

    const results = [];
    for (const file of req.files) {
      try {
        let pipeline = sharp(file.path).resize({
          width: width ? +width : undefined,
          height: height ? +height : undefined,
          fit: fit || 'cover',
        });
        const fmt = format || 'png';
        const q = Math.min(100, Math.max(1, parseInt(quality) || 90));
        if (fmt === 'jpg' || fmt === 'jpeg') pipeline = pipeline.jpeg({ quality: q });
        else if (fmt === 'webp') pipeline = pipeline.webp({ quality: q });
        else pipeline = pipeline.png();

        const outExt = fmt === 'jpg' ? '.jpg' : fmt === 'webp' ? '.webp' : '.png';
        const outName = `rsz_${Date.now()}_${randomUUID().slice(0, 6)}${outExt}`;
        const outPath = join(TEMP_DIR, outName);
        await pipeline.toFile(outPath);
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        results.push({ ...resultInfo(outPath), originalName });
      } catch (e) {
        results.push({ error: e.message, originalName: file.originalname });
      } finally {
        try { unlinkSync(file.path); } catch {}
      }
    }
    res.json({ success: true, data: { results } });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── 7. Audio Trim ────────────────────────────────────────────────
router.post('/audio-trim', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, error: '请上传音频文件' });
    const { start = 0, end, fadeIn = 0, fadeOut = 0, format = 'mp3' } = req.body;

    const args = ['-y', '-i', req.file.path];
    if (+start > 0) args.push('-ss', String(start));
    if (end && +end > 0) args.push('-t', String(+end - (+start || 0)));

    const filters = [];
    if (+fadeIn > 0) filters.push(`afade=t=in:st=0:d=${fadeIn}`);
    if (+fadeOut > 0) {
      const dur = end ? (+end - (+start || 0)) : 999;
      filters.push(`afade=t=out:st=${Math.max(0, dur - +fadeOut)}:d=${fadeOut}`);
    }
    if (filters.length) args.push('-af', filters.join(','));

    const fmt = format || 'mp3';
    const outExt = { wav: '.wav', aac: '.aac', ogg: '.ogg' }[fmt] || '.mp3';
    const outName = `trim_${Date.now()}_${randomUUID().slice(0, 6)}${outExt}`;
    const outPath = join(TEMP_DIR, outName);
    args.push(outPath);

    await execFileAsync('ffmpeg', args, { timeout: 60_000 });
    try { unlinkSync(req.file.path); } catch {}
    res.json({ success: true, data: resultInfo(outPath) });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── 8. Audio Convert + Volume ────────────────────────────────────
router.post('/audio-convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, error: '请上传音频文件' });
    const { format = 'mp3', volume, normalize } = req.body;

    const args = ['-y', '-i', req.file.path];
    const filters = [];
    if (volume && +volume !== 0) filters.push(`volume=${volume}dB`);
    if (normalize === 'true') filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
    if (filters.length) args.push('-af', filters.join(','));

    const fmt = format || 'mp3';
    const outExt = { wav: '.wav', aac: '.aac', ogg: '.ogg' }[fmt] || '.mp3';
    const outName = `conv_${Date.now()}_${randomUUID().slice(0, 6)}${outExt}`;
    const outPath = join(TEMP_DIR, outName);
    args.push(outPath);

    await execFileAsync('ffmpeg', args, { timeout: 60_000 });
    const origSize = req.file.size;
    try { unlinkSync(req.file.path); } catch {}
    res.json({ success: true, data: resultInfo(outPath, { originalSize: origSize }) });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── 9. Audio Concat ──────────────────────────────────────────────
router.post('/audio-concat', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files?.length || req.files.length < 2) {
      return res.json({ success: false, error: '请上传至少两个音频文件' });
    }
    const { format = 'mp3', gap = 0 } = req.body;
    const order = req.body.order ? JSON.parse(req.body.order) : req.files.map((_, i) => i);
    const ordered = order.map(i => req.files[i]).filter(Boolean);

    const fmt = format || 'mp3';
    const outExt = { wav: '.wav', aac: '.aac', ogg: '.ogg' }[fmt] || '.mp3';
    const outName = `concat_${Date.now()}_${randomUUID().slice(0, 6)}${outExt}`;
    const outPath = join(TEMP_DIR, outName);

    let silPath = null;
    if (+gap > 0) {
      silPath = join(TEMP_DIR, `sil_${Date.now()}.wav`);
      await execFileAsync('ffmpeg', [
        '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-t', String(+gap / 1000), silPath,
      ], { timeout: 10_000 });
    }

    const inputs = [];
    const filterParts = [];
    let idx = 0;
    for (let i = 0; i < ordered.length; i++) {
      inputs.push('-i', ordered[i].path);
      filterParts.push(`[${idx}:a]`);
      idx++;
      if (silPath && i < ordered.length - 1) {
        inputs.push('-i', silPath);
        filterParts.push(`[${idx}:a]`);
        idx++;
      }
    }
    const n = filterParts.length;
    const fc = `${filterParts.join('')}concat=n=${n}:v=0:a=1[out]`;

    await execFileAsync('ffmpeg', [
      '-y', ...inputs, '-filter_complex', fc, '-map', '[out]', outPath,
    ], { timeout: 120_000 });

    if (silPath) try { unlinkSync(silPath); } catch {}
    for (const f of req.files) try { unlinkSync(f.path); } catch {}
    res.json({ success: true, data: resultInfo(outPath) });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── 10. Video Preview (upload large file + metadata + H.264 preview) ─
const bigUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TEMP_DIR),
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `vid_${Date.now()}_${randomUUID().slice(0, 6)}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 * 1024 },
});

async function getVideoInfo(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'quiet', '-print_format', 'json',
    '-show_format', '-show_streams', filePath,
  ], { timeout: 30_000, maxBuffer: 5 * 1024 * 1024 });
  const info = JSON.parse(stdout);
  const vs = info.streams?.find(s => s.codec_type === 'video');
  return {
    duration: parseFloat(info.format?.duration || vs?.duration || 0),
    width: vs?.width || 0,
    height: vs?.height || 0,
    codec: vs?.codec_name || 'unknown',
  };
}

router.post('/video-preview', bigUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, error: '请上传视频文件' });

    const info = await getVideoInfo(req.file.path);
    const previewName = `preview_${Date.now()}_${randomUUID().slice(0, 6)}.mp4`;
    const previewPath = join(TEMP_DIR, previewName);

    await execFileAsync('ffmpeg', [
      '-y', '-i', req.file.path,
      '-vf', 'scale=640:-2',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
      '-an', previewPath,
    ], { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 });

    res.json({
      success: true,
      data: {
        filename: basename(req.file.path),
        previewUrl: '/uploads/tools-temp/' + previewName,
        duration: info.duration,
        width: info.width,
        height: info.height,
        codec: info.codec,
        size: req.file.size,
      },
    });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── 11. Video Edit (time trim + spatial crop + APNG) ─────────────
router.post('/video-edit', bigUpload.single('file'), async (req, res) => {
  try {
    const { filename, start, end, cropX, cropY, cropW, cropH,
            width = 360, height, fps = 10, maxColors = 256,
            borderRadius = 0, plays = 0 } = req.body;

    let inputPath;
    if (req.file) {
      inputPath = req.file.path;
    } else if (filename) {
      inputPath = join(TEMP_DIR, basename(filename));
      if (!existsSync(inputPath)) return res.json({ success: false, error: '文件不存在或已过期，请重新上传' });
    } else {
      return res.json({ success: false, error: '请上传视频或指定已上传的文件' });
    }

    const w = parseInt(width), h = height ? parseInt(height) : -1;
    const fpsVal = Math.min(30, Math.max(1, parseInt(fps) || 10));
    const mc = Math.min(256, Math.max(8, parseInt(maxColors) || 256));

    const outName = `apng_${Date.now()}_${randomUUID().slice(0, 6)}.png`;
    const outPath = join(TEMP_DIR, outName);

    const timeArgs = [];
    if (start && +start > 0) timeArgs.push('-ss', String(start));
    if (end && +end > 0) timeArgs.push('-t', String(+end - (+start || 0)));

    const filters = [];
    if (cropW && cropH && +cropW > 0 && +cropH > 0) {
      filters.push(`crop=${Math.round(+cropW)}:${Math.round(+cropH)}:${Math.round(+cropX || 0)}:${Math.round(+cropY || 0)}`);
    }
    filters.push(`fps=${fpsVal}`);
    filters.push(h > 0 ? `scale=${w}:${h}:flags=lanczos` : `scale=${w}:-1:flags=lanczos`);
    const vf = filters.join(',');

    const palPath = outPath.replace(/\.png$/, '_pal.png');
    await execFileAsync('ffmpeg', [
      '-y', ...timeArgs, '-i', inputPath,
      '-vf', `${vf},palettegen=max_colors=${mc}`, palPath,
    ], { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 });

    if (+borderRadius > 0 && h > 0) {
      const r = Math.min(+borderRadius, w / 2, h / 2);
      const maskPath = outPath.replace(/\.png$/, '_mask.png');
      await sharp(Buffer.from(
        `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="white"/></svg>`
      )).png().toFile(maskPath);
      await execFileAsync('ffmpeg', [
        '-y', ...timeArgs, '-i', inputPath, '-i', palPath, '-i', maskPath,
        '-lavfi', `${vf} [v]; [v][2:v]alphamerge [masked]; [masked][1:v] paletteuse=dither=none`,
        '-plays', String(plays), '-f', 'apng', outPath,
      ], { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 });
      try { unlinkSync(maskPath); } catch {}
    } else {
      await execFileAsync('ffmpeg', [
        '-y', ...timeArgs, '-i', inputPath, '-i', palPath,
        '-lavfi', `${vf} [x]; [x][1:v] paletteuse=dither=none`,
        '-plays', String(plays), '-f', 'apng', outPath,
      ], { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 });
    }
    try { unlinkSync(palPath); } catch {}

    res.json({ success: true, data: resultInfo(outPath) });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── 12. Video Format Convert ─────────────────────────────────────
router.post('/video-convert', bigUpload.single('file'), async (req, res) => {
  try {
    const { filename, start, end, cropX, cropY, cropW, cropH, format = 'mp4' } = req.body;

    let inputPath;
    if (req.file) {
      inputPath = req.file.path;
    } else if (filename) {
      inputPath = join(TEMP_DIR, basename(filename));
      if (!existsSync(inputPath)) return res.json({ success: false, error: '文件不存在或已过期，请重新上传' });
    } else {
      return res.json({ success: false, error: '请上传视频或指定已上传的文件' });
    }

    const fmt = (format || 'mp4').toLowerCase();
    const extMap = { mp4: '.mp4', mov: '.mov', webm: '.webm', avi: '.avi', mkv: '.mkv' };
    const outExt = extMap[fmt] || '.mp4';
    const outName = `vid_${Date.now()}_${randomUUID().slice(0, 6)}${outExt}`;
    const outPath = join(TEMP_DIR, outName);

    const args = ['-y'];
    if (start && +start > 0) args.push('-ss', String(start));
    if (end && +end > 0) args.push('-t', String(+end - (+start || 0)));
    args.push('-i', inputPath);

    const needsCrop = cropW && cropH && +cropW > 0 && +cropH > 0;
    if (needsCrop) {
      args.push('-vf', `crop=${Math.round(+cropW)}:${Math.round(+cropH)}:${Math.round(+cropX || 0)}:${Math.round(+cropY || 0)}`);
    }

    if (!needsCrop && !start && !end) {
      args.push('-c', 'copy');
    } else if (fmt === 'webm') {
      args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-c:a', 'libopus');
    } else if (fmt === 'mp4' || fmt === 'mov') {
      if (!needsCrop) args.push('-c:v', 'copy', '-c:a', 'aac');
      else args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-c:a', 'aac');
    }

    args.push(outPath);
    await execFileAsync('ffmpeg', args, { timeout: 600_000, maxBuffer: 10 * 1024 * 1024 });

    const origSize = req.file ? req.file.size : statSync(inputPath).size;
    res.json({ success: true, data: resultInfo(outPath, { originalSize: origSize }) });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

export default router;
