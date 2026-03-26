import { db, storage } from "../firebase";
import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// ══════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════

export const EXAM_STATUSES = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  NEEDS_CORRECTION: "NEEDS_CORRECTION",
};

export const EXAM_TYPES = ["End of Term", "Mid-Term", "Class Test", "Mock"];

export const LEVEL_GROUPS = {
  PRESCHOOL: "PRESCHOOL",
  BASIC: "BASIC",
};

export const PRESCHOOL_SUBJECTS = [
  "Numeracy", "Literacy", "Creative Arts", "Our World Our People",
  "Phonics", "Writing", "Science",
];

export const BASIC_SUBJECTS = [
  "English", "Mathematics", "Integrated Science",
  "Our World Our People", "Religious & Moral Education",
  "Information Comm. Technology", "Creative Art",
  "Akuapem Twi", "French", "History",
];

export const INPUT_MODES = {
  UPLOAD: "upload",
  TYPED: "typed",
};

export const SECTION_TYPES = {
  MCQ: "mcq",
  SHORT_ANSWER: "short_answer",
  COMPOSITION: "composition",
  COMPREHENSION: "comprehension",
  PRESCHOOL_ACTIVITY: "preschool_activity",
};

export const PRESCHOOL_ACTIVITY_TYPES = {
  TRACE: "trace",
  COLOUR: "colour",
  BLANK_SPACE: "blank_space",
  IDENTIFY: "identify",
  MATCH: "match",
};

// Section templates per level
export const BASIC_SECTIONS = [
  { section: "A", type: SECTION_TYPES.MCQ, label: "Section A – Objectives", layout: "two_column" },
  { section: "B", type: SECTION_TYPES.COMPOSITION, label: "Section B – Essay / Composition", layout: "full_width" },
  { section: "C", type: SECTION_TYPES.COMPREHENSION, label: "Section C – Comprehension", layout: "full_width" },
];

export const PRESCHOOL_SECTIONS = [
  { section: "A", type: SECTION_TYPES.PRESCHOOL_ACTIVITY, label: "Questions", layout: "full_width" },
];

// ══════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════

export function getSubjectsForLevel(levelGroup) {
  return levelGroup === LEVEL_GROUPS.PRESCHOOL
    ? PRESCHOOL_SUBJECTS
    : BASIC_SUBJECTS;
}

export function getSectionsForLevel(levelGroup) {
  return levelGroup === LEVEL_GROUPS.PRESCHOOL
    ? PRESCHOOL_SECTIONS
    : BASIC_SECTIONS;
}

function emptyMCQ(num = 1) {
  return {
    questionNumber: num,
    type: SECTION_TYPES.MCQ,
    question: "",
    options: ["", "", "", ""],
    answer: "",
    marks: 1,
  };
}

function emptyShortAnswer(num = 1) {
  return {
    questionNumber: num,
    type: SECTION_TYPES.SHORT_ANSWER,
    question: "",
    answer: "",
    marks: 2,
  };
}

function emptyComposition() {
  return {
    type: SECTION_TYPES.COMPOSITION,
    prompt: "",
    instructions: "",
    marks: 20,
  };
}

function emptyComprehension() {
  return {
    type: SECTION_TYPES.COMPREHENSION,
    passage: "",
    questions: [{ questionNumber: 1, question: "", answer: "", marks: 2 }],
  };
}

function emptyPreschoolActivity(num = 1) {
  return {
    questionNumber: num,
    type: SECTION_TYPES.PRESCHOOL_ACTIVITY,
    activityType: PRESCHOOL_ACTIVITY_TYPES.COLOUR,
    instruction: "",
    imageDescription: "",
    traceContent: "",
    answerLabel: "",
    matchPairs: [],
    marks: 5,
  };
}

export function buildBlankSection(sectionTemplate) {
  const base = {
    section: sectionTemplate.section,
    type: sectionTemplate.type,
    label: sectionTemplate.label,
    layout: sectionTemplate.layout,
    questions: [],
  };

  switch (sectionTemplate.type) {
    case SECTION_TYPES.MCQ:
      base.questions = Array.from({ length: 5 }, (_, i) => emptyMCQ(i + 1));
      break;
    case SECTION_TYPES.SHORT_ANSWER:
      base.questions = Array.from({ length: 3 }, (_, i) => emptyShortAnswer(i + 1));
      break;
    case SECTION_TYPES.COMPOSITION:
      base.questions = [emptyComposition()];
      break;
    case SECTION_TYPES.COMPREHENSION:
      base.questions = [emptyComprehension()];
      break;
    case SECTION_TYPES.PRESCHOOL_ACTIVITY:
      base.questions = Array.from({ length: 5 }, (_, i) => emptyPreschoolActivity(i + 1));
      break;
  }

  return base;
}

