import { cn } from "@/lib/utils"

function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "error" | "ai"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        variant === "default" && "bg-brand-muted text-brand border border-brand-muted-border",
        variant === "secondary" && "bg-elevated text-text-secondary",
        variant === "outline" && "border border-border-default text-text-secondary",
        variant === "success" && "bg-success-muted text-success",
        variant === "warning" && "bg-warning-muted text-warning",
        variant === "error" && "bg-error-muted text-error",
        variant === "ai" && "bg-ai-muted text-ai border border-ai-muted-border",
        className
      )}
      {...props}
    />
  )
}

export { Badge }
