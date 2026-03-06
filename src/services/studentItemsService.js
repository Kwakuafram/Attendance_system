import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export const ITEM_KEYS = ["bleach", "antiseptic", "detergent", "serum", "soap"];

export async function setStudentItemReceived({
  classId,
  studentId,
  itemKey,
  received,
  teacherUid,
}) {
  if (!ITEM_KEYS.includes(itemKey)) {
    throw new Error(`Invalid itemKey: ${itemKey}`);
  }

  const ref = doc(db, "classes", classId, "students", studentId);

  const patch = {
    [`items.${itemKey}.received`]: !!received,
    [`items.${itemKey}.receivedAt`]: received ? serverTimestamp() : null,
    [`items.${itemKey}.receivedBy`]: received ? teacherUid : null,
    [`items.${itemKey}.updatedAt`]: serverTimestamp(),
  };

  await updateDoc(ref, patch);
}
