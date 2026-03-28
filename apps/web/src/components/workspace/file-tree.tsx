"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronRight,
  File,
  FileJson,
  FileText,
  FileCode2,
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
import { cn } from "@/lib/utils"

interface FileTreeProps {
  files: FileNode[]
  activeFilePath: string
  presence: PresenceUser[]
  onOpenFile: (path: string) => void
  onNewFile?: () => void
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
}: {
  state: ContextMenuState
  onClose: () => void
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

  const menuItems = state.isDir
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
        if ("divider" in item && item.divider) {
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
            onClick={() => {
              // Mock action — in production these would modify the Yjs flat map
              if (item.label === "Copy Path") {
                navigator.clipboard?.writeText(state.path)
              }
              onClose()
            }}
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

function getFileIcon(name: string) {
  if (name.endsWith(".tsx") || name.endsWith(".ts"))
    return <FileCode2 className="h-4 w-4 text-blue-400" />
  if (name.endsWith(".json"))
    return <FileJson className="h-4 w-4 text-yellow-400" />
  if (name.endsWith(".md"))
    return <FileText className="h-4 w-4 text-text-secondary" />
  if (name.endsWith(".css"))
    return <FileCode2 className="h-4 w-4 text-purple-400" />
  return <File className="h-4 w-4 text-text-tertiary" />
}

export function FileTree({
  files,
  activeFilePath,
  presence,
  onOpenFile,
  onNewFile,
}: FileTreeProps) {
  const [search, setSearch] = useState("")
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    new Set(["/src", "/src/components", "/src/utils"])
  )
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

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
        {onNewFile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={onNewFile}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New file (a)</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1 px-1">
        <div className="py-1">
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
          />
        )}
      </AnimatePresence>
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
}: {
  node: TreeNode
  depth: number
  activeFilePath: string
  expandedDirs: Set<string>
  presence: PresenceUser[]
  onOpenFile: (path: string) => void
  onToggleDir: (path: string) => void
  onContextMenu: (e: React.MouseEvent, path: string, isDir: boolean) => void
}) {
  const isExpanded = expandedDirs.has(node.path)
  const presenceForFile = presence.filter(
    (p) => p.activeFile === node.path && p.isOnline
  )

  if (node.isDir) {
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
}: {
  name: string
  path: string
  isActive: boolean
  presence: PresenceUser[]
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  depth: number
}) {
  const fileName = name.includes("/") ? name.split("/").pop()! : name

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
