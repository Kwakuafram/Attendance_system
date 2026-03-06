/**
 * teacherAssessmentService.js
 *
 * Weekly Teacher Assessment based on:
 *  - Ghana Education Service (GES) National Teachers' Standards (NTS)
 *  - NaCCA Standards-Based Curriculum Framework
 *
 * Firestore collection: teacher_assessments
 * Doc shape: see buildBlankAssessment()
 */

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const COL = "teacher_assessments";

// ═══════════════════════════════════════════════════════════════
// GES / NaCCA Assessment Framework
// ═══════════════════════════════════════════════════════════════

/**
 * Rating scale (GES 4-point scale):
 *  4 = Excellent/Highly Effective
 *  3 = Good/Effective
 *  2 = Satisfactory/Developing
 *  1 = Unsatisfactory/Needs Improvement
 */
export const RATING_SCALE = [
  { value: 4, label: "Excellent",      tag: "Highly Effective", color: "emerald" },
  { value: 3, label: "Good",           tag: "Effective",        color: "sky" },
  { value: 2, label: "Satisfactory",   tag: "Developing",       color: "amber" },
  { value: 1, label: "Unsatisfactory", tag: "Needs Improvement",color: "rose" },
];

/**
 * The 3 GES Professional Domains with NaCCA-aligned criteria.
 * Each criterion has an id, label, description, and GES/NaCCA reference.
 */
