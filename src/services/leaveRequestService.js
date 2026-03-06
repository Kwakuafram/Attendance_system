// src/services/leaveRequestService.js
//
// Leave Request System: teachers can request leave in advance,
// admin approves/denies. Replaces the blocking workflow for planned absences.
//

import { db } from "../firebase";
import {
  collection,
  doc,
  addDoc,

  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Leave types.
 */
export const LEAVE_TYPES = [
  { value: "SICK", label: "Sick Leave" },
  { value: "PERSONAL", label: "Personal Leave" },
  { value: "FAMILY", label: "Family Emergency" },
  { value: "FUNERAL", label: "Funeral / Bereavement" },
  { value: "MATERNITY", label: "Maternity / Paternity" },
  { value: "OTHER", label: "Other" },
];

/**
 * Create a leave request (teacher submits).
 *
 * @param {Object} params
 * @param {string} params.teacherId - Teacher's UID
 * @param {string} params.teacherName - Teacher's display name
 * @param {string} params.leaveType - SICK | PERSONAL | FAMILY | FUNERAL | MATERNITY | OTHER
 * @param {string} params.startDate - YYYY-MM-DD
 * @param {string} params.endDate - YYYY-MM-DD
 * @param {string} params.reason - Explanation text
 */
export async function createLeaveRequest({
  teacherId,
  teacherName = "",
  leaveType,
  startDate,
  endDate,
  reason,
}) {
  if (!teacherId) throw new Error("Teacher ID is required.");
  if (!leaveType) throw new Error("Select a leave type.");
  if (!startDate || !endDate) throw new Error("Start and end dates are required.");
  if (!reason?.trim()) throw new Error("Please provide a reason.");
  if (startDate > endDate) throw new Error("End date must be after start date.");

  return addDoc(collection(db, "leave_requests"), {
    teacherId,
    teacherName,
    leaveType,
    startDate,
    endDate,
    reason: reason.trim(),
    status: "PENDING", // PENDING → APPROVED → REJECTED
    adminResponse: "",
    respondedBy: null,
    respondedAt: null,
    createdAt: serverTimestamp(),
  });
}

/**
 * Get leave requests for a specific teacher.
 */
export async function getTeacherLeaveRequests(teacherId, maxResults = 20) {
  const q = query(
    collection(db, "leave_requests"),
    where("teacherId", "==", teacherId),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get all pending leave requests (admin).
 */
export async function getPendingLeaveRequests() {
  const q = query(
    collection(db, "leave_requests"),
    where("status", "==", "PENDING"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get all leave requests (admin).
 */
export async function getAllLeaveRequests(maxResults = 50) {
  const q = query(
    collection(db, "leave_requests"),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Admin approves a leave request.
 */
export async function approveLeaveRequest(requestId, adminUid, responseNote = "") {
  await updateDoc(doc(db, "leave_requests", requestId), {
    status: "APPROVED",
    adminResponse: responseNote,
    respondedBy: adminUid,
    respondedAt: serverTimestamp(),
  });
}

/**
 * Admin rejects a leave request.
 */
export async function rejectLeaveRequest(requestId, adminUid, responseNote = "") {
  if (!responseNote?.trim()) throw new Error("Please provide a reason for rejection.");
  await updateDoc(doc(db, "leave_requests", requestId), {
    status: "REJECTED",
    adminResponse: responseNote.trim(),
    respondedBy: adminUid,
    respondedAt: serverTimestamp(),
  });
}

/**
 * Delete a leave request (admin or teacher if still pending).
 */
export async function deleteLeaveRequest(requestId) {
  await deleteDoc(doc(db, "leave_requests", requestId));
}

/**
 * Check if a teacher has an approved leave for a given date.
 * Useful to skip absence-checking for that teacher on that day.
 */
export async function hasApprovedLeaveForDate(teacherId, dateStr) {
  const q = query(
    collection(db, "leave_requests"),
    where("teacherId", "==", teacherId),
    where("status", "==", "APPROVED"),
    where("startDate", "<=", dateStr),
  );
  const snap = await getDocs(q);
  // Filter client-side for endDate >= dateStr (Firestore only allows range on one field)
  return snap.docs.some((d) => d.data().endDate >= dateStr);
}
