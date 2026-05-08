/**
 * Custom hook for managing chat state and API communication.
 */
import { useState, useCallback, useEffect } from 'react'
import { useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { Attachment, PendingAttachment } from '@/types'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  attachments?: Attachment[]
}

interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  sendMessage: (message: string) => Promise<void>
  addLocalMessage: (role: 'user' | 'assistant', content: string) => void
  clearChat: () => Promise<boolean>
  chatId: number | null
  setActiveChatId: (chatId: number | null) => void
  pendingAttachments: PendingAttachment[]
  uploadAttachment: (file: File) => Promise<void>
  removeAttachment: (tempId: string) => void
}

export const useChat = (chatId: number | null): UseChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeChatId, setActiveChatId] = useState<number | null>(chatId)
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const pendingRef = useRef<PendingAttachment[]>([])
  const { token } = useAuth()

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

  useEffect(() => {
    setActiveChatId(chatId)
  }, [chatId])

  // Clear pending attachments whenever the active thread changes
  useEffect(() => {
    setPendingAttachments([])
    pendingRef.current = []
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
          attachments: msg.attachments ?? [],
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
      const snapshot = pendingRef.current
      const attachmentIds = snapshot.filter((a) => !a.isUploading && a.id).map((a) => a.id!)
      const hasContent = userMessage.trim().length > 0 || attachmentIds.length > 0
      if (!hasContent || !token) return

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: userMessage.trim(),
        timestamp: new Date(),
        attachments: snapshot.filter((a) => a.id).map((a) => ({
          id: a.id!,
          file_name: a.file_name,
          file_type: a.file_type,
          file_url: '',
        })),
      }
      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)
      setError(null)
      // Clear pending immediately so previews don't persist after send
      setPendingAttachments([])
      pendingRef.current = []

      try {
        const response = await fetch(`${apiUrl}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: userMessage.trim(), chat_id: activeChatId, attachment_ids: attachmentIds }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.detail || 'Failed to get response')
        }

        const data = await response.json()
        if (data.chat_id && data.chat_id !== activeChatId) setActiveChatId(data.chat_id)

        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          attachments: [],
        }
        setMessages((prev) => [...prev, assistantMsg])
      } catch (err) {
        setMessages((prev) => prev.filter((msg) => msg.id !== userMsg.id))
        const message = err instanceof Error ? err.message : 'Failed to get response from AI'
        setError(message)
        // Restore pending on failure so user can retry
        setPendingAttachments(snapshot)
        pendingRef.current = snapshot
      } finally {
        setIsLoading(false)
      }
    },
    [activeChatId, apiUrl, token]
  )

  // ── File upload ────────────────────────────────────────────────────────────
  const uploadAttachment = useCallback(async (file: File) => {
    if (!activeChatId || !token) return
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    const pending: PendingAttachment = { tempId, file_name: file.name, file_type: file.type, preview, isUploading: true }
    setPendingAttachments((prev) => { const next = [...prev, pending]; pendingRef.current = next; return next })
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('thread_id', String(activeChatId))
      const res = await fetch(`${apiUrl}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
      if (!res.ok) { const e = await res.json().catch(() => ({ detail: 'Upload failed' })); throw new Error(e.detail) }
      const data = await res.json()
      setPendingAttachments((prev) => {
        const next = prev.map((a) => a.tempId === tempId ? { ...a, id: data.id, isUploading: false } : a)
        pendingRef.current = next; return next
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setPendingAttachments((prev) => {
        const next = prev.map((a) => a.tempId === tempId ? { ...a, isUploading: false, error: msg } : a)
        pendingRef.current = next; return next
      })
    }
  }, [activeChatId, apiUrl, token])

  const removeAttachment = useCallback((tempId: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((a) => a.tempId === tempId)
      if (target?.preview) URL.revokeObjectURL(target.preview)
      const next = prev.filter((a) => a.tempId !== tempId)
      pendingRef.current = next
      return next
    })
  }, [])

  const addLocalMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}_${role}`,
        role,
        content,
        timestamp: new Date(),
        attachments: [],
      },
    ])
  }, [])

  const clearChat = useCallback(async () => {
    if (!activeChatId || !token) return false

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
      pendingRef.current.forEach((attachment) => {
        if (attachment.preview) URL.revokeObjectURL(attachment.preview)
      })
      setPendingAttachments([])
      pendingRef.current = []
      setActiveChatId(null)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete chat'
      setError(message)
      return false
    }
  }, [activeChatId, apiUrl, token])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    addLocalMessage,
    clearChat,
    chatId: activeChatId,
    setActiveChatId,
    pendingAttachments,
    uploadAttachment,
    removeAttachment,
  }
}
