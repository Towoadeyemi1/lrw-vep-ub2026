import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader } from 'lucide-react';

function Step({ step, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`flex items-center gap-3 py-2.5 px-4 rounded-lg ${
        step.done ? 'bg-success/10' : step.active ? 'bg-cobalt/40' : 'bg-transparent'
      }`}
    >
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
        step.done ? 'bg-green-500' : step.active ? 'bg-gold/20 border border-gold' : 'bg-cobalt border border-steel'
      }`}>
        {step.done ? (
          <Check className="w-3.5 h-3.5 text-white" />
        ) : step.active ? (
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
            <Loader className="w-3.5 h-3.5 text-gold" />
          </motion.div>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-steel" />
        )}
      </div>

      <div className="flex-1">
        <span className={`text-sm font-medium ${step.done ? 'text-green-400' : step.active ? 'text-gold' : 'text-steel'}`}>
          {step.label}
        </span>
        {step.detail && (
          <span className="ml-2 text-xs text-silver">{step.detail}</span>
        )}
      </div>

      {step.badge && (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          step.badge === 'NEW' ? 'bg-steel/40 text-cloud' :
          step.badge === 'KNOWN' ? 'bg-cobalt text-blue-200' :
          'bg-gold/20 text-gold'
        }`}>
          {step.badge}
        </span>
      )}
    </motion.div>
  );
}

export function ProcessingAnimation({ steps }) {
  return (
    <div className="bg-navy rounded-xl border border-cobalt shadow-lg p-6">
      <h3 className="text-sm font-semibold text-silver uppercase tracking-wide mb-4 flex items-center gap-2">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full"
        />
        Processing with Claude AI...
      </h3>
      <div className="flex flex-col gap-1">
        <AnimatePresence>
          {steps.map((step, i) => (
            <Step key={step.id} step={step} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
