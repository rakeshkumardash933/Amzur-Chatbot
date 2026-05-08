/**
 * Custom hook for PDF document management and RAG-powered chat.
 */
import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export interface Document {
  id: number
  file_name: string
  file_size: number
  thread_id: number | null
  is_processed: boolean
  chunk_count: number
  error_message: string | null
  uploaded_at: string
  processed_at: string | null
}

interface UseDocumentsReturn {
  documents: Document[]
  isUploading: boolean
  isChatting: boolean
  uploadError: string | null
  chatError: string | null
  uploadPDF: (file: File, threadId: number) => Promise<Document | null>
  loadDocuments: (threadId: number) => Promise<void>
  deleteDocument: (documentId: number) => Promise<boolean>
  chatWithDocument: (message: string, threadId: number) => Promise<{ response: string; sources: { file_name: string; chunk_index: number }[] } | null>
  clearDocuments: () => void
  pollDocument: (documentId: number) => Promise<Document | null>
}

export const useDocuments = (): UseDocumentsReturn => {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isChatting, setIsChatting] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [chatError, setChatError] = useState<string | null>(null)
  const { token } = useAuth()

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

  const uploadPDF = useCallback(
    async (file: File, threadId: number): Promise<Document | null> => {
      if (!token) return null
      setIsUploading(true)
      setUploadError(null)

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('thread_id', String(threadId))

        const response = await fetch(`${apiUrl}/upload-pdf`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.detail || 'Upload failed')
        }

        const data = await response.json()
        const doc: Document = data.document
        setDocuments((prev) => [...prev, doc])
        return doc
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        setUploadError(msg)
        return null
      } finally {
        setIsUploading(false)
      }
    },
    [apiUrl, token]
  )

  const loadDocuments = useCallback(
    async (threadId: number): Promise<void> => {
      if (!token) return
      setDocuments([])
      try {
        const response = await fetch(`${apiUrl}/documents?thread_id=${threadId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) return
        const data = await response.json()
        if (data.success) setDocuments(data.documents)
      } catch {
        // silently ignore — not every chat has documents
      }
    },
    [apiUrl, token]
  )

  const deleteDocument = useCallback(
    async (documentId: number): Promise<boolean> => {
      if (!token) return false
      try {
        const response = await fetch(`${apiUrl}/documents/${documentId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) return false
        setDocuments((prev) => prev.filter((d) => d.id !== documentId))
        return true
      } catch {
        return false
      }
    },
    [apiUrl, token]
  )

  const chatWithDocument = useCallback(
    async (message: string, threadId: number) => {
      if (!token) return null
      setIsChatting(true)
      setChatError(null)
      try {
        const response = await fetch(`${apiUrl}/chat-with-document`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message, thread_id: threadId }),
        })
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.detail || 'Document chat failed')
        }
        const data = await response.json()
        return { response: data.response, sources: data.sources || [] }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Document chat failed'
        setChatError(msg)
        return null
      } finally {
        setIsChatting(false)
      }
    },
    [apiUrl, token]
  )

  /** Poll backend until document is processed or errored. */
  const pollDocument = useCallback(
    async (documentId: number): Promise<Document | null> => {
      if (!token) return null
      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise((r) => setTimeout(r, 2000))
        try {
          const res = await fetch(`${apiUrl}/documents/${documentId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!res.ok) continue
          const data = await res.json()
          const doc: Document = data.document
          setDocuments((prev) => prev.map((d) => (d.id === doc.id ? doc : d)))
          if (doc.is_processed || doc.error_message) return doc
        } catch {
          continue
        }
      }
      return null
    },
    [apiUrl, token]
  )

  const clearDocuments = () => setDocuments([])

  return {
    documents,
    isUploading,
    isChatting,
    uploadError,
    chatError,
    uploadPDF,
    loadDocuments,
    deleteDocument,
    chatWithDocument,
    clearDocuments,
    pollDocument,
  }
}
