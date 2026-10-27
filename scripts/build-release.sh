#!/usr/bin/env bash
# Signed + notarized stable build, then signed + notarized DMG.
#
# Notarization credentials live in the login keychain. One-time setup (prompts
# for the app-specific password from appleid.apple.com):
#   security add-generic-password -s quincy-notarization -a <apple-id> -w
set -euo pipefail

KEYCHAIN_SERVICE="quincy-notarization"

export ELECTROBUN_DEVELOPER_ID="${ELECTROBUN_DEVELOPER_ID:-Developer ID Application: Seth Webster (P8ZBH5878Q)}"
export ELECTROBUN_TEAMID="${ELECTROBUN_TEAMID:-P8ZBH5878Q}"

if [[ -z "${ELECTROBUN_APPLEIDPASS:-}" ]]; then
  ELECTROBUN_APPLEID="$(security find-generic-password -s "$KEYCHAIN_SERVICE" | sed -n 's/^ *"acct"<blob>="\(.*\)"$/\1/p')"
  ELECTROBUN_APPLEIDPASS="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -w)"
fi
export ELECTROBUN_APPLEID ELECTROBUN_APPLEIDPASS

bun run build:css
# release-bin/tar strips xattrs so the archived bundle keeps a valid signature.
PATH="$PWD/scripts/release-bin:$PATH" electrobun build --env=stable
bun scripts/package-release-dmg.ts
