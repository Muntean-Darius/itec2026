// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Docker Manager
// Manages one Docker container per workspace (project). Each terminal session
// creates a separate exec (shell) inside the container. Files are synced
// bidirectionally between the Yjs doc and the container filesystem.
//
// DigitalOcean connection: set DOCKER_HOST, DOCKER_PORT, DOCKER_CA,
// DOCKER_CERT, DOCKER_KEY env vars. Falls back to local Docker socket.
// ═══════════════════════════════════════════════════════════════════════════

import Docker from "dockerode"
import { PassThrough } from "node:stream"
import * as fs from "node:fs"
import * as path from "node:path"

// ─── Docker Client ───────────────────────────────────────────────────────

const DOCKER_HOST = process.env.DOCKER_HOST || undefined  // e.g. "your-droplet.digitalocean.com"
const DOCKER_PORT = process.env.DOCKER_PORT ? parseInt(process.env.DOCKER_PORT, 10) : 2376

// Certs can be provided as env vars (PEM string) or as file paths
const DOCKER_CA = process.env.DOCKER_CA || undefined
const DOCKER_CERT = process.env.DOCKER_CERT || undefined
const DOCKER_KEY = process.env.DOCKER_KEY || undefined
const DOCKER_CA_FILE = process.env.DOCKER_CA_FILE || undefined
const DOCKER_CERT_FILE = process.env.DOCKER_CERT_FILE || undefined
const DOCKER_KEY_FILE = process.env.DOCKER_KEY_FILE || undefined

// Base image used for workspace containers
const WORKSPACE_IMAGE = process.env.WORKSPACE_IMAGE || "node:22-slim"

// Working directory inside the container
const CONTAINER_WORKDIR = "/home/itecify/workspace"

/** Read a PEM cert from env var or file path, normalizing escaped newlines */
function readCert(envValue: string | undefined, filePath: string | undefined): string | undefined {
  if (filePath) {
    try { return fs.readFileSync(path.resolve(filePath), "utf-8") } catch { /* fall through */ }
  }
  if (envValue) {
    // dotenv may encode literal \n — restore real newlines
    return envValue.replace(/\\n/g, "\n")
  }
  return undefined
}

function createDockerClient(): Docker {
  const ca = readCert(DOCKER_CA, DOCKER_CA_FILE)
  const cert = readCert(DOCKER_CERT, DOCKER_CERT_FILE)
  const key = readCert(DOCKER_KEY, DOCKER_KEY_FILE)

  if (DOCKER_HOST && ca && cert && key) {
    // Remote Docker host over TLS (DigitalOcean Droplet)
    console.log(`[iTECify Docker] Connecting to remote Docker host ${DOCKER_HOST}:${DOCKER_PORT} over TLS`)
    return new Docker({
      host: DOCKER_HOST,
      port: DOCKER_PORT,
      protocol: "https",
      ca,
      cert,
      key,
    })
  }
  // Local Docker socket fallback (dev)
  console.log("[iTECify Docker] Using local Docker socket")
  return new Docker()
}

const docker = createDockerClient()

// ─── Types ───────────────────────────────────────────────────────────────

export type ContainerStatus = "creating" | "ready" | "error" | "destroyed"

export interface ContainerStatusInfo {
  status: ContainerStatus
  error?: string
}

export interface ContainerStats {
  cpuPercent: number
  memoryUsageMB: number
  memoryLimitMB: number
  memoryPercent: number
}

interface WorkspaceContainer {
  containerId: string
  container: Docker.Container
  status: ContainerStatus
  errorMessage?: string
  /** Active exec sessions: terminalSessionId → exec stream */
  execSessions: Map<string, ExecSession>
  /** Stats polling interval */
  statsInterval: ReturnType<typeof setInterval> | null
  lastStats: ContainerStats | null
}

interface ExecSession {
  exec: Docker.Exec
  stream: NodeJS.ReadWriteStream
  /** Whether the shell is still alive */
  alive: boolean
}

