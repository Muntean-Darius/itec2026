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
import { PassThrough, Readable } from "node:stream"
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

/** Maximum execution time for a single command (seconds) */
const COMMAND_TIMEOUT_SECONDS = 30

/** Max number of processes allowed inside the container */
const MAX_PIDS = 256

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

    // Create container with security constraints
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
        PidsLimit: MAX_PIDS,         // Prevent fork bombs
        // Drop dangerous capabilities
        CapDrop: ["ALL"],
        // Add back only what we need
        CapAdd: ["CHOWN", "SETUID", "SETGID", "DAC_OVERRIDE", "FOWNER"],
        // No network for extra security (comment out if you need npm install etc.)
        // NetworkMode: "none",
        // Read-only root filesystem — only workspace is writable
        ReadonlyRootfs: false, // We need to write to /home/itecify/workspace
        // No privilege escalation
        SecurityOpt: ["no-new-privileges"],
      },
    })

    await container.start()

    entry.containerId = container.id
    entry.container = container

    // ── Sandbox hardening ──
    // 1. Create the workspace user & directory structure
    await execInContainer(entry, ["sh", "-c", [
      // Create the sandbox user if it doesn't exist
      "id itecify >/dev/null 2>&1 || adduser --disabled-password --gecos '' --home /home/itecify itecify",
      // Ensure workspace dir exists and is owned by itecify
      `mkdir -p ${CONTAINER_WORKDIR}`,
      `chown -R itecify:itecify /home/itecify`,
    ].join(" && ")])

    // 2. Install a safe rm wrapper that blocks deletion outside workspace
    await execInContainer(entry, ["sh", "-c", [
      // Move real rm aside
      "cp /bin/rm /bin/rm.real",
      // Write a safe wrapper
      `cat > /bin/rm << 'WRAPPER'
#!/bin/sh
# iTECify safe rm — only allows deletion inside the workspace
WORKSPACE="/home/itecify/workspace"
for arg in "$@"; do
  case "$arg" in -*) continue ;; esac
  # Resolve to absolute path
  resolved="$(cd "$(dirname "$arg" 2>/dev/null)" 2>/dev/null && pwd)/$(basename "$arg")"
  case "$resolved" in
    "$WORKSPACE"/*) ;; # OK — inside workspace
    *) echo "rm: cannot remove '$arg': Permission denied (outside sandbox)" >&2; exit 1 ;;
  esac
done
/bin/rm.real "$@"
WRAPPER`,
      "chmod +x /bin/rm",
    ].join("\n")])

    // 3. Protect critical system paths from the sandbox user
    await execInContainer(entry, ["sh", "-c", [
      // Make system dirs immutable for the itecify user (owned by root, no write)
      "chmod 755 /bin /usr /usr/bin /usr/local /sbin /etc /var /tmp",
      // The workspace itself should be writable
      `chmod 755 ${CONTAINER_WORKDIR}`,
    ].join(" && ")])

    // Write initial files into the container
    await syncFilesToContainer(projectId, files)

    // Ensure all files are owned by the sandbox user so terminal commands work
    try {
      await execInContainer(entry, ["chown", "-R", "itecify:itecify", CONTAINER_WORKDIR])
    } catch { /* non-critical */ }

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

/**
 * Reset the container for a project: destroy the old one & recreate it
 * with current file state. This is useful when the container is in a bad
 * state (e.g. corrupted npm install, broken environment).
 */
export async function resetContainer(
  projectId: string,
  files: Map<string, string>,
): Promise<void> {
  console.log(`[iTECify Docker] Resetting container for project ${projectId}`)

  // Stop file sync first
  stopFileSync(projectId)

  // Destroy existing container
  await destroyContainer(projectId)

  // Clear session cwds for this project
  for (const key of Array.from(sessionCwds.keys())) {
    if (key.startsWith(`${projectId}:`)) {
      sessionCwds.delete(key)
    }
  }

  // Re-create from scratch
  await ensureContainer(projectId, files)
}

// ─── Tar Archive Helpers ─────────────────────────────────────────────────

/**
 * Build a tar archive buffer containing all files.
 * Uses USTAR format so Docker putArchive can extract them directly.
 */
function buildTarBuffer(files: Map<string, string>): Buffer {
  const blocks: Buffer[] = []

  // Collect all parent directories that need entries
  const dirs = new Set<string>()
  for (const filePath of files.keys()) {
    const parts = filePath.split("/")
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join("/") + "/")
    }
  }

  // Write directory entries (sorted so parents come first)
  for (const dir of [...dirs].sort()) {
    blocks.push(buildTarHeader(dir, 0, "5", 0o755))
  }

  // Write file entries
  for (const [filePath, content] of files) {
    const data = Buffer.from(content, "utf-8")
    blocks.push(buildTarHeader(filePath, data.length, "0", 0o644))
    blocks.push(data)
    const remainder = data.length % 512
    if (remainder > 0) {
      blocks.push(Buffer.alloc(512 - remainder, 0))
    }
  }

  // End-of-archive marker: two 512-byte zero blocks
  blocks.push(Buffer.alloc(1024, 0))
  return Buffer.concat(blocks)
}

