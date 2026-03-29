"use client"

import { useState, useActionState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Code2, ArrowLeft, Loader2, Check } from "lucide-react"
import { updateProfile } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

interface SettingsFormProps {
  initialName: string
  initialEmail: string
}

export function SettingsForm({ initialName, initialEmail }: SettingsFormProps) {
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await updateProfile(formData)
      return result ?? null
    },
    null
  )

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
              <Code2 className="h-4 w-4 text-brand-foreground" />
            </div>
            <span className="text-base font-semibold text-text-primary tracking-tight">
              iTECify
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-lg px-6 py-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-brand transition-colors mb-6 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              Account Settings
            </h1>
            <p className="mt-1 text-text-secondary">
              Manage your profile information
            </p>
          </motion.div>

          <Separator className="my-6" />

          <form action={formAction} className="space-y-6">
            <div className="space-y-1.5">
              <label
                htmlFor="name"
                className="text-sm font-medium text-text-secondary"
              >
                Display name
              </label>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                minLength={1}
                maxLength={100}
                autoComplete="name"
                className="bg-elevated/50 border-border-default hover:border-brand focus-visible:ring-brand/50 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium text-text-secondary"
              >
                Email address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="bg-elevated/50 border-border-default hover:border-brand focus-visible:ring-brand/50 transition-colors mb-1"
              />
              <p className="text-[11px] text-text-tertiary">
                Changing your email will send a confirmation to the new address.
              </p>
            </div>

            {state?.error && (
              <p className="text-sm text-error">{state.error}</p>
            )}

            {state?.success && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 text-sm text-success"
              >
                <Check className="h-4 w-4" />
                Profile updated successfully
              </motion.p>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
