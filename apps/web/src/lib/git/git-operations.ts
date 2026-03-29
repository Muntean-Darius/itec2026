// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Git Operations Wrapper
// High-level wrappers around isomorphic-git for common Git operations
// ═══════════════════════════════════════════════════════════════════════════

import git from "isomorphic-git"
import http from "isomorphic-git/http/web"
import type { YjsFsAdapter } from "./yjs-fs-adapter"

export interface GitAuthor {
  name: string
  email: string
}

export interface GitCredentials {
  username: string
  password: string // GitHub OAuth token
}

export interface FileStatus {
  filepath: string
  /** HEAD status: 0 = absent, 1 = present */
  head: 0 | 1
  /** Workdir status: 0 = absent, 1 = identical to HEAD, 2 = different from HEAD */
  workdir: 0 | 1 | 2
  /** Stage status: 0 = absent, 1 = identical to HEAD, 2 = different from HEAD, 3 = added */
  stage: 0 | 1 | 2 | 3
}

export interface CommitInfo {
  oid: string
  message: string
  author: {
    name: string
    email: string
    timestamp: number
  }
  parent: string[]
}

export interface GitOperations {
  /** Initialize a new Git repository */
  init: () => Promise<void>
  /** Clone a repository */
  clone: (url: string, credentials?: GitCredentials) => Promise<void>
  /** Get the current branch name */
  currentBranch: () => Promise<string | undefined>
  /** List all branches */
  listBranches: () => Promise<string[]>
  /** Create a new branch */
  createBranch: (name: string) => Promise<void>
  /** Checkout a branch */
  checkout: (branch: string) => Promise<void>
  /** Get status of all files */
  status: () => Promise<FileStatus[]>
  /** Stage a file */
  add: (filepath: string) => Promise<void>
  /** Unstage a file */
  remove: (filepath: string) => Promise<void>
  /** Discard changes to a file (reset to HEAD) */
  discardChanges: (filepath: string) => Promise<void>
  /** Commit staged changes */
  commit: (message: string, author: GitAuthor) => Promise<string>
  /** Get commit history */
  log: (depth?: number) => Promise<CommitInfo[]>
  /** Push to remote */
  push: (credentials: GitCredentials, remote?: string, branch?: string) => Promise<void>
  /** Pull from remote */
  pull: (credentials: GitCredentials, remote?: string, branch?: string) => Promise<void>
  /** Fetch from remote */
  fetch: (credentials: GitCredentials, remote?: string) => Promise<void>
  /** Add a remote */
  addRemote: (name: string, url: string) => Promise<void>
  /** List remotes */
  listRemotes: () => Promise<{ remote: string; url: string }[]>
  /** Get diff between working tree and index (or HEAD) */
  getDiff: (filepath: string) => Promise<{ original: string; current: string } | null>
  /** Check if repository is initialized */
  isInitialized: () => Promise<boolean>
}

const CORS_PROXY = "/api/git-proxy"

