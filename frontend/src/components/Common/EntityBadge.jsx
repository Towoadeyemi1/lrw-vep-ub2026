const VERTICAL_COLORS = {
  hospitality: 'bg-blue-700 text-blue-100',
  real_estate: 'bg-amber text-cream',
  wellness: 'bg-success text-green-100',
  default: 'bg-steel text-cloud',
};

export function EntityBadge({ vertical, className = '' }) {
  const key = (vertical || '').toLowerCase().replace(/\s+/g, '_');
  const cls = VERTICAL_COLORS[key] || VERTICAL_COLORS.default;
  const label = (vertical || 'unknown').replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tracking-wide uppercase ${cls} ${className}`}>
      {label}
    </span>
  );
}
