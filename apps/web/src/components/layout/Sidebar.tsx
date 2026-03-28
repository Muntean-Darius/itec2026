"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Settings, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
] as const

const BOTTOM_ITEMS = [
  { label: "Settings", href: "#", icon: Settings },
  { label: "Help", href: "#", icon: HelpCircle },
] as const

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-[220px] flex-col border-r border-border bg-surface shrink-0">
      {/* Section label */}
      <div className="px-4 pt-4 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
          Navigation
        </span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 relative group",
                active
                  ? "bg-brand-muted text-text-primary font-medium"
                  : "text-text-secondary hover:bg-hover hover:text-text-primary"
              )}
            >
              {/* Active indicator bar */}
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-brand" />
              )}
              <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-text-tertiary group-hover:text-text-secondary")} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom nav */}
      <div className="px-2 pb-3 space-y-0.5 border-t border-border pt-2">
        {BOTTOM_ITEMS.map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-hover hover:text-text-primary transition-all duration-150"
          >
            <Icon className="size-4 shrink-0 text-text-tertiary" />
            {label}
          </Link>
        ))}
      </div>
    </aside>
  )
}
