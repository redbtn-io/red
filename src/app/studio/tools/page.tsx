'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AvailableToolsBrowser } from '@/components/tools/AvailableToolsBrowser';

/**
 * Tools Explorer Page
 * Displays all available MCP tools in a full-page view
 */
export default function ToolsExplorerPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link 
            href="/studio" 
            className="p-2 hover:bg-bg-elevated rounded-lg transition-colors"
            title="Back to Studio"
          >
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Available Tools</h1>
            <p className="text-sm text-text-muted mt-1">Browse and explore all MCP tools available in your system</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <AvailableToolsBrowser />
      </div>

      {/* Footer */}
      <div className="bg-bg-secondary border-t border-border mt-12 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-text-muted">
          <p>Use these tools when creating nodes to build powerful automations</p>
          <Link href="/studio/create-node" className="text-accent hover:text-accent-hover transition-colors mt-2 inline-block">
            Create a Node →
          </Link>
        </div>
      </div>
    </div>
  );
}
