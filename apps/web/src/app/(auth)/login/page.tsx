"use client"

import Link from "next/link"
import { useActionState } from "react"
import { signIn } from "@/actions/auth"

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null)

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8">
          <span className="font-ui font-extrabold text-[28px] tracking-tight text-foreground">
            i<span style={{ color: "var(--accent)", textShadow: "0 0 12px var(--accent-glow), 0 0 24px rgba(0,217,192,0.2)" }}>TEC</span>ify
          </span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
        >
          <div className="p-6 pb-0">
            <h1 className="font-ui font-bold text-lg text-foreground tracking-tight">Sign in</h1>
            <p className="mt-1 text-xs text-text-sec">Welcome back. Enter your credentials to continue.</p>
          </div>

          <form action={action} className="p-6 space-y-3.5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-text-sec">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full h-9 px-3 rounded-xl text-sm text-foreground placeholder:text-text-dim outline-none transition-colors"
                style={{ background: "var(--elevated)", border: "1px solid var(--border-strong)" }}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-text-sec">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full h-9 px-3 rounded-xl text-sm text-foreground placeholder:text-text-dim outline-none transition-colors"
                style={{ background: "var(--elevated)", border: "1px solid var(--border-strong)" }}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}
              />
            </div>

            {state?.error && <p className="text-xs" style={{ color: "var(--red, #F87171)" }}>{state.error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="w-full flex items-center justify-center h-9 rounded-full text-xs font-semibold font-ui disabled:opacity-50 transition-all mt-1"
              style={{
                background: "linear-gradient(135deg, rgba(0,217,192,0.2), rgba(0,217,192,0.1))",
                border: "1px solid rgba(0,217,192,0.4)",
                color: "var(--accent)",
              }}
              onMouseEnter={e => !pending && (e.currentTarget.style.boxShadow = "0 0 16px var(--accent-glow)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-text-sec">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-accent hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
