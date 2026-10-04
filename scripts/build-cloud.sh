#!/usr/bin/env bash
# Build the serverless Cloudflare Pages bundle without deploying it.
# Cloudflare Git integration:
#   Build command: bash scripts/build-cloud.sh
#   Build output directory: dist
set -euo pipefail
cd "$(dirname "$0")/.."

DIST="dist"
rm -rf "$DIST"
mkdir -p "$DIST"

# Static deploy root.
cp -r web/. "$DIST"/
cp -r assets src "$DIST"/
cp tests/companion-spike.html "$DIST"/companion-spike.html
cp tests/pen-probe.html "$DIST"/pen-probe.html

# Wrangler Direct Upload expects functions relative to its invocation directory.
# Git-integrated Pages reads /functions from the repository root; keeping a copy
# in dist preserves both workflows.
cp -r functions "$DIST"/functions

printf 'Cloudflare bundle ready: %s files\n' "$(find "$DIST" -type f | wc -l | tr -d ' ')"
