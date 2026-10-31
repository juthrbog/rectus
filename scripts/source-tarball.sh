#!/usr/bin/env bash
# Writes the source tarball of a git revision, for the PKGBUILD.
#
# Usage: scripts/source-tarball.sh REF OUTDIR
#
# REF is a tag such as v0.2.0, or HEAD for a snapshot. The tarball is
# OUTDIR/rectus-PKGVER.tar.gz with the top folder rectus-PKGVER/. PKGVER is
# the version in package.json without "-", because pkgver cannot have "-".
# The same commit gives the same bytes: git archive uses the commit time,
# and gzip -n stores no file name or time.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 REF OUTDIR" >&2
  exit 2
fi
ref="$1"
outdir="$2"
cd "$(dirname "$0")/.."

version="$(git show "$ref:package.json" | node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0)).version)')"
pkgver="${version//-/}"
mkdir -p "$outdir"
out="$outdir/rectus-$pkgver.tar.gz"
git archive --format=tar --prefix="rectus-$pkgver/" "$ref" | gzip -n -9 > "$out"
echo "$out"
