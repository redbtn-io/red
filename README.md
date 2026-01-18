# Red AI Web Application

A Next.js web application that provides a chat interface, Studio UI, Automations, and Knowledge Libraries for the Red AI system.

**Version**: 2.1  
**Last Updated**: December 2025  
**Build Status**: ✅ Compiles successfully

## Overview

This is the web frontend for Red AI, built with Next.js 15, React 19, and Tailwind CSS 4. It provides a modern chat interface with **stream reconnection** support, a **Studio UI** for visual graph editing, **Automations** for scheduled workflows, and **Knowledge Libraries** for RAG-powered document storage and search.

### Key Features

- 📱 **Mobile-Friendly Streaming**: Responses continue generating even when the user switches apps
- 🔄 **Automatic Reconnection**: SSE streams reconnect seamlessly and deliver accumulated content
- 📦 **Redis Pub/Sub**: Real-time message delivery with persistent state
- 💾 **MongoDB Persistence**: Complete conversation history stored permanently
- ⚡ **Server-Sent Events**: Efficient streaming with native browser support
- 🎨 **Smooth UX**: Character-by-character display with skeleton animation during generation
- 🛠️ **Studio UI**: Visual graph editor with drag-and-drop canvas, state manager, and live preview
- ⚙️ **Automations**: Schedule and run workflow graphs on cron triggers or manual invocation
- 📊 **Dashboard**: Home page with quick stats, recent chats, and automation runs
- 📚 **Knowledge Libraries**: Upload, organize, and search documents with RAG integration
- 🗄️ **Archive System**: Soft-delete resources with restore capability

## Studio UI Features

The Studio provides a visual graph editor for creating AI workflows:

### Graph Editor
- **Drag-and-Drop Canvas**: Add nodes from the palette, connect them visually
- **ReactFlow Integration**: Smooth panning, zooming, and node manipulation
- **Graph Types**: 
  - **Agent** (purple): Interactive chat graphs requiring user input
  - **Workflow** (cyan): Headless graphs for automations
- **Node Palette**: Browse available nodes by category (RAG, Communication, Execution, etc.)
- **Config Panel**: Edit node parameters, prompts, and connections

### State Manager
- **Tree View**: Visualize the nested state object flowing between nodes
- **Read/Write Indicators**: See which nodes read or write each field
- **Type Display**: Shows object `{}`, array `[]`, string, number, boolean types
- **Click to Select**: Click node names to select them on the canvas
- **Infrastructure Toggle**: Show/hide system fields (memory, MCP client, etc.)

### Nodes, Neurons, Graphs
- **Nodes**: Reusable processing units (router, planner, executor, search, respond, etc.)
- **Neurons**: AI model configurations with provider/model/temperature settings
- **Graphs**: Complete workflows combining nodes with conditional routing

## Workspace Layout & Shared Tooling

This app lives beside the LangGraph library in the same workspace:

- `ai/` – LangGraph-based library, MCP servers, shared types
- `webapp/` – this Next.js frontend and API surface
- `scripts/` – shared automation such as `pre-commit-cleanup.sh`
- `explanations/` – single home for every markdown document that is not a README

When contributing to the webapp you often need to rebuild or relink the sibling `ai/` package and keep documentation hygiene consistent between both projects.

## Documentation Cleanup & Git Hooks

All non-README `.md` files should live under `/explanations`. A shared script enforces that policy and removes stray `explanations/` or `scripts/` folders inside individual projects.

```bash
# From the workspace root
./scripts/pre-commit-cleanup.sh ./webapp
```

To run this automatically before each commit inside the `webapp` repo, point Git to the local hook directory (one-time per clone):

```bash
git config core.hooksPath .githooks
```

The hook simply proxies to the shared script with the project path, so CI or manual workflows can reuse the same command. You can run the script manually anytime you touch documentation.

## Getting Started

### Prerequisites

- Node.js 18+ 
- The `@redbtn/ai` module (installed from local package)

### Installation

1. **Install the @redbtn/ai module** (from the parent ai folder):

```bash
# In the ai folder, build and pack the module
cd ../ai
npm install
npm run build
npm pack

# This creates: redbtn-ai-0.0.1.tgz
```

2. **Install webapp dependencies**:

```bash
cd ../webapp
npm install
```

This will automatically install the `@redbtn/ai` module from the local tarball specified in `package.json`.

### Environment Variables

Create a `.env.local` file in the webapp root:

