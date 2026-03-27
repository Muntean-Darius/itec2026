"use client"

import { useEffect, useRef, useState } from "react"
import { Terminal } from "xterm"
import { FitAddon } from "xterm-addon-fit"
import "xterm/css/xterm.css"
import { ChevronDown, ChevronUp, Maximize2, Trash2 } from "lucide-react"

interface SharedTerminalProps {
  /** Lines of output pushed in from outside (e.g. socket events) */
  output?: string[]
  defaultOpen?: boolean
}

export function SharedTerminal({ output = [], defaultOpen = true }: SharedTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [activeTab, setActiveTab] = useState<"terminal" | "output">("terminal")

  // Mount xterm
  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      theme: {
        background:   "#0A0D12",
        foreground:   "#9CA3AF",
        cursor:       "#00D9C0",
        cursorAccent: "#0A0D12",
        selectionBackground: "rgba(0,217,192,0.2)",
        black:        "#0A0D12",
        brightBlack:  "#484F58",
        cyan:         "#00D9C0",
        brightCyan:   "#00D9C0",
        green:        "#4ADE80",
        yellow:       "#FCD34D",
        red:          "#F87171",
        magenta:      "#A78BFA",
        blue:         "#60A5FA",
        white:        "#E6EDF3",
        brightWhite:  "#E6EDF3",
      },
      fontFamily: '"JetBrains Mono", "Fira Mono", monospace',
      fontSize:   12,
      lineHeight: 1.6,
      cursorBlink:    true,
      cursorStyle:    "block",
      disableStdin:   true, // read-only; backend streams output
      scrollback:     2000,
      convertEol:     true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    // Welcome line
    term.writeln("\x1b[36m$\x1b[0m Session started")
    term.writeln("")

    termRef.current    = term
    fitAddonRef.current = fitAddon

    const ro = new ResizeObserver(() => fitAddonRef.current?.fit())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      term.dispose()
      termRef.current    = null
      fitAddonRef.current = null
    }
  }, [])

  // Re-fit when panel is opened
  useEffect(() => {
    if (isOpen) setTimeout(() => fitAddonRef.current?.fit(), 50)
  }, [isOpen])

  // Stream incoming output lines
  useEffect(() => {
    if (!termRef.current || output.length === 0) return
    termRef.current.writeln(output[output.length - 1])
  }, [output])

  function clearTerminal() {
    termRef.current?.clear()
  }

  return (
    <div
      className="flex flex-col shrink-0 border-t border-border"
      style={{ background: "var(--terminal-bg)", height: isOpen ? 210 : 33 }}
    >
      {/* Terminal header */}
      <div
        className="flex items-center shrink-0 border-b border-border px-3"
        style={{ height: 33, background: "var(--panel)" }}
      >
        {/* Tabs */}
        {(["terminal", "output"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex items-center gap-1 px-3 h-full text-xs transition-colors capitalize"
            style={{
              color:          activeTab === tab ? "var(--foreground)" : "var(--text-sec)",
              borderBottom:   activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom:   "-1px",
            }}
          >
            {tab}
          </button>
        ))}

        {/* Actions */}
        <div className="flex items-center gap-0.5 ml-auto">
          <button
            onClick={clearTerminal}
            title="Clear"
            className="size-[22px] flex items-center justify-center rounded transition-colors"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-sec)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
          >
            <Trash2 className="size-3" />
          </button>
          <button
            onClick={() => fitAddonRef.current?.fit()}
            title="Fit"
            className="size-[22px] flex items-center justify-center rounded transition-colors"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-sec)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
          >
            <Maximize2 className="size-3" />
          </button>
          <button
            onClick={() => setIsOpen(o => !o)}
            title={isOpen ? "Collapse" : "Expand"}
            className="size-[22px] flex items-center justify-center rounded transition-colors"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-sec)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
          >
            {isOpen ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
          </button>
        </div>
      </div>

      {/* xterm container */}
      {isOpen && (
        <div
          ref={containerRef}
          className="flex-1 min-h-0"
          style={{ padding: "10px 4px 10px 14px" }}
        />
      )}
    </div>
  )
}
