export function getWorkspaceInviteUrl(projectId: string, origin?: string): string {
  if (!origin) return ""
  return `${origin}/workspace/join/${projectId}`
}
