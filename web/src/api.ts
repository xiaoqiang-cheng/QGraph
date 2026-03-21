import type { GraphData, GraphSummary, RunInfo, RunHistoryEntry, RunLogData } from './types'

const BASE_URL = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {}
  if (options?.body) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || res.statusText)
  }
  return res.json()
}

export const api = {
  listGraphs: () => request<GraphSummary[]>('/graphs'),

  getGraph: (name: string) => request<GraphData>(`/graphs/${encodeURIComponent(name)}`),

  createGraph: (name: string) => request<GraphData>(`/graphs/${encodeURIComponent(name)}`, { method: 'POST' }),

  saveGraph: (name: string, data: Partial<GraphData>) =>
    request<{ status: string }>(`/graphs/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteGraph: (name: string) =>
    request<{ status: string }>(`/graphs/${encodeURIComponent(name)}/delete`, { method: 'POST' }),

  runGraph: (name: string) =>
    request<{ status: string; run_id: string }>(`/graphs/${encodeURIComponent(name)}/run`, {
      method: 'POST',
    }),

  listRuns: () => request<RunInfo[]>('/runs'),

  listRunHistory: () => request<RunHistoryEntry[]>('/runs/history'),

  getRunLogs: (runId: string) =>
    request<RunLogData>(`/runs/${encodeURIComponent(runId)}/logs`),

  deleteRunLog: (runId: string) =>
    request<{ status: string }>(`/runs/${encodeURIComponent(runId)}/delete`, { method: 'POST' }),

  stopRun: (runId: string) =>
    request<{ status: string }>(`/runs/${encodeURIComponent(runId)}/stop`, { method: 'POST' }),
}
