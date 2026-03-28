import { redirect } from "next/navigation"
import { getProjects, getCurrentUser, getAuthUser } from "@/data/queries"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

export default async function DashboardPage() {
  const authUser = await getAuthUser()
  if (!authUser) redirect("/login")
  if (!authUser.onboardingComplete) redirect("/onboarding")

  const [user, projects] = await Promise.all([getCurrentUser(), getProjects()])
  if (!user) redirect("/login")

  return <DashboardShell user={user} projects={projects} />
}
