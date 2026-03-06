import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Ensure the school/main config doc exists with sensible defaults.
 * No longer generates daily codes (see dailyCodeService for per-user codes).
 */
export async function ensureSchoolConfig(adminUid) {
  const ref = doc(db, "school", "main");
  const snap = await getDoc(ref);

  const base = {
    lateAfterMinutes: 375,      // 06:15
    codeExpiresMinutes: 380,    // 06:20
    penaltyPerLate: 5,
    currency: "GHS",
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      name: "Greenidge",
      ...base,
      updatedBy: adminUid,
      updatedAt: serverTimestamp(),
    });
    return { name: "Greenidge", ...base };
  }

  return { ...base, ...snap.data() };
}

export async function getSchoolConfig() {
  const ref = doc(db, "school", "main");
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Missing school/main config in Firestore.");
  return snap.data();
}
