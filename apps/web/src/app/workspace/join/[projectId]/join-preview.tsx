"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Code2, Users, ArrowRight, ArrowLeft, Loader2, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { joinProject } from "@/app/actions"
import { toast } from "sonner"

interface JoinPreviewProps {
  project: {
    id: string
    name: string
    description: string | null
    language: string
    createdAt: string
    owner: { name: string; avatarUrl: string | null }
    collaborators: { id: string; name: string; avatarUrl: string | null; cursorColor: string }[]
  }
}

export function JoinPreview({ project }: JoinPreviewProps) {
  const [joining, setJoining] = useState(false)
  const router = useRouter()

  const handleJoin = async () => {
    setJoining(true)
    const result = await joinProject(project.id)
    if (result?.error) {
      toast.error("Unable to join workspace", { description: result.error })
      setJoining(false)
    }
    // On success, joinProject redirects automatically
  }

  const handleDecline = () => {
    router.push("/dashboard")
  }

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"

  const createdDate = new Date(project.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const maxVisible = 5
  const visibleCollaborators = project.collaborators.slice(0, maxVisible)
  const overflowCount = project.collaborators.length - maxVisible

  return (
    <div className="flex h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="rounded-2xl border border-border-default bg-bg-surface p-8 shadow-lg">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand glow-brand">
              <Code2 className="h-7 w-7 text-brand-foreground" />
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6 text-center">
            <p className="text-sm font-medium text-text-secondary">
              You&apos;ve been invited to join
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-text-primary">
              {project.name}
            </h1>
            {project.description && (
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                {project.description}
              </p>
            )}
          </div>

          {/* Details */}
          <div className="mb-6 space-y-3 rounded-xl border border-border-subtle bg-bg-base/60 px-4 py-3">
            {/* Language */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-tertiary">Language</span>
              <Badge variant="secondary" className="text-xs font-mono">
                {project.language || "Multi"}
              </Badge>
            </div>

            {/* Created */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-tertiary">Created</span>
              <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Calendar className="h-3 w-3" />
                {createdDate}
              </span>
            </div>

            {/* Owner */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-tertiary">Owner</span>
              <span className="text-xs font-medium text-text-primary">
                {project.owner.name || "Unknown"}
              </span>
            </div>

            {/* Collaborators */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-tertiary">Collaborators</span>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {visibleCollaborators.map((user) => (
                    <Avatar
                      key={user.id}
                      className="h-6 w-6 border-2 border-bg-surface"
                    >
                      <AvatarImage src={user.avatarUrl ?? undefined} />
                      <AvatarFallback
                        className="text-[9px] font-medium"
                        style={{ backgroundColor: user.cursorColor, color: "white" }}
                      >
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {overflowCount > 0 && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg-surface bg-bg-elevated text-[9px] font-medium text-text-secondary">
                      +{overflowCount}
                    </div>
                  )}
                </div>
                <span className="flex items-center gap-1 text-xs text-text-secondary">
                  <Users className="h-3 w-3" />
                  {project.collaborators.length}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2.5">
            <Button
              className="w-full h-10 gap-2"
              disabled={joining}
              onClick={handleJoin}
            >
              {joining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Join Workspace
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              className="w-full h-10 gap-2 text-text-secondary"
              disabled={joining}
              onClick={handleDecline}
            >
              <ArrowLeft className="h-4 w-4" />
              Decline
            </Button>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-text-tertiary">
          You&apos;ll join as an Editor and can start collaborating immediately.
        </p>
      </motion.div>
    </div>
  )
}
