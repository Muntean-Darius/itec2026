"use client"

import { useEffect, useMemo, useState } from "react"
import { io, type Socket } from "socket.io-client"

type UseSessionSocketResult = {
  socket: Socket | null
  connected: boolean
  connectError: string | null
}

export function useSessionSocket(projectId: string): UseSessionSocketResult {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  const serverUrl = useMemo(
    () => process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000",
    []
  )

  useEffect(() => {
    if (!projectId) return

    const nextSocket = io(serverUrl, {
      auth: { projectId },
      query: { projectId },
    })

    const handleConnect = () => {
      setConnected(true)
      setConnectError(null)
    }

    const handleDisconnect = () => {
      setConnected(false)
    }

    const handleConnectError = (error: Error) => {
      setConnectError(error.message)
      setConnected(false)
    }

    nextSocket.on("connect", handleConnect)
    nextSocket.on("disconnect", handleDisconnect)
    nextSocket.on("connect_error", handleConnectError)

    setSocket(nextSocket)

    return () => {
      nextSocket.off("connect", handleConnect)
      nextSocket.off("disconnect", handleDisconnect)
      nextSocket.off("connect_error", handleConnectError)
      nextSocket.disconnect()
      setSocket(null)
      setConnected(false)
    }
  }, [projectId, serverUrl])

  return { socket, connected, connectError }
}
