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

    // Builder shape: "<options (newlines)>,<checked (commas)>"
    const parts = raw.split(/,(.*)/s);
    const optionsPart = (parts[0] || '');
    const checkedPart = (parts[1] || '');

    const options = optionsPart
      .split(/\r?\n+/)
      .map(s => s.trim())
      .filter(Boolean);

    const checkedLabels = checkedPart
      .split(/\s*,\s*/)
      .map(s => s.trim())
      .filter(Boolean);

    const effective = checkedLabels.length ? checkedLabels : options;

    const toKey = (s) => {
      const piece = s.includes('|') ? s.split('|').pop() : s; // accept "Label|Value"
      return piece.trim().toLowerCase();
    };

    const nums = Array.from(new Set(
      effective.map(toKey).map(k => DAY_MAP.get(k)).filter(n => Number.isInteger(n))
    )).sort((a, b) => a - b);

    return { options, checked: effective, numbers: nums };
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

    return {
      startDate,           // "YYYY-MM-DD"
      endDate,             // "YYYY-MM-DD"
      minSelectableDates,  // integer >= 0 (0 = not enforced)
      maxSelectableDates,  // integer >= 0 (0 = not enforced)
      displayFormat,       // flatpickr-compatible format
      allowedWeekdays,     // [0..6]
    };
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
    if (s.minSelectableDates && s.maxSelectableDates && s.minSelectableDates > s.maxSelectableDates) {
      errors.push('Minimum selectable dates cannot be greater than maximum selectable dates.');
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

  function updateValueAndDisplay() {
    const out = els.value();
    const disp = els.display();
    const formatted = state.selected.map(s => {
      const parts = s.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return fmtDate(d, state.fmt);
    });

    if (out) out.value = JSON.stringify(state.selected);
    if (disp) disp.textContent = formatted.join(', ');
    if (window.JFCustomWidget && JFCustomWidget.requestFrameResize) {
      JFCustomWidget.requestFrameResize({ height: document.body.scrollHeight });
    }
  }

  function withinAllowedWeekday(date) {
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
      if (!dateIsInRange(date, minISO, maxISO)) return false;
      if (!withinAllowedWeekday(date)) return false;
      if (disableIfMaxReached(date)) return false;
      return true;
    };
  }

  function onChangeHandler(selectedDates, /*dateStr, instance*/) {
    // Build canonical ISO list
    state.selected = selectedDates.map(toISO);

    // Enforce max count: if user somehow exceeds (keyboard etc.), trim back to earliest picks
    if (state.maxCount && state.selected.length > state.maxCount) {
      state.selected = state.selected.slice(0, state.maxCount);
      // Re-apply to picker without firing infinite loop
      fp.setDate(state.selected, false);
    }

    // Enforce min count warning (do not block selection here)
    if (state.minCount && state.selected.length < state.minCount) {
      setWarning(`Select at least ${state.minCount} date${state.minCount === 1 ? '' : 's'}.`);
    } else {
      setWarning('');
    }

    updateValueAndDisplay();
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
    const calEl = els.calendar();
    if (!calEl) {
      error('Calendar element not found');
      return;
    }

    state.fmt = settings.displayFormat || 'Y-m-d';
    state.minCount = settings.minSelectableDates || 0;
    state.maxCount = settings.maxSelectableDates || 0;
    state.allowedWeekdays = settings.allowedWeekdays && settings.allowedWeekdays.length
      ? settings.allowedWeekdays
      : [0,1,2,3,4,5,6];

    const minISO = settings.startDate || '';
    const maxISO = settings.endDate || '';

    // Destroy any previous picker
    if (fp && fp.destroy) {
      try { fp.destroy(); } catch {}
      fp = null;
    }

    const opts = {
      mode: 'multiple',
      dateFormat: 'Y-m-d',           // internal format we keep in hidden field
      altInput: false,
      allowInput: false,
      clickOpens: true,
      defaultDate: [],
      disable: [],                   // we use enable function instead
      altFormat: state.fmt,          // not used unless altInput true
      // Limit range if provided
      minDate: minISO || null,
      maxDate: maxISO || null,
      // Enable only dates that pass our checks (range + weekday + max logic)
      enable: [ makeEnableFn(minISO, maxISO) ],
      onChange: onChangeHandler,
      onDayCreate: onDayCreateHandler,
      onReady: function () {
        // Initial UI
        updateValueAndDisplay();
        if (window.JFCustomWidget && JFCustomWidget.requestFrameResize) {
          JFCustomWidget.requestFrameResize({ height: document.body.scrollHeight });
        }
      }
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

    const errors = validateSettings(settings);
    if (errors.length) {
      error('Configuration errors:', errors);
      setWarning(errors.join(' '));
      return;
    }

    runWidget(settings);
  }

  function submitHandler() {
    log('submit');
    const hidden = els.value();
    const value = hidden ? hidden.value : '[]';
    if (window.JFCustomWidget && JFCustomWidget.sendSubmit) {
      JFCustomWidget.sendSubmit({ valid: true, value });
    }
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
