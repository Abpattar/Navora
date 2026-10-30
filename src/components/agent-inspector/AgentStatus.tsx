'use client';

import React from 'react';
import { Activity, CheckCircle, Clock, Hash, Key, Play, ShieldAlert, XCircle } from 'lucide-react';
import type { AgentRun } from '@/lib/types';

interface AgentStatusProps {
  run?: AgentRun | null;
  agentType: string;
}

export default function AgentStatus({ run, agentType }: AgentStatusProps) {
  if (!run) {
    return (
      <div className="agent-status-bar status-idle">
        <div className="status-main">
          <span className="status-indicator-dot dot-idle" />
          <span className="status-name">{agentType} Standby</span>
        </div>
        <span className="status-note">No active execution</span>
      </div>
    );
  }

  const isRunning = run.status === 'RUNNING';
  const isCompleted = run.status === 'COMPLETED';
  const isFailed = run.status === 'FAILED';

  const startTime = new Date(run.startTime).toLocaleTimeString();
  const endTime = run.endTime ? new Date(run.endTime).toLocaleTimeString() : null;

  return (
    <div className={`agent-status-bar ${isRunning ? 'status-running' : isCompleted ? 'status-ok' : isFailed ? 'status-error' : 'status-pending'}`}>
      <div className="status-main">
        <span className={`status-indicator-dot ${isRunning ? 'pulse' : ''}`} />
        <div>
          <strong className="status-name">{agentType}</strong>
          <span className="status-badge-inline">{run.status}</span>
        </div>
      </div>

      <div className="status-meta-items">
        <div className="status-meta-item">
          <Hash size={13} />
          <code>{run.runId}</code>
        </div>
        <div className="status-meta-item">
          <Clock size={13} />
          <span>Started: {startTime}</span>
          {endTime && <span>· Ended: {endTime}</span>}
        </div>
        <div className="status-meta-item">
          <Activity size={13} />
          <span>{run.stepsCount} steps</span>
        </div>
        {run.confirmationId && (
          <div className="status-meta-item confirmation-item">
            <Key size={13} />
            <strong>Confirmation: {run.confirmationId}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
