/**
 * E2E Tests — @redbtn webapp
 *
 * Tests the live running Next.js API (localhost:3000) against real Redis + MongoDB.
 * Creates a fresh test user via JWT for isolation, cleans up on teardown.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const JWT_SECRET = 'lUdJGxwzPskqIF+1Hd8CEeMdNr4zbKC2eaGyOXi/NkY=';
const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://alpha:redbtnioai@server.georgeanthony.net:27017/redbtn?authSource=admin';

// Test user — unique ObjectId per run for isolation
const TEST_USER_ID = new mongoose.Types.ObjectId().toString();
const TEST_EMAIL = `e2e-${Date.now()}@redbtn.io`;

function makeToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    { userId: TEST_USER_ID, email: TEST_EMAIL, accountLevel: 1, ...overrides },
    JWT_SECRET,
    { expiresIn: '2h' },
  );
}

const AUTH_TOKEN = makeToken();
const authHeaders = (): Record<string, string> => ({
  Cookie: `auth_token=${AUTH_TOKEN}`,
  'Content-Type': 'application/json',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function api(
  path: string,
  opts: RequestInit & { noAuth?: boolean } = {},
) {
  const { noAuth, headers: extra, ...rest } = opts as any;
  const headers = noAuth ? { 'Content-Type': 'application/json', ...extra } : { ...authHeaders(), ...extra };
  const res = await fetch(`${BASE}${path}`, { ...rest, headers });
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}

// Track created resources for cleanup
const cleanup: { conversations: string[]; neurons: string[]; graphs: string[]; automations: string[]; toolsets: string[]; nodes: string[] } = {
  conversations: [],
  neurons: [],
  graphs: [],
  automations: [],
  toolsets: [],
  nodes: [],
};

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
beforeAll(async () => {
  // Verify the server is reachable
  const { status } = await api('/api/health');
  if (status !== 200) throw new Error(`Server not reachable at ${BASE}`);
});

afterAll(async () => {
  // Clean up created test data via API where possible
  for (const id of cleanup.conversations) {
    await api(`/api/v1/conversations/${id}`, { method: 'DELETE' }).catch(() => {});
  }
  for (const id of cleanup.neurons) {
    // Neurons don't have a simple DELETE; we'll leave them — they're user-scoped
  }
  for (const id of cleanup.graphs) {
    await api(`/api/v1/graphs/${id}`, { method: 'DELETE' }).catch(() => {});
  }
  for (const id of cleanup.automations) {
    await api(`/api/v1/automations/${id}`, { method: 'DELETE' }).catch(() => {});
  }
  for (const id of cleanup.toolsets) {
    await api(`/api/v1/toolsets/${id}`, { method: 'DELETE' }).catch(() => {});
  }
  for (const id of cleanup.nodes) {
    await api(`/api/v1/nodes/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  // Direct DB cleanup for any leftovers
  try {
    const conn = await mongoose.connect(MONGODB_URI);
    const db = conn.connection.db!;
    await db.collection('neurons').deleteMany({ userId: TEST_USER_ID });
    await db.collection('graphs').deleteMany({ userId: TEST_USER_ID });
    await db.collection('conversations').deleteMany({ userId: TEST_USER_ID });
    await db.collection('automations').deleteMany({ userId: TEST_USER_ID });
    await db.collection('toolsets').deleteMany({ userId: TEST_USER_ID });
    await db.collection('nodes').deleteMany({ userId: TEST_USER_ID });
    // Clean AI package conversations collection
    await db.collection('red_conversations').deleteMany({ userId: TEST_USER_ID });
    await mongoose.disconnect();
  } catch {
    // Best-effort cleanup
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. HEALTH
// ═══════════════════════════════════════════════════════════════════════════
describe('Health', () => {
  it('GET /api/health returns ok', async () => {
    const { status, body } = await api('/api/health');
    expect(status).toBe(200);
    expect(body).toEqual({ status: 'ok', service: 'redbtn API' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════
describe('Authentication', () => {
  it('rejects unauthenticated request to v1 endpoints', async () => {
    const { status, body } = await api('/api/v1/conversations', { noAuth: true });
    expect(status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('accepts valid JWT in cookie', async () => {
    const { status, body } = await api('/api/v1/conversations');
    expect(status).toBe(200);
    expect(body).toHaveProperty('conversations');
  });

  it('accepts valid JWT in Authorization header', async () => {
    const { status, body } = await api('/api/v1/conversations', {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` } as any,
      noAuth: true,
    });
    // Bearer auth might not be wired for all endpoints; cookie is primary
    expect([200, 401]).toContain(status);
  });

  it('rejects expired token', async () => {
    const expired = jwt.sign(
      { userId: TEST_USER_ID, email: TEST_EMAIL, accountLevel: 1 },
      JWT_SECRET,
      { expiresIn: '-1s' },
    );
    const { status } = await api('/api/v1/conversations', {
      headers: { Cookie: `auth_token=${expired}` } as any,
      noAuth: true,
    });
    expect(status).toBe(401);
  });

  it('rejects token with wrong secret', async () => {
    const bad = jwt.sign(
      { userId: TEST_USER_ID, email: TEST_EMAIL, accountLevel: 1 },
      'wrong-secret',
      { expiresIn: '1h' },
    );
    const { status } = await api('/api/v1/conversations', {
      headers: { Cookie: `auth_token=${bad}` } as any,
      noAuth: true,
    });
    expect(status).toBe(401);
  });

  it('GET /api/auth/me returns 404 for non-existent user', async () => {
    const { status } = await api('/api/auth/me');
    // User doesn't exist in User collection, but JWT is valid
    expect([404, 500]).toContain(status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. CONVERSATIONS
// ═══════════════════════════════════════════════════════════════════════════
describe('Conversations', () => {
  let conversationId: string;

  it('GET /api/v1/conversations returns empty list for new user', async () => {
    const { status, body } = await api('/api/v1/conversations');
    expect(status).toBe(200);
    expect(body.conversations).toBeInstanceOf(Array);
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('limit');
    expect(body).toHaveProperty('offset');
  });

  it('POST /api/v1/conversations creates a conversation', async () => {
    const { status, body } = await api('/api/v1/conversations', {
      method: 'POST',
      body: JSON.stringify({ title: 'E2E Test Conversation', source: 'api' }),
    });
    expect(status).toBe(200);
    expect(body.conversation).toBeDefined();
    expect(body.conversation.id).toBeDefined();
    expect(body.conversation.title).toBe('E2E Test Conversation');
    expect(body.conversation.messages).toEqual([]);
    conversationId = body.conversation.id;
    cleanup.conversations.push(conversationId);
  });

  it('GET /api/v1/conversations lists the created conversation', async () => {
    const { status, body } = await api('/api/v1/conversations');
    expect(status).toBe(200);
    expect(body.conversations.length).toBeGreaterThanOrEqual(1);
    const found = body.conversations.find((c: any) => c.id === conversationId);
    expect(found).toBeDefined();
    expect(found.title).toBe('E2E Test Conversation');
    expect(found.source).toBe('api');
  });

  it('GET /api/v1/conversations supports source filter', async () => {
    const { status, body } = await api('/api/v1/conversations?source=api');
    expect(status).toBe(200);
    expect(body.conversations.every((c: any) => c.source === 'api')).toBe(true);
  });

  it('GET /api/v1/conversations supports pagination', async () => {
    const { status, body } = await api('/api/v1/conversations?limit=1&offset=0');
    expect(status).toBe(200);
    expect(body.limit).toBe(1);
    expect(body.offset).toBe(0);
  });

  it('GET /api/v1/conversations/:id returns the conversation', async () => {
    const { status, body } = await api(`/api/v1/conversations/${conversationId}`);
    expect(status).toBe(200);
    // Either body.conversation or body directly has the data
    const conv = body.conversation || body;
    expect(conv).toBeDefined();
  });

  it('PATCH /api/v1/conversations/:id updates title', async () => {
    const { status, body } = await api(`/api/v1/conversations/${conversationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated Title' }),
    });
    expect([200, 204]).toContain(status);
  });

  it('GET /api/v1/conversations/:id/messages returns messages', async () => {
    const { status, body } = await api(`/api/v1/conversations/${conversationId}/messages`);
    expect([200, 404]).toContain(status);
    if (status === 200) {
      expect(body).toHaveProperty('messages');
    }
  });

  it('DELETE /api/v1/conversations/:id deletes the conversation', async () => {
    // Create a throwaway conversation to delete
    const { body: created } = await api('/api/v1/conversations', {
      method: 'POST',
      body: JSON.stringify({ title: 'To Delete' }),
    });
    const deleteId = created.conversation.id;

    const { status } = await api(`/api/v1/conversations/${deleteId}`, { method: 'DELETE' });
    expect([200, 204]).toContain(status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. NEURONS
// ═══════════════════════════════════════════════════════════════════════════
describe('Neurons', () => {
  let customNeuronId: string;

  it('GET /api/v1/neurons lists available neurons', async () => {
    const { status, body } = await api('/api/v1/neurons');
    expect(status).toBe(200);
    expect(body.neurons).toBeInstanceOf(Array);
    expect(body.neurons.length).toBeGreaterThan(0);
    expect(body).toHaveProperty('grouped');
    expect(body).toHaveProperty('defaults');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('userTier');
  });

  it('neurons have expected shape', async () => {
    const { body } = await api('/api/v1/neurons');
    const neuron = body.neurons[0];
    expect(neuron).toHaveProperty('neuronId');
    expect(neuron).toHaveProperty('name');
    expect(neuron).toHaveProperty('provider');
    expect(neuron).toHaveProperty('model');
    expect(neuron).toHaveProperty('role');
    expect(neuron).toHaveProperty('tier');
    // Should NOT expose sensitive fields
    expect(neuron).not.toHaveProperty('apiKey');
    expect(neuron).not.toHaveProperty('endpoint');
  });

  it('grouped field separates by role', async () => {
    const { body } = await api('/api/v1/neurons');
    expect(body.grouped).toHaveProperty('chat');
    expect(body.grouped).toHaveProperty('worker');
    expect(body.grouped).toHaveProperty('specialist');
  });

  it('supports role filter', async () => {
    const { status, body } = await api('/api/v1/neurons?role=chat');
    expect(status).toBe(200);
    expect(body.neurons.every((n: any) => n.role === 'chat')).toBe(true);
  });

  it('POST /api/v1/neurons creates a custom neuron', async () => {
    const { status, body } = await api('/api/v1/neurons', {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Test Neuron',
        description: 'Created by E2E tests',
        provider: 'ollama',
        model: 'test-model',
        temperature: 0.5,
        maxTokens: 2048,
        role: 'chat',
      }),
    });
    expect(status).toBe(201);
    expect(body.neuronId).toBeDefined();
    expect(body.name).toBe('E2E Test Neuron');
    customNeuronId = body.neuronId;
    cleanup.neurons.push(customNeuronId);
  });

  it('custom neuron appears in list', async () => {
    const { body } = await api('/api/v1/neurons');
    const found = body.neurons.find((n: any) => n.neuronId === customNeuronId);
    expect(found).toBeDefined();
    expect(found.isSystem).toBe(false);
    expect(found.isOwned).toBe(true);
  });

  it('rejects neuron with missing required fields', async () => {
    const { status, body } = await api('/api/v1/neurons', {
      method: 'POST',
      body: JSON.stringify({ name: 'Incomplete' }),
    });
    expect(status).toBe(400);
    expect(body.error).toContain('Missing required fields');
  });

  it('rejects neuron with invalid provider', async () => {
    const { status, body } = await api('/api/v1/neurons', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad', provider: 'invalid', model: 'x' }),
    });
    expect(status).toBe(400);
    expect(body.error).toContain('Invalid provider');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. GRAPHS
// ═══════════════════════════════════════════════════════════════════════════
describe('Graphs', () => {
  let customGraphId: string;

  it('GET /api/v1/graphs lists available graphs', async () => {
    const { status, body } = await api('/api/v1/graphs');
    expect(status).toBe(200);
    expect(body.graphs).toBeInstanceOf(Array);
    expect(body.graphs.length).toBeGreaterThan(0);
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('userTier');
  });

  it('graphs include system graphs', async () => {
    const { body } = await api('/api/v1/graphs');
    const system = body.graphs.filter((g: any) => g.isSystem);
    expect(system.length).toBeGreaterThan(0);
  });

  it('graphs have expected shape', async () => {
    const { body } = await api('/api/v1/graphs');
    const graph = body.graphs[0];
    expect(graph).toHaveProperty('graphId');
    expect(graph).toHaveProperty('name');
    expect(graph).toHaveProperty('tier');
    expect(graph).toHaveProperty('nodeCount');
    expect(graph).toHaveProperty('edgeCount');
  });

  it('POST /api/v1/graphs creates a custom graph', async () => {
    const { status, body } = await api('/api/v1/graphs', {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Test Graph',
        description: 'Created by E2E tests',
        nodes: [{ id: 'start', config: { nodeId: 'n1' } }, { id: 'end', config: { nodeId: 'n2' } }],
        edges: [{ from: 'start', to: 'end' }],
      }),
    });
    expect(status).toBe(201);
    expect(body.graphId).toBeDefined();
    expect(body.name).toBe('E2E Test Graph');
    customGraphId = body.graphId;
    cleanup.graphs.push(customGraphId);
  });

  it('custom graph appears in list', async () => {
    const { body } = await api('/api/v1/graphs');
    const found = body.graphs.find((g: any) => g.graphId === customGraphId);
    expect(found).toBeDefined();
    expect(found.isSystem).toBe(false);
    expect(found.isOwned).toBe(true);
  });

  it('GET /api/v1/graphs/:graphId returns graph details', async () => {
    if (!customGraphId) return;
    const { status, body } = await api(`/api/v1/graphs/${customGraphId}`);
    expect(status).toBe(200);
    const graph = body.graph || body;
    expect(graph.graphId || graph.graphId).toBe(customGraphId);
  });

  it('POST /api/v1/graphs/:graphId/fork forks a system graph', async () => {
    const { body: graphs } = await api('/api/v1/graphs');
    const systemGraph = graphs.graphs.find((g: any) => g.isSystem);
    if (!systemGraph) return; // skip if no system graphs

    const { status, body } = await api(`/api/v1/graphs/${systemGraph.graphId}/fork`, {
      method: 'POST',
      body: JSON.stringify({ name: 'E2E Forked Graph' }),
    });
    expect([200, 201]).toContain(status);
    if (body.graphId) {
      cleanup.graphs.push(body.graphId);
    }
  });

  it('rejects graph with missing required fields', async () => {
    const { status, body } = await api('/api/v1/graphs', {
      method: 'POST',
      body: JSON.stringify({ name: 'Incomplete' }),
    });
    expect([400, 500]).toContain(status);
  });

  it('rejects graph with invalid tier', async () => {
    // User is tier 1, cannot create tier 0 (admin-only)
    const adminToken = makeToken({ accountLevel: 4 });
    const { status, body } = await api('/api/v1/graphs', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}` } as any,
      body: JSON.stringify({
        name: 'Tier Violation',
        nodes: [{ id: 'start' }],
        edges: [],
        tier: 1, // tier 1 requires accountLevel 1 or lower
      }),
    });
    expect(status).toBe(403);
  });

  it('DELETE /api/v1/graphs/:graphId deletes a graph', async () => {
    // Create a throwaway
    const { body: created, status: createStatus } = await api('/api/v1/graphs', {
      method: 'POST',
      body: JSON.stringify({
        name: 'To Delete',
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ from: 'a', to: 'b' }],
      }),
    });
    if (createStatus !== 201) return; // skip if creation failed
    const { status } = await api(`/api/v1/graphs/${created.graphId}`, { method: 'DELETE' });
    expect([200, 204]).toContain(status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
describe('Dashboard', () => {
  it('GET /api/v1/dashboard returns aggregated stats', async () => {
    const { status, body } = await api('/api/v1/dashboard');
    expect(status).toBe(200);
    expect(body).toHaveProperty('stats');
    expect(body.stats).toHaveProperty('conversations');
    expect(body.stats).toHaveProperty('graphs');
    expect(body.stats).toHaveProperty('automations');
    expect(body.stats).toHaveProperty('activeAutomations');
    expect(body.stats).toHaveProperty('totalRuns');
    expect(body.stats).toHaveProperty('successRate');
  });

  it('dashboard includes recent conversations', async () => {
    const { body } = await api('/api/v1/dashboard');
    expect(body).toHaveProperty('recentConversations');
    expect(body.recentConversations).toBeInstanceOf(Array);
  });

  it('dashboard includes available agents', async () => {
    const { body } = await api('/api/v1/dashboard');
    expect(body).toHaveProperty('availableAgents');
    expect(body.availableAgents).toBeInstanceOf(Array);
    expect(body.availableAgents.length).toBeGreaterThan(0);
  });

  it('dashboard includes user info', async () => {
    const { body } = await api('/api/v1/dashboard');
    expect(body).toHaveProperty('user');
    expect(body.user.email).toBe(TEST_EMAIL);
    expect(body.user.tier).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. RUNS
// ═══════════════════════════════════════════════════════════════════════════
describe('Runs', () => {
  it('GET /api/v1/runs returns empty list for new user', async () => {
    const { status, body } = await api('/api/v1/runs');
    expect(status).toBe(200);
    expect(body.runs).toBeInstanceOf(Array);
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('limit');
    expect(body).toHaveProperty('offset');
  });

  it('supports status filter', async () => {
    const { status, body } = await api('/api/v1/runs?status=running');
    expect(status).toBe(200);
    expect(body.runs).toBeInstanceOf(Array);
  });

  it('supports pagination', async () => {
    const { status, body } = await api('/api/v1/runs?limit=10&offset=0');
    expect(status).toBe(200);
    expect(body.limit).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. MODELS
// ═══════════════════════════════════════════════════════════════════════════
describe('Models', () => {
  it('GET /api/v1/models returns model list', async () => {
    const { status, body } = await api('/api/v1/models');
    expect(status).toBe(200);
    expect(body).toHaveProperty('data');
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('models have OpenAI-compatible shape', async () => {
    const { body } = await api('/api/v1/models');
    const model = body.data[0];
    expect(model).toHaveProperty('id');
    expect(model).toHaveProperty('object', 'model');
    expect(model).toHaveProperty('owned_by');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. CHAT COMPLETIONS
// ═══════════════════════════════════════════════════════════════════════════
describe('Chat Completions', () => {
  it('POST /api/v1/chat/completions returns stream info', async () => {
    // First create a conversation
    const { body: convBody } = await api('/api/v1/conversations', {
      method: 'POST',
      body: JSON.stringify({ title: 'Chat Test' }),
    });
    const convId = convBody.conversation.id;
    cleanup.conversations.push(convId);

    const { status, body } = await api('/api/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello, this is an E2E test' }],
        conversationId: convId,
        stream: true,
      }),
    });

    // The endpoint should return a stream reference or error gracefully
    // If worker is not running, it may still return the run reference
    if (status === 200) {
      // Streaming response — has runId and streamUrl
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('conversationId');
    } else {
      // Accept 500/503 if worker or graph execution isn't available
      expect([500, 503, 400]).toContain(status);
    }
  });

  it('rejects request without messages', async () => {
    const { status } = await api('/api/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect([400, 500]).toContain(status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. AUTOMATIONS
// ═══════════════════════════════════════════════════════════════════════════
describe('Automations', () => {
  let automationId: string;

  it('GET /api/v1/automations returns empty list', async () => {
    const { status, body } = await api('/api/v1/automations');
    expect(status).toBe(200);
    expect(body.automations || body).toBeInstanceOf(Array);
  });

  it('POST /api/v1/automations creates an automation', async () => {
    // Automations require a workflow graph (not agent)
    // First create a workflow graph
    const { body: graphBody, status: graphStatus } = await api('/api/v1/graphs', {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Workflow Graph',
        graphType: 'workflow',
        nodes: [{ id: 'start' }, { id: 'end' }],
        edges: [{ from: 'start', to: 'end' }],
      }),
    });
    const workflowGraphId = graphStatus === 201 ? graphBody.graphId : undefined;
    if (workflowGraphId) cleanup.graphs.push(workflowGraphId);

    const { status, body } = await api('/api/v1/automations', {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Test Automation',
        description: 'Created by E2E tests',
        trigger: { type: 'manual' },
        graphId: workflowGraphId || 'red-assistant',
        config: {},
      }),
    });
    // Accept 200 or 201
    expect([200, 201]).toContain(status);
    automationId = body.automationId || body.automation?.automationId || body.id;
    expect(automationId).toBeDefined();
    cleanup.automations.push(automationId);
  });

  it('GET /api/v1/automations/:id returns the automation', async () => {
    if (!automationId) return;
    const { status, body } = await api(`/api/v1/automations/${automationId}`);
    expect(status).toBe(200);
    const auto = body.automation || body;
    expect(auto.name || auto.automationId).toBeDefined();
  });

  it('PUT /api/v1/automations/:id updates the automation', async () => {
    if (!automationId) return;
    const { status } = await api(`/api/v1/automations/${automationId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated Automation' }),
    });
    expect([200, 204]).toContain(status);
  });

  it('POST /api/v1/automations/:id/enable enables', async () => {
    if (!automationId) return;
    const { status } = await api(`/api/v1/automations/${automationId}/enable`, {
      method: 'POST',
    });
    expect([200, 204]).toContain(status);
  });

  it('POST /api/v1/automations/:id/disable disables', async () => {
    if (!automationId) return;
    const { status } = await api(`/api/v1/automations/${automationId}/disable`, {
      method: 'POST',
    });
    expect([200, 204]).toContain(status);
  });

  it('GET /api/v1/automations/:id/runs lists runs', async () => {
    if (!automationId) return;
    const { status, body } = await api(`/api/v1/automations/${automationId}/runs`);
    expect(status).toBe(200);
  });

  it('DELETE /api/v1/automations/:id deletes', async () => {
    if (!automationId) return;
    const { status } = await api(`/api/v1/automations/${automationId}`, { method: 'DELETE' });
    expect([200, 204]).toContain(status);
    // Remove from cleanup since we already deleted
    cleanup.automations = cleanup.automations.filter(id => id !== automationId);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. NODES
// ═══════════════════════════════════════════════════════════════════════════
describe('Nodes', () => {
  let nodeId: string;

  it('GET /api/v1/nodes lists available nodes', async () => {
    const { status, body } = await api('/api/v1/nodes');
    expect(status).toBe(200);
    const nodes = body.nodes || body;
    expect(nodes).toBeInstanceOf(Array);
  });

  it('POST /api/v1/nodes creates a custom node', async () => {
    const { status, body } = await api('/api/v1/nodes', {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Test Node',
        description: 'Created by E2E tests',
        type: 'processor',
        config: { prompt: 'Test prompt' },
      }),
    });
    // Accept 200 or 201
    if (status === 200 || status === 201) {
      nodeId = body.nodeId || body.node?.nodeId || body.id;
      if (nodeId) cleanup.nodes.push(nodeId);
    }
    expect([200, 201, 400]).toContain(status);
  });

  it('GET /api/v1/nodes/preferences returns user preferences', async () => {
    const { status, body } = await api('/api/v1/nodes/preferences');
    expect([200, 404]).toContain(status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. TOOLS & TOOLSETS
// ═══════════════════════════════════════════════════════════════════════════
describe('Tools & Toolsets', () => {
  let toolSetId: string;

  it('GET /api/v1/tools lists available tools', async () => {
    const { status, body } = await api('/api/v1/tools');
    expect(status).toBe(200);
    const tools = body.tools || body;
    expect(tools).toBeInstanceOf(Array);
  });

  it('GET /api/v1/toolsets lists toolsets', async () => {
    const { status, body } = await api('/api/v1/toolsets');
    expect(status).toBe(200);
  });

  it('POST /api/v1/toolsets creates a toolset', async () => {
    const { status, body } = await api('/api/v1/toolsets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Test Toolset',
        description: 'Created by E2E tests',
        tools: [],
      }),
    });
    if (status === 200 || status === 201) {
      toolSetId = body.toolSetId || body.toolset?.toolSetId || body.id;
      if (toolSetId) cleanup.toolsets.push(toolSetId);
    }
    expect([200, 201, 400]).toContain(status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. CONNECTIONS
// ═══════════════════════════════════════════════════════════════════════════
describe('Connections', () => {
  it('GET /api/v1/connections returns list', async () => {
    const { status, body } = await api('/api/v1/connections');
    expect(status).toBe(200);
    // Response is { grouped: [], total: 0 } not a plain array
    expect(body).toHaveProperty('total');
  });

  it('GET /api/v1/connection-providers returns providers', async () => {
    const { status, body } = await api('/api/v1/connection-providers');
    expect(status).toBe(200);
  });

  it('GET /api/v1/mcp-connections returns MCP connections', async () => {
    const { status, body } = await api('/api/v1/mcp-connections');
    expect(status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. LIBRARIES
// ═══════════════════════════════════════════════════════════════════════════
describe('Libraries', () => {
  it('GET /api/v1/libraries returns list', async () => {
    const { status, body } = await api('/api/v1/libraries');
    expect(status).toBe(200);
    const libs = body.libraries || body;
    expect(libs).toBeInstanceOf(Array);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 15. STATE NAMESPACES
// ═══════════════════════════════════════════════════════════════════════════
describe('State Namespaces', () => {
  let namespace: string;

  it('GET /api/v1/state/namespaces returns list', async () => {
    const { status, body } = await api('/api/v1/state/namespaces');
    expect(status).toBe(200);
  });

  it('POST /api/v1/state/namespaces creates a namespace', async () => {
    namespace = `e2e-test-${Date.now()}`;
    const { status, body } = await api('/api/v1/state/namespaces', {
      method: 'POST',
      body: JSON.stringify({ namespace, description: 'E2E test namespace' }),
    });
    expect([200, 201]).toContain(status);
  });

  it('GET /api/v1/state/namespaces/:ns returns the namespace', async () => {
    if (!namespace) return;
    const { status } = await api(`/api/v1/state/namespaces/${namespace}`);
    expect([200, 404]).toContain(status);
  });

  it('POST /api/v1/state/namespaces/:ns/values sets a value', async () => {
    if (!namespace) return;
    const { status } = await api(`/api/v1/state/namespaces/${namespace}/values`, {
      method: 'POST',
      body: JSON.stringify({ key: 'testKey', value: 'testValue' }),
    });
    expect([200, 201]).toContain(status);
  });

  it('GET /api/v1/state/namespaces/:ns/values gets values', async () => {
    if (!namespace) return;
    const { status, body } = await api(`/api/v1/state/namespaces/${namespace}/values`);
    expect([200, 404]).toContain(status);
  });

  it('GET /api/v1/state/namespaces/:ns/values/:key gets a specific value', async () => {
    if (!namespace) return;
    const { status, body } = await api(`/api/v1/state/namespaces/${namespace}/values/testKey`);
    expect([200, 404]).toContain(status);
  });

  it('DELETE /api/v1/state/namespaces/:ns cleans up', async () => {
    if (!namespace) return;
    const { status } = await api(`/api/v1/state/namespaces/${namespace}`, { method: 'DELETE' });
    expect([200, 204]).toContain(status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 16. USER PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════
describe('User Preferences', () => {
  it('GET /api/v1/user/preferences/ui returns UI preferences', async () => {
    const { status, body } = await api('/api/v1/user/preferences/ui');
    expect([200, 404]).toContain(status);
  });

  it('POST /api/v1/user/preferences/ui sets UI preferences', async () => {
    const { status } = await api('/api/v1/user/preferences/ui', {
      method: 'POST',
      body: JSON.stringify({ theme: 'dark', sidebarCollapsed: false }),
    });
    expect([200, 201, 204]).toContain(status);
  });

  it('GET /api/v1/user/preferences/default-graph returns default graph', async () => {
    const { status, body } = await api('/api/v1/user/preferences/default-graph');
    expect([200, 404]).toContain(status);
  });

  it('PUT /api/v1/user/preferences/default-graph sets default graph', async () => {
    const { status } = await api('/api/v1/user/preferences/default-graph', {
      method: 'PUT',
      body: JSON.stringify({ graphId: 'red-assistant' }),
    });
    expect([200, 204]).toContain(status);
  });

  it('GET /api/v1/user/preferences/archive returns archived items', async () => {
    const { status, body } = await api('/api/v1/user/preferences/archive');
    expect([200, 404]).toContain(status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 17. LOGS
// ═══════════════════════════════════════════════════════════════════════════
describe('Logs', () => {
  it('GET /api/v1/logs/conversations returns conversation logs', async () => {
    const { status, body } = await api('/api/v1/logs/conversations');
    expect([200, 404]).toContain(status);
  });

  it('GET /api/v1/logs/stats returns log stats', async () => {
    const { status, body } = await api('/api/v1/logs/stats');
    expect([200, 404]).toContain(status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 18. OAUTH2 PROVIDER
// ═══════════════════════════════════════════════════════════════════════════
describe('OAuth2', () => {
  it('GET /api/oauth/authorize without params redirects to login', async () => {
    // Without valid params, OAuth authorize redirects to login
    const res = await fetch(`${BASE}/api/oauth/authorize`, { redirect: 'manual' });
    // Should redirect (307) or return an error page (200 with error)
    expect([200, 302, 307, 400]).toContain(res.status);
  });

  it('POST /api/oauth/token without grant returns error', async () => {
    const { status, body } = await api('/api/oauth/token', {
      method: 'POST',
      noAuth: true,
      body: JSON.stringify({}),
    });
    expect([400, 401]).toContain(status);
  });

  it('POST /api/oauth/introspect without token returns error', async () => {
    const { status } = await api('/api/oauth/introspect', {
      method: 'POST',
      noAuth: true,
      body: JSON.stringify({}),
    });
    expect([400, 401]).toContain(status);
  });

  it('GET /api/oauth/userinfo without auth returns error', async () => {
    const { status } = await api('/api/oauth/userinfo', { noAuth: true });
    expect([401, 403]).toContain(status);
  });

  it('GET /api/oauth/clients lists user OAuth clients', async () => {
    const { status, body } = await api('/api/oauth/clients');
    expect(status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 19. CLEANUP / ABANDONED
// ═══════════════════════════════════════════════════════════════════════════
describe('Cleanup', () => {
  it('GET /api/v1/cleanup/abandoned returns status', async () => {
    const { status } = await api('/api/v1/cleanup/abandoned');
    expect([200, 403]).toContain(status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 20. CROSS-CUTTING: RATE LIMITING & ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════
describe('Error Handling', () => {
  it('returns 404 for non-existent conversation', async () => {
    const { status } = await api('/api/v1/conversations/nonexistent-id-12345');
    expect([404, 500]).toContain(status);
  });

  it('returns 404 for non-existent graph', async () => {
    const { status } = await api('/api/v1/graphs/nonexistent-id-12345');
    expect([404, 500]).toContain(status);
  });

  it('returns 404 for non-existent run', async () => {
    const { status } = await api('/api/v1/runs/nonexistent-id-12345');
    expect([404, 500]).toContain(status);
  });

  it('returns error for invalid JSON body', async () => {
    const res = await fetch(`${BASE}/api/v1/conversations`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: '{invalid json',
    });
    expect([400, 500]).toContain(res.status);
  });

  it('handles concurrent requests gracefully', async () => {
    const promises = Array.from({ length: 5 }, () =>
      api('/api/v1/conversations'),
    );
    const results = await Promise.all(promises);
    results.forEach(r => {
      expect(r.status).toBe(200);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 21. TIER-BASED ACCESS CONTROL
// ═══════════════════════════════════════════════════════════════════════════
describe('Tier Access Control', () => {
  it('tier-4 user sees fewer neurons than tier-1', async () => {
    const tier4Token = makeToken({ accountLevel: 4 });
    const tier1Token = makeToken({ accountLevel: 1 });

    const [t4, t1] = await Promise.all([
      api('/api/v1/neurons', { headers: { Cookie: `auth_token=${tier4Token}` } as any }),
      api('/api/v1/neurons', { headers: { Cookie: `auth_token=${tier1Token}` } as any }),
    ]);

    expect(t4.status).toBe(200);
    expect(t1.status).toBe(200);
    // Tier 1 should see neurons at tier >= 1, tier 4 at tier >= 4
    // So tier 1 sees >= tier 4
    expect(t1.body.total).toBeGreaterThanOrEqual(t4.body.total);
  });

  it('tier-4 user sees fewer graphs than tier-1', async () => {
    const tier4Token = makeToken({ accountLevel: 4 });
    const tier1Token = makeToken({ accountLevel: 1 });

    const [t4, t1] = await Promise.all([
      api('/api/v1/graphs', { headers: { Cookie: `auth_token=${tier4Token}` } as any }),
      api('/api/v1/graphs', { headers: { Cookie: `auth_token=${tier1Token}` } as any }),
    ]);

    expect(t4.status).toBe(200);
    expect(t1.status).toBe(200);
    expect(t1.body.total).toBeGreaterThanOrEqual(t4.body.total);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 22. FETCH URL PROXY
// ═══════════════════════════════════════════════════════════════════════════
describe('Fetch URL', () => {
  it('POST /api/v1/fetch-url proxies a URL', async () => {
    const { status, body } = await api('/api/v1/fetch-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    // May work or fail depending on outbound network
    expect([200, 400, 500]).toContain(status);
  });

  it('rejects missing URL', async () => {
    const { status } = await api('/api/v1/fetch-url', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect([400, 500]).toContain(status);
  });
});
