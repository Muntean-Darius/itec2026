"use client"

import { useRef, useEffect, useState } from "react"
import { Terminal as TermIcon } from "lucide-react"
import { mockTerminalLines } from "@/data/mock"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface TerminalPanelProps {
  isRunning: boolean
}

export function TerminalPanel({ isRunning }: TerminalPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [lines] = useState(mockTerminalLines)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [lines, isRunning])

  return (
    <div className="flex h-full flex-col bg-terminal-bg">
      {/* Terminal header */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border-subtle px-3">
        <TermIcon className="h-3.5 w-3.5 text-text-tertiary" />
        <span className="text-xs font-medium text-text-secondary">Terminal</span>
        {isRunning && (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-xs text-success">Running</span>
          </span>
        )}
      </div>

      {/* Terminal output */}
      <ScrollArea className="flex-1 font-mono text-xs">
        <div className="p-3 leading-relaxed">
          {/* Prompt prefix */}
          <div className="text-text-tertiary mb-1">
            ~/itecify-demo $
          </div>
          {lines.map((line) => (
            <div
              key={line.id}
              className={cn(
                "whitespace-pre-wrap",
                line.type === "stdin" && "text-brand",
                line.type === "stdout" && "text-text-primary",
                line.type === "stderr" && "text-error"
              )}
            >
              {line.type === "stdin" && (
                <span className="text-text-tertiary">$ </span>
              )}
              {line.content}
            </div>
          ))}

          {/* Running indicator */}
          {isRunning && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-text-tertiary">$</span>
              <span className="text-ai">Scanning for vulnerabilities...</span>
              <span className="inline-block animate-pulse text-text-tertiary">▊</span>
            </div>
          )}

          {/* Blinking cursor */}
          {!isRunning && (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-text-tertiary">$ </span>
              <span className="animate-pulse text-text-primary">▊</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  )
}
