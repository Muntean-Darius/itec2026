"use server"

import { revalidatePath } from "next/cache"
import db from "@/lib/db"
import type { Session } from "@/types"

function toSession(row: {
  id: string
  name: string
  language: string
  ownerId: string
  createdAt: Date
}): Session {
  return {
    id:         row.id,
    name:       row.name,
    language:   row.language,
    owner_id:   row.ownerId,
    created_at: row.createdAt.toISOString(),
  }
}

export async function listSessions(ownerId: string): Promise<Session[]> {
  const rows = await db.session.findMany({
    where:   { ownerId },
    orderBy: { createdAt: "desc" },
  })
  return rows.map(toSession)
}

export async function createSession(
  name: string,
  language: string,
  ownerId: string
): Promise<Session> {
  const row = await db.session.create({
    data: { name, language, ownerId },
  })
  revalidatePath("/dashboard")
  return toSession(row)
}

export async function joinSession(joinCode: string): Promise<Session> {
  const row = await db.session.findUnique({ where: { joinCode } })
  if (!row) throw new Error("Session not found")
  return toSession(row)
}

export async function deleteSession(id: string): Promise<void> {
  await db.session.delete({ where: { id } })
  revalidatePath("/dashboard")
}
