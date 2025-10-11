# Dual Deployment Strategy

## Summary

You now have **two fully functional ways** to run Red AI:

### 1. Express Server (`examples/server.ts`)
```bash
npm run dev:server      # Development
npm run start:server    # Production
```

**Best for:**
- Local development
- OpenWebUI integration
- Self-hosted VPS deployment
- When you need `--think` mode (future)
- Full tiktoken support

### 2. Next.js WebApp (`webapp/`)
```bash
npm run dev:webapp      # Development
npm run build:webapp    # Build
npm run start:webapp    # Production
```

**Best for:**
- Serverless cloud deployment (Vercel, AWS Lambda)
- Auto-scaling production workloads
- When you want a built-in UI
- Global CDN distribution

## Architecture

Both share the same core library (`src/`):

```
@redbtn/ai/
├── src/                    ← SHARED CORE
│   ├── index.ts           Red class
│   ├── lib/
│   │   ├── memory.ts      Memory management
│   │   ├── tokenizer.ts   Token counting (with fallback)
│   │   ├── models.ts
│   │   ├── graphs/
│   │   └── nodes/
│
├── examples/
│   └── server.ts          ← EXPRESS SERVER
│
└── webapp/                ← NEXT.JS APP
    ├── src/app/api/       Serverless functions
    └── src/app/page.tsx   Chat UI
```

## Key Decisions Made

### Tiktoken Handling
- **Problem**: Next.js/Turbopack + tiktoken WebAssembly = incompatible
- **Solution**: Created `src/lib/tokenizer.ts` with fallback
  - Express server: Uses full tiktoken
  - Next.js: Falls back to character estimation (1 token ≈ 4 chars)
  - Accuracy: ±10-20% variance

### React Strict Mode
- **Disabled** in `webapp/next.config.ts` to prevent double execution
- Reduces console noise and API calls in development

### Shared Logic
- All helper functions in `webapp/src/lib/api-helpers.ts`
- Red singleton in `webapp/src/lib/red.ts`
- Conversation storage in `webapp/src/lib/conversation.ts`

## Benefits of This Approach

✅ **Flexibility**: Choose deployment strategy per use case
✅ **Code Reuse**: Both use same core library
✅ **Future-Proof**: Can maintain both independently
✅ **Think Mode**: Express server can add `--think` flag later
✅ **Serverless**: Next.js gives you cloud deployment option

## Quick Commands

```bash
# Express Server
npm run dev:server        # Local dev with hot reload
npm run start:server      # Production

# Next.js WebApp
npm run dev:webapp        # Local dev
npm run build:webapp      # Build
npm run start:webapp      # Production
```

## Environment Variables

Both need similar configs:

**Root `.env`** (for Express):
```env
REDIS_URL=redis://localhost:6379
LLM_URL=http://localhost:11434
BEARER_TOKEN=red_ai_sk_custom_token
PORT=3000
```

**`webapp/.env.local`** (for Next.js):
```env
REDIS_URL=redis://localhost:6379
LLM_URL=http://localhost:11434
```

## Documentation

- [DEPLOYMENT.md](../DEPLOYMENT.md) - Comprehensive deployment guide
- [README.md](../README.md) - Main project overview
- [examples/SERVER.md](../examples/SERVER.md) - Express server docs
- [webapp/README.md](./README.md) - Next.js webapp details

## Recommendation

**For now**:
1. Use Express server for local development and OpenWebUI
2. Keep Next.js ready for future cloud deployment

**Future**:
1. Deploy Express to your VPS for OpenWebUI
2. Deploy Next.js to Vercel for public web access
3. Add `--think` mode to Express server for autonomous operation

---

This gives you the best of both worlds! 🎉
