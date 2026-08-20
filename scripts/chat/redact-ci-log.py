#!/usr/bin/env python3
import os
import re
import sys
from pathlib import Path


source = Path(sys.argv[1])
target = Path(sys.argv[2])
text = source.read_text(encoding="utf-8", errors="replace")
for name in ("JWT_SECRET", "GATEWAY_INTERNAL_SECRET", "CHAT_LOAD_PASSWORD"):
    secret = os.environ.get(name)
    if secret:
        text = text.replace(secret, "[REDACTED]")
text = re.sub(r"(?i)authorization\s*[:=]\s*(?:bearer\s+)?\S+", "[AUTH_HEADER_REDACTED]", text)
text = re.sub(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "[JWT_REDACTED]", text)
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(text, encoding="utf-8")
