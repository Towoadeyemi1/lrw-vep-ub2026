import { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, Archive, CheckCircle } from 'lucide-react';
import { useToast } from '../components/Common/Toast';
import client from '../api/client';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const EXCEL_SHEETS = [
  'Routing Summary',
  'Vendor Profiles',
  'Entity Analytics',
  'Review Queue',
  'System Events',
];

const ZIP_TREE = `
invoice-archive/
├── routing-summary.csv
├── vendor-profiles.csv
├── entity-analytics.csv
├── review-queue.csv
├── system-events.csv
└── raw-invoices/
    ├── auto-routed/
    ├── held-for-review/
    └── escalated/
`.trim();

export default function Export() {
  useEffect(() => { document.title = 'Export | Invoice Routing Intelligence'; }, []);
  const [xlLoading, setXlLoading] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [xlDone, setXlDone] = useState(false);
  const [zipDone, setZipDone] = useState(false);
  const { addToast } = useToast();

  const handleExcel = async () => {
    setXlLoading(true);
    setXlDone(false);
    try {
      const res = await client.get('/export/excel', { responseType: 'blob' });
      downloadBlob(res.data, 'invoice-routing-report.xlsx');
      setXlDone(true);
      addToast('Excel report downloaded successfully', 'success');
      setTimeout(() => setXlDone(false), 3000);
    } catch (err) {
      addToast(err.displayMessage || 'Excel export failed', 'error');
    } finally {
      setXlLoading(false);
    }
  };

  const handleZip = async () => {
    setZipLoading(true);
    setZipDone(false);
    try {
      const res = await client.get('/export/zip', { responseType: 'blob' });
      downloadBlob(res.data, 'invoice-archive.zip');
      setZipDone(true);
      addToast('ZIP archive downloaded successfully', 'success');
      setTimeout(() => setZipDone(false), 3000);
    } catch (err) {
      addToast(err.displayMessage || 'ZIP export failed', 'error');
    } finally {
      setZipLoading(false);
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-ivory">Export Data</h1>
        <p className="text-silver text-sm mt-1">Download complete data packages for reporting and archiving.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Excel Export */}
        <div className="bg-navy rounded-xl border border-cobalt shadow-lg p-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-900/30 border border-green-700 flex items-center justify-center">
              <FileSpreadsheet className="w-7 h-7 text-green-400" />
            </div>
            <div>
              <h2 className="text-ivory font-bold">Routing Intelligence Report</h2>
              <p className="text-silver text-xs mt-0.5">Excel workbook (.xlsx)</p>
            </div>
          </div>

          <p className="text-silver text-sm leading-relaxed">
            Complete Excel workbook with five sheets covering all routing activity, vendor intelligence,
            entity analytics, pending review items, and system learning events.
          </p>

          <div>
            <p className="text-xs text-silver uppercase font-medium mb-2">Included Sheets</p>
            <div className="flex flex-col gap-1.5">
              {EXCEL_SHEETS.map((sheet) => (
                <div key={sheet} className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                  <span className="text-ivory">{sheet}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleExcel}
            disabled={xlLoading}
            className={`mt-auto flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-sm transition-all
              ${xlDone
                ? 'bg-green-600 text-white'
                : 'bg-gold hover:bg-amber text-midnight disabled:opacity-60 disabled:cursor-not-allowed'
              }`}
          >
            {xlLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-midnight border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : xlDone ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Downloaded
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download Excel →
              </>
            )}
          </button>
        </div>

        {/* ZIP Export */}
        <div className="bg-navy rounded-xl border border-cobalt shadow-lg p-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cobalt/60 border border-cobalt flex items-center justify-center">
              <Archive className="w-7 h-7 text-blue-300" />
            </div>
            <div>
              <h2 className="text-ivory font-bold">Invoice Archive</h2>
              <p className="text-silver text-xs mt-0.5">ZIP archive (.zip)</p>
            </div>
          </div>

          <p className="text-silver text-sm leading-relaxed">
            Complete archive of all processed invoices organised by routing outcome, plus CSV exports
            of all data tables. Suitable for long-term record-keeping.
          </p>

          <div>
            <p className="text-xs text-silver uppercase font-medium mb-2">Archive Structure</p>
            <pre className="bg-midnight/60 rounded-lg p-3 text-xs text-gold font-mono leading-relaxed overflow-x-auto">
              {ZIP_TREE}
            </pre>
          </div>

          <button
            onClick={handleZip}
            disabled={zipLoading}
            className={`mt-auto flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-sm transition-all border
              ${zipDone
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-cobalt hover:bg-slate text-ivory border-cobalt disabled:opacity-60 disabled:cursor-not-allowed'
              }`}
          >
            {zipLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-ivory border-t-transparent rounded-full animate-spin" />
                Packaging...
              </>
            ) : zipDone ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Downloaded
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download ZIP →
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
