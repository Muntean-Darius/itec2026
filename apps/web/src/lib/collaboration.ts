// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Real-Time Collaboration Hook
// Connects to the collaboration server via Socket.IO + Yjs
// All yjs/lib0/y-protocols imports are dynamic (inside useEffect) to avoid
// "Unexpected end of array" SSR errors with Turbopack.
// ═══════════════════════════════════════════════════════════════════════════

"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { io, Socket } from "socket.io-client"
import { toast } from "sonner"
import type { User, FileNode, PresenceUser, TerminalLine, AIChatMessage, AIChatSession, AIAgent } from "@/data/types"

const COLLAB_SERVER_URL =
  process.env.NEXT_PUBLIC_COLLAB_SERVER_URL || "http://localhost:4000"

// ─── Types ───────────────────────────────────────────────────────────────

export interface TerminalSession {
  id: string
  name: string
  lines: TerminalLine[]
}

interface UseCollaborationOptions {
  projectId: string
  currentUser: User
  initialFiles: FileNode[]
}

interface AwarenessState {
  activeFile: string | null
  cursorPosition: { line: number; column: number } | null
  isTyping: boolean
  terminalSessionId?: string
  terminalDraft?: string
  [key: string]: unknown
}

export type DockerStatus = "creating" | "ready" | "error" | null

export interface DockerStats {
  cpuPercent: number
  memoryUsageMB: number
  memoryLimitMB: number
  memoryPercent: number
}

