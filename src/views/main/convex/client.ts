import { ConvexReactClient } from "convex/react"

// Bun inlines process.env at build time via electrobun.config.ts `define`.
// Set CONVEX_URL in .env.local before running.
const url = process.env.CONVEX_URL as string | undefined

export const convex = url ? new ConvexReactClient(url) : null
