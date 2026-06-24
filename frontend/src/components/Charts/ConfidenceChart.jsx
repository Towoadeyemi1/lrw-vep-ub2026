import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const BANDS = [
  { key: '90-100%', label: '90–100%', color: '#22C55E' },
  { key: '70-90%', label: '70–90%', color: '#D4A820' },
  { key: '50-70%', label: '50–70%', color: '#F97316' },
  { key: '0-50%', label: '0–50%', color: '#EF4444' },
];

export function ConfidenceChart({ distribution }) {
  const data = BANDS.map(({ key, label, color }) => ({
    label,
    value: distribution?.[key] || 0,
    color,
  }));

  return (
    <div className="bg-navy rounded-xl border border-cobalt shadow-lg p-5">
      <h3 className="text-sm font-semibold text-silver uppercase tracking-wide mb-4">Confidence Distribution</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: '#8899AA', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#8899AA', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#0D2545',
              border: '1px solid #1B3F6B',
              borderRadius: 8,
              color: '#FAFAF7',
              fontSize: 12,
            }}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
