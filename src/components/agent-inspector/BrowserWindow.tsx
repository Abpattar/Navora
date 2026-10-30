'use client';

import React, { useState } from 'react';
import { ExternalLink, Globe, MonitorPlay, ShieldAlert } from 'lucide-react';

interface BrowserWindowProps {
  streamingUrl?: string | null;
  agentType: string;
  targetUrl?: string | null;
  status: string;
}

export default function BrowserWindow({ streamingUrl, agentType, targetUrl, status }: BrowserWindowProps) {
  const [iframeError, setIframeError] = useState(false);

  return (
    <div className="inspector-browser-frame">
      <div className="browser-topbar">
        <div className="browser-dots">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>
        <div className="browser-url-bar">
          <Globe size={13} />
          <span>{targetUrl || (streamingUrl ? 'Remote Chromium Session' : 'Waiting for navigation…')}</span>
        </div>
        {streamingUrl && (
          <a
            href={streamingUrl}
            target="_blank"
            rel="noreferrer"
            className="browser-popout-btn"
            title="Open stream in dedicated tab"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      <div className="browser-viewport">
        {streamingUrl && !iframeError ? (
          <div className="browser-iframe-container">
            <iframe
              src={streamingUrl}
              title={`${agentType} Remote Browser Stream`}
              className="browser-live-iframe"
              sandbox="allow-scripts allow-same-origin allow-popups"
              onError={() => setIframeError(true)}
            />
            <div className="browser-overlay-strip">
              <span className="live-dot" />
              <span>LIVE AGENT STREAM</span>
            </div>
          </div>
        ) : (
          <div className="browser-empty-state">
            <div className="browser-icon-halo">
              <MonitorPlay size={32} />
            </div>
            <h4>{streamingUrl ? 'Embedded Stream Restricted' : `${agentType} Inactive`}</h4>
            <p>
              {streamingUrl ? (
                <>
                  Provider restrictions or iframe CSP prevent direct embedding of this remote session.{' '}
                  <a href={streamingUrl} target="_blank" rel="noreferrer" className="text-link">
                    Open remote browser in external tab <ExternalLink size={13} />
                  </a>
                </>
              ) : status === 'RUNNING' ? (
                'Remote browser starting up on carrier portal…'
              ) : (
                'Select a shipment or start an agent run to stream live execution.'
              )}
            </p>
            <div className="browser-trust-note">
              <ShieldAlert size={13} />
              <span>No fabricated browser activity is ever shown. Real streaming only.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
