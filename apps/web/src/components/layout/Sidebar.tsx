"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="flex h-full flex-col border-r border-border bg-panel overflow-hidden shrink-0"
      style={{ width: 240 }}
    >
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2 font-ui text-[10px] font-bold uppercase tracking-[1px] text-text-dim">
        Navigation
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        {navItems.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] transition-all duration-100 relative",
              pathname === href
                ? "bg-[rgba(0,217,192,0.08)] text-foreground"
                : "text-text-sec hover:bg-elevated hover:text-foreground"
            )}
          >
            {pathname === href && (
              <span
                className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
                style={{ background: "var(--accent)" }}
              />
            )}
            <Icon className="size-3.5 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
