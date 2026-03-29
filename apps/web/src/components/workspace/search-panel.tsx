// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Search Panel
// Sidebar tab for global search & replace across all project files
// ═══════════════════════════════════════════════════════════════════════════

"use client"

import { useState, useMemo, useCallback, useRef, useEffect, useDeferredValue } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  ChevronRight,
  ChevronDown,
  CaseSensitive,
  WholeWord,
  Regex,
  ReplaceAll,
  FileCode2,
} from "lucide-react"
import type { FileNode } from "@/data/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────

interface SearchMatch {
  /** Line number (1-based) */
  line: number
  /** Column offset (0-based) */
  column: number
  /** Length of the match in characters */
  length: number
  /** The full line text for preview */
  lineText: string
}

interface FileSearchResult {
  path: string
  matches: SearchMatch[]
}

interface SearchPanelProps {
  files: FileNode[]
  /** Open a file and reveal a specific line in the editor */
  onNavigateTo: (path: string, line: number) => void
  onReplaceInFile?: (path: string, search: string | RegExp, replacement: string) => void
  className?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildSearchRegex(
  query: string,
  matchCase: boolean,
  wholeWord: boolean,
  useRegex: boolean
): RegExp | null {
  if (!query) return null

  try {
    let pattern = useRegex ? query : escapeRegex(query)
    if (wholeWord) {
      pattern = `\\b${pattern}\\b`
    }
    return new RegExp(pattern, matchCase ? "g" : "gi")
  } catch {
    // Invalid regex — return null
    return null
  }
}

// ─── Component ───────────────────────────────────────────────────────────

// Max matches to display per file to avoid rendering thousands of DOM nodes
const MAX_MATCHES_PER_FILE = 50

export function SearchPanel({
  files,
  onNavigateTo,
  onReplaceInFile,
  className,
}: SearchPanelProps) {
  // Immediate state — input value updates with no delay
  const [searchQuery, setSearchQuery] = useState("")
  const [replaceQuery, setReplaceQuery] = useState("")
  const [showReplace, setShowReplace] = useState(false)
  const [matchCase, setMatchCase] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  // Files the user has explicitly collapsed — all result files are expanded by default
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set())
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Deferred values — the expensive search computation runs against these,
  // which React can deprioritize so the input never blocks.
  const deferredQuery = useDeferredValue(searchQuery)
  const deferredMatchCase = useDeferredValue(matchCase)
  const deferredWholeWord = useDeferredValue(wholeWord)
  const deferredUseRegex = useDeferredValue(useRegex)

  // True when the deferred values haven't caught up yet — show a subtle stale indicator
  const isStale = deferredQuery !== searchQuery

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Regex built from deferred values — does NOT block the input
  const regex = useMemo(
    () => buildSearchRegex(deferredQuery, deferredMatchCase, deferredWholeWord, deferredUseRegex),
    [deferredQuery, deferredMatchCase, deferredWholeWord, deferredUseRegex]
  )

  // Only validate the live regex for the error message (cheap)
  const regexError = useMemo(() => {
    if (!useRegex || !searchQuery) return null
    try {
      new RegExp(searchQuery)
      return null
    } catch (e) {
      return (e as Error).message
    }
  }, [useRegex, searchQuery])

  // Expensive search — runs on deferred values so it never delays keystrokes
  const results: FileSearchResult[] = useMemo(() => {
    if (!regex || !deferredQuery.trim()) return []

    const fileResults: FileSearchResult[] = []

    for (const file of files) {
      const lines = file.content.split("\n")
      const matches: SearchMatch[] = []

      for (let i = 0; i < lines.length; i++) {
        if (matches.length >= MAX_MATCHES_PER_FILE) break
        const line = lines[i]
        const lineRegex = new RegExp(regex.source, regex.flags)
        let match: RegExpExecArray | null

        while ((match = lineRegex.exec(line)) !== null) {
          matches.push({
            line: i + 1,
            column: match.index,
            length: match[0].length,
            lineText: line,
          })
          if (match[0].length === 0) lineRegex.lastIndex++
          if (matches.length >= MAX_MATCHES_PER_FILE) break
        }
      }

      if (matches.length > 0) {
        fileResults.push({ path: file.path, matches })
      }
    }

    return fileResults
  }, [regex, deferredQuery, files])

  const totalMatches = useMemo(
    () => results.reduce((sum, r) => sum + r.matches.length, 0),
    [results]
  )

