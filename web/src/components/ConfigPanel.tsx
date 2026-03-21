import { useState, useEffect } from 'react'
import type { NodeData, NodeType } from '../types'
import { NODE_TYPE_LABELS, NODE_TYPE_COLORS } from '../types'

interface ConfigPanelProps {
  node: NodeData | null
  onUpdate: (nodeId: string, updates: Partial<NodeData>) => void
  onClose: () => void
}

export default function ConfigPanel({ node, onUpdate, onClose }: ConfigPanelProps) {
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [workingDir, setWorkingDir] = useState('')
  const [scriptPath, setScriptPath] = useState('')
  const [args, setArgs] = useState('')
  const [pythonPath, setPythonPath] = useState('')
  const [modulePath, setModulePath] = useState('')
  const [functionName, setFunctionName] = useState('')

  useEffect(() => {
    if (node) {
      setName(node.name)
      setCommand(node.config.command || '')
      setWorkingDir(node.config.working_dir || '')
      setScriptPath(node.config.script_path || '')
      setArgs((node.config.args || []).join(' '))
      setPythonPath(node.config.python_path || '')
      setModulePath(node.config.module_path || '')
      setFunctionName(node.config.function_name || '')
    }
  }, [node])

  if (!node) return null

  const handleSave = () => {
    onUpdate(node.id, {
      name,
      config: {
        ...node.config,
        command: command || undefined,
        working_dir: workingDir || undefined,
        script_path: scriptPath || undefined,
        args: args ? args.split(/\s+/) : [],
        python_path: pythonPath || undefined,
        module_path: modulePath || undefined,
        function_name: functionName || undefined,
      },
    })
  }

  const color = NODE_TYPE_COLORS[node.node_type]

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 4,
    display: 'block',
  }

  const renderTypeConfig = (nodeType: NodeType) => {
    switch (nodeType) {
      case 'shell_command':
        return (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Command</label>
              <textarea
                value={command}
                onChange={e => setCommand(e.target.value)}
                onBlur={handleSave}
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                placeholder="e.g. python train.py --lr 0.01"
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Working Directory</label>
              <input
                value={workingDir}
                onChange={e => setWorkingDir(e.target.value)}
                onBlur={handleSave}
                style={inputStyle}
                placeholder="Optional"
              />
            </div>
          </>
        )
      case 'python_script':
        return (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Script Path</label>
              <input
                value={scriptPath}
                onChange={e => setScriptPath(e.target.value)}
                onBlur={handleSave}
                style={inputStyle}
                placeholder="e.g. ./train.py"
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Arguments</label>
              <input
                value={args}
                onChange={e => setArgs(e.target.value)}
                onBlur={handleSave}
                style={inputStyle}
                placeholder="e.g. --lr 0.01 --epochs 10"
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Python Path</label>
              <input
                value={pythonPath}
                onChange={e => setPythonPath(e.target.value)}
                onBlur={handleSave}
                style={inputStyle}
                placeholder="Default: python"
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Working Directory</label>
              <input
                value={workingDir}
                onChange={e => setWorkingDir(e.target.value)}
                onBlur={handleSave}
                style={inputStyle}
                placeholder="Optional"
              />
            </div>
          </>
        )
      case 'python_function':
        return (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Module Path</label>
              <input
                value={modulePath}
                onChange={e => setModulePath(e.target.value)}
                onBlur={handleSave}
                style={inputStyle}
                placeholder="e.g. my_module.utils"
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Function Name</label>
              <input
                value={functionName}
                onChange={e => setFunctionName(e.target.value)}
                onBlur={handleSave}
                style={inputStyle}
                placeholder="e.g. train_model"
              />
            </div>
          </>
        )
      case 'input':
      case 'output':
        return (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {nodeType === 'input' ? 'Define input parameters for the pipeline.' : 'Collect output results from the pipeline.'}
          </div>
        )
    }
  }

  return (
    <div style={{
      width: 300,
      background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
          }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {NODE_TYPE_LABELS[node.node_type]}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 18,
            lineHeight: 1,
            padding: '2px 6px',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Node Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleSave}
            style={inputStyle}
          />
        </div>

        {renderTypeConfig(node.node_type)}
      </div>
    </div>
  )
}
