"use client"

import { LogOut } from "lucide-react"
import { signOut } from "@/actions/auth"

interface TopbarProps {
  breadcrumb?: string[]
  userInitials?: string
}

export function Topbar({ breadcrumb, userInitials = "?" }: TopbarProps) {
  return (
    <header
      className="flex items-center gap-1.5 px-3.5 border-b border-border bg-panel shrink-0"
      style={{ height: 48 }}
    >
      {/* Logo */}
      <span className="font-ui font-extrabold text-[17px] tracking-tight text-foreground whitespace-nowrap mr-1">
        i<span style={{ color: "var(--accent)", textShadow: "0 0 12px var(--accent-glow), 0 0 24px rgba(0,217,192,0.2)" }}>TEC</span>ify
      </span>

      {breadcrumb && breadcrumb.length > 0 && (
        <>
          <div className="w-px h-5 bg-border-strong mx-1 shrink-0" />
          <div className="flex items-center gap-1 text-xs text-text-sec">
            {breadcrumb.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-text-dim">/</span>}
                <span className={i === breadcrumb.length - 1 ? "text-foreground font-medium" : ""}>
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
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs text-text-sec border border-transparent hover:border-border-strong hover:text-foreground transition-all"
        >
          <LogOut className="size-3.5" />
        </button>
      </form>

      {/* User avatar */}
      <div
        className="size-7 rounded-full flex items-center justify-center font-ui font-bold text-[10px] ml-1 shrink-0"
        style={{ background: "linear-gradient(135deg, #00D9C0, #00a896)", color: "#0a1a18" }}
      >
        {userInitials}
      </div>
    </header>
  )
}
