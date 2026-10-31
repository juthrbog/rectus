#!/usr/bin/env bash
# Render PNG icons from the SVG sources. Needs rsvg-convert (librsvg).
set -euo pipefail
cd "$(dirname "$0")/../assets"
for s in 16 32 48 64 128 256 512; do
  rsvg-convert -w "$s" -h "$s" icon.svg -o "icons/$s.png"
done
cp icons/256.png icon.png
rsvg-convert -w 32 -h 32 tray.svg -o tray.png
rsvg-convert -w 32 -h 32 tray-unread.svg -o tray-unread.png
