"use client"

import { useEffect, useRef, useState } from "react"
import { Terminal } from "xterm"
import { FitAddon } from "xterm-addon-fit"
import "xterm/css/xterm.css"
import { ChevronDown, ChevronUp, Maximize2, Trash2 } from "lucide-react"

interface SharedTerminalProps {
  output?: string[]
  defaultOpen?: boolean
  onCommand?: (command: string) => void
}

export function SharedTerminal({
  output = [],
  defaultOpen = true,
  onCommand,
}: SharedTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const inputBufferRef = useRef("")
  const renderedCountRef = useRef(0)
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [activeTab, setActiveTab] = useState<"terminal" | "output">("terminal")

  // Initialize xterm
  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      theme: {
        // Backgrounds using HSL-derived values
        background:          "#0c0e15",  // hsl(230,18%,5%) → terminal bg
        foreground:          "#d9dde8",  // text-primary
        cursor:              "#6366f1",  // brand
        cursorAccent:        "#0c0e15",
        selectionBackground: "rgba(99, 102, 241, 0.18)",
        black:               "#0c0e15",
        brightBlack:         "#505870",
        cyan:                "#2dd4bf",  // ai / teal
        brightCyan:          "#5eead4",
        green:               "#4ade80",  // success
        brightGreen:         "#86efac",
        yellow:              "#d4a017",  // warning
        brightYellow:        "#fbbf24",
        red:                 "#c0392b",  // error
        brightRed:           "#ef4444",
        magenta:             "#a78bfa",  // keyword purple
        blue:                "#6366f1",  // brand
        white:               "#d9dde8",
        brightWhite:         "#f1f3f8",
      },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 12,
      lineHeight: 1.5,
      cursorBlink: true,
      cursorStyle: "block",
      disableStdin: false,
      scrollback: 2000,
      convertEol: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    // Welcome message
    term.writeln("\x1b[34m$\x1b[0m Session started — iTECify terminal")
    term.writeln("")
    term.write("\x1b[34m$\x1b[0m ")
    renderedCountRef.current = 0

    // Handle input
    term.onData((data) => {
      // Enter
      if (data === "\r") {
        const command = inputBufferRef.current.trim()
        term.writeln("")
        if (command) {
          onCommand?.(command)
        }
        inputBufferRef.current = ""
        term.write("\x1b[34m$\x1b[0m ")
        return
      }

      // Backspace
      if (data === "\u007f") {
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1)
          term.write("\b \b")
        }
        return
      }

      // Ctrl+C
      if (data === "\u0003") {
        inputBufferRef.current = ""
        term.writeln("^C")
        term.write("\x1b[34m$\x1b[0m ")
        return
      }

      // Printable characters
      if (data >= " " && data !== "\u007f") {
        inputBufferRef.current += data
        term.write(data)
      }
    })

    termRef.current = term
    fitAddonRef.current = fitAddon

    const ro = new ResizeObserver(() => fitAddonRef.current?.fit())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }
  }, [])

  // Refit on open/close
  useEffect(() => {
    if (isOpen) setTimeout(() => fitAddonRef.current?.fit(), 50)
  }, [isOpen])

  // Render incoming output
  useEffect(() => {
    if (!termRef.current || output.length === 0) return
    const start = Math.max(renderedCountRef.current, 0)
    const newLines = output.slice(start)
    if (newLines.length === 0) return

    for (const line of newLines) {
      termRef.current.writeln(line)
    }
    renderedCountRef.current = output.length
    termRef.current.write("\x1b[34m$\x1b[0m ")
  }, [output])

  function clearTerminal() {
    termRef.current?.clear()
    renderedCountRef.current = output.length
    termRef.current?.write("\x1b[34m$\x1b[0m ")
  }

  const tabs = ["terminal", "output"] as const

  return (
    <div
      className="flex flex-col h-full border-t border-border"
      style={{ background: "var(--bg-terminal)" }}
    >
      {/* Header */}
      <div className="flex items-center h-9 px-3 border-b border-border bg-surface shrink-0">
        {/* Tabs */}
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              flex items-center gap-1 px-3 h-full text-xs capitalize transition-colors
              border-b-2 -mb-px
              ${
                activeTab === tab
                  ? "text-text-primary border-brand"
                  : "text-text-secondary border-transparent hover:text-text-primary"
              }
            `}
          >
            {tab}
          </button>
        ))}

        {/* Right actions */}
        <div className="flex items-center gap-0.5 ml-auto">
          <button
            onClick={clearTerminal}
            title="Clear terminal"
            className="size-6 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <Trash2 className="size-3" />
          </button>
          <button
            onClick={() => fitAddonRef.current?.fit()}
            title="Fit to window"
            className="size-6 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <Maximize2 className="size-3" />
          </button>
          <button
            onClick={() => setIsOpen((o) => !o)}
            title={isOpen ? "Collapse" : "Expand"}
            className="size-6 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-secondary transition-colors"
          >
            {isOpen ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
          </button>
        </div>
      </div>

      {/* Terminal content */}
      {isOpen && (
        <div
          ref={containerRef}
          className="flex-1 min-h-0"
          style={{ padding: "8px 4px 8px 12px" }}
        />
      )}
    </div>
  )
}
