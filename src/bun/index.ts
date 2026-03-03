import { BrowserWindow, BrowserView, Utils, ApplicationMenu } from "electrobun/bun"
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, watch, copyFileSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { homedir } from "node:os"
import type { AppRPC, AppPreferences, DirEntry } from "../shared/types"
import { DEFAULT_PREFERENCES } from "../shared/types"

// ─── Preferences ────────────────────────────────────────────────────────────

const prefsDir = join(homedir(), ".config", "quincy")
const prefsPath = join(prefsDir, "preferences.json")

function loadPreferences(): AppPreferences {
  try {
    if (existsSync(prefsPath)) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(readFileSync(prefsPath, "utf-8")) }
    }
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_PREFERENCES }
}

function savePreferences(prefs: AppPreferences): void {
  if (!existsSync(prefsDir)) mkdirSync(prefsDir, { recursive: true })
  writeFileSync(prefsPath, JSON.stringify(prefs, null, 2))
}

let prefs = loadPreferences()

// ─── Application menu (MUST be set before BrowserWindow) ────────────────────

ApplicationMenu.setApplicationMenu([
  {
    label: "Quincy",
    submenu: [
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
      { label: "Add Folder…", action: "addFolder", accelerator: "shift+o" },
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
      { label: "Select All", role: "selectAll" },
    ],
  },
  {
    label: "View",
    submenu: [
      { role: "toggleFullScreen" },
    ],
  },
  {
    label: "Window",
    submenu: [
      { label: "Close File", action: "closeFile", accelerator: "w" },
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
  } else if (action === "addFolder") {
    const paths = await Utils.openFileDialog({
      canChooseDirectory: true,
      allowsMultipleSelection: false,
    })
    const first = paths[0]?.trim()
    if (!first) return

    prefs = { ...prefs, workspaceFolders: [...prefs.workspaceFolders, first] }
    savePreferences(prefs)
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
        prefs = { ...prefs, ...patch }
        savePreferences(prefs)
      },
      readFile: async ({ path }) => readFileSync(path, "utf-8"),
      writeFile: async ({ path, content }) => writeFileSync(path, content, "utf-8"),
      showOpenDialog: async () => null,
      showSaveDialog: async () => null,
      showOpenFolderDialog: async () => {
        const paths = await Utils.openFileDialog({
          canChooseDirectory: true,
          allowsMultipleSelection: false,
        })
        const first = paths[0]?.trim()
        return first && first.length > 0 ? first : null
      },
      searchFiles: async ({ roots }) => {
        const results: DirEntry[] = []
        function walk(dir: string) {
          try {
            const entries = readdirSync(dir, { withFileTypes: true })
            for (const entry of entries) {
              if (entry.name.startsWith(".")) continue
              const full = join(dir, entry.name)
              if (entry.isDirectory()) {
                walk(full)
              } else if (entry.name.endsWith(".md")) {
                results.push({ name: entry.name, path: full, isDirectory: false })
              }
            }
          } catch {
            // skip inaccessible dirs
          }
        }
        for (const root of roots) walk(root)
        results.sort((a, b) => a.name.localeCompare(b.name))
        return results
      },
      windowClose: async () => { win.close() },
      windowMinimize: async () => { win.minimize() },
      windowMaximize: async () => { win.maximize() },
      listDirectory: async ({ path }) => {
        try {
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
        } catch {
          return []
        }
      },
    },
    messages: {
      log: ({ msg, level }) => {
        const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log
        fn(`[renderer] ${msg}`)
      },
    },
  },
})

// ─── Window ─────────────────────────────────────────────────────────────────

const savedFrame = prefs.windowFrame ?? { width: 1400, height: 900, x: 100, y: 80 }

const win = new BrowserWindow({
  title: "Quincy",
  frame: savedFrame,
  url: "views://main/index.html",
  titleBarStyle: "hidden",
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

// ─── Dev live reload ────────────────────────────────────────────────────────

const isDev = import.meta.dir.includes("dev-")

if (isDev) {
  // import.meta.dir → .../build/dev-macos-arm64/Quincy-dev.app/Contents/MacOS
  // Walk up to find the project root (directory containing electrobun.config.ts)
  let projectRoot = import.meta.dir
  while (projectRoot !== "/" && !existsSync(join(projectRoot, "electrobun.config.ts"))) {
    projectRoot = dirname(projectRoot)
  }
  const srcViews = join(projectRoot, "src", "views")
  const outDir = resolve(import.meta.dir, "../Resources/app/views/main")
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
      // Also copy CSS if it changed
      const cssSource = join(projectRoot, "src/views/main/styles/output.css")
      const cssDest = join(outDir, "styles/output.css")
      if (existsSync(cssSource)) copyFileSync(cssSource, cssDest)

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

// Expose window for later use
export { win }
