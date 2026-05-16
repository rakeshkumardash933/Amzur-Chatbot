/**
 * ResearchMarkdown – lightweight inline markdown renderer for digest output.
 *
 * Handles: h1 (#), h2 (##), h3 (###), bold (**...**), bullet lists (- item),
 * numbered lists (1. item), horizontal rules (---), blank lines → paragraph breaks.
 * No external dependencies required.
 */
import React from 'react'

interface ResearchMarkdownProps {
  text: string
  isStreaming?: boolean
}

function renderInline(text: string): React.ReactNode[] {
  // Replace **bold** with <strong> spans
  const parts: React.ReactNode[] = []
  const regex = /\*\*(.+?)\*\*/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }
    parts.push(<strong key={key++} className="font-semibold text-white">{match[1]}</strong>)
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

const ResearchMarkdown: React.FC<ResearchMarkdownProps> = ({ text, isStreaming = false }) => {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listBuffer: string[] = []
  let listType: 'bullet' | 'numbered' | null = null
  let keyIdx = 0

  const flushList = () => {
    if (!listBuffer.length) return
    if (listType === 'bullet') {
      elements.push(
        <ul key={keyIdx++} className="list-disc list-inside space-y-1 my-2 pl-2">
          {listBuffer.map((item, i) => (
            <li key={i} className="text-slate-300 text-sm leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>,
      )
    } else {
      elements.push(
        <ol key={keyIdx++} className="list-decimal list-inside space-y-1 my-2 pl-2">
          {listBuffer.map((item, i) => (
            <li key={i} className="text-slate-300 text-sm leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ol>,
      )
    }
    listBuffer = []
    listType = null
  }

  for (const line of lines) {
    // Headings
    if (line.startsWith('### ')) {
      flushList()
      elements.push(
        <h3 key={keyIdx++} className="text-base font-semibold text-violet-300 mt-5 mb-2">
          {renderInline(line.slice(4))}
        </h3>,
      )
    } else if (line.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={keyIdx++} className="text-lg font-bold text-violet-200 mt-6 mb-2 border-b border-slate-700 pb-1">
          {renderInline(line.slice(3))}
        </h2>,
      )
    } else if (line.startsWith('# ')) {
      flushList()
      elements.push(
        <h1 key={keyIdx++} className="text-xl font-bold text-white mt-4 mb-3">
          {renderInline(line.slice(2))}
        </h1>,
      )
    }
    // Horizontal rule
    else if (/^---+$/.test(line.trim())) {
      flushList()
      elements.push(<hr key={keyIdx++} className="border-slate-700 my-4" />)
    }
    // Bullet list item
    else if (/^[-*] /.test(line)) {
      if (listType && listType !== 'bullet') flushList()
      listType = 'bullet'
      listBuffer.push(line.replace(/^[-*] /, ''))
    }
    // Numbered list item
    else if (/^\d+\. /.test(line)) {
      if (listType && listType !== 'numbered') flushList()
      listType = 'numbered'
      listBuffer.push(line.replace(/^\d+\. /, ''))
    }
    // Blank line → paragraph break
    else if (line.trim() === '') {
      flushList()
      elements.push(<div key={keyIdx++} className="my-2" />)
    }
    // Normal paragraph line
    else {
      flushList()
      elements.push(
        <p key={keyIdx++} className="text-slate-300 text-sm leading-relaxed">
          {renderInline(line)}
        </p>,
      )
    }
  }

  flushList()

  return (
    <div className="prose-research">
      {elements}
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-violet-400 ml-0.5 align-text-bottom animate-pulse" />
      )}
    </div>
  )
}

export default ResearchMarkdown
