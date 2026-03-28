"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { getAuthUser } from "@/data/queries"
import type { Snapshot } from "@/data/types"
import { gunzipSync } from "node:zlib"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const MAX_LOCAL_IMPORT_FILES = 2_000
const MAX_LOCAL_IMPORT_TOTAL_BYTES = 250 * 1024 * 1024
const MAX_GITHUB_IMPORT_FILES = 10_000
const MAX_GITHUB_IMPORT_TOTAL_BYTES = 250 * 1024 * 1024

type CreateSource = "blank" | "github" | "import"

function normalizeImportedPath(path: string): string {
  const trimmed = path.trim().replace(/\\/g, "/")
  if (!trimmed) return ""
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function makeWellFormed(value: string): string {
  if (typeof (value as unknown as { toWellFormed?: () => string }).toWellFormed === "function") {
    return (value as unknown as { toWellFormed: () => string }).toWellFormed()
  }
  return value
}

async function guessDefaultBranchFromHtml(owner: string, repo: string): Promise<string | null> {
  const res = await fetch(`https://github.com/${owner}/${repo}`, { cache: "no-store" })
  if (!res.ok) return null
  const html = await res.text()
  const match =
    html.match(/"defaultBranch":"([^"]+)"/) ??
    html.match(/data-default-branch="([^"]+)"/) ??
    html.match(/refs\/heads\/([^"]+)\.atom/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

async function githubFetchBinary(
  url: string,
  options?: { allowNotFound?: boolean }
): Promise<Buffer | null> {
  const maxAttempts = 4
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, { cache: "no-store" })
    if (res.ok) {
      return Buffer.from(await res.arrayBuffer())
    }

    if (options?.allowNotFound && res.status === 404) return null

    if ((res.status === 403 || res.status === 429) && attempt < maxAttempts) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "0")
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : attempt * 1200
      await delay(waitMs)
      continue
    }

    if (res.status === 403) {
      throw new Error(
        "Unable to access repository (403). It may be private, or GitHub temporarily blocked the archive download."
      )
    }
    if (res.status === 404) {
      throw new Error("Repository archive not found for this branch.")
    }
    throw new Error(`GitHub archive request failed (${res.status}).`)
  }

  throw new Error("GitHub archive request failed after multiple retries.")
}

function parseFileStatesJson(raw: string | null): Record<string, string> {
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("Imported files payload is not valid JSON.")
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Imported files payload must be an object map of path to content.")
  }

  const entries = Object.entries(parsed as Record<string, unknown>)
  if (entries.length > MAX_LOCAL_IMPORT_FILES) {
    throw new Error(`Import supports up to ${MAX_LOCAL_IMPORT_FILES} files right now.`)
  }

  let totalBytes = 0
  const normalized: Record<string, string> = {}
  for (const [rawPath, value] of entries) {
    if (typeof value !== "string") {
      throw new Error(`File "${rawPath}" has invalid content type.`)
    }
    const path = normalizeImportedPath(rawPath)
    if (!path) continue
    if (value.includes("\u0000")) {
      throw new Error(`Imported file "${rawPath}" appears to be binary and cannot be stored.`)
    }
    const content = makeWellFormed(value)
    totalBytes += Buffer.byteLength(content, "utf8")
    if (totalBytes > MAX_LOCAL_IMPORT_TOTAL_BYTES) {
      throw new Error("Imported files are too large. Keep the total under 250MB.")
    }
    normalized[path] = content
  }

  return normalized
}

function parseGithubRepoUrl(url: string): { owner: string; repo: string; branch?: string } | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== "github.com") return null
    const parts = parsed.pathname.split("/").filter(Boolean)
    if (parts.length < 2) return null
    const owner = parts[0]
    const repo = parts[1].replace(/\.git$/, "")
    if (!owner || !repo) return null
    const branch =
      parts[2] === "tree" && parts.length > 3
        ? decodeURIComponent(parts.slice(3).join("/"))
        : undefined
    return { owner, repo, branch }
  } catch {
    return null
  }
}

