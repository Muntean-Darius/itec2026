"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Sparkles,
  Send,
  X,
  Check,
  RotateCcw,
  Eye,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface AIInlinePromptProps {
  filePath: string
  onClose: () => void
}

type PromptState = "idle" | "generating" | "preview"

// Mock AI response — simulates a streamed code suggestion
const MOCK_AI_RESPONSE = `export function validateInput(input: string): boolean {
  if (!input || input.trim().length === 0) {
    return false
  }
  // Sanitize against XSS
  const sanitized = input.replace(/<[^>]*>/g, "")
  return sanitized.length > 0 && sanitized.length <= 1000
}`

export function AIInlinePrompt({ filePath, onClose }: AIInlinePromptProps) {
  const [prompt, setPrompt] = useState("")
  const [state, setState] = useState<PromptState>("idle")
  const [streamedCode, setStreamedCode] = useState("")
  const [showDiff, setShowDiff] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    if (!prompt.trim() || state === "generating") return
    setState("generating")
    setStreamedCode("")

    // Simulate token-by-token streaming
    let i = 0
    const interval = setInterval(() => {
      if (i < MOCK_AI_RESPONSE.length) {
        setStreamedCode(MOCK_AI_RESPONSE.slice(0, i + 1))
        i++
      } else {
        clearInterval(interval)
        setState("preview")
      }
    }, 12)
  }

  const handleAccept = () => {
    // In production: merge suggestedCode into the Yjs document
    onClose()
  }

  const handleReject = () => {
    setState("idle")
    setStreamedCode("")
    setPrompt("")
  }

  const fileName = filePath.split("/").pop() ?? filePath

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className="absolute left-1/2 top-12 z-50 w-[480px] -translate-x-1/2"
    >
      <div className="rounded-xl border border-ai-muted-border bg-elevated shadow-xl shadow-ai-glow overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
          <Sparkles className="h-4 w-4 text-ai" />
          <span className="text-xs font-medium text-text-primary">AI Assistant</span>
          <Badge variant="ai" className="text-[10px] px-1.5 py-0">
            CodePilot
          </Badge>
          <span className="ml-auto text-[10px] text-text-tertiary">
            in {fileName}
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-0.5 hover:bg-hover transition-colors"
          >
            <X className="h-3.5 w-3.5 text-text-tertiary" />
          </button>
        </div>

        {/* Prompt input */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
          <Input
            ref={inputRef}
            placeholder="Ask AI to generate, refactor, or explain..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
              if (e.key === "Escape") onClose()
            }}
            disabled={state === "generating"}
            className="h-8 border-0 bg-transparent focus-visible:ring-0 text-sm placeholder:text-text-tertiary"
          />
          <Button
            size="icon"
            className="h-7 w-7 shrink-0"
            variant={state === "generating" ? "ghost" : "default"}
            disabled={!prompt.trim() || state === "generating"}
            onClick={handleSubmit}
          >
            {state === "generating" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-ai" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {/* AI response area */}
        {(state === "generating" || state === "preview") && (
          <div className="max-h-[300px] overflow-auto">
            {/* Skeleton shimmer while generating */}
            {state === "generating" && streamedCode.length === 0 && (
              <div className="p-3 space-y-2">
                <div className="skeleton h-3 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
                <div className="skeleton h-3 w-5/6 rounded" />
              </div>
            )}

            {/* Streamed code */}
            {streamedCode && (
              <div className="relative">
                <pre className="p-3 font-mono text-xs leading-relaxed text-text-primary overflow-x-auto">
                  <code>{streamedCode}</code>
                  {state === "generating" && (
                    <span className="inline-block animate-pulse text-ai ml-0.5">▊</span>
                  )}
                </pre>

                {/* Diff toggle */}
                {state === "preview" && (
                  <button
                    onClick={() => setShowDiff(!showDiff)}
                    className={cn(
                      "absolute top-2 right-2 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                      showDiff
                        ? "bg-ai-muted text-ai border border-ai-muted-border"
                        : "bg-hover text-text-secondary hover:text-text-primary"
                    )}
                  >
                    <Eye className="inline h-3 w-3 mr-1" />
                    {showDiff ? "Hide Diff" : "Show Diff"}
                  </button>
                )}

                {/* Mock diff view */}
                {showDiff && state === "preview" && (
                  <div className="border-t border-border-subtle p-3 space-y-1 font-mono text-xs">
                    <div className="text-error/80 line-through opacity-60">
                      - // old code would appear here
                    </div>
                    <div className="text-success">
                      + {streamedCode.split("\n")[0]}
                    </div>
                    <div className="text-success">
                      + {streamedCode.split("\n")[1]}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {state === "preview" && (
          <div className="flex items-center justify-between border-t border-border-subtle px-3 py-2">
            <span className="text-[10px] text-text-tertiary">
              ⌘+Enter to accept · Esc to dismiss
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs"
                onClick={handleReject}
              >
                <RotateCcw className="h-3 w-3" />
                Retry
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 gap-1 text-xs"
                onClick={onClose}
              >
                <X className="h-3 w-3" />
                Reject
              </Button>
              <Button
                size="sm"
                className="h-7 gap-1 text-xs bg-ai hover:bg-ai/90 text-ai-foreground"
                onClick={handleAccept}
              >
                <Check className="h-3 w-3" />
                Accept
              </Button>
            </div>
          </div>
        )}

        {/* Idle state hint */}
        {state === "idle" && !prompt && (
          <div className="px-3 py-2 text-[10px] text-text-tertiary">
            Try: &quot;Add input validation&quot; · &quot;Refactor to use hooks&quot; · &quot;Explain this code&quot;
          </div>
        )}
      </div>
    </motion.div>
  )
}
