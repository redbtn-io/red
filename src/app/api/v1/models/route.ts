import { NextResponse } from 'next/server';
import { getModelsList } from '@/lib/api-helpers';

export async function GET() {
  return NextResponse.json(getModelsList());
}
