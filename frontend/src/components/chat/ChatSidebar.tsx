/**
 * Chat sidebar component showing chat history and user options.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface ChatItem {
  chat_id: number
  title: string
  created_at: string
  updated_at: string | null
  message_count: number
}

interface ChatSidebarProps {
  isOpen: boolean
  onNewChat: () => void
  onSelectChat: (chatId: number, title: string) => void
  currentChatId: number | null
  onChatDeleted: (chatId: number) => void
  onLogout: () => void
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  isOpen,
  onNewChat,
  onSelectChat,
  currentChatId,
  onChatDeleted,
  onLogout,
}) => {
  const [chats, setChats] = useState<ChatItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [editingChatId, setEditingChatId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [actionChatId, setActionChatId] = useState<number | null>(null)

  const { user, token } = useAuth()
  const navigate = useNavigate()
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

  const loadChats = async () => {
    if (!token) return

    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/chats`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load chats')
      }

      const data = await response.json()
      setChats(data.chats || [])
    } catch (err) {
      console.error('Failed to load chats:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadChats()
  }, [token, currentChatId])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const displayTitle = (chat: ChatItem) => {
    const title = (chat.title || '').trim()
    if (!title || title.toLowerCase() === 'new chat') {
      return `Chat #${chat.chat_id}`
    }
    return title
  }

  const startRename = (chat: ChatItem) => {
    setEditingChatId(chat.chat_id)
    setEditingTitle(chat.title)
  }

  const saveRename = async (chatId: number) => {
    const nextTitle = editingTitle.trim()
    if (!token || !nextTitle) {
      setEditingChatId(null)
      setEditingTitle('')
      return
    }

    setActionChatId(chatId)
    try {
      const response = await fetch(`${apiUrl}/chats/${chatId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: nextTitle }),
      })

      if (!response.ok) {
        throw new Error('Failed to rename chat')
      }

      setChats((prev) =>
        prev.map((chat) => (chat.chat_id === chatId ? { ...chat, title: nextTitle } : chat))
      )
      setEditingChatId(null)
      setEditingTitle('')
    } catch (err) {
      console.error('Failed to rename chat:', err)
    } finally {
      setActionChatId(null)
    }
  }

  const deleteChat = async (chatId: number) => {
    if (!token) return

    setActionChatId(chatId)
    try {
      const response = await fetch(`${apiUrl}/chats/${chatId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete chat')
      }

      setChats((prev) => prev.filter((chat) => chat.chat_id !== chatId))
      onChatDeleted(chatId)
    } catch (err) {
      console.error('Failed to delete chat:', err)
    } finally {
      setActionChatId(null)
    }
  }

  const PencilIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  )

  const TrashIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 md:hidden z-40" />}

      <aside
        className={`fixed md:relative w-72 h-screen bg-slate-800 border-r border-slate-700 flex flex-col transition-transform duration-200 z-50 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white mb-3">Amzur Chat</h2>
          <button
            onClick={onNewChat}
            className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium text-sm transition duration-200"
          >
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-slate-400 text-sm">Loading...</div>
          ) : chats.length === 0 ? (
            <div className="p-4 text-slate-400 text-sm">No chats yet. Create one to get started!</div>
          ) : (
            <div className="p-2 space-y-1">
              {chats.map((chat) => (
                <div
                  key={chat.chat_id}
                  className={`group rounded-lg transition duration-200 text-sm ${
                    currentChatId === chat.chat_id
                      ? 'bg-purple-600/30 border-l-2 border-purple-500'
                      : 'hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-start gap-2 px-3 py-2">
                    <button
                      onClick={() => onSelectChat(chat.chat_id, displayTitle(chat))}
                      className={`min-w-0 flex-1 text-left ${
                        currentChatId === chat.chat_id ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {editingChatId === chat.chat_id ? (
                        <input
                          autoFocus
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onBlur={() => {
                            void saveRename(chat.chat_id)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              void saveRename(chat.chat_id)
                            }
                            if (event.key === 'Escape') {
                              setEditingChatId(null)
                              setEditingTitle('')
                            }
                          }}
                          onClick={(event) => event.stopPropagation()}
                          className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-white outline-none ring-1 ring-purple-500"
                        />
                      ) : (
                        <>
                          <div className="font-medium truncate">{displayTitle(chat)}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {chat.message_count} message{chat.message_count !== 1 ? 's' : ''} • {formatDate(chat.created_at)}
                          </div>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          startRename(chat)
                        }}
                        disabled={actionChatId === chat.chat_id}
                        className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                        aria-label={`Rename chat ${chat.chat_id}`}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          void deleteChat(chat.chat_id)
                        }}
                        disabled={actionChatId === chat.chat_id}
                        className="rounded p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
                        aria-label={`Delete chat ${chat.chat_id}`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-700 p-4 space-y-2">
          <div className="text-sm text-slate-400 truncate">{user?.name || user?.email}</div>
          <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          <button
            onClick={() => navigate('/database')}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-blue-700 text-slate-300 hover:text-white rounded-lg font-medium text-sm transition duration-200 flex items-center justify-center gap-2"
          >
            🗄 DB Chat
          </button>
          <button
            onClick={() => navigate('/sheets')}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-emerald-700 text-slate-300 hover:text-white rounded-lg font-medium text-sm transition duration-200 flex items-center justify-center gap-2"
          >
            📊 Sheet Agent
          </button>
          <button
            onClick={() => navigate('/research')}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-violet-700 text-slate-300 hover:text-white rounded-lg font-medium text-sm transition duration-200 flex items-center justify-center gap-2"
          >
            🔬 Research Agent
          </button>
          <button
            onClick={() => navigate('/game')}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-indigo-700 text-slate-300 hover:text-white rounded-lg font-medium text-sm transition duration-200 flex items-center justify-center gap-2"
          >
            🎮 AI Tic Tac Toe
          </button>
          <button
            onClick={() => navigate('/tickets')}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-rose-700 text-slate-300 hover:text-white rounded-lg font-medium text-sm transition duration-200 flex items-center justify-center gap-2"
          >
            🎫 Support Tickets
          </button>
          <button
            onClick={onLogout}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg font-medium text-sm transition duration-200"
          >
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}
