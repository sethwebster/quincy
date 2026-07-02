import { defineSchema, defineTable } from "convex/server"
import { authTables } from "@convex-dev/auth/server"
import { v } from "convex/values"

export default defineSchema({
  ...authTables,

  documents: defineTable({
    userId: v.id("users"),
    title: v.string(),
    content: v.string(), // stored as markdown
  })
    .index("by_user", ["userId"]),

  // Per-document assistant chat. docKey = `conv:<documentId>` for Convex docs,
  // `file:<absolutePath>` for local files.
  assistantMessages: defineTable({
    userId: v.id("users"),
    docKey: v.string(),
    turnId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_docKey", ["userId", "docKey"]),
})
