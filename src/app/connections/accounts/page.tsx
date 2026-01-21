'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    Loader2,
    Link as LinkIcon, AlertCircle,
    Check,
    CheckCircle,
    RefreshCw,
    Trash2,
    Star, X,
    Plug,
    Layers,
    Activity,
    Shield, Search,
    Sparkles,
    Filter,
    ChevronRight,
    TrendingUp,
    Key,
    Zap,
    Database,
    Cloud,
    MessageSquare,
    Mail,
    CreditCard,
    Palette,
    Code,
    Music,
    Video,
    Image as ImageIcon,
} from 'lucide-react';
import Image from 'next/image';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { StudioHeader } from '@/components/layout/StudioHeader';
import {
    pageVariants,
    staggerContainerVariants,
    staggerItemVariants,
} from '@/lib/animations';

// =============================================================================
// Types
// =============================================================================

interface OAuthScope {
  name: string;
  description: string;
  required?: boolean;
  default?: boolean;
  // UI-friendly fields for scope selection
  displayName?: string;
  category?: string;
}

interface ConnectionProvider {
  _id: string;
  providerId: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  category?: string;
  tags?: string[];
  tier?: number;
  authType: 'oauth2' | 'api_key' | 'basic' | 'multi_credential' | 'custom';
  status: 'active' | 'deprecated' | 'disabled' | 'coming_soon';
  oauth2Config?: {
    scopes?: OAuthScope[];
  };
  apiKeyConfig?: {
    keyLabel?: string;
    instructions?: string;
  };
  basicAuthConfig?: {
    usernameLabel?: string;
    passwordLabel?: string;
    instructions?: string;
  };
}

interface UserConnection {
  _id: string;
  connectionId: string;
  providerId: string;
  label?: string;
  status: 'active' | 'expired' | 'revoked' | 'error' | 'pending';
  accountInfo?: {
    email?: string;
    name?: string;
    avatarUrl?: string;
  };
  isDefault: boolean;
  lastUsedAt?: string;
  lastValidatedAt?: string;
  createdAt: string;
}

interface ConnectionsByProvider {
  providerId: string;
  provider: ConnectionProvider;
  connections: UserConnection[];
}

// =============================================================================
// Component
// =============================================================================

