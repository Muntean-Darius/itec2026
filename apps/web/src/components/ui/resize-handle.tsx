"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface ResizeHandleProps {
  /** "horizontal" = drag left/right (for sidebars), "vertical" = drag up/down (for terminal) */
  direction: "horizontal" | "vertical"
  onResize: (delta: number) => void
  onResizeEnd?: () => void
  className?: string
}

export function ResizeHandle({
  direction,
  onResize,
  onResizeEnd,
  className,
}: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false)
  const lastPos = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      lastPos.current = direction === "horizontal" ? e.clientX : e.clientY
    },
    [direction]
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos =
        direction === "horizontal" ? e.clientX : e.clientY
      const delta = currentPos - lastPos.current
      lastPos.current = currentPos
      onResize(delta)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      onResizeEnd?.()
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    // Prevent text selection during drag
    document.body.style.userSelect = "none"
    document.body.style.cursor =
      direction === "horizontal" ? "col-resize" : "row-resize"

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }
  }, [isDragging, direction, onResize, onResizeEnd])

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        "group relative z-10 flex-shrink-0",
        direction === "horizontal"
          ? "w-1 cursor-col-resize hover:w-1"
          : "h-1 cursor-row-resize hover:h-1",
        className
      )}
    >
      {/* Visible indicator line */}
      <div
        className={cn(
          "absolute transition-colors duration-150",
          direction === "horizontal"
            ? "inset-y-0 left-0 w-[2px]"
            : "inset-x-0 top-0 h-[2px]",
          isDragging
            ? "bg-brand"
            : "bg-transparent group-hover:bg-brand/50"
        )}
      />
      {/* Invisible wider hit area */}
      <div
        className={cn(
          "absolute",
          direction === "horizontal"
            ? "inset-y-0 -left-1 w-3"
            : "inset-x-0 -top-1 h-3"
        )}
      />
    </div>
  )
}
