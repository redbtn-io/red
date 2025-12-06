import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import mongoose from 'mongoose';

/**
 * JSON Schema type for node configuration
 */
interface JSONSchema {
  type: string;
  title?: string;
  description?: string;
  properties?: Record<string, JSONSchema | JSONSchemaProperty>;
  items?: JSONSchema | JSONSchemaProperty;
  required?: string[];
  enum?: string[];
  minimum?: number;
  maximum?: number;
  default?: string | number | boolean;
}

interface JSONSchemaProperty {
  type: string;
  title?: string;
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  default?: string | number | boolean;
  items?: JSONSchema | JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

/**
 * Built-in node configuration schemas
 * These define what fields can be configured for each built-in node type
 */
const BUILTIN_NODE_SCHEMAS: Record<string, JSONSchema> = {
  router: {
    type: 'object',
    title: 'Router Configuration',
    properties: {
      systemPrompt: {
        type: 'string',
        title: 'System Prompt',
        description: 'Instructions for the router LLM',
        default: 'You are a routing classifier. Analyze the user message and determine the best path.'
      },
      routes: {
        type: 'array',
        title: 'Routes',
        description: 'Available routing destinations',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', title: 'Route Name' },
            description: { type: 'string', title: 'Description' },
            target: { type: 'string', title: 'Target Node ID' }
          },
          required: ['name', 'target']
        }
      },
      defaultRoute: {
        type: 'string',
        title: 'Default Route',
        description: 'Node to route to if no match found'
      }
    }
  },
  responder: {
    type: 'object',
    title: 'Responder Configuration',
    properties: {
      systemPrompt: {
        type: 'string',
        title: 'System Prompt',
        description: 'Base instructions for the responder',
        default: 'You are a helpful AI assistant.'
      },
      temperature: {
        type: 'number',
        title: 'Temperature',
        description: 'Creativity level (0.0-1.0)',
        minimum: 0,
        maximum: 1,
        default: 0.7
      },
      maxTokens: {
        type: 'number',
        title: 'Max Tokens',
        description: 'Maximum response length',
        minimum: 100,
        maximum: 32000,
        default: 4096
      },
      stream: {
        type: 'boolean',
        title: 'Stream Output',
        description: 'Stream response tokens in real-time',
        default: true
      }
    }
  },
  context: {
    type: 'object',
    title: 'Context Loader Configuration',
    properties: {
      maxTokens: {
        type: 'number',
        title: 'Max Context Tokens',
        description: 'Maximum tokens to load from history',
        minimum: 1000,
        maximum: 128000,
        default: 30000
      },
      includeSummary: {
        type: 'boolean',
        title: 'Include Summary',
        description: 'Include conversation summary if available',
        default: true
      },
      summaryType: {
        type: 'string',
        title: 'Summary Type',
        enum: ['none', 'trailing', 'full'],
        default: 'trailing'
      }
    }
  },
  planner: {
    type: 'object',
    title: 'Planner Configuration',
    properties: {
      maxSteps: {
        type: 'number',
        title: 'Max Steps',
        description: 'Maximum number of steps in a plan',
        minimum: 1,
        maximum: 20,
        default: 5
      },
      allowedTools: {
        type: 'array',
        title: 'Allowed Tools',
        description: 'Tools the planner can include in plans',
        items: { type: 'string' }
      }
    }
  },
  executor: {
    type: 'object',
    title: 'Executor Configuration',
    properties: {
      timeout: {
        type: 'number',
        title: 'Timeout (seconds)',
        description: 'Maximum execution time per step',
        minimum: 5,
        maximum: 300,
        default: 60
      },
      retryOnError: {
        type: 'boolean',
        title: 'Retry on Error',
        description: 'Retry failed steps automatically',
        default: true
      },
      maxRetries: {
        type: 'number',
        title: 'Max Retries',
        minimum: 0,
        maximum: 5,
        default: 2
      }
    }
  },
  search: {
    type: 'object',
    title: 'Search Configuration',
    properties: {
      maxResults: {
        type: 'number',
        title: 'Max Results',
        description: 'Number of search results to return',
        minimum: 1,
        maximum: 20,
        default: 5
      },
      searchType: {
        type: 'string',
        title: 'Search Type',
        enum: ['web', 'news', 'images'],
        default: 'web'
      }
    }
  },
  scrape: {
    type: 'object',
    title: 'Scrape Configuration',
    properties: {
      maxUrls: {
        type: 'number',
        title: 'Max URLs',
        description: 'Maximum URLs to scrape',
        minimum: 1,
        maximum: 10,
        default: 3
      },
      extractImages: {
        type: 'boolean',
        title: 'Extract Images',
        default: false
      },
      timeout: {
        type: 'number',
        title: 'Timeout (seconds)',
        minimum: 5,
        maximum: 60,
        default: 30
      }
    }
  },
  summarizer: {
    type: 'object',
    title: 'Summarizer Configuration',
    properties: {
      maxLength: {
        type: 'number',
        title: 'Max Summary Length',
        description: 'Target summary length in tokens',
        minimum: 50,
        maximum: 2000,
        default: 500
      },
      style: {
        type: 'string',
        title: 'Summary Style',
        enum: ['brief', 'detailed', 'bullet-points'],
        default: 'brief'
      }
    }
  },
  classifier: {
    type: 'object',
    title: 'Classifier Configuration',
    properties: {
      categories: {
        type: 'array',
        title: 'Categories',
        description: 'Classification categories',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' }
          },
          required: ['name']
        }
      },
      multiLabel: {
        type: 'boolean',
        title: 'Multi-Label',
        description: 'Allow multiple category assignments',
        default: false
      }
    }
  },
  universal: {
    type: 'object',
    title: 'Universal Node Configuration',
    properties: {
      configId: {
        type: 'string',
        title: 'Configuration ID',
        description: 'ID of the universal node config to use'
      }
    }
  }
};

