"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface NewFileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingPaths: string[]
  onCreateFile: (path: string) => void
}

export function NewFileDialog({
  open,
  onOpenChange,
  existingPaths,
  onCreateFile,
}: NewFileDialogProps) {
  const [path, setPath] = useState("")
  const normalizedPath = path.startsWith("/") ? path : "/" + path
  const alreadyExists = existingPaths.includes(normalizedPath)

  const handleCreate = () => {
    if (!path.trim() || alreadyExists) return
    onCreateFile(path.trim())
    setPath("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create new file</DialogTitle>
          <DialogDescription>
            Enter the file path relative to the project root. Folders will be
            created automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="py-3">
          <Input
            placeholder="/src/components/NewComponent.tsx"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate()
            }}
            autoFocus
            className="font-mono text-sm"
          />
          {alreadyExists && (
            <p className="mt-2 text-xs text-error">
              A file already exists at this path.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!path.trim() || alreadyExists} onClick={handleCreate}>
            Create file
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
