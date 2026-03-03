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
})
