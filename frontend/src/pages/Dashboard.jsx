import { useEffect, useState } from 'react';
import { FileText, TrendingUp, Clock, Building2, Folder, Mail, CheckCircle } from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';
import { MetricCard } from '../components/Common/MetricCard';
import { MetricCardSkeleton } from '../components/Common/Skeleton';
import { AnimatedCounter } from '../components/Common/AnimatedCounter';
import { ConfidenceChart } from '../components/Charts/ConfidenceChart';
import { TierChart } from '../components/Charts/TierChart';
import { EntityBadge } from '../components/Common/EntityBadge';
import { useToast } from '../components/Common/Toast';
import client from '../api/client';

function formatCurrency(amount) {
  if (!amount && amount !== 0) return '—';
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
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

function ConfidenceBadge({ score }) {
  let cls = 'bg-red-900/40 text-red-300';
  if (score >= 90) cls = 'bg-success/20 text-green-300';
  else if (score >= 70) cls = 'bg-amber/20 text-gold';
  else if (score >= 50) cls = 'bg-orange-900/40 text-orange-300';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{score}%</span>;
}

function TierBadge({ tier }) {
  const cfgs = {
    1: 'bg-blue-800 text-blue-200',
    2: 'bg-amber/30 text-gold',
    3: 'bg-orange-800 text-orange-200',
    human: 'bg-red-900 text-red-200',
  };
  return <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfgs[tier] || 'bg-steel text-cloud'}`}>T{tier}</span>;
}

function LearningEventRow({ event }) {
  const emojiMap = {
    vendor_profile_created: '🆕',
    vendor_status_change: event?.new_status === 'CONFIRMED' ? '✅' : '📚',
    vendor_auto_route_enabled: '🚀',
    email_invoice_processed: '📧',
    folder_watch_processed: '📁',
  };
  const emoji = emojiMap[event.event_type] || '📋';
  return (
    <div className="flex items-start gap-3 py-2 border-b border-cobalt/40 last:border-0">
      <span className="text-base shrink-0 mt-0.5">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-ivory text-xs leading-snug">{event.description || event.message}</p>
        <p className="text-steel text-xs mt-0.5">{timeAgo(event.created_at || event.timestamp)}</p>
      </div>
    </div>
  );
}

function EntityCard({ entity, maxVolume }) {
  const pct = maxVolume > 0 ? (entity.invoice_count / maxVolume) * 100 : 0;
  return (
    <div className="bg-navy rounded-xl border border-cobalt p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-ivory text-xs font-semibold truncate">{entity.name}</span>
        <EntityBadge vertical={entity.vertical || entity.entity_type || 'default'} className="text-[10px] py-0" />
      </div>
      <div className="flex items-center justify-between text-xs text-silver mb-2">
        <span>{entity.invoice_count || 0} invoices</span>
        <span>{formatCurrency(entity.total_amount)}</span>
      </div>
      <div className="h-1.5 bg-cobalt rounded-full overflow-hidden">
        <div className="h-full bg-teal rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function WatchFolderPanel({ data }) {
  const folders = data?.vendor_folders || [];
  return (
    <div className="bg-navy rounded-xl border border-cobalt shadow-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-gold" />
          <span className="text-sm font-semibold text-ivory uppercase tracking-wide">Folder Watch — Live</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          ACTIVE
        </span>
      </div>
      <div className="bg-midnight/60 rounded-lg p-3 mb-3 font-mono text-xs text-silver">
        <p className="text-steel">Incoming:</p>
        <p className="text-ivory">/watched/incoming/</p>
        <p className="text-steel mt-1">Drop invoice files here → auto-processed instantly</p>
      </div>
      {folders.length > 0 && (
        <div>
          <p className="text-xs text-silver mb-2 uppercase tracking-wide font-medium">Processed Vendor Folders</p>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {folders.map((f, i) => (
              <div key={i} className="text-xs text-ivory font-mono bg-midnight/40 px-2 py-1 rounded">📂 {f}</div>
            ))}
          </div>
        </div>
      )}
      <button className="mt-3 w-full bg-cobalt hover:bg-slate text-silver hover:text-ivory text-xs font-medium py-2 rounded-lg transition-colors border border-cobalt">
        Drop Test Invoice
      </button>
    </div>
  );
}

function EmailWatchPanel({ data }) {
  const { addToast } = useToast();
  const email = data?.email_watch_address || 'invoices.inspirationtechcorp@gmail.com';
  const lastChecked = data?.email_last_checked;
  const processed = data?.emails_processed || 0;
  const secAgo = lastChecked ? Math.round((Date.now() - new Date(lastChecked)) / 1000) : null;
  const [sending, setSending] = useState(false);

  const handleSendTest = async () => {
    setSending(true);
    try {
      await client.post('/watch-folder/test');
      addToast('Test invoice submitted — watch the dashboard update in ~5 seconds', 'success', 6000);
    } catch {
      addToast('Failed to submit test invoice — check the server', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-navy rounded-xl border border-cobalt shadow-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-gold" />
          <span className="text-sm font-semibold text-ivory uppercase tracking-wide">Email Watch — Live</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          ACTIVE
        </span>
      </div>
      <div className="bg-midnight/60 rounded-lg p-3 mb-3 text-xs">
        <p className="text-silver">Monitoring:</p>
        <p className="text-gold font-mono">{email}</p>
        {secAgo !== null && (
          <p className="text-steel mt-2">Last checked: {secAgo}s ago</p>
        )}
        <p className="text-silver mt-1">Emails processed: <span className="text-ivory font-semibold">{processed}</span></p>
      </div>
      <div className="bg-cobalt/30 border border-cobalt rounded-lg p-3 mb-3">
        <p className="text-xs text-silver mb-1">Send invoices to:</p>
        <p className="text-gold font-mono text-xs font-semibold">{email}</p>
      </div>
      <button
        onClick={handleSendTest}
        disabled={sending}
        className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-amber disabled:opacity-60 text-midnight text-xs font-bold py-2 rounded-lg transition-colors"
      >
        {sending ? (
          <>
            <div className="w-3 h-3 border-2 border-midnight border-t-transparent rounded-full animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail className="w-3.5 h-3.5" />
            Send Test Invoice
          </>
        )}
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { data, loading, error } = useDashboard(5000);
  const [events, setEvents] = useState([]);
  const [watchData, setWatchData] = useState(null);

  useEffect(() => {
    document.title = 'Dashboard | Invoice Routing Intelligence';
  }, []);

  useEffect(() => {
    client.get('/system-events').then((r) => setEvents(Array.isArray(r.data) ? r.data : r.data.events || [])).catch(() => {});
    client.get('/watch-folder/status').then((r) => setWatchData(r.data)).catch(() => {});
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <MetricCardSkeleton />
        <div className="flex items-center justify-center h-32">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
            <p className="text-silver text-sm">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-danger-bg border border-red-600 rounded-xl p-6 text-danger text-sm">
        <strong>Could not load dashboard:</strong> {error}
      </div>
    );
  }

  const metrics = data?.metrics || data || {};
  const autoRoutePct = metrics.auto_route_percentage || metrics.auto_routed_percentage || 0;
  const autoRouteColor = autoRoutePct >= 90 ? 'text-green-400' : autoRoutePct >= 70 ? 'text-gold' : 'text-red-400';

  const recentDecisions = data?.recent_decisions || data?.recent_invoices || [];
  const entities = data?.entities || data?.entity_stats || [];
  const maxVol = Math.max(...entities.map((e) => e.invoice_count || 0), 1);

  const totalProcessed = metrics.total_processed || metrics.total_invoices || 0;
  const pendingReview = metrics.pending_review || metrics.pending_count || 0;
  const knownVendors = metrics.known_vendors || metrics.vendor_count || 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Total Processed"
          value={<AnimatedCounter value={totalProcessed} />}
          icon={FileText}
          subLabel="invoices processed"
        />
        <MetricCard
          label="Auto-Routed"
          value={<AnimatedCounter value={autoRoutePct} suffix="%" decimals={0} />}
          icon={TrendingUp}
          valueColor={autoRouteColor}
          subLabel="of all invoices"
        />
        <MetricCard
          label="Pending Review"
          value={<AnimatedCounter value={pendingReview} />}
          icon={Clock}
          valueColor={pendingReview > 0 ? 'text-red-400' : 'text-green-400'}
          subLabel={pendingReview > 0 ? 'requires attention' : 'all clear'}
        />
        <MetricCard
          label="Known Vendors"
          value={<AnimatedCounter value={knownVendors} />}
          icon={Building2}
          subLabel={`${metrics.auto_routing_vendors || 0} auto-routing`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ConfidenceChart distribution={data?.confidence_distribution || {}} />
        <TierChart tierUsage={data?.tier_usage || {}} />
      </div>

      {/* Entity heatmap */}
      {entities.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-silver uppercase tracking-wide mb-3">Entity Routing Heatmap</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {entities.slice(0, 12).map((e, i) => (
              <EntityCard key={i} entity={e} maxVolume={maxVol} />
            ))}
          </div>
        </div>
      )}

      {/* Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent decisions */}
        <div className="bg-navy rounded-xl border border-cobalt shadow-lg p-5">
          <h3 className="text-xs font-semibold text-silver uppercase tracking-wide mb-4">Recent Decisions</h3>
          {recentDecisions.length === 0 ? (
            <p className="text-steel text-sm">No decisions yet</p>
          ) : (
            <div className="flex flex-col divide-y divide-cobalt/40">
              {recentDecisions.slice(0, 10).map((d, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="text-ivory font-medium truncate">{d.vendor_name || d.vendor}</p>
                    <p className="text-silver mt-0.5">{d.entity_name || d.entity}</p>
                  </div>
                  <ConfidenceBadge score={d.confidence_score || d.confidence || 0} />
                  <TierBadge tier={d.tier_used || d.tier} />
                  <span className="text-gold font-semibold w-16 text-right">{formatCurrency(d.amount)}</span>
                  <span className="text-steel w-14 text-right shrink-0">{timeAgo(d.created_at || d.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Learning events */}
        <div className="bg-navy rounded-xl border border-cobalt shadow-lg p-5">
          <h3 className="text-xs font-semibold text-silver uppercase tracking-wide mb-4">System Learning Events</h3>
          {events.length === 0 ? (
            <p className="text-steel text-sm">No events yet</p>
          ) : (
            <div className="flex flex-col max-h-80 overflow-y-auto pr-1">
              {events.slice(0, 20).map((e, i) => (
                <LearningEventRow key={i} event={e} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Watch panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WatchFolderPanel data={watchData} />
        <EmailWatchPanel data={data?.email_watch || watchData} />
      </div>
    </div>
  );
}
