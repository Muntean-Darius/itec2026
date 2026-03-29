// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Collaboration Engine
// Manages Yjs documents per project room, presence/awareness, and terminal.
//
// Architecture:
//   - Each project has one Yjs Doc in memory (source of truth during session)
//   - "files" Y.Map<string, Y.Text> — flat file system (path -> content)
//   - "meta" Y.Map — project metadata (name, description, language)
//   - "terminals" Y.Map<string, Y.Map> — multi-session terminals
//     Each terminal session map: { name: Y.Text, lines: Y.Array }
//   - Awareness protocol for cursors, presence, active files
//   - Socket.IO rooms scoped by projectId
//   - Automatic snapshots saved every 60s of activity
// ═══════════════════════════════════════════════════════════════════════════

import { Server as SocketIOServer, Socket } from "socket.io"
import * as Y from "yjs"
import * as encoding from "lib0/encoding"
import * as decoding from "lib0/decoding"
import * as syncProtocol from "y-protocols/sync"
import * as awarenessProtocol from "y-protocols/awareness"
import { loadLatestSnapshot } from "./snapshot-store.js"
import { streamAIChat, mergeWithAI } from "./ai.js"
import type { FileOperation, ChatMessage } from "./ai.js"
import {
  ensureContainer,
  getContainerStatusInfo,
  destroyContainer,
  resetContainer,
  executeCommand,
  getSessionCwd,
  onContainerStatus,
  onContainerStats,
  getContainerStats,
  startFileSync,
  stopFileSync,
  syncBeforeCommand,
  syncAfterCommand,
  type ContainerStatus,
} from "./docker-manager.js"

// ─── Types ───────────────────────────────────────────────────────────────

interface RoomUser {
  socketId: string
  userId: string
  name: string
  email: string
  cursorColor: string
  avatarUrl: string | null
  /** The Yjs doc.clientID sent by the client (for awareness cleanup) */
  yjsClientId: number | null
}

interface ProjectRoom {
  doc: Y.Doc
  awareness: awarenessProtocol.Awareness
  users: Map<string, RoomUser> // socketId -> user
  snapshotTimer: ReturnType<typeof setInterval> | null
  lastChangeAt: number
  lastSnapshotAt: number
  io: SocketIOServer | null
}

// ─── Room Store ──────────────────────────────────────────────────────────

const rooms = new Map<string, ProjectRoom>()

function getOrCreateRoom(projectId: string, io?: SocketIOServer): ProjectRoom {
  let room = rooms.get(projectId)
  if (room) return room

  const doc = new Y.Doc()
  const awareness = new awarenessProtocol.Awareness(doc)

  // Initialize shared types
  doc.getMap("files")     // Y.Map<string, Y.Text>
  doc.getMap("meta")      // Y.Map with name, description, language
  doc.getMap("terminals") // Y.Map<sessionId, Y.Map { name: string, lines: Y.Array }>
  doc.getMap("aiChats")   // Y.Map<chatId, Y.Map { id, agentId, agentName, messages: Y.Array, isGenerating }>
  doc.getMap("agents")    // Y.Map<agentId, Y.Map { id, name, persona, systemPrompt, color, isActive }>

  const now = Date.now()
  room = {
    doc,
    awareness,
    users: new Map(),
    snapshotTimer: null,
    lastChangeAt: now,
    lastSnapshotAt: now,
    io: io ?? null,
  }
  rooms.set(projectId, room)

  // Track changes for snapshot timing
  doc.on("update", () => {
    room!.lastChangeAt = Date.now()
  })

  // Broadcast server-originated doc updates to all clients in the room.
  // This is critical for terminal responses (server modifies doc directly).
  // We use the "server" origin to tag server-side mutations and only broadcast those.
  const roomName = `project:${projectId}`
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    // Only broadcast updates that originated from the server itself (origin === "server")
    // Client-originated updates are echoed in the sync handler already.
    if (origin === "server" && room!.io) {
      room!.io.to(roomName).emit("yjs-sync", {
        type: "update",
        data: Array.from(update),
      })
    }
  })

  // Clean up room after 5 minutes of no users
  const checkEmpty = () => {
    if (room!.users.size === 0) {
      setTimeout(() => {
        if (room!.users.size === 0) {
          if (room!.snapshotTimer) clearInterval(room!.snapshotTimer)
          loadedRooms.delete(projectId)
          awareness.destroy()
          doc.destroy()
          rooms.delete(projectId)
        }
      }, 5 * 60 * 1000)
    }
  }
  awareness.on("change", () => checkEmpty())

  return room
}

