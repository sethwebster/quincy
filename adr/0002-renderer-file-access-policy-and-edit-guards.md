# 0002 — Renderer file-access policy, assistant edit guards, and save integrity

- **Status:** Proposed
- **Date:** 2026-07-01

## Context

A security and quality review found four related weaknesses in the trust and
data-integrity model:

1. **Unrestricted RPC file access.** `readFile`/`writeFile`/`listDirectory`/
   `searchFiles` accepted any absolute path from the renderer. A compromised
   renderer (XSS, malicious dependency) had full-disk read/write as the user.
   There was no Content-Security-Policy on the webview.
2. **Unauthorized-feeling assistant edits.** MCP `edit_document` replaced the
   whole document from a ~300ms-stale snapshot with no target check: an edit
   could land on a different document than it was computed for (the user
   switched files mid-turn) or clobber keystrokes typed during the turn. The
   Codex backend was spawned with `--dangerously-bypass-approvals-and-sandbox`,
   turning a prompt-injected document into unsandboxed code execution.
3. **Racy auto-save.** Two parallel debounce effects marked the document clean
   after a write finished even if newer content had been typed during the
   write, silently dropping edits; switching files cancelled pending saves.
4. **Non-atomic writes.** A crash mid-`writeFileSync` could truncate the file;
   externally modified files were clobbered blindly.

## Decisions

### 1. `FileAccessPolicy` — the bun process stops trusting the renderer

`src/bun/fileAccess.ts` confines renderer-initiated file RPC to:

- workspace folders from validated preferences,
- folders the user approved through a native dialog **this session**,
- individual files the user opened via dialog, OS file association, or a
  restored session (registered bun-side with `allowFile`).

`setPreferences` rejects workspace folders the policy hasn't seen — the
renderer cannot grant itself access by writing preferences. All file RPC
handlers call `assertAllowed` and fail loud. `index.html` now carries a CSP
(`script-src 'self' views:`, no inline script) to shrink the blast radius of
renderer compromise in the first place.

### 2. Assistant edits carry provenance and are rejected when stale

`AssistantEdit` now includes `docKey` (the document the edit targets) and
`baseContent` (the content it was computed from). The bridge rejects edits for
documents that are no longer open (409); the renderer rejects edits whose
`baseContent` no longer matches the live content and tells the model to
re-read. Switching documents cancels the running turn. Codex runs with
`--sandbox read-only`; a test asserts the bypass flag never returns.

### 3. `DocumentSaver` — one race-safe save path

`src/views/main/editor/documentSaver.ts` serializes writes, only reports a
save when the exact (path, content) pair landed — the caller marks clean only
if that content is still current — and exposes `flush()` used on file switch,
close, new document, and window close. File and Convex saves share it. Save
failures surface in a visible banner and stay pending for retry.

### 4. Atomic, guarded disk writes

`writeFile` writes tmp+rename and, given `expectedMtimeMs`, refuses to
overwrite a file modified outside Quincy. `readFile` returns
`{ content, mtimeMs }` so the renderer tracks what it read.

### 5. Update-channel integrity gate

Inspection of Electrobun's `Updater` confirmed it performs no cryptographic
verification of downloaded artifacts (its "hash" is a version label read from
the artifact itself) and strips quarantine attributes from the swapped-in
bundle, so Gatekeeper never re-checks it — a compromised release server would
be silent RCE on every install. `applyUpdateHandler` now refuses to apply an
update unless the downloaded tar contains an `.app` that passes
`codesign --verify --deep --strict` and is signed by Quincy's Team ID
(`src/bun/updateVerification.ts`). Server compromise alone can no longer ship
code; an attacker would also need the Apple signing identity.

## Alternatives considered

- **Full sandboxing of the renderer path space via chroot/sandbox-exec** —
  heavier, platform-specific, and unnecessary while the bun process can
  enforce an allowlist at the RPC boundary.
- **Diff/confirm UI before assistant edits** — deferred as a product decision;
  the provenance guards plus native undo cover the integrity risk, a confirm
  gate covers the consent question (tracked separately).
- **Content hash instead of mtime for external-change detection** — hashing
  large files on every save is wasteful; mtime is cheap and adequate for
  detecting out-of-band writes, with the tmp+rename keeping writes atomic.
- **Keeping Codex bypass with a user toggle** — rejected: the prompt embeds
  attacker-controllable document content, so this is an unsafe default under
  prompt injection regardless of consent UI.

## Consequences

- The renderer can no longer open arbitrary paths programmatically; any new
  file-open flow must register the path bun-side (dialog, association, or
  workspace membership). This is the intended constraint.
- The CSP allows `ws:`/`wss:`/`https:` connects (Convex deployment URLs vary)
  and `views:` for Electrobun assets; it must be runtime-verified against the
  Electrobun RPC transport before release.
- `readFile`/`writeFile` RPC shapes changed; all callers were updated in the
  same change.
- Assistant edits computed from stale content now fail with an instruction to
  re-read instead of applying — occasionally costing the model a retry, never
  costing the user their keystrokes.
