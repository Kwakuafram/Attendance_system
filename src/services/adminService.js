import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { getSchoolConfig } from "./schoolService";
import { getAccraParts } from "../utils/accraTime";

function minutesSinceMidnightAccra(ts) {
  const d = ts instanceof Timestamp ? ts.toDate() : ts;
  const p = getAccraParts(d);
  return p.hour * 60 + p.minute;
}

function parseHHMM(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export async function approveCheckIn(docId) {
  const adminUid = auth.currentUser?.uid;
  if (!adminUid) throw new Error("Not signed in.");

  const ref = doc(db, "attendance", docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Attendance record not found.");

  const data = snap.data();

  // Require a request first
  if (!data.checkInRequestedAt)
    throw new Error("No check-in request to approve.");

  const school = await getSchoolConfig();
  const perLate = Number(school.penaltyPerLate ?? 5);
  const lateAfter = school.lateAfter ?? "06:15"; // Accra time

  const requestedMins = minutesSinceMidnightAccra(data.checkInRequestedAt);
  const lateAfterMins = parseHHMM(lateAfter);

  const isLate = requestedMins > lateAfterMins;
  const latePenalty = isLate ? perLate : 0;

  await updateDoc(ref, {
    checkInApprovedAt: serverTimestamp(),
    checkInApprovedBy: adminUid,
    isLate,
    latePenalty,
    status: "IN_APPROVED",
    updatedAt: serverTimestamp(),
  });
}
/** Load all teachers (existing users) */
export async function getTeachers() {
  const q = query(
    collection(db, "users"),
    where("role", "==", "TEACHER")
    // You can add orderBy("fullName") if you store it consistently and have indexes
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/** Create class and assign teacher */
export async function createClass({ name, teacherUid }) {
  const teacherSnap = await getDoc(doc(db, "users", teacherUid));
  if (!teacherSnap.exists()) throw new Error("Teacher user not found.");

  const teacher = teacherSnap.data();

  const payload = {
    name: name.trim(),
    teacherUid,
    teacherName: teacher.fullName || teacher.email || "Teacher",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "classes"), payload);
  return ref.id;
}

/** Load all classes */
export async function getClasses() {
  const snap = await getDocs(collection(db, "classes"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Add a student to a class */
export async function addStudentToClass({ classId, fullName }) {
  const payload = {
    fullName: fullName.trim(),
    classId,
    status: "ACTIVE",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "students"), payload);
  return ref.id;
}

/** Get students for a class */
export async function getStudentsByClass(classId) {
  const q = query(collection(db, "students"), where("classId", "==", classId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Delete student (optional but useful for correcting mistakes) */
export async function deleteStudent(studentId) {
  await deleteDoc(doc(db, "students", studentId));
}