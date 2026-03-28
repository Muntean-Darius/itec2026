"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
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
} from "lucide-react"
import type { User, Project } from "@/data/types"
import { signOut } from "@/app/actions"
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
  const [newProjectName, setNewProjectName] = useState("")

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  )

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
                  <AvatarFallback className="text-[10px] bg-brand text-brand-foreground">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-text-secondary">{user.name}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" /> Settings
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
                <ProjectCard key={project.id} project={project} />
              ))}
            </motion.div>
          )}
        </div>
      </main>

      {/* ─── New Project Dialog ─── */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new workspace</DialogTitle>
            <DialogDescription>
              Start a new collaborative coding session. You can invite
              collaborators after creating the workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Workspace name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewProject(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newProjectName.trim()}
              onClick={() => {
                // RSC: Server Action to create project
                // await createProject({ name: newProjectName })
                setShowNewProject(false)
                setNewProjectName("")
              }}
            >
              Create workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
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
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Invite</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-error">Delete</DropdownMenuItem>
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
