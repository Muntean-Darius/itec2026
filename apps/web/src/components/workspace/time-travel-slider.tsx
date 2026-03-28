"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, RotateCcw, Clock, Sparkles, User, Save } from "lucide-react"
import type { Snapshot, SnapshotKind } from "@/data/types"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// ─── Constants ───────────────────────────────────────────────────────────────

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000

// Color palette from design system
const COLORS = {
  cron: "hsl(224, 55%, 36%)",      // Tertiary text - subtle
  ai: "hsl(172, 66%, 50%)",        // AI Teal - glowing
  human: "hsl(239, 84%, 67%)",     // Brand Indigo
  active: "hsl(0, 0%, 100%)",      // White for active state
} as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

function formatFullTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
}

function getRelativeTime(dateStr: string): string {
  const now = new Date()
  const then = new Date(dateStr)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

function getSnapshotColor(kind: SnapshotKind, isActive: boolean): string {
  if (isActive) return COLORS.active
  return COLORS[kind]
}

function getKindIcon(kind: SnapshotKind) {
  switch (kind) {
    case "ai":
      return <Sparkles className="h-3 w-3" />
    case "human":
      return <Save className="h-3 w-3" />
    default:
      return <Clock className="h-3 w-3" />
  }
}

function getKindLabel(kind: SnapshotKind) {
  switch (kind) {
    case "ai":
      return "AI Generated"
    case "human":
      return "Manual Save"
    default:
      return "Auto-save"
  }
}

function getSnapshotActorLabel(snapshot: Snapshot): string {
  return snapshot.userName?.trim() || "Unknown user"
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface TimeTravelSliderProps {
  snapshots: Snapshot[]
  onClose: () => void
  onRestore: (snapshot: Snapshot) => void
  onScrub: (snapshot: Snapshot) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TimeTravelSlider({
  snapshots,
  onClose,
  onRestore,
  onScrub,
}: TimeTravelSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [mountTime] = useState(() => Date.now())
  
  // Filter to last 12 hours from mount time (stable reference)
  const filteredSnapshots = useMemo(() => {
    const cutoff = mountTime - TWELVE_HOURS_MS
    return snapshots.filter((s) => new Date(s.createdAt).getTime() >= cutoff)
  }, [snapshots, mountTime])

  const [activeIndex, setActiveIndex] = useState(filteredSnapshots.length - 1)
  const active = filteredSnapshots[activeIndex]

  useEffect(() => {
    if (filteredSnapshots.length === 0) return
    const lastIndex = filteredSnapshots.length - 1
    setActiveIndex((prev) => (prev > lastIndex ? lastIndex : prev))
  }, [filteredSnapshots.length])

  // Group snapshots for visual density (show individual AI/human, cluster cron)
  const displayNodes = useMemo(() => {
    if (filteredSnapshots.length === 0) return []
    
    // For the timeline, we show:
    // - All AI and Human snapshots as individual nodes
    // - Cron snapshots clustered by ~5 minute intervals as tick marks
    const nodes: Array<{
      snapshot: Snapshot
      index: number
      isCluster: boolean
      clusterCount: number
    }> = []

    let i = 0
    while (i < filteredSnapshots.length) {
      const snap = filteredSnapshots[i]
      
      if (snap.kind !== "cron") {
        // AI or Human - always show individually
        nodes.push({ snapshot: snap, index: i, isCluster: false, clusterCount: 1 })
        i++
      } else {
        // Cron - cluster nearby ones
        let clusterEnd = i
        const clusterTime = new Date(snap.createdAt).getTime()
        
        while (
          clusterEnd < filteredSnapshots.length - 1 &&
          filteredSnapshots[clusterEnd + 1].kind === "cron" &&
          new Date(filteredSnapshots[clusterEnd + 1].createdAt).getTime() - clusterTime < 5 * 60 * 1000
        ) {
          clusterEnd++
        }
        
        const clusterCount = clusterEnd - i + 1
        // Use middle snapshot of cluster
        const midIndex = i + Math.floor(clusterCount / 2)
        nodes.push({
          snapshot: filteredSnapshots[midIndex],
          index: midIndex,
          isCluster: clusterCount > 1,
          clusterCount,
        })
        i = clusterEnd + 1
      }
    }
    
    return nodes
  }, [filteredSnapshots])

  const handleSliderChange = useCallback(
    (value: number) => {
      if (filteredSnapshots.length === 0) return
      const nextIndex = Math.max(0, Math.min(filteredSnapshots.length - 1, value))
      setActiveIndex(nextIndex)
      onScrub(filteredSnapshots[nextIndex])
    },
    [filteredSnapshots, onScrub]
  )

  // Drag interaction on the track
  const isDragging = useRef(false)

  const scrubFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track || filteredSnapshots.length === 0) return
      const rect = track.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const idx = Math.round(pct * (filteredSnapshots.length - 1))
      setActiveIndex(idx)
      onScrub(filteredSnapshots[idx])
    },
    [filteredSnapshots, onScrub]
  )

  const handleTrackPointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      scrubFromPointer(e.clientX)
    },
    [scrubFromPointer]
  )

  const handleTrackPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return
      scrubFromPointer(e.clientX)
    },
    [scrubFromPointer]
  )

  const handleTrackPointerUp = useCallback(() => {
    isDragging.current = false
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && activeIndex > 0) {
        e.preventDefault()
        handleSliderChange(activeIndex - 1)
      } else if (e.key === "ArrowRight" && activeIndex < filteredSnapshots.length - 1) {
        e.preventDefault()
        handleSliderChange(activeIndex + 1)
      } else if (e.key === "Enter" && active) {
        e.preventDefault()
        onRestore(active)
      } else if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeIndex, filteredSnapshots, active, onRestore, onClose, handleSliderChange])

  if (filteredSnapshots.length === 0) {
    return (
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="absolute bottom-0 inset-x-0 z-50 border-t border-brand-muted-border bg-surface/98 backdrop-blur-md px-6 py-4"
      >
        <p className="text-sm text-text-secondary text-center">
          No snapshots in the last 12 hours
        </p>
      </motion.div>
    )
  }

  const isViewingPast = activeIndex < filteredSnapshots.length - 1

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="absolute bottom-0 inset-x-0 z-50 border-t border-brand-muted-border bg-surface/98 backdrop-blur-md"
    >
      <div className="px-6 py-4">
        {/* Header row with info and actions */}
        <div className="flex items-center justify-between mb-4">
          {/* Left: Active snapshot info */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg",
                active?.kind === "ai" && "bg-ai/20 text-ai glow-ai",
                active?.kind === "human" && "bg-brand/20 text-brand",
                active?.kind === "cron" && "bg-hover text-text-tertiary"
              )}
            >
              {active && getKindIcon(active.kind)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  {active?.kind === "ai" && active?.promptSummary
                    ? active.promptSummary
                    : active?.label ?? formatTime(active?.createdAt ?? "")}
                </span>
                <span className="text-xs text-text-tertiary">
                  {active && getRelativeTime(active.createdAt)}
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                {active && (
                  <>
                    <span className="text-text-tertiary">{getKindLabel(active.kind)}</span>
                    <span className="mx-1.5">•</span>
                    <span>{getSnapshotActorLabel(active)}</span>
                    {active.filePath && (
                      <>
                        <span className="mx-1.5">•</span>
                        <span className="font-mono text-[10px]">{active.filePath}</span>
                      </>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {isViewingPast && (
              <Button
                size="sm"
                variant="default"
                className="h-9 px-4 gap-2 rounded-full text-sm font-medium"
                onClick={() => active && onRestore(active)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore to this point
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-text-secondary hover:text-text-primary"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Timeline track */}
        <div className="relative">
          {/* Time labels */}
          <div className="flex justify-between text-[10px] text-text-tertiary mb-2 px-1">
            <span>12 hours ago</span>
            <span>Now</span>
          </div>

          {/* Unified interactive track */}
          <div
            ref={trackRef}
            className="relative h-12 cursor-pointer select-none touch-none"
            onPointerDown={handleTrackPointerDown}
            onPointerMove={handleTrackPointerMove}
            onPointerUp={handleTrackPointerUp}
            onPointerCancel={handleTrackPointerUp}
          >
            {/* Background track line */}
            <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-border-subtle -translate-y-1/2 rounded-full" />

            {/* Progress indicator */}
            <div
              className="absolute top-1/2 left-0 h-[2px] bg-brand -translate-y-1/2 rounded-full transition-[width] duration-75"
              style={{
                width: `${(activeIndex / Math.max(1, filteredSnapshots.length - 1)) * 100}%`,
              }}
            />

            {/* Snapshot nodes */}
            <div className="absolute inset-0 flex items-center">
              {displayNodes.map((node) => {
                const position = (node.index / Math.max(1, filteredSnapshots.length - 1)) * 100
                const isActive = activeIndex === node.index
                const isNearActive = Math.abs(activeIndex - node.index) <= 2
                
                return (
                  <Tooltip key={node.snapshot.id}>
                    <TooltipTrigger asChild>
                      <button
                        className="absolute flex items-center justify-center transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:ring-offset-2 focus:ring-offset-surface rounded-full"
                        style={{
                          left: `${position}%`,
                          transform: `translateX(-50%) ${isActive ? "scale(1.3)" : ""}`,
                          zIndex: isActive ? 10 : isNearActive ? 5 : 1,
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveIndex(node.index)
                          onScrub(node.snapshot)
                        }}
                      >
                        {node.snapshot.kind === "ai" ? (
                          // AI: Glowing teal diamond
                          <div
                            className={cn(
                              "w-3 h-3 rotate-45 transition-all",
                              isActive ? "glow-ai scale-125" : "opacity-90 hover:opacity-100"
                            )}
                            style={{
                              backgroundColor: getSnapshotColor(node.snapshot.kind, isActive),
                              boxShadow: isActive
                                ? `0 0 12px ${COLORS.ai}, 0 0 24px ${COLORS.ai}40`
                                : `0 0 6px ${COLORS.ai}60`,
                            }}
                          />
                        ) : node.snapshot.kind === "human" ? (
                          // Human: Brand indigo circle
                          <div
                            className={cn(
                              "w-2.5 h-2.5 rounded-full transition-all",
                              isActive && "ring-2 ring-brand/40 ring-offset-1 ring-offset-surface"
                            )}
                            style={{
                              backgroundColor: getSnapshotColor(node.snapshot.kind, isActive),
                            }}
                          />
                        ) : (
                          // Cron: Subtle tick mark
                          <div
                            className={cn(
                              "transition-all",
                              node.isCluster ? "w-1 h-3" : "w-0.5 h-2",
                              isActive ? "bg-white" : "bg-text-tertiary/50 hover:bg-text-tertiary"
                            )}
                            style={{
                              borderRadius: "1px",
                            }}
                          />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-xs"
                      sideOffset={8}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full",
                              node.snapshot.kind === "ai" && "bg-ai",
                              node.snapshot.kind === "human" && "bg-brand",
                              node.snapshot.kind === "cron" && "bg-text-tertiary"
                            )}
                          />
                          <span className="font-medium">
                            {getKindLabel(node.snapshot.kind)}
                          </span>
                        </div>
                        <p className="text-text-primary">
                          {node.snapshot.kind === "ai" && node.snapshot.promptSummary
                            ? node.snapshot.promptSummary
                            : node.snapshot.label ??
                              `${getSnapshotActorLabel(node.snapshot)} typing${
                                node.snapshot.filePath ? ` in ${node.snapshot.filePath.split("/").pop()}` : ""
                              }`}
                        </p>
                        <p className="text-text-tertiary text-[10px]">
                          {formatFullTime(node.snapshot.createdAt)}
                          {node.isCluster && ` • ${node.clusterCount} changes`}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>

            {/* Active position indicator (thumb) */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-full shadow-lg border-2 border-brand pointer-events-none transition-[left] duration-75"
              style={{
                left: `${(activeIndex / Math.max(1, filteredSnapshots.length - 1)) * 100}%`,
              }}
            />
          </div>

          {/* Screen-reader accessible range (visually hidden) */}
          <input
            type="range"
            min={0}
            max={Math.max(0, filteredSnapshots.length - 1)}
            step={1}
            value={activeIndex}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            className="sr-only"
            aria-label="Time travel timeline"
          />

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-3 text-[10px] text-text-tertiary">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rotate-45 bg-ai" style={{ boxShadow: `0 0 4px ${COLORS.ai}` }} />
              <span>AI Checkpoint</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-brand" />
              <span>Manual Save</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-0.5 h-2 bg-text-tertiary rounded-sm" />
              <span>Auto-save (60s)</span>
            </div>
            <div className="ml-4 text-text-tertiary/60">
              ← → to navigate • Enter to restore • Esc to close
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
