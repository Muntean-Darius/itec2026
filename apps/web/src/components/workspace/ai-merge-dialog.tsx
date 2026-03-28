"use client"

import { useState, useEffect } from "react"
import { GitMerge, Sparkles, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AIMergeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filePath: string
  originalContent: string
  versionA: string
  versionB: string
  labelA?: string
  labelB?: string
  onRequestAIMerge: (opts: {
    chatId: string
    filePath: string
    originalContent: string
    versionA: string
    versionB: string
  }) => void
  onAcceptMerge: (filePath: string, mergedContent: string) => void
  /** Holds the AI-merged result when it arrives */
  mergeResult?: string | null
  merging?: boolean
  chatId: string
}

export function AIMergeDialog({
  open,
  onOpenChange,
  filePath,
  originalContent,
  versionA,
  versionB,
  labelA = "Version A",
  labelB = "Version B",
  onRequestAIMerge,
  onAcceptMerge,
  mergeResult,
  merging = false,
  chatId,
}: AIMergeDialogProps) {
  const [finalContent, setFinalContent] = useState("")

  // When AI merge result arrives, populate the editable area
  // Using a timeout to avoid the synchronous-setState-in-effect lint rule
  useEffect(() => {
    if (mergeResult) {
      const id = requestAnimationFrame(() => setFinalContent(mergeResult))
      return () => cancelAnimationFrame(id)
    }
  }, [mergeResult])

  const fileName = filePath.split("/").pop() ?? filePath

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitMerge className="h-4 w-4 text-ai" />
            Merge Conflict — <code className="text-sm font-mono text-text-secondary">{fileName}</code>
          </DialogTitle>
          <DialogDescription>
            Two AI agents proposed changes to the same file. Review both versions and choose or merge them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col overflow-hidden">
          {/* Side-by-side versions */}
          <div className="grid grid-cols-2 gap-px bg-border-subtle border-y border-border-subtle">
            {/* Version A */}
            <div className="flex flex-col bg-surface">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle">
                <Badge variant="ai" className="text-[10px]">{labelA}</Badge>
                <span className="text-xs text-text-tertiary truncate">{filePath}</span>
              </div>
              <ScrollArea className="max-h-[25vh]">
                <pre className="p-4 font-mono text-[11px] leading-relaxed text-text-secondary whitespace-pre-wrap">
                  <code>{versionA || "(empty)"}</code>
                </pre>
              </ScrollArea>
            </div>

            {/* Version B */}
            <div className="flex flex-col bg-surface">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle">
                <Badge variant="outline" className="text-[10px]">{labelB}</Badge>
                <span className="text-xs text-text-tertiary truncate">{filePath}</span>
              </div>
              <ScrollArea className="max-h-[25vh]">
                <pre className="p-4 font-mono text-[11px] leading-relaxed text-text-secondary whitespace-pre-wrap">
                  <code>{versionB || "(empty)"}</code>
                </pre>
              </ScrollArea>
            </div>
          </div>

          {/* Actions bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle bg-elevated">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setFinalContent(versionA)}
            >
              Use {labelA}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setFinalContent(versionB)}
            >
              Use {labelB}
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs bg-ai hover:bg-ai/90 text-ai-foreground"
              disabled={merging}
              onClick={() =>
                onRequestAIMerge({
                  chatId,
                  filePath,
                  originalContent,
                  versionA,
                  versionB,
                })
              }
            >
              {merging ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  AI Merge
                </>
              )}
            </Button>
          </div>

          {/* Editable Final Version */}
          <div className="flex flex-col bg-surface">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle">
              <span className="text-xs font-medium text-text-primary">Final Version</span>
              <span className="text-[10px] text-text-tertiary">(editable)</span>
            </div>
            <textarea
              value={finalContent}
              onChange={(e) => setFinalContent(e.target.value)}
              className="flex-1 min-h-[20vh] max-h-[30vh] w-full resize-none border-0 bg-background p-4 font-mono text-[11px] leading-relaxed text-text-primary outline-none placeholder:text-text-tertiary"
              placeholder="Paste, edit, or use AI to merge the two versions..."
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-subtle bg-elevated">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={!finalContent.trim()}
              onClick={() => {
                onAcceptMerge(filePath, finalContent)
                onOpenChange(false)
              }}
            >
              <Check className="h-3 w-3" />
              Apply Merged Version
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
