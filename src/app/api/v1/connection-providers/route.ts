/**
 * Connection Providers API
 * 
 * GET /api/v1/connection-providers - List available providers
 * POST /api/v1/connection-providers - Create custom provider (admin or api_key type)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, isAdmin } from '@/lib/auth/auth';
import connectToDatabase from '@/lib/database/mongodb';
import { ConnectionProvider, type IConnectionProvider } from '@/lib/database/models/connections';
import { sanitizeProviderId, isValidProviderId, encryptValue } from '@/lib/connections';

export const dynamic = 'force-dynamic';

/**
 * GET - List available connection providers
 * 
 * Query params:
 * - category: Filter by category
 * - authType: Filter by auth type
 * - capability: Filter by capability
 * - status: Filter by status (default: active,beta)
 * - includeDisabled: Include disabled providers (admin only)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category');
  const authType = searchParams.get('authType');
  const capability = searchParams.get('capability');
  const statusParam = searchParams.get('status');
  const includeDisabled = searchParams.get('includeDisabled') === 'true' && isAdmin(user);

  try {
    await connectToDatabase();

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    // Status filter
    if (includeDisabled) {
      // Admin can see all
    } else if (statusParam) {
      query.status = { $in: statusParam.split(',') };
    } else {
      query.status = { $in: ['active', 'beta', 'coming_soon'] };
    }

    // Category filter
    if (category) {
      query.category = category.toLowerCase();
    }

    // Auth type filter
    if (authType) {
      query.authType = authType;
    }

    // Capability filter
    if (capability) {
      query.capabilities = capability;
    }

    // Tier filter (user can only see providers at or below their tier)
    // For now, assume all users can see all tiers (tier enforcement can be added later)
    // query.tier = { $lte: user.accountLevel || 0 };

    const providers = await ConnectionProvider.find(query)
      .select('-clientId -clientSecret') // Never expose credentials
      .sort({ tier: 1, name: 1 })
      .lean();

    // Transform providers for response
    const transformedProviders = providers.map(p => ({
      providerId: p.providerId,
      name: p.name,
      description: p.description,
      icon: p.icon,
      color: p.color,
      category: p.category,
      website: p.website,
      docsUrl: p.docsUrl,
      authType: p.authType,
      capabilities: p.capabilities,
      tags: p.tags,
      status: p.status,
      tier: p.tier,
      isSystem: p.isSystem,
      // Include config but not sensitive parts
      oauth2Config: p.authType === 'oauth2' ? {
        scopes: p.oauth2Config?.scopes,
        pkceRequired: p.oauth2Config?.pkceRequired,
      } : undefined,
      apiKeyConfig: p.authType === 'api_key' ? p.apiKeyConfig : undefined,
      basicAuthConfig: p.authType === 'basic' ? p.basicAuthConfig : undefined,
      multiCredentialConfig: p.authType === 'multi_credential' ? p.multiCredentialConfig : undefined,
      rateLimits: p.rateLimits,
    }));

    // Get unique categories for filtering
    const allCategories = await ConnectionProvider.distinct('category', { 
      status: { $in: ['active', 'beta'] } 
    });

    return NextResponse.json({
      providers: transformedProviders,
      total: transformedProviders.length,
      categories: allCategories.sort(),
    });
  } catch (error) {
    console.error('[Connection Providers] Error listing:', error);
    return NextResponse.json(
      { error: 'Failed to list providers' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a custom provider
 * 
 * Users can only create api_key type providers.
 * Admins can create any type.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const userIsAdmin = isAdmin(user);

    // Validate required fields
    const { name, authType } = body;
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (!authType) {
      return NextResponse.json({ error: 'authType is required' }, { status: 400 });
    }

    // Non-admins can only create api_key providers
    if (!userIsAdmin && authType !== 'api_key') {
      return NextResponse.json(
        { error: 'Only API Key providers can be created by users' },
        { status: 403 }
      );
    }

    // Generate or validate providerId
    let providerId = body.providerId;
    if (!providerId) {
      providerId = `custom_${sanitizeProviderId(name)}_${Date.now().toString(36)}`;
    } else if (!isValidProviderId(providerId)) {
      return NextResponse.json(
        { error: 'Invalid providerId format' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Check for duplicate
    const existing = await ConnectionProvider.findOne({ providerId });
    if (existing) {
      return NextResponse.json(
        { error: 'Provider ID already exists' },
        { status: 409 }
      );
    }

    // Build provider document
    const providerData: Partial<IConnectionProvider> = {
      providerId,
      name: name.trim(),
      description: body.description?.trim(),
      icon: body.icon || 'key',
      color: body.color || '#6B7280',
      category: body.category?.toLowerCase().trim() || 'custom',
      website: body.website?.trim(),
      docsUrl: body.docsUrl?.trim(),
      authType,
      capabilities: body.capabilities || [],
      tags: body.tags || ['custom'],
      status: userIsAdmin ? (body.status || 'active') : 'active',
      tier: userIsAdmin ? (body.tier || 0) : 0,
      isSystem: false,
      allowUserCustomization: false,
      createdBy: user.userId,
    };

    // Add auth config based on type
    if (authType === 'api_key') {
      if (!body.apiKeyConfig) {
        return NextResponse.json(
          { error: 'apiKeyConfig is required for api_key providers' },
          { status: 400 }
        );
      }
      providerData.apiKeyConfig = {
        headerName: body.apiKeyConfig.headerName || 'Authorization',
        headerFormat: body.apiKeyConfig.headerFormat || 'Bearer {{key}}',
        keyLabel: body.apiKeyConfig.keyLabel || 'API Key',
        instructions: body.apiKeyConfig.instructions || `Enter your ${name} API key`,
        testEndpoint: body.apiKeyConfig.testEndpoint,
        testMethod: body.apiKeyConfig.testMethod,
        testExpectedStatus: body.apiKeyConfig.testExpectedStatus,
      };
    } else if (authType === 'oauth2' && userIsAdmin) {
      if (!body.oauth2Config) {
        return NextResponse.json(
          { error: 'oauth2Config is required for oauth2 providers' },
          { status: 400 }
        );
      }
      providerData.oauth2Config = body.oauth2Config;
      
      // Encrypt client credentials if provided
      if (body.clientId) {
        providerData.clientId = encryptValue(body.clientId);
      }
      if (body.clientSecret) {
        providerData.clientSecret = encryptValue(body.clientSecret);
      }
    } else if (authType === 'basic') {
      if (!body.basicAuthConfig) {
        return NextResponse.json(
          { error: 'basicAuthConfig is required for basic auth providers' },
          { status: 400 }
        );
      }
      providerData.basicAuthConfig = body.basicAuthConfig;
    } else if (authType === 'multi_credential') {
      if (!body.multiCredentialConfig) {
        return NextResponse.json(
          { error: 'multiCredentialConfig is required for multi_credential providers' },
          { status: 400 }
        );
      }
      providerData.multiCredentialConfig = body.multiCredentialConfig;
    }

    const provider = await ConnectionProvider.create(providerData);

    return NextResponse.json({
      providerId: provider.providerId,
      name: provider.name,
      authType: provider.authType,
      status: provider.status,
    }, { status: 201 });
  } catch (error) {
    console.error('[Connection Providers] Error creating:', error);
    return NextResponse.json(
      { error: 'Failed to create provider' },
      { status: 500 }
    );
  }
}