export function buildBlankExamSections(levelGroup) {
  return getSectionsForLevel(levelGroup).map(buildBlankSection);
}

// Factory for adding new questions
export function createBlankQuestion(type, num = 1) {
  switch (type) {
    case SECTION_TYPES.MCQ: return emptyMCQ(num);
    case SECTION_TYPES.SHORT_ANSWER: return emptyShortAnswer(num);
    case SECTION_TYPES.COMPOSITION: return emptyComposition();
    case SECTION_TYPES.COMPREHENSION: return emptyComprehension();
    case SECTION_TYPES.PRESCHOOL_ACTIVITY: return emptyPreschoolActivity(num);
    default: return emptyPreschoolActivity(num);
  }
}

// ══════════════════════════════════════════════
// Firestore CRUD – Typed Exams
// ══════════════════════════════════════════════

const EXAMS_COL = "exams";

export async function createExam({
  teacherId,
  teacherName,
  classId,
  className,
  levelGroup,
  subject,
  term,
  academicYear,
  examType,
  inputMode,
  sections,
}) {
  const docRef = await addDoc(collection(db, EXAMS_COL), {
    teacherId,
    teacherName: teacherName || "",
    classId: classId || "",
    className: className || "",
    levelGroup,
    subject: subject.trim(),
    term: String(term).trim(),
    academicYear: academicYear.trim(),
    examType: examType.trim(),
    inputMode,
    sections: sections || [],
    status: EXAM_STATUSES.DRAFT,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateExamSections(examId, sections) {
  await updateDoc(doc(db, EXAMS_COL, examId), {
    sections,
    updatedAt: serverTimestamp(),
  });
}

export async function submitExam(examId) {
  await updateDoc(doc(db, EXAMS_COL, examId), {
    status: EXAM_STATUSES.SUBMITTED,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getExam(examId) {
  const snap = await getDoc(doc(db, EXAMS_COL, examId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getTeacherExams(teacherId) {
  const q = query(
    collection(db, EXAMS_COL),
    where("teacherId", "==", teacherId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteExam(examId) {
  await deleteDoc(doc(db, EXAMS_COL, examId));
}

// ══════════════════════════════════════════════
// Firestore CRUD – File Upload Exams
// ══════════════════════════════════════════════

export async function uploadExamFile({
  teacherId,
  teacherName,
  classId,
  className,
  levelGroup,
  subject,
  term,
  academicYear,
  examType,
  file,
}) {
  if (!file) throw new Error("Please choose a file.");

  const safeName = file.name.replace(/\s+/g, "_");
  const storagePath = `exams/${teacherId}/${academicYear}/term_${term}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);
  const fileUrl = await getDownloadURL(storageRef);

  const docRef = await addDoc(collection(db, EXAMS_COL), {
    teacherId,
    teacherName: teacherName || "",
    classId: classId || "",
    className: className || "",
    levelGroup,
    subject: subject.trim(),
    term: String(term).trim(),
    academicYear: academicYear.trim(),
    examType: examType.trim(),
    inputMode: INPUT_MODES.UPLOAD,
    fileName: file.name,
    fileUrl,
    storagePath,
    contentType: file.type || "",
    sizeBytes: file.size || 0,
    sections: [],
    status: EXAM_STATUSES.SUBMITTED,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    submittedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function deleteExamWithFile(examId, storagePath) {
  if (storagePath) {
    try { await deleteObject(ref(storage, storagePath)); } catch { /* file may already be deleted */ }
  }
  await deleteDoc(doc(db, EXAMS_COL, examId));
}

// ══════════════════════════════════════════════
// Admin Exam Review
// ══════════════════════════════════════════════

export async function getAllSubmittedExams() {
  const q = query(
    collection(db, EXAMS_COL),
    where("status", "in", [
      EXAM_STATUSES.SUBMITTED,
      EXAM_STATUSES.UNDER_REVIEW,
      EXAM_STATUSES.NEEDS_CORRECTION,
    ]),
    orderBy("submittedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAllExams() {
  const q = query(
    collection(db, EXAMS_COL),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function reviewExam(examId, { status, adminComment }) {
  const update = {
    status,
    adminComment: adminComment || "",
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, EXAMS_COL, examId), update);
}

export async function approveExam(examId, comment = "") {
  return reviewExam(examId, { status: EXAM_STATUSES.APPROVED, adminComment: comment });
}

export async function rejectExam(examId, comment = "") {
  return reviewExam(examId, { status: EXAM_STATUSES.REJECTED, adminComment: comment });
}

export async function requestCorrection(examId, comment = "") {
  return reviewExam(examId, { status: EXAM_STATUSES.NEEDS_CORRECTION, adminComment: comment });
}
