import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

// Returns payments between startDate and endDate (inclusive)
// Dates must be "YYYY-MM-DD" strings.
export async function listPaymentsByDateRange(startDate, endDate) {
  if (!startDate || !endDate) throw new Error("Missing date range.");

  const q = query(
    collection(db, "bursary_payments"),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date", "desc") // required when using range filters
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function groupDailyTotals(payments) {
  const byDate = new Map();

  for (const p of payments) {
    const date = p.date || "—";
    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        fees: 0,
        feeding: 0,
        healthMaintenance: 0,
        classes: 0,
        grand: 0,
        paymentsCount: 0,
      });
    }

    const row = byDate.get(date);
    row.fees += Number(p.fees || 0);
    row.feeding += Number(p.feeding || 0);
    row.healthMaintenance += Number(p.healthMaintenance || 0);
    row.classes += Number(p.classes || 0);
    row.grand += Number(p.total || 0);
    row.paymentsCount += 1;
  }

  return Array.from(byDate.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
