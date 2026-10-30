'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bot, LoaderCircle } from 'lucide-react';
import AgentInspector from '@/components/agent-inspector/AgentInspector';
import type { EnrichedShipment } from '@/lib/types';

function AgentConsoleContent() {
  const searchParams = useSearchParams();
  const initialShipmentId = searchParams.get('shipmentId');

  const [shipments, setShipments] = useState<EnrichedShipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadShipments() {
      try {
        const res = await fetch('/api/shipments/enriched', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setShipments(data.shipments || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    void loadShipments();
  }, []);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> AUTONOMOUS AGENT ORCHESTRATION
          </div>
          <h1>
            Live Agent Inspector<span className="heading-period">.</span>
          </h1>
          <p>
            Real-time execution telemetry for Carrier Tracking Agents and Warehouse Rescheduling Agents.
          </p>
        </div>
        <div className="heading-actions">
          <div className="telemetry-concurrency-badge">
            <span className="live-dot" />
            <span>GLOBAL CONCURRENCY: MAX 2 AGENTS</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="content-panel map-empty-state">
          <LoaderCircle size={28} className="spin" />
          <p>Initializing agent control telemetry…</p>
        </div>
      ) : shipments.length === 0 ? (
        <div className="content-panel map-empty-state">
          <Bot size={40} className="empty-icon-subtle" />
          <h3>No shipments available for agent inspection</h3>
          <p>Import a manifest to dispatch autonomous tracking and rescheduling agents.</p>
        </div>
      ) : (
        <AgentInspector
          initialShipmentId={initialShipmentId}
          shipments={shipments}
        />
      )}
    </>
  );
}

export default function AgentConsolePage() {
  return (
    <Suspense
      fallback={
        <div className="content-panel map-empty-state">
          <LoaderCircle size={28} className="spin" />
          <p>Loading agent console…</p>
        </div>
      }
    >
      <AgentConsoleContent />
    </Suspense>
  );
}
