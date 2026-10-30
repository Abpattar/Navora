'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  Anchor,
  Clock,
  CloudLightning,
  ExternalLink,
  Globe2,
  Info,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Ship,
  Sparkles,
} from 'lucide-react';
import type { DisruptionAlert } from '@/lib/types';

export default function IntelligencePage() {
  const [alerts, setAlerts] = useState<DisruptionAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitationNote, setLimitationNote] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function loadAlerts(searchQuery?: string) {
    setLoading(true);
    setLimitationNote(null);
    try {
      const url = searchQuery
        ? `/api/intelligence/disruptions?q=${encodeURIComponent(searchQuery)}`
        : '/api/intelligence/disruptions';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      setAlerts(data.alerts || []);
      if (data.limitationNote) {
        setLimitationNote(data.limitationNote);
      }
    } catch {
      setLimitationNote('Failed to connect to intelligence service.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAlerts();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void loadAlerts(query);
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> MARITIME DISRUPTION INTELLIGENCE
          </div>
          <h1>
            Port & Logistics Disruptions<span className="heading-period">.</span>
          </h1>
          <p>
            Real-world terminal congestion, extreme weather events, and transport exceptions.
          </p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => loadAlerts(query)}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh Intelligence
          </button>
        </div>
      </div>

      <div className="intelligence-toolbar mb-6">
        <form onSubmit={handleSearch} className="intelligence-search-form">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search port disruptions (e.g. Shanghai fog, Red Sea, Nhava Sheva strike)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="button button-primary" disabled={loading}>
            Search
          </button>
        </form>
      </div>

      {limitationNote && (
        <div className="note-strip mb-6">
          <Info size={16} />
          <span>
            <strong>Service Note:</strong> {limitationNote} (All external alerts originate strictly from real feeds without simulated data.)
          </span>
        </div>
      )}

      {loading ? (
        <div className="content-panel map-empty-state">
          <LoaderCircle size={28} className="spin" />
          <p>Querying maritime disruption feeds…</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="content-panel map-empty-state">
          <Globe2 size={40} className="empty-icon-subtle" />
          <h3>No Active Disruptions Logged</h3>
          <p>
            No major maritime alerts found matching the current query. Feed will update as external notices publish.
          </p>
        </div>
      ) : (
        <div className="disruptions-grid">
          {alerts.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            const isWeather = alert.category === 'WEATHER';
            const isStrike = alert.category === 'LABOR_STRIKE';

            return (
              <article key={alert.id} className={`disruption-card ${isCritical ? 'card-critical' : ''}`}>
                <div className="disruption-header">
                  <div className="disruption-category-tag">
                    {isWeather ? (
                      <CloudLightning size={14} />
                    ) : isStrike ? (
                      <ShieldAlert size={14} />
                    ) : (
                      <Anchor size={14} />
                    )}
                    <span>{alert.category.replace('_', ' ')}</span>
                  </div>
                  <span className={`severity-badge severity-${alert.severity.toLowerCase()}`}>
                    {alert.severity}
                  </span>
                </div>

                <h3 className="disruption-title">{alert.title}</h3>

                <div className="disruption-meta">
                  <span><strong>Hub:</strong> {alert.affectedLocation}</span>
                  <span>·</span>
                  <span>{new Date(alert.publishedAt).toLocaleDateString()}</span>
                </div>

                <p className="disruption-summary">{alert.summary}</p>

                {alert.relatedShipmentIds && alert.relatedShipmentIds.length > 0 && (
                  <div className="related-shipments-box">
                    <span className="related-label">
                      <AlertTriangle size={13} /> {alert.relatedShipmentIds.length} Manifest Shipments Routed Through Here:
                    </span>
                    <div className="related-pills">
                      {alert.relatedShipmentIds.map((id) => (
                        <Link key={id} href={`/live-map`} className="related-shipment-pill">
                          Shipment {id.slice(0, 8)}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <div className="disruption-footer">
                  <span className="disruption-source">Source: {alert.source}</span>
                  {alert.source.startsWith('http') && (
                    <a
                      href={alert.source}
                      target="_blank"
                      rel="noreferrer"
                      className="source-external-link"
                    >
                      Read Notice <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