/**
 * Load the latest snapshot from DB into the room's Yjs doc.
 * Called once when the first user joins a room.
 *
 * Handles two blob formats:
 * - Server cron snapshots: blob is a real Yjs state vector (Y.encodeStateAsUpdate)
 * - Client snapshots: blob is JSON.stringify(fileStates) — NOT a valid Yjs update
 *
 * When the blob is invalid, falls back to reconstructing the doc from fileStates.
 */
const loadedRooms = new Set<string>()
async function ensureSnapshotLoaded(projectId: string, room: ProjectRoom) {
  if (loadedRooms.has(projectId)) return
  loadedRooms.add(projectId)
  try {
    const result = await loadLatestSnapshot(projectId)
    if (!result) {
      console.log(`[iTECify] No snapshot found for ${projectId} — starting fresh`)
      return
    }

    const { blob, fileStates } = result

    // Detect whether the blob is a real Yjs binary update or a client-created
    // JSON blob (Buffer.from(JSON.stringify(fileStates))).  A Yjs update starts
    // with a struct-count varint; a JSON blob starts with '{' (0x7B) or '['.
    // Applying a JSON blob to Y.applyUpdate may silently corrupt the doc without
    // throwing, so we must detect and skip it.
    const isLikelyJsonBlob = blob.byteLength > 0 && (blob[0] === 0x7B || blob[0] === 0x5B) // '{' or '['

    // Try applying the blob as a Yjs state update (only if it looks like a real Yjs binary)
    if (blob.byteLength > 0 && !isLikelyJsonBlob) {
      try {
        Y.applyUpdate(room.doc, blob)
        console.log(`[iTECify] Loaded Yjs snapshot for ${projectId} (${blob.byteLength} bytes)`)
        return
      } catch (err) {
        console.warn(`[iTECify] Yjs blob invalid for ${projectId}, falling back to fileStates:`, (err as Error).message)
      }
    } else if (isLikelyJsonBlob) {
      console.log(`[iTECify] Snapshot blob for ${projectId} is JSON (client-created), using fileStates instead`)
    }

    // Reconstruct the doc from fileStates (handles client-created snapshots
    // where the blob is JSON text instead of a Yjs binary update)
    if (fileStates && typeof fileStates === "object") {
      const filesMap = room.doc.getMap("files")
      room.doc.transact(() => {
        for (const [path, content] of Object.entries(fileStates)) {
          if (typeof content === "string") {
            // Normalize path: strip leading slash to match client convention
            const normalizedPath = path.startsWith("/") ? path.slice(1) : path
            const ytext = new Y.Text()
            ytext.insert(0, content)
            filesMap.set(normalizedPath, ytext)
          }
        }
      }, "server")
      console.log(`[iTECify] Reconstructed ${Object.keys(fileStates).length} files from fileStates for ${projectId}`)
      return
    }

    console.log(`[iTECify] No usable snapshot data for ${projectId} — starting fresh`)
  } catch (err) {
    console.error(`[iTECify] Failed to load snapshot for ${projectId}:`, err)
  }
}

// ─── Snapshot Saving ─────────────────────────────────────────────────────

interface SnapshotStore {
  save: (projectId: string, blob: Uint8Array, userId: string, options?: { fileStates?: Record<string, string> }) => Promise<void>
}

let snapshotStore: SnapshotStore | null = null

export function setSnapshotStore(store: SnapshotStore) {
  snapshotStore = store
}

async function saveSnapshot(projectId: string, room: ProjectRoom) {
  if (!snapshotStore) {
    // No store configured — just log
    console.log(`[iTECify] Snapshot skipped for ${projectId} (no store configured)`)
    return
  }
  try {
    const blob = Y.encodeStateAsUpdate(room.doc)
    const userId = room.users.values().next().value?.userId ?? "system"

    // Extract file states from the Yjs doc for time-travel preview
    const filesMap = room.doc.getMap("files")
    const fileStates: Record<string, string> = {}
    filesMap.forEach((value: unknown, key: string) => {
      if (value && typeof (value as { toString(): string }).toString === "function") {
        fileStates[key] = (value as { toString(): string }).toString()
      }
    })

    await snapshotStore.save(projectId, blob, userId, { fileStates })
    room.lastSnapshotAt = Date.now()
    console.log(`[iTECify] Snapshot saved for ${projectId} (${blob.byteLength} bytes, ${Object.keys(fileStates).length} files)`)
  } catch (err) {
    console.error(`[iTECify] Snapshot save failed for ${projectId}:`, err)
  }
}

function startSnapshotTimer(projectId: string, room: ProjectRoom) {
  if (room.snapshotTimer) return
  // Check every 60s — save if there have been changes since last snapshot
  room.snapshotTimer = setInterval(() => {
    if (room.lastChangeAt > room.lastSnapshotAt && room.users.size > 0) {
      saveSnapshot(projectId, room)
    }
  }, 60_000)
}

