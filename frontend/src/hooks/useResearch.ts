/**
 * useResearch – streaming SSE hook for the Research Digest Agent.
 *
 * Architecture:
 *   • POST /api/research/stream  → SSE stream via fetch + ReadableStream
 *   • GET  /api/research/history → previous queries
 *
 * Each SSE event is a JSON payload on a `data:` line:
 *   { type: "progress" | "papers" | "token" | "done" | "error", ... }
 * Followed by the terminal sentinel:  data: [DONE]
 */
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArxivPaper {
  entry_id: string
  title: string
  authors: string[]
  summary: string
  published: string
  updated: string
  arxiv_url: string
  pdf_url: string
  categories: string[]
}

export interface ResearchHistoryItem {
  query: string
  paper_count: number
}

export type ResearchStage = 'idle' | 'searching' | 'analyzing' | 'generating' | 'done' | 'error'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useResearch = () => {
  const { token } = useAuth()
  const apiUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000/api'

  const [papers, setPapers] = useState<ArxivPaper[]>([])
  const [digest, setDigest] = useState<string>('')
  const [stage, setStage] = useState<ResearchStage>('idle')
  const [stageMessage, setStageMessage] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<ResearchHistoryItem[]>([])

  // ── Load history ─────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${apiUrl}/research/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = (await res.json()) as { history: ResearchHistoryItem[] }
        setHistory(data.history || [])
      }
    } catch {
      // Non-fatal; history is cosmetic
    }
  }, [apiUrl, token])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  // ── Start research ────────────────────────────────────────────────────────

  const startResearch = useCallback(
    async (query: string, clearHistory = false) => {
      if (!token) return

      setIsStreaming(true)
      setDigest('')
      setPapers([])
      setError(null)
      setStage('searching')
      setStageMessage(`Searching arXiv for "${query}"…`)

      try {
        const res = await fetch(`${apiUrl}/research/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ query, clear_history: clearHistory }),
        })

        if (!res.ok) {
          let detail = 'Research request failed'
          try {
            const data = (await res.json()) as { detail?: string }
            detail = data.detail ?? detail
          } catch {
            // ignore
          }
          throw new Error(detail)
        }

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6)

            if (raw === '[DONE]') {
              setStage((s) => (s !== 'error' ? 'done' : s))
              setIsStreaming(false)
              void loadHistory()
              return
            }

            try {
              const event = JSON.parse(raw) as {
                type: string
                stage?: ResearchStage
                message?: string
                papers?: ArxivPaper[]
                content?: string
                digest?: string
                paper_count?: number
              }

              switch (event.type) {
                case 'progress':
                  setStage(event.stage ?? 'searching')
                  setStageMessage(event.message ?? '')
                  break

                case 'papers':
                  // Replace or merge (later calls may add more papers)
                  setPapers(event.papers ?? [])
                  break

                case 'token':
                  setDigest((prev) => prev + (event.content ?? ''))
                  break

                case 'done':
                  setStage('done')
                  void loadHistory()
                  break

                case 'error':
                  setError(event.message ?? 'An unknown error occurred')
                  setStage('error')
                  setIsStreaming(false)
                  return
              }
            } catch {
              // Malformed event — skip silently
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Research failed. Please try again.')
        setStage('error')
      } finally {
        setIsStreaming(false)
      }
    },
    [apiUrl, token, loadHistory],
  )

  // ── Clear history ─────────────────────────────────────────────────────────

  const clearResearchHistory = useCallback(async () => {
    if (!token) return
    try {
      await fetch(`${apiUrl}/research/clear-history`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setHistory([])
    } catch {
      // ignore
    }
  }, [apiUrl, token])

  return {
    papers,
    digest,
    stage,
    stageMessage,
    isStreaming,
    error,
    history,
    startResearch,
    loadHistory,
    clearResearchHistory,
    clearError: () => setError(null),
  }
}
