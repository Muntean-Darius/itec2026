// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Real-Time Collaboration Hook
// Connects to the collaboration server via Socket.IO + Yjs
// All yjs/lib0/y-protocols imports are dynamic (inside useEffect) to avoid
// "Unexpected end of array" SSR errors with Turbopack.
// ═══════════════════════════════════════════════════════════════════════════

"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { io, Socket } from "socket.io-client"
import type { User, FileNode, PresenceUser, TerminalLine } from "@/data/types"

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

export interface UseCollaborationReturn {
  connected: boolean
  files: FileNode[]
  presence: PresenceUser[]
  localClientId: number | null
  meta: { name: string; description: string }
  terminalSessions: TerminalSession[]
  getYText: (path: string) => unknown | null
  getYdoc: () => unknown | null
  getAwareness: () => unknown | null
  getTerminalInputYText: (sessionId: string) => unknown | null
  createFile: (path: string, content?: string) => void
  deleteFile: (path: string) => void
  renameFile: (oldPath: string, newPath: string) => void
  updateAwareness: (state: Partial<AwarenessState>) => void
  updateFileContent: (path: string, newContent: string) => void
  updateMeta: (key: string, value: string) => void
  createTerminalSession: (name?: string) => string | null
  deleteTerminalSession: (sessionId: string) => void
  sendTerminalInput: (sessionId: string, content: string) => void
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
        newFiles.push({
          path: key,
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

      // Seed initial files
      if (initialFiles.length > 0) {
        doc.transact(() => {
          for (const file of initialFiles) {
            if (!filesMap.has(file.path)) {
              const ytext = new Y.Text()
              ytext.insert(0, file.content)
              filesMap.set(file.path, ytext)
            }
          }
        })
      }

      // ── Socket.IO ──
      const socket = io(COLLAB_SERVER_URL, {
        transports: ["websocket", "polling"],
        withCredentials: true,
      })
      socketRef.current = socket

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
      })

      socket.on("disconnect", () => {
        if (!destroyed) setConnected(false)
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
      filesMap.observeDeep(onFilesChange)
      metaMap.observeDeep(onMetaChange)
      terminalsMap.observeDeep(onTerminalsChange)

      // Initial sync
      queueMicrotask(() => {
        syncFilesFromDoc()
        syncMetaFromDoc()
        syncTerminalFromDoc()
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

  const getAwareness = useCallback(() => awarenessRef.current, [])

  const getYText = useCallback((path: string): unknown | null => {
    const Y = yjsRef.current
    const doc = ydocRef.current
    if (!Y || !doc) return null
    const filesMap = doc.getMap("files")
    const ytext = filesMap.get(path)
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
    if (filesMap.has(path)) return
    doc.transact(() => {
      const ytext = new Y.Text()
      if (content) ytext.insert(0, content)
      filesMap.set(path, ytext)
    })
  }, [])

  const deleteFile = useCallback((path: string) => {
    const doc = ydocRef.current
    if (!doc) return
    doc.transact(() => { doc.getMap("files").delete(path) })
  }, [])

  const renameFile = useCallback((oldPath: string, newPath: string) => {
    const Y = yjsRef.current
    const doc = ydocRef.current
    if (!Y || !doc) return
    const filesMap = doc.getMap("files")
    const existing = filesMap.get(oldPath)
    if (!(existing instanceof Y.Text)) return
    doc.transact(() => {
      const newText = new Y.Text()
      newText.insert(0, existing.toString())
      filesMap.set(newPath, newText)
      filesMap.delete(oldPath)
    })
  }, [])

  const updateFileContent = useCallback((path: string, newContent: string) => {
    const Y = yjsRef.current
    const doc = ydocRef.current
    if (!Y || !doc) return
    const filesMap = doc.getMap("files")
    let ytext = filesMap.get(path)
    if (!(ytext instanceof Y.Text)) {
      ytext = new Y.Text()
      filesMap.set(path, ytext)
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

  return {
    connected,
    files,
    presence,
    localClientId,
    meta,
    terminalSessions,
    getYdoc,
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
  }
}
