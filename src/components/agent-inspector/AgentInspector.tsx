'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Box,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  LoaderCircle,
  Play,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Warehouse,
  AlertTriangle,
} from 'lucide-react';
import BrowserWindow from './BrowserWindow';
import AgentTerminal from './AgentTerminal';
import AgentStatus from './AgentStatus';
import AgentTimeline from './AgentTimeline';
import type { AgentEvent, AgentRun, EnrichedShipment, ShipmentWorkflowRecord, SlotRecommendation } from '@/lib/types';

interface AgentInspectorProps {
  initialShipmentId?: string | null;
  shipments: EnrichedShipment[];
}

export default function AgentInspector({ initialShipmentId, shipments }: AgentInspectorProps) {
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(
    initialShipmentId || (shipments[0]?.shipment.id ?? '')
  );

  // Workflow State
  const [workflow, setWorkflow] = useState<ShipmentWorkflowRecord | null>(null);
  const [workflowExecuting, setWorkflowExecuting] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);

  // Left Panel: Tracking Agent State
  const [trackingRun, setTrackingRun] = useState<AgentRun | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<AgentEvent[]>([]);
  const [trackingRunning, setTrackingRunning] = useState(false);

  // Right Panel: Warehouse Rescheduling Agent State
  const [warehouseRun, setWarehouseRun] = useState<AgentRun | null>(null);
  const [warehouseEvents, setWarehouseEvents] = useState<AgentEvent[]>([]);
  const [warehouseRunning, setWarehouseRunning] = useState(false);

  const activeShipment = shipments.find((s) => s.shipment.id === selectedShipmentId) || shipments[0];

  // Fetch recent agent runs and workflow state for this shipment
  const loadRecentRuns = async () => {
    if (!activeShipment) return;
    try {
      const [runsRes, wfRes] = await Promise.all([
        fetch(`/api/agent/runs?shipmentId=${activeShipment.shipment.id}`),
        fetch(`/api/workflow/status?shipmentId=${activeShipment.shipment.id}`),
      ]);

      if (runsRes.ok) {
        const data = await runsRes.json();
        if (data.trackingRun) setTrackingRun(data.trackingRun);
        if (data.trackingEvents) setTrackingEvents(data.trackingEvents);
        if (data.warehouseRun) setWarehouseRun(data.warehouseRun);
        if (data.warehouseEvents) setWarehouseEvents(data.warehouseEvents);
      }

      if (wfRes.ok) {
        const wfData = await wfRes.json();
        setWorkflow(wfData.workflow || null);
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
                void loadRecentRuns();
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
                  confirmationId: eventPayload.result?.confirmationId || eventPayload.confirmationId,
                  extractedOutput: eventPayload.result,
                }));
                void loadRecentRuns();
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

  // Trigger Complete Autonomous Workflow
  const handleExecuteWorkflow = async () => {
    if (!activeShipment || workflowExecuting) return;
    setWorkflowExecuting(true);
    setWorkflowMessage('Running autonomous workflow: READ -> DETECT -> DECIDE…');

    try {
      const res = await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipmentId: activeShipment.shipment.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Workflow execution failed');
      }

      setWorkflow(data.workflow);
      setWorkflowMessage(data.message);
      void loadRecentRuns();
    } catch (err: unknown) {
      setWorkflowMessage(err instanceof Error ? err.message : 'Workflow error');
    } finally {
      setWorkflowExecuting(false);
    }
  };

  // Human Gatekeeper Action: Approve Recommendation & Dispatch TinyFish WRITE
  const handleApproveWorkflow = async () => {
    if (!activeShipment || workflowExecuting) return;
    setWorkflowExecuting(true);
    setWorkflowMessage('Gatekeeper approved! Dispatching TinyFish WRITE agent to execute warehouse rescheduling…');

    try {
      const res = await fetch('/api/workflow/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentId: activeShipment.shipment.id,
          notes: 'Approved via Autonomous Agent Inspector Command Desk',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Approval failed');
      }

      setWorkflow(data.workflow);
      setWorkflowMessage(data.message);
      void runWarehouseAgent();
    } catch (err: unknown) {
      setWorkflowMessage(err instanceof Error ? err.message : 'Approval execution error');
    } finally {
      setWorkflowExecuting(false);
    }
  };

  const stepsList = [
    { key: 'READ', label: '1. READ Tracking' },
    { key: 'DETECT', label: '2. DETECT Delay' },
    { key: 'DECIDE', label: '3. DECIDE Slot' },
    { key: 'APPROVE', label: '4. APPROVE Gate' },
    { key: 'WRITE', label: '5. WRITE Portal' },
    { key: 'VERIFY', label: '6. VERIFY Failsafe' },
  ];

  const currentStepIndex = stepsList.findIndex((s) => s.key === workflow?.currentStep);
  const isAwaitingApproval = workflow?.status === 'AWAITING_APPROVAL';

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
            onClick={handleExecuteWorkflow}
            disabled={workflowExecuting || trackingRunning || warehouseRunning}
          >
            {workflowExecuting ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
            <span>Run Autonomous Loop</span>
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={runTrackingAgent}
            disabled={trackingRunning || !activeShipment}
          >
            <Bot size={16} />
            <span>{trackingRunning ? 'Tracking Agent…' : 'READ Agent'}</span>
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={runWarehouseAgent}
            disabled={warehouseRunning || !activeShipment}
          >
            <Warehouse size={16} />
            <span>{warehouseRunning ? 'Warehouse Agent…' : 'WRITE Agent'}</span>
          </button>
        </div>
      </div>

      {/* Autonomous Workflow Progress Ribbon */}
      <div className="content-panel mb-6 p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-emerald-400" />
            <h4 className="text-sm font-semibold tracking-wide">Autonomous Workflow Pipeline</h4>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-secondary text-secondary-foreground">
            STATUS: {workflow?.status || 'READY'}
          </span>
        </div>

        {/* Pipeline Step Badges */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {stepsList.map((step, idx) => {
            const isCompleted = workflow?.status === 'COMPLETE' || (currentStepIndex !== -1 && idx < currentStepIndex);
            const isCurrent = workflow?.currentStep === step.key && workflow?.status !== 'COMPLETE';

            return (
              <div
                key={step.key}
                className={`p-2.5 rounded-lg border text-xs text-center transition-all ${
                  isCompleted
                    ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
                    : isCurrent
                    ? 'border-blue-500 bg-blue-950/30 text-blue-200 font-semibold shadow-sm'
                    : 'border-border/60 bg-background/50 text-muted-foreground'
                }`}
              >
                <div className="font-mono text-[10px] uppercase opacity-75">{step.label}</div>
              </div>
            );
          })}
        </div>

        {/* Workflow Message Banner */}
        {workflowMessage && (
          <div className="mt-3 p-2.5 rounded-lg bg-background/80 border border-border text-xs text-foreground flex items-center justify-between">
            <span>{workflowMessage}</span>
          </div>
        )}

        {/* Human Gatekeeper Approval Alert Card */}
        {isAwaitingApproval && workflow && (
          <div className="mt-4 p-4 rounded-xl border border-amber-500/40 bg-amber-950/20 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-amber-300">Human Approval Gate: Rescheduling Proposed</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Recommendation: Shift reservation to <strong>{workflow.proposedDock || workflow.recommendedDockId || 'Dock B'}</strong> at{' '}
                  <strong>{new Date(workflow.proposedSlot || workflow.recommendedSlotTime || new Date().toISOString()).toLocaleString()}</strong>.
                </p>
                {(workflow.decisionNotes || workflow.notes) && <p className="text-xs text-amber-200/80 mt-1">{workflow.decisionNotes || workflow.notes}</p>}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="button button-primary text-xs px-4 py-2 flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500"
                onClick={handleApproveWorkflow}
                disabled={workflowExecuting}
              >
                <CheckCircle2 size={14} />
                <span>Approve & Dispatch TinyFish Agent</span>
              </button>
              <Link
                href={`/warehouse-portal/reschedule?shipmentId=${activeShipment.shipment.id}&dock=${encodeURIComponent(workflow.proposedDock || workflow.recommendedDockId || 'Dock B')}&time=10:00`}
                className="button button-secondary text-xs"
              >
                Review in Portal
              </Link>
            </div>
          </div>
        )}

        {/* Authoritative Confirmation Card */}
        {workflow?.confirmationId && (
          <div className="mt-4 p-3 rounded-lg border border-emerald-500/40 bg-emerald-950/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-400" />
              <div>
                <div className="text-xs text-muted-foreground">Authoritative Confirmation Token</div>
                <div className="font-mono font-bold text-emerald-400 text-sm">{workflow.confirmationId}</div>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck size={12} /> Failsafe Verified
            </span>
          </div>
        )}
      </div>

      {/* Main Dual Execution Panels */}
      <div className="agent-panels-grid">
        {/* LEFT PANEL: Tracking Agent */}
        <section className="agent-execution-column">
          <div className="panel-column-header">
            <div className="panel-column-title">
              <Bot size={18} className="text-sky-400" />
              <div>
                <h3>Carrier Tracking Agent (READ)</h3>
                <p>Navigates carrier tracking portals to extract verified milestones</p>
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
                <h3>Warehouse Rescheduling Agent (WRITE)</h3>
                <p>Operates terminal rescheduling portal to execute berth adjustments</p>
              </div>
            </div>
          </div>

          <AgentStatus run={warehouseRun} agentType="Warehouse Agent" />

          <BrowserWindow
            streamingUrl={warehouseRun?.streamingUrl}
            agentType="Warehouse Agent"
            targetUrl="/warehouse-portal/reschedule"
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
