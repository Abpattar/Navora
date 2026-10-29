import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Global Freight Command Center',
  description: 'Live, source-backed shipment intelligence across carrier websites.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body><AppShell>{children}</AppShell></body></html>;
}