// projectId → WorkspaceContainer
const containers = new Map<string, WorkspaceContainer>()

// Listeners for status changes
type StatusListener = (projectId: string, info: ContainerStatusInfo) => void
const statusListeners = new Set<StatusListener>()

export function onContainerStatus(listener: StatusListener): () => void {
  statusListeners.add(listener)
  return () => { statusListeners.delete(listener) }
}

function emitStatus(projectId: string, status: ContainerStatus, error?: string) {
  for (const listener of statusListeners) {
    listener(projectId, { status, error })
  }
}

// Listeners for stats updates
type StatsListener = (projectId: string, stats: ContainerStats) => void
const statsListeners = new Set<StatsListener>()

export function onContainerStats(listener: StatsListener): () => void {
  statsListeners.add(listener)
  return () => { statsListeners.delete(listener) }
}

function emitStats(projectId: string, stats: ContainerStats) {
  for (const listener of statsListeners) {
    listener(projectId, stats)
  }
}

/**
 * Get the most recent container stats (cached from polling).
 */
export function getContainerStats(projectId: string): ContainerStats | null {
  return containers.get(projectId)?.lastStats ?? null
}

/**
 * Get current container status info for a project.
 */
export function getContainerStatusInfo(projectId: string): ContainerStatusInfo | null {
  const entry = containers.get(projectId)
  if (!entry) return null
  return { status: entry.status, error: entry.errorMessage }
}

// ─── Container Lifecycle ─────────────────────────────────────────────────

/**
 * Create and start a Docker container for a workspace.
 * Called when a user first joins a project room.
 * Files from the Yjs doc are written into the container once ready.
 */
export async function ensureContainer(
  projectId: string,
  files: Map<string, string>,
): Promise<void> {
  // Already exists or in progress
  if (containers.has(projectId)) return

  const entry: WorkspaceContainer = {
    containerId: "",
    container: null as unknown as Docker.Container,
    status: "creating",
    execSessions: new Map(),
    statsInterval: null,
    lastStats: null,
  }
  containers.set(projectId, entry)
  emitStatus(projectId, "creating")

  try {
    // Pull image if not available (ignore errors — image may already exist)
    try {
      const pullStream = await docker.pull(WORKSPACE_IMAGE)
      await new Promise<void>((resolve, reject) => {
        docker.modem.followProgress(pullStream, (err: Error | null) => {
          if (err) reject(err)
          else resolve()
        })
      })
    } catch {
      // Image may already be present locally
    }

    // Create container
    const container = await docker.createContainer({
      Image: WORKSPACE_IMAGE,
      Cmd: ["sleep", "infinity"], // Keep container alive
      WorkingDir: CONTAINER_WORKDIR,
      Tty: false,
      OpenStdin: true,
      Labels: {
        "itecify.project": projectId,
      },
      HostConfig: {
        // Limit resources per container
        Memory: 512 * 1024 * 1024,   // 512 MB
        NanoCpus: 1_000_000_000,     // 1 CPU
      },
    })

    await container.start()

    entry.containerId = container.id
    entry.container = container

    // Write initial files into the container
    await syncFilesToContainer(projectId, files)

    entry.status = "ready"
    emitStatus(projectId, "ready")
    console.log(`[iTECify Docker] Container started for project ${projectId}: ${container.id.slice(0, 12)}`)

    // Start stats polling
    startStatsPolling(projectId, entry)
  } catch (err) {
    const errorMsg = (err as Error).message || "Unknown error"
    console.error(`[iTECify Docker] Failed to create container for ${projectId}:`, err)
    entry.status = "error"
    entry.errorMessage = errorMsg
    emitStatus(projectId, "error", errorMsg)
  }
}

// ─── Stats Polling ───────────────────────────────────────────────────────

