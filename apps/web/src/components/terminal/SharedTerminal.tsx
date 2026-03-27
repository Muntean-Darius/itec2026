"use client"

import { useEffect, useRef, useState } from "react"
import { Terminal } from "xterm"
import { FitAddon } from "xterm-addon-fit"
import "xterm/css/xterm.css"
import { ChevronDown, ChevronUp, Maximize2, Trash2 } from "lucide-react"

interface SharedTerminalProps {
  output?: string[]
  defaultOpen?: boolean
}

export function SharedTerminal({ output = [], defaultOpen = true }: SharedTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [activeTab, setActiveTab] = useState<"terminal" | "output">("terminal")

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      theme: {
        background:          "#070F1A",
        foreground:          "#E4EEFF",
        cursor:              "#4F86F7",
        cursorAccent:        "#070F1A",
        selectionBackground: "rgba(79,134,247,0.2)",
        black:               "#070F1A",
        brightBlack:         "#3E5578",
        cyan:                "#4F86F7",
        brightCyan:          "#7AAEFF",
        green:               "#5EBC70",
        brightGreen:         "#7DC940",
        yellow:              "#C9AA2A",
        brightYellow:        "#D4B83A",
        red:                 "#C23B3B",
        brightRed:           "#D64F4F",
        magenta:             "#9B8AFA",
        blue:                "#4F86F7",
        white:               "#E4EEFF",
        brightWhite:         "#F0F4FF",
      },
      fontFamily: '"JetBrains Mono", "Fira Mono", monospace',
      fontSize:   12,
      lineHeight: 1.6,
      cursorBlink:  true,
      cursorStyle:  "block",
      disableStdin: true,
      scrollback:   2000,
      convertEol:   true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    term.writeln("\x1b[34m$\x1b[0m Session started")
    term.writeln("")

    termRef.current     = term
    fitAddonRef.current = fitAddon

    const ro = new ResizeObserver(() => fitAddonRef.current?.fit())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      term.dispose()
      termRef.current     = null
      fitAddonRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isOpen) setTimeout(() => fitAddonRef.current?.fit(), 50)
  }, [isOpen])

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
        {(["terminal", "output"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex items-center gap-1 px-3 h-full text-xs transition-colors capitalize"
            style={{
              color:        activeTab === tab ? "var(--foreground)" : "var(--text-sec)",
              borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {tab}
          </button>
        ))}

        <div className="flex items-center gap-0.5 ml-auto">
          <button
            onClick={clearTerminal}
            title="Clear"
            className="size-[22px] flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-sec)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
          >
            <Trash2 className="size-3" />
          </button>
          <button
            onClick={() => fitAddonRef.current?.fit()}
            title="Fit"
            className="size-[22px] flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-sec)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
          >
            <Maximize2 className="size-3" />
          </button>
          <button
            onClick={() => setIsOpen(o => !o)}
            title={isOpen ? "Collapse" : "Expand"}
            className="size-[22px] flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-sec)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
          >
            {isOpen ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
          </button>
        </div>
      </div>

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
