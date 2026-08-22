"""Verify the new section was appended with proper UTF-8."""
import sys

data = open(r"D:\voltium\docs\FOLLOWUP_TICKETS.md", "rb").read()
print("Total bytes:", len(data))
sys.stdout.reconfigure(encoding="utf-8")
text = data.decode("utf-8")
# Find the new section
idx = text.find("Follow-up — Flutter rider app deep audit")
if idx == -1:
    print("ERROR: Section not found!")
    raise SystemExit(1)
print(f"Section starts at byte {idx}")
print("--- Section header ---")
print(text[idx:idx+800])
print()
print("--- Section tail (last 500 chars of file) ---")
print(text[-500:])
