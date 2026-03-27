import { createClient } from "@/lib/supabase/server"
import { Topbar } from "@/components/layout/Topbar"
import db from "@/lib/db"

function getInitials(user: { email?: string; user_metadata?: { full_name?: string } } | null): string {
  if (!user) return "?"
  const name = user.user_metadata?.full_name
  if (name) {
    return name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
  }
  return (user.email?.[0] ?? "?").toUpperCase()
}

export default async function SessionLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const initials = getInitials(user)

  let sessionName = id
  try {
    const session = await db.session.findUnique({ where: { id } })
    if (session) sessionName = session.name
  } catch {
    // DB not reachable yet — fall back to ID
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Topbar breadcrumb={["Sessions", sessionName]} userInitials={initials} />
      <div className="flex flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
