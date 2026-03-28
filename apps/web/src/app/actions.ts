"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { getAuthUser } from "@/data/queries"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

// ─── Onboarding ──────────────────────────────────────────────────────────

export async function completeOnboarding(formData: FormData) {
  const user = await getAuthUser()
  if (!user) redirect("/login")

  const name = (formData.get("name") as string)?.trim()
  if (!name || name.length < 1 || name.length > 100) {
    return { error: "Name must be between 1 and 100 characters." }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name, onboardingComplete: true },
  })

  redirect("/dashboard")
}

// ─── Account Settings ────────────────────────────────────────────────────

export async function updateProfile(formData: FormData) {
  const user = await getAuthUser()
  if (!user) redirect("/login")

  const name = (formData.get("name") as string)?.trim()
  if (!name || name.length < 1 || name.length > 100) {
    return { error: "Name must be between 1 and 100 characters." }
  }

  const email = (formData.get("email") as string)?.trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." }
  }

  // Update Prisma user
  await prisma.user.update({
    where: { id: user.id },
    data: { name },
  })

  // If email changed, update in Supabase Auth too
  if (email !== user.email) {
    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({ email })
    if (error) {
      return { error: "Failed to update email. " + error.message }
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { email },
    })
  }

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return { success: true }
}

// ─── Projects ────────────────────────────────────────────────────────────

export async function createProject(
  _prevState: { error?: string } | null,
  formData: FormData
) {
  const user = await getAuthUser()
  if (!user) redirect("/login")

  const name = (formData.get("name") as string)?.trim()
  if (!name || name.length < 1 || name.length > 100) {
    return { error: "Project name is required." }
  }

  const description = (formData.get("description") as string)?.trim() || null

  const project = await prisma.project.create({
    data: {
      name,
      description,
      ownerId: user.id,
      memberships: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
  })

  revalidatePath("/dashboard")
  redirect(`/workspace/${project.id}`)
}

export async function deleteProject(projectId: string) {
  const user = await getAuthUser()
  if (!user) redirect("/login")

  // Verify ownership
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: user.id, projectId } },
  })
  if (!membership || membership.role !== "OWNER") {
    return { error: "Only the owner can delete a project." }
  }

  // Delete memberships first, then the project
  await prisma.projectMembership.deleteMany({ where: { projectId } })
  await prisma.project.delete({ where: { id: projectId } })

  revalidatePath("/dashboard")
  return { success: true }
}

export async function updateProject(formData: FormData) {
  const user = await getAuthUser()
  if (!user) redirect("/login")

  const projectId = formData.get("projectId") as string
  if (!projectId) return { error: "Project ID is required." }

  // Verify membership
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: user.id, projectId } },
  })
  if (!membership) return { error: "Access denied." }

  const name = (formData.get("name") as string)?.trim()
  const description = (formData.get("description") as string)?.trim()

  const data: Record<string, string | null> = {}
  if (name !== undefined && name.length > 0) data.name = name
  if (description !== undefined) data.description = description || null

  await prisma.project.update({
    where: { id: projectId },
    data,
  })

  revalidatePath(`/workspace/${projectId}`)
  revalidatePath("/dashboard")
  return { success: true }
}

// ─── Join Project (Invite Link) ──────────────────────────────────────────

export async function joinProject(projectId: string) {
  const user = await getAuthUser()
  if (!user) redirect("/login")

  // Check project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })
  if (!project) return { error: "Project not found." }

  // Check if already a member
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

  revalidatePath("/dashboard")
  redirect(`/workspace/${projectId}`)
}
