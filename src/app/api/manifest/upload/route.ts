import { NextRequest, NextResponse } from 'next/server';
import { parseSpreadsheetBuffer } from '@/lib/excel/parser';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls') && !filename.endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'Unsupported format. Upload an Excel (.xlsx, .xls) or CSV file.' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const summary = parseSpreadsheetBuffer(buffer, file.name);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Spreadsheet parsing error' },
      { status: 400 }
    );
  }
}
