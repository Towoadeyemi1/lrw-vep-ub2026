import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const ENTITIES_TABLE = [
  { name: 'Grand Luxe Hotel Group', vertical: 'Hospitality', vendors: 'Luxury linen suppliers, fine-dining vendors, spa equipment' },
  { name: 'Bayshore Resort Collection', vertical: 'Hospitality', vendors: 'Resort amenities, marina services, beach equipment' },
  { name: 'Summit Conference Centers', vertical: 'Hospitality', vendors: 'AV equipment, catering services, event staffing' },
  { name: 'Urban Boutique Hotels', vertical: 'Hospitality', vendors: 'Interior design, local art suppliers, boutique amenities' },
  { name: 'Coastal Property Management', vertical: 'Real Estate', vendors: 'Landscaping, coastal maintenance, property services' },
  { name: 'Metro Real Estate Holdings', vertical: 'Real Estate', vendors: 'Urban contractors, office suppliers, facility management' },
  { name: 'Suburban Development Corp', vertical: 'Real Estate', vendors: 'Construction materials, suburban contractors, utilities' },
  { name: 'Industrial Warehouse Group', vertical: 'Real Estate', vendors: 'Heavy equipment, industrial supplies, logistics' },
  { name: 'Harmony Wellness Centers', vertical: 'Wellness', vendors: 'Yoga equipment, meditation supplies, wellness products' },
  { name: 'Peak Performance Gyms', vertical: 'Wellness', vendors: 'Fitness equipment, supplements, sports nutrition' },
  { name: 'MindBody Spa Collection', vertical: 'Wellness', vendors: 'Massage oils, spa equipment, beauty products' },
  { name: 'Nutrition & Health Clinics', vertical: 'Wellness', vendors: 'Medical supplies, nutritional products, health tech' },
];

const TIERS = [
  {
    icon: '🔵',
    tier: 'Tier 1 — Instant Lookup',
    color: 'text-blue-300',
    border: 'border-blue-700/50',
    bg: 'bg-blue-900/20',
    desc: 'Known vendors route in milliseconds. No AI needed. 100% confidence.',
  },
  {
    icon: '🟡',
    tier: 'Tier 2 — Signal Scoring',
    color: 'text-gold',
    border: 'border-gold/30',
    bg: 'bg-gold/5',
    desc: 'Matches vendor category, address patterns, PO format, and amount range against all 12 entities.',
  },
  {
    icon: '🟠',
    tier: 'Tier 3 — AI Reasoning',
    color: 'text-orange-300',
    border: 'border-orange-700/50',
    bg: 'bg-orange-900/20',
    desc: 'Claude AI reads the full invoice context and reasons about which entity it belongs to.',
  },
  {
    icon: '🔴',
    tier: 'Human Review',
    color: 'text-red-300',
    border: 'border-red-700/50',
    bg: 'bg-red-900/20',
    desc: 'When confidence is below threshold, a human confirms — and the system learns from that confirmation.',
  },
];

const LIFECYCLE = [
  { icon: '🆕', label: 'NEW', color: 'bg-steel text-cloud', desc: 'First time a vendor is seen. Profile created automatically.' },
  { icon: '📚', label: 'LEARNING', color: 'bg-amber text-midnight', desc: 'After 1st human confirmation. System is building confidence.' },
  { icon: '✅', label: 'CONFIRMED', color: 'bg-cobalt text-cloud', desc: 'After 3rd confirmation. Routing is trusted.' },
  { icon: '🚀', label: 'AUTO-ROUTE', color: 'bg-green-700 text-green-100', desc: 'Vendor routes instantly and permanently via Tier 1.' },
];

const QUICKSTART = [
  { step: 1, text: <>Go to <strong className="text-gold">Demo Controls</strong> → click <strong className="text-gold">Run Full Demo</strong> to see the system learn from scratch</> },
  { step: 2, text: <>Go to <strong className="text-gold">Review Queue</strong> → confirm the pending invoices to teach the system</> },
  { step: 3, text: <>Go to <strong className="text-gold">Intelligence</strong> → watch vendor status badges change in real-time</> },
  { step: 4, text: <>Go to <strong className="text-gold">Process Invoice</strong> → upload your own invoice to test with real data</> },
  { step: 5, text: <>Go to <strong className="text-gold">Export</strong> → download the full Excel report</> },
];

