'use client';

import React, { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Globe2,
  LoaderCircle,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { CARRIERS } from '@/lib/carriers';
import StatusBadge from '@/components/StatusBadge';
import { displayValue, formatDate } from '@/lib/format';
import type { CarrierId, DockId, ManifestImportRow, ManifestImportSummary } from '@/lib/types';

export default function ManifestBatchPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [summary, setSummary] = useState<ManifestImportSummary | null>(null);
  const [editedRows, setEditedRows] = useState<ManifestImportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [queueStats, setQueueStats] = useState<{ queued: number; running: number; completed: number; failed: number } | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll queue telemetry periodically if there are running or queued tasks
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    async function checkQueue() {
      try {
        const res = await fetch('/api/queue/status');
        if (res.ok) {
          const data = await res.json();
          setQueueStats(data.stats);
        }
      } catch {
        // ignore
      }
    }

    void checkQueue();
    interval = setInterval(checkQueue, 3000);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  // Handle file upload
  async function handleFileUpload(file: File) {
    setError(null);
    setSuccessMessage(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/manifest/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to parse manifest file');
      }

      setSummary(data.summary);
      setEditedRows(data.summary.rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not process file');
    } finally {
      setUploading(false);
    }
  }

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFileUpload(file);
    e.target.value = '';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFileUpload(file);
  };

  // Row editing helpers
  const updateRow = (rowId: string, partial: Partial<ManifestImportRow>) => {
    setEditedRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        const updated = { ...r, ...partial };
        // Re-check validity
        const errs: string[] = [];
        if (!updated.trackingNumber || updated.trackingNumber.length < 3) {
          errs.push('Tracking number must be >= 3 chars.');
        }
        updated.isValid = errs.length === 0;
        updated.errors = errs;
        return updated;
      })
    );
  };

  const deleteRow = (rowId: string) => {
    setEditedRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const addManualRow = () => {
    const newRow: ManifestImportRow = {
      rowId: `manual-${Date.now()}`,
      shipmentId: `FC-${Math.floor(1000 + Math.random() * 9000)}`,
      trackingNumber: '',
      carrier: 'maersk',
      carrierRaw: 'Maersk',
      promisedEta: null,
      assignedDock: 'Dock A',
      isValid: false,
      errors: ['Enter tracking reference'],
    };
    setEditedRows((prev) => [newRow, ...prev]);
  };

  // Commit manifest and enqueue tracking
  const commitManifest = async () => {
    if (!editedRows.length) return;
    setCommitting(true);
    setError(null);

    try {
      const res = await fetch('/api/manifest/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: editedRows,
          manifestId: summary?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to commit manifest');
      }

      setSuccessMessage(
        `Successfully committed ${data.importedCount} shipments to database. Enqueued ${data.enqueuedCount} lookups across max 2 concurrent TinyFish agent workers.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Manifest commit failed');
    } finally {
      setCommitting(false);
    }
  };

  const filteredRows = editedRows.filter((r) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      r.shipmentId.toLowerCase().includes(q) ||
      r.trackingNumber.toLowerCase().includes(q) ||
      r.carrier.toLowerCase().includes(q) ||
      r.carrierRaw.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> SHIPMENT MANIFEST & EXCEL ENGINE
          </div>
          <h1>
            Manifest Management<span className="heading-period">.</span>
          </h1>
          <p>
            Upload multi-carrier spreadsheets (XLSX, XLS, CSV). Controlled background execution enqueues lookups with strict 2-agent concurrency.
          </p>
        </div>
        <div className="heading-actions">
          <a
            href="/api/manifest/export?format=xlsx"
            className="button button-secondary"
            title="Download enriched XLSX with tracking, SLA, demurrage, and confirmation keys"
          >
            <Download size={16} /> Enriched Excel (.xlsx)
          </a>
          <a
            href="/api/manifest/export?format=csv"
            className="button button-secondary"
            title="Download CSV export"
          >
            <ArrowDownToLine size={16} /> Export CSV
          </a>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <section
        className={`content-panel manifest-dropzone ${dragOver ? 'dropzone-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          onChange={onFileInputChange}
        />
        <div className="dropzone-content">
          <div className="dropzone-icon-halo">
            {uploading ? (
              <LoaderCircle size={32} className="spin text-sky-400" />
            ) : (
              <FileSpreadsheet size={32} className="text-sky-400" />
            )}
          </div>
          <h3>{uploading ? 'Parsing spreadsheet columns…' : 'Drop shipment manifest here or click to browse'}</h3>
          <p>
            Supports XLSX, XLS, and CSV. Automatically detects Shipment ID, Container No, Carrier, Promised ETA, and Dock Assignment.
          </p>
          <div className="dropzone-badges">
            <span className="format-tag">.XLSX</span>
            <span className="format-tag">.XLS</span>
            <span className="format-tag">.CSV</span>
            <span className="format-tag">No 5-Shipment Restriction</span>
          </div>
        </div>
      </section>

      {error && (
        <div className="inline-alert inline-alert-error mb-6">
          <AlertTriangle size={18} />
          <p>{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="inline-alert inline-alert-success mb-6">
          <CheckCircle2 size={18} />
          <div className="success-content">
            <strong>{successMessage}</strong>
            <div className="success-links">
              <Link href="/live-map" className="text-link">
                View on Live Map <Globe2 size={13} />
              </Link>
              <span>·</span>
              <Link href="/agent-console" className="text-link">
                Inspect Agent Telemetry <Bot size={13} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Global Queue Monitor Strip */}
      {queueStats && (queueStats.queued > 0 || queueStats.running > 0) && (
        <div className="queue-telemetry-banner mb-6">
          <div className="queue-banner-title">
            <LoaderCircle size={18} className="spin text-sky-400" />
            <div>
              <strong>Controlled Agent Queue Running</strong>
              <span>Concurrency limited to exactly 2 simultaneous TinyFish remote browsers</span>
            </div>
          </div>
          <div className="queue-stat-pills">
            <span className="queue-pill pill-running">Running: {queueStats.running} / 2</span>
            <span className="queue-pill pill-queued">Queued: {queueStats.queued}</span>
            <span className="queue-pill pill-completed">Completed: {queueStats.completed}</span>
            {queueStats.failed > 0 && <span className="queue-pill pill-failed">Failed: {queueStats.failed}</span>}
          </div>
        </div>
      )}

      {/* Manifest Table & Editing Workspace */}
      {editedRows.length > 0 && (
        <section className="content-panel manifest-preview-panel">
          <div className="section-heading">
            <div>
              <div className="eyebrow">IMPORT PREVIEW & VERIFICATION</div>
              <h2>Shipment Manifest Workspace</h2>
              <p>
                Review normalized fields, correct warnings, and commit rows for automated tracking.
              </p>
            </div>
            <div className="heading-actions">
              <button type="button" className="button button-secondary" onClick={addManualRow}>
                <Plus size={16} /> Add Row
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={commitManifest}
                disabled={committing || editedRows.every((r) => !r.isValid)}
              >
                {committing ? (
                  <>
                    <LoaderCircle size={16} className="spin" /> Enqueueing…
                  </>
                ) : (
                  <>
                    <Play size={16} /> Commit & Dispatch Tracking
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="manifest-table-toolbar">
            <div className="search-field">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search shipment ID, container reference, or carrier…"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
            </div>
            <div className="manifest-summary-badges">
              <span className="summary-badge badge-valid">
                <CheckCircle2 size={13} /> {editedRows.filter((r) => r.isValid).length} Valid
              </span>
              {editedRows.some((r) => !r.isValid) && (
                <span className="summary-badge badge-invalid">
                  <AlertCircle size={13} /> {editedRows.filter((r) => !r.isValid).length} Require Correction
                </span>
              )}
            </div>
          </div>

          {/* Data Table */}
          <div className="table-scroll">
            <table className="data-table manifest-data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Shipment ID</th>
                  <th>Tracking / Container No.</th>
                  <th>Carrier</th>
                  <th>Promised ETA</th>
                  <th>Assigned Dock</th>
                  <th>Origin / Dest</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.rowId} className={!row.isValid ? 'row-has-errors' : ''}>
                    <td>
                      {row.isValid ? (
                        <span className="status-pill-valid">
                          <CheckCircle2 size={14} /> Valid
                        </span>
                      ) : (
                        <span className="status-pill-invalid" title={row.errors.join('; ')}>
                          <AlertTriangle size={14} /> Issues
                        </span>
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.shipmentId}
                        onChange={(e) => updateRow(row.rowId, { shipmentId: e.target.value })}
                        className="table-inline-input"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.trackingNumber}
                        onChange={(e) => updateRow(row.rowId, { trackingNumber: e.target.value })}
                        placeholder="e.g. MSKU1234567"
                        className="table-inline-input"
                      />
                      {row.errors.length > 0 && (
                        <div className="row-inline-error">{row.errors[0]}</div>
                      )}
                    </td>
                    <td>
                      <select
                        value={row.carrier}
                        onChange={(e) => updateRow(row.rowId, { carrier: e.target.value as CarrierId })}
                        className="table-inline-select"
                      >
                        {CARRIERS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="datetime-local"
                        value={row.promisedEta ? row.promisedEta.slice(0, 16) : ''}
                        onChange={(e) => updateRow(row.rowId, { promisedEta: e.target.value ? new Date(e.target.value).toISOString() : null })}
                        className="table-inline-input"
                      />
                    </td>
                    <td>
                      <select
                        value={row.assignedDock || ''}
                        onChange={(e) => updateRow(row.rowId, { assignedDock: (e.target.value || null) as DockId | null })}
                        className="table-inline-select"
                      >
                        <option value="">Unassigned</option>
                        <option value="Dock A">Dock A</option>
                        <option value="Dock B">Dock B</option>
                        <option value="Dock C">Dock C</option>
                      </select>
                    </td>
                    <td>
                      <div className="table-secondary">
                        {row.origin || 'Origin'} → {row.destination || 'Dest'}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => deleteRow(row.rowId)}
                        className="row-action danger-action"
                        title="Delete row"
                        aria-label="Delete row"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
