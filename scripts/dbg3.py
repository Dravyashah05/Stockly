import re, json
s = open(r'C:\Users\dravy_qci9mn7\.local\share\opencode\tool-output\tool_139b92a5f001qvUOKC5WGpgQ28', encoding='utf-8').read()
print('apk mentions:', len(re.findall(r'stockly-1\.0\.0\.apk', s)))
print('SHA256SUMS mentions:', len(re.findall(r'SHA256SUMS', s)))
print('release.json mentions:', len(re.findall(r'release\.json', s)))
print('browser_download mentions:', len(re.findall(r'browser_download', s)))
# find embedded JSON blobs with asset info
for m in re.finditer(r'"name"\s*:\s*"([^"]*\.apk)"', s):
    print('APK-NAME:', m.group(1))
for m in re.finditer(r'"size"\s*:\s*(\d+)', s):
    pass
# look for download URLs of any kind
seen = set()
for m in re.finditer(r'https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/releases/download/[^\s"\']+', s):
    if m.group(0) not in seen:
        seen.add(m.group(0)); print('DL:', m.group(0))
print('done')
