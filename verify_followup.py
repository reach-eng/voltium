import sys
data = open(r'D:\voltium\docs\FOLLOWUP_TICKETS.md', 'rb').read()
print('Total bytes:', len(data))
# Decode and re-encode to verify UTF-8 round-trip
text = data.decode('utf-8')
# Just print a safe window
sys.stdout.reconfigure(encoding='utf-8')
# Show the last portion as UTF-8
print('--- Last 1500 chars (UTF-8 decoded) ---')
print(text[-1500:])
