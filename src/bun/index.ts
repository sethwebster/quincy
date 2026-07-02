import Electrobun, { BrowserWindow, BrowserView, Utils, ApplicationMenu } from "electrobun/bun"
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, watch, copyFileSync, renameSync, statSync } from "node:fs"
import { join, resolve, dirname, extname, basename as pathBasename } from "node:path"
import { homedir } from "node:os"
import type { AppRPC, AppPreferences, ContentSearchResult, DirEntry } from "../shared/types"
import { DEFAULT_PREFERENCES } from "../shared/types"
import { appendWorkspaceFolder, normalizeWorkspaceFolders } from "../shared/workspaceFolders"
import { initializeUpdater, checkForUpdatesHandler, applyUpdateHandler } from "./updater"
import {
  markdownPathFromFileUrl,
  normalizeMarkdownFilePath,
  registerMarkdownFileAssociation,
} from "./markdownFileAssociations"
import { tmpdir } from "node:os"
import { startBridge } from "./assistant/bridge"
import { detectBackends } from "./assistant/backends"
import { runTurn, cancelTurn } from "./assistant/runTurn"
import type { AssistantDocSnapshot } from "../shared/types"
import { readMarkdownImageDataUrl, resolveMarkdownImagePath } from "./markdownImages"
import { writeMarkdownAttachmentSidecar } from "./markdownAttachments"
import { FileAccessPolicy } from "./fileAccess"
import { findContentMatches } from "./contentSearch"
import { moveToTrash, renameMarkdownFile } from "./fileOps"

interface OpenUrlEvent {
  data: {
    url: string
  }
}

// ─── Preferences ────────────────────────────────────────────────────────────

const prefsDir = join(homedir(), ".config", "quincy")
const prefsPath = join(prefsDir, "preferences.json")

function loadPreferences(): AppPreferences {
  try {
    if (existsSync(prefsPath)) {
      const loaded = { ...DEFAULT_PREFERENCES, ...JSON.parse(readFileSync(prefsPath, "utf-8")) }
      return { ...loaded, workspaceFolders: normalizeWorkspaceFolders(loaded.workspaceFolders) }
    }
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_PREFERENCES }
}

function savePreferences(prefs: AppPreferences): void {
  if (!existsSync(prefsDir)) mkdirSync(prefsDir, { recursive: true })
  const normalized = { ...prefs, workspaceFolders: normalizeWorkspaceFolders(prefs.workspaceFolders) }
  writeFileSync(prefsPath, JSON.stringify(normalized, null, 2))
}

let prefs = loadPreferences()
registerMarkdownFileAssociation()

// Renderer file access is confined to workspace folders and files the user
// opened through bun-side flows (dialogs, file association, session restore).
const fileAccess = new FileAccessPolicy()
fileAccess.setWorkspaceFolders(prefs.workspaceFolders)
if (prefs.editorSession?.activeFilePath) fileAccess.allowFile(prefs.editorSession.activeFilePath)

let rendererReady = false
const pendingMarkdownFileOpenPaths: string[] = []

function openMarkdownFile(path: string): void {
  fileAccess.allowFile(path)
  if (!rendererReady) {
    pendingMarkdownFileOpenPaths.push(path)
    return
  }

  rpc.send.openFile({ path })
}

function flushPendingMarkdownFileOpens(): void {
  rendererReady = true
  while (pendingMarkdownFileOpenPaths.length > 0) {
    const path = pendingMarkdownFileOpenPaths.shift()
    if (path) rpc.send.openFile({ path })
  }
}

async function showMarkdownOpenDialog(): Promise<string | null> {
  const paths = await Utils.openFileDialog({
    allowedFileTypes: "md",
    canChooseFiles: true,
    canChooseDirectory: false,
    allowsMultipleSelection: false,
  })
  const first = paths[0]?.trim()
  if (!first) return null
  const normalized = normalizeMarkdownFilePath(first)
  if (normalized) fileAccess.allowFile(normalized)
  return normalized
}

// ─── Assistant (Ask-a-Question panel) ───────────────────────────────────────

let assistantSnapshot: AssistantDocSnapshot | null = null
const assistantTmpBase = join(tmpdir(), "quincy-assistant")

