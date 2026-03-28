import { redirect } from "next/navigation"
import { getAuthUser } from "@/data/queries"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { JoinPreview } from "./join-preview"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

interface JoinPageProps {
  params: Promise<{ projectId: string }>
}

export default async function JoinWorkspacePage({ params }: JoinPageProps) {
  const { projectId } = await params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(projectId)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-text-secondary">Invalid invite link.</p>
      </div>
    )
  }

  const user = await getAuthUser()
  if (!user) redirect("/login")

  // Fetch project with collaborators
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      memberships: {
        include: { user: true },
      },
    },
  })

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-text-secondary">Project not found.</p>
      </div>
    )
  }

  // Already a member — skip preview, go straight to workspace
  const isMember = project.memberships.some((m) => m.userId === user.id)
  if (isMember) {
    redirect(`/workspace/${projectId}`)
  }

  // Find the owner
  const ownerMembership = project.memberships.find((m) => m.role === "OWNER")

  return (
    <JoinPreview
      project={{
        id: project.id,
        name: project.name,
        description: project.description,
        language: project.language,
        createdAt: project.createdAt.toISOString(),
        owner: {
          name: ownerMembership?.user.name ?? "Unknown",
          avatarUrl: ownerMembership?.user.avatarUrl ?? null,
        },
        collaborators: project.memberships.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          avatarUrl: m.user.avatarUrl,
          cursorColor: m.user.cursorColor,
        })),
      }}
    />
  )
}
