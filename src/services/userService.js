import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export async function ensureUserProfile({ uid, email, fullName, address, contact }) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (snap.exists()) return snap.data();

  const payload = {
    email: email ?? "",
    fullName: fullName ?? "",
    address: address ?? "",
    contact: contact ?? "",

    role: "TEACHER",
    baseMonthlySalary: 0, // required by rules; admin will update later

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload);
  return payload;
}
