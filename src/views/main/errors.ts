/** App-wide transient error channel. Failures the user must know about but
 *  that aren't tied to a specific component's state flow through here and
 *  surface in the banner rendered by `useAppErrorBanner`. */

export function reportAppError(context: string, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error)
  reportAppMessage(`${context} — ${reason}`)
}

export function reportAppMessage(message: string): void {
  window.dispatchEvent(new CustomEvent("quincy:appError", { detail: message }))
}
