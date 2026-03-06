import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";

import { db } from "../firebase";
import { accraMinutesFromDate, accraYyyyMmDd } from "../utils/accraTime";
import { accraMonthKey, accraMonthName } from "../utils/month";
import { getSchoolConfig } from "./schoolService";
import { getUserDailyCode } from "./dailyCodeService";

export function attendanceDocId(uid, date = accraYyyyMmDd()) {
  return `${uid}_${date}`;
}

/**
 * Attendance Statuses used:
 * - PENDING_IN: teacher requested check-in; admin must approve/reject
 * - IN_APPROVED: admin approved check-in
 * - REJECTED: admin rejected check-in
 * - PENDING_OUT: teacher requested check-out; admin must approve/reject
 * - OUT_APPROVED: admin approved check-out
 * - REJECTED_OUT: admin rejected check-out
 */

export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  // If missing, create a minimal TEACHER profile (MVP-safe)
  if (!snap.exists()) {
    await setDoc(
      ref,
      {
        role: "TEACHER",
        baseMonthlySalary: 0,
        fullName: "",
        contact: "",
        address: "",
        email: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const snap2 = await getDoc(ref);
    return snap2.exists() ? snap2.data() : null;
  }

  return snap.data();
}

export async function getTodayAttendance(uid) {
  const date = accraYyyyMmDd();
  const id = attendanceDocId(uid, date);
  const ref = doc(db, "attendance", id);
  const snap = await getDoc(ref);

  return {
    id,
    date,
    exists: snap.exists(),
    data: snap.exists() ? snap.data() : null,
  };
}

/**
 * Teacher requests check-in (with daily code).
 * - Creates doc if missing.
 * - If already requested and not rejected, no-op.
 * - If previously rejected, allow re-request and reset decision fields.
 */
export async function requestCheckIn(uid, inputCode) {
  const profile = await getUserProfile(uid);
  const school = await getSchoolConfig();

  // Validate against the per-user daily code
  const expectedCode = await getUserDailyCode(uid);
  if (!expectedCode) throw new Error("No daily code generated yet. Ask admin to generate codes.");
  const codeOk = String(inputCode).trim() === String(expectedCode).trim();
  if (!codeOk) throw new Error("Invalid daily code.");

  // compute expiry using school's codeExpiresMinutes (06:20 default)
  const now = new Date();
  const nowMins = accraMinutesFromDate(now);
  const expired = nowMins > Number(school.codeExpiresMinutes ?? 380);

  const date = accraYyyyMmDd();
  const id = attendanceDocId(uid, date);
  const ref = doc(db, "attendance", id);

  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      teacherId: uid,
      teacherName: profile.fullName,
      date,
      monthKey: accraMonthKey(),
      monthName: accraMonthName(),

      // Check-in fields
      checkInRequestedAt: serverTimestamp(),
      checkInCodeUsed: String(inputCode).trim(),
      checkInApprovedAt: null,
      checkInApprovedBy: null,

      // Late logic
      isLate: null,
      latePenalty: null,
      codeExpiredAtRequest: !!expired,

      // Rejection (check-in)
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,

      // Check-out fields (always present for UI consistency)
      checkOutRequestedAt: null,
      checkOutApprovedAt: null,
      checkOutApprovedBy: null,
      checkOutRejectedAt: null,
      checkOutRejectedBy: null,
      checkOutRejectionReason: null,

      // Work duration (computed on checkout approval)
      minutesWorked: null,

      status: "PENDING_IN",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return;
  }

  const data = snap.data();

  // If already requested and not rejected, do nothing (prevents duplicates).
  // Allow re-request ONLY if admin previously rejected.
  if (data.checkInRequestedAt && data.status !== "REJECTED") return;

  await updateDoc(ref, {
    // Re-request check-in
    checkInRequestedAt: serverTimestamp(),
    checkInCodeUsed: String(inputCode).trim(),
    status: "PENDING_IN",
    codeExpiredAtRequest: !!expired,

    // Reset check-in admin decision fields when re-requesting
    checkInApprovedAt: null,
    checkInApprovedBy: null,
    isLate: null,
    latePenalty: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,

    // Reset checkout section too (safe; ensures clean day state)
    checkOutRequestedAt: null,
    checkOutApprovedAt: null,
    checkOutApprovedBy: null,
    checkOutRejectedAt: null,
    checkOutRejectedBy: null,
    checkOutRejectionReason: null,
    minutesWorked: null,

    updatedAt: serverTimestamp(),
  });
}

