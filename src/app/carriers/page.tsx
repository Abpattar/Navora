'use client';

import Link from 'next/link';
import { ArrowUpRight, ExternalLink, Info, Ship } from 'lucide-react';
import { CARRIERS } from '@/lib/carriers';

export default function CarriersPage() {
  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> SOURCE DIRECTORY</div><h1>Carrier sources<span className="heading-period">.</span></h1><p>Official tracking pages that the agent can be asked to inspect. A listing is not a guarantee that automation has been tested.</p></div><div className="heading-actions"><Link className="button button-primary" href="/track"><Ship size={17} /> Track a shipment</Link></div></div>
    <div className="carrier-grid">{CARRIERS.map((carrier) => <article className="carrier-card" key={carrier.id}><div className="carrier-card-top"><div className="carrier-symbol"><Ship size={19} /></div><span className={`carrier-tag ${carrier.integrationStatus === 'priority' ? 'carrier-tag-priority' : ''}`}>{carrier.integrationStatus === 'priority' ? 'PRIORITY TARGET' : 'CANDIDATE'}</span></div><h2>{carrier.name}</h2><p className="carrier-hint">Accepts: {carrier.referenceHint}</p><p className="carrier-note">{carrier.note}</p><div className="carrier-card-footer"><a href={carrier.trackingUrl} target="_blank" rel="noreferrer" className="carrier-link">Open official page <ExternalLink size={14} /></a><Link href={`/track?carrier=${carrier.id}`} className="carrier-use-link" title={`Use ${carrier.name} in tracking form`}><ArrowUpRight size={17} /></Link></div></article>)}</div>
    <div className="note-strip source-warning"><Info size={17} /><span><strong>Testing note:</strong> Start with Maersk and MSC. Manually confirm a valid reference and publicly accessible fields before relying on any carrier during the hackathon. The app never attempts to bypass login, CAPTCHA, or other access restrictions.</span></div>
  </>;
}
