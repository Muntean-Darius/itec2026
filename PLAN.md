iTECify - Comprehensive Project & Architecture Plan

Event: iTEC 2026 Web Development Hackathon

Vision: "Figma for Code" - A universal, multi-agent, and multi-human collaborative sandbox.

1. Executive Summary & Core Goals

Based on the hackathon brief and master plan, the core problem is that current AI coding tools act as disjointed "autocomplete on steroids", making human-AI collaboration messy and debugging a nightmare.

Our Primary Goals:

Fluid Multi-Presence: Real-time synchronization for multiple human developers and AI agents in the exact same file without Git conflicts.

Visual AI Distinction: AI-generated code must not blindly overwrite text. It must appear as floating, Notion-style visual blocks that users can accept, reject, or merge.

Collision Resolution: A "Smart Merge" system that intelligently resolves overlapping edits from multiple humans and AIs.

Secure On-the-Fly Sandboxing: An isolated, containerized execution environment (Docker) that spins up instantly, scans for vulnerabilities, enforces resource limits, and streams output via WebSockets.

Bonus Quests: Shared terminal execution, Time-Travel debugging (CRDT snapshots), and Easter eggs.

2. Optimized Architecture & Tech Stack

To maximize iteration speed during a 48-hour hackathon, minimize boilerplate, and maintain a highly LLM-friendly codebase, we will use a Decoupled Hybrid Stack managed via a Yarn 4 Monorepo.

Frontend (apps/web)

Framework: Next.js (App Router) with React & TypeScript. (Deployed on Vercel).

Direct Database Access (RSC Paradigm): The frontend will leverage React Server Components (RSC) and Next.js Server Actions to talk directly to the Prisma/Supabase database for all standard CRUD operations (e.g., fetching user dashboards, listing projects, authentication state). By bypassing a traditional REST API for standard web workflows, we drastically reduce boilerplate and latency.

UI/Styling: Tailwind CSS + shadcn/ui. Why? shadcn/ui provides unstyled, accessible components that you copy-paste into your app. It's incredibly LLM-friendly (AI understands Tailwind inherently) and requires zero boilerplate configuration.

Icons: lucide-react.

Editor: Monaco Editor (@monaco-editor/react).

Terminal UI: xterm.js + xterm-addon-fit.

Backend & Collaboration Server (apps/server)

Framework: Node.js + Express. (Deployed on a VPS like Railway or DigitalOcean).

Role (Strict Separation of Concerns): This is not a standard REST API for CRUD. It is a dedicated, stateful microservice specifically reserved for complex, long-lived real-time connections. Standard UI data fetching should never hit this server.

CRDT Engine: yjs + y-websocket. Why? Yjs is the industry standard for text-based CRDTs. It handles network partitions, multi-user cursors, and state vectors natively.

Execution Engine: dockerode (Docker API for Node.js) for orchestrating ephemeral containers.

AI Orchestration: Vercel AI SDK (or direct OpenAI/Anthropic SDKs) integrated into the Express server.

Database & Auth

BaaS: Supabase (PostgreSQL + Auth + Row Level Security).

ORM: Prisma. Why? Prisma's typed client prevents backend errors and its schema is very easy for LLMs to generate and refactor. Both the Next.js frontend (for standard queries) and the Express backend (for saving Yjs Time-Travel snapshots) will instantiate Prisma clients connected to the same Supabase instance.

Project & File System Architecture (The Virtual FS)

A core challenge is representing a multi-file IDE within a collaborative environment.

Decision 1: Collaborative Sessions are strictly Per-Project.
Users connect to a single WebSocket room designated by the projectId.

Why? For a true "Figma for Code" experience, users need global project awareness. If User A is editing /src/index.js and User B is editing /src/utils.js, they should see indicators in the file tree showing who is where. Furthermore, the AI Agent requires the context of the entire project to make accurate multi-file refactoring suggestions, not just the single file currently in view.

Decision 2: The Virtual File System is a "Flat Yjs Map".
Instead of modeling complex, deeply nested directory trees in Prisma or Yjs (which leads to painful recursive CRDT logic and hackathon-ending bugs), the entire file system will be modeled as a single flat Y.Map inside the Yjs document.

How it works: The Y.Map uses the full file path as the key (e.g., "/src/components/Button.tsx") and a Y.Text object as the value.

