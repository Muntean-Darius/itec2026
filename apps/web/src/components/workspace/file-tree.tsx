"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronRight,
  File,
  FileJson,
  FileText,
  FolderOpen,
  Folder,
  Search,
  Plus,
  FilePlus,
  FolderPlus,
  Copy,
  Trash2,
  Pencil,
  ClipboardCopy,
} from "lucide-react"
import type { FileNode, PresenceUser } from "@/data/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface FileTreeProps {
  files: FileNode[]
  activeFilePath: string
  presence: PresenceUser[]
  onOpenFile: (path: string) => void
  onDeleteFile?: (path: string) => void
  onRenameFile?: (oldPath: string, newPath: string) => void
  onCreateFile?: (path: string) => void
  /** Increment to trigger inline file creation at root */
  createFileTrigger?: number
}

type TreeNode = {
  name: string
  path: string
  isDir: boolean
  children: TreeNode[]
  file?: FileNode
}

// ─── Context Menu ──────────────────────────────────────────────────────────

interface ContextMenuState {
  x: number
  y: number
  path: string
  isDir: boolean
}

function FileContextMenu({
  state,
  onClose,
  onDelete,
  onRename,
  onDuplicate,
  onCopyPath,
  onNewFileInFolder,
  onNewFolderInFolder,
  isEmptySpace,
}: {
  state: ContextMenuState
  onClose: () => void
  onDelete?: (path: string) => void
  onRename?: (oldPath: string) => void
  onDuplicate?: (path: string) => void
  onCopyPath?: (path: string) => void
  onNewFileInFolder?: (folderPath: string) => void
  onNewFolderInFolder?: (folderPath: string) => void
  isEmptySpace?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("keydown", keyHandler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("keydown", keyHandler)
    }
  }, [onClose])

  const menuItems: { icon?: typeof FilePlus; label?: string; shortcut?: string; destructive?: boolean; divider?: boolean }[] = isEmptySpace
    ? [
        { icon: FilePlus, label: "New File", shortcut: "a" },
        { icon: FolderPlus, label: "New Folder", shortcut: "" },
      ]
    : state.isDir
      ? [
          { icon: FilePlus, label: "New File", shortcut: "a" },
          { icon: FolderPlus, label: "New Folder", shortcut: "" },
          { divider: true },
          { icon: Pencil, label: "Rename", shortcut: "F2" },
          { icon: Copy, label: "Duplicate", shortcut: "" },
          { icon: ClipboardCopy, label: "Copy Path", shortcut: "" },
          { divider: true },
          { icon: Trash2, label: "Delete", shortcut: "", destructive: true },
        ]
      : [
          { icon: Pencil, label: "Rename", shortcut: "F2" },
          { icon: Copy, label: "Duplicate", shortcut: "" },
          { icon: ClipboardCopy, label: "Copy Path", shortcut: "" },
          { divider: true },
          { icon: Trash2, label: "Delete", shortcut: "Del", destructive: true },
        ]

  const handleAction = (label: string) => {
    switch (label) {
      case "Copy Path":
        onCopyPath?.(state.path)
        onClose()
        break
      case "Delete":
        onDelete?.(state.path)
        onClose()
        break
      case "Rename":
        onRename?.(state.path)
        onClose()
        break
      case "Duplicate":
        onDuplicate?.(state.path)
        onClose()
        break
      case "New File": {
        const folderPath = state.isDir ? state.path : state.path.substring(0, state.path.lastIndexOf("/")) || "/"
        onNewFileInFolder?.(folderPath)
        onClose()
        break
      }
      case "New Folder": {
        const folderPath = state.isDir ? state.path : state.path.substring(0, state.path.lastIndexOf("/")) || "/"
        onNewFolderInFolder?.(folderPath)
        onClose()
        break
      }
      default:
        onClose()
    }
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="fixed z-50 min-w-[180px] rounded-lg border border-border-default bg-popover p-1 shadow-xl"
      style={{ left: state.x, top: state.y }}
    >
      {menuItems.map((item, i) => {
        if (item.divider) {
          return (
            <div
              key={`divider-${i}`}
              className="my-1 h-px bg-border-subtle"
            />
          )
        }
        const Icon = item.icon!
        return (
          <button
            key={item.label}
            onClick={() => handleAction(item.label!)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
              item.destructive
                ? "text-error hover:bg-error-muted"
                : "text-text-secondary hover:bg-hover hover:text-text-primary"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">{item.label}</span>
            {item.shortcut && (
              <span className="text-[10px] text-text-tertiary">
                {item.shortcut}
              </span>
            )}
          </button>
        )
      })}
    </motion.div>
  )
}

