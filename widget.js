/* widget.js - Advanced Date Picker (Jotform widget)
   Assumptions:
   - HTML includes:
       <div id="calendar"></div>
       <div id="calendar-warning"></div>
       <div id="selectedDatesDisplay"></div>
       <input type="hidden" id="selectedDates" name="selectedDates" />
   - flatpickr is loaded before this file.
   - Jotform API (JotFormCustomWidget.min.js) is loaded before this file.
*/

(function () {
  'use strict';

  // -------------------- logging helpers --------------------
  const log = (...a) => console.log('[widget.js]', ...a);
  const warn = (...a) => console.warn('[widget.js]', ...a);
  const error = (...a) => console.error('[widget.js]', ...a);

  log('Script starting');

  // -------------------- DOM refs --------------------
  const els = {
    calendar: () => document.getElementById('calendar'),
    warn: () => document.getElementById('calendar-warning'),
    display: () => document.getElementById('selectedDatesDisplay'),
    value: () => document.getElementById('selectedDates'),
  };

  // -------------------- settings pipeline --------------------
  const DAY_MAP = new Map([
    ['sunday', 0], ['sun', 0], ['0', 0], ['7', 0],
    ['monday', 1], ['mon', 1], ['1', 1],
    ['tuesday', 2], ['tue', 2], ['tues', 2], ['2', 2],
    ['wednesday', 3], ['wed', 3], ['3', 3],
    ['thursday', 4], ['thu', 4], ['thur', 4], ['thurs', 4], ['4', 4],
    ['friday', 5], ['fri', 5], ['5', 5],
    ['saturday', 6], ['sat', 6], ['6', 6],
  ]);

  function parseAllowedWeekday(raw) {
  if (!raw) return { options: [], checked: [], numbers: [] };

  // Find the first comma; left side = options (newlines), right side = checked (commas)
  const firstComma = raw.indexOf(',');
  const optionsPart = firstComma === -1 ? raw : raw.slice(0, firstComma);
  const checkedPart = firstComma === -1 ? ''  : raw.slice(firstComma + 1);

  const options = optionsPart
    .split(/\r?\n+/)
    .map(s => s.trim())
    .filter(Boolean);

  const checked = checkedPart
    .split(/\s*,\s*/)
    .map(s => s.trim())
    .filter(Boolean);

  const effective = checked.length ? checked : options;

  const toKey = s => (s.includes('|') ? s.split('|').pop() : s).trim().toLowerCase();

  const numbers = Array.from(new Set(
    effective.map(toKey).map(k => DAY_MAP.get(k)).filter(Number.isInteger)
  )).sort((a, b) => a - b);

  return { options, checked: effective, numbers };
}

function rangeIsUnderOneYear(startISO, endISO) {
  if (!startISO || !endISO) return false;
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  return (end - start) < ONE_YEAR_MS;
}

// Strip year tokens from a flatpickr format string (Y or y) and tidy spaces/punctuation
function stripYearTokens(fmt) {
  if (!fmt) return 'M j';
  let f = fmt.replace(/[Yy]+/g, '').replace(/\s*,\s*,/g, ',');   // remove year tokens
  f = f.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').trim();     // clean doubles / spaces
  if (!/[MDjFlmnUd]/i.test(f)) f = 'M j';                         // fallback if empty-ish
  return f;
}

function monthShortName(d) {
  return window.flatpickr.formatDate(d, 'M'); // e.g., Aug
}

// Use either full format (with year) or a compact format (without year)
function formatDateISOForUserCompact(iso, fullFmt, noYear) {
  const d = parseISO(iso);
  return window.flatpickr.formatDate(d, noYear || fullFmt);
}


  function readSettingsFromEvent(data) {
    try {
      const arr = JSON.parse(decodeURIComponent(data.settings)); // [{name,value}]
      return Object.fromEntries(arr.map(({ name, value }) => [name, value]));
    } catch (e) {
      warn('Failed to parse data.settings', e);
      return {};
    }
  }

  function getRawSettings(data) {
    const api = (window.JFCustomWidget && JFCustomWidget.getWidgetSettings && JFCustomWidget.getWidgetSettings()) || {};
    if (api && Object.keys(api).length) return api;
    return readSettingsFromEvent(data);
  }

  function normalizeSettings(raw) {
    const startDate = (raw.startDate || '').trim();
    const endDate = (raw.endDate || '').trim();

    const minSelectableDates = Number.isFinite(+raw.minSelectableDates) ? +raw.minSelectableDates : 0;
    const maxSelectableDates = Number.isFinite(+raw.maxSelectableDates) ? +raw.maxSelectableDates : 0;

    const { numbers: allowedWeekdays } = parseAllowedWeekday(raw.allowedWeekday || '');
    const displayFormat = (raw.displayFormat || 'Y-m-d').trim();
    const excludedDates = parseExcludedDates(raw.excludedDates || '');

    return {
      startDate,           // "YYYY-MM-DD"
      endDate,             // "YYYY-MM-DD"
      minSelectableDates,  // integer >= 0 (0 = not enforced)
      maxSelectableDates,  // integer >= 0 (0 = not enforced)
      displayFormat,       // flatpickr-compatible format
      allowedWeekdays,     // [0..6]
      excludedDates,       // ["YYYY-MM-DD", ...]
    };
  }

  function parseExcludedDates(raw) {
    if (!raw) return [];
    return Array.from(new Set(
      raw.split(/\s*,\s*/).map(s => s.trim())
        .filter(Boolean)
        .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s)) // keep only ISO YYYY-MM-DD
    ));
  }

  function parseISO(iso) {
    // "YYYY-MM-DD" -> Date (local)
    const [y, m, d] = iso.split('-').map(Number);

    return new Date(y, m - 1, d);
  }

  function countPossibleDays(startISO, endISO, allowedWeekdays, excluded) {
    if (!startISO || !endISO || !allowedWeekdays || !allowedWeekdays.length) return null;

    const start = parseISO(startISO);
    const end   = parseISO(endISO);
    if (!(start <= end)) return 0;

    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (allowedWeekdays.includes(d.getDay()) && !(excluded && excluded.has(iso))) {
        count++;
      }
    }
    return count;
  }


  function validateSettings(s) {
    const errors = [];
    const ISO = /^\d{4}-\d{2}-\d{2}$/;
    if (s.startDate && !ISO.test(s.startDate)) errors.push('Start date must be YYYY-MM-DD.');
    if (s.endDate && !ISO.test(s.endDate)) errors.push('End date must be YYYY-MM-DD.');
    if (s.startDate && s.endDate && s.startDate > s.endDate) {
      errors.push('Start date must be on or before end date.');
    }
    if (!s.allowedWeekdays.length) errors.push('Select at least one weekday.');
    if (s.minSelectableDates < 0) errors.push('Minimum selectable dates cannot be negative.');
    if (s.maxSelectableDates < 0) errors.push('Maximum selectable dates cannot be negative.');
    if (s.minSelectableDates && s.maxSelectableDates &&s.maxSelectableDates !== 0 && && s.minSelectableDates > s.maxSelectableDates) {
      errors.push('Minimum selectable dates cannot be greater than maximum selectable dates.');
    }

    const possible = countPossibleDays(
      s.startDate,
      s.endDate,
      s.allowedWeekdays,
      new Set(s.excludedDates || [])
    );

    if (possible !== null) {
      if (s.minSelectableDates && s.minSelectableDates > possible) {
        errors.push(`Minimum selectable dates (${s.minSelectableDates}) exceeds available dates in range (${possible}).`);
      }
      if (s.maxSelectableDates && s.maxSelectableDates !== 0 && s.maxSelectableDates > possible) {
        errors.push(`Maximum selectable dates (${s.maxSelectableDates}) exceeds available dates in range (${possible}).`);
      }
    }

    return errors;
  }

  // -------------------- calendar runtime --------------------
  let fp = null;
  let state = {
    selected: [], // array of ISO strings "YYYY-MM-DD"
    fmt: 'Y-m-d',
    minCount: 0,
    maxCount: 0,
    allowedWeekdays: [0,1,2,3,4,5,6],
    excluded: new Set(),
  };

  function setWarning(msg) {
    const w = els.warn();
    if (w) w.textContent = msg || '';
  }

  function fmtDate(d, fmt) {
    // Use flatpickr to format for display without mutating picker
    try {
      return window.flatpickr.formatDate(d, fmt || state.fmt);
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }

  function toISO(d) {
    // Convert Date -> "YYYY-MM-DD" in local time
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function areConsecutive(prevISO, nextISO) {
    const prev = parseISO(prevISO);
    const next = parseISO(nextISO);
    // difference of exactly 1 day (handles month/year rollovers)
    const oneDay = 24 * 60 * 60 * 1000;
    return (next - prev) === oneDay;
  }

  function groupConsecutiveDates(datesISO) {
    if (!datesISO || !datesISO.length) return [];
    const sorted = [...new Set(datesISO)].sort(); // unique + sort (ISO sorts lexicographically by date)
    const groups = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      if (areConsecutive(prev, cur)) {
        // keep extending the current group
        prev = cur;
        continue;
      }
      // close current group
      groups.push({ start, end: prev });
      // start a new group
      start = cur;
      prev = cur;
    }
    // close the final group
    groups.push({ start, end: prev });
    return groups; // [{start:"YYYY-MM-DD", end:"YYYY-MM-DD"}, ...]
  }

  function formatDateISOForUser(iso, fmt) {
    // flatpickr is already loaded
    return window.flatpickr.formatDate(parseISO(iso), fmt);
  }

  function formatRange(range, fullFmt, noYearFmt, useNoYear) {
    if (range.start === range.end) {
      return formatDateISOForUserCompact(range.start, fullFmt, useNoYear ? noYearFmt : null);
    }

    if (useNoYear) {
      // Compact: "Aug 19–20" if same month; otherwise "Aug 19–Sep 2"
      const s = parseISO(range.start);
      const e = parseISO(range.end);
      const sameMonth = (s.getFullYear() === e.getFullYear()) && (s.getMonth() === e.getMonth());
      if (sameMonth) {
        // month once + day span
        return `${monthShortName(s)} ${String(s.getDate())}–${String(e.getDate())}`;
      }
      // different months
      return `${monthShortName(s)} ${s.getDate()}–${monthShortName(e)} ${e.getDate()}`;
    }

    // Fallback: respect user’s full display format on both ends
    return `${formatDateISOForUser(range.start, fullFmt)}–${formatDateISOForUser(range.end, fullFmt)}`;
  }

  function formatRangesList(ranges, fullFmt, noYearFmt, useNoYear) {
    if (!ranges.length) return 'No dates selected';
    const parts = ranges.map(r => formatRange(r, fullFmt, noYearFmt, useNoYear));
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
  }


  function updateValueAndDisplay() {
    const out = els.value();
    const disp = els.display();

    const sortedISO = [...state.selected].sort();
    if (out) out.value = JSON.stringify(sortedISO);

    const ranges = groupConsecutiveDates(sortedISO);

    // Decide formatting mode based on configured range
    const useNoYear = rangeIsUnderOneYear(
      // These come from settings and were copied into state in runWidget
      // If you didn’t copy them into state, pass settings.startDate/endDate instead
      (window.__ADP_LAST_SETTINGS__ && window.__ADP_LAST_SETTINGS__.startDate) || null,
      (window.__ADP_LAST_SETTINGS__ && window.__ADP_LAST_SETTINGS__.endDate) || null
    );
    const noYearFmt = stripYearTokens(state.fmt);

    const nice = formatRangesList(ranges, state.fmt, noYearFmt, useNoYear);

    if (disp) {
      const count = sortedISO.length;
      disp.textContent = count
        ? `${count} date${count > 1 ? 's' : ''} selected: ${nice}`
        : 'No dates selected';
    }

    if (window.JFCustomWidget && JFCustomWidget.requestFrameResize) {
      JFCustomWidget.requestFrameResize({ height: document.body.scrollHeight });
    }
  }


  function withinAllowedWeekday(date) {
    log('allowedWeekdays are:', state.allowedWeekdays);
    const dow = date.getDay(); // 0..6 (Sun..Sat)
    return state.allowedWeekdays.includes(dow);
    
    
  }

  function disableIfMaxReached(date) {
    if (!state.maxCount || state.selected.length < state.maxCount) return false;
    // Allow clicking already-selected dates to unselect
    const iso = toISO(date);
    if (state.selected.includes(iso)) return false;
    // Otherwise block adding more
    return true;
  }

  function dateIsInRange(date, minISO, maxISO) {
    const iso = toISO(date);
    if (minISO && iso < minISO) return false;
    if (maxISO && iso > maxISO) return false;
    return true;
  }

  function makeEnableFn(minISO, maxISO) {
    return function (date) {
      const iso = toISO(date);
      if (minISO && iso < minISO) return false;
      if (maxISO && iso > maxISO) return false;

      if (state.excluded.has(iso)) return false;
      if (!state.allowedWeekdays.includes(date.getDay())) return false;

      // If at max, allow toggling already-selected dates but block new ones
      if (state.maxCount && state.selected.length >= state.maxCount) {
        return state.selected.includes(iso);
      }
      return true;
    };
  }


  function onChangeHandler(selectedDates /*, dateStr, instance */) {
  const before = state.selected.slice(); // previous ISO list

  // Normalize to ISO list
  let iso = (Array.isArray(selectedDates) ? selectedDates : [])
    .filter(Boolean)
    .map(d => (d instanceof Date ? d : new Date(d)))
    .filter(d => !isNaN(d))
    .map(toISO);

  // Hard-block going over max: revert and warn
  if (state.maxCount && iso.length > state.maxCount) {
    setWarning(`You can select up to ${state.maxCount} date${state.maxCount === 1 ? '' : 's'}.`);
    fp?.setDate?.(before, false);
    state.selected = before;
    updateValueAndDisplay();
    fp?.redraw?.();            // ← re-evaluate enable() for each cell
    return;
  }

  state.selected = iso;

  // Min warning (don’t block here; block on submit if you want)
  if (state.minCount && state.selected.length < state.minCount) {
    setWarning(`Select at least ${state.minCount} date${state.minCount === 1 ? '' : 's'}.`);
  } else {
    setWarning('');
  }

  updateValueAndDisplay();
  fp?.redraw?.();              // ← re-evaluate enable() after each change
}


  function onDayCreateHandler(_dObj, _dStr, _fp, dayElem) {
    // When max is reached, add a disabled style for non-selected days
    if (state.maxCount && state.selected.length >= state.maxCount) {
      const date = dayElem.dateObj;
      const iso = toISO(date);
      if (!state.selected.includes(iso)) {
        dayElem.classList.add('flatpickr-disabled');
        dayElem.setAttribute('aria-disabled', 'true');
      }
    }
  }

function runWidget(settings) {
  log('runWidget', settings);
  const calEl = document.getElementById('calendar');
  if (!calEl) {
    error('Calendar element not found');
    return;
  }

  // COPY settings into state so filters have the right values
  state.fmt = settings.displayFormat || 'Y-m-d';
  state.minCount = settings.minSelectableDates || 0;
  state.maxCount = settings.maxSelectableDates || 0;
  state.allowedWeekdays = (settings.allowedWeekdays && settings.allowedWeekdays.length)
    ? settings.allowedWeekdays
    : [0,1,2,3,4,5,6];
  state.excluded = new Set(settings.excludledDates || []);

  const minISO = settings.startDate || null;
  const maxISO = settings.endDate || null;

  if (fp && fp.destroy) { try { fp.destroy(); } catch {} fp = null; }

  const opts = {
    mode: 'multiple',
    inline: true,
    clickOpens: false,
    allowInput: false,
    disableMobile: true,

    dateFormat: 'Y-m-d',
    altInput: false,
    altFormat: state.fmt,

    minDate: minISO,
    maxDate: maxISO,
    enable: [ makeEnableFn(minISO, maxISO) ], // uses state.allowedWeekdays + state.maxCount

    onChange: onChangeHandler,
    onDayCreate: onDayCreateHandler,
    onReady() {
      updateValueAndDisplay();
      JFCustomWidget?.requestFrameResize?.({ height: document.body.scrollHeight });
    },
    onMonthChange() {
      JFCustomWidget?.requestFrameResize?.({ height: document.body.scrollHeight });
    },
    onYearChange() {
      JFCustomWidget?.requestFrameResize?.({ height: document.body.scrollHeight });
    },
  };

  if (!window.flatpickr) {
    error('flatpickr is not available');
    setWarning('Calendar library failed to load.');
    return;
  }

  fp = window.flatpickr(calEl, opts);
  log('flatpickr created');
}


  // -------------------- Jotform lifecycle --------------------
  function readyHandler(data) {
    log('JF widget ready:', true);

    const raw = getRawSettings(data);
    log('Raw settings:', raw);

    const settings = normalizeSettings(raw);
    log('Normalized settings:', settings);
    log('allowedWeekdays parsed:', settings.allowedWeekdays);
    log('excludedDates parsed:', settings.excludedDates);

    const errors = validateSettings(settings);
    if (errors.length) {
      error('Configuration errors:', errors);
      setWarning(errors.join(' '));
      return;
    }

    window.__ADP_LAST_SETTINGS__ = settings;
    runWidget(settings);
  }

  function submitHandler() {
    const sortedISO = [...state.selected].sort();
    const ranges = groupConsecutiveDates(sortedISO);

    const useNoYear = rangeIsUnderOneYear(
      (window.__ADP_LAST_SETTINGS__ && window.__ADP_LAST_SETTINGS__.startDate) || null,
      (window.__ADP_LAST_SETTINGS__ && window.__ADP_LAST_SETTINGS__.endDate) || null
    );
    const noYearFmt = stripYearTokens(state.fmt);
    const nice = formatRangesList(ranges, state.fmt, noYearFmt, useNoYear);

    // Send formatted value to Jotform
    JFCustomWidget.sendSubmit({
      valid: true,
      value: nice
    });
  }

  // Subscribe if API is present now; otherwise, retry on DOM ready.
  function wireJotform() {
    if (window.JFCustomWidget && JFCustomWidget.subscribe) {
      log('JFCustomWidget detected, calling ready()');
      JFCustomWidget.subscribe('ready', readyHandler);
      JFCustomWidget.subscribe('submit', submitHandler);
    } else {
      warn('JFCustomWidget not available yet');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      log('DOMContentLoaded');
      wireJotform();
    });
  } else {
    wireJotform();
  }

  // Expose for debugging (optional)
  window.__ADP_DEBUG__ = {
    parseAllowedWeekday,
    normalizeSettings,
    validateSettings,
    runWidget,
  };
})();

