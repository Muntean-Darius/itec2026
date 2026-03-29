"use client"

import { useEffect, useState, useCallback } from "react"
import {
  FileCode2,
  Search,
  Play,
  PanelLeft,
  Terminal,
  History,
  Bot,
  Keyboard,
  GitBranch,
  GitCommit,
  CloudUpload,
  CloudDownload,
  Plus,
  FolderGit2,
} from "lucide-react"
import type { FileNode } from "@/data/types"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useGitOptional } from "@/lib/git"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  files: FileNode[]
  onOpenFile: (path: string) => void
  onToggleSourceControl?: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  files,
  onOpenFile,
  onToggleSourceControl,
}: CommandPaletteProps) {
  const git = useGitOptional()
  const [mode, setMode] = useState<"default" | "branch" | "commit">("default")
  const [inputValue, setInputValue] = useState("")
  const [wasOpen, setWasOpen] = useState(open)

  // Reset mode when closing (using derived state pattern)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) {
      setMode("default")
      setInputValue("")
    }
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mode !== "default") {
          setMode("default")
          setInputValue("")
        } else {
          onOpenChange(false)
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onOpenChange, mode])

  // Handle create branch
  const handleCreateBranch = useCallback(async () => {
    if (!git || !inputValue.trim()) return
    await git.createBranch(inputValue.trim())
    setInputValue("")
    setMode("default")
    onOpenChange(false)
  }, [git, inputValue, onOpenChange])

  // Handle commit
  const handleCommit = useCallback(async () => {
    if (!git || !inputValue.trim()) return
    await git.commit(inputValue.trim())
    setInputValue("")
    setMode("default")
    onOpenChange(false)
  }, [git, inputValue, onOpenChange])

  // Handle checkout branch
  const handleCheckoutBranch = useCallback(async (branch: string) => {
    if (!git) return
    await git.checkoutBranch(branch)
    onOpenChange(false)
  }, [git, onOpenChange])

  // Branch creation mode
  if (mode === "branch") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="overflow-hidden p-0 max-w-lg border-brand-muted-border shadow-2xl">
          <div className="bg-elevated p-4">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="h-4 w-4 text-text-tertiary" />
              <span className="text-sm font-medium">Create New Branch</span>
            </div>
            <Input
              placeholder="Branch name (e.g., feature/my-feature)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateBranch()
              }}
              autoFocus
              className="mb-2"
            />
            <p className="text-xs text-text-tertiary">
              Press Enter to create and checkout, Escape to cancel
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Commit mode
  if (mode === "commit") {
    const stagedCount = git?.fileStatuses.filter(
      (f) => f.stage !== 1 && f.stage !== 0
    ).length ?? 0

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="overflow-hidden p-0 max-w-lg border-brand-muted-border shadow-2xl">
          <div className="bg-elevated p-4">
            <div className="flex items-center gap-2 mb-3">
              <GitCommit className="h-4 w-4 text-text-tertiary" />
              <span className="text-sm font-medium">Commit Changes</span>
              {stagedCount > 0 && (
                <span className="text-xs px-1.5 py-0.5 bg-brand/20 text-brand rounded">
                  {stagedCount} staged
                </span>
              )}
            </div>
            <Input
              placeholder="Commit message"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCommit()
              }}
              autoFocus
              className="mb-2"
              disabled={stagedCount === 0}
            />
            <p className="text-xs text-text-tertiary">
              {stagedCount === 0
                ? "No staged changes to commit"
                : "Press Enter to commit, Escape to cancel"}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 max-w-lg border-brand-muted-border shadow-2xl">
        <Command className="bg-elevated">
          <CommandInput placeholder="Type a command or search files..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading="Files">
              {files.map((file) => (
                <CommandItem
                  key={file.path}
                  value={file.path}
                  onSelect={() => {
                    onOpenFile(file.path)
                    onOpenChange(false)
                  }}
                >
                  <FileCode2 className="mr-2 h-4 w-4 text-text-tertiary" />
                  <span className="truncate">{file.path}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Actions">
              <CommandItem>
                <Play className="mr-2 h-4 w-4 text-success" />
                Run Code
                <CommandShortcut>⌘⇧R</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <Search className="mr-2 h-4 w-4" />
                Search in Files
                <CommandShortcut>⌘⇧F</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <PanelLeft className="mr-2 h-4 w-4" />
                Toggle Sidebar
                <CommandShortcut>⌘B</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <Terminal className="mr-2 h-4 w-4" />
                Toggle Terminal
                <CommandShortcut>⌘`</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <History className="mr-2 h-4 w-4" />
                Time Travel
              </CommandItem>
              <CommandItem>
                <Bot className="mr-2 h-4 w-4 text-ai" />
                Ask AI Agent
                <CommandShortcut>⌘J</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <Keyboard className="mr-2 h-4 w-4" />
                Keyboard Shortcuts
              </CommandItem>
            </CommandGroup>

            {/* Git Commands */}
            {git && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Git">
                  <CommandItem
                    onSelect={() => {
                      onToggleSourceControl?.()
                      onOpenChange(false)
                    }}
                  >
                    <FolderGit2 className="mr-2 h-4 w-4 text-text-tertiary" />
                    Source Control
                  </CommandItem>

                  {git.initialized ? (
                    <>
                      <CommandItem
                        onSelect={() => setMode("commit")}
                      >
                        <GitCommit className="mr-2 h-4 w-4 text-text-tertiary" />
                        Commit
                      </CommandItem>
                      <CommandItem
                        onSelect={() => setMode("branch")}
                      >
                        <Plus className="mr-2 h-4 w-4 text-text-tertiary" />
                        Create Branch
                      </CommandItem>

                      {/* Branch switching */}
                      {git.branches.length > 0 && (
                        <>
                          {git.branches.map((branch) => (
                            <CommandItem
                              key={branch}
                              value={`checkout ${branch}`}
                              onSelect={() => handleCheckoutBranch(branch)}
                            >
                              <GitBranch className="mr-2 h-4 w-4 text-text-tertiary" />
                              Checkout: {branch}
                              {branch === git.currentBranch && (
                                <span className="ml-auto text-xs text-success">current</span>
                              )}
                            </CommandItem>
                          ))}
                        </>
                      )}

                      {git.remotes.length > 0 && (
                        <>
                          <CommandItem
                            onSelect={() => {
                              git.push()
                              onOpenChange(false)
                            }}
                          >
                            <CloudUpload className="mr-2 h-4 w-4 text-text-tertiary" />
                            Push
                          </CommandItem>
                          <CommandItem
                            onSelect={() => {
                              git.pull()
                              onOpenChange(false)
                            }}
                          >
                            <CloudDownload className="mr-2 h-4 w-4 text-text-tertiary" />
                            Pull
                          </CommandItem>
                        </>
                      )}
                    </>
                  ) : (
                    <CommandItem
                      onSelect={() => {
                        git.initRepo()
                        onOpenChange(false)
                      }}
                    >
                      <GitBranch className="mr-2 h-4 w-4 text-text-tertiary" />
                      Initialize Repository
                    </CommandItem>
                  )}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
