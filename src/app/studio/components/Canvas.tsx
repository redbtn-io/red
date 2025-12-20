'use client';

import { useCallback, useRef, DragEvent, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  NodeTypes,
  EdgeTypes,
  BaseEdge,
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  SelectionMode,
} from 'reactflow';
import { X, MousePointer2, Move, Maximize, Trash2, Copy, ClipboardPaste } from 'lucide-react';
import { useGraphStore, StudioNodeData, StudioEdgeData } from '@/lib/stores/graphStore';
import StudioNode from './nodes/StudioNode';
import StartNode from './nodes/StartNode';
import EndNode from './nodes/EndNode';

// Custom node types
const nodeTypes: NodeTypes = {
  studioNode: StudioNode,
  startNode: StartNode,
  endNode: EndNode,
};

/**
 * Custom edge component with selection state and delete button
 * Highlights edges connected to the selected node
 * Shows bidirectional indicator for two-way connections
 */
function StudioEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps<StudioEdgeData>) {
  const { removeEdge, selectedNodeId } = useGraphStore();
  
  // Check if this edge is connected to the selected node
  const isConnectedToSelected = selectedNodeId && (source === selectedNodeId || target === selectedNodeId);
  const hasNodeSelection = !!selectedNodeId;
  
  // Check if this is a bidirectional edge
  const isBidirectional = data?.isBidirectional || false;
  
  // Use edge color if provided (for conditional edges), otherwise default red
  const baseColor = data?.edgeColor || '#ef4444';
  
  // Determine visual state
  const isHighlighted = selected || isConnectedToSelected;
  const isDimmed = hasNodeSelection && !isConnectedToSelected && !selected;
  
  // Compute styles
  const strokeColor = isDimmed ? `${baseColor}30` : baseColor;
  const strokeWidth = isHighlighted ? 2.5 : 1.5;
  const glowFilter = selected ? `drop-shadow(0 0 4px ${baseColor}80)` : undefined;
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Generate unique animation name for bidirectional edges
  const animationId = `bidir-${id.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <>
      {/* Animation style for bidirectional edges - oscillates back and forth */}
      {isBidirectional && !isDimmed && (
        <style>
          {`
            @keyframes ${animationId} {
              0%, 100% { stroke-dashoffset: 0; }
              50% { stroke-dashoffset: 20; }
            }
          `}
        </style>
      )}
      {/* Invisible wider path for easier clicking */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        className="react-flow__edge-interaction"
      />
      {/* Visible edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          strokeWidth,
          stroke: strokeColor,
          strokeDasharray: isBidirectional ? '8,4' : (data?.isFallback ? '6,4' : undefined),
          animation: isBidirectional && !isDimmed ? `${animationId} 1.5s ease-in-out infinite` : undefined,
          filter: glowFilter,
          transition: 'stroke 0.15s, stroke-width 0.15s',
        }}
      />
      {/* Bidirectional indicator - double arrow symbol */}
      {isBidirectional && !isDimmed && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
          >
            <span 
              className="text-[10px] font-bold px-1 py-0.5 rounded bg-gray-800/80"
              style={{ color: baseColor }}
            >
              ⇄
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
      {/* Delete button when selected */}
      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - (isBidirectional ? 16 : 0)}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeEdge(id);
              }}
              className="w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-colors"
              title="Delete connection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
      {/* Label for conditional edges - shown on hover or when connected to selection */}
      {data?.label && (isHighlighted || !hasNodeSelection) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 12}px)`,
              pointerEvents: 'none',
              opacity: isDimmed ? 0 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <span 
              className="px-1.5 py-0.5 rounded text-[9px] font-medium border"
              style={{
                backgroundColor: `${baseColor}15`,
                borderColor: `${baseColor}50`,
                color: baseColor
              }}
            >
              {data.label}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// Custom edge types
const edgeTypes: EdgeTypes = {
  studioEdge: StudioEdge,
};

/**
 * Context menu for canvas right-click actions
 */
interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onSelectMode: () => void;
  onFitView: () => void;
  onSelectAll: () => void;
  onPaste?: () => void;
}