const SUBMISSION_METHODS = [
  {
    icon: '📤',
    title: 'Web Upload',
    desc: 'Drag & drop any invoice (PDF, image, Word, text) on the Process Invoice page',
    path: '/process',
    cta: 'Go to Process Invoice',
  },
  {
    icon: '📧',
    title: 'Email',
    desc: 'Send invoice attachments to invoices.inspirationtechcorp@gmail.com — processed within 60 seconds',
    path: null,
    mono: 'invoices.inspirationtechcorp@gmail.com',
  },
  {
    icon: '📁',
    title: 'Folder Drop',
    desc: 'SFTP any file to /watched/incoming/ on the server — auto-processed instantly',
    path: null,
    mono: '/watched/incoming/',
  },
];

const CONFIDENCE_ROWS = [
  { score: '≥ 92%', status: 'Auto-Routed', color: 'text-green-300', action: 'Routes immediately' },
  { score: '65–92%', status: 'Human Review', color: 'text-gold', action: 'Held for confirmation' },
  { score: '< 65%', status: 'Escalated', color: 'text-red-300', action: 'Owner review required' },
];

const TIPS = [
  'Always run the demo in order — the learning effect is most visible when vendors start from NEW',
  'Check the Intelligence page after each invoice — it updates in real-time',
  'The Email integration checks every 60 seconds — send a real invoice to test it',
  'Download the Excel export after running the demo — it shows the full intelligence report',
];

const VERTICAL_COLOR = {
  Hospitality: 'text-blue-300 bg-blue-900/20 border-blue-700/40',
  'Real Estate': 'text-purple-300 bg-purple-900/20 border-purple-700/40',
  Wellness: 'text-green-300 bg-green-900/20 border-green-700/40',
};

function Section({ id, title, children, className = '' }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4 }}
      className={`flex flex-col gap-5 ${className}`}
    >
      <h2 className="text-gold font-bold text-lg uppercase tracking-wide border-b border-cobalt pb-3">{title}</h2>
      {children}
    </motion.section>
  );
}

