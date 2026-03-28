"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Socket } from "socket.io-client"

type RunnerState = "starting" | "running" | "stopped" | "completed" | "failed"

type RunnerStatusPayload = {
  from: string
  state: RunnerState
  runId?: string
  language?: string
  message?: string
  timestamp: string
}

type TerminalOutputPayload = {
  from: string
  runId?: string
  stream: "stdout" | "stderr"
  data: string
  timestamp: string
}

type TerminalBroadcastPayload = {
  from: string
  command: string
  timestamp: string
}

type RunCodeRequestPayload = {
  language: string
  files: Array<{ path: string; content: string }>
  timeout?: number
}

const EXT_BY_LANGUAGE: Record<string, string> = {
  python: "py",
  javascript: "js",
  typescript: "ts",
  go: "go",
  rust: "rs",
  "c++": "cpp",
  java: "java",
}

function fileExtension(language: string): string {
  return EXT_BY_LANGUAGE[language.toLowerCase()] ?? "txt"
}

export function useRunner(socket: Socket | null) {
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const [runnerStatus, setRunnerStatus] = useState<RunnerStatusPayload | null>(null)

  useEffect(() => {
    if (!socket) return

    const onRunnerStatus = (payload: RunnerStatusPayload) => {
      setRunnerStatus(payload)
      setTerminalOutput((prev) => [
        ...prev,
        `[runner:${payload.state}] ${payload.message ?? ""}`.trim(),
      ])
    }

    const onTerminalOutput = (payload: TerminalOutputPayload) => {
      const line = payload.stream === "stderr" ? `[stderr] ${payload.data}` : payload.data
      setTerminalOutput((prev) => [...prev, line])
    }

    const onTerminalBroadcast = (payload: TerminalBroadcastPayload) => {
      setTerminalOutput((prev) => [...prev, `[peer:${payload.from}] $ ${payload.command}`])
    }

    const onRunnerStdin = (payload: { from: string; data: string }) => {
      setTerminalOutput((prev) => [...prev, `[stdin:${payload.from}] $ ${payload.data}`])
    }

    socket.on("runner:status", onRunnerStatus)
    socket.on("terminal-output", onTerminalOutput)
    socket.on("terminal-broadcast", onTerminalBroadcast)
    socket.on("runner:stdin", onRunnerStdin)

    return () => {
      socket.off("runner:status", onRunnerStatus)
      socket.off("terminal-output", onTerminalOutput)
      socket.off("terminal-broadcast", onTerminalBroadcast)
      socket.off("runner:stdin", onRunnerStdin)
    }
  }, [socket])

  const runCode = useCallback(
    (language: string, code: string) => {
      if (!socket) return

      const payload: RunCodeRequestPayload = {
        language,
        files: [{ path: `main.${fileExtension(language)}`, content: code }],
      }

      socket.emit("run-code-request", payload)
    },
    [socket]
  )

  const sendTerminalInput = useCallback(
    (command: string) => {
      if (!socket || !command.trim()) return

      setTerminalOutput((prev) => [...prev, `$ ${command.trim()}`])
      socket.emit("terminal-input", {
        command: command.trim(),
        timestamp: new Date().toISOString(),
      })
    },
    [socket]
  )

  const clearTerminalOutput = useCallback(() => {
    setTerminalOutput([])
  }, [])

  const runnerStatusLabel = useMemo(() => {
    if (!runnerStatus) return "idle"
    return runnerStatus.state
  }, [runnerStatus])

  return {
    terminalOutput,
    runnerStatus,
    runnerStatusLabel,
    runCode,
    sendTerminalInput,
    clearTerminalOutput,
  }
}
