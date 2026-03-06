import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export async function addStudentToClass({ fullName, classId }) {
  const payload = {
    fullName,
    classId,
    status: "ACTIVE",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await addDoc(collection(db, "students"), payload);
}
