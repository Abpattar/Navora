'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, CircleAlert, ExternalLink, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { CARRIERS } from '@/lib/carriers';

type Health = { ok: boolean; service: string; tinyfishConfigured: boolean; checkedAt: string; note: string };

export default function SettingsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function checkHealth() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      const data = await response.json() as Health;
      if (!response.ok) throw new Error('Health endpoint returned an error.');
      setHealth(data);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not contact the application backend.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void checkHealth(); }, []);

  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> SYSTEM CONFIGURATION</div><h1>Settings<span className="heading-period">.</span></h1><p>Review backend health, TinyFish configuration, and prototype limitations.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={() => void checkHealth()} disabled={loading}>{loading ? <RefreshCw className="spin" size={16} /> : <RefreshCw size={16} />} Check health</button></div></div>
    <div className="settings-grid"><section className="content-panel settings-panel"><div className="settings-section-title"><span className="settings-icon"><Activity size={19} /></span><div><h2>Backend health</h2><p>Checks whether the app server is responding.</p></div></div>{error && <div className="inline-alert inline-alert-error"><CircleAlert size={17} /><span>{error}</span></div>}{health && <div className="config-status-row"><div className="config-status-copy"><span className="status-light status-light-green" /><div><strong>{health.ok ? 'Application API is responding' : 'Backend health check failed'}</strong><p>Checked at {new Date(health.checkedAt).toLocaleString()}</p></div></div><span className="config-pill config-pill-green">{health.ok ? 'HEALTHY' : 'ERROR'}</span></div>}</section>
      <section className="content-panel settings-panel"><div className="settings-section-title"><span className="settings-icon"><KeyRound size={19} /></span><div><h2>TinyFish API</h2><p>Key presence only; this is not a live credential test.</p></div></div>{health && <div className="config-status-row"><div className="config-status-copy"><span className={`status-light ${health.tinyfishConfigured ? 'status-light-green' : 'status-light-amber'}`} /><div><strong>{health.tinyfishConfigured ? 'API key is configured' : 'API key is missing'}</strong><p>{health.tinyfishConfigured ? 'The server found TINYFISH_API_KEY.' : 'Set TINYFISH_API_KEY in .env.local, then restart the dev server.'}</p></div></div><span className={`config-pill ${health.tinyfishConfigured ? 'config-pill-green' : 'config-pill-amber'}`}>{health.tinyfishConfigured ? 'CONFIGURED' : 'ACTION NEEDED'}</span></div>}<ol className="settings-steps"><li>Copy <code>.env.example</code> to <code>.env.local</code>.</li><li>Add your key from the <a href="https://agent.tinyfish.ai/api-keys" target="_blank" rel="noreferrer">TinyFish API keys page <ExternalLink size={12} /></a>.</li><li>Restart the server after changing environment variables.</li></ol></section>
      <section className="content-panel settings-panel settings-wide"><div className="settings-section-title"><span className="settings-icon"><ShieldCheck size={19} /></span><div><h2>Data handling and limitations</h2><p>Be clear about what the prototype does and does not claim.</p></div></div><div className="settings-bullets"><p><CheckCircle2 size={16} /> API keys remain on the server and are never returned by the health route.</p><p><CheckCircle2 size={16} /> Tracking history is stored in this browser using localStorage.</p><p><CheckCircle2 size={16} /> Source links and retrieval timestamps are shown with results.</p><p><CircleAlert size={16} /> The prototype does not book, cancel, or alter shipments.</p><p><CircleAlert size={16} /> Carrier pages may restrict automated access or require a login. The app does not bypass these restrictions.</p></div></section>
      <section className="content-panel settings-panel settings-wide"><div className="settings-section-title"><span className="settings-icon"><Activity size={19} /></span><div><h2>Carrier registry</h2><p>Configured official tracking sources ({CARRIERS.length}).</p></div></div><div className="settings-carrier-list">{CARRIERS.map((carrier) => <div key={carrier.id}><span>{carrier.name}</span><a href={carrier.trackingUrl} target="_blank" rel="noreferrer">Open source <ExternalLink size={12} /></a></div>)}</div></section></div>
  </>;
}
