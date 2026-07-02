import { describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  compareVersionNumbers,
  parseTeamIdentifier,
  validateBundleMetadata,
  verifyUpdateTar,
} from "./updateVerification"

const verificationContext = {
  currentVersion: "0.1.0",
  expectedVersion: "0.2.0",
} as const

const validInfoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.quincy.app</string>
  <key>CFBundleShortVersionString</key>
  <string>0.2.0</string>
  <key>CFBundleVersion</key>
  <string>0.1.1</string>
</dict>
</plist>
`

describe("parseTeamIdentifier", () => {
  test("should extract the team from codesign -dv output", () => {
    const output = [
      "Executable=/Applications/Quincy.app/Contents/MacOS/launcher",
      "Identifier=com.quincy.app",
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

describe("compareVersionNumbers", () => {
  test("should order dotted numeric versions by segment", () => {
    expect(compareVersionNumbers("0.2.0", "0.1.9")).toBe(1)
    expect(compareVersionNumbers("0.1.0", "0.1")).toBe(0)
    expect(compareVersionNumbers("0.1.0", "0.1.1")).toBe(-1)
  })

  test("should reject non-numeric versions", () => {
    expect(compareVersionNumbers("0.2.0-beta", "0.1.0")).toBeNull()
  })
})

describe("validateBundleMetadata", () => {
  test("should accept Quincy metadata for the expected release and forward bundle version", () => {
    const result = validateBundleMetadata(
      {
        bundleName: "Quincy.app",
        bundleIdentifier: "com.quincy.app",
        shortVersion: "0.2.0",
        bundleVersion: "0.1.1",
      },
      verificationContext,
    )
    expect(result.ok).toBe(true)
  })

  test("should reject a tar for another app bundle", () => {
    const result = validateBundleMetadata(
      {
        bundleName: "Other.app",
        bundleIdentifier: "com.quincy.app",
        shortVersion: "0.2.0",
        bundleVersion: "0.1.1",
      },
      verificationContext,
    )
    expect(result).toEqual({ ok: false, reason: "unexpected app bundle Other.app, expected Quincy.app" })
  })

  test("should reject a tar signed for another bundle identifier", () => {
    const result = validateBundleMetadata(
      {
        bundleName: "Quincy.app",
        bundleIdentifier: "com.attacker.app",
        shortVersion: "0.2.0",
        bundleVersion: "0.1.1",
      },
      verificationContext,
    )
    expect(result).toEqual({ ok: false, reason: "bundle id com.attacker.app, expected com.quincy.app" })
  })

  test("should reject release metadata that does not match the expected version", () => {
    const result = validateBundleMetadata(
      {
        bundleName: "Quincy.app",
        bundleIdentifier: "com.quincy.app",
        shortVersion: "0.3.0",
        bundleVersion: "0.1.1",
      },
      verificationContext,
    )
    expect(result).toEqual({ ok: false, reason: "release version 0.3.0, expected 0.2.0" })
  })

  test("should reject a bundle version that is not newer than the installed version", () => {
    const result = validateBundleMetadata(
      {
        bundleName: "Quincy.app",
        bundleIdentifier: "com.quincy.app",
        shortVersion: "0.2.0",
        bundleVersion: "0.1.0",
      },
      verificationContext,
    )
    expect(result).toEqual({ ok: false, reason: "bundle version 0.1.0 must be greater than current 0.1.0" })
  })
})

describe("verifyUpdateTar", () => {
  test("should refuse a tar with no app bundle inside", async () => {
    const dir = mkdtempSync(join(tmpdir(), "quincy-verify-test-"))
    writeFileSync(join(dir, "readme.txt"), "not an app")
    const tarPath = join(dir, "update.tar")
    Bun.spawnSync(["/usr/bin/tar", "-cf", tarPath, "-C", dir, "readme.txt"])
    const result = await verifyUpdateTar(tarPath, verificationContext)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/no \.app bundle/)
  })

  test("should refuse an unsigned app bundle", async () => {
    const dir = mkdtempSync(join(tmpdir(), "quincy-verify-test-"))
    const appDir = join(dir, "Quincy.app", "Contents", "MacOS")
    mkdirSync(appDir, { recursive: true })
    writeFileSync(join(appDir, "fake"), "#!/bin/sh\n")
    writeFileSync(join(dir, "Quincy.app", "Contents", "Info.plist"), validInfoPlist)
    const tarPath = join(dir, "update.tar")
    const createTar = Bun.spawnSync(["/usr/bin/tar", "-cf", tarPath, "-C", dir, "Quincy.app"])
    expect(createTar.exitCode).toBe(0)
    const result = await verifyUpdateTar(tarPath, verificationContext)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/signature invalid/)
  })

  test("should refuse an unreadable tar without throwing", async () => {
    const result = await verifyUpdateTar("/nonexistent/update.tar", verificationContext)
    expect(result.ok).toBe(false)
  })
})
