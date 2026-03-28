import { redirect } from "next/navigation"
import { getAuthUser } from "@/data/queries"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

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

  // Check project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })
  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-text-secondary">Project not found.</p>
      </div>
    )
  }

  // Add membership if not already a member
  const existingMembership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: user.id, projectId } },
  })

  if (!existingMembership) {
    await prisma.projectMembership.create({
      data: {
        userId: user.id,
        projectId,
        role: "EDITOR",
      },
    })
  }

  // Redirect to the workspace — dashboard will show updated data
  // on next visit since it's a dynamic server component
  redirect(`/workspace/${projectId}`)
}
