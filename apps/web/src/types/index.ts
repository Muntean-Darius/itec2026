export interface Session {
  id: string
  name: string
  language: string
  owner_id: string
  created_at: string
}

export interface SessionUser {
  id: string
  username: string
  color: string
  cursor?: { line: number; col: number }
}
