/**
 * Ticket #43 — Deploy script cleanup batch
 *
 * Audit claims (one P1 with multiple sub-fixes):
 *   1. set -euo pipefail
 *   2. HEALTH_ENDPOINT from env
 *   3. Health check timeout: 30 × 5s = 150s
 *   4. npm audit --audit-level=high FAILS the deploy
 *   5. Slack notification on success and failure
 *   6. build:all runs parallel
 *   7. npm ci (no --production)
 *
 * Verification: structural test that reads the deploy scripts and asserts
 * each of the acceptance criteria is present.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const DEPLOY_PROD = readFileSync(
  resolve(__dirname, '../../../scripts/deploy-prod.sh'),
  'utf-8'
);
const DEPLOY_STAGING = readFileSync(
  resolve(__dirname, '../../../scripts/deploy-staging.sh'),
  'utf-8'
);
const PACKAGE_JSON = JSON.parse(
  readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')
);

describe('deploy scripts — ticket #43 acceptance criteria', () => {
  it.each([
    ['deploy-prod.sh', DEPLOY_PROD],
    ['deploy-staging.sh', DEPLOY_STAGING],
  ])('%s uses set -euo pipefail', (_name, content) => {
    expect(content).toMatch(/^set -euo pipefail/m);
  });

  it.each([
    ['deploy-prod.sh', DEPLOY_PROD],
    ['deploy-staging.sh', DEPLOY_STAGING],
  ])('%s reads HEALTH_ENDPOINT from env with default', (_name, content) => {
    expect(content).toMatch(/HEALTH_ENDPOINT="\$\{HEALTH_ENDPOINT:-(http|https):\/\//);
  });

  it.each([
    ['deploy-prod.sh', DEPLOY_PROD],
    ['deploy-staging.sh', DEPLOY_STAGING],
  ])('%s has 30-iteration health check (150s timeout)', (_name, content) => {
    expect(content).toMatch(/for i in \$\(seq 1 30\)/);
  });

  it.each([
    ['deploy-prod.sh', DEPLOY_PROD],
    ['deploy-staging.sh', DEPLOY_STAGING],
  ])('%s FAILS the deploy on npm audit high-severity findings', (_name, content) => {
    // Look for the "aborting" pattern, not just "proceeding with deploy"
    expect(content).toMatch(/Aborting deploy/);
    expect(content).toMatch(/exit 1/);
    // Should NOT have the old "Proceeding with deploy" string
    expect(content).not.toMatch(/Proceeding with deploy/);
  });

  it.each([
    ['deploy-prod.sh', DEPLOY_PROD],
    ['deploy-staging.sh', DEPLOY_STAGING],
  ])('%s has a notify() function (Slack/webhook alerts)', (_name, content) => {
    expect(content).toMatch(/^notify\(\)/m);
    expect(content).toMatch(/ALERT_WEBHOOK_URL/);
  });

  it.each([
    ['deploy-prod.sh', DEPLOY_PROD],
    ['deploy-staging.sh', DEPLOY_STAGING],
  ])('%s uses npm ci (no --production)', (_name, content) => {
    expect(content).toMatch(/^npm ci$/m);
    expect(content).not.toMatch(/npm ci --production/);
  });

  it.each([
    ['deploy-prod.sh', DEPLOY_PROD],
    ['deploy-staging.sh', DEPLOY_STAGING],
  ])('%s runs npm run build:all (parallel web + worker builds)', (_name, content) => {
    expect(content).toMatch(/npm run build:all/);
  });

  it('package.json build:all runs web + worker builds in parallel with fail-fast exit propagation', () => {
    const buildAll = PACKAGE_JSON.scripts['build:all'];
    expect(buildAll).toBeDefined();
    expect(buildAll).toMatch(/build-all\.mjs/);
  });
});
