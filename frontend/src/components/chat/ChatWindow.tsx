/**
 * Main chat window component combining message list and input with sidebar.
 * Supports text chat, AI image generation, and RAG document chat.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageList } from './MessageList'
import { InputBox } from './InputBox'
import { ChatSidebar } from './ChatSidebar.tsx'
import { DocumentPanel } from './DocumentPanel'
import { useChat } from '../../hooks/useChat'
import { useImageGeneration } from '../../hooks/useImageGeneration'
import { useDocuments } from '../../hooks/useDocuments'
import { useAuth } from '@/contexts/AuthContext'
import { isImageGenerationRequest, extractImagePrompt } from '@/lib/imageGenerationUtils'

export const ChatWindow = () => {
  const [chatId, setChatId] = useState<number | null>(null)
  const [chatTitle, setChatTitle] = useState<string>('New Chat')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [docPanelOpen, setDocPanelOpen] = useState(false)
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    addLocalMessage,
    clearChat,
    setActiveChatId,
    pendingAttachments,
    uploadAttachment,
    removeAttachment,
  } = useChat(chatId)
  const {
    generatedImages,
    isGenerating: isGeneratingImage,
    error: imageError,
    generateImage,
    loadImages,
    clearImages,
  } = useImageGeneration()
  const {
    documents,
    isUploading: isUploadingPDF,
    uploadError,
    uploadPDF,
    loadDocuments,
    deleteDocument,
    chatWithDocument,
    clearDocuments,
    pollDocument,
    isChatting: isDocChatting,
  } = useDocuments()
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
      clearImages()
      clearDocuments()
      setDocPanelOpen(false)
      setChatId(data.chat_id)
      setActiveChatId(data.chat_id)
      setChatTitle(data.title || 'New Chat')
    } catch (err) {
      console.error('Failed to create chat:', err)
    }
  }

  const handleSelectChat = (cid: number, title: string) => {
    clearImages()
    clearDocuments()
    setDocPanelOpen(false)
    setChatId(cid)
    setActiveChatId(cid)
    setChatTitle(title || `Chat #${cid}`)
    void loadImages(cid)
    void loadDocuments(cid)
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

  const handleClearChat = async () => {
    const cleared = await clearChat()
    if (!cleared) return
    clearImages()
    clearDocuments()
    setDocPanelOpen(false)
    setChatId(null)
    setChatTitle('New Chat')
  }

  /**
   * Route: image generation → PDF document chat (via @doc prefix or has documents) → normal chat.
   */
  const handleSendMessage = async (message: string) => {
    if (!chatId) return

    if (isImageGenerationRequest(message)) {
      addLocalMessage('user', message)
      const prompt = extractImagePrompt(message)
      await generateImage(prompt, chatId)
      return
    }

    // If there are processed docs in this thread, check for @doc trigger or auto-route
    const hasProcessedDocs = documents.some((d) => d.is_processed)
    const isDocQuery = message.startsWith('@doc ') || message.startsWith('@doc\n')
    const cleanedMessage = isDocQuery ? message.replace(/^@doc\s*/i, '').trim() : message

    if (hasProcessedDocs && isDocQuery) {
      addLocalMessage('user', message)
      const result = await chatWithDocument(cleanedMessage, chatId)
      if (result) {
        const sourceLine =
          result.sources.length > 0
            ? `\n\n*Sources: ${[...new Set(result.sources.map((s) => s.file_name))].join(', ')}*`
            : ''
        addLocalMessage('assistant', result.response + sourceLine)
      }
      return
    }

    await sendMessage(message)
  }

  const handlePDFUpload = async (file: File) => {
    if (!chatId) return
    const doc = await uploadPDF(file, chatId)
    if (doc) {
      // Poll until processed
      void pollDocument(doc.id)
    }
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
            <header className="bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
              <h1 className="text-xl font-bold text-white">{chatTitle}</h1>
              <button
                onClick={() => setDocPanelOpen((v) => !v)}
                title="Manage PDF documents for this chat"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  docPanelOpen
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                📄
                <span>Docs</span>
                {documents.length > 0 && (
                  <span className="ml-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {documents.length}
                  </span>
                )}
              </button>
            </header>

            {(error || imageError) && (() => {
              const msg = error || imageError || ''
              const isBudget = msg.toLowerCase().includes('budget')
              return (
                <div
                  className={`border-l-4 p-4 ${isBudget ? 'bg-amber-900/30 border-amber-500 text-amber-200' : 'bg-red-900/20 border-red-500 text-red-200'}`}
                  role="alert"
                >
                  {isBudget ? (
                    <div className="flex items-start gap-3">
                      <span className="text-2xl shrink-0">⚠️</span>
                      <div>
                        <p className="font-semibold mb-1">AI Budget Exhausted</p>
                        <p className="text-sm">{msg}</p>
                        <p className="text-xs mt-2 text-amber-300">Please ask your administrator to top up the LiteLLM quota before continuing.</p>
                      </div>
                    </div>
                  ) : msg}
                </div>
              )
            })()}

            <MessageList
              messages={messages}
              isLoading={isLoading || isGeneratingImage || isDocChatting}
              generatedImages={generatedImages}
            />

            {docPanelOpen && (
              <DocumentPanel
                documents={documents}
                isUploading={isUploadingPDF}
                uploadError={uploadError}
                onUpload={handlePDFUpload}
                onDelete={(id) => void deleteDocument(id)}
                onClose={() => setDocPanelOpen(false)}
              />
            )}

            <InputBox
              onSend={handleSendMessage}
              isLoading={isLoading || isGeneratingImage || isDocChatting}
              onClear={handleClearChat}
              pendingAttachments={pendingAttachments}
              onAttachFiles={(files) => { files.forEach((f) => void uploadAttachment(f)) }}
              onRemoveAttachment={removeAttachment}
              hasChatId={!!chatId}
            />
          </>
        )}
      </div>
    </div>
  )
}
