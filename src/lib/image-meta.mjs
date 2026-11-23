import fs from 'node:fs';
import path from 'node:path';

/**
 * Reads intrinsic PNG dimensions (IHDR) and detects a sibling `.webp` file in `public/`.
 */
export function resolvePublicImageMeta(src) {
  if (!src || typeof src !== 'string' || !src.startsWith('/')) {
    return {};
  }

  const cleanPath = src.split('?')[0].replace(/^\/+/, '');
  const fullPath = path.resolve(process.cwd(), 'public', cleanPath);

  let width;
  let height;

  try {
    if (fs.existsSync(fullPath)) {
      const fd = fs.openSync(fullPath, 'r');
      const buf = Buffer.alloc(24);
      const bytesRead = fs.readSync(fd, buf, 0, 24, 0);
      fs.closeSync(fd);

      // PNG signature + IHDR chunk
      if (
        bytesRead === 24 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47
      ) {
        width = buf.readUInt32BE(16);
        height = buf.readUInt32BE(20);
      }
    }
  } catch {
    // ignore unreadable files
  }

  let webpSrc;
  if (/\.png$/i.test(cleanPath)) {
    const webpClean = cleanPath.replace(/\.png$/i, '.webp');
    const webpFull = path.resolve(process.cwd(), 'public', webpClean);
    if (fs.existsSync(webpFull)) {
      webpSrc = `/${webpClean}`;
    }
  }

  return { width, height, webpSrc };
}
