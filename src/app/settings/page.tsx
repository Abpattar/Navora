'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, CircleAlert, Database, ExternalLink, Globe, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { CARRIERS } from '@/lib/carriers';

type Health = {
  ok: boolean;
  service: string;
  tinyfishConfigured: boolean;
  databaseHealthy: boolean;
  appBaseUrlConfigured: boolean;
  appBaseUrl: string;
  checkedAt: string;
  note: string;
};

export default function SettingsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function checkHealth() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      const data = await response.json() as Health;
      if (!response.ok) throw new Error('Health endpoint returned an error.');
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not contact the application backend.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void checkHealth();
  }, []);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> SYSTEM ARCHITECTURE & HEALTH
          </div>
          <h1>
            System Settings<span className="heading-period">.</span>
          </h1>
          <p>
            Verify backend database persistence, TinyFish credentials, public tunnel connectivity, and security policies.
          </p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void checkHealth()}
            disabled={loading}
          >
            {loading ? <RefreshCw className="spin" size={16} /> : <RefreshCw size={16} />} Check Health
          </button>
        </div>
      </div>

      <div className="settings-grid">
        {/* Backend & Database Health */}
        <section className="content-panel settings-panel">
          <div className="settings-section-title">
            <span className="settings-icon">
              <Activity size={19} />
            </span>
            <div>
              <h2>Backend & Persistence</h2>
              <p>Checks API response and SQLite transactional persistence.</p>
            </div>
          </div>
          {error && (
            <div className="inline-alert inline-alert-error">
              <CircleAlert size={17} />
              <span>{error}</span>
            </div>
          )}
          {health && (
            <div className="config-status-row">
              <div className="config-status-copy">
                <span className={`status-light ${health.databaseHealthy ? 'status-light-green' : 'status-light-amber'}`} />
                <div>
                  <strong>{health.databaseHealthy ? 'SQLite Persistence Active' : 'Database Degraded'}</strong>
                  <p>Persistent tables for shipments, bookings, runs & coordinates.</p>
                </div>
              </div>
              <span className={`config-pill ${health.databaseHealthy ? 'config-pill-green' : 'config-pill-amber'}`}>
                {health.databaseHealthy ? 'PERSISTENT' : 'DEGRADED'}
              </span>
            </div>
          )}
        </section>

        {/* TinyFish API Status */}
        <section className="content-panel settings-panel">
          <div className="settings-section-title">
            <span className="settings-icon">
              <KeyRound size={19} />
            </span>
            <div>
              <h2>TinyFish Autonomous Agent API</h2>
              <p>Required for live browser tracking and portal actions.</p>
            </div>
          </div>
          {health && (
            <div className="config-status-row">
              <div className="config-status-copy">
                <span className={`status-light ${health.tinyfishConfigured ? 'status-light-green' : 'status-light-amber'}`} />
                <div>
                  <strong>{health.tinyfishConfigured ? 'TINYFISH_API_KEY Configured' : 'API Key Missing'}</strong>
                  <p>{health.tinyfishConfigured ? 'Server credentials loaded safely.' : 'Add TINYFISH_API_KEY to .env.local to enable live browser tracking.'}</p>
                </div>
              </div>
              <span className={`config-pill ${health.tinyfishConfigured ? 'config-pill-green' : 'config-pill-amber'}`}>
                {health.tinyfishConfigured ? 'READY' : 'ACTION NEEDED'}
              </span>
            </div>
          )}
        </section>

        {/* Remote Agent Tunnel & Public Base URL */}
        <section className="content-panel settings-panel">
          <div className="settings-section-title">
            <span className="settings-icon">
              <Globe size={19} />
            </span>
            <div>
              <h2>Public Tunnel / APP_BASE_URL</h2>
              <p>Reachable URL for remote browser access to warehouse portal.</p>
            </div>
          </div>
          {health && (
            <div className="config-status-row">
              <div className="config-status-copy">
                <span className={`status-light ${health.appBaseUrlConfigured ? 'status-light-green' : 'status-light-amber'}`} />
                <div>
                  <strong>Base URL: {health.appBaseUrl}</strong>
                  <p>{health.appBaseUrlConfigured ? 'Explicitly configured for agent access.' : 'Defaulting to local port. Use tunnel URL for remote browser access.'}</p>
                </div>
              </div>
              <span className={`config-pill ${health.appBaseUrlConfigured ? 'config-pill-green' : 'config-pill-amber'}`}>
                {health.appBaseUrlConfigured ? 'PUBLIC' : 'LOCAL'}
              </span>
            </div>
          )}
        </section>

        {/* Data Handling and Operational Rules */}
        <section className="content-panel settings-panel settings-wide">
          <div className="settings-section-title">
            <span className="settings-icon">
              <ShieldCheck size={19} />
            </span>
            <div>
              <h2>Security and Operational Failsafes</h2>
              <p>Verified guardrails adhering strictly to Hackathon rules.</p>
            </div>
          </div>
          <div className="settings-bullets">
            <p><CheckCircle2 size={16} /> API credentials remain strictly on server; never exposed to browser context.</p>
            <p><CheckCircle2 size={16} /> Global queue manager caps simultaneous browser agents strictly at TWO across the instance.</p>
            <p><CheckCircle2 size={16} /> Strict SSRF protection and domain allowlists block private IP ranges.</p>
            <p><CheckCircle2 size={16} /> Failsafe warehouse action: never discards original booking before replacement is confirmed.</p>
            <p><CheckCircle2 size={16} /> Zero fabricated coordinates or synthetic tracking responses. Real verifiable data only.</p>
          </div>
        </section>
      </div>
    </>
  );
}
