import { Updater } from "electrobun/bun"
import type { UpdateStatusEntry } from "electrobun/bun"
import { join } from "node:path"
import type { UpdateStatusPayload } from "../shared/types"
import { verifyUpdateTar } from "./updateVerification"

const HOUR_MS = 60 * 60 * 1000
const INITIAL_DELAY_MS = 5 * 60 * 1000 // 5 min — don't block startup
const MAX_RETRY_DELAY_MS = 30_000
const MAX_RETRY_ATTEMPTS = 5

let sendStatus: ((payload: UpdateStatusPayload) => void) | null = null
let isChecking = false
let isDownloading = false
let hourlyTimer: ReturnType<typeof setInterval> | null = null
let initialTimer: ReturnType<typeof setTimeout> | null = null

function toPayload(entry: UpdateStatusEntry): UpdateStatusPayload {
  return {
    status: entry.status as UpdateStatusPayload["status"],
    message: entry.message,
    progress: entry.details?.progress,
    errorMessage: entry.details?.errorMessage,
  }
}
function emit(payload: UpdateStatusPayload) {
  sendStatus?.(payload)
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T | null> {
  let delay = 1000
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isLast = attempt === MAX_RETRY_ATTEMPTS
      console.error(`[updater] ${label} attempt ${attempt} failed:`, err)
      if (isLast) {
        emit({ status: "error", message: `${label} failed after ${attempt} attempts`, errorMessage: String(err) })
        return null
      }
      await Bun.sleep(delay)
      delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS)
    }
  }
  return null
}

async function checkForUpdates() {
  if (isChecking || isDownloading) return
  isChecking = true
  try {
    const info = await withRetry(() => Updater.checkForUpdate(), "checkForUpdate")
    if (!info) return

    if (info.updateAvailable && !info.updateReady) {
      // kick off background download without blocking
      void downloadUpdateAsync()
    }
  } finally {
    isChecking = false
  }
}

async function downloadUpdateAsync() {
  if (isDownloading) return
  isDownloading = true
  try {
    await withRetry(() => Updater.downloadUpdate(), "downloadUpdate")
  } finally {
    isDownloading = false
  }
}

export async function checkForUpdatesHandler(): Promise<void> {
  await checkForUpdates()
}

export async function applyUpdateHandler(): Promise<void> {
  const info = Updater.updateInfo()
  if (!info?.updateReady) return

  // Electrobun's updater does not verify downloaded artifacts and strips
  // quarantine on the swapped bundle — gate the apply on our own signature
  // check so a compromised release channel can't ship unsigned code.
  const appDataFolder = await Updater.appDataFolder()
  const tarPath = join(appDataFolder, "self-extraction", `${info.hash}.tar`)
  const verification = await verifyUpdateTar(tarPath)
  if (!verification.ok) {
    console.error(`[updater] Refusing to apply update: ${verification.reason}`)
    emit({
      status: "error",
      message: "Update rejected: signature verification failed",
      errorMessage: verification.reason,
    })
    return
  }

  await Updater.applyUpdate()
}

export function initializeUpdater(onStatus: (payload: UpdateStatusPayload) => void) {
  sendStatus = onStatus

  Updater.onStatusChange((entry: UpdateStatusEntry) => {
    emit(toPayload(entry))
  })

  // Delay first check so app startup isn't blocked
  initialTimer = setTimeout(() => {
    void checkForUpdates()
    hourlyTimer = setInterval(() => void checkForUpdates(), HOUR_MS)
  }, INITIAL_DELAY_MS)
}
