import { ChangeEvent, useState } from 'react'

interface SheetUploadProps {
  onUpload: (file: File, worksheetName?: string) => Promise<void>
  onGoogleImport: (url: string, worksheetName?: string) => Promise<void>
  isLoading: boolean
}

export const SheetUpload = ({ onUpload, onGoogleImport, isLoading }: SheetUploadProps) => {
  const [googleUrl, setGoogleUrl] = useState('')
  const [worksheetName, setWorksheetName] = useState('')

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await onUpload(file, worksheetName)
    event.target.value = ''
  }

  const handleGoogleImport = async () => {
    const trimmed = googleUrl.trim()
    if (!trimmed) return
    await onGoogleImport(trimmed, worksheetName)
  }

  return (
    <div className="rounded-xl border border-slate-300/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 md:p-5 space-y-4">
      <div>
        <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-slate-100">Load Spreadsheet</h3>
        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1">
          Upload CSV/XLSX files or paste a Google Sheets URL shared with your service account.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-xs text-slate-600 dark:text-slate-400">Upload CSV or XLSX</span>
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => void handleFileChange(e)}
            disabled={isLoading}
            className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-white"
          />
        </label>

        <label className="block">
          <span className="text-xs text-slate-600 dark:text-slate-400">Worksheet name (optional)</span>
          <input
            value={worksheetName}
            onChange={(e) => setWorksheetName(e.target.value)}
            placeholder="Sheet1"
            disabled={isLoading}
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
          />
        </label>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <input
          value={googleUrl}
          onChange={(e) => setGoogleUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          disabled={isLoading}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
        />
        <button
          onClick={() => void handleGoogleImport()}
          disabled={isLoading || !googleUrl.trim()}
          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/60 px-4 py-2 text-sm font-medium text-white"
        >
          {isLoading ? 'Loading…' : 'Import Google Sheet'}
        </button>
      </div>
    </div>
  )
}