```env
# Required
REDIS_URL=redis://localhost:6379
MONGODB_URI=mongodb://username:password@localhost:27017/red-ai

# Optional
LLM_URL=http://localhost:11434
VECTOR_DB_URL=http://localhost:8200
```

**Note**: MongoDB authentication is required. See `ai/src/lib/memory/database.ts` for connection details.

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Building for Production

```bash
npm run build
npm start
```

## Updating the @redbtn/ai Module

When you make changes to the ai module, you need to rebuild and reinstall it:

```bash
# In the ai folder
cd ../ai
npm run build
npm pack

# Back in the webapp folder
cd ../webapp
npm install
```

Alternatively, for faster iteration during development, you can use `npm link`:

```bash
# In the ai folder
cd ../ai
npm run build
npm link

# In the webapp folder
cd ../webapp
npm link @redbtn/ai
```

With `npm link`, changes to the ai module will be reflected immediately (after rebuilding with `npm run build` in the ai folder).

## Project Structure

```
webapp/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── api/                # API routes
│   │   │   ├── health/         # Health check endpoint
│   │   │   ├── auth/           # Authentication endpoints
│   │   │   └── v1/             # OpenAI-compatible API endpoints
│   │   │       ├── automations/        # Automation CRUD + triggers
│   │   │       ├── chat/completions/   # Chat completions
│   │   │       ├── conversations/      # Conversation management
│   │   │       ├── dashboard/          # Dashboard stats
│   │   │       ├── generations/        # Generation tracking
│   │   │       ├── graphs/             # Graph templates
│   │   │       ├── libraries/          # Knowledge libraries
│   │   │       ├── logs/               # Log streaming
│   │   │       ├── messages/           # Message streaming
│   │   │       ├── models/             # Model discovery
│   │   │       ├── neurons/            # Neuron configs
│   │   │       ├── nodes/              # Node configs
│   │   │       ├── user/               # User preferences
│   │   │       └── README.md           # API documentation (v2.1)
│   │   ├── (chat)/             # Chat interface pages
│   │   ├── logs/               # Logging dashboard
│   │   ├── automations/        # Automations UI
│   │   ├── settings/           # User settings UI
│   │   ├── studio/             # Studio UI
│   │   │   ├── (browse)/       # Browse nodes/neurons/graphs
│   │   │   │   ├── nodes/
│   │   │   │   ├── neurons/
│   │   │   │   └── graphs/
│   │   │   ├── components/     # Studio components
│   │   │   │   ├── Canvas.tsx          # ReactFlow canvas
│   │   │   │   ├── NodePalette.tsx     # Node category browser
│   │   │   │   ├── ConfigPanel.tsx     # Node configuration
│   │   │   │   ├── GraphHeader.tsx     # Graph toolbar
│   │   │   │   ├── StateManager.tsx    # State tree visualization
│   │   │   │   └── nodes/              # Custom node components
│   │   │   ├── [graphId]/      # Edit existing graph
│   │   │   ├── new/            # Create new graph
│   │   │   ├── create-node/    # Create new node
│   │   │   ├── create-neuron/  # Create new neuron
│   │   │   └── edit-node/      # Edit existing node
│   │   ├── page.tsx            # Main home/chat interface
│   │   ├── layout.tsx          # Root layout
│   │   └── globals.css         # Global styles
│   ├── components/             # Shared React components
│   └── lib/                    # Utilities
│       ├── red.ts              # Red AI initialization
│       ├── stores/             # Zustand stores
│       │   └── graphStore.ts   # Graph editor state
│       ├── mongodb.ts          # Database connection
│       └── mongo-models.ts     # Mongoose schemas
├── public/                     # Static assets
└── package.json
```

## API Endpoints

The webapp exposes OpenAI-compatible API endpoints. See `src/app/api/README.md` for complete documentation.

### Authentication
- `POST /api/auth/request-code` - Request magic link email
- `GET /api/auth/check-session` - Check session status
- `POST /api/auth/complete-profile` - Complete user profile
- `POST /api/auth/logout` - End session

### Chat Completion (Decoupled Generation)
- `POST /api/v1/chat/completions` - Start generation, returns `messageId` + `stream_url` immediately
  - Generation continues in background
  - Returns JSON: `{ messageId, stream_url, conversationId }`
  - Supports `x-execution-mode` header to select graph

