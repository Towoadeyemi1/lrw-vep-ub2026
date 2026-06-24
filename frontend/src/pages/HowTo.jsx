import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

// ── Data ──────────────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    letter: 'a',
    question: 'What stack and tools power this system?',
    color: 'border-blue-600/50 bg-blue-900/10',
    badge: 'bg-blue-700 text-blue-100',
    answer: 'FastAPI (Python) backend handles all invoice processing and classification logic. Claude AI (Anthropic Sonnet) is the Tier 3 reasoning engine — it reads raw invoice text and determines which entity it belongs to. SQLAlchemy + SQLite stores every routing decision and vendor profile, with a clean swap path to PostgreSQL for production. React + Vite powers the frontend. Nothing exotic: battle-tested components that can be handed off to any engineering team.',
    detail: [
      { icon: '⚡', label: 'FastAPI', note: 'async REST API, < 50ms routing decisions' },
      { icon: '🤖', label: 'Claude AI', note: 'Tier 3 contextual reasoning when rules fall short' },
      { icon: '🗄️', label: 'SQLite → Postgres', note: 'full audit trail, zero-cost upgrade path' },
      { icon: '🎨', label: 'React + Vite', note: 'live dashboard, mobile-ready' },
    ],
    cta: null,
  },
  {
    letter: 'b',
    question: 'How does it read invoices and choose the right entity out of 50?',
    color: 'border-gold/40 bg-gold/5',
    badge: 'bg-gold text-midnight',
    answer: 'Every invoice — PDF, image, Word doc, email attachment, or plain text — flows through a three-tier pipeline. Tier 1 checks whether the vendor is already known and auto-routes in milliseconds. Tier 2 scores five signals (vendor category, address patterns, PO format, amount range, entity name mentions) across all 50 entities. Only when both tiers are uncertain does Tier 3 send the invoice to Claude AI, which reads the full context and reasons like a human reviewer would.',
    detail: [
      { icon: '🔵', label: 'Vendor Match', note: 'known vendors route instantly — 100% confidence, 0 AI calls' },
      { icon: '🟡', label: 'Pattern Match', note: '5 weighted signals scored across all 50 entities' },
      { icon: '🟠', label: 'AI Analysis', note: 'Claude reads the full invoice context and reasons through it' },
    ],
    cta: { label: 'See it live on Process Invoice', path: '/process' },
  },
  {
    letter: 'c',
    question: 'What happens when the system isn\'t confident?',
    color: 'border-orange-600/40 bg-orange-900/10',
    badge: 'bg-orange-700 text-orange-100',
    answer: 'The system never guesses silently. Any invoice where the top-candidate confidence score falls below 92% is held automatically and placed in the Review Queue with the top-ranked entities shown to the reviewer. A human picks the correct entity and confirms — the system learns from that confirmation. After three confirmations from the same vendor, it earns AUTO-ROUTE status and never needs review again.',
    detail: [
      { icon: '🚦', label: 'Confidence gate', note: '< 92% → Review Queue, always' },
      { icon: '👤', label: 'Human confirmation', note: 'reviewer sees top candidates, picks the right one' },
      { icon: '📈', label: 'System learns', note: '3 confirmations → permanent auto-route' },
    ],
    cta: { label: 'See the Review Queue', path: '/review' },
  },
  {
    letter: 'd',
    question: 'How do you prevent costly misrouting errors?',
    color: 'border-red-600/40 bg-red-900/10',
    badge: 'bg-red-700 text-red-100',
    answer: 'Five independent layers prevent a wrong-entity route from reaching accounting — and even if one slips through, you can recall it. Every decision is logged with the confidence score, routing method, and who confirmed it, so any misroute is immediately visible and correctable directly from the Audit Log.',
    detail: [
      { icon: '1️⃣', label: 'Confidence threshold', note: 'uncertain invoices never self-route — held automatically' },
      { icon: '2️⃣', label: 'Human confirmation gate', note: 'a person approves before any new vendor auto-routes' },
      { icon: '3️⃣', label: 'Vendor learning lifecycle', note: 'auto-route only after 3 confirmed decisions, not 1' },
      { icon: '4️⃣', label: 'Full audit trail', note: 'every decision logged — routing method, confidence, who confirmed it' },
      { icon: '5️⃣', label: 'Recall & correct', note: 'any routed invoice can be recalled from the Audit Log and re-routed immediately' },
    ],
    cta: { label: 'See the Audit Log', path: '/audit' },
  },
  {
    letter: 'e',
    question: 'How do you measure whether it\'s actually working?',
    color: 'border-green-600/40 bg-green-900/10',
    badge: 'bg-green-700 text-green-100',
    answer: 'The Dashboard shows the four KPIs that tell the whole story at a glance. Auto-route % is the headline: it should rise week over week as vendors move through the learning lifecycle. Tier distribution shows whether you\'re calling Claude less over time (a healthy system routes more on Tier 1 and 2). Confidence histogram shows whether decisions are getting sharper. And per-entity volume shows exactly how much work each of the 50 entities is handling.',
    detail: [
      { icon: '📊', label: 'Auto-route %', note: 'the headline KPI — should trend upward continuously' },
      { icon: '🎯', label: 'Tier distribution', note: 'Tier 1 share growing = system learning correctly' },
      { icon: '📈', label: 'Confidence histogram', note: 'bi-modal distribution = high clarity, low uncertainty' },
      { icon: '🏢', label: 'Per-entity volume', note: '50-entity heatmap shows routing load in real-time' },
    ],
    cta: { label: 'See the Dashboard', path: '/' },
  },
];

