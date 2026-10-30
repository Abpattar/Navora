'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, Bot, Box, Play, RefreshCw, Warehouse, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import BrowserWindow from './BrowserWindow';
import AgentTerminal from './AgentTerminal';
import AgentStatus from './AgentStatus';
import AgentTimeline from './AgentTimeline';
import type { AgentEvent, AgentRun, EnrichedShipment } from '@/lib/types';

interface AgentInspectorProps {
  initialShipmentId?: string | null;
  shipments: EnrichedShipment[];
}

export default function AgentInspector({ initialShipmentId, shipments }: AgentInspectorProps) {
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(
    initialShipmentId || (shipments[0]?.shipment.id ?? '')
  );

  // Left Panel: Tracking Agent State
  const [trackingRun, setTrackingRun] = useState<AgentRun | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<AgentEvent[]>([]);
  const [trackingRunning, setTrackingRunning] = useState(false);

  // Right Panel: Warehouse Rescheduling Agent State
  const [warehouseRun, setWarehouseRun] = useState<AgentRun | null>(null);
  const [warehouseEvents, setWarehouseEvents] = useState<AgentEvent[]>([]);
  const [warehouseRunning, setWarehouseRunning] = useState(false);

  const activeShipment = shipments.find((s) => s.shipment.id === selectedShipmentId) || shipments[0];

  // Fetch recent agent runs for this shipment
  const loadRecentRuns = async () => {
    if (!activeShipment) return;
    try {
      const res = await fetch(`/api/agent/runs?shipmentId=${activeShipment.shipment.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.trackingRun) setTrackingRun(data.trackingRun);
        if (data.trackingEvents) setTrackingEvents(data.trackingEvents);
        if (data.warehouseRun) setWarehouseRun(data.warehouseRun);
        if (data.warehouseEvents) setWarehouseEvents(data.warehouseEvents);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadRecentRuns();
  }, [selectedShipmentId]);

  // Execute Tracking Agent with real SSE streaming
  const runTrackingAgent = async () => {
    if (!activeShipment || trackingRunning) return;
    setTrackingRunning(true);
    setTrackingEvents([]);

    const initialEvent: AgentEvent = {
      id: `evt-${Date.now()}`,
      runId: `run-${Date.now()}`,
      type: 'STARTED',
      timestamp: new Date().toISOString(),
      message: `Connecting to ${activeShipment.shipment.carrierName} official portal…`,
    };
    setTrackingEvents([initialEvent]);

    try {
      const response = await fetch('/api/shipments/track-sse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier: activeShipment.shipment.carrier,
          trackingNumber: activeShipment.shipment.trackingNumber,
          shipmentId: activeShipment.shipment.id,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Agent stream request failed');
      }

      if (!response.body) throw new Error('ReadableStream not supported');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            try {
              const eventPayload = JSON.parse(trimmed.slice(5).trim());
              const newEvt: AgentEvent = {
                id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                runId: eventPayload.runId || 'run-live',
                type: eventPayload.type || 'PROGRESS',
                timestamp: eventPayload.timestamp || new Date().toISOString(),
                message: eventPayload.message || eventPayload.purpose || 'Agent step processing',
                payload: eventPayload.payload,
              };

              setTrackingEvents((prev) => [...prev, newEvt]);

              if (eventPayload.streamingUrl) {
                setTrackingRun((prev) => ({
                  ...(prev || {
                    id: 'live',
                    runId: 'live',
                    agentType: 'TRACKING',
                    status: 'RUNNING',
                    startTime: new Date().toISOString(),
                    stepsCount: 1,
                  }),
                  streamingUrl: eventPayload.streamingUrl,
                }));
              }

              if (eventPayload.type === 'COMPLETE') {
                setTrackingRun((prev) => ({
                  ...(prev || {
                    id: 'live',
                    runId: 'live',
                    agentType: 'TRACKING',
                    startTime: new Date().toISOString(),
                    stepsCount: 1,
                  }),
                  status: 'COMPLETED',
                  endTime: new Date().toISOString(),
                  extractedOutput: eventPayload.result,
                }));
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Execution error';
      setTrackingEvents((prev) => [
        ...prev,
        {
          id: `evt-err-${Date.now()}`,
          runId: 'err',
          type: 'FAILED',
          timestamp: new Date().toISOString(),
          message: errMsg,
        },
      ]);
      setTrackingRun((prev) => ({
        ...(prev || {
          id: 'err',
          runId: 'err',
          agentType: 'TRACKING',
          startTime: new Date().toISOString(),
          stepsCount: 1,
        }),
        status: 'FAILED',
        error: errMsg,
      }));
    } finally {
      setTrackingRunning(false);
    }
  };

  // Execute Warehouse Rescheduling Agent
  const runWarehouseAgent = async () => {
    if (!activeShipment || warehouseRunning) return;
    setWarehouseRunning(true);
    setWarehouseEvents([]);

    const initialEvt: AgentEvent = {
      id: `evt-wh-${Date.now()}`,
      runId: `run-wh-${Date.now()}`,
      type: 'STARTED',
      timestamp: new Date().toISOString(),
      message: 'Launching Warehouse Agent. Opening internal dock portal…',
    };
    setWarehouseEvents([initialEvt]);

    try {
      const response = await fetch('/api/warehouse/reschedule-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentId: activeShipment.shipment.id,
          trackingNumber: activeShipment.shipment.trackingNumber,
          assignedDock: activeShipment.shipment.assignedDock || 'Dock A',
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Warehouse agent execution failed');
      }

      if (!response.body) throw new Error('ReadableStream not supported');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            try {
              const eventPayload = JSON.parse(trimmed.slice(5).trim());
              const newEvt: AgentEvent = {
                id: `evt-wh-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                runId: eventPayload.runId || 'run-wh',
                type: eventPayload.type || 'PROGRESS',
                timestamp: eventPayload.timestamp || new Date().toISOString(),
                message: eventPayload.message || 'Updating dock reservation timetable',
                payload: eventPayload.payload,
              };

              setWarehouseEvents((prev) => [...prev, newEvt]);

              if (eventPayload.streamingUrl) {
                setWarehouseRun((prev) => ({
                  ...(prev || {
                    id: 'live-wh',
                    runId: 'live-wh',
                    agentType: 'WAREHOUSE',
                    status: 'RUNNING',
                    startTime: new Date().toISOString(),
                    stepsCount: 1,
                  }),
                  streamingUrl: eventPayload.streamingUrl,
                }));
              }

              if (eventPayload.type === 'COMPLETE') {
                setWarehouseRun((prev) => ({
                  ...(prev || {
                    id: 'live-wh',
                    runId: 'live-wh',
                    agentType: 'WAREHOUSE',
                    startTime: new Date().toISOString(),
                    stepsCount: 1,
                  }),
                  status: 'COMPLETED',
                  endTime: new Date().toISOString(),
                  confirmationId: eventPayload.confirmationId,
                  extractedOutput: eventPayload.result,
                }));
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Warehouse agent execution error';
      setWarehouseEvents((prev) => [
        ...prev,
        {
          id: `evt-wh-err-${Date.now()}`,
          runId: 'err',
          type: 'FAILED',
          timestamp: new Date().toISOString(),
          message: errMsg,
        },
      ]);
      setWarehouseRun((prev) => ({
        ...(prev || {
          id: 'err-wh',
          runId: 'err-wh',
          agentType: 'WAREHOUSE',
          startTime: new Date().toISOString(),
          stepsCount: 1,
        }),
        status: 'FAILED',
        error: errMsg,
      }));
    } finally {
      setWarehouseRunning(false);
    }
  };

  return (
    <div className="agent-inspector-workspace">
      {/* Top Shipment Selector & Action Header */}
      <div className="inspector-top-selector">
        <div className="selector-meta">
          <label htmlFor="shipment-select">Target Shipment:</label>
          <select
            id="shipment-select"
            value={selectedShipmentId}
            onChange={(e) => setSelectedShipmentId(e.target.value)}
          >
            {shipments.map((s) => (
              <option key={s.shipment.id} value={s.shipment.id}>
                {s.shipment.shipmentId} — {s.shipment.carrierName} ({s.shipment.trackingNumber})
              </option>
            ))}
          </select>
        </div>

        <div className="selector-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={runTrackingAgent}
            disabled={trackingRunning || !activeShipment}
          >
            <Bot size={16} />
            <span>{trackingRunning ? 'Tracking Agent Running…' : 'Run Tracking Agent'}</span>
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={runWarehouseAgent}
            disabled={warehouseRunning || !activeShipment}
          >
            <Warehouse size={16} />
            <span>{warehouseRunning ? 'Warehouse Agent Running…' : 'Run Warehouse Agent'}</span>
          </button>
        </div>
      </div>

      {/* Main Dual Execution Panels */}
      <div className="agent-panels-grid">
        {/* LEFT PANEL: Tracking Agent */}
        <section className="agent-execution-column">
          <div className="panel-column-header">
            <div className="panel-column-title">
              <Bot size={18} className="text-sky-400" />
              <div>
                <h3>Carrier Tracking Agent</h3>
                <p>Navigates live carrier portals to verify milestones</p>
              </div>
            </div>
          </div>

          <AgentStatus run={trackingRun} agentType="Carrier Tracking Agent" />

          <BrowserWindow
            streamingUrl={trackingRun?.streamingUrl}
            agentType="Tracking Agent"
            targetUrl={activeShipment?.tracking?.sourceUrl || activeShipment?.shipment.carrierName}
            status={trackingRunning ? 'RUNNING' : trackingRun?.status || 'IDLE'}
          />

          <AgentTimeline events={trackingEvents} />

          <AgentTerminal
            events={trackingEvents}
            title="TRACKING AGENT TERMINAL (RAW SSE)"
          />

          {trackingRun?.extractedOutput ? (
            <div className="extracted-output-card">
              <h4>Extracted Structured Observation</h4>
              <pre>{JSON.stringify(trackingRun.extractedOutput, null, 2)}</pre>
            </div>
          ) : null}
        </section>

        {/* RIGHT PANEL: Warehouse Rescheduling Agent */}
        <section className="agent-execution-column">
          <div className="panel-column-header">
            <div className="panel-column-title">
              <Warehouse size={18} className="text-amber-400" />
              <div>
                <h3>Warehouse Rescheduling Agent</h3>
                <p>Navigates internal dock portal to shift unloading reservations</p>
              </div>
            </div>
          </div>

          <AgentStatus run={warehouseRun} agentType="Warehouse Agent" />

          <BrowserWindow
            streamingUrl={warehouseRun?.streamingUrl}
            agentType="Warehouse Agent"
            targetUrl="/warehouse-portal"
            status={warehouseRunning ? 'RUNNING' : warehouseRun?.status || 'IDLE'}
          />

          <AgentTimeline events={warehouseEvents} />

          <AgentTerminal
            events={warehouseEvents}
            title="WAREHOUSE AGENT TERMINAL (MUTATION AUDIT)"
          />

          {warehouseRun?.confirmationId && (
            <div className="confirmation-id-card">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <div>
                <strong>Dock Reservation Confirmed</strong>
                <p>Confirmation Key: <code>{warehouseRun.confirmationId}</code></p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
