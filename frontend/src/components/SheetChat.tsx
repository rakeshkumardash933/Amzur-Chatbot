import { useState } from 'react'
import { SheetMessage, SheetSession } from '@/hooks/useSheetAgent'

interface SheetChatProps {
  session: SheetSession
  messages: SheetMessage[]
  isQuerying: boolean
  onAsk: (question: string) => Promise<void>
}

export const SheetChat = ({ session, messages, isQuerying, onAsk }: SheetChatProps) => {
  const [input, setInput] = useState('')

  const submit = async () => {
    const q = input.trim()
    if (!q || isQuerying) return
    setInput('')
    await onAsk(q)
  }

  return (
    <div className="rounded-xl border border-slate-300/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-slate-100">Ask About This Sheet</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">Conversational follow-up supported</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {session.preview.suggested_questions.map((q) => (
          <button
            key={q}
            onClick={() => void onAsk(q)}
            disabled={isQuerying}
            className="rounded-full border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ask questions like “What is total sales?” or “Now show only products from California”.
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={`inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {isQuerying && <p className="text-sm text-slate-500 dark:text-slate-400">Analyzing dataframe…</p>}
      </div>

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit()
            }
          }}
          rows={2}
          placeholder="Ask a spreadsheet question…"
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
        />
        <button
          onClick={() => void submit()}
          disabled={isQuerying || !input.trim()}
          className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/60 px-4 py-2 text-sm font-medium text-white"
        >
          Ask
        </button>
      </div>
    </div>
  )
}