// How to launch the Quincy MCP server: the app's bun runtime running either the
// bundled JS (packaged) or the TS source (dev).
function resolveMcpServer(): { cmd: string; args: string[] } {
  // import.meta.dir is .../Resources/app/bun in a packaged build; the bundled
  // MCP server sits at the sibling ../mcp (the old ../Resources/app/… form
  // produced a doubled path that never exists, so packaged builds silently
  // fell back to a nonexistent source path and assistant tools broke).
  const bundled = resolve(import.meta.dir, "../mcp/quincy-mcp-server.js")
  if (existsSync(bundled)) return { cmd: process.execPath, args: ["run", bundled] }
  let projectRoot = import.meta.dir
  while (projectRoot !== "/" && !existsSync(join(projectRoot, "electrobun.config.ts"))) {
    projectRoot = dirname(projectRoot)
  }
  return { cmd: process.execPath, args: ["run", join(projectRoot, "src/mcp/quincy-mcp-server.ts")] }
}

const mcpServer = resolveMcpServer()
const bridge = startBridge({
  onApplyEdit: (edit) => rpc.send.assistantApplyEdit(edit),
})

// ─── Application menu (MUST be set before BrowserWindow) ────────────────────

ApplicationMenu.setApplicationMenu([
  {
    label: "Quincy",
    submenu: [
      { label: "Settings…", action: "settings", accelerator: "," },
      { type: "separator" },
      { role: "hide" },
      { role: "hideOthers" },
      { role: "showAll" },
      { type: "separator" },
      { role: "quit", accelerator: "q" },
    ],
  },
  {
    label: "File",
    submenu: [
      { label: "New File", action: "newFile", accelerator: "n" },
      { label: "Open File…", action: "openFile", accelerator: "o" },
      { label: "Go to File…", action: "quickOpen", accelerator: "p" },
      { label: "Add Folder…", action: "addFolder", accelerator: "shift+o" },
      { type: "separator" },
      { label: "Export as HTML", action: "exportHtml", accelerator: "shift+e" },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { label: "Undo", role: "undo" },
      { label: "Redo", role: "redo" },
      { type: "separator" },
      { label: "Cut", role: "cut" },
      { label: "Copy", role: "copy" },
      { label: "Paste", role: "paste" },
      { type: "separator" },
      { label: "Find", action: "find", accelerator: "f" },
      { type: "separator" },
      { label: "Select All", role: "selectAll" },
    ],
  },
  {
    label: "View",
    submenu: [
      { role: "toggleFullScreen" },
      { type: "separator" },
      { label: "Use Dark Appearance", action: "themeDark" },
      { label: "Use Light Appearance", action: "themeLight" },
      { label: "Use System Appearance", action: "themeSystem" },
    ],
  },
  {
    label: "Window",
    submenu: [
      { label: "Close File", action: "closeFile", accelerator: "w" },
      { label: "Toggle Sidebar", action: "toggleSidebar", accelerator: "b" },
      { label: "Toggle Assistant", action: "toggleAssistant", accelerator: "j" },
      { type: "separator" },
      { role: "minimize" },
      { role: "zoom" },
    ],
  },
])

ApplicationMenu.on("application-menu-clicked", async (e: unknown) => {
  const { action } = (e as { data: { action: string } }).data

  if (action === "closeFile") {
    rpc.send.closeFile({})
  } else if (action === "quickOpen") {
    rpc.send.toggleQuickOpen({})
  } else if (action === "exportHtml") {
    rpc.send.exportHtml({})
  } else if (action === "settings") {
    rpc.send.showSettings({})
  } else if (action === "themeDark" || action === "themeLight" || action === "themeSystem") {
    const theme = action === "themeDark" ? "dark" : action === "themeLight" ? "light" : "system"
    prefs = { ...prefs, theme }
    savePreferences(prefs)
    rpc.send.themeChanged({ theme })
  } else if (action === "find") {
    rpc.send.find({})
  } else if (action === "toggleSidebar") {
    rpc.send.toggleSidebar({})
  } else if (action === "toggleAssistant") {
    rpc.send.toggleAssistant({})
  } else if (action === "newFile") {
    rpc.send.newFile({})
  } else if (action === "openFile") {
    const path = await showMarkdownOpenDialog()
    if (!path) return

    openMarkdownFile(path)
  } else if (action === "addFolder") {
    const paths = await Utils.openFileDialog({
      canChooseDirectory: true,
      allowsMultipleSelection: false,
    })
    const first = paths[0]?.trim()
    if (!first) return

    fileAccess.approveFolder(first)
    prefs = { ...prefs, workspaceFolders: appendWorkspaceFolder(prefs.workspaceFolders, first) }
    savePreferences(prefs)
    fileAccess.setWorkspaceFolders(prefs.workspaceFolders)
    rpc.send.workspaceFoldersChanged({ folders: prefs.workspaceFolders })
  }
})

