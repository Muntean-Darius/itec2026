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
      className="group relative flex flex-col gap-4 p-6 rounded-xl cursor-pointer transition-all duration-200"
      style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--elevated)", border: "1px solid var(--border-strong)" }}
          >
            <span className="w-3 h-3 rounded-sm" style={{ background: langColor }} />
          </div>
          <div>
            <h4 className="font-ui font-bold text-sm uppercase tracking-tight group-hover:text-accent transition-colors" style={{ color: "var(--foreground)" }}>
              {session.name}
            </h4>
            <p className="text-[10px] font-mono" style={{ color: "var(--text-dim)" }}>
              {session.language}
            </p>
          </div>
        </div>

        {/* Open on hover */}
        <button
          className="hidden group-hover:flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider shrink-0 transition-all"
          style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "var(--accent)" }}
        >
          Open
          <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full" style={{ background: langColor }} />
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>{session.language}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
          <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          {timeAgo(session.created_at)}
        </div>
      </div>
    </div>
  )
}
