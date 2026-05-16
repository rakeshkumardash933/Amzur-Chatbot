import { SheetSession } from '@/hooks/useSheetAgent'

interface SheetPreviewProps {
  session: SheetSession
}

export const SheetPreview = ({ session }: SheetPreviewProps) => {
  const { preview } = session

  return (
    <div className="rounded-xl border border-slate-300/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 md:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-slate-100">Spreadsheet Preview</h3>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1">
            {session.source_name} {session.worksheet_name ? `• ${session.worksheet_name}` : ''}
          </p>
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-400">
          Total rows: <span className="font-semibold text-slate-900 dark:text-slate-100">{preview.row_count}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="min-w-full text-xs md:text-sm">
          <thead className="bg-slate-100 dark:bg-slate-900">
            <tr>
              {preview.columns.map((column) => (
                <th
                  key={column}
                  className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-slate-500 dark:text-slate-400" colSpan={Math.max(1, preview.columns.length)}>
                  Sheet has no rows.
                </td>
              </tr>
            ) : (
              preview.rows.map((row, idx) => (
                <tr key={idx} className="border-t border-slate-200 dark:border-slate-700">
                  {preview.columns.map((column) => (
                    <td key={`${idx}-${column}`} className="px-3 py-2 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {row[column] === null ? 'NULL' : String(row[column] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Data Types</p>
          <div className="space-y-1 text-xs md:text-sm">
            {Object.entries(preview.dtypes).map(([name, dtype]) => (
              <div key={name} className="flex items-center justify-between gap-2">
                <span className="text-slate-700 dark:text-slate-300 truncate">{name}</span>
                <span className="text-slate-500 dark:text-slate-400">{dtype}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Missing Values</p>
          {Object.keys(preview.missing_values).length === 0 ? (
            <p className="text-xs md:text-sm text-emerald-600 dark:text-emerald-400">No missing values detected.</p>
          ) : (
            <div className="space-y-1 text-xs md:text-sm">
              {Object.entries(preview.missing_values).map(([name, count]) => (
                <div key={name} className="flex items-center justify-between gap-2">
                  <span className="text-slate-700 dark:text-slate-300 truncate">{name}</span>
                  <span className="text-amber-600 dark:text-amber-400">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
