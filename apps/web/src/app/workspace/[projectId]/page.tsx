import { notFound } from "next/navigation"
import { getProject, getProjectFiles, getPresence, getAgents, getSnapshots } from "@/data/mock"
import { getCurrentUser } from "@/data/mock"
import { WorkspaceShell } from "@/components/workspace/workspace-shell"

// RSC page — fetches all workspace data server-side
// In production: all these would be Prisma queries

interface WorkspacePageProps {
  params: Promise<{ projectId: string }>
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { projectId } = await params

  const [project, files, presence, user, agents, snapshots] = await Promise.all([
    getProject(projectId),
    getProjectFiles(projectId),
    getPresence(projectId),
    getCurrentUser(),
    getAgents(projectId),
    getSnapshots(projectId),
  ])

  if (!project) notFound()

  return (
    <WorkspaceShell
      project={project}
      initialFiles={files}
      initialPresence={presence}
      currentUser={user}
      agents={agents}
      snapshots={snapshots}
    />
  )
}