/**
 * Build a single USTAR tar header (512 bytes).
 */
function buildTarHeader(
  name: string,
  size: number,
  typeflag: string,
  mode: number,
): Buffer {
  const header = Buffer.alloc(512, 0)

  // Handle long paths using USTAR prefix field (prefix ≤155, name ≤100)
  let prefix = ""
  let shortName = name
  if (Buffer.byteLength(name, "utf-8") > 100) {
    const sepIdx = name.lastIndexOf("/", 99)
    if (sepIdx > 0) {
      prefix = name.substring(0, sepIdx)
      shortName = name.substring(sepIdx + 1)
    }
  }

  header.write(shortName, 0, 100, "utf-8")                          // name       (0-99)
  header.write(mode.toString(8).padStart(7, "0") + "\0", 100, 8, "utf-8") // mode  (100-107)
  header.write("0001750\0", 108, 8, "utf-8")                        // uid 1000   (108-115)
  header.write("0001750\0", 116, 8, "utf-8")                        // gid 1000   (116-123)
  header.write(size.toString(8).padStart(11, "0") + "\0", 124, 12, "utf-8") // size (124-135)
  const mtime = Math.floor(Date.now() / 1000)
  header.write(mtime.toString(8).padStart(11, "0") + "\0", 136, 12, "utf-8") // mtime (136-147)
  header.fill(0x20, 148, 156)                                       // checksum placeholder (spaces)
  header[156] = typeflag.charCodeAt(0)                               // typeflag   (156)
  header.write("ustar\0", 257, 6, "utf-8")                          // magic      (257-262)
  header.write("00", 263, 2, "utf-8")                                // version    (263-264)
  header.write("itecify", 265, 32, "utf-8")                          // uname      (265-296)
  header.write("itecify", 297, 32, "utf-8")                          // gname      (297-328)
  if (prefix) {
    header.write(prefix, 345, 155, "utf-8")                          // prefix     (345-499)
  }

  // Compute and write checksum (sum of all bytes, treating checksum field as spaces)
  let checksum = 0
  for (let i = 0; i < 512; i++) checksum += header[i]
  header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "utf-8")

  return header
}

// ─── File Sync ───────────────────────────────────────────────────────────

/**
 * Write files into the container filesystem.
 *
 * Primary strategy: uses Docker's putArchive API (tar-based) which avoids
 * all shell escaping, argument-length limits, and exit-code issues.
 *
 * Fallback: writes files in small batches via shell exec if putArchive fails.
 */
export async function syncFilesToContainer(
  projectId: string,
  files: Map<string, string>,
): Promise<void> {
  const entry = containers.get(projectId)
  if (!entry || (entry.status !== "ready" && entry.status !== "creating")) return
  if (files.size === 0) return

  // ── Fast path: putArchive (tar-based, no shell) ──
  try {
    const tarBuffer = buildTarBuffer(files)
    const stream = Readable.from([tarBuffer])
    await entry.container.putArchive(stream, { path: CONTAINER_WORKDIR })
    console.log(`[iTECify Docker] Wrote ${files.size} files via putArchive for ${projectId}`)
    return
  } catch (err) {
    console.warn(`[iTECify Docker] putArchive failed for ${projectId}, falling back to exec:`, (err as Error).message)
  }

  // ── Fallback: shell exec in small batches ──
  // Use ';' instead of '&&' so one file's failure doesn't skip the rest.
  const BATCH_SIZE = 5
  const entries = Array.from(files.entries())

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE)
    const commands: string[] = []

    for (const [filePath, content] of batch) {
      const dir = filePath.substring(0, filePath.lastIndexOf("/")) || "."
      const b64 = Buffer.from(content, "utf-8").toString("base64")
      commands.push(`mkdir -p "${CONTAINER_WORKDIR}/${dir}"`)
      commands.push(`echo '${b64}' | base64 -d > "${CONTAINER_WORKDIR}/${filePath}"`)
    }

    try {
      await execInContainer(entry, ["sh", "-c", commands.join(" ; ")])
    } catch {
      // If the batch fails, try individual writes
      for (const [filePath, content] of batch) {
        try {
          const dir = filePath.substring(0, filePath.lastIndexOf("/")) || "."
          await execInContainer(entry, ["mkdir", "-p", `${CONTAINER_WORKDIR}/${dir}`])
          const b64 = Buffer.from(content, "utf-8").toString("base64")
          await execInContainer(entry, [
            "sh", "-c",
            `echo '${b64}' | base64 -d > "${CONTAINER_WORKDIR}/${filePath}"`,
          ])
        } catch (innerErr) {
          console.warn(`[iTECify Docker] Failed to write ${filePath}:`, innerErr)
        }
      }
    }
  }
}

