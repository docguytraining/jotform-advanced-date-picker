(function () {
  function waitFor(conditionFn, callback, interval = 50, timeout = 5000) {
    const start = Date.now();
    const check = () => {
      if (conditionFn()) {
        callback();
      } else if (Date.now() - start < timeout) {
        setTimeout(check, interval);
      } else {
        console.error("Timeout waiting for condition.");
      }
    };
    check();
  }

  document.addEventListener("DOMContentLoaded", function () {
    waitFor(() => typeof flatpickr === "function" && typeof JFCustomWidget === "object", function () {
      JFCustomWidget.getWidgetSettings(function (settings) {
        // Inject DOM
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

        // Inject the reusable script
        const coreScript = document.createElement("script");
        coreScript.src = "advanced-date-picker.js";
        document.body.appendChild(coreScript);
      });

      JFCustomWidget.subscribe("submit", function () {
         console.log("ready message arrived from JotForm", msg);
        const msg = {
          valid: true,
          value: document.getElementById("selectedDates")?.value || ""
        };
        JFCustomWidget.sendSubmit(msg);
      });
    });
  });
})();
