import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, ChevronDown, ChevronUp, Globe, Mail, Folder, FlaskConical } from 'lucide-react';
import { useInvoices } from '../hooks/useInvoices';
import { useToast } from '../components/Common/Toast';
import client from '../api/client';

function formatCurrency(v) {
  if (!v && v !== 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

function formatDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function SourceBadge({ source }) {
  const cfg = {
    web: { label: 'Web Upload', icon: Globe, cls: 'bg-info-bg text-info' },
    email: { label: 'Email', icon: Mail, cls: 'bg-cobalt/40 text-blue-300' },
    folder: { label: 'Folder', icon: Folder, cls: 'bg-cobalt/40 text-blue-300' },
    sample: { label: 'Sample', icon: FlaskConical, cls: 'bg-success-bg text-success' },
  };
  const s = source?.toLowerCase() || 'web';
  const { label, icon: Icon, cls } = cfg[s] || cfg.web;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function ConfidenceBadge({ score }) {
  let cls = 'bg-red-900/40 text-red-300';
  if (score >= 90) cls = 'bg-success/20 text-green-300';
  else if (score >= 70) cls = 'bg-amber/20 text-gold';
  else if (score >= 50) cls = 'bg-orange-900/40 text-orange-300';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded ${cls}`}>{score}%</span>;
}

function StatusBadge({ status }) {
  const cls = {
    auto_routed: 'bg-success/20 text-green-300',
    routed: 'bg-success/20 text-green-300',
    held_for_review: 'bg-warning-bg text-warning',
    escalated: 'bg-danger-bg text-danger',
    pending: 'bg-steel/30 text-silver',
  }[status?.toLowerCase()] || 'bg-steel/30 text-silver';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${cls}`}>
      {(status || '').replace(/_/g, ' ')}
    </span>
  );
}

function ExpandedRow({ invoice }) {
  const fields = invoice.extracted_fields || invoice.extracted_data || {};
  const signals = invoice.matched_signals || invoice.signals || [];

  const sourceLabel = {
    web: '📤 Web Upload',
    email: '📧 Email',
    folder: '📁 Folder Watch',
    sample: '🧪 Sample',
  }[invoice.source?.toLowerCase()] || '📤 Web Upload';

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="px-4 pb-4 bg-midnight/40 grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 text-xs border-t border-cobalt">
        <div>
          <p className="text-silver uppercase font-medium mb-2">Extracted Fields</p>
          <div className="flex flex-col gap-1">
            {Object.entries(fields).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-steel capitalize w-24 shrink-0">{k.replace(/_/g, ' ')}:</span>
                <span className="text-ivory">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-silver uppercase font-medium mb-2">Matched Signals</p>
          <div className="flex flex-wrap gap-1.5">
            {signals.length > 0
              ? signals.map((s, i) => (
                  <span key={i} className="bg-cobalt text-cloud px-2 py-0.5 rounded text-xs">
                    {typeof s === 'string' ? s : s.signal || s.name || JSON.stringify(s)}
                  </span>
                ))
              : <span className="text-steel">—</span>
            }
          </div>
        </div>

        <div>
          <p className="text-silver uppercase font-medium mb-2">Details</p>
          <div className="flex flex-col gap-1.5">
            <div><span className="text-steel">Source:</span> <span className="text-ivory ml-1">{sourceLabel}</span></div>
            {invoice.reasoning && (
              <div>
                <p className="text-steel mb-1">AI Reasoning:</p>
                <p className="text-ivory/80 leading-relaxed">{invoice.reasoning}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AuditLog() {
  const [expandedId, setExpandedId] = useState(null);
  const { addToast } = useToast();
  const {
    invoices, loading, error, total, page, totalPages, setPage, filters, setFilters
  } = useInvoices(20);

  const exportExcel = async () => {
    try {
      const res = await client.get('/export/excel', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoice-routing-report.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast('Export failed — try again', 'error');
    }
  };

  const toggleRow = (id) => setExpandedId(expandedId === id ? null : id);

  return (
    <div className="p-6 flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2 flex-1">
          <select
            value={filters.entity}
            onChange={(e) => setFilters((f) => ({ ...f, entity: e.target.value }))}
            className="bg-navy border border-cobalt text-silver text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-gold/50"
          >
            <option value="">All Entities</option>
            {['Grand Luxe Hotel Group','Bayshore Resort Collection','Summit Conference Centers','Urban Boutique Hotels',
              'Coastal Property Management','Metro Real Estate Holdings','Suburban Development Corp','Industrial Warehouse Group',
              'Harmony Wellness Centers','Peak Performance Gyms','MindBody Spa Collection','Nutrition & Health Clinics',
            ].map((e) => <option key={e} value={e}>{e}</option>)}
          </select>

          <select
            value={filters.tier}
            onChange={(e) => setFilters((f) => ({ ...f, tier: e.target.value }))}
            className="bg-navy border border-cobalt text-silver text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-gold/50"
          >
            <option value="">All Tiers</option>
            {['1','2','3'].map((t) => <option key={t} value={t}>Tier {t}</option>)}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="bg-navy border border-cobalt text-silver text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-gold/50"
          >
            <option value="">All Statuses</option>
            {['auto_routed','held_for_review','escalated','pending'].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <select
            value={filters.source}
            onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
            className="bg-navy border border-cobalt text-silver text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-gold/50"
          >
            <option value="">All Sources</option>
            {['web','email','folder','sample'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <button
          onClick={exportExcel}
          className="flex items-center gap-2 bg-gold hover:bg-amber text-midnight font-bold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" /> Export to Excel
        </button>
      </div>

      {/* Table */}
      <div className="bg-navy rounded-xl border border-cobalt shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cobalt bg-cobalt/20">
                {['Time','Vendor','Amount','Entity','Confidence','Tier','Status','Source',''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-silver font-semibold uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-silver">
                    <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-red-400 text-sm">{error}</td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-silver">No invoices found</td>
                </tr>
              ) : (
                invoices.map((inv, i) => (
                  <>
                    <tr
                      key={inv.id || i}
                      onClick={() => toggleRow(inv.id || i)}
                      className="border-b border-cobalt/40 hover:bg-cobalt/10 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-silver whitespace-nowrap text-xs">{formatDate(inv.created_at || inv.timestamp)}</td>
                      <td className="px-4 py-3 text-ivory font-medium max-w-[160px] truncate">{inv.vendor_name || inv.vendor}</td>
                      <td className="px-4 py-3 text-gold font-semibold whitespace-nowrap">{formatCurrency(inv.amount)}</td>
                      <td className="px-4 py-3 text-ivory max-w-[160px] truncate">{inv.entity_name || inv.entity}</td>
                      <td className="px-4 py-3"><ConfidenceBadge score={inv.confidence_score || inv.confidence || 0} /></td>
                      <td className="px-4 py-3 text-silver text-xs">T{inv.tier_used || inv.tier}</td>
                      <td className="px-4 py-3"><StatusBadge status={inv.status || inv.routing_decision} /></td>
                      <td className="px-4 py-3"><SourceBadge source={inv.source} /></td>
                      <td className="px-4 py-3 text-steel">
                        {expandedId === (inv.id || i) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expandedId === (inv.id || i) && (
                        <tr key={`${inv.id || i}-expanded`}>
                          <td colSpan={9} className="p-0">
                            <ExpandedRow invoice={inv} />
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-silver text-xs">
            Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total} invoices
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-navy border border-cobalt text-silver hover:text-ivory disabled:opacity-40 transition-colors text-xs"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-silver text-xs">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg bg-navy border border-cobalt text-silver hover:text-ivory disabled:opacity-40 transition-colors text-xs"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
