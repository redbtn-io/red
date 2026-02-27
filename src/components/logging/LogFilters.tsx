/**
 * LogFilters - Sidebar filters for log viewer
 */
'use client';

interface LogFiltersProps {
  conversationId: string;
  setConversationId: (id: string) => void;
  generationId: string;
  setGenerationId: (id: string) => void;
  filterLevel: string;
  setFilterLevel: (level: string) => void;
  filterCategory: string;
  setFilterCategory: (category: string) => void;
  showThoughts: boolean;
  setShowThoughts: (show: boolean) => void;
}

export function LogFilters({
  conversationId,
  setConversationId,
  generationId,
  setGenerationId,
  filterLevel,
  setFilterLevel,
  filterCategory,
  setFilterCategory,
  showThoughts,
  setShowThoughts,
}: LogFiltersProps) {
  return (
    <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-4">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Filters</h2>

      {/* Conversation ID */}
      <div>
        <label className="block text-sm font-medium text-text-primary opacity-70 mb-2">
          Conversation ID
        </label>
        <input
          type="text"
          value={conversationId}
          onChange={(e) => {
            setConversationId(e.target.value);
            setGenerationId(''); // Clear generation when conversation changes
          }}
          placeholder="conv_..."
          className="w-full px-3 py-2 bg-bg-primary border border-border rounded text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {/* Generation ID */}
      <div>
        <label className="block text-sm font-medium text-text-primary opacity-70 mb-2">
          Generation ID
        </label>
        <input
          type="text"
          value={generationId}
          onChange={(e) => {
            setGenerationId(e.target.value);
            setConversationId(''); // Clear conversation when generation is set
          }}
          placeholder="gen_..."
          className="w-full px-3 py-2 bg-bg-primary border border-border rounded text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="border-t border-border pt-4"></div>

      {/* Level Filter */}
      <div>
        <label className="block text-sm font-medium text-text-primary opacity-70 mb-2">
          Log Level
        </label>
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="w-full px-3 py-2 bg-bg-primary border border-border rounded text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="all">All Levels</option>
          <option value="debug">🐛 Debug</option>
          <option value="info">ℹ️ Info</option>
          <option value="success">✅ Success</option>
          <option value="warning">⚠️ Warning</option>
          <option value="error">❌ Error</option>
        </select>
      </div>

      {/* Category Filter */}
      <div>
        <label className="block text-sm font-medium text-text-primary opacity-70 mb-2">
          Category
        </label>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="w-full px-3 py-2 bg-bg-primary border border-border rounded text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="all">All Categories</option>
          <option value="generation">🔄 Generation</option>
          <option value="router">🧭 Router</option>
          <option value="tool">🔧 Tool</option>
          <option value="chat">💬 Chat</option>
          <option value="thought">💭 Thought</option>
        </select>
      </div>

      {/* Show Thoughts Toggle */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showThoughts}
            onChange={(e) => setShowThoughts(e.target.checked)}
            className="w-4 h-4 rounded border-border bg-bg-primary text-accent focus:ring-2 focus:ring-accent"
          />
          <span className="text-sm text-text-primary opacity-70">
            💭 Show Thoughts
          </span>
        </label>
        <p className="text-xs text-text-primary opacity-50 mt-1 ml-6">
          Internal reasoning from AI nodes
        </p>
      </div>

      {/* Quick Actions */}
      <div className="border-t border-border pt-4 space-y-2">
        <button
          onClick={() => {
            setFilterLevel('all');
            setFilterCategory('all');
            setShowThoughts(true);
          }}
          className="w-full px-3 py-2 bg-bg-primary hover:bg-bg-elevated text-sm text-text-primary opacity-70 hover:opacity-100 rounded transition-all"
        >
          Reset Filters
        </button>
        <button
          onClick={() => {
            setConversationId('');
            setGenerationId('');
          }}
          className="w-full px-3 py-2 bg-bg-primary hover:bg-bg-elevated text-sm text-text-primary opacity-70 hover:opacity-100 rounded transition-all"
        >
          Clear IDs
        </button>
      </div>
    </div>
  );
}
