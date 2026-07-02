#!/usr/bin/env bun
/**
 * Electrobun postBuild hook.
 *
 * 1. Bundles the Quincy MCP server (with the MCP SDK inlined) into every built
 *    app bundle's `Resources/app/mcp/quincy-mcp-server.js`, so the packaged app
 *    can spawn it via `process.execPath run <that file>`. In dev the server runs
 *    straight from TS source, so this only matters for `electrobun build`.
 * 2. Delegates to `scripts/register-markdown-documents.ts` if it exists, so that
 *    (separate) postBuild step still runs.
 *
 * Env provided by Electrobun: ELECTROBUN_BUILD_DIR, ELECTROBUN_APP_NAME, …
 */
import { readdirSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"

const projectRoot = process.cwd()
const buildDir = process.env.ELECTROBUN_BUILD_DIR ?? join(projectRoot, "build")
const mcpEntry = join(projectRoot, "src/mcp/quincy-mcp-server.ts")

/** Recursively find every `Resources/app` directory under `root`. */
function findAppDirs(root: string, out: string[] = [], depth = 0): string[] {
  if (depth > 8 || !existsSync(root)) return out
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return out
  }
  for (const name of entries) {
    const full = join(root, name)
    let isDir = false
    try {
      isDir = statSync(full).isDirectory()
    } catch {
      continue
    }
    if (!isDir) continue
    if (name === "app" && full.endsWith(join("Resources", "app"))) {
      out.push(full)
    } else {
      findAppDirs(full, out, depth + 1)
    }
  }
  return out
}

const appDirs = findAppDirs(buildDir)
if (appDirs.length === 0) {
  console.warn(`[postbuild] No Resources/app directories found under ${buildDir}; skipping MCP bundle.`)
}

for (const appDir of appDirs) {
  const outdir = join(appDir, "mcp")
  const result = await Bun.build({
    entrypoints: [mcpEntry],
    outdir,
    target: "bun",
    naming: "quincy-mcp-server.js",
  })
  if (!result.success) {
    console.error(`[postbuild] Failed to bundle MCP server into ${outdir}:`, result.logs.join("\n"))
    process.exit(1)
  }
  console.log(`[postbuild] Bundled MCP server → ${join(outdir, "quincy-mcp-server.js")}`)
}

// Chain the markdown-registration postBuild step if it's present.
const markdownScript = join(projectRoot, "scripts/register-markdown-documents.ts")
if (existsSync(markdownScript)) {
  const proc = Bun.spawnSync([process.execPath, markdownScript], {
    stdio: ["ignore", "inherit", "inherit"],
    cwd: projectRoot,
    env: process.env,
  })
  if (proc.exitCode !== 0) process.exit(proc.exitCode ?? 1)
}
