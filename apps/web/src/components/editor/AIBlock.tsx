"use client"

import { motion } from "framer-motion"
import { Check, X, Sparkles, Eye } from "lucide-react"
import { useState } from "react"

interface AIBlockProps {
  summary?: string
  proposal: string
  onAccept: () => void
  onReject: () => void
}

export function AIBlock({ summary, proposal, onAccept, onReject }: AIBlockProps) {
  const [showDiff, setShowDiff] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="overflow-hidden"
    >
      <div className="mx-3 my-2 rounded-xl border border-[var(--ai-muted-border)] bg-[var(--ai-muted)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ai-muted-border)]">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-ai" />
            <span className="text-sm font-semibold text-text-primary">AI Proposal</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Diff toggle */}
            <button
              onClick={() => setShowDiff((d) => !d)}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                border transition-all duration-150
                ${
                  showDiff
                    ? "bg-elevated text-text-primary border-border-strong"
                    : "text-text-secondary border-transparent hover:text-text-primary"
                }
              `}
            >
              <Eye className="size-3" />
              Diff
            </button>

            {/* Reject */}
            <button
              onClick={onReject}
              className="
                flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                text-text-secondary border border-border-strong
                hover:text-error hover:border-[var(--error-muted-border)] hover:bg-error-muted
                transition-all duration-150
              "
              title="Reject (Esc)"
            >
              <X className="size-3" />
              Reject
            </button>

            {/* Accept */}
            <button
              onClick={onAccept}
              className="
                flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold
                bg-ai text-ai-foreground
                hover:opacity-90
                transition-all duration-150
              "
              title="Accept (⌘↵)"
            >
              <Check className="size-3" />
              Accept
            </button>
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div className="px-4 py-2 text-xs text-text-secondary border-b border-[var(--ai-muted-border)]">
            {summary}
          </div>
        )}

        {/* Code preview */}
        <pre className="max-h-52 overflow-auto p-4 text-xs text-text-primary font-mono leading-relaxed">
          {proposal}
        </pre>
      </div>
    </motion.div>
  )
}
