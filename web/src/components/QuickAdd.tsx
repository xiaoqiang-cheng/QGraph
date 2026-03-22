import { useState, useRef, useEffect } from 'react'
import type { NodeType, NodeConfig } from '../types'

interface ParsedNode {
  type: NodeType
  name: string
  config: NodeConfig
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1].replace(/\.\w+$/, '')
}

function parseSingleCommand(line: string): ParsedNode {
  const envVars: Record<string, string> = {}
  let workingDir: string | undefined
  let remaining = line.trim()

  const cdMatch = remaining.match(/^cd\s+(\S+)\s*(?:&&|;)\s*(.+)/)
  if (cdMatch) {
    workingDir = cdMatch[1]
    remaining = cdMatch[2].trim()
  }

  while (/^[A-Z_][A-Z0-9_]*=\S+\s/.test(remaining)) {
    const m = remaining.match(/^([A-Z_][A-Z0-9_]*)=(\S+)\s+(.+)/)
    if (!m) break
    envVars[m[1]] = m[2]
    remaining = m[3].trim()
  }

  const exportMatch = remaining.match(/^export\s+([A-Z_][A-Z0-9_]*)=(.+)/)
  if (exportMatch) {
    envVars[exportMatch[1]] = exportMatch[2].trim()
    return {
      type: 'shell_command',
      name: `export ${exportMatch[1]}`,
      config: { command: remaining, env_vars: envVars, working_dir: workingDir },
    }
  }

  const pyMatch = remaining.match(/^(python\S*)\s+(\S+\.py)(.*)/)
  if (pyMatch) {
    const pythonPath = pyMatch[1] === 'python' ? undefined : pyMatch[1]
    const scriptPath = pyMatch[2]
    const argStr = pyMatch[3].trim()
    const args = argStr ? argStr.split(/\s+/) : []
    return {
      type: 'python_script',
      name: basename(scriptPath),
      config: {
        script_path: scriptPath,
        args,
        python_path: pythonPath,
        env_vars: Object.keys(envVars).length > 0 ? envVars : undefined,
        working_dir: workingDir,
      },
    }
  }

  const firstWord = remaining.split(/\s+/)[0]
  const name = firstWord.length > 20 ? firstWord.substring(0, 20) : firstWord
  return {
    type: 'shell_command',
    name,
    config: {
      command: remaining,
      env_vars: Object.keys(envVars).length > 0 ? envVars : undefined,
      working_dir: workingDir,
    },
  }
}

export function parseCommands(input: string): ParsedNode[] {
  const lines = input.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))

  if (lines.length === 0) return []

  let globalWorkingDir: string | undefined
  const startIdx = 0
  const result: ParsedNode[] = []

  let nextName: string | undefined

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('#')) {
      const nameMatch = line.match(/^#\s*(?:Step\s*\d*:?\s*)?(.+)/)
      if (nameMatch) nextName = nameMatch[1].trim()
      continue
    }

    if (/^cd\s+\S+\s*$/.test(line) && i === 0) {
      globalWorkingDir = line.replace(/^cd\s+/, '').trim()
      continue
    }

    if (/^export\s+[A-Z_]/.test(line)) {
      const m = line.match(/^export\s+([A-Z_][A-Z0-9_]*)=(.+)/)
      if (m) continue
    }

    const node = parseSingleCommand(line)
    if (globalWorkingDir && !node.config.working_dir) {
      node.config.working_dir = globalWorkingDir
    }
    if (nextName) {
      node.name = nextName
      nextName = undefined
    }
    result.push(node)
  }

  return result
}

interface QuickAddProps {
  position: { x: number; y: number }
  onAdd: (nodes: ParsedNode[]) => void
  onClose: () => void
}

export default function QuickAdd({ position, onAdd, onClose }: QuickAddProps) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as HTMLElement)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    const nodes = parseCommands(trimmed)
    if (nodes.length > 0) onAdd(nodes)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') onClose()
  }

  const preview = parseCommands(text.trim())

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 1000,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        width: 400,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        Quick Add
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
        Paste a command or script. Shift+Enter for multi-line.
      </div>
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="python train.py --epochs 10"
        style={{
          width: '100%',
          minHeight: 60,
          maxHeight: 200,
          padding: '8px 10px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          color: 'var(--text-primary)',
          fontSize: 13,
          fontFamily: 'Consolas, "Courier New", monospace',
          outline: 'none',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />

      {preview.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          {preview.length === 1 ? (
            <span>
              Will create: <strong style={{ color: 'var(--text-primary)' }}>{preview[0].name}</strong>
              {' '}({preview[0].type.replace('_', ' ')})
            </span>
          ) : (
            <span>
              Will create <strong style={{ color: 'var(--text-primary)' }}>{preview.length} nodes</strong>
              {' '}with serial connections:
              <div style={{ marginTop: 4 }}>
                {preview.map((n, i) => (
                  <span key={i}>
                    {i > 0 && <span style={{ color: 'var(--accent)' }}> → </span>}
                    <span style={{ color: 'var(--text-primary)' }}>{n.name}</span>
                  </span>
                ))}
              </div>
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{
            padding: '6px 16px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={preview.length === 0}
          style={{
            padding: '6px 16px',
            background: preview.length > 0 ? 'var(--accent)' : 'var(--border)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: preview.length > 0 ? 'pointer' : 'not-allowed',
          }}
        >Create {preview.length > 1 ? `${preview.length} Nodes` : 'Node'}</button>
      </div>
    </div>
  )
}