UI Representation: The Next.js frontend is responsible for taking this flat map and visually parsing the string paths to render a nested, hierarchical file tree in the sidebar.

Why? This makes moving, renaming, and deleting files incredibly easy (just delete the key or add a new key in the Y.Map). It completely avoids CRDT nesting issues.

Decision 3: Storage and Execution Strategy

The Source of Truth (Live): The live, authoritative state of the project files lives strictly in the Yjs server's memory (apps/server) during an active session.

Database Persistence: We do not store individual files as rows in PostgreSQL. Instead, a cron job on the Express server periodically serializes the entire Yjs Document (the State Vector) into a single binary BLOB, saved to a snapshots table in Supabase. When a workspace is opened, the server loads the latest BLOB from the DB into memory and re-inflates the Yjs document.

Just-In-Time (JIT) Docker Execution: When a user clicks "Run", the Express server reads the flat Y.Map, iterates over all the paths, and physically writes them to a temporary host directory (e.g., /tmp/workspace/{projectId}). It then spins up the Docker container, mounting this temporary directory as a volume. This guarantees the container runs the exact millisecond-accurate state of the collaborative session.

3. UI, Frontend Guidelines & Design System

🌟 The Prime Directive: UX-Driven Development

Every single architectural, developmental, and LLM-driven decision must be taken strictly with User Experience (UX) in mind. Whether writing a backend resolver or a frontend component, the ultimate goal is to maximize user-friendliness. The UI must be intuitive, predictable, and forgiving. If a technical choice degrades the fluid, frictionless nature of the tool, it must be rethought. The user should never have to fight the interface to collaborate with the AI.

To ensure a polished, professional, and easily maintainable codebase, the UI must adhere to the following principles:

Design Persona & Vibe

Kinetic & Fluid: Utilize Framer Motion to ensure no UI change feels abrupt. When AI blocks spawn, they should animate smoothly into the document flow. Conflict resolutions should transition elegantly rather than snapping.

Spatial & Layered (Z-Depth): Because "Figma for Code" relies on overlapping AI and human contexts, we need a strong sense of elevation. The raw code is the base layer; AI blocks, command palettes, and collaborative cursors should float above it using subtle drop shadows, varying border colors, and glassmorphism (backdrop blurs).

Chrome-less & Immersive: The editor canvas is the hero. Minimize heavy, distracting borders and permanent sidebars. Hide advanced actions behind a Cmd+K command palette to keep the workspace clean.

Keyboard-First / Developer-Native: The app should feel like a power-tool. Keyboard shortcuts must exist for all primary actions.

Focus-Driven: When the AI is generating code or a collision is being resolved, subtly dim the rest of the editor to draw the user's eye to the active workflow.

Tactile & Crisp: Elements should feel responsive. Buttons, tooltips, and terminal commands should have immediate visual feedback (hover states, active scaling, and focus rings).

Deep Typography Guidelines

The Strategy: The visual language must blend the highly readable, technical feel of monospace fonts (for the code canvas) with crisp, modern sans-serif fonts (for the UI chrome).

UI Typeface: Use Geist Sans or Inter. Why? Because they are neutral, highly legible variable fonts that "disappear" into the interface, allowing the code to be the star. They offer robust weights that allow for clear visual hierarchy without needing to constantly change font sizes.

Code Typeface: Use JetBrains Mono or Geist Mono. Why? Developer tools require specialized fonts. These fonts have distinct character spacing (eliminating confusion between l, I, and 1), excellent vertical rhythm, and beautiful ligatures (e.g., =>, !==) which reduce cognitive load when scanning code.

Alignment & Legibility: Optimize for maximum legibility (e.g., contrasting treatments for headlines vs. smaller body text). Crucially: Align different fonts strictly by their baseline. This ensures the UI maintains a rhythmic visual grid even when UI Sans text and Code Monospace text sit side-by-side. Utilize typefaces with a comprehensive range of weights, and apply letter-spacing effectively (e.g., slightly increasing tracking/letter-spacing on all-caps subheadings).

The Mathematical Color Palette (HSL & Accessibility)

The HSL Mandate: All colors MUST be defined exclusively using HSL (Hue, Saturation, Lightness). Do not use Hex or RGB.

Refactoring UI Principle: Using HSL allows us to programmatically generate a harmonious color palette. By picking a base color and keeping the Hue (the color itself) and Saturation (the intensity) constant, we can create perfect shades simply by stepping the Lightness parameter up or down (e.g., from hsl(210, 100%, 10%) for dark text to hsl(210, 100%, 96%) for a light background).

