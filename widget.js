/* widget.js - Advanced Date Picker (Jotform widget)
   Thin integration layer between AdvancedDatePicker core and Jotform.

   Assumptions:
   - HTML includes:
       <div id="calendar"></div>
       <div id="calendar-warning"></div>
       <div id="selectedDatesDisplay"></div>
       <input type="hidden" id="selectedDates" name="selectedDates" />
   - advanced-date-picker.js loaded before this file (provides window.AdvancedDatePicker).
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

  // Core class + utilities (from advanced-date-picker.js)
  const ADP = window.AdvancedDatePicker;
  const utils = ADP && ADP.utils;

  // -------------------- DOM refs --------------------
  const els = {
    calendar: () => document.getElementById('calendar'),
    warn: () => document.getElementById('calendar-warning'),
    display: () => document.getElementById('selectedDatesDisplay'),
    value: () => document.getElementById('selectedDates'),
    progressFill: () => document.getElementById('adp-progress-fill'),
    progressLabel: () => document.getElementById('adp-progress-label'),
    btnSelectAll: () => document.getElementById('adp-select-all'),
    btnClearAll: () => document.getElementById('adp-clear-all'),
  };

  // -------------------- Jotform settings parsing --------------------
  // Jotform delivers settings in a quirky encoded format that needs
  // special handling before passing to the core ADP class.

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
    const allowedWeekdays = utils.parseAllowedWeekday(raw.allowedWeekday || '');
    const displayFormat = (raw.displayFormat || 'Y-m-d').trim();
    const excludedDates = utils.parseExcludedDates(raw.excludedDates || '');

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
    if (s.minSelectableDates && s.maxSelectableDates && s.maxSelectableDates !== 0 && s.minSelectableDates > s.maxSelectableDates) {
      errors.push('Minimum selectable dates cannot be greater than maximum selectable dates.');
    }

    const possible = utils.countPossibleDays(
      s.startDate, s.endDate, s.allowedWeekdays, new Set(s.excludedDates || [])
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

  // -------------------- Jotform storage (CSV) --------------------

  function isoArrayToStorageCSV(isoArr, displayFmt) {
    const fmt = utils.makeStorageFormat(displayFmt);
    return (isoArr || [])
      .map(s => window.flatpickr.formatDate(utils.parseISO(s), fmt))
      .join(', ');
  }

  function storageCSVToISOArray(str, displayFmt) {
    if (!str || typeof str !== 'string') return [];
    const fmt = utils.makeStorageFormat(displayFmt);
    const out = [];
    for (const token of str.split(/\s*,\s*/).filter(Boolean)) {
      const d = window.flatpickr.parseDate(token, fmt);
      if (d && !isNaN(d)) out.push(utils.toISO(d));
    }
    return Array.from(new Set(out)).sort();
  }

  // -------------------- ADP instance + UI updates --------------------
  let adp = null;

  function setWarning(msg) {
    const w = els.warn();
    if (w) w.textContent = msg || '';
  }

  function sendCurrentData() {
    if (!adp) return;
    try {
      const storageStr = isoArrayToStorageCSV(adp.getISO(), adp.state.fmt);
      JFCustomWidget?.sendData?.({ value: storageStr });
    } catch (e) {
      warn('sendData failed', e);
    }
  }

  function resizeFrame() {
    if (window.JFCustomWidget && JFCustomWidget.requestFrameResize) {
      JFCustomWidget.requestFrameResize({ height: document.body.scrollHeight });
    }
  }

  function updateValueAndDisplay() {
    if (!adp) return;
    const out = els.value();
    const disp = els.display();
    const sortedISO = adp.getISO();

    if (out) out.value = JSON.stringify(sortedISO);

    const settings = window.__ADP_LAST_SETTINGS__;
    const summary = adp.getHumanSummary(settings?.startDate, settings?.endDate);

    if (disp) {
      const count = sortedISO.length;
      disp.textContent = count
        ? `${count} date${count > 1 ? 's' : ''} selected: ${summary}`
        : 'No dates selected';
    }

    updateProgressBar();
    resizeFrame();
  }

  function updateProgressBar() {
    if (!adp) return;
    const fill = els.progressFill();
    const label = els.progressLabel();
    if (!fill || !label) return;

    const info = adp.getSelectionInfo();
    const bar = document.getElementById('adp-progress-bar');

    fill.style.width = info.pct + '%';
    if (bar) {
      bar.setAttribute('aria-valuenow', info.count);
      bar.setAttribute('aria-valuemax', info.limit);
    }
    fill.classList.remove('adp-progress--under', 'adp-progress--ok', 'adp-progress--full');
    if (!info.meetsMin) {
      fill.classList.add('adp-progress--under');
    } else if (info.atMax) {
      fill.classList.add('adp-progress--full');
    } else {
      fill.classList.add('adp-progress--ok');
    }

    let text = `${info.count} selected`;
    if (info.max) text += ` of ${info.max} max`;
    if (info.min) text += ` (${info.min} min)`;
    label.textContent = text;

    const btnAll = els.btnSelectAll();
    const btnClear = els.btnClearAll();
    if (btnAll) btnAll.disabled = info.atMax || info.count >= info.possible;
    if (btnClear) btnClear.disabled = info.count === 0;
  }

  function selectAllDates() {
    if (!adp) return;
    adp.selectAll();
    sendCurrentData();
  }

  function clearAllDates() {
    if (!adp) return;
    adp.clearAll();
    try { JFCustomWidget?.sendData?.({ value: '' }); } catch (e) { warn('sendData failed', e); }
  }

  // -------------------- widget init --------------------

  function runWidget(settings) {
    log('runWidget', settings);
    const calEl = els.calendar();
    if (!calEl) { error('Calendar element not found'); return; }
    if (!window.flatpickr) { error('flatpickr is not available'); setWarning('Calendar library failed to load.'); return; }
    if (!ADP) { error('AdvancedDatePicker not available'); setWarning('Core library failed to load.'); return; }

    if (adp) { adp.destroy(); adp = null; }

    adp = new ADP(calEl, {
      startDate: settings.startDate,
      endDate: settings.endDate,
      minSelectableDates: settings.minSelectableDates,
      maxSelectableDates: settings.maxSelectableDates,
      displayFormat: settings.displayFormat,
      allowedWeekday: settings.allowedWeekdays,
      excludedDates: settings.excludedDates,
      onWarning: setWarning,
      onChange: () => {
        updateValueAndDisplay();
        sendCurrentData();
      },
      onReady: () => {
        updateValueAndDisplay();
        resizeFrame();
      },
    });

    log('ADP instance created');

    // Wire up Select All / Clear All buttons (onclick replaces previous handler)
    const btnAll = els.btnSelectAll();
    const btnClear = els.btnClearAll();
    if (btnAll) btnAll.onclick = selectAllDates;
    if (btnClear) btnClear.onclick = clearAllDates;
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

    window.__ADP_LAST_SETTINGS__ = settings;

    runWidget(settings);

    // Rehydrate selection from prior saved value
    const prior = data?.value;
    if (prior && adp) {
      let restored = [];
      // Back-compat: try JSON array first
      try {
        const maybe = JSON.parse(prior);
        if (Array.isArray(maybe)) {
          restored = maybe.filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s)).sort();
        }
      } catch {
        // Otherwise parse CSV using designer's (derived) storage format
        restored = storageCSVToISOArray(prior, settings.displayFormat || 'Y-m-d');
      }
      if (restored.length) {
        adp.setDateISO(restored);
        updateValueAndDisplay();
      }
    }
  }

  function submitHandler() {
    if (!adp) {
      JFCustomWidget.sendSubmit({ valid: false, value: '' });
      return;
    }

    const sortedISO = adp.getISO();
    const info = adp.getSelectionInfo();

    if (!info.meetsMin) {
      setWarning(`Select at least ${info.min} date${info.min === 1 ? '' : 's'} before submitting.`);
      JFCustomWidget.sendSubmit({ valid: false, value: '' });
      return;
    }

    const storageStr = isoArrayToStorageCSV(sortedISO, adp.state.fmt);
    JFCustomWidget.sendSubmit({ valid: true, value: storageStr });
  }

  // Subscribe if API is present now; otherwise, retry on DOM ready.
  function wireJotform() {
    if (window.JFCustomWidget && JFCustomWidget.subscribe) {
      log('JFCustomWidget detected');
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

  // Expose for debugging
  window.__ADP_DEBUG__ = {
    normalizeSettings,
    validateSettings,
    runWidget,
    isoArrayToStorageCSV,
    storageCSVToISOArray,
    selectAllDates,
    clearAllDates,
    get adp() { return adp; },
  };
})();
