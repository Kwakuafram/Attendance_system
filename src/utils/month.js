import { getAccraParts } from "./accraTime";

export function accraMonthKey(date = new Date()) {
  const p = getAccraParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function accraMonthName(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra",
    month: "long",
  }).format(date); // e.g., "January"
}

export function accraYear(date = new Date()) {
  const p = getAccraParts(date);
  return p.year;
}
