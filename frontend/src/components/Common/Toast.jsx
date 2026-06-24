import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

const ICONS = {
  success: <CheckCircle className="w-5 h-5 text-green-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
  error: <XCircle className="w-5 h-5 text-red-400" />,
  info: <Info className="w-5 h-5 text-blue-400" />,
};

const BG = {
  success: 'border-green-600 bg-success-bg',
  warning: 'border-yellow-600 bg-warning-bg',
  error: 'border-red-600 bg-danger-bg',
  info: 'border-blue-600 bg-info-bg',
};

const TEXT = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
  info: 'text-info',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-sm ${BG[toast.type]}`}
            >
              <div className="mt-0.5 shrink-0">{ICONS[toast.type]}</div>
              <p className={`text-sm font-medium flex-1 ${TEXT[toast.type]}`}>{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 mt-0.5 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