function startStatsPolling(projectId: string, entry: WorkspaceContainer) {
  if (entry.statsInterval) return

  async function pollOnce() {
    if (entry.status !== "ready" || !entry.container) return
    try {
      const rawStats = await entry.container.stats({ stream: false }) as Docker.ContainerStats
      const stats = calculateStats(rawStats)
      entry.lastStats = stats
      emitStats(projectId, stats)
    } catch (err) {
      console.warn(`[iTECify Docker] Stats polling failed for ${projectId}:`, (err as Error).message)
    }
  }

  // Poll immediately, then every 5 seconds
  pollOnce()
  entry.statsInterval = setInterval(pollOnce, 5_000)
}

function calculateStats(raw: Docker.ContainerStats): ContainerStats {
  // CPU calculation
  const cpuDelta = raw.cpu_stats.cpu_usage.total_usage - (raw.precpu_stats.cpu_usage?.total_usage ?? 0)
  const systemDelta = (raw.cpu_stats.system_cpu_usage ?? 0) - (raw.precpu_stats.system_cpu_usage ?? 0)
  const numCpus = raw.cpu_stats.online_cpus ?? raw.cpu_stats.cpu_usage.percpu_usage?.length ?? 1
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0

  // Memory calculation
  const memUsage = raw.memory_stats.usage ?? 0
  const memCache = raw.memory_stats.stats?.cache ?? 0
  const memActual = memUsage - memCache
  const memLimit = raw.memory_stats.limit ?? 1
  const memoryUsageMB = Math.round(memActual / (1024 * 1024) * 10) / 10
  const memoryLimitMB = Math.round(memLimit / (1024 * 1024) * 10) / 10
  const memoryPercent = memLimit > 0 ? (memActual / memLimit) * 100 : 0

  return {
    cpuPercent: Math.round((cpuPercent || 0) * 10) / 10,
    memoryUsageMB: memoryUsageMB || 0,
    memoryLimitMB: memoryLimitMB || 0,
    memoryPercent: Math.round((memoryPercent || 0) * 10) / 10,
  }
}

/**
 * Destroy the container for a project (cleanup).
 */
export async function destroyContainer(projectId: string): Promise<void> {
  const entry = containers.get(projectId)
  if (!entry) return

  // Stop file sync
  stopFileSync(projectId)

  // Kill all exec sessions
  for (const [, execSession] of entry.execSessions) {
    execSession.alive = false
    try { execSession.stream.end() } catch { /* ignore */ }
  }
  entry.execSessions.clear()

  // Stop stats polling
  if (entry.statsInterval) {
    clearInterval(entry.statsInterval)
    entry.statsInterval = null
  }

  try {
    await entry.container.stop({ t: 2 })
  } catch { /* may already be stopped */ }

  try {
    await entry.container.remove({ force: true })
  } catch { /* ignore */ }

  entry.status = "destroyed"
  containers.delete(projectId)
  emitStatus(projectId, "destroyed")
  console.log(`[iTECify Docker] Container destroyed for project ${projectId}`)
}

// ─── File Sync ───────────────────────────────────────────────────────────

/**
 * Write files from the Yjs doc into the container filesystem.
 * Uses `docker exec` to write files via shell commands.
 */
export async function syncFilesToContainer(
  projectId: string,
  files: Map<string, string>,
): Promise<void> {
  const entry = containers.get(projectId)
  if (!entry || entry.status !== "ready" && entry.status !== "creating") return

  for (const [filePath, content] of files) {
    try {
      // Ensure parent directory exists
      const dir = filePath.substring(0, filePath.lastIndexOf("/")) || "."
      await execInContainer(entry, ["mkdir", "-p", `${CONTAINER_WORKDIR}/${dir}`])

      // Write file content using base64 to avoid shell escaping issues
      const b64 = Buffer.from(content, "utf-8").toString("base64")
      await execInContainer(entry, [
        "sh", "-c",
        `echo '${b64}' | base64 -d > ${CONTAINER_WORKDIR}/${filePath}`,
      ])
    } catch (err) {
      console.warn(`[iTECify Docker] Failed to write ${filePath} to container:`, err)
    }
  }
}

