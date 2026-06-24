import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Trash2, Play, RefreshCw, LayoutDashboard, Layers } from 'lucide-react';
import { useToast } from '../components/Common/Toast';
import client from '../api/client';

document.title = 'Demo Controls | Invoice Routing Intelligence';

const CLEARED = [
  'All processed invoices',
  'Vendor profiles and learning history',
  'Review queue items',
  'System events and timeline',
  'Routing decisions and audit log',
];

const KEPT = [
  'Entity configuration (12 entities)',
  'Routing rules and classification logic',
  'Sample invoice library',
  'Watch folder configuration',
  'Email watch settings',
];

const DEMO_SEQUENCE = [
  'sample_01',
  'sample_02',
  'sample_03',
  'sample_04',
  'sample_05',
  'sample_06',
];

function ResetDialog({ onConfirm, onCancel, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-navy border border-red-700 rounded-xl shadow-2xl p-8 max-w-md w-full mx-4"
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <h2 className="text-xl font-bold text-ivory">Confirm Reset</h2>
        </div>
        <p className="text-silver text-sm mb-6 leading-relaxed">
          This will permanently delete all demo data including invoices, vendor profiles, and routing history.
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 rounded-xl border border-cobalt text-silver hover:text-ivory hover:bg-cobalt/20 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Yes, Reset Everything
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DemoSequenceOverlay({ onClose }) {
  const navigate = useNavigate();
  const [steps, setSteps] = useState(
    DEMO_SEQUENCE.map((id) => ({ id, state: 'pending', label: id, result: null }))
  );
  const [current, setCurrent] = useState(-1);
  const [done, setDone] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setRunning(true);
      for (let i = 0; i < DEMO_SEQUENCE.length; i++) {
        if (cancelled) break;
        const id = DEMO_SEQUENCE[i];
        setCurrent(i);

        setSteps((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, state: 'processing' } : s))
        );

        try {
          const res = await client.post(`/invoices/sample/${id}`);
          const d = res.data || {};
          const entityName = d.entity_name || d.entity || '—';
          const confidence = d.confidence_score || d.confidence || 0;
          const tier = d.tier_used || d.tier || '?';
          const label = d.vendor_name || d.vendor || id;

          setSteps((prev) =>
            prev.map((s, idx) =>
              idx === i
                ? {
                    ...s,
                    state: 'done',
                    label,
                    result: { entityName, confidence, tier },
                  }
                : s
            )
          );
        } catch (err) {
          setSteps((prev) =>
            prev.map((s, idx) =>
              idx === i ? { ...s, state: 'error', result: { entityName: 'Error', confidence: 0, tier: '?' } } : s
            )
          );
        }

        if (i < DEMO_SEQUENCE.length - 1) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      if (!cancelled) {
        setDone(true);
        setRunning(false);
        setCurrent(DEMO_SEQUENCE.length);
      }
    }

    run();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = Math.max(0, Math.min(DEMO_SEQUENCE.length, current + (done ? 1 : 0)));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        className="bg-navy border border-cobalt rounded-2xl shadow-2xl p-8 max-w-lg w-full"
      >
        <h2 className="text-ivory font-bold text-xl mb-1">Running Full Demo Sequence</h2>
        <p className="text-silver text-sm mb-6">Processing 6 sample invoices to demonstrate the learning lifecycle...</p>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-silver mb-2">
            <span>Progress</span>
            <span>{Math.min(progress, DEMO_SEQUENCE.length)}/{DEMO_SEQUENCE.length}</span>
          </div>
          <div className="h-2 bg-cobalt rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gold rounded-full"
              animate={{ width: `${(Math.min(progress, DEMO_SEQUENCE.length) / DEMO_SEQUENCE.length) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Step list */}
        <div className="flex flex-col gap-3 mb-6">
          <AnimatePresence>
            {steps.map((step, i) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 text-sm"
              >
                <div className="w-6 shrink-0 flex items-center justify-center">
                  {step.state === 'done' && <CheckCircle className="w-4 h-4 text-green-400" />}
                  {step.state === 'processing' && (
                    <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                  )}
                  {step.state === 'pending' && (
                    <div className="w-4 h-4 rounded-full border-2 border-cobalt" />
                  )}
                  {step.state === 'error' && <span className="text-red-400 text-xs">✕</span>}
                </div>

                <div className="flex-1 min-w-0">
                  {step.state === 'processing' && (
                    <span className="text-gold">⟳ Processing: {step.label}...</span>
                  )}
                  {step.state === 'done' && step.result && (
                    <span className="text-green-300">
                      ✓ {step.label} → <span className="text-ivory">{step.result.entityName}</span>{' '}
                      <span className="text-silver">({step.result.confidence}%) [T{step.result.tier}]</span>
                    </span>
                  )}
                  {step.state === 'error' && (
                    <span className="text-red-400">✕ {step.label} — failed</span>
                  )}
                  {step.state === 'pending' && (
                    <span className="text-steel">{step.label}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Completion */}
        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-t border-cobalt pt-5 flex flex-col gap-4"
            >
              <div className="flex items-start gap-3 bg-success-bg border border-green-600 rounded-xl p-4">
                <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                <p className="text-green-300 text-sm font-medium">
                  ✓ Demo complete! 6 invoices processed. Visit the Dashboard to see results.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2 bg-gold hover:bg-amber text-midnight font-bold px-5 py-2.5 rounded-xl transition-colors flex-1 justify-center"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Go to Dashboard
                </button>
                <button
                  onClick={onClose}
                  className="border border-cobalt text-silver hover:text-ivory px-5 py-2.5 rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function BatchGeneratePanel({ samples }) {
  const [rounds, setRounds] = useState(2);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' });
  const [finished, setFinished] = useState(false);
  const { addToast } = useToast();

  const handleGenerate = async () => {
    const ids = DEMO_SEQUENCE;
    const total = rounds * ids.length;
    setRunning(true);
    setFinished(false);
    setProgress({ done: 0, total, current: '' });

    let done = 0;
    for (let r = 0; r < rounds; r++) {
      for (const id of ids) {
        const sample = samples.find((s) => s.id === id);
        setProgress({ done, total, current: sample?.name || id });
        try {
          await client.post(`/invoices/sample/${id}`);
        } catch {
          // continue even if one fails
        }
        done++;
        setProgress({ done, total, current: sample?.name || id });
        await new Promise((res) => setTimeout(res, 400));
      }
    }

    setRunning(false);
    setFinished(true);
    addToast(`Generated ${total} invoices across ${rounds} rounds`, 'success');
  };

  const pct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <div className="bg-navy border border-cobalt rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Layers className="w-5 h-5 text-gold" />
        <h2 className="text-ivory font-bold text-lg">Generate Test Volume</h2>
      </div>
      <p className="text-silver text-sm mb-5 leading-relaxed">
        Run all 6 sample invoices multiple times to build up realistic data volume and trigger the full
        learning lifecycle — vendors progress from NEW → LEARNING → AUTO-ROUTE as confirmations accumulate.
      </p>

      <div className="flex items-center gap-4 mb-5">
        <div>
          <label className="block text-xs text-silver uppercase tracking-wide mb-2">Rounds</label>
          <div className="flex gap-2">
            {[1, 2, 3, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRounds(n)}
                disabled={running}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors border ${
                  rounds === n
                    ? 'bg-gold text-midnight border-gold'
                    : 'border-cobalt text-silver hover:text-ivory hover:border-gold/50'
                }`}
              >
                {n}×
              </button>
            ))}
          </div>
        </div>
        <div className="text-sm text-silver mt-5">
          = <span className="text-ivory font-semibold">{rounds * 6}</span> invoices total
        </div>
      </div>

      {running && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-silver mb-1.5">
            <span className="text-gold truncate">{progress.current}</span>
            <span>{progress.done}/{progress.total}</span>
          </div>
          <div className="h-2 bg-cobalt rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gold rounded-full"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {finished && !running && (
        <div className="mb-4 flex items-center gap-2 bg-success-bg border border-green-600 rounded-lg px-4 py-3 text-green-300 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Done — {rounds * 6} invoices generated. Check Review Queue and Dashboard.
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={running}
        className="flex items-center gap-2 bg-cobalt hover:bg-slate disabled:opacity-50 disabled:cursor-not-allowed text-ivory font-bold px-6 py-3 rounded-xl transition-colors border border-cobalt/80"
      >
        {running ? (
          <>
            <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Layers className="w-4 h-4 text-gold" />
            Generate {rounds * 6} Invoices
          </>
        )}
      </button>
    </div>
  );
}

export default function DemoControls() {
  const [showDialog, setShowDialog] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [samples, setSamples] = useState([]);
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    document.title = 'Demo Controls | Invoice Routing Intelligence';
    client.get('/samples')
      .then((r) => setSamples(Array.isArray(r.data) ? r.data : r.data.samples || []))
      .catch(() => {});
  }, []);

  const handleReset = async () => {
    setResetLoading(true);
    try {
      await client.post('/demo/reset');
      addToast('Demo data reset successfully', 'success');
      setShowDialog(false);
      setTimeout(() => navigate('/'), 800);
    } catch (err) {
      addToast(err.displayMessage || 'Reset failed', 'error');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="p-6 flex flex-col gap-8 max-w-4xl">
      <AnimatePresence>
        {showDialog && (
          <ResetDialog
            onConfirm={handleReset}
            onCancel={() => setShowDialog(false)}
            loading={resetLoading}
          />
        )}
        {showDemo && (
          <DemoSequenceOverlay onClose={() => setShowDemo(false)} />
        )}
      </AnimatePresence>

      {/* Run Full Demo — prominent gold button */}
      <div className="bg-gradient-to-r from-gold/10 to-amber/5 border border-gold/40 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-ivory font-bold text-lg mb-1">▶ Run Full Demo</h2>
            <p className="text-silver text-sm leading-relaxed max-w-lg">
              Automatically process all 6 sample invoices in sequence and watch the system learn — from NEW vendor profiles to CONFIRMED auto-routing.
            </p>
          </div>
          <button
            onClick={() => setShowDemo(true)}
            className="flex items-center gap-2 bg-gold hover:bg-amber text-midnight font-bold text-base px-8 py-3.5 rounded-xl transition-all shadow-lg hover:shadow-gold/30 shrink-0 whitespace-nowrap"
          >
            <Play className="w-5 h-5" />
            Run Full Demo
          </button>
        </div>
      </div>

      {/* Generate Test Volume */}
      <BatchGeneratePanel samples={samples} />

      {/* Danger Zone */}
      <div className="border-2 border-red-700 rounded-xl overflow-hidden">
        <div className="bg-red-900/30 px-6 py-4 border-b border-red-700 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h2 className="text-red-200 font-bold uppercase tracking-wide text-sm">Danger Zone — Reset Demo Data</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3">What gets cleared</h3>
            <ul className="flex flex-col gap-2">
              {CLEARED.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-ivory/80">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-3">What is kept</h3>
            <ul className="flex flex-col gap-2">
              {KEPT.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-ivory/80">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="px-6 pb-6">
          <button
            onClick={() => setShowDialog(true)}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-600 text-white font-bold px-6 py-3 rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Reset Demo Data
          </button>
        </div>
      </div>

      {/* Sample Invoices */}
      <div>
        <h2 className="text-sm font-bold text-ivory uppercase tracking-wide mb-4">Sample Invoices</h2>
        <p className="text-silver text-sm mb-5">
          Pre-configured test invoices that demonstrate different routing scenarios.
        </p>

        {samples.length === 0 ? (
          <div className="bg-navy rounded-xl border border-cobalt p-8 text-center text-silver text-sm">
            Loading samples...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {samples.map((sample) => (
              <div
                key={sample.id}
                className="bg-navy rounded-xl border border-cobalt shadow-lg p-5 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-ivory font-semibold text-sm">{sample.name || sample.id}</h3>
                    {sample.description && (
                      <p className="text-silver text-xs mt-1 leading-relaxed">{sample.description}</p>
                    )}
                  </div>
                  {sample.expected_tier && (
                    <span className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${
                      sample.expected_tier === 1 ? 'bg-blue-700 text-blue-100' :
                      sample.expected_tier === 2 ? 'bg-amber/30 text-gold' :
                      'bg-orange-800 text-orange-200'
                    }`}>
                      Tier {sample.expected_tier}
                    </span>
                  )}
                </div>

                {sample.expected_behavior && (
                  <div className="bg-cobalt/20 rounded-lg p-3">
                    <p className="text-xs text-silver font-medium mb-1 uppercase tracking-wide">Expected Behaviour</p>
                    <p className="text-ivory/80 text-xs leading-relaxed">{sample.expected_behavior}</p>
                  </div>
                )}

                <button
                  onClick={() => navigate(`/process?sample=${sample.id}`)}
                  className="flex items-center justify-center gap-2 bg-cobalt hover:bg-slate text-ivory text-sm font-medium py-2.5 rounded-lg transition-colors border border-cobalt mt-auto"
                >
                  <Play className="w-4 h-4 text-gold" />
                  Process This Invoice
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
