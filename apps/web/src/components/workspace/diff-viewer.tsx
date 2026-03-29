// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Diff Viewer
// Monaco-based side-by-side diff viewer for Git changes
// ═══════════════════════════════════════════════════════════════════════════

"use client"

import { useEffect, useState } from "react"
import { X, Loader2, FileCode2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGit } from "@/lib/git"
import { cn } from "@/lib/utils"

interface DiffViewerProps {
  filepath: string
  onClose?: () => void
  className?: string
}

export function DiffViewer({ filepath, onClose, className }: DiffViewerProps) {
  const git = useGit()
  const [diff, setDiff] = useState<{ original: string; current: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load diff
  useEffect(() => {
    let cancelled = false

    const loadDiff = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await git.getDiff(filepath)
        if (!cancelled) {
          setDiff(result)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load diff")
          setLoading(false)
        }
      }
    }

    loadDiff()

    return () => {
      cancelled = true
    }
  }, [filepath, git])

  // Get file language from extension
  const getLanguage = (path: string): string => {
    const ext = path.split(".").pop()?.toLowerCase()
    const langMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      json: "json",
      css: "css",
      scss: "scss",
      html: "html",
      md: "markdown",
      py: "python",
      go: "go",
      rs: "rust",
      java: "java",
    }
    return langMap[ext || ""] || "plaintext"
  }

  const filename = filepath.split("/").pop() || filepath

  if (loading) {
    return (
      <div className={cn("flex flex-col h-full bg-elevated", className)}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-text-tertiary" />
            <span className="text-sm font-medium">{filename}</span>
            <span className="text-xs text-text-tertiary">Loading diff...</span>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-text-tertiary animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("flex flex-col h-full bg-elevated", className)}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-text-tertiary" />
            <span className="text-sm font-medium">{filename}</span>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center text-error text-sm">
          {error}
        </div>
      </div>
    )
  }

  if (!diff) {
    return (
      <div className={cn("flex flex-col h-full bg-elevated", className)}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-text-tertiary" />
            <span className="text-sm font-medium">{filename}</span>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">
          No changes
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full bg-elevated", className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-text-tertiary" />
          <span className="text-sm font-medium">{filename}</span>
          <span className="text-xs text-text-tertiary">
            {diff.original ? "Modified" : "New file"}
          </span>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <MonacoDiffEditorWrapper
          original={diff.original}
          modified={diff.current}
          language={getLanguage(filepath)}
        />
      </div>
    </div>
  )
}

// ─── Monaco Diff Editor Wrapper ──────────────────────────────────────────

interface MonacoDiffEditorWrapperProps {
  original: string
  modified: string
  language: string
}

function MonacoDiffEditorWrapper({
  original,
  modified,
  language,
}: MonacoDiffEditorWrapperProps) {
  const [mounted, setMounted] = useState(false)
  const [DiffEditor, setDiffEditor] = useState<React.ComponentType<{
    original: string
    modified: string
    language: string
    theme: string
    options: Record<string, unknown>
  }> | null>(null)

  useEffect(() => {
    // Dynamic import Monaco diff editor
    import("@monaco-editor/react").then((mod) => {
      setDiffEditor(() => mod.DiffEditor)
      setMounted(true)
    })
  }, [])

  if (!mounted || !DiffEditor) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 text-text-tertiary animate-spin" />
      </div>
    )
  }

  return (
    <DiffEditor
      original={original}
      modified={modified}
      language={language}
      theme="vs-dark"
      options={{
        readOnly: true,
        renderSideBySide: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        lineNumbers: "on",
        glyphMargin: false,
        folding: true,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 3,
        renderOverviewRuler: false,
        overviewRulerBorder: false,
        padding: { top: 8, bottom: 8 },
      }}
    />
  )
}
