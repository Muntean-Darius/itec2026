import { redirect, notFound } from "next/navigation"
import { getProject, getProjectFiles, getAgents, getSnapshots, getCurrentUser, getAuthUser } from "@/data/queries"
import { WorkspaceShell } from "@/components/workspace/workspace-shell"

interface WorkspacePageProps {
  params: Promise<{ projectId: string }>
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { projectId } = await params

  const authUser = await getAuthUser()
  if (!authUser) redirect("/login")

  const [project, files, user, agents, snapshots] = await Promise.all([
    getProject(projectId),
    getProjectFiles(projectId),
    getCurrentUser(),
    getAgents(projectId),
    getSnapshots(projectId),
  ])

  if (!project || !user) notFound()

  return (
    <WorkspaceShell
      project={project}
      initialFiles={files}
      initialPresence={[]}
      currentUser={user}
      agents={agents}
      snapshots={snapshots}
    />
  )
}
