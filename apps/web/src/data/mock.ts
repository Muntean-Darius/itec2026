/**
 * Mock data for frontend development.
 * This will be replaced with real DB/API calls when integrated.
 */
import type { Session, SessionUser, LangMeta } from "@/types"

/* ── Language Registry ──────────────────────────────────────────────────── */

export const LANGUAGES = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Go",
  "Rust",
  "C++",
  "Java",
] as const

export type Language = (typeof LANGUAGES)[number]

export const LANG_META: Record<string, LangMeta> = {
  Python:     { color: "hsl(210, 70%, 58%)", ext: "py",   monacoId: "python" },
  JavaScript: { color: "hsl(48, 85%, 55%)",  ext: "js",   monacoId: "javascript" },
  TypeScript: { color: "hsl(215, 65%, 55%)", ext: "ts",   monacoId: "typescript" },
  Go:         { color: "hsl(190, 70%, 48%)", ext: "go",   monacoId: "go" },
  Rust:       { color: "hsl(24, 70%, 55%)",  ext: "rs",   monacoId: "rust" },
  "C++":      { color: "hsl(260, 55%, 62%)", ext: "cpp",  monacoId: "cpp" },
  Java:       { color: "hsl(0, 60%, 55%)",   ext: "java", monacoId: "java" },
}

export const DEFAULT_SNIPPETS: Record<string, string> = {
  python: `# Welcome to iTECify ✨

def fibonacci(n: int) -> list[int]:
    """Generate the first n Fibonacci numbers."""
    seq = [0, 1]
    for _ in range(2, n):
        seq.append(seq[-1] + seq[-2])
    return seq[:n]

if __name__ == "__main__":
    print(fibonacci(10))
`,
  javascript: `// Welcome to iTECify ✨

function fibonacci(n) {
  const seq = [0, 1];
  for (let i = 2; i < n; i++) {
    seq.push(seq[i - 1] + seq[i - 2]);
  }
  return seq.slice(0, n);
}

console.log(fibonacci(10));
`,
  typescript: `// Welcome to iTECify ✨

function fibonacci(n: number): number[] {
  const seq: number[] = [0, 1];
  for (let i = 2; i < n; i++) {
    seq.push(seq[i - 1] + seq[i - 2]);
  }
  return seq.slice(0, n);
}

console.log(fibonacci(10));
`,
  go: `package main

import "fmt"

func fibonacci(n int) []int {
\tseq := []int{0, 1}
\tfor i := 2; i < n; i++ {
\t\tseq = append(seq, seq[i-1]+seq[i-2])
\t}
\treturn seq[:n]
}

func main() {
\tfmt.Println(fibonacci(10))
}
`,
  rust: `fn fibonacci(n: usize) -> Vec<u64> {
    let mut seq = vec![0, 1];
    for i in 2..n {
        let next = seq[i - 1] + seq[i - 2];
        seq.push(next);
    }
    seq.truncate(n);
    seq
}

fn main() {
    println!("{:?}", fibonacci(10));
}
`,
  cpp: `#include <iostream>
#include <vector>

std::vector<int> fibonacci(int n) {
    std::vector<int> seq = {0, 1};
    for (int i = 2; i < n; ++i) {
        seq.push_back(seq[i - 1] + seq[i - 2]);
    }
    seq.resize(n);
    return seq;
}

int main() {
    for (int x : fibonacci(10)) std::cout << x << " ";
    std::cout << std::endl;
}
`,
  java: `import java.util.ArrayList;
import java.util.List;

public class Main {
    static List<Integer> fibonacci(int n) {
        List<Integer> seq = new ArrayList<>(List.of(0, 1));
        for (int i = 2; i < n; i++) {
            seq.add(seq.get(i - 1) + seq.get(i - 2));
        }
        return seq.subList(0, n);
    }

    public static void main(String[] args) {
        System.out.println(fibonacci(10));
    }
}
`,
}

/* ── Mock Sessions ──────────────────────────────────────────────────────── */

export const MOCK_SESSIONS: Session[] = [
  {
    id: "sess-001",
    name: "Algorithm Practice",
    language: "Python",
    ownerId: "user-001",
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    joinCode: "algo-2024",
  },
  {
    id: "sess-002",
    name: "React Dashboard",
    language: "TypeScript",
    ownerId: "user-001",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    joinCode: "react-dash",
  },
  {
    id: "sess-003",
    name: "API Server",
    language: "Go",
    ownerId: "user-001",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    joinCode: "go-api",
  },
  {
    id: "sess-004",
    name: "Systems Programming",
    language: "Rust",
    ownerId: "user-002",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    joinCode: "rust-sys",
  },
  {
    id: "sess-005",
    name: "ML Pipeline",
    language: "Python",
    ownerId: "user-001",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    joinCode: "ml-pipe",
  },
  {
    id: "sess-006",
    name: "Game Engine",
    language: "C++",
    ownerId: "user-002",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    joinCode: "game-eng",
  },
]

/* ── Mock Users ─────────────────────────────────────────────────────────── */

export const MOCK_CURRENT_USER: SessionUser = {
  id: "user-001",
  name: "Alex Chen",
  email: "alex@example.com",
  avatarUrl: null,
  color: "hsl(239, 84%, 67%)",
  isOnline: true,
}

export const MOCK_COLLABORATORS: SessionUser[] = [
  {
    id: "user-002",
    name: "Sam Rivera",
    email: "sam@example.com",
    avatarUrl: null,
    color: "hsl(150, 55%, 48%)",
    isOnline: true,
    cursor: { line: 12, col: 8 },
  },
  {
    id: "user-003",
    name: "Jordan Lee",
    email: "jordan@example.com",
    avatarUrl: null,
    color: "hsl(38, 85%, 55%)",
    isOnline: true,
    cursor: { line: 5, col: 22 },
  },
  {
    id: "user-004",
    name: "Taylor Kim",
    email: "taylor@example.com",
    avatarUrl: null,
    color: "hsl(0, 62%, 55%)",
    isOnline: false,
  },
]

/* ── Mock File Tree ─────────────────────────────────────────────────────── */

export const MOCK_FILE_TREE = [
  "/src/main.py",
  "/src/utils.py",
  "/src/models/user.py",
  "/src/models/session.py",
  "/tests/test_main.py",
  "/README.md",
  "/requirements.txt",
]
