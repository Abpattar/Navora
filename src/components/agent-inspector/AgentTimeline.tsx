'use client';

import React from 'react';
import { CheckCircle2, Circle, Clock, Loader2, XCircle } from 'lucide-react';
import type { AgentEvent } from '@/lib/types';

interface AgentTimelineProps {
  events: AgentEvent[];
}

export default function AgentTimeline({ events }: AgentTimelineProps) {
  // Extract progress steps from events
  const steps = events.filter((e) => e.type === 'PROGRESS' || e.type === 'COMPLETE' || e.type === 'FAILED');

  if (steps.length === 0) {
    return (
      <div className="agent-timeline-empty">
        <Clock size={16} />
        <span>Step timeline begins upon agent dispatch.</span>
      </div>
    );
  }

  return (
    <div className="agent-timeline-flow">
      {steps.map((step, idx) => {
        const isComplete = step.type === 'COMPLETE';
        const isFailed = step.type === 'FAILED';
        const isLast = idx === steps.length - 1;

        return (
          <div key={step.id || idx} className="timeline-step-row">
            <div className="timeline-step-indicator">
              {isComplete ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : isFailed ? (
                <XCircle size={16} className="text-red-400" />
              ) : isLast ? (
                <Loader2 size={16} className="text-sky-400 spin" />
              ) : (
                <Circle size={14} className="text-neutral-500" />
              )}
              {!isLast && <div className="timeline-step-line" />}
            </div>
            <div className="timeline-step-content">
              <span className="timeline-step-time">
                {new Date(step.timestamp).toLocaleTimeString()}
              </span>
              <p className="timeline-step-title">{step.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
