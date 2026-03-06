export function isLateInAccra(checkInDate) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(checkInDate);

  const hour = Number(parts.find(p => p.type === "hour")?.value);
  const minute = Number(parts.find(p => p.type === "minute")?.value);
  const second = Number(parts.find(p => p.type === "second")?.value);

  // Late if after 06:15:00
  if (hour > 6) return true;
  if (hour < 6) return false;

  if (minute > 15) return true;
  if (minute < 15) return false;

  return second > 0;
}
