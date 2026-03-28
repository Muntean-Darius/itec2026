import { getProjects, getCurrentUser } from "@/data/mock"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

// RSC page — this will be a server component that fetches data directly
// In production: const user = await prisma.user.findUnique(...)
// In production: const projects = await prisma.project.findMany(...)

export default async function DashboardPage() {
  const [user, projects] = await Promise.all([getCurrentUser(), getProjects()])

  return <DashboardShell user={user} projects={projects} />
}
