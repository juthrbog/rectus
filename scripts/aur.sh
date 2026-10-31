#!/usr/bin/env bash
# Writes the AUR PKGBUILD for a release to standard output. It is
# packaging/PKGBUILD with the release version and the real checksum.
#
# Usage: scripts/aur.sh VERSION TARBALL
#
# VERSION is the version without "v", for example 0.2.0. TARBALL is the
# source tarball that scripts/source-tarball.sh wrote for that version.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 VERSION TARBALL" >&2
  exit 2
fi
version="$1"
tarball="$2"
pkgver="${version//-/}"
cd "$(dirname "$0")/.."

if [[ ! "$pkgver" =~ ^[0-9]+\.[0-9]+\.[0-9]+[a-z0-9.]*$ ]]; then
  echo "bad version: $version" >&2
  exit 1
fi
sum="$(sha256sum "$tarball" | cut -d' ' -f1)"

# The release asset has the name rectus-PKGVER.tar.gz, but it is under the
# tag vVERSION, which can have a "-".
sed -e "s/^pkgver=.*/pkgver=$pkgver/" \
    -e "s/^pkgrel=.*/pkgrel=1/" \
    -e "s|^source=.*|source=(\"\$url/releases/download/v$version/\$pkgname-\$pkgver.tar.gz\")|" \
    -e "s/^sha256sums=.*/sha256sums=('$sum')/" \
    -e '/^# The release workflow writes/,/^# writes the tarball next to/d' \
    packaging/PKGBUILD
