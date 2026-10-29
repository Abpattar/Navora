import type { LucideIcon } from 'lucide-react';

export default function StatCard({ label, value, note, icon: Icon, tone = 'neutral' }: {
  label: string; value: string | number; note: string; icon: LucideIcon; tone?: 'neutral' | 'green' | 'amber' | 'red';
}) {
  return <div className="stat-card">
    <div className="stat-top"><span className="stat-label">{label}</span><span className={`stat-icon stat-icon-${tone}`}><Icon size={18} /></span></div>
    <div className="stat-value">{value}</div>
    <div className="stat-note">{note}</div>
  </div>;
}
