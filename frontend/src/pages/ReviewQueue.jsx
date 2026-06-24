import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Eye, X, FileText, Brain, GitBranch, Hash, Calendar, Tag } from 'lucide-react';
import { useToast } from '../components/Common/Toast';
import { ConfettiEffect } from '../components/Common/ConfettiEffect';
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

function parseLineItem(li) {
  if (typeof li === 'string') {
    const raw = li.replace(/^["']|["']$/g, '').trim();
    const amtMatch = raw.match(/:\s*\$([0-9,]+(?:\.\d+)?)["']?\s*$/);
    if (amtMatch) {
      const amount = parseFloat(amtMatch[1].replace(/,/g, ''));
      const description = raw.slice(0, raw.lastIndexOf(amtMatch[0])).replace(/:\s*$/, '').trim();
      return { description, amount };
    }
    return { description: raw, amount: null };
  }
  const description = li.description || li.name || li.item || '';
  let amount = li.amount ?? li.total ?? li.price ?? null;
  if (amount == null && description) {
    const m = description.match(/:\s*\$([0-9,]+(?:\.\d+)?)\s*$/);
    if (m) amount = parseFloat(m[1].replace(/,/g, ''));
  }
  return { description: description || JSON.stringify(li), amount };
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

function AnimatedCheckmark() {
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24" fill="none">
      <motion.circle
        cx="50"
        cy="50"
        r="45"
        stroke="#4ade80"
        strokeWidth="5"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
      <motion.path
        d="M28 50 L44 66 L72 38"
        stroke="#4ade80"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5, ease: 'easeOut' }}
      />
    </svg>
  );
}

function EmptyState() {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 gap-5"
    >
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 22 }}
      >
        <AnimatedCheckmark />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex flex-col items-center gap-2"
      >
        <h2 className="text-gold text-2xl font-bold">All Clear</h2>
        <p className="text-silver text-sm">No invoices awaiting review</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <button
          onClick={() => navigate('/process')}
          className="flex items-center gap-2 text-gold border border-gold/40 hover:bg-gold/10 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors mt-2"
        >
          Process an Invoice →
        </button>
      </motion.div>
    </motion.div>
  );
}

