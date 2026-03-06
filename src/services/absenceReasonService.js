/**
 * Absence Reason & Teacher Blocking Service
 *
 * Flow:
 * 1. Each school day, if a teacher didn't check-in OR didn't check-out the
 *    previous working day, they are prompted to provide a reason.
 * 2. If they don't provide a reason, they get BLOCKED.
 * 3. A blocked teacher cannot use the dashboard — they must contact admin.
 * 4. Admin can view blocked teachers, read their absence history, and unblock.
 *
 * Collections used:
 *   - users/{uid}                → isBlocked, blockedAt, blockedReason
 *   - absence_reasons/{docId}    → teacher's submitted reasons for missed days
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  orderBy,
  limit,
} from "firebase/firestore";

import { db } from "../firebase";
import { accraYyyyMmDd } from "../utils/accraTime";
import { isSchoolDay } from "../utils/ghanaHolidays";

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Get the previous school day (skip Sat, Sun, AND Ghana public holidays).
 */
function getPreviousWorkday(dateStr = accraYyyyMmDd()) {
  const d = new Date(dateStr + "T12:00:00Z"); // noon UTC to avoid timezone edge
  for (;;) {
    d.setUTCDate(d.getUTCDate() - 1);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const check = `${yyyy}-${mm}-${dd}`;
    if (isSchoolDay(check)) {
      return check;
    }
  }
}

/** Build the attendance doc ID the same way as attendanceService. */
function attendanceDocId(uid, date) {
  return `${uid}_${date}`;
}

// ─── Check if teacher missed attendance yesterday ──────────────────────────

/**
 * Returns { missed: true/false, missedDate, missedType }
 * missedType: "NO_CHECKIN" | "NO_CHECKOUT" | null
 *
 * A teacher "missed" if:
 *  - No attendance doc at all for prev workday → NO_CHECKIN
 *  - Attendance doc exists but status never reached OUT_APPROVED → NO_CHECKOUT
 */
export async function checkMissedAttendance(uid) {
  const today = accraYyyyMmDd();

  // Don't check on weekends or holidays — teachers aren't expected to attend
  if (!isSchoolDay(today)) {
    return { missed: false, missedDate: null, missedType: null, isNonSchoolDay: true };
  }

  const prevDay = getPreviousWorkday(today);

  const id = attendanceDocId(uid, prevDay);
  const ref = doc(db, "attendance", id);
  const snap = await getDoc(ref);

  // Already submitted a reason for this date?
  const reasonRef = doc(db, "absence_reasons", `${uid}_${prevDay}`);
  const reasonSnap = await getDoc(reasonRef);
  if (reasonSnap.exists()) {
    return { missed: false, missedDate: prevDay, missedType: null, reasonAlreadySubmitted: true };
  }

  if (!snap.exists()) {
    // No record at all → didn't check in
    return { missed: true, missedDate: prevDay, missedType: "NO_CHECKIN" };
  }

  const data = snap.data();
  const status = data.status || "";

  // If check-in was approved but no checkout approved → missed checkout
  if (status === "IN_APPROVED") {
    return { missed: true, missedDate: prevDay, missedType: "NO_CHECKOUT" };
  }

  // If status is still pending or rejected (never got approved at all)
  if (
    status === "PENDING_IN" ||
    status === "REJECTED" ||
    status === "NOT_REQUESTED"
  ) {
    return { missed: true, missedDate: prevDay, missedType: "NO_CHECKIN" };
  }

  // PENDING_OUT or REJECTED_OUT → checkout was requested but never approved
  if (status === "PENDING_OUT" || status === "REJECTED_OUT") {
    return { missed: true, missedDate: prevDay, missedType: "NO_CHECKOUT" };
  }

  // OUT_APPROVED → teacher completed the full day
  return { missed: false, missedDate: prevDay, missedType: null };
}

// ─── Submit absence reason ─────────────────────────────────────────────────

/**
 * Teacher submits a reason for missing check-in or checkout on a given date.
 * docId = `{uid}_{date}` to prevent duplicate submissions.
 */
export async function submitAbsenceReason(uid, { date, reason, missedType }) {
  const cleanReason = String(reason || "").trim();
  if (!cleanReason) throw new Error("Reason is required.");
  if (cleanReason.length < 5) throw new Error("Please provide a more detailed reason (at least 5 characters).");

  const docId = `${uid}_${date}`;
  const ref = doc(db, "absence_reasons", docId);

  await setDoc(ref, {
    teacherId: uid,
    date,
    missedType: missedType || "UNKNOWN",
    reason: cleanReason,
    submittedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
}

// ─── Block / Unblock teacher ───────────────────────────────────────────────

/**
 * Block a teacher (sets isBlocked = true on their user doc).
 * Can be called automatically when they fail to provide a reason,
 * or manually by admin.
 */
export async function blockTeacher(uid, reason = "No absence reason provided") {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, {
    isBlocked: true,
    blockedAt: serverTimestamp(),
    blockedReason: reason,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Unblock a teacher (admin action).
 */
export async function unblockTeacher(uid) {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, {
    isBlocked: false,
    blockedAt: null,
    blockedReason: null,
    unblockedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Check if a teacher is currently blocked.
 */
export async function checkTeacherBlocked(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { blocked: false };
  const data = snap.data();
  return {
    blocked: !!data.isBlocked,
    blockedAt: data.blockedAt || null,
    blockedReason: data.blockedReason || "",
  };
}

// ─── Admin: list blocked teachers ──────────────────────────────────────────

export async function getBlockedTeachers() {
  const q = query(
    collection(db, "users"),
    where("isBlocked", "==", true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

// ─── Admin: get absence reasons for a teacher ──────────────────────────────

export async function getTeacherAbsenceReasons(uid, maxRows = 30) {
  const q = query(
    collection(db, "absence_reasons"),
    where("teacherId", "==", uid),
    orderBy("date", "desc"),
    limit(maxRows)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── Admin: get ALL recent absence reasons ─────────────────────────────────

export async function getAllRecentAbsenceReasons(maxRows = 50) {
  const q = query(
    collection(db, "absence_reasons"),
    orderBy("date", "desc"),
    limit(maxRows)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
