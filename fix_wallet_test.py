import re

file_path = r"D:\voltium\flutter\test\wallet\wallet_screen_enhanced_test.dart"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

new_content = content.replace("await tester.pumpAndSettle();", "await tester.pump(const Duration(milliseconds: 500));")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Fixed wallet_screen_enhanced_test.dart")
