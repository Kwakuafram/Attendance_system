import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export async function createClass({ name, teacher }) {
  const payload = {
    name,
    teacherUid: teacher.uid,
    teacherName: teacher.fullName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "classes"), payload);
  return ref.id;
}
