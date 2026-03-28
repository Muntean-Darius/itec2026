"use client"

import Link from "next/link"
import { useActionState } from "react"
import { motion } from "framer-motion"
import { signIn } from "@/actions/auth"

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full max-w-[400px]"
    >
      {/* Logo */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">
          i
          <span className="text-brand" style={{ textShadow: "0 0 24px var(--brand-glow)" }}>
            TEC
          </span>
          ify
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Figma for Code — collaborative sandbox
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-border-strong bg-surface p-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-text-primary tracking-tight">
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Sign in to your account to continue.
          </p>
        </div>

        <form action={action} className="space-y-5">
          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="
                w-full h-10 px-3.5 rounded-xl text-sm
                bg-elevated text-text-primary placeholder:text-text-tertiary
                border border-border-strong
                outline-none transition-all duration-200
                focus:border-brand focus:ring-1 focus:ring-brand/30
              "
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="
                w-full h-10 px-3.5 rounded-xl text-sm
                bg-elevated text-text-primary placeholder:text-text-tertiary
                border border-border-strong
                outline-none transition-all duration-200
                focus:border-brand focus:ring-1 focus:ring-brand/30
              "
            />
          </div>

          {/* Error */}
          {state?.error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-error rounded-lg bg-error-muted px-3 py-2 border border-[var(--error-muted-border)]"
            >
              {state.error}
            </motion.p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={pending}
            className="
              w-full h-10 rounded-full text-sm font-semibold
              bg-brand text-brand-foreground
              hover:bg-brand-hover
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              shadow-[0_0_0_0_transparent]
              hover:shadow-[0_0_20px_var(--brand-glow)]
              active:scale-[0.98]
            "
          >
            {pending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 border-2 border-brand-foreground/30 border-t-brand-foreground rounded-full animate-spin" />
                Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      </div>

      {/* Footer link */}
      <p className="mt-6 text-center text-sm text-text-secondary">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-brand hover:text-brand-hover transition-colors">
          Create one
        </Link>
      </p>
    </motion.div>
  )
}
