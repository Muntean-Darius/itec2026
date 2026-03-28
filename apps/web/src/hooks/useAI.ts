"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Socket } from "socket.io-client"

type AiState = "queued" | "generating" | "done" | "conflict" | "error"

type AiKind = "generate" | "smart-merge"

type AiStatePayload = {
  from: string
  requestId: string
  state: AiState
  kind: AiKind
  message?: string
  timestamp: string
}

type AiProposalPayload = {
  from: string
  requestId: string
  language: string
  filePath?: string
  proposal: string
  summary?: string
  timestamp: string
}

type AiMergeResultPayload = {
  from: string
  requestId: string
  language: string
  filePath?: string
  status: "merged" | "conflict"
  mergedCode?: string
  reason?: string
  timestamp: string
}

type AiProposalActionPayload = {
  from: string
  requestId: string
  action: "accept" | "reject"
  appliedCode?: string
  timestamp: string
}

type GenerateArgs = {
  language: string
  prompt: string
  context?: string
  filePath?: string
}

type SmartMergeArgs = {
  language: string
  originalCode: string
  mine: string
  theirs: string
  filePath?: string
}

function nextRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `req-${Date.now()}`
}

export function useAI(socket: Socket | null) {
  const [aiState, setAiState] = useState<AiStatePayload | null>(null)
  const [lastProposal, setLastProposal] = useState<AiProposalPayload | null>(null)
  const [lastMergeResult, setLastMergeResult] = useState<AiMergeResultPayload | null>(null)
  const [lastProposalAction, setLastProposalAction] = useState<AiProposalActionPayload | null>(null)

  useEffect(() => {
    if (!socket) return

    const onAiState = (payload: AiStatePayload) => setAiState(payload)
    const onAiProposal = (payload: AiProposalPayload) => setLastProposal(payload)
    const onAiMergeResult = (payload: AiMergeResultPayload) => setLastMergeResult(payload)
    const onAiProposalAction = (payload: AiProposalActionPayload) => setLastProposalAction(payload)

    socket.on("ai:state", onAiState)
    socket.on("ai:proposal", onAiProposal)
    socket.on("ai:merge-result", onAiMergeResult)
    socket.on("ai:proposal-action", onAiProposalAction)

    return () => {
      socket.off("ai:state", onAiState)
      socket.off("ai:proposal", onAiProposal)
      socket.off("ai:merge-result", onAiMergeResult)
      socket.off("ai:proposal-action", onAiProposalAction)
    }
  }, [socket])

  const requestGenerate = useCallback(
    (args: GenerateArgs) => {
      if (!socket || !args.prompt.trim()) return null
      const requestId = nextRequestId()
      socket.emit("ai:generate", {
        requestId,
        language: args.language,
        prompt: args.prompt,
        context: args.context,
        filePath: args.filePath,
      })
      return requestId
    },
    [socket]
  )

  const requestSmartMerge = useCallback(
    (args: SmartMergeArgs) => {
      if (!socket) return null
      const requestId = nextRequestId()
      socket.emit("ai:smart-merge", {
        requestId,
        language: args.language,
        filePath: args.filePath,
        originalCode: args.originalCode,
        mine: args.mine,
        theirs: args.theirs,
      })
      return requestId
    },
    [socket]
  )

  const sendProposalAction = useCallback(
    (args: { requestId: string; action: "accept" | "reject"; appliedCode?: string }) => {
      if (!socket) return
      socket.emit("ai:proposal-action", args)
    },
    [socket]
  )

  const aiStatusLabel = useMemo(() => {
    if (!aiState) return "idle"
    return `${aiState.kind}:${aiState.state}`
  }, [aiState])

  return {
    aiState,
    aiStatusLabel,
    lastProposal,
    lastMergeResult,
    lastProposalAction,
    requestGenerate,
    requestSmartMerge,
    sendProposalAction,
  }
}
