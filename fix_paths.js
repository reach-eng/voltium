const fs = require('fs');
const path = require('path');

function processDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('_golden_test.dart')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('../../helpers/golden_test_harness.dart')) {
                // If it's in a subdirectory like 'widgets', we only need '../helpers'
                // We calculate depth based on the path relative to 'test'
                const relPath = path.relative(path.join(__dirname, 'flutter/test'), fullPath);
                const depth = relPath.split(path.sep).length - 1; // 1 for widgets, 5 for features/...
                
                let prefix = '';
                for (let i=0; i<depth; i++) prefix += '../';
                
                content = content.replace(/import '.*\/helpers\/golden_test_harness\.dart';/g, `import '${prefix}helpers/golden_test_harness.dart';`);
                content = content.replace(/import '.*\/helpers\/golden_test_helper\.dart';/g, `import '${prefix}helpers/golden_test_helper.dart';`);
                
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Fixed paths for ${fullPath}`);
            }
        }
    }
}

processDirectory(path.join(__dirname, 'flutter/test/widgets'));
processDirectory(path.join(__dirname, 'flutter/test/features'));
