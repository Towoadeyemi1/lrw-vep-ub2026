import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X } from 'lucide-react';

const ACCEPTED = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
};

export function UploadZone({ onFile, file }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED,
    maxSize: 10 * 1024 * 1024,
    onDrop: (accepted) => {
      if (accepted[0]) onFile(accepted[0]);
    },
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 select-none
          ${isDragActive
            ? 'border-gold bg-cobalt/30 scale-[1.01]'
            : file
            ? 'border-green-500 bg-success/10'
            : 'border-cobalt hover:border-gold/60 hover:bg-cobalt/10 bg-midnight/40'
          }`}
        style={{ minHeight: 200 }}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <FileText className="w-10 h-10 text-green-400" />
            <span className="text-ivory font-medium text-sm">{file.name}</span>
            <span className="text-silver text-xs">{(file.size / 1024).toFixed(1)} KB — ready to process</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 p-6">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isDragActive ? 'bg-gold/20' : 'bg-cobalt'}`}>
              <Upload className={`w-7 h-7 ${isDragActive ? 'text-gold' : 'text-silver'}`} />
            </div>
            <div className="text-center">
              <p className="text-ivory font-semibold">
                {isDragActive ? 'Drop to upload' : 'Drag & drop your invoice here'}
              </p>
              <p className="text-silver text-sm mt-1">or click to browse files</p>
            </div>
            <p className="text-xs text-steel">PDF, PNG, JPG, JPEG, DOCX, TXT — max 10 MB</p>
          </div>
        )}
      </div>

      {file && (
        <button
          onClick={() => onFile(null)}
          className="mt-2 flex items-center gap-1 text-xs text-steel hover:text-red-400 transition-colors"
        >
          <X className="w-3 h-3" /> Remove file
        </button>
      )}
    </div>
  );
}
