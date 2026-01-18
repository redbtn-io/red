'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Plus, Library, Search, FileText, FolderOpen, Lock, Users, Eye, Loader2 } from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';

interface KnowledgeSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LibraryInfo {
  libraryId: string;
  name: string;
  icon?: string;
  color?: string;
  access: 'private' | 'shared' | 'public';
  documentCount: number;
}

const knowledgeNavItems = [
  { href: '/knowledge', label: 'All Libraries', icon: Library },
];

export function KnowledgeSidebar({ isOpen, onClose }: KnowledgeSidebarProps) {
  const pathname = usePathname();
  const [libraries, setLibraries] = useState<LibraryInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLibraries() {
      try {
        const response = await fetch('/api/v1/libraries');
        if (response.ok) {
          const data = await response.json();
          setLibraries((data.libraries || []).slice(0, 5)); // Show top 5
        }
      } catch (err) {
        console.error('Failed to fetch libraries:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLibraries();
  }, []);

  const isActive = (href: string) => {
    if (href === '/knowledge') {
      return pathname === '/knowledge';
    }
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const getAccessIcon = (access: string) => {
    switch (access) {
      case 'private': return Lock;
      case 'shared': return Users;
      case 'public': return Eye;
      default: return Lock;
    }
  };

  return (
    <AppSidebar
      isOpen={isOpen}
      onClose={onClose}
      headerAction={
        <button
          onClick={() => {
            // Dispatch custom event to open create modal
            window.dispatchEvent(new CustomEvent('openCreateLibrary'));
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
        >
          <Plus size={18} />
          <span>New Library</span>
        </button>
      }
    >
      {/* Knowledge Navigation */}
      <div className="p-3">
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 mb-2">
          Knowledge Base
        </div>
        <div className="space-y-1">
          {knowledgeNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-accent/10 text-accent-text font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Libraries */}
      <div className="p-3 border-t border-border">
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 mb-2">
          Recent Libraries
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
          </div>
        ) : libraries.length === 0 ? (
          <div className="px-3 py-2 text-xs text-text-muted">
            No libraries yet. Create one to get started!
          </div>
        ) : (
          <div className="space-y-1">
            {libraries.map((lib) => {
              const active = pathname === `/knowledge/${lib.libraryId}`;
              const AccessIcon = getAccessIcon(lib.access);
              return (
                <Link
                  key={lib.libraryId}
                  href={`/knowledge/${lib.libraryId}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group ${
                    active
                      ? 'bg-accent/10 text-accent-text font-medium'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: lib.color || '#ef4444' }}
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-text-primary" />
                  </div>
                  <span className="truncate flex-1">{lib.name}</span>
                  <AccessIcon className="w-3 h-3 text-text-disabled group-hover:text-text-secondary" />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Tips */}
      <div className="p-3 border-t border-border">
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 mb-2">
          Quick Tips
        </div>
        <div className="px-3 py-2 text-xs text-text-muted">
          <p className="mb-2">• Upload documents to create searchable knowledge bases</p>
          <p className="mb-2">• Connect libraries to graphs for RAG-powered responses</p>
          <p>• Share libraries with team members</p>
        </div>
      </div>
    </AppSidebar>
  );
}
