import os
import re

lib_dir = "d:/voltium/flutter/lib"
test_dir = "d:/voltium/flutter/test"

def get_class_name(file_content):
    matches = re.findall(r'class\s+([A-Za-z0-9_]+)\s+extends\s+(?:StatelessWidget|StatefulWidget|ConsumerWidget|ConsumerStatefulWidget)', file_content)
    matches = [m for m in matches if not m.startswith('_')]
    return matches[0] if matches else None

created_count = 0
for root, dirs, files in os.walk(lib_dir):
    for file in files:
        if file.endswith('.dart'):
            is_widget = 'widgets' in root.split(os.sep) or file.endswith('_widget.dart')
            is_screen = 'screens' in root.split(os.sep) or file.endswith('_screen.dart')
            
            if is_widget or is_screen:
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                class_name = get_class_name(content)
                if class_name:
                    rel_path = os.path.relpath(file_path, lib_dir)
                    import_path = rel_path.replace(os.sep, '/')
                    
                    test_rel_path = rel_path.replace('.dart', '_test.dart')
                    test_file_path = os.path.join(test_dir, test_rel_path)
                    
                    if not os.path.exists(test_file_path):
                        os.makedirs(os.path.dirname(test_file_path), exist_ok=True)
                        depth = len(test_rel_path.split(os.sep)) - 1
                        helper_path = '../' * depth + 'helpers/golden_test_helper.dart'
                        
                        test_content = f"""import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/{import_path}';
import '{helper_path}';

void main() {{
  testWidgets('Golden test for {class_name}', (WidgetTester tester) async {{
    configureGoldenSurface(tester);
    
    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden({class_name}()));
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType({class_name}),
      matchesGoldenFile('goldens/{class_name.lower()}_golden.png'),
    );
  }});
}}
"""
                        with open(test_file_path, 'w', encoding='utf-8') as f:
                            f.write(test_content)
                        created_count += 1
                        print(f"Created {test_file_path}")

print(f"Total created: {created_count}")
