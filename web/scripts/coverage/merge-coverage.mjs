import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import createCoverageMap from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const unitCoveragePath = path.resolve(rootDir, 'coverage/coverage-final.json');
const integrationCoveragePath = path.resolve(rootDir, 'coverage-integration/coverage-final.json');
const combinedOutputDir = path.resolve(rootDir, 'coverage-combined');

console.log('🔄 Merging Unit & Integration Coverage Reports...');

const map = createCoverageMap.createCoverageMap({});

if (fs.existsSync(unitCoveragePath)) {
  console.log('  └─ Loading unit coverage map...');
  const unitMap = JSON.parse(fs.readFileSync(unitCoveragePath, 'utf8'));
  map.merge(unitMap);
} else {
  console.warn('  ⚠️ Unit coverage map not found at:', unitCoveragePath);
}

if (fs.existsSync(integrationCoveragePath)) {
  console.log('  └─ Loading integration coverage map...');
  const intMap = JSON.parse(fs.readFileSync(integrationCoveragePath, 'utf8'));
  map.merge(intMap);
} else {
  console.warn('  ⚠️ Integration coverage map not found at:', integrationCoveragePath);
}

if (!fs.existsSync(combinedOutputDir)) {
  fs.mkdirSync(combinedOutputDir, { recursive: true });
}

// Generate merged reports: text, html, lcov, json-summary
const context = libReport.createContext({
  dir: combinedOutputDir,
  coverageMap: map,
  defaultSummarizer: 'nested',
});

const textReport = reports.create('text');
const summaryReport = reports.create('json-summary');
const htmlReport = reports.create('html');
const lcovReport = reports.create('lcov');

textReport.execute(context);
summaryReport.execute(context);
htmlReport.execute(context);
lcovReport.execute(context);

// Read summary for threshold check
const summaryPath = path.resolve(combinedOutputDir, 'coverage-summary.json');
if (fs.existsSync(summaryPath)) {
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const totalLines = summary.total.lines;
  console.log('\n📊 COMBINED COVERAGE SUMMARY:');
  console.log(`  Lines      : ${totalLines.pct}% (${totalLines.covered}/${totalLines.total})`);
  console.log(`  Statements : ${summary.total.statements.pct}%`);
  console.log(`  Functions  : ${summary.total.functions.pct}%`);
  console.log(`  Branches   : ${summary.total.branches.pct}%`);

  const MIN_LINE_COVERAGE = parseFloat(process.env.MIN_COVERAGE || '85.0');
  if (totalLines.pct < MIN_LINE_COVERAGE) {
    console.error(`\n❌ COMBINED COVERAGE FAILURE: Line coverage ${totalLines.pct}% is below required ${MIN_LINE_COVERAGE}% threshold!`);
    process.exit(1);
  } else {
    console.log(`\n✅ COMBINED COVERAGE PASSED: Line coverage ${totalLines.pct}% >= ${MIN_LINE_COVERAGE}% threshold.`);
  }
}
