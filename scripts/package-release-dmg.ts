import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs"
import { join } from "node:path"

if (process.platform !== "darwin") throw new Error("Release DMG packaging requires macOS")

const root = process.cwd()
const artifactDir = join(root, "artifacts")
const appArchivePath = join(artifactDir, "stable-macos-arm64-Quincy.app.tar.zst")
const dmgPath = join(artifactDir, "stable-macos-arm64-Quincy.dmg")
const stagingDir = join(root, "build", "stable-macos-arm64", ".release-dmg-staging")
const tarPath = join(root, "build", "stable-macos-arm64", ".release-dmg-app.tar")
const zstdPath = join(root, "node_modules", "electrobun", "dist-macos-arm64", "zig-zstd")
const stagedAppPath = join(stagingDir, "Quincy.app")
const developerId = process.env.ELECTROBUN_DEVELOPER_ID
const appleId = process.env.ELECTROBUN_APPLEID
const appleIdPassword = process.env.ELECTROBUN_APPLEIDPASS
const teamId = process.env.ELECTROBUN_TEAMID

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required for signed/notarized release packaging`)
  return value
}

function signDmg(path: string): void {
  execFileSync("codesign", [
    "--force",
    "--verbose",
    "--timestamp",
    "--sign",
    requireEnv("ELECTROBUN_DEVELOPER_ID", developerId),
    path,
  ], { stdio: "inherit" })
}

function notarizeAndStaple(path: string): void {
  execFileSync("xcrun", [
    "notarytool",
    "submit",
    "--apple-id",
    requireEnv("ELECTROBUN_APPLEID", appleId),
    "--password",
    requireEnv("ELECTROBUN_APPLEIDPASS", appleIdPassword),
    "--team-id",
    requireEnv("ELECTROBUN_TEAMID", teamId),
    "--wait",
    path,
  ], { stdio: "inherit" })

  execFileSync("xcrun", ["stapler", "staple", path], { stdio: "inherit" })
  execFileSync("xcrun", ["stapler", "validate", path], { stdio: "inherit" })
}

if (!existsSync(appArchivePath)) throw new Error(`App archive not found: ${appArchivePath}`)
if (!existsSync(zstdPath)) throw new Error(`zig-zstd not found: ${zstdPath}`)
if (!existsSync(artifactDir)) mkdirSync(artifactDir, { recursive: true })

rmSync(stagingDir, { recursive: true, force: true })
rmSync(tarPath, { force: true })
mkdirSync(stagingDir, { recursive: true })

execFileSync(zstdPath, ["decompress", "-i", appArchivePath, "-o", tarPath], { stdio: "inherit" })
execFileSync("/usr/bin/tar", ["-xf", tarPath, "-C", stagingDir], { stdio: "inherit" })

if (!existsSync(stagedAppPath)) throw new Error(`Extracted app bundle not found: ${stagedAppPath}`)

symlinkSync("/Applications", join(stagingDir, "Applications"))

execFileSync("hdiutil", [
  "create",
  "-volname",
  "Quincy",
  "-srcfolder",
  stagingDir,
  "-ov",
  "-format",
  "ULFO",
  dmgPath,
], { stdio: "inherit" })

signDmg(dmgPath)
notarizeAndStaple(dmgPath)

rmSync(stagingDir, { recursive: true, force: true })
rmSync(tarPath, { force: true })
