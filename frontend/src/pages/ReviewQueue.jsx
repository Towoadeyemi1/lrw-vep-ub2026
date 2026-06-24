import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { useToast } from '../components/Common/Toast';
import { StatusBadge } from '../components/Vendor/StatusBadge';
import client from '../api/client';

const ENTITIES = [
  'Grand Luxe Hotel Group',
  'Bayshore Resort Collection',
  'Summit Conference Centers',
  'Urban Boutique Hotels',
  'Coastal Property Management',
  'Metro Real Estate Holdings',
  'Suburban Development Corp',
  'Industrial Warehouse Group',
  'Harmony Wellness Centers',
  'Peak Performance Gyms',
  'MindBody Spa Collection',
  'Nutrition & Health Clinics',
];

function formatCurrency(v) {
  if (!v && v !== 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
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

function PendingCard({ item, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const [otherEntity, setOtherEntity] = useState('');
  const candidates = item.top_candidates || item.candidates || [];

  const confirm = async (entityId) => {
    setConfirming(true);
    try {
      await onConfirm(item.id, entityId);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="bg-navy rounded-xl border border-cobalt shadow-lg overflow-hidden"
    >
      <div className="bg-cobalt/30 px-5 py-4 border-b border-cobalt flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-ivory font-bold">{item.vendor_name || item.vendor}</h3>
          <p className="text-silver text-xs mt-0.5">Received: {timeAgo(item.received_at || item.created_at)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gold font-bold text-lg">{formatCurrency(item.amount)}</span>
          <span className="text-xs text-silver">
            {item.confidence_score || 0}% confidence — Tier {item.tier_used || item.tier}
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {item.reasoning && (
          <div className="bg-midnight/50 rounded-lg p-4 border border-cobalt">
            <p className="text-xs text-silver uppercase font-medium mb-1">AI Reasoning</p>
            <p className="text-ivory/80 text-sm leading-relaxed">{item.reasoning}</p>
          </div>
        )}

        {candidates.length > 0 && (
          <div>
            <p className="text-xs text-silver uppercase font-medium mb-3">Top Candidates</p>
            <div className="flex flex-col gap-2">
              {candidates.map((c, i) => (
                <div key={i} className="flex items-center gap-3 bg-cobalt/20 rounded-lg p-3">
                  <div className="flex-1">
                    <p className="text-ivory text-sm font-medium">{c.entity_name || c.name}</p>
                    <div className="h-1.5 bg-cobalt rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-gold rounded-full"
                        style={{ width: `${c.confidence_score || c.score || 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-gold text-sm font-semibold w-12 text-right shrink-0">
                    {c.confidence_score || c.score || 0}%
                  </span>
                  <button
                    onClick={() => confirm(c.entity_id || c.id || c.entity_name || c.name)}
                    disabled={confirming}
                    className="bg-gold hover:bg-amber text-midnight text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                  >
                    Route →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <select
            value={otherEntity}
            onChange={(e) => setOtherEntity(e.target.value)}
            className="flex-1 bg-midnight border border-cobalt rounded-lg px-3 py-2 text-sm text-ivory focus:outline-none focus:border-gold/50"
          >
            <option value="">Route to another entity...</option>
            {ENTITIES.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          {otherEntity && (
            <button
              onClick={() => confirm(otherEntity)}
              disabled={confirming}
              className="bg-cobalt hover:bg-slate text-ivory text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Confirm
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ResolvedCard({ item }) {
  return (
    <div className="flex items-center gap-4 py-3 px-5 bg-navy/50 rounded-lg border border-cobalt/40 opacity-60">
      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-ivory text-sm font-medium truncate">{item.vendor_name || item.vendor}</p>
        <p className="text-silver text-xs">Routed to: {item.confirmed_entity || item.entity_name}</p>
      </div>
      <span className="text-gold text-sm">{formatCurrency(item.amount)}</span>
      <div className="text-right">
        <p className="text-steel text-xs">{item.confirmed_by || 'demo-user'}</p>
        <p className="text-steel text-xs">{timeAgo(item.confirmed_at || item.updated_at)}</p>
      </div>
    </div>
  );
}

export default function ReviewQueue() {
  const [pending, setPending] = useState([]);
  const [resolved, setResolved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vendorStatuses, setVendorStatuses] = useState({});
  const { addToast } = useToast();

  const fetchQueue = useCallback(async () => {
    try {
      const res = await client.get('/review-queue');
      const data = res.data;
      if (Array.isArray(data)) {
        setPending(data.filter((i) => !i.confirmed_at && !i.resolved));
        setResolved(data.filter((i) => i.confirmed_at || i.resolved));
      } else {
        setPending(data.pending || data.items || []);
        setResolved(data.resolved || []);
      }
      setError(null);
    } catch (err) {
      setError(err.displayMessage || 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const id = setInterval(fetchQueue, 10000);
    return () => clearInterval(id);
  }, [fetchQueue]);

  const handleConfirm = async (itemId, entityId) => {
    try {
      const res = await client.post(`/review-queue/${itemId}/confirm`, {
        entity_id: entityId,
        confirmed_by: 'demo-user',
      });
      const updatedStatus = res.data?.vendor_status || res.data?.new_vendor_status;
      const vendorName = res.data?.vendor_name || res.data?.vendor;

      // Update local status badge
      if (vendorName && updatedStatus) {
        setVendorStatuses((prev) => ({ ...prev, [vendorName]: updatedStatus }));
        if (updatedStatus === 'AUTO-ROUTE') {
          addToast(`🚀 ${vendorName} will now route automatically!`, 'success', 6000);
        } else {
          addToast(`Invoice routed to ${entityId}`, 'success');
        }
      } else {
        addToast(`Invoice routed to ${entityId}`, 'success');
      }

      await fetchQueue();
    } catch (err) {
      addToast(err.displayMessage || 'Failed to confirm routing', 'error');
    }
  };

  if (loading && pending.length === 0 && resolved.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-danger-bg border border-red-600 rounded-xl p-6 text-danger text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {pending.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-20 gap-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          >
            <CheckCircle className="w-16 h-16 text-green-400" />
          </motion.div>
          <h2 className="text-ivory text-xl font-semibold">All clear</h2>
          <p className="text-silver text-sm">No invoices awaiting review</p>
        </motion.div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-silver uppercase tracking-wide">
              Pending Review ({pending.length})
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            <AnimatePresence>
              {pending.map((item) => (
                <PendingCard
                  key={item.id}
                  item={{ ...item, vendor_status: vendorStatuses[item.vendor_name || item.vendor] || item.vendor_status }}
                  onConfirm={handleConfirm}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-silver uppercase tracking-wide mb-3">
            Resolved ({resolved.length})
          </h2>
          <div className="flex flex-col gap-2">
            {resolved.slice(0, 20).map((item, i) => (
              <ResolvedCard key={i} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
