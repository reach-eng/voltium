import { join } from 'path';

export interface StorageProvider {
  upload(buffer: Buffer, filename: string, contentType: string): Promise<string>;
  delete(storageKey: string): Promise<void>;
  getSignedReadUrl(storageKey: string, expiresInMinutes?: number): Promise<string>;
  getSignedUploadUrl(storageKey: string, contentType: string): Promise<string>;
  verifyUpload(storageKey: string): Promise<boolean>;
}

class LocalStorageProvider implements StorageProvider {
  private baseDir = join(process.cwd(), 'data', 'uploads');

  async upload(buffer: Buffer, filename: string): Promise<string> {
    const { writeFile, mkdir } = await import('fs/promises');
    const fullPath = join(this.baseDir, filename);
    const dir = join(this.baseDir, filename.split('/').slice(0, -1).join('/'));

    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, buffer);
    return filename;
  }

  async delete(storageKey: string): Promise<void> {
    const { unlink } = await import('fs/promises');
    try {
      await unlink(join(this.baseDir, storageKey));
    } catch {}
  }

  async getSignedReadUrl(storageKey: string): Promise<string> {
    if (storageKey.startsWith('/api/files/') || storageKey.startsWith('http')) {
      return storageKey;
    }
    return `/api/files/${storageKey}`;
  }

  async getSignedUploadUrl(storageKey: string, _contentType: string): Promise<string> {
    const uploadUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081'}/api/files/direct-upload`;
    const baseUrl = uploadUrl.replace(/\/+$/, '');
    return `${baseUrl}?key=${encodeURIComponent(storageKey)}`;
  }

  async verifyUpload(storageKey: string): Promise<boolean> {
    const { access } = await import('fs/promises');
    try {
      await access(join(this.baseDir, storageKey));
      return true;
    } catch {
      return false;
    }
  }
}

class GcsStorageProvider implements StorageProvider {
  private storage: any;
  private bucket: any;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.GCS_BUCKET_NAME || 'voltium-uploads';
  }

  private async init() {
    if (this.storage) return;
    const { Storage } = await import('@google-cloud/storage');
    this.storage = new Storage({ projectId: process.env.GCS_PROJECT_ID });
    this.bucket = this.storage.bucket(this.bucketName);
  }

  async upload(buffer: Buffer, filename: string, contentType: string): Promise<string> {
    await this.init();
    const file = this.bucket.file(filename);
    await file.save(buffer, {
      contentType,
      metadata: { cacheControl: 'private, max-age=3600' },
    });
    return filename;
  }

  async delete(storageKey: string): Promise<void> {
    await this.init();
    await this.bucket.file(storageKey).delete();
  }

  async getSignedReadUrl(storageKey: string, expiresInMinutes = 15): Promise<string> {
    await this.init();
    const key = storageKey.startsWith(`https://storage.googleapis.com/${this.bucketName}/`)
      ? storageKey.replace(`https://storage.googleapis.com/${this.bucketName}/`, '')
      : storageKey;
    const file = this.bucket.file(key);
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });
    return signedUrl;
  }

  async getSignedUploadUrl(storageKey: string, contentType: string): Promise<string> {
    await this.init();
    const file = this.bucket.file(storageKey);
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 60 * 60 * 1000,
      contentType,
    });
    return signedUrl;
  }

  async verifyUpload(storageKey: string): Promise<boolean> {
    await this.init();
    const [exists] = await this.bucket.file(storageKey).exists();
    return exists;
  }
}

let _provider: StorageProvider | null = null;

export async function getStorageProvider(): Promise<StorageProvider> {
  if (_provider) return _provider;

  const provider = process.env.STORAGE_PROVIDER || 'local';

  if (provider === 'gcs') {
    _provider = new GcsStorageProvider();
  } else {
    _provider = new LocalStorageProvider();
  }

  return _provider;
}

export { LocalStorageProvider, GcsStorageProvider };
