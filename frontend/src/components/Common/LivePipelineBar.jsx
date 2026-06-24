import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, FileText, Brain, GitBranch, CheckCircle, Clock } from 'lucide-react';
import client from '../../api/client';

const STAGES = [
  { id: 'watching',      icon: Wifi,         label: 'Watching',      desc: 'Monitoring for invoices' },
  { id: 'received',      icon: FileText,      label: 'Received',      desc: 'Invoice detected' },
  { id: 'extracting',    icon: Brain,         label: 'AI Extraction', desc: 'Claude reading document' },
  { id: 'classifying',   icon: GitBranch,     label: 'Classifying',   desc: '3-tier routing logic' },
  { id: 'routed',        icon: CheckCircle,   label: 'Routed',        desc: 'Decision complete' },
];

const ANIM_DELAY_MS = 750;
const POLL_INTERVAL_MS = 4000;
const IDLE_RESET_MS = 8000;

export function LivePipelineBar() {
  const [activeStage, setActiveStage] = useState(0);
  const [pendingReview, setPendingReview] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [lastId, setLastId] = useState(null);
  const [isReview, setIsReview] = useState(false);
  const [animating, setAnimating] = useState(false);
  const idleTimer = useRef(null);
  const animTimer = useRef(null);

  const resetToIdle = () => {
    setActiveStage(0);
    setAnimating(false);
    setIsReview(false);
  };

  const animatePipeline = (routingStatus) => {
    if (animating) return;
    setAnimating(true);
    const isRev = (routingStatus || '').includes('review');
    let step = 1;

    const advance = () => {
      setActiveStage(step);
      if (step < 4) {
        step += 1;
        animTimer.current = setTimeout(advance, ANIM_DELAY_MS);
      } else {
        setIsReview(isRev);
        idleTimer.current = setTimeout(resetToIdle, IDLE_RESET_MS);
        setAnimating(false);
      }
    };

    animTimer.current = setTimeout(advance, 80);
  };

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await client.get('/pipeline/status');
        if (cancelled) return;
        const data = res.data;
        setTodayCount(data.today_count ?? 0);
        setPendingReview(data.pending_review ?? 0);

        const newId = data.last_decision?.id;
        if (newId && newId !== lastId) {
          setLastId(newId);
          clearTimeout(idleTimer.current);
          clearTimeout(animTimer.current);
          animatePipeline(data.last_decision?.status);
        }
      } catch {
        // silent — indicator is non-critical
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(idleTimer.current);
      clearTimeout(animTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId]);

  return (
    <div className="flex items-center gap-0 px-4 py-2 bg-navy/80 border-b border-cobalt/60 backdrop-blur-sm shrink-0 overflow-x-auto">
      {/* Stage steps */}
      <div className="flex items-center gap-0 flex-1 min-w-0">
        {STAGES.map((stage, idx) => {
          const isActive = idx === activeStage;
          const isDone = idx < activeStage;
          const isFinal = idx === 4;
          const Icon = stage.icon;

          return (
            <div key={stage.id} className="flex items-center min-w-0">
              {/* Step */}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-300 shrink-0
                ${isActive && !isFinal ? 'bg-gold/15 text-gold' :
                  isDone || (isFinal && activeStage === 4)
                    ? (isFinal && isReview ? 'text-amber-400' : 'text-emerald-400')
                    : 'text-steel'}`}
              >
                <div className="relative flex items-center">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive && !isFinal ? 'animate-pulse' : ''}`} />
                  {/* Live dot on stage 0 */}
                  {idx === 0 && activeStage === 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </div>
                <span className={`text-[11px] font-medium whitespace-nowrap hidden sm:block
                  ${isActive && !isFinal ? 'text-gold' :
                    (isDone || (isFinal && activeStage === 4))
                      ? (isFinal && isReview ? 'text-amber-400' : 'text-emerald-400')
                      : 'text-steel'}`}
                >
                  {isFinal && activeStage === 4 && isReview ? 'Review' : stage.label}
                </span>
              </div>

              {/* Connector */}
              {idx < STAGES.length - 1 && (
                <div className={`w-6 h-px mx-0.5 transition-all duration-500 shrink-0
                  ${idx < activeStage ? 'bg-emerald-400/60' : 'bg-cobalt/60'}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Right-side stats */}
      <div className="flex items-center gap-3 ml-3 shrink-0 border-l border-cobalt/60 pl-3">
        <div className="flex items-center gap-1 text-[11px] text-silver whitespace-nowrap">
          <CheckCircle className="w-3 h-3 text-emerald-400/80" />
          <span className="font-semibold text-ivory">{todayCount}</span>
          <span className="hidden sm:inline">today</span>
        </div>
        <AnimatePresence>
          {pendingReview > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1 text-[11px] text-amber-400 whitespace-nowrap"
            >
              <Clock className="w-3 h-3" />
              <span className="font-semibold">{pendingReview}</span>
              <span className="hidden sm:inline">review</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