/**
 * Read all files from the container workspace back into a Map.
 * Used after commands execute to detect file changes.
 */
export async function readFilesFromContainer(
  projectId: string,
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const entry = containers.get(projectId)
  if (!entry || entry.status !== "ready") return result

  try {
    // List all files recursively
    const listOutput = await execInContainer(entry, [
      "find", CONTAINER_WORKDIR, "-type", "f",
      "-not", "-path", "*/node_modules/*",
      "-not", "-path", "*/.git/*",
    ])

    const paths = listOutput
      .split("\n")
      .map(p => p.trim())
      .filter(p => p.startsWith(CONTAINER_WORKDIR + "/"))

    for (const absPath of paths) {
      const relPath = absPath.slice(CONTAINER_WORKDIR.length + 1)
      if (!relPath) continue
      try {
        const content = await execInContainer(entry, ["cat", absPath])
        result.set(relPath, content)
      } catch {
        // skip unreadable files
      }
    }
  } catch (err) {
    console.warn(`[iTECify Docker] Failed to read files from container:`, err)
  }

  return result
}

/**
 * Run a command in the container and return stdout as a string.
 * (Utility, not a terminal session — used for file sync.)
 */
async function execInContainer(
  entry: WorkspaceContainer,
  cmd: string[],
): Promise<string> {
  const exec = await entry.container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
  })

  const stream = await exec.start({ hijack: true, stdin: false })
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    const stdout = new PassThrough()
    const stderr = new PassThrough()

    docker.modem.demuxStream(stream, stdout, stderr)

    stdout.on("data", (chunk: Buffer) => chunks.push(chunk))
    stderr.on("data", (chunk: Buffer) => chunks.push(chunk))

    stream.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf-8").trimEnd())
    })
    stream.on("error", reject)
  })
}

// ─── Terminal Exec Sessions ──────────────────────────────────────────────

export interface ExecCommandResult {
  output: string
  exitCode: number | null
}

/**
 * Execute a single command in the container for a terminal session.
 * Returns the combined stdout+stderr output.
 */
export async function executeCommand(
  projectId: string,
  terminalSessionId: string,
  command: string,
): Promise<ExecCommandResult> {
  const entry = containers.get(projectId)
  if (!entry || entry.status !== "ready") {
    return {
      output: entry?.status === "creating"
        ? "⏳ Docker instance is starting up, please wait..."
        : "❌ Docker instance is not available.",
      exitCode: 1,
    }
  }

  try {
    const exec = await entry.container.exec({
      Cmd: ["sh", "-c", command],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: CONTAINER_WORKDIR,
    })

    const stream = await exec.start({ hijack: true, stdin: false })

    const output = await new Promise<string>((resolve, reject) => {
      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []
      const stdout = new PassThrough()
      const stderr = new PassThrough()

      docker.modem.demuxStream(stream, stdout, stderr)

      stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk))
      stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk))

      stream.on("end", () => {
        const out = Buffer.concat(stdoutChunks).toString("utf-8")
        const err = Buffer.concat(stderrChunks).toString("utf-8")
        resolve((out + err).trimEnd())
      })
      stream.on("error", reject)

      // Safety timeout — kill after 30 seconds
      setTimeout(() => {
        try { stream.destroy() } catch { /* ignore */ }
        resolve(Buffer.concat(stdoutChunks).toString("utf-8").trimEnd() + "\n[Process timed out after 30s]")
      }, 30_000)
    })

    // Get exit code
    const inspectResult = await exec.inspect()
    const exitCode = inspectResult.ExitCode ?? null

    return { output, exitCode }
  } catch (err) {
    console.error(`[iTECify Docker] Exec failed for ${projectId}/${terminalSessionId}:`, err)
    return {
      output: `Error executing command: ${(err as Error).message}`,
      exitCode: 1,
    }
  }
}

