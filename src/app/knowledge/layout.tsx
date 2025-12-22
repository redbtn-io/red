'use client';

import { useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Library, User as UserIcon, LogOut } from 'lucide-react';
import { KnowledgeSidebar } from '@/components/layout/KnowledgeSidebar';
import { useAuth } from '@/contexts/AuthContext';

interface KnowledgeLayoutProps {
  children: ReactNode;
}

export default function KnowledgeLayout({ children }: KnowledgeLayoutProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Determine page title based on route
  const getPageTitle = () => {
    if (pathname === '/knowledge') return 'Knowledge';
    if (pathname === '/knowledge/search') return 'Global Search';
    if (pathname === '/knowledge/new') return 'New Library';
    if (pathname?.startsWith('/knowledge/')) return 'Library';
    return 'Knowledge';
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      <KnowledgeSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[#0a0a0a]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-[#1a1a1a] text-gray-400 lg:hidden"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-2">
              <Library size={20} className="text-red-500" />
              <h1 className="text-lg font-semibold">{getPageTitle()}</h1>
            </div>
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="p-2 rounded-lg hover:bg-[#1a1a1a] text-gray-400"
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
                <div className="absolute right-0 mt-2 w-48 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-20">
                  {user && (
                    <div className="px-4 py-2 border-b border-[#2a2a2a]">
                      <p className="text-sm font-medium text-white truncate">{user.name || user.email}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-[#2a2a2a]"
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
