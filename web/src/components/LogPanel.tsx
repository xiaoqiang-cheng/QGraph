import { useEffect, useRef } from 'react'

interface LogEntry {
  node_id: string
  message: string
  timestamp: number
}

interface LogPanelProps {
  logs: LogEntry[]
  onClose: () => void
}

export default function LogPanel({ logs, onClose }: LogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  return (
    <div style={{
      height: 220,
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Logs</span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 16,
            padding: '2px 6px',
          }}
        >✕</button>
      </div>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 16px',
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: 12,
        lineHeight: 1.6,
      }}>
        {logs.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Waiting for logs...
          </div>
        )}
        {logs.map((entry, i) => {
          const isError = entry.message.includes('Failed') || entry.message.includes('ERROR') || entry.message.includes('[stderr]')
          const isSuccess = entry.message.includes('Completed') || entry.message.includes('successfully')
          return (
            <div key={i} style={{
              color: isError ? 'var(--error)' : isSuccess ? 'var(--success)' : 'var(--text-primary)',
            }}>
              <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>
                [{entry.node_id.substring(0, 12)}]
              </span>
              {entry.message}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
