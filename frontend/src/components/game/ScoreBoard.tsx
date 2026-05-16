import React from 'react'

interface ScoreBoardProps {
  scores: {
    user: number
    ai: number
    draw: number
  }
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({ scores }) => {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
        <p className="text-[11px] uppercase tracking-wide text-blue-600 dark:text-blue-300">You</p>
        <p className="text-2xl font-bold text-blue-700 dark:text-blue-200">{scores.user}</p>
      </div>
      <div className="rounded-xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 p-3 text-center">
        <p className="text-[11px] uppercase tracking-wide text-rose-600 dark:text-rose-300">AI</p>
        <p className="text-2xl font-bold text-rose-700 dark:text-rose-200">{scores.ai}</p>
      </div>
      <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-center">
        <p className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-300">Draw</p>
        <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{scores.draw}</p>
      </div>
    </div>
  )
}
