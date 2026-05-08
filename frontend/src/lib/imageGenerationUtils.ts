/**
 * Utility functions for image generation detection and handling.
 */

// Keywords that indicate an image generation request
const IMAGE_GENERATION_KEYWORDS = [
  'generate image',
  'create image',
  'generate a',
  'create a',
  'make a',
  'design',
  'make illustration',
  'draw',
  'create poster',
  'design logo',
  'design ui',
  'create mockup',
  'generate art',
  'make artwork',
  'create art',
  'generate design',
  'make logo',
  'create logo',
  'design mockup',
  'make diagram',
  'create diagram',
  'generate diagram',
  'illustration of',
  'image of',
  'picture of',
  'artwork',
  'design concept',
  'mockup',
  'wireframe',
]

/**
 * Detect if a user message is requesting image generation.
 */
export const isImageGenerationRequest = (message: string): boolean => {
  const lowerMsg = message.toLowerCase().trim()
  if (!lowerMsg) return false

  if (IMAGE_GENERATION_KEYWORDS.some((keyword) => lowerMsg.includes(keyword))) {
    return true
  }

  // Natural-language detection for prompts like:
  // "white dog image", "a white dog photo", "cartoon robot picture"
  const directImageNouns = /\b(image|photo|picture|illustration|artwork|logo|poster|mockup|diagram)\b/
  const generationVerbs = /\b(generate|create|make|draw|design|render)\b/

  if (directImageNouns.test(lowerMsg) && lowerMsg.length <= 240) {
    return true
  }

  if (generationVerbs.test(lowerMsg) && lowerMsg.length <= 300) {
    return true
  }

  return false
}

/**
 * Extract the image prompt from a message that requests image generation.
 * Can remove some common prefixes to get a cleaner prompt.
 */
export const extractImagePrompt = (message: string): string => {
  let prompt = message.trim()

  // Remove common prefixes
  const prefixes = [
    /^generate image of\s+/i,
    /^create image of\s+/i,
    /^generate an image of\s+/i,
    /^create an image of\s+/i,
    /^generate a photo of\s+/i,
    /^create a photo of\s+/i,
    /^design\s+/i,
    /^create\s+/i,
    /^make\s+/i,
    /^draw\s+/i,
    /^generate\s+/i,
    /^design concept of\s+/i,
    /^mockup of\s+/i,
    /^wireframe of\s+/i,
    /^show me\s+/i,
    /^give me\s+/i,
  ]

  for (const prefix of prefixes) {
    const match = prompt.match(prefix)
    if (match) {
      prompt = prompt.substring(match[0].length).trim()
      break
    }
  }

  return prompt || message.trim()
}

/**
 * Check if a message contains both text and an image generation request.
 * Returns true only if it seems like a pure image generation request.
 */
export const isPureImageGenerationRequest = (message: string): boolean => {
  const lowerMsg = message.toLowerCase().trim()
  const keywordCount = IMAGE_GENERATION_KEYWORDS.filter((keyword) =>
    lowerMsg.includes(keyword)
  ).length

  // If there are multiple keywords or significant text beyond keywords, it's likely a chat message
  // with image generation mentioned, not a pure image request
  return keywordCount > 0 && message.length < 200
}
