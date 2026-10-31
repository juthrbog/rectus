#!/usr/bin/env bash
# Fails if package.json and packaging/PKGBUILD have different versions, or
# if TAG (optional, for example v0.2.0) does not match them.
#
# Usage: scripts/check-version.sh [TAG]
set -euo pipefail
cd "$(dirname "$0")/.."

version="$(node -p 'require("./package.json").version')"
pkgver="$(sed -n 's/^pkgver=//p' packaging/PKGBUILD)"
status=0
if [[ "$pkgver" != "${version//-/}" ]]; then
  echo "packaging/PKGBUILD has pkgver=$pkgver, but package.json has $version" >&2
  status=1
fi
if [[ $# -ge 1 && "$1" != "v$version" ]]; then
  echo "the tag is $1, but package.json has $version" >&2
  status=1
fi
[[ $status -eq 0 ]] && echo "version $version"
exit $status
