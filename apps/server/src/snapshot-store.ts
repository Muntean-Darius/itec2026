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
  userId: string
): Promise<void> {
  const db = getPrisma()
  await db.snapshot.create({
    data: {
      projectId,
      userId,
      blob: Buffer.from(blob),
    },
  })
}

/**
 * Load the latest snapshot blob for a project.
 * Returns null if no snapshot exists.
 */
export async function loadLatestSnapshot(
  projectId: string
): Promise<Uint8Array | null> {
  const db = getPrisma()
  const snapshot = await db.snapshot.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { blob: true },
  })
  if (!snapshot) return null
  return new Uint8Array(snapshot.blob)
}
