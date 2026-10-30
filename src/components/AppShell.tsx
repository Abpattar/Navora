'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Anchor,
  Bot,
  Boxes,
  ChevronRight,
  Container,
  FileSpreadsheet,
  Globe2,
  History,
  LayoutDashboard,
  Menu,
  Radio,
  Search,
  Settings2,
  Ship,
  Warehouse,
  Waves,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

const navigation = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/batch', label: 'Manifest', icon: FileSpreadsheet },
  { href: '/shipments', label: 'Shipments', icon: Container },
  { href: '/live-map', label: 'Live Map', icon: Globe2 },
  { href: '/agent-console', label: 'Agent Console', icon: Bot },
  { href: '/warehouse-portal', label: 'Warehouse', icon: Warehouse },
  { href: '/intelligence', label: 'Intelligence', icon: Radio },
  { href: '/history', label: 'History', icon: History },
  { href: '/carriers', label: 'Carrier Sources', icon: Ship },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = navigation.find((item) => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}`))) ?? navigation[0];

  return (
    <div className="app-frame">
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Waves size={22} strokeWidth={2.4} /></div>
          <div>
            <div className="brand-title">FREIGHT<span>COMMAND</span></div>
            <div className="brand-subtitle">AUTONOMOUS FREIGHT INTELLIGENCE</div>
          </div>
          <button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <div className="workspace-pill">
          <span className="live-dot" /> OPERATIONS DESK <ChevronRight size={14} />
        </div>
        <div className="nav-caption">COMMAND CENTER</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = current.href === item.href;
            return (
              <Link
                href={item.href}
                key={item.href}
                className={`nav-item ${active ? 'nav-item-active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span>{item.label}</span>
                {active && <span className="nav-active-bar" />}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-tip">
          <div className="tip-icon"><Anchor size={17} /></div>
          <p className="tip-title">Autonomous Logistics</p>
          <p className="tip-copy">Manual single-reference fallback lookup is always accessible.</p>
          <Link href="/track" className="tip-link">Manual Tracking <ChevronRight size={14} /></Link>
        </div>
        <div className="sidebar-footer">
          <span className="footer-status" />
          <span>Production Ready</span>
          <span className="version-tag">v2.0</span>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumbs">
            <span>FreightCommand</span>
            <ChevronRight size={14} />
            <strong>{current.label}</strong>
          </div>
          <div className="topbar-right">
            <Link href="/track" className="topbar-link-action">
              <Search size={14} /> Manual Lookup
            </Link>
            <span className="topbar-caption">
              <span className="live-dot" /> AUTONOMOUS ENGINE
            </span>
            <Link href="/settings" className="user-chip">
              <span className="avatar">FC</span>
              <span>Command Desk</span>
              <ChevronRight size={13} />
            </Link>
          </div>
        </header>
        <div className="page-content">{children}</div>
        <footer className="app-footer">
          <span>FREIGHTCOMMAND <span className="footer-dot">·</span> Autonomous Freight Intelligence & Logistics Operations</span>
          <span>Verified carrier observations only. Zero simulated or fabricated results.</span>
        </footer>
      </main>
    </div>
  );
}
