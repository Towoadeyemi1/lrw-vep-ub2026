import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Building2 } from 'lucide-react';
import { useVendors } from '../hooks/useVendors';
import { useDashboard } from '../hooks/useDashboard';
import { VendorCard } from '../components/Vendor/VendorCard';
import { EntityBadge } from '../components/Common/EntityBadge';
import client from '../api/client';

function formatCurrency(v) {
  if (!v && v !== 0) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

const EVENT_EMOJIS = {
  vendor_profile_created: '🆕',
  vendor_status_change: (e) => e?.new_status === 'CONFIRMED' ? '✅' : '📚',
  vendor_auto_route_enabled: '🚀',
  email_invoice_processed: '📧',
  folder_watch_processed: '📁',
};

function getEmoji(event) {
  const e = EVENT_EMOJIS[event.event_type];
  if (typeof e === 'function') return e(event);
  return e || '📋';
}

function EntityRow({ entity, maxCount }) {
  const pct = maxCount > 0 ? (entity.invoice_count / maxCount) * 100 : 0;
  const accuracy = entity.routing_accuracy ?? entity.accuracy ?? 100;

  return (
    <div className="flex items-center gap-4 py-3 border-b border-cobalt/40 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-ivory text-sm font-medium truncate">{entity.name}</span>
          <EntityBadge vertical={entity.vertical || entity.entity_type || 'default'} className="text-[10px]" />
        </div>
        <div className="h-1.5 bg-cobalt rounded-full mt-2 overflow-hidden max-w-xs">
          <div
            className="h-full bg-teal rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-gold font-bold text-lg">{entity.invoice_count || 0}</p>
        <p className="text-silver text-xs">invoices</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-ivory font-semibold text-sm">{formatCurrency(entity.total_amount)}</p>
        <p className="text-silver text-xs">total</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`font-semibold text-sm ${accuracy >= 95 ? 'text-green-400' : accuracy >= 80 ? 'text-gold' : 'text-orange-400'}`}>
          {accuracy}%
        </p>
        <p className="text-silver text-xs">accuracy</p>
      </div>
    </div>
  );
}

export default function Intelligence() {
  const { vendors, loading: vLoading, error: vError } = useVendors();
  const { data: dashData } = useDashboard(30000);
  const [events, setEvents] = useState([]);
  const [eLoading, setELoading] = useState(true);

  useEffect(() => {
    client.get('/system-events')
      .then((r) => setEvents(Array.isArray(r.data) ? r.data : r.data.events || []))
      .catch(() => {})
      .finally(() => setELoading(false));
  }, []);

  const entities = dashData?.entities || dashData?.entity_stats || [];
  const maxCount = Math.max(...entities.map((e) => e.invoice_count || 0), 1);

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-cobalt to-navy rounded-xl border border-cobalt p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center">
            <Brain className="w-6 h-6 text-gold" />
          </div>
          <h1 className="text-xl font-bold text-ivory">The system learns from every invoice.</h1>
        </div>
        <p className="text-silver">Watch it get smarter.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* LEFT: Vendor Intelligence */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-bold text-ivory uppercase tracking-wide">Vendor Intelligence</h2>
            <p className="text-silver text-xs mt-1">The system builds a profile for every vendor it encounters.</p>
          </div>

          {vLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : vError ? (
            <div className="bg-danger-bg border border-red-600 rounded-xl p-4 text-danger text-sm">{vError}</div>
          ) : vendors.length === 0 ? (
            <div className="bg-navy rounded-xl border border-cobalt p-8 text-center text-silver text-sm">
              No vendor profiles yet. Process some invoices to start building intelligence.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
              {vendors.map((v, i) => (
                <motion.div
                  key={v.id || v.canonical_name || i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <VendorCard vendor={v} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Entity Intelligence */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-bold text-ivory uppercase tracking-wide">Entity Intelligence</h2>
            <p className="text-silver text-xs mt-1">Routing volume and accuracy across all 12 entities.</p>
          </div>

          <div className="bg-navy rounded-xl border border-cobalt shadow-lg p-5">
            {entities.length === 0 ? (
              <p className="text-silver text-sm text-center py-8">No entity data yet</p>
            ) : (
              <div className="flex flex-col divide-y divide-cobalt/30">
                {entities.map((e, i) => (
                  <EntityRow key={i} entity={e} maxCount={maxCount} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Learning Timeline */}
      <div>
        <h2 className="text-sm font-bold text-ivory uppercase tracking-wide mb-4">Learning Timeline</h2>
        <div className="bg-navy rounded-xl border border-cobalt shadow-lg p-5">
          {eLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-silver text-sm text-center py-8">No events yet — process some invoices to see the system learn.</p>
          ) : (
            <div className="flex flex-col gap-0 max-h-96 overflow-y-auto">
              {events.map((event, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-start gap-3 py-3 border-b border-cobalt/30 last:border-0"
                >
                  <span className="text-base shrink-0 w-6 text-center mt-0.5">{getEmoji(event)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-ivory text-sm leading-snug">{event.description || event.message}</p>
                    {event.vendor_name && (
                      <p className="text-silver text-xs mt-0.5">{event.vendor_name}</p>
                    )}
                  </div>
                  <span className="text-steel text-xs shrink-0 whitespace-nowrap">
                    {timeAgo(event.created_at || event.timestamp)}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