export const ASSESSMENT_DOMAINS = [
  {
    id: "professional_knowledge",
    label: "Domain 1: Professional Knowledge",
    description: "Teacher's mastery of subject content, knowledge of learners, and understanding of the NaCCA Standards-Based Curriculum.",
    gesRef: "NTS Domain 1 / NaCCA SBC Framework",
    criteria: [
      {
        id: "content_knowledge",
        label: "Subject Content Knowledge",
        description: "Demonstrates thorough understanding of subject matter; explains concepts accurately; links topics across strands and sub-strands per NaCCA curriculum.",
        gesRef: "NTS 1a",
        indicators: [
          "Explains concepts with clarity and accuracy",
          "Connects lesson content to real-life applications",
          "Demonstrates awareness of common learner misconceptions",
          "Shows mastery across all strands of the subject",
        ],
      },
      {
        id: "knowledge_of_learners",
        label: "Knowledge of Learners",
        description: "Understands learners' diverse needs, developmental stages, prior knowledge, learning styles, and special educational needs (inclusive education).",
        gesRef: "NTS 1b / Inclusive Education Policy",
        indicators: [
          "Identifies learners' prior knowledge before introducing new topics",
          "Differentiates instruction for varied abilities",
          "Shows awareness of learners' socio-cultural backgrounds",
          "Addresses special educational needs appropriately",
        ],
      },
      {
        id: "curriculum_knowledge",
        label: "Knowledge of NaCCA Curriculum",
        description: "Shows clear understanding of the Standards-Based Curriculum: content standards, indicators, exemplars, core competencies, and the 4Rs (Reading, wRiting, aRithmetic, cReativity).",
        gesRef: "NaCCA SBC / NTS 1c",
        indicators: [
          "Aligns lessons to NaCCA content standards and indicators",
          "Uses curriculum exemplars to guide teaching activities",
          "Integrates core competencies (critical thinking, creativity, collaboration, communication, citizenship, digital literacy)",
          "References strand/sub-strand codes in lesson plans",
        ],
      },
      {
        id: "pedagogical_knowledge",
        label: "Pedagogical Content Knowledge",
        description: "Applies appropriate teaching methods for the subject and topic; understands how learners best acquire knowledge in the discipline.",
        gesRef: "NTS 1d",
        indicators: [
          "Uses subject-appropriate teaching strategies",
          "Selects activities that match cognitive demand of the topic",
          "Applies constructivist/learner-centred pedagogy",
          "Scaffolds learning from concrete to abstract",
        ],
      },
    ],
  },
  {
    id: "professional_practice",
    label: "Domain 2: Professional Practice",
    description: "Teacher's ability to plan, deliver, assess, and manage a productive learning environment aligned with GES expectations.",
    gesRef: "NTS Domain 2 / NaCCA Assessment Guidelines",
    criteria: [
      {
        id: "lesson_planning",
        label: "Lesson Planning & Preparation",
        description: "Prepares scheme of work, weekly forecast, and daily lesson plans with clear objectives (SMART), core competencies, key activities, and assessment strategies per NaCCA template.",
        gesRef: "NTS 2a / GES Lesson Plan Template",
        indicators: [
          "Submits weekly lesson plan/forecast on time",
          "Lesson objectives are SMART and linked to NaCCA indicators",
          "Plans include starter, main activity, and plenary/closure",
          "Identifies TLMs and core competencies for each lesson",
        ],
      },
      {
        id: "learning_environment",
        label: "Creating a Learning Environment",
        description: "Establishes a safe, well-organised, inclusive, and stimulating classroom that promotes learner engagement.",
        gesRef: "NTS 2b",
        indicators: [
          "Classroom is clean, organized, and print-rich",
          "Displays learners' work and teaching aids on walls",
          "Seating arrangement supports group/pair work",
          "Creates a psychologically safe and inclusive atmosphere",
        ],
      },
      {
        id: "teaching_learning",
        label: "Teaching & Learning (Lesson Delivery)",
        description: "Delivers learner-centred, activity-based lessons; uses the NaCCA suggested activities and facilitates all 3 phases (Starter → Main → Plenary).",
        gesRef: "NTS 2c / NaCCA Pedagogy Framework",
        indicators: [
          "Begins with engaging starter activity to activate prior knowledge",
          "Uses varied, learner-centred activities (not chalk-and-talk only)",
          "Involves learners actively through group work, discussions, practicals",
          "Manages transitions between lesson phases smoothly",
          "Uses effective questioning techniques (Bloom's taxonomy levels)",
          "Summarises lesson and checks understanding in plenary",
        ],
      },
      {
        id: "use_of_tlms",
        label: "Use of Teaching & Learning Materials (TLMs)",
        description: "Selects, prepares, and effectively uses relevant TLMs – including ICT tools – to enhance understanding.",
        gesRef: "NTS 2d / NaCCA TLM Guidelines",
        indicators: [
          "Uses appropriate TLMs relevant to the topic",
          "TLMs are visible, accessible, and safe for all learners",
          "Integrates ICT where available (projector, phone, laptop)",
          "Encourages learners to interact with TLMs (not just demonstration)",
        ],
      },
      {
        id: "assessment_recording",
        label: "Assessment & Recording",
        description: "Conducts continuous assessment (formative & summative), keeps accurate records, provides timely feedback, and uses NaCCA's assessment guidelines.",
        gesRef: "NTS 2e / NaCCA Assessment Policy / GES SBA",
        indicators: [
          "Conducts formative assessment during and after lessons",
          "Uses varied assessment methods (oral, written, project, practical)",
          "Provides constructive feedback to learners promptly",
          "Maintains up-to-date Continuous Assessment (CA) record book",
          "Follows NaCCA weighting: Class Score (50%) + End-of-Term (50%)",
          "Uses assessment data to inform re-teaching decisions",
        ],
      },
      {
        id: "time_on_task",
        label: "Time on Task / Classroom Management",
        description: "Maximises instructional time, manages learner behaviour positively, and follows the GES time-on-task standards.",
        gesRef: "NTS 2f / GES Time-on-Task Directive",
        indicators: [
          "Starts and ends lessons on time per the timetable",
          "Minimises non-instructional time (transition, settling)",
          "Uses positive behaviour management strategies (no corporal punishment)",
          "All learners are engaged throughout the lesson",
        ],
      },
    ],
  },
  {
    id: "professional_values",
    label: "Domain 3: Professional Values & Attitudes",
    description: "Teacher's professional conduct, ethical behaviour, collaboration, and commitment to continuous improvement.",
    gesRef: "NTS Domain 3 / GES Code of Conduct",
    criteria: [
      {
        id: "punctuality_attendance",
        label: "Punctuality & Regularity",
        description: "Arrives at school and class on time; regular attendance; follows GES reporting time policy.",
        gesRef: "NTS 3a / GES Attendance Policy",
        indicators: [
          "Reports to school by the prescribed time daily",
          "Is in class and ready before lesson period begins",
          "Does not absent without prior notification/approval",
          "Attends all scheduled school activities (assembly, meetings)",
        ],
      },
      {
        id: "professional_appearance",
        label: "Professional Appearance & Conduct",
        description: "Dresses professionally; demonstrates ethical behaviour; serves as a role model for learners.",
        gesRef: "NTS 3b / GES Dress Code",
        indicators: [
          "Dresses appropriately and professionally at all times",
          "Speaks respectfully to learners, colleagues, and parents",
          "Upholds GES Code of Conduct and ethical standards",
          "Avoids inappropriate relationships with learners",
        ],
      },
      {
        id: "collaboration_teamwork",
        label: "Collaboration & Teamwork",
        description: "Works cooperatively with colleagues; participates in professional learning communities (PLCs); supports school activities.",
        gesRef: "NTS 3c",
        indicators: [
          "Participates actively in staff meetings and PLCs",
          "Collaborates with fellow teachers on lesson planning",
          "Contributes to extra-curricular and co-curricular activities",
          "Shares best practices and resources with colleagues",
        ],
      },
      {
        id: "community_engagement",
        label: "Community & Stakeholder Engagement",
        description: "Engages positively with parents, community, and SMC/PTA; communicates learner progress regularly.",
        gesRef: "NTS 3d / GES Parent Engagement",
        indicators: [
          "Communicates regularly with parents about learner progress",
          "Attends PTA/SMC meetings when required",
          "Involves parents/community in school activities",
          "Handles parent concerns professionally and promptly",
        ],
      },
      {
        id: "professional_development",
        label: "Professional Development & Reflective Practice",
        description: "Engages in continuous professional development (CPD); reflects on teaching practice; sets improvement goals.",
        gesRef: "NTS 3e / GES TCPD / NTC Licensing",
        indicators: [
          "Participates in school-based INSET and cluster workshops",
          "Maintains a reflective journal or professional portfolio",
          "Sets termly professional development goals",
          "Applies new knowledge and skills from CPD in the classroom",
          "Pursues NTC license renewal requirements",
        ],
      },
      {
        id: "record_keeping",
        label: "Record Keeping & Documentation",
        description: "Maintains all required professional records: attendance register, scheme of work, lesson notes, CA records, inventory of TLMs.",
        gesRef: "NTS 3f / GES Record-Keeping Standards",
        indicators: [
          "Keeps learner attendance register up to date",
          "Scheme of work is prepared and available for the term",
          "Lesson plan book is consistently maintained",
          "CA record book is complete and accurate",
          "Maintains inventory of TLMs and classroom resources",
        ],
      },
    ],
  },
];

