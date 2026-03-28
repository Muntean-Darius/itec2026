"use client"

import { useEffect } from "react"
import {
  FileCode2,
  Search,
  Play,
  PanelLeft,
  Terminal,
  History,
  Bot,
  Keyboard,
} from "lucide-react"
import type { FileNode } from "@/data/types"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  files: FileNode[]
  onOpenFile: (path: string) => void
}

export function CommandPalette({
  open,
  onOpenChange,
  files,
  onOpenFile,
}: CommandPaletteProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 max-w-lg border-brand-muted-border shadow-2xl">
        <Command className="bg-elevated">
          <CommandInput placeholder="Type a command or search files..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading="Files">
              {files.map((file) => (
                <CommandItem
                  key={file.path}
                  value={file.path}
                  onSelect={() => {
                    onOpenFile(file.path)
                    onOpenChange(false)
                  }}
                >
                  <FileCode2 className="mr-2 h-4 w-4 text-text-tertiary" />
                  <span className="truncate">{file.path}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Actions">
              <CommandItem>
                <Play className="mr-2 h-4 w-4 text-success" />
                Run Code
                <CommandShortcut>⌘⇧R</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <Search className="mr-2 h-4 w-4" />
                Search in Files
                <CommandShortcut>⌘⇧F</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <PanelLeft className="mr-2 h-4 w-4" />
                Toggle Sidebar
                <CommandShortcut>⌘B</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <Terminal className="mr-2 h-4 w-4" />
                Toggle Terminal
                <CommandShortcut>⌘`</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <History className="mr-2 h-4 w-4" />
                Time Travel
              </CommandItem>
              <CommandItem>
                <Bot className="mr-2 h-4 w-4 text-ai" />
                Ask AI Agent
                <CommandShortcut>⌘J</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <Keyboard className="mr-2 h-4 w-4" />
                Keyboard Shortcuts
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
