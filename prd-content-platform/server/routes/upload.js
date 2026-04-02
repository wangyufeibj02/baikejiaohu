import { Router } from 'express';
import multer from 'multer';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS = join(__dirname, '..', '..', 'uploads');

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS),
  filename: (_req, file, cb) => {
    const id = randomUUID().slice(0, 8);
    const ext = extname(file.originalname) || '.bin';
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_TYPES.has(file.mimetype));
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = Router();

router.post('/', upload.array('files', 20), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, error: '请上传 PDF 或图片文件' });
  }

  const fileId = randomUUID();
  const pdfs = [];
  const images = [];

  for (const f of req.files) {
    const originalName = Buffer.from(f.originalname, 'latin1').toString('utf8');
    const info = {
      originalName,
      savedName: f.filename,
      path: f.path,
      size: f.size,
      mimetype: f.mimetype,
    };
    if (f.mimetype === 'application/pdf') pdfs.push(info);
    else images.push(info);
  }

  res.json({
    success: true,
    data: {
      fileId,
      pdfs,
      images,
      totalFiles: req.files.length,
    },
  });
});

export default router;
