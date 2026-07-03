# Quincy design system — how to build with it

Quincy is a **dark-first** desktop markdown editor. Its language is quiet glass:
translucent surfaces, restrained motion, text-first hierarchy. The components below
are the real, shipped React components — compose them, don't reimplement them.

## Setup: no provider, but render on a dark surface

None of these components need a context provider — import and use them directly.
But they are **dark-first** and style themselves through CSS custom properties, so
a design must render them on a Quincy surface or they'll look unstyled (light text
on white). Put your layout on `var(--color-surface-0)` and default the page to dark.
Light appearance is opt-in by setting `data-theme="light"` on `<html>`; the same
tokens flip automatically, so never hard-code hex — always go through the tokens.

## Styling idiom: Tailwind v4 + CSS custom properties

Style with the design tokens, not raw colors. All are `var(--color-*)`:

| Group | Tokens |
|---|---|
| Surfaces | `--color-surface-0` (app canvas) `--color-surface-1` `--color-surface-2` `--color-surface-3` |
| Glass | `--color-glass-bg` `--color-glass-border` `--color-glass-hover` |
| Text | `--color-text-primary` `--color-text-secondary` `--color-text-muted` `--color-text-placeholder` |
| Accent | `--color-accent` (#7c6af7) `--color-accent-dim` `--color-accent-glow` |
| Semantic | `--color-danger` `--color-success` `--color-warning` |
| Backdrop | `--color-backdrop-modal` (modal scrim) |

The `.glass` utility class is the frosted-panel primitive (translucent bg + blurred
backdrop) — or just use the `Glass` component. Radii: `rounded-md` for compact
controls, `rounded-xl` for panels/modals.

**Tailwind v4 gotcha:** to reference a token in a utility class, write
`bg-[var(--color-accent)]` or `bg-(--color-accent)` — NOT the v3 shorthand
`bg-[--color-accent]`, which v4 compiles to invalid CSS (no color). Inline
`style={{ color: "var(--color-accent)" }}` is always safe and is what most
Quincy components use.

## Where the truth lives

- `styles.css` (and its `@import` closure) — the full token + component stylesheet.
  Read it before styling.
- Each component's `<Name>.d.ts` (the exact prop contract) and `<Name>.prompt.md`.

## Idiomatic example

```tsx
import { Glass, Button } from "quincy"

// Everything sits on a dark Quincy surface; controls carry the design language.
function UnsavedChangesPanel() {
  return (
    <div style={{ background: "var(--color-surface-0)", padding: 24 }}>
      <Glass elevated style={{ padding: 16, borderRadius: 12, maxWidth: 320 }}>
        <p style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>Unsaved changes</p>
        <p style={{ color: "var(--color-text-secondary)", fontSize: 13, marginTop: 4 }}>
          This document has edits that haven't been written to disk.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Button variant="ghost">Discard</Button>
          <Button variant="primary">Save changes</Button>
        </div>
      </Glass>
    </div>
  )
}
```

Primary actions use `<Button variant="primary">` (accent fill); secondary use
`variant="ghost"`; destructive use `variant="danger"`. Overlays (`QuickOpenModal`,
`MarkdownAttachmentStorageModal`, `TreeContextMenu`) already render their own
full-screen scrim — mount them at the top level of your view.
