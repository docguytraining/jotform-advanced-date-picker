/** 
 * Jotform Widget wrapper for Advaned Date Picker
 * Author: Paul Pehrson
 * Version: 1.0.0 
 * Source: https://github.com/docguytraining/jotform-advanced-date-picker
 * Requires: Advanced date Picker v1.0.0
 * Requires: Flatpicker v4 (https://cdn.jsdelivr.net/npm/flatpickr)
 * License: MIT License (https://mit-license.org/)
 * 
 *  * To view a working version of this script, see https://docguytraining.github.io/jotform-advanced-date-picker/ 
 **/

// This script is for anythying that makes Advanced Date Picker specifically work with JotForm

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
        script.src = "advanced-date-picker.js";
        document.body.appendChild(script);
    });
};
