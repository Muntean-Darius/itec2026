import { Topbar } from "@/components/layout/Topbar"
import { MOCK_COLLABORATORS } from "@/data/mock"
// import { createClient } from "@/lib/supabase/server"
// import db from "@/lib/db"

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    return name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
  }
  return (email?.[0] ?? "?").toUpperCase()
}

export default async function SessionLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // TODO: Replace with real auth + DB lookup
  // const supabase = await createClient()
  // const { data: { user } } = await supabase.auth.getUser()
  // const initials = getInitials(user?.user_metadata?.full_name, user?.email)
  // const session = await db.session.findUnique({ where: { id } })
  // const sessionName = session?.name ?? id

  const initials = getInitials("Alex Chen", "alex@example.com")
  const sessionName = "Algorithm Practice"

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Topbar
        breadcrumb={["Sessions", sessionName]}
        userInitials={initials}
        collaborators={MOCK_COLLABORATORS}
      />
      <div className="flex flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
