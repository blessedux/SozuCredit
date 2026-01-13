"use client"

import { useState, useEffect } from "react"

interface TypingMessageProps {
  messages: string[]
  typingSpeed?: number
  pauseBetweenMessages?: number
  className?: string
}

export function TypingMessage({
  messages,
  typingSpeed = 50,
  pauseBetweenMessages = 2000,
  className = "",
}: TypingMessageProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState("")
  const [isTyping, setIsTyping] = useState(true)

  useEffect(() => {
    if (messages.length === 0) return

    const currentMessage = messages[currentMessageIndex]
    let charIndex = 0
    let timeoutId: NodeJS.Timeout

    const typeNextChar = () => {
      if (charIndex < currentMessage.length) {
        setDisplayedText(currentMessage.substring(0, charIndex + 1))
        charIndex++
        timeoutId = setTimeout(typeNextChar, typingSpeed)
      } else {
        // Finished typing current message, pause then move to next
        setIsTyping(false)
        timeoutId = setTimeout(() => {
          setDisplayedText("")
          setIsTyping(true)
          setCurrentMessageIndex((prev) => (prev + 1) % messages.length)
        }, pauseBetweenMessages)
      }
    }

    // Start typing
    typeNextChar()

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [currentMessageIndex, messages, typingSpeed, pauseBetweenMessages])

  return (
    <div className={`flex items-center justify-center w-full ${className}`}>
      <div className="text-2xl md:text-3xl font-medium text-white/90 text-center">
        {displayedText}
        {isTyping && (
          <span className="inline-block w-0.5 h-6 md:h-8 bg-white/90 ml-1 animate-pulse" />
        )}
      </div>
    </div>
  )
}
