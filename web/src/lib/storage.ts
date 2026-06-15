import { join } from 'path';

export interface StorageProvider {
  upload(buffer: Buffer, filename: string, contentType: string): Promise<string>;
  delete(storageKey: string): Promise<void>;
  getSignedReadUrl(storageKey: string, expiresInMinutes?: number): Promise<string>;
  getSignedUploadUrl(storageKey: string, contentType: string): Promise<string>;
  verifyUpload(storageKey: string): Promise<boolean>;
}

class LocalStorageProvider implements StorageProvider {
  private async getBaseDir(): Promise<string> {
    try {
      const { db } = await import('@/lib/db');
      const setting = await db.systemSetting.findUnique({ where: { key: 'LOCAL_STORAGE_ROOT' } });
      if (setting?.value) return setting.value;
    } catch {}
    return process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads');
  }

  async upload(buffer: Buffer, filename: string): Promise<string> {
    const { writeFile, mkdir } = await import('fs/promises');
    const baseDir = await this.getBaseDir();
    const fullPath = join(baseDir, filename);
    const dir = join(baseDir, filename.split('/').slice(0, -1).join('/'));

    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, buffer);
    return filename;
  }

  async delete(storageKey: string): Promise<void> {
    const { unlink } = await import('fs/promises');
    try {
      const baseDir = await this.getBaseDir();
      await unlink(join(baseDir, storageKey));
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
      const baseDir = await this.getBaseDir();
      await access(join(baseDir, storageKey));
      return true;
    } catch {
      return false;
    }
  }
}

let _provider: StorageProvider | null = null;

export async function getStorageProvider(): Promise<StorageProvider> {
  if (_provider) return _provider;
  _provider = new LocalStorageProvider();
  return _provider;
}

export { LocalStorageProvider };
