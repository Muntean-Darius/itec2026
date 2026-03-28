"use client"

import { signOut } from "@/actions/auth"

interface TopbarProps {
  breadcrumb?: string[]
  userInitials?: string
}

export function Topbar({ breadcrumb, userInitials = "?" }: TopbarProps) {
  return (
    <header
      className="fixed top-0 w-full z-50 flex items-center gap-2 px-5 shrink-0"
      style={{
        height: 56,
        background: "rgba(25,28,34,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* Logo */}
      <span className="font-ui font-bold text-[18px] tracking-tight whitespace-nowrap mr-2" style={{ color: "var(--accent)" }}>
        iTECify
      </span>

      {breadcrumb && breadcrumb.length > 0 && (
        <>
          <div className="w-px h-4 shrink-0" style={{ background: "var(--border-strong)" }} />
          <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-sec)" }}>
            {breadcrumb.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span style={{ color: "var(--text-dim)" }}>/</span>}
                <span style={{
                  color: i === breadcrumb.length - 1 ? "var(--foreground)" : undefined,
                  fontWeight: i === breadcrumb.length - 1 ? 500 : undefined,
                }}>
                  {part}
                </span>
              </span>
            ))}
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* Sign out */}
      <form action={signOut}>
        <button
          type="submit"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
          style={{ color: "var(--text-dim)", background: "transparent" }}
          onMouseEnter={e => {
            e.currentTarget.style.color = "var(--text-sec)"
            e.currentTarget.style.background = "var(--elevated)"
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = "var(--text-dim)"
            e.currentTarget.style.background = "transparent"
          }}
        >
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
          </svg>
        </button>
      </form>

      {/* User avatar */}
      <div
        className="size-8 rounded-full flex items-center justify-center font-ui font-bold text-[11px] shrink-0 ml-1"
        style={{ background: "linear-gradient(135deg, var(--accent-container), var(--accent))", color: "#fff" }}
      >
        {userInitials}
      </div>
    </header>
  )
}
