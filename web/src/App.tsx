import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import PipelineNode from './components/PipelineNode'
import Sidebar from './components/Sidebar'
import Toolbar from './components/Toolbar'
import ConfigPanel from './components/ConfigPanel'
import LogPanel from './components/LogPanel'
import Dashboard from './components/Dashboard'
import { useTheme } from './hooks/useTheme'
import { api } from './api'
import type { NodeType, NodeData, NodeConfig, NodeStatus, WsMessage } from './types'

let nodeIdCounter = 0
function nextNodeId() {
  return `node_${Date.now()}_${++nodeIdCounter}`
}

function createDefaultConfig(nodeType: NodeType): NodeConfig {
  switch (nodeType) {
    case 'shell_command':
      return { command: '', env_vars: {} }
    case 'python_script':
      return { script_path: '', args: [], python_path: 'python', env_vars: {} }
    case 'python_function':
      return { module_path: '', function_name: '', kwargs: {} }
    case 'input':
      return { parameters: {} }
    case 'output':
      return {}
  }
}

function createDefaultPorts(nodeType: NodeType) {
  const inputs = nodeType === 'input' ? [] : [{ id: 'in_0', name: 'input', data_type: 'any' }]
  const outputs = nodeType === 'output' ? [] : [{ id: 'out_0', name: 'output', data_type: 'any' }]
  return { inputs, outputs }
}

function nodeDataToFlowNode(data: NodeData, layoutDirection: 'LR' | 'TB' = 'LR'): Node {
  return {
    id: data.id,
    type: 'pipeline',
    position: data.position,
    data: {
      label: data.name,
      nodeType: data.node_type,
      status: data.status || 'idle',
      config: data.config,
      inputCount: data.inputs?.length || 0,
      outputCount: data.outputs?.length || 0,
      layoutDirection,
    },
  }
}

interface LogEntry {
  node_id: string
  message: string
  timestamp: number
}

