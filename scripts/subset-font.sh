#!/usr/bin/env bash
# Builds the embedded PDF font: Noto Sans Regular (SIL OFL 1.1), subset to the
# Latin ranges accepted by src/pdf/charset.ts. Requires fonttools (pip install fonttools).
# Usage: scripts/subset-font.sh path/to/NotoSans-Regular.ttf
set -euo pipefail
SRC="${1:?path to NotoSans-Regular.ttf}"
OUT="$(dirname "$0")/../public/fonts/NotoSans-Regular-latin.ttf"
# Keep in sync with ALLOWED_RANGES in src/pdf/charset.ts
UNICODES="U+0020-007E,U+00A0-024F,U+0259,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+1E00-1EFF,U+2010-2015,U+2018-201E,U+2020-2022,U+2026,U+2030,U+2039-203A,U+20AC,U+2116,U+2122"
pyftsubset "$SRC" --unicodes="$UNICODES" --layout-features='kern' --no-hinting \
  --desubroutinize --name-IDs='*' --name-languages='*' --notdef-outline --output-file="$OUT"
echo "Wrote $OUT ($(wc -c < "$OUT") bytes)"
