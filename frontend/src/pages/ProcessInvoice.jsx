import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Zap, ChevronDown } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { ProcessingAnimation } from '../components/Invoice/ProcessingAnimation';
import { ResultCard } from '../components/Invoice/ResultCard';
import { InvoicePreview } from '../components/Invoice/InvoicePreview';
import { useToast } from '../components/Common/Toast';
import client from '../api/client';

const TABS = ['Upload File', 'Paste Text', 'Sample Invoice'];
const ACCEPTED = { 'application/pdf': [], 'image/*': [], 'text/plain': [], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [] };

function buildSteps(result) {
  return [
    { id: 'upload',     label: 'Uploading invoice...',             done: true,    active: false },
    { id: 'received',   label: 'Invoice received',                 done: true,    active: false },
    { id: 'extract',    label: 'Extracting data with Claude AI...', done: !!result, active: !result },
    {
      id: 'vendor',
      label: result ? `Vendor identified: ${result.vendor_canonical || result.vendor_name || '...'}` : 'Identifying vendor...',
      done: !!result, active: false,
      badge: result ? (result.is_new_vendor ? 'NEW' : 'KNOWN') : undefined,
    },
    {
      id: 'classify',
      label: result ? `Classification complete — ${result.tier_used || result.tier || 'Tier ?'} used` : 'Running three-tier classification...',
      done: !!result, active: false,
    },
    {
      id: 'confidence',
      label: result ? `Confidence: ${result.confidence_score ?? 0}%` : 'Calculating confidence...',
      done: !!result, active: false,
      badge: result ? (result.confidence_score >= 90 ? 'HIGH' : result.confidence_score >= 70 ? 'GOOD' : 'LOW') : undefined,
    },
    {
      id: 'decision',
      label: result ? `Decision: ${(result.routing_decision || result.routing_status || '').replace(/_/g, ' ')}` : 'Making routing decision...',
      done: !!result, active: false,
    },
  ];
}

// ── Upload drop zone ──────────────────────────────────────────────────────────
function FileDropZone({ file, fileUrl, onFile }) {
  const onDrop = useCallback((accepted) => {
    if (accepted[0]) onFile(accepted[0]);
  }, [onFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  });

  return (
    <div className="flex flex-col gap-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${isDragActive ? 'border-gold bg-gold/5' : 'border-cobalt hover:border-gold/50 hover:bg-cobalt/10'}`}
      >
        <input {...getInputProps()} />
        <div className="text-3xl mb-2">📄</div>
        {isDragActive ? (
          <p className="text-gold font-medium">Drop the invoice here...</p>
        ) : (
          <>
            <p className="text-ivory font-medium">Drag & drop an invoice here</p>
            <p className="text-silver text-sm mt-1">or <span className="text-gold underline">click to browse</span></p>
            <p className="text-steel text-xs mt-3">PDF · PNG · JPG · DOCX · TXT — max 10 MB</p>
          </>
        )}
      </div>

      {file && (
        <InvoicePreview
          file={file}
          fileUrl={fileUrl}
          label={`Preview — ${file.name}`}
        />
      )}
    </div>
  );
}

// ── Paste text tab ────────────────────────────────────────────────────────────
function PasteTextTab({ text, onText }) {
  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder={`Paste invoice text here...\n\nExample:\nSYSCO FOOD SERVICES\nInvoice #: INV-2026-4471\nDate: June 20, 2026\nBill To: Coastal Grand Hotel\n247 Harbour Rd\nTOTAL DUE: $6,300.00`}
        className="w-full h-44 bg-midnight border border-cobalt rounded-xl p-4 text-ivory text-sm font-mono placeholder-steel resize-none focus:outline-none focus:border-gold/50 transition-colors"
      />
      {text.trim() && (
        <InvoicePreview content={text} label="Live Preview" />
      )}
    </div>
  );
}

