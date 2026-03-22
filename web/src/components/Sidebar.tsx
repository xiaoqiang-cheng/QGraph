import type { NodeType } from '../types'
import { NODE_TYPE_LABELS, NODE_TYPE_COLORS } from '../types'

interface SidebarProps {
  onAddNode: (type: NodeType) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onBack?: () => void
  width?: number
}

const NODE_TYPES: NodeType[] = ['shell_command', 'python_script', 'python_function', 'input', 'output']

export default function Sidebar({ onAddNode, theme, onToggleTheme, onBack, width }: SidebarProps) {
  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/qgraph-node-type', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div style={{
      width: width ?? 220,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span
          onClick={onBack}
          style={{
            fontWeight: 700,
            fontSize: 18,
            color: 'var(--accent)',
            cursor: onBack ? 'pointer' : 'default',
          }}
          title={onBack ? 'Back to Dashboard' : undefined}
        >
          QGraph
        </span>
        <button
          onClick={onToggleTheme}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 8px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: 14,
          }}
          title="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      <div style={{ padding: '12px 16px' }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 1,
          color: 'var(--text-muted)',
          marginBottom: 8,
        }}>
          Nodes
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {NODE_TYPES.map(type => (
            <div
              key={type}
              draggable
              onDragStart={(e) => onDragStart(e, type)}
              onClick={() => onAddNode(type)}
              style={{
                padding: '10px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${NODE_TYPE_COLORS[type]}`,
                borderRadius: 6,
                cursor: 'grab',
                fontSize: 13,
                color: 'var(--text-primary)',
                transition: 'background 0.15s',
                userSelect: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
            >
              {NODE_TYPE_LABELS[type]}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
