# Advanced Date Picker Widget for Jotform

A custom Jotform widget that lets form users select multiple dates within a defined range — with fine-grained controls for allowed days, exclusions, and min/max selections.

## Features
- **Start/End Date Limits** – Show only months/days within a configured date range.  
- **Allowed Weekdays** – Limit selectable dates to specific days of the week.  
- **Excluded Dates** – Block out specific dates inside the range.  
- **Min/Max Selectable Dates** – Control how many dates can be chosen.  
- **Custom Date Display** – Choose how dates appear in the widget and in submission data.  
- **Readable Output** – Stores dates in the form’s chosen display format for easy viewing in Jotform Tables.  
- **Live Feedback** – Displays selected dates in a human-friendly list below the calendar.  
- **Error Handling** – Warns during form setup if constraints make selection impossible.  
- **Always-Visible Calendar** – No pop-up picker; the calendar is fully visible for faster selection.  
- **Accessible** – Keyboard-friendly and screen-reader considerate.  

## How It Works
1. You configure:
   - Start and end dates  
   - Allowed weekdays  
   - Excluded dates  
   - Minimum and maximum number of selectable dates  
   - Display format for saved dates  
2. The widget renders a calendar that respects these settings.  
3. Users click to select/deselect dates; the widget enforces rules in real time.  
4. The widget sends back **formatted text** (CSV using your display format), so it looks clean in Jotform Tables.

## Installation
1. Host the widget files (`index.html`, `widget.js`, `style.css`) on a public server or GitHub Pages.  
2. Add the widget to your Jotform form via **Custom Widget**.  
3. Configure the widget settings:
   - **Start Date**  
   - **End Date**  
   - **Allowed Weekdays** (checkbox list)  
   - **Excluded Dates** (comma-separated `YYYY-MM-DD`)  
   - **Minimum / Maximum Selectable Dates**  
   - **Display Format** (e.g., `Y-m-d`, `M j`, `d M Y`)  

## File Overview
- **index.html** – Container and script load order.  
- **widget.js** – Logic, parsing/formatting, constraint enforcement, Jotform API integration.  
- **style.css** – Calendar and widget styles.  
- **Flatpickr** – Loaded from CDN.

---

## For Developers

### Jotform Widget API
The widget uses `JFCustomWidget`:
- `subscribe('ready', handler)` – Initialize with builder-provided settings.  
- `subscribe('submit', handler)` – Validate and send the final value.  
- `sendSubmit({ valid, value })` – Return status and value to Jotform.  
- `sendData({ value })` – (Optional) Live-save current value (helps in Tables/editor contexts).  
- `requestFrameResize({ height })` – Resize the iframe to fit dynamic content.  
- `getWidgetSettings()` – (Sometimes) returns settings directly; we also parse the `ready` payload.  

### Settings Normalization
- URL-decoded into `{ name: value }`.  
- Dates normalized to ISO (`YYYY-MM-DD`) internally.  
- Allowed weekdays mapped to `0..6`.  
- Excluded dates parsed to a `Set` of ISO strings.  
- Display format preserved for on-screen text and stored value.

### Selection Rules
- Disable outside **start/end**.  
- Disable not-in **allowed weekdays**.  
- Disable any **excluded dates**.  
- Enforce **max** (hard block) and show **min** warning.  
- Show a friendly “X dates selected: …” summary (groups consecutive dates into ranges).  

### Stored Value
- Stored as **CSV** of dates formatted with a storage-safe variant of your **Display Format** (weekday tokens removed; month tokens normalized to numeric; year forced to `Y`).  
- Example: `2025-08-19, 2025-08-20, 2025-08-24`

---

## Developer Flow

```mermaid
flowchart TD
    A[Jotform loads widget iframe] --> B[widget.js boot]
    B --> C[subscribe('ready')]
    C --> D{Get settings}
    D -->|JFCustomWidget.getWidgetSettings() present| E[Use API settings]
    D -->|Else| F[Parse settings from ready payload]
    E --> G[normalizeSettings()]
    F --> G[normalizeSettings()]
    G --> H[validateSettings()]
    H -->|errors| I[Render error message; stop]
    H -->|ok| J[runWidget()]
    J --> K[Flatpickr init (inline, multiple)]
    K --> L[User selects/deselects dates]
    L --> M[onChange() -> enforce rules, update display]
    M --> N[sendData({value}) (optional live save)]
    N --> O[User submits form]
    O --> P[submitHandler()]
    P --> Q[Validate min/max again]
    Q -->|invalid| R[sendSubmit({valid:false})]
    Q -->|valid| S[Format CSV -> sendSubmit({valid:true, value})]
```

