'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    Wrench,
    Users,
    ArrowRight,
    Loader2,
    Plug,
    Server,
} from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Header } from '@/components/layout/Header';
import {
    pageVariants,
    staggerContainerVariants,
    staggerItemVariants,
    fadeUpVariants,
} from '@/lib/animations';

interface ConnectionSection {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  href: string;
  count?: number;
  comingSoon?: boolean;
}

/**
 * Connections Home Page
 * 
 * Hub for managing tools, accounts, and external integrations.
 */
export default function ConnectionsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsCount, setToolsCount] = useState(0);
  const [mcpServersCount, setMcpServersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [toolsRes, mcpRes] = await Promise.all([
          fetch('/api/v1/tools'),
          fetch('/api/v1/mcp-connections'),
        ]);
        
        if (toolsRes.ok) {
          const { count } = await toolsRes.json();
          setToolsCount(count || 0);
        }
        if (mcpRes.ok) {
          const { count } = await mcpRes.json();
          setMcpServersCount(count || 0);
        }
      } catch (err) {
        console.error('Error fetching connections data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const sections: ConnectionSection[] = [
    {
      title: 'Tools',
      description: 'Browse all available MCP tools and create reusable toolkits for your workflows.',
      icon: Wrench,
      color: '#f59e0b',
      href: '/connections/tools',
      count: toolsCount,
    },
    {
      title: 'MCP Servers',
      description: 'Connect external MCP servers to add custom tools from third-party services.',
      icon: Server,
      color: '#10b981',
      href: '/connections/mcp-servers',
      count: mcpServersCount,
    },
    {
      title: 'Accounts',
      description: 'Connected accounts and OAuth integrations for third-party services like Google, GitHub, and more.',
      icon: Users,
      color: '#8b5cf6',
      href: '/connections/accounts',
    },
  ];

  return (
    <div className="flex h-app bg-bg-primary overflow-hidden">
      {/* Sidebar */}
      <AppSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title="Connections"
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onNewChat={() => {}}
        />

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            className="max-w-4xl mx-auto px-4 py-8 pb-scroll-safe"
            variants={pageVariants}
            initial="initial"
            animate="animate"
          >
            {/* Page Header */}
            <motion.div className="mb-8" variants={fadeUpVariants}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Plug className="w-6 h-6 text-accent-text" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-text-primary">Connections</h1>
                  <p className="text-text-secondary">Manage tools, accounts, and integrations</p>
                </div>
              </div>
            </motion.div>

            {/* Sections Grid */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
              variants={staggerContainerVariants}
              initial="initial"
              animate="animate"
            >
              {sections.map((section) => (
                <motion.div key={section.title} variants={staggerItemVariants}>
                  <Link
                    href={section.comingSoon ? '#' : section.href}
                    className={`
                      relative block p-6 rounded-xl border bg-bg-secondary
                      ${section.comingSoon 
                        ? 'opacity-70 cursor-not-allowed' 
                        : 'hover:border-border-hover hover:bg-bg-tertiary cursor-pointer'
                      }
                      border-border transition-all group
                    `}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${section.color}20` }}
                      >
                        <section.icon className="w-6 h-6" style={{ color: section.color }} />
                      </div>
                      {section.comingSoon ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-bg-tertiary text-text-muted">
                          Coming Soon
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 text-text-disabled group-hover:text-text-secondary transition-colors">
                          {section.count !== undefined && (
                            <span className="text-sm font-medium">
                              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : section.count}
                            </span>
                          )}
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold text-text-primary mb-2">{section.title}</h2>
                    <p className="text-sm text-text-secondary leading-relaxed">{section.description}</p>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