// ─── RPC ────────────────────────────────────────────────────────────────────

const rpc = BrowserView.defineRPC<AppRPC>({
  maxRequestTime: 10000,
  handlers: {
    requests: {
      getPreferences: async () => prefs,
      setPreferences: async (patch) => {
        // Folder additions must come through a native dialog; the renderer
        // can't grant itself access to new directories via preferences.
        if (patch.workspaceFolders) {
          for (const folder of patch.workspaceFolders) {
            if (!fileAccess.isFolderPermitted(folder)) {
              throw new Error(`Workspace folder not approved: ${folder}`)
            }
          }
        }
        if (patch.editorSession?.activeFilePath) {
          fileAccess.assertAllowed(patch.editorSession.activeFilePath)
        }
        const next = { ...prefs, ...patch }
        prefs = {
          ...next,
          workspaceFolders: normalizeWorkspaceFolders(next.workspaceFolders),
        }
        savePreferences(prefs)
        fileAccess.setWorkspaceFolders(prefs.workspaceFolders)
      },
      readFile: async ({ path }) => {
        fileAccess.assertAllowed(path)
        return {
          content: readFileSync(path, "utf-8"),
          mtimeMs: statSync(path).mtimeMs,
        }
      },
      // The resolved image path must ALSO pass the policy (or live inside the
      // markdown file's own directory tree) — otherwise a hostile document can
      // use ../ or file:// image URLs to read files anywhere on disk.
      readMarkdownImage: async ({ markdownPath, imageUrl }) => {
        fileAccess.assertAllowed(markdownPath)
        const imagePath = resolveMarkdownImagePath(markdownPath, imageUrl)
        if (!imagePath) return null
        const mdDir = dirname(resolve(markdownPath))
        const insideMdDir = resolve(imagePath).startsWith(mdDir + "/")
        if (!insideMdDir) fileAccess.assertAllowed(imagePath)
        return readMarkdownImageDataUrl(markdownPath, imageUrl)
      },
      writeMarkdownAttachment: async (input) => {
        fileAccess.assertAllowed(input.markdownPath)
        return writeMarkdownAttachmentSidecar(input).url
      },
      // Atomic write: a crash mid-write must never truncate the user's file.
      // With expectedMtimeMs, refuses to clobber a file modified externally
      // since it was read.
      writeFile: async ({ path, content, expectedMtimeMs }) => {
        fileAccess.assertWritable(path)
        if (expectedMtimeMs !== undefined && existsSync(path)) {
          const currentMtimeMs = statSync(path).mtimeMs
          if (currentMtimeMs !== expectedMtimeMs) {
            throw new Error("File changed on disk since it was opened")
          }
        }
        const tmp = join(dirname(path), `.${pathBasename(path)}.quincy-tmp`)
        writeFileSync(tmp, content, "utf-8")
        renameSync(tmp, path)
        return { mtimeMs: statSync(path).mtimeMs }
      },
      showOpenDialog: showMarkdownOpenDialog,
      showOpenFolderDialog: async () => {
        const paths = await Utils.openFileDialog({
          canChooseDirectory: true,
          allowsMultipleSelection: false,
        })
        const first = paths[0]?.trim()
        if (!first || first.length === 0) return null
        fileAccess.approveFolder(first)
        return first
      },
      searchFiles: async ({ roots }) => {
        // Bounded walk: a workspace folder pointed at ~ must not block the
        // bun event loop indefinitely or return an unbounded payload.
        const MAX_DEPTH = 12
        const MAX_RESULTS = 5_000
        const results: DirEntry[] = []
        function walk(dir: string, depth: number) {
          if (depth > MAX_DEPTH || results.length >= MAX_RESULTS) return
          let entries
          try {
            entries = readdirSync(dir, { withFileTypes: true })
          } catch {
            return // inaccessible dir: skip, the rest of the walk still counts
          }
          for (const entry of entries) {
            if (results.length >= MAX_RESULTS) return
            if (entry.name.startsWith(".") || entry.name === "node_modules") continue
            const full = join(dir, entry.name)
            if (entry.isDirectory()) {
              walk(full, depth + 1)
            } else if (entry.name.endsWith(".md")) {
              results.push({ name: entry.name, path: full, isDirectory: false })
            }
          }
        }
        for (const root of roots) {
          fileAccess.assertAllowed(root)
          walk(root, 0)
        }
        results.sort((a, b) => a.name.localeCompare(b.name))
        return results
      },
      // Bounded full-text search over workspace markdown files.
      searchContent: async ({ roots, query }) => {
        const MAX_DEPTH = 12
        const MAX_FILES = 2_000
        const MAX_FILE_BYTES = 1_000_000
        const MAX_RESULTS = 100
        const MAX_PER_FILE = 3
        const trimmed = query.trim()
        if (!trimmed) return []

        const files: { name: string; path: string }[] = []
        function collect(dir: string, depth: number) {
          if (depth > MAX_DEPTH || files.length >= MAX_FILES) return
          let entries
          try {
            entries = readdirSync(dir, { withFileTypes: true })
          } catch {
            return
          }
          for (const entry of entries) {
            if (files.length >= MAX_FILES) return
            if (entry.name.startsWith(".") || entry.name === "node_modules") continue
            const full = join(dir, entry.name)
            if (entry.isDirectory()) collect(full, depth + 1)
            else if (entry.name.endsWith(".md")) files.push({ name: entry.name, path: full })
          }
        }
        for (const root of roots) {
          fileAccess.assertAllowed(root)
          collect(root, 0)
        }

        const results: ContentSearchResult[] = []
        for (const file of files) {
          if (results.length >= MAX_RESULTS) break
          try {
            if (statSync(file.path).size > MAX_FILE_BYTES) continue
            const content = readFileSync(file.path, "utf-8")
            for (const match of findContentMatches(content, trimmed, MAX_PER_FILE)) {
              results.push({ path: file.path, name: file.name, ...match })
              if (results.length >= MAX_RESULTS) break
            }
          } catch {
            continue // unreadable file: skip, keep searching the rest
          }
        }
        return results
      },
      renameFile: async ({ path, newName }) => {
        fileAccess.assertAllowed(path)
        const newPath = renameMarkdownFile(path, newName)
        fileAccess.allowFile(newPath)
        return { newPath }
      },
      // Recoverable delete: the file moves to the user's Trash, never unlinked.
      deleteFile: async ({ path }) => {
        fileAccess.assertAllowed(path)
        moveToTrash(path)
      },
      checkForUpdates: checkForUpdatesHandler,
      applyUpdate: applyUpdateHandler,
      assistantBackends: async () => detectBackends(),
      // Throws on unreadable dirs: a permission failure must not render as an
      // empty folder. The renderer catches and surfaces it (useFileTree).
      listDirectory: async ({ path }) => {
        fileAccess.assertAllowed(path)
        const entries = readdirSync(path, { withFileTypes: true })
        const result: DirEntry[] = []
        for (const entry of entries) {
          if (entry.name.startsWith(".")) continue
          if (entry.isDirectory()) {
            result.push({ name: entry.name, path: join(path, entry.name), isDirectory: true })
          } else if (entry.name.endsWith(".md")) {
            result.push({ name: entry.name, path: join(path, entry.name), isDirectory: false })
          }
        }
        result.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        return result
      },
    },
    messages: {
      log: ({ msg, level }) => {
        const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log
        fn(`[renderer] ${msg}`)
      },
      rendererReady: () => {
        console.log("[quincy] renderer ready — RPC channel up")
        flushPendingMarkdownFileOpens()
      },
      syncAssistantDoc: (snapshot) => {
        assistantSnapshot = snapshot
        bridge.setSnapshot(snapshot)
      },
      assistantAsk: ({ turnId, backend, question, history }) => {
        void runTurn(
          { turnId, backend, question, history },
          {
            getSnapshot: () => assistantSnapshot,
            bridgeUrl: bridge.url,
            bridgeToken: bridge.token,
            mcpServerCmd: mcpServer.cmd,
            mcpServerArgs: mcpServer.args,
            tmpDir: join(assistantTmpBase, turnId),
            emit: {
              chunk: (id, delta) => rpc.send.assistantChunk({ turnId: id, delta }),
              toolUse: (id, label) =>
                rpc.send.assistantToolUse({ turnId: id, toolUseId: crypto.randomUUID(), label }),
              done: (id) => rpc.send.assistantDone({ turnId: id }),
              error: (id, message) => rpc.send.assistantError({ turnId: id, message }),
            },
          },
        )
      },
      assistantCancel: ({ turnId }) => cancelTurn(turnId),
      assistantEditApplied: ({ editId, ok, error }) => bridge.resolveEdit(editId, ok, error),
    },
  },
})

