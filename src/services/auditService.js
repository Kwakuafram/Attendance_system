/**
 * auditService.js – Audit log for admin-visible activity tracking
 *
 * Firestore collection: audit_log
 * Doc shape:
 * {
 *   action:     string   – e.g. "TEACHER_BLOCKED", "LEAVE_APPROVED"
 *   actorId:    string   – uid of the person who did the action
 *   actorName:  string   – display name
 *   targetId:   string?  – uid or doc id of the target
 *   targetName: string?  – display name of the target
 *   details:    string?  – free-form detail
 *   meta:       object?  – any extra payload
 *   createdAt:  serverTimestamp
 * }
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const COL = "audit_log";

// ─── Action constants ───────────────────────────────────────
export const AUDIT_ACTIONS = {
  TEACHER_BLOCKED: "TEACHER_BLOCKED",
  TEACHER_UNBLOCKED: "TEACHER_UNBLOCKED",
  LEAVE_APPROVED: "LEAVE_APPROVED",
  LEAVE_REJECTED: "LEAVE_REJECTED",
  NOTIFICATION_SENT: "NOTIFICATION_SENT",
  CLASS_CREATED: "CLASS_CREATED",
  CLASS_DELETED: "CLASS_DELETED",
  STUDENT_ADDED: "STUDENT_ADDED",
  STUDENT_DELETED: "STUDENT_DELETED",
  TEACHER_CREATED: "TEACHER_CREATED",
  FEE_RECEIPT_ADDED: "FEE_RECEIPT_ADDED",
  ATTENDANCE_SESSION_OPENED: "ATTENDANCE_SESSION_OPENED",
  ATTENDANCE_SESSION_CLOSED: "ATTENDANCE_SESSION_CLOSED",
  PAYROLL_GENERATED: "PAYROLL_GENERATED",
  CHECKIN_APPROVED: "CHECKIN_APPROVED",
  CHECKIN_REJECTED: "CHECKIN_REJECTED",
  BURSARY_PAYMENT_ADDED: "BURSARY_PAYMENT_ADDED",
};

// ─── Write ──────────────────────────────────────────────────

/**
 * Log an action to the audit trail.
 * Safe to call fire-and-forget; does NOT throw on failure.
 */
export async function logAudit({
  action,
  actorId = "",
  actorName = "",
  targetId = "",
  targetName = "",
  details = "",
  meta = {},
}) {
  try {
    await addDoc(collection(db, COL), {
      action,
      actorId,
      actorName,
      targetId,
      targetName,
      details,
      meta,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    // silent – audit should never block the main flow
    console.error("[auditService] logAudit failed:", e);
  }
}

// ─── Read ───────────────────────────────────────────────────

/**
 * Fetch the most recent audit entries (newest first).
 * @param {number} max – max entries to return (default 100)
 */
export async function getRecentAuditLog(max = 100) {
  const q = query(
    collection(db, COL),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch audit entries filtered by action type.
 */
export async function getAuditLogByAction(action, max = 50) {
  const q = query(
    collection(db, COL),
    where("action", "==", action),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch audit entries for a specific actor.
 */
export async function getAuditLogByActor(actorId, max = 50) {
  const q = query(
    collection(db, COL),
    where("actorId", "==", actorId),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch audit entries for a date range.
 */
export async function getAuditLogByDateRange(startDate, endDate, max = 200) {
  const q = query(
    collection(db, COL),
    where("createdAt", ">=", Timestamp.fromDate(startDate)),
    where("createdAt", "<=", Timestamp.fromDate(endDate)),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
