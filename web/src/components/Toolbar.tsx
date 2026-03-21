interface ToolbarProps {
  graphName: string
  onSave: () => void
  onRun: () => void
  onStop: () => void
  isRunning: boolean
  isSaving: boolean
  onBack?: () => void
  layoutDirection: 'LR' | 'TB'
  onToggleLayout: () => void
}

export default function Toolbar({
  graphName, onSave, onRun, onStop, isRunning, isSaving, onBack,
  layoutDirection, onToggleLayout,
}: ToolbarProps) {
  const btnBase: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'background 0.15s',
  }

  return (
    <div style={{
      height: 48,
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 10,
      flexShrink: 0,
    }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            ...btnBase,
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            padding: '6px 8px',
          }}
          title="Back to Dashboard"
        >
          ← Back
        </button>
      )}

      <span style={{
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginRight: 'auto',
      }}>
        {graphName || 'Untitled'}
      </span>

      <button
        onClick={onToggleLayout}
        style={{
          ...btnBase,
          background: 'var(--bg-surface)',
          color: 'var(--text-secondary)',
          fontSize: 12,
          padding: '5px 10px',
        }}
        title={layoutDirection === 'LR' ? 'Switch to vertical layout' : 'Switch to horizontal layout'}
      >
        {layoutDirection === 'LR' ? '↕ Vertical' : '↔ Horizontal'}
      </button>

      <button
        onClick={onSave}
        disabled={isSaving}
        style={{
          ...btnBase,
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          opacity: isSaving ? 0.6 : 1,
        }}
      >
        💾 {isSaving ? 'Saving...' : 'Save'}
      </button>

      {isRunning ? (
        <button
          onClick={onStop}
          style={{
            ...btnBase,
            background: 'var(--error)',
            color: '#fff',
            border: 'none',
          }}
        >
          ⏹ Stop
        </button>
      ) : (
        <button
          onClick={onRun}
          style={{
            ...btnBase,
            background: 'var(--success)',
            color: '#fff',
            border: 'none',
          }}
        >
          ▶ Run
        </button>
      )}
    </div>
  )
}
