import { mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return await ctx.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect()
  },
})

export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Unauthenticated")
    const doc = await ctx.db.get(id)
    if (!doc || doc.userId !== userId) throw new Error("Not found")
    return doc
  },
})

export const create = mutation({
  args: {
    title: v.string(),
    content: v.optional(v.string()),
  },
  handler: async (ctx, { title, content = "" }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Unauthenticated")
    return await ctx.db.insert("documents", { userId, title, content })
  },
})

export const update = mutation({
  args: {
    id: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, { id, title, content }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Unauthenticated")
    const doc = await ctx.db.get(id)
    if (!doc || doc.userId !== userId) throw new Error("Not found")
    const patch: { title?: string; content?: string } = {}
    if (title !== undefined) patch.title = title
    if (content !== undefined) patch.content = content
    await ctx.db.patch(id, patch)
  },
})

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Unauthenticated")
    const doc = await ctx.db.get(id)
    if (!doc || doc.userId !== userId) throw new Error("Not found")
    await ctx.db.delete(id)
  },
})