export default function HowTo() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'How To | Invoice Routing Intelligence';
  }, []);

  return (
    <div className="p-6 max-w-4xl flex flex-col gap-10">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-br from-cobalt via-navy to-midnight rounded-2xl border border-cobalt p-8"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-ivory mb-3 leading-tight">
          How to Use Invoice Routing Intelligence
        </h1>
        <p className="text-silver text-base leading-relaxed max-w-2xl">
          A self-learning AI system that routes vendor invoices automatically — getting smarter with every confirmation.
        </p>
      </motion.div>

      {/* Section 1: Tier Engine */}
      <Section title="The 3-Tier Classification Engine">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TIERS.map((t) => (
            <div
              key={t.tier}
              className={`rounded-xl border p-5 flex flex-col gap-3 ${t.bg} ${t.border}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{t.icon}</span>
                <span className={`font-bold text-sm ${t.color}`}>{t.tier}</span>
              </div>
              <p className="text-silver text-sm leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Section 2: Learning Lifecycle */}
      <Section title="The Learning Lifecycle">
        {/* Horizontal stepper */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-0">
          {LIFECYCLE.map((step, i) => (
            <div key={step.label} className="flex sm:flex-col items-start sm:items-center flex-1 gap-3 sm:gap-0">
              {/* Step icon + connector */}
              <div className="flex sm:flex-col items-center sm:w-full">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full text-xl font-bold shrink-0 ${step.color}`}>
                  {step.icon}
                </div>
                {i < LIFECYCLE.length - 1 && (
                  <div className="flex-1 sm:flex-none h-px sm:h-0 sm:w-full bg-cobalt sm:border-t sm:border-dashed sm:border-cobalt mx-2 sm:mx-0 sm:my-0 hidden sm:block" />
                )}
              </div>
              <div className="sm:text-center sm:px-2 sm:mt-3 flex-1 sm:flex-none">
                <p className={`font-bold text-sm ${step.color.split(' ')[0]}`}>
                  <span className={`px-2 py-0.5 rounded text-xs ${step.color}`}>{step.label}</span>
                </p>
                <p className="text-silver text-xs mt-2 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Mobile vertical stepper */}
        <div className="flex flex-col gap-4 sm:hidden">
          {LIFECYCLE.map((step, i) => (
            <div key={step.label} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full text-lg shrink-0 ${step.color}`}>
                  {step.icon}
                </div>
                {i < LIFECYCLE.length - 1 && (
                  <div className="w-px flex-1 bg-cobalt mt-2 min-h-[2rem]" />
                )}
              </div>
              <div className="flex-1 pb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${step.color}`}>{step.label}</span>
                <p className="text-silver text-xs mt-1.5 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Section 3: Quick Start */}
      <Section title="Quick Start Guide">
        <ol className="flex flex-col gap-4">
          {QUICKSTART.map(({ step, text }) => (
            <li key={step} className="flex items-start gap-4 bg-navy rounded-xl border border-cobalt p-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gold text-midnight font-bold text-sm shrink-0">
                {step}
              </span>
              <p className="text-silver text-sm leading-relaxed mt-0.5">{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Section 4: Submitting Invoices */}
      <Section title="Submitting Invoices — 3 Ways">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SUBMISSION_METHODS.map((m) => (
            <div key={m.title} className="bg-navy rounded-xl border border-cobalt p-5 flex flex-col gap-3">
              <span className="text-3xl">{m.icon}</span>
              <h3 className="text-ivory font-bold text-sm">{m.title}</h3>
              <p className="text-silver text-xs leading-relaxed flex-1">{m.desc}</p>
              {m.mono && (
                <p className="text-gold font-mono text-xs bg-midnight/50 px-2 py-1 rounded">{m.mono}</p>
              )}
              {m.path && (
                <button
                  onClick={() => navigate(m.path)}
                  className="text-gold text-xs font-medium hover:underline text-left"
                >
                  {m.cta} →
                </button>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Section 5: 12 Business Entities */}
      <Section title="The 12 Business Entities">
        <div className="overflow-x-auto rounded-xl border border-cobalt">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cobalt bg-cobalt/20">
                <th className="text-left px-4 py-3 text-xs text-silver font-semibold uppercase tracking-wide">Entity</th>
                <th className="text-left px-4 py-3 text-xs text-silver font-semibold uppercase tracking-wide">Vertical</th>
                <th className="text-left px-4 py-3 text-xs text-silver font-semibold uppercase tracking-wide hidden md:table-cell">Typical Vendors</th>
              </tr>
            </thead>
            <tbody>
              {ENTITIES_TABLE.map((e, i) => (
                <tr key={i} className="border-b border-cobalt/40 last:border-0 hover:bg-cobalt/10 transition-colors">
                  <td className="px-4 py-3 text-ivory font-medium text-xs">{e.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded border ${VERTICAL_COLOR[e.vertical] || 'text-silver bg-cobalt/20 border-cobalt'}`}>
                      {e.vertical}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-silver text-xs hidden md:table-cell">{e.vendors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Section 6: Confidence Thresholds */}
      <Section title="Confidence Thresholds">
        <div className="overflow-x-auto rounded-xl border border-cobalt">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cobalt bg-cobalt/20">
                <th className="text-left px-4 py-3 text-xs text-silver font-semibold uppercase tracking-wide">Score</th>
                <th className="text-left px-4 py-3 text-xs text-silver font-semibold uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs text-silver font-semibold uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {CONFIDENCE_ROWS.map((r) => (
                <tr key={r.score} className="border-b border-cobalt/40 last:border-0">
                  <td className="px-4 py-3 font-mono text-ivory font-semibold text-sm">{r.score}</td>
                  <td className={`px-4 py-3 font-bold text-sm ${r.color}`}>{r.status}</td>
                  <td className="px-4 py-3 text-silver text-sm">{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Section 7: Tips */}
      <Section title="Tips">
        <div className="flex flex-col gap-3">
          {TIPS.map((tip, i) => (
            <div key={i} className="flex items-start gap-3 bg-navy rounded-xl border border-cobalt/60 p-4">
              <span className="text-gold font-bold text-sm shrink-0 mt-0.5">→</span>
              <p className="text-silver text-sm leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
