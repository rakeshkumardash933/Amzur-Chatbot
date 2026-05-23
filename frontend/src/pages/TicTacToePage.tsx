import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'
import { useTicTacToe } from '@/hooks/useTicTacToe'
import { AIMoveIndicator } from '@/components/game/AIMoveIndicator'
import { GameControls } from '@/components/game/GameControls'
import { ScoreBoard } from '@/components/game/ScoreBoard'
import { TicTacToeBoard } from '@/components/game/TicTacToeBoard'

const statusLabel = (status: string, winner: string): string => {
  if (status === 'user_won') return 'You won this round!'
  if (status === 'ai_won') return 'AI won this round.'
  if (status === 'draw') return 'Round ended in a draw.'
  if (winner) return winner
  return 'Your turn'
}

export const TicTacToePage: React.FC = () => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const {
    board,
    status,
    winner,
    currentTurn,
    scores,
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
    clearError,
  } = useTicTacToe()
  const [showResultFx, setShowResultFx] = useState(false)

  const resultTone = useMemo(() => {
    if (status === 'user_won') return 'win'
    if (status === 'ai_won') return 'lose'
    if (status === 'draw') return 'draw'
    return 'none'
  }, [status])

  useEffect(() => {
    if (status === 'user_won' || status === 'ai_won' || status === 'draw') {
      setShowResultFx(true)
      const timer = window.setTimeout(() => setShowResultFx(false), 2400)
      return () => window.clearTimeout(timer)
    }
    setShowResultFx(false)
    return
  }, [status])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-4 md:py-6 space-y-4">
        <header className="rounded-xl border border-slate-300/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 md:p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">AI Agent Tic Tac Toe</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Play against an LLM-powered agent with strategic reasoning.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate('/')}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Chat
            </button>
            <button
              onClick={() => navigate('/database')}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              DB Chat
            </button>
            <button
              onClick={() => navigate('/sheets')}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Sheet Agent
            </button>
            <button
              onClick={() => navigate('/research')}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Research
            </button>
            <button
              onClick={() => navigate('/tickets')}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Support Tickets
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-slate-800 dark:bg-slate-700 px-3 py-2 text-sm text-white hover:opacity-90"
            >
              Logout
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
            <span>{error}</span>
            <button type="button" onClick={clearError} className="text-xs underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3 items-start">
          <section className="lg:col-span-2 space-y-4">
            <div className="relative overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {statusLabel(status, winner)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {status === 'ongoing'
                      ? currentTurn === 'user'
                        ? 'You are X. Place your move.'
                        : 'AI is preparing the next move.'
                      : 'Start a new game to continue.'}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  currentTurn === 'user'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                }`}>
                  Turn: {currentTurn === 'user' ? 'You' : 'AI'}
                </span>
              </div>

              <TicTacToeBoard
                board={board}
                onCellClick={(r, c) => void makeMove(r, c)}
                disabled={!canPlay}
                lastAiMove={lastAiMove ? { row: lastAiMove.row, col: lastAiMove.col } : null}
              />

              {showResultFx && resultTone !== 'none' && (
                <div className={`ttt-result-overlay ${resultTone}`}>
                  <div className="ttt-result-badge">
                    {status === 'user_won' && 'User Won'}
                    {status === 'ai_won' && 'AI Won'}
                    {status === 'draw' && 'Draw'}
                  </div>
                  <div className="ttt-confetti-wrap" aria-hidden="true">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <span key={i} className="ttt-confetti" style={{ left: `${(i + 1) * 6}%`, animationDelay: `${(i % 6) * 0.08}s` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <AIMoveIndicator
              isThinking={isThinking}
              reason={lastAiMove?.reason}
              confidence={lastAiMove?.confidence}
              source={lastAiMove?.source}
            />
          </section>

          <aside className="space-y-4">
            <ScoreBoard scores={scores} />

            <GameControls
              difficulty={difficulty}
              personality={personality}
              onDifficultyChange={setDifficulty}
              onPersonalityChange={setPersonality}
              onNewGame={() => void startGame(difficulty, personality)}
              onResetScore={() => void restartGame(true)}
              disabled={isLoading || isThinking}
            />

            <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Recent Games</h3>
              {history.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">No completed games yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.map((item) => (
                    <div key={item.game_id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">Game #{item.game_id}</span>
                        <span className={`px-2 py-0.5 rounded-full ${
                          item.winner === 'user'
                            ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : item.winner === 'ai'
                              ? 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                          {item.winner.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {item.moves.length} moves · {new Date(item.ended_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default TicTacToePage
