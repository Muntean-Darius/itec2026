"use client"

import { useState } from "react"
import { SessionCard } from "@/components/dashboard/SessionCard"
import type { Session } from "@/types"

const LANGUAGES = ["Python", "JavaScript", "TypeScript", "Go", "Rust", "C++", "Java"]

const LANG_COLORS: Record<string, string> = {
  Python:     "#3B82F6",
  JavaScript: "#FCD34D",
  TypeScript: "#60A5FA",
  Go:         "#4ADE80",
  Rust:       "#FB923C",
  "C++":      "#A78BFA",
  Java:       "#F87171",
}

export default function DashboardPage() {
  const [sessions] = useState<Session[]>([])
  const [showNew, setShowNew] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState("")
  const [newLang, setNewLang] = useState("Python")
  const [joinCode, setJoinCode] = useState("")

  return (
    <div className="flex flex-col flex-1 p-8 lg:p-12 max-w-7xl w-full">

      {/* ── Header ── */}
      <header className="mb-10 pl-5" style={{ borderLeft: "3px solid var(--accent)" }}>
        <h1 className="font-ui font-black text-4xl tracking-tight uppercase" style={{ color: "var(--foreground)" }}>
          Sessions
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
          Create or join a collaborative coding environment
        </p>
      </header>

      {/* ── Primary actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-10">

        {/* New Session bento */}
        <section
          className="lg:col-span-8 rounded-xl p-7 flex flex-col transition-colors"
          style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
        >
          <div className="flex justify-between items-start mb-7">
            <div>
              <h2 className="font-ui font-bold text-lg" style={{ color: "var(--foreground)" }}>Initialize Sandbox</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>Deploy an isolated containerized environment.</p>
            </div>
            <div
              className="p-2.5 rounded-lg"
              style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "var(--accent)" }}
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-auto">
            {LANGUAGES.map(lang => (
              <button
                key={lang}
                onClick={() => { setNewLang(lang); setShowNew(true) }}
                className="flex flex-col items-center gap-2 px-5 py-4 rounded-lg transition-all group"
                style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: LANG_COLORS[lang] }} />
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                  {lang}
                </span>
              </button>
            ))}
            <button
              onClick={() => setShowNew(true)}
              className="flex flex-col items-center gap-2 px-5 py-4 rounded-lg transition-all"
              style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.1)", color: "var(--accent)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(99,102,241,0.05)")}
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Custom</span>
            </button>
          </div>
        </section>

        {/* Join Session */}
        <section
          className="lg:col-span-4 rounded-xl p-7 flex flex-col justify-between transition-colors"
          style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
        >
          <div className="space-y-3">
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "var(--accent)" }}
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
            </div>
            <h2 className="font-ui font-bold text-lg" style={{ color: "var(--foreground)" }}>Join Session</h2>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
              Access a collaborative session via instance code.
            </p>
          </div>
          <div className="mt-8 space-y-3">
            <input
              type="text"
              placeholder="ITEC-0000-0000"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              className="w-full rounded-lg py-3.5 px-4 font-mono text-center text-sm tracking-widest outline-none transition-all"
              style={{ background: "var(--elevated)", border: "1px solid var(--border-strong)", color: "var(--accent)" }}
              onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(99,102,241,0.2)" }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.boxShadow = "none" }}
            />
            <button
              onClick={() => setShowJoin(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg font-ui font-bold text-xs tracking-[0.1em] uppercase text-white transition-all group active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, var(--accent-container), var(--accent))", boxShadow: "0 4px 12px rgba(99,102,241,0.2)" }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.4)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(99,102,241,0.2)")}
            >
              Connect
              <svg className="size-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </section>
      </div>

      {/* ── Recent Sessions ── */}
      <section>
        <div className="flex items-center justify-between pb-4 mb-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <h3 className="font-ui font-bold text-base uppercase tracking-tight" style={{ color: "var(--foreground)" }}>
              Recent Sessions
            </h3>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider"
              style={{ background: "var(--elevated)", color: "var(--text-dim)" }}
            >
              Logs Active
            </span>
          </div>
        </div>

        {sessions.length > 0 ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {sessions.map(s => (
              <SessionCard key={s.id} session={s} langColor={LANG_COLORS[s.language] ?? "#8B949E"} />
            ))}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center py-20 rounded-xl"
            style={{ border: "1px dashed var(--border-strong)" }}
          >
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
              style={{ background: "var(--elevated)", border: "1px solid var(--border-strong)", color: "var(--text-dim)" }}
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
              </svg>
            </div>
            <p className="text-sm font-ui font-semibold" style={{ color: "var(--foreground)" }}>No sessions yet</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>Initialize a sandbox above to get started</p>
          </div>
        )}
      </section>

      {/* ── New Session Modal ── */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div
            className="w-full max-w-sm rounded-xl overflow-hidden animate-fade-up"
            style={{ background: "var(--surface-highest)", border: "1px solid rgba(99,102,241,0.3)", boxShadow: "0 0 0 1px rgba(99,102,241,0.1), 0 24px 48px rgba(0,0,0,0.6)" }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="font-ui font-bold text-sm" style={{ color: "var(--foreground)" }}>New Session</span>
              <button onClick={() => setShowNew(false)} style={{ color: "var(--text-dim)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-sec)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono tracking-[0.15em] uppercase" style={{ color: "var(--text-dim)" }}>Session name</label>
                <input
                  type="text"
                  placeholder="my-project"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full rounded-lg py-3 px-4 text-sm outline-none transition-all"
                  style={{ background: "var(--terminal-bg)", border: "1px solid var(--border-strong)", color: "var(--foreground)" }}
                  onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(99,102,241,0.2)" }}
                  onBlur={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.boxShadow = "none" }}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono tracking-[0.15em] uppercase" style={{ color: "var(--text-dim)" }}>Language</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang}
                      onClick={() => setNewLang(lang)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs transition-all font-mono"
                      style={{
                        background: newLang === lang ? "rgba(99,102,241,0.15)" : "var(--elevated)",
                        border: newLang === lang ? "1px solid rgba(99,102,241,0.4)" : "1px solid var(--border-strong)",
                        color: newLang === lang ? "var(--accent)" : "var(--text-dim)",
                      }}
                    >
                      <span className="size-1.5 rounded-full shrink-0" style={{ background: LANG_COLORS[lang] }} />
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => setShowNew(false)}
                className="px-3.5 py-2 rounded-full text-xs transition-colors"
                style={{ color: "var(--text-dim)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-sec)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
              >
                Cancel
              </button>
              <button
                onClick={() => setShowNew(false)}
                disabled={!newName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold font-ui uppercase tracking-wider text-white disabled:opacity-40 transition-all"
                style={{ background: "linear-gradient(135deg, var(--accent-container), var(--accent))" }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Join Session Modal ── */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div
            className="w-full max-w-sm rounded-xl overflow-hidden animate-fade-up"
            style={{ background: "var(--surface-highest)", border: "1px solid var(--border-strong)", boxShadow: "0 24px 48px rgba(0,0,0,0.6)" }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="font-ui font-bold text-sm" style={{ color: "var(--foreground)" }}>Join Session</span>
              <button onClick={() => setShowJoin(false)} style={{ color: "var(--text-dim)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-sec)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-1.5">
              <label className="block text-[11px] font-mono tracking-[0.15em] uppercase" style={{ color: "var(--text-dim)" }}>Session code</label>
              <input
                type="text"
                placeholder="ITEC-0000-0000"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                className="w-full rounded-lg py-3 px-4 font-mono text-center text-sm tracking-widest outline-none transition-all"
                style={{ background: "var(--terminal-bg)", border: "1px solid var(--border-strong)", color: "var(--accent)" }}
                onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(99,102,241,0.2)" }}
                onBlur={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.boxShadow = "none" }}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => setShowJoin(false)}
                className="px-3.5 py-2 rounded-full text-xs transition-colors"
                style={{ color: "var(--text-dim)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-sec)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
              >
                Cancel
              </button>
              <button
                onClick={() => setShowJoin(false)}
                disabled={!joinCode.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold font-ui uppercase tracking-wider text-white disabled:opacity-40 transition-all"
                style={{ background: "linear-gradient(135deg, var(--accent-container), var(--accent))" }}
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
