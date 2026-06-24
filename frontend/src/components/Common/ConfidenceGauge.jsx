export function ConfidenceGauge({ score, size = 120 }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score || 0));
  const offset = circumference - (pct / 100) * circumference;

  let color = '#EF4444';
  if (pct >= 90) color = '#22C55E';
  else if (pct >= 70) color = '#D4A820';
  else if (pct >= 50) color = '#F97316';

  let label = 'LOW';
  if (pct >= 90) label = 'HIGH';
  else if (pct >= 70) label = 'GOOD';
  else if (pct >= 50) label = 'MEDIUM';

  let labelColor = 'text-red-400';
  if (pct >= 90) labelColor = 'text-green-400';
  else if (pct >= 70) labelColor = 'text-gold';
  else if (pct >= 50) labelColor = 'text-orange-400';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1B3F6B"
          strokeWidth={8}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
      </svg>
      <div className="flex flex-col items-center relative z-10">
        <span className="text-2xl font-bold text-ivory leading-none">{pct}%</span>
        <span className={`text-[10px] font-bold tracking-widest mt-1 ${labelColor}`}>{label}</span>
      </div>
    </div>
  );
}
