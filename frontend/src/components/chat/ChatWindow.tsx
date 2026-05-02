/**
 * Main chat window component combining message list and input with sidebar.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageList } from './MessageList'
import { InputBox } from './InputBox'
import { ChatSidebar } from './ChatSidebar.tsx'
import { useChat } from '../../hooks/useChat'
import { useAuth } from '@/contexts/AuthContext'

export const ChatWindow = () => {
  const [chatId, setChatId] = useState<number | null>(null)
  const [chatTitle, setChatTitle] = useState<string>('New Chat')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { messages, isLoading, error, sendMessage, clearChat, setActiveChatId } = useChat(chatId)
  const { logout, token } = useAuth()
  const navigate = useNavigate()
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

  const handleNewChat = async () => {
    try {
      const response = await fetch(`${apiUrl}/chats/new`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to create chat')
      }

      const data = await response.json()
      setChatId(data.chat_id)
      setActiveChatId(data.chat_id)
      setChatTitle(data.title || 'New Chat')
    } catch (err) {
      console.error('Failed to create chat:', err)
    }
  }

  const handleSelectChat = (cid: number, title: string) => {
    setChatId(cid)
    setActiveChatId(cid)
    setChatTitle(title || `Chat #${cid}`)
  }

  const handleChatDeleted = (deletedChatId: number) => {
    if (chatId === deletedChatId) {
      setChatId(null)
      setActiveChatId(null)
      setChatTitle('New Chat')
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Sidebar */}
      <ChatSidebar
        isOpen={sidebarOpen}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        currentChatId={chatId}
        onChatDeleted={handleChatDeleted}
        onLogout={handleLogout}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Toggle button for mobile */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden p-4 text-slate-300 hover:text-white"
        >
          ☰
        </button>

        {!chatId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <h2 className="text-2xl font-bold text-white">No chat selected</h2>
            <button
              onClick={handleNewChat}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg"
            >
              Start a new chat
            </button>
          </div>
        ) : (
          <>
            <header className="bg-slate-800 border-b border-slate-700 p-4">
              <h1 className="text-xl font-bold text-white">{chatTitle}</h1>
            </header>

            {error && (
              <div
                className="bg-red-900/20 border-l-4 border-red-500 text-red-200 p-4"
                role="alert"
              >
                {error}
              </div>
            )}

            <MessageList messages={messages} isLoading={isLoading} />
            <InputBox onSend={sendMessage} isLoading={isLoading} onClear={clearChat} />
          </>
        )}
      </div>
    </div>
  )
}
