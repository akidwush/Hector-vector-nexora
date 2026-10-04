#!/usr/bin/env bash
# Build and deploy Hector Vector Nexora to Cloudflare Pages using Wrangler.
# For Git integration use scripts/build-cloud.sh as the build command and dist
# as the output directory; this script is for manual/direct deployments.
set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/build-cloud.sh

echo "── deploying to Cloudflare Pages (project: hector-vector-nexora) ──"
(cd dist && npx wrangler pages deploy . --project-name hector-vector-nexora --branch main --commit-dirty=true)