function InvoiceDetailModal({ item, onClose }) {
  const ex = item.extracted_data || {};
  const lineItems = item.line_items || ex.line_items || [];
  const signals = item.signals_matched || [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-navy border border-cobalt rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-cobalt shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <FileText className="w-4 h-4 text-gold shrink-0" />
              <h2 className="text-ivory font-bold">{item.vendor_name || item.vendor}</h2>
            </div>
            <p className="text-silver text-xs">{item.invoice_filename || 'Invoice document'}</p>
          </div>
          <button onClick={onClose} className="text-steel hover:text-ivory transition-colors mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-5">

          {/* Key fields */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: Tag, label: 'Amount', value: item.amount != null ? `$${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null },
              { icon: Hash, label: 'Invoice #', value: item.invoice_number || ex.invoice_number },
              { icon: Calendar, label: 'Date', value: item.invoice_date || ex.invoice_date },
              { icon: Hash, label: 'PO Number', value: item.po_number || ex.po_number },
              { icon: GitBranch, label: 'Tier', value: item.tier_used ? `Tier ${item.tier_used.replace(/\D/g, '')}` : null },
              { icon: Brain, label: 'Confidence', value: item.confidence_score != null ? `${Math.round(item.confidence_score * 100)}%` : null },
            ].filter((f) => f.value).map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-cobalt/20 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3 h-3 text-silver" />
                  <span className="text-steel text-[10px] uppercase font-medium tracking-wide">{label}</span>
                </div>
                <p className="text-ivory text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>

          {/* Extracted address / billing info */}
          {(ex.vendor_address || ex.billing_address || ex.vendor_contact) && (
            <div className="bg-cobalt/10 border border-cobalt/40 rounded-xl p-4">
              <p className="text-xs text-silver uppercase font-medium tracking-wide mb-2">Vendor & Billing</p>
              <div className="flex flex-col gap-1.5 text-sm">
                {ex.vendor_address && <p className="text-ivory/80"><span className="text-silver">Vendor: </span>{ex.vendor_address}</p>}
                {ex.billing_address && <p className="text-ivory/80"><span className="text-silver">Bill To: </span>{ex.billing_address}</p>}
                {ex.vendor_contact && <p className="text-ivory/80"><span className="text-silver">Contact: </span>{ex.vendor_contact}</p>}
              </div>
            </div>
          )}

          {/* Line items */}
          {lineItems.length > 0 && (
            <div>
              <p className="text-xs text-silver uppercase font-medium tracking-wide mb-2">Line Items</p>
              <div className="border border-cobalt/40 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-cobalt/20 text-steel text-xs uppercase tracking-wide">
                      <th className="text-left px-3 py-2 font-medium">Description</th>
                      <th className="text-right px-3 py-2 font-medium w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((li, i) => {
                      const { description, amount } = parseLineItem(li);
                      return (
                        <tr key={i} className="border-t border-cobalt/20 hover:bg-cobalt/10">
                          <td className="px-3 py-2 text-ivory/90">{description}</td>
                          <td className="px-3 py-2 text-gold text-right font-medium">
                            {amount != null ? `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Reasoning */}
          <div className="bg-cobalt/10 border border-cobalt/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-3.5 h-3.5 text-gold" />
              <p className="text-xs text-silver uppercase font-medium tracking-wide">AI Reasoning</p>
            </div>
            {item.llm_reasoning ? (
              <p className="text-ivory/80 text-sm leading-relaxed">{item.llm_reasoning}</p>
            ) : (
              <p className="text-steel text-sm italic">
                {item.tier_used
                  ? `Routed via ${item.tier_used} — no Claude AI analysis for this invoice (confidence was sufficient without it).`
                  : 'No AI analysis recorded for this invoice.'}
              </p>
            )}
          </div>

          {/* Signals matched */}
          {signals.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <GitBranch className="w-3.5 h-3.5 text-gold" />
                <p className="text-xs text-silver uppercase font-medium tracking-wide">Classification Signals</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {signals.map((sig, i) => (
                  <span key={i} className="text-xs bg-cobalt/30 border border-cobalt/60 text-ivory/80 px-2.5 py-1 rounded-full">
                    {typeof sig === 'string' ? sig : sig.signal || sig.name || JSON.stringify(sig)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Fallback: raw extracted_data dump if nothing else rendered */}
          {!item.llm_reasoning && lineItems.length === 0 && signals.length === 0 && Object.keys(ex).length > 0 && (
            <div>
              <p className="text-xs text-silver uppercase font-medium tracking-wide mb-2">Extracted Fields</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(ex).filter(([, v]) => v != null && v !== '' && !Array.isArray(v) && typeof v !== 'object').map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-sm">
                    <span className="text-silver shrink-0">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-ivory/80">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-cobalt shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-cobalt text-silver hover:text-ivory hover:bg-cobalt/20 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PendingCard({ item, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const [otherEntity, setOtherEntity] = useState('');
  const [showDetail, setShowDetail] = useState(false);
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
    <>
      <AnimatePresence>
        {showDetail && <InvoiceDetailModal item={item} onClose={() => setShowDetail(false)} />}
      </AnimatePresence>

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
            {item.confidence_score != null ? `${Math.round(item.confidence_score * 100)}%` : '0%'} confidence — Tier {item.tier_used || item.tier}
          </span>
          <button
            onClick={() => setShowDetail(true)}
            title="View invoice details"
            className="flex items-center gap-1.5 text-xs text-gold font-semibold border border-gold/60 hover:bg-gold/15 hover:border-gold px-3 py-1.5 rounded-lg transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </button>
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
    </>
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
  const [confettiTrigger, setConfettiTrigger] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    document.title = 'Review Queue | Invoice Routing Intelligence';
  }, []);

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

      if (vendorName && updatedStatus) {
        setVendorStatuses((prev) => ({ ...prev, [vendorName]: updatedStatus }));
        if (updatedStatus === 'AUTO-ROUTE' || updatedStatus === 'auto_route') {
          addToast(`🚀 ${vendorName} will now route automatically!`, 'success', 6000);
          setConfettiTrigger(false);
          setTimeout(() => setConfettiTrigger(true), 50);
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
      <ConfettiEffect trigger={confettiTrigger} />

      {pending.length === 0 ? (
        <EmptyState />
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
