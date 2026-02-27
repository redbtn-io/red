'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Workflow, Box, Brain, FilePlus } from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';

interface StudioSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const studioNavItems = [
  { href: '/studio/graphs', label: 'Graphs', icon: Workflow },
  { href: '/studio/nodes', label: 'Nodes', icon: Box },
  { href: '/studio/neurons', label: 'Neurons', icon: Brain },
];

const createItems = [
  { href: '/studio/new', label: 'New Graph', icon: Plus },
  { href: '/studio/create-node', label: 'Create Node', icon: FilePlus },
];

export function StudioSidebar({ isOpen, onClose }: StudioSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/studio') {
      return pathname === '/studio';
    }
    return pathname === href || pathname?.startsWith(href + '/');
  };

  return (
    <AppSidebar
      isOpen={isOpen}
      onClose={onClose}
      headerAction={
        <Link
          href="/studio/new"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
        >
          <Plus size={18} />
          <span>New Graph</span>
        </Link>
      }
    >
      {/* Studio Navigation */}
      <div className="p-3">
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 mb-2">
          Studio
        </div>
        <div className="space-y-1">
          {studioNavItems.map((item) => {
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

      {/* Create Section */}
      <div className="p-3 border-t border-border">
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 mb-2">
          Create
        </div>
        <div className="space-y-1">
          {createItems.map((item) => {
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
    </AppSidebar>
  );
}