Accessibility & Contrast: The design must ensure proper contrast between text and background to guarantee accessibility, strictly adhering to WCAG guidelines. Important actions must have high contrast ratios to be immediately visible.

Seamless Dark/Light Mode: The UI must support both Dark Mode and Light Mode seamlessly, defaulting to the user's system preference.

Development Note: Dark mode is NOT just inverting colors. Pure white text on pure black backgrounds causes visual halation and eye strain. Dark mode should utilize very dark grays (e.g., hsl(220, 10%, 10%)) with off-white text (e.g., hsl(220, 10%, 90%)) to maintain a soothing, professional look.

No Hardcoding: Never use rogue HSL values or arbitrary pixel values outside the Tailwind theme configuration to guarantee absolute design consistency.

Refactoring UI Layout Principles

Visual Hierarchy: Establish clear hierarchy by strategically emphasizing important elements and de-emphasizing secondary information. Rely on color contrast, font weights, and opacity rather than just relying on sizing.

Airy & Spacious: Prioritize generous padding and margins. It is always better to have too much whitespace than too little. Use spacing effectively to group related elements and give the UI an airy, modern feel.

Border Radiuses & Softness: Avoid harsh, sharp 90-degree corners. Use varying degrees of border-radius to make the UI feel modern, friendly, and approachable.

Use fully rounded borders (rounded-full) for pills, tags, and primary floating action buttons.

Use medium to large radiuses (rounded-lg, rounded-xl) for panels, AI Zone Widgets, and modals to create a soft, tactile aesthetic.

Modern & Uncluttered: Keep the interface clean. Each page and panel must have clearly defined primary actions based on their importance, avoiding visual clutter.

Interactive Elements: Modals, Dialogs & Notifications

To maintain a fluid "Figma for Code" experience, the usage of interactive UI elements must be heavily regulated so they do not break the user's flow:

Inline First: The default state for any interaction should be inline. Do not open a new page or modal if an action can be performed directly within the workspace (e.g., AI prompting should happen in a floating Zone Widget inside the editor, not a popup).

Modals & Dialogs: Use sparingly. Only use center-screen blocking modals for critical, destructive, or complex multi-step actions where losing focus would be detrimental (e.g., "Are you sure you want to delete this workspace?", or "Invite team members"). If it doesn't require the user to completely stop what they are doing, do not use a modal.

Popovers & Command Palettes: Use dropdowns, popovers, and a global command palette (Cmd+K) for settings, agent switching, and non-blocking interactions. These should dismiss instantly when clicking outside or pressing Esc.

Toasts & Snackbars: Use toasts for ephemeral success or non-critical state changes (e.g., "Link copied to clipboard", "AI generation complete"). Toasts should auto-dismiss and never block the UI. Do not use toasts for critical errors that require user action.

Comprehensive Error Handling Strategy

A robust error handling strategy is non-negotiable. Users should never see raw stack traces, generic "Something went wrong" messages, or infinitely spinning loaders.

Actionable & Human-Readable Errors: If something fails, the UI must explain What happened, Why it happened, and How to fix it.

Bad: "Error 500: WebSocket connection failed."

Good: "Lost connection to the workspace. We're automatically trying to reconnect. [Retry Now]"

Graceful Degradation: If a secondary service goes down (e.g., the Time-Travel CRDT cron-job fails), the primary UI (the code editor) must continue to function. Disable the broken feature visually (e.g., gray out the Time-Travel button) rather than crashing the whole page.

Inline Validation & Feedback: For code execution errors, do not use global popups. Instead, pipe the error directly into the terminal UI, or use Monaco's native error markers (red squiggly lines) to highlight exactly where the code failed.

Optimistic UI: When a user performs an action (like accepting an AI code block), update the UI instantly as if the server request succeeded. If the server request subsequently fails, gently revert the UI state and inform the user why it failed. This makes the app feel incredibly fast.

Loading States (Skeletons over Spinners): When fetching data or waiting for AI responses, avoid full-screen blocking spinners. Use skeleton loaders or localized loading states (e.g., a shimmering pulse effect on the specific AI Zone Widget) so the user can continue working elsewhere in the file.

React Component Architecture

