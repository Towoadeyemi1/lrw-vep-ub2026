export function MetricCard({ label, value, subLabel, valueColor, icon: Icon, trend }) {
  return (
    <div className="bg-navy rounded-xl shadow-lg p-6 flex flex-col gap-2 border border-cobalt">
      <div className="flex items-center justify-between">
        <span className="text-silver text-sm font-medium tracking-wide uppercase">{label}</span>
        {Icon && (
          <div className="w-9 h-9 rounded-lg bg-cobalt flex items-center justify-center">
            <Icon className="w-5 h-5 text-gold" />
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-4xl font-bold ${valueColor || 'text-gold'}`}>{value}</span>
        {trend !== undefined && (
          <span className={`text-sm font-semibold mb-1 ${trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-silver'}`}>
            {trend > 0 ? `+${trend}` : trend}
          </span>
        )}
      </div>
      {subLabel && <span className="text-silver text-xs">{subLabel}</span>}
    </div>
  );
}