/**
 * GET /api/v1/nodes/[nodeId]
 * Get detailed information and config schema for a specific node type
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Ensure database connection
    await connectToDatabase();

    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { nodeId } = await params;

    // Check MongoDB first - universal nodes take priority over built-in schemas
    const UniversalNodeConfig = mongoose.models.UniversalNodeConfig ||
      mongoose.model('UniversalNodeConfig', new mongoose.Schema({
        nodeId: String,
        name: String,
        description: String,
        category: String,
        userId: String,
        isSystem: Boolean,
        steps: [mongoose.Schema.Types.Mixed],
        metadata: mongoose.Schema.Types.Mixed
      }));

    const universalNode = await UniversalNodeConfig.findOne({
      nodeId,
      $or: [
        { isSystem: true },
        { userId: user.userId }
      ]
    }).lean();

    if (universalNode) {
      // Generate schema from steps
      interface UniversalNodeDocument {
        nodeId: string;
        name: string;
        description: string;
        category: string;
        steps: UniversalNodeStep[];
      }
      const typedNode = universalNode as unknown as UniversalNodeDocument;
      const stepSchemas = typedNode.steps?.map((step: UniversalNodeStep, index: number) => ({
        stepIndex: index,
        type: step.type,
        configurable: getConfigurableFieldsForStep(step)
      }));

      return NextResponse.json({
        nodeId,
        type: 'universal',
        name: typedNode.name,
        description: typedNode.description,
        category: typedNode.category,
        steps: stepSchemas,
        fullConfig: typedNode.steps,
        configurable: true
      }, { status: 200 });
    }

    // Fall back to built-in node type schemas (for nodes not in MongoDB)
    if (BUILTIN_NODE_SCHEMAS[nodeId]) {
      return NextResponse.json({
        nodeId,
        type: 'builtin',
        schema: BUILTIN_NODE_SCHEMAS[nodeId],
        configurable: true
      }, { status: 200 });
    }

    return NextResponse.json({ error: 'Node type not found' }, { status: 404 });

  } catch (error: unknown) {
    console.error('[API] Error getting node type:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}

interface UniversalNodeStep {
  type: 'neuron' | 'tool' | 'transform' | 'conditional' | 'loop';
  config: Record<string, unknown>;
}

/**
 * Get configurable fields for a universal node step
 */
function getConfigurableFieldsForStep(step: UniversalNodeStep): JSONSchema {
  switch (step.type) {
    case 'neuron':
      return {
        type: 'object',
        properties: {
          neuronId: { type: 'string', title: 'Neuron ID' },
          systemPrompt: { type: 'string', title: 'System Prompt' },
          userPrompt: { type: 'string', title: 'User Prompt' },
          temperature: { type: 'number', minimum: 0, maximum: 1 },
          maxTokens: { type: 'number', minimum: 100, maximum: 32000 },
          stream: { type: 'boolean' }
        }
      };
    case 'tool':
      return {
        type: 'object',
        properties: {
          toolName: { type: 'string', title: 'Tool Name' },
          parameters: { type: 'object', title: 'Parameters' }
        }
      };
    case 'transform':
      return {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['map', 'filter', 'select', 'parse-json', 'append', 'concat', 'set'] },
          inputField: { type: 'string' },
          outputField: { type: 'string' }
        }
      };
    case 'conditional':
      return {
        type: 'object',
        properties: {
          condition: { type: 'string', title: 'Condition Expression' },
          setField: { type: 'string' },
          trueValue: { type: 'string', title: 'True Value' },
          falseValue: { type: 'string', title: 'False Value' }
        }
      };
    default:
      return { type: 'object' };
  }
}
