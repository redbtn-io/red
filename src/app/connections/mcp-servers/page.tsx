'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Plus,
    Server,
    Wrench,
    Check,
    X,
    Loader2,
    AlertCircle,
    RefreshCw,
    Trash2,
    Edit2,
    ToggleLeft,
    ToggleRight,
    ExternalLink,
    Clock,
    ChevronDown,
    ChevronRight,
    Copy,
    Zap,
} from 'lucide-react';
import { useMcpConnections, type McpConnection, type CreateMcpConnectionData, type DiscoveredTool } from '@/hooks/useMcpConnections';
import { pageVariants, fadeUpVariants } from '@/lib/animations';
import { ConfirmModal } from '@/components/ui/Modal';

/**
 * Connection Card Component
 */
function ConnectionCard({ 
  connection, 
  onEdit, 
  onDelete, 
  onTest, 
  onDiscover, 
  onToggle,
  isLoading,
}: {
  connection: McpConnection;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onDiscover: () => void;
  onToggle: () => void;
  isLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(connection.connectionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColor = connection.lastError 
    ? 'text-red-400' 
    : connection.isEnabled 
      ? 'text-green-400' 
      : 'text-text-muted';
  
  const statusText = connection.lastError
    ? 'Error'
    : connection.isEnabled
      ? 'Active'
      : 'Disabled';

  return (
    <motion.div
      variants={fadeUpVariants}
      className={`bg-bg-secondary border rounded-xl overflow-hidden transition-all ${
        connection.isEnabled ? 'border-border' : 'border-border opacity-60'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${connection.color}20`, color: connection.color }}
            >
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">{connection.name}</h3>
              <div className="flex items-center gap-2 text-xs">
                <span className={`flex items-center gap-1 ${statusColor}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    connection.lastError ? 'bg-red-400' : connection.isEnabled ? 'bg-green-400' : 'bg-text-muted'
                  }`} />
                  {statusText}
                </span>
                <span className="text-text-muted">•</span>
                <span className="text-text-muted">{connection.toolCount} tools</span>
              </div>
            </div>
          </div>
          <button
            onClick={onToggle}
            disabled={isLoading}
            className="p-1 hover:bg-bg-tertiary rounded transition-colors"
            title={connection.isEnabled ? 'Disable' : 'Enable'}
          >
            {connection.isEnabled ? (
              <ToggleRight className="w-6 h-6 text-green-400" />
            ) : (
              <ToggleLeft className="w-6 h-6 text-text-muted" />
            )}
          </button>
        </div>

        {connection.description && (
          <p className="text-sm text-text-secondary mb-3">{connection.description}</p>
        )}

        <div className="flex items-center gap-2 text-xs text-text-muted mb-3">
          <ExternalLink className="w-3 h-3" />
          <span className="truncate font-mono">{connection.url}</span>
        </div>

        {connection.lastError && (
          <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg mb-3">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-red-200">{connection.lastError}</span>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-3 py-1.5 bg-bg-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors text-xs text-text-secondary"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>Tools ({connection.toolCount})</span>
          </button>
          <button
            onClick={onTest}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-bg-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors text-xs text-text-secondary disabled:opacity-50"
          >
            <Zap className="w-3 h-3" />
            <span>Test</span>
          </button>
          <button
            onClick={onDiscover}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-bg-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors text-xs text-text-secondary disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleCopyId}
            className="p-1.5 bg-bg-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors text-text-muted"
            title="Copy connection ID"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 bg-bg-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors text-text-muted"
            title="Edit"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 bg-bg-primary border border-border rounded-lg hover:bg-red-500/10 hover:border-red-500/30 transition-colors text-text-muted hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {connection.lastConnectedAt && (
          <div className="flex items-center gap-1 mt-3 text-xs text-text-muted">
            <Clock className="w-3 h-3" />
            <span>Last connected: {new Date(connection.lastConnectedAt).toLocaleString()}</span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border overflow-hidden"
          >
            <div className="p-4 bg-bg-primary space-y-2 max-h-64 overflow-y-auto">
              {connection.tools.length > 0 ? (
                connection.tools.map(tool => (
                  <div
                    key={tool.name}
                    className="flex items-center gap-3 p-2 rounded-lg bg-bg-secondary"
                  >
                    <div className="p-1.5 rounded border border-border bg-bg-tertiary">
                      <Wrench className="w-4 h-4 text-text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs text-accent-text">{tool.name}</span>
                      <p className="text-xs text-text-muted truncate">{tool.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-muted text-center py-4">No tools discovered</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Add/Edit Connection Modal
 */
function ConnectionModal({
  isOpen,
  onClose,
  onSave,
  editingConnection,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateMcpConnectionData) => Promise<void>;
  editingConnection?: McpConnection | null;
}) {
  const [name, setName] = useState(editingConnection?.name || '');
  const [description, setDescription] = useState(editingConnection?.description || '');
  const [url, setUrl] = useState(editingConnection?.url || '');
  const [color, setColor] = useState(editingConnection?.color || '#10b981');
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; tools?: DiscoveredTool[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Update form when editing a connection
  useEffect(() => {
    if (editingConnection) {
      setName(editingConnection.name);
      setDescription(editingConnection.description || '');
      setUrl(editingConnection.url);
      setColor(editingConnection.color);
      // Convert headers object to array
      const headerArray = Object.entries(editingConnection.headers || {}).map(([key, value]) => ({ key, value }));
      setHeaders(headerArray);
    } else {
      // Clear form when not editing
      setName('');
      setDescription('');
      setUrl('');
      setColor('#10b981');
      setHeaders([]);
      setTestResult(null);
      setError(null);
    }
  }, [editingConnection, isOpen]);

  // Scroll to top when error appears
  useEffect(() => {
    if (error && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [error]);

  const handleTest = async () => {
    if (!url) {
      setError('URL is required');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      // Build headers object
      const headersObj: Record<string, string> = {};
      headers.forEach(h => {
        if (h.key && h.value) headersObj[h.key] = h.value;
      });

      // Use the create endpoint for testing (it tests before saving)
      // For a pure test, we'd need a separate endpoint, but for now we'll just validate the response
      const response = await fetch('/api/v1/mcp-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'Test Connection',
          url,
          headers: headersObj,
          _testOnly: true, // This won't be used but indicates intent
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        setTestResult({ success: false, message: data.error || 'Connection failed' });
      } else {
        setTestResult({ 
          success: true, 
          message: `Connected! Found ${data.connection.toolCount} tools`,
          tools: data.connection.tools,
        });
        // Since we created a connection for testing, delete it
        if (data.connection?.connectionId) {
          await fetch(`/api/v1/mcp-connections/${data.connection.connectionId}`, {
            method: 'DELETE',
          });
        }
      }
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const headersObj: Record<string, string> = {};
      headers.forEach(h => {
        if (h.key && h.value) headersObj[h.key] = h.value;
      });

      await onSave({
        name: name.trim(),
        description: description.trim(),
        color,
        url: url.trim(),
        headers: headersObj,
      });
      
      // Clear form fields on success
      setName('');
      setDescription('');
      setUrl('');
      setColor('#10b981');
      setHeaders([]);
      setTestResult(null);
      setError(null);
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...headers];
    newHeaders[index][field] = value;
    setHeaders(newHeaders);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg max-h-[90vh] bg-bg-secondary border border-border rounded-2xl overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">
              {editingConnection ? 'Edit MCP Server' : 'Add MCP Server'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors text-text-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-200">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My MCP Server"
              className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">URL *</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/mcp"
              className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-border"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 px-4 py-2 bg-bg-primary border border-border rounded-lg text-text-primary font-mono text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text-secondary">Headers</label>
              <button
                onClick={addHeader}
                className="text-xs text-accent-text hover:text-accent-hover transition-colors"
              >
                + Add Header
              </button>
            </div>
            {headers.length > 0 ? (
              <div className="space-y-2">
                {headers.map((header, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={header.key}
                      onChange={(e) => updateHeader(index, 'key', e.target.value)}
                      placeholder="Header name"
                      className="flex-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent"
                    />
                    <input
                      type="password"
                      value={header.value}
                      onChange={(e) => updateHeader(index, 'value', e.target.value)}
                      placeholder="Value"
                      className="flex-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={() => removeHeader(index)}
                      className="p-2 hover:bg-red-500/10 rounded-lg text-text-muted hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">No headers configured</p>
            )}
          </div>

          <button
            onClick={handleTest}
            disabled={testing || !url}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-bg-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors text-text-secondary disabled:opacity-50"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Testing connection...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Test Connection</span>
              </>
            )}
          </button>

          {testResult && (
            <div className={`p-3 rounded-lg border ${
              testResult.success 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {testResult.success ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
                <span className={`text-sm ${testResult.success ? 'text-green-200' : 'text-red-200'}`}>
                  {testResult.message}
                </span>
              </div>
              {testResult.tools && testResult.tools.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-text-muted">Discovered tools:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {testResult.tools.map(tool => (
                      <div key={tool.name} className="text-xs text-text-secondary font-mono">
                        • {tool.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{editingConnection ? 'Save Changes' : 'Add Server'}</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * MCP Servers Page - Manage custom MCP server connections
 */
export default function McpServersPage() {
  const { 
    connections, 
    loading, 
    error,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    discoverTools,
    toggleConnection,
    refetch,
  } = useMcpConnections();

  const [showModal, setShowModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState<McpConnection | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deleteConfirmConnection, setDeleteConfirmConnection] = useState<McpConnection | null>(null);

  const handleCreate = () => {
    setEditingConnection(null);
    setShowModal(true);
  };

  const handleEdit = (connection: McpConnection) => {
    setEditingConnection(connection);
    setShowModal(true);
  };

  const handleSave = async (data: CreateMcpConnectionData) => {
    if (editingConnection) {
      await updateConnection(editingConnection.connectionId, data);
    } else {
      await createConnection(data);
    }
  };

  const handleDelete = (connection: McpConnection) => {
    setDeleteConfirmConnection(connection);
  };

  const confirmDeleteConnection = async () => {
    if (deleteConfirmConnection) {
      await deleteConnection(deleteConfirmConnection.connectionId);
      setDeleteConfirmConnection(null);
    }
  };

  const handleTest = async (connectionId: string) => {
    setLoadingId(connectionId);
    try {
      await testConnection(connectionId);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDiscover = async (connectionId: string) => {
    setLoadingId(connectionId);
    try {
      await discoverTools(connectionId);
    } finally {
      setLoadingId(null);
    }
  };

  const handleToggle = async (connectionId: string) => {
    setLoadingId(connectionId);
    try {
      await toggleConnection(connectionId);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="h-app bg-bg-primary flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-bg-elevated border-b border-border px-4 py-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/connections"
                className="p-2 hover:bg-bg-secondary rounded-lg transition-colors"
                title="Back to Connections"
              >
                <ArrowLeft className="w-5 h-5 text-text-secondary" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-text-primary">MCP Servers</h1>
                <p className="text-sm text-text-muted">Connect external MCP servers to add custom tools</p>
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Server</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 pb-scroll-safe">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
              <p className="text-text-secondary">Loading connections...</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg mb-6">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <p className="font-medium text-red-200">Failed to load connections</p>
                <p className="text-sm text-red-300 mt-1">{error}</p>
                <button
                  onClick={refetch}
                  className="mt-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {!loading && !error && connections.length === 0 && (
            <motion.div
              variants={pageVariants}
              initial="initial"
              animate="animate"
              className="text-center py-20"
            >
              <Server className="w-16 h-16 text-text-disabled mx-auto mb-4" />
              <h3 className="text-lg font-medium text-text-primary mb-2">No MCP Servers</h3>
              <p className="text-text-secondary mb-6 max-w-md mx-auto">
                Connect external MCP servers to add custom tools for your workflows.
              </p>
              <button
                onClick={handleCreate}
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Add Your First Server</span>
              </button>
            </motion.div>
          )}

          {!loading && !error && connections.length > 0 && (
            <motion.div
              variants={pageVariants}
              initial="initial"
              animate="animate"
              className="space-y-4"
            >
              {connections.map(connection => (
                <ConnectionCard
                  key={connection.connectionId}
                  connection={connection}
                  onEdit={() => handleEdit(connection)}
                  onDelete={() => handleDelete(connection)}
                  onTest={() => handleTest(connection.connectionId)}
                  onDiscover={() => handleDiscover(connection.connectionId)}
                  onToggle={() => handleToggle(connection.connectionId)}
                  isLoading={loadingId === connection.connectionId}
                />
              ))}
            </motion.div>
          )}
        </div>
      </div>

      <ConnectionModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingConnection(null);
        }}
        onSave={handleSave}
        editingConnection={editingConnection}
      />

      <ConfirmModal
        isOpen={!!deleteConfirmConnection}
        onClose={() => setDeleteConfirmConnection(null)}
        onConfirm={confirmDeleteConnection}
        title="Delete MCP Server"
        message={`Delete "${deleteConfirmConnection?.name}"? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
