/**
 * Start Next.js with TLS (HTTPS)
 *
 * Uses mkcert-generated certificates from certs/ directory.
 * Generate them first: bash ../bin/cert-setup.sh
 *
 * Run: npx tsx bin/start-with-tls.ts
 *
 * This script:
 *   1. Reads TLS cert/key from env or certs/ directory
 *   2. Starts the Next.js dev server over HTTPS
 *   3. Falls back to HTTP if certificates aren't found
 */

import { readFileSync, existsSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';
import https from 'https';
import http from 'http';
import next from 'next';

const certDir = join(__dirname, '..', 'certs');
const certPath = process.env.TLS_CERT_PATH || join(certDir, 'dev.crt');
const keyPath = process.env.TLS_KEY_PATH || join(certDir, 'dev.key');
const port = parseInt(process.env.PORT || '8081', 10);
const host = process.env.HOST || '0.0.0.0';

async function main() {
  const hasCerts = existsSync(certPath) && existsSync(keyPath);

  if (!hasCerts) {
    console.log('\n⚠️  No TLS certificates found.');
    console.log(`   Looked for: ${certPath}`);
    console.log('   Starting with HTTP instead.\n');
    console.log('   To generate certs:');
    console.log('     bash bin/cert-setup.sh\n');

    const app = next({ dev: process.env.NODE_ENV !== 'production', port });
    const handle = app.getRequestHandler();
    await app.prepare();

    http.createServer(handle).listen(port, () => {
      console.log(`> HTTP server listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    });
    return;
  }

  console.log(`\n🔒 TLS certificates found at:`);
  console.log(`   cert: ${certPath}`);
  console.log(`   key:  ${keyPath}\n`);

  const app = next({ dev: process.env.NODE_ENV !== 'production', port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const options: https.ServerOptions = {
    cert: readFileSync(certPath),
    key: readFileSync(keyPath),
  };

  https.createServer(options, handle).listen(port, host, () => {
    console.log(`> HTTPS server listening on https://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
