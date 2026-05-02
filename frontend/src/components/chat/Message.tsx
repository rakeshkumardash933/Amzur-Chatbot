/**
 * Component to display a single chat message with typing effect.
 */
import { useEffect, useState } from 'react'

interface MessageProps {
  role: 'user' | 'assistant'
  content: string
}

export const Message = ({ role, content }: MessageProps) => {
  const [displayedContent, setDisplayedContent] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    if (role === 'assistant') {
      // Typing effect for assistant messages
      setIsTyping(true)
      let index = 0
      const interval = setInterval(() => {
        if (index < content.length) {
          setDisplayedContent(content.substring(0, index + 1))
          index++
        } else {
          setIsTyping(false)
          clearInterval(interval)
        }
      }, 20)

      return () => clearInterval(interval)
    } else {
      setIsTyping(false)
      setDisplayedContent(content)
    }
  }, [content, role])

  const isUser = role === 'user'

  return (
    <div className={isUser ? 'chat-message-row user' : 'chat-message-row bot'}>
      <div className={isUser ? 'chat-message user' : 'chat-message bot'}>
        <p>{displayedContent}</p>
        {isTyping && <span className="chat-typing-cursor">▊</span>}
      </div>
    </div>
  )
}
