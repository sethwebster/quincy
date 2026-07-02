/**
 * Debounced, race-safe document persistence.
 *
 * Guarantees the naive timer-in-useEffect pattern couldn't:
 * - Content scheduled while a write is in flight is never dropped; writes are
 *   serialized in order.
 * - `onSaved` fires with exactly the path+content that landed, so the caller
 *   can decide whether the document is actually clean.
 * - `flush()` persists pending content immediately (file switch, close, quit).
 * - A failed write reports through `onError` and stays pending for the next
 *   flush unless newer content superseded it.
 */

interface PendingSave {
  path: string
  content: string
}

interface DocumentSaverOptions {
  write: (path: string, content: string) => Promise<void>
  onSaved: (path: string, content: string) => void
  onError: (path: string, error: unknown) => void
  debounceMs?: number
}

export class DocumentSaver {
  private pending: PendingSave | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private inflight: Promise<void> | null = null

  private readonly write: DocumentSaverOptions["write"]
  private readonly onSaved: DocumentSaverOptions["onSaved"]
  private readonly onError: DocumentSaverOptions["onError"]
  private readonly debounceMs: number

  constructor(options: DocumentSaverOptions) {
    this.write = options.write
    this.onSaved = options.onSaved
    this.onError = options.onError
    this.debounceMs = options.debounceMs ?? 800
  }

  /** Record the latest content for `path` and (re)start the debounce timer. */
  schedule(path: string, content: string): void {
    this.pending = { path, content }
    this.clearTimer()
    this.timer = setTimeout(() => {
      void this.run()
    }, this.debounceMs)
  }

  /** Persist any pending content now. Resolves once all writes have settled. */
  async flush(): Promise<void> {
    this.clearTimer()
    await this.run()
  }

  /** Drop pending content without writing it. */
  cancel(): void {
    this.clearTimer()
    this.pending = null
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private async run(): Promise<void> {
    // Serialize behind any in-flight write; re-check because a concurrent
    // run() may have claimed the pending job while we waited.
    while (this.inflight) await this.inflight
    const job = this.pending
    if (!job) return

    this.pending = null
    this.inflight = this.write(job.path, job.content)
    let succeeded = false
    try {
      await this.inflight
      succeeded = true
      this.onSaved(job.path, job.content)
    } catch (error) {
      // Keep the failed content pending for a later retry unless the user
      // typed something newer while the write was failing.
      if (!this.pending) this.pending = job
      this.onError(job.path, error)
    } finally {
      this.inflight = null
    }

    // Content scheduled during a successful write has its own timer; if
    // flush() called us the timer is cleared, so drain now — flush means
    // "everything is on disk". Never drain after a failure: that would
    // busy-loop retrying a persistently failing write.
    if (succeeded && this.pending && !this.timer) await this.run()
  }
}
