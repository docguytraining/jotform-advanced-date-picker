(function () {
  console.log("[widget.js] Script starting");

  // Initialize Jotform widget first
  function initializeJotformWidget() {
    if (typeof window.JFCustomWidget === "object") {
      console.log("[widget.js] JFCustomWidget detected, calling ready()");
      
      // Tell Jotform the widget is ready
      if (typeof JFCustomWidget.ready === "function") {
        JFCustomWidget.ready();
      }
      
      // Alternative: Some widgets need to call requestFrameResize
      if (typeof JFCustomWidget.requestFrameResize === "function") {
        JFCustomWidget.requestFrameResize({ width: "100%", height: 420 });
      }
      
      return true;
    }
    return false;
  }

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

  // Initialize Jotform widget first
  const jotformReady = initializeJotformWidget();
  console.log("[widget.js] Jotform widget ready:", jotformReady);

  document.addEventListener("DOMContentLoaded", function () {
    console.log("[widget.js] DOMContentLoaded");

    waitFor(
      () => typeof flatpickr === "function",
      function () {
        console.log("[widget.js] flatpickr is available");

        function runWidget(settings, fromJotform = false) {
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

          // Only display settings table if data came from Jotform
          if (fromJotform) {
            let debugDiv = document.getElementById("jotform-settings-debug");
            if (!debugDiv) {
              debugDiv = document.createElement("div");
              debugDiv.id = "jotform-settings-debug";
              debugDiv.style.background = "#f8f8f8";
              debugDiv.style.border = "1px solid #ccc";
              debugDiv.style.fontSize = "12px";
              debugDiv.style.margin = "10px 0";
              debugDiv.style.padding = "8px";
              document.body.insertBefore(debugDiv, document.body.firstChild);
            }
            debugDiv.innerHTML = "<strong>Jotform Widget Settings:</strong><br><pre style='white-space:pre-wrap;'>" +
              JSON.stringify(settings, null, 2) + "</pre>";
          }
        }

        // Debug: Log JFCustomWidget details
        if (typeof window.JFCustomWidget === "object") {
          console.log("JFCustomWidget object:", window.JFCustomWidget);
          console.log("Available methods:", Object.keys(window.JFCustomWidget || {}));
        }

       // Replace your JFCustomWidget.getWidgetSettings block with this:

try {
  if (typeof window.JFCustomWidget === "object") {
    console.log("[widget.js] JFCustomWidget detected");
    
    // Method 1: Direct property access (some widgets work this way)
    if (window.JFCustomWidget.settings) {
      console.log("[widget.js] Found settings directly:", window.JFCustomWidget.settings);
      runWidget(window.JFCustomWidget.settings, true);
    }
    // Method 2: Try getWidgetSetting (singular, not plural)
    else if (typeof JFCustomWidget.getWidgetSetting === "function") {
      console.log("[widget.js] Trying getWidgetSetting (singular)");
      const settings = {
        startDate: JFCustomWidget.getWidgetSetting('startDate'),
        endDate: JFCustomWidget.getWidgetSetting('endDate'),
        minSelectableDates: JFCustomWidget.getWidgetSetting('minSelectableDates'),
        maxSelectableDates: JFCustomWidget.getWidgetSetting('maxSelectableDates'),
        displayFormat: JFCustomWidget.getWidgetSetting('displayFormat'),
        allowedWeekdays: JFCustomWidget.getWidgetSetting('allowedWeekdays'),
        excludedDates: JFCustomWidget.getWidgetSetting('excludedDates')
      };
      console.log("[widget.js] Retrieved individual settings:", settings);
      runWidget(settings, true);
    }
    // Method 3: Your original method with timeout
    else if (typeof JFCustomWidget.getWidgetSettings === "function") {
      console.log("[widget.js] Calling JFCustomWidget.getWidgetSettings...");
      
      let called = false;
      const fallbackSettings = {
        startDate: "2025-08-01",
        endDate: "2025-08-31",
        displayFormat: "Y-m-d",
        allowedWeekdays: "1,2,3,4,5",
        excludedDates: "",
        minSelectableDates: "1",
        maxSelectableDates: "5"
      };
      
      const timeout = setTimeout(() => {
        if (!called) {
          console.warn("[widget.js] getWidgetSettings timeout, using fallback");
          runWidget(fallbackSettings);
        }
      }, 1000); // Reduced timeout to 1 second
      
      JFCustomWidget.getWidgetSettings(function (settings) {
        called = true;
        clearTimeout(timeout);
        console.log("[widget.js] SUCCESS: Received settings:", settings);
        runWidget(settings || fallbackSettings, true);
      });
    }
  } else {
    // Local testing fallback
    console.warn("[widget.js] No JFCustomWidget, using local fallback");
    runWidget({
      startDate: "2025-08-01",
      endDate: "2025-08-31",
      displayFormat: "Y-m-d",
      allowedWeekdays: "1,2,3,4,5",
      excludedDates: "",
      minSelectableDates: "1",
      maxSelectableDates: "5"
    });
  }
} catch (e) {
  console.error("[widget.js] Exception:", e);
}

        // Only subscribe if JFCustomWidget exists
        if (typeof window.JFCustomWidget === "object" && typeof JFCustomWidget.subscribe === "function") {
          JFCustomWidget.subscribe("submit", function () {
            const msg = {
              valid: true,
              value: document.getElementById("selectedDates")?.value || ""
            };
            JFCustomWidget.sendSubmit(msg);
          });
        }
      }
    );
  });
})();
