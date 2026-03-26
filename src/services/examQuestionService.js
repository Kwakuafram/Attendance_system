import { db, storage } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

export async function uploadExamQuestion({
  teacherId,
  teacherName,
  classId,
  className,
  subject,
  term,
  academicYear,
  examType,
  title,
  file,
}) {
  if (!teacherId) throw new Error("Teacher ID is required.");
  if (!classId) throw new Error("Class is required.");
  if (!subject?.trim()) throw new Error("Subject is required.");
  if (!term?.trim()) throw new Error("Term is required.");
  if (!academicYear?.trim()) throw new Error("Academic year is required.");
  if (!examType?.trim()) throw new Error("Exam type is required.");
  if (!title?.trim()) throw new Error("Title is required.");
  if (!file) throw new Error("Please choose a file.");

  const safeName = file.name.replace(/\s+/g, "_");
  const storagePath = `exam_questions/${teacherId}/${academicYear}/term_${term}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);
  const fileUrl = await getDownloadURL(storageRef);

  const docRef = await addDoc(collection(db, "exam_questions"), {
    teacherId,
    teacherName: teacherName || "",
    classId,
    className: className || "",
    subject: subject.trim(),
    term: String(term).trim(),
    academicYear: academicYear.trim(),
    examType: examType.trim(),
    title: title.trim(),
    fileName: file.name,
    fileUrl,
    storagePath,
    contentType: file.type || "",
    sizeBytes: file.size || 0,
    uploadedAt: serverTimestamp(),
    uploadedByRole: "TEACHER",
  });

  return docRef;
}

export async function getTeacherExamQuestions(teacherId) {
  const q = query(
    collection(db, "exam_questions"),
    where("teacherId", "==", teacherId),
    orderBy("uploadedAt", "desc")
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAllExamQuestions() {
  const q = query(
    collection(db, "exam_questions"),
    orderBy("uploadedAt", "desc")
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteExamQuestion(questionId, storagePath) {
  if (!questionId) throw new Error("Question ID is required.");
  if (!storagePath) throw new Error("Storage path is required.");

  await deleteObject(ref(storage, storagePath));
  await deleteDoc(doc(db, "exam_questions", questionId));
}