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
