"use client"

import Link from "next/link"
import { useActionState } from "react"
import { signIn } from "@/actions/auth"
import { TypewriterText } from "@/components/TypewriterText"

const TYPEWRITER_WORDS = ["Code.", "Build.", "Ship.", "Iterate.", "Deploy.", "Collaborate."]

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null)

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background architectural-grid px-4"
      style={{ overflow: "hidden" }}
    >
      {/* Ambient orb */}
      <div
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full animate-orb"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-[400px] animate-fade-up">
        {/* Protocol badge */}
        <div className="flex justify-center mb-8">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded font-mono text-[10px] tracking-[0.2em] uppercase"
            style={{ background: "var(--elevated)", border: "1px solid var(--border-strong)", color: "var(--text-dim)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--green)", boxShadow: "0 0 6px var(--green)" }}
            />
            Auth Gateway
          </div>
        </div>

        {/* Hero typewriter */}
        <div className="text-center mb-8 space-y-2">
          <h1 className="font-ui font-bold text-4xl tracking-tight text-foreground leading-none">
            <TypewriterText words={TYPEWRITER_WORDS} className="text-accent" />
          </h1>
          <p className="text-sm" style={{ color: "var(--text-sec)" }}>
            Sign in to your collaborative workspace.
          </p>
        </div>

        {/* Glass card */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "rgba(25,28,34,0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid var(--border-strong)",
            boxShadow: "0 32px 64px rgba(0,0,0,0.4)",
          }}
        >
          <form action={action} className="p-8 space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-mono tracking-[0.15em] uppercase" style={{ color: "var(--text-dim)" }}>
                Identity
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 shrink-0" style={{ color: "var(--text-dim)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                <input
                  name="email"
                  type="email"
                  placeholder="user@itecify.io"
                  required
                  autoComplete="email"
                  className="w-full rounded-lg py-3 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-[var(--text-dim)]"
                  style={{
                    background: "var(--terminal-bg)",
                    border: "1px solid var(--border-strong)",
                    color: "var(--foreground)",
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = "var(--accent)"
                    e.currentTarget.style.boxShadow = "0 0 0 1px rgba(99,102,241,0.2)"
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = "var(--border-strong)"
                    e.currentTarget.style.boxShadow = "none"
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-mono tracking-[0.15em] uppercase" style={{ color: "var(--text-dim)" }}>
                Credentials
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 shrink-0" style={{ color: "var(--text-dim)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
                </svg>
                <input
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg py-3 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-[var(--text-dim)]"
                  style={{
                    background: "var(--terminal-bg)",
                    border: "1px solid var(--border-strong)",
                    color: "var(--foreground)",
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = "var(--accent)"
                    e.currentTarget.style.boxShadow = "0 0 0 1px rgba(99,102,241,0.2)"
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = "var(--border-strong)"
                    e.currentTarget.style.boxShadow = "none"
                  }}
                />
              </div>
            </div>

            {state?.error && (
              <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "var(--red)", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)" }}>
                {state.error}
              </p>
            )}

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
              {pending ? "Authenticating…" : "Initiate Connection"}
              {!pending && (
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              )}
            </button>
          </form>

          <div
            className="px-8 py-4 text-center"
            style={{ borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.15)" }}
          >
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              First time?{" "}
              <Link href="/register" className="font-semibold transition-colors hover:underline underline-offset-4" style={{ color: "var(--accent)" }}>
                Initialize Identity
              </Link>
            </p>
          </div>
        </div>

        {/* System info */}
        <div className="mt-8 flex items-center justify-center gap-4 text-[9px] font-mono tracking-[0.2em] uppercase" style={{ color: "var(--text-dim)" }}>
          <span>Encrypted Node</span>
          <span className="w-1 h-1 rounded-full" style={{ background: "var(--text-dim)" }} />
          <span>SLA 99.99%</span>
          <span className="w-1 h-1 rounded-full" style={{ background: "var(--text-dim)" }} />
          <span>Core v1.0</span>
        </div>
      </div>
    </div>
  )
}
