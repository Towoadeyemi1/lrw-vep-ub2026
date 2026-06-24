/**
 * Tests for the buildSteps() helper in ProcessInvoice.jsx.
 *
 * buildSteps() produces the 7-step pipeline description array used by
 * ProcessingAnimation. We extract the function logic here rather than
 * importing from the JSX so tests remain pure JS with no React rendering.
 */

function buildSteps(result) {
  return [
    { id: 'upload',     label: 'Uploading invoice...',              done: true,     active: false },
    { id: 'received',   label: 'Invoice received',                  done: true,     active: false },
    { id: 'extract',    label: 'Extracting data with Claude AI...', done: !!result, active: !result },
    {
      id: 'vendor',
      label: result
        ? `Vendor identified: ${result.vendor_canonical || result.vendor_name || '...'}`
        : 'Identifying vendor...',
      done: !!result, active: false,
      badge: result ? (result.is_new_vendor ? 'NEW' : 'KNOWN') : undefined,
    },
    {
      id: 'classify',
      label: result
        ? `Classification complete — ${result.tier_used || result.tier || 'Tier ?'} used`
        : 'Running three-tier classification...',
      done: !!result, active: false,
    },
    {
      id: 'confidence',
      label: result ? `Confidence: ${result.confidence_score ?? 0}%` : 'Calculating confidence...',
      done: !!result, active: false,
      badge: result
        ? (result.confidence_score >= 90 ? 'HIGH' : result.confidence_score >= 70 ? 'GOOD' : 'LOW')
        : undefined,
    },
    {
      id: 'decision',
      label: result
        ? `Decision: ${(result.routing_decision || result.routing_status || '').replace(/_/g, ' ')}`
        : 'Making routing decision...',
      done: !!result, active: false,
    },
  ];
}

// ── Idle state (no result) ────────────────────────────────────────────────────

describe('buildSteps with null result (processing state)', () => {
  const steps = buildSteps(null);

  test('returns 7 steps', () => {
    expect(steps).toHaveLength(7);
  });

  test('upload and received are always done', () => {
    expect(steps[0].done).toBe(true);
    expect(steps[1].done).toBe(true);
  });

  test('extract step is active while processing', () => {
    expect(steps[2].active).toBe(true);
    expect(steps[2].done).toBe(false);
  });

  test('remaining steps are not done', () => {
    steps.slice(3).forEach((s) => {
      expect(s.done).toBe(false);
    });
  });

  test('vendor step shows placeholder label', () => {
    expect(steps[3].label).toBe('Identifying vendor...');
  });

  test('confidence step has no badge', () => {
    expect(steps[5].badge).toBeUndefined();
  });
});

// ── Completed state ───────────────────────────────────────────────────────────

describe('buildSteps with a result object', () => {
  const result = {
    vendor_canonical: 'sysco food services',
    is_new_vendor: false,
    tier_used: 'Tier 2',
    confidence_score: 88,
    routing_decision: 'auto_routed',
    routing_status: 'auto_routed',
  };
  const steps = buildSteps(result);

  test('all steps are done', () => {
    steps.forEach((s) => expect(s.done).toBe(true));
  });

  test('extract step is no longer active', () => {
    expect(steps[2].active).toBe(false);
  });

  test('vendor label contains canonical name', () => {
    expect(steps[3].label).toContain('sysco food services');
  });

  test('known vendor gets KNOWN badge', () => {
    expect(steps[3].badge).toBe('KNOWN');
  });

  test('new vendor gets NEW badge', () => {
    const s = buildSteps({ ...result, is_new_vendor: true });
    expect(s[3].badge).toBe('NEW');
  });

  test('tier label included', () => {
    expect(steps[4].label).toContain('Tier 2');
  });

  test('confidence label shows score', () => {
    expect(steps[5].label).toBe('Confidence: 88%');
  });

  test('confidence 90+ is HIGH', () => {
    const s = buildSteps({ ...result, confidence_score: 92 });
    expect(s[5].badge).toBe('HIGH');
  });

  test('confidence 70-89 is GOOD', () => {
    expect(steps[5].badge).toBe('GOOD');
  });

  test('confidence below 70 is LOW', () => {
    const s = buildSteps({ ...result, confidence_score: 60 });
    expect(s[5].badge).toBe('LOW');
  });

  test('underscores replaced with spaces in decision label', () => {
    expect(steps[6].label).toBe('Decision: auto routed');
  });

  test('falls back to routing_status when routing_decision missing', () => {
    const s = buildSteps({ ...result, routing_decision: undefined });
    expect(s[6].label).toContain('auto routed');
  });

  test('tier falls back gracefully when missing', () => {
    const s = buildSteps({ ...result, tier_used: undefined, tier: undefined });
    expect(s[4].label).toContain('Tier ?');
  });

  test('confidence_score of 0 shown as 0%', () => {
    const s = buildSteps({ ...result, confidence_score: 0 });
    expect(s[5].label).toBe('Confidence: 0%');
  });
});
