import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'
import type { GraphSummary, RunInfo, RunHistoryEntry, RunLogData, WsMessage } from '../types'

interface DashboardProps {
  onOpenGraph: (name: string) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

function LogViewer({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [logData, setLogData] = useState<RunLogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const data = await api.getRunLogs(runId)
        if (active) { setLogData(data); setLoading(false) }
      } catch (err) {
        if (active) { setError(String(err)); setLoading(false) }
      }
    }
    load()
    return () => { active = false }
  }, [runId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logData])

  const statusColor = (s: string) =>
    s === 'completed' ? 'var(--success)' : s === 'failed' || s.startsWith('error') ? 'var(--error)' : 'var(--warning)'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '85vw',
          maxWidth: 900,
          height: '75vh',
          background: 'var(--bg-secondary)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Run Logs</span>
          {logData && (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{logData.graph_name}</span>
              <span style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                background: logData.status === 'completed' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                color: statusColor(logData.status),
                fontWeight: 500,
              }}>{logData.status}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {logData.logs.length} lines
              </span>
            </>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: 18,
              padding: '2px 6px',
            }}
          >✕</button>
        </div>

        {logData && (
          <div style={{
            padding: '8px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: 16,
            fontSize: 11,
            color: 'var(--text-muted)',
            flexShrink: 0,
            flexWrap: 'wrap',
          }}>
            <span>ID: {logData.run_id}</span>
            {logData.started_at && <span>Started: {new Date(logData.started_at).toLocaleString()}</span>}
            {logData.finished_at && <span>Finished: {new Date(logData.finished_at).toLocaleString()}</span>}
            <span>
              Nodes: {Object.entries(logData.node_statuses).map(([nid, st]) => (
                <span key={nid} style={{
                  marginLeft: 4,
                  padding: '0 4px',
                  borderRadius: 3,
                  background: st === 'success' ? 'rgba(34,197,94,0.12)' : st === 'failed' ? 'rgba(239,68,68,0.12)' : 'rgba(107,114,128,0.1)',
                  color: st === 'success' ? 'var(--success)' : st === 'failed' ? 'var(--error)' : 'var(--text-muted)',
                }}>{nid.substring(0, 12)}</span>
              ))}
            </span>
          </div>
        )}

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 20px',
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: 12,
          lineHeight: 1.7,
        }}>
          {loading && <div style={{ color: 'var(--text-muted)' }}>Loading...</div>}
          {error && <div style={{ color: 'var(--error)' }}>Error: {error}</div>}
          {logData && logData.logs.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No log output.</div>
          )}
          {logData?.logs.map((entry, i) => {
            const line = typeof entry === 'string' ? entry : `[${entry.node_id}] ${entry.message}`
            const isErr = line.includes('Failed') || line.includes('ERROR') || line.includes('[stderr]')
            const isOk = line.includes('Completed') || line.includes('successfully')
            return (
              <div key={i} style={{
                color: isErr ? 'var(--error)' : isOk ? 'var(--success)' : 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>{line}</div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ onOpenGraph, theme, onToggleTheme }: DashboardProps) {
  const [graphs, setGraphs] = useState<GraphSummary[]>([])
  const [runs, setRuns] = useState<RunInfo[]>([])
  const [history, setHistory] = useState<RunHistoryEntry[]>([])
  const [newGraphName, setNewGraphName] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deletingRun, setDeletingRun] = useState<string | null>(null)
  const [viewingLog, setViewingLog] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [g, r] = await Promise.all([api.listGraphs(), api.listRuns()])
      setGraphs(g)
      setRuns(r)
    } catch {
      try { setGraphs(await api.listGraphs()) } catch { /* */ }
    }
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await api.listRunHistory())
    } catch { /* */ }
  }, [])

  useEffect(() => {
    loadData()
    loadHistory()
    const interval = setInterval(() => { loadData(); loadHistory() }, 5000)
    return () => clearInterval(interval)
  }, [loadData, loadHistory])

  useEffect(() => {
    const wsUrl = `ws://${window.location.host}/ws/dashboard`
    let ws: WebSocket | null = null

    function connect() {
      ws = new WebSocket(wsUrl)
      ws.onmessage = (ev) => {
        const msg: WsMessage = JSON.parse(ev.data)
        if (msg.type === 'run_update') {
          loadData()
          loadHistory()
        } else if (msg.type === 'ping') {
          ws?.send(JSON.stringify({ type: 'pong' }))
        }
      }
      ws.onclose = () => { setTimeout(connect, 2000) }
    }
    connect()

    return () => { ws?.close() }
  }, [loadData, loadHistory])

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

  const handleDeleteRun = useCallback(async (runId: string) => {
    setDeletingRun(runId)
    try {
      await api.deleteRunLog(runId)
    } catch (err) {
      alert(`Delete failed: ${err}`)
    } finally {
      setDeletingRun(null)
      await loadHistory()
    }
  }, [loadHistory])

  const activeRuns = runs.filter(r => r.status === 'running')

  const sortedHistory = [...history].sort((a, b) => {
    const ta = a.started_at ? new Date(a.started_at).getTime() : 0
    const tb = b.started_at ? new Date(b.started_at).getTime() : 0
    return tb - ta
  })

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

  const statusColor = (s: string) =>
    s === 'completed' ? 'var(--success)' : s === 'failed' ? 'var(--error)' : 'var(--warning)'

  const statusIcon = (s: string) =>
    s === 'completed' ? '✓' : s === 'failed' ? '✗' : '⟳'

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {viewingLog && <LogViewer runId={viewingLog} onClose={() => setViewingLog(null)} />}

      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
        background: 'var(--bg-secondary)',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
          QGraph
        </h1>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Pipeline Dashboard
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={newGraphName}
            onChange={e => setNewGraphName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="New pipeline name..."
            style={{
              padding: '6px 12px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none',
              width: 180,
            }}
          />
          <button onClick={handleCreate} style={{
            ...btnStyle,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
          }}>+ Create</button>
        </div>
        <button
          onClick={onToggleTheme}
          style={{ ...btnStyle, marginLeft: 4 }}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        <div style={{
          width: 340,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px 8px',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            flexShrink: 0,
          }}>
            Pipelines ({graphs.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
            {graphs.length === 0 ? (
              <div style={{
                padding: 24,
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 13,
              }}>
                No pipelines yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {graphs.map(g => {
                  const graphRuns = runs.filter(r => r.graph_name === g.name && r.status === 'running')
                  const isDeleting = deleting === g.name
                  return (
                    <div key={g.name} style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      opacity: isDeleting ? 0.5 : 1,
                      transition: 'opacity 0.2s',
                    }}>
                      <div
                        style={{ cursor: 'pointer', marginBottom: 6 }}
                        onClick={() => onOpenGraph(g.name)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</span>
                          {graphRuns.length > 0 && (
                            <span style={{
                              fontSize: 9,
                              padding: '1px 6px',
                              borderRadius: 10,
                              background: 'rgba(245,158,11,0.15)',
                              color: 'var(--warning)',
                              fontWeight: 600,
                            }}>RUNNING</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                          {g.node_count} nodes · {new Date(g.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => onOpenGraph(g.name)}
                          style={{
                            ...btnStyle, fontSize: 11, padding: '3px 8px',
                            color: 'var(--accent)', flex: 1,
                          }}
                        >Edit</button>
                        <button
                          onClick={() => handleRun(g.name)}
                          style={{
                            ...btnStyle, fontSize: 11, padding: '3px 8px',
                            background: 'var(--success)', color: '#fff', border: 'none', flex: 1,
                          }}
                        >▶ Run</button>
                        <button
                          disabled={isDeleting}
                          onClick={() => handleDelete(g.name)}
                          style={{
                            ...btnStyle, fontSize: 11, padding: '3px 8px',
                            color: 'var(--error)',
                          }}
                        >{isDeleting ? '...' : 'Del'}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {activeRuns.length > 0 && (
            <div style={{
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
              maxHeight: '35%',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{
                padding: '12px 16px 8px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--warning)',
                flexShrink: 0,
              }}>
                ⟳ Running ({activeRuns.length})
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeRuns.map(run => (
                    <div key={run.run_id} style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--warning)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{run.graph_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {run.elapsed_seconds}s
                          {run.current_node && (
                            <span style={{ color: 'var(--warning)', marginLeft: 6 }}>
                              ⟳ {run.current_node}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 3, marginTop: 5, flexWrap: 'wrap' }}>
                          {Object.entries(run.node_statuses).map(([nid, st]) => (
                            <span key={nid} style={{
                              fontSize: 9,
                              padding: '1px 5px',
                              borderRadius: 3,
                              background: st === 'success' ? 'rgba(34,197,94,0.15)'
                                : st === 'running' ? 'rgba(245,158,11,0.15)'
                                : st === 'failed' ? 'rgba(239,68,68,0.15)'
                                : 'rgba(107,114,128,0.1)',
                              color: st === 'success' ? 'var(--success)'
                                : st === 'running' ? 'var(--warning)'
                                : st === 'failed' ? 'var(--error)'
                                : 'var(--text-muted)',
                            }}>{nid.substring(0, 12)}</span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => onOpenGraph(run.graph_name)}
                        style={{ ...btnStyle, fontSize: 11, padding: '4px 10px', color: 'var(--accent)' }}
                      >View</button>
                      <button
                        onClick={() => handleStop(run.run_id)}
                        style={{
                          ...btnStyle, fontSize: 11, padding: '4px 10px',
                          background: 'var(--error)', color: '#fff', border: 'none',
                        }}
                      >Stop</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px 8px',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              flexShrink: 0,
            }}>
              Execution History ({history.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
              {sortedHistory.length === 0 ? (
                <div style={{
                  padding: 32,
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                }}>
                  No execution history yet. Run a pipeline to see results here.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sortedHistory.slice(0, 50).map(entry => {
                    const isDel = deletingRun === entry.run_id
                    return (
                      <div key={entry.run_id} style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        opacity: isDel ? 0.4 : 1,
                        transition: 'opacity 0.15s',
                      }}>
                        <span style={{
                          fontSize: 12,
                          color: statusColor(entry.status),
                          flexShrink: 0,
                        }}>{statusIcon(entry.status)}</span>
                        <div
                          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                          onClick={() => setViewingLog(entry.run_id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 500, fontSize: 12 }}>{entry.graph_name}</span>
                            <span style={{
                              fontSize: 10,
                              padding: '0 5px',
                              borderRadius: 3,
                              background: entry.status === 'completed' ? 'rgba(34,197,94,0.1)'
                                : entry.status === 'failed' ? 'rgba(239,68,68,0.1)'
                                : 'rgba(107,114,128,0.08)',
                              color: statusColor(entry.status),
                            }}>{entry.status}</span>
                            <span style={{
                              fontSize: 10,
                              color: 'var(--accent)',
                              marginLeft: 'auto',
                              flexShrink: 0,
                            }}>Logs →</span>
                          </div>
                          <div style={{
                            fontSize: 10,
                            color: 'var(--text-muted)',
                            marginTop: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {entry.started_at ? new Date(entry.started_at).toLocaleString() : entry.run_id}
                            <span style={{ marginLeft: 6 }}>{entry.log_count} lines</span>
                          </div>
                        </div>
                        <button
                          disabled={isDel}
                          onClick={() => handleDeleteRun(entry.run_id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            fontSize: 12,
                            padding: '2px 4px',
                            opacity: 0.5,
                            flexShrink: 0,
                          }}
                          title="Delete this run log"
                        >{isDel ? '...' : '✕'}</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
