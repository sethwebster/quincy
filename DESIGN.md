# Quincy Design System

## 1. Direction

Quincy uses a quiet glass desktop language: dark surfaces, translucent panels, restrained motion, and text-first hierarchy. The UI should recede so the document remains the primary object.

## 2. Tokens

Colors are defined in `src/views/main/styles/tailwind.css` and must be referenced through CSS variables.

- Surfaces: `--color-surface-0`, `--color-surface-1`, `--color-surface-2`, `--color-surface-3`.
- Glass: `--color-glass-bg`, `--color-glass-border`, `--color-glass-hover`.
- Backdrops: `--color-backdrop-modal`.
- Text: `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-text-placeholder`.
- Accent: `--color-accent`, `--color-accent-dim`, `--color-accent-glow`.
- Semantic: `--color-danger`, `--color-success`, `--color-warning`.

## 3. Typography

- App UI uses the system sans stack from `body`.
- Markdown source and inline code use `JetBrains Mono`, `Fira Code`, `Cascadia Code`, monospace.
- UI text sizes come from Tailwind's default scale: `text-xs`, `text-sm`, `text-base`, `text-lg`.
- Markdown rendered content follows `.editor-content` heading and body rules.

## 4. Spacing And Shape

- Layout spacing uses Tailwind's 4px scale.
- Editor canvas padding is `px-8 py-6`.
- Compact controls use `rounded-md`; panels and modals use `rounded-xl`.
- Borders use `--color-glass-border`.

## 5. Components

- Glass panels use `.glass` or the `Glass` component, with `backdrop-filter` blur and `--color-glass-border`.
- Floating modals use a full-screen dark backdrop plus an elevated glass panel.
- Primary actions use `--color-accent` with white text.
- Secondary actions use transparent or glass-hover backgrounds with `--color-text-secondary`.
- Disabled actions reduce opacity and must keep layout stable.

## 6. Motion

- Use Framer Motion for modal opacity and panel transitions already established in the app.
- Motion must communicate state changes; avoid decorative motion.
- Animate opacity and transform only.

## 7. Accessibility

- Modal controls must be real buttons with clear labels.
- Disabled choices must include concise explanatory copy.
- Focus, keyboard, and screen-reader behavior must remain predictable.