// ─── Tree Helpers ──────────────────────────────────────────────────────────

function buildTree(files: FileNode[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [] }

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean)
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const existingChild = current.children.find((c) => c.name === part)

      if (existingChild) {
        current = existingChild
      } else {
        const pathSoFar = "/" + parts.slice(0, i + 1).join("/")
        const newNode: TreeNode = {
          name: part,
          path: pathSoFar,
          isDir: !isLast,
          children: [],
          file: isLast ? file : undefined,
        }
        current.children.push(newNode)
        current = newNode
      }
    }
  }

  // Sort: folders first, then alphabetical
  function sortTree(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    nodes.forEach((n) => sortTree(n.children))
  }
  sortTree(root.children)

  return root.children
}

import {
  SiTypescript,
  SiJavascript,
  SiPython,
  SiHtml5,
  SiCss,
  SiReact,
  SiDocker,
  SiMarkdown,
  SiYaml,
  SiGit,
  SiRust,
  SiGo,
  SiRuby,
  SiPhp,
  SiSwift,
  SiCplusplus,
  SiC,
  SiGnubash,
  SiToml,
  SiSvg,
} from "react-icons/si"

export function getFileIcon(name: string, size = "h-4 w-4") {
  const lower = name.toLowerCase()

  // React (JSX/TSX)
  if (lower.endsWith(".tsx") || lower.endsWith(".jsx"))
    return <SiReact className={`${size} text-cyan-400`} />
  // TypeScript
  if (lower.endsWith(".ts") || lower.endsWith(".d.ts"))
    return <SiTypescript className={`${size} text-blue-400`} />
  // JavaScript
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs"))
    return <SiJavascript className={`${size} text-yellow-300`} />
  // Python
  if (lower.endsWith(".py") || lower.endsWith(".pyw"))
    return <SiPython className={`${size} text-green-400`} />
  // HTML
  if (lower.endsWith(".html") || lower.endsWith(".htm"))
    return <SiHtml5 className={`${size} text-orange-500`} />
  // CSS / SCSS / LESS
  if (lower.endsWith(".css") || lower.endsWith(".scss") || lower.endsWith(".less") || lower.endsWith(".sass"))
    return <SiCss className={`${size} text-blue-500`} />
  // Markdown
  if (lower.endsWith(".md") || lower.endsWith(".mdx"))
    return <SiMarkdown className={`${size} text-text-secondary`} />
  // JSON
  if (lower.endsWith(".json") || lower.endsWith(".jsonc"))
    return <FileJson className={`${size} text-yellow-400`} />
  // YAML
  if (lower.endsWith(".yaml") || lower.endsWith(".yml"))
    return <SiYaml className={`${size} text-red-400`} />
  // TOML
  if (lower.endsWith(".toml"))
    return <SiToml className={`${size} text-gray-400`} />
  // Git
  if (lower.startsWith(".git") || lower === ".gitignore" || lower === ".gitmodules")
    return <SiGit className={`${size} text-orange-500`} />
  // Docker
  if (lower === "dockerfile" || lower.endsWith(".dockerfile") || lower === ".dockerignore")
    return <SiDocker className={`${size} text-blue-400`} />
  // Shell / Bash
  if (lower.endsWith(".sh") || lower.endsWith(".bash") || lower.endsWith(".zsh"))
    return <SiGnubash className={`${size} text-green-300`} />
  // Rust
  if (lower.endsWith(".rs"))
    return <SiRust className={`${size} text-orange-400`} />
  // Go
  if (lower.endsWith(".go"))
    return <SiGo className={`${size} text-cyan-300`} />
  // Ruby
  if (lower.endsWith(".rb"))
    return <SiRuby className={`${size} text-red-500`} />
  // PHP
  if (lower.endsWith(".php"))
    return <SiPhp className={`${size} text-indigo-300`} />
  // Swift
  if (lower.endsWith(".swift"))
    return <SiSwift className={`${size} text-orange-400`} />
  // C++
  if (lower.endsWith(".cpp") || lower.endsWith(".cc") || lower.endsWith(".cxx") || lower.endsWith(".hpp"))
    return <SiCplusplus className={`${size} text-blue-500`} />
  // C
  if (lower.endsWith(".c") || lower.endsWith(".h"))
    return <SiC className={`${size} text-blue-300`} />
  // SVG
  if (lower.endsWith(".svg"))
    return <SiSvg className={`${size} text-yellow-500`} />
  // Images
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".gif") || lower.endsWith(".webp") || lower.endsWith(".ico"))
    return <FileText className={`${size} text-green-300`} />
  // Config files
  if (lower.endsWith(".env") || lower.endsWith(".env.local") || lower.endsWith(".env.example"))
    return <File className={`${size} text-yellow-600`} />
  // Lock files
  if (lower.endsWith(".lock") || lower === "yarn.lock" || lower === "package-lock.json")
    return <File className={`${size} text-gray-500`} />
  // Text / Plain
  if (lower.endsWith(".txt") || lower.endsWith(".log"))
    return <FileText className={`${size} text-text-tertiary`} />

  return <File className={`${size} text-text-tertiary`} />
}

