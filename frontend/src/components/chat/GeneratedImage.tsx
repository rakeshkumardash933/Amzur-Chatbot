/**
 * GeneratedImage component for displaying AI-generated images in chat.
 * Includes download, fullscreen preview, and regenerate buttons.
 */
import { useState } from 'react'
import { Download, Maximize2, RefreshCw } from 'lucide-react'
import type { GeneratedImage } from '@/hooks/useImageGeneration'

interface GeneratedImageProps {
  image: GeneratedImage
  onRegenerate?: (prompt: string) => void
  isRegenerating?: boolean
}

/**
 * Image preview modal for fullscreen viewing.
 */
const ImagePreviewModal = ({
  imageUrl,
  prompt,
  onClose,
}: {
  imageUrl: string
  prompt: string
  onClose: () => void
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
          aria-label="Close preview"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Image */}
        <img
          src={imageUrl}
          alt={prompt}
          className="max-h-[80vh] max-w-[80vw] rounded-lg object-contain"
        />

        {/* Prompt text */}
        <div className="mt-4 bg-gray-800 rounded-lg p-3 text-white text-sm">
          <p className="font-semibold mb-1">Prompt:</p>
          <p className="text-gray-300">{prompt}</p>
        </div>
      </div>
    </div>
  )
}

export const GeneratedImageComponent = ({
  image,
  onRegenerate,
  isRegenerating = false,
}: GeneratedImageProps) => {
  const [showPreview, setShowPreview] = useState(false)

  const handleDownload = async () => {
    try {
      const response = await fetch(image.image_url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `generated-image-${image.id}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to download image:', error)
    }
  }

  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate(image.prompt)
    }
  }

  const createdAt = new Date(image.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <>
      <div className="group relative rounded-lg overflow-hidden bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 p-4 max-w-md">
        {/* Image container */}
        <div className="relative mb-3 aspect-square rounded-lg overflow-hidden bg-gray-800">
          <img
            src={image.image_url}
            alt={image.prompt}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <button
              onClick={() => setShowPreview(true)}
              className="p-2 bg-white/90 hover:bg-white rounded-full transition-colors"
              aria-label="Preview image fullscreen"
            >
              <Maximize2 className="w-5 h-5 text-gray-800" />
            </button>
          </div>
        </div>

        {/* Prompt text */}
        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-1">Generated with prompt:</p>
          <p className="text-sm text-gray-200 line-clamp-2">{image.prompt}</p>
          <p className="text-xs text-gray-500 mt-1">{createdAt}</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors duration-200"
            title="Download image"
          >
            <Download className="w-4 h-4" />
            Download
          </button>

          {onRegenerate && (
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white text-sm font-medium transition-colors duration-200"
              title="Regenerate with same prompt"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`}
              />
              {isRegenerating ? 'Generating...' : 'Regenerate'}
            </button>
          )}
        </div>

        {/* Generator badge */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-blue-500/80 rounded-full text-xs text-white font-medium">
          AI Generated
        </div>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <ImagePreviewModal
          imageUrl={image.image_url}
          prompt={image.prompt}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  )
}
