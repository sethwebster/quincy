import { readFileSync } from "fs"
import { resolve } from "path"
import type { ElectrobunConfig } from "electrobun"

function loadDotEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const file of [".env", ".env.local"]) {
    try {
      for (const line of readFileSync(resolve(file), "utf-8").split("\n")) {
        const t = line.trim()
        if (!t || t.startsWith("#")) continue
        const eq = t.indexOf("=")
        if (eq < 0) continue
        env[t.slice(0, eq).trim()] = t.slice(eq + 1).split(" #")[0].trim()
      }
    } catch {}
  }
  return env
}

const dotenv = loadDotEnv()
const CONVEX_URL = process.env.CONVEX_URL ?? dotenv.CONVEX_URL ?? ""

export default {
  app: {
    name: "Quincy",
    identifier: "com.quincy.app",
    version: "0.1.0",
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    views: {
      main: {
        entrypoint: "src/views/main/index.tsx",
        define: {
          "process.env.CONVEX_URL": JSON.stringify(CONVEX_URL),
        },
      },
    },
    copy: {
      "src/views/main/index.html": "views/main/index.html",
      "src/views/main/styles/output.css": "views/main/styles/output.css",
    },
  },
  release: {
    baseUrl: "https://quincy.app/releases/",
  },
} satisfies ElectrobunConfig