// Admin lists pending check-in requests for today
export async function adminListPendingCheckIns(date = accraYyyyMmDd()) {
  const q = query(
    collection(db, "attendance"),
    where("date", "==", date),
    where("status", "==", "PENDING_IN")
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Admin approves check-in and computes late + penalty
export async function adminApproveCheckIn(attendanceId, adminUid) {
  const school = await getSchoolConfig();
  const lateAfterMinutes = school.lateAfterMinutes ?? 375; // 06:15
  const penaltyPerLate = school.penaltyPerLate ?? 5;

  const ref = doc(db, "attendance", attendanceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Attendance doc not found.");

  const data = snap.data();
  if (!data.checkInRequestedAt)
    throw new Error("Teacher has not requested check-in.");
  if (data.checkInApprovedAt) return; // already approved

  // Use request timestamp (server timestamp) to compute late
  const requestDate = data.checkInRequestedAt.toDate();
  const requestMins = accraMinutesFromDate(requestDate);

  const isLate = requestMins > lateAfterMinutes;
  const latePenalty = isLate ? penaltyPerLate : 0;

  await updateDoc(ref, {
    checkInApprovedAt: serverTimestamp(),
    checkInApprovedBy: adminUid,
    isLate,
    latePenalty,
    status: "IN_APPROVED",
    updatedAt: serverTimestamp(),
  });
}

export async function adminRejectCheckIn(attendanceId, adminUid, reason) {
  const ref = doc(db, "attendance", attendanceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Attendance doc not found.");

  const data = snap.data();
  if (!data.checkInRequestedAt)
    throw new Error("Teacher has not requested check-in.");

  const cleanReason = String(reason || "").trim();
  if (!cleanReason) throw new Error("Rejection reason is required.");

  await updateDoc(ref, {
    rejectedAt: serverTimestamp(),
    rejectedBy: adminUid,
    rejectionReason: cleanReason,

    // ensure approval fields are empty
    checkInApprovedAt: null,
    checkInApprovedBy: null,

    // do not count as late or penalty when rejected
    isLate: false,
    latePenalty: 0,

    status: "REJECTED",
    updatedAt: serverTimestamp(),
  });
}

/**
 * Teacher requests check-out.
 * Requirements:
 * - attendance doc must exist
 * - check-in must be approved (status IN_APPROVED)
 * Behavior:
 * - If already requested and not rejected_out, no-op
 * - If previously rejected_out, allow re-request and reset out decision fields
 */
export async function requestCheckOut(uid) {
  const date = accraYyyyMmDd();
  const id = attendanceDocId(uid, date);
  const ref = doc(db, "attendance", id);
  // Hard rule: allow checkout requests only after 3:00pm GMT (UTC+0)
const now = new Date();
const hh = now.getUTCHours();
const mm = now.getUTCMinutes();
const after3pm = hh > 15 || (hh === 15 && mm >= 0);
if (!after3pm) throw new Error("Checkout opens after 3:00pm GMT.");


  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("No attendance record found for today.");

  const data = snap.data();

  if (data.status !== "IN_APPROVED" && data.status !== "REJECTED_OUT") {
    // If REJECTED_OUT, we allow re-request (since check-in is already approved)
    // If IN_APPROVED, normal request flow
    throw new Error(
      "You must have an approved check-in before requesting checkout."
    );
  }

  // Prevent duplicate requests unless previously rejected
  if (data.checkOutRequestedAt && data.status !== "REJECTED_OUT") return;

  await updateDoc(ref, {
    checkOutRequestedAt: serverTimestamp(),

    // reset out decision fields
    checkOutApprovedAt: null,
    checkOutApprovedBy: null,
    checkOutRejectedAt: null,
    checkOutRejectedBy: null,
    checkOutRejectionReason: null,

    // do not overwrite minutesWorked unless approved later
    minutesWorked: null,

    status: "PENDING_OUT",
    updatedAt: serverTimestamp(),
  });
}

// Admin lists pending check-out requests for today
export async function adminListPendingCheckOuts(date = accraYyyyMmDd()) {
  const q = query(
    collection(db, "attendance"),
    where("date", "==", date),
    where("status", "==", "PENDING_OUT")
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Admin approves check-out and computes minutes worked.
 * - minutesWorked uses local "now" vs stored checkInApprovedAt because serverTimestamp is not resolvable immediately.
 * - Stores checkOutApprovedAt as serverTimestamp.
 */
export async function adminApproveCheckOut(attendanceId, adminUid) {
  const ref = doc(db, "attendance", attendanceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Attendance doc not found.");

  const data = snap.data();

  if (data.status !== "PENDING_OUT") {
    throw new Error("Teacher has not requested checkout.");
  }

  if (!data.checkInApprovedAt) {
    throw new Error("Cannot checkout: check-in is not approved.");
  }

  // Calculate minutes worked from check-in approval to now (approx),
  // approval timestamp is stored as serverTimestamp below.
  const now = new Date();
  const checkInApprovedDate = data.checkInApprovedAt.toDate();
  const minutesWorked = Math.max(
    0,
    Math.round((now.getTime() - checkInApprovedDate.getTime()) / (1000 * 60))
  );

  await updateDoc(ref, {
    checkOutApprovedAt: serverTimestamp(),
    checkOutApprovedBy: adminUid,
    minutesWorked,
    status: "OUT_APPROVED",
    updatedAt: serverTimestamp(),
  });
}

export async function adminRejectCheckOut(attendanceId, adminUid, reason) {
  const ref = doc(db, "attendance", attendanceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Attendance doc not found.");

  const data = snap.data();

  if (data.status !== "PENDING_OUT") {
    throw new Error("No pending checkout request to reject.");
  }

  const cleanReason = String(reason || "").trim();
  if (!cleanReason) throw new Error("Rejection reason is required.");

  await updateDoc(ref, {
    checkOutRejectedAt: serverTimestamp(),
    checkOutRejectedBy: adminUid,
    checkOutRejectionReason: cleanReason,

    // ensure approval fields are empty
    checkOutApprovedAt: null,
    checkOutApprovedBy: null,

    // do not record worked minutes on rejected checkout
    minutesWorked: null,

    status: "REJECTED_OUT",
    updatedAt: serverTimestamp(),
  });
}

// Monthly penalty calculation for a teacher
export async function getMonthlyPenalty(uid, monthKey = accraMonthKey()) {
  const q = query(
    collection(db, "attendance"),
    where("teacherId", "==", uid),
    where("monthKey", "==", monthKey),
    where("isLate", "==", true)
  );

  const snap = await getDocs(q);

  let lateCount = 0;
  let penaltyTotal = 0;

  snap.forEach((d) => {
    const row = d.data();
    lateCount += 1;
    penaltyTotal += Number(row.latePenalty ?? 0);
  });

  const school = await getSchoolConfig();
  const perLate = Number(school.penaltyPerLate ?? 5);

  return {
    monthKey,
    monthName: accraMonthName(),
    lateCount,
    penaltyTotal,
    currency: school.currency ?? "GHS",
    perLate,
  };
}

// Salary view: base salary - penalties
export async function getSalarySummary(uid) {
  const profile = await getUserProfile(uid);
  const base = Number(profile.baseMonthlySalary ?? 0);

  const penalty = await getMonthlyPenalty(uid);
  const net = Math.max(0, base - penalty.penaltyTotal);

  return {
    baseSalary: base,
    netSalary: net,
    ...penalty,
  };
}

export async function getRecentAttendance(uid, days = 14) {
  const q = query(
    collection(db, "attendance"),
    where("teacherId", "==", uid),
    limit(50)
  );

  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // sort locally (expects date like "YYYY-MM-DD")
  rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return rows.slice(0, days);
}

/**
 * Get all attendance records for a teacher in a given month.
 * @param {string} uid - teacher's user id
 * @param {string} monthKey - "YYYY-MM" e.g. "2026-03"
 */
export async function getMonthAttendance(uid, monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate(); // e.g. 31 for March
  const startDate = `${monthKey}-01`;
  const endDate = `${monthKey}-${String(lastDay).padStart(2, "0")}`;

  const q = query(
    collection(db, "attendance"),
    where("teacherId", "==", uid),
    where("date", ">=", startDate),
    where("date", "<=", endDate)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Optional helper for UI:
 * Returns a simple "stage" your UI can use to decide which button to show.
 */
export async function getTodayAttendanceStage(uid) {
  const today = await getTodayAttendance(uid);
  if (!today.exists) return { stage: "NO_RECORD", ...today };

  const status = today.data?.status;

  // Stages your UI can map to actions
  const stage =
    status === "PENDING_IN"
      ? "WAITING_CHECKIN_APPROVAL"
      : status === "IN_APPROVED"
      ? "CAN_REQUEST_CHECKOUT"
      : status === "PENDING_OUT"
      ? "WAITING_CHECKOUT_APPROVAL"
      : status === "OUT_APPROVED"
      ? "DONE"
      : status === "REJECTED"
      ? "CHECKIN_REJECTED"
      : status === "REJECTED_OUT"
      ? "CHECKOUT_REJECTED"
      : "UNKNOWN";

  return { stage, status, ...today };
}
