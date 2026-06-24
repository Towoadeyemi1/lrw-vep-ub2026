export function Skeleton({ className = '' }) {
  return (
    <div
      className={`rounded-lg bg-cobalt/30 animate-shimmer ${className}`}
      style={{
        background: 'linear-gradient(90deg, rgba(40,60,100,0.3) 25%, rgba(40,60,100,0.6) 50%, rgba(40,60,100,0.3) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-navy rounded-xl border border-cobalt shadow-lg p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-20 mt-1" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function TableRowSkeleton({ rows = 5, cols = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} className="border-b border-cobalt/40">
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} className="px-4 py-3">
              <Skeleton className="h-4" style={{ width: `${55 + Math.random() * 45}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// Inject shimmer keyframes once
if (typeof document !== 'undefined' && !document.getElementById('shimmer-keyframes')) {
  const style = document.createElement('style');
  style.id = 'shimmer-keyframes';
  style.textContent = `
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .animate-shimmer {
      background: linear-gradient(90deg, rgba(40,60,100,0.3) 25%, rgba(40,60,100,0.6) 50%, rgba(40,60,100,0.3) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
  `;
  document.head.appendChild(style);
}