// ─── Socket.IO Setup ─────────────────────────────────────────────────────

export function setupCollaboration(io: SocketIOServer) {
  // Broadcast Docker container status changes to all clients in the relevant room
  onContainerStatus((projectId, info) => {
    io.to(`project:${projectId}`).emit("docker-status", info)
  })

  // Broadcast Docker container stats to all clients in the relevant room
  onContainerStats((projectId, stats) => {
    io.to(`project:${projectId}`).emit("docker-stats", stats)
  })

  io.on("connection", (socket: Socket) => {
    let currentProjectId: string | null = null
    let currentRoom: ProjectRoom | null = null

    // ── Join a project room ──
    socket.on("join-project", async (data: {
      projectId: string
      userId: string
      name: string
      email: string
      cursorColor: string
      avatarUrl: string | null
      clientId?: number
    }) => {
      const { projectId, userId, name, email, cursorColor, avatarUrl, clientId } = data

      // Leave previous room if any
      if (currentProjectId && currentRoom) {
        leaveRoom(socket, currentProjectId, currentRoom)
      }

      currentProjectId = projectId
      currentRoom = getOrCreateRoom(projectId, io)

      // Load snapshot from DB if this room was just created
      await ensureSnapshotLoaded(projectId, currentRoom)

      const roomName = `project:${projectId}`

      socket.join(roomName)

      // Register user
      currentRoom.users.set(socket.id, {
        socketId: socket.id,
        userId,
        name,
        email,
        cursorColor,
        avatarUrl,
        yjsClientId: clientId ?? null,
      })

      // Send initial Yjs sync (step 1)
      const encoder = encoding.createEncoder()
      syncProtocol.writeSyncStep1(encoder, currentRoom.doc)
      socket.emit("yjs-sync", {
        type: "sync-step-1",
        data: Array.from(encoding.toUint8Array(encoder)),
      })

      // Send current awareness states to the new client
      const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
        currentRoom.awareness,
        Array.from(currentRoom.awareness.getStates().keys())
      )
      socket.emit("awareness-update", {
        data: Array.from(awarenessUpdate),
      })

      // Notify others about new user
      socket.to(roomName).emit("user-joined", {
        socketId: socket.id,
        userId,
        name,
        cursorColor,
        avatarUrl,
      })

      // Send user list to joining client
      socket.emit("room-users", {
        users: Array.from(currentRoom.users.values()),
      })

      // Start snapshot timer for this room
      startSnapshotTimer(projectId, currentRoom)

      // ── Docker container: send current status then start if needed ──
      const existingInfo = getContainerStatusInfo(projectId)
      if (existingInfo) {
        socket.emit("docker-status", existingInfo)
      } else {
        socket.emit("docker-status", { status: "creating" })
      }

      // Send cached stats if available
      const cachedStats = getContainerStats(projectId)
      if (cachedStats) {
        socket.emit("docker-stats", cachedStats)
      }

      // Spin up Docker container in the background (no-op if already exists)
      const room = currentRoom
      const filesMap = room.doc.getMap("files")
      const fileEntries = new Map<string, string>()
      filesMap.forEach((value: unknown, key: string) => {
        if (value && typeof (value as { toString(): string }).toString === "function") {
          fileEntries.set(key, (value as { toString(): string }).toString())
        }
      })
      ensureContainer(projectId, fileEntries)
        .then(() => {
          // Start bidirectional file sync once container is ready
          startFileSync(projectId, {
            getFiles: () => {
              const files = new Map<string, string>()
              const fMap = room.doc.getMap("files")
              fMap.forEach((value: unknown, key: string) => {
                if (value && typeof (value as { toString(): string }).toString === "function") {
                  // Normalize: strip leading slash to match container paths
                  const normalizedKey = key.startsWith("/") ? key.slice(1) : key
                  files.set(normalizedKey, (value as { toString(): string }).toString())
                }
              })
              return files
            },
            applyContainerChanges: (containerFiles: Map<string, string>) => {
              const fMap = room.doc.getMap("files")
              room.doc.transact(() => {
                for (const [filePath, content] of containerFiles) {
                  // Try both with and without leading slash
                  let existing = fMap.get(filePath)
                  let actualKey = filePath
                  if (!(existing instanceof Y.Text)) {
                    existing = fMap.get("/" + filePath) as unknown
                    if (existing instanceof Y.Text) actualKey = "/" + filePath
                  }
                  if (existing instanceof Y.Text) {
                    const currentContent = existing.toString()
                    if (currentContent !== content) {
                      existing.delete(0, existing.length)
                      existing.insert(0, content)
                    }
                  } else {
                    const ytext = new Y.Text()
                    ytext.insert(0, content)
                    fMap.set(filePath, ytext)
                  }
                }
              }, "server")
            },
            removeFiles: (paths: string[]) => {
              const fMap = room.doc.getMap("files")
              room.doc.transact(() => {
                for (const p of paths) {
                  fMap.delete(p)
                  fMap.delete("/" + p)
                }
              }, "server")
            },
          })
        })
        .catch((err) => {
          console.error(`[iTECify] Docker container creation failed for ${projectId}:`, err)
        })
    })

    // ── Yjs sync messages ──
    socket.on("yjs-sync", (msg: { type: string; data: number[] }) => {
      if (!currentRoom || !currentProjectId) return
      if (!msg.data || msg.data.length === 0) return
      const roomName = `project:${currentProjectId}`

      try {
        const msgData = new Uint8Array(msg.data)

        if (msg.type === "sync-step-1") {
          const encoder = encoding.createEncoder()
          const decoder = decoding.createDecoder(msgData)
          // Consume the message type prefix written by writeSyncStep1
          decoding.readVarUint(decoder)
          syncProtocol.readSyncStep1(decoder, encoder, currentRoom.doc)
          // encoder now has [messageYjsSyncStep2, diff...] — send as sync-step-2
          socket.emit("yjs-sync", {
            type: "sync-step-2",
            data: Array.from(encoding.toUint8Array(encoder)),
          })
        } else if (msg.type === "sync-step-2") {
          const decoder = decoding.createDecoder(msgData)
          // Consume the message type prefix written by readSyncStep1's response
          decoding.readVarUint(decoder)
          syncProtocol.readSyncStep2(decoder, currentRoom.doc, socket)
        } else if (msg.type === "update") {
          Y.applyUpdate(currentRoom.doc, msgData, socket)
          socket.to(roomName).emit("yjs-sync", {
            type: "update",
            data: msg.data,
          })
        }
      } catch (err) {
        console.warn("[iTECify] Yjs sync error from client:", (err as Error).message)
      }
    })

    // ── Awareness updates (cursors, presence) ──
    socket.on("awareness-update", (msg: { data: number[] }) => {
      if (!currentRoom || !currentProjectId) return
      if (!msg.data || msg.data.length === 0) return
      const roomName = `project:${currentProjectId}`

      try {
        const update = new Uint8Array(msg.data)
        awarenessProtocol.applyAwarenessUpdate(currentRoom.awareness, update, socket)
      } catch (err) {
        console.warn("[iTECify] Awareness update error:", (err as Error).message)
      }

      socket.to(roomName).emit("awareness-update", {
        data: msg.data,
      })
    })

    // ── Terminal input (multi-session, Docker exec) ──
    socket.on("terminal-input", async (msg: { sessionId: string; content: string; userId: string }) => {
      if (!currentRoom || !currentProjectId) return

      const terminalsMap = currentRoom.doc.getMap("terminals")
      const sessionMap = terminalsMap.get(msg.sessionId)
      if (!sessionMap || !(sessionMap instanceof Y.Map)) return

      const linesArr = sessionMap.get("lines")
      if (!linesArr || !(linesArr instanceof Y.Array)) return

      const room = currentRoom
      const projectId = currentProjectId
      const roomName = `project:${projectId}`

      // Get the current working directory for this session before executing
      const stdinCwd = getSessionCwd(projectId, msg.sessionId)

      const stdinLine = {
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "stdin" as const,
        content: msg.content,
        timestamp: new Date().toISOString(),
        userId: msg.userId,
        cwd: stdinCwd,
      }

      // Push the stdin line & clear shared input immediately
      room.doc.transact(() => {
        linesArr.push([stdinLine])
        const inputText = sessionMap.get("input")
        if (inputText instanceof Y.Text && inputText.length > 0) {
          inputText.delete(0, inputText.length)
        }
      }, "server")

      // Notify all clients that this terminal session is busy
      io.to(roomName).emit("terminal-busy", { sessionId: msg.sessionId, busy: true })

      // Sync Yjs files → container before executing the command
      await syncBeforeCommand(projectId)

      // Execute command in Docker container
      const { output, exitCode, cwd } = await executeCommand(projectId, msg.sessionId, msg.content)

      if (output) {
        const lineType = (exitCode !== null && exitCode !== 0) ? "stderr" as const : "stdout" as const
        room.doc.transact(() => {
          linesArr.push([{
            id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: lineType,
            content: output,
            timestamp: new Date().toISOString(),
          }])
        }, "server")
      }

      // After command, merge container file changes back into Yjs (additive, not destructive)
      await syncAfterCommand(projectId)

      // Notify all clients that this terminal session is done + new cwd
      io.to(roomName).emit("terminal-busy", { sessionId: msg.sessionId, busy: false, cwd })
    })

    // ── Container Reset ──────────────────────────────────────────────────
    socket.on("container-reset", async () => {
      if (!currentRoom || !currentProjectId) return
      const projectId = currentProjectId
      const room = currentRoom
      const roomName = `project:${projectId}`

      console.log(`[iTECify] Container reset requested for ${projectId}`)

      // Gather current Yjs file state
      const filesMap = room.doc.getMap("files")
      const fileEntries = new Map<string, string>()
      filesMap.forEach((value: unknown, key: string) => {
        if (value && typeof (value as { toString(): string }).toString === "function") {
          const normalizedKey = key.startsWith("/") ? key.slice(1) : key
          fileEntries.set(normalizedKey, (value as { toString(): string }).toString())
        }
      })

      // Reset (destroy + recreate) the container
      await resetContainer(projectId, fileEntries)

      // Restart file sync
      startFileSync(projectId, {
        getFiles: () => {
          const files = new Map<string, string>()
          const fMap = room.doc.getMap("files")
          fMap.forEach((value: unknown, key: string) => {
            if (value && typeof (value as { toString(): string }).toString === "function") {
              const normalizedKey = key.startsWith("/") ? key.slice(1) : key
              files.set(normalizedKey, (value as { toString(): string }).toString())
            }
          })
          return files
        },
        applyContainerChanges: (containerFiles: Map<string, string>) => {
          const fMap = room.doc.getMap("files")
          room.doc.transact(() => {
            for (const [filePath, content] of containerFiles) {
              let existing = fMap.get(filePath)
              let actualKey = filePath
              if (!(existing instanceof Y.Text)) {
                existing = fMap.get("/" + filePath) as unknown
                if (existing instanceof Y.Text) actualKey = "/" + filePath
              }
              if (existing instanceof Y.Text) {
                const currentContent = existing.toString()
                if (currentContent !== content) {
                  existing.delete(0, existing.length)
                  existing.insert(0, content)
                }
              } else {
                const ytext = new Y.Text()
                ytext.insert(0, content)
                fMap.set(filePath, ytext)
              }
            }
          }, "server")
        },
        removeFiles: (paths: string[]) => {
          const fMap = room.doc.getMap("files")
          room.doc.transact(() => {
            for (const p of paths) {
              fMap.delete(p)
              fMap.delete("/" + p)
            }
          }, "server")
        },
      })

      // Reset terminal cwds for all clients
      io.to(roomName).emit("terminal-busy", { sessionId: "__all__", busy: false, cwd: "/home/itecify/workspace" })
    })

    // ── AI Chat ──────────────────────────────────────────────────────────
    socket.on("ai-chat", async (msg: {
      chatId: string
      messageId: string
      content: string
      userId: string
      userName: string
      agentId: string
      agentName: string
      agentInstructions?: string
    }) => {
      if (!currentRoom || !currentProjectId) return
      const room = currentRoom
      const projectId = currentProjectId
      const roomName = `project:${projectId}`

      // Get the AI chats Y.Map (each chat is a Y.Map with messages Y.Array)
      const aiChatsMap = room.doc.getMap("aiChats")

      // Get or create the chat session — client may have already created
      // a skeleton Y.Map (with just an "input" field) for collaborative input,
      // so always ensure the required fields exist.
      let chatMap = aiChatsMap.get(msg.chatId)
      if (!chatMap || !(chatMap instanceof Y.Map)) {
        room.doc.transact(() => {
          const newChat = new Y.Map()
          newChat.set("id", msg.chatId)
          newChat.set("agentId", msg.agentId)
          newChat.set("agentName", msg.agentName)
          newChat.set("messages", new Y.Array())
          newChat.set("isGenerating", false)
          aiChatsMap.set(msg.chatId, newChat)
          chatMap = newChat
        }, "server")
      } else {
        // Chat map exists but may be missing required fields (skeleton from client)
        const cm = chatMap as Y.Map<unknown>
        room.doc.transact(() => {
          if (!cm.get("id")) cm.set("id", msg.chatId)
          if (!cm.get("agentId")) cm.set("agentId", msg.agentId)
          if (!cm.get("agentName")) cm.set("agentName", msg.agentName)
          if (!cm.get("messages")) cm.set("messages", new Y.Array())
          if (cm.get("isGenerating") === undefined) cm.set("isGenerating", false)
        }, "server")
      }

      const messagesArr = (chatMap as Y.Map<unknown>).get("messages") as Y.Array<unknown>
      if (!messagesArr) return

      // Add the user message to Yjs
      room.doc.transact(() => {
        messagesArr.push([{
          id: msg.messageId,
          role: "user",
          content: msg.content,
          timestamp: new Date().toISOString(),
          userId: msg.userId,
          userName: msg.userName,
        }])
        ;(chatMap as Y.Map<unknown>).set("isGenerating", true)
      }, "server")

      // Gather current file contents from the Yjs doc
      const filesMap = room.doc.getMap("files")
      const fileContents = new Map<string, string>()
      filesMap.forEach((value: unknown, key: string) => {
        if (value instanceof Y.Text) {
          fileContents.set(key, value.toString())
        }
      })

      // Build chat history from Yjs messages array
      const chatHistory: ChatMessage[] = []
      const messagesArray = messagesArr.toArray() as Array<Record<string, unknown>>
      for (const m of messagesArray) {
        if (m.role === "user" || m.role === "assistant") {
          chatHistory.push({
            role: m.role as "user" | "assistant",
            content: m.content as string,
            operations: m.operations as FileOperation[] | undefined,
          })
        }
      }

      // Create the assistant message placeholder
      const assistantMsgId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      try {
        // Stream the response — send text chunks to all clients via socket
        const result = await streamAIChat({
          userMessage: msg.content,
          files: fileContents,
          chatHistory: chatHistory.slice(0, -1), // exclude the just-added user message (it's the prompt)
          agentInstructions: msg.agentInstructions,
          onTextChunk: (chunk: string) => {
            // Broadcast streaming chunk to room
            room.io?.to(roomName).emit("ai-chat-stream", {
              chatId: msg.chatId,
              messageId: assistantMsgId,
              chunk,
            })
          },
        })

        // Signal streaming complete to clients
        room.io?.to(roomName).emit("ai-chat-stream", {
          chatId: msg.chatId,
          messageId: assistantMsgId,
          chunk: "",
          done: true,
        })

        // Add the full assistant message with operations to Yjs
        const opStatuses = result.operations.map(() => "pending" as const)

        room.doc.transact(() => {
          messagesArr.push([{
            id: assistantMsgId,
            role: "assistant",
            content: result.message,
            operations: result.operations,
            operationStatuses: opStatuses,
            timestamp: new Date().toISOString(),
          }])
          ;(chatMap as Y.Map<unknown>).set("isGenerating", false)
          // Update chat name if AI suggested one (typically on first response)
          if (result.suggestedChatName) {
            ;(chatMap as Y.Map<unknown>).set("name", result.suggestedChatName)
          }
        }, "server")

      } catch (err) {
        console.error(`[iTECify] AI chat error:`, err)

        // Add error message
        room.doc.transact(() => {
          messagesArr.push([{
            id: assistantMsgId,
            role: "assistant",
            content: `Error: ${(err as Error).message || "AI request failed. Please try again."}`,
            operations: [],
            operationStatuses: [],
            timestamp: new Date().toISOString(),
          }])
          ;(chatMap as Y.Map<unknown>).set("isGenerating", false)
        }, "server")
      }
    })

    // ── AI operation accept/reject ─────────────────────────────────────
    socket.on("ai-operation-action", (msg: {
      chatId: string
      messageId: string
      operationIndex: number
      action: "accept" | "reject"
    }) => {
      if (!currentRoom || !currentProjectId) return
      const room = currentRoom

      const aiChatsMap = room.doc.getMap("aiChats")
      const chatMap = aiChatsMap.get(msg.chatId) as Y.Map<unknown> | undefined
      if (!chatMap) return

      const messagesArr = chatMap.get("messages") as Y.Array<unknown>
      if (!messagesArr) return

      // Find the message and update its operation status
      const messages = messagesArr.toArray() as Array<Record<string, unknown>>
      const msgIndex = messages.findIndex(m => m.id === msg.messageId)
      if (msgIndex === -1) return

      const message = messages[msgIndex]
      const operations = message.operations as Array<Record<string, unknown>> | undefined
      const statuses = (message.operationStatuses as string[]) || []

      if (!operations || msg.operationIndex >= operations.length) return

      // Update status
      const newStatuses = [...statuses]
      newStatuses[msg.operationIndex] = msg.action === "accept" ? "accepted" : "rejected"

      // If accepting, apply the operation to the files
      if (msg.action === "accept") {
        const op = operations[msg.operationIndex]
        const filesMap = room.doc.getMap("files")

        room.doc.transact(() => {
          if (op.type === "create" || op.type === "update") {
            const path = op.path as string
            const content = (op.content as string) || ""
            let ytext = filesMap.get(path)
            if (ytext instanceof Y.Text) {
              // Update existing file
              ytext.delete(0, ytext.length)
              ytext.insert(0, content)
            } else {
              // Create new file
              const newText = new Y.Text()
              newText.insert(0, content)
              filesMap.set(path, newText)
            }
          } else if (op.type === "delete") {
            filesMap.delete(op.path as string)
          }
        }, "server")
      }

      // Update the message in Yjs
      room.doc.transact(() => {
        // We need to replace the message in the array
        // Y.Array doesn't support in-place update, so we delete and re-insert
        const updatedMsg = { ...message, operationStatuses: newStatuses }
        messagesArr.delete(msgIndex, 1)
        messagesArr.insert(msgIndex, [updatedMsg])
      }, "server")
    })

    // ── AI bulk accept/reject all operations ───────────────────────────
    socket.on("ai-bulk-action", (msg: {
      chatId: string
      messageId: string
      action: "accept" | "reject"
    }) => {
      if (!currentRoom || !currentProjectId) return
      const room = currentRoom

      const aiChatsMap = room.doc.getMap("aiChats")
      const chatMap = aiChatsMap.get(msg.chatId) as Y.Map<unknown> | undefined
      if (!chatMap) return

      const messagesArr = chatMap.get("messages") as Y.Array<unknown>
      if (!messagesArr) return

      const messages = messagesArr.toArray() as Array<Record<string, unknown>>
      const msgIndex = messages.findIndex(m => m.id === msg.messageId)
      if (msgIndex === -1) return

      const message = messages[msgIndex]
      const operations = message.operations as Array<Record<string, unknown>> | undefined
      if (!operations) return

      const filesMap = room.doc.getMap("files")
      const newStatuses = operations.map(() => msg.action === "accept" ? "accepted" : "rejected")

      room.doc.transact(() => {
        // Apply all operations if accepting
        if (msg.action === "accept") {
          for (const op of operations) {
            if (op.type === "create" || op.type === "update") {
              const path = op.path as string
              const content = (op.content as string) || ""
              let ytext = filesMap.get(path)
              if (ytext instanceof Y.Text) {
                ytext.delete(0, ytext.length)
                ytext.insert(0, content)
              } else {
                const newText = new Y.Text()
                newText.insert(0, content)
                filesMap.set(path, newText)
              }
            } else if (op.type === "delete") {
              filesMap.delete(op.path as string)
            }
          }
        }

        // Update the message
        const updatedMsg = { ...message, operationStatuses: newStatuses }
        messagesArr.delete(msgIndex, 1)
        messagesArr.insert(msgIndex, [updatedMsg])
      }, "server")
    })

    // ── AI merge conflict resolution ───────────────────────────────────
    socket.on("ai-merge", async (msg: {
      chatId: string
      filePath: string
      originalContent: string
      versionA: string
      versionB: string
      contextA: string
      contextB: string
    }) => {
      if (!currentRoom || !currentProjectId) return
      const roomName = `project:${currentProjectId}`

      try {
        const result = await mergeWithAI({
          filePath: msg.filePath,
          originalContent: msg.originalContent,
          versionA: msg.versionA,
          versionB: msg.versionB,
          contextA: msg.contextA,
          contextB: msg.contextB,
        })

        // Send merge result back to room
        currentRoom.io?.to(roomName).emit("ai-merge-result", {
          chatId: msg.chatId,
          filePath: msg.filePath,
          merged: result.merged,
          explanation: result.explanation,
        })
      } catch (err) {
        currentRoom.io?.to(roomName).emit("ai-merge-result", {
          chatId: msg.chatId,
          filePath: msg.filePath,
          merged: null,
          explanation: `Merge failed: ${(err as Error).message}`,
        })
      }
    })

    // ── Rename AI chat ─────────────────────────────────────────────────
    socket.on("rename-chat", (msg: { chatId: string; name: string }) => {
      if (!currentRoom || !currentProjectId) return
      const room = currentRoom
      const aiChatsMap = room.doc.getMap("aiChats")
      const chatMap = aiChatsMap.get(msg.chatId) as Y.Map<unknown> | undefined
      if (!chatMap) return
      room.doc.transact(() => {
        chatMap.set("name", msg.name)
      }, "server")
    })

    // ── Delete AI chat ─────────────────────────────────────────────────
    socket.on("delete-chat", (msg: { chatId: string }) => {
      if (!currentRoom || !currentProjectId) return
      const room = currentRoom
      const aiChatsMap = room.doc.getMap("aiChats")
      room.doc.transact(() => {
        aiChatsMap.delete(msg.chatId)
      }, "server")
    })

    // ── Create AI agent ────────────────────────────────────────────────
    socket.on("create-agent", (msg: {
      id: string
      name: string
      persona: string
      systemPrompt: string
      color: string
      userId: string
    }) => {
      if (!currentRoom || !currentProjectId) return
      const room = currentRoom

      const agentsMap = room.doc.getMap("agents")
      room.doc.transact(() => {
        const agentMap = new Y.Map()
        agentMap.set("id", msg.id)
        agentMap.set("name", msg.name)
        agentMap.set("persona", msg.persona)
        agentMap.set("systemPrompt", msg.systemPrompt)
        agentMap.set("color", msg.color)
        agentMap.set("isActive", true)
        agentMap.set("createdById", msg.userId)
        agentsMap.set(msg.id, agentMap)
      }, "server")
    })

    // ── Update AI agent ────────────────────────────────────────────────
    socket.on("update-agent", (msg: {
      id: string
      name?: string
      persona?: string
      systemPrompt?: string
      color?: string
      isActive?: boolean
    }) => {
      if (!currentRoom || !currentProjectId) return
      const room = currentRoom

      const agentsMap = room.doc.getMap("agents")
      const agentMap = agentsMap.get(msg.id)
      if (!agentMap || !(agentMap instanceof Y.Map)) return

      room.doc.transact(() => {
        if (msg.name !== undefined) agentMap.set("name", msg.name)
        if (msg.persona !== undefined) agentMap.set("persona", msg.persona)
        if (msg.systemPrompt !== undefined) agentMap.set("systemPrompt", msg.systemPrompt)
        if (msg.color !== undefined) agentMap.set("color", msg.color)
        if (msg.isActive !== undefined) agentMap.set("isActive", msg.isActive)
      }, "server")
    })

    // ── Delete AI agent ────────────────────────────────────────────────
    socket.on("delete-agent", (msg: { id: string }) => {
      if (!currentRoom || !currentProjectId) return
      const room = currentRoom

      const agentsMap = room.doc.getMap("agents")
      room.doc.transact(() => {
        agentsMap.delete(msg.id)
        // Also delete associated chat sessions
        const aiChatsMap = room.doc.getMap("aiChats")
        const keysToDelete: string[] = []
        aiChatsMap.forEach((value: unknown, key: string) => {
          if (value instanceof Y.Map && value.get("agentId") === msg.id) {
            keysToDelete.push(key)
          }
        })
        for (const key of keysToDelete) {
          aiChatsMap.delete(key)
        }
      }, "server")
    })

    // ── Snapshot broadcast (time-travel sync across clients) ──────────
    socket.on("snapshot-created", (msg: {
      snapshot: {
        id: string
        projectId: string
        createdAt: string
        label: string | null
        changeCount: number
        userId: string
        kind: string
        promptSummary?: string
        filePath?: string
        fileStates?: Record<string, string>
        userName?: string
      }
    }) => {
      if (!currentProjectId) return
      const roomName = `project:${currentProjectId}`
      // Broadcast to all OTHER clients in the room so their timelines stay in sync
      socket.to(roomName).emit("snapshot-created", msg)
    })

    // ── Disconnect ──
    socket.on("disconnect", () => {
      if (currentProjectId && currentRoom) {
        leaveRoom(socket, currentProjectId, currentRoom)
      }
    })
  })
}

function leaveRoom(socket: Socket, projectId: string, room: ProjectRoom) {
  const roomName = `project:${projectId}`
  const user = room.users.get(socket.id)

  // Remove the client's awareness state using their Yjs clientID (not the server's)
  if (user?.yjsClientId != null) {
    awarenessProtocol.removeAwarenessStates(room.awareness, [user.yjsClientId], null)
  }

  room.users.delete(socket.id)
  socket.leave(roomName)

  if (user) {
    socket.to(roomName).emit("user-left", {
      socketId: socket.id,
      userId: user.userId,
    })
  }

  // Save a snapshot when a user leaves (if there were changes)
  if (room.lastChangeAt > room.lastSnapshotAt) {
    saveSnapshot(projectId, room)
  }

  // If all users left, schedule Docker container cleanup
  if (room.users.size === 0) {
    setTimeout(() => {
      const currentRoom = rooms.get(projectId)
      if (currentRoom && currentRoom.users.size === 0) {
        destroyContainer(projectId).catch((err) => {
          console.warn(`[iTECify] Docker cleanup failed for ${projectId}:`, err)
        })
      }
    }, 5 * 60 * 1000) // Keep container alive 5 min after last user leaves
  }
}