Electrobun.events.on("open-url", (event: OpenUrlEvent) => {
  const path = markdownPathFromFileUrl(event.data.url)
  if (path) openMarkdownFile(path)
})

// ─── Window ─────────────────────────────────────────────────────────────────

const savedFrame = prefs.windowFrame ?? { width: 1400, height: 900, x: 100, y: 80 }

const win = new BrowserWindow({
  title: "Quincy",
  frame: savedFrame,
  url: "views://main/index.html",
  titleBarStyle: "hiddenInset",
  rpc,
})

// Persist window frame on move/resize (debounced)
let frameSaveTimer: ReturnType<typeof setTimeout> | null = null

function persistFrame() {
  if (frameSaveTimer) clearTimeout(frameSaveTimer)
  frameSaveTimer = setTimeout(() => {
    const frame = win.getFrame()
    prefs = { ...prefs, windowFrame: frame }
    savePreferences(prefs)
  }, 500)
}

win.on("resize", persistFrame)
win.on("move", persistFrame)

// Ensure WKWebView is the first responder so keyboard events reach web content
setTimeout(() => win.focus(), 200)

// ─── Dev live reload ────────────────────────────────────────────────────────

const isDev = import.meta.dir.includes("dev-")

if (isDev) {
  // import.meta.dir → .../Quincy-dev.app/Contents/Resources/app/bun (the
  // bundled bun code). The served views live at the sibling views/ dir —
  // resolving via ../Resources/app used to produce a junk doubled path, so
  // live rebuilds wrote to the void and reload served stale bundles.
  // Walk up to find the project root (directory containing electrobun.config.ts)
  let projectRoot = import.meta.dir
  while (projectRoot !== "/" && !existsSync(join(projectRoot, "electrobun.config.ts"))) {
    projectRoot = dirname(projectRoot)
  }
  const srcViews = join(projectRoot, "src", "views")
  const outDir = resolve(import.meta.dir, "../views/main")
  if (!existsSync(join(outDir, "index.html"))) {
    console.warn(`[dev] Live-reload outDir looks wrong (${outDir}) — rebuilds may not land`)
  }
  const entrypoint = join(projectRoot, "src", "views", "main", "index.tsx")
  // Read CONVEX_URL from .env (same logic as electrobun.config.ts)
  function readConvexUrl(): string {
    for (const file of [".env", ".env.local"]) {
      try {
        for (const line of readFileSync(join(projectRoot, file), "utf-8").split("\n")) {
          const t = line.trim()
          if (!t || t.startsWith("#")) continue
          const eq = t.indexOf("=")
          if (eq < 0) continue
          if (t.slice(0, eq).trim() === "CONVEX_URL") return t.slice(eq + 1).split(" #")[0].trim()
        }
      } catch {}
    }
    return ""
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  async function rebuild() {
    const start = performance.now()
    try {
      const result = await Bun.build({
        entrypoints: [entrypoint],
        outdir: outDir,
        target: "browser",
        define: {
          "process.env.CONVEX_URL": JSON.stringify(readConvexUrl()),
        },
      })
      if (!result.success) {
        console.error("[dev] Build failed:", result.logs.join("\n"))
        return
      }
      // Also copy CSS if it changed. Tailwind's watcher rewrites the file, so
      // it can vanish between the exists check and the copy — a missed CSS
      // copy must not abort the reload of a successful JS rebuild.
      try {
        const cssSource = join(projectRoot, "src/views/main/styles/output.css")
        const cssDest = join(outDir, "styles/output.css")
        if (existsSync(cssSource)) copyFileSync(cssSource, cssDest)
      } catch (cssError) {
        console.warn("[dev] CSS copy skipped (mid-rewrite):", cssError)
      }

      console.log(`[dev] Rebuilt in ${(performance.now() - start).toFixed(0)}ms`)
      rpc.send.reload({})
    } catch (e) {
      console.error("[dev] Rebuild error:", e)
    }
  }

  watch(srcViews, { recursive: true }, (_event, filename) => {
    if (!filename || filename.includes("node_modules")) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(rebuild, 200)
  })

  console.log("[dev] Watching src/views/ for changes")
}

// ─── Updater ────────────────────────────────────────────────────────────────

initializeUpdater((payload) => rpc.send.updateStatus(payload))

// Expose window for later use