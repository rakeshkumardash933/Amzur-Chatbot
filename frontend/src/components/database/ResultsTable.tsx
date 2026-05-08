/**
 * ResultsTable — renders SQL query results in a paginated, sortable table.
 */
import { useState, useMemo } from 'react'
import type { QueryResult } from '@/hooks/useDatabaseQuery'

interface ResultsTableProps {
  result: QueryResult
}

const PAGE_SIZE = 20

function cellValue(v: string | number | boolean | null): string {
  if (v === null || v === undefined) return 'NULL'
  return String(v)
}

export const ResultsTable = ({ result }: ResultsTableProps) => {
  const [page, setPage] = useState(0)
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    if (!filter.trim()) return result.rows
    const q = filter.toLowerCase()
    return result.rows.filter((row) =>
      row.some((cell) => cellValue(cell).toLowerCase().includes(q))
    )
  }, [result.rows, filter])

  const sorted = useMemo(() => {
    if (sortCol === null) return filtered
    return [...filtered].sort((a, b) => {
      const av = cellValue(a[sortCol])
      const bv = cellValue(b[sortCol])
      const n = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' })
      return sortAsc ? n : -n
    })
  }, [filtered, sortCol, sortAsc])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      setSortAsc((v) => !v)
    } else {
      setSortCol(colIdx)
      setSortAsc(true)
    }
    setPage(0)
  }

  // CSV export
  const exportCSV = () => {
    const header = result.columns.join(',')
    const body = result.rows
      .map((row) => row.map((c) => `"${cellValue(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'query_results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (result.error) {
    return (
      <div className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300 text-sm">
        <strong>Execution error:</strong> {result.error}
      </div>
    )
  }

  if (!result.columns.length) {
    return (
      <div className="mt-4 p-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 text-sm">
        No results returned.
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Meta row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-3 text-xs text-slate-400">
          <span className="bg-slate-700 px-2 py-1 rounded">
            {result.row_count} row{result.row_count !== 1 ? 's' : ''}
          </span>
          <span className="bg-slate-700 px-2 py-1 rounded">
            {result.execution_time_ms} ms
          </span>
          {filter && (
            <span className="bg-blue-800/50 px-2 py-1 rounded">
              {filtered.length} matching
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(0) }}
            placeholder="Filter results…"
            className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-40"
          />
          <button
            onClick={exportCSV}
            className="text-xs px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded transition-colors"
          >
            ⬇ CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-700/80 text-slate-300 text-xs uppercase">
            <tr>
              {result.columns.map((col, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  className="px-3 py-2 cursor-pointer select-none whitespace-nowrap hover:bg-slate-600/60 transition-colors"
                >
                  {col}
                  {sortCol === i ? (sortAsc ? ' ↑' : ' ↓') : ' ⇅'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {pageRows.map((row, ri) => (
              <tr
                key={ri}
                className="bg-slate-900/50 hover:bg-slate-800/60 transition-colors"
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-2 text-slate-300 max-w-[300px] truncate"
                    title={cellValue(cell)}
                  >
                    {cellValue(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded"
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded"
            >
              ‹
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded"
            >
              ›
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page === totalPages - 1}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
