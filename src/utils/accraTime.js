export function getAccraParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(date).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function accraYyyyMmDd(date = new Date()) {
  const p = getAccraParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function accraYyyyMm(date = new Date()) {
  const p = getAccraParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function accraMinutesNow(date = new Date()) {
  const p = getAccraParts(date);
  return p.hour * 60 + p.minute;
}

export function accraMinutesFromDate(date) {
  const p = getAccraParts(date);
  return p.hour * 60 + p.minute;
}

