import { memo, useEffect } from 'react'
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import type { NodeConfig, NodeType, NodeStatus } from '../types'
import { NODE_TYPE_LABELS, NODE_TYPE_COLORS } from '../types'

interface PipelineNodeData {
  label: string
  nodeType: NodeType
  status: NodeStatus
  config: NodeConfig
  inputCount: number
  outputCount: number
  layoutDirection: 'LR' | 'TB'
  durationMs?: number
}

const STATUS_INDICATORS: Record<NodeStatus, { icon: string; color: string; animate?: boolean }> = {
  idle: { icon: '○', color: 'var(--text-muted)' },
  queued: { icon: '◉', color: 'var(--text-muted)' },
  running: { icon: '⟳', color: 'var(--warning)', animate: true },
  success: { icon: '✓', color: 'var(--success)' },
  failed: { icon: '✗', color: 'var(--error)' },
  skipped: { icon: '⊘', color: 'var(--text-muted)' },
  cancelled: { icon: '⊗', color: 'var(--text-muted)' },
}

function PipelineNode({ id, data, selected }: NodeProps & { data: PipelineNodeData }) {
  const color = NODE_TYPE_COLORS[data.nodeType]
  const indicator = STATUS_INDICATORS[data.status]
  const isRunning = data.status === 'running'
  const isVertical = data.layoutDirection === 'TB'
  const updateNodeInternals = useUpdateNodeInternals()

  const targetPos = isVertical ? Position.Top : Position.Left
  const sourcePos = isVertical ? Position.Bottom : Position.Right

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, data.layoutDirection, updateNodeInternals])

  return (
    <div
      style={{
        background: 'var(--node-bg)',
        border: `2px solid ${
          isRunning ? 'var(--warning)'
          : selected ? 'var(--node-selected)'
          : 'var(--node-border)'
        }`,
        borderRadius: 8,
        minWidth: 180,
        boxShadow: isRunning
          ? '0 0 16px rgba(245, 158, 11, 0.4)'
          : selected
            ? `0 0 12px ${color}40`
            : '0 2px 8px var(--shadow)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        animation: isRunning ? 'pulse 2s ease-in-out infinite' : undefined,
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(245, 158, 11, 0.3); }
          50% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.6); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          background: `${color}20`,
          borderBottom: `1px solid var(--border)`,
          padding: '8px 12px',
          borderRadius: '6px 6px 0 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ color, fontSize: 12, fontWeight: 600 }}>
          {NODE_TYPE_LABELS[data.nodeType]}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 14,
          color: indicator.color,
          display: 'inline-block',
          animation: indicator.animate ? 'spin 1s linear infinite' : undefined,
        }}>
          {indicator.icon}
        </span>
      </div>

      <div style={{ padding: '10px 12px' }}>
        <div style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {data.label}
        </div>
        {data.config.command && (
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginTop: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 200,
          }}>
            {data.config.command}
          </div>
        )}
        {data.config.script_path && (
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginTop: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 200,
          }}>
            {data.config.script_path}
          </div>
        )}
        {data.durationMs != null && (data.status === 'success' || data.status === 'failed') && (
          <div style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            marginTop: 4,
          }}>
            ⏱ {data.durationMs < 1000
              ? `${Math.round(data.durationMs)}ms`
              : `${(data.durationMs / 1000).toFixed(1)}s`}
          </div>
        )}
      </div>

      {data.inputCount > 0 && (
        <Handle
          type="target"
          position={targetPos}
          id="in_0"
          style={{
            width: 10,
            height: 10,
            background: color,
            border: '2px solid var(--bg-primary)',
          }}
        />
      )}
      {data.outputCount > 0 && (
        <Handle
          type="source"
          position={sourcePos}
          id="out_0"
          style={{
            width: 10,
            height: 10,
            background: color,
            border: '2px solid var(--bg-primary)',
          }}
        />
      )}
    </div>
  )
}

export default memo(PipelineNode, (prev, next) => {
  const pd = prev.data as PipelineNodeData
  const nd = next.data as PipelineNodeData
  return (
    pd.label === nd.label &&
    pd.status === nd.status &&
    pd.durationMs === nd.durationMs &&
    pd.layoutDirection === nd.layoutDirection &&
    pd.nodeType === nd.nodeType &&
    pd.inputCount === nd.inputCount &&
    pd.outputCount === nd.outputCount &&
    pd.config === nd.config &&
    prev.selected === next.selected
  )
})