const TIERS = [
  {
    icon: '🔵',
    tier: 'Vendor Match',
    color: 'text-blue-300',
    border: 'border-blue-700/50',
    bg: 'bg-blue-900/20',
    desc: 'Known vendors route in milliseconds. No AI call needed. 100% confidence.',
  },
  {
    icon: '🟡',
    tier: 'Pattern Match',
    color: 'text-gold',
    border: 'border-gold/30',
    bg: 'bg-gold/5',
    desc: 'Scores 5 signals (vendor category, address patterns, PO format, amount range, entity mentions) across all 50 entities.',
  },
  {
    icon: '🟠',
    tier: 'AI Analysis',
    color: 'text-orange-300',
    border: 'border-orange-700/50',
    bg: 'bg-orange-900/20',
    desc: 'Claude AI reads the full invoice context and reasons through which entity it belongs to.',
  },
  {
    icon: '🔴',
    tier: 'Human Review',
    color: 'text-red-300',
    border: 'border-red-700/50',
    bg: 'bg-red-900/20',
    desc: 'When confidence is below threshold, a human confirms the routing — and the system learns from every confirmation.',
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

const ENTITIES_BY_VERTICAL = [
  {
    vertical: 'Hospitality',
    color: 'text-blue-300 bg-blue-900/20 border-blue-700/40',
    dot: 'bg-blue-400',
    entities: [
      'Coastal Grand Hotel', 'Harbour Suites & Conference Centre', 'The Summit Resort & Spa',
      'Pacific Inn Group Operations', 'Bayside Hotel & Events', 'Riverside Inn & Suites',
      'Mountain Peak Lodge', 'The Urban Grand Hotel', 'Garden Terrace Hotel', 'The Peninsula Club',
    ],
  },
  {
    vertical: 'Real Estate',
    color: 'text-purple-300 bg-purple-900/20 border-purple-700/40',
    dot: 'bg-purple-400',
    entities: [
      'Pacific Commercial Properties Ltd', 'Harbour View Residential', 'Summit Land Holdings',
      'Metro Property Management', 'Coastal Development Group', 'Westside Commercial Realty',
      'Northgate Property Holdings', 'Eastview Retail Centers', 'Downtown Mixed-Use Properties',
      'Greenfield Residential Communities',
    ],
  },
  {
    vertical: 'Wellness',
    color: 'text-green-300 bg-green-900/20 border-green-700/40',
    dot: 'bg-green-400',
    entities: [
      'Serenity Wellness Studios', 'Pure Life E-Commerce', 'Vitality Health Retail',
      'Elite Fitness Chain', 'Botanical Spa & Wellness', 'Mind & Body Clinic Network',
      'Active Life Sports Centers', 'NutriLife Health Stores',
    ],
  },
  {
    vertical: 'Food & Beverage',
    color: 'text-orange-300 bg-orange-900/20 border-orange-700/40',
    dot: 'bg-orange-400',
    entities: [
      'The Harbour Restaurant Group', 'Summit Catering & Events', 'Pacific Farm-to-Table Restaurants',
      'Coastal Brew & Bistro', 'Artisan Bakery Chain', 'The Urban Kitchen Group',
      'Fine Dining Collections', 'Waterfront Café Network',
    ],
  },
  {
    vertical: 'Retail',
    color: 'text-pink-300 bg-pink-900/20 border-pink-700/40',
    dot: 'bg-pink-400',
    entities: [
      'Coastal Lifestyle Retail', 'Pacific Fashion Group', 'Homestyle Furnishings',
      'Outdoor & Adventure Gear', 'Luxury Goods Boutiques', 'Tech & Electronics Stores',
      "Children's World Retail",
    ],
  },
  {
    vertical: 'Construction',
    color: 'text-yellow-300 bg-yellow-900/20 border-yellow-700/40',
    dot: 'bg-yellow-400',
    entities: [
      'Pacific Construction Group', 'Summit Interior Fit-Outs', 'Coastal Infrastructure Works',
      'Urban Renovation Projects', 'Greenland Landscaping Division',
    ],
  },
  {
    vertical: 'Technology',
    color: 'text-teal-300 bg-teal-900/20 border-teal-700/40',
    dot: 'bg-teal-400',
    entities: [
      'Inspiration Tech Corp HQ', 'Digital Growth Marketing',
    ],
  },
];

const CONFIDENCE_ROWS = [
  { score: '≥ 92%', status: 'Auto-Routed', color: 'text-green-300', action: 'Routes immediately, no human needed' },
  { score: '65–92%', status: 'Human Review', color: 'text-gold', action: 'Held in Review Queue for confirmation' },
  { score: '< 65%', status: 'Escalated', color: 'text-red-300', action: 'Flagged for owner review' },
];

const TIPS = [
  'Always run the demo in order — the learning effect is most visible when vendors start from NEW',
  'Check the Intelligence page after each invoice — vendor statuses update in real-time',
  'Click any metric card on the Dashboard to drill into the full detail — Pending Review goes straight to the queue, Known Vendors opens Intelligence',
  'If an invoice was routed to the wrong entity, open the Audit Log, expand that row, and click "Recall for Re-routing" to send it back to the Review Queue',
  'The Email integration checks every 60 seconds — send a real invoice attachment to test it',
  'Download the Excel export after running the demo — it shows the full intelligence report with every decision',
  'Use Generate Test Volume (2× or 3× rounds) to fast-forward the learning lifecycle in the demo',
];

// ── Sub-components ─────────────────────────────────────────────────────────────

const VERTICAL_COLOR = {
  Hospitality: 'text-blue-300 bg-blue-900/20 border-blue-700/40',
  'Real Estate': 'text-purple-300 bg-purple-900/20 border-purple-700/40',
  Wellness: 'text-green-300 bg-green-900/20 border-green-700/40',
  'Food & Beverage': 'text-orange-300 bg-orange-900/20 border-orange-700/40',
  Retail: 'text-pink-300 bg-pink-900/20 border-pink-700/40',
  Construction: 'text-yellow-300 bg-yellow-900/20 border-yellow-700/40',
  Technology: 'text-teal-300 bg-teal-900/20 border-teal-700/40',
};

function Section({ id, title, subtitle, children, className = '' }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4 }}
      className={`flex flex-col gap-5 ${className}`}
    >
      <div className="border-b border-cobalt pb-3">
        <h2 className="text-gold font-bold text-lg uppercase tracking-wide">{title}</h2>
        {subtitle && <p className="text-silver text-sm mt-1">{subtitle}</p>}
      </div>
      {children}
    </motion.section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
          How Invoice Routing Intelligence Works
        </h1>
        <p className="text-silver text-base leading-relaxed max-w-2xl">
          A self-learning AI system that monitors your email inbox, reads every invoice regardless
          of format, and routes it to the correct entity out of 50 — without guessing when it isn't sure.
        </p>
      </motion.div>

      {/* Section: How It Works — Every Question Answered */}
      <Section
        id="how-it-works"
        title="How It Works — Every Question Answered"
        subtitle="The five questions every stakeholder asks — and exactly how this system handles each one."
      >
        <div className="flex flex-col gap-5">
          {HOW_IT_WORKS.map((item) => (
            <motion.div
              key={item.letter}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
              className={`rounded-xl border p-6 flex flex-col gap-4 ${item.color}`}
            >
              {/* Header */}
              <div className="flex items-start gap-4">
                <span className={`flex items-center justify-center w-9 h-9 rounded-full font-black text-base shrink-0 ${item.badge}`}>
                  {item.letter}
                </span>
                <h3 className="text-ivory font-bold text-base leading-snug mt-0.5">{item.question}</h3>
              </div>

              {/* Answer text */}
              <p className="text-silver text-sm leading-relaxed pl-13">{item.answer}</p>

              {/* Detail chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-0 sm:pl-13">
                {item.detail.map((d) => (
                  <div key={d.label} className="flex items-start gap-2 bg-midnight/40 rounded-lg px-3 py-2">
                    <span className="text-base shrink-0">{d.icon}</span>
                    <div>
                      <p className="text-ivory text-xs font-semibold">{d.label}</p>
                      <p className="text-silver text-xs mt-0.5">{d.note}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {item.cta && (
                <div className="pl-0 sm:pl-13">
                  <button
                    onClick={() => navigate(item.cta.path)}
                    className="text-gold text-xs font-semibold hover:underline"
                  >
                    {item.cta.label} →
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Section: 3-Tier Engine */}
      <Section id="tiers" title="The 3-Tier Classification Engine">
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

      {/* Section: Learning Lifecycle */}
      <Section id="lifecycle" title="The Learning Lifecycle">
        {/* Desktop stepper */}
        <div className="hidden sm:flex items-start">
          {LIFECYCLE.map((step, i) => (
            <div key={step.label} className="flex flex-col items-center flex-1">
              <div className="flex items-center w-full">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full text-xl font-bold shrink-0 mx-auto ${step.color}`}>
                  {step.icon}
                </div>
                {i < LIFECYCLE.length - 1 && (
                  <div className="flex-1 h-px border-t border-dashed border-cobalt -ml-2 mr-[-8px] mt-[-24px] hidden" />
                )}
              </div>
              <div className="text-center px-2 mt-3">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${step.color}`}>{step.label}</span>
                <p className="text-silver text-xs mt-2 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Connecting line (desktop) */}
        <div className="hidden sm:flex items-center gap-0 -mt-[140px] mb-[100px] px-6 pointer-events-none">
          {LIFECYCLE.map((_, i) => (
            i < LIFECYCLE.length - 1 ? (
              <div key={i} className="flex-1 h-px border-t border-dashed border-cobalt mx-5" />
            ) : null
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

      {/* Section: Quick Start */}
      <Section id="quickstart" title="Quick Start Guide">
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

      {/* Section: Submitting Invoices */}
      <Section id="submit" title="Submitting Invoices — 3 Ways">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SUBMISSION_METHODS.map((m) => (
            <div key={m.title} className="bg-navy rounded-xl border border-cobalt p-5 flex flex-col gap-3">
              <span className="text-3xl">{m.icon}</span>
              <h3 className="text-ivory font-bold text-sm">{m.title}</h3>
              <p className="text-silver text-xs leading-relaxed flex-1">{m.desc}</p>
              {m.mono && (
                <p className="text-gold font-mono text-xs bg-midnight/50 px-2 py-1 rounded break-all">{m.mono}</p>
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

      {/* Section: 50 Business Entities */}
      <Section
        id="entities"
        title="All 50 Business Entities"
        subtitle="Grouped by vertical. The classifier scores each invoice against all 50 simultaneously."
      >
        <div className="flex flex-col gap-5">
          {ENTITIES_BY_VERTICAL.map((group) => (
            <div key={group.vertical} className="bg-navy rounded-xl border border-cobalt overflow-hidden">
              {/* Group header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-cobalt/20 border-b border-cobalt">
                <span className={`w-2 h-2 rounded-full shrink-0 ${group.dot}`} />
                <span className={`text-xs font-bold uppercase tracking-wide border px-2 py-0.5 rounded ${group.color}`}>
                  {group.vertical}
                </span>
                <span className="text-steel text-xs ml-auto">{group.entities.length} entities</span>
              </div>
              {/* Entity list */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.entities.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-silver hover:text-ivory transition-colors">
                    <span className="text-cobalt">›</span>
                    {name}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => navigate('/intelligence')}
            className="text-gold text-xs font-semibold hover:underline"
          >
            View live entity stats on Intelligence →
          </button>
        </div>
      </Section>

      {/* Section: Confidence Thresholds */}
      <Section id="confidence" title="Confidence Thresholds">
        <div className="overflow-x-auto rounded-xl border border-cobalt">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cobalt bg-cobalt/20">
                <th className="text-left px-4 py-3 text-xs text-silver font-semibold uppercase tracking-wide">Score</th>
                <th className="text-left px-4 py-3 text-xs text-silver font-semibold uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs text-silver font-semibold uppercase tracking-wide">What Happens</th>
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

      {/* Section: Tips */}
      <Section id="tips" title="Tips">
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