export default function AccountsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<ConnectionsByProvider[]>([]);
  const [providers, setProviders] = useState<ConnectionProvider[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ConnectionProvider | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Handle OAuth callback query params
  useEffect(() => {
    const success = searchParams.get('success');
    const errorParam = searchParams.get('error');
    const provider = searchParams.get('provider');
    
    if (success === 'true') {
      setSuccessMessage(`Successfully connected${provider ? ` to ${provider}` : ''}!`);
      // Clear query params from URL
      router.replace('/connections/accounts', { scroll: false });
    } else if (errorParam) {
      setError(decodeURIComponent(errorParam));
      router.replace('/connections/accounts', { scroll: false });
    }
  }, [searchParams, router]);
  
  // Auto-dismiss success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  
  // Fetch connections and providers
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [connectionsRes, providersRes] = await Promise.all([
        fetch('/api/v1/connections'),
        fetch('/api/v1/connection-providers'),
      ]);
      
      if (connectionsRes.ok) {
        const data = await connectionsRes.json();
        setConnections(data.grouped || []);
      } else {
        throw new Error('Failed to fetch connections');
      }
      
      if (providersRes.ok) {
        const data = await providersRes.json();
        setProviders(data.providers || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Show OAuth scope selection modal
  const handleOAuthClick = (provider: ConnectionProvider) => {
    setSelectedProvider(provider);
    setShowOAuthModal(true);
  };

  // Handle OAuth connect with selected scopes
  const handleOAuthConnect = async (provider: ConnectionProvider, scopes?: string[]) => {
    try {
      const res = await fetch('/api/v1/connections/oauth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          providerId: provider.providerId,
          scopes: scopes,
        }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to initiate OAuth flow');
      }
      
      const { authorizationUrl } = await res.json();
      window.location.href = authorizationUrl;
    } catch (err) {
      console.error('OAuth connect error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  };
  
  // Handle validate connection
  const handleValidate = async (connectionId: string) => {
    try {
      setValidatingId(connectionId);
      const res = await fetch(`/api/v1/connections/${connectionId}/validate`, {
        method: 'POST',
      });
      
      if (res.ok) {
        await fetchData(); // Refresh to show updated status
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Validation failed');
      }
    } catch (err) {
      console.error('Validate error:', err);
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setValidatingId(null);
    }
  };
  
  // Handle delete connection
  const handleDelete = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this account?')) {
      return;
    }
    
    try {
      setDeletingId(connectionId);
      const res = await fetch(`/api/v1/connections/${connectionId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        await fetchData();
      } else {
        throw new Error('Failed to delete connection');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDeletingId(null);
    }
  };
  
  // Handle set as default
  const handleSetDefault = async (connectionId: string) => {
    try {
      const res = await fetch(`/api/v1/connections/${connectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Set default error:', err);
    }
  };
  
  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'expired': return 'bg-yellow-500/20 text-yellow-400';
      case 'revoked': return 'bg-gray-500/20 text-gray-400';
      case 'pending': return 'bg-blue-500/20 text-blue-400';
      case 'error': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };
  
  // Map of Lucide icon names to components
  const lucideIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    TrendingUp,
    Key,
    Zap,
    Database,
    Cloud,
    MessageSquare,
    Mail,
    CreditCard,
    Palette,
    Code,
    Music,
    Video,
    Image: ImageIcon,
    Plug,
    Shield,
    Activity,
  };
  
  // Get provider icon - supports URLs, Lucide icon names, or falls back to first letter
  const getProviderIcon = (provider: ConnectionProvider, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: { container: 'w-8 h-8', icon: 'w-5 h-5', text: 'text-sm' },
      md: { container: 'w-10 h-10', icon: 'w-6 h-6', text: 'text-lg' },
      lg: { container: 'w-12 h-12', icon: 'w-7 h-7', text: 'text-xl' },
    };
    const sizes = sizeClasses[size];
    
    // Check if it's a URL (http, https, or local path)
    if (provider.icon?.startsWith('http') || provider.icon?.startsWith('/')) {
      return (
        <div 
          className={`${sizes.container} rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden`}
          style={{ backgroundColor: provider.color || '#374151' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={provider.icon} 
            alt={provider.name} 
            className={`${sizes.icon} object-contain`}
            onError={(e) => {
              // On error, hide the image and show fallback
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      );
    }
    
    // Check if it's a Lucide icon name
    const LucideIcon = provider.icon ? lucideIcons[provider.icon] : null;
    if (LucideIcon) {
      return (
        <div 
          className={`${sizes.container} rounded-xl flex items-center justify-center text-white flex-shrink-0`}
          style={{ backgroundColor: provider.color || '#374151' }}
        >
          <LucideIcon className={sizes.icon} />
        </div>
      );
    }
    
    // Fallback to first letter
    return (
      <div 
        className={`${sizes.container} rounded-xl flex items-center justify-center text-white font-bold ${sizes.text} flex-shrink-0`}
        style={{ backgroundColor: provider.color || '#374151' }}
      >
        {provider.name.charAt(0)}
      </div>
    );
  };
  
  // Unconnected providers (for the "Add Connection" section)
  const connectedProviderIds = new Set(connections.map(c => c.providerId));
  const unconnectedProviders = providers.filter(p => !connectedProviderIds.has(p.providerId));
  
  // Filter unconnected providers by search and category
  const filteredProviders = unconnectedProviders.filter(p => {
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.tags && p.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });
  
  // Get popular providers (tier 1 or has 'popular' tag)
  const popularProviders = filteredProviders.filter(
    p => p.tier === 1 || (p.tags && p.tags.includes('popular'))
  );
  
  // Category display names - add new categories here as providers are added
  const categoryLabels: Record<string, string> = {
    'ai': 'AI & ML',
    'productivity': 'Productivity',
    'developer': 'Developer',
    'communication': 'Communication',
    'social': 'Social',
    'finance': 'Finance',
    'payments': 'Payments',
    'media': 'Media',
    'design': 'Design',
    'automation': 'Automation',
    'custom': 'Custom',
  };
  
  // Preferred category order (categories not in this list appear at the end alphabetically)
  const categoryOrder = Object.keys(categoryLabels);
  
  // Get available categories from unconnected providers, sorted by preferred order
  const availableCategories = Array.from(
    new Set(unconnectedProviders.map(p => p.category).filter(Boolean))
  ).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    // If both are in the order list, sort by that order
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    // If only one is in the list, it comes first
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    // Otherwise sort alphabetically
    return a.localeCompare(b);
  }) as string[];
  
  // Stats calculations
  const totalConnections = connections.reduce((sum, g) => sum + g.connections.length, 0);
  const activeConnections = connections.reduce(
    (sum, g) => sum + g.connections.filter(c => c.status === 'active').length, 0
  );
  const availableProviders = providers.length;
  const connectedProviderCount = connections.length;
  
  return (
    <div className="flex h-app bg-bg-primary overflow-hidden">
      {/* Sidebar */}
      <AppSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <StudioHeader
          title="Connected Accounts"
          subtitle="Manage your external service connections"
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <motion.div
            className="max-w-6xl mx-auto px-4 py-8 pb-scroll-safe"
            variants={pageVariants}
            initial="initial"
            animate="animate"
          >
            {/* Stats Overview */}
            <motion.div 
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="p-4 rounded-xl bg-bg-secondary">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/20">
                    <Plug className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-text-primary">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : totalConnections}
                    </div>
                    <div className="text-sm text-text-secondary">Connections</div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-bg-secondary">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/20">
                    <Activity className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-text-primary">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : activeConnections}
                    </div>
                    <div className="text-sm text-text-secondary">Active</div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-bg-secondary">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/20">
                    <Layers className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-text-primary">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : connectedProviderCount}
                    </div>
                    <div className="text-sm text-text-secondary">Providers</div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-bg-secondary">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/20">
                    <Shield className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-text-primary">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : availableProviders}
                    </div>
                    <div className="text-sm text-text-secondary">Available</div>
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Success Alert */}
            <AnimatePresence>
              {successMessage && (
                <motion.div
                  key="success-alert"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mb-6 p-4 rounded-xl bg-green-500/10 flex items-center gap-3"
                >
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <p className="text-green-400 font-medium">{successMessage}</p>
                  <button 
                    onClick={() => setSuccessMessage(null)}
                    className="ml-auto text-green-400 hover:text-green-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Error Alert */}
            <AnimatePresence>
              {error && (
                <motion.div
                  key="error-alert"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mb-6 p-4 rounded-xl bg-red-500/10 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium">Error</p>
                    <p className="text-red-400/80 text-sm">{error}</p>
                  </div>
                  <button 
                    onClick={() => setError(null)}
                    className="ml-auto text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Loading State */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
              </div>
            ) : (
              <>
                {/* Connected Accounts */}
                {connections.length > 0 && (
                  <section className="mb-10">
                    <h2 className="text-lg font-semibold text-text-primary mb-4">
                      Your Connections
                    </h2>
                    <motion.div 
                      className="space-y-4"
                      variants={staggerContainerVariants}
                    >
                      {connections.map((group) => (
                        <motion.div
                          key={group.providerId}
                          className="bg-bg-secondary rounded-xl overflow-hidden"
                          variants={staggerItemVariants}
                        >
                          {/* Provider Header */}
                          <div className="px-4 py-3 flex items-center gap-3 bg-bg-tertiary/50">
                            {getProviderIcon(group.provider)}
                            <div>
                              <h3 className="font-medium text-text-primary">
                                {group.provider.name}
                              </h3>
                              <p className="text-xs text-text-tertiary">
                                {group.connections.length} connection{group.connections.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                if (group.provider.authType === 'oauth2') {
                                  handleOAuthClick(group.provider);
                                } else {
                                  setSelectedProvider(group.provider);
                                  setShowAddModal(true);
                                }
                              }}
                              className="ml-auto p-2 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
                              title="Add another connection"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {/* Connections List */}
                          <div className="space-y-1 p-2">
                            {group.connections.map((conn) => (
                              <div
                                key={conn.connectionId}
                                className="px-3 py-3 flex items-center gap-4 rounded-lg hover:bg-bg-tertiary/50 transition-colors"
                              >
                                {/* Avatar */}
                                {conn.accountInfo?.avatarUrl ? (
                                  <img 
                                    src={conn.accountInfo.avatarUrl} 
                                    alt="" 
                                    className="w-10 h-10 rounded-full"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center">
                                    <LinkIcon className="w-5 h-5 text-text-tertiary" />
                                  </div>
                                )}
                                
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-text-primary truncate">
                                      {conn.label || conn.accountInfo?.name || conn.accountInfo?.email || 'Connected Account'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(conn.status)}`}>
                                      {conn.status}
                                    </span>
                                    {conn.accountInfo?.email && (
                                      <span className="text-text-tertiary truncate">
                                        {conn.accountInfo.email}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => !conn.isDefault && handleSetDefault(conn.connectionId)}
                                    className={`p-2 rounded transition-colors ${
                                      conn.isDefault 
                                        ? 'text-amber-400 cursor-default' 
                                        : 'text-text-tertiary hover:text-amber-400 hover:bg-bg-tertiary'
                                    }`}
                                    title={conn.isDefault ? 'Default connection' : 'Set as default'}
                                  >
                                    <Star className={`w-4 h-4 ${conn.isDefault ? 'fill-amber-400' : ''}`} />
                                  </button>
                                  <button
                                    onClick={() => handleValidate(conn.connectionId)}
                                    disabled={validatingId === conn.connectionId}
                                    className="p-2 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
                                    title="Validate connection"
                                  >
                                    {validatingId === conn.connectionId ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleDelete(conn.connectionId)}
                                    disabled={deletingId === conn.connectionId}
                                    className="p-2 rounded hover:bg-red-500/10 text-text-tertiary hover:text-red-400 transition-colors disabled:opacity-50"
                                    title="Disconnect"
                                  >
                                    {deletingId === conn.connectionId ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </section>
                )}
                
                {/* Add New Connection */}
                <section>
                  <h2 className="text-lg font-semibold text-text-primary mb-4">
                    {connections.length > 0 ? 'Add New Connection' : 'Connect a Service'}
                  </h2>
                  
                  {/* Search and Filter */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search providers..."
                        className="w-full pl-10 pr-4 py-2.5 bg-bg-secondary rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {/* Category Filter */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                          !selectedCategory
                            ? 'bg-accent text-white'
                            : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                        }`}
                      >
                        <Filter className="w-3.5 h-3.5" />
                        All
                      </button>
                      {availableCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                            selectedCategory === cat
                              ? 'bg-accent text-white'
                              : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                          }`}
                        >
                          {categoryLabels[cat] || cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Results count */}
                  {(searchQuery || selectedCategory) && (
                    <p className="text-sm text-text-tertiary mb-4">
                      {filteredProviders.length} provider{filteredProviders.length !== 1 ? 's' : ''} found
                      {searchQuery && ` for "${searchQuery}"`}
                      {selectedCategory && ` in ${categoryLabels[selectedCategory] || selectedCategory}`}
                    </p>
                  )}
                  
                  {/* Popular Providers Section */}
                  {!searchQuery && !selectedCategory && popularProviders.length > 0 && (
                    <div className="mb-8">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
                          Popular
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {popularProviders.slice(0, 6).map((provider) => {
                          const isComingSoon = provider.status === 'coming_soon';
                          return (
                            <button
                              key={provider.providerId}
                              onClick={() => {
                                if (isComingSoon) return;
                                if (provider.authType === 'oauth2') {
                                  handleOAuthClick(provider);
                                } else {
                                  setSelectedProvider(provider);
                                  setShowAddModal(true);
                                }
                              }}
                              disabled={isComingSoon}
                              className={`flex items-center gap-3 p-4 bg-bg-secondary rounded-xl transition-colors text-left group ${
                                isComingSoon 
                                  ? 'opacity-60 cursor-not-allowed' 
                                  : 'hover:bg-bg-tertiary'
                              }`}
                            >
                              {getProviderIcon(provider)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium transition-colors ${
                                    isComingSoon 
                                      ? 'text-text-secondary' 
                                      : 'text-text-primary group-hover:text-accent-primary'
                                  }`}>
                                    {provider.name}
                                  </span>
                                  {isComingSoon ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-text-tertiary/20 text-text-tertiary rounded">
                                      Soon
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded">
                                      <Sparkles className="w-3 h-3" />
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-text-tertiary truncate">
                                  {provider.description.length > 40 
                                    ? provider.description.substring(0, 40) + '...' 
                                    : provider.description}
                                </p>
                              </div>
                              {isComingSoon ? (
                                <span className="text-xs text-text-tertiary flex-shrink-0">Coming Soon</span>
                              ) : (
                                <Plus className="w-5 h-5 text-text-tertiary group-hover:text-accent-primary transition-colors flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Provider Categories - use dynamic categoryOrder */}
                  {categoryOrder.map((category) => {
                    const categoryProviders = filteredProviders.filter(p => p.category === category);
                    if (categoryProviders.length === 0) return null;
                    
                    // When a category is selected, show all; otherwise show max 4
                    const isExpanded = selectedCategory === category;
                    const displayProviders = isExpanded ? categoryProviders : categoryProviders.slice(0, 4);
                    const hasMore = categoryProviders.length > 4;
                    
                    return (
                      <div key={category} className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
                            {categoryLabels[category] || category}
                            <span className="ml-2 text-text-tertiary font-normal normal-case">({categoryProviders.length})</span>
                          </h3>
                          {hasMore && !isExpanded && (
                            <button
                              onClick={() => setSelectedCategory(category)}
                              className="flex items-center gap-1 text-sm text-accent-primary hover:text-accent-primary/80 transition-colors"
                            >
                              View all
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {displayProviders.map((provider) => {
                            const isComingSoon = provider.status === 'coming_soon';
                            return (
                              <button
                                key={provider.providerId}
                                onClick={() => {
                                  if (isComingSoon) return;
                                  if (provider.authType === 'oauth2') {
                                    handleOAuthClick(provider);
                                  } else {
                                    setSelectedProvider(provider);
                                    setShowAddModal(true);
                                  }
                                }}
                                disabled={isComingSoon}
                                className={`flex items-center gap-3 p-4 bg-bg-secondary rounded-xl transition-colors text-left group ${
                                  isComingSoon 
                                    ? 'opacity-60 cursor-not-allowed' 
                                    : 'hover:bg-bg-tertiary'
                                }`}
                              >
                                {getProviderIcon(provider)}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-medium transition-colors ${
                                      isComingSoon 
                                        ? 'text-text-secondary' 
                                        : 'text-text-primary group-hover:text-accent-primary'
                                    }`}>
                                      {provider.name}
                                    </span>
                                    {isComingSoon ? (
                                      <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-text-tertiary/20 text-text-tertiary rounded">
                                        Soon
                                      </span>
                                    ) : provider.tags?.includes('popular') ? (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded">
                                        <Sparkles className="w-2.5 h-2.5" />
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="text-sm text-text-tertiary truncate">
                                    {provider.description.length > 60 
                                      ? provider.description.substring(0, 60) + '...' 
                                      : provider.description}
                                  </p>
                                </div>
                                {isComingSoon ? (
                                  <span className="text-xs text-text-tertiary flex-shrink-0">Coming Soon</span>
                                ) : (
                                  <Plus className="w-5 h-5 text-text-tertiary group-hover:text-accent-primary transition-colors flex-shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* No results */}
                  {filteredProviders.length === 0 && (searchQuery || selectedCategory) && (
                    <div className="text-center py-12">
                      <Search className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-text-primary mb-2">No providers found</h3>
                      <p className="text-text-secondary mb-4">
                        Try adjusting your search or filter criteria
                      </p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCategory(null);
                        }}
                        className="text-accent-primary hover:text-accent-primary/80 font-medium"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </section>
              </>
            )}
          </motion.div>
        </main>
      </div>
      
      {/* Add Connection Modal (for API Key/Basic Auth) */}
      {showAddModal && selectedProvider && (
        <AddConnectionModal
          provider={selectedProvider}
          onClose={() => {
            setShowAddModal(false);
            setSelectedProvider(null);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            setSelectedProvider(null);
            fetchData();
          }}
        />
      )}

      {/* OAuth Scope Selection Modal */}
      {showOAuthModal && selectedProvider && (
        <OAuthScopeModal
          provider={selectedProvider}
          onClose={() => {
            setShowOAuthModal(false);
            setSelectedProvider(null);
          }}
          onConnect={(scopes) => {
            setShowOAuthModal(false);
            handleOAuthConnect(selectedProvider, scopes);
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Add Connection Modal (for API Key / Basic Auth)
// =============================================================================

function AddConnectionModal({
  provider,
  onClose,
  onSuccess,
}: {
  provider: ConnectionProvider;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError(null);
      
      const body: any = {
        providerId: provider.providerId,
        label: label || undefined,
      };
      
      if (provider.authType === 'api_key') {
        body.credentials = { apiKey };
      } else if (provider.authType === 'basic') {
        body.credentials = { username, password };
      }
      
      const res = await fetch('/api/v1/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to create connection');
      }
      
      onSuccess();
    } catch (err) {
      console.error('Create connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create connection');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        className="bg-bg-secondary border border-border rounded-xl w-full max-w-md mx-4 shadow-xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">
              Connect {provider.name}
            </h2>
          </div>
          
          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            {/* Instructions */}
            {(provider.apiKeyConfig?.instructions || provider.basicAuthConfig?.instructions) && (
              <div 
                className="text-sm text-text-secondary prose prose-invert prose-sm"
                dangerouslySetInnerHTML={{ 
                  __html: (provider.apiKeyConfig?.instructions || provider.basicAuthConfig?.instructions || '')
                    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-accent-primary hover:underline">$1</a>')
                }}
              />
            )}
            
            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Label (optional)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Production API"
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent"
              />
            </div>
            
            {/* API Key */}
            {provider.authType === 'api_key' && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {provider.apiKeyConfig?.keyLabel || 'API Key'}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent font-mono"
                />
              </div>
            )}
            
            {/* Basic Auth */}
            {provider.authType === 'basic' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    {provider.basicAuthConfig?.usernameLabel || 'Username'}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    {provider.basicAuthConfig?.passwordLabel || 'Password'}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent font-mono"
                  />
                </div>
              </>
            )}
            
            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Connect
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// =============================================================================
// OAuth Scope Selection Modal
// =============================================================================

// Google service definitions with their scopes
const GOOGLE_SERVICES: ServiceDefinition[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Email service',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
    ],
    required: false,
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Calendar and event management',
    scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    required: false,
  },
  {
    id: 'drive',
    name: 'Google Drive',
    description: 'File storage and management',
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
    ],
    required: false,
  },
  {
    id: 'sheets',
    name: 'Google Sheets',
    description: 'Spreadsheet management',
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
    required: false,
  },
];

interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  scopes: string[];
  required: boolean;
}

function OAuthScopeModal({
  provider,
  onClose,
  onConnect,
}: {
  provider: ConnectionProvider;
  onClose: () => void;
  onConnect: (scopes: string[]) => void;
}) {
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  
  // Get service definitions based on provider
  const getServiceDefinitions = (): ServiceDefinition[] => {
    if (provider.providerId === 'google') {
      return GOOGLE_SERVICES;
    }
    // For other providers, convert scopes to service-like structure
    const scopes = provider.oauth2Config?.scopes || [];
    return scopes.map(scope => ({
      id: scope.name,
      name: scope.displayName || scope.name.split('/').pop() || scope.name,
      description: scope.description,
      scopes: [scope.name],
      required: scope.required || false,
    }));
  };
  
  const services = getServiceDefinitions();
  
  const toggleService = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service?.required) return; // Can't toggle required
    
    const newSelected = new Set(selectedServices);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedServices(newSelected);
  };
  
  const handleConnect = () => {
    // Collect all scopes from selected services + required scopes
    const allScopes: string[] = ['email', 'profile']; // Always include basic scopes for Google
    
    services.forEach(service => {
      if (selectedServices.has(service.id) || service.required) {
        allScopes.push(...service.scopes);
      }
    });
    
    onConnect([...new Set(allScopes)]);
  };
  
  // Map of Lucide icon names to components
  const lucideIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    TrendingUp,
    Key,
    Zap,
    Database,
    Cloud,
    MessageSquare,
    Mail,
    CreditCard,
    Palette,
    Code,
    Music,
    Video,
    Image: ImageIcon,
    Plug,
    Shield,
    Activity,
  };
  
  // Get provider icon
  const getProviderIcon = () => {
    // Check if it's a URL
    if (provider.icon?.startsWith('http') || provider.icon?.startsWith('/')) {
      return (
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ backgroundColor: provider.color || '#374151' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={provider.icon} 
            alt={provider.name} 
            className="w-6 h-6 object-contain"
          />
        </div>
      );
    }
    
    // Check if it's a Lucide icon name
    const LucideIcon = provider.icon ? lucideIcons[provider.icon] : null;
    if (LucideIcon) {
      return (
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
          style={{ backgroundColor: provider.color || '#374151' }}
        >
          <LucideIcon className="w-6 h-6" />
        </div>
      );
    }
    
    // Fallback to first letter
    return (
      <div 
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
        style={{ backgroundColor: provider.color || '#374151' }}
      >
        {provider.name.charAt(0)}
      </div>
    );
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        className="bg-bg-secondary rounded-xl w-full max-w-md mx-4 shadow-xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-start gap-4">
          {getProviderIcon()}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-text-primary">
              Connect to {provider.name}
            </h2>
            <p className="text-sm text-text-secondary mt-0.5">
              Connect your {provider.name} account to access Gmail, Drive, Calendar, and more.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Services Selection */}
        <div className="px-6 pb-4">
          <h3 className="text-sm font-medium text-text-primary mb-2">
            Select Services to Enable
          </h3>
          <p className="text-xs text-text-tertiary mb-4">
            Choose which {provider.name} services you want to use in your automations:
          </p>
          
          <div className="space-y-2">
            {services.map((service) => {
              const isRequired = service.required;
              const isSelected = selectedServices.has(service.id) || isRequired;
              
              return (
                <button
                  key={service.id}
                  onClick={() => toggleService(service.id)}
                  disabled={isRequired}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                    isSelected
                      ? 'bg-accent/10'
                      : 'bg-bg-tertiary hover:bg-bg-tertiary/70'
                  } ${isRequired ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                    isSelected 
                      ? 'bg-accent' 
                      : 'bg-bg-primary'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-text-primary text-sm">
                      {service.name}
                      {isRequired && (
                        <span className="ml-2 text-xs text-text-tertiary">(Required)</span>
                      )}
                    </div>
                    <div className="text-xs text-text-tertiary">
                      {service.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium flex items-center gap-2"
          >
            Connect to {provider.name}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