// ─── Bidirectional File Sync Manager ─────────────────────────────────────

/** Callbacks for the sync manager to interact with the Yjs doc */
export interface FileSyncCallbacks {
  /** Read current files from Yjs */
  getFiles: () => Map<string, string>
  /** Apply container changes to Yjs (additive merge — never deletes Yjs-only files) */
  applyContainerChanges: (containerFiles: Map<string, string>) => void
}

interface FileSyncState {
  interval: ReturnType<typeof setInterval> | null
  callbacks: FileSyncCallbacks
  /** Snapshot of Yjs file contents from last sync (used to detect editor changes) */
  lastSyncedToContainer: Map<string, string>
  /** Snapshot of container file contents from last sync (used to detect container changes) */
  lastSyncedFromContainer: Map<string, string>
  /** Whether a sync cycle is currently running */
  syncing: boolean
}

const fileSyncStates = new Map<string, FileSyncState>()

/** Sync interval in ms */
const FILE_SYNC_INTERVAL = 2_000

/**
 * Start bidirectional file sync for a project.
 * - Periodically pushes Yjs changes → container
 * - Periodically pulls container changes → Yjs
 * - Smart merge: only syncs actual changes, never destructively replaces
 */
export function startFileSync(
  projectId: string,
  callbacks: FileSyncCallbacks,
): void {
  // Don't double-start
  if (fileSyncStates.has(projectId)) return

  const state: FileSyncState = {
    interval: null,
    callbacks,
    lastSyncedToContainer: new Map(),
    lastSyncedFromContainer: new Map(),
    syncing: false,
  }
  fileSyncStates.set(projectId, state)

  // Initialize the "last synced" snapshots from current Yjs state
  const currentFiles = callbacks.getFiles()
  for (const [path, content] of currentFiles) {
    state.lastSyncedToContainer.set(path, content)
  }

  // Start the interval
  state.interval = setInterval(() => {
    runSyncCycle(projectId).catch((err) => {
      console.warn(`[iTECify Sync] Interval sync failed for ${projectId}:`, (err as Error).message)
    })
  }, FILE_SYNC_INTERVAL)

  console.log(`[iTECify Sync] Started bidirectional file sync for ${projectId} (every ${FILE_SYNC_INTERVAL}ms)`)
}

/**
 * Stop file sync for a project.
 */
export function stopFileSync(projectId: string): void {
  const state = fileSyncStates.get(projectId)
  if (!state) return

  if (state.interval) {
    clearInterval(state.interval)
    state.interval = null
  }
  fileSyncStates.delete(projectId)
  console.log(`[iTECify Sync] Stopped file sync for ${projectId}`)
}

/**
 * Run a single sync cycle: push editor changes to container, pull container changes back.
 */
