// src/services/reportPositionsService.js
import { collection, doc, getDocs, getDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { ordinal } from "../utils/ordinals";
import { toNumberOrZero } from "../utils/reportGrading";

// BASIC subjects you want ranked
const BASIC_SUBJECT_KEYS = [
  "english",
  "ourWorldOurPeople",
  "mathematics",
  "integratedScience",
  "religiousMoralEducation",
  "informationCommunicationTechnology",
  "creativeArt",
  "akuapemTwi",
  "french",
  "history",
  "projectWork",
];

export function reportIdFromYearTerm(year, termNo) {
  return `${year}_T${termNo}`;
}

function computeOverallTotal(report) {
  const subjects = report?.subjects || {};
  let sum = 0;

  for (const k of Object.keys(subjects)) {
    const row = subjects[k] || {};
    const classScore = toNumberOrZero(row.classScore);
    const examsScore = toNumberOrZero(row.examsScore);
    sum += classScore + examsScore;
  }

  return sum;
}

function computeSubjectTotal(subjectRow) {
  const classScore = toNumberOrZero(subjectRow?.classScore);
  const examsScore = toNumberOrZero(subjectRow?.examsScore);
  return classScore + examsScore;
}

// Standard competition ranking:
// scores: 100, 90, 90, 80 => ranks: 1,2,2,4
function rankCompetition(sortedScoresDesc) {
  const ranks = new Map(); // score -> rank
  let rank = 1;
  for (let i = 0; i < sortedScoresDesc.length; i++) {
    const sc = sortedScoresDesc[i];
    if (!ranks.has(sc)) {
      ranks.set(sc, rank);
    }
    rank++;
  }
  return ranks;
}

export async function computeAndWriteBasicPositions({
  classId,
  year,
  termNo,
}) {
  if (!classId) throw new Error("classId required");
  if (!year) throw new Error("year required");
  if (!termNo) throw new Error("termNo required");

  const rid = reportIdFromYearTerm(year, termNo);

  // Load students in class
  const studentsSnap = await getDocs(collection(db, "classes", classId, "students"));
  const students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Load reports for each student (only those that exist)
  const reports = [];
  for (const st of students) {
    const ref = doc(db, "classes", classId, "students", st.id, "reports", rid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      reports.push({
        studentId: st.id,
        studentName: st.fullName || st.studentName || st.id,
        ref,
        report: snap.data(),
      });
    }
  }

  if (!reports.length) throw new Error("No BASIC reports found for this class/year/term.");

  // OVERALL totals
  const totals = reports.map((r) => ({
    studentId: r.studentId,
    total: computeOverallTotal(r.report),
  }));

  totals.sort((a, b) => b.total - a.total);
  const overallScoresDesc = totals.map((t) => t.total);
  const overallRankMap = rankCompetition(overallScoresDesc);

  // SUBJECT totals & ranks
  const subjectRankMaps = {};
  for (const subjectKey of BASIC_SUBJECT_KEYS) {
    const subjectTotals = reports.map((r) => ({
      studentId: r.studentId,
      total: computeSubjectTotal(r.report?.subjects?.[subjectKey]),
    }));

    subjectTotals.sort((a, b) => b.total - a.total);
    const scoresDesc = subjectTotals.map((x) => x.total);
    subjectRankMaps[subjectKey] = rankCompetition(scoresDesc);
  }

  // Write back in a batch (split if huge; typical class sizes are fine)
  const batch = writeBatch(db);

  for (const r of reports) {
    const overallTotal = computeOverallTotal(r.report);
    const overallRank = overallRankMap.get(overallTotal) || null;

    const patchSubjects = {};
    const existingSubjects = r.report?.subjects || {};

    for (const subjectKey of Object.keys(existingSubjects)) {
      const row = existingSubjects[subjectKey] || {};
      const sTotal = computeSubjectTotal(row);
      const sRank = subjectRankMaps[subjectKey]?.get(sTotal) || null;

      patchSubjects[subjectKey] = {
        ...row,
        totalScore: sTotal,
        positionInSubject: sRank,
        positionInSubjectText: sRank ? ordinal(sRank) : "",
      };
    }

    batch.set(
      r.ref,
      {
        // overall
        overallTotalScore: overallTotal,
        position: overallRank,
        positionText: overallRank ? ordinal(overallRank) : "",

        // subjects
        subjects: patchSubjects,
      },
      { merge: true }
    );
  }

  await batch.commit();

  return {
    reportId: rid,
    updatedCount: reports.length,
  };
}
