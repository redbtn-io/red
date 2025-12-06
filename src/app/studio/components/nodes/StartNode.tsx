'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { StudioNodeData } from '@/lib/stores/graphStore';
import { PlayCircle } from 'lucide-react';

/**
 * Start Node Component
 * 
 * Entry point for graph execution.
 * Only has an output handle (no inputs).
 */
function StartNode({ data, selected }: NodeProps<StudioNodeData>) {
  console.log('[StartNode] Rendering, selected:', selected);
  
  return (
    <div
      className={`
        relative rounded-full border-2 bg-green-600 p-4 shadow-lg transition-all cursor-pointer
        ${selected ? 'border-[#ef4444] ring-2 ring-[#ef4444]/30' : 'border-green-500 hover:border-green-400'}
      `}
    >
      <PlayCircle className="w-6 h-6 text-white" />
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-white !border-2 !border-green-600"
      />
    </div>
  );
}

export default memo(StartNode);
