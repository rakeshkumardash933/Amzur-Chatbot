/**
 * Custom hook for managing chat state and API communication.
 */
import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  sendMessage: (message: string) => Promise<void>
  clearChat: () => void
  chatId: number | null
  setActiveChatId: (chatId: number | null) => void
}

export const useChat = (chatId: number | null): UseChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeChatId, setActiveChatId] = useState<number | null>(chatId)
  const { token } = useAuth()

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

  useEffect(() => {
    setActiveChatId(chatId)
  }, [chatId])

  const loadMessages = useCallback(async (cid: number) => {
    if (!token) return

    try {
      const response = await fetch(`${apiUrl}/chats/${cid}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load messages')
      }

      const data = await response.json()
      setMessages(
        data.messages.map((msg: any, idx: number) => ({
          id: String(msg.id || `msg_${idx}`),
          role: msg.sender as 'user' | 'assistant',
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        }))
      )
    } catch (err) {
      console.error('Failed to load messages:', err)
      setError('Failed to load chat messages')
    }
  }, [apiUrl, token])

  useEffect(() => {
    if (activeChatId && token) {
      void loadMessages(activeChatId)
    } else {
      setMessages([])
    }
  }, [activeChatId, token, loadMessages])

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || !token) return

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`${apiUrl}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: userMessage,
            chat_id: activeChatId,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.detail || 'Failed to get response')
        }

        const data = await response.json()
        if (data.chat_id && data.chat_id !== activeChatId) {
          setActiveChatId(data.chat_id)
        }

        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMsg])
      } catch (err) {
        setMessages((prev) => prev.filter((msg) => msg.id !== userMsg.id))
        const message = err instanceof Error ? err.message : 'Failed to get response from AI'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [activeChatId, apiUrl, token]
  )

  const clearChat = useCallback(async () => {
    if (!activeChatId || !token) return

    try {
      const response = await fetch(`${apiUrl}/chats/${activeChatId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete chat')
      }

      setMessages([])
      setError(null)
      setActiveChatId(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete chat'
      setError(message)
    }
  }, [activeChatId, apiUrl, token])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    chatId: activeChatId,
    setActiveChatId,
  }
}
