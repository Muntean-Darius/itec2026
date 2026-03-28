"use client"

import Link from "next/link"
import { useActionState } from "react"
import { signUp } from "@/actions/auth"
import { TypewriterText } from "@/components/TypewriterText"

const TYPEWRITER_WORDS = ["Logic", "Future", "Stack", "Codebase", "Pipeline", "Team"]

const FEATURES = [
  {
    label: "Architectural Stability",
    desc: "Redundant nodes across global clusters.",
    icon: (
      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
  },
  {
    label: "Encryption Standard",
    desc: "AES-256 architectural data shielding.",
    icon: (
      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  },
  {
    label: "Real-time Collaboration",
    desc: "Live cursors and conflict-free editing.",
    icon: (
      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
]

export default function RegisterPage() {
  const [state, action, pending] = useActionState(signUp, null)

  return (
    <div className="flex min-h-screen items-center justify-center bg-background architectural-grid px-6" style={{ overflow: "hidden" }}>
      {/* Ambient orb */}
      <div
        className="pointer-events-none absolute top-0 right-0 w-[500px] h-[500px] rounded-full animate-orb"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-[1040px] grid grid-cols-1 lg:grid-cols-2 gap-20 items-center animate-fade-up">

        {/* ── Left: Branding ── */}
        <div className="hidden lg:flex flex-col space-y-10">
          <div className="space-y-5">
            <div
              className="inline-flex items-center px-3 py-1 rounded font-mono text-[10px] tracking-[0.2em] uppercase"
              style={{ background: "var(--elevated)", border: "1px solid var(--border-strong)", color: "var(--text-dim)" }}
            >
              Protocol: 08-Initialize
            </div>
            <h1 className="font-ui font-bold text-5xl tracking-tight leading-[1.1]" style={{ color: "var(--foreground)" }}>
              Build the{" "}
              <TypewriterText words={TYPEWRITER_WORDS} className="text-accent" typingSpeed={70} holdDuration={2000} />
              <br />of Tomorrow.
            </h1>
            <p className="text-base max-w-sm font-light leading-relaxed" style={{ color: "var(--text-sec)" }}>
              Deploy secure, high-fidelity collaborative infrastructure within an architectural framework designed for precision.
            </p>
          </div>

          <div className="space-y-5">
            {FEATURES.map(f => (
              <div key={f.label} className="flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "var(--elevated)", border: "1px solid var(--border-strong)", color: "var(--accent)" }}
                >
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-ui font-semibold" style={{ color: "var(--foreground)" }}>{f.label}</p>
                  <p className="text-xs" style={{ color: "var(--text-dim)" }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 text-[9px] font-mono tracking-[0.2em] uppercase" style={{ color: "var(--text-dim)" }}>
            <span>Region: EU-WEST-1</span>
            <span className="w-1 h-1 rounded-full" style={{ background: "var(--text-dim)" }} />
            <span>Build: v1.0-Indigo</span>
          </div>
        </div>

        {/* ── Right: Form ── */}
        <div className="flex justify-center lg:justify-end">
          <div
            className="w-full max-w-md rounded-xl overflow-hidden"
            style={{
              background: "rgba(25,28,34,0.9)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid var(--border-strong)",
              boxShadow: "0 32px 64px rgba(0,0,0,0.4)",
            }}
          >
            <div className="px-8 pt-8 pb-5 text-center" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-ui font-bold text-xl tracking-tight" style={{ color: "var(--foreground)" }}>Initialize Identity</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--text-sec)" }}>Enter credentials to authenticate access.</p>
            </div>

            <form action={action} className="p-8 space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono tracking-[0.15em] uppercase" style={{ color: "var(--text-dim)" }}>Full Name</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4" style={{ color: "var(--text-dim)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  <input name="name" type="text" placeholder="Ada Lovelace" required autoComplete="name"
                    className="w-full rounded-lg py-3 pl-10 pr-4 text-sm outline-none transition-all"
                    style={{ background: "var(--terminal-bg)", border: "1px solid var(--border-strong)", color: "var(--foreground)" }}
                    onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(99,102,241,0.2)" }}
                    onBlur={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.boxShadow = "none" }}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono tracking-[0.15em] uppercase" style={{ color: "var(--text-dim)" }}>Work Email</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4" style={{ color: "var(--text-dim)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                  <input name="email" type="email" placeholder="you@itecify.io" required autoComplete="email"
                    className="w-full rounded-lg py-3 pl-10 pr-4 text-sm outline-none transition-all"
                    style={{ background: "var(--terminal-bg)", border: "1px solid var(--border-strong)", color: "var(--foreground)" }}
                    onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(99,102,241,0.2)" }}
                    onBlur={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.boxShadow = "none" }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono tracking-[0.15em] uppercase" style={{ color: "var(--text-dim)" }}>Password</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4" style={{ color: "var(--text-dim)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  <input name="password" type="password" placeholder="••••••••" required autoComplete="new-password" minLength={8}
                    className="w-full rounded-lg py-3 pl-10 pr-4 text-sm outline-none transition-all"
                    style={{ background: "var(--terminal-bg)", border: "1px solid var(--border-strong)", color: "var(--foreground)" }}
                    onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(99,102,241,0.2)" }}
                    onBlur={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.boxShadow = "none" }}
                  />
                </div>
              </div>

              {state?.error && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "var(--red)", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)" }}>
                  {state.error}
                </p>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg font-ui font-bold text-xs tracking-[0.1em] uppercase text-white disabled:opacity-50 transition-all active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, var(--accent-container), var(--accent))",
                    boxShadow: "0 8px 20px rgba(99,102,241,0.25)",
                  }}
                  onMouseEnter={e => !pending && (e.currentTarget.style.boxShadow = "0 8px 28px rgba(99,102,241,0.4)")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 8px 20px rgba(99,102,241,0.25)")}
                >
                  {pending ? "Initializing…" : "Initialize Account"}
                  {!pending && (
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  )}
                </button>
              </div>

              <p className="text-center text-xs" style={{ color: "var(--text-dim)" }}>
                Already active?{" "}
                <Link href="/login" className="font-semibold hover:underline underline-offset-4" style={{ color: "var(--accent)" }}>
                  Establish Link
                </Link>
              </p>
            </form>

            <div className="flex justify-center gap-1.5 pb-6">
              <div className="h-[2px] w-6 rounded-full" style={{ background: "var(--accent)" }} />
              <div className="h-[2px] w-6 rounded-full" style={{ background: "var(--border-strong)" }} />
              <div className="h-[2px] w-6 rounded-full" style={{ background: "var(--border-strong)" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
