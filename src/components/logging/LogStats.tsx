/**
 * LogStats - Display statistics for a conversation
 */
'use client';

import { useState, useEffect } from 'react';

interface LogStatsProps {
  conversationId: string;
}

interface Stats {
  totalLogs: number;
  generationCount: number;
  isGenerating: boolean;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
}

export function LogStats({ conversationId }: LogStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setStats(null);
      return;
    }

    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/v1/logs/stats?conversationId=${conversationId}`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
      setIsLoading(false);
    };

    fetchStats();
    
    // Refresh stats every 5 seconds if generating
    const interval = setInterval(() => {
      // Only refresh periodically while generating
      if (stats?.isGenerating) {
        fetchStats();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [conversationId, stats?.isGenerating]);

  if (!conversationId) return null;

  if (isLoading && !stats) {
    return (
      <div className="bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-[var(--background)] rounded w-3/4"></div>
          <div className="h-4 bg-[var(--background)] rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] p-4 space-y-4">
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Statistics</h2>

      {/* Overview */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--foreground)] opacity-60">Total Logs</span>
          <span className="text-[var(--foreground)] font-semibold">{stats.totalLogs}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--foreground)] opacity-60">Generations</span>
          <span className="text-[var(--foreground)] font-semibold">{stats.generationCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--foreground)] opacity-60">Status</span>
          <span className={stats.isGenerating ? 'text-[var(--red-primary)]' : 'text-[var(--foreground)] opacity-40'}>
            {stats.isGenerating ? '🟢 Active' : '⚪ Idle'}
          </span>
        </div>
      </div>

      {/* By Level */}
      <div className="border-t border-[var(--border-color)] pt-4">
        <h3 className="text-sm font-medium text-[var(--foreground)] opacity-70 mb-2">By Level</h3>
        <div className="space-y-2">
          {Object.entries(stats.byLevel).map(([level, count]) => {
            const icons: Record<string, string> = {
              debug: '🐛',
              info: 'ℹ️',
              success: '✅',
              warn: '⚠️',
              warning: '⚠️',
              error: '❌',
            };
            const colors: Record<string, string> = {
              debug: 'text-text-muted',
              info: 'text-blue-400',
              success: 'text-green-400',
              warn: 'text-yellow-400',
              warning: 'text-yellow-400',
              error: 'text-red-400',
            };
            
            // Fallback for unexpected levels
            const icon = icons[level] || '📝';
            const color = colors[level] || 'text-text-secondary';
            
            const percentage = stats.totalLogs > 0 ? (count / stats.totalLogs) * 100 : 0;
            
            return (
              <div key={level}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={color}>
                    {icon} {level}
                  </span>
                  <span className="text-[var(--foreground)] opacity-60">{count}</span>
                </div>
                <div className="w-full bg-[var(--background)] rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${color.replace('text-', 'bg-')}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* By Category */}
      <div className="border-t border-[var(--border-color)] pt-4">
        <h3 className="text-sm font-medium text-[var(--foreground)] opacity-70 mb-2">By Category</h3>
        <div className="space-y-2">
          {Object.entries(stats.byCategory).map(([category, count]) => {
            const icons: Record<string, string> = {
              generation: '🔄',
              router: '🧭',
              tool: '🔧',
              chat: '💬',
              thought: '💭',
            };
            
            const percentage = stats.totalLogs > 0 ? (count / stats.totalLogs) * 100 : 0;
            
            return (
              <div key={category} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--foreground)] opacity-60">
                    {icons[category]} {category}
                  </span>
                  <span className="text-[var(--foreground)] font-medium">{count}</span>
                </div>
                <div className="w-full bg-[var(--background)] rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full bg-[var(--red-primary)]`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