/**
 * Read all files from the container workspace back into a Map.
 * Uses a single exec call with a shell loop for efficiency.
 */
export async function readFilesFromContainer(
  projectId: string,
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const entry = containers.get(projectId)
  if (!entry || entry.status !== "ready") return result

  try {
    // Single exec: find all files and output path + base64 content with delimiters
    const DELIM = "__ITECIFY_FILE_DELIM__"
    const script = `find ${CONTAINER_WORKDIR} -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | while IFS= read -r f; do echo "${DELIM}"; echo "$f"; base64 "$f" 2>/dev/null; done`
    const output = await execInContainer(entry, ["sh", "-c", script])

    if (!output.trim()) return result

    // Parse the output: DELIM, then path line, then base64 content lines
    const blocks = output.split(DELIM).filter(b => b.trim())
    for (const block of blocks) {
      const lines = block.split("\n")
      // First non-empty line is the path
      let pathIdx = 0
      while (pathIdx < lines.length && !lines[pathIdx].trim()) pathIdx++
      if (pathIdx >= lines.length) continue

      const absPath = lines[pathIdx].trim()
      if (!absPath.startsWith(CONTAINER_WORKDIR + "/")) continue

      const relPath = absPath.slice(CONTAINER_WORKDIR.length + 1)
      if (!relPath) continue

      // Remaining lines are base64 content
      const b64Content = lines.slice(pathIdx + 1).join("\n").trim()
      try {
        const content = Buffer.from(b64Content, "base64").toString("utf-8")
        result.set(relPath, content)
      } catch {
        // Skip files that can't be decoded (binary files etc.)
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
  cwd: string
}

// Track cwd per terminal session: projectId:sessionId → cwd
const sessionCwds = new Map<string, string>()

/**
 * Get the current working directory for a terminal session.
 */
export function getSessionCwd(projectId: string, terminalSessionId: string): string {
  return sessionCwds.get(`${projectId}:${terminalSessionId}`) ?? CONTAINER_WORKDIR
}

/**
 * Execute a single command in the container for a terminal session.
 * Tracks the current working directory across commands.
 * Returns the combined stdout+stderr output plus the new cwd.
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
      cwd: CONTAINER_WORKDIR,
    }
  }

  const cwdKey = `${projectId}:${terminalSessionId}`
  const cwd = sessionCwds.get(cwdKey) ?? CONTAINER_WORKDIR

  try {
    // Wrap command: cd to tracked cwd, run command with timeout, then emit separator + pwd
    const CWD_SEPARATOR = "__ITECIFY_CWD__"
    // Use `timeout` to enforce execution limit and prevent infinite loops
    const wrappedCommand = `cd ${JSON.stringify(cwd)} 2>/dev/null; timeout ${COMMAND_TIMEOUT_SECONDS} sh -c ${JSON.stringify(command)}; __exit=$?; if [ $__exit -eq 124 ]; then echo "\\n⏱ Process killed: exceeded ${COMMAND_TIMEOUT_SECONDS}s time limit" >&2; fi; echo "${CWD_SEPARATOR}"; pwd; exit $__exit`

    const exec = await entry.container.exec({
      Cmd: ["sh", "-c", wrappedCommand],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: CONTAINER_WORKDIR,
      // Run as the sandboxed user
      User: "itecify",
    })

    const stream = await exec.start({ hijack: true, stdin: false })

    const { stdoutStr, stderrStr } = await new Promise<{ stdoutStr: string; stderrStr: string }>((resolve, reject) => {
      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []
      const stdout = new PassThrough()
      const stderr = new PassThrough()

      docker.modem.demuxStream(stream, stdout, stderr)

      stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk))
      stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk))

      stream.on("end", () => {
        resolve({
          stdoutStr: Buffer.concat(stdoutChunks).toString("utf-8"),
          stderrStr: Buffer.concat(stderrChunks).toString("utf-8"),
        })
      })
      stream.on("error", reject)

      // Safety timeout — kill after command timeout + buffer
      setTimeout(() => {
        try { stream.destroy() } catch { /* ignore */ }
        resolve({
          stdoutStr: Buffer.concat(stdoutChunks).toString("utf-8"),
          stderrStr: Buffer.concat(stderrChunks).toString("utf-8") + `\n[Process timed out after ${COMMAND_TIMEOUT_SECONDS}s]`,
        })
      }, (COMMAND_TIMEOUT_SECONDS + 5) * 1_000)
    })

    // Get exit code
    const inspectResult = await exec.inspect()
    const exitCode = inspectResult.ExitCode ?? null

    // Parse out the cwd from the separator (only in stdout)
    let stdoutOutput = stdoutStr
    let newCwd = cwd
    const sepIdx = stdoutStr.lastIndexOf(CWD_SEPARATOR)
    if (sepIdx !== -1) {
      stdoutOutput = stdoutStr.substring(0, sepIdx).trimEnd()
      const afterSep = stdoutStr.substring(sepIdx + CWD_SEPARATOR.length).trim()
      // The first line after separator is the pwd output
      const pwdLine = afterSep.split("\n")[0]?.trim()
      if (pwdLine) newCwd = pwdLine
    }

    // Combine stdout and stderr, each on its own line
    const parts: string[] = []
    if (stdoutOutput.trimEnd()) parts.push(stdoutOutput.trimEnd())
    if (stderrStr.trimEnd()) parts.push(stderrStr.trimEnd())
    const output = parts.join("\n")

    sessionCwds.set(cwdKey, newCwd)

    return { output, exitCode, cwd: newCwd }
  } catch (err) {
    console.error(`[iTECify Docker] Exec failed for ${projectId}/${terminalSessionId}:`, err)
    return {
      output: `Error executing command: ${(err as Error).message}`,
      exitCode: 1,
      cwd,
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
  /** Remove files from Yjs that were deleted in the container */
  removeFiles?: (paths: string[]) => void
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

    // Safety: if the container read returned nothing, skip pulling to avoid
    // losing track of what was in the container.
    if (containerFiles.size === 0 && currentFiles.size > 0) {
      return
    }

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
 * Sync only changed Yjs files → container before executing a command.
 * Uses the lastSyncedToContainer snapshot for a fast differential sync
 * rather than writing all files every time.
 */
export async function syncBeforeCommand(projectId: string): Promise<void> {
  const state = fileSyncStates.get(projectId)
  const entry = containers.get(projectId)
  if (!entry || entry.status !== "ready") return

  // Get current Yjs files
  const getFiles = state?.callbacks.getFiles
  if (!getFiles) return

  const currentFiles = getFiles()

  if (state) {
    // Differential sync: only write files that changed since last sync
    const filesToWrite = new Map<string, string>()
    for (const [filePath, content] of currentFiles) {
      const lastSynced = state.lastSyncedToContainer.get(filePath)
      if (lastSynced === undefined || lastSynced !== content) {
        filesToWrite.set(filePath, content)
      }
    }

    // Delete files that were in last sync but gone now
    for (const [filePath] of state.lastSyncedToContainer) {
      if (!currentFiles.has(filePath)) {
        try {
          await execInContainer(entry, ["rm", "-f", `${CONTAINER_WORKDIR}/${filePath}`])
        } catch { /* ignore */ }
      }
    }

    if (filesToWrite.size > 0) {
      await syncFilesToContainer(projectId, filesToWrite)
    }

    // Update snapshot
    state.lastSyncedToContainer = new Map(currentFiles)
  } else {
    // No sync state — fall back to writing all files
    await syncFilesToContainer(projectId, currentFiles)
  }
}

/**
 * Force a container → Yjs sync after a command completes.
 * Merges container state into Yjs: applies new/changed files and removes
 * ONLY files that were confirmed to be in the container before the command
 * but are now gone (i.e. the command deleted them).
 *
 * We never delete Yjs files just because they weren't found in the container
 * read — that would be destructive if the container read returned incomplete
 * results (large workspaces, binary files, timeouts, etc.).
 */
export async function syncAfterCommand(projectId: string): Promise<void> {
  const state = fileSyncStates.get(projectId)
  if (!state) return

  const entry = containers.get(projectId)
  if (!entry || entry.status !== "ready") return

  try {
    const containerFiles = await readFilesFromContainer(projectId)
    const currentFiles = state.callbacks.getFiles()

    // Safety: if the container read returned nothing at all, something went
    // wrong (timeout, permission error, etc.) — skip the entire sync to
    // avoid accidentally wiping the Yjs doc.
    if (containerFiles.size === 0 && currentFiles.size > 0) {
      console.warn(`[iTECify Sync] Post-command container read returned 0 files for ${projectId} — skipping sync to protect Yjs state`)
      return
    }

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

    // Only delete files that were KNOWN to be in the container before the
    // command (tracked in lastSyncedToContainer) but are now gone.  This
    // avoids deleting Yjs-only files that were never in the container.
    if (state.callbacks.removeFiles) {
      const deletedPaths: string[] = []
      for (const [filePath] of state.lastSyncedToContainer) {
        if (!containerFiles.has(filePath)) {
          deletedPaths.push(filePath)
        }
      }
      if (deletedPaths.length > 0) {
        state.callbacks.removeFiles(deletedPaths)
      }
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
