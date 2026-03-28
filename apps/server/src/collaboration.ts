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

// ─── Fake Terminal Responses ─────────────────────────────────────────────

const FAKE_RESPONSES: Record<string, string> = {
  help: "Available commands: help, ls, pwd, echo, whoami, date, clear, node, npm, git, cat",
  ls: "src/  node_modules/  package.json  tsconfig.json  README.md",
  pwd: "/home/itecify/workspace",
  whoami: "itecify-user",
  date: new Date().toUTCString(),
  clear: "",
  "node --version": "v22.11.0",
  "npm --version": "10.9.2",
  "git status": "On branch main\nnothing to commit, working tree clean",
  "git log --oneline": "a1b2c3d feat: initial commit\nd4e5f6g docs: add README",
  "npm run build": "> itecify@1.0.0 build\n> next build\n\n ✓ Compiled successfully\n ✓ Linting and checking validity\n ✓ Collecting page data\n ✓ Generating static pages\n ✓ Finalizing page optimization\n\nRoute (app)    Size     First Load JS\n┌ ○ /          5.2 kB   89.1 kB\n└ ○ /dashboard 3.1 kB   87.0 kB\n\n✓ Build completed in 4.2s",
  "npm test": "> itecify@1.0.0 test\n> jest\n\n PASS  src/__tests__/utils.test.ts\n PASS  src/__tests__/api.test.ts\n\nTest Suites: 2 passed, 2 total\nTests:       12 passed, 12 total\nTime:        1.847s",
  "npm install": "added 0 packages, audited 847 packages in 2s\n\n0 vulnerabilities",
}

function getFakeResponse(input: string): string {
  const trimmed = input.trim().toLowerCase()

  // Direct match
  if (FAKE_RESPONSES[trimmed] !== undefined) return FAKE_RESPONSES[trimmed]

  // echo command
  if (trimmed.startsWith("echo ")) return input.trim().slice(5)

  // cat command
  if (trimmed.startsWith("cat ")) {
    const file = trimmed.slice(4).trim()
    return `cat: ${file}: simulated file contents would appear here`
  }

  // Fallback
  return `command not found: ${input.trim().split(" ")[0]}\nTry 'help' for available commands.`
}

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
 */
const loadedRooms = new Set<string>()
async function ensureSnapshotLoaded(projectId: string, room: ProjectRoom) {
  if (loadedRooms.has(projectId)) return
  loadedRooms.add(projectId)
  try {
    const snapshot = await loadLatestSnapshot(projectId)
    if (snapshot && snapshot.byteLength > 0) {
      Y.applyUpdate(room.doc, snapshot)
      console.log(`[iTECify] Loaded snapshot for ${projectId} (${snapshot.byteLength} bytes)`)
    } else {
      console.log(`[iTECify] No snapshot found for ${projectId} — starting fresh`)
    }
  } catch (err) {
    console.error(`[iTECify] Failed to load snapshot for ${projectId}:`, err)
  }
}

// ─── Snapshot Saving ─────────────────────────────────────────────────────

interface SnapshotStore {
  save: (projectId: string, blob: Uint8Array, userId: string) => Promise<void>
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
    await snapshotStore.save(projectId, blob, userId)
    room.lastSnapshotAt = Date.now()
    console.log(`[iTECify] Snapshot saved for ${projectId} (${blob.byteLength} bytes)`)
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

    // ── Terminal input (multi-session) ──
    socket.on("terminal-input", (msg: { sessionId: string; content: string; userId: string }) => {
      if (!currentRoom || !currentProjectId) return

      const terminalsMap = currentRoom.doc.getMap("terminals")
      const sessionMap = terminalsMap.get(msg.sessionId)
      if (!sessionMap || !(sessionMap instanceof Y.Map)) return

      const linesArr = sessionMap.get("lines")
      if (!linesArr || !(linesArr instanceof Y.Array)) return

      const stdinLine = {
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "stdin" as const,
        content: msg.content,
        timestamp: new Date().toISOString(),
        userId: msg.userId,
      }

      const response = getFakeResponse(msg.content)

      currentRoom.doc.transact(() => {
        linesArr.push([stdinLine])

        if (response) {
          linesArr.push([{
            id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: "stdout" as const,
            content: response,
            timestamp: new Date().toISOString(),
          }])
        }

        // Clear the shared input Y.Text after command submission
        const inputText = sessionMap.get("input")
        if (inputText instanceof Y.Text && inputText.length > 0) {
          inputText.delete(0, inputText.length)
        }
      }, "server")
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
}
