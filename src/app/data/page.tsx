'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  Database, 
  FileText, 
  Key,
  ArrowRight,
  Clock,
  Loader2,
  Plus,
  Folder,
  Activity,
} from 'lucide-react';
import { pageVariants, staggerContainerVariants, staggerItemVariants } from '@/lib/animations';

interface DataStats {
  knowledge: {
    libraryCount: number;
    documentCount: number;
    recentLibraries: Array<{ id: string; name: string; documentCount: number }>;
  };
  state: {
    namespaceCount: number;
    totalKeys: number;
    recentNamespaces: Array<{ namespace: string; keyCount: number; updatedAt: string }>;
  };
}

export default function DataDashboardPage() {
  const [stats, setStats] = useState<DataStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch knowledge stats
        const librariesRes = await fetch('/api/v1/libraries');
        const librariesData = librariesRes.ok ? await librariesRes.json() : { libraries: [] };
        
        // Fetch state stats
        const namespacesRes = await fetch('/api/v1/state/namespaces');
        const namespacesData = namespacesRes.ok ? await namespacesRes.json() : { namespaces: [] };

        const libraries = librariesData.libraries || [];
        const namespaces = namespacesData.namespaces || [];

        setStats({
          knowledge: {
            libraryCount: libraries.length,
            documentCount: libraries.reduce((sum: number, lib: any) => sum + (lib.documentCount || 0), 0),
            recentLibraries: libraries
              .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .slice(0, 3)
              .map((lib: any) => ({ id: lib._id, name: lib.name, documentCount: lib.documentCount || 0 })),
          },
          state: {
            namespaceCount: namespaces.length,
            totalKeys: namespaces.reduce((sum: number, ns: any) => sum + (ns.keyCount || 0), 0),
            recentNamespaces: namespaces
              .filter((ns: any) => !ns.isArchived)
              .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .slice(0, 3)
              .map((ns: any) => ({ namespace: ns.namespace, keyCount: ns.keyCount || 0, updatedAt: ns.updatedAt })),
          },
        });
      } catch (error) {
        console.error('Failed to fetch data stats:', error);
        setStats({
          knowledge: { libraryCount: 0, documentCount: 0, recentLibraries: [] },
          state: { namespaceCount: 0, totalKeys: 0, recentNamespaces: [] },
        });
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-full bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-full bg-bg-primary text-text-primary"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 pb-scroll-safe">
        <motion.div
          variants={staggerContainerVariants}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Knowledge Section */}
          <motion.div variants={staggerItemVariants}>
            <div className="bg-bg-elevated border border-border rounded-2xl overflow-hidden">
              {/* Section Header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <BookOpen size={20} className="text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Knowledge</h2>
                      <p className="text-sm text-text-secondary">Document libraries for RAG</p>
                    </div>
                  </div>
                  <Link
                    href="/data/knowledge"
                    className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    View all
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                <div className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">{stats?.knowledge.libraryCount || 0}</div>
                  <div className="text-xs text-text-muted">Libraries</div>
                </div>
                <div className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">{stats?.knowledge.documentCount || 0}</div>
                  <div className="text-xs text-text-muted">Documents</div>
                </div>
              </div>

              {/* Recent Items */}
              <div className="p-4">
                <div className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Recent Libraries</div>
                {stats?.knowledge.recentLibraries.length ? (
                  <div className="space-y-2">
                    {stats.knowledge.recentLibraries.map((lib) => (
                      <Link
                        key={lib.id}
                        href={`/data/knowledge/${lib.id}`}
                        className="flex items-center justify-between p-3 bg-bg-primary hover:bg-bg-secondary rounded-lg transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <Folder size={16} className="text-blue-400" />
                          <span className="font-medium truncate">{lib.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          <FileText size={12} />
                          {lib.documentCount}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-text-muted">
                    <BookOpen size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No libraries yet</p>
                  </div>
                )}

                {/* Quick Action */}
                <Link
                  href="/data/knowledge"
                  className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
                >
                  <Plus size={16} />
                  Create Library
                </Link>
              </div>
            </div>
          </motion.div>

          {/* State Section */}
          <motion.div variants={staggerItemVariants}>
            <div className="bg-bg-elevated border border-border rounded-2xl overflow-hidden">
              {/* Section Header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <Database size={20} className="text-purple-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Global State</h2>
                      <p className="text-sm text-text-secondary">Persistent key-value storage</p>
                    </div>
                  </div>
                  <Link
                    href="/data/state"
                    className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    View all
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                <div className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">{stats?.state.namespaceCount || 0}</div>
                  <div className="text-xs text-text-muted">Namespaces</div>
                </div>
                <div className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">{stats?.state.totalKeys || 0}</div>
                  <div className="text-xs text-text-muted">Total Keys</div>
                </div>
              </div>

              {/* Recent Items */}
              <div className="p-4">
                <div className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Recent Namespaces</div>
                {stats?.state.recentNamespaces.length ? (
                  <div className="space-y-2">
                    {stats.state.recentNamespaces.map((ns) => (
                      <Link
                        key={ns.namespace}
                        href={`/data/state/${ns.namespace}`}
                        className="flex items-center justify-between p-3 bg-bg-primary hover:bg-bg-secondary rounded-lg transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <Database size={16} className="text-purple-400" />
                          <span className="font-medium font-mono truncate">{ns.namespace}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-muted">
                          <span className="flex items-center gap-1">
                            <Key size={12} />
                            {ns.keyCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatRelativeTime(ns.updatedAt)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-text-muted">
                    <Database size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No namespaces yet</p>
                  </div>
                )}

                {/* Quick Action */}
                <Link
                  href="/data/state"
                  className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-colors"
                >
                  <Plus size={16} />
                  Create Namespace
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Usage Tips */}
          <motion.div variants={staggerItemVariants} className="lg:col-span-2">
            <div className="bg-bg-elevated border border-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Activity size={20} className="text-text-secondary" />
                <h3 className="font-semibold">Quick Tips</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-bg-primary rounded-xl">
                  <div className="text-sm font-medium mb-1">Knowledge Libraries</div>
                  <p className="text-xs text-text-muted">
                    Upload documents to create searchable knowledge bases. Use them in workflows for context-aware responses.
                  </p>
                </div>
                <div className="p-4 bg-bg-primary rounded-xl">
                  <div className="text-sm font-medium mb-1">Global State</div>
                  <p className="text-xs text-text-muted">
                    Store persistent values that workflows can read and write. Great for counters, preferences, and shared config.
                  </p>
                </div>
                <div className="p-4 bg-bg-primary rounded-xl">
                  <div className="text-sm font-medium mb-1">Template Syntax</div>
                  <p className="text-xs text-text-muted">
                    Access state in templates: <code className="text-purple-400">{'{{globalState.namespace.key}}'}</code>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
