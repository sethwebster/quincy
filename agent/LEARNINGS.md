# Agent Learnings

- Electrobun native menus can visually react while debugging keyboard focus, but they were not the root cause of the sign-in text-entry issue in this workspace. Check native window key capability and WebKit editable-control CSS before blaming menu accelerators.
- Multiple Electrobun apps (Quincy, Riffle) all run as a process named "bun"; to focus/screenshot Quincy specifically, use `osascript -e 'tell application "<full path to Quincy-dev.app>" to activate'` — System Events frontmost-by-name grabs the wrong app, and `open -a` may not switch Spaces.
- `bun run dev` twice concurrently = two instances racing on ~/.config/quincy/preferences.json; check `ps aux | grep Quincy-dev` first.
- Tailwind's --watch rewrites output.css mid-build; the dev rebuild pipeline must treat a failed CSS copy as non-fatal (fixed in src/bun/index.ts rebuild()).
- Verification evidence for renderer boot: `[quincy] renderer ready — RPC channel up` log line in bun stdout (added 2026-07-01).
- The dev live-reload pipeline (src/bun/index.ts) resolved outDir to a doubled junk path (Contents/Resources/app/Resources/app/...) because import.meta.dir is Resources/app/bun, not Contents/MacOS. Fixed 2026-07-01 (outDir = ../views/main). Before the fix, "[dev] Rebuilt" wrote to the void and reload served stale bundles — renderer changes only ever applied after full app restart.
- Riffle-dev runs its own agent automation and re-steals frontmost within seconds; screenshot Quincy immediately after activate, and don't trust "first process whose frontmost is true".
- ~/.Trash is TCC-protected — shell ls fails even unsandboxed; use Finder via osascript to list/restore trashed items.
- Dev rebuild race: a reload can briefly serve a bundle mid-write (blank "CONVEX_URL is not set" screen). Touch any src file to force a clean rebuild+reload. Consider build-to-temp+rename in the dev pipeline if it recurs.
