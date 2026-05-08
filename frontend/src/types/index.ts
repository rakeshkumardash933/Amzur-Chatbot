/**
 * Shared TypeScript types for API responses and component props.
 * Import all types from here.
 */

// Chat API
export interface ChatRequest {
  message: string
  session_id: string
}

export interface ChatResponse {
  response: string
  session_id: string
  message_count: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// User
export interface User {
  id: string
  email: string
  google_id?: string
  created_at: string
  updated_at: string
}

// Thread
export interface Thread {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

// Message
export interface Message {
  id: string
  thread_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// Add more types as features are implemented

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

/** Attachment record returned by the server. */
export interface Attachment {
  id: number
  file_name: string
  file_type: string
  /** Relative URL served by the backend: /uploads/<thread_id>/<file> */
  file_url: string
  file_size?: number
}

/**
 * Local state for a file that is being (or has been) uploaded.
 * Holds a temp ID so items can be tracked before the server responds.
 */
export interface PendingAttachment {
  /** Locally generated key, e.g. `temp_<Date.now()>` */
  tempId: string
  /** Server-assigned ID — undefined while the upload is in-flight */
  id?: number
  file_name: string
  file_type: string
  /** Object-URL for image previews (created by URL.createObjectURL) */
  preview?: string
  isUploading: boolean
  error?: string
}
