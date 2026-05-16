/**
 * ResearchPage – Research Digest Agent UI at /research.
 *
 * Layout:
 *   Left sidebar  → suggested queries, past history, navigation
 *   Main panel    → search bar, progress stages, streaming digest, paper cards
 */
import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useResearch } from '../hooks/useResearch'
import PaperCard from '../components/PaperCard'
import ResearchMarkdown from '../components/ResearchMarkdown'

// ---------------------------------------------------------------------------
// Suggested queries
// ---------------------------------------------------------------------------

const SUGGESTED_QUERIES = [
  'Large language model reasoning 2024',
  'Diffusion models image generation',
  'Retrieval augmented generation survey',
  'Transformer architecture efficiency',
  'Reinforcement learning from human feedback',
  'Vision transformer medical imaging',
  'Graph neural network molecules',
  'Quantum machine learning algorithms',
]

// ---------------------------------------------------------------------------
// Stage indicator
// ---------------------------------------------------------------------------

const STAGES = [
  { id: 'searching', label: 'Searching' },
  { id: 'analyzing', label: 'Analyzing' },
  { id: 'generating', label: 'Generating' },
  { id: 'done', label: 'Done' },
]

interface StageBarProps {
  stage: string
}

const StageBar: React.FC<StageBarProps> = ({ stage }) => {
  const activeIdx = STAGES.findIndex((s) => s.id === stage)

  return (
    <div className="flex items-center gap-2 mb-4">
      {STAGES.map((s, i) => {
        const isActive = i === activeIdx
        const isDone = i < activeIdx || stage === 'done'
        return (
          <React.Fragment key={s.id}>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                  isDone
                    ? 'bg-emerald-500 text-white'
                    : isActive
                      ? 'bg-violet-500 text-white animate-pulse'
                      : 'bg-slate-700 text-slate-500'
                }`}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  isDone
                    ? 'text-emerald-400'
                    : isActive
                      ? 'text-violet-300'
                      : 'text-slate-600'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={`flex-1 h-0.5 transition-all duration-500 ${
                  i < activeIdx ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

const ResearchPage: React.FC = () => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const {
    papers,
    digest,
    stage,
    stageMessage,
    isStreaming,
    error,
    history,
    startResearch,
    clearResearchHistory,
    clearError,
  } = useResearch()

  const [query, setQuery] = useState('')
  const digestRef = useRef<HTMLDivElement>(null)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q || isStreaming) return
    void startResearch(q)
  }

  const handleSuggest = (q: string) => {
    setQuery(q)
    if (!isStreaming) void startResearch(q)
  }

  const handleHistoryClick = (q: string) => {
    setQuery(q)
    if (!isStreaming) void startResearch(q)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const showStageBar = stage !== 'idle' && stage !== 'error'
  const hasResult = digest.length > 0

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      {/* ─── Left Sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-sm">
              🔬
            </div>
            <div>
              <p className="text-sm font-bold text-white">Research Agent</p>
              <p className="text-[10px] text-slate-500">arXiv Digest</p>
            </div>
          </div>
        </div>

        {/* Suggested queries */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-2">
              Suggested Topics
            </p>
            <div className="space-y-1">
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggest(q)}
                  disabled={isStreaming}
                  className="w-full text-left text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg px-3 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-1 mb-2">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  History
                </p>
                <button
                  onClick={() => void clearResearchHistory()}
                  className="text-[10px] text-slate-600 hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-1">
                {history.slice(0, 20).map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleHistoryClick(item.query)}
                    disabled={isStreaming}
                    className="w-full text-left rounded-lg px-3 py-2 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <p className="text-xs text-slate-300 truncate">{item.query}</p>
                    {item.paper_count > 0 && (
                      <p className="text-[10px] text-slate-600">{item.paper_count} papers</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <span>💬</span> Chat
          </button>
          <button
            onClick={() => navigate('/database')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <span>🗄️</span> DB Chat
          </button>
          <button
            onClick={() => navigate('/sheets')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <span>📊</span> Sheet Agent
          </button>
          <button
            onClick={() => navigate('/game')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <span>🎮</span> AI Game
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors"
          >
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* ─── Main Panel ───────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Research Digest Agent</h1>
            <p className="text-xs text-slate-500">Powered by arXiv · AI-synthesized summaries</p>
          </div>
          {stage !== 'idle' && stage !== 'error' && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              stage === 'done'
                ? 'bg-emerald-900/40 text-emerald-400'
                : 'bg-violet-900/40 text-violet-300 animate-pulse'
            }`}>
              {stage === 'done' ? `${papers.length} papers analysed` : stageMessage || stage}
            </span>
          )}
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Search form */}
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 'transformer architectures for long-context reasoning'…"
              disabled={isStreaming}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isStreaming || !query.trim()}
              className="bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors disabled:cursor-not-allowed"
            >
              {isStreaming ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Researching
                </span>
              ) : (
                'Research'
              )}
            </button>
          </form>

          {/* Error state */}
          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 flex items-start gap-3">
              <span className="text-red-400 text-lg flex-shrink-0">⚠</span>
              <div className="flex-1">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
              <button onClick={clearError} className="text-red-600 hover:text-red-400 text-xs">
                Dismiss
              </button>
            </div>
          )}

          {/* Progress stage bar */}
          {showStageBar && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <StageBar stage={stage} />
              {stageMessage && stage !== 'done' && (
                <p className="text-xs text-slate-400 mt-1">{stageMessage}</p>
              )}
            </div>
          )}

          {/* Idle placeholder */}
          {stage === 'idle' && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-700/30 to-purple-800/30 border border-violet-700/30 flex items-center justify-center text-3xl mb-4">
                🔬
              </div>
              <h2 className="text-lg font-semibold text-slate-300 mb-2">
                Start a Research Session
              </h2>
              <p className="text-sm text-slate-500 max-w-md">
                Enter a research topic above or pick from the suggested queries in the sidebar.
                The agent will search arXiv, evaluate evidence, and generate a structured digest.
              </p>
            </div>
          )}

          {/* Digest output */}
          {hasResult && (
            <div
              ref={digestRef}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-violet-300 flex items-center gap-2">
                  <span>📄</span> Research Digest
                </h2>
                {stage === 'done' && !isStreaming && (
                  <button
                    onClick={() => {
                      const el = document.createElement('textarea')
                      el.value = digest
                      document.body.appendChild(el)
                      el.select()
                      document.execCommand('copy')
                      document.body.removeChild(el)
                    }}
                    className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                    title="Copy to clipboard"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </button>
                )}
              </div>
              <ResearchMarkdown text={digest} isStreaming={isStreaming} />
            </div>
          )}

          {/* Paper cards */}
          {papers.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <span>📚</span>
                {papers.length} Paper{papers.length !== 1 ? 's' : ''} Retrieved from arXiv
              </h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {papers.map((paper, i) => (
                  <PaperCard key={paper.entry_id} paper={paper} index={i + 1} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default ResearchPage