function EditorView({ graphName, onBack }: { graphName: string; onBack: () => void }) {
  const { theme, toggleTheme } = useTheme()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [layoutDirection, setLayoutDirection] = useState<'LR' | 'TB'>('LR')
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const reactFlowInstance = useRef<ReactFlowInstance<Node, Edge> | null>(null)
  const nodeDataMap = useRef<Map<string, NodeData>>(new Map())
  const wsRef = useRef<WebSocket | null>(null)

  const [sidebarWidth, setSidebarWidth] = useState(220)
  const [configWidth, setConfigWidth] = useState(300)
  const sidebarDrag = useRef<{ startX: number; startW: number } | null>(null)
  const configDrag = useRef<{ startX: number; startW: number } | null>(null)

  const [isTesting, setIsTesting] = useState(false)
  const [testLogs, setTestLogs] = useState<string[]>([])
  const [testResult, setTestResult] = useState<{ status: string; error: string | null; duration_ms?: number } | null>(null)
  const activeTestId = useRef<string | null>(null)
  const [lastRunFailed, setLastRunFailed] = useState(false)
  const succeededNodes = useRef<Set<string>>(new Set())
  const clipboardNode = useRef<NodeData | null>(null)
  const nodeStartTimes = useRef<Map<string, number>>(new Map())

  const nodeTypes = useMemo(() => ({ pipeline: PipelineNode }), [])

  const nodeNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const [id, data] of nodeDataMap.current.entries()) {
      map.set(id, data.name)
    }
    return map
  }, [nodes])

  const selectedNodeData = selectedNodeId ? nodeDataMap.current.get(selectedNodeId) || null : null

  useEffect(() => {
    const wsUrl = `ws://${window.location.host}/ws/graph/${graphName}`
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onmessage = (ev) => {
        const msg: WsMessage = JSON.parse(ev.data)

        if (msg.type === 'log' && msg.node_id && msg.message) {
          setLogs(prev => [...prev, {
            node_id: msg.node_id!,
            message: msg.message!,
            timestamp: Date.now(),
          }])
          setShowLogs(true)
        }

        if (msg.type === 'test_log' && msg.message && msg.test_id) {
          if (msg.test_id === activeTestId.current) {
            setTestLogs(prev => [...prev, msg.message!])
          }
        }

        if (msg.type === 'node_status' && msg.node_id && msg.status) {
          const status = msg.status as NodeStatus
          const nodeId = msg.node_id

          if (status === 'running') {
            nodeStartTimes.current.set(nodeId, Date.now())
          }

          if (status === 'success') {
            succeededNodes.current.add(nodeId)
          }

          let durationMs: number | undefined
          if (status === 'success' || status === 'failed') {
            const startTime = nodeStartTimes.current.get(nodeId)
            if (startTime) {
              durationMs = Date.now() - startTime
              nodeStartTimes.current.delete(nodeId)
            }
          }

          setNodes(nds => nds.map(n => {
            if (n.id !== nodeId) return n
            return {
              ...n,
              data: {
                ...(n.data as Record<string, unknown>),
                status,
                ...(durationMs !== undefined ? { durationMs } : {}),
              },
            }
          }))

          const nd = nodeDataMap.current.get(nodeId)
          if (nd) {
            nodeDataMap.current.set(nodeId, { ...nd, status })
          }

          const allDone = ['success', 'failed', 'cancelled', 'skipped'].includes(status)
          if (allDone) {
            setTimeout(() => {
              setNodes(nds => {
                const anyRunning = nds.some(n =>
                  ['running', 'queued'].includes((n.data as Record<string, unknown>).status as string)
                )
                if (!anyRunning) {
                  setIsRunning(false)
                  const hasFailed = nds.some(n =>
                    ['failed', 'skipped'].includes((n.data as Record<string, unknown>).status as string)
                  )
                  setLastRunFailed(hasFailed)
                }
                return nds
              })
            }, 100)
          }
        }

        if (msg.type === 'ping') {
          ws?.send(JSON.stringify({ type: 'pong' }))
        }
      }

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 2000)
      }
    }

    connect()
    return () => {
      clearTimeout(reconnectTimer)
      ws?.close()
      wsRef.current = null
    }
  }, [graphName, setNodes])

  const addNode = useCallback((type: NodeType, position?: { x: number; y: number }) => {
    const id = nextNodeId()
    const { inputs, outputs } = createDefaultPorts(type)
    const config = createDefaultConfig(type)

    const nodeData: NodeData = {
      id,
      name: `${type}`,
      node_type: type,
      position: position || { x: 250, y: 150 },
      inputs,
      outputs,
      config,
      status: 'idle',
    }
    nodeDataMap.current.set(id, nodeData)

    const flowNode = nodeDataToFlowNode(nodeData, layoutDirection)
    setNodes(nds => [...nds, flowNode])
  }, [setNodes, layoutDirection])

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge(params, eds))
  }, [setEdges])

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/qgraph-node-type') as NodeType
    if (!type || !reactFlowInstance.current || !reactFlowWrapper.current) return

    const bounds = reactFlowWrapper.current.getBoundingClientRect()
    const position = reactFlowInstance.current.screenToFlowPosition({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })
    addNode(type, position)
  }, [addNode])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(prev => {
      if (prev !== node.id) {
        setTestLogs([])
        setTestResult(null)
        setIsTesting(false)
        activeTestId.current = null
      }
      return node.id
    })
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.ctrlKey && e.key === 'c' && selectedNodeId) {
        const data = nodeDataMap.current.get(selectedNodeId)
        if (data) clipboardNode.current = { ...data }
      }

      if (e.ctrlKey && e.key === 'v' && clipboardNode.current) {
        const src = clipboardNode.current
        const id = `node_${Date.now()}`
        const nodeData: NodeData = {
          ...src,
          id,
          name: `${src.name} (copy)`,
          position: { x: src.position.x + 40, y: src.position.y + 40 },
          status: 'idle',
        }
        nodeDataMap.current.set(id, nodeData)
        setNodes(nds => [...nds, nodeDataToFlowNode(nodeData, layoutDirection)])
        setSelectedNodeId(id)
        clipboardNode.current = nodeData
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        nodeDataMap.current.delete(selectedNodeId)
        setNodes(nds => nds.filter(n => n.id !== selectedNodeId))
        setEdges(eds => eds.filter(e2 => e2.source !== selectedNodeId && e2.target !== selectedNodeId))
        setSelectedNodeId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNodeId, setNodes, setEdges, layoutDirection])

  const onNodeUpdate = useCallback((nodeId: string, updates: Partial<NodeData>) => {
    const existing = nodeDataMap.current.get(nodeId)
    if (!existing) return

    const updated = { ...existing, ...updates, config: { ...existing.config, ...updates.config } }
    nodeDataMap.current.set(nodeId, updated)

    setNodes(nds => nds.map(n => {
      if (n.id !== nodeId) return n
      return {
        ...n,
        data: {
          ...(n.data as Record<string, unknown>),
          label: updated.name,
          config: updated.config,
        },
      }
    }))
  }, [setNodes])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const graphNodes: NodeData[] = nodes.map(n => {
        const data = nodeDataMap.current.get(n.id)
        return {
          ...(data || { inputs: [], outputs: [], config: {}, status: 'idle' as const }),
          id: n.id,
          name: (n.data as Record<string, unknown>).label as string || n.id,
          node_type: (n.data as Record<string, unknown>).nodeType as NodeType,
          position: n.position,
        }
      })

      const graphEdges = edges.map(e => ({
        id: e.id,
        source: e.source,
        source_port: e.sourceHandle || 'out_0',
        target: e.target,
        target_port: e.targetHandle || 'in_0',
      }))

      await api.saveGraph(graphName, {
        name: graphName,
        description: '',
        nodes: graphNodes,
        edges: graphEdges,
      })
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setIsSaving(false)
    }
  }, [nodes, edges, graphName])

  const handleRun = useCallback(async () => {
    await handleSave()
    setIsRunning(true)
    setLogs([])
    setShowLogs(true)
    setLastRunFailed(false)
    succeededNodes.current.clear()

    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...(n.data as Record<string, unknown>), status: 'idle' },
    })))

    try {
      await api.runGraph(graphName)
    } catch (err) {
      console.error('Run failed:', err)
      setIsRunning(false)
    }
  }, [handleSave, graphName, setNodes])

  const handleResume = useCallback(async () => {
    await handleSave()
    const skipList = Array.from(succeededNodes.current)
    setIsRunning(true)
    setLogs([])
    setShowLogs(true)
    setLastRunFailed(false)

    setNodes(nds => nds.map(n => {
      const st = (n.data as Record<string, unknown>).status as string
      if (st === 'success') return n
      return {
        ...n,
        data: { ...(n.data as Record<string, unknown>), status: 'idle' },
      }
    }))

    try {
      await api.runGraph(graphName, skipList)
    } catch (err) {
      console.error('Resume failed:', err)
      setIsRunning(false)
    }
  }, [handleSave, graphName, setNodes])

  const handleStop = useCallback(async () => {
    try {
      const runs = await api.listRuns()
      const activeRun = runs.find(r => r.graph_name === graphName && r.status === 'running')
      if (activeRun) {
        await api.stopRun(activeRun.run_id)
      }
    } catch (err) {
      console.error('Stop failed:', err)
    }
    setIsRunning(false)
  }, [graphName])

  const handleStartTest = useCallback(async (nodeType: string, config: Record<string, unknown>) => {
    const testId = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    activeTestId.current = testId
    setIsTesting(true)
    setTestLogs([])
    setTestResult(null)

    try {
      const result = await api.testNode(nodeType, config, graphName, 30, testId)
      setTestResult({ status: result.status, error: result.error, duration_ms: result.duration_ms })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setTestResult({ status: 'error', error: message })
    } finally {
      setIsTesting(false)
      activeTestId.current = null
    }
  }, [graphName])

  const handleStopTest = useCallback(async () => {
    const testId = activeTestId.current
    if (!testId) return
    try {
      await api.stopTest(testId)
    } catch {
      // ignore
    }
    setIsTesting(false)
    setTestResult({ status: 'cancelled', error: 'Test cancelled by user' })
    activeTestId.current = null
  }, [])

  const onSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    sidebarDrag.current = { startX: e.clientX, startW: sidebarWidth }
    const onMove = (ev: MouseEvent) => {
      if (!sidebarDrag.current) return
      const delta = ev.clientX - sidebarDrag.current.startX
      setSidebarWidth(Math.max(160, Math.min(400, sidebarDrag.current.startW + delta)))
    }
    const onUp = () => {
      sidebarDrag.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  const onConfigDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    configDrag.current = { startX: e.clientX, startW: configWidth }
    const onMove = (ev: MouseEvent) => {
      if (!configDrag.current) return
      const delta = configDrag.current.startX - ev.clientX
      setConfigWidth(Math.max(240, Math.min(500, configDrag.current.startW + delta)))
    }
    const onUp = () => {
      configDrag.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [configWidth])

  const handleLoad = useCallback(async () => {
    try {
      const data = await api.getGraph(graphName)
      if (data.nodes && data.nodes.length > 0) {
        nodeDataMap.current.clear()
        data.nodes.forEach(n => nodeDataMap.current.set(n.id, n))
        setNodes(data.nodes.map(n => nodeDataToFlowNode(n, layoutDirection)))
        setEdges(data.edges.map(e => ({
          id: e.id,
          source: e.source,
          sourceHandle: e.source_port,
          target: e.target,
          targetHandle: e.target_port,
        })))
        setTimeout(() => reactFlowInstance.current?.fitView({ padding: 0.3 }), 100)

        try {
          const history = await api.listRunHistory()
          const lastRun = history.find(r => r.graph_name === graphName)
          if (lastRun && lastRun.status === 'failed') {
            const logData = await api.getRunLogs(lastRun.run_id)
            if (logData && logData.node_statuses) {
              const succeeded = new Set<string>()
              for (const [nid, st] of Object.entries(logData.node_statuses)) {
                if (st === 'success') succeeded.add(nid)
              }
              if (succeeded.size > 0) {
                succeededNodes.current = succeeded
                setLastRunFailed(true)
                setNodes(nds => nds.map(n => {
                  const st = logData.node_statuses[n.id]
                  if (!st || st === 'idle') return n
                  return {
                    ...n,
                    data: { ...(n.data as Record<string, unknown>), status: st },
                  }
                }))
              }
            }
          }
        } catch {
          // history not available
        }
      }
    } catch {
      // graph doesn't exist yet
    }
  }, [graphName, setNodes, setEdges, layoutDirection])

  const onInit = useCallback((instance: ReactFlowInstance<Node, Edge>) => {
    reactFlowInstance.current = instance
    handleLoad()
  }, [handleLoad])

  const toggleLayout = useCallback(() => {
    setLayoutDirection(prev => {
      const next = prev === 'LR' ? 'TB' : 'LR'
      setNodes(nds => nds.map(n => ({
        ...n,
        position: { x: n.position.y, y: n.position.x },
        data: { ...(n.data as Record<string, unknown>), layoutDirection: next },
      })))
      setTimeout(() => reactFlowInstance.current?.fitView({ padding: 0.2 }), 100)
      return next
    })
  }, [setNodes])

  const resizeHandleStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    width: 6,
    height: '100%',
    cursor: 'ew-resize',
    zIndex: 10,
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <div style={{ width: sidebarWidth, flexShrink: 0, position: 'relative' }}>
        <Sidebar onAddNode={addNode} theme={theme} onToggleTheme={toggleTheme} onBack={onBack} width={sidebarWidth} />
        <div
          onMouseDown={onSidebarDragStart}
          style={{ ...resizeHandleStyle, right: -3 }}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Toolbar
          graphName={graphName}
          onSave={handleSave}
          onRun={handleRun}
          onStop={handleStop}
          onResume={handleResume}
          isRunning={isRunning}
          isSaving={isSaving}
          lastRunFailed={lastRunFailed}
          onBack={onBack}
          layoutDirection={layoutDirection}
          onToggleLayout={toggleLayout}
        />

        <div style={{ flex: 1, position: 'relative' }} ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={onInit}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            deleteKeyCode="Delete"
            colorMode={theme}
            defaultEdgeOptions={{
              style: { stroke: 'var(--edge-color)', strokeWidth: 2 },
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls />
            <MiniMap
              style={{ background: 'var(--minimap-bg)' }}
              maskColor="rgba(0, 0, 0, 0.3)"
            />
          </ReactFlow>
        </div>

        {showLogs && (
          <LogPanel
            logs={logs}
            isRunning={isRunning}
            onClose={() => setShowLogs(false)}
            onClear={() => setLogs([])}
            nodeNames={nodeNames}
          />
        )}
      </div>

      {selectedNodeData && (
        <div style={{ width: configWidth, flexShrink: 0, position: 'relative' }}>
          <div
            onMouseDown={onConfigDragStart}
            style={{ ...resizeHandleStyle, left: -3 }}
          />
          <ConfigPanel
            node={selectedNodeData}
            onUpdate={onNodeUpdate}
            onClose={() => setSelectedNodeId(null)}
            graphName={graphName}
            testLogs={testLogs}
            onStartTest={handleStartTest}
            onStopTest={handleStopTest}
            isTesting={isTesting}
            testResult={testResult}
            width={configWidth}
          />
        </div>
      )}
    </div>
  )
}

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const [currentGraph, setCurrentGraph] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('graph')
  })

  const handleOpenGraph = useCallback((name: string) => {
    window.history.pushState({}, '', `?graph=${encodeURIComponent(name)}`)
    setCurrentGraph(name)
  }, [])

  const handleBack = useCallback(() => {
    window.history.pushState({}, '', '/')
    setCurrentGraph(null)
  }, [])

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search)
      setCurrentGraph(params.get('graph'))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  if (currentGraph) {
    return <EditorView graphName={currentGraph} onBack={handleBack} />
  }

  return <Dashboard onOpenGraph={handleOpenGraph} theme={theme} onToggleTheme={toggleTheme} />
}
