import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';

describe('PM2 Ecosystem Config', () => {
  const ecosystemPath = path.resolve(__dirname, '../../../ecosystem.config.js');

  beforeEach(() => {
    delete process.env.WORKER_INSTANCES;
    delete process.env.WORKER_EXEC_MODE;
  });

  it('exports valid apps config for voltium-web and voltium-worker', () => {
    delete require.cache[require.resolve(ecosystemPath)];
    const config = require(ecosystemPath);

    expect(config.apps).toHaveLength(2);
    const [webApp, workerApp] = config.apps;

    expect(webApp.name).toBe('voltium-web');
    expect(webApp.exec_mode).toBe('cluster');
    expect(webApp.instances).toBe('max');

    expect(workerApp.name).toBe('voltium-worker');
    expect(workerApp.instances).toBe(1);
    expect(workerApp.exec_mode).toBe('fork');
  });

  it('supports configurable multi-worker cluster mode via environment variables', () => {
    process.env.WORKER_INSTANCES = '4';
    delete require.cache[require.resolve(ecosystemPath)];
    const config = require(ecosystemPath);

    const workerApp = config.apps.find((a: any) => a.name === 'voltium-worker');
    expect(workerApp.instances).toBe(4);
    expect(workerApp.exec_mode).toBe('cluster');
  });
});
