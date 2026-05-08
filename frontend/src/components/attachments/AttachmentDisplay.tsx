/**
 * AttachmentDisplay — renders a saved attachment inside a chat message bubble.
 *
 * - Images   → inline thumbnail, click to open full size
 * - Videos   → HTML5 <video> player
 * - Others   → icon + filename with download link
 */
import type { Attachment } from '@/types'
import { FileIcon } from './FileIcon'

interface AttachmentDisplayProps {
  attachment: Attachment
}

/** Resolve the full URL for an attachment served by the backend. */
function resolveUrl(fileUrl: string): string {
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api')
    .replace(/\/api$/, '')           // strip trailing /api → http://localhost:8000
  return `${base}${fileUrl}`
}

export const AttachmentDisplay = ({ attachment }: AttachmentDisplayProps) => {
  const { file_name, file_type, file_url } = attachment
  const src = resolveUrl(file_url)
  const isImage = file_type.startsWith('image/')
  const isVideo = file_type.startsWith('video/')

  if (isImage) {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className="block mt-2">
        <img
          src={src}
          alt={file_name}
          className="max-w-xs max-h-64 rounded-xl object-cover border border-slate-600 hover:opacity-90 transition-opacity cursor-zoom-in"
        />
        <p className="text-xs text-slate-400 mt-1">{file_name}</p>
      </a>
    )
  }

  if (isVideo) {
    return (
      <div className="mt-2">
        <video
          controls
          className="max-w-xs rounded-xl border border-slate-600"
          aria-label={file_name}
        >
          <source src={src} type={file_type} />
          Your browser does not support this video format.
        </video>
        <p className="text-xs text-slate-400 mt-1">{file_name}</p>
      </div>
    )
  }

  // Generic download card
  const sizeLabel = attachment.file_size
    ? attachment.file_size < 1024
      ? `${attachment.file_size} B`
      : attachment.file_size < 1024 * 1024
        ? `${(attachment.file_size / 1024).toFixed(1)} KB`
        : `${(attachment.file_size / (1024 * 1024)).toFixed(1)} MB`
    : null

  return (
    <a
      href={src}
      download={file_name}
      className="mt-2 flex items-center gap-3 bg-slate-700/60 border border-slate-600 rounded-xl px-3 py-2 hover:bg-slate-700 transition-colors no-underline max-w-xs"
      aria-label={`Download ${file_name}`}
    >
      <FileIcon fileType={file_type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 truncate font-medium">{file_name}</p>
        {sizeLabel && <p className="text-xs text-slate-400">{sizeLabel}</p>}
      </div>
      {/* Download arrow */}
      <span className="text-slate-400 text-lg flex-shrink-0">↓</span>
    </a>
  )
}
