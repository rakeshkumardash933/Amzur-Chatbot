import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export interface SheetPreview {
  columns: string[]
  rows: Record<string, string | number | boolean | null>[]
  row_count: number
  dtypes: Record<string, string>
  missing_values: Record<string, number>
  markdown: string
  numeric_columns: string[]
  categorical_columns: string[]
  suggested_questions: string[]
}

export interface SheetSession {
  sheet_id: string
  source_type: 'upload' | 'google'
  source_name: string
  worksheet_name?: string | null
  worksheet_names?: string[]
  preview: SheetPreview
}

export interface SheetMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export const useSheetAgent = () => {
  const { token } = useAuth()
  const [session, setSession] = useState<SheetSession | null>(null)
  const [messages, setMessages] = useState<SheetMessage[]>([])
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const [isQuerying, setIsQuerying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
  const sheetApi = useMemo(() => `${apiUrl}/sheet`, [apiUrl])

  const applySession = useCallback((payload: any) => {
    const next: SheetSession = {
      sheet_id: payload.sheet_id,
      source_type: payload.source_type,
      source_name: payload.source_name,
      worksheet_name: payload.worksheet_name,
      worksheet_names: payload.worksheet_names || [],
      preview: payload.preview,
    }
    setSession(next)
    setMessages([])
    setError(null)
  }, [])

  const uploadSheet = useCallback(async (file: File, worksheetName?: string) => {
    if (!token) return
    setIsLoadingSession(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (worksheetName?.trim()) {
        formData.append('worksheet_name', worksheetName.trim())
      }

      const res = await fetch(`${sheetApi}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Sheet upload failed')
      }

      applySession(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sheet upload failed')
    } finally {
      setIsLoadingSession(false)
    }
  }, [token, sheetApi, applySession])

  const importGoogleSheet = useCallback(async (url: string, worksheetName?: string) => {
    if (!token) return
    setIsLoadingSession(true)
    setError(null)

    try {
      const res = await fetch(`${sheetApi}/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url,
          worksheet_name: worksheetName?.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Google Sheets import failed')
      }

      applySession(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sheets import failed')
    } finally {
      setIsLoadingSession(false)
    }
  }, [token, sheetApi, applySession])

  const refreshPreview = useCallback(async () => {
    if (!token || !session?.sheet_id) return
    try {
      const res = await fetch(`${sheetApi}/preview?sheet_id=${encodeURIComponent(session.sheet_id)}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to refresh preview')
      }
      setSession((prev) => prev ? ({ ...prev, preview: data.preview }) : prev)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh preview')
    }
  }, [token, sheetApi, session?.sheet_id])

  const askQuestion = useCallback(async (question: string) => {
    if (!token || !session?.sheet_id) return
    const clean = question.trim()
    if (!clean) return

    const userMsg: SheetMessage = { id: `${Date.now()}_u`, role: 'user', content: clean }
    setMessages((prev) => [...prev, userMsg])
    setIsQuerying(true)
    setError(null)

    try {
      const res = await fetch(`${sheetApi}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: clean, sheet_id: session.sheet_id }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Sheet query failed')
      }

      const botMsg: SheetMessage = {
        id: `${Date.now()}_a`,
        role: 'assistant',
        content: data.answer || 'No response generated.',
      }
      setMessages((prev) => [...prev, botMsg])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sheet query failed')
    } finally {
      setIsQuerying(false)
    }
  }, [token, sheetApi, session?.sheet_id])

  return {
    session,
    messages,
    isLoadingSession,
    isQuerying,
    error,
    uploadSheet,
    importGoogleSheet,
    refreshPreview,
    askQuestion,
    clearError: () => setError(null),
  }
}
