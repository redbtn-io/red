'use client';

import { useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Library, Database, Globe } from 'lucide-react';
import { DataSidebar } from '@/components/layout/DataSidebar';
import { UserMenu } from '@/components/layout/UserMenu';

interface DataLayoutProps {
  children: ReactNode;
}

export default function DataLayout({ children }: DataLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Determine page title and icon based on route
  const getPageInfo = () => {
    if (pathname?.startsWith('/data/state')) {
      return { title: 'Global State', icon: Globe };
    }
    if (pathname === '/data/knowledge') return { title: 'Knowledge', icon: Library };
    if (pathname === '/data/knowledge/search') return { title: 'Global Search', icon: Library };
    if (pathname === '/data/knowledge/new') return { title: 'New Library', icon: Library };
    if (pathname?.startsWith('/data/knowledge/')) return { title: 'Library', icon: Library };
    return { title: 'Data', icon: Database };
  };

  const { title, icon: PageIcon } = getPageInfo();

  return (
    <div className="flex h-app bg-bg-primary text-text-primary overflow-hidden">
      <DataSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-bg-elevated/90 backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary lg:hidden flex-shrink-0"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <PageIcon size={20} className="text-red-500 flex-shrink-0" />
            <h1 className="text-base sm:text-lg font-semibold truncate">{title}</h1>
          </div>
          
          {/* Spacer */}
          <div className="flex-1" />

          {/* User Menu */}
          <UserMenu showName={true} />
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