async function fetchGithubFileStates(repoUrl: string): Promise<Record<string, string>> {
  const parsed = parseGithubRepoUrl(repoUrl)
  if (!parsed) {
    throw new Error("Please provide a valid GitHub repository URL.")
  }

  const guessedDefaultBranch = parsed.branch
    ? null
    : await guessDefaultBranchFromHtml(parsed.owner, parsed.repo)
  const candidateBranches = Array.from(
    new Set([parsed.branch, guessedDefaultBranch, "main", "master"].filter(Boolean) as string[])
  )
  let archiveBuffer: Buffer | null = null
  for (const branch of candidateBranches) {
    const branchPath = encodeURIComponent(branch)
    const archiveUrls = [
      `https://github.com/${parsed.owner}/${parsed.repo}/archive/refs/heads/${branchPath}.tgz`,
      `https://github.com/${parsed.owner}/${parsed.repo}/archive/refs/heads/${branchPath}.tar.gz`,
    ]
    for (const archiveUrl of archiveUrls) {
      archiveBuffer = await githubFetchBinary(archiveUrl, { allowNotFound: true })
      if (archiveBuffer) break
    }
    if (archiveBuffer) {
      break
    }
  }
  if (!archiveBuffer) {
    if (parsed.branch) {
      throw new Error(`Unable to download archive for branch "${parsed.branch}".`)
    }
    throw new Error("Unable to download archive. Try a URL with explicit branch, e.g. /tree/main.")
  }

  const tarBuffer = gunzipSync(archiveBuffer)
  const fileStates: Record<string, string> = {}
  let totalBytes = 0
  let fileCount = 0
  let offset = 0

  const readTarString = (buffer: Buffer, start: number, length: number) =>
    buffer.subarray(start, start + length).toString("utf8").replace(/\0.*$/, "").trim()

  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512)
    offset += 512

    if (header.every((byte) => byte === 0)) break

    const name = readTarString(header, 0, 100)
    const prefix = readTarString(header, 345, 155)
    const typeFlag = header[156]
    const sizeOctal = readTarString(header, 124, 12)
    const size = sizeOctal ? Number.parseInt(sizeOctal, 8) : 0
    const fullPath = prefix ? `${prefix}/${name}` : name

    const body = tarBuffer.subarray(offset, offset + size)
    offset += Math.ceil(size / 512) * 512

    const isRegularFile = typeFlag === 0 || typeFlag === 48
    if (!isRegularFile || !fullPath) continue

    const pathParts = fullPath.split("/").filter(Boolean)
    if (pathParts.length < 2) continue
    const relativePath = pathParts.slice(1).join("/")
    if (!relativePath) continue
    if (body.includes(0)) continue

    fileCount += 1
    if (fileCount > MAX_GITHUB_IMPORT_FILES) {
      throw new Error(`Repository has too many files (${fileCount}). Limit is ${MAX_GITHUB_IMPORT_FILES}.`)
    }

    totalBytes += body.byteLength
    if (totalBytes > MAX_GITHUB_IMPORT_TOTAL_BYTES) {
      throw new Error("Repository files are too large to import. Keep total text under 250MB.")
    }

    fileStates[normalizeImportedPath(relativePath)] = makeWellFormed(body.toString("utf8"))
  }

  if (Object.keys(fileStates).length === 0) {
    throw new Error("No text files could be imported from this repository.")
  }

  return fileStates
}

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
  const source = ((formData.get("source") as string) || "blank") as CreateSource
  if (!["blank", "github", "import"].includes(source)) {
    return { error: "Invalid workspace source selected." }
  }

  let initialFileStates: Record<string, string> = {}
  try {
    if (source === "github") {
      const githubUrl = (formData.get("githubUrl") as string)?.trim()
      if (!githubUrl) {
        return { error: "GitHub repository URL is required." }
      }
      initialFileStates = await fetchGithubFileStates(githubUrl)
    } else if (source === "import") {
      initialFileStates = parseFileStatesJson((formData.get("fileStates") as string) || null)
      if (Object.keys(initialFileStates).length === 0) {
        return { error: "Please choose a local folder with at least one file." }
      }
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to prepare workspace source." }
  }

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

  if (Object.keys(initialFileStates).length > 0) {
    const blob = Buffer.from(JSON.stringify(initialFileStates), "utf8")
    await prisma.snapshot.create({
      data: {
        projectId: project.id,
        userId: user.id,
        kind: "human",
        label: source === "github" ? "Initial GitHub import" : "Initial local import",
        changeCount: Object.keys(initialFileStates).length,
        fileStates: initialFileStates,
        blob,
      },
    })
  }

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

type CreateSnapshotInput = {
  projectId: string
  kind: "cron" | "ai" | "human"
  label?: string | null
  promptSummary?: string
  filePath?: string
  fileStates?: Record<string, string>
  changeCount?: number
}

export async function createSnapshot(input: CreateSnapshotInput): Promise<{ snapshot?: Snapshot; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: "Not authenticated." }

  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: user.id, projectId: input.projectId } },
  })
  if (!membership) return { error: "Access denied." }

  const fileStates = input.fileStates ?? {}
  const blob = Buffer.from(JSON.stringify(fileStates), "utf8")

  const created = await prisma.snapshot.create({
    data: {
      projectId: input.projectId,
      userId: user.id,
      kind: input.kind,
      label: input.label ?? null,
      changeCount: input.changeCount ?? 0,
      promptSummary: input.promptSummary ?? null,
      filePath: input.filePath ?? null,
      fileStates,
      blob,
    },
  })

  revalidatePath(`/workspace/${input.projectId}`)

  return {
    snapshot: {
      id: created.id,
      projectId: created.projectId,
      createdAt: created.createdAt.toISOString(),
      label: created.label,
      changeCount: created.changeCount,
      userId: created.userId,
      kind: created.kind,
      promptSummary: created.promptSummary ?? undefined,
      filePath: created.filePath ?? undefined,
      fileStates: (created.fileStates as Record<string, string> | null) ?? undefined,
    },
  }
}
