// src/services/notificationService.js
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
  setDoc,
} from "firebase/firestore";

/* ─── FCM Token Management ─── */

/**
 * Save the user's FCM token to Firestore so admin can target them.
 */
export async function saveFcmToken(uid, token) {
  if (!uid || !token) return;
  const ref = doc(db, "fcm_tokens", uid);
  await setDoc(ref, { uid, token, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Remove user's FCM token (on sign-out).
 */
export async function removeFcmToken(uid) {
  if (!uid) return;
  try {
    await deleteDoc(doc(db, "fcm_tokens", uid));
  } catch {
    // ignore
  }
}

/**
 * Get all registered FCM tokens (admin use).
 */
export async function getAllFcmTokens() {
  const snap = await getDocs(collection(db, "fcm_tokens"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ─── In-App Notifications ─── */

/**
 * Create a notification for a specific user (or broadcast).
 *   type: "check_in_approved" | "check_in_rejected" | "blocked" | "announcement" | "leave_response"
 */
export async function createNotification({
  recipientId,
  type,
  title,
  body,
  data = {},
}) {
  return addDoc(collection(db, "notifications"), {
    recipientId: recipientId || "ALL", // "ALL" = broadcast
    type: type || "announcement",
    title,
    body,
    data,
    read: false,
    createdAt: serverTimestamp(),
  });
}

/**
 * Send a broadcast notification to all staff.
 */
export async function sendBroadcastNotification({ title, body }) {
  return createNotification({
    recipientId: "ALL",
    type: "announcement",
    title,
    body,
  });
}

/**
 * Send notification to a specific user.
 */
export async function sendUserNotification({ recipientId, type, title, body, data }) {
  return createNotification({ recipientId, type, title, body, data });
}

/**
 * Get notifications for a user (includes broadcasts).
 * Returns most recent first, limited.
 */
export async function getUserNotifications(uid, maxResults = 30) {
  // User-specific
  const q1 = query(
    collection(db, "notifications"),
    where("recipientId", "==", uid),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );

  // Broadcasts
  const q2 = query(
    collection(db, "notifications"),
    where("recipientId", "==", "ALL"),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  const all = [
    ...snap1.docs.map((d) => ({ id: d.id, ...d.data() })),
    ...snap2.docs.map((d) => ({ id: d.id, ...d.data() })),
  ];

  // De-duplicate and sort by createdAt desc
  const seen = new Set();
  const unique = [];
  for (const n of all) {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      unique.push(n);
    }
  }
  unique.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? 0;
    return tb - ta;
  });

  return unique.slice(0, maxResults);
}

/**
 * Get unread count for a user.
 */
export async function getUnreadCount(uid) {
  const notifications = await getUserNotifications(uid, 50);
  return notifications.filter((n) => !n.read).length;
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(notificationId) {
  await updateDoc(doc(db, "notifications", notificationId), { read: true });
}

/**
 * Mark all notifications for a user as read.
 */
export async function markAllRead(uid) {
  const notifications = await getUserNotifications(uid, 100);
  const unread = notifications.filter((n) => !n.read);
  const promises = unread.map((n) =>
    updateDoc(doc(db, "notifications", n.id), { read: true })
  );
  await Promise.all(promises);
}

/**
 * Delete a notification.
 */
export async function deleteNotification(notificationId) {
  await deleteDoc(doc(db, "notifications", notificationId));
}

/**
 * Admin: get all notifications (most recent).
 */
export async function getAllNotifications(maxResults = 50) {
  const q = query(
    collection(db, "notifications"),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
