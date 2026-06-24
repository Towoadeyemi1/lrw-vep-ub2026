import { useEffect, useRef, useState } from 'react';
import { useMotionValue, useTransform, animate } from 'framer-motion';

export function AnimatedCounter({ value, prefix = '', suffix = '', decimals = 0 }) {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(() => {
    const n = parseFloat(value) || 0;
    return prefix + n.toFixed(decimals) + suffix;
  });
  const prevValue = useRef(0);

  useEffect(() => {
    const numeric = parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;
    const from = prevValue.current;
    prevValue.current = numeric;

    const controls = animate(motionValue, numeric, {
      duration: 1,
      ease: [0.16, 1, 0.3, 1],
      from,
      onUpdate(v) {
        setDisplay(prefix + v.toFixed(decimals) + suffix);
      },
    });

    return () => controls.stop();
  }, [value, prefix, suffix, decimals]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span>{display}</span>;
}