Encapsulation & Extraction: Encapsulate features into functional React components. If a component is reused across multiple files, extract it into a shared UI folder.

Conflict Reduction: Even if a component is only used within a single file, extract self-contained parts (e.g., a complex modal or a toolbar) into their own local sub-components. This dramatically improves encapsulation and reduces Git merge conflicts during simultaneous team editing.

Next.js Server-First Approach: Maximize the use of React Server Components (RSC) to ship less JavaScript to the client. Fetch data directly from Prisma within Server Components and use Server Actions for standard mutations. Only use the 'use client' directive where absolutely necessary (e.g., for interactivity, hooks, or libraries like Monaco/Xterm). When required, push 'use client' as far down the component tree as possible to encapsulate the interactivity in the smallest possible sections.

4. Comprehensive End-User Use Cases

This section outlines the platform's functionality from the end-user's perspective, maximizing UX while detailing the underlying development requirements.

Use Case 1: Multi-Human Real-Time Collaboration

Description: Multiple users join a workspace to write code simultaneously without locking files.

Main Flow: 1. User A creates a workspace and shares the link.
2. User B joins. A "Presence Dock" at the top right updates with User B's avatar. Both users see each other's uniquely colored cursors and name-tags floating in the editor.
3. User A types a function; User B sees the text appear instantly with ~50ms latency.

UX Enhancements: * Apply CSS transitions/Framer Motion to the remote cursors so they glide smoothly across the screen instead of teleporting jankily.

Add a subtle pulsing "User B is typing..." indicator near their avatar in the Presence Dock.

Alternative Flow (Offline): User B drops connection. Their avatar turns grayscale. They continue typing. Upon reconnection, the CRDT engine resolves the changes mathematically in the background without prompting the user, and the avatar lights up again.

Dev Note: Use yjs mapped to Monaco via y-monaco. Cursor awareness is handled via Yjs's awareness protocol. Assign a random, accessible HSL color to the user's connection ID.

Use Case 2: Invoking the AI Agent (Notion-Style Blocks)

Description: A user asks the AI to generate code inline, creating a distinct visual block that doesn't disrupt the flow of the document.

Main Flow:

User highlights a block of code and presses Cmd+K.

A small, floating command palette appears exactly at the cursor's location. The input has a context-aware placeholder (e.g., "Ask AI to refactor highlighted text...").

User types the prompt and hits Enter.

The AI response streams into a visually distinct "Zone Widget" (a soft-edged panel inserted between lines of code).

The user reviews the code. They can toggle a "Diff View" button inside the widget to clearly see deletions vs. additions.

The user uses keyboard shortcuts (Cmd+Enter to Accept, Esc to Reject). If accepted, the widget dissolves smoothly, and the code merges into the main file.

UX Enhancements: Do not let text jump unexpectedly. The Zone Widget must reserve vertical space gracefully. Show a subtle shimmering skeleton loading state in the widget before the first token arrives from the LLM.

Dev Note: Use Monaco's IViewZone and ZoneWidget APIs. Broadcast the "AI generating" state via WebSockets so remote users see a lock icon or a loading state over that specific block, preventing them from interfering.

Use Case 3: Handling Collisions ("Smart Merge")

Description: Two users ask the AI to modify the exact same lines of code simultaneously, or a user edits a line the AI is actively rewriting.

Main Flow:

User A and User B prompt the AI on lines 10-15 simultaneously.

Instead of creating a messy layout shift, the UI groups the overlapping requests into a single "Collaboration Thread" widget. Both users' avatars appear on this thread.

The UI detects the overlap and displays a primary "Resolve Conflict via Smart Merge" button.

A user clicks "Smart Merge". The backend sends both proposals to the LLM.

The LLM returns a synthesized block. The widget offers an "Explain Merge" tooltip so the users understand how the AI combined their ideas. Users click "Accept".

Alternative Flow (Irreconcilable Conflict): If the AI returns a CONFLICT flag, the UI smoothly transitions the Zone Widget into a 3-Way Diff viewer (Keep Mine vs. Keep Theirs), allowing manual resolution.

UX Enhancements: Keep the collision UI strictly inline. Do not use an intrusive modal. Dim the surrounding code slightly to focus attention on resolving the merge.

Dev Note: Use Monaco's native diffEditor mounted inside a Zone Widget for the 3-Way Merge fallback.

Use Case 4: Secure Pre-Flight Scan & Code Execution

