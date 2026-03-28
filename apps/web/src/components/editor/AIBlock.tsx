"use client"

type AIBlockProps = {
  summary?: string
  proposal: string
  onAccept: () => void
  onReject: () => void
}

export function AIBlock({ summary, proposal, onAccept, onReject }: AIBlockProps) {
  return (
    <div className="mx-3 my-2 rounded-xl border border-border-strong bg-elevated p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold text-foreground">AI Proposal</div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReject}
            className="px-2.5 py-1 rounded-full text-xs border border-border-strong text-text-sec hover:text-foreground"
          >
            Reject
          </button>
          <button
            onClick={onAccept}
            className="px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: "linear-gradient(135deg, rgba(79,134,247,0.22), rgba(79,134,247,0.1))",
              border: "1px solid rgba(79,134,247,0.4)",
              color: "var(--accent)",
            }}
          >
            Accept
          </button>
        </div>
      </div>

      {summary && <div className="mb-2 text-xs text-text-sec">{summary}</div>}

      <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-panel p-2 text-xs text-foreground">
        {proposal}
      </pre>
    </div>
  )
}
