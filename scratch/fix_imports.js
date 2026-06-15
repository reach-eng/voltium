const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'flutter', 'lib', 'features');

function walk(dir) {
  let files = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      files = files.concat(walk(filePath));
    } else if (file.endsWith('.dart')) {
      files.push(filePath);
    }
  }
  return files;
}

const dartFiles = walk(targetDir);
console.log(`Found ${dartFiles.length} Dart files under features/`);

// Regex to match imports starting with relative paths pointing to core folders/files
const relativeImportRegex = /import\s+['"](?:\.\.\/)+(models|providers|services|theme|utils|widgets|gen|core|main\.dart)([\/\'\"])/g;

let fixedCount = 0;

for (const file of dartFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (relativeImportRegex.test(content)) {
    const updated = content.replace(relativeImportRegex, "import 'package:voltium_rider/$1$2");
    fs.writeFileSync(file, updated, 'utf8');
    console.log(`Fixed imports in: ${path.relative(targetDir, file)}`);
    fixedCount++;
  }
}

console.log(`Successfully fixed imports in ${fixedCount} files.`);
