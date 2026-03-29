// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Sync Indicator
// Button for pushing/pulling changes to/from GitHub
// Shows notification dot when there are unpushed commits
// ═══════════════════════════════════════════════════════════════════════════

"use client"

import { useState, useCallback } from "react"
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useGit } from "@/lib/git"
import { cn } from "@/lib/utils"

interface SyncIndicatorProps {
  className?: string
}

export function SyncIndicator({ className }: SyncIndicatorProps) {
  const git = useGit()
  const [open, setOpen] = useState(false)

  const handlePush = useCallback(async () => {
    await git.push()
    setOpen(false)
  }, [git])

  const handlePull = useCallback(async () => {
    await git.pull()
    setOpen(false)
  }, [git])

  // Not initialized state
  if (!git.initialized) {
    return null
  }

  // No remotes configured
  if (git.remotes.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7 relative", className)}
            disabled
          >
            <Cloud className="h-4 w-4 text-text-tertiary" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>No remote configured</TooltipContent>
      </Tooltip>
    )
  }

  // Syncing state
  if (git.syncing) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", className)}
        disabled
      >
        <Loader2 className="h-4 w-4 animate-spin text-brand" />
      </Button>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7 relative", className)}
        >
          <RefreshCw className="h-4 w-4" />
          {/* Notification dot for unpushed commits */}
          {git.hasUnpushedCommits && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-brand animate-pulse" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs font-normal text-text-tertiary">
          Sync with Remote
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-xs cursor-pointer"
          onClick={handlePull}
        >
          <CloudDownload className="h-3.5 w-3.5 mr-2 text-text-tertiary" />
          Pull Changes
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-xs cursor-pointer"
          onClick={handlePush}
        >
          <CloudUpload className="h-3.5 w-3.5 mr-2 text-text-tertiary" />
          Push Changes
          {git.hasUnpushedCommits && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-brand/20 text-brand rounded">
              {git.commits.length}
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Sync Status Badge ───────────────────────────────────────────────────

interface SyncStatusBadgeProps {
  className?: string
}

export function SyncStatusBadge({ className }: SyncStatusBadgeProps) {
  const git = useGit()

  if (!git.initialized || git.remotes.length === 0) {
    return null
  }

  if (git.syncing) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 text-xs text-brand bg-brand/10 rounded-full",
          className
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Syncing...</span>
      </div>
    )
  }

  if (git.hasUnpushedCommits) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 text-xs text-warning bg-warning/10 rounded-full",
          className
        )}
      >
        <CloudUpload className="h-3 w-3" />
        <span>{git.commits.length} to push</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 text-xs text-success bg-success/10 rounded-full",
        className
      )}
    >
      <Cloud className="h-3 w-3" />
      <span>Synced</span>
    </div>
  )
}
