#!/usr/bin/env bash
# Build the Cloudflare Workers Static Assets bundle without deploying it.
#
# Cloudflare dashboard settings:
#   Build command:  bash scripts/build-cloud.sh
#   Deploy command: npx wrangler deploy
#   Root directory: /
set -euo pipefail
cd "$(dirname "$0")/.."

DIST="dist"
rm -rf "$DIST"
mkdir -p "$DIST"

# Copy the browser runtime.
cp -r web/. "$DIST"/
cp -r assets src "$DIST"/
cp tests/companion-spike.html "$DIST"/companion-spike.html
cp tests/pen-probe.html "$DIST"/pen-probe.html

# The deployed product is the editor itself. Keep /app as an alternate clean
# route, but make the root URL open the editor too.
cp web/app.html "$DIST/index.html"

# /functions is a Pages-only runtime convention. The current Cloudflare project
# deploys with `wrangler deploy` (Workers Static Assets), so do not copy Pages
# Functions into the public asset bundle.
rm -rf "$DIST/functions"

printf 'Cloudflare Workers bundle ready: %s files\n' "$(find "$DIST" -type f | wc -l | tr -d ' ')"
