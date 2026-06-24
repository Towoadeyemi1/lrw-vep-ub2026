import { motion } from 'framer-motion';

const STATUS_CONFIG = {
  NEW: {
    label: 'NEW',
    bg: 'bg-steel',
    text: 'text-cloud',
    emoji: '',
    pulse: true,
    glow: false,
  },
  LEARNING: {
    label: 'LEARNING',
    bg: 'bg-amber',
    text: 'text-midnight',
    emoji: '📚',
    pulse: true,
    glow: false,
  },
  CONFIRMED: {
    label: 'CONFIRMED',
    bg: 'bg-cobalt',
    text: 'text-cloud',
    emoji: '✅',
    pulse: false,
    glow: false,
  },
  'AUTO-ROUTE': {
    label: 'AUTO-ROUTE',
    bg: 'bg-success',
    text: 'text-green-100',
    emoji: '🚀',
    pulse: false,
    glow: true,
  },
};

export function StatusBadge({ status, className = '' }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NEW;

  return (
    <motion.span
      key={status}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase
        ${cfg.bg} ${cfg.text}
        ${cfg.pulse ? 'animate-pulse-slow' : ''}
        ${cfg.glow ? 'animate-glow shadow-lg' : ''}
        ${className}`}
    >
      {cfg.emoji && <span>{cfg.emoji}</span>}
      {cfg.label}
    </motion.span>
  );
}
