#!/usr/bin/env bash
# Runs scripts/ci-package.sh in an archlinux:base-devel container. It is for
# the Ubuntu runners of GitHub Actions.
#
# Usage: scripts/ci-container.sh REF VERSION OUTDIR
#
# The self-test runs Chromium with its sandbox, and the sandbox needs user
# namespaces. Ubuntu 24.04 blocks them through AppArmor, and the default
# seccomp profile of Docker blocks them in a container. This script allows
# them for the container. A "container:" job cannot change the host, so the
# workflows call this script instead.
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: $0 REF VERSION OUTDIR" >&2
  exit 2
fi
cd "$(dirname "$0")/.."

sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
# shellcheck disable=SC2016 # $@ expands in the container shell.
docker run --rm --security-opt seccomp=unconfined \
  -v "$PWD:/src" -w /src archlinux:base-devel \
  bash -euo pipefail -c '
    echo "::group::Install tools"
    pacman -Syu --noconfirm --needed git nodejs namcap desktop-file-utils xorg-server-xvfb
    echo "::endgroup::"
    scripts/ci-package.sh "$@"
  ' bash "$@"
