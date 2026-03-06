import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";

export async function getPreschoolReport({ classId, studentId, reportId }) {
  const ref = doc(db, "classes", classId, "students", studentId, "reports", reportId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createPreschoolReport({ classId, studentId, reportId, payload }) {
  const ref = doc(db, "classes", classId, "students", studentId, "reports", reportId);

  await setDoc(ref, {
    ...payload,
    type: "PRESCHOOL",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return true;
}

export async function updatePreschoolReport({ classId, studentId, reportId, patch }) {
  const ref = doc(db, "classes", classId, "students", studentId, "reports", reportId);

  await updateDoc(ref, {
    ...patch,
    updatedAt: serverTimestamp(),
  });

  return true;
}
