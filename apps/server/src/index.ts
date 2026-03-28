// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Real-Time Collaboration Server
// Express + Socket.IO + Yjs CRDT
// ═══════════════════════════════════════════════════════════════════════════

import "dotenv/config"
import express from "express"
import { createServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import cors from "cors"
import { setupCollaboration, setSnapshotStore } from "./collaboration.js"
import { saveSnapshotToDB } from "./snapshot-store.js"

const PORT = parseInt(process.env.PORT || "4000", 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000"

const app = express()
app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
app.use(express.json())

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() })
})

const httpServer = createServer(app)

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    credentials: true,
  },
  // Allow large payloads for Yjs state vectors
  maxHttpBufferSize: 5e6,
})

// Set up the collaboration rooms
setSnapshotStore({
  save: saveSnapshotToDB,
})
setupCollaboration(io)

httpServer.listen(PORT, () => {
  console.log(`[iTECify] Collaboration server running on port ${PORT}`)
  console.log(`[iTECify] CORS origin: ${CORS_ORIGIN}`)
})
