'use client';

import { useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Library } from 'lucide-react';
import { KnowledgeSidebar } from '@/components/layout/KnowledgeSidebar';
import { UserMenu } from '@/components/layout/UserMenu';

interface KnowledgeLayoutProps {
  children: ReactNode;
}

export default function KnowledgeLayout({ children }: KnowledgeLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Determine page title based on route
  const getPageTitle = () => {
    if (pathname === '/knowledge') return 'Knowledge';
    if (pathname === '/knowledge/search') return 'Global Search';
    if (pathname === '/knowledge/new') return 'New Library';
    if (pathname?.startsWith('/knowledge/')) return 'Library';
    return 'Knowledge';
  };

  return (
    <div className="flex h-app bg-bg-primary text-text-primary overflow-hidden">
      <KnowledgeSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-white/90 dark:bg-bg-elevated backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary lg:hidden flex-shrink-0"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <Library size={20} className="text-red-500 flex-shrink-0" />
            <h1 className="text-base sm:text-lg font-semibold truncate">{getPageTitle()}</h1>
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
