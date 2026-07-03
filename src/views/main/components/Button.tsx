import { forwardRef } from "react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger"
  size?: "sm" | "md"
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "ghost", size = "md", loading = false, children, className = "", disabled, ...props }, ref) => {
    const base = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 no-drag select-none cursor-default"

    const variants = {
      primary: "bg-[var(--color-accent)] text-white hover:opacity-90 active:opacity-80",
      ghost: "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-glass-hover)] active:opacity-70",
      danger: "text-[var(--color-danger)] hover:bg-[rgba(248,113,113,0.1)] active:opacity-70",
    }

    const sizes = {
      sm: "px-2.5 py-1 text-xs",
      md: "px-3 py-1.5 text-sm",
    }

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${disabled || loading ? "opacity-50 pointer-events-none" : ""} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : null}
        {children}
      </button>
    )
  },
)

Button.displayName = "Button"
