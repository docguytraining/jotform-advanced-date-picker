/** 
 * Advaned Date Picker
 * Author: Paul Pehrson
 * Version: 1.0.0 
 * Source: https://github.com/docguytraining/jotform-advanced-date-picker
 * Requires: Flatpicker v4 (https://cdn.jsdelivr.net/npm/flatpickr)
 * License: MIT License (https://mit-license.org/)
 * 
 *  * To view a working version of this script, see https://docguytraining.github.io/jotform-advanced-date-picker/
 **/

// While this script was written to work with Jotform, it could also be useful for other projects as well, so we're only including code here that is core functionality. If it makes it work with Jotform, that code goes in widget.js. If it makes it work for the example webpage, that code goes in index-scripts.js

console.log("[advanced-date-picker.js] Script loaded and running");


document.addEventListener("DOMContentLoaded", function () {
    console.log("[advanced-date-picker.js] DOMContentLoaded fired");
    const calendarEl = document.getElementById("calendar");
    const selectedDisplay = document.getElementById("selectedDatesDisplay");
    const hiddenInput = document.getElementById("selectedDates") || createHiddenInput();

    const config = {
        startDate: calendarEl.dataset.startDate,
        endDate: calendarEl.dataset.endDate,
        displayFormat: calendarEl.dataset.displayFormat || "Y-m-d",
        allowedWeekdays: (calendarEl.dataset.allowedWeekdays || "")
            .split(",").map(n => parseInt(n)).filter(n => Number.isInteger(n) && n >= 0 && n <= 6),
        excludedDates: (calendarEl.dataset.excludedDates || "")
            .split(",").map(s => s.trim()).filter(isValidISODate),
        minSelectableDates: parseInt(calendarEl.dataset.minSelectableDates || "0"),
        maxSelectableDates: parseInt(calendarEl.dataset.maxSelectableDates || "999")
    };

    const selectableDates = getSelectableDatesInRange(
        config.startDate,
        config.endDate,
        config.allowedWeekdays,
        config.excludedDates
    );

    console.log("Valid selectable dates:", selectableDates);

    const configErrors = validateConfig(config, selectableDates);
    if (configErrors.length > 0) {
        calendarEl.innerHTML = "<strong style='color:red;'>" + configErrors.join("<br/>") + "</strong>";
        console.error("Configuration errors:", configErrors);
        return;
    }

    const warningEl = createWarningMessage();
    let selectedDates = [];

    flatpickr(calendarEl, {
        mode: "multiple",
        inline: true,
        dateFormat: config.displayFormat,
        minDate: config.startDate,
        maxDate: config.endDate,
        disable: [
            ...config.excludedDates,
            function (date) {
                return config.allowedWeekdays.length > 0 &&
                    !config.allowedWeekdays.includes(date.getDay());
            }
        ],
        onChange: function (dates, dateStr, instance) {
            if (dates.length > config.maxSelectableDates) {
                showWarning("You can select up to " + config.maxSelectableDates + " dates.");
                instance.setDate(selectedDates, true);
                return;
            }

            selectedDates = dates;

            if (dates.length < config.minSelectableDates) {
                showWarning("You must select at least " + config.minSelectableDates + " dates.");
            } else {
                clearWarning();
            }

            updateSelectedDates(dates);
        }
    });

    function isValidISODate(dateStr) {
        return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(new Date(dateStr).getTime());
    }

    function formatLocalDate(date) {
        return date.getFullYear() + "-" +
            String(date.getMonth() + 1).padStart(2, "0") + "-" +
            String(date.getDate()).padStart(2, "0");
    }

    function getSelectableDatesInRange(start, end, allowedWeekdays, excludedDates) {
        const dates = [];
        if (!isValidISODate(start) || !isValidISODate(end)) {
            return dates;
        }

        const current = new Date(start + 'T00:00:00');
        const endDate = new Date(end + 'T00:00:00');

        while (current <= endDate) {
            const iso = formatLocalDate(current);
            const day = current.getDay();
            const isExcluded = excludedDates.includes(iso);
            const isAllowed = allowedWeekdays.length === 0 || allowedWeekdays.includes(day);

            if (!isExcluded && isAllowed) {
                dates.push(iso);
            }

            current.setDate(current.getDate() + 1);
        }

        return dates;
    }

    function validateConfig(cfg, selectable) {
        const errors = [];

        if (!isValidISODate(cfg.startDate)) {
            errors.push("Start date must be a valid ISO date (YYYY-MM-DD).");
        }

        if (!isValidISODate(cfg.endDate)) {
            errors.push("End date must be a valid ISO date (YYYY-MM-DD).");
        }

        if (
            isValidISODate(cfg.startDate) &&
            isValidISODate(cfg.endDate) &&
            new Date(cfg.startDate) > new Date(cfg.endDate)
        ) {
            errors.push("Start date must be before or equal to end date.");
        }

        if (cfg.minSelectableDates > cfg.maxSelectableDates) {
            errors.push("Minimum selectable dates cannot exceed the maximum.");
        }

        if (selectable.length < cfg.minSelectableDates) {
            errors.push(`Only ${selectable.length} selectable date(s) available, but minimum required is ${cfg.minSelectableDates}.`);
        }

        return errors;
    }

    function updateSelectedDates(dates) {
        const formatted = dates.map(d => formatLocalDate(d));
        selectedDisplay.textContent = formatted.join(", ");
        hiddenInput.value = formatted.join(",");
    }

    function createHiddenInput() {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "selectedDates";
        input.id = "selectedDates";
        document.body.appendChild(input);
        return input;
    }

    function createWarningMessage() {
        let el = document.getElementById("calendar-warning");
        if (!el) {
            el = document.createElement("div");
            el.id = "calendar-warning";
            el.style.color = "red";
            el.style.marginTop = "0.5em";
            calendarEl.parentNode.insertBefore(el, calendarEl.nextSibling);
        }
        return el;
    }

    function showWarning(message) {
        warningEl.textContent = message;
    }

    function clearWarning() {
        warningEl.textContent = "";
    }
});
