"use client"

import { useState } from "react"
import { Plus, Hash, X } from "lucide-react"
import { SessionCard } from "@/components/dashboard/SessionCard"
import type { Session } from "@/types"

const LANGUAGES = ["Python", "JavaScript", "TypeScript", "Go", "Rust", "C++", "Java"]

const LANG_COLORS: Record<string, string> = {
  Python: "#3B82F6",
  JavaScript: "#FCD34D",
  TypeScript: "#60A5FA",
  Go: "#4ADE80",
  Rust: "#FB923C",
  "C++": "#A78BFA",
  Java: "#F87171",
}

export default function DashboardPage() {
  const [sessions] = useState<Session[]>([])
  const [showNew, setShowNew] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState("")
  const [newLang, setNewLang] = useState("Python")
  const [joinCode, setJoinCode] = useState("")

  return (
    <div className="flex flex-col flex-1 p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-ui font-bold text-xl text-foreground tracking-tight">Sessions</h1>
          <p className="mt-0.5 text-xs text-text-sec">Create or join a collaborative coding session</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowJoin(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-text-sec border border-border-strong bg-elevated hover:border-[rgba(0,217,192,0.4)] hover:text-accent transition-all"
          >
            <Hash className="size-3.5" />
            Join Session
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(0,217,192,0.2), rgba(0,217,192,0.1))",
              border: "1px solid rgba(0,217,192,0.4)",
              color: "var(--accent)",
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 16px var(--accent-glow)")}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
          >
            <Plus className="size-3.5" />
            New Session
          </button>
        </div>
      </div>

      {/* Session grid */}
      {sessions.length > 0 ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {sessions.map(s => (
            <SessionCard key={s.id} session={s} langColor={LANG_COLORS[s.language] ?? "#8B949E"} />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-[10px] border border-dashed border-border">
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">No sessions yet</p>
            <p className="mt-1 text-xs text-text-sec">Create a new session to get started</p>
          </div>
        </div>
      )}

      {/* ── New Session Modal ── */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div
            className="w-full max-w-sm rounded-[10px] overflow-hidden"
            style={{ background: "var(--elevated)", border: "1px solid rgba(0,217,192,0.4)", boxShadow: "0 0 0 1px rgba(0,217,192,0.15), 0 8px 32px rgba(0,0,0,0.6), 0 0 60px rgba(0,217,192,0.07)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-ui font-bold text-sm text-foreground">New Session</span>
              <button onClick={() => setShowNew(false)} className="text-text-dim hover:text-text-sec transition-colors">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-sec">Session name</label>
                <input
                  type="text"
                  placeholder="my-project"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full h-8 px-2.5 rounded text-sm text-foreground placeholder:text-text-dim outline-none transition-colors"
                  style={{ background: "var(--panel)", border: "1px solid var(--border-strong)" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-sec">Language</label>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang}
                      onClick={() => setNewLang(lang)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all"
                      style={{
                        background: newLang === lang ? "rgba(0,217,192,0.12)" : "var(--panel)",
                        border: newLang === lang ? "1px solid rgba(0,217,192,0.4)" : "1px solid var(--border-strong)",
                        color: newLang === lang ? "var(--accent)" : "var(--text-sec)",
                      }}
                    >
                      <span className="size-1.5 rounded-full shrink-0" style={{ background: LANG_COLORS[lang] }} />
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
              <button
                onClick={() => setShowNew(false)}
                className="px-3 py-1.5 rounded text-xs text-text-sec hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowNew(false)}
                disabled={!newName.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-40 transition-all"
                style={{
                  background: "linear-gradient(135deg, rgba(0,217,192,0.2), rgba(0,217,192,0.1))",
                  border: "1px solid rgba(0,217,192,0.4)",
                  color: "var(--accent)",
                }}
              >
                Create Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Join Session Modal ── */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div
            className="w-full max-w-sm rounded-[10px] overflow-hidden"
            style={{ background: "var(--elevated)", border: "1px solid var(--border-strong)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-ui font-bold text-sm text-foreground">Join Session</span>
              <button onClick={() => setShowJoin(false)} className="text-text-dim hover:text-text-sec transition-colors">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-4 space-y-1.5">
              <label className="text-xs font-medium text-text-sec">Session code</label>
              <input
                type="text"
                placeholder="Enter invite code"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                className="w-full h-8 px-2.5 rounded text-sm text-foreground placeholder:text-text-dim outline-none font-mono transition-colors"
                style={{ background: "var(--panel)", border: "1px solid var(--border-strong)" }}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
              <button
                onClick={() => setShowJoin(false)}
                className="px-3 py-1.5 rounded text-xs text-text-sec hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowJoin(false)}
                disabled={!joinCode.trim()}
                className="px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-40 transition-all"
                style={{
                  background: "linear-gradient(135deg, rgba(0,217,192,0.2), rgba(0,217,192,0.1))",
                  border: "1px solid rgba(0,217,192,0.4)",
                  color: "var(--accent)",
                }}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
