window.onload = function () {
    JFCustomWidget.getWidgetSettings(function (settings) {
        const calendarDiv = document.createElement("div");
        calendarDiv.id = "calendar";
        calendarDiv.dataset.startDate = settings.startDate || "";
        calendarDiv.dataset.endDate = settings.endDate || "";
        calendarDiv.dataset.displayFormat = settings.displayFormat || "Y-m-d";
        calendarDiv.dataset.allowedWeekdays = settings.allowedWeekdays || "";
        calendarDiv.dataset.excludedDates = settings.excludedDates || "";
        calendarDiv.dataset.minSelectableDates = settings.minSelectableDates || "0";
        calendarDiv.dataset.maxSelectableDates = settings.maxSelectableDates || "999";

        const displayDiv = document.createElement("div");
        displayDiv.id = "selectedDatesDisplay";

        document.body.appendChild(calendarDiv);
        document.body.appendChild(displayDiv);

        const script = document.createElement("script");
        script.src = "script.js";
        document.body.appendChild(script);
    });
};

