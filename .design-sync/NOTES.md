# design-sync notes — Quincy

Repo-specific gotchas for future syncs. Read this first.

## What Quincy is
Quincy is a **desktop markdown editor app** (Electrobun + React + Convex), not a
component library. `package.json` is `private`, has no `main`/`module`/`exports`,
and there is no `dist/`. design-sync runs in **package shape, synth-entry mode**,
but with a **curated entry** to keep the app's backend out of the bundle.

## Build model (important)
- **Curated entry**: `.design-sync/entry.tsx` re-exports ONLY the 10
  presentational leaf components. Pass it via `--entry .design-sync/entry.tsx`.
  Do NOT let the converter synthesize an entry from `src/` — that does
  `export * from` every file and pulls Convex/RPC/Electrobun/TipTap/CodeMirror
  into the bundle (breaks the build / massive bloat).
- Keep `entry.tsx` and `componentSrcMap` (config.json) in sync — same 10 names.
- **Before the converter, run `bun run build:css`** (persisted as `cfg.buildCmd`)
  to refresh `src/views/main/styles/output.css`. That compiled Tailwind file is
  `cfg.cssEntry` and carries everything: the `@theme` `--color-*` tokens, the
  `.glass` primitive, editor typography, and the `html[data-theme="light"]`
  override. There is no separate tokens package.
- `--node-modules` → repo-root `node_modules` (react is externalized; framer-motion,
  lucide-react, react-markdown, remark-gfm bundle from there).

## Scope decisions
- **10 components** (Button, Glass, Spinner, ModeToggle, Toolbar, FindReplacePanel,
  ChatMessage, TreeContextMenu, MarkdownAttachmentStorageModal, QuickOpenModal).
  Chosen because they render standalone from props/mock data with zero coupling
  to RPC / Convex / EditorContext.
- **Excluded**: everything importing RPC/Convex/EditorContext or needing a live
  editor ref/hook — Sidebar, SourceEditor, RichTextEditor, MarkdownPreview,
  SettingsModal (via `useSettings`), AssistantPanel/Minimap, DocumentList,
  FileTreeList, SignIn, App. Re-including any of these needs a stubbed hook or
  provider — do not add without deliberately solving that.
- User was away when the extra-component / group-label questions were asked;
  defaults taken: **keep at 10** and **folder-derived groups**. Both re-askable.

## Groups
Path-derived (folder names): `main` (the 3 primitives), `editor`, `assistant`,
`sidebar`, `quickopen`. `main` is awkward for primitives. To get a real taxonomy
(Primitives/Controls/Overlays/Content) without moving files, add a one-line JSDoc
`/** @category Primitives */` above each component export (also enriches its
`.prompt.md`) — deferred to avoid touching app source in this run.

## Styling / rendering
- Dark-first: `@theme` defines dark tokens at `:root`; `html[data-theme="light"]`
  overrides. Preview cards render dark by default (correct — matches the app).
- Component styling is entirely Tailwind v4 utility classes + `var(--color-*)`.
  `output.css` only contains utilities used by scanned `src/` — so **author
  preview scaffolding with inline styles + the components' own classes**, never
  novel Tailwind classes (they won't be in output.css → unstyled).

## Overlay components (need cfg.overrides on render)
- QuickOpenModal, MarkdownAttachmentStorageModal, TreeContextMenu render as
  overlays/positioned menus. Expect to set
  `cfg.overrides.<Name>: {"cardMode": "single", "viewport": "WxH"}` so the open
  state renders inside the card instead of escaping/collapsing.

## Fonts — SHIPPED (2026-07-03)
The mono stack ("JetBrains Mono", "Fira Code", "Cascadia Code") is now shipped, so
`[FONT_MISSING]` no longer fires. woff2 (OFL, from @fontsource via jsdelivr) live in
`.design-sync/fonts/` with `.design-sync/fonts/fonts.css` (@font-face for all three,
+ JetBrains Mono bold). Wired via `cfg.extraFonts: ".design-sync/fonts/fonts.css"`.
The converter copies them to `ds-bundle/fonts/` and adds `@import "./fonts/fonts.css"`
to styles.css so they reach designs. `extraFonts` is bounded to the repo, so the
fonts MUST live inside the repo (not `~/Library/Fonts`). The FONT_MISSING check flags
EACH undeclared non-generic family individually — that's why all three are shipped,
not just the primary. If a family is renamed in the app CSS, update fonts.css to match.

## Tailwind v4 bug fixed in app source (2026-07-03)
While verifying Button, found the app used the Tailwind **v3** arbitrary-value
shorthand `bg-[--color-accent]` / `text-[--color-x]`, which Tailwind v4 compiles
to invalid CSS (`background-color: --color-accent`, no `var()`) → **primary
buttons rendered with NO fill in the shipped app**. Fixed 6 occurrences
(`[--color-x]` → `[var(--color-x)]`) in `Button.tsx` (5) and `AssistantPanel.tsx`
(3, out of DS scope but same bug). v4 also accepts `bg-(--color-x)`. If new
`[--color-*]` usages appear, they're broken — fix them.

## Dark-first previews: each cell provides its own surface
The DS-pane card body is WHITE (`background:#fff` in each `<Name>.html`), and the
isolated grading capture composites onto white too. Quincy is dark-first (light
text), so every preview cell MUST set its own dark stage
(`background: var(--color-surface-0)` or `surface-1`) or it renders invisible.
All 10 previews do this. Do the same for any new preview.

## Overlay/fixed previews need a transform wrapper
QuickOpenModal / MarkdownAttachmentStorageModal / TreeContextMenu use
`position: fixed inset-0`, which collapses the measured mount to 0px (→
`[RENDER_THIN]`/`[RENDER_BLANK]`). Each preview wraps the component in a sized box
with `transform: translateZ(0)` — that makes the box the containing block for the
fixed overlay, so it fills the box and the card measures real height. Keep this.

## Known render warns / capture limitations (triaged, not new)
- **QuickOpenModal & MarkdownAttachmentStorageModal grade "good" but appear BLANK
  in `_screenshots/review/` (the grading capture).** Root cause: both use
  framer-motion `initial={{opacity:0}} animate={{opacity:1}}` entrance animations
  (WAAPI opacity), and `package-capture.mjs`'s fixed clock freezes the document
  timeline → opacity stuck at 0. They render CORRECTLY in the product `.html`
  (validate render check passes 10/10, live clock). Verified via a live-clock
  screenshot (`.ds-sync/shoot-modals.mjs` — a scratch helper, not committed).
  On re-sync: a blank review sheet for these two is EXPECTED — re-verify with a
  live-clock render, don't treat as a regression. The two bundled framer
  instances (preview vs bundle) don't share context, so MotionConfig can't fix it
  from the preview side.

## Re-sync risks
- `entry.tsx` is hand-maintained; if a curated component is renamed/moved in the
  app, update both `entry.tsx` and `componentSrcMap` or the build breaks.
- `output.css` is a build artifact checked into the repo; always `bun run build:css`
  before syncing so it reflects current component classes.
- `.d.ts` contracts are extracted from `src/` (no shipped types) — if extraction
  is weak for a component, add `cfg.dtsPropsFor.<Name>` (prop interfaces are
  simple and visible in each source file).
- No `--entry` config field exists; the entry path lives only here and in the
  re-sync command. Re-sync: `node .ds-sync/resync.mjs --config .design-sync/config.json
  --node-modules node_modules --entry .design-sync/entry.tsx --out ./ds-bundle
  --remote .design-sync/.cache/remote-sync.json`.
