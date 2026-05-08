/**
 * AttachmentPreview — shows a single pending attachment before the message is sent.
 * Displays an image thumbnail, upload spinner, or file-icon fallback.
 */
import type { PendingAttachment } from '@/types'
import { FileIcon } from './FileIcon'

interface AttachmentPreviewProps {
  attachment: PendingAttachment
  onRemove: () => void
}

export const AttachmentPreview = ({ attachment, onRemove }: AttachmentPreviewProps) => {
  const isImage = attachment.file_type.startsWith('image/')

  return (
    <div className="relative group flex items-center gap-2 bg-slate-700/80 border border-slate-600 rounded-xl px-3 py-2 max-w-[160px]">
      {/* Thumbnail / icon */}
      {isImage && attachment.preview ? (
        <img
          src={attachment.preview}
          alt={attachment.file_name}
          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <FileIcon fileType={attachment.file_type} className="flex-shrink-0" />
      )}

      {/* File name */}
      <span className="text-xs text-slate-300 truncate flex-1 leading-tight">
        {attachment.file_name}
      </span>

      {/* Upload spinner */}
      {attachment.isUploading && (
        <span className="flex-shrink-0 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      )}

      {/* Error indicator */}
      {attachment.error && (
        <span className="flex-shrink-0 text-red-400 text-xs" title={attachment.error}>⚠</span>
      )}

      {/* Remove button — visible on hover */}
      {!attachment.isUploading && (
        <button
          onClick={onRemove}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-600 hover:bg-red-500 text-white text-xs flex items-center justify-center transition-colors shadow"
          aria-label={`Remove ${attachment.file_name}`}
        >
          ×
        </button>
      )}
    </div>
  )
}
