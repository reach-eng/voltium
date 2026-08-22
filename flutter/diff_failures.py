#!/usr/bin/env python3
"""Compare baseline (no changes) vs with-changes (PR-13 attempt-2) test failures."""
import json
import re
from urllib.parse import unquote

def parse_file(path):
    failed_ids = set()
    test_id_to_name = {}
    test_id_to_url = {}
    with open(path, 'r', encoding='utf-8') as f:
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
                    test_id_to_url[t['id']] = t.get('root_url', '') or t.get('url', '') or ''
            elif msg_type == 'testDone':
                result = obj.get('result', '')
                tid = obj.get('testID')
                if result in ('error', 'failure'):
                    failed_ids.add(tid)
    return failed_ids, test_id_to_name, test_id_to_url

def to_path(url):
    if not url:
        return '(suite-level)'
    if url.startswith('file:///'):
        path = unquote(url[8:])
    else:
        path = unquote(url)
    if 'voltium/flutter/test/' in path:
        idx = path.find('voltium/flutter/test/')
        return path[idx:].replace('/', '\\')
    return path

baseline_ids, name_map, url_map = parse_file('test_baseline_json_full.txt')
with_ids, _, _ = parse_file('test_final_json.txt')

new_failures = with_ids - baseline_ids
fixed_failures = baseline_ids - with_ids

print(f"Baseline failures: {len(baseline_ids)}")
print(f"With-changes failures: {len(with_ids)}")
print(f"NEW regressions: {len(new_failures)}")
print(f"FIXED by changes: {len(fixed_failures)}")
print()
if new_failures:
    print("=== NEW REGRESSIONS (need to fix) ===")
    for tid in sorted(new_failures):
        print(f"  [{tid}] {name_map.get(tid, '?')}")
        print(f"      FILE: {to_path(url_map.get(tid, ''))}")
    print()
if fixed_failures:
    print("=== FIXED (working) ===")
    for tid in sorted(fixed_failures):
        print(f"  [{tid}] {name_map.get(tid, '?')}")
