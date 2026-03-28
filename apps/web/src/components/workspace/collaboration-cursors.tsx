"use client"

import { motion, AnimatePresence } from "framer-motion"
import type { PresenceUser } from "@/data/types"

interface CollaborationCursorsProps {
  presence: PresenceUser[]
  currentUserId: string
  activeFilePath: string
}

// Mock cursor positions that simulate smooth movement
const MOCK_CURSOR_ANIMATIONS = [
  { startX: 180, startY: 120, endX: 320, endY: 180 },
  { startX: 400, startY: 240, endX: 250, endY: 300 },
  { startX: 150, startY: 300, endX: 350, endY: 160 },
]

export function CollaborationCursors({
  presence,
  currentUserId,
  activeFilePath,
}: CollaborationCursorsProps) {
  // Filter to other online users who are in the same file
  const remoteCursors = presence.filter(
    (p) =>
      p.id !== currentUserId &&
      p.isOnline &&
      p.activeFile === activeFilePath &&
      p.cursorPosition
  )

  if (remoteCursors.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <AnimatePresence>
        {remoteCursors.map((user, idx) => (
          <RemoteCursor
            key={user.id}
            user={user}
            animation={MOCK_CURSOR_ANIMATIONS[idx % MOCK_CURSOR_ANIMATIONS.length]}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

function RemoteCursor({
  user,
  animation,
}: {
  user: PresenceUser
  animation: { startX: number; startY: number; endX: number; endY: number }
}) {
  // Approximate pixel position from line/column
  const lineHeight = 20
  const charWidth = 7.8
  const paddingTop = 12
  const paddingLeft = 60 // line number gutter

  const baseX = paddingLeft + (user.cursorPosition?.column ?? 0) * charWidth
  const baseY = paddingTop + (user.cursorPosition?.line ?? 0) * lineHeight

  const firstName = user.name.split(" ")[0]

  return (
    <motion.div
      initial={{ opacity: 0, x: animation.startX, y: animation.startY }}
      animate={{
        opacity: 1,
        x: [baseX, baseX + 40, baseX + 20, baseX],
        y: [baseY, baseY, baseY + lineHeight, baseY + lineHeight],
      }}
      exit={{ opacity: 0 }}
      transition={{
        opacity: { duration: 0.3 },
        x: { duration: 8, repeat: Infinity, ease: "easeInOut" },
        y: { duration: 8, repeat: Infinity, ease: "easeInOut" },
      }}
      className="absolute"
    >
      {/* Cursor line */}
      <div
        className="w-[2px] rounded-full"
        style={{
          height: lineHeight,
          backgroundColor: user.cursorColor,
          boxShadow: `0 0 6px ${user.cursorColor}40`,
        }}
      />
      {/* Name label */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute -top-5 left-0 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: user.cursorColor }}
      >
        {firstName}
      </motion.div>
      {/* Selection highlight mock */}
      {user.isTyping && (
        <motion.div
          className="absolute top-0 left-[2px] rounded-sm"
          style={{
            height: lineHeight,
            width: 80,
            backgroundColor: `${user.cursorColor}15`,
            borderLeft: `2px solid ${user.cursorColor}`,
          }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.div>
  )
}
