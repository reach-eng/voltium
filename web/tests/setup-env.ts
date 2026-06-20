import fs from 'fs';
import path from 'path';

try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    for (const line of envConfig.split('\n')) {
      const commentIndex = line.indexOf('#');
      const cleanLine = (commentIndex !== -1 ? line.substring(0, commentIndex) : line).trim();
      const match = cleanLine.match(/^([\w.-]+)\s*=\s*(.*)?$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        val = val.trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    }
  }
} catch (e) {
  // Ignore
}

process.env.TEST_BASE_URL = 'http://localhost:8081';


