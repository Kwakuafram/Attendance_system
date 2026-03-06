// src/services/smsService.js
//
// SMS / WhatsApp notification queue service.
// Queues messages in Firestore for processing by a backend worker or Cloud Function.
// The actual sending (Twilio, Africa's Talking, Hubtel, etc.) is handled server-side.
//

import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Queue an SMS/WhatsApp message for a parent.
 *
 * @param {Object} params
 * @param {string} params.parentPhone - Phone number (e.g. +233...)
 * @param {string} params.parentName - Parent's name
 * @param {string} params.studentName - Student's name
 * @param {string} params.studentId - Student's doc ID
 * @param {string} params.classId - Class ID
 * @param {string} params.className - Class name
 * @param {string} params.message - The message body
 * @param {string} params.channel - "sms" | "whatsapp"
 * @param {string} params.type - "absence" | "general" | "fee_reminder"
 * @param {string} params.triggeredBy - UID of user who triggered
 */
export async function queueParentMessage({
  parentPhone,
  parentName = "",
  studentName,
  studentId = "",
  classId = "",
  className = "",
  message,
  channel = "sms",
  type = "absence",
  triggeredBy = "",
}) {
  if (!parentPhone || !message) throw new Error("Phone and message are required.");

  return addDoc(collection(db, "sms_queue"), {
    parentPhone,
    parentName,
    studentName,
    studentId,
    classId,
    className,
    message,
    channel, // "sms" or "whatsapp"
    type,
    triggeredBy,
    status: "PENDING", // PENDING → SENT → FAILED
    createdAt: serverTimestamp(),
    sentAt: null,
    error: null,
  });
}

/**
 * Queue an absence alert for a student.
 */
export async function queueAbsenceAlert({
  parentPhone,
  parentName,
  studentName,
  studentId,
  classId,
  className,
  date,
  channel = "sms",
  triggeredBy = "",
}) {
  const message =
    `Dear ${parentName || "Parent"}, this is to inform you that your ward ${studentName} ` +
    `was absent from school on ${date}. ` +
    `Please contact the school for more information. — ${className || "School Admin"}`;

  return queueParentMessage({
    parentPhone,
    parentName,
    studentName,
    studentId,
    classId,
    className,
    message,
    channel,
    type: "absence",
    triggeredBy,
  });
}

/**
 * Queue a fee reminder for a student.
 */
export async function queueFeeReminder({
  parentPhone,
  parentName,
  studentName,
  studentId,
  classId,
  className,
  amountOwed,
  currency = "GHS",
  channel = "sms",
  triggeredBy = "",
}) {
  const message =
    `Dear ${parentName || "Parent"}, this is a gentle reminder that the outstanding school fee ` +
    `for ${studentName} is ${currency} ${amountOwed}. ` +
    `Please make payment at your earliest convenience. — ${className || "School Admin"}`;

  return queueParentMessage({
    parentPhone,
    parentName,
    studentName,
    studentId,
    classId,
    className,
    message,
    channel,
    type: "fee_reminder",
    triggeredBy,
  });
}

/**
 * Get pending messages in the queue.
 */
export async function getPendingMessages(maxResults = 50) {
  const q = query(
    collection(db, "sms_queue"),
    where("status", "==", "PENDING"),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get recent messages (all statuses).
 */
export async function getRecentMessages(maxResults = 50) {
  const q = query(
    collection(db, "sms_queue"),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Mark a message as sent.
 */
export async function markMessageSent(messageId) {
  await updateDoc(doc(db, "sms_queue", messageId), {
    status: "SENT",
    sentAt: serverTimestamp(),
  });
}

/**
 * Mark a message as failed.
 */
export async function markMessageFailed(messageId, error = "") {
  await updateDoc(doc(db, "sms_queue", messageId), {
    status: "FAILED",
    error,
  });
}

/**
 * Delete a queued message.
 */
export async function deleteQueuedMessage(messageId) {
  await deleteDoc(doc(db, "sms_queue", messageId));
}
