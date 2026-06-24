import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { UploadZone } from '../components/Invoice/UploadZone';
import { ProcessingAnimation } from '../components/Invoice/ProcessingAnimation';
import { ResultCard } from '../components/Invoice/ResultCard';
import { useToast } from '../components/Common/Toast';
import client from '../api/client';

const TABS = ['Upload File', 'Paste Text', 'Sample Invoice'];

function buildSteps(result) {
  return [
    { id: 'upload', label: 'Uploading invoice...', done: true, active: false },
    { id: 'received', label: 'Invoice received', done: true, active: false },
    { id: 'extract', label: 'Extracting data with Claude AI...', done: !!result, active: !result },
    {
      id: 'vendor',
      label: result ? `Vendor identified: ${result.vendor_canonical || result.vendor_name || '...'}` : 'Identifying vendor...',
      done: !!result,
      active: false,
      badge: result ? (result.is_new_vendor ? 'NEW' : 'KNOWN') : undefined,
    },
    {
      id: 'classify',
      label: result ? `Classification complete — Tier ${result.tier_used || result.tier || '?'} used` : 'Running three-tier classification...',
      done: !!result,
      active: false,
    },
    {
      id: 'confidence',
      label: result ? `Confidence: ${result.confidence_score || 0}%` : 'Calculating confidence...',
      done: !!result,
      active: false,
      badge: result
        ? result.confidence_score >= 90 ? 'HIGH' : result.confidence_score >= 70 ? 'GOOD' : 'LOW'
        : undefined,
    },
    {
      id: 'decision',
      label: result ? `Decision: ${(result.routing_decision || '').replace(/_/g, ' ')}` : 'Making routing decision...',
      done: !!result,
      active: false,
    },
  ];
}

export default function ProcessInvoice() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(0);
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [sampleId, setSampleId] = useState('');
  const [samples, setSamples] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [steps, setSteps] = useState([]);
  const [result, setResult] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    client.get('/samples').then((r) => {
      const arr = Array.isArray(r.data) ? r.data : r.data.samples || [];
      setSamples(arr);
    }).catch(() => {});
  }, []);

  // If navigated with ?sample=id, auto-switch to Sample tab
  useEffect(() => {
    const sid = searchParams.get('sample');
    if (sid) {
      setTab(2);
      setSampleId(sid);
    }
  }, [searchParams]);

  const handleProcess = async () => {
    if (tab === 0 && !file) { addToast('Please select a file first', 'warning'); return; }
    if (tab === 1 && !text.trim()) { addToast('Please paste some invoice text', 'warning'); return; }
    if (tab === 2 && !sampleId) { addToast('Please select a sample invoice', 'warning'); return; }

    setProcessing(true);
    setResult(null);
    setSteps(buildSteps(null));

    try {
      let res;
      if (tab === 0) {
        const formData = new FormData();
        formData.append('file', file);
        res = await client.post('/process/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else if (tab === 1) {
        res = await client.post('/process/text', { text });
      } else {
        res = await client.post('/process/sample', { sample_id: sampleId });
      }

      const resultData = res.data;
      setSteps(buildSteps(resultData));
      setResult(resultData);
      addToast('Invoice processed successfully!', 'success');
    } catch (err) {
      addToast(err.displayMessage || 'Processing failed', 'error');
      setSteps([]);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setSteps([]);
    setFile(null);
    setText('');
    setSampleId('');
  };

  const selectedSample = samples.find((s) => String(s.id) === String(sampleId));

  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col gap-6">
      {!processing && !result && (
        <div className="bg-navy rounded-xl border border-cobalt shadow-lg overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-cobalt">
            {TABS.map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(i)}
                className={`flex-1 py-3 text-sm font-medium transition-colors
                  ${tab === i
                    ? 'text-gold border-b-2 border-gold bg-cobalt/20'
                    : 'text-silver hover:text-ivory hover:bg-cobalt/10'
                  }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="p-6">
            {tab === 0 && (
              <UploadZone file={file} onFile={setFile} />
            )}

            {tab === 1 && (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste invoice text here...&#10;&#10;Example:&#10;INVOICE #INV-2024-001&#10;Date: January 15, 2024&#10;From: Marriott Hotels Ltd&#10;Amount: $2,450.00"
                className="w-full h-48 bg-midnight border border-cobalt rounded-xl p-4 text-ivory text-sm font-mono placeholder-steel resize-none focus:outline-none focus:border-gold/50 transition-colors"
              />
            )}

            {tab === 2 && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs text-silver font-medium mb-2 uppercase tracking-wide">Select Sample Invoice</label>
                  <select
                    value={sampleId}
                    onChange={(e) => setSampleId(e.target.value)}
                    className="w-full bg-midnight border border-cobalt rounded-xl px-4 py-3 text-ivory text-sm focus:outline-none focus:border-gold/50 transition-colors"
                  >
                    <option value="">Choose a sample...</option>
                    {samples.map((s) => (
                      <option key={s.id} value={s.id}>{s.name || s.id}</option>
                    ))}
                  </select>
                </div>

                {selectedSample && (
                  <div className="bg-cobalt/20 border border-cobalt rounded-xl p-4">
                    <p className="text-silver text-xs uppercase tracking-wide font-medium mb-1">Description</p>
                    <p className="text-ivory text-sm">{selectedSample.description}</p>
                    {selectedSample.expected_behavior && (
                      <>
                        <p className="text-silver text-xs uppercase tracking-wide font-medium mt-3 mb-1">Expected Behaviour</p>
                        <p className="text-ivory/80 text-sm">{selectedSample.expected_behavior}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!processing && !result && (
        <button
          onClick={handleProcess}
          disabled={
            (tab === 0 && !file) ||
            (tab === 1 && !text.trim()) ||
            (tab === 2 && !sampleId)
          }
          className="w-full flex items-center justify-center gap-3 bg-gold hover:bg-amber disabled:bg-cobalt disabled:text-steel text-midnight font-bold py-4 rounded-xl text-base transition-colors shadow-lg disabled:cursor-not-allowed"
        >
          <Zap className="w-5 h-5" />
          Analyse &amp; Route
        </button>
      )}

      {processing && <ProcessingAnimation steps={steps} />}

      {result && (
        <ResultCard result={result} onReset={handleReset} />
      )}
    </div>
  );
}
