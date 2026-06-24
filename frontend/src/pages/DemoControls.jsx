import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Trash2, Play, RefreshCw } from 'lucide-react';
import { useToast } from '../components/Common/Toast';
import client from '../api/client';

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

export default function DemoControls() {
  const [showDialog, setShowDialog] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [samples, setSamples] = useState([]);
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
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
      </AnimatePresence>

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
