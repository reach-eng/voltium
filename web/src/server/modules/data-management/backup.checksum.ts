/**
 * Data Management — Backup Checksum
 *
 * Stream-based hashing and checksum manifest generation.
 */

import { createHash } from 'crypto';
import { createReadStream, readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function hashFile(filePath: string): Promise<string> {
  const h = createHash('sha256');
  await new Promise<void>((resolveHash, rejectHash) => {
    createReadStream(filePath)
      .on('data', (chunk) => h.update(chunk))
      .on('error', rejectHash)
      .on('end', () => resolveHash());
  });
  return h.digest('hex');
}

export async function generateChecksums(
  files: { filename: string; filePath: string }[]
): Promise<string[]> {
  const lines: string[] = [];
  for (const { filename, filePath } of files) {
    const hash = await hashFile(filePath);
    lines.push(`${hash}  ${filename}`);
  }
  return lines;
}

export function verifyChecksumFile(
  checksumPath: string,
  backupDir: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!existsSync(checksumPath)) {
    return { valid: false, errors: ['Checksums file not found'] };
  }

  try {
    const checksumContent = readFileSync(checksumPath, 'utf-8');
    const lines = checksumContent.trim().split('\n');

    for (const line of lines) {
      const [expectedHash, filename] = line.split(/\s+/);
      if (!expectedHash || !filename) continue;

      const filePath = join(backupDir, filename);
      if (existsSync(filePath)) {
        const actualHash = createHash('sha256').update(readFileSync(filePath)).digest('hex');
        if (actualHash !== expectedHash) {
          errors.push(`Checksum mismatch for ${filename}`);
        }
      } else {
        errors.push(`Missing file listed in checksums: ${filename}`);
      }
    }
  } catch (err) {
    errors.push(`Could not read checksums: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { valid: errors.length === 0, errors };
}
