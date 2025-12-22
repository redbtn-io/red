'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  ArrowLeft,
  Settings,
  Save,
  Loader2,
  Webhook,
  Calendar,
  MousePointer,
  Radio,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { StudioSidebar } from '@/components/layout/StudioSidebar';
import { StudioHeader } from '@/components/layout/StudioHeader';
import { pageVariants, fadeUpVariants } from '@/lib/animations';
import type { Automation, TriggerType } from '@/types/automation';

const triggerIcons: Record<TriggerType, typeof Webhook> = {
  webhook: Webhook,
  schedule: Calendar,
  event: Radio,
  manual: MousePointer,
};

const triggerLabels: Record<TriggerType, string> = {
  webhook: 'Webhook',
  schedule: 'Scheduled',
  event: 'Event-based',
  manual: 'Manual',
};

export default function AutomationEditPage() {
  const params = useParams();
  const router = useRouter();
  const automationId = params?.automationId as string;
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<'webhook' | 'schedule' | 'event' | 'manual'>('manual');

  useEffect(() => {
    if (automationId) {
      fetchAutomation();
    }
  }, [automationId]);

  async function fetchAutomation() {
    try {
      const res = await fetch(`/api/v1/automations/${automationId}`);
      if (res.ok) {
        const data = await res.json();
        const auto = data.automation;
        setAutomation(auto);
        setName(auto.name);
        setDescription(auto.description || '');
        setTriggerType(auto.trigger.type);
      }
    } catch (err) {
      console.error('Error fetching automation:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/automations/${automationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          trigger: { type: triggerType },
        }),
      });
      if (res.ok) {
        router.push(`/automations/${automationId}`);
      }
    } catch (err) {
      console.error('Error saving automation:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this automation? This action cannot be undone.')) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/automations/${automationId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push('/automations');
      }
    } catch (err) {
      console.error('Error deleting automation:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Automation not found</h2>
          <Link href="/automations" className="text-[#ef4444] hover:underline">
            Back to Automations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <StudioSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <StudioHeader
          title="Edit Automation"
          subtitle={automation.name}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <motion.div 
            className="max-w-2xl mx-auto px-4 py-8 pb-24"
            variants={pageVariants}
            initial="initial"
            animate="animate"
          >
            {/* Back Link */}
            <motion.div className="mb-6" variants={fadeUpVariants}>
              <Link 
                href={`/automations/${automationId}`}
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Automation
              </Link>
            </motion.div>

            {/* Mock Notice */}
            <motion.div 
              className="mb-6 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 flex items-start gap-3"
              variants={fadeUpVariants}
            >
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-500 mb-1">Mock Settings Page</h3>
                <p className="text-sm text-yellow-500/80">
                  This is a placeholder settings page. Full configuration options including 
                  schedule builder, webhook configuration, input mapping, and output actions 
                  will be available in a future update.
                </p>
              </div>
            </motion.div>

            {/* Settings Form */}
            <motion.div 
              className="space-y-6"
              variants={fadeUpVariants}
            >
              {/* Basic Info */}
              <div className="p-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Basic Information
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder-gray-500 focus:outline-none focus:border-[#ef4444] transition-colors"
                      placeholder="Automation name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder-gray-500 focus:outline-none focus:border-[#ef4444] transition-colors resize-none"
                      placeholder="Optional description"
                    />
                  </div>
                </div>
              </div>

              {/* Trigger Type */}
              <div className="p-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                <h2 className="text-lg font-semibold text-white mb-4">Trigger Type</h2>
                
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(triggerLabels) as Array<keyof typeof triggerLabels>).map((type) => {
                    const Icon = triggerIcons[type];
                    const isSelected = triggerType === type;
                    const isDisabled = type !== 'manual'; // Only manual is functional for now
                    
                    return (
                      <button
                        key={type}
                        onClick={() => !isDisabled && setTriggerType(type)}
                        disabled={isDisabled}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-[#ef4444] bg-[#ef4444]/10'
                            : isDisabled
                            ? 'border-[#2a2a2a] bg-[#0a0a0a] opacity-50 cursor-not-allowed'
                            : 'border-[#2a2a2a] bg-[#0a0a0a] hover:border-[#3a3a3a]'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mb-2 ${isSelected ? 'text-[#ef4444]' : 'text-gray-400'}`} />
                        <div className={`font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                          {triggerLabels[type]}
                        </div>
                        {isDisabled && (
                          <div className="text-xs text-gray-500 mt-1">Coming soon</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Graph Selection (Read-only for now) */}
              <div className="p-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                <h2 className="text-lg font-semibold text-white mb-4">Graph</h2>
                <div className="px-4 py-3 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a]">
                  <code className="text-sm text-gray-400 break-all">{automation.graphId}</code>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Graph selection cannot be changed after creation.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Automation
                </button>
                
                <div className="flex items-center gap-3">
                  <Link
                    href={`/automations/${automationId}`}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </Link>
                  <button
                    onClick={handleSave}
                    disabled={saving || !name.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#ef4444] text-white rounded-lg hover:bg-[#dc2626] transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
