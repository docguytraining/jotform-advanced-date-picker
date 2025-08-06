document.addEventListener("DOMContentLoaded", function () {
    const calendarEl = document.getElementById("calendar");
    const outputEl = document.getElementById("postOutput");
    const selectedDisplay = document.getElementById("selectedDatesDisplay");
    const hiddenInput = document.getElementById("selectedDates") || createHiddenInput();

    const config = {
        startDate: calendarEl.dataset.startDate,
        endDate: calendarEl.dataset.endDate,
        displayFormat: calendarEl.dataset.displayFormat || "Y-m-d",
        allowedWeekdays: (calendarEl.dataset.allowedWeekdays || "")
            .split(",").map(Number).filter(n => !isNaN(n)),
        excludedDates: (calendarEl.dataset.excludedDates || "")
            .split(",").filter(Boolean),
        minSelectableDates: parseInt(calendarEl.dataset.minSelectableDates || "0"),
        maxSelectableDates: parseInt(calendarEl.dataset.maxSelectableDates || "999")
    };

    let limitExceeded = false;

    function isValidISODate(dateStr) {
        return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(new Date(dateStr).getTime());
    }

    if (!isValidISODate(config.startDate) || !isValidISODate(config.endDate)) {
        calendarEl.innerHTML = "<strong style='color:red;'>Error: Start and end dates must be valid ISO dates (YYYY-MM-DD).</strong>";
        console.error("Invalid date configuration:", config.startDate, config.endDate);
        return;
    }

    const maxReachedWarning = createWarningMessage();

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
                limitExceeded = true;
                showWarning("You can select up to " + config.maxSelectableDates + " dates.");

                setTimeout(() => {
                    dates.pop(); // remove extra date
                    instance.setDate(dates, true); // reset without triggering another full clear
                    limitExceeded = false;
                }, 10);

                return;
            }

            if (!limitExceeded) {
                if (dates.length < config.minSelectableDates) {
                    showWarning("You must select at least " + config.minSelectableDates + " dates.");
                } else {
                    clearWarning();
                }
            }

            updateSelectedDates(dates);
        }
    });

    function updateSelectedDates(dates) {
        const formatted = dates.map(d => formatDate(d));
        selectedDisplay.textContent = formatted.join(", ");
        hiddenInput.value = formatted.join(",");
    }

    function formatDate(date) {
        return date.toISOString().split("T")[0];
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
        const el = document.createElement("div");
        el.id = "calendar-warning";
        el.style.color = "red";
        el.style.marginTop = "0.5em";
        calendarEl.parentNode.insertBefore(el, calendarEl.nextSibling);
        return el;
    }

    function showWarning(message) {
        maxReachedWarning.textContent = message;
    }

    function clearWarning() {
        maxReachedWarning.textContent = "";
    }
});
