/**
 * DocumentPanel — slide-in panel for PDF upload and management.
 * Shown as a collapsible panel above the InputBox inside a chat thread.
 */
import { useRef, useState } from 'react'
import type { Document } from '@/hooks/useDocuments'

interface DocumentPanelProps {
  documents: Document[]
  isUploading: boolean
  uploadError: string | null
  onUpload: (file: File) => void
  onDelete: (id: number) => void
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StatusBadge({ doc }: { doc: Document }) {
  if (doc.error_message) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-300 border border-red-700">
        Error
      </span>
    )
  }
  if (doc.is_processed) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-700">
        Ready · {doc.chunk_count} chunks
      </span>
    )
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-300 border border-yellow-700 animate-pulse">
      Indexing…
    </span>
  )
}

export const DocumentPanel = ({
  documents,
  isUploading,
  uploadError,
  onUpload,
  onDelete,
  onClose,
}: DocumentPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      if (file.type === 'application/pdf') {
        onUpload(file)
      }
    }
  }

  return (
    <div className="bg-slate-800 border-t border-slate-700 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">📄 PDF Documents</span>
          <span className="text-xs text-slate-400">
            {documents.length} uploaded · ask questions once ✅
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-lg leading-none px-1"
          title="Close panel"
        >
          ×
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors mb-3 ${
          dragOver
            ? 'border-blue-400 bg-blue-900/20'
            : 'border-slate-600 hover:border-slate-400 bg-slate-900/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {isUploading ? (
          <div className="flex items-center justify-center gap-2 text-blue-300">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Uploading…</span>
          </div>
        ) : (
          <div className="text-slate-400 text-sm">
            <div className="text-2xl mb-1">📄</div>
            <div>Drop PDF here or <span className="text-blue-400 underline">click to browse</span></div>
            <div className="text-xs mt-1">PDF only · max 50 MB</div>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="mb-2 text-xs text-red-300 bg-red-900/20 border border-red-700 rounded px-2 py-1">
          {uploadError}
        </div>
      )}

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2 gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">📄</span>
                <div className="min-w-0">
                  <p className="text-xs text-slate-200 truncate max-w-[180px]" title={doc.file_name}>
                    {doc.file_name}
                  </p>
                  <p className="text-xs text-slate-500">{formatBytes(doc.file_size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge doc={doc} />
                <button
                  onClick={() => onDelete(doc.id)}
                  className="text-slate-500 hover:text-red-400 text-base leading-none"
                  title="Delete document"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {documents.some((d) => d.is_processed) && (
        <p className="mt-2 text-xs text-emerald-400">
          ✅ Ready — start your message with <strong>@doc</strong> to query documents, or just ask naturally.
        </p>
      )}
    </div>
  )
}
