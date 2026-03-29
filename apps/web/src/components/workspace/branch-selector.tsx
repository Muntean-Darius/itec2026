// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Branch Selector
// Dropdown for viewing current branch, switching branches, creating new branches
// ═══════════════════════════════════════════════════════════════════════════

"use client"

import { useState, useCallback } from "react"
import {
  GitBranch,
  ChevronDown,
  Plus,
  Check,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useGit } from "@/lib/git"
import { cn } from "@/lib/utils"

interface BranchSelectorProps {
  className?: string
}

export function BranchSelector({ className }: BranchSelectorProps) {
  const git = useGit()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newBranchName, setNewBranchName] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateBranch = useCallback(async () => {
    if (!newBranchName.trim()) return

    setIsCreating(true)
    await git.createBranch(newBranchName.trim())
    setNewBranchName("")
    setCreating(false)
    setIsCreating(false)
    setOpen(false)
  }, [newBranchName, git])

  const handleCheckout = useCallback(
    async (branch: string) => {
      if (branch === git.currentBranch) return
      await git.checkoutBranch(branch)
      setOpen(false)
    },
    [git]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleCreateBranch()
      } else if (e.key === "Escape") {
        setCreating(false)
        setNewBranchName("")
      }
    },
    [handleCreateBranch]
  )

  // Not initialized state
  if (!git.initialized) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 text-xs text-text-tertiary",
          className
        )}
      >
        <GitBranch className="h-3.5 w-3.5" />
        <span>No repo</span>
      </div>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 gap-1.5 text-xs font-normal",
            className
          )}
        >
          <GitBranch className="h-3.5 w-3.5 text-text-tertiary" />
          <span className="max-w-[100px] truncate">
            {git.currentBranch || "main"}
          </span>
          <ChevronDown className="h-3 w-3 text-text-tertiary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-text-tertiary">
          Switch Branch
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Existing branches */}
        {git.branches.map((branch) => (
          <DropdownMenuItem
            key={branch}
            className="text-xs cursor-pointer"
            onClick={() => handleCheckout(branch)}
          >
            <div className="flex items-center gap-2 w-full">
              <GitBranch className="h-3.5 w-3.5 text-text-tertiary" />
              <span className="flex-1 truncate">{branch}</span>
              {branch === git.currentBranch && (
                <Check className="h-3.5 w-3.5 text-success" />
              )}
            </div>
          </DropdownMenuItem>
        ))}

        {git.branches.length === 0 && (
          <div className="px-2 py-2 text-xs text-text-tertiary">
            No branches yet
          </div>
        )}

        <DropdownMenuSeparator />

        {/* Create new branch */}
        {creating ? (
          <div className="p-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Branch name"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-7 text-xs flex-1"
                autoFocus
              />
              <Button
                size="sm"
                className="h-7 px-2"
                disabled={!newBranchName.trim() || isCreating}
                onClick={handleCreateBranch}
              >
                {isCreating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <DropdownMenuItem
            className="text-xs cursor-pointer"
            onClick={(e) => {
              e.preventDefault()
              setCreating(true)
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-2 text-text-tertiary" />
            Create New Branch
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
