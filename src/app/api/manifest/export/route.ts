import { NextRequest, NextResponse } from 'next/server';
import { getEnrichedShipments } from '@/lib/db';
import { exportEnrichedExcelBuffer, exportEnrichedCsvString } from '@/lib/excel/exporter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'xlsx';

  try {
    const shipments = getEnrichedShipments();

    if (format === 'csv') {
      const csv = exportEnrichedCsvString(shipments);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="enriched-freight-manifest.csv"',
        },
      });
    }

    // Default: XLSX
    const buffer = exportEnrichedExcelBuffer(shipments);
    return new Response(new Blob([buffer.buffer as ArrayBuffer]), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="enriched-freight-manifest.xlsx"',
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    );
  }
}
