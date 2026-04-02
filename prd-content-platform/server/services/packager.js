import { createWriteStream } from 'fs';
import { join, dirname } from 'path';
import archiver from 'archiver';

export function packOutput(taskDir, taskId) {
  return new Promise((resolve, reject) => {
    const zipPath = join(dirname(taskDir), `${taskId}.zip`);
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(zipPath));
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(taskDir, taskId);
    archive.finalize();
  });
}
