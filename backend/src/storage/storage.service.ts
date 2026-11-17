import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';

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
  }

  /** Stores the image and returns the URL to save in the database. */
  async save(file: Express.Multer.File): Promise<string> {
    return this.cloud ? this.toCloudinary(file) : this.toDisk(file);
  }

  private async toDisk(file: Express.Multer.File) {
    const name = `${randomUUID()}${extname(file.originalname).toLowerCase() || '.jpg'}`;
    await mkdir('uploads', { recursive: true });
    await writeFile(join('uploads', name), file.buffer);
    return `/uploads/${name}`;
  }

  private async toCloudinary(file: Express.Multer.File) {
    const { name, key, secret } = this.cloud!;
    const params = { folder: 'holydo-market', timestamp: String(Math.floor(Date.now() / 1000)) };
    // Signature = sha1 of the alphabetically sorted params + API secret.
    const toSign = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&');
    const signature = createHash('sha1').update(toSign + secret).digest('hex');

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname);
    Object.entries(params).forEach(([k, v]) => form.append(k, v));
    form.append('api_key', key);
    form.append('signature', signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${name}/image/upload`, { method: 'POST', body: form });
    const body = (await res.json()) as { secure_url?: string; error?: { message: string } };
    if (!res.ok || !body.secure_url) throw new Error(body.error?.message ?? `Cloudinary error ${res.status}`);
    return body.secure_url;
  }
}
