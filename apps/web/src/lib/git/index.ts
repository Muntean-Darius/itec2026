// Re-export Git utilities
export { createYjsFsAdapter, type YjsFsAdapter } from "./yjs-fs-adapter"
export {
  createGitOperations,
  getFileStatusLabel,
  isFileStaged,
  hasUnstagedChanges,
  hasChanges,
  type GitOperations,
  type FileStatus,
  type CommitInfo,
  type GitCredentials,
  type GitAuthor,
} from "./git-operations"
export {
  GitProvider,
  useGit,
  useGitOptional,
  type GitContextValue,
  type GitState,
} from "./git-context"
