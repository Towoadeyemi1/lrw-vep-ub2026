import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Building2, X, Copy, Check, ExternalLink, ClipboardCheck, Upload } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { useVendors } from '../hooks/useVendors';
import { useDashboard } from '../hooks/useDashboard';
import { VendorCard } from '../components/Vendor/VendorCard';
import { StatusBadge } from '../components/Vendor/StatusBadge';
import { EntityBadge } from '../components/Common/EntityBadge';
import client from '../api/client';

document.title = 'Intelligence | Invoice Routing Intelligence';

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

function ConfirmationDots({ count, max = 3 }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`text-base ${i < count ? 'text-gold' : 'text-steel'}`}>●</span>
      ))}
      <span className="text-xs text-silver ml-1">{count}/{max}</span>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }, [text]);

  return (
    <div className="relative inline-flex">
      <button
        onClick={handleCopy}
        className="p-1 text-steel hover:text-gold transition-colors"
        title="Copy to clipboard"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-green-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none"
          >
            Copied!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VendorDrawer({ vendor, onClose }) {
  const navigate = useNavigate();
  const [hasPending, setHasPending] = useState(false);

  const confidenceHistory = vendor?.confidence_history || [];
  const chartData = confidenceHistory.map((v, i) => ({ i, v }));
  const rawNames = vendor?.raw_names || vendor?.name_variants || [];

  const status = (vendor.status || 'new').toLowerCase();
  const isAutoRoute = status === 'auto_route';
  const confirmations = vendor.confirmation_count || 0;
  const threshold = vendor.auto_route_threshold || 3;
  const remaining = Math.max(0, threshold - confirmations);

  useEffect(() => {
    if (isAutoRoute) return;
    client.get('/review-queue')
      .then((r) => {
        const items = Array.isArray(r.data) ? r.data : [];
        const canonical = (vendor.canonical_name || vendor.name || '').toLowerCase();
        setHasPending(items.some((item) => {
          const v = (item.vendor_name || '').toLowerCase();
          return v === canonical || v.includes(canonical) || canonical.includes(v);
        }));
      })
      .catch(() => {});
  }, [vendor, isAutoRoute]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-midnight/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <motion.div
        initial={{ x: 480 }}
        animate={{ x: 0 }}
        exit={{ x: 480 }}
        transition={{ type: 'spring', stiffness: 320, damping: 35 }}
        className="fixed top-0 right-0 z-50 h-full w-full max-w-[480px] bg-navy border-l border-cobalt shadow-2xl overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-cobalt shrink-0 bg-navy sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-cobalt flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-gold" />
            </div>
            <div className="min-w-0">
              <h2 className="text-ivory font-bold text-sm truncate">{vendor.canonical_name || vendor.name}</h2>
              <p className="text-silver text-xs">{vendor.category || 'Uncategorized'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-silver hover:text-ivory transition-colors shrink-0"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 flex flex-col gap-6">
          {/* Status + routing */}
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={vendor.status || 'NEW'} />
            {vendor.default_entity && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-silver">Routes to:</span>
                <EntityBadge vertical={vendor.default_entity_vertical || 'default'} />
                <span className="text-ivory font-medium">{vendor.default_entity}</span>
              </div>
            )}
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-midnight/40 rounded-lg p-3">
              <p className="text-steel mb-1">First Seen</p>
              <p className="text-ivory">{timeAgo(vendor.first_seen || vendor.created_at)}</p>
            </div>
            <div className="bg-midnight/40 rounded-lg p-3">
              <p className="text-steel mb-1">Last Seen</p>
              <p className="text-ivory">{timeAgo(vendor.last_seen || vendor.updated_at)}</p>
            </div>
            <div className="bg-midnight/40 rounded-lg p-3">
              <p className="text-steel mb-1">Invoice Count</p>
              <p className="text-ivory font-semibold">{vendor.invoice_count || 0}</p>
            </div>
            <div className="bg-midnight/40 rounded-lg p-3">
              <p className="text-steel mb-1">Avg Amount</p>
              <p className="text-ivory font-semibold">{formatCurrency(vendor.average_amount)}</p>
            </div>
          </div>

          {/* Confirmations */}
          <div>
            <p className="text-silver text-xs uppercase font-medium mb-2">Confirmations</p>
            <ConfirmationDots count={vendor.confirmation_count || 0} max={3} />
            {vendor.default_entity && (
              <p className="text-xs text-silver mt-2">
                Confirmed entity: <span className="text-ivory font-medium">{vendor.default_entity}</span>
              </p>
            )}
          </div>

          {/* Confidence trend */}
          {chartData.length > 1 && (
            <div>
              <p className="text-silver text-xs uppercase font-medium mb-3">Confidence Trend</p>
              <div className="h-24 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip
                      contentStyle={{ background: '#0d1b2a', border: '1px solid #1e3a5f', borderRadius: 8 }}
                      labelStyle={{ display: 'none' }}
                      itemStyle={{ color: '#D4A820' }}
                      formatter={(v) => [`${v}%`, 'Confidence']}
                    />
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke="#D4A820"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#D4A820' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Raw names */}
          {rawNames.length > 0 && (
            <div>
              <p className="text-silver text-xs uppercase font-medium mb-2">Name Variants Seen</p>
              <div className="flex flex-col gap-1">
                {rawNames.map((n, i) => (
                  <p key={i} className="text-ivory text-xs font-mono bg-midnight/40 px-3 py-1.5 rounded">{n}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer — contextual action based on vendor state */}
        <div className="px-6 py-4 border-t border-cobalt shrink-0 bg-navy sticky bottom-0 flex flex-col gap-2">
          {isAutoRoute ? (
            <button
              onClick={() => { navigate(`/audit?vendor=${encodeURIComponent(vendor.canonical_name || vendor.name)}`); onClose(); }}
              className="flex items-center gap-2 w-full justify-center bg-cobalt hover:bg-slate text-ivory text-sm font-medium py-2.5 rounded-xl transition-colors border border-cobalt"
            >
              <ExternalLink className="w-4 h-4 text-gold" />
              View Invoice History
            </button>
          ) : hasPending ? (
            <>
              <button
                onClick={() => { navigate('/review'); onClose(); }}
                className="flex items-center gap-2 w-full justify-center bg-gold hover:bg-amber text-midnight text-sm font-bold py-2.5 rounded-xl transition-colors"
              >
                <ClipboardCheck className="w-4 h-4" />
                Review Pending Invoice
                <span className="text-xs opacity-70 font-medium">— {remaining} more to auto-route</span>
              </button>
              <button
                onClick={() => { navigate(`/audit?vendor=${encodeURIComponent(vendor.canonical_name || vendor.name)}`); onClose(); }}
                className="flex items-center gap-1.5 w-full justify-center text-steel hover:text-silver text-xs py-1 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> View History
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { navigate('/process'); onClose(); }}
                className="flex items-center gap-2 w-full justify-center bg-gold hover:bg-amber text-midnight text-sm font-bold py-2.5 rounded-xl transition-colors"
              >
                <Upload className="w-4 h-4" />
                Process Another Invoice
                <span className="text-xs opacity-70 font-medium">— {remaining} more to auto-route</span>
              </button>
              <button
                onClick={() => { navigate(`/audit?vendor=${encodeURIComponent(vendor.canonical_name || vendor.name)}`); onClose(); }}
                className="flex items-center gap-1.5 w-full justify-center text-steel hover:text-silver text-xs py-1 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> View History
              </button>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
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
      {/* Copy routing email */}
      {entity.routing_email && (
        <div className="flex items-center gap-1 text-xs shrink-0">
          <span className="text-steel font-mono">{entity.routing_email}</span>
          <CopyButton text={entity.routing_email} />
        </div>
      )}
    </div>
  );
}

export default function Intelligence() {
  const { vendors, loading: vLoading, error: vError } = useVendors();
  const { data: dashData } = useDashboard(30000);
  const [events, setEvents] = useState([]);
  const [eLoading, setELoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);

  useEffect(() => {
    document.title = 'Intelligence | Invoice Routing Intelligence';
    client.get('/system-events')
      .then((r) => setEvents(Array.isArray(r.data) ? r.data : r.data.events || []))
      .catch(() => {})
      .finally(() => setELoading(false));
  }, []);

  const entities = dashData?.entities || dashData?.entity_stats || [];
  const maxCount = Math.max(...entities.map((e) => e.invoice_count || 0), 1);

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Vendor drawer */}
      <AnimatePresence>
        {selectedVendor && (
          <VendorDrawer
            vendor={selectedVendor}
            onClose={() => setSelectedVendor(null)}
          />
        )}
      </AnimatePresence>

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
            <p className="text-silver text-xs mt-1">Click any vendor card to see its full profile.</p>
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
                  className="cursor-pointer"
                  onClick={() => setSelectedVendor(v)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
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
            <p className="text-silver text-xs mt-1">Routing volume and accuracy across all 50 entities.</p>
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
