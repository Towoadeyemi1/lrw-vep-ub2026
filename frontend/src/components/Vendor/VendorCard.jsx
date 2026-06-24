import { Building2 } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { EntityBadge } from '../Common/EntityBadge';

function ConfirmationDots({ count }) {
  const max = 3;
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full border-2 transition-all duration-500 ${
            i < count ? 'bg-gold border-gold' : 'border-steel bg-transparent'
          }`}
        />
      ))}
      <span className="text-xs text-silver ml-1">{count}/{max}</span>
    </div>
  );
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function VendorCard({ vendor }) {
  const confirmations = vendor.confirmation_count || 0;
  const progress = Math.min(100, Math.round((confirmations / 3) * 100));

  return (
    <div className="bg-navy rounded-xl border border-cobalt shadow-lg p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-cobalt flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-ivory text-sm leading-tight truncate">{vendor.canonical_name || vendor.name}</h3>
          <p className="text-silver text-xs mt-0.5 truncate">{vendor.category || 'Uncategorized'}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <StatusBadge status={vendor.status || 'NEW'} />
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-silver">
            <span>Confirmations</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-cobalt rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                progress >= 100 ? 'bg-green-500' : progress >= 67 ? 'bg-cobalt' : 'bg-amber'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <ConfirmationDots count={confirmations} />
        </div>
      </div>

      {vendor.default_entity && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-silver">Routes to:</span>
          <EntityBadge vertical={vendor.default_entity_vertical || 'default'} />
          <span className="text-ivory font-medium truncate">{vendor.default_entity}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-silver">Invoices</span>
          <p className="text-ivory font-semibold mt-0.5">{vendor.invoice_count || 0}</p>
        </div>
        <div>
          <span className="text-silver">Avg Amount</span>
          <p className="text-ivory font-semibold mt-0.5">{formatCurrency(vendor.average_amount)}</p>
        </div>
      </div>

      <div className="text-xs text-silver border-t border-cobalt pt-2">
        First seen: {timeAgo(vendor.first_seen || vendor.created_at)}
      </div>
    </div>
  );
}
