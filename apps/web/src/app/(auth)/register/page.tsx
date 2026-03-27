"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push("/dashboard")
      router.refresh()
    }
  }

  const inputStyle = {
    background: "var(--elevated)",
    border: "1px solid var(--border-strong)",
  }

  function focusIn(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = "var(--accent)"
  }
  function focusOut(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = "var(--border-strong)"
  }

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
          className="rounded-[10px] overflow-hidden"
          style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
        >
          <div className="p-6 pb-0">
            <h1 className="font-ui font-bold text-lg text-foreground tracking-tight">Create account</h1>
            <p className="mt-1 text-xs text-text-sec">Get started with a free iTECify account.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-medium text-text-sec">Full name</label>
              <input
                id="name"
                type="text"
                placeholder="Ada Lovelace"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
                className="w-full h-8 px-2.5 rounded text-sm text-foreground placeholder:text-text-dim outline-none transition-colors"
                style={inputStyle}
                onFocus={focusIn}
                onBlur={focusOut}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-text-sec">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full h-8 px-2.5 rounded text-sm text-foreground placeholder:text-text-dim outline-none transition-colors"
                style={inputStyle}
                onFocus={focusIn}
                onBlur={focusOut}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-text-sec">Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
                className="w-full h-8 px-2.5 rounded text-sm text-foreground placeholder:text-text-dim outline-none transition-colors"
                style={inputStyle}
                onFocus={focusIn}
                onBlur={focusOut}
              />
            </div>

            {error && <p className="text-xs text-red">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center h-8 rounded text-xs font-semibold font-ui disabled:opacity-50 transition-all mt-1"
              style={{
                background: "linear-gradient(135deg, rgba(0,217,192,0.2), rgba(0,217,192,0.1))",
                border: "1px solid rgba(0,217,192,0.4)",
                color: "var(--accent)",
              }}
              onMouseEnter={e => !loading && (e.currentTarget.style.boxShadow = "0 0 16px var(--accent-glow)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-text-sec">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
