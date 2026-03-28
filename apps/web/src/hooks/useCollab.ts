"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MonacoBinding } from "y-monaco"
import { WebsocketProvider } from "y-websocket"
import * as Y from "yjs"

import type { MonacoEditor } from "@/components/editor/CodeEditor"

export function useCollab(projectId: string) {
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<"connected" | "disconnected" | "connecting">("connecting")

  const providerRef = useRef<WebsocketProvider | null>(null)
  const docRef = useRef<Y.Doc | null>(null)
  const bindingRef = useRef<MonacoBinding | null>(null)
  const editorRef = useRef<MonacoEditor | null>(null)

  const websocketUrl = useMemo(
    () => process.env.NEXT_PUBLIC_YJS_URL ?? "ws://localhost:4000/yjs",
    []
  )

  const createBinding = useCallback(() => {
    const editor = editorRef.current
    const provider = providerRef.current
    const doc = docRef.current

    if (!editor || !provider || !doc) return

    const model = editor.getModel()
    if (!model) return

    bindingRef.current?.destroy()

    const yText = doc.getText("monaco")
    bindingRef.current = new MonacoBinding(
      yText,
      model,
      new Set([editor]),
      provider.awareness
    )
  }, [])

  const bindEditor = useCallback(
    (editor: MonacoEditor) => {
      editorRef.current = editor
      createBinding()
    },
    [createBinding]
  )

  useEffect(() => {
    if (!projectId) return

    const doc = new Y.Doc()
    const provider = new WebsocketProvider(websocketUrl, projectId, doc)

    const onStatus = (event: { status: "connected" | "disconnected" | "connecting" }) => {
      setStatus(event.status)
      setConnected(event.status === "connected")
    }

    provider.on("status", onStatus)

    docRef.current = doc
    providerRef.current = provider

    createBinding()

    return () => {
      bindingRef.current?.destroy()
      bindingRef.current = null
      provider.destroy()
      doc.destroy()
      providerRef.current = null
      docRef.current = null
      setConnected(false)
      setStatus("disconnected")
    }
  }, [projectId, websocketUrl, createBinding])

  return {
    bindEditor,
    connected,
    status,
  }
}
