"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { X, Bot, Sparkles, Power, Settings2 } from "lucide-react"
import type { AIAgent } from "@/data/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface AgentRosterProps {
  agents: AIAgent[]
  onClose: () => void
}

export function AgentRoster({ agents, onClose }: AgentRosterProps) {
  const [agentList, setAgentList] = useState(agents)

  const toggleAgent = (id: string) => {
    setAgentList((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a))
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-subtle px-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-ai" />
          <span className="text-sm font-medium text-text-primary">AI Agents</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Agent list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {agentList.map((agent) => (
            <motion.div
              key={agent.id}
              layout
              className={cn(
                "rounded-xl border p-3 transition-all",
                agent.isActive
                  ? "border-ai-muted-border bg-ai-muted"
                  : "border-border-subtle bg-surface hover:border-border-default"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: agent.color + "22" }}
                  >
                    <Sparkles
                      className="h-4 w-4"
                      style={{ color: agent.color }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {agent.name}
                    </p>
                    <p className="text-xs text-text-tertiary">{agent.persona}</p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => toggleAgent(agent.id)}
                >
                  <Power
                    className={cn(
                      "h-4 w-4",
                      agent.isActive ? "text-ai" : "text-text-tertiary"
                    )}
                  />
                </Button>
              </div>

              {agent.isActive && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-2 pt-2 border-t border-border-subtle"
                >
                  <Badge variant="ai" className="text-[10px]">Active</Badge>
                  <p className="mt-1.5 text-[11px] text-text-secondary leading-relaxed">
                    Mention <span className="font-mono text-ai">@{agent.name}</span>{" "}
                    in the AI prompt to invoke this agent.
                  </p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        <Separator className="my-2" />

        <div className="px-3 pb-3">
          <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5">
            <Settings2 className="h-3 w-3" />
            Configure Agents
          </Button>
        </div>
      </ScrollArea>
    </div>
  )
}