### Stream Reconnection
- `GET /api/v1/messages/:messageId/stream` - SSE endpoint for reconnectable streaming
  - Sends accumulated content first (from Redis)
  - Then streams new chunks via Redis pub/sub
  - Supports multiple concurrent subscribers
  - Events: `{type: 'content'|'complete'|'error', content?, metadata?, error?}`

### Conversation Management
- `GET /api/v1/conversations` - List conversations
- `POST /api/v1/conversations` - Create conversation
- `GET /api/v1/conversations/:id` - Get conversation details
- `PATCH /api/v1/conversations/:id` - Update conversation
- `DELETE /api/v1/conversations/:id` - Delete conversation
- `GET /api/v1/conversations/:id/messages` - Get message history

### Dashboard
- `GET /api/v1/dashboard` - Get quick stats, recent chats, recent automation runs

### Automations
- `GET /api/v1/automations` - List automations
- `POST /api/v1/automations` - Create automation
- `GET /api/v1/automations/:id` - Get automation details
- `PATCH /api/v1/automations/:id` - Update automation
- `DELETE /api/v1/automations/:id` - Delete automation
- `POST /api/v1/automations/:id/trigger` - Manually trigger automation
- `GET /api/v1/automations/:id/runs` - Get run history

### Studio APIs

#### Nodes
- `GET /api/v1/nodes` - List node configurations
- `POST /api/v1/nodes` - Create node
- `GET /api/v1/nodes/:id` - Get node
- `PATCH /api/v1/nodes/:id` - Update node
- `DELETE /api/v1/nodes/:id` - Delete node
- `POST /api/v1/nodes/:id/archive` - Archive node (soft delete)
- `POST /api/v1/nodes/:id/restore` - Restore archived node

#### Neurons
- `GET /api/v1/neurons` - List neuron configurations
- `POST /api/v1/neurons` - Create neuron
- `GET /api/v1/neurons/:id` - Get neuron
- `PATCH /api/v1/neurons/:id` - Update neuron
- `DELETE /api/v1/neurons/:id` - Delete neuron
- `POST /api/v1/neurons/:id/archive` - Archive neuron
- `POST /api/v1/neurons/:id/restore` - Restore neuron

#### Graphs
- `GET /api/v1/graphs` - List graph templates
- `POST /api/v1/graphs` - Create graph
- `GET /api/v1/graphs/:id` - Get graph (includes `graphType: 'agent' | 'workflow'`)
- `PATCH /api/v1/graphs/:id` - Update graph
- `DELETE /api/v1/graphs/:id` - Delete graph
- `POST /api/v1/graphs/:id/fork` - Fork system graph

#### User Preferences
- `GET /api/v1/user/preferences` - Get all preferences
- `POST /api/v1/user/preferences` - Set preference
- `DELETE /api/v1/user/preferences` - Delete preference(s)

### Models
- `GET /api/v1/models` - List available models
- `GET /api/v1/models/:id` - Get model details

### OAuth 2.0
- `POST /api/v1/oauth/clients` - Create OAuth client
- `GET /api/v1/oauth/authorize` - Authorization endpoint
- `POST /api/v1/oauth/token` - Token exchange
- `POST /api/v1/oauth/introspect` - Token introspection
- `POST /api/v1/oauth/revoke` - Revoke token

### Health
- `GET /api/health` - Health check

---

## 🛠️ Studio UI

The Studio UI provides a visual interface for managing AI configurations.

### Nodes (`/nodes`)
Configure processing nodes that make up workflow graphs:
- **Router**: Routes messages to appropriate processing paths
- **Planner**: Creates multi-step execution plans
- **Executor**: Executes planned actions
- **Search**: Web search and information retrieval
- **Summarizer**: Content summarization
- **Context**: Context management
- **Optimizer**: Response optimization
- **Error Handler**: Error handling and recovery

### Neurons (`/neurons`)
Manage AI model configurations:
- Configure LLM endpoints and models
- Set temperature, max tokens, and other parameters
- Tier-based access control (free, pro, enterprise)
- Archive/restore capability

### Graphs (`/graphs`)
Create and manage workflow templates:
- **red-assistant**: Full-featured assistant with tools
- **red-chat**: Simple chat without tools
- Fork system graphs to create custom versions
- Visual node and edge configuration

### Archive System
All Studio resources support soft-delete:
- **Archive**: Hides resource from active lists
- **Restore**: Brings archived resource back
- **Delete**: Permanently removes resource
- Archived resources can be viewed with `?includeArchived=true`

---

## � Knowledge Libraries

