import { useNavigate } from 'react-router-dom'
import { SheetUpload } from '@/components/SheetUpload'
import { SheetPreview } from '@/components/SheetPreview'
import { SheetChat } from '@/components/SheetChat'
import { useSheetAgent } from '@/hooks/useSheetAgent'
import { useAuth } from '@/contexts/AuthContext'

export const SheetsPage = () => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const {
    session,
    messages,
    isLoadingSession,
    isQuerying,
    error,
    uploadSheet,
    importGoogleSheet,
    askQuestion,
  } = useSheetAgent()

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-4 md:py-6 space-y-4">
        <header className="rounded-xl border border-slate-300/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 md:p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Spreadsheet Query Agent</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              CSV, XLSX, and Google Sheets with AI-powered conversational analysis.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Back to Chat
            </button>
            <button
              onClick={() => navigate('/database')}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              DB Chat
            </button>
            <button
              onClick={() => navigate('/game')}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              AI Game
            </button>
            <button
              onClick={() => {
                logout()
                navigate('/login')
              }}
              className="rounded-lg bg-slate-800 dark:bg-slate-700 px-3 py-2 text-sm text-white hover:opacity-90"
            >
              Logout
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <SheetUpload
          onUpload={uploadSheet}
          onGoogleImport={importGoogleSheet}
          isLoading={isLoadingSession}
        />

        {session && (
          <div className="grid gap-4 xl:grid-cols-2 items-start">
            <SheetPreview session={session} />
            <SheetChat
              session={session}
              messages={messages}
              isQuerying={isQuerying}
              onAsk={askQuestion}
            />
          </div>
        )}
      </div>
    </div>
  )
}