function CanvasContextMenu({ x, y, onClose, onSelectMode, onFitView, onSelectAll, onPaste }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    // Close on escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => { onSelectMode(); onClose(); }}
        className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-[#2a2a2a] flex items-center gap-2"
      >
        <MousePointer2 className="w-4 h-4" />
        Select Mode
        <span className="ml-auto text-[10px] text-gray-500">Box select</span>
      </button>
      <button
        onClick={() => { onSelectAll(); onClose(); }}
        className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-[#2a2a2a] flex items-center gap-2"
      >
        <Copy className="w-4 h-4" />
        Select All
        <span className="ml-auto text-[10px] text-gray-500">⌘A</span>
      </button>
      <div className="border-t border-[#333] my-1" />
      <button
        onClick={() => { onFitView(); onClose(); }}
        className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-[#2a2a2a] flex items-center gap-2"
      >
        <Maximize className="w-4 h-4" />
        Fit View
      </button>
      {onPaste && (
        <>
          <div className="border-t border-[#333] my-1" />
          <button
            onClick={() => { onPaste(); onClose(); }}
            className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-[#2a2a2a] flex items-center gap-2"
          >
            <ClipboardPaste className="w-4 h-4" />
            Paste
            <span className="ml-auto text-[10px] text-gray-500">⌘V</span>
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Selection mode indicator bar
 */
function SelectionModeBar({ onExit, selectedCount }: { onExit: () => void; selectedCount: number }) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
      <MousePointer2 className="w-4 h-4" />
      <span className="text-sm font-medium">
        Selection Mode {selectedCount > 0 && `(${selectedCount} selected)`}
      </span>
      <span className="text-xs opacity-75">Drag to select • ESC to exit</span>
      <button
        onClick={onExit}
        className="ml-2 p-1 hover:bg-white/20 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface StudioCanvasProps {
  onNodeAdded?: () => void;
  onNodeDoubleClick?: () => void;
}

/**
 * Studio Canvas
 * 
 * ReactFlow canvas for visual graph editing.
 * Supports drag-and-drop from node palette, node connections, and selection.
 */
export default function StudioCanvas({ onNodeAdded, onNodeDoubleClick }: StudioCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, getNodes, setNodes, getViewport } = useReactFlow();
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Touch selection box state
  const [touchSelectionBox, setTouchSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const touchSelectionStartRef = useRef<{ x: number; y: number } | null>(null);
  
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    selectEdge,
    selectedNodeId,
    selectedEdgeId,
    removeNode,
    removeEdge,
    addNode,
    clearSelection,
  } = useGraphStore();

  // Count selected nodes
  const selectedCount = nodes.filter(n => n.selected).length;

  // Keyboard shortcuts for delete
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // Delete selected edge
        if (selectedEdgeId) {
          event.preventDefault();
          removeEdge(selectedEdgeId);
        }
        // Delete selected node (but not start/end)
        else if (selectedNodeId && !['__start__', '__end__'].includes(selectedNodeId)) {
          event.preventDefault();
          removeNode(selectedNodeId);
        }
        // Delete multiple selected nodes
        else if (selectedCount > 0) {
          event.preventDefault();
          nodes.filter(n => n.selected && !['__start__', '__end__'].includes(n.id))
            .forEach(n => removeNode(n.id));
        }
      }
      
      // Escape to clear selection and exit selection mode
      if (event.key === 'Escape') {
        setIsSelectionMode(false);
        setContextMenu(null);
        clearSelection();
      }
      
      // Select all with Cmd/Ctrl + A
      if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
        event.preventDefault();
        handleSelectAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedEdgeId, selectedCount, nodes, removeNode, removeEdge, clearSelection]);

  // Handle right-click context menu
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  // Long press state for touch with movement tolerance
  const longPressStartPos = useRef<{ x: number; y: number } | null>(null);
  const LONG_PRESS_TOLERANCE = 15; // pixels of movement allowed

  // Handle long press for touch devices (on the wrapper div)
  const handleWrapperMouseDown = useCallback((event: React.MouseEvent) => {
    // Only trigger on left mouse button and if clicking on the pane (not nodes)
    if (event.button !== 0) return;
    
    // Check if we're clicking on a node or other interactive element
    const target = event.target as HTMLElement;
    if (target.closest('.react-flow__node') || target.closest('.react-flow__edge') || target.closest('.react-flow__controls')) {
      return;
    }
    
    // Store the start position
    longPressStartPos.current = { x: event.clientX, y: event.clientY };
    
    longPressTimerRef.current = setTimeout(() => {
      if (longPressStartPos.current) {
        setContextMenu({ x: longPressStartPos.current.x, y: longPressStartPos.current.y });
      }
    }, 600); // 600ms hold (slightly longer for mobile)
  }, []);

  // Handle mouse/touch move - cancel long press if moved too far
  const handleWrapperMouseMove = useCallback((event: React.MouseEvent) => {
    if (longPressTimerRef.current && longPressStartPos.current) {
      const dx = Math.abs(event.clientX - longPressStartPos.current.x);
      const dy = Math.abs(event.clientY - longPressStartPos.current.y);
      
      // Cancel if moved beyond tolerance
      if (dx > LONG_PRESS_TOLERANCE || dy > LONG_PRESS_TOLERANCE) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        longPressStartPos.current = null;
      }
    }
  }, []);

  const handleWrapperMouseUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartPos.current = null;
  }, []);

  const handleWrapperMouseLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartPos.current = null;
  }, []);

  // Touch event handlers for mobile - using capture phase
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (event.touches.length !== 1) return; // Only single touch
    
    const touch = event.touches[0];
    const target = event.target as HTMLElement;
    
    // Check if we're touching a node or other interactive element
    if (target.closest('.react-flow__node') || target.closest('.react-flow__edge') || target.closest('.react-flow__controls') || target.closest('.react-flow__minimap')) {
      return;
    }
    
    // In selection mode, start the selection box
    if (isSelectionMode) {
      event.preventDefault();
      event.stopPropagation();
      
      const rect = reactFlowWrapper.current?.getBoundingClientRect();
      if (rect) {
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        touchSelectionStartRef.current = { x, y };
        setTouchSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });
      }
      return;
    }
    
    console.log('[Canvas] Touch start at:', touch.clientX, touch.clientY);
    longPressStartPos.current = { x: touch.clientX, y: touch.clientY };
    
    longPressTimerRef.current = setTimeout(() => {
      console.log('[Canvas] Long press triggered!');
      if (longPressStartPos.current) {
        // Vibrate on mobile if available
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        setContextMenu({ x: longPressStartPos.current.x, y: longPressStartPos.current.y });
      }
    }, 500);
  }, [isSelectionMode]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    
    // In selection mode, update the selection box
    if (isSelectionMode && touchSelectionStartRef.current) {
      event.preventDefault();
      event.stopPropagation();
      
      const rect = reactFlowWrapper.current?.getBoundingClientRect();
      if (rect) {
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        setTouchSelectionBox(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
      }
      return;
    }
    
    // Cancel long press if moved too far
    if (longPressTimerRef.current && longPressStartPos.current) {
      const dx = Math.abs(touch.clientX - longPressStartPos.current.x);
      const dy = Math.abs(touch.clientY - longPressStartPos.current.y);
      
      if (dx > LONG_PRESS_TOLERANCE || dy > LONG_PRESS_TOLERANCE) {
        console.log('[Canvas] Long press cancelled due to movement');
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        longPressStartPos.current = null;
      }
    }
  }, [isSelectionMode]);

  const handleTouchEnd = useCallback(() => {
    console.log('[Canvas] Touch end');
    
    // In selection mode, finalize the selection
    if (isSelectionMode && touchSelectionBox && reactFlowWrapper.current) {
      const rect = reactFlowWrapper.current.getBoundingClientRect();
      const viewport = getViewport();
      
      // Calculate selection box in screen coordinates
      const boxLeft = Math.min(touchSelectionBox.startX, touchSelectionBox.currentX);
      const boxRight = Math.max(touchSelectionBox.startX, touchSelectionBox.currentX);
      const boxTop = Math.min(touchSelectionBox.startY, touchSelectionBox.currentY);
      const boxBottom = Math.max(touchSelectionBox.startY, touchSelectionBox.currentY);
      
      // Only select if box is big enough (not just a tap)
      if (boxRight - boxLeft > 10 && boxBottom - boxTop > 10) {
        // Convert screen box to flow coordinates
        const flowBoxLeft = (boxLeft - viewport.x) / viewport.zoom;
        const flowBoxRight = (boxRight - viewport.x) / viewport.zoom;
        const flowBoxTop = (boxTop - viewport.y) / viewport.zoom;
        const flowBoxBottom = (boxBottom - viewport.y) / viewport.zoom;
        
        // Find nodes within the selection box
        const nodesToSelect = nodes.filter(node => {
          const nodeLeft = node.position.x;
          const nodeRight = node.position.x + 120; // node width
          const nodeTop = node.position.y;
          const nodeBottom = node.position.y + 100; // node height
          
          // Check if node overlaps with selection box
          return nodeLeft < flowBoxRight && 
                 nodeRight > flowBoxLeft && 
                 nodeTop < flowBoxBottom && 
                 nodeBottom > flowBoxTop;
        });
        
        // Select the nodes
        if (nodesToSelect.length > 0) {
          onNodesChange(nodesToSelect.map(n => ({ 
            type: 'select' as const, 
            id: n.id, 
            selected: true 
          })));
          
          // Vibrate on selection
          if (navigator.vibrate) {
            navigator.vibrate(30);
          }
        }
      }
      
      setTouchSelectionBox(null);
      touchSelectionStartRef.current = null;
      return;
    }
    
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartPos.current = null;
  }, [isSelectionMode, touchSelectionBox, nodes, onNodesChange, getViewport]);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Enter selection mode
  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  // Exit selection mode
  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
  }, []);

  // Select all nodes
  const handleSelectAll = useCallback(() => {
    const updatedNodes = nodes.map(n => ({ ...n, selected: true }));
    // Use onNodesChange to update selection
    onNodesChange(updatedNodes.map(n => ({ type: 'select' as const, id: n.id, selected: true })));
  }, [nodes, onNodesChange]);

  // Handle fit view
  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  // Debug: Log nodes when they change
  console.log('[Canvas] Rendering with nodes:', nodes.length, nodes.map(n => ({ id: n.id, type: n.type, draggable: n.draggable, selectable: n.selectable })));

  // Handle node click for selection
  // If clicking an already-selected node, trigger the double-click callback (opens config on mobile)
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      console.log('[Canvas] Node clicked:', node.id);
      const wasAlreadySelected = selectedNodeId === node.id;
      selectNode(node.id);
      
      // If tapping an already-selected node (or any node on mobile), open config
      if (wasAlreadySelected && onNodeDoubleClick) {
        onNodeDoubleClick();
      }
    },
    [selectNode, selectedNodeId, onNodeDoubleClick]
  );

  // Handle edge click for selection
  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      selectEdge(edge.id);
    },
    [selectEdge]
  );

  // Handle pane click to clear selection
  const handlePaneClick = useCallback(() => {
    // Don't clear selection when in selection mode
    if (!isSelectionMode) {
      clearSelection();
    }
  }, [clearSelection, isSelectionMode]);

  // Handle drag over for drop zone
  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop from node palette
  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow-type');
      const nodeData = event.dataTransfer.getData('application/reactflow-data');
      
      if (!type || !nodeData) {
        console.log('[Canvas] Drop failed - missing data:', { type, nodeData });
        return;
      }

      console.log('[Canvas] Drop received:', { type, nodeData });
      
      const parsedData = JSON.parse(nodeData) as Partial<StudioNodeData>;
      
      // Get drop position in flow coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Generate unique ID
      const nodeId = `${parsedData.nodeType}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      // Create new node
      const newNode = {
        id: nodeId,
        type: 'studioNode',
        position,
        draggable: true,
        selectable: true,
        data: {
          label: parsedData.label || parsedData.nodeType || 'Node',
          nodeType: parsedData.nodeType || 'universal',
          description: parsedData.description,
          icon: parsedData.icon,
          color: parsedData.color,
          config: {},
        } as StudioNodeData,
      };

      console.log('[Canvas] Adding node:', newNode);
      addNode(newNode);
      selectNode(nodeId);
      
      // Notify parent that a node was added (opens config on mobile)
      if (onNodeAdded) {
        onNodeAdded();
      }
    },
    [screenToFlowPosition, addNode, selectNode, onNodeAdded]
  );

  return (
    <div 
      ref={reactFlowWrapper} 
      className="h-full w-full relative select-none"
      style={{ 
        WebkitUserSelect: 'none', 
        userSelect: 'none', 
        WebkitTouchCallout: 'none',
        // Prevent browser scrolling when in selection mode
        touchAction: isSelectionMode ? 'none' : 'auto',
      }}
      onContextMenu={handleContextMenu}
      onMouseDown={handleWrapperMouseDown}
      onMouseMove={handleWrapperMouseMove}
      onMouseUp={handleWrapperMouseUp}
      onMouseLeave={handleWrapperMouseLeave}
      onTouchStartCapture={handleTouchStart}
      onTouchMoveCapture={handleTouchMove}
      onTouchEndCapture={handleTouchEnd}
      onTouchCancelCapture={handleTouchEnd}
    >
      {/* Selection mode indicator */}
      {isSelectionMode && (
        <SelectionModeBar onExit={exitSelectionMode} selectedCount={selectedCount} />
      )}
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        edgesUpdatable
        selectionOnDrag={isSelectionMode}
        selectionMode={SelectionMode.Partial}
        selectNodesOnDrag={false}
        panOnDrag={!isSelectionMode}
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'studioEdge',
          animated: true,
        }}
        connectionLineStyle={{ strokeWidth: 2, stroke: '#ef4444' }}
        proOptions={{ hideAttribution: true }}
        selectionKeyCode={null}
        multiSelectionKeyCode="Shift"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={5}
          color="#444444"
        />
        <Controls 
          className="!bg-[#1a1a1a] !border-[#2a2a2a] !shadow-lg"
          showInteractive={false}
        />
        <MiniMap
          className="!bg-[#1a1a1a] !border-[#2a2a2a]"
          nodeColor={(node) => {
            if (node.type === 'startNode') return '#22c55e';
            if (node.type === 'endNode') return '#ef4444';
            return node.data?.color || '#ef4444';
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
        />
      </ReactFlow>
      
      {/* Touch selection box overlay */}
      {touchSelectionBox && (
        <div
          className="absolute pointer-events-none border-2 border-red-500 bg-red-500/20 z-50"
          style={{
            left: Math.min(touchSelectionBox.startX, touchSelectionBox.currentX),
            top: Math.min(touchSelectionBox.startY, touchSelectionBox.currentY),
            width: Math.abs(touchSelectionBox.currentX - touchSelectionBox.startX),
            height: Math.abs(touchSelectionBox.currentY - touchSelectionBox.startY),
          }}
        />
      )}
      
      {/* Context menu */}
      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          onSelectMode={enterSelectionMode}
          onFitView={handleFitView}
          onSelectAll={handleSelectAll}
        />
      )}
    </div>
  );
}
