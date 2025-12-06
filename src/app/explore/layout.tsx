'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Workflow, 
  Box, 
  Brain,
  Menu
} from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { useViewportHeight } from '@/hooks/useViewportHeight';

interface ExploreLayoutProps {
  children: ReactNode;
}

const exploreNavItems = [
  { href: '/explore/graphs', label: 'Graphs', icon: Workflow },
  { href: '/explore/nodes', label: 'Nodes', icon: Box },
  { href: '/explore/neurons', label: 'Neurons', icon: Brain },
];

export default function ExploreLayout({ children }: ExploreLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Handle mobile viewport height
  useViewportHeight();

  return (
    <div 
      className="flex bg-[#0a0a0a]"
      style={{ height: 'var(--app-height, 100vh)' }}
    >
      {/* Sidebar */}
      <AppSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      >
        {/* Explore Navigation */}
        <div className="p-3">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 px-2">Explore</h2>
          <div className="space-y-1">
            {exploreNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#ef4444]/10 text-[#ef4444] border-l-2 border-[#ef4444]'
                      : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </AppSidebar>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-40 bg-[#0f0f0f] border-b border-[#2a2a2a] px-4 h-14 flex items-center">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-[#1a1a1a] text-gray-400"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white ml-2">Explore</h1>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
