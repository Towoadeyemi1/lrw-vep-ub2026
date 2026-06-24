import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#D4A820', '#ffffff', '#4ade80', '#60a5fa', '#f472b6', '#fb923c'];

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

function generateParticles(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    x: randomBetween(-200, 200),
    y: randomBetween(-350, -150),
    rotate: randomBetween(-360, 360),
    scale: randomBetween(0.5, 1.2),
    size: randomBetween(6, 12),
    shape: Math.random() > 0.5 ? 'circle' : 'rect',
  }));
}

export function ConfettiEffect({ trigger }) {
  const [particles, setParticles] = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setParticles(generateParticles(40));
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, [trigger]);

  return (
    <AnimatePresence>
      {visible && (
        <div
          className="fixed bottom-0 left-1/2 pointer-events-none z-50"
          style={{ transform: 'translateX(-50%)' }}
        >
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: p.scale }}
              animate={{
                x: p.x,
                y: p.y,
                opacity: [1, 1, 0],
                rotate: p.rotate,
                scale: [p.scale, p.scale * 1.2, 0],
              }}
              transition={{
                duration: 2.5,
                ease: [0.25, 0.46, 0.45, 0.94],
                opacity: { times: [0, 0.7, 1], duration: 2.5 },
                scale: { times: [0, 0.3, 1], duration: 2.5 },
              }}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.shape === 'rect' ? p.size * 0.5 : p.size,
                borderRadius: p.shape === 'circle' ? '50%' : '2px',
                backgroundColor: p.color,
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
