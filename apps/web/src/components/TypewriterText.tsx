"use client"

import { useState, useEffect } from "react"

interface TypewriterTextProps {
  words: string[]
  className?: string
  typingSpeed?: number
  deletingSpeed?: number
  holdDuration?: number
}

export function TypewriterText({
  words,
  className,
  typingSpeed = 85,
  deletingSpeed = 45,
  holdDuration = 1800,
}: TypewriterTextProps) {
  const [idx, setIdx] = useState(0)
  const [text, setText] = useState("")
  const [phase, setPhase] = useState<"typing" | "hold" | "deleting">("typing")

  useEffect(() => {
    const word = words[idx]
    let timer: ReturnType<typeof setTimeout>

    if (phase === "typing") {
      if (text.length < word.length) {
        timer = setTimeout(() => setText(word.slice(0, text.length + 1)), typingSpeed)
      } else {
        timer = setTimeout(() => setPhase("hold"), holdDuration)
      }
    } else if (phase === "hold") {
      timer = setTimeout(() => setPhase("deleting"), 200)
    } else {
      if (text.length > 0) {
        timer = setTimeout(() => setText(t => t.slice(0, -1)), deletingSpeed)
      } else {
        setIdx(i => (i + 1) % words.length)
        setPhase("typing")
      }
    }

    return () => clearTimeout(timer)
  }, [text, phase, idx, words, typingSpeed, deletingSpeed, holdDuration])

  return (
    <span className={className}>
      {text}
      <span className="animate-blink" style={{ color: "var(--accent)" }}>|</span>
    </span>
  )
}
