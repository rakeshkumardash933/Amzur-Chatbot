import React from 'react'
import type { Difficulty, Personality } from '@/hooks/useTicTacToe'

interface GameControlsProps {
  difficulty: Difficulty
  personality: Personality
  onDifficultyChange: (v: Difficulty) => void
  onPersonalityChange: (v: Personality) => void
  onNewGame: () => void
  onResetScore: () => void
  disabled?: boolean
}

export const GameControls: React.FC<GameControlsProps> = ({
  difficulty,
  personality,
  onDifficultyChange,
  onPersonalityChange,
  onNewGame,
  onResetScore,
  disabled = false,
}) => {
  return (
    <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Game Controls</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-slate-600 dark:text-slate-300 space-y-1 block">
          <span>Difficulty</span>
          <select
            value={difficulty}
            onChange={(e) => onDifficultyChange(e.target.value as Difficulty)}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-2 py-2 text-sm"
          >
            <option value="easy">Easy</option>
            <option value="balanced">Balanced</option>
            <option value="hard">Hard</option>
          </select>
        </label>

        <label className="text-xs text-slate-600 dark:text-slate-300 space-y-1 block">
          <span>AI Personality</span>
          <select
            value={personality}
            onChange={(e) => onPersonalityChange(e.target.value as Personality)}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-2 py-2 text-sm"
          >
            <option value="strategic">Strategic</option>
            <option value="aggressive">Aggressive</option>
            <option value="playful">Playful</option>
          </select>
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onNewGame}
          disabled={disabled}
          className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 text-white px-3 py-2 text-sm font-medium"
        >
          New Game
        </button>
        <button
          type="button"
          onClick={onResetScore}
          disabled={disabled}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2 text-sm font-medium"
        >
          Reset Score
        </button>
      </div>
    </div>
  )
}
