'use client';

/**
 * Test page for useGraphRunner hook
 * Visit /test-graph-runner to test the new graph running system
 */

import { useState } from 'react';
import { useGraphRunner } from '@/hooks/useGraphRunner';
import { GraphRunViewer, type GraphDefinition } from '@/components/graph';

// Sample graph definition for visualization
const sampleGraph: GraphDefinition = {
  name: 'Test Graph',
  nodes: [
    { id: 'context', name: 'Context', type: 'context' },
    { id: 'router', name: 'Router', type: 'router' },
    { id: 'planner', name: 'Planner', type: 'planner' },
    { id: 'executor', name: 'Executor', type: 'executor' },
    { id: 'respond', name: 'Respond', type: 'respond' },
    { id: 'search', name: 'Search', type: 'search' },
    { id: 'command', name: 'Command', type: 'command' },
  ],
  edges: [
    { from: 'context', to: 'router' },
    { from: 'router', targets: { plan: 'planner', respond: 'respond', search: 'search', command: 'command' } },
    { from: 'planner', to: 'executor' },
    { from: 'executor', targets: { respond: 'respond', search: 'search', command: 'command' } },
    { from: 'search', to: 'respond' },
    { from: 'command', to: 'respond' },
  ],
  entryNodeId: 'context',
};

export default function TestGraphRunnerPage() {
  const [message, setMessage] = useState('Hello, can you help me?');
  const [logs, setLogs] = useState<string[]>([]);
  
  const runner = useGraphRunner();

  const addLog = (msg: string) => {
    const ts = new Date().toISOString().split('T')[1].slice(0, 12);
    setLogs(prev => [...prev.slice(-50), `[${ts}] ${msg}`]);
  };

  const handleRun = async () => {
    setLogs([]);
    addLog('Starting run...');

    await runner.run({
      endpoint: '/api/v1/chat/completions',
      body: {
        model: 'Red',
        messages: [{ role: 'user', content: message }],
      },
      onEvent: (event) => {
        addLog(`Event: ${event.type} ${event.nodeId ? `(node: ${event.nodeId})` : ''}`);
      },
      onNodeStart: (nodeId, nodeName) => {
        addLog(`Node started: ${nodeName} (${nodeId})`);
      },
      onNodeComplete: (nodeId, nextNodeId) => {
        addLog(`Node complete: ${nodeId} → ${nextNodeId || 'END'}`);
      },
      onChunk: (chunk, isThinking) => {
        if (isThinking) {
          addLog(`Thinking chunk: ${chunk.slice(0, 30)}...`);
        } else {
          addLog(`Content chunk: ${chunk.slice(0, 30)}...`);
        }
      },
      onComplete: (content, thinking) => {
        addLog(`Complete! Content: ${content.length} chars, Thinking: ${thinking.length} chars`);
      },
      onError: (error) => {
        addLog(`Error: ${error}`);
      },
    });
  };

  // Convert runner state to GraphRunState format for viewer
  const graphRunState = {
    graphId: runner.graphState.graphId || undefined,
    status: runner.runState.status === 'running' ? 'running' as const : 
            runner.runState.status === 'completed' ? 'completed' as const :
            runner.runState.status === 'error' ? 'error' as const : 'idle' as const,
    currentNodeId: runner.graphState.currentNodeId || undefined,
    nodeProgress: Object.fromEntries(
      Object.entries(runner.graphState.nodes).map(([id, node]) => [
        id,
        {
          nodeId: id,
          status: node.status,
          stepName: node.nodeName,
          startTime: node.startedAt,
          endTime: node.completedAt,
          error: node.error,
        },
      ])
    ),
    executionPath: runner.graphState.executionPath,
    startTime: runner.runState.startedAt || undefined,
    endTime: runner.runState.completedAt || undefined,
    error: runner.runState.error || undefined,
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Graph Runner Test</h1>

      {/* Controls */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2"
          placeholder="Enter message..."
        />
        <button
          onClick={handleRun}
          disabled={runner.isRunning}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-medium"
        >
          {runner.isRunning ? 'Running...' : 'Run'}
        </button>
        <button
          onClick={runner.cancel}
          disabled={!runner.isRunning}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded font-medium"
        >
          Cancel
        </button>
        <button
          onClick={runner.reset}
          className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded font-medium"
        >
          Reset
        </button>
      </div>

      {/* Status */}
      <div className="mb-6 p-4 bg-gray-900 rounded">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Status:</span>{' '}
            <span className={
              runner.runState.status === 'running' ? 'text-blue-400' :
              runner.runState.status === 'completed' ? 'text-green-400' :
              runner.runState.status === 'error' ? 'text-red-400' : 'text-gray-400'
            }>
              {runner.runState.status}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Run ID:</span>{' '}
            <span className="font-mono text-xs">{runner.runState.runId || '-'}</span>
          </div>
          <div>
            <span className="text-gray-400">Current Node:</span>{' '}
            <span>{runner.graphState.currentNodeId || '-'}</span>
          </div>
          <div>
            <span className="text-gray-400">Path:</span>{' '}
            <span className="text-xs">{runner.graphState.executionPath.join(' → ') || '-'}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-2 gap-6">
        {/* Graph Viewer */}
        <div className="bg-gray-900 rounded p-4">
          <h2 className="text-lg font-semibold mb-4">Graph Visualization</h2>
          <div className="h-[500px]">
            <GraphRunViewer
              graph={sampleGraph}
              runState={graphRunState}
            />
          </div>
        </div>

        {/* Output and Logs */}
        <div className="space-y-4">
          {/* Thinking */}
          {runner.thinking && (
            <div className="bg-gray-900 rounded p-4">
              <h2 className="text-lg font-semibold mb-2">Thinking</h2>
              <pre className="text-sm text-gray-300 whitespace-pre-wrap max-h-[150px] overflow-auto">
                {runner.thinking}
              </pre>
            </div>
          )}

          {/* Content */}
          <div className="bg-gray-900 rounded p-4">
            <h2 className="text-lg font-semibold mb-2">Output</h2>
            <pre className="text-sm text-gray-300 whitespace-pre-wrap max-h-[200px] overflow-auto">
              {runner.content || '(no output yet)'}
            </pre>
          </div>

          {/* Logs */}
          <div className="bg-gray-900 rounded p-4">
            <h2 className="text-lg font-semibold mb-2">Event Log</h2>
            <div className="h-[200px] overflow-auto font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className="text-gray-400">{log}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
