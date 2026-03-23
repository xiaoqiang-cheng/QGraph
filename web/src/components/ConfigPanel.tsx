import { useState, useEffect, useRef } from 'react'
import type { NodeData, NodeType } from '../types'
import { NODE_TYPE_LABELS, NODE_TYPE_COLORS } from '../types'
import CodeEditor from './CodeEditor'

interface ConfigPanelProps {
  node: NodeData | null
  onUpdate: (nodeId: string, updates: Partial<NodeData>) => void
  onClose: () => void
  graphName: string
  testLogs: string[]
  onStartTest: (nodeType: string, config: Record<string, unknown>) => void
  onStopTest: () => void
  isTesting: boolean
  testResult: { status: string; error: string | null; duration_ms?: number } | null
  width?: number
}

function parseArgs(text: string): string[] {
  return text.split('\n').flatMap(l => l.trim() ? l.trim().split(/\s+/) : [])
}

export default function ConfigPanel({ node, onUpdate, onClose, testLogs, onStartTest, onStopTest, isTesting, testResult, width }: ConfigPanelProps) {
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [workingDir, setWorkingDir] = useState('')
  const [scriptPath, setScriptPath] = useState('')
  const [args, setArgs] = useState('')
  const [pythonPath, setPythonPath] = useState('')
  const [modulePath, setModulePath] = useState('')
  const [functionName, setFunctionName] = useState('')
  const [parameters, setParameters] = useState<Array<{ key: string; value: string }>>([])
  const [pendingSave, setPendingSave] = useState(false)
  const testLogEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (node) {
      setName(node.name)
      setCommand(node.config.command || '')
      setWorkingDir(node.config.working_dir || '')
      setScriptPath(node.config.script_path || '')
      setArgs((node.config.args || []).join('\n'))
      setPythonPath(node.config.python_path || '')
      setModulePath(node.config.module_path || '')
      setFunctionName(node.config.function_name || '')
      const params = node.config.parameters || {}
      setParameters(Object.entries(params).map(([key, value]) => ({ key, value: String(value) })))
    }
  }, [node])

  if (!node) return null

  const buildConfig = () => {
    const paramsObj: Record<string, string> = {}
    for (const p of parameters) {
      if (p.key.trim()) paramsObj[p.key.trim()] = p.value
    }
    return {
      ...node.config,
      command: command || undefined,
      working_dir: workingDir || undefined,
      script_path: scriptPath || undefined,
      args: args ? parseArgs(args) : [],
      python_path: pythonPath || undefined,
      module_path: modulePath || undefined,
      function_name: functionName || undefined,
      parameters: Object.keys(paramsObj).length > 0 ? paramsObj : undefined,
    }
  }

  const handleSave = () => {
    onUpdate(node.id, { name, config: buildConfig() })
  }

  const handleTest = () => {
    handleSave()
    onStartTest(node.node_type, buildConfig() as Record<string, unknown>)
  }

  useEffect(() => {
    testLogEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [testLogs])

  useEffect(() => {
    if (pendingSave) {
      setPendingSave(false)
      handleSave()
    }
  })

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
              <CodeEditor
                value={command}
                onChange={setCommand}
                onBlur={handleSave}
                placeholder="e.g. python train.py --lr 0.01"
                language="shell"
                minHeight={120}
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
              <CodeEditor
                value={args}
                onChange={setArgs}
                onBlur={handleSave}
                placeholder={"--lr 0.01\n--epochs 10\n--data-dir /path/to/data"}
                language="args"
                minHeight={120}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                One argument group per line
              </div>
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
        return (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              Parameters are injected as environment variables into all downstream nodes. Use <code style={{ fontSize: 11 }}>os.getenv()</code> in Python or <code style={{ fontSize: 11 }}>%KEY%</code> (Win) / <code style={{ fontSize: 11 }}>$KEY</code> (Linux) in shell.
            </div>
            {parameters.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <input
                  value={p.key}
                  onChange={e => {
                    const next = [...parameters]
                    next[i] = { ...next[i], key: e.target.value }
                    setParameters(next)
                  }}
                  onBlur={handleSave}
                  style={{ ...inputStyle, width: '40%', fontSize: 12 }}
                  placeholder="KEY"
                />
                <input
                  value={p.value}
                  onChange={e => {
                    const next = [...parameters]
                    next[i] = { ...next[i], value: e.target.value }
                    setParameters(next)
                  }}
                  onBlur={handleSave}
                  style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                  placeholder="value"
                />
                <button
                  onClick={() => {
                    setParameters(parameters.filter((_, j) => j !== i))
                    setPendingSave(true)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: 14,
                    padding: '0 4px',
                    flexShrink: 0,
                  }}
                >✕</button>
              </div>
            ))}
            <button
              onClick={() => setParameters([...parameters, { key: '', value: '' }])}
              style={{
                background: 'var(--bg-primary)',
                border: '1px dashed var(--border)',
                borderRadius: 6,
                padding: '6px 0',
                width: '100%',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 12,
              }}
            >+ Add Parameter</button>
          </>
        )
      case 'output':
        return (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Collect output results from the pipeline.
          </div>
        )
    }
  }

  return (
    <div style={{
      width: width ?? 300,
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

        {node.node_type !== 'input' && node.node_type !== 'output' && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            {isTesting ? (
              <button
                onClick={onStopTest}
                style={{
                  width: '100%',
                  padding: '8px 0',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                ⏹ Stop Test
              </button>
            ) : (
              <button
                onClick={handleTest}
                style={{
                  width: '100%',
                  padding: '8px 0',
                  background: '#22c55e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                ▶ Test Node
              </button>
            )}

            {(testLogs.length > 0 || testResult) && (
              <div style={{
                marginTop: 10,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                overflow: 'hidden',
              }}>
                {testResult && (
                  <div style={{
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderBottom: testLogs.length > 0 ? '1px solid var(--border)' : 'none',
                    color: testResult.status === 'success' ? '#22c55e'
                      : testResult.status === 'timeout' ? '#f59e0b'
                      : testResult.status === 'cancelled' ? '#f59e0b'
                      : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span>
                      {testResult.status === 'success' ? '✓ Passed' : testResult.status === 'timeout' ? '⏱ Timeout' : testResult.status === 'cancelled' ? '⏹ Cancelled' : '✗ Failed'}
                      {testResult.error && `: ${testResult.error}`}
                    </span>
                    {testResult.duration_ms != null && (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                        {testResult.duration_ms.toFixed(0)}ms
                      </span>
                    )}
                  </div>
                )}

                {testLogs.length > 0 && (
                  <div style={{
                    maxHeight: 200,
                    overflowY: 'auto',
                    padding: '8px 10px',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    color: 'var(--text-secondary)',
                  }}>
                    {testLogs.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                    <div ref={testLogEndRef} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
