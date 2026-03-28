"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { X, RotateCcw, Clock } from "lucide-react"
import type { Snapshot } from "@/data/types"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { mockUsers } from "@/data/mock"

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function getUserName(userId: string) {
  return mockUsers.find((u) => u.id === userId)?.name ?? "Unknown"
}

interface TimeTravelSliderProps {
  snapshots: Snapshot[]
  onClose: () => void
}

export function TimeTravelSlider({ snapshots, onClose }: TimeTravelSliderProps) {
  const [activeIndex, setActiveIndex] = useState(snapshots.length - 1)
  const active = snapshots[activeIndex]

  const maxChanges = Math.max(...snapshots.map((s) => s.changeCount))

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute bottom-0 inset-x-0 z-10 border-t border-brand-muted-border bg-surface/95 backdrop-blur-sm px-4 py-3"
    >
      <div className="flex items-center gap-4">
        {/* Info */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-brand" />
          <div>
            <p className="text-xs font-medium text-text-primary">
              {active?.label ?? formatTime(active?.createdAt ?? "")}
            </p>
            <p className="text-[10px] text-text-tertiary">
              {active && `${getUserName(active.userId)} • ${active.changeCount} changes`}
            </p>
          </div>
        </div>

        {/* Slider track with heatmap dots */}
        <div className="flex flex-1 items-end gap-1 h-8 px-2">
          {snapshots.map((snap, i) => {
            const height = 8 + (snap.changeCount / maxChanges) * 20
            const isActive = i === activeIndex
            return (
              <Tooltip key={snap.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveIndex(i)}
                    className="flex-1 flex items-end justify-center group"
                  >
                    <motion.div
                      className="w-full max-w-[6px] rounded-full transition-colors"
                      style={{
                        height: `${height}px`,
                        backgroundColor: isActive
                          ? "var(--brand)"
                          : "var(--bg-active)",
                      }}
                      whileHover={{ scaleY: 1.2 }}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p>{formatTime(snap.createdAt)}</p>
                  <p className="text-text-tertiary">
                    {snap.label ?? `${snap.changeCount} changes`}
                  </p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        {/* Range slider */}
        <input
          type="range"
          min={0}
          max={snapshots.length - 1}
          value={activeIndex}
          onChange={(e) => setActiveIndex(Number(e.target.value))}
          className="w-32 accent-brand"
        />

        {/* Actions */}
        <Button size="sm" variant="default" className="h-7 gap-1.5 text-xs">
          <RotateCcw className="h-3 w-3" />
          Restore
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  )
}