export function FileTree({
  files,
  activeFilePath,
  presence,
  onOpenFile,
  onDeleteFile,
  onRenameFile,
  onCreateFile,
  createFileTrigger,
}: FileTreeProps) {
  const [search, setSearch] = useState("")
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    new Set(["/src", "/src/components", "/src/utils"])
  )
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [creatingIn, setCreatingIn] = useState<{ parentPath: string; isDir: boolean } | null>(null)

  // External trigger for inline file creation (e.g., keyboard shortcut "a")
  useEffect(() => {
    if (createFileTrigger && createFileTrigger > 0) {
      setCreatingIn({ parentPath: "/", isDir: false })
    }
  }, [createFileTrigger])

  const tree = useMemo(() => buildTree(files), [files])

  const filteredFiles = search
    ? files.filter((f) =>
        f.path.toLowerCase().includes(search.toLowerCase())
      )
    : null

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const getPresenceForFile = (path: string) =>
    presence.filter((p) => p.activeFile === path && p.isOnline)

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, path: string, isDir: boolean) => {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY, path, isDir })
    },
    []
  )

  const handleRename = useCallback(
    (oldPath: string) => {
      setRenamingPath(oldPath)
    },
    []
  )

  const handleRenameSubmit = useCallback(
    (oldPath: string, newName: string) => {
      const name = oldPath.split("/").pop()!
      if (newName.trim() && newName.trim() !== name) {
        const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/"))
        const newPath = `${parentPath}/${newName.trim()}`
        onRenameFile?.(oldPath, newPath)
      }
      setRenamingPath(null)
    },
    [onRenameFile]
  )

  const handleDuplicate = useCallback(
    (path: string) => {
      const file = files.find((f) => f.path === path)
      if (!file) return
      const ext = path.includes(".") ? path.substring(path.lastIndexOf(".")) : ""
      const base = ext ? path.substring(0, path.lastIndexOf(".")) : path
      const newPath = `${base} (copy)${ext}`
      onCreateFile?.(newPath)
    },
    [files, onCreateFile]
  )

  const handleStartInlineCreate = useCallback(
    (parentPath: string, isDir: boolean) => {
      setCreatingIn({ parentPath, isDir })
      // Ensure parent folder is expanded
      if (parentPath !== "/") {
        setExpandedDirs((prev) => {
          const next = new Set(prev)
          next.add(parentPath)
          return next
        })
      }
    },
    []
  )

  const handleInlineCreateSubmit = useCallback(
    (name: string) => {
      if (!creatingIn || !name.trim()) {
        setCreatingIn(null)
        return
      }
      const parentPath = creatingIn.parentPath === "/" ? "" : creatingIn.parentPath
      const newPath = `${parentPath}/${name.trim()}`
      if (creatingIn.isDir) {
        // Create a placeholder file inside the folder to make it appear
        onCreateFile?.(`${newPath}/.gitkeep`)
      } else {
        onCreateFile?.(newPath)
        onOpenFile(newPath)
      }
      setCreatingIn(null)
    },
    [creatingIn, onCreateFile, onOpenFile]
  )

  const handleNewFileInFolder = useCallback(
    (folderPath: string) => {
      handleStartInlineCreate(folderPath, false)
    },
    [handleStartInlineCreate]
  )

  const handleNewFolderInFolder = useCallback(
    (folderPath: string) => {
      handleStartInlineCreate(folderPath, true)
    },
    [handleStartInlineCreate]
  )

  return (
    <div className="flex h-full flex-col">
      {/* Header with search + new file */}
      <div className="flex items-center gap-1 p-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 text-xs bg-background border-border-subtle"
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => handleStartInlineCreate("/", false)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New file (a)</TooltipContent>
        </Tooltip>
      </div>

      {/* Tree */}
      <ScrollArea
        className="flex-1 px-1"
        onContextMenu={(e) => {
          // Right-click on empty space → create file at root
          if ((e.target as HTMLElement).closest("button")) return
          e.preventDefault()
          setContextMenu({ x: e.clientX, y: e.clientY, path: "/", isDir: true })
        }}
      >
        <div className="py-1">
          {creatingIn?.parentPath === "/" && (
            <InlineCreateInput
              isDir={creatingIn.isDir}
              depth={0}
              onSubmit={handleInlineCreateSubmit}
              onCancel={() => setCreatingIn(null)}
            />
          )}
          {filteredFiles
            ? filteredFiles.map((file) => (
                <FileItem
                  key={file.path}
                  name={file.path}
                  path={file.path}
                  isActive={file.path === activeFilePath}
                  presence={getPresenceForFile(file.path)}
                  onClick={() => onOpenFile(file.path)}
                  onContextMenu={(e) => handleContextMenu(e, file.path, false)}
                  depth={0}
                  renamingPath={renamingPath}
                  onRenameSubmit={handleRenameSubmit}
                  onRenameCancel={() => setRenamingPath(null)}
                />
              ))
            : tree.map((node) => (
                <TreeNodeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  activeFilePath={activeFilePath}
                  expandedDirs={expandedDirs}
                  presence={presence}
                  onOpenFile={onOpenFile}
                  onToggleDir={toggleDir}
                  onContextMenu={handleContextMenu}
                  renamingPath={renamingPath}
                  onRenameSubmit={handleRenameSubmit}
                  onRenameCancel={() => setRenamingPath(null)}
                  creatingIn={creatingIn}
                  onCreateSubmit={handleInlineCreateSubmit}
                  onCreateCancel={() => setCreatingIn(null)}
                />
              ))}
        </div>
      </ScrollArea>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <FileContextMenu
            state={contextMenu}
            onClose={() => setContextMenu(null)}
            onDelete={(path) => setDeleteTarget(path)}
            onRename={handleRename}
            onDuplicate={handleDuplicate}
            onCopyPath={(path) => {
              navigator.clipboard?.writeText(path).then(() => {
                toast.success("Path copied to clipboard")
              })
            }}
            onNewFileInFolder={handleNewFileInFolder}
            onNewFolderInFolder={handleNewFolderInFolder}
            isEmptySpace={contextMenu.path === "/"}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-mono text-text-primary">{deleteTarget}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error text-white hover:bg-error/90"
              onClick={() => {
                if (deleteTarget) onDeleteFile?.(deleteTarget)
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function TreeNodeItem({
  node,
  depth,
  activeFilePath,
  expandedDirs,
  presence,
  onOpenFile,
  onToggleDir,
  onContextMenu,
  renamingPath,
  onRenameSubmit,
  onRenameCancel,
  creatingIn,
  onCreateSubmit,
  onCreateCancel,
}: {
  node: TreeNode
  depth: number
  activeFilePath: string
  expandedDirs: Set<string>
  presence: PresenceUser[]
  onOpenFile: (path: string) => void
  onToggleDir: (path: string) => void
  onContextMenu: (e: React.MouseEvent, path: string, isDir: boolean) => void
  renamingPath: string | null
  onRenameSubmit: (oldPath: string, newName: string) => void
  onRenameCancel: () => void
  creatingIn: { parentPath: string; isDir: boolean } | null
  onCreateSubmit: (name: string) => void
  onCreateCancel: () => void
}) {
  const isExpanded = expandedDirs.has(node.path)
  const presenceForFile = presence.filter(
    (p) => p.activeFile === node.path && p.isOnline
  )

  if (node.isDir) {
    const isCreatingHere = creatingIn?.parentPath === node.path
    return (
      <div>
        <button
          onClick={() => onToggleDir(node.path)}
          onContextMenu={(e) => onContextMenu(e, node.path, true)}
          className={cn(
            "flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors hover:bg-hover",
            "text-text-secondary hover:text-text-primary"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight className="h-3 w-3 text-text-tertiary" />
          </motion.div>
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 text-brand" />
          ) : (
            <Folder className="h-4 w-4 text-text-tertiary" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {isCreatingHere && (
                <InlineCreateInput
                  isDir={creatingIn.isDir}
                  depth={depth + 1}
                  onSubmit={onCreateSubmit}
                  onCancel={onCreateCancel}
                />
              )}
              {node.children.map((child) => (
                <TreeNodeItem
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  activeFilePath={activeFilePath}
                  expandedDirs={expandedDirs}
                  presence={presence}
                  onOpenFile={onOpenFile}
                  onToggleDir={onToggleDir}
                  onContextMenu={onContextMenu}
                  renamingPath={renamingPath}
                  onRenameSubmit={onRenameSubmit}
                  onRenameCancel={onRenameCancel}
                  creatingIn={creatingIn}
                  onCreateSubmit={onCreateSubmit}
                  onCreateCancel={onCreateCancel}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <FileItem
      name={node.name}
      path={node.path}
      isActive={node.path === activeFilePath}
      presence={presenceForFile}
      onClick={() => onOpenFile(node.path)}
      onContextMenu={(e) => onContextMenu(e, node.path, false)}
      depth={depth}
      renamingPath={renamingPath}
      onRenameSubmit={onRenameSubmit}
      onRenameCancel={onRenameCancel}
    />
  )
}

function FileItem({
  name,
  path,
  isActive,
  presence,
  onClick,
  onContextMenu,
  depth,
  renamingPath,
  onRenameSubmit,
  onRenameCancel,
}: {
  name: string
  path: string
  isActive: boolean
  presence: PresenceUser[]
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  depth: number
  renamingPath?: string | null
  onRenameSubmit?: (oldPath: string, newName: string) => void
  onRenameCancel?: () => void
}) {
  const fileName = name.includes("/") ? name.split("/").pop()! : name
  const isRenaming = renamingPath === path
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [renameValue, setRenameValue] = useState(fileName)

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(fileName)
      // Focus after render
      setTimeout(() => {
        renameInputRef.current?.focus()
        // Select the name part without extension
        const dotIdx = fileName.lastIndexOf(".")
        renameInputRef.current?.setSelectionRange(0, dotIdx > 0 ? dotIdx : fileName.length)
      }, 0)
    }
  }, [isRenaming, fileName])

  if (isRenaming) {
    return (
      <div
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-0.5",
          "bg-elevated ring-1 ring-brand"
        )}
        style={{ paddingLeft: `${depth * 12 + 20}px` }}
      >
        {getFileIcon(fileName)}
        <input
          ref={renameInputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onRenameSubmit?.(path, renameValue)
            } else if (e.key === "Escape") {
              onRenameCancel?.()
            }
          }}
          onBlur={() => {
            // Submit on blur if value changed
            if (renameValue.trim() && renameValue.trim() !== fileName) {
              onRenameSubmit?.(path, renameValue)
            } else {
              onRenameCancel?.()
            }
          }}
          className="flex-1 bg-transparent text-xs text-text-primary outline-none"
          spellCheck={false}
        />
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
        isActive
          ? "bg-brand-muted text-text-primary"
          : "text-text-secondary hover:bg-hover hover:text-text-primary"
      )}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
      title={path}
    >
      {getFileIcon(fileName)}
      <span className="truncate flex-1 text-left">{fileName}</span>
      {/* Presence indicators */}
      {presence.length > 0 && (
        <div className="flex -space-x-1">
          {presence.map((p) => (
            <div
              key={p.id}
              className="h-2 w-2 rounded-full ring-1 ring-surface"
              style={{ backgroundColor: p.cursorColor }}
              title={`${p.name} is here`}
            />
          ))}
        </div>
      )}
    </button>
  )
}

function InlineCreateInput({
  isDir,
  depth,
  onSubmit,
  onCancel,
}: {
  isDir: boolean
  depth: number
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState("")

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const icon = isDir
    ? <Folder className="h-4 w-4 text-text-tertiary" />
    : value
      ? getFileIcon(value)
      : <File className="h-4 w-4 text-text-tertiary" />

  return (
    <div
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-2 py-0.5",
        "bg-elevated ring-1 ring-brand"
      )}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      {icon}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            onSubmit(value.trim())
          } else if (e.key === "Escape") {
            onCancel()
          }
        }}
        onBlur={() => {
          if (value.trim()) {
            onSubmit(value.trim())
          } else {
            onCancel()
          }
        }}
        placeholder={isDir ? "folder name..." : "filename..."}
        className="flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-tertiary"
        spellCheck={false}
      />
    </div>
  )
}
