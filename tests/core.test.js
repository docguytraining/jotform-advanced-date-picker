/**
 * Tests for advanced-date-picker.js utility functions.
 * Uses Node.js built-in test runner (node --test).
 *
 * Run: node --test tests/core.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ---------- Helpers ----------

// deepEqual across VM contexts (avoids Array constructor mismatch)
function eq(actual, expected, msg) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), msg);
}

// Minimal flatpickr stub so the module can load.
// Must be a callable function (returns a mock picker instance) AND
// have .formatDate / .parseDate as static methods.
function flatpickrStub(el, opts) {
  // Return a mock flatpickr instance
  return {
    destroy() {},
    setDate() {},
    clear() {},
    redraw() {},
  };
}
flatpickrStub.formatDate = function (d, fmt) {
  const pad = (n) => String(n).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthsFull = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return fmt.replace(/Y/g, d.getFullYear())
    .replace(/m/g, pad(d.getMonth() + 1))
    .replace(/d/g, pad(d.getDate()))
    .replace(/j/g, d.getDate())
    .replace(/F/g, monthsFull[d.getMonth()])
    .replace(/M/g, months[d.getMonth()]);
};
flatpickrStub.parseDate = function (str, fmt) {
  if (fmt === 'Y-m-d') {
    const [y, m, d] = str.split('-').map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
  }
  return null;
};

// Load the module into a fake window
const fakeWindow = { flatpickr: flatpickrStub };
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync(require('path').resolve(__dirname, '..', 'advanced-date-picker.js'), 'utf8');
vm.runInNewContext(src, { window: fakeWindow, console });
const ADP = fakeWindow.AdvancedDatePicker;
const utils = ADP.utils;

// ---------- parseISO / toISO ----------

describe('parseISO', () => {
  it('parses YYYY-MM-DD to local Date', () => {
    const d = utils.parseISO('2025-08-19');
    assert.equal(d.getFullYear(), 2025);
    assert.equal(d.getMonth(), 7);
    assert.equal(d.getDate(), 19);
  });

  it('handles single-digit months', () => {
    const d = utils.parseISO('2025-01-05');
    assert.equal(d.getMonth(), 0);
    assert.equal(d.getDate(), 5);
  });
});

describe('toISO', () => {
  it('formats Date as YYYY-MM-DD', () => {
    assert.equal(utils.toISO(new Date(2025, 7, 19)), '2025-08-19');
  });

  it('zero-pads month and day', () => {
    assert.equal(utils.toISO(new Date(2025, 0, 5)), '2025-01-05');
  });
});

// ---------- parseExcludedDates ----------

describe('parseExcludedDates', () => {
  it('parses comma-separated ISO dates', () => {
    eq(utils.parseExcludedDates('2025-08-19, 2025-08-20'), ['2025-08-19', '2025-08-20']);
  });

  it('filters out non-ISO strings', () => {
    // Note: regex only checks format (DDDD-DD-DD), not calendar validity
    eq(utils.parseExcludedDates('2025-08-19, banana'), ['2025-08-19']);
  });

  it('deduplicates', () => {
    eq(utils.parseExcludedDates('2025-08-19, 2025-08-19'), ['2025-08-19']);
  });

  it('returns empty for falsy input', () => {
    eq(utils.parseExcludedDates(''), []);
    eq(utils.parseExcludedDates(null), []);
  });
});

// ---------- parseAllowedWeekday ----------

describe('parseAllowedWeekday', () => {
  it('parses array of day names', () => {
    eq(utils.parseAllowedWeekday(['Monday', 'Wednesday', 'Friday']), [1, 3, 5]);
  });

  it('parses array of numeric strings', () => {
    eq(utils.parseAllowedWeekday(['0', '2', '4']), [0, 2, 4]);
  });

  it('handles mixed case', () => {
    eq(utils.parseAllowedWeekday(['SUNDAY', 'monday']), [0, 1]);
  });

  it('deduplicates', () => {
    eq(utils.parseAllowedWeekday(['Monday', 'Mon', '1']), [1]);
  });

  it('returns empty for falsy input', () => {
    eq(utils.parseAllowedWeekday(''), []);
    eq(utils.parseAllowedWeekday(null), []);
  });

  it('parses Jotform builder-style string', () => {
    const raw = 'Sunday\nMonday\nTuesday\nWednesday\nThursday\nFriday\nSaturday,Monday,Wednesday';
    eq(utils.parseAllowedWeekday(raw), [1, 3]);
  });
});

// ---------- countPossibleDays ----------

describe('countPossibleDays', () => {
  it('counts days in range respecting weekday filter', () => {
    // Aug 18 (Mon) to Aug 22 (Fri) 2025 = 5 weekdays
    assert.equal(utils.countPossibleDays('2025-08-18', '2025-08-22', [1,2,3,4,5], null), 5);
  });

  it('excludes specific dates', () => {
    const excluded = new Set(['2025-08-20']);
    assert.equal(utils.countPossibleDays('2025-08-18', '2025-08-22', [1,2,3,4,5], excluded), 4);
  });

  it('returns null for missing range', () => {
    assert.equal(utils.countPossibleDays('', '', [0,1,2,3,4,5,6], null), null);
  });

  it('returns 0 for inverted range', () => {
    assert.equal(utils.countPossibleDays('2025-09-01', '2025-08-01', [0,1,2,3,4,5,6], null), 0);
  });

  it('counts single day', () => {
    assert.equal(utils.countPossibleDays('2025-08-18', '2025-08-18', [1], null), 1);
    assert.equal(utils.countPossibleDays('2025-08-18', '2025-08-18', [0], null), 0);
  });
});

// ---------- makeStorageFormat ----------

describe('makeStorageFormat', () => {
  it('passes through Y-m-d unchanged', () => {
    assert.equal(utils.makeStorageFormat('Y-m-d'), 'Y-m-d');
  });

  it('replaces month name tokens with numeric', () => {
    assert.equal(utils.makeStorageFormat('M d'), 'm d Y');
  });

  it('removes weekday tokens but keeps day-of-month', () => {
    const result = utils.makeStorageFormat('D, M j Y');
    assert.ok(!result.includes('D'), 'should not contain D');
    assert.ok(result.includes('j'), 'should keep j (day of month)');
    assert.ok(result.includes('Y'), 'should keep Y');
  });

  it('adds year if missing', () => {
    assert.ok(/Y/.test(utils.makeStorageFormat('m-d')));
  });

  it('normalizes lowercase y to uppercase Y', () => {
    const result = utils.makeStorageFormat('y-m-d');
    assert.ok(result.includes('Y'));
    assert.ok(!result.includes('y'));
  });

  it('falls back for empty input', () => {
    assert.equal(utils.makeStorageFormat(''), 'Y-m-d');
    assert.equal(utils.makeStorageFormat(null), 'Y-m-d');
  });
});

// ---------- groupConsecutiveDates ----------

describe('groupConsecutiveDates', () => {
  it('groups consecutive dates into ranges', () => {
    const groups = utils.groupConsecutiveDates(['2025-08-18', '2025-08-19', '2025-08-20', '2025-08-25']);
    eq(groups, [
      { start: '2025-08-18', end: '2025-08-20' },
      { start: '2025-08-25', end: '2025-08-25' },
    ]);
  });

  it('handles single date', () => {
    eq(utils.groupConsecutiveDates(['2025-08-18']), [{ start: '2025-08-18', end: '2025-08-18' }]);
  });

  it('handles empty input', () => {
    eq(utils.groupConsecutiveDates([]), []);
    eq(utils.groupConsecutiveDates(null), []);
  });

  it('sorts unsorted input', () => {
    const groups = utils.groupConsecutiveDates(['2025-08-20', '2025-08-18', '2025-08-19']);
    eq(groups, [{ start: '2025-08-18', end: '2025-08-20' }]);
  });

  it('deduplicates', () => {
    const groups = utils.groupConsecutiveDates(['2025-08-18', '2025-08-18', '2025-08-19']);
    eq(groups, [{ start: '2025-08-18', end: '2025-08-19' }]);
  });
});

// ---------- rangeIsUnderOneYear ----------

describe('rangeIsUnderOneYear', () => {
  it('returns true for short ranges', () => {
    assert.equal(utils.rangeIsUnderOneYear('2025-08-01', '2025-09-30'), true);
  });

  it('returns false for ranges >= 1 year', () => {
    assert.equal(utils.rangeIsUnderOneYear('2025-01-01', '2026-01-01'), false);
  });

  it('returns false for missing dates', () => {
    assert.equal(utils.rangeIsUnderOneYear('', '2025-09-30'), false);
    assert.equal(utils.rangeIsUnderOneYear('2025-08-01', ''), false);
  });
});

// ---------- stripYearTokens ----------

describe('stripYearTokens', () => {
  it('removes Y from format', () => {
    assert.equal(utils.stripYearTokens('M j, Y'), 'M j,');
  });

  it('removes lowercase y too', () => {
    assert.ok(!utils.stripYearTokens('m/d/y').includes('y'));
  });

  it('falls back to M j for empty result', () => {
    assert.equal(utils.stripYearTokens('Y'), 'M j');
  });

  it('falls back for null', () => {
    assert.equal(utils.stripYearTokens(null), 'M j');
  });
});

// ---------- AdvancedDatePicker class ----------

describe('AdvancedDatePicker class', () => {
  function createPicker(opts = {}) {
    const el = {};
    return new ADP(el, {
      startDate: '2025-08-15',
      endDate: '2025-09-30',
      minSelectableDates: 0,
      maxSelectableDates: 10,
      allowedWeekday: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
      excludedDates: '2025-08-20',
      displayFormat: 'Y-m-d',
      onWarning: () => {},
      onChange: () => {},
      onReady: () => {},
      ...opts,
    });
  }

  it('creates an instance with normalized settings', () => {
    const picker = createPicker();
    assert.equal(picker.settings.startDate, '2025-08-15');
    assert.equal(picker.settings.endDate, '2025-09-30');
    eq(picker.state.allowedWeekdays, [1, 2, 3, 4, 5]);
    assert.ok(picker.state.excluded.has('2025-08-20'));
  });

  it('getISO returns sorted selected dates', () => {
    const picker = createPicker();
    picker.state.selected = ['2025-08-22', '2025-08-18'];
    eq(picker.getISO(), ['2025-08-18', '2025-08-22']);
  });

  it('getSelectionInfo returns correct counts', () => {
    const picker = createPicker();
    picker.state.selected = ['2025-08-18', '2025-08-19', '2025-08-21'];
    const info = picker.getSelectionInfo();
    assert.equal(info.count, 3);
    assert.equal(info.max, 10);
    assert.equal(info.meetsMin, true);
    assert.equal(info.atMax, false);
    assert.ok(info.pct > 0);
  });

  it('getSelectionInfo.atMax is true when at max', () => {
    const picker = createPicker({ maxSelectableDates: 2 });
    picker.state.selected = ['2025-08-18', '2025-08-19'];
    assert.equal(picker.getSelectionInfo().atMax, true);
  });

  it('getSelectionInfo.meetsMin is false when below min', () => {
    const picker = createPicker({ minSelectableDates: 5 });
    picker.state.selected = ['2025-08-18', '2025-08-19'];
    assert.equal(picker.getSelectionInfo().meetsMin, false);
  });

  it('getAllEnabledISO returns enabled dates excluding excluded', () => {
    const picker = createPicker();
    const all = picker.getAllEnabledISO();
    assert.ok(all.length > 0);
    assert.ok(!all.includes('2025-08-20'), 'excluded date should not be in list');
    assert.ok(!all.includes('2025-08-16'), 'Saturday should not be in list');
    assert.ok(all.includes('2025-08-18'), 'Monday should be in list');
  });

  it('selectAll selects all enabled up to max', () => {
    const picker = createPicker({ maxSelectableDates: 5 });
    picker.selectAll();
    assert.equal(picker.state.selected.length, 5);
  });

  it('clearAll empties selection', () => {
    const picker = createPicker();
    picker.state.selected = ['2025-08-18', '2025-08-19'];
    picker.clearAll();
    eq(picker.getISO(), []);
  });

  it('setDateISO filters invalid dates', () => {
    const picker = createPicker();
    picker.setDateISO(['2025-08-18', 'not-a-date', '2025-08-19']);
    eq(picker.getISO(), ['2025-08-18', '2025-08-19']);
  });

  it('setDateISO deduplicates', () => {
    const picker = createPicker();
    picker.setDateISO(['2025-08-18', '2025-08-18']);
    eq(picker.getISO(), ['2025-08-18']);
  });

  it('getFormattedCSV returns comma-separated storage dates', () => {
    const picker = createPicker();
    picker.state.selected = ['2025-08-18', '2025-08-19'];
    const csv = picker.getFormattedCSV();
    assert.ok(csv.includes('2025-08-18'));
    assert.ok(csv.includes('2025-08-19'));
    assert.ok(csv.includes(', '));
  });

  it('validateSettings detects inverted range', () => {
    const picker = createPicker({ startDate: '2025-09-30', endDate: '2025-08-15' });
    const errors = picker.validateSettings();
    assert.ok(errors.some(e => e.includes('on or before')));
  });

  it('validateSettings detects min > max', () => {
    const picker = createPicker({ minSelectableDates: 15, maxSelectableDates: 5 });
    const errors = picker.validateSettings();
    assert.ok(errors.some(e => e.includes('greater than maximum')));
  });
});
