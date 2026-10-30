import type { LookupStatus } from '@/lib/types';

const labels: Record<LookupStatus, string> = {
  success: 'Retrieved',
  not_found: 'Not found',
  needs_login: 'Login required',
  blocked: 'Restricted',
  unsupported: 'Unsupported',
  error: 'Lookup error',
  pending: 'Queued',
  running: 'Tracking…',
};

export default function StatusBadge({ status }: { status: LookupStatus | string }) {
  const known = status in labels ? status as LookupStatus : 'error';
  return <span className={`status-badge status-${known}`}><span className="status-dot" />{labels[known]}</span>;
}
