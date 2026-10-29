'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Anchor, Boxes, ChevronRight, Container, History, LayoutDashboard, Menu, Settings2, Ship, Waves, X } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

const navigation = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/track', label: 'Track shipment', icon: Container },
  { href: '/batch', label: 'Batch tracking', icon: Boxes },
  { href: '/history', label: 'Tracking history', icon: History },
  { href: '/carriers', label: 'Carrier sources', icon: Ship },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = navigation.find((item) => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))) ?? navigation[0];

  return (
    <div className="app-frame">
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Waves size={22} strokeWidth={2.4} /></div>
          <div><div className="brand-title">FREIGHT<span>OS</span></div><div className="brand-subtitle">SUPPLY CHAIN INTELLIGENCE</div></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <div className="workspace-pill"><span className="live-dot" /> HACKATHON WORKSPACE <ChevronRight size={14} /></div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = current.href === item.href;
            return <Link href={item.href} key={item.href} className={`nav-item ${active ? 'nav-item-active' : ''}`} onClick={() => setMobileOpen(false)}>
              <Icon size={18} strokeWidth={1.9} /><span>{item.label}</span>{active && <span className="nav-active-bar" />}
            </Link>;
          })}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-tip">
          <div className="tip-icon"><Anchor size={17} /></div>
          <p className="tip-title">Built for visibility.</p>
          <p className="tip-copy">Every result should link back to its carrier source.</p>
          <Link href="/carriers" className="tip-link">Explore sources <ChevronRight size={14} /></Link>
        </div>
        <div className="sidebar-footer"><span className="footer-status" /><span>Prototype environment</span><span className="version-tag">v1.0</span></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{current.label}</strong></div>
          <div className="topbar-right"><span className="topbar-caption"><span className="live-dot" /> LIVE WEB LOOKUPS</span><Link href="/settings" className="user-chip"><span className="avatar">G</span><span>Freight team</span><ChevronRight size={13} /></Link></div>
        </header>
        <div className="page-content">{children}</div>
        <footer className="app-footer"><span>FREIGHTOS <span className="footer-dot">·</span> Global Freight Command Center</span><span>Data is retrieved from carrier sources when requested. Availability may change.</span></footer>
      </main>
    </div>
  );
}
