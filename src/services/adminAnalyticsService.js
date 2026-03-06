// src/services/adminAnalyticsService.js
import { db } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { accraYyyyMmDd } from "../utils/accraTime";
import {
  getTermStats,
  getClassTermStats,
  getRankingRows,
} from "./statsService";

/* ─── helpers ─── */
function dateKey(d = new Date()) {
  return accraYyyyMmDd(d);
}

/**
 * Query all attendance docs for a single date.
 * Returns array of plain objects.
 */
async function getAttendanceDocsForDate(date) {
  const q = query(
    collection(db, "attendance"),
    where("date", "==", date)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Query attendance docs for a date range (inclusive).
 */
async function getAttendanceDocsForRange(from, to) {
  const q = query(
    collection(db, "attendance"),
    where("date", ">=", from),
    where("date", "<=", to),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Query fee_receipts for a single date.
 */
async function getFeeReceiptsForDate(date) {
  const q = query(
    collection(db, "fee_receipts"),
    where("date", "==", date)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Query fee_receipts for a date range (inclusive).
 */
async function getFeeReceiptsForRange(from, to) {
  const q = query(
    collection(db, "fee_receipts"),
    where("date", ">=", from),
    where("date", "<=", to),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Query bursary_payments for a single date.
 */
async function getBursaryPaymentsForDate(date) {
  const q = query(
    collection(db, "bursary_payments"),
    where("date", "==", date)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Query bursary_payments for a date range (inclusive).
 */
async function getBursaryPaymentsForRange(from, to) {
  const q = query(
    collection(db, "bursary_payments"),
    where("date", ">=", from),
    where("date", "<=", to),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get all classes and today's attendance_sessions for each class.
 * Returns { totalClasses, submittedClasses } for a given date.
 */
async function getStudentAttendanceForDate(date) {
  const classesSnap = await getDocs(collection(db, "classes"));
  const classes = classesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  let submittedClasses = 0;
  for (const c of classes) {
    const sessionId = `${c.id}_${date}`;
    const sessionRef = doc(db, "attendance_sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);
    if (sessionSnap.exists() && sessionSnap.data()?.status === "SUBMITTED") {
      submittedClasses++;
    }
  }

  return { totalClasses: classes.length, submittedClasses };
}

/**
 * Compute teacher check-in stats from attendance docs.
 */
function computeTeacherStats(attendanceDocs) {
  let approved = 0;
  let pending = 0;
  let rejected = 0;
  let lateCount = 0;
  let codeExpiredCount = 0;

  for (const a of attendanceDocs) {
    const s = a.status || "";
    if (s === "IN_APPROVED" || s === "PENDING_OUT" || s === "OUT_APPROVED" || s === "REJECTED_OUT") {
      approved++;
    } else if (s === "PENDING_IN") {
      pending++;
    } else if (s === "REJECTED") {
      rejected++;
    }

    if (a.isLate) lateCount++;
    if (a.codeExpiredAtRequest) codeExpiredCount++;
  }

  return { approved, pending, rejected, lateCount, codeExpiredCount };
}

/* ══════════════════════════════════════════════════════════════
   TODAY OVERVIEW — computes live from Firestore collections
   ══════════════════════════════════════════════════════════════ */

/**
 * Gets a live "Today Overview" model for AdminDashboard top cards.
 *
 * Shape matches what AdminDashboard.jsx expects:
 *   teacherCheckins: { approved, pending, rejected }
 *   studentAttendance: { submittedClasses, totalClasses }
 *   fees: { receiptsCount, amountTotal, currency }
 *   bursary: { paymentsCount, grandTotal, currency }
 *   flags: { lateTeachersCount, codeExpiredAtRequestCount }
 */
export async function getAdminTodayOverview(date = dateKey()) {
  // Run queries in parallel for speed
  const [attendanceDocs, studentAtt, feeReceipts, bursaryPayments] =
    await Promise.all([
      getAttendanceDocsForDate(date),
      getStudentAttendanceForDate(date),
      getFeeReceiptsForDate(date),
      getBursaryPaymentsForDate(date),
    ]);

  // Teacher check-in stats
  const ts = computeTeacherStats(attendanceDocs);

  // Fee receipt totals
  let feesTotal = 0;
  for (const r of feeReceipts) {
    feesTotal += Number(r.amount || 0);
  }

  // Bursary totals
  let bursaryGrand = 0;
  for (const p of bursaryPayments) {
    bursaryGrand += Number(p.total || 0);
  }

  return {
    dateId: date,

    teacherCheckins: {
      approved: ts.approved,
      pending: ts.pending,
      rejected: ts.rejected,
    },

    studentAttendance: {
      submittedClasses: studentAtt.submittedClasses,
      totalClasses: studentAtt.totalClasses,
    },

    fees: {
      receiptsCount: feeReceipts.length,
      amountTotal: feesTotal,
      currency: "GHS",
    },

    bursary: {
      paymentsCount: bursaryPayments.length,
      grandTotal: bursaryGrand,
      currency: "GHS",
    },

    flags: {
      lateTeachersCount: ts.lateCount,
      codeExpiredAtRequestCount: ts.codeExpiredCount,
    },
  };
}

/* ══════════════════════════════════════════════════════════════
   DAILY TRENDS — computes live from Firestore collections
   ══════════════════════════════════════════════════════════════ */

/**
 * Returns daily rows + totals for a date range.
 *
 * Shape matches what AdminDashboard.jsx expects:
 *   rows[]: { date, teacherApproved, teacherPending,
 *             studentSubmittedClasses, feesTotal, bursaryGrand }
 *   totals: { teacherApproved }
 */
export async function getAdminDailyTrends(fromDate, toDate) {
  if (!fromDate || !toDate) throw new Error("Select From and To dates.");

  // Parallel queries for the range
  const [attendanceDocs, feeReceipts, bursaryPayments] = await Promise.all([
    getAttendanceDocsForRange(fromDate, toDate),
    getFeeReceiptsForRange(fromDate, toDate),
    getBursaryPaymentsForRange(fromDate, toDate),
  ]);

  // Also get student attendance per day — collect unique dates first
  const allDates = new Set();
  for (const a of attendanceDocs) if (a.date) allDates.add(a.date);
  for (const r of feeReceipts) if (r.date) allDates.add(r.date);
  for (const p of bursaryPayments) if (p.date) allDates.add(p.date);

  // Ensure we cover every calendar day in the range
  let cursor = new Date(fromDate + "T00:00:00");
  const end = new Date(toDate + "T00:00:00");
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    allDates.add(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }

  // Group attendance docs by date
  const attByDate = new Map();
  for (const a of attendanceDocs) {
    if (!a.date) continue;
    if (!attByDate.has(a.date)) attByDate.set(a.date, []);
    attByDate.get(a.date).push(a);
  }

  // Group fee receipts by date
  const feesByDate = new Map();
  for (const r of feeReceipts) {
    if (!r.date) continue;
    if (!feesByDate.has(r.date)) feesByDate.set(r.date, []);
    feesByDate.get(r.date).push(r);
  }

  // Group bursary by date
  const bursByDate = new Map();
  for (const p of bursaryPayments) {
    if (!p.date) continue;
    if (!bursByDate.has(p.date)) bursByDate.set(p.date, []);
    bursByDate.get(p.date).push(p);
  }

  // Get classes once (for student attendance sessions)
  const classesSnap = await getDocs(collection(db, "classes"));
  const classes = classesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Build rows
  const sortedDates = [...allDates].sort();
  const rows = [];
  let totalApproved = 0;

  for (const date of sortedDates) {
    // Teacher stats
    const dayAtt = attByDate.get(date) || [];
    const ts = computeTeacherStats(dayAtt);
    totalApproved += ts.approved;

    // Student attendance — count submitted session docs for this date
    let submittedClasses = 0;
    for (const c of classes) {
      const sessionId = `${c.id}_${date}`;
      const sessionRef = doc(db, "attendance_sessions", sessionId);
      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists() && sessionSnap.data()?.status === "SUBMITTED") {
        submittedClasses++;
      }
    }

    // Fee totals
    const dayFees = feesByDate.get(date) || [];
    let feesTotal = 0;
    for (const r of dayFees) feesTotal += Number(r.amount || 0);

    // Bursary totals
    const dayBurs = bursByDate.get(date) || [];
    let bursaryGrand = 0;
    for (const p of dayBurs) bursaryGrand += Number(p.total || 0);

    rows.push({
      date,
      teacherApproved: ts.approved,
      teacherPending: ts.pending,
      studentSubmittedClasses: submittedClasses,
      feesTotal,
      bursaryGrand,
    });
  }

  return {
    fromDateId: fromDate,
    toDateId: toDate,
    rows,
    totals: {
      teacherApproved: totalApproved,
    },
  };
}

/* ══════════════════════════════════════════════════════════════
   TERM SUMMARY + CLASS RANKING (unchanged — reads stats_terms)
   ══════════════════════════════════════════════════════════════ */

/**
 * Term-level academics/finance summary.
 */
export async function getAdminTermSummary(year, termNo) {
  const t = await getTermStats(year, termNo);
  if (!t) return null;

  const byClass = t?.academics?.byClass || {};
  const classes = Object.entries(byClass).map(([classId, v]) => ({
    classId,
    className: v?.className || "",
    avgTotal: Number(v?.avgTotal ?? 0),
    highestTotal: Number(v?.highestTotal ?? 0),
    lowestTotal: Number(v?.lowestTotal ?? 0),
    reportsCount: Number(v?.reportsCount ?? 0),
  }));

  classes.sort((a, b) => b.avgTotal - a.avgTotal);

  const bySubject = t?.academics?.bySubject || {};
  const subjects = Object.entries(bySubject).map(([key, v]) => ({
    key,
    avg: Number(v?.avg ?? 0),
    passRate: Number(v?.passRate ?? 0),
  }));

  return {
    id: t.id,
    year: Number(t.year ?? year),
    termNo: Number(t.termNo ?? termNo),

    finance: {
      collected: Number(t?.finance?.collected ?? 0),
      outstanding: Number(t?.finance?.outstanding ?? 0),
      exemptionsValue: Number(t?.finance?.exemptionsValue ?? 0),
    },

    academics: {
      classes,
      subjects,
    },

    raw: t,
  };
}

/**
 * Class-term ranking for positions.
 */
export async function getAdminClassRanking(classId, year, termNo) {
  const stats = await getClassTermStats(classId, year, termNo);
  if (!stats) return null;

  const ranking = getRankingRows(stats);
  const top10 = ranking.slice(0, 10);

  return {
    classId,
    year: Number(year),
    termNo: Number(termNo),
    className: stats?.className || "",
    computedAt: stats?.computedAt || null,
    ranking,
    top10,
    raw: stats,
  };
}

/**
 * Utility: list all classes quickly for dropdowns (AdminDashboard).
 */
export async function listAllClassesForAdmin() {
  const snap = await getDocs(collection(db, "classes"));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  return rows;
}
