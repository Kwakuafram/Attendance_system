/**
 * Ghana Public Holidays Utility
 *
 * Covers:
 *  - Fixed-date holidays (New Year, Independence Day, etc.)
 *  - Computed holidays (Easter-based: Good Friday, Easter Monday)
 *  - Approximate Islamic holidays (Eid al-Fitr, Eid al-Adha)
 *    → These shift each year; we store known/estimated dates per year.
 *
 * Usage:
 *   isGhanaHoliday("2026-03-05")  → true/false
 *   isSchoolDay("2026-03-05")     → true if weekday AND not a holiday
 *   getHolidayName("2026-01-01")  → "New Year's Day"
 */

// ─── Fixed holidays (month-day) ────────────────────────────────────────────
// These are the same every year.
const FIXED_HOLIDAYS = [
  { mmdd: "01-01", name: "New Year's Day" },
  { mmdd: "01-07", name: "Constitution Day" },
  { mmdd: "03-06", name: "Independence Day" },
  { mmdd: "05-01", name: "May Day / Workers' Day" },
  { mmdd: "05-25", name: "Africa Day / AU Day" },
  { mmdd: "07-01", name: "Republic Day" },
  { mmdd: "08-04", name: "Founders' Day" },
  { mmdd: "09-21", name: "Kwame Nkrumah Memorial Day" },
  { mmdd: "12-01", name: "Farmers' Day" },  // first Friday of Dec, but govt sometimes fixes Dec 1
  { mmdd: "12-25", name: "Christmas Day" },
  { mmdd: "12-26", name: "Boxing Day" },
];

// ─── Easter computation (Anonymous Gregorian algorithm) ────────────────────
function computeEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function fmtDate(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Get Easter-based holidays for a year. */
function getEasterHolidays(year) {
  const easter = computeEasterSunday(year);
  return [
    { date: fmtDate(addDays(easter, -2)), name: "Good Friday" },
    { date: fmtDate(addDays(easter, -1)), name: "Holy Saturday" },
    { date: fmtDate(easter), name: "Easter Sunday" },
    { date: fmtDate(addDays(easter, 1)), name: "Easter Monday" },
  ];
}

// ─── Islamic holidays (approximate — these shift ~11 days each year) ──────
// Since the Islamic calendar is lunar, we store known/estimated dates.
// Update this map each year or fetch from an API.
const ISLAMIC_HOLIDAYS = {
  2024: [
    { date: "2024-04-10", name: "Eid al-Fitr" },
    { date: "2024-04-11", name: "Eid al-Fitr (Day 2)" },
    { date: "2024-06-17", name: "Eid al-Adha" },
    { date: "2024-06-18", name: "Eid al-Adha (Day 2)" },
  ],
  2025: [
    { date: "2025-03-31", name: "Eid al-Fitr" },
    { date: "2025-04-01", name: "Eid al-Fitr (Day 2)" },
    { date: "2025-06-07", name: "Eid al-Adha" },
    { date: "2025-06-08", name: "Eid al-Adha (Day 2)" },
  ],
  2026: [
    { date: "2026-03-20", name: "Eid al-Fitr" },
    { date: "2026-03-21", name: "Eid al-Fitr (Day 2)" },
    { date: "2026-05-27", name: "Eid al-Adha" },
    { date: "2026-05-28", name: "Eid al-Adha (Day 2)" },
  ],
  2027: [
    { date: "2027-03-10", name: "Eid al-Fitr" },
    { date: "2027-03-11", name: "Eid al-Fitr (Day 2)" },
    { date: "2027-05-16", name: "Eid al-Adha" },
    { date: "2027-05-17", name: "Eid al-Adha (Day 2)" },
  ],
  2028: [
    { date: "2028-02-27", name: "Eid al-Fitr" },
    { date: "2028-02-28", name: "Eid al-Fitr (Day 2)" },
    { date: "2028-05-05", name: "Eid al-Adha" },
    { date: "2028-05-06", name: "Eid al-Adha (Day 2)" },
  ],
};

// ─── Build full holiday set for a year ─────────────────────────────────────

/** Cache: year → Map<dateStr, name> */
const _cache = {};

function buildHolidayMap(year) {
  if (_cache[year]) return _cache[year];

  const map = new Map();

  // Fixed holidays
  for (const h of FIXED_HOLIDAYS) {
    map.set(`${year}-${h.mmdd}`, h.name);
  }

  // Easter-based
  for (const h of getEasterHolidays(year)) {
    map.set(h.date, h.name);
  }

  // Islamic
  const islamic = ISLAMIC_HOLIDAYS[year] || [];
  for (const h of islamic) {
    map.set(h.date, h.name);
  }

  _cache[year] = map;
  return map;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Check if a YYYY-MM-DD date string is a Ghana public holiday.
 */
export function isGhanaHoliday(dateStr) {
  const year = Number(dateStr.slice(0, 4));
  const map = buildHolidayMap(year);
  return map.has(dateStr);
}

/**
 * Get the holiday name for a YYYY-MM-DD date string (or null).
 */
export function getHolidayName(dateStr) {
  const year = Number(dateStr.slice(0, 4));
  const map = buildHolidayMap(year);
  return map.get(dateStr) || null;
}

/**
 * Check if a date is a weekend (Saturday=6 or Sunday=0).
 */
export function isWeekend(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Returns true if the date is a regular school/work day:
 * - Must be a weekday (Mon–Fri)
 * - Must NOT be a Ghana public holiday
 */
export function isSchoolDay(dateStr) {
  return !isWeekend(dateStr) && !isGhanaHoliday(dateStr);
}

/**
 * Check if today (Accra time) is a Monday.
 * Accepts an optional YYYY-MM-DD string.
 */
export function isMonday(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.getUTCDay() === 1;
}

/**
 * Get the day-of-week index (0=Sun … 6=Sat) for an Accra date string.
 */
export function getDayOfWeek(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.getUTCDay();
}
