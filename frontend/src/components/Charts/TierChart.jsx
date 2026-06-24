import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TIER_COLORS = {
  'Tier 1': '#22C55E',
  'Tier 2': '#3B82F6',
  'Tier 3': '#F97316',
  'Human': '#EF4444',
};

export function TierChart({ tierUsage }) {
  const data = Object.entries(tierUsage || {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  if (data.length === 0) {
    return (
      <div className="bg-navy rounded-xl border border-cobalt shadow-lg p-5 flex items-center justify-center" style={{ minHeight: 260 }}>
        <p className="text-silver text-sm">No data yet</p>
      </div>
    );
  }

  return (
    <div className="bg-navy rounded-xl border border-cobalt shadow-lg p-5">
      <h3 className="text-sm font-semibold text-silver uppercase tracking-wide mb-4">Routing Tier Usage</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, idx) => (
              <Cell key={idx} fill={TIER_COLORS[entry.name] || '#5C6E82'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#0D2545',
              border: '1px solid #1B3F6B',
              borderRadius: 8,
              color: '#FAFAF7',
              fontSize: 12,
            }}
          />
          <Legend
            iconType="circle"
            formatter={(value) => <span style={{ color: '#8899AA', fontSize: 12 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