Description: Running code securely in an isolated, ephemeral environment with immediate visual feedback.

Main Flow:

User clicks the "Run" button (or hits Cmd+R). The button turns into a "Cancel" button.

A status bar briefly indicates "Scanning for vulnerabilities...". The backend intercepts the code and runs a static analysis regex/AST scanner.

The status changes to "Building Environment..." as the system spins up an ephemeral Docker container.

The code executes. The stdout/stderr are piped in real-time to the terminal panel.

Upon success, the terminal header flashes a subtle green.

UX Enhancements: If the execution throws a runtime error, do not just dump it in the terminal. Parse the stack trace and add a red error marker (squiggly line) directly on the offending line of code in the editor, with a hover tooltip explaining the error. Allow the "Cancel" button to immediately kill the Docker container if the user spots an infinite loop.

Alternative Flow (Malicious Code): The scanner detects fs.unlinkSync. Execution aborts instantly. A non-blocking toast notification explains the security violation, and the offending line is highlighted in red.

Dev Note: Use dockerode. Hardcode resource limits: NanoCPUs and Memory inside the HostConfig object.

Use Case 5: Shared Interactive Terminal (Bonus)

Description: A collaborative terminal where commands and outputs are synchronized, built to avoid chaos.

Main Flow:

User A clicks into the terminal panel. The terminal border highlights in User A's assigned color, indicating "User A has the floor".

User A types npm install lodash.

User B sees User A's keystrokes in real-time, but their own terminal input is temporarily disabled to prevent conflicting commands.

The server executes the command. The stdout stream flows simultaneously to both screens.

Once the process finishes and the prompt returns, the terminal "floor" is open again.

UX Enhancements: Visual cues are critical here. If two people type in a terminal at once, it breaks the shell. The "Floor" or "Token" lock concept prevents this while keeping it collaborative.

Dev Note: Connect xterm.js to a Socket.io namespace. Pipe to node-pty (pseudo-terminal). Implement a simple locking mechanism in the WebSocket server based on focus events.

Use Case 6: Time-Travel Debugging (Bonus)

Description: Rewinding the codebase to any previous state like a video player.

Main Flow:

A user realizes a recent refactor broke the code.

User clicks the "Time Travel" toggle. The editor locks into a read-only state, and a timeline slider appears at the bottom of the screen.

The timeline slider acts as an "Activity Heatmap" (denser marks where more lines were changed).

As the user drags the slider, the Monaco editor instantly updates to reflect the code state at that timestamp. Tooltips on the slider show who was active at that time.

The user finds the working state and clicks a prominent "Restore to this point" button. The app creates a new CRDT update restoring the text.

UX Enhancements: The transition into Time-Travel mode should feel distinct—perhaps adding a subtle vignette or changing the editor background slightly to signify "you are looking at the past, this is read-only".

Dev Note: Implement a CRDT cron-job. Every 60 seconds (or on major typing pauses), save the Yjs State Vector to Supabase. The slider fetches and applies these vectors to a read-only Monaco instance.

Use Case 7: The Easter Egg

Description: Rewarding users for trying classic developer tropes.

Main Flow:

A user types sudo rm -rf / into the shared terminal.

Instead of executing, the frontend intercepts the command.

The editor UI aggressively shakes (using a Framer Motion keyframe animation), and the terminal text turns neon red.

A playful message streams in: "> ACCESS DENIED. Nice try, hacker. System integrity maintained."

UX Enhancements: Keep it fast, punchy, and harmless. It shouldn't crash their session or force a page reload.

Dev Note: Add a simple client-side interceptor in the xterm.js keystroke listener before emitting the command to the WebSocket.

Use Case 8: Live Agent Profiling (Advanced)

Description: Assigning different personas to AI agents, treating them like specialized team members.

Main Flow:

User opens the "Agent Roster" side panel.

User configures Agent 1 as "Frontend Lead" (System prompt biased towards React) and Agent 2 as "Security Auditor" (Biased to find vulnerabilities).

When asking for code, the user types @SecurityAuditor check this auth flow in the inline prompt.

The Security Auditor's specific avatar appears in the document, generating the response in a Zone Widget.

UX Enhancements: Make the AI feel present. When an agent is working, show their avatar in the Presence Dock with a "thinking" spinner.

Dev Note: Pass the selected persona's specific system_prompt alongside the user query to the Vercel AI SDK execution block.