<div align="center">

# ✦ Quincy

**A markdown editor that gets out of your way.**

Glassy, fast, and beautiful — Quincy is a desktop editor where the document *is* the interface. Write in rich text, split view, or raw markdown. Never lose a keystroke. macOS today; Windows and Linux are planned.

<br />

![Status](https://img.shields.io/badge/status-early_development-8b5cf6?style=flat-square)
![Platform](https://img.shields.io/badge/platform-macOS_(Windows_·_Linux_planned)-1f2937?style=flat-square)
![Built with Bun](https://img.shields.io/badge/built_with-Bun-f9f1e1?style=flat-square)
![Powered by Electrobun](https://img.shields.io/badge/powered_by-Electrobun-8b5cf6?style=flat-square)
![License](https://img.shields.io/badge/license-AGPL--3.0-8b5cf6?style=flat-square)

</div>

---

> **Current state:** The editor core works — open, edit, and save local markdown files across all three modes. Real-time Convex sync is wired but not yet deployed to production. The AI assistant panel is in active development. Windows and Linux builds are not yet available.

---

## Why Quincy

Most markdown editors force a choice: *pretty* or *powerful*. Quincy refuses the tradeoff.

- **⚡ Instantaneous** — preview updates in ≤100ms. Typing never stutters.
- **🪟 Glassy & quiet** — frosted panels, dark-mode-first, minimal chrome. The UI recedes so the writing leads.
- **🔒 No content loss, ever** — switch modes mid-sentence and your document survives byte-for-byte.
- **☁️ Real-time sync** — documents stay live across sessions via Convex.
- **🤖 A writing assistant built in** — an AI panel that reads and edits the open document, wired through an MCP bridge.

---

## Three ways to write

| Mode | What it feels like |
|------|--------------------|
| **Rich Text** | Markdown becomes invisible. Headings, bold, lists — you see the result, not the syntax. |
| **Side-by-side** | Raw source on the left, live preview on the right, scrolling in lockstep. |
| **Source + Helpers** | Plain markdown with gentle assists for people who think in `#` and `*`. |

Switch freely. Your content never changes underneath you.

![Rich Text mode](docs/images/mode-rich-text.png)
*Rich Text — markdown invisible.*

![Side-by-side mode](docs/images/mode-split.png)
*Side-by-side — source left, live preview right.*

![Source mode](docs/images/mode-source.png)
*Source + Helpers — raw markdown, gentle assists.*

---

## The feel

Quincy is opinionated about the experience:

- **It recedes** — the chrome disappears; the cursor and your words fill the screen.
- **It's dark by default** — comfortable at midnight, not a concession to trend.
- **It moves like it has weight** — transitions snap, settle, and bounce. Nothing floats or fades arbitrarily.
- **Text is the product** — font sizes, line heights, and spacing are tuned for long-form reading, not UI legibility.

---

## Built with

| Layer | Technology |
|-------|------------|
| Desktop runtime | **Electrobun** — Bun main process + WebView renderer |
| UI | **React** + **TypeScript** + **Tailwind CSS v4** |
| Motion | **Framer Motion** |
| Rich text | **TipTap** |
| Source editing | **CodeMirror 6** |
| Markdown pipeline | **unified / remark / rehype** |
| Sync & data | **Convex** (real-time) |
| Auth | **Convex Auth** — magic link / email OTP, no passwords |
| AI assistant | Local MCP server bridging the editor to a model |

---

## Getting started

> **Requires [Bun](https://bun.sh).** Quincy uses `bun` exclusively — never npm or yarn.

```bash
# Install dependencies
bun install

# Generate Convex types & start the backend (first run provisions your project)
npx convex dev

# Build the renderer stylesheet
bun run build:css

# Launch Quincy
bun run dev
```

If everything worked, Quincy opens to a blank canvas with a sidebar on the left. Open a folder from the sidebar to start browsing and editing markdown files. The first `npx convex dev` will prompt you to log in to Convex and provision a new project — this only happens once.

---

## Project layout

```
quincy/
├── src/
│   ├── bun/              # Main process — RPC, assistant bridge, file I/O
│   ├── mcp/              # Quincy MCP server (assistant ⇄ editor)
│   ├── views/main/       # React renderer
│   │   ├── editor/       # Rich text, split, and source editors
│   │   ├── assistant/    # AI chat panel
│   │   └── rpc/          # Typed bun ⇄ renderer bridge
│   └── shared/           # Shared types
├── convex/               # Real-time backend & schema
└── adr/                  # Architecture Decision Records
```

---

## Contributing

Quincy is early and moving fast. The best first contribution is [opening an issue](../../issues) — a bug you hit, lag you noticed, or UI friction that broke your focus.

When you're ready to write code:

1. **Open or claim an issue** so we're aligned before you build
2. **Fork and branch** — use a descriptive branch name (e.g. `fix/preview-lag` or `feat/word-count`)
3. **Run `bun test`** to confirm nothing broke
4. **Open a PR** — link the issue and describe what changed and why

A few non-negotiables:
- `bun` only — never npm or yarn
- Architecture decisions land as ADRs in `adr/` before code is written
- Treat any perceptible lag as a bug — the editor must feel instantaneous

---

## Licensing

Quincy is **open source under [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.en.html)** — free to use, self-host, and modify.

- **The app is fully open.** Fork it, run it, ship your own build.
- **The hosted backend is a paid service.** Real-time sync, the AI assistant, and account management run on Quincy's cloud. Subscriptions fund the project.
- **AGPL's network clause** means anyone offering Quincy as a hosted service must open-source their modifications too — keeping the ecosystem honest.

Prefer not to self-host? A subscription gets you the hosted experience with zero setup.

> Contributions are welcome under a Contributor License Agreement so the hosted service can build on your work. Not legal advice — see [`LICENSE`](./LICENSE) for the binding terms.

---

<div align="center">
<sub>Built with care. The document is the UI.</sub>
</div>