export interface UseCollaborationReturn {
  connected: boolean
  dockerStatus: DockerStatus
  dockerError: string | null
  dockerStats: DockerStats | null
  terminalBusy: Record<string, boolean>
  terminalCwds: Record<string, string>
  files: FileNode[]
  presence: PresenceUser[]
  localClientId: number | null
  meta: { name: string; description: string }
  terminalSessions: TerminalSession[]
  aiChatSessions: AIChatSession[]
  aiAgents: AIAgent[]
  getYText: (path: string) => unknown | null
  getYdoc: () => unknown | null
  getYjs: () => unknown | null
  getAwareness: () => unknown | null
  getTerminalInputYText: (sessionId: string) => unknown | null
  getAIChatInputYText: (chatId: string) => unknown | null
  createFile: (path: string, content?: string) => void
  deleteFile: (path: string) => void
  renameFile: (oldPath: string, newPath: string) => void
  updateAwareness: (state: Partial<AwarenessState>) => void
  updateFileContent: (path: string, newContent: string) => void
  updateMeta: (key: string, value: string) => void
  createTerminalSession: (name?: string) => string | null
  deleteTerminalSession: (sessionId: string) => void
  sendTerminalInput: (sessionId: string, content: string) => void
  /** Send a chat message to an AI agent */
  sendAIChat: (opts: {
    chatId: string
    content: string
    agentId: string
    agentName: string
    agentInstructions?: string
  }) => void
  /** Rename an AI chat */
  renameAIChat: (chatId: string, name: string) => void
  /** Delete an AI chat */
  deleteAIChat: (chatId: string) => void
  /** Accept or reject a single AI operation */
  aiOperationAction: (chatId: string, messageId: string, operationIndex: number, action: "accept" | "reject") => void
  /** Accept or reject ALL operations in a message */
  aiBulkAction: (chatId: string, messageId: string, action: "accept" | "reject") => void
  /** Request AI merge of conflicting file changes */
  requestAIMerge: (opts: {
    chatId: string
    filePath: string
    originalContent: string
    versionA: string
    versionB: string
    contextA: string
    contextB: string
  }) => void
  /** Create a new AI agent visible to all users */
  createAgent: (agent: { name: string; persona: string; systemPrompt: string; color: string }) => string
  /** Update an agent's config */
  updateAgent: (id: string, updates: Partial<{ name: string; persona: string; systemPrompt: string; color: string; isActive: boolean }>) => void
  /** Delete an agent */
  deleteAgent: (id: string) => void
  /** Reset the Docker container (destroy and recreate) */
  resetContainer: () => void
  /** Subscribe to AI stream chunks — returns unsubscribe function */
  onAIStreamChunk: (handler: (data: { chatId: string; messageId: string; chunk: string; done?: boolean }) => void) => () => void
  /** Subscribe to AI merge results — returns unsubscribe function */
  onAIMergeResult: (handler: (data: { chatId: string; filePath: string; merged: string | null; explanation: string }) => void) => () => void
  /** Broadcast a snapshot creation to other clients — returns unsubscribe function */
  broadcastSnapshot: (snapshot: Record<string, unknown>) => void
  /** Subscribe to snapshot-created events from other clients — returns unsubscribe function */
  onSnapshotCreated: (handler: (data: { snapshot: Record<string, unknown> }) => void) => () => void
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useCollaboration({
  projectId,
  currentUser,
  initialFiles,
}: UseCollaborationOptions): UseCollaborationReturn {
  const socketRef = useRef<Socket | null>(null)
  // We store yjs objects as `any` refs to avoid importing yjs types at module scope
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const ydocRef = useRef<any>(null)
  const awarenessRef = useRef<any>(null)
  const yjsRef = useRef<any>(null)
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const [connected, setConnected] = useState(false)
  const [files, setFiles] = useState<FileNode[]>(initialFiles)
  const [presence, setPresence] = useState<PresenceUser[]>([])
  const [localClientId, setLocalClientId] = useState<number | null>(null)
  const [meta, setMeta] = useState<{ name: string; description: string }>({
    name: "",
    description: "",
  })
  const [terminalSessions, setTerminalSessions] = useState<TerminalSession[]>([])
  const [aiChatSessions, setAIChatSessions] = useState<AIChatSession[]>([])
  const [aiAgents, setAIAgents] = useState<AIAgent[]>([])
  const [dockerStatus, setDockerStatus] = useState<DockerStatus>(null)
  const [dockerError, setDockerError] = useState<string | null>(null)
  const [dockerStats, setDockerStats] = useState<DockerStats | null>(null)
  const [terminalBusy, setTerminalBusy] = useState<Record<string, boolean>>({})
  const [terminalCwds, setTerminalCwds] = useState<Record<string, string>>({})

  // ── Sync helpers ──

  const syncFilesFromDoc = useCallback(() => {
    const Y = yjsRef.current
    const doc = ydocRef.current
    if (!Y || !doc) return

    const filesMap = doc.getMap("files")
    const newFiles: FileNode[] = []
    const langMap: Record<string, string> = {
      ts: "typescript", tsx: "typescript",
      js: "javascript", jsx: "javascript",
      json: "json", css: "css", md: "markdown",
      html: "html", py: "python",
    }

    filesMap.forEach((value: unknown, key: string) => {
      if (value instanceof Y.Text) {
        const ext = key.split(".").pop() ?? ""
        const normalizedPath = key.startsWith("/") ? key : "/" + key
        newFiles.push({
          path: normalizedPath,
          content: (value as { toString(): string }).toString(),
          language: langMap[ext] ?? "plaintext",
        })
      }
    })

    newFiles.sort((a, b) => a.path.localeCompare(b.path))
    setFiles(newFiles)
  }, [])

  const syncMetaFromDoc = useCallback(() => {
    const doc = ydocRef.current
    if (!doc) return
    const metaMap = doc.getMap("meta")
    setMeta({
      name: (metaMap.get("name") as string) ?? "",
      description: (metaMap.get("description") as string) ?? "",
    })
  }, [])

  const syncPresence = useCallback(() => {
    const awareness = awarenessRef.current
    if (!awareness) return

    const states = awareness.getStates()
    const users: PresenceUser[] = []
    states.forEach((state: Record<string, unknown>, clientId: number) => {
      const u = state.user as Record<string, unknown> | undefined
      if (u) {
        users.push({
          // Use "userId:clientId" as the id so same user in multiple tabs gets unique entries
          id: `${u.userId as string}:${clientId}`,
          name: u.name as string,
          email: (u.email as string) || "",
          avatarUrl: u.avatarUrl as string | null,
          cursorColor: u.cursorColor as string,
          activeFile: u.activeFile as string | null,
          cursorPosition: u.cursorPosition as { line: number; column: number } | null,
          isTyping: (u.isTyping as boolean) ?? false,
          isOnline: true,
          terminalSessionId: u.terminalSessionId as string | undefined,
          terminalDraft: u.terminalDraft as string | undefined,
          terminalCursorPos: u.terminalCursorPos as number | undefined,
        })
      }
    })
    setPresence(users)
  }, [])

  const syncTerminalFromDoc = useCallback(() => {
    const doc = ydocRef.current
    if (!doc) return
    const terminalsMap = doc.getMap("terminals")
    const sessions: TerminalSession[] = []

    terminalsMap.forEach((value: unknown, key: string) => {
      if (value && typeof value === "object" && typeof (value as Record<string, unknown>).get === "function") {
        const sessionMap = value as { get(k: string): unknown }
        const name = (sessionMap.get("name") as string) ?? "Terminal"
        const linesArr = sessionMap.get("lines")
        const lines: TerminalLine[] = []

        if (linesArr && typeof (linesArr as Record<string, unknown>).toArray === "function") {
          const arr = (linesArr as { toArray(): unknown[] }).toArray()
          for (const item of arr) {
            if (item && typeof item === "object") {
              lines.push(item as TerminalLine)
            }
          }
        }

        sessions.push({ id: key, name, lines })
      }
    })

    sessions.sort((a, b) => a.id.localeCompare(b.id))
    setTerminalSessions(sessions)
  }, [])

  const syncAIChatsFromDoc = useCallback(() => {
    const doc = ydocRef.current
    if (!doc) return
    const aiChatsMap = doc.getMap("aiChats")
    const sessions: AIChatSession[] = []

    aiChatsMap.forEach((value: unknown, key: string) => {
      if (value && typeof value === "object" && typeof (value as Record<string, unknown>).get === "function") {
        const chatMap = value as { get(k: string): unknown }
        const messages: AIChatMessage[] = []

        const messagesArr = chatMap.get("messages")
        if (messagesArr && typeof (messagesArr as Record<string, unknown>).toArray === "function") {
          const arr = (messagesArr as { toArray(): unknown[] }).toArray()
          for (const item of arr) {
            if (item && typeof item === "object") {
              messages.push(item as AIChatMessage)
            }
          }
        }

        sessions.push({
          id: key,
          agentId: (chatMap.get("agentId") as string) ?? "",
          agentName: (chatMap.get("agentName") as string) ?? "AI",
          name: (chatMap.get("name") as string) || undefined,
          messages,
          isGenerating: (chatMap.get("isGenerating") as boolean) ?? false,
        })
      }
    })

    sessions.sort((a, b) => a.id.localeCompare(b.id))
    setAIChatSessions(sessions)
  }, [])

  const syncAgentsFromDoc = useCallback(() => {
    const doc = ydocRef.current
    if (!doc) return
    const agentsMap = doc.getMap("agents")
    const agents: AIAgent[] = []

    agentsMap.forEach((value: unknown, key: string) => {
      if (value && typeof value === "object" && typeof (value as Record<string, unknown>).get === "function") {
        const agentMap = value as { get(k: string): unknown }
        agents.push({
          id: key,
          name: (agentMap.get("name") as string) ?? "",
          persona: (agentMap.get("persona") as string) ?? "",
          avatarUrl: null,
          systemPrompt: (agentMap.get("systemPrompt") as string) ?? "",
          color: (agentMap.get("color") as string) ?? "hsl(172, 66%, 50%)",
          isActive: (agentMap.get("isActive") as boolean) ?? true,
        })
      }
    })

    agents.sort((a, b) => a.name.localeCompare(b.name))
    setAIAgents(agents)
  }, [])

  // ── Main effect: dynamically load yjs, create doc, connect socket ──

  useEffect(() => {
    let destroyed = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cleanupFn: (() => void) | undefined

    async function init() {
      // Dynamic imports — avoids SSR issues with yjs/lib0
      const [Y, encoding, decoding, syncProtocol, awarenessProtocol] =
        await Promise.all([
          import("yjs"),
          import("lib0/encoding"),
          import("lib0/decoding"),
          import("y-protocols/sync"),
          import("y-protocols/awareness"),
        ])

      if (destroyed) return

      yjsRef.current = Y

      const doc = new Y.Doc()
      ydocRef.current = doc
      setLocalClientId(doc.clientID)

      const awareness = new awarenessProtocol.Awareness(doc)
      awarenessRef.current = awareness

      // Initialize shared types
      const filesMap = doc.getMap("files")
      const metaMap = doc.getMap("meta")
      const terminalsMap = doc.getMap("terminals")
      const aiChatsMap = doc.getMap("aiChats")
      const agentsMap = doc.getMap("agents")

      // NOTE: We intentionally do NOT seed initialFiles into the Yjs doc here.
      // The server loads files from the latest snapshot and provides them during
      // the initial Yjs sync (sync-step-1/2 exchange).  If the client also seeds
      // files, both sides create separate Y.Text items for the same map keys.
      // Y.Map LWW conflict resolution picks one winner per key, but the Monaco
      // binding (created at editor mount time) may be attached to the loser,
      // causing one-way collaboration where one user's edits are invisible.
      //
      // The file tree still renders immediately from the `initialFiles` prop via
      // React state (`useState<FileNode[]>(initialFiles)`), so the UI is not
      // empty while waiting for the sync to deliver the live Y.Text instances.

      // ── Socket.IO ──
      const socket = io(COLLAB_SERVER_URL, {
        transports: ["websocket", "polling"],
        withCredentials: true,
      })
      socketRef.current = socket

      let wasConnected = false

      socket.on("connect", () => {
        if (destroyed) return
        setConnected(true)
        socket.emit("join-project", {
          projectId,
          userId: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          cursorColor: currentUser.cursorColor,
          avatarUrl: currentUser.avatarUrl,
          clientId: doc.clientID,
        })
        // Show reconnection toast only if we previously lost connection
        if (wasConnected) {
          toast.success("Reconnected — you're back in sync", { duration: 3000 })
        }
        wasConnected = true
      })

      socket.on("disconnect", (reason) => {
        if (destroyed) return
        setConnected(false)
        // Only show toast for unexpected disconnections, not clean unmounts
        if (reason !== "io client disconnect") {
          toast.warning("Lost connection to the workspace", {
            description: "We're automatically trying to reconnect.",
            duration: 5000,
            action: {
              label: "Retry Now",
              onClick: () => socket.connect(),
            },
          })
        }
      })

      socket.on("connect_error", () => {
        if (destroyed) return
        // Only fire once — Socket.IO retries automatically
        if (!wasConnected) {
          toast.error("Unable to connect to the collaboration server", {
            description: "You can still edit locally. Changes will sync when the connection is restored.",
            duration: 6000,
          })
          wasConnected = true // prevent repeat toasts
        }
      })

      // ── Yjs sync ──
      socket.on("yjs-sync", (msg: { type: string; data: number[] }) => {
        if (!msg.data || msg.data.length === 0) return
        try {
          const msgData = new Uint8Array(msg.data)

          if (msg.type === "sync-step-1") {
            const enc = encoding.createEncoder()
            const dec = decoding.createDecoder(msgData)
            // Consume the message type prefix written by writeSyncStep1
            decoding.readVarUint(dec)
            doc.transact(() => {
              syncProtocol.readSyncStep1(dec, enc, doc)
            }, socket)
            // enc now has [messageYjsSyncStep2, diff...] — send as sync-step-2
            socket.emit("yjs-sync", {
              type: "sync-step-2",
              data: Array.from(encoding.toUint8Array(enc)),
            })
            // Also send our own state vector to get data we're missing
            const enc2 = encoding.createEncoder()
            syncProtocol.writeSyncStep1(enc2, doc)
            socket.emit("yjs-sync", {
              type: "sync-step-1",
              data: Array.from(encoding.toUint8Array(enc2)),
            })
          } else if (msg.type === "sync-step-2") {
            const dec = decoding.createDecoder(msgData)
            // Consume the message type prefix written by readSyncStep1's response
            decoding.readVarUint(dec)
            syncProtocol.readSyncStep2(dec, doc, socket)
          } else if (msg.type === "update") {
            Y.applyUpdate(doc, msgData, socket)
          }
        } catch (err) {
          console.warn("[iTECify] Yjs sync error (ignoring):", (err as Error).message)
        }
      })

      // ── Awareness ──
      socket.on("awareness-update", (msg: { data: number[] }) => {
        if (!msg.data || msg.data.length === 0) return
        try {
          const update = new Uint8Array(msg.data)
          awarenessProtocol.applyAwarenessUpdate(awareness, update, socket)
        } catch (err) {
          console.warn("[iTECify] Awareness sync error (ignoring):", (err as Error).message)
        }
      })

      socket.on("room-users", () => syncPresence())
      socket.on("user-joined", () => syncPresence())
      socket.on("user-left", () => syncPresence())

      // ── Docker status ──
      socket.on("docker-status", (msg: { status: string; error?: string }) => {
        if (!destroyed) {
          setDockerStatus(msg.status as DockerStatus)
          setDockerError(msg.error ?? null)
        }
      })

      // ── Docker stats ──
      socket.on("docker-stats", (msg: { cpuPercent: number; memoryUsageMB: number; memoryLimitMB: number; memoryPercent: number }) => {
        if (!destroyed) {
          setDockerStats(msg)
        }
      })

      // ── Terminal busy / cwd updates ──
      socket.on("terminal-busy", (msg: { sessionId: string; busy: boolean; cwd?: string }) => {
        if (!destroyed) {
          if (msg.sessionId === "__all__") {
            // Container reset: clear all busy states and reset cwds
            setTerminalBusy({})
            if (msg.cwd) {
              setTerminalCwds((prev) => {
                const next: Record<string, string> = {}
                for (const key of Object.keys(prev)) {
                  next[key] = msg.cwd!
                }
                return next
              })
            }
          } else {
            setTerminalBusy((prev) => ({ ...prev, [msg.sessionId]: msg.busy }))
            if (msg.cwd) {
              setTerminalCwds((prev) => ({ ...prev, [msg.sessionId]: msg.cwd! }))
            }
          }
        }
      })

      // ── Doc updates → server ──
      const onDocUpdate = (update: Uint8Array, origin: unknown) => {
        if (origin === socket) return
        socket.emit("yjs-sync", {
          type: "update",
          data: Array.from(update),
        })
      }
      doc.on("update", onDocUpdate)

      // ── Awareness → server ──
      const onAwarenessChange = (
        _changes: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown
      ) => {
        // Always sync presence state (both local and remote changes)
        syncPresence()
        // Only broadcast our own changes to the server (skip if origin is socket)
        if (origin === socket) return
        const upd = awarenessProtocol.encodeAwarenessUpdate(awareness, [doc.clientID])
        socket.emit("awareness-update", { data: Array.from(upd) })
      }
      awareness.on("change", onAwarenessChange)

      // ── Observe shared types ──
      const onFilesChange = () => syncFilesFromDoc()
      const onMetaChange = () => syncMetaFromDoc()
      const onTerminalsChange = () => syncTerminalFromDoc()
      const onAIChatsChange = () => syncAIChatsFromDoc()
      const onAgentsChange = () => syncAgentsFromDoc()
      filesMap.observeDeep(onFilesChange)
      metaMap.observeDeep(onMetaChange)
      terminalsMap.observeDeep(onTerminalsChange)
      aiChatsMap.observeDeep(onAIChatsChange)
      agentsMap.observeDeep(onAgentsChange)

      // Initial sync
      queueMicrotask(() => {
        syncFilesFromDoc()
        syncMetaFromDoc()
        syncTerminalFromDoc()
        syncAIChatsFromDoc()
        syncAgentsFromDoc()
      })

      // Set awareness — name and color MUST be at top level for y-monaco cursor rendering
      awareness.setLocalStateField("user", {
        userId: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        cursorColor: currentUser.cursorColor,
        avatarUrl: currentUser.avatarUrl,
        activeFile: null,
        cursorPosition: null,
        isTyping: false,
        isOnline: true,
      })
      // Top-level fields for y-monaco (reads state.name, state.color directly)
      awareness.setLocalStateField("name", currentUser.name)
      awareness.setLocalStateField("color", currentUser.cursorColor)

      cleanupFn = () => {
        doc.off("update", onDocUpdate)
        awareness.off("change", onAwarenessChange)
        filesMap.unobserveDeep(onFilesChange)
        metaMap.unobserveDeep(onMetaChange)
        terminalsMap.unobserveDeep(onTerminalsChange)
        aiChatsMap.unobserveDeep(onAIChatsChange)
        agentsMap.unobserveDeep(onAgentsChange)
        awareness.destroy()
        doc.destroy()
        socket.disconnect()
        ydocRef.current = null
        awarenessRef.current = null
        socketRef.current = null
        yjsRef.current = null
      }
    }

    init()

    return () => {
      destroyed = true
      cleanupFn?.()
    }
  }, [projectId, currentUser.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public API ──

  const getYdoc = useCallback(() => ydocRef.current, [])

  const getYjs = useCallback(() => yjsRef.current, [])

  const getAwareness = useCallback(() => awarenessRef.current, [])

  const getYText = useCallback((path: string): unknown | null => {
    const Y = yjsRef.current
    const doc = ydocRef.current
    if (!Y || !doc) return null
    const filesMap = doc.getMap("files")
    // Try exact path, then with/without leading slash
    let ytext = filesMap.get(path)
    if (!(ytext instanceof Y.Text)) {
      const alt = path.startsWith("/") ? path.slice(1) : "/" + path
      ytext = filesMap.get(alt)
    }
    if (ytext instanceof Y.Text) return ytext
    return null
  }, [])

  const getTerminalInputYText = useCallback((sessionId: string): unknown | null => {
    const Y = yjsRef.current
    const doc = ydocRef.current
    if (!Y || !doc) return null
    const terminalsMap = doc.getMap("terminals")
    const sessionMap = terminalsMap.get(sessionId)
    if (!sessionMap || !(sessionMap instanceof Y.Map)) return null
    let inputText = sessionMap.get("input")
    if (!(inputText instanceof Y.Text)) {
      // Create the shared input Y.Text if it doesn't exist yet
      doc.transact(() => {
        const yt = new Y.Text()
        ;(sessionMap as InstanceType<typeof Y.Map>).set("input", yt)
        inputText = yt
      })
    }
    return inputText
  }, [])

  const createFile = useCallback((path: string, content = "") => {
    const Y = yjsRef.current
    const doc = ydocRef.current
    if (!Y || !doc) return
    const filesMap = doc.getMap("files")
    // Normalize: strip leading slash so keys match container paths
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path
    if (filesMap.has(normalizedPath) || filesMap.has("/" + normalizedPath)) return
    doc.transact(() => {
      const ytext = new Y.Text()
      if (content) ytext.insert(0, content)
      filesMap.set(normalizedPath, ytext)
    })
  }, [])

  const deleteFile = useCallback((path: string) => {
    const doc = ydocRef.current
    if (!doc) return
    const filesMap = doc.getMap("files")
    const key = filesMap.has(path) ? path : (path.startsWith("/") ? path.slice(1) : "/" + path)
    doc.transact(() => { filesMap.delete(key) })
  }, [])

  const renameFile = useCallback((oldPath: string, newPath: string) => {
    const Y = yjsRef.current
    const doc = ydocRef.current
    if (!Y || !doc) return
    const filesMap = doc.getMap("files")
    let existing = filesMap.get(oldPath)
    let actualOldKey = oldPath
    if (!(existing instanceof Y.Text)) {
      const alt = oldPath.startsWith("/") ? oldPath.slice(1) : "/" + oldPath
      existing = filesMap.get(alt)
      actualOldKey = alt
    }
    if (!(existing instanceof Y.Text)) return
    // Normalize new key: strip leading slash to match container convention
    const normalizedNewPath = newPath.startsWith("/") ? newPath.slice(1) : newPath
    const content = existing.toString()
    doc.transact(() => {
      const newText = new Y.Text()
      newText.insert(0, content)
      filesMap.set(normalizedNewPath, newText)
      filesMap.delete(actualOldKey)
    })
  }, [])

  const updateFileContent = useCallback((path: string, newContent: string) => {
    const Y = yjsRef.current
    const doc = ydocRef.current
    if (!Y || !doc) return
    const filesMap = doc.getMap("files")
    // Normalize: strip leading slash to match createFile convention
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path
    let ytext = filesMap.get(normalizedPath)
    if (!(ytext instanceof Y.Text)) {
      // Try alternate path (with leading slash)
      ytext = filesMap.get("/" + normalizedPath)
    }
    if (!(ytext instanceof Y.Text)) {
      ytext = new Y.Text()
      filesMap.set(normalizedPath, ytext)
    }
    const current = ytext.toString()
    if (current === newContent) return
    doc.transact(() => {
      ytext.delete(0, ytext.length)
      ytext.insert(0, newContent)
    })
  }, [])

  const updateAwareness = useCallback((state: Partial<AwarenessState>) => {
    const awareness = awarenessRef.current
    if (!awareness) return
    const current = awareness.getLocalState()?.user || {}
    awareness.setLocalStateField("user", { ...current, ...state })
    // Keep top-level isOnline sync'd for y-monaco
    if (state.isTyping !== undefined) {
      // Trigger an awareness update so remote users see changes
    }
  }, [])

  const updateMeta = useCallback((key: string, value: string) => {
    const doc = ydocRef.current
    if (!doc) return
    doc.getMap("meta").set(key, value)
  }, [])

  const createTerminalSession = useCallback((name?: string): string | null => {
    const Y = yjsRef.current
    const doc = ydocRef.current
    if (!Y || !doc) return null
    const terminalsMap = doc.getMap("terminals")
    const sessionId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    doc.transact(() => {
      const sessionMap = new Y.Map()
      sessionMap.set("name", name ?? "Terminal")
      sessionMap.set("lines", new Y.Array())
      terminalsMap.set(sessionId, sessionMap)
    })
    return sessionId
  }, [])

  const deleteTerminalSession = useCallback((sessionId: string) => {
    const doc = ydocRef.current
    if (!doc) return
    doc.transact(() => { doc.getMap("terminals").delete(sessionId) })
  }, [])

  const sendTerminalInput = useCallback(
    (sessionId: string, content: string) => {
      const socket = socketRef.current
      if (!socket) return
      socket.emit("terminal-input", {
        sessionId,
        content,
        userId: currentUser.id,
      })
    },
    [currentUser.id]
  )

  const getAIChatInputYText = useCallback((chatId: string): unknown | null => {
    const Y = yjsRef.current
    const doc = ydocRef.current
    if (!Y || !doc) return null
    const aiChatsMap = doc.getMap("aiChats")
    let chatMap = aiChatsMap.get(chatId)
    if (!chatMap || !(chatMap instanceof Y.Map)) {
      // Create the chat map skeleton so the input Y.Text can exist
      doc.transact(() => {
        const newChat = new Y.Map()
        newChat.set("input", new Y.Text())
        aiChatsMap.set(chatId, newChat)
        chatMap = newChat
      })
    }
    let inputText = (chatMap as InstanceType<typeof Y.Map>).get("input")
    if (!(inputText instanceof Y.Text)) {
      doc.transact(() => {
        const yt = new Y.Text()
        ;(chatMap as InstanceType<typeof Y.Map>).set("input", yt)
        inputText = yt
      })
    }
    return inputText
  }, [])

  const sendAIChat = useCallback(
    (opts: {
      chatId: string
      content: string
      agentId: string
      agentName: string
      agentInstructions?: string
    }) => {
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      // Ensure the chat skeleton exists in Yjs so the UI shows the chat tab immediately.
      // The server will add the actual user message, AI response, and control isGenerating.
      const Y = yjsRef.current
      const doc = ydocRef.current
      if (Y && doc) {
        const aiChatsMap = doc.getMap("aiChats")
        let chatMap = aiChatsMap.get(opts.chatId)
        if (!chatMap || !(chatMap instanceof Y.Map)) {
          doc.transact(() => {
            const newChat = new Y.Map()
            newChat.set("agentId", opts.agentId)
            newChat.set("agentName", opts.agentName)
            newChat.set("isGenerating", false)
            newChat.set("messages", new Y.Array())
            newChat.set("input", new Y.Text())
            aiChatsMap.set(opts.chatId, newChat)
            chatMap = newChat
          })
        }
      }

      // Emit to server for AI processing — server adds user message + AI response to Yjs
      const socket = socketRef.current
      if (socket?.connected) {
        socket.emit("ai-chat", {
          chatId: opts.chatId,
          messageId,
          content: opts.content,
          userId: currentUser.id,
          userName: currentUser.name,
          agentId: opts.agentId,
          agentName: opts.agentName,
          agentInstructions: opts.agentInstructions,
        })
      } else {
        // Offline — write a local error message so the user knows
        if (Y && doc) {
          const aiChatsMap = doc.getMap("aiChats")
          const chatMap = aiChatsMap.get(opts.chatId) as InstanceType<typeof Y.Map> | undefined
          if (chatMap) {
            doc.transact(() => {
              // Add the user message locally so it's visible
              const messagesArr = chatMap.get("messages")
              if (messagesArr instanceof Y.Array) {
                messagesArr.push([
                  {
                    id: messageId,
                    role: "user",
                    content: opts.content,
                    userId: currentUser.id,
                    userName: currentUser.name,
                    timestamp: Date.now(),
                  },
                  {
                    id: `err-${Date.now()}`,
                    role: "assistant",
                    content: "Unable to reach the AI — the server connection is down. Your message will not be processed until the connection is restored. Please try again once the connection indicator turns green.",
                    operations: [],
                    operationStatuses: [],
                    timestamp: Date.now(),
                  },
                ])
              }
            })
          }
        }
      }
    },
    [currentUser.id, currentUser.name]
  )

  const renameAIChat = useCallback(
    (chatId: string, name: string) => {
      const socket = socketRef.current
      if (!socket) return
      socket.emit("rename-chat", { chatId, name })
    },
    []
  )

  const deleteAIChat = useCallback(
    (chatId: string) => {
      const socket = socketRef.current
      if (!socket) return
      socket.emit("delete-chat", { chatId })
    },
    []
  )

  const aiOperationAction = useCallback(
    (chatId: string, messageId: string, operationIndex: number, action: "accept" | "reject") => {
      const socket = socketRef.current
      if (!socket) return
      socket.emit("ai-operation-action", { chatId, messageId, operationIndex, action })
    },
    []
  )

  const aiBulkAction = useCallback(
    (chatId: string, messageId: string, action: "accept" | "reject") => {
      const socket = socketRef.current
      if (!socket) return
      socket.emit("ai-bulk-action", { chatId, messageId, action })
    },
    []
  )

  const requestAIMerge = useCallback(
    (opts: {
      chatId: string
      filePath: string
      originalContent: string
      versionA: string
      versionB: string
      contextA: string
      contextB: string
    }) => {
      const socket = socketRef.current
      if (!socket) return
      socket.emit("ai-merge", opts)
    },
    []
  )

  const createAgent = useCallback(
    (agent: { name: string; persona: string; systemPrompt: string; color: string }): string => {
      const socket = socketRef.current
      const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      if (socket) {
        socket.emit("create-agent", { ...agent, id, userId: currentUser.id })
      }
      return id
    },
    [currentUser.id]
  )

  const updateAgent = useCallback(
    (id: string, updates: Partial<{ name: string; persona: string; systemPrompt: string; color: string; isActive: boolean }>) => {
      const socket = socketRef.current
      if (!socket) return
      socket.emit("update-agent", { id, ...updates })
    },
    []
  )

  const deleteAgent = useCallback(
    (id: string) => {
      const socket = socketRef.current
      if (!socket) return
      socket.emit("delete-agent", { id })
    },
    []
  )

  const resetContainer = useCallback(() => {
    const socket = socketRef.current
    if (!socket) return
    socket.emit("container-reset")
  }, [])

  const onAIStreamChunk = useCallback(
    (handler: (data: { chatId: string; messageId: string; chunk: string; done?: boolean }) => void) => {
      const socket = socketRef.current
      if (!socket) return () => {}
      socket.on("ai-chat-stream", handler)
      return () => { socket.off("ai-chat-stream", handler) }
    },
    []
  )

  const onAIMergeResult = useCallback(
    (handler: (data: { chatId: string; filePath: string; merged: string | null; explanation: string }) => void) => {
      const socket = socketRef.current
      if (!socket) return () => {}
      socket.on("ai-merge-result", handler)
      return () => { socket.off("ai-merge-result", handler) }
    },
    []
  )

  const broadcastSnapshot = useCallback(
    (snapshot: Record<string, unknown>) => {
      const socket = socketRef.current
      if (!socket) return
      socket.emit("snapshot-created", { snapshot })
    },
    []
  )

  const onSnapshotCreated = useCallback(
    (handler: (data: { snapshot: Record<string, unknown> }) => void) => {
      const socket = socketRef.current
      if (!socket) return () => {}
      socket.on("snapshot-created", handler)
      return () => { socket.off("snapshot-created", handler) }
    },
    []
  )

  return {
    connected,
    dockerStatus,
    dockerError,
    dockerStats,
    terminalBusy,
    terminalCwds,
    files,
    presence,
    localClientId,
    meta,
    terminalSessions,
    aiChatSessions,
    aiAgents,
    getYdoc,
    getYjs,
    getYText,
    getAwareness,
    createFile,
    deleteFile,
    renameFile,
    updateAwareness,
    updateFileContent,
    updateMeta,
    createTerminalSession,
    deleteTerminalSession,
    sendTerminalInput,
    getTerminalInputYText,
    getAIChatInputYText,
    sendAIChat,
    renameAIChat,
    deleteAIChat,
    aiOperationAction,
    aiBulkAction,
    requestAIMerge,
    createAgent,
    updateAgent,
    deleteAgent,
    resetContainer,
    onAIStreamChunk,
    onAIMergeResult,
    broadcastSnapshot,
    onSnapshotCreated,
  }
}
