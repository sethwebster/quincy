<div align="center">

# ✦ Quincy

**A markdown editor that gets out of your way.**

Glassy, fast, and beautiful — Quincy is a cross-platform desktop editor where the document *is* the interface. Write in rich text, split view, or raw markdown. Never lose a keystroke.

<br />

![Status](https://img.shields.io/badge/status-early_development-8b5cf6?style=flat-square)
![Platform](https://img.shields.io/badge/platform-macOS_·_Windows_·_Linux-1f2937?style=flat-square)
![Built with Bun](https://img.shields.io/badge/built_with-Bun-f9f1e1?style=flat-square)
![Powered by Electrobun](https://img.shields.io/badge/powered_by-Electrobun-8b5cf6?style=flat-square)
![License](https://img.shields.io/badge/license-AGPL--3.0-8b5cf6?style=flat-square)

</div>

---

## Why Quincy

Most markdown editors force a choice: *pretty* or *powerful*. Quincy refuses the tradeoff.

- **⚡ Instantaneous** — preview debounce ≤100ms, parsing off the main thread. Typing never stutters.
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

| **Rich Text** | **Side-by-side** | **Source + Helpers** |
|:---:|:---:|:---:|
| ![Rich Text mode](file:///Users/sethwebster/Development/quincy/docs/images/mode-rich-text.png) | ![Side-by-side mode](file:///Users/sethwebster/Development/quincy/docs/images/mode-split.png) | ![Source mode](file:///Users/sethwebster/Development/quincy/docs/images/mode-source.png) |
| Markdown, invisible. | Source left, preview right. | Raw markdown, gentle assists. |

---

## The design language

Quincy is opinionated about feel:

- **Frosted glass** — `backdrop-filter` blur on every floating panel.
- **Dark mode first** — light mode is the guest, not the host.
- **Typographic excellence** — the reading experience is the product.
- **Physical motion** — animations via Framer Motion that feel sprung, not scripted.

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

# Generate Convex types & start the backend
npx convex dev

# Build the renderer stylesheet
bun run build:css

# Launch Quincy
bun run dev
```

The first `npx convex dev` provisions your real `_generated/` types and Convex environment. `build:css` must run before the app can launch.

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

Quincy is early and moving fast. A few house rules:

- **`bun` only** — never npm or yarn.
- **Branches** are prefixed `seth/`.
- **Architecture decisions** land as ADRs in `adr/` before implementation.
- **The editor must feel instantaneous** — treat any perceptible lag as a bug.

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
