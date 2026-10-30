'use client';

import Link from 'next/link';
import { ArrowUpRight, ExternalLink, Info, Plane, ShieldCheck, Ship, Truck } from 'lucide-react';
import { CARRIERS } from '@/lib/carriers';

export default function CarriersPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> CARRIER & REGISTRY DIRECTORY
          </div>
          <h1>
            Carrier Sources<span className="heading-period">.</span>
          </h1>
          <p>
            Official tracking portals that TinyFish autonomous agents inspect. Every carrier configuration includes domain allowlists for SSRF prevention.
          </p>
        </div>
        <div className="heading-actions">
          <Link className="button button-primary" href="/track">
            <Ship size={17} /> Manual Track Lookup
          </Link>
        </div>
      </div>

      <div className="carrier-grid">
        {CARRIERS.map((carrier) => {
          const isOcean = carrier.carrierType === 'ocean';
          const isAir = carrier.carrierType === 'air';
          const isSurface = carrier.carrierType === 'surface';
          const Icon = isAir ? Plane : isSurface ? Truck : Ship;

          return (
            <article className="carrier-card" key={carrier.id}>
              <div className="carrier-card-top">
                <div className="carrier-symbol">
                  <Icon size={19} />
                </div>
                <div className="carrier-badges-row">
                  <span
                    className={`carrier-tag ${
                      carrier.integrationStatus === 'priority' ? 'carrier-tag-priority' : ''
                    }`}
                  >
                    {carrier.integrationStatus.toUpperCase()}
                  </span>
                  <span className="carrier-type-pill">{carrier.carrierType.toUpperCase()}</span>
                </div>
              </div>

              <h2>{carrier.name}</h2>
              <p className="carrier-hint">Accepts: {carrier.referenceHint}</p>
              <p className="carrier-note">{carrier.note}</p>

              <div className="carrier-domains-strip">
                <ShieldCheck size={13} className="text-emerald-400" />
                <span>Allowed: {carrier.allowedDomains.join(', ')}</span>
              </div>

              <div className="carrier-card-footer">
                <a
                  href={carrier.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="carrier-link"
                >
                  Open official portal <ExternalLink size={14} />
                </a>
                <Link
                  href={`/track?carrier=${carrier.id}`}
                  className="carrier-use-link"
                  title={`Use ${carrier.name} in tracking form`}
                >
                  <ArrowUpRight size={17} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <div className="note-strip source-warning mt-6">
        <Info size={17} />
        <span>
          <strong>Operational Policy:</strong> Autonomous agents navigate only official public portals with strict domain allowlists and private network protection (SSRF). The application never bypasses CAPTCHA, access controls, or account requirements.
        </span>
      </div>
    </>
  );
}
