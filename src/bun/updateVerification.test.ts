import { describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { parseTeamIdentifier, verifyUpdateTar } from "./updateVerification"

describe("parseTeamIdentifier", () => {
  test("should extract the team from codesign -dv output", () => {
    const output = [
      "Executable=/Applications/Quincy.app/Contents/MacOS/launcher",
      "Identifier=sh.quincy.app",
      "TeamIdentifier=P8ZBH5878Q",
      "Sealed Resources version=2",
    ].join("\n")
    expect(parseTeamIdentifier(output)).toBe("P8ZBH5878Q")
  })

  test("should return null for ad-hoc signatures", () => {
    expect(parseTeamIdentifier("Identifier=x\nTeamIdentifier=not set\n")).toBeNull()
  })

  test("should return null when the field is absent", () => {
    expect(parseTeamIdentifier("Identifier=x\n")).toBeNull()
  })
})

describe("verifyUpdateTar", () => {
  test("should refuse a tar with no app bundle inside", async () => {
    const dir = mkdtempSync(join(tmpdir(), "quincy-verify-test-"))
    writeFileSync(join(dir, "readme.txt"), "not an app")
    const tarPath = join(dir, "update.tar")
    Bun.spawnSync(["/usr/bin/tar", "-cf", tarPath, "-C", dir, "readme.txt"])
    const result = await verifyUpdateTar(tarPath)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no \.app bundle/)
  })

  test("should refuse an unsigned app bundle", async () => {
    const dir = mkdtempSync(join(tmpdir(), "quincy-verify-test-"))
    const appDir = join(dir, "Fake.app", "Contents", "MacOS")
    mkdirSync(appDir, { recursive: true })
    writeFileSync(join(appDir, "fake"), "#!/bin/sh\n")
    const tarPath = join(dir, "update.tar")
    Bun.spawnSync(["/usr/bin/tar", "-cf", tarPath, "-C", dir, "Fake.app"])
    const result = await verifyUpdateTar(tarPath)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/signature invalid/)
  })

  test("should refuse an unreadable tar without throwing", async () => {
    const result = await verifyUpdateTar("/nonexistent/update.tar")
    expect(result.ok).toBe(false)
  })
})
