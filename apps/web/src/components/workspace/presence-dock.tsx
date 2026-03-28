"use client"

import { motion } from "framer-motion"
import { Bot, Sparkles, Settings, LogOut, LayoutDashboard } from "lucide-react"
import Link from "next/link"
import type { User, PresenceUser } from "@/data/types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { signOut } from "@/app/actions"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

interface PresenceDockProps {
  users: PresenceUser[]
  currentUser: User
  onToggleAgentRoster: () => void
}

export function PresenceDock({
  users,
  currentUser,
  onToggleAgentRoster,
}: PresenceDockProps) {
  // Filter out the current user (id format is "userId:clientId") and deduplicate by userId
  const seenUserIds = new Set<string>()
  const otherUsers = users.filter((u) => {
    const userId = u.id.split(":")[0]
    if (userId === currentUser.id) return false
    if (seenUserIds.has(userId)) return false
    seenUserIds.add(userId)
    return true
  })

  return (
    <div className="flex items-center gap-1.5">
      {/* Agent roster toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggleAgentRoster}
          >
            <Bot className="h-4 w-4 text-ai" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>AI Assistants & Chats</TooltipContent>
      </Tooltip>

      {/* Other users */}
      <div className="flex items-center -space-x-1">
        {otherUsers.map((user) => (
          <Tooltip key={user.id}>
            <TooltipTrigger asChild>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Avatar
                  className={cn(
                    "h-7 w-7 ring-2 ring-background transition-all",
                    !user.isOnline && "opacity-40 grayscale"
                  )}
                >
                  <AvatarFallback
                    className="text-[10px] font-medium text-white"
                    style={{ backgroundColor: user.cursorColor }}
                  >
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                {/* Typing indicator */}
                {user.isTyping && user.isOnline && (
                  <motion.div
                    className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-brand"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    <Sparkles className="h-2 w-2 text-brand-foreground" />
                  </motion.div>
                )}
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <p className="font-medium">{user.name}</p>
                <p className="text-text-tertiary">
                  {user.isOnline
                    ? user.activeFile
                      ? `Editing ${user.activeFile.split("/").pop()}`
                      : "Online"
                    : "Offline"}
                </p>
                {user.isTyping && user.isOnline && (
                  <p className="text-brand">typing...</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Current user — dropdown menu with settings/sign-out */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <Avatar className="h-7 w-7 ring-2 ring-brand/30 cursor-pointer">
              <AvatarFallback
                className="text-[10px] font-medium text-white"
                style={{ backgroundColor: currentUser.cursorColor }}
              >
                {getInitials(currentUser.name)}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium text-text-primary">{currentUser.name}</p>
            <p className="text-xs text-text-tertiary">{currentUser.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard?tab=settings" className="flex items-center gap-2 cursor-pointer">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-2 text-error focus:text-error cursor-pointer"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
