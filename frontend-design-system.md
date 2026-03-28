# iTECify Frontend Design System

## Structure
- Monorepo: Yarn 4, apps/web (Next.js 16 App Router)
- Routes: / -> /dashboard, /login, /workspace/[projectId]
- shadcn/ui manually configured (components.json, Radix primitives)

## Color Palette (all HSL, dark+light modes in globals.css)
- Backgrounds: hsl(230, 13%, L%) — 7% base, 10% surface, 13% elevated, 16% hover, 20% active
- Text: hsl(224, S%, L%) — 88% primary, 55% secondary, 36% tertiary
- Brand (Indigo): hsl(239, 84%, 67%), AI (Teal): hsl(172, 66%, 50%)
- Semantic: success hsl(150,55%,48%), warning hsl(38,85%,55%), error hsl(0,62%,55%)

## Fonts
- UI: Inter (--font-inter), Code: JetBrains Mono (--font-jetbrains-mono)

## Components Created
- UI: button, tooltip, scroll-area, avatar, badge, separator, dialog, dropdown-menu, input, tabs, command, sonner
- Dashboard: dashboard-shell (project cards, search, new project dialog)
- Workspace: workspace-shell, file-tree, presence-dock, code-editor (Monaco), terminal-panel, command-palette, time-travel-slider, agent-roster
- Login: OAuth + email stub page

## Auth & Database
- Supabase auth: @supabase/supabase-js + @supabase/ssr
- Client utils: lib/supabase/client.ts (browser), server.ts (RSC), middleware.ts
- Middleware at src/middleware.ts: session refresh + auth redirects
- Auth callback: app/auth/callback/route.ts
- Sign-out server action: app/actions.ts
- Prisma schema: prisma/schema.prisma (User, Project, ProjectMembership, Snapshot, AIAgent)
- Env vars in .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL

## Key Patterns
- Mock data in src/data/mock.ts with async wrappers (RSC-ready)
- framer-motion animations, next-themes dark/light
- CSS utilities: .skeleton, .glass, .glow-brand, .glow-ai, .glow-error
- Keyboard shortcuts: Cmd+K (AI prompt), Cmd+Shift+P (palette), Cmd+B (sidebar), Cmd+` (terminal), "a" (new file)
- Resizable panels: sidebar, terminal, agent roster via ResizeHandle component (drag handles)
- AI inline prompt: ai-inline-prompt.tsx (mock streaming, accept/reject/diff)
- Collaboration cursors: collaboration-cursors.tsx (mock floating cursors with names)
- File context menu: right-click on files/folders in file tree
- New file dialog: new-file-dialog.tsx + "a" keyboard shortcut
- Build: passes, lint: 4 warnings (intentional unused params)