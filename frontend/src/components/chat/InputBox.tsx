/**
 * InputBox — chat input with drag-and-drop file attachment support.
 */
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import type { PendingAttachment } from '@/types'
import { AttachmentPreview } from '../attachments/AttachmentPreview'

export interface InputBoxProps {
  onSend: (message: string) => Promise<void>
  isLoading: boolean
  onClear: () => void
  pendingAttachments: PendingAttachment[]
  onAttachFiles: (files: File[]) => void
  onRemoveAttachment: (tempId: string) => void
  hasChatId: boolean
}

export const InputBox = ({
  onSend, isLoading, onClear, pendingAttachments, onAttachFiles, onRemoveAttachment, hasChatId,
}: InputBoxProps) => {
  const [input, setInput] = useState('')

  const handleSend = async () => {
    const busy = pendingAttachments.some((a) => a.isUploading)
    if ((!input.trim() && pendingAttachments.length === 0) || isLoading || busy) return
    await onSend(input.trim())
    setInput('')
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
  }

  const onDrop = useCallback(
    (accepted: File[]) => { if (hasChatId && accepted.length > 0) onAttachFiles(accepted) },
    [hasChatId, onAttachFiles],
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop, maxSize: 20 * 1024 * 1024,
    noClick: true, noKeyboard: true, disabled: !hasChatId || isLoading,
  })

  const canSend =
    !isLoading &&
    !pendingAttachments.some((a) => a.isUploading) &&
    (input.trim().length > 0 || pendingAttachments.length > 0)

  return (
    <div className="chat-input-wrap">
      <div className="chat-input-controls">
        <div
          {...getRootProps()}
          className={`relative rounded-xl transition-all ${isDragActive ? 'ring-2 ring-blue-400 bg-blue-900/20' : ''}`}
        >
          <input {...getInputProps()} />

          {isDragActive && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-blue-500/20 border-2 border-dashed border-blue-400 pointer-events-none">
              <p className="text-blue-300 font-semibold text-sm">Drop files to attach</p>
            </div>
          )}

          {pendingAttachments.length > 0 && (
            <div className="chat-attachments-strip">
              {pendingAttachments.map((att) => (
                <AttachmentPreview key={att.tempId} attachment={att} onRemove={() => onRemoveAttachment(att.tempId)} />
              ))}
            </div>
          )}

          <div className="chat-input-top-row">
            <div className="chat-input-meta">
              {!hasChatId
                ? 'Select a chat to attach files'
                : pendingAttachments.length > 0
                  ? `${pendingAttachments.length} attachment${pendingAttachments.length > 1 ? 's' : ''} ready`
                  : 'Attach files or type your message'}
            </div>
            <button onClick={onClear} disabled={isLoading} className="chat-clear-btn">Clear chat</button>
          </div>

          <div className="chat-input-row">
            <button
              type="button" onClick={open}
              disabled={!hasChatId || isLoading}
              title={hasChatId ? 'Attach file (max 20 MB)' : 'Select a chat first'}
              className={`chat-attach-btn ${hasChatId && !isLoading ? 'is-ready' : 'is-disabled'}`}
              aria-label="Attach file"
            >
              📎
            </button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Message… (Enter to send, Shift+Enter for new line)"
              disabled={isLoading}
              rows={2}
              className="chat-input"
            />

            <button onClick={() => void handleSend()} disabled={!canSend} className="chat-send-btn flex-shrink-0">
              {isLoading ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
