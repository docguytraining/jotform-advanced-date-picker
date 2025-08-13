/* advanced-date-picker.js
   Core, framework-agnostic date picker with:
   - Start/end limits
   - Allowed weekdays
   - Excluded dates
   - Min/max selection
   - Always-visible calendar (inline)
   - Formatted display + CSV storage (based on displayFormat)
   Requires: flatpickr (global)
*/

(function (global) {
  'use strict';

  // -------------------- utils --------------------
  const log = (...a) => console.log('[adp]', ...a);

  const DAY_MAP = new Map([
    ['sunday', 0], ['sun', 0], ['0', 0], ['7', 0],
    ['monday', 1], ['mon', 1], ['1', 1],
    ['tuesday', 2], ['tue', 2], ['tues', 2], ['2', 2],
    ['wednesday', 3], ['wed', 3], ['3', 3],
    ['thursday', 4], ['thu', 4], ['thur', 4], ['thurs', 4], ['4', 4],
    ['friday', 5], ['fri', 5], ['5', 5],
    ['saturday', 6], ['sat', 6], ['6', 6],
  ]);

  function toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function parseISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function parseExcludedDates(raw) {
    if (!raw) return [];
    return Array.from(new Set(
      raw.split(/\s*,\s*/).map(s => s.trim())
        .filter(Boolean)
        .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s))
    ));
  }

  function parseAllowedWeekday(raw) {
    // Accept:
    //  - array of names/numbers, OR
    //  - raw string from a builder (newline options, comma-checked)
    if (!raw) return [];

    if (Array.isArray(raw)) {
      return raw
        .map(v => String(v).trim().toLowerCase())
        .map(v => DAY_MAP.get(v))
        .filter(Number.isInteger)
        .filter((v,i,a) => a.indexOf(v) === i)  // unique
        .sort((a,b)=>a-b);
    }

    // String: maybe "Sunday\nMonday\n... , Monday,Wednesday"
    const firstComma = raw.indexOf(',');
    const optionsPart = firstComma === -1 ? raw : raw.slice(0, firstComma);
    const checkedPart = firstComma === -1 ? ''  : raw.slice(firstComma + 1);

    const options = optionsPart.split(/\r?\n+/).map(s=>s.trim()).filter(Boolean);
    const checked = checkedPart.split(/\s*,\s*/).map(s=>s.trim()).filter(Boolean);
    const effective = checked.length ? checked : options;

    const toKey = s => (s.includes('|') ? s.split('|').pop() : s).trim().toLowerCase();
    return Array.from(new Set(
      effective.map(toKey).map(k => DAY_MAP.get(k)).filter(Number.isInteger)
    )).sort((a,b)=>a-b);
  }

  function rangeIsUnderOneYear(startISO, endISO) {
    if (!startISO || !endISO) return false;
    const start = parseISO(startISO);
    const end = parseISO(endISO);
    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
    return (end - start) < ONE_YEAR_MS;
  }

  // Strip year tokens from a flatpickr format string and tidy spaces/punctuation
  function stripYearTokens(fmt) {
    if (!fmt) return 'M j';
    let f = fmt.replace(/[Yy]+/g, '').replace(/\s*,\s*,/g, ',');
    f = f.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').trim();
    if (!/[MDjFlmnUd]/i.test(f)) f = 'M j';
    return f;
  }

  function monthShortName(d) {
    return global.flatpickr.formatDate(d, 'M');
  }

  function areConsecutive(prevISO, nextISO) {
    const prev = parseISO(prevISO);
    const next = parseISO(nextISO);
    return (next - prev) === 24 * 60 * 60 * 1000;
  }

  function groupConsecutiveDates(datesISO) {
    if (!datesISO || !datesISO.length) return [];
    const sorted = [...new Set(datesISO)].sort();
    const groups = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      if (areConsecutive(prev, cur)) { prev = cur; continue; }
      groups.push({ start, end: prev });
      start = cur;
      prev = cur;
    }
    groups.push({ start, end: prev });
    return groups;
  }

  function formatDateISOForUser(iso, fmt) {
    return global.flatpickr.formatDate(parseISO(iso), fmt);
  }

  function formatDateISOForUserCompact(iso, fullFmt, noYearFmtOrNull) {
    const d = parseISO(iso);
    return global.flatpickr.formatDate(d, noYearFmtOrNull || fullFmt);
  }

  function formatRange(range, fullFmt, noYearFmt, useNoYear) {
    if (range.start === range.end) {
      return formatDateISOForUserCompact(range.start, fullFmt, useNoYear ? noYearFmt : null);
    }
    if (useNoYear) {
      const s = parseISO(range.start);
      const e = parseISO(range.end);
      const sameMonth = (s.getFullYear() === e.getFullYear()) && (s.getMonth() === e.getMonth());
      if (sameMonth) return `${monthShortName(s)} ${s.getDate()}\u2013${e.getDate()}`;
      return `${monthShortName(s)} ${s.getDate()}\u2013${monthShortName(e)} ${e.getDate()}`;
    }
    return `${formatDateISOForUser(range.start, fullFmt)}\u2013${formatDateISOForUser(range.end, fullFmt)}`;
  }

  function formatRangesList(ranges, fullFmt, noYearFmt, useNoYear) {
    if (!ranges.length) return 'No dates selected';
    const parts = ranges.map(r => formatRange(r, fullFmt, noYearFmt, useNoYear));
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
  }

  function countPossibleDays(startISO, endISO, allowedWeekdays, excludedSet) {
    if (!startISO || !endISO || !allowedWeekdays || !allowedWeekdays.length) return null;
    const start = parseISO(startISO);
    const end   = parseISO(endISO);
    if (!(start <= end)) return 0;

    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = toISO(d);
      if (allowedWeekdays.includes(d.getDay()) && !(excludedSet && excludedSet.has(iso))) {
        count++;
      }
    }
    return count;
  }

  // Build a storage-safe format (CSV) from a display format:
  // - force numeric month/day/year so we can round-trip reliably
  function makeStorageFormat(displayFmt) {
    // Simple heuristic: if display fmt contains month names or weekday tokens, fall back to ISO 'Y-m-d'
    // Otherwise, ensure 'Y-m-d' ordering. You can expand this if you need smarter mapping.
    const hasMonthNames = /F|M/i.test(displayFmt);
    const hasWeekday = /D|l/i.test(displayFmt);
    if (hasMonthNames || hasWeekday) return 'Y-m-d';
    // If already numeric components exist, still prefer ISO to keep CSV parse-safe.
    return 'Y-m-d';
  }

  // -------------------- core class --------------------
  class AdvancedDatePicker {
    /**
     * @param {HTMLElement} el - container that holds the calendar
     * @param {Object} opts
     * @param {String} opts.startDate - "YYYY-MM-DD"
     * @param {String} opts.endDate   - "YYYY-MM-DD"
     * @param {Number} opts.minSelectableDates - >= 0 (0 means not enforced)
     * @param {Number} opts.maxSelectableDates - >= 0 (0 means not enforced)
     * @param {Array|String} opts.allowedWeekday - names/numbers or raw string (builder style)
     * @param {Array|String} opts.excludedDates - ISO strings or comma-separated ISO
     * @param {String} opts.displayFormat - flatpickr display format
     * @param {Function} opts.onWarning - (msg)=>void
     * @param {Function} opts.onChange  - (isoArray)=>void
     * @param {Function} opts.onReady   - ()=>void
     */
    constructor(el, opts = {}) {
      if (!global.flatpickr) throw new Error('flatpickr not available');
      if (!el) throw new Error('AdvancedDatePicker: container element not found');

      this.el = el;
      this.fp = null;

      const {
        startDate = '',
        endDate = '',
        minSelectableDates = 0,
        maxSelectableDates = 0,
        allowedWeekday = ['0','1','2','3','4','5','6'],
        excludedDates = [],
        displayFormat = 'Y-m-d',
        onWarning = () => {},
        onChange = () => {},
        onReady = () => {},
      } = opts;

      // normalized internals
      this.settings = {
        startDate: String(startDate || '').trim(),
        endDate: String(endDate || '').trim(),
        minSelectableDates: Number.isFinite(+minSelectableDates) ? +minSelectableDates : 0,
        maxSelectableDates: Number.isFinite(+maxSelectableDates) ? +maxSelectableDates : 0,
        allowedWeekdays: parseAllowedWeekday(allowedWeekday || ''),
        excludedDates: Array.isArray(excludedDates)
          ? excludedDates
          : parseExcludedDates(String(excludedDates || '')),
        displayFormat: String(displayFormat || 'Y-m-d').trim(),
      };

      this.callbacks = { onWarning, onChange, onReady };
      this.state = {
        selected: [], // ISO strings
        fmt: this.settings.displayFormat,
        minCount: this.settings.minSelectableDates,
        maxCount: this.settings.maxSelectableDates,
        allowedWeekdays: this.settings.allowedWeekdays.length ? this.settings.allowedWeekdays : [0,1,2,3,4,5,6],
        excluded: new Set(this.settings.excludedDates || []),
      };

      const errors = this.validateSettings();
      if (errors.length) {
        this.callbacks.onWarning(errors.join(' '));
        // You can throw here in non-Jotform contexts if you want hard-fail:
        // throw new Error(errors.join(' | '));
      }

      this.initFlatpickr();
    }

    validateSettings() {
      const s = this.settings;
      const errors = [];
      const ISO = /^\d{4}-\d{2}-\d{2}$/;

      if (s.startDate && !ISO.test(s.startDate)) errors.push('Start date must be YYYY-MM-DD.');
      if (s.endDate && !ISO.test(s.endDate)) errors.push('End date must be YYYY-MM-DD.');
      if (s.startDate && s.endDate && s.startDate > s.endDate) {
        errors.push('Start date must be on or before end date.');
      }
      if (!this.state.allowedWeekdays.length) errors.push('Select at least one weekday.');
      if (this.state.minCount < 0) errors.push('Minimum selectable dates cannot be negative.');
      if (this.state.maxCount < 0) errors.push('Maximum selectable dates cannot be negative.');
      if (this.state.minCount && this.state.maxCount && this.state.maxCount !== 0 && this.state.minCount > this.state.maxCount) {
        errors.push('Minimum selectable dates cannot be greater than maximum selectable dates.');
      }

      const possible = countPossibleDays(
        s.startDate,
        s.endDate,
        this.state.allowedWeekdays,
        this.state.excluded
      );

      if (possible !== null) {
        if (this.state.minCount && this.state.minCount > possible) {
          errors.push(`Minimum selectable dates (${this.state.minCount}) exceeds available dates in range (${possible}).`);
        }
        if (this.state.maxCount && this.state.maxCount !== 0 && this.state.maxCount > possible) {
          errors.push(`Maximum selectable dates (${this.state.maxCount}) exceeds available dates in range (${possible}).`);
        }
      }

      return errors;
    }

    makeEnableFn(minISO, maxISO) {
      const self = this;
      return function (date) {
        const iso = toISO(date);
        if (minISO && iso < minISO) return false;
        if (maxISO && iso > maxISO) return false;
        if (self.state.excluded.has(iso)) return false;
        if (!self.state.allowedWeekdays.includes(date.getDay())) return false;

        if (self.state.maxCount && self.state.selected.length >= self.state.maxCount) {
          // allow deselecting existing, block adding new
          return self.state.selected.includes(iso);
        }
        return true;
      };
    }

    initFlatpickr() {
      if (this.fp && this.fp.destroy) { try { this.fp.destroy(); } catch(e) {} this.fp = null; }

      const minISO = this.settings.startDate || null;
      const maxISO = this.settings.endDate || null;

      const opts = {
        mode: 'multiple',
        inline: true,
        clickOpens: false,
        allowInput: false,
        disableMobile: true,
        dateFormat: 'Y-m-d',   // internal canonical
        altInput: false,
        altFormat: this.state.fmt,
        minDate: minISO,
        maxDate: maxISO,
        enable: [ this.makeEnableFn(minISO, maxISO) ],
        onChange: (selectedDates) => this.onChange(selectedDates),
        onDayCreate: (_dObj, _dStr, fp, dayElem) => {
          if (this.state.maxCount && this.state.selected.length >= this.state.maxCount) {
            const iso = toISO(dayElem.dateObj);
            if (!this.state.selected.includes(iso)) {
              dayElem.classList.add('flatpickr-disabled');
              dayElem.setAttribute('aria-disabled', 'true');
            }
          }
        },
        onReady: () => {
          this.updateDisplay();
          this.callbacks.onReady();
        },
        onMonthChange: () => this.callbacks.onReady(),
        onYearChange: () => this.callbacks.onReady(),
      };

      this.fp = global.flatpickr(this.el, opts);
      log('flatpickr created (core)');
    }

    onChange(selectedDates) {
      const before = this.state.selected.slice();
      let iso = (Array.isArray(selectedDates) ? selectedDates : [])
        .filter(Boolean)
        .map(d => (d instanceof Date ? d : new Date(d)))
        .filter(d => !isNaN(d))
        .map(toISO);

      // Hard block > max
      if (this.state.maxCount && iso.length > this.state.maxCount) {
        this.callbacks.onWarning(`You can select up to ${this.state.maxCount} date${this.state.maxCount === 1 ? '' : 's'}.`);
        this.fp?.setDate?.(before, false);
        this.state.selected = before;
        this.updateDisplay();
        this.fp?.redraw?.();
        return;
      }

      this.state.selected = iso;

      if (this.state.minCount && this.state.selected.length < this.state.minCount) {
        this.callbacks.onWarning(`Select at least ${this.state.minCount} date${this.state.minCount === 1 ? '' : 's'}.`);
      } else {
        this.callbacks.onWarning('');
      }

      this.updateDisplay();
      this.fp?.redraw?.();
      this.callbacks.onChange(this.getISO());
    }

    // --- external API ---
    getISO() {
      return [...this.state.selected].sort();
    }

    getFormattedCSV() {
      const storageFmt = makeStorageFormat(this.state.fmt);  // currently 'Y-m-d'
      const out = this.getISO().map(iso => formatDateISOForUser(iso, storageFmt));
      return out.join(', ');
    }

    getHumanSummary(startISO, endISO) {
      const ranges = groupConsecutiveDates(this.getISO());
      const useNoYear = rangeIsUnderOneYear(startISO, endISO);
      const noYearFmt = stripYearTokens(this.state.fmt);
      return formatRangesList(ranges, this.state.fmt, noYearFmt, useNoYear);
    }

    setDateISO(isoArray) {
      const clean = (Array.isArray(isoArray) ? isoArray : [])
        .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(String(s)));
      this.state.selected = [...new Set(clean)].sort();
      this.fp?.setDate?.(this.state.selected, false);
      this.updateDisplay();
    }

    setOptions(partialOpts = {}) {
      // Update settings/state and re-init picker
      if ('startDate' in partialOpts)  this.settings.startDate = String(partialOpts.startDate || '').trim();
      if ('endDate' in partialOpts)    this.settings.endDate   = String(partialOpts.endDate || '').trim();

      if ('minSelectableDates' in partialOpts) this.state.minCount = Number(partialOpts.minSelectableDates) || 0;
      if ('maxSelectableDates' in partialOpts) this.state.maxCount = Number(partialOpts.maxSelectableDates) || 0;

      if ('displayFormat' in partialOpts) {
        this.state.fmt = String(partialOpts.displayFormat || 'Y-m-d').trim();
      }

      if ('allowedWeekday' in partialOpts) {
        const arr = parseAllowedWeekday(partialOpts.allowedWeekday || '');
        this.state.allowedWeekdays = arr.length ? arr : [0,1,2,3,4,5,6];
      }

      if ('excludedDates' in partialOpts) {
        const list = Array.isArray(partialOpts.excludedDates)
          ? partialOpts.excludedDates
          : parseExcludedDates(String(partialOpts.excludedDates || ''));
        this.state.excluded = new Set(list);
      }

      const errs = this.validateSettings();
      if (errs.length) this.callbacks.onWarning(errs.join(' '));

      this.initFlatpickr();
    }

    updateDisplay() {
      // no-op here; consumers can render summaries as they like
      // We keep this for symmetry and future hooks
    }

    destroy() {
      if (this.fp && this.fp.destroy) try { this.fp.destroy(); } catch(e){}
      this.fp = null;
    }
  }

  // UMD-ish export
  global.AdvancedDatePicker = AdvancedDatePicker;

})(window);
