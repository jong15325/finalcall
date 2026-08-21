#!/usr/bin/env python3
import os
import re
import sys
from pathlib import Path


root = Path(sys.argv[1])
patterns = {
    "authorization-header-value": re.compile(
        rb"(?i)\bauthorization\s*[:=]\s*(?!\[AUTH_HEADER_REDACTED\])(?:bearer\s+)?\S+"
    ),
    "bearer-token": re.compile(rb"(?i)\bbearer\s+[A-Za-z0-9._-]+"),
    "jwt": re.compile(rb"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"),
}
runtime_secrets = {
    name: os.environ.get(name, "").encode()
    for name in ("JWT_SECRET", "GATEWAY_INTERNAL_SECRET", "CHAT_LOAD_PASSWORD")
}

findings = []
for path in sorted(item for item in root.rglob("*") if item.is_file()):
    content = path.read_bytes()
    kinds = [name for name, pattern in patterns.items() if pattern.search(content)]
    kinds.extend(
        f"runtime-secret:{name}"
        for name, secret in runtime_secrets.items()
        if secret and secret in content
    )
    if kinds:
        findings.append((path.relative_to(root), sorted(set(kinds))))

for path, kinds in findings:
    print(f"SECRET_SCAN_FAILED: file={path} kinds={','.join(kinds)}", file=sys.stderr)
if findings:
    raise SystemExit(1)
