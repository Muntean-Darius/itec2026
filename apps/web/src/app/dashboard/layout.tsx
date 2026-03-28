import { Topbar } from "@/components/layout/Topbar"
import { Sidebar } from "@/components/layout/Sidebar"
import { createClient } from "@/lib/supabase/server"

function getInitials(user: { email?: string; user_metadata?: { full_name?: string } } | null): string {
  if (!user) return "?"
  const name = user.user_metadata?.full_name
  if (name) {
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }
  return (user.email?.[0] ?? "?").toUpperCase()
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const initials = getInitials(user)

  return (
    <div className="flex flex-col h-screen">
      <Topbar breadcrumb={["Dashboard"]} userInitials={initials} />
      <div className="flex flex-1 overflow-hidden" style={{ paddingTop: 56 }}>
        {/* Sidebar spacer for fixed sidebar */}
        <div className="hidden md:block shrink-0" style={{ width: 240 }} />
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