## Edit-in-Tables Flow (rehydration)

When you click the cell in Jotform Tables and the widget reopens:
```
sequenceDiagram
  participant Tables
  participant Widget
  participant Flatpickr

  Tables->>Widget: Load + pass existing cell value (string)
  Widget->>Widget: Try JSON parse; if fails, parse CSV using makeStorageFormat(displayFormat)
  Widget->>Flatpickr: setDate(restored ISO array)
  Flatpickr-->>Widget: ready
  Widget->>Tables: (Optional) sendData on changes
  Tables-->>Widget: Submit row/save
  Widget->>Tables: sendSubmit({ valid, value: CSV })
```

### Notes

- We support both legacy JSON-array values and the new CSV string.
- `makeStorageFormat()` ensures the format is parse-safe even if the display format uses month names or omits year.

## Local Development Tips

- Ensure files are served as UTF-8.
- If you output a range dash in code, use `\u2013` to avoid encoding problems.
- Log with the `log()` helper `(console.log wrapper)` for consistent, prefixed logs.
- If you change settings names in the builder UI, update `normalizeSettings()` and the README.

## Known Behaviors

In Jotform Tables, the widget can open for editing inside the cell. We support rehydrating the current value; changes auto-save via `sendData` and save on row submit via `sendSubmit`.

## Troubleshooting

### Widget doesn’t load in the form builder

- Make sure all widget files (`index.html`, `widget.js`, `style.css`) are hosted at a publicly accessible HTTPS URL.  
- Check browser console for 404 errors — a missing script or CSS file will stop the widget from rendering.  

### Calendar shows wrong dates or ignores limits

- Verify that **Start Date** and **End Date** are in `YYYY-MM-DD` format.  
- If **Start Date** is after **End Date**, the widget will stop and show an error.  
- Allowed weekdays must match the builder’s checkbox labels (e.g., `Monday`, `Tuesday`), not numbers.  

### Excluded dates not working

- Excluded dates must be comma-separated and in `YYYY-MM-DD` format.  
- Whitespace after commas is allowed but not required. Example: `2025-08-19,2025-08-24`

### Min/max selectable dates not enforced
- **Max selectable dates** is a hard limit — you can’t click beyond it.  
- **Min selectable dates** is only validated on submit.  
- If your min or max exceeds the number of possible dates in the range, you’ll see a setup-time error.

### Widget value in Jotform Tables is unreadable JSON
- This widget now stores dates as **CSV in your chosen display format**.  
- If you see JSON arrays, you may be viewing submissions from before the upgrade.  
- Old JSON values are still supported when re-editing.

### Editing dates in Jotform Tables isn’t working
- The widget supports in-cell editing, but Jotform Tables doesn’t show a "Save" button in widget view.  
- Changes save when you exit the cell or submit the row.  
- If you don’t see the calendar when editing, refresh Tables and try again.

### Date ranges not displaying full months
- The calendar only renders months that include at least one selectable day within your **start/end** range.  
- To show full months, expand the date range in settings.

### Console errors about `log()` or `console.log`
- This widget uses a `log()` helper. If removed, replace `log(...)` calls with `console.log(...)` or re-add the helper function:

```js
const log = (...args) => console.log('[widget.js]', ...args);
```

## Quick Setup Checklist

1. **Add widget to Jotform**
    - In the Jotform Form Builder, add a Custom Widget.  
    - Set the widget’s URL to the hosted `index.html` file.

1. **Configure date settings**
    - **Start Date** / **End Date** → in `YYYY-MM-DD` format.  
    - **Allowed Weekdays** → check days by name (e.g., Monday, Wednesday).  
    - **Excluded Dates** → comma-separated `YYYY-MM-DD` list.  
    - **Min/Max Selectable Dates** → numeric limits for selection.  
    - **Display Format** → choose how dates appear to users *and* in Jotform Tables.

1. **Test in Preview**
    - Select multiple dates and confirm the calendar respects allowed weekdays, excluded dates, and min/max rules.  
    - Verify error messages appear for invalid configurations.

1. **Check in Jotform Tables**
    - Submit a test entry.  
    - Ensure the stored value is in your chosen display format (CSV list).  
    - Re-edit the widget in Tables to confirm in-cell editing works.

1. **Publish**
    - Make the form live and re-check date selection on mobile and desktop.