// ─── Helper: build empty assessment object ──────────────────
export function buildBlankAssessment() {
  const ratings = {};
  for (const domain of ASSESSMENT_DOMAINS) {
    for (const criterion of domain.criteria) {
      ratings[criterion.id] = {
        score: 0,       // 0 = not yet rated
        comment: "",
      };
    }
  }
  return ratings;
}

/**
 * Compute totals from a ratings object.
 * Returns { domainScores: { [domainId]: { earned, possible, pct } }, overall: { earned, possible, pct, grade } }
 */
export function computeAssessmentScores(ratings) {
  const domainScores = {};
  let totalEarned = 0;
  let totalPossible = 0;

  for (const domain of ASSESSMENT_DOMAINS) {
    let domainEarned = 0;
    let domainPossible = 0;

    for (const criterion of domain.criteria) {
      const score = ratings?.[criterion.id]?.score || 0;
      domainEarned += score;
      domainPossible += 4; // max per criterion
    }

    domainScores[domain.id] = {
      earned: domainEarned,
      possible: domainPossible,
      pct: domainPossible > 0 ? Math.round((domainEarned / domainPossible) * 100) : 0,
    };

    totalEarned += domainEarned;
    totalPossible += domainPossible;
  }

  const pct = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
  let grade = "Unsatisfactory";
  if (pct >= 90) grade = "Excellent";
  else if (pct >= 70) grade = "Good";
  else if (pct >= 50) grade = "Satisfactory";

  return {
    domainScores,
    overall: { earned: totalEarned, possible: totalPossible, pct, grade },
  };
}

