import { describe, expect, test } from "bun:test"
import { api } from "./convexApi"

describe("convexApi", () => {
  test("exposes renderer Convex function references", () => {
    expect(api).toHaveProperty("documents.list")
    expect(api).toHaveProperty("documents.get")
    expect(api).toHaveProperty("documents.create")
    expect(api).toHaveProperty("documents.update")
    expect(api).toHaveProperty("documents.remove")
    expect(api).toHaveProperty("assistant.listByDocKey")
    expect(api).toHaveProperty("assistant.appendMessage")
    expect(api).toHaveProperty("assistant.clearThread")
  })
})
