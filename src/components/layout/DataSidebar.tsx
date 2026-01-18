'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus, 
  Library, 
  Database, 
  Lock, 
  Users, 
  Eye, 
  Loader2,
  FolderOpen,
  Settings,
  Globe
} from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';

interface DataSidebarProps {
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

interface GlobalStateInfo {
  namespace: string;
  keyCount: number;
  lastUpdated: string;
}

const dataNavItems = [
  { href: '/data/knowledge', label: 'Knowledge Base', icon: Library, section: 'knowledge' },
  { href: '/data/state', label: 'Global State', icon: Globe, section: 'state' },
];

export function DataSidebar({ isOpen, onClose }: DataSidebarProps) {
  const pathname = usePathname();
  const [libraries, setLibraries] = useState<LibraryInfo[]>([]);
  const [loadingLibraries, setLoadingLibraries] = useState(true);
  const [namespaces, setNamespaces] = useState<GlobalStateInfo[]>([]);
  const [loadingNamespaces, setLoadingNamespaces] = useState(true);

  // Determine active section
  const activeSection = pathname?.startsWith('/data/state') ? 'state' : 'knowledge';

  useEffect(() => {
    async function fetchLibraries() {
      try {
        const response = await fetch('/api/v1/libraries');
        if (response.ok) {
          const data = await response.json();
          setLibraries((data.libraries || []).slice(0, 5));
        }
      } catch (err) {
        console.error('Failed to fetch libraries:', err);
      } finally {
        setLoadingLibraries(false);
      }
    }
    fetchLibraries();
  }, []);

  useEffect(() => {
    async function fetchNamespaces() {
      try {
        const response = await fetch('/api/v1/state/namespaces');
        if (response.ok) {
          const data = await response.json();
          setNamespaces((data.namespaces || []).slice(0, 5));
        }
      } catch (err) {
        console.error('Failed to fetch namespaces:', err);
      } finally {
        setLoadingNamespaces(false);
      }
    }
    fetchNamespaces();
  }, []);

  const isActive = (href: string) => {
    if (href === '/data/knowledge') {
      return pathname === '/data/knowledge';
    }
    if (href === '/data/state') {
      return pathname === '/data/state';
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
        activeSection === 'knowledge' ? (
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('openCreateLibrary'));
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
          >
            <Plus size={18} />
            <span>New Library</span>
          </button>
        ) : (
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('openCreateNamespace'));
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
          >
            <Plus size={18} />
            <span>New Namespace</span>
          </button>
        )
      }
    >
      {/* Data Navigation */}
      <div className="p-3">
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 mb-2">
          Data Management
        </div>
        <div className="space-y-1">
          {dataNavItems.map((item) => {
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

      {/* Knowledge Libraries (shown when on knowledge section) */}
      {activeSection === 'knowledge' && (
        <div className="p-3 border-t border-border">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 mb-2">
            Recent Libraries
          </div>
          {loadingLibraries ? (
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
                const active = pathname === `/data/knowledge/${lib.libraryId}`;
                const AccessIcon = getAccessIcon(lib.access);
                return (
                  <Link
                    key={lib.libraryId}
                    href={`/data/knowledge/${lib.libraryId}`}
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
      )}

      {/* State Namespaces (shown when on state section) */}
      {activeSection === 'state' && (
        <div className="p-3 border-t border-border">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 mb-2">
            Namespaces
          </div>
          {loadingNamespaces ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
            </div>
          ) : namespaces.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-muted">
              No namespaces yet. Create one to organize your global state!
            </div>
          ) : (
            <div className="space-y-1">
              {namespaces.map((ns) => {
                const active = pathname === `/data/state/${ns.namespace}`;
                return (
                  <Link
                    key={ns.namespace}
                    href={`/data/state/${ns.namespace}`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group ${
                      active
                        ? 'bg-accent/10 text-accent-text font-medium'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                    }`}
                  >
                    <Database className="w-4 h-4" />
                    <span className="truncate flex-1">{ns.namespace}</span>
                    <span className="text-xs text-text-disabled group-hover:text-text-secondary">
                      {ns.keyCount} keys
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Quick Tips */}
      <div className="p-3 border-t border-border">
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 mb-2">
          Quick Tips
        </div>
        <div className="px-3 py-2 text-xs text-text-muted">
          {activeSection === 'knowledge' ? (
            <>
              <p className="mb-2">• Upload documents to create searchable knowledge bases</p>
              <p className="mb-2">• Connect libraries to graphs for RAG-powered responses</p>
              <p>• Share libraries with team members</p>
            </>
          ) : (
            <>
              <p className="mb-2">• Global state persists across all workflow executions</p>
              <p className="mb-2">• Use namespaces to organize related data</p>
              <p>• Access state in workflows via <code className="bg-bg-secondary px-1 rounded">{'{{globalState.key}}'}</code></p>
            </>
          )}
        </div>
      </div>
    </AppSidebar>
  );
}
