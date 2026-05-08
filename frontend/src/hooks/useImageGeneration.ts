/**
 * Custom hook for managing AI image generation state and API communication.
 */
import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export interface GeneratedImage {
  id: number
  prompt: string
  image_url: string
  created_at: string
}

interface UseImageGenerationReturn {
  generatedImages: GeneratedImage[]
  isGenerating: boolean
  error: string | null
  generateImage: (prompt: string, threadId: number) => Promise<GeneratedImage | null>
  loadImages: (threadId: number) => Promise<void>
  clearImages: () => void
}

export const useImageGeneration = (): UseImageGenerationReturn => {
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { token } = useAuth()

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
  const backendBase = apiUrl.replace(/\/api$/, '')

  const toAbsoluteUrl = (url: string) =>
    url.startsWith('http') ? url : `${backendBase}${url}`

  /**
   * Generate an image from a text prompt.
   */
  const generateImage = useCallback(
    async (prompt: string, threadId: number): Promise<GeneratedImage | null> => {
      if (!token || !threadId) return null

      setIsGenerating(true)
      setError(null)

      try {
        const response = await fetch(`${apiUrl}/generate-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt,
            thread_id: threadId,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.detail || 'Failed to generate image')
        }

        const data = await response.json()

        if (data.success) {
          const generatedImage: GeneratedImage = {
            id: data.generated_image_id,
            prompt: data.prompt,
            image_url: toAbsoluteUrl(data.image_url),
            // Use client time (ISO with Z) so it sorts correctly against message timestamps.
            // Server created_at lacks a timezone suffix and would be misinterpreted as local time.
            created_at: new Date().toISOString(),
          }

          setGeneratedImages((prev) => [generatedImage, ...prev])
          return generatedImage
        }

        return null
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate image'
        setError(message)
        return null
      } finally {
        setIsGenerating(false)
      }
    },
    [apiUrl, token]
  )

  /**
   * Load all generated images for a specific thread.
   */
  const loadImages = useCallback(
    async (threadId: number): Promise<void> => {
      if (!token || !threadId) return

      // Clear previous chat's images immediately
      setGeneratedImages([])
      setError(null)

      try {
        const response = await fetch(`${apiUrl}/generated-images/${threadId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        // 404 means this chat simply has no images — treat as empty, not an error
        if (response.status === 404) return

        if (!response.ok) {
          throw new Error('Failed to load generated images')
        }

        const data = await response.json()

        if (data.success && Array.isArray(data.generated_images)) {
          setGeneratedImages(
            data.generated_images.map((img: GeneratedImage) => ({
              ...img,
              image_url: toAbsoluteUrl(img.image_url),
            }))
          )
        }
      } catch (err) {
        console.error('Failed to load images:', err)
        setError(err instanceof Error ? err.message : 'Failed to load images')
      }
    },
    [apiUrl, token]
  )

  const clearImages = () => setGeneratedImages([])

  return {
    generatedImages,
    isGenerating,
    error,
    generateImage,
    loadImages,
    clearImages,
  }
}
