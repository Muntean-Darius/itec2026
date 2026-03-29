import { redirect, notFound } from "next/navigation"
import { getProject, getProjectFiles, getAgents, getSnapshots, getCurrentUser, getAuthUser } from "@/data/queries"
import { WorkspaceShell } from "@/components/workspace/workspace-shell"
import { createClient } from "@/lib/supabase/server"

interface WorkspacePageProps {
  params: Promise<{ projectId: string }>
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { projectId } = await params

  const authUser = await getAuthUser()
  if (!authUser) redirect("/login")

  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const providerToken = session?.provider_token ?? null
  const provider = session?.user?.app_metadata?.provider
  const providerUsername =
    typeof session?.user?.user_metadata?.user_name === "string"
      ? session.user.user_metadata.user_name
      : typeof session?.user?.user_metadata?.preferred_username === "string"
        ? session.user.user_metadata.preferred_username
        : typeof session?.user?.user_metadata?.name === "string"
          ? session.user.user_metadata.name
          : ""

  const initialGitCredentials =
    provider === "github" && providerToken
      ? {
          username: providerUsername || "oauth2",
          password: providerToken,
        }
      : undefined

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
      initialGitCredentials={initialGitCredentials}
    />
  )
}
