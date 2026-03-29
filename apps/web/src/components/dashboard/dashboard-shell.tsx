"use client"

import { useState, useActionState, useRef, type DragEvent } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Search,
  Code2,
  Users,
  Clock,
  MoreHorizontal,
  Sparkles,
  LogOut,
  Settings,
  FolderOpen,
  Share2,
  Copy,
  CheckCheck,
  Trash2,
  GitBranch,
  Upload,
  FileCode2,
} from "lucide-react"
import type { User, Project } from "@/data/types"
import { signOut, createProject, deleteProject, updateProject } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { getWorkspaceInviteUrl } from "@/lib/workspace-share"

const MAX_IMPORT_FILES = 2_000
const MAX_IMPORT_TOTAL_BYTES = 250 * 1024 * 1024

interface WebkitFileSystemEntry {
  isFile: boolean
  isDirectory: boolean
  fullPath: string
  name: string
}

interface WebkitFileSystemFileEntry extends WebkitFileSystemEntry {
  isFile: true
  file: (success: (file: File) => void, error?: (err: DOMException) => void) => void
}

interface WebkitFileSystemDirectoryReader {
  readEntries: (
    success: (entries: WebkitFileSystemEntry[]) => void,
    error?: (err: DOMException) => void
  ) => void
}

interface WebkitFileSystemDirectoryEntry extends WebkitFileSystemEntry {
  isDirectory: true
  createReader: () => WebkitFileSystemDirectoryReader
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
}

interface DashboardShellProps {
  user: User
  projects: Project[]
}

