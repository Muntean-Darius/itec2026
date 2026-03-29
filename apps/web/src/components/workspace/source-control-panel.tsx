// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Source Control Panel
// Sidebar tab for Git operations: staging, committing, viewing changes
// ═══════════════════════════════════════════════════════════════════════════

"use client"

import { useState, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  GitBranch,
  Plus,
  Minus,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FilePlus2,
  FileX2,
  FileEdit,
  GitCommit,
  RefreshCw,
  Loader2,
  CloudUpload,
  CloudDownload,
  Download,
  Link2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import {
  useGit,
  getFileStatusLabel,
  isFileStaged,
  hasUnstagedChanges,
  type FileStatus,
} from "@/lib/git"
import { cn } from "@/lib/utils"

interface SourceControlPanelProps {
  onViewDiff?: (filepath: string) => void
  className?: string
}

export function SourceControlPanel({
  onViewDiff,
  className,
}: SourceControlPanelProps) {
  const git = useGit()
  const [commitMessage, setCommitMessage] = useState("")
  const [remoteUrl, setRemoteUrl] = useState("")
  const [connectingRemote, setConnectingRemote] = useState(false)
  const [changesExpanded, setChangesExpanded] = useState(true)
  const [stagedExpanded, setStagedExpanded] = useState(true)

  const remoteConnected = git.remotes.length > 0

  // Split files into staged and unstaged
  const { stagedFiles, unstagedFiles } = useMemo(() => {
    const staged: FileStatus[] = []
    const unstaged: FileStatus[] = []

    for (const file of git.fileStatuses) {
      if (isFileStaged(file)) {
        staged.push(file)
      }
      if (hasUnstagedChanges(file)) {
        unstaged.push(file)
      }
    }

    return { stagedFiles: staged, unstagedFiles: unstaged }
  }, [git.fileStatuses])

  // Handle commit
  const handleCommit = useCallback(async () => {
    if (!commitMessage.trim() || stagedFiles.length === 0) return
    await git.commit(commitMessage.trim())
    setCommitMessage("")
  }, [commitMessage, stagedFiles.length, git])

  // Handle key press in commit input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        handleCommit()
      }
    },
    [handleCommit]
  )

  const normalizeRemoteUrl = useCallback((value: string): string => {
    const trimmed = value.trim()
    if (!trimmed) return ""
    if (trimmed.startsWith("git@github.com:")) {
      const repoPath = trimmed.slice("git@github.com:".length).replace(/\.git$/, "")
      return `https://github.com/${repoPath}.git`
    }
    if (trimmed.startsWith("https://github.com/") || trimmed.startsWith("http://github.com/")) {
      return trimmed.endsWith(".git") ? trimmed : `${trimmed}.git`
    }
    return trimmed
  }, [])

  const handleConnectRemote = useCallback(async () => {
    const normalizedUrl = normalizeRemoteUrl(remoteUrl)
    if (!normalizedUrl) return
    setConnectingRemote(true)
    try {
      await git.addRemote("origin", normalizedUrl)
      setRemoteUrl("")
    } finally {
      setConnectingRemote(false)
    }
  }, [git, normalizeRemoteUrl, remoteUrl])

  // Get icon for file status
  const getStatusIcon = (status: FileStatus) => {
    const label = getFileStatusLabel(status)
    switch (label) {
      case "added":
      case "untracked":
        return <FilePlus2 className="h-3.5 w-3.5 text-success" />
      case "deleted":
      case "staged-deleted":
        return <FileX2 className="h-3.5 w-3.5 text-error" />
      case "modified":
      case "staged-modified":
      case "staged":
        return <FileEdit className="h-3.5 w-3.5 text-warning" />
      default:
        return <FileCode2 className="h-3.5 w-3.5 text-text-tertiary" />
    }
  }

  // Get status badge color
  const getStatusBadge = (status: FileStatus) => {
    const label = getFileStatusLabel(status)
    switch (label) {
      case "added":
      case "untracked":
        return "A"
      case "deleted":
      case "staged-deleted":
        return "D"
      case "modified":
      case "staged-modified":
      case "staged":
        return "M"
      default:
        return "?"
    }
  }

  // Not initialized state
  if (!git.initialized && !git.loading) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Source Control
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <GitBranch className="h-12 w-12 text-text-tertiary" />
          <div className="text-center">
            <p className="text-sm text-text-secondary mb-1">
              No Git repository
            </p>
            <p className="text-xs text-text-tertiary">
              Initialize a repository to start tracking changes
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => git.initRepo()}
            className="gap-1.5"
          >
            <GitBranch className="h-3.5 w-3.5" />
            Initialize Repository
          </Button>
        </div>
      </div>
    )
  }

  // Loading state
  if (git.loading) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Source Control
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-text-tertiary animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          Source Control
        </span>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => git.refreshStatus()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Commit Form */}
          <div className="mb-3">
            <Input
              placeholder="Commit message"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 text-xs mb-2"
            />
            <Button
              size="sm"
              className="w-full h-7 text-xs gap-1.5"
              disabled={!commitMessage.trim() || stagedFiles.length === 0}
              onClick={handleCommit}
            >
              <GitCommit className="h-3.5 w-3.5" />
              Commit ({stagedFiles.length})
            </Button>

            <div className="mt-2 grid grid-cols-3 gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                disabled={!remoteConnected || git.syncing}
                onClick={() => git.fetch()}
              >
                <Download className="h-3.5 w-3.5" />
                Fetch
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                disabled={!remoteConnected || git.syncing}
                onClick={() => git.pull()}
              >
                <CloudDownload className="h-3.5 w-3.5" />
                Pull
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={!remoteConnected || git.syncing}
                onClick={() => git.push()}
              >
                <CloudUpload className="h-3.5 w-3.5" />
                Push
              </Button>
            </div>
          </div>

          <Separator className="my-2" />

          {!remoteConnected ? (
            <>
              <div className="mb-3 rounded-md border border-border-subtle p-2">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                  <Link2 className="h-3.5 w-3.5" />
                  Connect Remote
                </div>
                <Input
                  placeholder="https://github.com/user/repo.git"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  className="mt-2 h-7 w-full text-xs"
                  disabled={!remoteUrl.trim() || connectingRemote}
                  onClick={handleConnectRemote}
                >
                  {connectingRemote ? "Connecting..." : "Connect Repository"}
                </Button>
              </div>
              <Separator className="my-2" />
            </>
          ) : null}

          {/* Staged Changes */}
          <div className="mb-2">
            <div
              className="flex items-center justify-between w-full px-1 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => setStagedExpanded(!stagedExpanded)}
                >
                  {stagedExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  Staged Changes
                </button>
                {stagedFiles.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-brand/20 text-brand rounded">
                    {stagedFiles.length}
                  </span>
                )}
              </div>
              {stagedFiles.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation()
                        git.unstageAll()
                      }}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Unstage All</TooltipContent>
                </Tooltip>
              )}
            </div>

            <AnimatePresence initial={false}>
              {stagedExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  {stagedFiles.length === 0 ? (
                    <p className="text-xs text-text-tertiary px-2 py-2">
                      No staged changes
                    </p>
                  ) : (
                    <div className="space-y-0.5 pt-1">
                      {stagedFiles.map((file) => (
                        <FileStatusItem
                          key={file.filepath}
                          file={file}
                          staged
                          onUnstage={() => git.unstageFile(file.filepath)}
                          onViewDiff={() => onViewDiff?.(file.filepath)}
                          getStatusIcon={getStatusIcon}
                          getStatusBadge={getStatusBadge}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Changes (Unstaged) */}
          <div>
            <div
              className="flex items-center justify-between w-full px-1 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => setChangesExpanded(!changesExpanded)}
                >
                  {changesExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  Changes
                </button>
                {unstagedFiles.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-elevated text-text-secondary rounded">
                    {unstagedFiles.length}
                  </span>
                )}
              </div>
              {unstagedFiles.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation()
                        git.stageAll()
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Stage All</TooltipContent>
                </Tooltip>
              )}
            </div>

            <AnimatePresence initial={false}>
              {changesExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  {unstagedFiles.length === 0 ? (
                    <p className="text-xs text-text-tertiary px-2 py-2">
                      No changes
                    </p>
                  ) : (
                    <div className="space-y-0.5 pt-1">
                      {unstagedFiles.map((file) => (
                        <FileStatusItem
                          key={file.filepath}
                          file={file}
                          staged={false}
                          onStage={() => git.stageFile(file.filepath)}
                          onDiscard={() => git.discardChanges(file.filepath)}
                          onViewDiff={() => onViewDiff?.(file.filepath)}
                          getStatusIcon={getStatusIcon}
                          getStatusBadge={getStatusBadge}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── File Status Item ────────────────────────────────────────────────────

interface FileStatusItemProps {
  file: FileStatus
  staged: boolean
  onStage?: () => void
  onUnstage?: () => void
  onDiscard?: () => void
  onViewDiff?: () => void
  getStatusIcon: (status: FileStatus) => React.ReactNode
  getStatusBadge: (status: FileStatus) => string
}

function FileStatusItem({
  file,
  staged,
  onStage,
  onUnstage,
  onDiscard,
  onViewDiff,
  getStatusIcon,
  getStatusBadge,
}: FileStatusItemProps) {
  const filename = file.filepath.split("/").pop() ?? file.filepath
  const directory = file.filepath.split("/").slice(0, -1).join("/")

  return (
    <div
      className="group flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-hover/50 cursor-pointer"
      onClick={onViewDiff}
    >
      {getStatusIcon(file)}
      <div className="flex-1 min-w-0">
        <span className="text-xs text-text-primary truncate block">
          {filename}
        </span>
        {directory && (
          <span className="text-[10px] text-text-tertiary truncate block">
            {directory}
          </span>
        )}
      </div>
      <span
        className={cn(
          "text-[10px] font-medium px-1 rounded",
          getStatusBadge(file) === "A" && "text-success",
          getStatusBadge(file) === "D" && "text-error",
          getStatusBadge(file) === "M" && "text-warning"
        )}
      >
        {getStatusBadge(file)}
      </span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {staged ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => {
                  e.stopPropagation()
                  onUnstage?.()
                }}
              >
                <Minus className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Unstage</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDiscard?.()
                  }}
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Discard Changes</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation()
                    onStage?.()
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stage</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  )
}