// ── Sample invoice tab ────────────────────────────────────────────────────────
function SampleTab({ samples, sampleId, onSelect }) {
  const selected = samples.find((s) => String(s.id) === String(sampleId));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-xs text-silver font-medium mb-2 uppercase tracking-wide">
          Choose a sample invoice
        </label>
        <div className="relative">
          <select
            value={sampleId}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full appearance-none bg-midnight border border-cobalt rounded-xl px-4 py-3 pr-10 text-ivory text-sm focus:outline-none focus:border-gold/50 transition-colors"
          >
            <option value="">Select sample invoice...</option>
            {samples.map((s) => (
              <option key={s.id} value={s.id}>{s.name || s.id}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-silver pointer-events-none" />
        </div>
      </div>

      {selected && (
        <>
          {/* Info strip */}
          <div className="flex gap-3">
            <div className="flex-1 bg-cobalt/20 border border-cobalt/50 rounded-xl p-3">
              <p className="text-silver text-xs uppercase tracking-wide font-medium mb-1">Description</p>
              <p className="text-ivory text-sm">{selected.description}</p>
            </div>
            {selected.expected_behavior && (
              <div className="flex-1 bg-gold/5 border border-gold/20 rounded-xl p-3">
                <p className="text-gold/70 text-xs uppercase tracking-wide font-medium mb-1">Expected behaviour</p>
                <p className="text-ivory/80 text-sm">{selected.expected_behavior}</p>
              </div>
            )}
          </div>

          {/* Invoice document preview */}
          <InvoicePreview
            content={selected.content}
            label={`Invoice Document — ${selected.name}`}
          />
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProcessInvoice() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(0);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
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

  useEffect(() => {
    const sid = searchParams.get('sample');
    if (sid) { setTab(2); setSampleId(sid); }
  }, [searchParams]);

  // Create object URL for file preview
  useEffect(() => {
    if (!file) { setFileUrl(null); return; }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleProcess = async () => {
    if (tab === 0 && !file)         { addToast('Please select a file first', 'warning'); return; }
    if (tab === 1 && !text.trim())  { addToast('Please paste some invoice text', 'warning'); return; }
    if (tab === 2 && !sampleId)     { addToast('Please select a sample invoice', 'warning'); return; }

    setProcessing(true);
    setResult(null);
    setSteps(buildSteps(null));

    try {
      let res;
      if (tab === 0) {
        const formData = new FormData();
        formData.append('file', file);
        res = await client.post('/invoices/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else if (tab === 1) {
        res = await client.post('/invoices/process-text', { text });
      } else {
        res = await client.post(`/invoices/sample/${sampleId}`);
      }

      setSteps(buildSteps(res.data));
      setResult(res.data);
      addToast('Invoice processed successfully!', 'success');
    } catch (err) {
      addToast(err.displayMessage || 'Processing failed — check server logs', 'error');
      setSteps([]);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setResult(null); setSteps([]); setFile(null); setFileUrl(null);
    setText(''); setSampleId('');
  };

  const canProcess =
    (tab === 0 && !!file) ||
    (tab === 1 && text.trim().length > 0) ||
    (tab === 2 && !!sampleId);

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
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
                    : 'text-silver hover:text-ivory hover:bg-cobalt/10'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="p-6">
            {tab === 0 && (
              <FileDropZone file={file} fileUrl={fileUrl} onFile={setFile} />
            )}
            {tab === 1 && (
              <PasteTextTab text={text} onText={setText} />
            )}
            {tab === 2 && (
              <SampleTab samples={samples} sampleId={sampleId} onSelect={setSampleId} />
            )}
          </div>
        </div>
      )}

      {!processing && !result && (
        <button
          onClick={handleProcess}
          disabled={!canProcess}
          className="w-full flex items-center justify-center gap-3 bg-gold hover:bg-amber disabled:bg-cobalt disabled:text-steel text-midnight font-bold py-4 rounded-xl text-base transition-colors shadow-lg disabled:cursor-not-allowed"
        >
          <Zap className="w-5 h-5" />
          Analyse &amp; Route
        </button>
      )}

      {processing && <ProcessingAnimation steps={steps} />}

      {result && <ResultCard result={result} onReset={handleReset} />}
    </div>
  );
}
