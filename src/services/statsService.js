// src/services/statsService.js
import { db } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  documentId,
  startAt,
  endAt,
  limit as qLimit,
} from "firebase/firestore";

/**
 * Conventions:
 * - stats_daily/{YYYY-MM-DD}
 * - stats_terms/{year}_T{termNo}
 * - classes/{classId}/term_stats/{year}_T{termNo}
 */

export function toDateId(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function termId(year, termNo) {
  return `${String(year).trim()}_T${Number(termNo)}`;
}

export async function getDailyStats(dateId) {
  if (!dateId) return null;
  const ref = doc(db, "stats_daily", dateId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * List stats_daily docs by documentId() range.
 * This requires your doc IDs to be sortable strings like YYYY-MM-DD.
 *
 * @param {string} fromDateId e.g. "2026-01-01"
 * @param {string} toDateId   e.g. "2026-01-11"
 * @param {number} maxDocs default 60
 */
export async function listDailyStatsByDateRange(fromDateId, toDateId, maxDocs = 60) {
  if (!fromDateId || !toDateId) return [];

  const col = collection(db, "stats_daily");

  // docId ordering works because YYYY-MM-DD lexicographically sorts correctly
  const q = query(
    col,
    orderBy(documentId()),
    startAt(fromDateId),
    endAt(toDateId),
    qLimit(maxDocs)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTermStats(year, termNo) {
  if (!year || !termNo) return null;
  const id = termId(year, termNo);
  const ref = doc(db, "stats_terms", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Class-term ranking/analytics doc.
 * Path: classes/{classId}/term_stats/{year}_T{termNo}
 */
export async function getClassTermStats(classId, year, termNo) {
  if (!classId || !year || !termNo) return null;
  const id = termId(year, termNo);
  const ref = doc(db, "classes", classId, "term_stats", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Convenience: returns {labels, series} arrays for charts.
 * You can feed these into any chart lib you choose later.
 */
export function buildDailyTrendSeries(dailyStatsRows = []) {
  const rows = [...dailyStatsRows].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const labels = rows.map((r) => r.id);

  const teacherPresent = rows.map((r) => Number(r?.teacherAttendance?.present ?? 0));
  const teacherLate = rows.map((r) => Number(r?.teacherAttendance?.late ?? 0));
  const teacherPenalties = rows.map((r) => Number(r?.teacherAttendance?.penalties ?? 0));

  const studentPercent = rows.map((r) => Number(r?.studentAttendance?.percent ?? 0));
  const studentAbsent = rows.map((r) => Number(r?.studentAttendance?.absent ?? 0));

  const bursaryGrand = rows.map((r) => Number(r?.bursary?.grand ?? 0));
  const bursaryPayments = rows.map((r) => Number(r?.bursary?.paymentsCount ?? 0));

  return {
    labels,
    series: {
      teacherPresent,
      teacherLate,
      teacherPenalties,
      studentPercent,
      studentAbsent,
      bursaryGrand,
      bursaryPayments,
    },
  };
}

/**
 * Safe extractor for a class ranking list.
 * Expected: { ranking: [{studentId, studentName, total, position}, ...] }
 */
export function getRankingRows(classTermStats) {
  const arr = Array.isArray(classTermStats?.ranking) ? classTermStats.ranking : [];
  // Ensure numeric total + position
  return arr
    .map((r) => ({
      studentId: r.studentId || "",
      studentName: r.studentName || "",
      total: Number(r.total ?? 0),
      position: Number(r.position ?? 0),
    }))
    .sort((a, b) => a.position - b.position);
}
