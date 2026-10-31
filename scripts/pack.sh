#!/usr/bin/env bash
# Makes the source tarball that packaging/PKGBUILD expects, from the local
# files (also changes that are not committed). makepkg uses this file and
# does not download the release tarball.
set -euo pipefail
cd "$(dirname "$0")/.."
version="$(node -p 'require("./package.json").version')"
pkgver="${version//-/}"
out="packaging/rectus-$pkgver.tar.gz"
tar --exclude=./node_modules --exclude=./.git --exclude=./packaging/src \
  --exclude=./packaging/pkg --exclude='./packaging/*.tar.*' \
  --transform "s,^\.,rectus-$pkgver," -czf "$out" .
echo "$out"
