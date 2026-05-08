/**
 * Message — renders a single chat bubble with Markdown, syntax-highlighted
 * code blocks, KaTeX formulas, and file attachment cards.
 */
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import 'katex/dist/katex.min.css'
import type { Attachment } from '@/types'
import { AttachmentDisplay } from '../attachments/AttachmentDisplay'

interface MessageProps {
  role: 'user' | 'assistant'
  content: string
  attachments?: Attachment[]
}

export const Message = ({ role, content, attachments = [] }: MessageProps) => {
  const isUser = role === 'user'

  return (
    <div className={isUser ? 'chat-message-row user' : 'chat-message-row bot'}>
      <div className={isUser ? 'chat-message user' : 'chat-message bot'}>

        {/* Attachments displayed above the text bubble */}
        {attachments.length > 0 && (
          <div className="flex flex-col gap-2 mb-2">
            {attachments.map((att) => (
              <AttachmentDisplay key={att.id} attachment={att} />
            ))}
          </div>
        )}

        {/* Markdown content with math + syntax highlighting */}
        {content && (
          <div className="prose prose-invert prose-sm max-w-none break-words">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                // Syntax-highlighted code blocks
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  const isBlock = !!match
                  return isBlock ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus as Record<string, React.CSSProperties>}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{ borderRadius: '0.5rem', margin: '0.5rem 0', fontSize: '0.8rem' }}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code
                      className={`bg-slate-700 text-blue-300 px-1 py-0.5 rounded text-sm font-mono ${className ?? ''}`}
                      {...props}
                    >
                      {children}
                    </code>
                  )
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
