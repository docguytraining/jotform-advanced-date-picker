document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);

  const startDateStr = params.get("startDate") || "2025-08-01";
  const endDateStr = params.get("endDate") || "2025-08-31";
  const minSelectable = parseInt(params.get("minSelectableDates") || "0", 10);
  const maxSelectable = parseInt(params.get("maxSelectableDates") || "20", 10);
  const displayFormat = params.get("displayFormat") || "Y-m-d";

  const weekdaysRaw = params.get("allowedWeekdays") || "0,1,2,3,4,5,6";
  const allowedWeekdays = weekdaysRaw
    .split(",")
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n >= 0 && n <= 6);

  const excludedDates = (params.get("excludedDates") || "")
    .split(",")
    .map(d => d.trim())
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  // ✅ Calculate first valid selectable date
  let defaultDate = null;
  const probe = new Date(startDate);
  while (probe <= endDate) {
    const day = probe.getDay();

    const iso = [
      probe.getFullYear().toString().padStart(4, "0"),
      (probe.getMonth() + 1).toString().padStart(2, "0"),
      probe.getDate().toString().padStart(2, "0")
    ].join("-");

    if (allowedWeekdays.includes(day) && !excludedDates.includes(iso)) {
      defaultDate = iso;
      break;
    }
    probe.setDate(probe.getDate() + 1);
  }

  const feedbackEl = document.getElementById("feedback");
  const selectedDatesEl = document.getElementById("selectedDates");

  const fp = flatpickr("#datePicker", {
    mode: "multiple",
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: displayFormat,
    minDate: startDateStr,
    maxDate: endDateStr,
    defaultDate: defaultDate,
    inline: true,

    disable: [
      function (date) {
        const day = date.getDay();
        const iso = [
          date.getFullYear().toString().padStart(4, "0"),
          (date.getMonth() + 1).toString().padStart(2, "0"),
          date.getDate().toString().padStart(2, "0")
        ].join("-");
        return !allowedWeekdays.includes(day) || excludedDates.includes(iso);
      }
    ],

    onReady: function () {
      if (defaultDate) {
        fp.jumpToDate(defaultDate);
      } else {
        fp.jumpToDate(startDateStr);
      }
    },

    onChange: (selectedDates) => {
      const rawDates = selectedDates.map(d =>
        `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`
      );

      if (rawDates.length > maxSelectable) {
        feedbackEl.textContent = `You can select up to ${maxSelectable} date(s).`;
        fp.setDate(selectedDates.slice(0, maxSelectable));
        return;
      }

      feedbackEl.textContent =
        rawDates.length < minSelectable
          ? `Select at least ${minSelectable} date(s).`
          : "";

      const formattedDates = selectedDates.map(d => fp.formatDate(d, displayFormat));
      selectedDatesEl.innerHTML = formattedDates.length
        ? `<strong>Selected Dates:</strong><ul>${formattedDates.map(d => `<li>${d}</li>`).join("")}</ul>`
        : `<em>No dates selected yet.</em>`;

      window.parent.postMessage({
        type: "control",
        method: "set",
        value: rawDates.join(",")
      }, "*");
    }
  });
});
