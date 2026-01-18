'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { StudioNodeData } from '@/lib/stores/graphStore';
import {
  GitBranch,
  MessageSquare,
  Database,
  ListTodo,
  Play,
  Search,
  Globe,
  FileText,
  Tags,
  Blocks,
  Wrench,
  Shuffle,
  Box,
} from 'lucide-react';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  GitBranch,
  MessageSquare,
  Database,
  ListTodo,
  Play,
  Search,
  Globe,
  FileText,
  Tags,
  Blocks,
  Wrench,
  Shuffle,
  Box,
};

// Node types that have multiple outputs (branching)
const BRANCHING_NODES = ['router', 'classifier', 'conditional', 'executor'];

/**
 * Studio Node Component
 * 
 * Custom ReactFlow node for the graph editor.
 * Clean design with left input, right output handles only.
 */
function StudioNode({ data, selected }: NodeProps<StudioNodeData>) {
  const IconComponent = iconMap[data.icon || 'Box'] || Box;
  const bgColor = data.color || '#ef4444';
  const nodeType = data.nodeType || '';
  const isBranching = BRANCHING_NODES.includes(nodeType);

  return (
    <div
      className={`
        relative rounded-xl border-2 bg-bg-secondary shadow-lg transition-all cursor-pointer
        ${selected ? 'border-accent ring-2 ring-accent/30' : 'border-border hover:border-border-hover'}
      `}
      style={{ width: 120, height: 100 }}
    >
      {/* Single input handle - left */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-gray-500 !border-2 !border-border hover:!bg-white transition-colors"
      />

      {/* Content */}
      <div className="flex flex-col items-center justify-center h-full p-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center mb-2"
          style={{ backgroundColor: bgColor }}
        >
          <IconComponent className="w-4 h-4 text-text-primary" />
        </div>
        <span className="text-xs font-medium text-text-primary text-center leading-tight line-clamp-2">
          {data.label}
        </span>
      </div>

      {/* Single output handle - right */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-gray-500 !border-2 !border-border hover:!bg-white transition-colors"
      />
      
      {/* Branching indicator badge */}
      {isBranching && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-bg-secondary border border-border rounded-full flex items-center justify-center">
          <GitBranch className="w-2.5 h-2.5 text-amber-400" />
        </div>
      )}
    </div>
  );
}

export default memo(StudioNode);
