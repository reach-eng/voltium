#!/usr/bin/env python3
"""Parse flutter test --reporter json output to extract failed test names."""
import json
import re
import sys
from urllib.parse import unquote

failed_ids = set()
test_id_to_name = {}
test_id_to_url = {}

with open('test_json_output.txt', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        msg_type = obj.get('type', '')
        if msg_type == 'testStart':
            t = obj.get('test') or {}
            if 'id' in t:
                test_id_to_name[t['id']] = t.get('name', '')
                test_id_to_url[t['id']] = t.get('root_url', '') or t.get('url', '')
        elif msg_type == 'testDone':
            result = obj.get('result', '')
            tid = obj.get('testID')
            if result in ('error', 'failure'):
                failed_ids.add(tid)

# Emit
print(f"Total failed: {len(failed_ids)}")
print()

unique_files = set()
for tid in sorted(failed_ids):
    name = test_id_to_name.get(tid, f"unknown(id={tid})")
    url = test_id_to_url.get(tid, '') or ''
    # Convert file:///D:/... to D:/...
    if url.startswith('file:///'):
        path = unquote(url[8:])
    elif url:
        path = unquote(url)
    else:
        path = '(suite-level)'
    # Strip Dart-style path for non-test files
    if 'voltium/flutter/test/' in path:
        # Extract just the test path
        idx = path.find('voltium/flutter/test/')
        path = path[idx:].replace('/', '\\')
    else:
        path = '(non-test)'
    unique_files.add(path)
    print(f"  [{tid}] {name}")
    print(f"      FILE: {path}")

print()
print(f"=== Unique test files affected ({len(unique_files)}): ===")
for p in sorted(unique_files):
    print(f"  {p}")
