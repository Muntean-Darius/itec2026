// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Git Context Provider
// React context for managing Git state across the workspace
// ═══════════════════════════════════════════════════════════════════════════

"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import { toast } from "sonner"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { createYjsFsAdapter, type YjsFsAdapter } from "./yjs-fs-adapter"
import {
  createGitOperations,
  type GitOperations,
  type FileStatus,
  type CommitInfo,
  type GitCredentials,
  type GitAuthor,
  getFileStatusLabel,
  isFileStaged,
  hasUnstagedChanges,
  hasChanges,
} from "./git-operations"

// Re-export helpers for convenience
export { getFileStatusLabel, isFileStaged, hasUnstagedChanges, hasChanges }
export type { FileStatus, CommitInfo, GitCredentials, GitAuthor }

// ─── Types ───────────────────────────────────────────────────────────────

export interface GitState {
  /** Whether Git is initialized in this project */
  initialized: boolean
  /** Whether Git operations are loading */
  loading: boolean
  /** Current branch name */
  currentBranch: string | undefined
  /** List of all branches */
  branches: string[]
  /** File statuses */
  fileStatuses: FileStatus[]
  /** Recent commits */
  commits: CommitInfo[]
  /** Remote repositories */
  remotes: { remote: string; url: string }[]
  /** Whether there are unpushed commits */
  hasUnpushedCommits: boolean
  /** Whether push/pull is in progress */
  syncing: boolean
}

export interface GitContextValue extends GitState {
  // Actions
  initRepo: () => Promise<void>
  cloneRepo: (url: string) => Promise<void>
  refreshStatus: () => Promise<void>
  stageFile: (filepath: string) => Promise<void>
  unstageFile: (filepath: string) => Promise<void>
  stageAll: () => Promise<void>
  unstageAll: () => Promise<void>
  discardChanges: (filepath: string) => Promise<void>
  commit: (message: string) => Promise<void>
  createBranch: (name: string) => Promise<void>
  checkoutBranch: (name: string) => Promise<void>
  push: () => Promise<void>
  pull: () => Promise<void>
  fetch: () => Promise<void>
  addRemote: (name: string, url: string) => Promise<void>
  getDiff: (filepath: string) => Promise<{ original: string; current: string } | null>
  setCredentials: (creds: GitCredentials) => void
  setAuthor: (author: GitAuthor) => void
}

const GitContext = createContext<GitContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────

interface GitProviderProps {
  children: ReactNode
  projectId: string
  /** Yjs document for file system */
  ydoc: unknown
  /** Yjs module reference */
  Y: unknown
  /** Initial author info */
  initialAuthor?: GitAuthor
  /** Initial credentials (from Supabase session) */
  initialCredentials?: GitCredentials
}

