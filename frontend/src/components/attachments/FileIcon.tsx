/**
 * Renders a coloured icon representing a file MIME type.
 */

interface FileIconProps {
  fileType: string
  className?: string
}

function getIconInfo(fileType: string): { emoji: string; colour: string } {
  if (fileType.startsWith('image/'))  return { emoji: '🖼️', colour: 'text-purple-400' }
  if (fileType.startsWith('video/'))  return { emoji: '🎬', colour: 'text-red-400' }
  if (fileType === 'text/csv')        return { emoji: '📊', colour: 'text-green-400' }
  if (fileType.includes('spreadsheet') || fileType.includes('excel'))
                                      return { emoji: '📗', colour: 'text-green-500' }
  if (fileType === 'application/json')return { emoji: '{ }', colour: 'text-yellow-400' }
  if (fileType === 'application/pdf') return { emoji: '📄', colour: 'text-red-500' }
  if (
    fileType.includes('javascript') ||
    fileType.includes('typescript') ||
    fileType.includes('python') ||
    fileType.includes('java') ||
    fileType.includes('c++') ||
    fileType.includes('html') ||
    fileType.includes('css') ||
    fileType.includes('sql')
  )                                   return { emoji: '💻', colour: 'text-blue-400' }
  return { emoji: '📎', colour: 'text-slate-400' }
}

export const FileIcon = ({ fileType, className = '' }: FileIconProps) => {
  const { emoji, colour } = getIconInfo(fileType)
  return (
    <span className={`text-xl select-none ${colour} ${className}`} aria-hidden="true">
      {emoji}
    </span>
  )
}
