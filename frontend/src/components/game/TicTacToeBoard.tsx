import React from 'react'
import type { Board } from '@/hooks/useTicTacToe'

interface TicTacToeBoardProps {
  board: Board
  onCellClick: (row: number, col: number) => void
  disabled?: boolean
  lastAiMove?: { row: number; col: number } | null
}

const symbolClass = (value: string): string => {
  if (value === 'X') return 'text-blue-500'
  if (value === 'O') return 'text-rose-500'
  return 'text-slate-400'
}

export const TicTacToeBoard: React.FC<TicTacToeBoardProps> = ({
  board,
  onCellClick,
  disabled = false,
  lastAiMove,
}) => {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-200/80 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 shadow-lg">
        {board.map((row, rIdx) =>
          row.map((cell, cIdx) => {
            const isLastAiMove = lastAiMove?.row === rIdx && lastAiMove?.col === cIdx
            return (
              <button
                key={`${rIdx}-${cIdx}`}
                type="button"
                onClick={() => onCellClick(rIdx, cIdx)}
                disabled={disabled || cell !== ''}
                className={`aspect-square rounded-xl border text-4xl md:text-5xl font-black transition-all duration-200 ${
                  cell === ''
                    ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:scale-[1.03]'
                    : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700'
                } ${isLastAiMove ? 'ring-2 ring-violet-500/70' : ''} ${symbolClass(cell)}`}
                aria-label={`Cell ${rIdx + 1}, ${cIdx + 1}`}
              >
                {cell || ''}
              </button>
            )
          }),
        )}
      </div>
    </div>
  )
}
