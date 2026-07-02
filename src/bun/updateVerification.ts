import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

/**
 * Update-channel integrity gate.
 *
 * Electrobun's updater performs NO cryptographic verification of downloaded
 * artifacts (its "hash" is a version label read from the artifact itself) and
 * strips quarantine attributes on the swapped-in bundle, so Gatekeeper never
 * re-checks it. That makes a compromised release server a silent RCE on every
 * install. This gate extracts the downloaded tar and requires a valid Apple
 * code signature from OUR team before the update is allowed to apply.
 */

/** Quincy's Apple Developer Team ID; must match the release signing identity. */
export const EXPECTED_TEAM_ID = "P8ZBH5878Q"
export const EXPECTED_APP_BUNDLE_NAME = "Quincy.app"
export const EXPECTED_BUNDLE_ID = "com.quincy.app"

export type UpdateVerificationContext = {
  readonly currentVersion: string
  readonly expectedVersion: string
}

export type BundleMetadata = {
  readonly bundleName: string
  readonly bundleIdentifier: string
  readonly shortVersion: string
  readonly bundleVersion: string
}

export type UpdateVerification =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string }

/** Parse `TeamIdentifier=XXXX` out of `codesign -dv` output. */
export function parseTeamIdentifier(codesignOutput: string): string | null {
  const match = codesignOutput.match(/^TeamIdentifier=(.+)$/m)
  const team = match?.[1]?.trim()
  return team && team !== "not set" ? team : null
}

async function run(cmd: string[]): Promise<{ readonly ok: boolean; readonly output: string }> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { ok: exitCode === 0, output: stdout + stderr }
}

function parseVersionSegments(version: string): readonly number[] | null {
  if (!/^\d+(?:\.\d+)*$/.test(version)) return null
  return version.split(".").map((segment) => Number(segment))
}

export function compareVersionNumbers(candidate: string, current: string): -1 | 0 | 1 | null {
  const candidateSegments = parseVersionSegments(candidate)
  const currentSegments = parseVersionSegments(current)
  if (!candidateSegments || !currentSegments) return null

  const length = Math.max(candidateSegments.length, currentSegments.length)
  for (let index = 0; index < length; index++) {
    const candidateSegment = candidateSegments[index] ?? 0
    const currentSegment = currentSegments[index] ?? 0
    if (candidateSegment > currentSegment) return 1
    if (candidateSegment < currentSegment) return -1
  }
  return 0
}

export function validateBundleMetadata(
  metadata: BundleMetadata,
  context: UpdateVerificationContext,
): UpdateVerification {
  if (metadata.bundleName !== EXPECTED_APP_BUNDLE_NAME) {
    return { ok: false, reason: `unexpected app bundle ${metadata.bundleName}, expected ${EXPECTED_APP_BUNDLE_NAME}` }
  }
  if (metadata.bundleIdentifier !== EXPECTED_BUNDLE_ID) {
    return { ok: false, reason: `bundle id ${metadata.bundleIdentifier}, expected ${EXPECTED_BUNDLE_ID}` }
  }
  if (metadata.shortVersion !== context.expectedVersion) {
    return { ok: false, reason: `release version ${metadata.shortVersion}, expected ${context.expectedVersion}` }
  }
  if (compareVersionNumbers(metadata.bundleVersion, context.currentVersion) !== 1) {
    return {
      ok: false,
      reason: `bundle version ${metadata.bundleVersion} must be greater than current ${context.currentVersion}`,
    }
  }
  return { ok: true }
}

function firstAppBundleName(names: readonly string[]): string | null {
  for (const name of names) {
    if (name.endsWith(".app")) return name
  }
  return null
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function readPlistStringValue(plistContent: string, key: string): string | null {
  const match = plistContent.match(new RegExp(`<key>${escapeRegex(key)}</key>\\s*<string>([^<]+)</string>`))
  return match?.[1]?.trim() ?? null
}

function readBundleMetadata(appPath: string, bundleName: string): UpdateVerification | BundleMetadata {
  const plistContent = readFileSync(join(appPath, "Contents", "Info.plist"), "utf8")
  const bundleIdentifier = readPlistStringValue(plistContent, "CFBundleIdentifier")
  const shortVersion = readPlistStringValue(plistContent, "CFBundleShortVersionString")
  const bundleVersion = readPlistStringValue(plistContent, "CFBundleVersion")
  if (!bundleIdentifier) return { ok: false, reason: "missing CFBundleIdentifier in update app" }
  if (!shortVersion) return { ok: false, reason: "missing CFBundleShortVersionString in update app" }
  if (!bundleVersion) return { ok: false, reason: "missing CFBundleVersion in update app" }

  return {
    bundleName,
    bundleIdentifier,
    shortVersion,
    bundleVersion,
  }
}

/** Extract the downloaded update tar and verify the .app inside is validly
 *  signed by EXPECTED_TEAM_ID with Quincy's bundle identity and a forward
 *  version. Never throws; an unverifiable update is a refusal, not a crash. */
export async function verifyUpdateTar(
  tarPath: string,
  context: UpdateVerificationContext,
): Promise<UpdateVerification> {
  const workDir = mkdtempSync(join(tmpdir(), "quincy-update-verify-"))
  try {
    const extract = await run(["/usr/bin/tar", "-xf", tarPath, "-C", workDir])
    if (!extract.ok) return { ok: false, reason: `couldn't extract update tar: ${extract.output.slice(0, 200)}` }

    const extractedNames = readdirSync(workDir)
    const firstAppBundle = firstAppBundleName(extractedNames)
    const appBundle = extractedNames.includes(EXPECTED_APP_BUNDLE_NAME) ? EXPECTED_APP_BUNDLE_NAME : firstAppBundle
    if (!appBundle) return { ok: false, reason: "no .app bundle inside update tar" }
    const appPath = join(workDir, appBundle)

    const metadata = readBundleMetadata(appPath, appBundle)
    if ("ok" in metadata) return metadata
    const metadataVerification = validateBundleMetadata(metadata, context)
    if (!metadataVerification.ok) return metadataVerification

    const verify = await run(["/usr/bin/codesign", "--verify", "--deep", "--strict", appPath])
    if (!verify.ok) return { ok: false, reason: `code signature invalid: ${verify.output.slice(0, 200)}` }

    const details = await run(["/usr/bin/codesign", "-dv", appPath])
    const team = parseTeamIdentifier(details.output)
    if (team !== EXPECTED_TEAM_ID) {
      return { ok: false, reason: `signed by team ${team ?? "unknown"}, expected ${EXPECTED_TEAM_ID}` }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, reason: `verification failed: ${error instanceof Error ? error.message : String(error)}` }
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}
