import os
import re

test_dir = r"D:\voltium\flutter\test"

def refactor_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    new_content = content.replace("await tester.pumpAndSettle();", "await tester.pump(const Duration(milliseconds: 500));")
    
    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("Fixed pumpAndSettle in", file_path)

for root, _, files in os.walk(test_dir):
    for f in files:
        if f.endswith("_test.dart"):
            refactor_file(os.path.join(root, f))
