import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

describe('Laptop Service Mode Integration Tests', () => {
  const projectRoot = join(__dirname, '../../../../');
  const serviceScriptPath = join(projectRoot, 'scripts/laptop-service.ps1');
  const smokeScriptPath = join(projectRoot, 'scripts/laptop-service-smoke.ps1');
  const ecosystemPath = join(projectRoot, 'ecosystem.config.js');

  it('1. Verifies that all service scripts and PM2 ecosystem file exist', () => {
    expect(existsSync(serviceScriptPath)).toBe(true);
    expect(existsSync(smokeScriptPath)).toBe(true);
    expect(existsSync(ecosystemPath)).toBe(true);
  });

  it('2. Checks PM2 ecosystem.config.js uses correct laptop mode settings', () => {
    const content = readFileSync(ecosystemPath, 'utf8');

    // Should run Next.js in production local_laptop mode
    expect(content).toContain("DATA_MODE: 'local_laptop'");
    expect(content).toContain("STORAGE_PROVIDER: 'local'");
    expect(content).toContain('voltium-web');
    expect(content).toContain('voltium-worker');
  });

  it('3. Runs folder initialization command successfully', () => {
    // Run folder init with a temporary server root to avoid modifying production directory
    const testServerRoot = join(projectRoot, 'data/test-server-root').replace(/\\/g, '/');

    try {
      const output = execSync(
        `powershell -ExecutionPolicy Bypass -File "${serviceScriptPath}" init-folders -ServerRoot "${testServerRoot}"`,
        { encoding: 'utf8' }
      );

      expect(output).toContain('Creating laptop service folders');
      expect(output).toContain(testServerRoot);
      expect(existsSync(testServerRoot)).toBe(true);
      expect(existsSync(join(testServerRoot, 'data/uploads'))).toBe(true);
      expect(existsSync(join(testServerRoot, 'data/backups'))).toBe(true);
      expect(existsSync(join(testServerRoot, 'data/logs'))).toBe(true);
    } catch (err: any) {
      throw new Error(`Failed to execute laptop-service.ps1 init-folders: ${err.message}`);
    }
  });

  it('4. Checks laptop service check runbook exists and matches specifications', () => {
    const runbookPath = join(projectRoot, 'docs/LAPTOP_SERVICE_RUNBOOK.md');
    expect(existsSync(runbookPath)).toBe(true);

    const runbookContent = readFileSync(runbookPath, 'utf8');
    expect(runbookContent.toLowerCase()).toContain('disaster');
    expect(runbookContent.toLowerCase()).toContain('pm2');
    expect(runbookContent.toLowerCase()).toContain('postgres');
  });
});
