# Red AI Web Application

A Next.js web application that provides a chat interface for the Red AI system.

## Overview

This is the web frontend for Red AI, built with Next.js 15, React 19, and Tailwind CSS 4. It provides a modern chat interface with **stream reconnection** support, ensuring messages aren't lost when users switch apps or experience network interruptions.

### Key Features

- 📱 **Mobile-Friendly Streaming**: Responses continue generating even when the user switches apps
- 🔄 **Automatic Reconnection**: SSE streams reconnect seamlessly and deliver accumulated content
- 📦 **Redis Pub/Sub**: Real-time message delivery with persistent state
- 💾 **MongoDB Persistence**: Complete conversation history stored permanently
- ⚡ **Server-Sent Events**: Efficient streaming with native browser support
- 🎨 **Smooth UX**: Character-by-character display with skeleton animation during generation

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
│   ├── app/              # Next.js app directory
│   │   ├── api/          # API routes (serverless functions)
│   │   │   ├── health/   # Health check endpoint
│   │   │   └── v1/       # OpenAI-compatible API endpoints
│   │   │       ├── chat/
│   │   │       │   └── completions/
│   │   │       │       └── route.ts         # POST: Start generation, return messageId
│   │   │       ├── conversations/
│   │   │       │   └── [id]/
│   │   │       │       ├── messages/
│   │   │       │       │   └── route.ts     # GET: Message history
│   │   │       │       ├── status/
│   │   │       │       │   └── route.ts     # GET: Generating messages status
│   │   │       │       └── title/
│   │   │       │           └── route.ts     # GET: Conversation title
│   │   │       ├── messages/
│   │   │       │   └── [messageId]/
│   │   │       │       └── stream/
│   │   │       │           └── route.ts     # GET: SSE stream (reconnectable)
│   │   │       └── models/
│   │   │           └── route.ts         # GET: List models
│   │   ├── page.tsx      # Main chat interface
│   │   ├── layout.tsx    # Root layout
│   │   └── globals.css   # Global styles
│   ├── components/       # React components
│   │   ├── ChatInput.tsx
│   │   ├── Header.tsx
│   │   ├── Messages.tsx
│   │   ├── Modal.tsx
│   │   ├── SetVh.tsx
│   │   └── Sidebar.tsx
│   └── lib/             # Utilities
│       ├── red.ts        # Red AI initialization
│       ├── api-helpers.ts
│       └── conversation.ts
├── public/              # Static assets
├── test-simple.js       # Stream reconnection test (simple)
├── test-tool-call.js    # Stream reconnection test (with web search)
└── package.json
```

## API Endpoints

The webapp exposes OpenAI-compatible API endpoints:

### Chat Completion (Decoupled Generation)
- `POST /api/v1/chat/completions` - Start generation, returns `messageId` + `stream_url` immediately
  - Generation continues in background
  - Returns JSON: `{ messageId, stream_url, conversationId }`

### Stream Reconnection
- `GET /api/v1/messages/:messageId/stream` - SSE endpoint for reconnectable streaming
  - Sends accumulated content first (from Redis)
  - Then streams new chunks via Redis pub/sub
  - Supports multiple concurrent subscribers
  - Events: `{type: 'content'|'complete'|'error', content?, metadata?, error?}`

### Conversation Management
- `GET /api/v1/conversations/:id/messages` - Retrieve message history (from MongoDB)
- `GET /api/v1/conversations/:id/status` - Get generating message status
- `GET /api/v1/conversations/:id/title` - Get conversation title

### Models
- `GET /api/v1/models` - List available models
- `GET /api/v1/models/:id` - Get model details

### Health
- `GET /api/health` - Health check

---

## 🔄 Stream Reconnection Architecture

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
- Calls `red.respond(...)` in a fire-and-forget async function
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