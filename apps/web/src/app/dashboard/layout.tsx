import { Topbar } from "@/components/layout/Topbar"
import { Sidebar } from "@/components/layout/Sidebar"
// import { createClient } from "@/lib/supabase/server"

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }
  return (email?.[0] ?? "?").toUpperCase()
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // TODO: Replace with real auth when integrating
  // const supabase = await createClient()
  // const { data: { user } } = await supabase.auth.getUser()
  // const initials = getInitials(user?.user_metadata?.full_name, user?.email)
  const initials = getInitials("Alex Chen", "alex@example.com")

  return (
    <div className="flex flex-col h-screen">
      <Topbar breadcrumb={["Dashboard"]} userInitials={initials} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
