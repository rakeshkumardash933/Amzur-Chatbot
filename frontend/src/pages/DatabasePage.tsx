/**
 * DatabasePage — full NL-to-SQL interface.
 * Accessible at /database via the protected route.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDatabaseQuery } from '@/hooks/useDatabaseQuery'
import { ResultsTable } from '@/components/database/ResultsTable'
import { useAuth } from '@/contexts/AuthContext'

const SUGGESTED_QUESTIONS = [
  'Show all users',
  'How many chats are there in total?',
  'List the 10 most recent messages',
  'How many messages has each user sent?',
  'Show all generated images',
  'Which users have uploaded documents?',
]

export const DatabasePage = () => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const {
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
  } = useDatabaseQuery()

  const [input, setInput] = useState('')
  const [showSchema, setShowSchema] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    void loadSchema()
    void loadHistory()
  }, [])

  const handleSend = async () => {
    const q = input.trim()
    if (!q || isQuerying) return
    setInput('')
    await runQuery(q)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleSuggest = (q: string) => {
    setInput(q)
    inputRef.current?.focus()
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-200">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div className="w-64 shrink-0 flex flex-col bg-slate-800 border-r border-slate-700">
        {/* Nav */}
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-lg font-bold text-white">🗄 DB Chat</h1>
          <p className="text-xs text-slate-400 mt-0.5">Natural Language → SQL</p>
        </div>

        <div className="flex flex-col gap-2 p-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            ← Back to Chat
          </button>
          <button
            onClick={() => navigate('/sheets')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            📊 Sheet Agent
          </button>
          <button
            onClick={() => navigate('/game')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            🎮 AI Tic Tac Toe
          </button>
          <button
            onClick={() => navigate('/tickets')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            🎫 Support Tickets
          </button>
          <button
            onClick={() => { setShowSchema((v) => !v); setShowHistory(false) }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${showSchema ? 'bg-blue-700 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
          >
            📋 {isLoadingSchema ? 'Loading schema…' : 'View Schema'}
          </button>
          <button
            onClick={() => { setShowHistory((v) => !v); setShowSchema(false) }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${showHistory ? 'bg-blue-700 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
          >
            🕒 Query History
            {history.length > 0 && (
              <span className="ml-auto bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {Math.min(history.length, 99)}
              </span>
            )}
          </button>
          {(history.length > 0) && (
            <button
              onClick={() => void clearHistory()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-700 transition-colors"
            >
              🗑 Clear History
            </button>
          )}
        </div>

        {/* Suggested questions */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Suggestions</p>
          <div className="space-y-1">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleSuggest(q)}
                className="w-full text-left text-xs px-2 py-1.5 rounded text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs px-2 py-1.5 text-slate-500 hover:text-slate-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* ── Main Panel ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
          <h2 className="text-xl font-bold text-white">Database Query</h2>
          <p className="text-sm text-slate-400">Ask questions about your data in plain English</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Schema panel */}
          {showSchema && schema && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">📋 Database Schema</h3>
              <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">
                {schema}
              </pre>
            </div>
          )}

          {/* Query history panel */}
          {showHistory && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">🕒 Recent Queries</h3>
              {history.length === 0 ? (
                <p className="text-xs text-slate-500">No queries yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggest(h.question)}
                      className="w-full text-left bg-slate-900/50 hover:bg-slate-700/60 rounded-lg px-3 py-2 transition-colors"
                    >
                      <p className="text-sm text-slate-200 truncate">{h.question}</p>
                      <div className="flex gap-3 mt-1 text-xs text-slate-500">
                        <span>{h.row_count} rows</span>
                        <span>{h.execution_time_ms} ms</span>
                        {h.error && <span className="text-red-400">error</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 text-amber-200 text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              {/* Question */}
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-1">Question</p>
                <p className="text-slate-200 font-medium">"{result.question}"</p>
              </div>

              {/* SQL block */}
              {result.sql && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-1">Generated SQL</p>
                  <pre className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-emerald-300 font-mono whitespace-pre-wrap overflow-x-auto">
                    {result.sql}
                  </pre>
                </div>
              )}

              {/* Explanation */}
              {result.explanation && (
                <div className="mb-4 flex gap-2 items-start bg-blue-900/20 border border-blue-800/50 rounded-lg px-4 py-3">
                  <span className="text-blue-400 mt-0.5 shrink-0">💡</span>
                  <p className="text-sm text-blue-200">{result.explanation}</p>
                </div>
              )}

              {/* Results table */}
              <ResultsTable result={result} />
            </div>
          )}

          {/* Empty state */}
          {!result && !error && !isQuerying && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-5xl mb-4">🗄️</div>
              <h3 className="text-xl font-semibold text-slate-300 mb-2">Ask your database anything</h3>
              <p className="text-slate-500 text-sm max-w-md">
                Type a question in plain English below. The AI will generate the SQL, execute it safely, and display the results here.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {SUGGESTED_QUESTIONS.slice(0, 3).map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggest(q)}
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {isQuerying && (
            <div className="flex items-center gap-3 p-5 bg-slate-800 border border-slate-700 rounded-xl">
              <svg className="animate-spin w-5 h-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-slate-300 text-sm">Generating SQL and running query…</span>
            </div>
          )}
        </div>

        {/* Input box */}
        <div className="bg-slate-800 border-t border-slate-700 p-4">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your data… (Enter to send)"
              disabled={isQuerying}
              rows={2}
              className="flex-1 resize-none bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isQuerying}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
            >
              {isQuerying ? '…' : 'Run'}
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            🔒 Read-only — only SELECT queries are executed. DROP, DELETE, UPDATE etc. are blocked.
          </p>
        </div>
      </div>
    </div>
  )
}
