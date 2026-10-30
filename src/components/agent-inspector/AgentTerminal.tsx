'use client';

import React, { useEffect, useRef } from 'react';
import { Terminal, Copy, Check } from 'lucide-react';
import type { AgentEvent } from '@/lib/types';

interface AgentTerminalProps {
  events: AgentEvent[];
  title?: string;
}

export default function AgentTerminal({ events, title = 'LIVE AGENT LOG STREAM' }: AgentTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const copyLogs = () => {
    const text = events.map((e) => `[${e.timestamp}] [${e.type}] ${e.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="agent-terminal-card">
      <div className="terminal-header">
        <div className="terminal-title">
          <Terminal size={14} />
          <span>{title}</span>
          <span className="terminal-count">({events.length} events)</span>
        </div>
        <button
          type="button"
          className="terminal-action-btn"
          onClick={copyLogs}
          title="Copy log buffer"
          aria-label="Copy terminal log"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className="terminal-body">
        {events.length === 0 ? (
          <div className="terminal-empty">
            <span className="terminal-cursor">_</span>
            <span className="terminal-dim">Awaiting agent dispatch…</span>
          </div>
        ) : (
          events.map((event, idx) => {
            const time = new Date(event.timestamp).toLocaleTimeString();
            const isError = event.type === 'FAILED';
            const isComplete = event.type === 'COMPLETE';
            const isUrl = event.type === 'STREAMING_URL';
            const isStep = event.type === 'PROGRESS';

            return (
              <div key={event.id || idx} className="terminal-line">
                <span className="terminal-time">[{time}]</span>
                <span
                  className={`terminal-tag tag-${
                    isError ? 'err' : isComplete ? 'ok' : isUrl ? 'url' : isStep ? 'step' : 'info'
                  }`}
                >
                  {event.type}
                </span>
                <span className="terminal-msg">{event.message}</span>
                {Boolean(event.payload && typeof event.payload === 'object' && Object.keys(event.payload).length > 0) ? (
                  <pre className="terminal-json">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                ) : null}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
