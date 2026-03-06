import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { accraYyyyMmDd } from "../utils/accraTime";

/* helpers */

/** Generate a random 4-digit code (1000-9999). */
function random4Digit() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Generate count unique 4-digit codes. */
function uniqueCodes(count) {
  const codes = new Set();
  while (codes.size < count) codes.add(random4Digit());
  return [...codes];
}

/** Firestore doc ref: dailyCodes/{yyyy-MM-dd} */
function todayRef(date) {
  return doc(db, "dailyCodes", date ?? accraYyyyMmDd());
}

/* public API */

/**
 * Generate unique daily codes for every staff member.
 * @param {string}   adminUid   - the admin who triggered generation
 * @param {{ id: string, fullName?: string }[]} staffList - teacher / non-teacher rows
 * @returns {Promise<Record<string, string>>} map  userId -> code
 */
export async function generateDailyCodesForStaff(adminUid, staffList) {
  const date = accraYyyyMmDd();
  const ref = todayRef(date);

  const codes = uniqueCodes(staffList.length);
  const codesMap = {};
  staffList.forEach((s, i) => {
    codesMap[s.id] = codes[i];
  });

  await setDoc(ref, {
    date,
    codes: codesMap,
    createdBy: adminUid,
    createdAt: serverTimestamp(),
  });

  return codesMap;
}

/**
 * Get the full codes document for today (admin / bursary view).
 * Returns null if no codes have been generated yet.
 */
export async function getTodayDailyCodes() {
  const ref = todayRef();
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data(); // { date, codes: { uid: "1234", ... }, createdBy, createdAt }
}

/**
 * Get a single user's daily code for today.
 * Used by attendanceService during check-in validation.
 * @param {string} uid
 * @returns {Promise<string|null>}
 */
export async function getUserDailyCode(uid) {
  const ref = todayRef();
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const codes = snap.data().codes ?? {};
  return codes[uid] ?? null;
}
