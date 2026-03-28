// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Real Data Queries (Prisma + Supabase Auth)
// Used in React Server Components for direct DB access.
// ═══════════════════════════════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { createClient } from "@/lib/supabase/server"
import type { User, Project, FileNode, AIAgent, Snapshot } from "./types"
import { cache } from "react"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ─── Random HSL cursor color ─────────────────────────────────────────────
const CURSOR_HUES = [239, 330, 150, 270, 30, 190, 350, 60]
function randomCursorColor(): string {
  const hue = CURSOR_HUES[Math.floor(Math.random() * CURSOR_HUES.length)]
  return `hsl(${hue}, 70%, 60%)`
}

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  json: "JSON",
  css: "CSS",
  scss: "SCSS",
  md: "Markdown",
  html: "HTML",
  py: "Python",
}

function inferLanguageFromFileStates(
  fileStates: unknown,
  fallbackLanguage: string
): string {
  if (!fileStates || typeof fileStates !== "object" || Array.isArray(fileStates)) {
    return fallbackLanguage
  }

  const counts = new Map<string, number>()

  for (const path of Object.keys(fileStates as Record<string, unknown>)) {
    const fileName = path.split("/").pop() ?? path
    const extension = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : ""
    if (!extension) continue

    const language = EXTENSION_LANGUAGE_MAP[extension]
    if (!language) continue

    counts.set(language, (counts.get(language) ?? 0) + 1)
  }

  let dominantLanguage = fallbackLanguage
  let highestCount = 0

  for (const [language, count] of counts.entries()) {
    if (count > highestCount) {
      dominantLanguage = language
      highestCount = count
    }
  }

  return dominantLanguage
}

// ─── Get or create user from Supabase auth ───────────────────────────────
export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  // Upsert user row — creates on first sign-in
  const user = await prisma.user.upsert({
    where: { id: authUser.id },
    update: {
      email: authUser.email ?? "",
    },
    create: {
      id: authUser.id,
      email: authUser.email ?? "",
      name: "",
      cursorColor: randomCursorColor(),
      onboardingComplete: false,
    },
  })

  return user
})

// ─── Get current user as typed User ──────────────────────────────────────
export async function getCurrentUser(): Promise<User | null> {
  const dbUser = await getAuthUser()
  if (!dbUser) return null
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    avatarUrl: dbUser.avatarUrl,
    cursorColor: dbUser.cursorColor,
  }
}

// ─── Projects ────────────────────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  const user = await getAuthUser()
  if (!user) return []

  const memberships = await prisma.projectMembership.findMany({
    where: { userId: user.id },
    include: {
      project: {
        include: {
          memberships: {
            include: { user: true },
          },
          snapshots: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              fileStates: true,
            },
          },
        },
      },
    },
    orderBy: { project: { updatedAt: "desc" } },
  })

  return memberships.map(({ project }: { project: any }) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    language: inferLanguageFromFileStates(project.snapshots[0]?.fileStates, project.language),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    ownerId: project.ownerId,
    collaborators: project.memberships.map((m: any) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      cursorColor: m.user.cursorColor,
    })),
  }))
}

export async function getProject(id: string): Promise<Project | null> {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      memberships: {
        include: { user: true },
      },
      snapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          fileStates: true,
        },
      },
    },
  })

  if (!project) return null

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    language: inferLanguageFromFileStates(project.snapshots[0]?.fileStates, project.language),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    ownerId: project.ownerId,
    collaborators: project.memberships.map((m: any) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      cursorColor: m.user.cursorColor,
    })),
  }
}

// ─── Agents ──────────────────────────────────────────────────────────────

export async function getAgents(projectId: string): Promise<AIAgent[]> {
  const agents = await prisma.aIAgent.findMany({
    where: { projectId },
  })

  return agents.map((a: any) => ({
    id: a.id,
    name: a.name,
    persona: a.persona,
    avatarUrl: null,
    systemPrompt: a.systemPrompt,
    color: a.color,
    isActive: a.isActive,
  }))
}

// ─── Snapshots ───────────────────────────────────────────────────────────

export async function getSnapshots(projectId: string): Promise<Snapshot[]> {
  const snapshots = await prisma.snapshot.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      projectId: true,
      createdAt: true,
      label: true,
      changeCount: true,
      userId: true,
      kind: true,
      promptSummary: true,
      filePath: true,
      fileStates: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  })

  const parsedSnapshots = snapshots.map((s: any) => ({
    id: s.id,
    projectId: s.projectId,
    createdAt: s.createdAt.toISOString(),
    label: s.label,
    changeCount: s.changeCount,
    userId: s.userId,
    userName: s.user?.name?.trim() || s.user?.email || undefined,
    kind: (s.kind as "cron" | "ai" | "human") ?? "cron",
    promptSummary: s.promptSummary,
    filePath: s.filePath,
    fileStates: s.fileStates,
  }))
  return parsedSnapshots
}

// ─── Files (initial load from latest snapshot or empty) ──────────────────
// In production, files live in Yjs server memory.
// On first load, we return an empty set — the Yjs server will hydrate from snapshot.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getProjectFiles(projectId: string): Promise<FileNode[]> {
  return []
}
