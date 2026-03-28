"use client"

import { useActionState } from "react"
import { motion } from "framer-motion"
import { Code2, ArrowRight, Loader2 } from "lucide-react"
import { completeOnboarding } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function OnboardingForm({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await completeOnboarding(formData)
      return result ?? null
    },
    null
  )

  return (
    <div className="flex h-full items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md px-6"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand">
            <Code2 className="h-5 w-5 text-brand-foreground" />
          </div>
          <span className="text-xl font-semibold text-text-primary tracking-tight">
            iTECify
          </span>
        </div>

        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Welcome aboard
        </h1>
        <p className="mt-2 text-text-secondary">
          Let&apos;s set up your profile. What should we call you?
        </p>

        <form action={formAction} className="mt-8 space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="email-display"
              className="text-sm font-medium text-text-secondary"
            >
              Email
            </label>
            <Input
              id="email-display"
              value={email}
              disabled
              className="opacity-60"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="name"
              className="text-sm font-medium text-text-secondary"
            >
              Your name
            </label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Alex Chen"
              autoFocus
              required
              minLength={1}
              maxLength={100}
              autoComplete="name"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-error">{state.error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Continue
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
