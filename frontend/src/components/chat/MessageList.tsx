/**
 * Component to display list of chat messages.
 */
import { useEffect, useRef } from 'react'
import { Message } from './Message'
import type { ChatMessage } from '@/hooks/useChat'

interface MessageListProps {
  messages: ChatMessage[]
  isLoading: boolean
}

export const MessageList = ({ messages, isLoading }: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (messages.length === 0) {
    return (
      <div className="chat-messages-wrap empty">
        <div className="chat-welcome">
          <h2>Welcome to Amzur Chat</h2>
          <p>Start a conversation by typing a message below.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-messages-wrap">
      <div className="chat-messages-inner">
        {messages.map((message) => (
          <Message
            key={message.id}
            role={message.role}
            content={message.content}
          />
        ))}
        {isLoading && (
          <div className="chat-loading">
            <div className="chat-loading-dots">
              <span></span>
              <span></span>
              <span></span>
              </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
