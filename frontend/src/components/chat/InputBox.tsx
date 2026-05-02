/**
 * Component for chat input and send button.
 */
import { useState } from 'react'

interface InputBoxProps {
  onSend: (message: string) => Promise<void>
  isLoading: boolean
  onClear: () => void
}

export const InputBox = ({ onSend, isLoading, onClear }: InputBoxProps) => {
  const [input, setInput] = useState('')

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    await onSend(input)
    setInput('')
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-input-wrap">
      <div className="chat-input-controls">
        <div className="chat-input-top-row">
          <button
            onClick={onClear}
            disabled={isLoading}
            className="chat-clear-btn"
          >
            Clear
          </button>
        </div>

        <div className="chat-input-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Message... (Enter to send, Shift+Enter for new line)"
            disabled={isLoading}
            rows={2}
            className="chat-input"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="chat-send-btn"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
