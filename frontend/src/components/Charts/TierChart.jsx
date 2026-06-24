import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TIER_LABELS = {
  tier1_lookup:  'Vendor Match',
  tier2_scoring: 'Pattern Match',
  tier3_llm:     'AI Analysis',
  human_review:  'Human Review',
};

const TIER_COLORS = {
  'Vendor Match':   '#22C55E',
  'Pattern Match':  '#3B82F6',
  'AI Analysis':    '#F97316',
  'Human Review':   '#EF4444',
};

export function TierChart({ tierUsage }) {
  const data = Object.entries(tierUsage || {})
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: TIER_LABELS[key] || key, value }));

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
