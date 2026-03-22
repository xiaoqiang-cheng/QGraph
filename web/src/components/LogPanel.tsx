import { useEffect, useRef, useState, useCallback } from 'react'

interface LogEntry {
  node_id: string
  message: string
  timestamp: number
}

interface LogPanelProps {
  logs: LogEntry[]
  isRunning: boolean
  onClose: () => void
  onClear: () => void
  nodeNames?: Map<string, string>
}

export default function LogPanel({ logs, isRunning, onClose, onClear, nodeNames }: LogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(240)
  const [autoScroll, setAutoScroll] = useState(true)
  const [filterNodeId, setFilterNodeId] = useState<string>('')
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs.length, autoScroll])

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }, [])

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startH: height }

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - ev.clientY
      setHeight(Math.max(120, Math.min(600, dragRef.current.startH + delta)))
    }
    const onUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [height])

  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 4,
  }

  return (
    <div style={{
      height,
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'relative',
    }}>
      <div
        onMouseDown={onDragStart}
        style={{
          position: 'absolute',
          top: -3,
          left: 0,
          right: 0,
          height: 6,
          cursor: 'ns-resize',
          zIndex: 10,
        }}
      />
      <div style={{
        padding: '6px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Logs</span>
        {isRunning && (
          <span style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'rgba(245,158,11,0.15)',
            color: 'var(--warning)',
            fontWeight: 600,
          }}>RUNNING</span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {logs.length} lines
        </span>
        {nodeNames && nodeNames.size > 0 && (
          <select
            value={filterNodeId}
            onChange={e => setFilterNodeId(e.target.value)}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-primary)',
              fontSize: 11,
              padding: '2px 6px',
              outline: 'none',
              maxWidth: 140,
            }}
          >
            <option value="">All Nodes</option>
            {Array.from(nodeNames.entries()).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        )}
        <div style={{ flex: 1 }} />
        {!autoScroll && (
          <button
            onClick={() => {
              setAutoScroll(true)
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            }}
            style={{ ...btnStyle, color: 'var(--accent)' }}
          >↓ Follow</button>
        )}
        <button onClick={onClear} style={btnStyle}>Clear</button>
        <button
          onClick={onClose}
          style={{ ...btnStyle, fontSize: 16, padding: '0 4px' }}
        >✕</button>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 16px',
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        {logs.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {isRunning ? 'Waiting for logs...' : 'No logs. Click ▶ Run to start.'}
          </div>
        )}
        {logs
          .filter(entry => !filterNodeId || entry.node_id === filterNodeId)
          .map((entry, i) => {
          const msg = entry.message
          const isError = msg.includes('Failed') || msg.includes('ERROR') || msg.includes('[stderr]')
          const isSuccess = msg.includes('Completed') || msg.includes('successfully')
          return (
            <div key={i} style={{
              color: isError ? 'var(--error)' : isSuccess ? 'var(--success)' : 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>
                [{entry.node_id.substring(0, 15)}]
              </span>
              {msg}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