export function DashboardShell({ user, projects }: DashboardShellProps) {
  const [search, setSearch] = useState("")
  const [showNewProject, setShowNewProject] = useState(false)
  const [createMode, setCreateMode] = useState<"blank" | "github" | "import">("blank")
  const [lastSubmitMode, setLastSubmitMode] = useState<"blank" | "github" | "import" | null>(null)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDesc, setNewProjectDesc] = useState("")
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editingProjectName, setEditingProjectName] = useState("")
  const [editingProjectDesc, setEditingProjectDesc] = useState("")
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [inviteProject, setInviteProject] = useState<Project | null>(null)
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false)
  const [githubUrl, setGithubUrl] = useState("")
  const [importFileStates, setImportFileStates] = useState("")
  const [importSummary, setImportSummary] = useState("")
  const [isImportDragging, setIsImportDragging] = useState(false)
  const [localImportError, setLocalImportError] = useState("")
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [tabVersion, setTabVersion] = useState(0)

  const [createState, createAction, isCreating] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const source = ((formData.get("source") as string) || "blank") as "blank" | "github" | "import"
      setLastSubmitMode(source)
      const result = await createProject(null, formData)
      if (!result?.error) {
        setShowNewProject(false)
        setCreateMode("blank")
        setNewProjectName("")
        setNewProjectDesc("")
        setGithubUrl("")
        setImportFileStates("")
        setImportSummary("")
        setLocalImportError("")
      }
      return result ?? null
    },
    null
  )

  const clearImportState = () => {
    setImportFileStates("")
    setImportSummary("")
    setLocalImportError("")
    setNewProjectName("")
    if (importInputRef.current) {
      importInputRef.current.value = ""
    }
  }

  const clearGithubState = () => {
    setGithubUrl("")
    setNewProjectName("")
    setLocalImportError("")
  }

  const applyPrefilledName = (value: string) => {
    if (!value) return
    setNewProjectName((prev) => (prev.trim() ? prev : value))
  }

  const tryPrefillNameFromGithub = (url: string) => {
    try {
      const parsed = new URL(url)
      if (parsed.hostname !== "github.com") return
      const parts = parsed.pathname.split("/").filter(Boolean)
      if (parts.length < 2) return
      const repo = parts[1].replace(/\.git$/, "")
      if (repo) applyPrefilledName(repo)
    } catch {
      return
    }
  }

  const processImportedFiles = async (
    files: Array<{ file: File; relativePath: string }>,
    rootFolderHint?: string
  ) => {
    if (files.length === 0) {
      setImportFileStates("")
      setImportSummary("")
      setLocalImportError("Please select a folder with files.")
      return
    }

    if (files.length > MAX_IMPORT_FILES) {
      setImportFileStates("")
      setImportSummary("")
      setLocalImportError(`Import supports up to ${MAX_IMPORT_FILES} files.`)
      return
    }

    const rootFolderName =
      rootFolderHint ??
      files[0]?.relativePath.split("/").filter(Boolean)[0] ??
      files[0]?.file.name.replace(/\.[^/.]+$/, "")
    applyPrefilledName(rootFolderName)

    let totalBytes = 0
    const states: Record<string, string> = {}
    for (const entry of files) {
      const content = await entry.file.text()
      totalBytes += new TextEncoder().encode(content).length
      if (totalBytes > MAX_IMPORT_TOTAL_BYTES) {
        setImportFileStates("")
        setImportSummary("")
        setLocalImportError("Imported files are too large. Keep total text under 250MB.")
        return
      }
      states[`/${entry.relativePath.replace(/\\/g, "/")}`] = content
    }

    setImportFileStates(JSON.stringify(states))
    setImportSummary(`${files.length} file${files.length === 1 ? "" : "s"} ready to import`)
    setLocalImportError("")
  }

  const readImportFilesFromInput = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      await processImportedFiles([])
      return
    }

    const entries = Array.from(files).map((file) => {
      const withRelative = file as File & { webkitRelativePath?: string }
      return {
        file,
        relativePath: withRelative.webkitRelativePath || file.name,
      }
    })

    const rootFromInput =
      entries[0]?.relativePath.split("/").filter(Boolean)[0] ??
      entries[0]?.file.name.replace(/\.[^/.]+$/, "")

    await processImportedFiles(entries, rootFromInput)
  }

  const readImportFilesFromDrop = async (event: DragEvent<HTMLButtonElement>) => {
    const items = Array.from(event.dataTransfer.items || [])
    const getEntry = (item: DataTransferItem): WebkitFileSystemEntry | null => {
      const candidate = item as DataTransferItem & {
        webkitGetAsEntry?: () => WebkitFileSystemEntry | null
      }
      return typeof candidate.webkitGetAsEntry === "function"
        ? candidate.webkitGetAsEntry()
        : null
    }

    const firstEntry = items[0] ? getEntry(items[0]) : null

    if (!firstEntry) {
      await readImportFilesFromInput(event.dataTransfer.files)
      return
    }

    const readDirectoryEntries = (entry: WebkitFileSystemDirectoryEntry): Promise<WebkitFileSystemEntry[]> =>
      new Promise((resolve, reject) => {
        const reader = entry.createReader()
        const allEntries: WebkitFileSystemEntry[] = []
        const readBatch = () => {
          reader.readEntries(
            (batch) => {
              if (batch.length === 0) {
                resolve(allEntries)
                return
              }
              allEntries.push(...batch)
              readBatch()
            },
            (err) => reject(err)
          )
        }
        readBatch()
      })

    const walkEntry = async (
      entry: WebkitFileSystemEntry,
      currentPath = ""
    ): Promise<Array<{ file: File; relativePath: string }>> => {
      if (entry.isFile) {
        const fileEntry = entry as WebkitFileSystemFileEntry
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject)
        })
        return [{ file, relativePath: currentPath || file.name }]
      }

      if (!entry.isDirectory) return []
      const dirEntry = entry as WebkitFileSystemDirectoryEntry
      const children = await readDirectoryEntries(dirEntry)
      const nested = await Promise.all(
        children.map((child) => {
          const nextPath = currentPath ? `${currentPath}/${child.name}` : child.name
          return walkEntry(child, nextPath)
        })
      )
      return nested.flat()
    }

    const droppedEntries = await Promise.all(
      items
        .map((item) => getEntry(item))
        .filter((entry): entry is WebkitFileSystemEntry => Boolean(entry))
        .map((entry) => walkEntry(entry, entry.name))
    )

    await processImportedFiles(droppedEntries.flat(), firstEntry.name)
  }

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  )

  const openProjectSettings = (project: Project) => {
    setEditingProject(project)
    setEditingProjectName(project.name)
    setEditingProjectDesc(project.description ?? "")
  }

  const openInviteDialog = (project: Project) => {
    setInviteProject(project)
    setInviteLinkCopied(false)
  }

  const copyInviteLink = async () => {
    if (!inviteProject || typeof window === "undefined") return

    const inviteUrl = getWorkspaceInviteUrl(inviteProject.id, window.location.origin)
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setInviteLinkCopied(true)
      toast.success("Invite link copied", {
        description: `Share it to let collaborators join ${inviteProject.name}.`,
      })
      window.setTimeout(() => setInviteLinkCopied(false), 2000)
    } catch {
      toast.error("Unable to copy invite link", {
        description: "Copy the link manually and try again.",
      })
    }
  }

  const handleSaveProjectSettings = async () => {
    if (!editingProject) return

    const trimmedName = editingProjectName.trim()
    if (!trimmedName) {
      toast.error("Workspace name is required", {
        description: "Give the workspace a name before saving.",
      })
      return
    }

    setIsSavingProject(true)
    const formData = new FormData()
    formData.set("projectId", editingProject.id)
    formData.set("name", trimmedName)
    formData.set("description", editingProjectDesc.trim())

    const result = await updateProject(formData)
    setIsSavingProject(false)

    if (result?.error) {
      toast.error("Unable to update workspace", {
        description: result.error,
      })
      return
    }

    toast.success("Workspace updated", {
      description: `${trimmedName} is ready to go.`,
    })
    setEditingProject(null)
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* ─── Top Bar ─── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
              <Code2 className="h-4 w-4 text-brand-foreground" />
            </div>
            <span className="text-base font-semibold text-text-primary tracking-tight">
              iTECify
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full p-1 pr-3 transition-colors hover:bg-hover">
                <Avatar className="h-7 w-7">
                  <AvatarFallback
                    className="text-[10px]"
                    style={{ backgroundColor: user.cursorColor, color: "#fff" }}
                  >
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-text-secondary">{user.name}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <a href="/settings">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-error" onClick={() => signOut()}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ─── Content ─── */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-6 py-10">
          {/* Greeting */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              Welcome back, {user.name.split(" ")[0]}
            </h1>
            <p className="mt-1 text-text-secondary">
              Your collaborative workspaces
            </p>
          </motion.div>

          {/* Search + New */}
          <div className="mt-8 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                placeholder="Search workspaces..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => setShowNewProject(true)}>
              <Plus className="h-4 w-4" />
              New Workspace
            </Button>
          </div>

          <Separator className="my-6" />

          {/* Project Grid */}
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <FolderOpen className="h-12 w-12 text-text-tertiary" />
              <p className="mt-4 text-text-secondary">
                {search ? "No workspaces match your search" : "No workspaces yet"}
              </p>
              {!search && (
                <Button
                  className="mt-4"
                  onClick={() => setShowNewProject(true)}
                >
                  <Sparkles className="h-4 w-4" />
                  Create your first workspace
                </Button>
              )}
            </motion.div>
          ) : (
            <motion.div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onSettings={openProjectSettings}
                  onInvite={openInviteDialog}
                  onDelete={setDeletingProject}
                />
              ))}
            </motion.div>
          )}
        </div>
      </main>

      {/* ─── New Project Dialog ─── */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Create new workspace</DialogTitle>
            <DialogDescription>
              Start a new collaborative coding session. You can invite
              collaborators after creating the workspace.
            </DialogDescription>
          </DialogHeader>
          <form action={createAction} className="space-y-4 py-4">
            <input type="hidden" name="source" value={createMode} />
            <input type="hidden" name="fileStates" value={importFileStates} />

            <Tabs
              value={createMode}
              onValueChange={(value) => {
                const next = value as "blank" | "github" | "import"
                if (next === "import") {
                  clearGithubState()
                } else if (next === "github") {
                  clearImportState()
                } else {
                  clearGithubState()
                  clearImportState()
                }
                setTabVersion((prev) => prev + 1)
                setCreateMode(next)
              }}
            >
              <TabsList className="grid h-10 w-full grid-cols-3 rounded-lg bg-elevated p-1">
                <TabsTrigger value="blank" className="gap-1.5">
                  <FileCode2 className="h-3.5 w-3.5" />
                  Blank
                </TabsTrigger>
                <TabsTrigger value="github" className="gap-1.5">
                  <GitBranch className="h-3.5 w-3.5" />
                  GitHub
                </TabsTrigger>
                <TabsTrigger value="import" className="gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  Import
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${createMode}-${tabVersion}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="space-y-4"
              >
                {createMode === "blank" && (
                  <>
                    <div className="space-y-2">
                      <label htmlFor="project-name" className="text-sm font-medium text-text-secondary">
                        Workspace Title
                      </label>
                      <Input
                        id="project-name"
                        name="name"
                        placeholder="Workspace name"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        autoFocus
                        required
                        disabled={isCreating}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="project-desc" className="text-sm font-medium text-text-secondary">
                        Description <span className="text-text-tertiary">(optional)</span>
                      </label>
                      <Input
                        id="project-desc"
                        name="description"
                        placeholder="What's this workspace about?"
                        value={newProjectDesc}
                        onChange={(e) => setNewProjectDesc(e.target.value)}
                        disabled={isCreating}
                      />
                    </div>
                  </>
                )}

                {createMode === "github" && (
                  <>
                    <div className="space-y-2">
                      <label htmlFor="github-url" className="text-sm font-medium text-text-secondary">
                        GitHub Repository URL
                      </label>
                      <Input
                        id="github-url"
                        name="githubUrl"
                        placeholder="https://github.com/user/repo"
                        value={githubUrl}
                        onChange={(e) => {
                          const value = e.target.value
                          setGithubUrl(value)
                          tryPrefillNameFromGithub(value)
                        }}
                        autoFocus
                        required
                        disabled={isCreating}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="project-name-github" className="text-sm font-medium text-text-secondary">
                        Workspace Title
                      </label>
                      <Input
                        id="project-name-github"
                        name="name"
                        placeholder="Workspace name"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        required
                        disabled={isCreating}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="project-desc-github" className="text-sm font-medium text-text-secondary">
                        Description <span className="text-text-tertiary">(optional)</span>
                      </label>
                      <Input
                        id="project-desc-github"
                        name="description"
                        placeholder="What's this workspace about?"
                        value={newProjectDesc}
                        onChange={(e) => setNewProjectDesc(e.target.value)}
                        disabled={isCreating}
                      />
                    </div>
                  </>
                )}

                {createMode === "import" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-secondary">
                        Local Folder
                      </label>
                      <button
                        type="button"
                        onClick={() => importInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setIsImportDragging(true)
                        }}
                        onDragLeave={() => setIsImportDragging(false)}
                        onDrop={async (e) => {
                          e.preventDefault()
                          setIsImportDragging(false)
                          await readImportFilesFromDrop(e)
                        }}
                        className={`w-full rounded-xl border border-dashed px-4 py-8 text-sm transition-colors ${
                          isImportDragging
                            ? "border-brand bg-brand-muted text-text-primary"
                            : "border-border-default bg-elevated/40 text-text-secondary hover:border-brand-muted-border"
                        }`}
                        disabled={isCreating}
                      >
                        Drop a folder here, or click to browse
                      </button>
                      <input
                        ref={importInputRef}
                        type="file"
                        // @ts-expect-error non-standard but supported in Chromium/Safari
                        webkitdirectory=""
                        directory=""
                        className="hidden"
                        multiple
                        onChange={async (e) => {
                          await readImportFilesFromInput(e.target.files)
                        }}
                        disabled={isCreating}
                      />
                      {importSummary && <p className="text-xs text-success">{importSummary}</p>}
                      {localImportError && <p className="text-xs text-error">{localImportError}</p>}
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="project-name-import" className="text-sm font-medium text-text-secondary">
                        Workspace Title
                      </label>
                      <Input
                        id="project-name-import"
                        name="name"
                        placeholder="Workspace name"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        required
                        disabled={isCreating}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="project-desc-import" className="text-sm font-medium text-text-secondary">
                        Description <span className="text-text-tertiary">(optional)</span>
                      </label>
                      <Input
                        id="project-desc-import"
                        name="description"
                        placeholder="What's this workspace about?"
                        value={newProjectDesc}
                        onChange={(e) => setNewProjectDesc(e.target.value)}
                        disabled={isCreating}
                      />
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            {createMode === "import" && localImportError && (
              <p className="text-sm text-error">{localImportError}</p>
            )}

            {createState?.error && lastSubmitMode === createMode && (
              <p className="text-sm text-error">{createState.error}</p>
            )}

            <DialogFooter>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setShowNewProject(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !newProjectName.trim() ||
                  isCreating ||
                  (createMode === "github" && !githubUrl.trim()) ||
                  (createMode === "import" && !importFileStates)
                }
              >
                {isCreating
                  ? "Creating..."
                  : createMode === "github"
                    ? "Clone & Create"
                    : createMode === "import"
                      ? "Import & Create"
                      : "Create Workspace"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingProject} onOpenChange={(open) => { if (!open) setEditingProject(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workspace settings</DialogTitle>
            <DialogDescription>
              Update the workspace name and description without leaving the dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="edit-project-name" className="text-sm font-medium text-text-secondary">
                Name
              </label>
              <Input
                id="edit-project-name"
                value={editingProjectName}
                onChange={(e) => setEditingProjectName(e.target.value)}
                placeholder="Workspace name"
                disabled={isSavingProject}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-project-description" className="text-sm font-medium text-text-secondary">
                Description <span className="text-text-tertiary">(optional)</span>
              </label>
              <Input
                id="edit-project-description"
                value={editingProjectDesc}
                onChange={(e) => setEditingProjectDesc(e.target.value)}
                placeholder="What&apos;s this workspace about?"
                disabled={isSavingProject}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingProject(null)} disabled={isSavingProject}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveProjectSettings()} disabled={isSavingProject || !editingProjectName.trim()}>
              {isSavingProject ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!inviteProject} onOpenChange={(open) => { if (!open) setInviteProject(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite collaborators</DialogTitle>
            <DialogDescription>
              Share this link to let teammates join <strong>{inviteProject?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={
                inviteProject && typeof window !== "undefined"
                  ? getWorkspaceInviteUrl(inviteProject.id, window.location.origin)
                  : ""
              }
              className="flex-1 text-sm"
              onFocus={(e) => e.target.select()}
            />
            <Button
              variant="default"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => void copyInviteLink()}
            >
              {inviteLinkCopied ? (
                <>
                  <CheckCheck className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog open={!!deletingProject} onOpenChange={(open) => { if (!open) setDeletingProject(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deletingProject?.name}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletingProject(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={async () => {
                if (!deletingProject) return
                setIsDeleting(true)
                await deleteProject(deletingProject.id)
                setIsDeleting(false)
                setDeletingProject(null)
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProjectCard({
  project,
  onSettings,
  onInvite,
  onDelete,
}: {
  project: Project
  onSettings: (project: Project) => void
  onInvite: (project: Project) => void
  onDelete: (project: Project) => void
}) {
  return (
    <motion.div variants={itemVariants}>
      <Link
        href={`/workspace/${project.id}`}
        className="group flex h-full flex-col rounded-xl border border-border-subtle bg-surface p-5 transition-all duration-200 hover:border-brand-muted-border hover:shadow-lg hover:shadow-brand-glow"
      >
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-muted">
            <Code2 className="h-5 w-5 text-brand" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-hover"
                onClick={(e) => e.preventDefault()}
              >
                <MoreHorizontal className="h-4 w-4 text-text-tertiary" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSettings(project) }}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInvite(project) }}>
                <Share2 className="mr-2 h-4 w-4" />
                Invite
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-error" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(project) }}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h3 className="mt-3 font-medium text-text-primary group-hover:text-brand transition-colors">
          {project.name}
        </h3>
        {project.description && (
          <p className="mt-1 text-sm text-text-secondary line-clamp-2">
            {project.description}
          </p>
        )}

        <div className="mt-auto pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{project.language}</Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Collaborator avatars */}
            <div className="flex -space-x-1.5">
              {project.collaborators.slice(0, 3).map((collab) => (
                <Avatar key={collab.id} className="h-5 w-5 ring-2 ring-surface">
                  <AvatarFallback
                    className="text-[8px]"
                    style={{ backgroundColor: collab.cursorColor, color: "#fff" }}
                  >
                    {getInitials(collab.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {project.collaborators.length > 3 && (
                <span className="ml-1 text-xs text-text-tertiary">
                  +{project.collaborators.length - 3}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-text-tertiary">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {project.collaborators.length}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(project.updatedAt)}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}
