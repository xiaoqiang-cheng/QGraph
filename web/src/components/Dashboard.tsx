import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { GraphSummary, RunInfo, WsMessage } from '../types'

interface DashboardProps {
  onOpenGraph: (name: string) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

export default function Dashboard({ onOpenGraph, theme, onToggleTheme }: DashboardProps) {
  const [graphs, setGraphs] = useState<GraphSummary[]>([])
  const [runs, setRuns] = useState<RunInfo[]>([])
  const [newGraphName, setNewGraphName] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [g, r] = await Promise.all([api.listGraphs(), api.listRuns()])
      setGraphs(g)
      setRuns(r)
    } catch {
      try { setGraphs(await api.listGraphs()) } catch { /* */ }
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 3000)
    return () => clearInterval(interval)
  }, [loadData])

  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:9800/ws/dashboard`
    let ws: WebSocket | null = null

    function connect() {
      ws = new WebSocket(wsUrl)
      ws.onmessage = (ev) => {
        const msg: WsMessage = JSON.parse(ev.data)
        if (msg.type === 'run_update') {
          loadData()
        } else if (msg.type === 'ping') {
          ws?.send(JSON.stringify({ type: 'pong' }))
        }
      }
      ws.onclose = () => { setTimeout(connect, 2000) }
    }
    connect()

    return () => { ws?.close() }
  }, [loadData])

  const handleCreate = async () => {
    const name = newGraphName.trim()
    if (!name) return
    try {
      await api.createGraph(name)
      setNewGraphName('')
      onOpenGraph(name)
    } catch (err) {
      alert(String(err))
    }
  }

  const handleDelete = useCallback(async (name: string) => {
    if (!window.confirm(`Delete graph "${name}"?`)) return
    setDeleting(name)
    try {
      await api.deleteGraph(name)
    } catch (err) {
      console.error('[QGraph] Delete error:', err)
      alert(`Delete failed: ${err}`)
    } finally {
      setDeleting(null)
      await loadData()
    }
  }, [loadData])

  const handleRun = async (name: string) => {
    await api.runGraph(name)
    await loadData()
  }

  const handleStop = async (runId: string) => {
    await api.stopRun(runId)
    await loadData()
  }

  const activeRuns = runs.filter(r => r.status === 'running')
  const recentRuns = runs.filter(r => r.status !== 'running')

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 16,
  }

  const btnStyle: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'var(--bg-primary)',
      overflow: 'auto',
    }}>
      <div style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '32px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
            QGraph
          </h1>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 12 }}>
            Pipeline Dashboard
          </span>
          <button
            onClick={onToggleTheme}
            style={{ ...btnStyle, marginLeft: 'auto' }}
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        {activeRuns.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--warning)' }}>
              ⟳ Running ({activeRuns.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeRuns.map(run => (
                <div key={run.run_id} style={{
                  ...cardStyle,
                  borderColor: 'var(--warning)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{run.graph_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {run.run_id} · {run.elapsed_seconds}s
                      {run.current_node && (
                        <span style={{ color: 'var(--warning)', marginLeft: 8 }}>
                          ⟳ {run.current_node}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      {Object.entries(run.node_statuses).map(([nodeId, status]) => (
                        <span key={nodeId} style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: status === 'success' ? 'rgba(34,197,94,0.15)'
                            : status === 'running' ? 'rgba(245,158,11,0.15)'
                            : status === 'failed' ? 'rgba(239,68,68,0.15)'
                            : 'rgba(107,114,128,0.1)',
                          color: status === 'success' ? 'var(--success)'
                            : status === 'running' ? 'var(--warning)'
                            : status === 'failed' ? 'var(--error)'
                            : 'var(--text-muted)',
                        }}>
                          {nodeId.substring(0, 15)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenGraph(run.graph_name)}
                    style={{ ...btnStyle, background: 'var(--accent)', color: '#fff', border: 'none' }}
                  >View</button>
                  <button
                    onClick={() => handleStop(run.run_id)}
                    style={{ ...btnStyle, background: 'var(--error)', color: '#fff', border: 'none' }}
                  >Stop</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Pipelines</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={newGraphName}
              onChange={e => setNewGraphName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="New pipeline name..."
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button onClick={handleCreate} style={{
              ...btnStyle,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
            }}>+ Create</button>
          </div>

          {graphs.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--text-muted)' }}>
              No pipelines yet. Create one above.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {graphs.map(g => {
                const graphRuns = runs.filter(r => r.graph_name === g.name && r.status === 'running')
                const isDeleting = deleting === g.name
                return (
                  <div key={g.name} style={{
                    ...cardStyle,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    opacity: isDeleting ? 0.5 : 1,
                    transition: 'opacity 0.2s',
                  }}>
                    <div
                      style={{ flex: 1, cursor: 'pointer' }}
                      onClick={() => onOpenGraph(g.name)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{g.name}</span>
                        {graphRuns.length > 0 && (
                          <span style={{
                            fontSize: 10,
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: 'rgba(245,158,11,0.15)',
                            color: 'var(--warning)',
                            fontWeight: 600,
                          }}>RUNNING</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        {g.node_count} nodes · updated {new Date(g.updated_at).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRun(g.name)}
                      style={{ ...btnStyle, background: 'var(--success)', color: '#fff', border: 'none' }}
                    >▶ Run</button>
                    <button
                      disabled={isDeleting}
                      onClick={() => handleDelete(g.name)}
                      style={{ ...btnStyle, color: 'var(--error)' }}
                    >{isDeleting ? 'Deleting...' : 'Delete'}</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {recentRuns.length > 0 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Recent Runs</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentRuns.slice(0, 10).map(run => (
                <div key={run.run_id} style={{
                  ...cardStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  opacity: 0.7,
                }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>{run.graph_name}</span>
                    <span style={{
                      fontSize: 12,
                      marginLeft: 8,
                      color: run.status === 'completed' ? 'var(--success)' : 'var(--error)',
                    }}>
                      {run.status}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {run.elapsed_seconds}s
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
