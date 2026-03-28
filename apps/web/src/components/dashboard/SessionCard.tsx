"use client"

import { motion } from "framer-motion"
import { ArrowUpRight, Trash2 } from "lucide-react"
import { LANG_META } from "@/data/mock"
import type { Session } from "@/types"

interface SessionCardProps {
  session: Session
  onOpen: () => void
  onDelete?: () => void
  index?: number
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function SessionCard({ session, onOpen, onDelete, index = 0 }: SessionCardProps) {
  const lang = LANG_META[session.language]
  const langColor = lang?.color ?? "hsl(224, 12%, 55%)"

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={onOpen}
      className="
        group relative flex flex-col gap-4 p-5 rounded-xl cursor-pointer
        bg-surface border border-border
        hover:border-brand-muted-border hover:bg-elevated
        transition-all duration-200
      "
    >
      {/* Top row: name + actions */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-sm text-text-primary truncate leading-snug">
          {session.name}
        </h3>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="size-7 flex items-center justify-center rounded-lg text-text-tertiary hover:text-error hover:bg-error-muted transition-all"
              title="Delete session"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-muted text-brand border border-[var(--brand-muted-border)] hover:bg-brand hover:text-brand-foreground transition-all"
          >
            Open
            <ArrowUpRight className="size-3" />
          </button>
        </div>
      </div>

      {/* Bottom row: language + time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ background: langColor }}
          />
          <span className="text-xs text-text-secondary">{session.language}</span>
        </div>
        <span className="text-xs text-text-tertiary">{timeAgo(session.createdAt)}</span>
      </div>

      {/* Join code badge */}
      {session.joinCode && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-0 pointer-events-none">
          {/* Hidden — available for copy feature later */}
        </div>
      )}
    </motion.div>
  )
}