export function GitProvider({
  children,
  projectId,
  ydoc,
  Y,
  initialAuthor,
  initialCredentials,
}: GitProviderProps) {
  // State
  const [state, setState] = useState<GitState>({
    initialized: false,
    loading: true,
    currentBranch: undefined,
    branches: [],
    fileStatuses: [],
    commits: [],
    remotes: [],
    hasUnpushedCommits: false,
    syncing: false,
  })

  // Credentials and author info
  const [credentials, setCredentials] = useState<GitCredentials | undefined>(
    initialCredentials
  )
  const [author, setAuthor] = useState<GitAuthor>(
    initialAuthor || { name: "iTECify User", email: "user@itecify.dev" }
  )

  // Refs for git operations
  const fsRef = useRef<YjsFsAdapter | null>(null)
  const gitRef = useRef<GitOperations | null>(null)
  const initPromiseRef = useRef<Promise<void> | null>(null)

  // Hydrate credentials from browser Supabase session (provider_token).
  // This fixes cases where server-passed credentials are unavailable/stale.
  useEffect(() => {
    const supabase = createSupabaseClient()
    let active = true

    const extractCredentialsFromSession = (session: unknown): GitCredentials | undefined => {
      if (!session || typeof session !== "object") return undefined
      const s = session as {
        provider_token?: string
        user?: {
          app_metadata?: { provider?: string }
          user_metadata?: Record<string, unknown>
        }
      }
      if (s.user?.app_metadata?.provider !== "github" || !s.provider_token) {
        return undefined
      }
      const meta = s.user.user_metadata ?? {}
      const username =
        (typeof meta.user_name === "string" && meta.user_name) ||
        (typeof meta.preferred_username === "string" && meta.preferred_username) ||
        (typeof meta.name === "string" && meta.name) ||
        "oauth2"
      return { username, password: s.provider_token }
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const nextCreds = extractCredentialsFromSession(data.session)
      if (nextCreds) {
        setCredentials(nextCreds)
      }
    })

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      const nextCreds = extractCredentialsFromSession(session)
      if (nextCreds) {
        setCredentials(nextCreds)
      }
    })

    return () => {
      active = false
      authSub.subscription.unsubscribe()
    }
  }, [])

  // Internal status refresh - defined before useEffect that uses it
  const refreshStatusInternal = useCallback(async () => {
    const git = gitRef.current
    if (!git) return

    try {
      const [currentBranch, branches, fileStatuses, commits, remotes] = await Promise.all([
        git.currentBranch(),
        git.listBranches(),
        git.status(),
        git.log(20),
        git.listRemotes(),
      ])

      // TODO: Check for unpushed commits by comparing local and remote refs
      const hasUnpushedCommits = commits.length > 0

      setState((s) => ({
        ...s,
        initialized: true,
        loading: false,
        currentBranch,
        branches,
        fileStatuses: fileStatuses.filter(hasChanges),
        commits,
        remotes,
        hasUnpushedCommits,
      }))
    } catch (error) {
      console.error("Git status refresh failed:", error)
      setState((s) => ({ ...s, loading: false }))
    }
  }, [])

  // Initialize FS adapter and Git operations
  useEffect(() => {
    if (!ydoc || !Y) return

    // Type assertions for Yjs objects
    const typedYdoc = ydoc as Parameters<typeof createYjsFsAdapter>[0]["ydoc"]
    const typedY = Y as Parameters<typeof createYjsFsAdapter>[0]["Y"]

    fsRef.current = createYjsFsAdapter({
      ydoc: typedYdoc,
      Y: typedY,
      projectId,
    })
    gitRef.current = createGitOperations(fsRef.current)

    // Initial status check
    initPromiseRef.current = (async () => {
      try {
        const initialized = await gitRef.current!.isInitialized()
        if (initialized) {
          await refreshStatusInternal()
        } else {
          setState((s) => ({ ...s, initialized: false, loading: false }))
        }
      } catch (error) {
        console.error("Git init check failed:", error)
        setState((s) => ({ ...s, loading: false }))
      }
    })()

    // Observe Yjs files map for changes and refresh git status
    const filesMap = typedYdoc.getMap("files")
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    
    const onFilesChange = () => {
      // Debounce the refresh to avoid excessive calls during rapid edits
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        if (gitRef.current) {
          try {
            const initialized = await gitRef.current.isInitialized()
            if (initialized) {
              await refreshStatusInternal()
            }
          } catch {
            // Ignore errors during background refresh
          }
        }
      }, 500) // 500ms debounce
    }

    // Type assertion for Y.Map observer
    const mapObserver = filesMap as unknown as { 
      observe: (fn: () => void) => void
      unobserve: (fn: () => void) => void 
    }
    mapObserver.observe(onFilesChange)

    return () => {
      fsRef.current = null
      gitRef.current = null
      if (debounceTimer) clearTimeout(debounceTimer)
      mapObserver.unobserve(onFilesChange)
    }
  }, [projectId, ydoc, Y, refreshStatusInternal])

  // ─── Actions ───────────────────────────────────────────────────────────

  const initRepo = useCallback(async () => {
    const git = gitRef.current
    if (!git) return

    setState((s) => ({ ...s, loading: true }))
    try {
      await git.init()
      toast.success("Git repository initialized")
      await refreshStatusInternal()
    } catch (error) {
      console.error("Git init failed:", error)
      toast.error("Failed to initialize Git repository")
      setState((s) => ({ ...s, loading: false }))
    }
  }, [refreshStatusInternal])

  const cloneRepo = useCallback(
    async (url: string) => {
      const git = gitRef.current
      if (!git) return

      setState((s) => ({ ...s, loading: true }))
      try {
        await git.clone(url, credentials)
        toast.success("Repository cloned")
        await refreshStatusInternal()
      } catch (error) {
        console.error("Git clone failed:", error)
        toast.error("Failed to clone repository")
        setState((s) => ({ ...s, loading: false }))
      }
    },
    [credentials, refreshStatusInternal]
  )

  const refreshStatus = useCallback(async () => {
    await initPromiseRef.current
    await refreshStatusInternal()
  }, [refreshStatusInternal])

  const stageFile = useCallback(
    async (filepath: string) => {
      const git = gitRef.current
      if (!git) return

      try {
        await git.add(filepath)
        await refreshStatusInternal()
      } catch (error) {
        console.error("Git add failed:", error)
        toast.error(`Failed to stage ${filepath}`)
      }
    },
    [refreshStatusInternal]
  )

  const unstageFile = useCallback(
    async (filepath: string) => {
      const git = gitRef.current
      if (!git) return

      try {
        await git.remove(filepath)
        await refreshStatusInternal()
      } catch (error) {
        console.error("Git remove failed:", error)
        toast.error(`Failed to unstage ${filepath}`)
      }
    },
    [refreshStatusInternal]
  )

  const stageAll = useCallback(async () => {
    const git = gitRef.current
    if (!git) return

    const unstaged = state.fileStatuses.filter(hasUnstagedChanges)
    try {
      for (const file of unstaged) {
        await git.add(file.filepath)
      }
      await refreshStatusInternal()
      toast.success("All changes staged")
    } catch (error) {
      console.error("Git add all failed:", error)
      toast.error("Failed to stage all changes")
    }
  }, [state.fileStatuses, refreshStatusInternal])

  const unstageAll = useCallback(async () => {
    const git = gitRef.current
    if (!git) return

    const staged = state.fileStatuses.filter(isFileStaged)
    try {
      for (const file of staged) {
        await git.remove(file.filepath)
      }
      await refreshStatusInternal()
      toast.success("All changes unstaged")
    } catch (error) {
      console.error("Git unstage all failed:", error)
      toast.error("Failed to unstage all changes")
    }
  }, [state.fileStatuses, refreshStatusInternal])

  const discardChanges = useCallback(
    async (filepath: string) => {
      const git = gitRef.current
      if (!git) return

      try {
        await git.discardChanges(filepath)
        await refreshStatusInternal()
        toast.success(`Discarded changes to ${filepath}`)
      } catch (error) {
        console.error("Git discard failed:", error)
        toast.error(`Failed to discard changes to ${filepath}`)
      }
    },
    [refreshStatusInternal]
  )

  const commit = useCallback(
    async (message: string) => {
      const git = gitRef.current
      if (!git) return

      try {
        const oid = await git.commit(message, author)
        toast.success(`Committed: ${oid.slice(0, 7)}`)
        await refreshStatusInternal()
      } catch (error) {
        console.error("Git commit failed:", error)
        toast.error("Failed to commit")
      }
    },
    [author, refreshStatusInternal]
  )

  const createBranch = useCallback(
    async (name: string) => {
      const git = gitRef.current
      if (!git) return

      try {
        await git.createBranch(name)
        await git.checkout(name)
        toast.success(`Created and switched to branch: ${name}`)
        await refreshStatusInternal()
      } catch (error) {
        console.error("Git branch failed:", error)
        toast.error(`Failed to create branch: ${name}`)
      }
    },
    [refreshStatusInternal]
  )

  const checkoutBranch = useCallback(
    async (name: string) => {
      const git = gitRef.current
      if (!git) return

      try {
        await git.checkout(name)
        toast.success(`Switched to branch: ${name}`)
        await refreshStatusInternal()
      } catch (error) {
        console.error("Git checkout failed:", error)
        toast.error(`Failed to switch to branch: ${name}`)
      }
    },
    [refreshStatusInternal]
  )

  const push = useCallback(async () => {
    const git = gitRef.current
    if (!git || !credentials) {
      toast.error("GitHub OAuth token missing. Re-login with GitHub and try again.")
      return
    }

    setState((s) => ({ ...s, syncing: true }))
    try {
      await git.push(credentials)
      toast.success("Pushed to remote")
      await refreshStatusInternal()
    } catch (error) {
      console.error("Git push failed:", error)
      toast.error("Failed to push")
    } finally {
      setState((s) => ({ ...s, syncing: false }))
    }
  }, [credentials, refreshStatusInternal])

  const pull = useCallback(async () => {
    const git = gitRef.current
    if (!git) {
      return
    }

    setState((s) => ({ ...s, syncing: true }))
    try {
      await git.pull(credentials)
      toast.success("Pulled from remote")
      await refreshStatusInternal()
    } catch (error) {
      console.error("Git pull failed:", error)
      toast.error("Failed to pull")
    } finally {
      setState((s) => ({ ...s, syncing: false }))
    }
  }, [credentials, refreshStatusInternal])

  const fetch = useCallback(async () => {
    const git = gitRef.current
    if (!git) {
      return
    }

    setState((s) => ({ ...s, syncing: true }))
    try {
      await git.fetch(credentials)
      toast.success("Fetched from remote")
      await refreshStatusInternal()
    } catch (error) {
      console.error("Git fetch failed:", error)
      toast.error("Failed to fetch")
    } finally {
      setState((s) => ({ ...s, syncing: false }))
    }
  }, [credentials, refreshStatusInternal])

  const addRemote = useCallback(
    async (name: string, url: string) => {
      const git = gitRef.current
      if (!git) return

      try {
        await git.addRemote(name, url)
        toast.success(`Added remote: ${name}`)
        await refreshStatusInternal()
      } catch (error) {
        console.error("Git add remote failed:", error)
        toast.error(`Failed to add remote: ${name}`)
      }
    },
    [refreshStatusInternal]
  )

  const getDiff = useCallback(
    async (filepath: string): Promise<{ original: string; current: string } | null> => {
      const git = gitRef.current
      if (!git) return null
      return git.getDiff(filepath)
    },
    []
  )

  const setCredentialsHandler = useCallback((creds: GitCredentials) => {
    setCredentials(creds)
  }, [])

  const setAuthorHandler = useCallback((newAuthor: GitAuthor) => {
    setAuthor(newAuthor)
  }, [])

  // ─── Context Value ─────────────────────────────────────────────────────

  const value: GitContextValue = {
    ...state,
    initRepo,
    cloneRepo,
    refreshStatus,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    discardChanges,
    commit,
    createBranch,
    checkoutBranch,
    push,
    pull,
    fetch,
    addRemote,
    getDiff,
    setCredentials: setCredentialsHandler,
    setAuthor: setAuthorHandler,
  }

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useGit(): GitContextValue {
  const context = useContext(GitContext)
  if (!context) {
    throw new Error("useGit must be used within a GitProvider")
  }
  return context
}

// Optional hook that returns null if not in provider (for optional usage)
export function useGitOptional(): GitContextValue | null {
  return useContext(GitContext)
}
