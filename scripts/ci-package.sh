#!/usr/bin/env bash
# Builds, checks, installs and runs the Arch package. CI and the release
# workflow run this in an archlinux:base-devel container, as root.
#
# Usage: scripts/ci-package.sh REF VERSION OUTDIR
#
# REF is the git revision to package (a tag, or HEAD). VERSION is the
# version without "v". OUTDIR gets the source tarball, the AUR PKGBUILD and
# .SRCINFO, and the package.
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: $0 REF VERSION OUTDIR" >&2
  exit 2
fi
ref="$1"
version="$2"
outdir="$(realpath -m "$3")"
cd "$(dirname "$0")/.."
# The checkout belongs to the runner user, not to root.
git config --global --add safe.directory "$PWD"

# makepkg does not run as root. It builds as the user "builder".
id builder >/dev/null 2>&1 || useradd -m builder
build="$(mktemp -d)"
chown builder: "$build"

tarball="$(scripts/source-tarball.sh "$ref" "$build")"
scripts/aur.sh "$version" "$tarball" > "$build/PKGBUILD"
chown builder: "$build"/*

echo "::group::makepkg"
# --nodeps: the build needs no dependencies. pacman installs them below.
su builder -c "cd '$build' && makepkg --nodeps --clean --cleanbuild --noconfirm && makepkg --printsrcinfo > .SRCINFO"
echo "::endgroup::"

echo "::group::namcap"
namcap "$build/PKGBUILD"
namcap "$build"/rectus-*.pkg.tar.zst
echo "::endgroup::"

echo "::group::Install"
pacman -U --noconfirm "$build"/rectus-*.pkg.tar.zst
desktop-file-validate /usr/share/applications/io.github.juthrbog.Rectus.desktop
echo "::endgroup::"

# The self-test loads the Linear login page in a temporary profile. It runs
# as a normal user, because Chromium does not run as root with its sandbox.
echo "::group::Self-test"
su builder -c 'xvfb-run -a rectus --self-test'
echo "::endgroup::"

mkdir -p "$outdir"
cp "$tarball" "$build/PKGBUILD" "$build/.SRCINFO" "$build"/rectus-*.pkg.tar.zst "$outdir/"
ls -la "$outdir"
