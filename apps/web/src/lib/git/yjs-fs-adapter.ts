// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Yjs File System Adapter for isomorphic-git
// Provides an fs-like interface that reads workspace files from Yjs Y.Map
// and stores .git/ objects in IndexedDB via LightningFS
// ═══════════════════════════════════════════════════════════════════════════

import LightningFS from "@isomorphic-git/lightning-fs"

// Type for Yjs Y.Text-like objects
interface YTextLike {
  toString(): string
  delete(index: number, length: number): void
  insert(index: number, text: string): void
}

// Type for Yjs Y.Map-like objects
interface YMapLike {
  get(key: string): unknown
  set(key: string, value: unknown): void
  delete(key: string): void
  forEach(callback: (value: unknown, key: string) => void): void
  has(key: string): boolean
  keys(): IterableIterator<string>
}

// Type for Yjs Y.Doc-like objects
interface YDocLike {
  getMap(name: string): YMapLike
  transact(fn: () => void): void
}

// Yjs module type (for creating Y.Text instances)
interface YjsModule {
  Text: new (text?: string) => YTextLike
}

export interface YjsFsAdapterOptions {
  /** The Yjs document containing the "files" map */
  ydoc: YDocLike
  /** The Yjs module (for creating Y.Text instances) */
  Y: YjsModule
  /** Project ID for namespacing IndexedDB storage */
  projectId: string
}

// Stat result for isomorphic-git
interface StatResult {
  type: "file" | "dir"
  mode: number
  size: number
  ino: number
  mtimeMs: number
  ctimeMs: number
  uid: number
  gid: number
  dev: number
  isFile: () => boolean
  isDirectory: () => boolean
  isSymbolicLink: () => boolean
}

// Encoding type
type Encoding = "utf8" | null | undefined

/**
 * Creates a hybrid file system for isomorphic-git:
 * - Workspace files (non-.git) are read/written to/from Yjs Y.Map
 * - Git internal files (.git/*) are stored in IndexedDB via LightningFS
 */
