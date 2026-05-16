/**
 * PaperCard – displays a single arXiv paper with metadata and links.
 */
import React from 'react'
import type { ArxivPaper } from '../hooks/useResearch'

interface PaperCardProps {
  paper: ArxivPaper
  index: number
}

const CATEGORY_COLORS: Record<string, string> = {
  cs: 'bg-blue-900/60 text-blue-300',
  math: 'bg-emerald-900/60 text-emerald-300',
  physics: 'bg-violet-900/60 text-violet-300',
  stat: 'bg-amber-900/60 text-amber-300',
  q: 'bg-rose-900/60 text-rose-300',
  econ: 'bg-cyan-900/60 text-cyan-300',
}

function categoryColor(cat: string): string {
  const prefix = cat.split('.')[0].toLowerCase()
  return CATEGORY_COLORS[prefix] ?? 'bg-slate-700 text-slate-300'
}

const PaperCard: React.FC<PaperCardProps> = ({ paper, index }) => {
  const arxivId = paper.entry_id.split('/').pop() ?? paper.entry_id

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 hover:border-violet-500/40 transition-colors duration-200">
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Index badge */}
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-700/40 text-violet-300 text-xs font-bold flex items-center justify-center mt-0.5">
          {index}
        </span>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-sm font-semibold text-white leading-snug mb-1 line-clamp-3">
            {paper.title}
          </h3>

          {/* Authors */}
          <p className="text-xs text-slate-400 mb-2 truncate">
            {paper.authors.slice(0, 4).join(', ')}
            {paper.authors.length > 4 && ' et al.'}
          </p>

          {/* Categories + date */}
          <div className="flex flex-wrap gap-1 mb-3">
            {paper.categories.slice(0, 3).map((cat) => (
              <span
                key={cat}
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${categoryColor(cat)}`}
              >
                {cat}
              </span>
            ))}
            {paper.published && (
              <span className="text-[10px] text-slate-500 px-1.5 py-0.5">
                {paper.published}
              </span>
            )}
          </div>

          {/* Abstract preview */}
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-4 mb-3">
            {paper.summary}
          </p>

          {/* Links */}
          <div className="flex gap-3">
            <a
              href={paper.arxiv_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              arXiv:{arxivId}
            </a>

            {paper.pdf_url && (
              <a
                href={paper.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PDF
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaperCard
