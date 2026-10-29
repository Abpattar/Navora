'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, FileSpreadsheet, LoaderCircle, Plus, Play, Trash2, Upload } from 'lucide-react';
import { CARRIERS } from '@/lib/carriers';
import { exportToCsv } from '@/lib/storage';
import { useShipmentHistory } from '@/lib/useShipmentHistory';
import type { CarrierId, ShipmentResult } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import { displayValue, formatDate } from '@/lib/format';

type Row = { id: string; carrier: CarrierId; trackingNumber: string };
type RunResult = { rowId: string; success: boolean; result?: ShipmentResult; error?: string };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some((value) => value.length)) rows.push(row);
  return rows;
}

function normalizeCarrier(value: string): CarrierId | null {
  const key = value.trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-');
  const aliases: Record<string, CarrierId> = { 'maersk': 'maersk', 'msc': 'msc', 'cma-cgm': 'cma-cgm', 'cma-cgm-line': 'cma-cgm', 'hapag-lloyd': 'hapag-lloyd', 'cosco': 'cosco', 'cosco-shipping-lines': 'cosco', 'evergreen': 'evergreen', 'one': 'one', 'oocl': 'oocl', 'zim': 'zim', 'yang-ming': 'yang-ming' };
  return aliases[key] ?? null;
}

export default function BatchPage() {
  const { addResult } = useShipmentHistory();
  const [rows, setRows] = useState<Row[]>([{ id: 'row-1', carrier: 'maersk', trackingNumber: '' }]);
  const [results, setResults] = useState<RunResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  function updateRow(id: string, change: Partial<Row>) { setRows((current) => current.map((row) => row.id === id ? { ...row, ...change } : row)); }
  function addRow() {
    if (rows.length >= 5) return;
    setRows((current) => [...current, { id: `row-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`, carrier: 'maersk', trackingNumber: '' }]);
  }
  function removeRow(id: string) { setRows((current) => current.length > 1 ? current.filter((row) => row.id !== id) : current); }

  async function handleCsv(event: ChangeEvent<HTMLInputElement>) {
    setError('');
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Please upload a CSV file.'); event.target.value = ''; return; }
    try {
      const raw = parseCsv(await file.text());
      if (raw.length < 2) throw new Error('CSV must contain a header row and at least one shipment row.');
      const headers = raw[0].map((item) => item.toLowerCase().replaceAll(' ', '').replaceAll('_', ''));
      const carrierIndex = headers.findIndex((item) => ['carrier', 'shippingcarrier'].includes(item));
      const refIndex = headers.findIndex((item) => ['trackingnumber', 'trackingreference', 'containernumber', 'billoflading', 'bol', 'reference'].includes(item));
      if (carrierIndex === -1 || refIndex === -1) throw new Error('CSV needs carrier and trackingNumber (or reference) columns.');
      const imported: Row[] = raw.slice(1).map((data, index) => {
        const rawCarrier = (data[carrierIndex] ?? '').trim();
        const normalized = normalizeCarrier(rawCarrier);
        if (!normalized) throw new Error(`Unknown carrier in CSV row ${index + 2}: "${rawCarrier}". Use a supported carrier name or ID.`);
        return { id: `csv-${Date.now()}-${index}`, carrier: normalized, trackingNumber: (data[refIndex] ?? '').trim() };
      }).filter((item) => item.trackingNumber.length > 0);
      if (!imported.length) throw new Error('No tracking references were found in the CSV.');
      if (imported.length > 5) throw new Error(`The CSV contains ${imported.length} references. The current limit is five; split the file into smaller batches.`);
      setRows(imported);
      setResults([]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not read the CSV.'); }
    finally { event.target.value = ''; }
  }

  async function runBatch() {
    setError(''); setResults([]);
    const valid = rows.filter((row) => row.trackingNumber.trim().length >= 3);
    if (!valid.length) { setError('Add at least one tracking reference with three or more characters.'); return; }
    if (valid.length > 5) { setError('A batch can contain at most five shipments.'); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/shipments/track-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: valid.map(({ carrier, trackingNumber }) => ({ carrier, trackingNumber: trackingNumber.trim() })) }) });
      const body = await response.json() as { success?: boolean; error?: string; results?: Array<{ index: number; success: boolean; result?: ShipmentResult; error?: string }> };
      if (!response.ok) throw new Error(body.error ?? 'The batch request could not be completed.');
      const mapped: RunResult[] = (body.results ?? []).map((item) => ({ rowId: valid[item.index]?.id ?? `result-${item.index}`, success: item.success, result: item.result, error: item.error }));
      setResults(mapped);
      mapped.forEach((item) => { if (item.result) addResult(item.result); });
    } catch (err) { setError(err instanceof Error ? err.message : 'Batch tracking failed.'); }
    finally { setLoading(false); }
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> MULTI-SHIPMENT WORKFLOW</div><h1>Batch tracking<span className="heading-period">.</span></h1><p>Check up to five shipment references in one request. Results still come from real carrier lookups.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={() => fileInput.current?.click()}><Upload size={16} /> Import CSV</button><input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={handleCsv} /></div></div>
    <section className="content-panel batch-panel"><div className="section-heading"><div><div className="eyebrow">BATCH INPUT</div><h2>Shipment manifest</h2><p>Enter one carrier and reference per row. Blank rows are ignored.</p></div><span className="count-pill">{rows.length} / 5 rows</span></div>
      <div className="batch-rows"><div className="batch-row batch-row-header"><span>Carrier</span><span>Tracking reference</span><span>Action</span></div>{rows.map((row) => <div className="batch-row" key={row.id}><label className="visually-hidden" htmlFor={`${row.id}-carrier`}>Carrier</label><select id={`${row.id}-carrier`} value={row.carrier} onChange={(event) => updateRow(row.id, { carrier: event.target.value as CarrierId })}>{CARRIERS.map((carrier) => <option value={carrier.id} key={carrier.id}>{carrier.name}</option>)}</select><label className="visually-hidden" htmlFor={`${row.id}-reference`}>Tracking reference</label><input id={`${row.id}-reference`} value={row.trackingNumber} onChange={(event) => updateRow(row.id, { trackingNumber: event.target.value })} placeholder="Enter a valid reference" maxLength={80} /><button className="row-action danger-action" title="Remove row" aria-label="Remove row" onClick={() => removeRow(row.id)} disabled={rows.length === 1}><Trash2 size={16} /></button></div>)}</div>
      <div className="batch-controls"><button className="button button-secondary" onClick={addRow} disabled={rows.length >= 5}><Plus size={16} /> Add another shipment</button><div><button className="button button-primary" onClick={runBatch} disabled={loading}>{loading ? <><LoaderCircle className="spin" size={17} /> Checking shipments…</> : <><Play size={16} /> Run live batch</>}</button></div></div>
      {error && <div className="inline-alert inline-alert-error"><AlertTriangle size={17} /><p>{error}</p></div>}
      {loading && <div className="lookup-progress"><LoaderCircle className="spin" size={19} /><div><strong>Batch lookup running</strong><p>The server limits concurrent browser tasks. This can take a little while for multiple carriers.</p></div></div>}
    </section>
    {results.length > 0 && <section className="content-panel batch-results-panel"><div className="section-heading"><div><div className="eyebrow">LIVE RESULTS</div><h2>Batch report</h2><p>Each row represents one attempted carrier lookup.</p></div><button className="button button-secondary" onClick={() => exportToCsv(results.flatMap((item) => item.result ? [item.result] : []), 'freight-batch-results.csv')} disabled={!results.some((item) => item.result)}><ArrowDownToLine size={16} /> Export successful results</button></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Carrier / reference</th><th>Outcome</th><th>Latest status</th><th>Location</th><th>Retrieved</th><th>Source</th></tr></thead><tbody>{results.map((item) => <tr key={item.rowId}><td><div className="table-carrier">{item.result?.carrierName ?? rows.find((row) => row.id === item.rowId)?.carrier ?? 'Shipment'}</div><div className="table-reference">{item.result?.trackingNumber ?? rows.find((row) => row.id === item.rowId)?.trackingNumber ?? 'Reference'}</div></td><td>{item.result ? <StatusBadge status={item.result.lookupStatus} /> : <span className="status-badge status-error">Failed</span>}<div className="table-secondary">{item.error ?? ''}</div></td><td>{displayValue(item.result?.status)}</td><td>{displayValue(item.result?.location)}</td><td>{item.result ? formatDate(item.result.retrievedAt) : 'Unavailable'}</td><td>{item.result && <a className="source-link" href={item.result.sourceUrl} target="_blank" rel="noreferrer">Open source <ArrowDownToLine size={13} /></a>}</td></tr>)}</tbody></table></div><div className="note-strip"><FileSpreadsheet size={16} /><span>For CSV import, use headers <code>carrier</code> and <code>trackingNumber</code>. Carrier values should match a listed carrier name or ID.</span></div></section>}
  </>;
}
