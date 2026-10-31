#!/usr/bin/env bash
# Sets the version in package.json, package-lock.json and packaging/PKGBUILD.
#
# Usage: scripts/version.sh VERSION
#
# VERSION has no "v", for example 0.2.0 or 0.3.0-rc.1.
set -euo pipefail

if [[ $# -ne 1 || ! "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]]; then
  echo "usage: $0 VERSION (for example 0.2.0)" >&2
  exit 2
fi
version="$1"
cd "$(dirname "$0")/.."

npm version --no-git-tag-version --allow-same-version "$version" >/dev/null
sed -i -e "s/^pkgver=.*/pkgver=${version//-/}/" -e "s/^pkgrel=.*/pkgrel=1/" packaging/PKGBUILD
echo "version $version"
