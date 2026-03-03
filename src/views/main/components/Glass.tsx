import { forwardRef } from "react"

interface GlassProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType
  elevated?: boolean
}

export const Glass = forwardRef<HTMLDivElement, GlassProps>(
  ({ as: Tag = "div", elevated = false, className = "", children, ...props }, ref) => {
    return (
      <Tag
        ref={ref}
        className={`glass ${elevated ? "shadow-2xl" : ""} ${className}`}
        {...props}
      >
        {children}
      </Tag>
    )
  },
)

Glass.displayName = "Glass"
