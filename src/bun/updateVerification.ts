import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

/**
 * Update-channel integrity gate.
 *
 * Electrobun's updater performs NO cryptographic verification of downloaded
 * artifacts (its "hash" is a version label read from the artifact itself) and
 * strips quarantine attributes on the swapped-in bundle, so Gatekeeper never
 * re-checks it. That makes a compromised release server a silent RCE on every
 * install. This gate extracts the downloaded tar and requires a valid Apple
 * code signature from OUR team before the update is allowed to apply —
 * turning "compromise the web server" into "steal the signing identity".
 */

/** Quincy's Apple Developer Team ID — must match the release signing identity
 *  (see build:release in package.json). */
export const EXPECTED_TEAM_ID = "P8ZBH5878Q"

/** Parse `TeamIdentifier=XXXX` out of `codesign -dv` output. */
export function parseTeamIdentifier(codesignOutput: string): string | null {
  const match = codesignOutput.match(/^TeamIdentifier=(.+)$/m)
  const team = match?.[1]?.trim()
  return team && team !== "not set" ? team : null
}

async function run(cmd: string[]): Promise<{ ok: boolean; output: string }> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { ok: exitCode === 0, output: stdout + stderr }
}

export interface UpdateVerification {
  ok: boolean
  reason?: string
}

/** Extract the downloaded update tar and verify the .app inside is validly
 *  signed by EXPECTED_TEAM_ID. Never throws — an unverifiable update is a
 *  refusal, not a crash. */
export async function verifyUpdateTar(tarPath: string): Promise<UpdateVerification> {
  const workDir = mkdtempSync(join(tmpdir(), "quincy-update-verify-"))
  try {
    const extract = await run(["/usr/bin/tar", "-xf", tarPath, "-C", workDir])
    if (!extract.ok) return { ok: false, reason: `couldn't extract update tar: ${extract.output.slice(0, 200)}` }

    const appBundle = readdirSync(workDir).find((name) => name.endsWith(".app"))
    if (!appBundle) return { ok: false, reason: "no .app bundle inside update tar" }
    const appPath = join(workDir, appBundle)

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
