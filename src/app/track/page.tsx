'use client';

import { ShieldCheck, Sparkles } from 'lucide-react';
import TrackForm from '@/components/TrackForm';
import { useShipmentHistory } from '@/lib/useShipmentHistory';

export default function TrackPage() {
  const { addResult } = useShipmentHistory();
  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> LIVE WEB RESEARCH</div><h1>Track a shipment<span className="heading-period">.</span></h1><p>Ask TinyFish to investigate a carrier's official tracking page and return the information it can verify.</p></div></div>
    <div className="track-layout"><TrackForm onResult={addResult} /><aside className="track-explainer"><div className="explainer-icon"><Sparkles size={20} /></div><div className="eyebrow">HOW IT WORKS</div><h2>One request. One evidence-backed result.</h2><div className="explainer-list"><div><span>01</span><section><strong>Submit a reference</strong><p>Select the carrier and enter a container or Bill of Lading reference you are authorized to access.</p></section></div><div><span>02</span><section><strong>TinyFish investigates</strong><p>The server asks TinyFish to navigate the selected carrier's official page and extract the details it can see.</p></section></div><div><span>03</span><section><strong>Verify the result</strong><p>Review the retrieved fields, note missing information, and open the official source to confirm.</p></section></div></div><div className="privacy-note"><ShieldCheck size={17} /><span>Your TinyFish key stays on the server. This prototype does not book, modify, or cancel shipments.</span></div></aside></div>
  </>;
}
