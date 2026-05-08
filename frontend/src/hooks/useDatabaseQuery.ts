/**
 * Hook for Natural Language → SQL database query feature.
 */
import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export interface QueryResult {
  question: string
  sql: string | null
  columns: string[]
  rows: (string | number | boolean | null)[][]
  row_count: number
  execution_time_ms: number
  explanation: string
  error: string | null
  success: boolean
}

export interface QueryHistoryItem {
  question: string
  sql: string
  row_count: number
  execution_time_ms: number
  error: string | null
}

interface UseDatabaseQueryReturn {
  result: QueryResult | null
  history: QueryHistoryItem[]
  schema: string
  isQuerying: boolean
  isLoadingSchema: boolean
  error: string | null
  runQuery: (question: string) => Promise<void>
  loadSchema: () => Promise<void>
  loadHistory: () => Promise<void>
  clearHistory: () => Promise<void>
  clearResult: () => void
}

export const useDatabaseQuery = (): UseDatabaseQueryReturn => {
  const [result, setResult] = useState<QueryResult | null>(null)
  const [history, setHistory] = useState<QueryHistoryItem[]>([])
  const [schema, setSchema] = useState('')
  const [isQuerying, setIsQuerying] = useState(false)
  const [isLoadingSchema, setIsLoadingSchema] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { token } = useAuth()

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
  const dbUrl = `${apiUrl}/database`

  const runQuery = useCallback(
    async (question: string) => {
      if (!token || !question.trim()) return
      setIsQuerying(true)
      setError(null)
      try {
        const res = await fetch(`${dbUrl}/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ question }),
        })
        const data = await res.json()
        if (!res.ok) {
          const isBudget = res.status === 402
          throw new Error(
            isBudget
              ? 'AI budget exhausted — contact your admin to top up the quota.'
              : data.detail || 'Query failed'
          )
        }
        setResult(data)
        // Refresh history after successful query
        void loadHistory()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Query failed')
      } finally {
        setIsQuerying(false)
      }
    },
    [token, dbUrl]
  )

  const loadSchema = useCallback(async () => {
    if (!token) return
    setIsLoadingSchema(true)
    try {
      const res = await fetch(`${dbUrl}/schema`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setSchema(data.schema || '')
    } catch {
      // ignore
    } finally {
      setIsLoadingSchema(false)
    }
  }, [token, dbUrl])

  const loadHistory = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${dbUrl}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setHistory(data.history || [])
    } catch {
      // ignore
    }
  }, [token, dbUrl])

  const clearHistory = useCallback(async () => {
    if (!token) return
    try {
      await fetch(`${dbUrl}/clear-history`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setHistory([])
      setResult(null)
    } catch {
      // ignore
    }
  }, [token, dbUrl])

  const clearResult = () => setResult(null)

  return {
    result,
    history,
    schema,
    isQuerying,
    isLoadingSchema,
    error,
    runQuery,
    loadSchema,
    loadHistory,
    clearHistory,
    clearResult,
  }
}
