document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const verbose = params.get("verbose") === "true";

    function log(...args) {
        if (verbose) console.log(...args);
    }

    const isConfigMode = params.get("mode") === "edit" || params.get("mode") === "builder";
    const configForm = document.querySelector(".config-form");

    if (isConfigMode) {
        configForm.style.display = "block";

        const excludedInput = document.getElementById("configExcludedDates");
        if (excludedInput) {
            flatpickr(excludedInput, {
                mode: "multiple",
                dateFormat: "Y-m-d",
                onChange: function (selectedDates) {
                    const formatted = selectedDates.map(d => d.toISOString().split("T")[0]);
                    excludedInput.value = formatted.join(",");
                }
            });
        }

        configForm.addEventListener("submit", function (e) {
            e.preventDefault();
            applyConfig();
        });
    }

    const calendarSection = document.getElementById("calendarSection");
    const calendarEl = document.getElementById("calendar");
    const outputEl = document.getElementById("postOutput");
    const selectedDisplay = document.getElementById("selectedDatesDisplay");
    const weekdaysMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    function parseWeekdays(checkboxes) {
        return [...checkboxes].filter(cb => cb.checked).map(cb => parseInt(cb.value));
    }

    function parseExcludedDates(str) {
        return str.split(",").map(s => s.trim()).filter(Boolean);
    }

    function calculateAvailableDates(start, end, allowedWeekdays, excludedDates) {
        const result = [];
        const current = new Date(start);
        const endDate = new Date(end);
        while (current <= endDate) {
            const day = current.getDay();
            const iso = current.toISOString().split("T")[0];
            if (allowedWeekdays.includes(day) && !excludedDates.includes(iso)) {
                result.push(iso);
            }
            current.setDate(current.getDate() + 1);
        }
        log("Available Dates:", result);
        return result;
    }

    function renderFlatpickr(start, end, allowedWeekdays, excludedDates, displayFormat, minDates, maxDates) {
        let suppressOnChange = false;
        let lastValidSelection = [];


        if (displayFormat === "d M") displayFormat = "j M";

        const availableDates = calculateAvailableDates(start, end, allowedWeekdays, excludedDates);

        if (minDates > availableDates.length) {
            alert(`Configuration error: minSelectableDates (${minDates}) is greater than number of selectable dates (${availableDates.length})`);
            return;
        }

        calendarEl.innerHTML = "";
        flatpickr(calendarEl, {
            inline: true,
            mode: "multiple",
            dateFormat: displayFormat,
            minDate: start,
            maxDate: end,
            disable: [
                function(date) {
                    const iso = date.toISOString().split("T")[0];
                    return !allowedWeekdays.includes(date.getDay()) || excludedDates.includes(iso);
                }
            ],
            onChange: function(selectedDates, dateStr, instance) {
                if (suppressOnChange) return;

                log("Selected dates:", selectedDates);

                selectedDisplay.classList.remove("error");

                if (selectedDates.length < minDates) {
                    selectedDisplay.textContent = `Select at least ${minDates} dates.`;
                    selectedDisplay.classList.add("error");
                    return;
                }

                if (selectedDates.length > maxDates) {
                    selectedDisplay.textContent = `You can only select up to ${maxDates} dates.`;
                    selectedDisplay.classList.add("error");

                    suppressOnChange = true;
                    instance.clear(); // 👈 wipes everything
                    instance.setDate(lastValidSelection, true); // 👈 re-adds valid dates
                    suppressOnChange = false;


                    return;
                }

                lastValidSelection = selectedDates;

                const formatted = selectedDates.map(d => d.toISOString().split("T")[0]);
                selectedDisplay.textContent = `You selected: ${formatted.join(", ")}`;
                const message = { type: "selectedDates", dates: formatted };
                outputEl.textContent = JSON.stringify(message, null, 2);
                window.parent.postMessage(message, "*");
            }

        });
    }

    function applyConfig() {
        const start = document.getElementById("configStartDate").value;
        const end = document.getElementById("configEndDate").value;
        if (!start || !end || isNaN(Date.parse(start)) || isNaN(Date.parse(end))) {
            alert("Start and end dates must be valid.");
            return;
        }

        const displayFormat = document.getElementById("configDisplayFormat").value;
        const weekdays = parseWeekdays(document.querySelectorAll("#weekdayCheckboxes input"));
        const excluded = parseExcludedDates(document.getElementById("configExcludedDates").value);
        const minDates = parseInt(document.getElementById("configMinDates").value);
        const maxDates = parseInt(document.getElementById("configMaxDates").value);

        if (minDates > maxDates) {
            alert("Minimum selectable dates cannot exceed the maximum.");
            return;
        }

        const available = calculateAvailableDates(start, end, weekdays, excluded);
        if (minDates > available.length) {
            alert(`Minimum selectable dates (${minDates}) exceeds number of available dates (${available.length}).`);
            return;
        }

        renderFlatpickr(start, end, weekdays, excluded, displayFormat, minDates, maxDates);
    }

    if (!isConfigMode) {
        const start = params.get("startDate");
        const end = params.get("endDate");
        if (!start || !end || isNaN(Date.parse(start)) || isNaN(Date.parse(end))) {
            alert("Start and end dates must be valid.");
            return;
        }

        const displayFormat = params.get("displayFormat") || "Y-m-d";
        const weekdays = (params.get("allowedWeekdays") || "")
            .split(",")
            .map(s => parseInt(s.trim()))
            .filter(n => !isNaN(n));
        const excluded = (params.get("excludedDates") || "")
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);
        const minDates = parseInt(params.get("minSelectableDates") || "0");
        const maxDates = parseInt(params.get("maxSelectableDates") || "1000");

        renderFlatpickr(start, end, weekdays, excluded, displayFormat, minDates, maxDates);
    }
});
