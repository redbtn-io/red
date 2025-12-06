'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { StudioNodeData } from '@/lib/stores/graphStore';
import { Square } from 'lucide-react';

/**
 * End Node Component
 * 
 * Terminal point for graph execution.
 * Only has an input handle (no outputs).
 */
function EndNode({ data, selected }: NodeProps<StudioNodeData>) {
  console.log('[EndNode] Rendering, selected:', selected);
  
  return (
    <div
      className={`
        relative rounded-full border-2 bg-red-600 p-4 shadow-lg transition-all cursor-pointer
        ${selected ? 'border-[#ef4444] ring-2 ring-[#ef4444]/30' : 'border-red-500 hover:border-red-400'}
      `}
    >
      <Square className="w-6 h-6 text-white fill-white" />
      
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-white !border-2 !border-red-600"
      />
    </div>
  );
}

export default memo(EndNode);
