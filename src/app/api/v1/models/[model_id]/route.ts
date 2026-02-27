import { NextRequest, NextResponse } from 'next/server';
import { getModelDetails } from '@/lib/api/api-helpers';
import { verifyAuth } from '@/lib/auth/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ model_id: string }> }
) {
  // Verify authentication
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { model_id } = await params;
  const model = getModelDetails(model_id);

  if (model) {
    return NextResponse.json(model);
  } else {
    return NextResponse.json(
      {
        error: {
          message: `Model '${model_id}' not found`,
          type: 'invalid_request_error',
          code: 'model_not_found'
        }
      },
      { status: 404 }
    );
  }
}
