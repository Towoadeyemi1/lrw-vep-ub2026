import { motion } from 'framer-motion';
import { CheckCircle, Clock, AlertTriangle, Building2, RotateCcw } from 'lucide-react';
import { ConfidenceGauge } from '../Common/ConfidenceGauge';
import { StatusBadge } from '../Vendor/StatusBadge';
import { EntityBadge } from '../Common/EntityBadge';

function TierBadge({ tier }) {
  const cfg = {
    1: { label: 'Tier 1', cls: 'bg-blue-700 text-blue-100' },
    2: { label: 'Tier 2', cls: 'bg-amber text-midnight' },
    3: { label: 'Tier 3', cls: 'bg-orange-600 text-orange-100' },
    human: { label: 'Human', cls: 'bg-red-700 text-red-100' },
  }[tier] || { label: `Tier ${tier}`, cls: 'bg-steel text-cloud' };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function RoutingDecision({ result }) {
  const decision = result.routing_decision || result.decision || '';
  const entity = result.routed_to || result.entity_name || '';
  const score = result.confidence_score || 0;

  if (decision === 'auto_routed' || decision === 'AUTO_ROUTED' || decision === 'routed') {
    return (
      <div className="bg-success/20 border border-green-700 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
        <div>
          <p className="text-green-300 text-xs font-semibold uppercase tracking-wide">Auto-Routed To</p>
          <p className="text-ivory font-bold mt-0.5">{entity}</p>
        </div>
      </div>
    );
  }

  if (decision === 'held_for_review' || decision === 'HELD' || decision === 'review') {
    return (
      <div className="bg-warning-bg border border-yellow-600 rounded-xl p-4 flex items-center gap-3">
        <Clock className="w-6 h-6 text-yellow-600 shrink-0" />
        <div>
          <p className="text-warning text-xs font-semibold uppercase tracking-wide">Held for Review</p>
          <p className="text-midnight font-medium text-sm mt-0.5">Needs human confirmation</p>
        </div>
      </div>
    );
  }

  if (decision === 'escalated' || decision === 'ESCALATED') {
    return (
      <div className="bg-danger-bg border border-red-600 rounded-xl p-4 flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
        <div>
          <p className="text-danger text-xs font-semibold uppercase tracking-wide">Escalated</p>
          <p className="text-danger/80 text-sm mt-0.5">Requires manual review</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cobalt/40 border border-cobalt rounded-xl p-4">
      <p className="text-silver text-sm">{decision || 'Decision pending'}</p>
      {entity && <p className="text-ivory font-semibold mt-1">{entity}</p>}
    </div>
  );
}

function FieldTable({ fields }) {
  const entries = Object.entries(fields || {}).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return null;
  return (
    <div className="rounded-lg overflow-hidden border border-cobalt">
      <table className="w-full text-xs">
        <tbody>
          {entries.map(([k, v], i) => (
            <tr key={k} className={i % 2 === 0 ? 'bg-midnight/40' : 'bg-cobalt/20'}>
              <td className="px-3 py-2 text-silver font-medium capitalize">{k.replace(/_/g, ' ')}</td>
              <td className="px-3 py-2 text-ivory">{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CandidateBar({ candidate, maxScore }) {
  const score = candidate.confidence_score || candidate.score || 0;
  const width = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-xs text-silver truncate">{candidate.entity_name || candidate.name}</div>
      <div className="flex-1 h-2 bg-cobalt rounded-full overflow-hidden">
        <div
          className="h-full bg-gold rounded-full transition-all duration-700"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs text-gold font-semibold w-10 text-right">{score}%</span>
    </div>
  );
}

export function ResultCard({ result, onReset }) {
  if (!result) return null;

  const extracted = result.extracted_data || result.extracted_fields || {};
  const candidates = (result.top_candidates || result.candidates || []).slice(0, 3);
  const maxScore = candidates.reduce((m, c) => Math.max(m, c.confidence_score || c.score || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, type: 'spring' }}
      className="bg-navy rounded-xl border border-cobalt shadow-xl overflow-hidden"
    >
      <div className="bg-cobalt/30 px-6 py-4 border-b border-cobalt flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cobalt flex items-center justify-center">
            <Building2 className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h2 className="text-ivory font-bold">
              {result.vendor_canonical || result.canonical_name || result.vendor_name || 'Unknown Vendor'}
            </h2>
            {result.vendor_raw && result.vendor_raw !== result.vendor_canonical && (
              <p className="text-silver text-xs">Raw: {result.vendor_raw}</p>
            )}
          </div>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cobalt hover:bg-slate text-silver hover:text-ivory text-sm transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Process Another
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {result.vendor_category && (
              <span className="px-2 py-0.5 rounded bg-cobalt text-silver text-xs font-medium">
                {result.vendor_category}
              </span>
            )}
            <StatusBadge status={result.vendor_status || 'NEW'} />
            {(result.is_new_vendor || result.vendor_status === 'NEW') && (
              <span className="text-xs text-green-400 font-medium">Profile Created</span>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold text-silver uppercase tracking-wide mb-2">Extracted Fields</h4>
            <FieldTable fields={extracted} />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <ConfidenceGauge score={result.confidence_score || 0} size={110} />
            <div className="flex flex-col gap-2 items-end">
              <TierBadge tier={result.tier_used || result.tier || 1} />
              {result.entity_vertical && <EntityBadge vertical={result.entity_vertical} />}
            </div>
          </div>

          <RoutingDecision result={result} />

          {result.reasoning && (
            <div className="bg-midnight/60 rounded-lg p-4 border border-cobalt">
              <h4 className="text-xs font-semibold text-silver uppercase tracking-wide mb-2">AI Reasoning</h4>
              <p className="text-ivory/80 text-sm leading-relaxed">{result.reasoning}</p>
            </div>
          )}

          {candidates.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-silver uppercase tracking-wide mb-3">Top Candidates</h4>
              <div className="flex flex-col gap-2">
                {candidates.map((c, i) => (
                  <CandidateBar key={i} candidate={c} maxScore={maxScore} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