export function createYjsFsAdapter(options: YjsFsAdapterOptions) {
  const { ydoc, Y, projectId } = options

  // LightningFS for .git/ storage (IndexedDB-backed)
  const lfs = new LightningFS(`itecify-git-${projectId}`)
  const gitFs = lfs.promises

  // Helper to get the files map from Yjs
  const getFilesMap = (): YMapLike => ydoc.getMap("files")

  // Normalize path to a canonical absolute path.
  // Handles ".", "..", duplicate slashes, and trailing slash normalization.
  const normalizePath = (filepath: string): string => {
    const raw = (filepath || "/").replace(/\\/g, "/")
    const withLeading = raw.startsWith("/") ? raw : "/" + raw
    const segments = withLeading.split("/")
    const resolved: string[] = []

    for (const segment of segments) {
      if (!segment || segment === ".") continue
      if (segment === "..") {
        resolved.pop()
        continue
      }
      resolved.push(segment)
    }

    return "/" + resolved.join("/")
  }

  // Check if path is inside .git directory
  const isGitPath = (filepath: string): boolean => {
    const normalized = normalizePath(filepath)
    return normalized === "/.git" || normalized.startsWith("/.git/")
  }

  // Get all workspace paths from Yjs
  const getWorkspacePaths = (): string[] => {
    const filesMap = getFilesMap()
    const paths: string[] = []
    filesMap.forEach((_, key) => {
      paths.push(normalizePath(key))
    })
    return paths
  }

  // Check if a directory exists in workspace (by checking if any file has it as prefix)
  const workspaceDirExists = (dirPath: string): boolean => {
    const normalizedDir = normalizePath(dirPath)
    if (normalizedDir === "/") return true
    const paths = getWorkspacePaths()
    return paths.some(
      (p) => p === normalizedDir || p.startsWith(normalizedDir + "/")
    )
  }

  // Read a file
  const readFile = async (
    filepath: string,
    options?: { encoding?: Encoding } | Encoding
  ): Promise<Uint8Array | string> => {
    const normalized = normalizePath(filepath)
    const encoding =
      typeof options === "string" ? options : options?.encoding

    if (isGitPath(normalized)) {
      const result = await gitFs.readFile(normalized, options as Parameters<typeof gitFs.readFile>[1])
      return result as Uint8Array | string
    }

    // Read from Yjs
    const filesMap = getFilesMap()
    const yText = filesMap.get(normalized) as YTextLike | undefined

    if (!yText) {
      const error = new Error(`ENOENT: no such file or directory, open '${normalized}'`) as NodeJS.ErrnoException
      error.code = "ENOENT"
      throw error
    }

    const content = yText.toString()
    if (encoding === "utf8") {
      return content
    }
    return new TextEncoder().encode(content)
  }

  // Write a file
  const writeFile = async (
    filepath: string,
    data: Uint8Array | string,
    options?: { encoding?: Encoding; mode?: number } | Encoding
  ): Promise<void> => {
    const normalized = normalizePath(filepath)

    if (isGitPath(normalized)) {
      await gitFs.writeFile(normalized, data, options as Parameters<typeof gitFs.writeFile>[2])
      return
    }

    // Write to Yjs
    const content = typeof data === "string" ? data : new TextDecoder().decode(data)
    const filesMap = getFilesMap()

    ydoc.transact(() => {
      const existing = filesMap.get(normalized) as YTextLike | undefined
      if (existing) {
        // Update existing Y.Text
        existing.delete(0, existing.toString().length)
        existing.insert(0, content)
      } else {
        // Create new Y.Text
        const yText = new Y.Text(content)
        filesMap.set(normalized, yText)
      }
    })
  }

  // Delete a file
  const unlink = async (filepath: string): Promise<void> => {
    const normalized = normalizePath(filepath)

    if (isGitPath(normalized)) {
      await gitFs.unlink(normalized)
      return
    }

    // Delete from Yjs
    const filesMap = getFilesMap()
    if (!filesMap.has(normalized)) {
      const error = new Error(`ENOENT: no such file or directory, unlink '${normalized}'`) as NodeJS.ErrnoException
      error.code = "ENOENT"
      throw error
    }
    ydoc.transact(() => {
      filesMap.delete(normalized)
    })
  }

  // Read directory contents
  const readdir = async (filepath: string): Promise<string[]> => {
    const normalized = normalizePath(filepath)

    if (isGitPath(normalized)) {
      return gitFs.readdir(normalized)
    }

    // For workspace, parse the flat map to get directory entries
    const paths = getWorkspacePaths()
    const prefix = normalized === "/" ? "/" : normalized + "/"
    const entries = new Set<string>()

    for (const path of paths) {
      if (normalized === "/") {
        // Root directory: get first path segment
        const segments = path.split("/").filter(Boolean)
        if (segments.length > 0) {
          entries.add(segments[0])
        }
      } else if (path.startsWith(prefix)) {
        // Get next path segment after the prefix
        const remainder = path.slice(prefix.length)
        const segments = remainder.split("/").filter(Boolean)
        if (segments.length > 0) {
          entries.add(segments[0])
        }
      }
    }

    // Also check for .git directory at root
    if (normalized === "/") {
      try {
        await gitFs.stat("/.git")
        entries.add(".git")
      } catch {
        // .git doesn't exist yet
      }
    }

    return Array.from(entries)
  }

  // Create directory
  const mkdir = async (filepath: string, options?: { mode?: number; recursive?: boolean }): Promise<void> => {
    const normalized = normalizePath(filepath)

    if (isGitPath(normalized)) {
      await gitFs.mkdir(normalized, options as { mode: number })
      return
    }

    // For Yjs workspace, directories are implicit (created when files are added)
    // We don't need to do anything, but we shouldn't throw an error
  }

  // Remove directory
  const rmdir = async (filepath: string): Promise<void> => {
    const normalized = normalizePath(filepath)

    if (isGitPath(normalized)) {
      await gitFs.rmdir(normalized)
      return
    }

    // For Yjs workspace, removing a directory means removing all files with that prefix
    const filesMap = getFilesMap()
    const prefix = normalized + "/"

    ydoc.transact(() => {
      const keysToDelete: string[] = []
      filesMap.forEach((_, key) => {
        const normalizedKey = normalizePath(key)
        if (normalizedKey.startsWith(prefix)) {
          keysToDelete.push(key)
        }
      })
      for (const key of keysToDelete) {
        filesMap.delete(key)
      }
    })
  }

  // Get file/directory stats
  const stat = async (filepath: string): Promise<StatResult> => {
    const normalized = normalizePath(filepath)

    // Repository root always exists for git operations
    if (normalized === "/") {
      const now = Date.now()
      return {
        type: "dir",
        mode: 0o40755,
        size: 0,
        ino: 0,
        mtimeMs: now,
        ctimeMs: now,
        uid: 0,
        gid: 0,
        dev: 0,
        isFile: () => false,
        isDirectory: () => true,
        isSymbolicLink: () => false,
      }
    }

    if (isGitPath(normalized)) {
      const result = await gitFs.stat(normalized)
      return result as unknown as StatResult
    }

    // Check if it's a file in Yjs
    const filesMap = getFilesMap()
    const yText = filesMap.get(normalized) as YTextLike | undefined

    if (yText) {
      const content = yText.toString()
      const size = new TextEncoder().encode(content).length
      const now = Date.now()
      return {
        type: "file",
        mode: 0o100644,
        size,
        ino: 0,
        mtimeMs: now,
        ctimeMs: now,
        uid: 0,
        gid: 0,
        dev: 0,
        isFile: () => true,
        isDirectory: () => false,
        isSymbolicLink: () => false,
      }
    }

    // Check if it's a directory
    if (workspaceDirExists(normalized)) {
      const now = Date.now()
      return {
        type: "dir",
        mode: 0o40755,
        size: 0,
        ino: 0,
        mtimeMs: now,
        ctimeMs: now,
        uid: 0,
        gid: 0,
        dev: 0,
        isFile: () => false,
        isDirectory: () => true,
        isSymbolicLink: () => false,
      }
    }

    const error = new Error(`ENOENT: no such file or directory, stat '${normalized}'`) as NodeJS.ErrnoException
    error.code = "ENOENT"
    throw error
  }

  // lstat is same as stat for our purposes (no symlinks)
  const lstat = stat

  // Rename/move a file
  const rename = async (oldPath: string, newPath: string): Promise<void> => {
    const normalizedOld = normalizePath(oldPath)
    const normalizedNew = normalizePath(newPath)

    if (isGitPath(normalizedOld) && isGitPath(normalizedNew)) {
      await gitFs.rename(normalizedOld, normalizedNew)
      return
    }

    if (isGitPath(normalizedOld) || isGitPath(normalizedNew)) {
      throw new Error("Cannot rename between workspace and .git")
    }

    // Rename in Yjs
    const filesMap = getFilesMap()
    const yText = filesMap.get(normalizedOld) as YTextLike | undefined

    if (!yText) {
      const error = new Error(`ENOENT: no such file or directory, rename '${normalizedOld}'`) as NodeJS.ErrnoException
      error.code = "ENOENT"
      throw error
    }

    const content = yText.toString()
    ydoc.transact(() => {
      filesMap.delete(normalizedOld)
      const newYText = new Y.Text(content)
      filesMap.set(normalizedNew, newYText)
    })
  }

  // Read symbolic link (not supported, but required by isomorphic-git)
  const readlink = async (filepath: string): Promise<string> => {
    const normalized = normalizePath(filepath)
    if (isGitPath(normalized)) {
      return gitFs.readlink(normalized)
    }
    const error = new Error(`EINVAL: invalid argument, readlink '${normalized}'`) as NodeJS.ErrnoException
    error.code = "EINVAL"
    throw error
  }

  // Create symbolic link (not supported, but required by isomorphic-git)
  const symlink = async (target: string, filepath: string): Promise<void> => {
    const normalized = normalizePath(filepath)
    if (isGitPath(normalized)) {
      await gitFs.symlink(target, normalized)
      return
    }
    const error = new Error(`ENOSYS: function not implemented, symlink`) as NodeJS.ErrnoException
    error.code = "ENOSYS"
    throw error
  }

  // Chmod (no-op for workspace, delegate for .git)
  const chmod = async (filepath: string, mode: number): Promise<void> => {
    const normalized = normalizePath(filepath)
    if (isGitPath(normalized)) {
      // LightningFS might not support chmod, ignore
      try {
        await (gitFs as unknown as { chmod?: (path: string, mode: number) => Promise<void> }).chmod?.(normalized, mode)
      } catch {
        // Ignore
      }
    }
    // No-op for workspace files
  }

  return {
    promises: {
      readFile,
      writeFile,
      unlink,
      readdir,
      mkdir,
      rmdir,
      stat,
      lstat,
      rename,
      readlink,
      symlink,
      chmod,
    },
  }
}

export type YjsFsAdapter = ReturnType<typeof createYjsFsAdapter>
