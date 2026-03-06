import {
  collection,
  doc,
  getDocs,
  query,
  where,
  getDoc,
  writeBatch,
  serverTimestamp,
  setDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

function dateKey(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function getTeacherClass(teacherUid) {
  const q = query(collection(db, "classes"), where("teacherUid", "==", teacherUid));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("No class assigned to this teacher.");
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// UPDATED: students are now under classes/{classId}/students
export async function getStudentsForClass(classId) {
  const snap = await getDocs(collection(db, "classes", classId, "students"));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || "")));
  return rows;
}

export async function getTodayAbsenceIds(sessionId) {
  try {
    const sessionRef = doc(db, "attendance_sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) return new Set();

    const absCol = collection(db, "attendance_sessions", sessionId, "absent");
    const snap = await getDocs(absCol);
    return new Set(snap.docs.map((d) => d.id));
  } catch {
    // Treat blocked/missing reads as "no saved absences yet"
    return new Set();
  }
}


export async function submitTodayClassAttendance({
  teacherUid,
  classId,
  students,
  absentStudentIds,
  absenceReasons = {},
}) {
  const day = dateKey();
  const sessionId = `${classId}_${day}`;

  const totalStudents = students.length;
  const absentCount = absentStudentIds.length;
  const presentCount = totalStudents - absentCount;

  const sessionRef = doc(db, "attendance_sessions", sessionId);

  // ✅ STEP 1: ensure session doc exists FIRST (so subcollection rules pass)
  await setDoc(
    sessionRef,
    {
      date: day,
      classId,
      teacherUid,
      totalStudents,
      absentCount,
      presentCount,
      status: "SUBMITTED",
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Now it's safe to read existing absent docs
  const existingAbsent = await getTodayAbsenceIds(sessionId);

  // ✅ STEP 2: batch absent docs
  const batch = writeBatch(db);

  const nowAbsentSet = new Set(absentStudentIds);

  // Upsert absent docs
  for (const sid of absentStudentIds) {
    const stu = students.find((s) => s.id === sid);
    const absentRef = doc(db, "attendance_sessions", sessionId, "absent", sid);

    batch.set(
      absentRef,
      {
        studentId: sid,
        studentName: stu?.fullName || "—",
        reason: absenceReasons[sid] || "",
        reasonRequested: false,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // Delete absent docs that are no longer absent
  for (const sid of existingAbsent) {
    if (!nowAbsentSet.has(sid)) {
      const absentRef = doc(db, "attendance_sessions", sessionId, "absent", sid);
      batch.delete(absentRef);
    }
  }

  await batch.commit();

  return { sessionId, date: day, totalStudents, presentCount, absentCount };
}

// Load all classes, then fetch today session doc for each class.
// This avoids needing `list` permission on attendance_sessions.
export async function adminGetTodayAttendanceSessionsForAllClasses() {
  const day = dateKey();

  // Admin can read classes
  const classesSnap = await getDocs(collection(db, "classes"));
  const classes = classesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // For each class, fetch today's session doc by ID
  const results = [];
  for (const c of classes) {
    const sessionId = `${c.id}_${day}`;
    const sessionRef = doc(db, "attendance_sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (sessionSnap.exists()) {
      results.push({
        id: sessionSnap.id,
        ...sessionSnap.data(),
        className: c.name || c.id,
        teacherName: c.teacherName || c.teacherUid || "—",
        classId: c.id,
      });
    } else {
      // Not submitted yet
      results.push({
        id: sessionId,
        date: day,
        classId: c.id,
        className: c.name || c.id,
        teacherUid: c.teacherUid || "",
        teacherName: c.teacherName || c.teacherUid || "—",
        totalStudents: 0,
        presentCount: 0,
        absentCount: 0,
        status: "NOT_SUBMITTED",
      });
    }
  }

  // Sort by class name
  results.sort((a, b) => String(a.className).localeCompare(String(b.className)));
  return results;
}

export async function adminGetAbsentList(sessionId) {
  // Admin rules allow read
  const absSnap = await getDocs(collection(db, "attendance_sessions", sessionId, "absent"));
  const rows = absSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => String(a.studentName || "").localeCompare(String(b.studentName || "")));
  return rows;
}

// ══════════════════════════════════════
// History, Stats, Frequent Absentees
// ══════════════════════════════════════

function generateDateKeys(days = 30) {
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(dateKey(d));
  }
  return dates;
}

/**
 * Load attendance sessions for a class for the last N days.
 * Uses direct document reads (no query/index needed).
 */
export async function getClassAttendanceHistory(classId, days = 30) {
  const dates = generateDateKeys(days);

  const results = await Promise.all(
    dates.map(async (date) => {
      const sessionId = `${classId}_${date}`;
      const snap = await getDoc(doc(db, "attendance_sessions", sessionId));
      if (!snap.exists()) return null;
      return { id: snap.id, date, ...snap.data() };
    })
  );

  return results.filter(Boolean);
}

/**
 * Load a single past session + its absent list (for teacher history browser).
 */
export async function getSessionWithAbsent(classId, dateStr) {
  const sessionId = `${classId}_${dateStr}`;
  const sessionRef = doc(db, "attendance_sessions", sessionId);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) return null;

  const absSnap = await getDocs(collection(db, "attendance_sessions", sessionId, "absent"));
  const absentees = absSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  absentees.sort((a, b) => String(a.studentName || "").localeCompare(String(b.studentName || "")));

  return { ...snap.data(), id: snap.id, absentees };
}

/**
 * Compute weekly + monthly attendance summary for a class.
 */
export async function getClassAttendanceSummary(classId) {
  const history = await getClassAttendanceHistory(classId, 30);
  const submitted = history.filter((s) => s.status === "SUBMITTED");

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const sevenKey = dateKey(sevenDaysAgo);

  const weekSessions = submitted.filter((s) => s.date >= sevenKey);
  const monthSessions = submitted;

  function calcRate(sessions) {
    if (!sessions.length) return { rate: 0, present: 0, absent: 0, total: 0, days: 0 };
    const present = sessions.reduce((a, s) => a + (s.presentCount || 0), 0);
    const absent = sessions.reduce((a, s) => a + (s.absentCount || 0), 0);
    const total = present + absent;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { rate, present, absent, total, days: sessions.length };
  }

  return {
    week: calcRate(weekSessions),
    month: calcRate(monthSessions),
    totalSessions: submitted.length,
  };
}

/**
 * Find students absent >= threshold times in the last N days.
 */
export async function getFrequentAbsentees(classId, days = 30, threshold = 3) {
  const history = await getClassAttendanceHistory(classId, days);
  const submitted = history.filter((s) => s.status === "SUBMITTED");
  if (!submitted.length) return [];

  const absentCounts = {};

  const absentLists = await Promise.all(
    submitted.map(async (session) => {
      const absSnap = await getDocs(
        collection(db, "attendance_sessions", session.id, "absent")
      );
      return absSnap.docs;
    })
  );

  for (const docs of absentLists) {
    for (const d of docs) {
      const data = d.data();
      const sid = d.id;
      if (!absentCounts[sid]) {
        absentCounts[sid] = { name: data.studentName || sid, count: 0 };
      }
      absentCounts[sid].count++;
    }
  }

  return Object.entries(absentCounts)
    .filter(([, v]) => v.count >= threshold)
    .map(([id, v]) => ({ studentId: id, studentName: v.name, absentCount: v.count }))
    .sort((a, b) => b.absentCount - a.absentCount);
}

/**
 * Per-student attendance rates for a class over the last N days.
 * Returns Map<studentId, { present, absent, total, rate }>.
 */
export async function getStudentAttendanceRates(classId, studentIds, days = 30) {
  const history = await getClassAttendanceHistory(classId, days);
  const submitted = history.filter((s) => s.status === "SUBMITTED");
  const totalDays = submitted.length;
  if (!totalDays) return new Map();

  const absentCounts = {};
  studentIds.forEach((id) => { absentCounts[id] = 0; });

  const absentLists = await Promise.all(
    submitted.map(async (session) => {
      const absSnap = await getDocs(
        collection(db, "attendance_sessions", session.id, "absent")
      );
      return absSnap.docs;
    })
  );

  for (const docs of absentLists) {
    for (const d of docs) {
      if (absentCounts[d.id] !== undefined) {
        absentCounts[d.id]++;
      }
    }
  }

  const rates = new Map();
  for (const sid of studentIds) {
    const absent = absentCounts[sid] || 0;
    const present = totalDays - absent;
    const rate = Math.round((present / totalDays) * 100);
    rates.set(sid, { present, absent, total: totalDays, rate });
  }
  return rates;
}

/**
 * Admin override: mark a student present or absent in a submitted session.
 */
export async function adminOverrideAttendance(sessionId, studentId, studentName, action) {
  const absentRef = doc(db, "attendance_sessions", sessionId, "absent", studentId);
  const sessionRef = doc(db, "attendance_sessions", sessionId);

  if (action === "MARK_ABSENT") {
    await setDoc(absentRef, {
      studentId,
      studentName,
      reason: "Added by admin",
      adminOverride: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } else {
    // MARK_PRESENT — remove from absent subcollection
    await deleteDoc(absentRef);
  }

  // Recalculate counts
  const absSnap = await getDocs(collection(db, "attendance_sessions", sessionId, "absent"));
  const absentCount = absSnap.size;
  const sessionSnap = await getDoc(sessionRef);
  const totalStudents = sessionSnap.data()?.totalStudents || 0;

  await updateDoc(sessionRef, {
    absentCount,
    presentCount: totalStudents - absentCount,
    adminOverride: true,
    updatedAt: serverTimestamp(),
  });

  return { absentCount, presentCount: totalStudents - absentCount };
}
