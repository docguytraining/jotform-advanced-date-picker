document.addEventListener("DOMContentLoaded", function() {
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");
    const calendarContainer = document.getElementById("calendar");

    // Function to generate the calendar
    function generateCalendar(startDate, endDate) {
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        const currentMonth = startDateObj.getMonth();
        const currentYear = startDateObj.getFullYear();

        // Clear existing calendar
        calendarContainer.innerHTML = "";

        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
        const totalDaysInMonth = lastDayOfMonth.getDate();

        // Create days for the calendar
        for (let i = 1; i <= totalDaysInMonth; i++) {
            const dayElement = document.createElement("div");
            dayElement.classList.add("day");
            dayElement.textContent = i;
            dayElement.dataset.date = `${currentYear}-${currentMonth + 1}-${i}`;

            // Mark selected days
            if (isDateInRange(`${currentYear}-${currentMonth + 1}-${i}`, startDate, endDate)) {
                dayElement.classList.add("selected");
            }

            // Add hover effect
            dayElement.addEventListener("click", function() {
                toggleSelectedDay(dayElement, startDate, endDate);
            });

            calendarContainer.appendChild(dayElement);
        }
    }

    // Check if a date is in the range
    function isDateInRange(dateStr, startDate, endDate) {
        return dateStr >= startDate && dateStr <= endDate;
    }

    // Toggle selected dates
    function toggleSelectedDay(dayElement, startDate, endDate) {
        const selectedDate = dayElement.dataset.date;
        const selectedDates = getSelectedDates(startDate, endDate);

        if (selectedDates.includes(selectedDate)) {
            // Remove from selected dates
            dayElement.classList.remove("selected");
        } else {
            // Add to selected dates
            dayElement.classList.add("selected");
        }
    }

    // Get selected dates as a comma-separated list
    function getSelectedDates(startDate, endDate) {
        const selectedDays = [];
        document.querySelectorAll(".day.selected").forEach(day => {
            selectedDays.push(day.dataset.date);
        });
        return selectedDays.join(",");
    }

    // Listen for start and end date changes
    startDateInput.addEventListener("change", function() {
        if (startDateInput.value && endDateInput.value) {
            generateCalendar(startDateInput.value, endDateInput.value);
        }
    });

    endDateInput.addEventListener("change", function() {
        if (startDateInput.value && endDateInput.value) {
            generateCalendar(startDateInput.value, endDateInput.value);
        }
    });
});
