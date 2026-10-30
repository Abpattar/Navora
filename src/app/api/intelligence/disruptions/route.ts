import { NextRequest, NextResponse } from 'next/server';
import { fetchDisruptionIntelligence } from '@/lib/tinyfish/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || 'port congestion shipping disruptions weather';

  try {
    const data = await fetchDisruptionIntelligence(query);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        alerts: [],
        sourceService: 'cached_intelligence',
        limitationNote: err instanceof Error ? err.message : 'Disruption intelligence query failed',
      },
      { status: 500 }
    );
  }
}