Knowledge Libraries provide a RAG (Retrieval-Augmented Generation) system for document storage, organization, and semantic search.

### Overview (`/knowledge`)
- Create and manage document libraries
- Upload files with drag-and-drop support
- View documents and their processed chunks
- Search across all libraries

### Supported File Types
- **Text**: Markdown (`.md`), plain text (`.txt`), JSON, YAML
- **Documents**: PDF (with text extraction)
- **Images**: PNG, JPG, JPEG, GIF, WebP (with OCR processing)

### Document Processing Pipeline
1. **Upload**: Files are stored in MongoDB GridFS
2. **Text Extraction**: Content extracted based on file type
3. **OCR** (images): Tesseract.js extracts text from images
4. **Chunking**: Content split into semantic chunks
5. **Embedding**: Chunks vectorized and stored in ChromaDB
6. **Indexing**: Ready for semantic search

### Using Knowledge in AI Responses
Libraries integrate with the graph system via MCP tools:

```json
{
  "type": "tool",
  "config": {
    "toolName": "search_library",
    "parameters": {
      "libraryId": "lib_abc123",
      "query": "{{state.data.query.message}}",
      "userId": "{{state.data.options.userId}}"
    },
    "outputField": "data.knowledgeContext"
  }
}
```

### Available MCP Tools
- `list_libraries` - List accessible libraries for a user
- `search_library` - Search within a specific library
- `search_all_libraries` - Search across all user's libraries  
- `get_library_info` - Get library metadata and document count

