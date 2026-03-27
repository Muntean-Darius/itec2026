"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import type { Session } from "@/types"

/**
 * NOTE: These server actions use the anon Supabase client.
 * Auth-gated queries will fail until:
 *   1. @supabase/ssr is installed for proper cookie-based session handling
 *   2. The `sessions` table is created in Supabase with appropriate RLS policies
 *
 * Table schema (run in Supabase SQL editor):
 *   create table sessions (
 *     id         uuid primary key default gen_random_uuid(),
 *     name       text not null,
 *     language   text not null default 'Python',
 *     owner_id   uuid references auth.users(id) on delete cascade,
 *     join_code  text unique default substr(md5(random()::text), 1, 8),
 *     created_at timestamptz default now()
 *   );
 *   alter table sessions enable row level security;
 *   create policy "owner can manage" on sessions
 *     for all using (auth.uid() = owner_id);
 */

export async function listSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, name, language, owner_id, created_at")
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Session[]
}

export async function createSession(
  name: string,
  language: string
): Promise<Session> {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ name, language })
    .select("id, name, language, owner_id, created_at")
    .single()

  if (error) throw new Error(error.message)

  revalidatePath("/dashboard")
  return data as Session
}

export async function joinSession(joinCode: string): Promise<Session> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, name, language, owner_id, created_at")
    .eq("join_code", joinCode)
    .single()

  if (error) throw new Error("Session not found")
  return data as Session
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from("sessions").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard")
}
