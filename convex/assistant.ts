import { mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"

export const listByDocKey = query({
  args: { docKey: v.string() },
  handler: async (ctx, { docKey }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    // Bounded: the most recent 500 messages of the thread, oldest first.
    const recent = await ctx.db
      .query("assistantMessages")
      .withIndex("by_docKey", (q) => q.eq("userId", userId).eq("docKey", docKey))
      .order("desc")
      .take(500)
    return recent.reverse()
  },
})

export const appendMessage = mutation({
  args: {
    docKey: v.string(),
    turnId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, { docKey, turnId, role, content }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Unauthenticated")
    return await ctx.db.insert("assistantMessages", {
      userId,
      docKey,
      turnId,
      role,
      content,
      createdAt: Date.now(),
    })
  },
})

export const clearThread = mutation({
  args: { docKey: v.string() },
  handler: async (ctx, { docKey }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Unauthenticated")
    // Delete in bounded batches instead of loading the whole thread at once.
    const BATCH = 500
    for (;;) {
      const rows = await ctx.db
        .query("assistantMessages")
        .withIndex("by_docKey", (q) => q.eq("userId", userId).eq("docKey", docKey))
        .take(BATCH)
      if (rows.length === 0) break
      await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
      if (rows.length < BATCH) break
    }
  },
})
