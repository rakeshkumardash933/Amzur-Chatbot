import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export type CellValue = '' | 'X' | 'O'
export type Board = CellValue[][]
export type GameStatus = 'ongoing' | 'user_won' | 'ai_won' | 'draw'
export type Difficulty = 'easy' | 'balanced' | 'hard'
export type Personality = 'strategic' | 'aggressive' | 'playful'

export interface GameMove {
  turn: 'user' | 'ai'
  symbol: 'X' | 'O'
  row: number
  col: number
  reason?: string
  timestamp: string
}

export interface GameHistoryItem {
  game_id: number
  started_at: string
  ended_at: string
  winner: 'user' | 'ai' | 'draw'
  moves: GameMove[]
}

interface AiMove {
  row: number
  col: number
  reason: string
  confidence: number
  source: 'llm' | 'fallback'
}

interface GameResponse {
  success: boolean
  board: Board
  current_turn: 'user' | 'ai'
  status: GameStatus
  winner: string
  scores: { user: number; ai: number; draw: number }
  difficulty: Difficulty
  personality: Personality
  game_id: number
  moves: GameMove[]
  ai_move?: AiMove | null
}

const EMPTY_BOARD: Board = [
  ['', '', ''],
  ['', '', ''],
  ['', '', ''],
]

export const useTicTacToe = () => {
  const { token } = useAuth()
  const apiUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000/api'

  const [board, setBoard] = useState<Board>(EMPTY_BOARD)
  const [status, setStatus] = useState<GameStatus>('ongoing')
  const [winner, setWinner] = useState<string>('')
  const [currentTurn, setCurrentTurn] = useState<'user' | 'ai'>('user')
  const [scores, setScores] = useState({ user: 0, ai: 0, draw: 0 })
  const [moves, setMoves] = useState<GameMove[]>([])
  const [history, setHistory] = useState<GameHistoryItem[]>([])
  const [difficulty, setDifficulty] = useState<Difficulty>('balanced')
  const [personality, setPersonality] = useState<Personality>('aggressive')
  const [isLoading, setIsLoading] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAiMove, setLastAiMove] = useState<AiMove | null>(null)

  const canPlay = useMemo(
    () => status === 'ongoing' && currentTurn === 'user' && !isLoading && !isThinking,
    [status, currentTurn, isLoading, isThinking],
  )

  const applyGameState = useCallback((payload: GameResponse) => {
    setBoard(payload.board)
    setCurrentTurn(payload.current_turn)
    setStatus(payload.status)
    setWinner(payload.winner)
    setScores(payload.scores)
    setMoves(payload.moves || [])
    setDifficulty(payload.difficulty)
    setPersonality(payload.personality)
    setLastAiMove(payload.ai_move ?? null)
  }, [])

  const loadHistory = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${apiUrl}/game/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = (await res.json()) as {
        history: GameHistoryItem[]
        scores: { user: number; ai: number; draw: number }
      }
      setHistory(data.history || [])
      if (data.scores) setScores(data.scores)
    } catch {
      // Non-critical request
    }
  }, [apiUrl, token])

  const startGame = useCallback(async (nextDifficulty: Difficulty, nextPersonality: Personality) => {
    if (!token) return
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`${apiUrl}/game/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ difficulty: nextDifficulty, personality: nextPersonality }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { detail?: string }
        throw new Error(data.detail || 'Unable to start game')
      }
      const data = (await res.json()) as GameResponse
      applyGameState(data)
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game')
    } finally {
      setIsLoading(false)
    }
  }, [apiUrl, token, applyGameState, loadHistory])

  const makeMove = useCallback(async (row: number, col: number) => {
    if (!token || !canPlay) return

    setIsThinking(true)
    setError(null)
    setLastAiMove(null)

    try {
      const res = await fetch(`${apiUrl}/game/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ row, col, explain: true }),
      })

      const data = (await res.json()) as GameResponse | { detail?: string }
      if (!res.ok) {
        throw new Error((data as { detail?: string }).detail || 'Invalid move')
      }

      applyGameState(data as GameResponse)
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move failed')
    } finally {
      setIsThinking(false)
    }
  }, [apiUrl, token, canPlay, applyGameState, loadHistory])

  const restartGame = useCallback(async (resetScore = false) => {
    if (!token) return
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`${apiUrl}/game/restart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reset_score: resetScore, difficulty, personality }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { detail?: string }
        throw new Error(data.detail || 'Unable to restart game')
      }
      const data = (await res.json()) as GameResponse
      applyGameState(data)
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restart failed')
    } finally {
      setIsLoading(false)
    }
  }, [apiUrl, token, difficulty, personality, applyGameState, loadHistory])

  useEffect(() => {
    if (!token) return
    void startGame(difficulty, personality)
  }, [token])

  return {
    board,
    status,
    winner,
    currentTurn,
    scores,
    moves,
    history,
    difficulty,
    personality,
    isLoading,
    isThinking,
    error,
    lastAiMove,
    canPlay,
    setDifficulty,
    setPersonality,
    startGame,
    makeMove,
    restartGame,
    loadHistory,
    clearError: () => setError(null),
  }
}
