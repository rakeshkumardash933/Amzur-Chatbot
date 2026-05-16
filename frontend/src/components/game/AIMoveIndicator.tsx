import React from 'react'

interface AIMoveIndicatorProps {
  isThinking: boolean
  reason?: string
  confidence?: number
  source?: 'llm' | 'fallback'
}

export const AIMoveIndicator: React.FC<AIMoveIndicatorProps> = ({
  isThinking,
  reason,
  confidence,
  source,
}) => {
  if (isThinking) {
    return (
      <div className="rounded-xl border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 p-3 flex items-center gap-3">
        <svg className="animate-spin w-4 h-4 text-violet-600 dark:text-violet-300" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
        </svg>
        <p className="text-sm text-violet-700 dark:text-violet-200">AI is reasoning about its next move...</p>
      </div>
    )
  }

  if (!reason) {
    return (
      <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">Make a move to start the match.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 p-3 space-y-1">
      <p className="text-sm font-medium text-violet-700 dark:text-violet-200">AI rationale</p>
      <p className="text-sm text-violet-800 dark:text-violet-100">{reason}</p>
      <div className="text-xs text-violet-700/80 dark:text-violet-300">
        Confidence: {Math.round((confidence ?? 0.7) * 100)}% · Source: {source === 'fallback' ? 'Fallback Strategy' : 'LLM Agent'}
      </div>
    </div>
  )
}
