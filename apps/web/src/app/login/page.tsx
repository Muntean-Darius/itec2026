"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Code2, ArrowRight, GitBranch, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  const handleGitHubLogin = async () => {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      toast.error("Failed to sign in with GitHub. Please try again.")
      setLoading(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      toast.error("Failed to send magic link. Please try again.")
    } else {
      toast.success("Check your email for the magic link!")
    }
    setLoading(false)
  }

  return (
    <div className="flex h-full items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm px-6"
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand glow-brand">
            <Code2 className="h-6 w-6 text-brand-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">
              Welcome to iTECify
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Figma for Code — collaborative AI sandbox
            </p>
          </div>
        </div>

        {/* OAuth */}
        <Button
          variant="outline"
          className="w-full h-10 gap-2"
          disabled={loading}
          onClick={handleGitHubLogin}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GitBranch className="h-4 w-4" />
          )}
          Continue with GitHub
        </Button>

        <div className="my-4 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-text-tertiary">or</span>
          <Separator className="flex-1" />
        </div>

        {/* Email */}
        <form onSubmit={handleEmailLogin} className="space-y-3">
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <Button className="w-full gap-2" disabled={!email.trim() || loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Continue
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-text-tertiary">
          By continuing, you agree to the Terms of Service.
        </p>
      </motion.div>
    </div>
  )
}