// ─── Week key helper ────────────────────────────────────────
export function currentWeekKey() {
  const now = new Date();
  const year = now.getFullYear();
  // ISO week number
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

// ─── CRUD ────────────────────────────────────────────────────

/**
 * Status lifecycle:
 *  DRAFT     → teacher is still working on it
 *  SUBMITTED → teacher submitted for admin review
 *  REVIEWED  → admin has reviewed and added remarks / adjusted scores
 */
export const ASSESSMENT_STATUS = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  REVIEWED: "REVIEWED",
};

/**
 * Teacher submits their own weekly self-assessment.
 */
export async function saveWeeklyAssessment({
  teacherId,
  teacherName,
  assessorId = "",
  assessorName = "",
  weekKey,
  ratings,
  overallComment = "",
  strengthsObserved = "",
  areasForImprovement = "",
  agreedActionPlan = "",
  status = "SUBMITTED",
}) {
  const scores = computeAssessmentScores(ratings);

  return addDoc(collection(db, COL), {
    teacherId,
    teacherName,
    assessorId,
    assessorName,
    weekKey,
    ratings,
    overallComment,
    strengthsObserved,
    areasForImprovement,
    agreedActionPlan,
    status,
    // Admin review fields (filled later by admin)
    adminRatings: null,
    adminComment: "",
    adminStrengths: "",
    adminAreasForImprovement: "",
    adminActionPlan: "",
    reviewedById: "",
    reviewedByName: "",
    reviewedAt: null,
    ...scores.overall,
    domainScores: scores.domainScores,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update an existing assessment (teacher editing draft or resubmitting).
 */
export async function updateWeeklyAssessment(docId, updates) {
  const scores = updates.ratings ? computeAssessmentScores(updates.ratings) : null;
  const payload = { ...updates, updatedAt: serverTimestamp() };
  if (scores) {
    payload.domainScores = scores.domainScores;
    Object.assign(payload, scores.overall);
  }
  return updateDoc(doc(db, COL, docId), payload);
}

/**
 * Admin reviews a submitted assessment:
 * can add admin-side ratings, comments, and mark as REVIEWED.
 */
export async function reviewAssessment(docId, {
  adminRatings = null,
  adminComment = "",
  adminStrengths = "",
  adminAreasForImprovement = "",
  adminActionPlan = "",
  reviewedById = "",
  reviewedByName = "",
}) {
  const payload = {
    status: ASSESSMENT_STATUS.REVIEWED,
    adminComment,
    adminStrengths,
    adminAreasForImprovement,
    adminActionPlan,
    reviewedById,
    reviewedByName,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (adminRatings) {
    payload.adminRatings = adminRatings;
    const adminScores = computeAssessmentScores(adminRatings);
    payload.adminDomainScores = adminScores.domainScores;
    payload.adminPct = adminScores.overall.pct;
    payload.adminGrade = adminScores.overall.grade;
  }

  return updateDoc(doc(db, COL, docId), payload);
}

/**
 * Get all assessments for a specific teacher (newest first).
 */
export async function getTeacherAssessments(teacherId, max = 20) {
  const q = query(
    collection(db, COL),
    where("teacherId", "==", teacherId),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get all submitted assessments pending admin review.
 */
export async function getPendingAssessments(max = 50) {
  const q = query(
    collection(db, COL),
    where("status", "==", "SUBMITTED"),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get all assessments (admin overview, newest first).
 */
export async function getAllAssessments(max = 50) {
  const q = query(
    collection(db, COL),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get a single assessment by ID.
 */
export async function getAssessmentById(docId) {
  const snap = await getDoc(doc(db, COL, docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Delete an assessment.
 */
export async function deleteAssessment(docId) {
  return deleteDoc(doc(db, COL, docId));
}

/**
 * Check if an assessment already exists for a teacher + week.
 */
export async function getAssessmentForWeek(teacherId, weekKey) {
  const q = query(
    collection(db, COL),
    where("teacherId", "==", teacherId),
    where("weekKey", "==", weekKey),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}
