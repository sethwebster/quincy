import { useState, useRef, useEffect } from "react"
import { useAuthActions } from "@convex-dev/auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { Mail, ArrowRight, RotateCcw } from "lucide-react"
import { Glass } from "../components/Glass"
import { Button } from "../components/Button"

const appIconSrc = new URL("./logo.png", import.meta.url).href

type Step = { kind: "email" } | { kind: "code"; email: string }

function useFocusOnMount(dep?: unknown) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 300)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])
  return ref
}

export function SignIn() {
  const { signIn } = useAuthActions()
  const [step, setStep] = useState<Step>({ kind: "email" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emailRef = useFocusOnMount(step.kind)
  const codeRef  = useFocusOnMount(step.kind)

  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const email = fd.get("email") as string
    try {
      await signIn("resend-otp", fd)
      setStep({ kind: "code", email })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      setError(`Couldn't send code (${reason}). Check your email and try again.`)
    } finally {
      setLoading(false)
    }
  }

  async function handleCodeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (step.kind !== "code") return
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    try {
      await signIn("resend-otp", fd)
    } catch {
      setError("Invalid or expired code. Try again.")
      setLoading(false)
    }
  }

  return (
    <div
      className="no-drag relative flex h-full w-full items-center justify-center"
      style={{ background: "var(--color-surface-0)" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(124,106,247,0.08) 0%, transparent 70%)",
        }}
      />

      <AnimatePresence mode="wait">
        {step.kind === "email" ? (
          <motion.div
            key="email"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <Glass elevated className="w-80 rounded-2xl p-8">
              {/* Logo / wordmark */}
              <div className="mb-8 text-center">
                <img
                  src={appIconSrc}
                  alt="Quincy app icon"
                  className="mb-3 inline-block h-14 w-14 object-contain"
                />
                <h1
                  className="text-lg font-semibold tracking-tight"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Quincy
                </h1>
                <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Sign in to continue
                </p>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div className="relative">
                  <Mail
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <input
                    ref={emailRef}
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    required
                    className="no-drag w-full rounded-lg py-2.5 pl-9 pr-3 text-sm outline-none transition-colors"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--color-glass-border)",
                      color: "var(--color-text-primary)",
                      userSelect: "text",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--color-glass-border)")}
                  />
                </div>

                {error && (
                  <p className="text-xs" style={{ color: "var(--color-danger)" }}>
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  className="w-full justify-center"
                >
                  Send code
                  <ArrowRight size={14} />
                </Button>
              </form>
            </Glass>
          </motion.div>
        ) : (
          <motion.div
            key="code"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <Glass elevated className="w-80 rounded-2xl p-8">
              <div className="mb-8 text-center">
                <div
                  className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: "var(--color-accent-dim)", border: "1px solid var(--color-accent-glow)" }}
                >
                  <span className="text-xl">✉️</span>
                </div>
                <h2
                  className="text-base font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Check your email
                </h2>
                <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  Sent a 6-digit code to
                </p>
                <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {step.email}
                </p>
              </div>

              <form onSubmit={handleCodeSubmit} className="space-y-3">
                <input type="hidden" name="email" value={step.email} />

                <input
                  ref={codeRef}
                  name="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  required
                  className="no-drag w-full rounded-lg py-2.5 px-3 text-center text-2xl font-mono font-bold tracking-[0.4em] outline-none transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--color-glass-border)",
                    color: "var(--color-text-primary)",
                    letterSpacing: "0.4em",
                    userSelect: "text",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-glass-border)")}
                />

                {error && (
                  <p className="text-xs text-center" style={{ color: "var(--color-danger)" }}>
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  className="w-full justify-center"
                >
                  Verify code
                </Button>

                <button
                  type="button"
                  onClick={() => { setStep({ kind: "email" }); setError(null) }}
                  className="no-drag flex w-full items-center justify-center gap-1.5 py-1 text-xs transition-opacity hover:opacity-80"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <RotateCcw size={11} />
                  Use a different email
                </button>
              </form>
            </Glass>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
