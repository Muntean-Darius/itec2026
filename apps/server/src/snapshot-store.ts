// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Snapshot Store (Prisma)
// Saves and loads Yjs document state vectors to/from the database.
// ═══════════════════════════════════════════════════════════════════════════

import { PrismaClient } from "./generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg"

let prisma: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!prisma) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error("[iTECify] DATABASE_URL is not set — snapshots will not work.")
    }
    const adapter = new PrismaPg({ connectionString })
    prisma = new PrismaClient({ adapter })
  }
  return prisma
}

/**
 * Save a Yjs state update blob as a snapshot in the database.
 */
export async function saveSnapshotToDB(
  projectId: string,
  blob: Uint8Array,
  userId: string,
  options?: { fileStates?: Record<string, string> }
): Promise<void> {
  const db = getPrisma()
  await db.snapshot.create({
    data: {
      projectId,
      userId,
      kind: "cron",
      blob: Buffer.from(blob),
      fileStates: options?.fileStates ?? undefined,
    },
  })
}

/**
 * Load the latest snapshot for a project.
 * Returns both the Yjs blob and fileStates (if available) so the caller
 * can fall back to fileStates when the blob is not a valid Yjs update
 * (e.g. snapshots created by the web client store JSON as the blob).
 */
export async function loadLatestSnapshot(
  projectId: string
): Promise<{ blob: Uint8Array; fileStates: Record<string, string> | null } | null> {
  const db = getPrisma()
  const snapshot = await db.snapshot.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { blob: true, fileStates: true },
  })
  if (!snapshot) return null
  const fileStates = snapshot.fileStates as Record<string, string> | null | undefined
  return {
    blob: new Uint8Array(snapshot.blob),
    fileStates: fileStates ?? null,
  }
}
