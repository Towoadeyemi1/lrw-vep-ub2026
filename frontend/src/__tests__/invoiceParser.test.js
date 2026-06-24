/**
 * Tests for the line-classification logic inside TextInvoiceDoc.
 *
 * We test the rules that decide how each line of invoice text is rendered,
 * without mounting the React component (pure logic extraction).
 */

// Mirrors the classification logic from InvoicePreview.jsx
function classifyLine(line, lineIndex, allLines) {
  const trimmed = line.trim();

  if (!trimmed) return 'blank';

  const isFirstContent = allLines.slice(0, lineIndex).every((l) => !l.trim());
  if (isFirstContent) return 'header';

  if (
    trimmed === trimmed.toUpperCase() &&
    trimmed.length > 3 &&
    trimmed.length < 40 &&
    !/\d{4}/.test(trimmed) &&
    !trimmed.includes('$')
  ) {
    return 'section-header';
  }

  if (trimmed.includes('....') || trimmed.includes('......')) return 'line-item';

  if (/TOTAL|AMOUNT DUE|BALANCE DUE/i.test(trimmed) && trimmed.includes('$')) return 'total';

  if (
    trimmed.includes(':') &&
    !trimmed.startsWith('-') &&
    trimmed.split(':')[0].length < 30
  ) {
    const colonIdx = line.indexOf(':');
    const key = line.substring(0, colonIdx).trim();
    const val = line.substring(colonIdx + 1).trim();
    if (key && val) return 'key-value';
  }

  if (trimmed.startsWith('-') || trimmed.startsWith('•')) return 'bullet';

  return 'default';
}

function classify(line, idx, lines) {
  return classifyLine(line, idx, lines);
}

// ── blank lines ───────────────────────────────────────────────────────────────

describe('blank lines', () => {
  test('empty string is blank', () => {
    expect(classify('', 1, ['HEADER', ''])).toBe('blank');
  });

  test('whitespace-only line is blank', () => {
    expect(classify('   ', 1, ['HEADER', '   '])).toBe('blank');
  });
});

// ── header (first non-empty line) ─────────────────────────────────────────────

describe('header line', () => {
  test('first non-empty line is header', () => {
    const lines = ['SYSCO FOOD SERVICES'];
    expect(classify('SYSCO FOOD SERVICES', 0, lines)).toBe('header');
  });

  test('first content after blank lines is header', () => {
    const lines = ['', '', 'SYSCO FOOD SERVICES'];
    expect(classify('SYSCO FOOD SERVICES', 2, lines)).toBe('header');
  });

  test('second non-empty line is not header', () => {
    const lines = ['SYSCO FOOD SERVICES', 'Invoice #: 1234'];
    expect(classify('Invoice #: 1234', 1, lines)).not.toBe('header');
  });
});

// ── section headers ───────────────────────────────────────────────────────────

describe('section header lines', () => {
  const doc = ['HEADER', 'BILL TO'];

  test('all-caps short line is section-header', () => {
    expect(classify('BILL TO', 1, doc)).toBe('section-header');
  });

  test('all-caps line with year is NOT section-header', () => {
    expect(classify('JUNE 2026', 1, doc)).not.toBe('section-header');
  });

  test('all-caps line with $ is NOT section-header', () => {
    expect(classify('TOTAL $500', 1, doc)).not.toBe('section-header');
  });

  test('line too short (≤3 chars) is NOT section-header', () => {
    expect(classify('CA', 1, doc)).not.toBe('section-header');
  });

  test('mixed-case line is NOT section-header', () => {
    expect(classify('Line Items', 1, doc)).not.toBe('section-header');
  });
});

// ── line items (dot leaders) ──────────────────────────────────────────────────

describe('line-item lines (dot leaders)', () => {
  const doc = ['HEADER', 'Food delivery.....$1,200.00'];

  test('line with .... is line-item', () => {
    expect(classify('Food delivery.....$1,200.00', 1, doc)).toBe('line-item');
  });

  test('line with ...... is line-item', () => {
    expect(classify('Cleaning fee......$450.00', 1, doc)).toBe('line-item');
  });
});

// ── total lines ───────────────────────────────────────────────────────────────

describe('total lines', () => {
  const doc = ['HEADER', 'TOTAL DUE: $6,300.00'];

  test('TOTAL with $ is total', () => {
    expect(classify('TOTAL DUE: $6,300.00', 1, doc)).toBe('total');
  });

  test('AMOUNT DUE with $ is total', () => {
    expect(classify('AMOUNT DUE: $1,000.00', 1, doc)).toBe('total');
  });

  test('BALANCE DUE with $ is total', () => {
    expect(classify('BALANCE DUE $500.00', 1, doc)).toBe('total');
  });

  test('TOTAL without $ is not total', () => {
    expect(classify('TOTAL ITEMS: 5', 1, doc)).not.toBe('total');
  });
});

// ── key-value pairs ───────────────────────────────────────────────────────────

describe('key-value lines', () => {
  const doc = ['HEADER', 'Invoice #: INV-2026-001'];

  test('Key: Value is key-value', () => {
    expect(classify('Invoice #: INV-2026-001', 1, doc)).toBe('key-value');
  });

  test('Date: 2026-06-24 is key-value', () => {
    expect(classify('Date: 2026-06-24', 1, doc)).toBe('key-value');
  });

  test('dash-prefixed line with colon is bullet not key-value', () => {
    expect(classify('- Note: see below', 1, doc)).toBe('bullet');
  });

  test('very long key (>30 chars) is not key-value', () => {
    const longKey = 'A'.repeat(31) + ': value';
    expect(classify(longKey, 1, doc)).not.toBe('key-value');
  });

  test('colon with no value is not key-value', () => {
    expect(classify('Label:', 1, doc)).not.toBe('key-value');
  });
});

// ── bullet / dash items ───────────────────────────────────────────────────────

describe('bullet lines', () => {
  const doc = ['HEADER', '- item one'];

  test('dash-prefixed is bullet', () => {
    expect(classify('- item one', 1, doc)).toBe('bullet');
  });

  test('bullet-point-prefixed is bullet', () => {
    expect(classify('• item two', 1, doc)).toBe('bullet');
  });
});

// ── default ───────────────────────────────────────────────────────────────────

describe('default lines', () => {
  const doc = ['HEADER', '247 Harbour Road'];

  test('plain address line is default', () => {
    expect(classify('247 Harbour Road', 1, doc)).toBe('default');
  });

  test('plain text with no special pattern is default', () => {
    expect(classify('Thank you for your business.', 1, doc)).toBe('default');
  });
});
