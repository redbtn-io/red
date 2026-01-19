'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    GitBranch,
    Box,
    Brain,
    Wrench,
    Plus,
    ArrowRight,
    Sparkles,
    Clock,
    Loader2,
} from 'lucide-react';
import { StudioSidebar } from '@/components/layout/StudioSidebar';
import { StudioHeader } from '@/components/layout/StudioHeader';
import {
    pageVariants,
    staggerContainerVariants,
    staggerItemVariants,
    cardVariants,
    fadeUpVariants,
} from '@/lib/animations';

interface GraphSummary {
  graphId: string;
  name: string;
  description?: string;
  updatedAt?: string;
}

interface Stats {
  graphs: number;
  nodes: number;
  neurons: number;
}

/**
 * Studio Home Page
 * 
 * Dashboard with overview of graphs, nodes, neurons, and quick actions.
 */
export default function StudioHomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recentGraphs, setRecentGraphs] = useState<GraphSummary[]>([]);
  const [stats, setStats] = useState<Stats>({ graphs: 0, nodes: 0, neurons: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [graphsRes, nodesRes, neuronsRes] = await Promise.all([
          fetch('/api/v1/graphs'),
          fetch('/api/v1/nodes'),
          fetch('/api/v1/neurons'),
        ]);

        if (graphsRes.ok) {
          const { graphs } = await graphsRes.json();
          setRecentGraphs(graphs?.slice(0, 4) || []);
          setStats(prev => ({ ...prev, graphs: graphs?.length || 0 }));
        }
        if (nodesRes.ok) {
          const { nodes } = await nodesRes.json();
          setStats(prev => ({ ...prev, nodes: nodes?.length || 0 }));
        }
        if (neuronsRes.ok) {
          const { neurons } = await neuronsRes.json();
          setStats(prev => ({ ...prev, neurons: neurons?.length || 0 }));
        }
      } catch (err) {
        console.error('Error fetching studio data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const sections = [
    {
      title: 'Graphs',
      description: 'Visual AI workflows connecting nodes into intelligent pipelines',
      icon: GitBranch,
      color: '#ef4444',
      href: '/studio/graphs',
      createHref: '/studio/new',
      count: stats.graphs,
    },
    {
      title: 'Nodes',
      description: 'Building blocks with configurable steps for processing data',
      icon: Box,
      color: '#3b82f6',
      href: '/studio/nodes',
      createHref: '/studio/create-node',
      count: stats.nodes,
    },
    {
      title: 'Neurons',
      description: 'AI model configurations for language understanding and generation',
      icon: Brain,
      color: '#8b5cf6',
      href: '/studio/neurons',
      createHref: '/studio/create-neuron',
      count: stats.neurons,
    },
    {
      title: 'Tools',
      description: 'MCP integrations for search, scraping, and external APIs',
      icon: Wrench,
      color: '#f59e0b',
      href: '/studio/tools',
      count: 0,
      comingSoon: true,
    },
  ];

  return (
    <div className="flex h-app bg-bg-primary overflow-hidden">
      {/* Sidebar */}
      <StudioSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <StudioHeader
          title="Studio"
          subtitle="Build and manage your AI infrastructure"
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          action={{ label: 'New Graph', href: '/studio/new' }}
        />

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div 
            className="max-w-6xl mx-auto px-4 py-8 pb-24"
            variants={pageVariants}
            initial="initial"
            animate="animate"
          >
            {/* Quick Actions */}
            <motion.div className="mb-8" variants={fadeUpVariants}>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/studio/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  New Graph
                </Link>
                <Link
                  href="/studio/create-node"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-bg-secondary text-text-primary rounded-lg hover:bg-bg-tertiary border border-border transition-colors"
                >
                  <Box className="w-4 h-4" />
                  Create Node
                </Link>
              </div>
            </motion.div>

            {/* Stats Cards */}
            <motion.div 
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
              variants={staggerContainerVariants}
              initial="initial"
              animate="animate"
            >
              {sections.map((section, index) => (
                <motion.div key={section.title} variants={staggerItemVariants}>
                  <Link
                    href={section.comingSoon ? '#' : section.href}
                    className={`
                      relative p-4 rounded-xl border bg-bg-secondary block
                      ${section.comingSoon ? 'opacity-60 cursor-not-allowed' : 'hover:border-border-hover hover:bg-bg-secondary'}
                      border-border transition-all group
                    `}
                  >
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                      style={{ backgroundColor: `${section.color}20` }}
                    >
                      <section.icon className="w-5 h-5" style={{ color: section.color }} />
                    </div>
                    <div className="text-2xl font-bold text-text-primary mb-1">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : section.count}
                    </div>
                    <div className="text-sm text-text-secondary">{section.title}</div>
                    {section.comingSoon && (
                      <span className="absolute top-3 right-3 text-[10px] font-medium px-2 py-0.5 rounded bg-bg-tertiary text-text-muted">
                        Soon
                      </span>
                    )}
                    {!section.comingSoon && (
                      <ArrowRight className="absolute top-4 right-4 w-4 h-4 text-text-disabled group-hover:text-text-secondary transition-colors" />
                    )}
                  </Link>
                </motion.div>
              ))}
            </motion.div>

            {/* Sections Grid */}
            <motion.div 
              className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-8"
              variants={staggerContainerVariants}
              initial="initial"
              animate="animate"
            >
              {/* Recent Graphs */}
              <motion.div 
                className="bg-bg-secondary rounded-xl border border-border p-5"
                variants={cardVariants}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-text-muted" />
                    <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Recent Graphs</h2>
                  </div>
                  <Link 
                    href="/studio/graphs" 
                    className="text-xs text-accent-text hover:text-accent-hover transition-colors"
                  >
                    View all →
                  </Link>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
                  </div>
                ) : recentGraphs.length > 0 ? (
                  <div className="space-y-2">
                    {recentGraphs.map((graph) => (
                      <Link
                        key={graph.graphId}
                        href={`/studio/${graph.graphId}`}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-bg-elevated transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                          <GitBranch className="w-4 h-4 text-accent-text" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text-primary truncate group-hover:text-text-primary">
                            {graph.name}
                          </div>
                          {graph.description && (
                            <div className="text-xs text-text-muted truncate">{graph.description}</div>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-text-disabled group-hover:text-text-secondary transition-colors flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-text-muted text-sm mb-3">No graphs yet</div>
                    <Link
                      href="/studio/new"
                      className="inline-flex items-center gap-1 text-sm text-accent-text hover:text-accent-hover"
                    >
                      <Plus className="w-3 h-3" />
                      Create your first graph
                    </Link>
                  </div>
                )}
              </motion.div>

              {/* Quick Start */}
              <motion.div 
                className="bg-bg-secondary rounded-xl border border-border p-5"
                variants={cardVariants}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-text-muted" />
                  <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Quick Start</h2>
                </div>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-bg-elevated border border-border">
                    <div className="text-sm font-medium text-text-primary mb-1">1. Create a Graph</div>
                    <div className="text-xs text-text-muted">
                      Start with a visual canvas to design your AI workflow
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-bg-elevated border border-border">
                    <div className="text-sm font-medium text-text-primary mb-1">2. Add Nodes</div>
                    <div className="text-xs text-text-muted">
                      Drag nodes onto the canvas — routers, responders, tools, and more
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-bg-elevated border border-border">
                    <div className="text-sm font-medium text-text-primary mb-1">3. Connect & Configure</div>
                    <div className="text-xs text-text-muted">
                      Link nodes together and customize their steps and parameters
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-bg-elevated border border-border">
                    <div className="text-sm font-medium text-text-primary mb-1">4. Deploy</div>
                    <div className="text-xs text-text-muted">
                      Save your graph and use it as an AI assistant endpoint
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Feature Cards */}
            <motion.div 
              className="grid md:grid-cols-3 gap-4"
              variants={staggerContainerVariants}
              initial="initial"
              animate="animate"
            >
              {sections.slice(0, 3).map((section, index) => (
                <motion.div key={section.title} variants={staggerItemVariants}>
                  <Link
                    href={section.href}
                    className="p-5 rounded-xl border border-border bg-bg-secondary hover:bg-bg-secondary hover:border-border-hover transition-all group block"
                  >
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                      style={{ backgroundColor: `${section.color}15` }}
                    >
                      <section.icon className="w-6 h-6" style={{ color: section.color }} />
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary mb-2 group-hover:text-text-primary">
                      {section.title}
                    </h3>
                    <p className="text-sm text-text-muted mb-4">
                      {section.description}
                    </p>
                    <div className="flex items-center text-sm text-text-secondary group-hover:text-text-secondary">
                      Explore {section.title.toLowerCase()}
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
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
