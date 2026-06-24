import { FileText, Image, File } from 'lucide-react';

export function TextInvoiceDoc({ content }) {
  const lines = (content || '').trim().split('\n');

  return (
    <div className="bg-white text-gray-900 rounded-lg shadow-2xl p-8 font-mono text-xs leading-relaxed min-h-64 border border-gray-200">
      <div className="space-y-0.5">
        {lines.map((line, i) => {
          const trimmed = line.trim();

          // Blank line
          if (!trimmed) return <div key={i} className="h-3" />;

          // All-caps company name / header (first non-empty line)
          const isFirstContent = lines.slice(0, i).every(l => !l.trim());
          if (isFirstContent) {
            return (
              <div key={i} className="text-base font-bold text-gray-900 tracking-wide mb-2">
                {line}
              </div>
            );
          }

          // Section headers (all caps, short)
          if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 40 && !/\d{4}/.test(trimmed) && !trimmed.includes('$')) {
            return (
              <div key={i} className="text-xs font-bold text-gray-700 uppercase tracking-widest mt-3 mb-1 border-b border-gray-200 pb-1">
                {line}
              </div>
            );
          }

          // Line items with dots and amounts
          if (trimmed.includes('....') || trimmed.includes('......')) {
            const parts = trimmed.split(/\.{3,}/);
            const label = parts[0]?.trim();
            const amount = parts[parts.length - 1]?.trim();
            return (
              <div key={i} className="flex justify-between items-baseline gap-2 py-0.5">
                <span className="text-gray-700 truncate">{label}</span>
                <span className="flex-1 border-b border-dotted border-gray-300 mx-2 mb-1" />
                <span className="text-gray-900 font-medium whitespace-nowrap">{amount}</span>
              </div>
            );
          }

          // Total lines
          if (/TOTAL|AMOUNT DUE|BALANCE DUE/i.test(trimmed) && trimmed.includes('$')) {
            return (
              <div key={i} className="flex justify-between font-bold text-sm border-t border-gray-300 pt-2 mt-2 text-gray-900">
                <span>{trimmed.split(':')[0]?.split('$')[0]?.trim()}</span>
                <span className="text-green-700">${trimmed.split('$').pop()?.trim()}</span>
              </div>
            );
          }

          // Key: Value pairs
          if (trimmed.includes(':') && !trimmed.startsWith('-') && trimmed.split(':')[0].length < 30) {
            const colonIdx = line.indexOf(':');
            const key = line.substring(0, colonIdx).trim();
            const val = line.substring(colonIdx + 1).trim();
            if (key && val) {
              return (
                <div key={i} className="flex gap-2 py-0.5">
                  <span className="text-gray-500 min-w-[120px] shrink-0">{key}:</span>
                  <span className="text-gray-900 font-medium">{val}</span>
                </div>
              );
            }
          }

          // Bullet/dash list items
          if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
            return (
              <div key={i} className="pl-4 text-gray-700 py-0.5">
                {line}
              </div>
            );
          }

          // Default
          return (
            <div key={i} className="text-gray-700 py-0.5">
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function InvoicePreview({ content, file, fileUrl, label }) {
  const isImage = file && file.type.startsWith('image/');
  const isPdf = file && file.type === 'application/pdf';
  const isText = file && (file.type === 'text/plain' || file.name?.endsWith('.txt'));
  const isDocx = file && (file.name?.endsWith('.docx'));

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <div className="flex items-center gap-2 text-xs text-silver uppercase tracking-wide font-medium">
          <FileText className="w-3.5 h-3.5" />
          {label}
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-cobalt/50 shadow-xl bg-midnight">
        {/* Document chrome bar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-cobalt/30 border-b border-cobalt/50">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          <span className="ml-2 text-xs text-silver truncate">
            {file ? file.name : 'Invoice Preview'}
          </span>
        </div>

        <div className="p-4 max-h-[500px] overflow-y-auto">
          {/* PDF */}
          {isPdf && fileUrl && (
            <embed
              src={fileUrl}
              type="application/pdf"
              className="w-full rounded"
              style={{ height: '460px' }}
            />
          )}

          {/* Image */}
          {isImage && fileUrl && (
            <img
              src={fileUrl}
              alt="Invoice"
              className="w-full rounded object-contain max-h-[460px]"
            />
          )}

          {/* Text content (sample invoice, paste text, or txt file) */}
          {(content || isText || isDocx) && !isPdf && !isImage && (
            <TextInvoiceDoc content={content || '[File content will be extracted by AI]'} />
          )}

          {/* Unknown file type */}
          {!content && !isPdf && !isImage && !isText && !isDocx && file && (
            <div className="flex flex-col items-center justify-center py-12 text-silver gap-3">
              <File className="w-12 h-12 opacity-40" />
              <div className="text-center">
                <p className="font-medium text-ivory">{file.name}</p>
                <p className="text-xs mt-1">Content will be extracted by AI when processed</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