async function runSyncCycle(projectId: string): Promise<void> {
  const state = fileSyncStates.get(projectId)
  if (!state || state.syncing) return

  const entry = containers.get(projectId)
  if (!entry || entry.status !== "ready") return

  state.syncing = true
  try {
    // 1. Push Yjs changes → container
    const currentFiles = state.callbacks.getFiles()
    const filesToWrite = new Map<string, string>()

    for (const [filePath, content] of currentFiles) {
      const lastSynced = state.lastSyncedToContainer.get(filePath)
      if (lastSynced === undefined || lastSynced !== content) {
        // New file or content changed in editor since last sync
        filesToWrite.set(filePath, content)
      }
    }

    // Detect files deleted in Yjs (existed in last sync but gone now)
    for (const [filePath] of state.lastSyncedToContainer) {
      if (!currentFiles.has(filePath)) {
        // File was deleted in editor — delete from container
        try {
          await execInContainer(entry, ["rm", "-f", `${CONTAINER_WORKDIR}/${filePath}`])
        } catch { /* ignore */ }
      }
    }

    // Write changed files to container
    if (filesToWrite.size > 0) {
      await syncFilesToContainer(projectId, filesToWrite)
    }

    // Update "last synced to container" snapshot
    state.lastSyncedToContainer = new Map(currentFiles)

    // 2. Pull container changes → Yjs
    const containerFiles = await readFilesFromContainer(projectId)

    // Find files that changed in the container since last pull
    const changedFiles = new Map<string, string>()
    for (const [filePath, content] of containerFiles) {
      const lastFromContainer = state.lastSyncedFromContainer.get(filePath)
      const currentYjsContent = currentFiles.get(filePath)

      if (lastFromContainer === undefined && currentYjsContent === undefined) {
        // Brand new file created in container (not in Yjs) — add it
        changedFiles.set(filePath, content)
      } else if (lastFromContainer !== undefined && lastFromContainer !== content) {
        // File changed in container since last sync
        // Only apply if editor hasn't also changed it (editor wins for concurrent edits)
        const lastToContainer = state.lastSyncedToContainer.get(filePath)
        if (currentYjsContent === lastToContainer) {
          // Editor hasn't changed this file — safe to apply container changes
          changedFiles.set(filePath, content)
        }
        // else: both sides changed — editor wins, skip container version
      }
    }

    if (changedFiles.size > 0) {
      state.callbacks.applyContainerChanges(changedFiles)
    }

    // Update "last synced from container" snapshot
    state.lastSyncedFromContainer = new Map(containerFiles)
  } finally {
    state.syncing = false
  }
}

/**
 * Force a full Yjs → container sync. Called before executing a command
 * to ensure the container has the latest editor state.
 */
export async function syncBeforeCommand(projectId: string): Promise<void> {
  const state = fileSyncStates.get(projectId)
  const entry = containers.get(projectId)
  if (!entry || entry.status !== "ready") return

  // Get current Yjs files
  const getFiles = state?.callbacks.getFiles
  if (!getFiles) return

  const currentFiles = getFiles()
  await syncFilesToContainer(projectId, currentFiles)

  // Also delete container files that don't exist in Yjs
  try {
    const containerFiles = await readFilesFromContainer(projectId)
    for (const [filePath] of containerFiles) {
      if (!currentFiles.has(filePath)) {
        try {
          await execInContainer(entry, ["rm", "-f", `${CONTAINER_WORKDIR}/${filePath}`])
        } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }

  // Update snapshot
  if (state) {
    state.lastSyncedToContainer = new Map(currentFiles)
  }
}

/**
 * Force a container → Yjs sync after a command completes.
 * Uses additive merge: new/changed container files are applied to Yjs,
 * but files only in Yjs are preserved (not deleted).
 */
export async function syncAfterCommand(projectId: string): Promise<void> {
  const state = fileSyncStates.get(projectId)
  if (!state) return

  const entry = containers.get(projectId)
  if (!entry || entry.status !== "ready") return

  try {
    const containerFiles = await readFilesFromContainer(projectId)
    const currentFiles = state.callbacks.getFiles()

    // Apply all container file changes to Yjs
    const changedFiles = new Map<string, string>()
    for (const [filePath, content] of containerFiles) {
      const currentYjs = currentFiles.get(filePath)
      if (currentYjs === undefined || currentYjs !== content) {
        changedFiles.set(filePath, content)
      }
    }

    if (changedFiles.size > 0) {
      state.callbacks.applyContainerChanges(changedFiles)
    }

    // Update snapshots
    state.lastSyncedFromContainer = new Map(containerFiles)
    state.lastSyncedToContainer = new Map(state.callbacks.getFiles())
  } catch (err) {
    console.warn(`[iTECify Sync] Post-command sync failed for ${projectId}:`, (err as Error).message)
  }
}

// ─── Cleanup ─────────────────────────────────────────────────────────────

/**
 * Destroy all containers (graceful shutdown).
 */
export async function destroyAllContainers(): Promise<void> {
  const projectIds = Array.from(containers.keys())
  await Promise.all(projectIds.map(id => destroyContainer(id)))
}
