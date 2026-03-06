export function yyyyMmDd(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function yyyyMm(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function attendanceDocId(uid, dateStr) {
  return `${uid}_${dateStr}`;
}
