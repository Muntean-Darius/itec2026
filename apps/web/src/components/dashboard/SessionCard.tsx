import type { Session } from "@/types"

interface SessionCardProps {
  session: Session
  langColor: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return "just now"
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function SessionCard({ session, langColor }: SessionCardProps) {
  return (
    <div
      className="group relative flex flex-col gap-3 p-4 rounded-[10px] cursor-pointer transition-all duration-150"
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      {/* Name row */}
      <div className="flex items-start justify-between gap-2">
        <span className="font-ui font-semibold text-sm text-foreground truncate">
          {session.name}
        </span>
        {/* Open button — visible on hover */}
        <button
          className="hidden group-hover:flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 transition-all"
          style={{
            background: "rgba(0,217,192,0.12)",
            border: "1px solid rgba(0,217,192,0.35)",
            color: "var(--accent)",
          }}
        >
          Open →
        </button>
      </div>

      {/* Language + last active */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full shrink-0" style={{ background: langColor }} />
          <span className="text-xs text-text-sec">{session.language}</span>
        </div>
        <span className="text-[11px] text-text-dim">{timeAgo(session.created_at)}</span>
      </div>
    </div>
  )
}
