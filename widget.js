(function () {
  console.log("[widget.js] Script starting");

  function waitFor(conditionFn, callback, interval = 50, timeout = 5000) {
    const start = Date.now();
    const check = () => {
      if (conditionFn()) {
        console.log("[widget.js] Dependencies ready");
        callback();
      } else if (Date.now() - start < timeout) {
        setTimeout(check, interval);
      } else {
        console.error("[widget.js] Timeout waiting for dependencies");
      }
    };
    check();
  }

  document.addEventListener("DOMContentLoaded", function () {
    console.log("[widget.js] DOMContentLoaded");

    waitFor(
      () => {
        return typeof flatpickr === "function" && typeof JFCustomWidget === "object";
      },
      function () {
        console.log("[widget.js] flatpickr and JFCustomWidget are available");

        try {
          JFCustomWidget.getWidgetSettings(function (settings) {
            console.log("[widget.js] Received widget settings:", settings);

            // Fallback for local testing
            if (!settings || Object.keys(settings).length === 0) {
              settings = {
                startDate: "2025-08-01",
                endDate: "2025-08-31",
                displayFormat: "Y-m-d",
                allowedWeekdays: "1,2,3,4,5",
                excludedDates: "",
                minSelectableDates: "1",
                maxSelectableDates: "5"
              };
              console.warn("[widget.js] Using fallback settings for local testing:", settings);
            }

            // Use existing elements if present, otherwise create them
            let calendarEl = document.getElementById("calendar");
            if (!calendarEl) {
              calendarEl = document.createElement("div");
              calendarEl.id = "calendar";
              document.body.appendChild(calendarEl);
            }
            calendarEl.dataset.startDate = settings.startDate || "";
            calendarEl.dataset.endDate = settings.endDate || "";
            calendarEl.dataset.displayFormat = settings.displayFormat || "Y-m-d";
            calendarEl.dataset.allowedWeekdays = settings.allowedWeekdays || "";
            calendarEl.dataset.excludedDates = settings.excludedDates || "";
            calendarEl.dataset.minSelectableDates = settings.minSelectableDates || "0";
            calendarEl.dataset.maxSelectableDates = settings.maxSelectableDates || "999";

            let displayDiv = document.getElementById("selectedDatesDisplay");
            if (!displayDiv) {
              displayDiv = document.createElement("div");
              displayDiv.id = "selectedDatesDisplay";
              document.body.appendChild(displayDiv);
            }

            let warningDiv = document.getElementById("calendar-warning");
            if (!warningDiv) {
              warningDiv = document.createElement("div");
              warningDiv.id = "calendar-warning";
              warningDiv.style.color = "red";
              warningDiv.style.marginTop = "0.5em";
              document.body.appendChild(warningDiv);
            }

            let hiddenInput = document.getElementById("selectedDates");
            if (!hiddenInput) {
              hiddenInput = document.createElement("input");
              hiddenInput.type = "hidden";
              hiddenInput.name = "selectedDates";
              hiddenInput.id = "selectedDates";
              document.body.appendChild(hiddenInput);
            }

            // --- Begin advanced-date-picker.js logic ---
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

            const configErrors = validateConfig(config, selectableDates);
            if (configErrors.length > 0) {
              console.error("Configuration errors:", configErrors);
              calendarEl.innerHTML = "<strong style='color:red;'>" + configErrors.join("<br/>") + "</strong>";
              return;
            }

            let selectedDates = [];

            console.log("About to initialize flatpickr", config);
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
            console.log("flatpickr initialized");

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
              displayDiv.textContent = formatted.join(", ");
              hiddenInput.value = formatted.join(",");
            }

            function showWarning(message) {
              warningDiv.textContent = message;
            }

            function clearWarning() {
              warningDiv.textContent = "";
            }
            // --- End advanced-date-picker.js logic ---

          });
        } catch (e) {
          console.error("[widget.js] Exception in getWidgetSettings block:", e);
        }

        JFCustomWidget.subscribe("submit", function () {
          const msg = {
            valid: true,
            value: document.getElementById("selectedDates")?.value || ""
          };
          JFCustomWidget.sendSubmit(msg);
        });
      }
    );
  });
})();
