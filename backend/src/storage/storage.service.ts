import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Where uploaded photos go.
 *
 * - CLOUDINARY_URL set (cloudinary://API_KEY:API_SECRET@CLOUD_NAME):
 *   uploaded to Cloudinary; the photo URL is the absolute https URL it returns.
 *   Required on hosts with a temporary disk (Render, Railway, Heroku…).
 * - Otherwise: saved to ./uploads and served by the API at /uploads/<file>.
 *
 * Uses Cloudinary's REST upload API directly (signed request) — no SDK needed.
 */
@Injectable()
export class StorageService {
  private readonly log = new Logger('Storage');
  private readonly cloud: { name: string; key: string; secret: string } | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('CLOUDINARY_URL');
    const m = url?.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    this.cloud = m ? { key: m[1], secret: m[2], name: m[3] } : null;
    this.log.log(this.cloud ? `Photos → Cloudinary (${this.cloud.name})` : 'Photos → local ./uploads');
    if (!this.cloud && config.get('NODE_ENV') === 'production') {
      // Render/Railway disks are temporary: photos would disappear at the next deploy or restart.
      this.log.error('CLOUDINARY_URL is not set in production: uploaded photos are stored on a temporary disk and will be lost.');
    }
  }

  /**
   * Stores the image and returns the URL to save in the database.
   * The type is checked from the file's real content ("magic bytes"), never
   * from the name or the type declared by the browser — so an HTML or script
   * file renamed "photo.png" is refused (security audit H1).
   */
  async save(file: Express.Multer.File): Promise<string> {
    const kind = detectImage(file.buffer);
    if (!kind) throw new BadRequestException('Ce fichier n’est pas une image JPG, PNG ou WEBP valide.');
    return this.cloud ? this.toCloudinary(file, kind) : this.toDisk(file, kind);
  }

  private async toDisk(file: Express.Multer.File, kind: ImageKind) {
    // Extension chosen from the detected type, never from the uploaded file name.
    const name = `${randomUUID()}.${kind.ext}`;
    await mkdir('uploads', { recursive: true });
    await writeFile(join('uploads', name), file.buffer);
    return `/uploads/${name}`;
  }

  private async toCloudinary(file: Express.Multer.File, kind: ImageKind) {
    const { name, key, secret } = this.cloud!;
    const params = { folder: 'holydo-market', timestamp: String(Math.floor(Date.now() / 1000)) };
    // Signature = sha1 of the alphabetically sorted params + API secret.
    const toSign = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&');
    const signature = createHash('sha1').update(toSign + secret).digest('hex');

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(file.buffer)], { type: kind.mime }), `photo.${kind.ext}`);
    Object.entries(params).forEach(([k, v]) => form.append(k, v));
    form.append('api_key', key);
    form.append('signature', signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${name}/image/upload`, { method: 'POST', body: form });
    const body = (await res.json()) as { secure_url?: string; error?: { message: string } };
    if (!res.ok || !body.secure_url) throw new Error(body.error?.message ?? `Cloudinary error ${res.status}`);
    return body.secure_url;
  }
}

interface ImageKind { ext: 'jpg' | 'png' | 'webp'; mime: string }

/** Recognises JPEG, PNG and WEBP from their first bytes; anything else → null. */
export function detectImage(buf: Buffer): ImageKind | null {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}
