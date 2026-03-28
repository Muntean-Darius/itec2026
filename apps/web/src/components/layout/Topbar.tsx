"use client"

import { LogOut, Command } from "lucide-react"
import { signOut } from "@/actions/auth"
import type { SessionUser } from "@/types"

interface TopbarProps {
  breadcrumb?: string[]
  userInitials?: string
  /** Online collaborators shown in the Presence Dock */
  collaborators?: SessionUser[]
}

function UserAvatar({
  name,
  color,
  size = "sm",
}: {
  name: string
  color: string
  size?: "sm" | "md"
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const px = size === "sm" ? "size-7 text-[10px]" : "size-8 text-xs"

  return (
    <div
      className={`${px} rounded-full flex items-center justify-center font-semibold shrink-0 ring-2 ring-background`}
      style={{ background: color, color: "var(--brand-foreground)" }}
      title={name}
    >
      {initials}
    </div>
  )
}

export function Topbar({ breadcrumb, userInitials = "?", collaborators = [] }: TopbarProps) {
  return (
    <header className="flex items-center gap-3 px-4 h-12 border-b border-border bg-surface shrink-0">
      {/* Logo */}
      <span className="font-bold text-[17px] tracking-tight text-text-primary whitespace-nowrap select-none">
        i
        <span className="text-brand" style={{ textShadow: "0 0 20px var(--brand-glow)" }}>
          TEC
        </span>
        ify
      </span>

      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && (
        <>
          <div className="w-px h-5 bg-border-strong mx-0.5 shrink-0" />
          <nav className="flex items-center gap-1.5 text-sm text-text-secondary min-w-0">
            {breadcrumb.map((part, i) => (
              <span key={i} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && <span className="text-text-tertiary">/</span>}
                <span
                  className={`truncate ${
                    i === breadcrumb.length - 1
                      ? "text-text-primary font-medium"
                      : ""
                  }`}
                >
                  {part}
                </span>
              </span>
            ))}
          </nav>
        </>
      )}

      <div className="flex-1" />

      {/* Command Palette hint */}
      <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-elevated border border-border-strong text-text-tertiary text-xs cursor-pointer hover:text-text-secondary transition-colors">
        <Command className="size-3" />
        <span>K</span>
      </div>

      {/* Presence Dock */}
      {collaborators.length > 0 && (
        <div className="flex items-center -space-x-2 ml-1">
          {collaborators
            .filter((u) => u.isOnline)
            .slice(0, 4)
            .map((user) => (
              <UserAvatar key={user.id} name={user.name} color={user.color} />
            ))}
          {collaborators.filter((u) => u.isOnline).length > 4 && (
            <div className="size-7 rounded-full flex items-center justify-center text-[10px] font-semibold bg-elevated text-text-secondary ring-2 ring-background">
              +{collaborators.filter((u) => u.isOnline).length - 4}
            </div>
          )}
        </div>
      )}

      {/* Sign out */}
      <form action={signOut}>
        <button
          type="submit"
          className="flex items-center justify-center size-8 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-hover transition-all duration-150"
          title="Sign out"
        >
          <LogOut className="size-4" />
        </button>
      </form>

      {/* Current user avatar */}
      <div
        className="size-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
        style={{
          background: "linear-gradient(135deg, hsl(239, 84%, 67%), hsl(239, 84%, 50%))",
          color: "var(--brand-foreground)",
        }}
      >
        {userInitials}
      </div>
    </header>
  )
}
