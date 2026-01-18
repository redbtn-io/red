'use client';

import { useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Library, Database, User as UserIcon, LogOut, Globe, Settings } from 'lucide-react';
import Link from 'next/link';
import { DataSidebar } from '@/components/layout/DataSidebar';
import { useAuth } from '@/contexts/AuthContext';

interface DataLayoutProps {
  children: ReactNode;
}

export default function DataLayout({ children }: DataLayoutProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

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
    <div className="flex h-screen bg-bg-primary text-text-primary overflow-hidden">
      <DataSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-primary">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary lg:hidden"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-2">
              <PageIcon size={20} className="text-red-500" />
              <h1 className="text-lg font-semibold">{title}</h1>
            </div>
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary"
              title="User Menu"
            >
              <UserIcon size={20} />
            </button>
            
            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowUserMenu(false)} 
                />
                <div className="absolute right-0 mt-2 w-48 py-2 bg-bg-secondary border border-border rounded-lg shadow-xl z-20">
                  {user && (
                    <div className="px-4 py-2 border-b border-border">
                      <p className="text-sm font-medium text-text-primary truncate">{user.name || user.email}</p>
                      <p className="text-xs text-text-secondary truncate">{user.email}</p>
                    </div>
                  )}
                  <Link
                    href="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-tertiary"
                  >
                    <Settings size={16} />
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-bg-tertiary"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
