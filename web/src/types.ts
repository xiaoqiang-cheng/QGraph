export type NodeType = 'shell_command' | 'python_script' | 'python_function' | 'input' | 'output'

export type NodeStatus = 'idle' | 'queued' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled'

export interface NodeConfig {
  command?: string
  working_dir?: string
  env_vars?: Record<string, string>
  script_path?: string
  args?: string[]
  python_path?: string
  module_path?: string
  function_name?: string
  kwargs?: Record<string, unknown>
  parameters?: Record<string, unknown>
}

export interface GraphData {
  name: string
  description: string
  nodes: NodeData[]
  edges: EdgeData[]
  created_at: string
  updated_at: string
}

export interface GraphSummary {
  name: string
  created_at: string
  updated_at: string
  node_count: number
}

export interface NodeData {
  id: string
  name: string
  node_type: NodeType
  position: { x: number; y: number }
  inputs: { id: string; name: string; data_type: string }[]
  outputs: { id: string; name: string; data_type: string }[]
  config: NodeConfig
  status: NodeStatus
}

export interface EdgeData {
  id: string
  source: string
  source_port: string
  target: string
  target_port: string
}

export interface RunInfo {
  run_id: string
  graph_name: string
  status: string
  started_at: number
  elapsed_seconds: number
  current_node: string | null
  node_statuses: Record<string, string>
}

export interface WsMessage {
  type: 'log' | 'node_status' | 'run_update' | 'ping' | 'pong' | 'test_log' | 'test_status'
  graph_name?: string
  node_id?: string
  message?: string
  status?: string
  run_id?: string
  test_id?: string
}

export interface RunHistoryEntry {
  run_id: string
  graph_name: string
  status: string
  started_at: string
  finished_at: string | null
  log_count: number
}

export interface RunLogData {
  run_id: string
  graph_name: string
  status: string
  started_at: string
  finished_at: string | null
  node_statuses: Record<string, string>
  logs: (string | { node_id: string; message: string; time?: string })[]
}

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  shell_command: 'Shell Command',
  python_script: 'Python Script',
  python_function: 'Python Function',
  input: 'Input',
  output: 'Output',
}

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  shell_command: '#f59e0b',
  python_script: '#4f8ef7',
  python_function: '#8b5cf6',
  input: '#22c55e',
  output: '#ef4444',
}