export function createGitOperations(
  fs: YjsFsAdapter,
  dir: string = "/"
): GitOperations {
  const commonOpts = { fs, dir }

  const init = async (): Promise<void> => {
    await git.init({ ...commonOpts, defaultBranch: "main" })
  }

  const clone = async (url: string, credentials?: GitCredentials): Promise<void> => {
    await git.clone({
      ...commonOpts,
      http,
      url,
      corsProxy: CORS_PROXY,
      singleBranch: true,
      depth: 1,
      onAuth: credentials
        ? () => ({ username: credentials.username, password: credentials.password })
        : undefined,
    })
  }

  const currentBranch = async (): Promise<string | undefined> => {
    try {
      return await git.currentBranch({ ...commonOpts, fullname: false }) || undefined
    } catch {
      return undefined
    }
  }

  const listBranches = async (): Promise<string[]> => {
    try {
      return await git.listBranches(commonOpts)
    } catch {
      return []
    }
  }

  const createBranch = async (name: string): Promise<void> => {
    await git.branch({ ...commonOpts, ref: name })
  }

  const checkout = async (branch: string): Promise<void> => {
    await git.checkout({ ...commonOpts, ref: branch })
  }

  const status = async (): Promise<FileStatus[]> => {
    const matrix = await git.statusMatrix({ ...commonOpts, filepaths: ["."] })
    return matrix.map(([filepath, head, workdir, stage]) => ({
      filepath,
      head: head as 0 | 1,
      workdir: workdir as 0 | 1 | 2,
      stage: stage as 0 | 1 | 2 | 3,
    }))
  }

  // Normalize filepath for isomorphic-git (expects paths without leading "/")
  const normalizeFilepath = (filepath: string): string => {
    return filepath.startsWith("/") ? filepath.slice(1) : filepath
  }

  const add = async (filepath: string): Promise<void> => {
    await git.add({ ...commonOpts, filepath: normalizeFilepath(filepath) })
  }

  const remove = async (filepath: string): Promise<void> => {
    await git.remove({ ...commonOpts, filepath: normalizeFilepath(filepath) })
  }

  const discardChanges = async (filepath: string): Promise<void> => {
    const normalizedPath = normalizeFilepath(filepath)
    try {
      // Reset file to HEAD when a commit exists
      await git.resolveRef({ ...commonOpts, ref: "HEAD" })
      await git.checkout({ ...commonOpts, ref: "HEAD", filepaths: [normalizedPath], force: true })
      return
    } catch {
      // Fresh repo with no commits yet: "discard" means remove the working file
      // if it exists (equivalent to undo untracked file creation).
      try {
        await fs.promises.unlink("/" + normalizedPath)
      } catch {
        // If file doesn't exist, nothing to discard.
      }
    }
  }

  const commit = async (message: string, author: GitAuthor): Promise<string> => {
    return await git.commit({
      ...commonOpts,
      message,
      author: { name: author.name, email: author.email },
    })
  }

  const log = async (depth: number = 50): Promise<CommitInfo[]> => {
    try {
      const commits = await git.log({ ...commonOpts, depth })
      return commits.map((c) => ({
        oid: c.oid,
        message: c.commit.message,
        author: {
          name: c.commit.author.name,
          email: c.commit.author.email,
          timestamp: c.commit.author.timestamp,
        },
        parent: c.commit.parent,
      }))
    } catch {
      return []
    }
  }

  const push = async (
    credentials: GitCredentials,
    remote: string = "origin",
    branch?: string
  ): Promise<void> => {
    const ref = branch || (await currentBranch())
    if (!ref) throw new Error("No branch to push")

    await git.push({
      ...commonOpts,
      http,
      remote,
      ref,
      corsProxy: CORS_PROXY,
      onAuth: () => ({ username: credentials.username, password: credentials.password }),
    })
  }

  const pull = async (
    credentials: GitCredentials,
    remote: string = "origin",
    branch?: string
  ): Promise<void> => {
    const ref = branch || (await currentBranch())
    if (!ref) throw new Error("No branch to pull")

    await git.pull({
      ...commonOpts,
      http,
      remote,
      ref,
      corsProxy: CORS_PROXY,
      singleBranch: true,
      author: { name: credentials.username, email: `${credentials.username}@users.noreply.github.com` },
      onAuth: () => ({ username: credentials.username, password: credentials.password }),
    })
  }

  const fetch = async (credentials: GitCredentials, remote: string = "origin"): Promise<void> => {
    await git.fetch({
      ...commonOpts,
      http,
      remote,
      corsProxy: CORS_PROXY,
      singleBranch: true,
      onAuth: () => ({ username: credentials.username, password: credentials.password }),
    })
  }

  const addRemote = async (name: string, url: string): Promise<void> => {
    await git.addRemote({ ...commonOpts, remote: name, url })
  }

  const listRemotes = async (): Promise<{ remote: string; url: string }[]> => {
    try {
      return await git.listRemotes(commonOpts)
    } catch {
      return []
    }
  }

  const getDiff = async (
    filepath: string
  ): Promise<{ original: string; current: string } | null> => {
    try {
      // Get current working tree content
      const currentContent = await fs.promises.readFile(filepath, { encoding: "utf8" }) as string

      // Get HEAD content
      let originalContent = ""
      try {
        const oid = await git.resolveRef({ ...commonOpts, ref: "HEAD" })
        const { blob } = await git.readBlob({
          ...commonOpts,
          oid,
          filepath: filepath.startsWith("/") ? filepath.slice(1) : filepath,
        })
        originalContent = new TextDecoder().decode(blob)
      } catch {
        // File doesn't exist in HEAD (new file)
        originalContent = ""
      }

      return { original: originalContent, current: currentContent }
    } catch {
      return null
    }
  }

  const isInitialized = async (): Promise<boolean> => {
    try {
      await fs.promises.stat("/.git")
      return true
    } catch {
      return false
    }
  }

  return {
    init,
    clone,
    currentBranch,
    listBranches,
    createBranch,
    checkout,
    status,
    add,
    remove,
    discardChanges,
    commit,
    log,
    push,
    pull,
    fetch,
    addRemote,
    listRemotes,
    getDiff,
    isInitialized,
  }
}

// Helper to interpret status matrix
export function getFileStatusLabel(status: FileStatus): string {
  const { head, workdir, stage } = status

  // New file (not in HEAD)
  if (head === 0 && workdir === 2 && stage === 0) return "untracked"
  if (head === 0 && workdir === 2 && stage === 2) return "added"
  if (head === 0 && stage === 3) return "added"

  // Modified file
  if (head === 1 && workdir === 2 && stage === 1) return "modified"
  if (head === 1 && workdir === 2 && stage === 2) return "staged-modified"
  if (head === 1 && workdir === 1 && stage === 2) return "staged"

  // Deleted file
  if (head === 1 && workdir === 0 && stage === 1) return "deleted"
  if (head === 1 && workdir === 0 && stage === 0) return "staged-deleted"

  // Unchanged
  if (head === 1 && workdir === 1 && stage === 1) return "unchanged"

  return "unknown"
}

export function isFileStaged(status: FileStatus): boolean {
  // File is staged if stage is different from HEAD (stage !== 1 for existing files)
  // or if it's a new file in the stage (stage === 2 or 3)
  return status.stage === 2 || status.stage === 3
}

export function hasUnstagedChanges(status: FileStatus): boolean {
  // File has unstaged changes if workdir differs from stage
  // For untracked files: head=0, workdir=2, stage=0
  // For modified but not staged: head=1, workdir=2, stage=1
  // For deleted but not staged: head=1, workdir=0, stage=1
  if (status.head === 0 && status.workdir === 2 && status.stage === 0) {
    // Untracked file
    return true
  }
  if (status.head === 1 && status.workdir === 2 && status.stage === 1) {
    // Modified but not staged
    return true
  }
  if (status.head === 1 && status.workdir === 0 && status.stage === 1) {
    // Deleted but not staged
    return true
  }
  return false
}

export function hasChanges(status: FileStatus): boolean {
  const label = getFileStatusLabel(status)
  return label !== "unchanged" && label !== "unknown"
}
