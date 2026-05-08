/**
 * Component to display list of chat messages and generated images
 * interleaved in chronological order.
 */
import { useEffect, useRef } from 'react'
import { Message } from './Message'
import { GeneratedImageComponent } from './GeneratedImage'
import type { ChatMessage } from '@/hooks/useChat'
import type { GeneratedImage } from '@/hooks/useImageGeneration'

interface MessageListProps {
  messages: ChatMessage[]
  isLoading: boolean
  generatedImages?: GeneratedImage[]
}

type TimelineItem =
  | { type: 'message'; data: ChatMessage; time: number }
  | { type: 'image'; data: GeneratedImage; time: number }

export const MessageList = ({
  messages,
  isLoading,
  generatedImages = [],
}: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, generatedImages])

  if (messages.length === 0 && generatedImages.length === 0) {
    return (
      <div className="chat-messages-wrap empty">
        <div className="chat-welcome">
          <h2>Welcome to Amzur Chat</h2>
          <p>Start a conversation by typing a message below.</p>
          <p className="text-sm text-gray-400 mt-4">
            You can also generate AI images by mentioning:
            <br />
            "generate image of...", "design a...", "create a logo...", etc.
          </p>
        </div>
      </div>
    )
  }

  // Merge messages and images into a single chronological timeline
  const timeline: TimelineItem[] = [
    ...messages.map((m) => ({
      type: 'message' as const,
      data: m,
      time: m.timestamp instanceof Date ? m.timestamp.getTime() : new Date(m.timestamp).getTime(),
    })),
    ...generatedImages.map((img) => ({
      type: 'image' as const,
      data: img,
      time: new Date(img.created_at).getTime(),
    })),
  ].sort((a, b) => a.time - b.time)

  return (
    <div className="chat-messages-wrap">
      <div className="chat-messages-inner">
        {timeline.map((item) =>
          item.type === 'message' ? (
            <Message
              key={`msg-${item.data.id}`}
              role={item.data.role}
              content={item.data.content}
              attachments={item.data.attachments}
            />
          ) : (
            <div key={`img-${item.data.id}`} className="px-4 py-2">
              <GeneratedImageComponent image={item.data} />
            </div>
          )
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="chat-loading">
            <div className="chat-loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
