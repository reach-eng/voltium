const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'flutter', 'lib', 'features', 'kyc', 'presentation', 'screens', 'user_onboarding_screen.dart');
let content = fs.readFileSync(filePath, 'utf8');

const startKeyword = '  Widget _buildPersonalDetailsCard() {';
const endKeyword = '  void _showBankDialog() {';

const startIndex = content.indexOf(startKeyword);
const endIndex = content.indexOf(endKeyword);

if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
  content = content.substring(0, startIndex) + content.substring(endIndex);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully cleaned up user_onboarding_screen.dart');
} else {
  console.error('Failed to locate start or end keywords in file.');
}
