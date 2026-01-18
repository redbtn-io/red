'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Workflow, Box, Brain } from 'lucide-react';
import { StudioSidebar } from '@/components/layout/StudioSidebar';
import { StudioHeader } from '@/components/layout/StudioHeader';

const pageMeta: Record<string, { title: string; subtitle: string; action?: { label: string; href: string } }> = {
  '/studio/graphs': { 
    title: 'Graphs', 
    subtitle: 'Visual workflows that define how AI processes your requests',
    action: { label: 'New Graph', href: '/studio/new' }
  },
  '/studio/nodes': { 
    title: 'Nodes', 
    subtitle: 'Building blocks with configurable steps for processing data',
    action: { label: 'Create Node', href: '/studio/create-node' }
  },
  '/studio/neurons': { 
    title: 'Neurons', 
    subtitle: 'AI model configurations for language understanding and generation',
  },
};

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Get page metadata
  const meta = pageMeta[pathname] || { title: 'Studio', subtitle: '' };

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <StudioSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <StudioHeader
          title={meta.title}
          subtitle={meta.subtitle}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          action={meta.action}
        />
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
