"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Plus, Hash, X, Loader2, FolderOpen } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { SessionCard } from "@/components/dashboard/SessionCard"
import { MOCK_SESSIONS, LANGUAGES, LANG_META } from "@/data/mock"
import type { Session } from "@/types"

// TODO: Replace with real server actions when integrating
// import { createSession, joinSession, listSessions, deleteSession } from "@/actions/sessions"

export default function DashboardPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>(MOCK_SESSIONS)
  const [showNew, setShowNew] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState("")
  const [newLang, setNewLang] = useState<string>("Python")
  const [joinCode, setJoinCode] = useState("")
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return
    setIsPending(true)
    setError(null)

    // Mock: create a new session and navigate
    const newSession: Session = {
      id: `sess-${Date.now()}`,
      name: newName.trim(),
      language: newLang,
      ownerId: "user-001",
      createdAt: new Date().toISOString(),
      joinCode: newName.trim().toLowerCase().replace(/\s+/g, "-"),
    }

    setSessions((prev) => [newSession, ...prev])
    setShowNew(false)
    setNewName("")
    setIsPending(false)
    router.push(`/session/${newSession.id}`)
  }, [newName, newLang, router])

  const handleJoin = useCallback(() => {
    if (!joinCode.trim()) return
    setIsPending(true)
    setError(null)

    // Mock: find session by join code
    const found = sessions.find((s) => s.joinCode === joinCode.trim())
    if (found) {
      setShowJoin(false)
      setJoinCode("")
      setIsPending(false)
      router.push(`/session/${found.id}`)
    } else {
      setError("Session not found. Check the invite code and try again.")
      setIsPending(false)
    }
  }, [joinCode, sessions, router])

  const handleDelete = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const closeModals = useCallback(() => {
    setShowNew(false)
    setShowJoin(false)
    setError(null)
  }, [])

  return (
    <div className="flex flex-col flex-1 p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Sessions
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Create or join a collaborative coding session.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setError(null)
              setShowJoin(true)
            }}
            className="
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm
              bg-elevated text-text-secondary
              border border-border-strong
              hover:text-text-primary hover:border-brand-muted-border
              transition-all duration-150
            "
          >
            <Hash className="size-4" />
            Join Session
          </button>

          <button
            onClick={() => {
              setError(null)
              setShowNew(true)
            }}
            className="
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
              bg-brand text-brand-foreground
              hover:bg-brand-hover
              hover:shadow-[0_0_20px_var(--brand-glow)]
              transition-all duration-200 active:scale-[0.98]
            "
          >
            <Plus className="size-4" />
            New Session
          </button>
        </div>
      </div>

      {/* Session grid */}
      {sessions.length > 0 ? (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
          {sessions.map((s, i) => (
            <SessionCard
              key={s.id}
              session={s}
              index={i}
              onOpen={() => router.push(`/session/${s.id}`)}
              onDelete={() => handleDelete(s.id)}
            />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border-strong"
        >
          <div className="text-center py-16">
            <FolderOpen className="size-10 text-text-tertiary mx-auto mb-4" />
            <p className="text-sm font-medium text-text-primary">No sessions yet</p>
            <p className="mt-1 text-sm text-text-secondary">
              Create a new session to get started.
            </p>
          </div>
        </motion.div>
      )}

      {/* ═══ New Session Modal ═══ */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "hsla(230, 13%, 4%, 0.75)" }}
            onClick={closeModals}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="w-full max-w-md rounded-2xl border border-border-strong overflow-hidden"
              style={{
                background: "var(--bg-elevated)",
                boxShadow: "0 0 0 1px var(--border-subtle), 0 16px 48px hsla(230, 13%, 4%, 0.6), 0 0 80px var(--brand-glow)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h3 className="font-semibold text-text-primary">New Session</h3>
                <button
                  onClick={closeModals}
                  disabled={isPending}
                  className="size-7 flex items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-hover transition-all"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-5">
                {/* Name */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-text-secondary">
                    Session name
                  </label>
                  <input
                    type="text"
                    placeholder="my-awesome-project"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    autoFocus
                    disabled={isPending}
                    className="
                      w-full h-10 px-3.5 rounded-xl text-sm
                      bg-surface text-text-primary placeholder:text-text-tertiary
                      border border-border-strong
                      outline-none transition-all duration-200
                      focus:border-brand focus:ring-1 focus:ring-brand/30
                    "
                  />
                </div>

                {/* Language */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-text-secondary">
                    Language
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGES.map((lang) => {
                      const active = newLang === lang
                      const meta = LANG_META[lang]
                      return (
                        <button
                          key={lang}
                          onClick={() => setNewLang(lang)}
                          disabled={isPending}
                          className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                            border transition-all duration-150
                            ${
                              active
                                ? "bg-brand-muted text-brand border-[var(--brand-muted-border)]"
                                : "bg-surface text-text-secondary border-border-strong hover:text-text-primary hover:border-border-strong"
                            }
                          `}
                        >
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ background: meta?.color }}
                          />
                          {lang}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-error"
                  >
                    {error}
                  </motion.p>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
                <button
                  onClick={closeModals}
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || isPending}
                  className="
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                    bg-brand text-brand-foreground
                    hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed
                    transition-all duration-200 active:scale-[0.98]
                  "
                >
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  {isPending ? "Creating…" : "Create Session"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Join Session Modal ═══ */}
      <AnimatePresence>
        {showJoin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "hsla(230, 13%, 4%, 0.75)" }}
            onClick={closeModals}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="w-full max-w-md rounded-2xl border border-border-strong overflow-hidden"
              style={{
                background: "var(--bg-elevated)",
                boxShadow: "0 0 0 1px var(--border-subtle), 0 16px 48px hsla(230, 13%, 4%, 0.6)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h3 className="font-semibold text-text-primary">Join Session</h3>
                <button
                  onClick={closeModals}
                  disabled={isPending}
                  className="size-7 flex items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-hover transition-all"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  Invite code
                </label>
                <input
                  type="text"
                  placeholder="Enter session invite code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  autoFocus
                  disabled={isPending}
                  className="
                    w-full h-10 px-3.5 rounded-xl text-sm font-mono
                    bg-surface text-text-primary placeholder:text-text-tertiary
                    border border-border-strong
                    outline-none transition-all duration-200
                    focus:border-brand focus:ring-1 focus:ring-brand/30
                  "
                />
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-error mt-2"
                  >
                    {error}
                  </motion.p>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
                <button
                  onClick={closeModals}
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoin}
                  disabled={!joinCode.trim() || isPending}
                  className="
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                    bg-brand text-brand-foreground
                    hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed
                    transition-all duration-200 active:scale-[0.98]
                  "
                >
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  {isPending ? "Joining…" : "Join Session"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