  const toggleFileExpanded = useCallback((path: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path) // un-collapse
      } else {
        next.add(path) // collapse
      }
      return next
    })
  }, [])

  const handleReplaceInFile = useCallback(
    (path: string) => {
      if (!regex || !onReplaceInFile) return
      onReplaceInFile(path, regex, replaceQuery)
    },
    [regex, replaceQuery, onReplaceInFile]
  )

  const handleReplaceAll = useCallback(() => {
    if (!regex || !onReplaceInFile) return
    for (const result of results) {
      onReplaceInFile(result.path, regex, replaceQuery)
    }
  }, [regex, replaceQuery, results, onReplaceInFile])

  /** Extract the file name from a path */
  const getFileName = (path: string) => {
    const parts = path.split("/")
    return parts[parts.length - 1] || path
  }

  /** Get parent directory from a path */
  const getDirectory = (path: string) => {
    const parts = path.split("/")
    parts.pop()
    return parts.join("/") || "/"
  }

  /** Render a match line with the matched text highlighted */
  const renderMatchLine = (match: SearchMatch) => {
    const before = match.lineText.slice(0, match.column)
    const matched = match.lineText.slice(match.column, match.column + match.length)
    const after = match.lineText.slice(match.column + match.length)

    // Trim leading whitespace but track how much was trimmed
    const trimmedBefore = before.trimStart()

    return (
      <span className="text-xs font-mono whitespace-pre">
        <span className="text-text-secondary">{trimmedBefore}</span>
        <span className="bg-brand/30 text-brand-light rounded-sm px-[1px]">
          {matched}
        </span>
        <span className="text-text-secondary">{after}</span>
      </span>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* ─── Search Input Area ─── */}
      <div className="shrink-0 p-2 space-y-2 border-b border-border-subtle">
        {/* Search row */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setShowReplace(!showReplace)}
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                showReplace && "rotate-90"
              )}
            />
          </Button>
          <div className="relative flex-1">
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                // Reset collapsed state whenever the user types a new query
                setCollapsedFiles(new Set())
              }}
              placeholder="Search"
              className="h-7 text-xs pr-20 font-mono bg-base"
            />
            {/* Toggle buttons inside the input */}
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setMatchCase(!matchCase)}
                    className={cn(
                      "h-5 w-5 rounded flex items-center justify-center transition-colors",
                      matchCase
                        ? "bg-brand/20 text-brand-light"
                        : "text-text-tertiary hover:text-text-secondary"
                    )}
                  >
                    <CaseSensitive className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Match Case</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setWholeWord(!wholeWord)}
                    className={cn(
                      "h-5 w-5 rounded flex items-center justify-center transition-colors",
                      wholeWord
                        ? "bg-brand/20 text-brand-light"
                        : "text-text-tertiary hover:text-text-secondary"
                    )}
                  >
                    <WholeWord className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Match Whole Word</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setUseRegex(!useRegex)}
                    className={cn(
                      "h-5 w-5 rounded flex items-center justify-center transition-colors",
                      useRegex
                        ? "bg-brand/20 text-brand-light"
                        : "text-text-tertiary hover:text-text-secondary"
                    )}
                  >
                    <Regex className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Use Regular Expression</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Regex error feedback */}
        {regexError && (
          <p className="text-xs text-error pl-7 -mt-1">{regexError}</p>
        )}

        {/* Replace row */}
        <AnimatePresence>
          {showReplace && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-1 pl-7">
                <Input
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  placeholder="Replace"
                  className="h-7 text-xs font-mono bg-base flex-1"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={handleReplaceAll}
                      disabled={!regex || totalMatches === 0}
                    >
                      <ReplaceAll className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Replace All</TooltipContent>
                </Tooltip>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results summary + stale indicator */}
        {searchQuery.trim() && (
          <p className="text-xs text-text-tertiary pl-7">
            {totalMatches === 0
              ? (isStale ? "Searching…" : "No results found")
              : `${totalMatches} result${totalMatches !== 1 ? "s" : ""} in ${results.length} file${results.length !== 1 ? "s" : ""}${isStale ? "…" : ""}`}
          </p>
        )}
      </div>

      {/* ─── Results List ─── */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          <AnimatePresence initial={false}>
            {results.map((fileResult) => {
              // A result file is expanded by default; collapsed only if user explicitly toggled it
              const isExpanded = !collapsedFiles.has(fileResult.path)

              return (
                <motion.div
                  key={fileResult.path}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                >
                  {/* File header */}
                  <button
                    onClick={() => toggleFileExpanded(fileResult.path)}
                    className="flex items-center w-full px-2 py-1 hover:bg-hover text-left group"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                    )}
                    <FileCode2 className="h-3.5 w-3.5 shrink-0 ml-1 mr-1.5 text-text-secondary" />
                    <span className="text-xs font-medium text-text-primary truncate">
                      {getFileName(fileResult.path)}
                    </span>
                    <span className="text-xs text-text-tertiary ml-1.5 truncate">
                      {getDirectory(fileResult.path)}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-text-tertiary bg-elevated rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                      {fileResult.matches.length}
                    </span>
                    {showReplace && onReplaceInFile && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            role="button"
                            tabIndex={0}
                            className="ml-1 shrink-0 h-5 w-5 rounded flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-active opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReplaceInFile(fileResult.path)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation()
                                handleReplaceInFile(fileResult.path)
                              }
                            }}
                          >
                            <ReplaceAll className="h-3 w-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right">Replace in File</TooltipContent>
                      </Tooltip>
                    )}
                  </button>

                  {/* Match lines */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="overflow-hidden"
                      >
                        {fileResult.matches.map((match, idx) => (
                          <button
                            key={`${match.line}-${match.column}-${idx}`}
                            onClick={() => onNavigateTo(fileResult.path, match.line)}
                            className="flex items-start w-full pl-8 pr-2 py-0.5 hover:bg-hover text-left"
                          >
                            <span className="text-xs text-text-tertiary mr-2 shrink-0 tabular-nums w-8 text-right">
                              {match.line}
                            </span>
                            <span className="truncate flex-1 overflow-hidden">
                              {renderMatchLine(match)}
                            </span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Empty state: typed something but no results yet */}
          {deferredQuery.trim() && totalMatches === 0 && !isStale && (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Search className="h-8 w-8 text-text-tertiary mb-2 opacity-40" />
              <p className="text-xs text-text-tertiary">
                No results for &ldquo;{deferredQuery}&rdquo;
              </p>
              {useRegex && regexError && (
                <p className="text-xs text-error mt-1">Invalid regex pattern</p>
              )}
            </div>
          )}

          {/* Initial state */}
          {!searchQuery.trim() && (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Search className="h-8 w-8 text-text-tertiary mb-2 opacity-40" />
              <p className="text-xs text-text-tertiary">
                Type to search across all files
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