### API Endpoints
See `/api/v1/libraries/*` in the [API documentation](src/app/api/README.md#knowledge-libraries).

---

## �🔄 Stream Reconnection Architecture

### Problem Solved

Mobile apps lose responses when users switch away because HTTP connections break. Traditional streaming ties generation to the connection, so disconnection = lost response.

### Solution: Decoupled Generation + Redis Pub/Sub

#### 1. **Client POSTs to `/api/v1/chat/completions`**
```json
{
  "conversationId": "conv_123",
  "message": "Tell me about quantum computing"
}
```

#### 2. **Server responds immediately** (doesn't wait for generation)
```json
{
  "messageId": "msg_456",
  "stream_url": "/api/v1/messages/msg_456/stream",
  "conversationId": "conv_123"
}
```

#### 3. **Server starts background generation**
- Calls `red.run(...)` in a fire-and-forget async function
- Each token/chunk is:
  - Appended to Redis state: `message:generating:msg_456`
  - Published to pub/sub channel: `message:stream:msg_456`

#### 4. **Client opens SSE stream** to `stream_url`
```javascript
const eventSource = new EventSource(stream_url);
eventSource.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.type === 'content') {
    displayChunk(data.content);
  } else if (data.type === 'complete') {
    console.log('Done!');
  }
};
```

#### 5. **Stream endpoint behavior**
- **First**: Sends all accumulated content from Redis (for reconnecting clients)
- **Then**: Subscribes to pub/sub channel and streams new chunks in real-time
- **Finally**: Sends `{type: 'complete'}` when generation finishes

#### 6. **Client disconnects** (app switch, network drop, etc.)
- SSE connection closes
- **Generation continues** in background
- Redis keeps accumulating chunks

#### 7. **Client reconnects** (opens same `stream_url` again)
- Gets all accumulated content immediately
- Subscribes to pub/sub for any remaining chunks
- User sees complete response with no gaps

### Benefits

✅ **No lost messages**: Generation is independent of connection  
✅ **Instant reconnection**: Accumulated content delivered immediately  
✅ **Mobile-friendly**: Works with aggressive app suspension  
✅ **Multiple clients**: Multiple devices can subscribe to same messageId  
✅ **Clean error handling**: No "Controller is already closed" errors  
✅ **Tool call support**: Works with web search/scraping (no tokens for seconds)  

### Data Flow Diagram

```
Client                    Server (Next.js)              Redis              LLM
  |                              |                         |                 |
  |--- POST /completions ------->|                         |                 |
  |                              |                         |                 |
  |<-- {messageId, stream_url} --|                         |                 |
  |                              |                         |                 |
  |                              |------ Start Gen ------->|                 |
  |                              |        (background)     |                 |
  |                              |                         |                 |
  |--- GET /stream/msg_456 ----->|                         |                 |
  |                              |-- Get existing content -|                 |
  |<==== Accumulated chunks =====|                         |                 |
  |                              |--- Subscribe pub/sub ---|                 |
  |                              |                         |                 |
  |                              |                         |<-- chunk -------|  
  |<==== New chunk ==============|<== PUBLISH =============|                 |
  |                              |                         |                 |
  |  ** USER SWITCHES AWAY **    |                         |                 |
  |  (connection closed)         |                         |                 |
  X                              |                         |                 |
                                 |                         |<-- chunk -------|  
                                 |                         | (still going!)  |
                                 |                         |<-- chunk -------|  
                                 |                         |                 |
  |  ** USER RETURNS **          |                         |                 |
  |--- GET /stream/msg_456 ----->|                         |                 |
  |                              |-- Get full content -----|                 |
  |<==== ALL accumulated ========|                         |                 |
  |<==== Final chunks ===========|<== PUBLISH =============|<-- done --------|  
  |                              |                         |                 |
  |<==== {type: 'complete'} =====|                         |                 |
  |                              |                         |                 |
```

### Implementation Details

**Frontend** (`src/app/page.tsx`):
```typescript
// Send message and get messageId
const { messageId, stream_url } = await sendMessage(message);

// Stream the response (can be called multiple times for reconnection)
await streamMessage(conversationId, messageId, stream_url);
```

**Backend** (`src/app/api/v1/chat/completions/route.ts`):
```typescript
// Return immediately
const messageId = generateMessageId();
const stream_url = `/api/v1/messages/${messageId}/stream`;

// Start generation in background (fire-and-forget)
generateInBackground(messageId, conversationId, query);

return Response.json({ messageId, stream_url, conversationId });
```

**Stream Endpoint** (`src/app/api/v1/messages/[messageId]/stream/route.ts`):
```typescript
const messageStream = messageQueue.subscribeToMessage(messageId);

for await (const event of messageStream) {
  if (event.type === 'init' && event.existingContent) {
    // Send accumulated content in chunks
    sendChunks(event.existingContent);
  } else if (event.type === 'chunk') {
    // Stream new chunk from pub/sub
    sendChunk(event.content);
  } else if (event.type === 'complete') {
    // Send completion event
    sendComplete();
    break;
  }
}
```

**MessageQueue** (`@redbtn/ai/src/lib/memory/queue.ts`):
```typescript
// Append and publish
async appendContent(messageId: string, chunk: string) {
  // Update Redis state
  await redis.set(`message:generating:${messageId}`, content);
  
  // Publish to subscribers
  await redis.publish(`message:stream:${messageId}`, 
    JSON.stringify({ type: 'chunk', content: chunk })
  );
}

// Subscribe with accumulated content
async *subscribeToMessage(messageId: string) {
  // First, yield existing content
  const state = await getMessageState(messageId);
  if (state.content) {
    yield { type: 'init', existingContent: state.content };
  }
  
  // Then subscribe to new chunks
  const subscriber = redis.duplicate();
  await subscriber.subscribe(`message:stream:${messageId}`);
  
  for await (const message of subscriber) {
    yield JSON.parse(message);
  }
}
```

### Testing

Run the automated tests to verify reconnection:

```bash
# Simple streaming test
node test-simple.js

# Tool call test (web search with delayed tokens)
node test-tool-call.js
```

Both tests simulate:
1. Starting a generation
2. Opening the stream
3. Reading a few chunks
4. Closing the connection (simulating app switch)
5. Waiting for generation to continue
6. Reconnecting
7. Verifying full content was received

---

## Features

- 💬 **Real-time streaming chat** with SSE and Redis pub/sub
- 🔄 **Stream reconnection** - responses survive app switching and network drops
- 🎨 **Modern, responsive design** with Tailwind CSS 4
- � **Persistent storage** - MongoDB for complete conversation history
- 🔍 **Web search & scraping** - built-in tools for real-time information
- 📝 **Markdown rendering** in chat messages
- 🏷️ **Auto-generated titles** for conversations
- 🧠 **Executive summaries** for quick context retrieval (3+ messages)
- 🌐 **OpenAI-compatible API** for integration with other tools
- ⚡ **Next.js 15** with React Server Components and Turbopack

## Deployment

### Vercel (Recommended)

```bash
vercel deploy
```

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- AWS Lambda (via Serverless Framework)
- Cloudflare Pages
- Docker containers
- Traditional Node.js hosting

See the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Red AI Library](../ai/README.md)
- [Red AI Deployment Guide](../ai/DEPLOYMENT.md)

## License

ISC