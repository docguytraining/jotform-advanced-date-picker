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
        console.log("[widget.js] typeof flatpickr:", typeof flatpickr);
        console.log("[widget.js] typeof JFCustomWidget:", typeof JFCustomWidget);
        return typeof flatpickr === "function" && typeof JFCustomWidget === "object";
      },
      function () {
        console.log("[widget.js] flatpickr and JFCustomWidget are available");
            try {
            console.log("[widget.js] Calling getWidgetSettings()");
            JFCustomWidget.getWidgetSettings(function (settings) {
                console.log("[widget.js] Callback fired. Settings received:", settings);

                if (!settings || Object.keys(settings).length === 0) {
                console.warn("[widget.js] No settings received from Jotform. Check widget setup.");
                }

                // inject DOM + calendar logic here
            });
            } catch (e) {
            console.error("[widget.js] Error calling getWidgetSettings:", e);
            }

        try {
          console.log("[widget.js] Calling getWidgetSettings()");
          JFCustomWidget.getWidgetSettings(function (settings) {
            console.log("[widget.js] Received widget settings:", settings);

            const calendarEl = document.createElement("div");
            calendarEl.id = "calendar";
            calendarEl.dataset.startDate = settings.startDate || "";
            calendarEl.dataset.endDate = settings.endDate || "";
            calendarEl.dataset.displayFormat = settings.displayFormat || "Y-m-d";
            calendarEl.dataset.allowedWeekdays = settings.allowedWeekdays || "";
            calendarEl.dataset.excludedDates = settings.excludedDates || "";
            calendarEl.dataset.minSelectableDates = settings.minSelectableDates || "0";
            calendarEl.dataset.maxSelectableDates = settings.maxSelectableDates || "999";

            const displayDiv = document.createElement("div");
            displayDiv.id = "selectedDatesDisplay";

            const warningDiv = document.createElement("div");
            warningDiv.id = "calendar-warning";
            warningDiv.style.color = "red";
            warningDiv.style.marginTop = "0.5em";

            const hiddenInput = document.createElement("input");
            hiddenInput.type = "hidden";
            hiddenInput.name = "selectedDates";
            hiddenInput.id = "selectedDates";

            document.body.appendChild(calendarEl);
            document.body.appendChild(warningDiv);
            document.body.appendChild(displayDiv);
            document.body.appendChild(hiddenInput);

            console.log("[widget.js] DOM elements injected");

            const coreScript = document.createElement("script");
            coreScript.src = "advanced-date-picker.js";
            coreScript.onload = () => console.log("[widget.js] advanced-date-picker.js loaded");
            coreScript.onerror = () => console.error("[widget.js] Failed to load advanced-date-picker.js");
            document.body.appendChild(coreScript);
          });
        } catch (e) {
          console.error("[widget.js] Exception in getWidgetSettings block:", e);
        }

        JFCustomWidget.subscribe("submit", function () {
          console.log("[widget.js] Submit triggered");
          const msg = {
            valid: true,
            value: document.getElementById("selectedDates")?.value || ""
          };
          console.log("[widget.js] Sending submit message:", msg);
          JFCustomWidget.sendSubmit(msg);
        });
      }
    );
  });
})();
