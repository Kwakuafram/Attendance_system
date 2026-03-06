// src/pages/BasicReport.jsx
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { gradeFromTotal, toNumberOrNull, toNumberOrZero } from "../utils/reportGrading";

// BASIC subjects (edit to match your school)
const SUBJECTS = [
  { key: "english", label: "English" },
  { key: "ourWorldOurPeople", label: "Our World Our People" },
  { key: "mathematics", label: "Mathematics" },
  { key: "integratedScience", label: "Int. Science" },
  { key: "religiousMoralEducation", label: "Religious & Moral Educ." },
  { key: "informationCommunicationTechnology", label: "Information Comm. Techno." },
  { key: "creativeArt", label: "Creative Art" },
  { key: "akuapemTwi", label: "Akuapem Twi" },
  { key: "french", label: "French" },
  { key: "history", label: "History" },
  { key: "projectWork", label: "Project Work" },
];

function todayKey(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function reportDocId(year, termNo) {
  return `${year}_T${termNo}`;
}

function emptySubjects() {
  return SUBJECTS.reduce((acc, s) => {
    acc[s.key] = {
      label: s.label,
      classScore: "",
      examsScore: "",
      totalScore: null,
      grade: "",
      remarks: "",
      positionInSubject: null,
      positionInSubjectText: "",
    };
    return acc;
  }, {});
}

export default function BasicReport({ teacherClass, students, profile }) {
  const [busy, setBusy] = useState(false);

  // student selection
  const [studentId, setStudentId] = useState("");
  const student = useMemo(
    () => students?.find((s) => s.id === studentId) || null,
    [students, studentId]
  );

  // term & meta
  const [termNo, setTermNo] = useState(1);
  const [termName, setTermName] = useState("Term One");
  const [year, setYear] = useState(new Date().getFullYear());
  const [reportDate, setReportDate] = useState(todayKey());
  const [nextTermBegins, setNextTermBegins] = useState("");

  // attendance & roll
  const [attendancePresent, setAttendancePresent] = useState("");
  const [attendanceTotal, setAttendanceTotal] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [noOnRoll, setNoOnRoll] = useState("");

  // subjects
  const [subjects, setSubjects] = useState(() => emptySubjects());

  // overall computed (saved later by admin compute)
  const [positionText, setPositionText] = useState(""); // e.g. "3rd"
  const [_overallTotalScore, setOverallTotalScore] = useState(null);

  // remarks
  const [teacherRemarks, setTeacherRemarks] = useState("");
  const [hodRecommendation, setHodRecommendation] = useState("");

  // extra / evaluation
  const [extraCurricular, setExtraCurricular] = useState("");
  const [conduct, setConduct] = useState("");
  const [attitude, setAttitude] = useState("");
  const [interestHobby, setInterestHobby] = useState("");
  const [classTeacherComments, setClassTeacherComments] = useState("");

  // auto select first student
  useEffect(() => {
    if (!studentId && students?.length) setStudentId(students[0].id);
  }, [students, studentId]);

  // load existing report
  useEffect(() => {
    (async () => {
      if (!teacherClass?.id || !studentId) return;

      const rid = reportDocId(year, termNo);
      const ref = doc(db, "classes", teacherClass.id, "students", studentId, "reports", rid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        // reset when switching
        setSubjects(emptySubjects());
        setPositionText("");
        setOverallTotalScore(null);
        setTeacherRemarks("");
        setHodRecommendation("");
        setAttendancePresent("");
        setAttendanceTotal("");
        setRollNo("");
        setNoOnRoll("");
        setExtraCurricular("");
        setConduct("");
        setAttitude("");
        setInterestHobby("");
        setClassTeacherComments("");
        return;
      }

      const data = snap.data();

      setTermNo(data.termNo ?? 1);
      setTermName(data.termName ?? "Term One");
      setYear(data.year ?? new Date().getFullYear());
      setReportDate(data.reportDate ?? todayKey());
      setNextTermBegins(data.nextTermBegins ?? "");

      setAttendancePresent(String(data.attendance?.present ?? ""));
      setAttendanceTotal(String(data.attendance?.total ?? ""));
      setRollNo(String(data.rollNo ?? ""));
      setNoOnRoll(String(data.noOnRoll ?? ""));

      setSubjects(data.subjects ?? emptySubjects());

      setTeacherRemarks(data.teacherRemarks ?? "");
      setHodRecommendation(data.hodRecommendation ?? "");

      setOverallTotalScore(data.overallTotalScore ?? null);
      setPositionText(data.positionText ?? "");

      setExtraCurricular(data.childEvaluation?.extraCurricular ?? "");
      setConduct(data.childEvaluation?.conduct ?? "");
      setAttitude(data.childEvaluation?.attitude ?? "");
      setInterestHobby(data.childEvaluation?.interestHobby ?? "");
      setClassTeacherComments(data.childEvaluation?.classTeacherComments ?? "");
    })().catch(() => {});
  }, [teacherClass?.id, studentId, year, termNo]);

  function setSubjectField(subjectKey, field, value) {
    setSubjects((prev) => {
      const row = prev[subjectKey] || {};
      const nextRow = { ...row, [field]: value };

      // auto compute totals + grade + remarks when classScore/examsScore change
      if (field === "classScore" || field === "examsScore") {
        const classScore = toNumberOrZero(field === "classScore" ? value : row.classScore);
        const examsScore = toNumberOrZero(field === "examsScore" ? value : row.examsScore);

        const total = classScore + examsScore;
        const { grade, remark } = gradeFromTotal(total);

        nextRow.totalScore = total;
        nextRow.grade = grade;
        nextRow.remarks = remark;
      }

      return { ...prev, [subjectKey]: nextRow };
    });
  }

  const computedOverallTotal = useMemo(() => {
    let sum = 0;
    for (const s of SUBJECTS) {
      const row = subjects?.[s.key] || {};
      sum += toNumberOrZero(row.classScore) + toNumberOrZero(row.examsScore);
    }
    return sum;
  }, [subjects]);

  async function saveReport() {
    toast.dismiss();

    if (!teacherClass?.id) {
      toast.error("No class assigned.");
      return;
    }
    if (!student?.id) {
      toast.error("Select a student.");
      return;
    }

    setBusy(true);
    try {
      const rid = reportDocId(year, termNo);
      const ref = doc(db, "classes", teacherClass.id, "students", student.id, "reports", rid);

      // normalize subjects for storage
      const normalizedSubjects = {};
      for (const s of SUBJECTS) {
        const row = subjects?.[s.key] || {};
        const classScore = toNumberOrNull(row.classScore);
        const examsScore = toNumberOrNull(row.examsScore);

        const total = (toNumberOrZero(row.classScore) + toNumberOrZero(row.examsScore));
        const { grade, remark } = gradeFromTotal(total);

        normalizedSubjects[s.key] = {
          key: s.key,
          label: s.label,
          classScore,
          examsScore,
          totalScore: Number.isFinite(total) ? total : null,
          grade,
          remarks: remark,

          // these are computed later (admin compute job)
          positionInSubject: row.positionInSubject ?? null,
          positionInSubjectText: row.positionInSubjectText ?? "",
        };
      }

      const payload = {
        reportType: "BASIC",

        classId: teacherClass.id,
        className: teacherClass.name || "",
        studentId: student.id,
        studentName: student.fullName || "",

        year,
        termNo,
        termName,
        reportDate,
        nextTermBegins,

        rollNo: rollNo === "" ? null : String(rollNo),
        noOnRoll: noOnRoll === "" ? null : String(noOnRoll),

        attendance: {
          present: attendancePresent === "" ? null : Number(attendancePresent),
          total: attendanceTotal === "" ? null : Number(attendanceTotal),
        },

        // computed total stored (position computed later)
        overallTotalScore: computedOverallTotal,
        position: null,
        positionText: "",

        subjects: normalizedSubjects,

        teacherRemarks,
        hodRecommendation,

        childEvaluation: {
          extraCurricular,
          conduct,
          attitude,
          interestHobby,
          classTeacherComments,
        },

        updatedAt: serverTimestamp(),
        updatedByUid: profile?.uid || "",
        updatedByName: profile?.fullName || "",
        createdAt: serverTimestamp(),
      };

      await setDoc(ref, payload, { merge: true });
      toast.success("Report saved. (Positions will update after Admin computes class positions.)");
    } catch (e) {
      toast.error(e?.message || "Failed to save report.");
    } finally {
      setBusy(false);
    }
  }

  function printBasicReportLocal() {
    if (!student || !teacherClass) return;

    const safe = (v) =>
      String(v ?? "")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const subjectRowsHtml = SUBJECTS.map((s) => {
      const row = subjects?.[s.key] || {};
      const classScore = toNumberOrZero(row.classScore);
      const examsScore = toNumberOrZero(row.examsScore);
      const total = classScore + examsScore;
      const { grade, remark } = gradeFromTotal(total);

      return `
        <tr>
          <td>${safe(s.label)}</td>
          <td class="c">${safe(classScore || "")}</td>
          <td class="c">${safe(examsScore || "")}</td>
          <td class="c strong">${safe(total || "")}</td>
          <td class="c">${safe(grade)}</td>
          <td class="c">${safe(row.positionInSubjectText || "")}</td>
          <td>${safe(remark)}</td>
        </tr>
      `;
    }).join("");

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Report ${safe(student.fullName)} ${safe(year)}_T${safe(termNo)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 18px; }
    .sheet { max-width: 980px; margin: 0 auto; }
    .top { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
    .h1 { font-weight:800; font-size:18px; margin:0; }
    .meta { font-size:12px; color:#444; line-height:1.5; margin-top:6px; }
    .box { border:1px solid #ddd; border-radius:10px; padding:12px; margin-top:12px; }
    table { width:100%; border-collapse:collapse; }
    th, td { border:1px solid #ddd; padding:6px 8px; font-size:12px; }
    th { background:#f6f6f6; text-align:left; }
    .c { text-align:center; width:90px; }
    .strong { font-weight:700; }
    .row { display:flex; justify-content:space-between; gap:12px; font-size:12px; margin-top:6px; }
    .muted { color:#555; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div>
        <p class="h1">GREENIDGE INTERNATIONAL SCHOOL</p>
        <div class="meta">
          <div><span class="muted">Student:</span> <b>${safe(student.fullName || "—")}</b></div>
          <div><span class="muted">Class:</span> <b>${safe(teacherClass.name || "—")}</b></div>
          <div><span class="muted">Year/Term:</span> <b>${safe(year)} / Term ${safe(termNo)}</b></div>
          <div><span class="muted">Position:</span> <b>${safe(positionText || "")}</b></div>
        </div>
      </div>
      <div class="meta" style="text-align:right;">
        <div><span class="muted">Total score:</span> <b>${safe(computedOverallTotal)}</b></div>
        <div><span class="muted">Date:</span> <b>${safe(reportDate)}</b></div>
      </div>
    </div>

    <div class="box">
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th class="c">Class<br/>Score</th>
            <th class="c">End of Term<br/>Exams</th>
            <th class="c">Total<br/>100%</th>
            <th class="c">Grade</th>
            <th class="c">Position<br/>in Subject</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${subjectRowsHtml}
        </tbody>
      </table>

      <div class="row">
        <div><span class="muted">Attendance:</span> ${safe(attendancePresent || "—")} out of ${safe(attendanceTotal || "—")}</div>
        <div><span class="muted">No. on Roll:</span> ${safe(noOnRoll || "—")}</div>
        <div><span class="muted">Roll No:</span> ${safe(rollNo || "—")}</div>
      </div>
      <div class="row">
        <div><span class="muted">Next Term Begins:</span> ${safe(nextTermBegins || "—")}</div>
      </div>
    </div>

    <div class="box">
      <div class="row"><div><span class="muted">Class Teacher’s Remarks:</span> <b>${safe(teacherRemarks || "—")}</b></div></div>
      <div class="row"><div><span class="muted">H.O.D recommendation:</span> <b>${safe(hodRecommendation || "—")}</b></div></div>
    </div>

    <div class="box">
      <div class="row"><div><span class="muted">Extra Curricular Activities:</span> <b>${safe(extraCurricular || "—")}</b></div></div>
      <div class="row"><div><span class="muted">Conduct:</span> <b>${safe(conduct || "—")}</b></div></div>
      <div class="row"><div><span class="muted">Attitude:</span> <b>${safe(attitude || "—")}</b></div></div>
      <div class="row"><div><span class="muted">Interest/Hobby(ies):</span> <b>${safe(interestHobby || "—")}</b></div></div>
      <div class="row"><div><span class="muted">Class Teacher’s Comments:</span> <b>${safe(classTeacherComments || "—")}</b></div></div>
    </div>
  </div>

  <script>window.print();</script>
</body>
</html>
    `;

    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">GREENIDGE INTERNATIONA SCH.</h2>
          <p className="mt-1 text-sm text-slate-600">
            Class: <span className="font-semibold">{teacherClass?.name || teacherClass?.id}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Overall Position shows after Admin computes positions for the class.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={printBasicReportLocal}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Print (Preview)
          </button>

          <button
            disabled={busy}
            onClick={saveReport}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save Report"}
          </button>
        </div>
      </div>

      {/* Selectors */}
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-slate-600">Student</label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          >
            {students?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName || s.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">Term</label>
          <select
            value={termNo}
            onChange={(e) => {
              const t = Number(e.target.value);
              setTermNo(t);
              setTermName(t === 1 ? "Term One" : t === 2 ? "Term Two" : "Term Three");
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          >
            <option value={1}>Term One</option>
            <option value={2}>Term Two</option>
            <option value={3}>Term Three</option>
          </select>
        </div>
      </div>

      {/* Meta */}
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div>
          <label className="text-xs font-semibold text-slate-600">Report date</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">Next term begins</label>
          <input
            type="text"
            value={nextTermBegins}
            onChange={(e) => setNextTermBegins(e.target.value)}
            placeholder="e.g. 8th January, 2026"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">Attendance present</label>
          <input
            type="number"
            value={attendancePresent}
            onChange={(e) => setAttendancePresent(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">Attendance total</label>
          <input
            type="number"
            value={attendanceTotal}
            onChange={(e) => setAttendanceTotal(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div>
          <label className="text-xs font-semibold text-slate-600">Roll No</label>
          <input
            value={rollNo}
            onChange={(e) => setRollNo(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">No. on Roll</label>
          <input
            value={noOnRoll}
            onChange={(e) => setNoOnRoll(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
          <div className="text-xs font-semibold text-slate-600">Overall total score</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{computedOverallTotal}</div>
          <div className="mt-1 text-xs text-slate-500">
            Position: <span className="font-semibold">{positionText || "—"}</span>
          </div>
        </div>
      </div>

      {/* Subjects table */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Subjects</h3>

        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-7 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
            <div className="col-span-2">Subject</div>
            <div className="text-center">Class score</div>
            <div className="text-center">Exams score</div>
            <div className="text-center">Total 100%</div>
            <div className="text-center">Grade</div>
            <div className="text-center">Pos. in Subject</div>
          </div>

          {SUBJECTS.map((s) => {
            const row = subjects?.[s.key] || {};
            const classScore = toNumberOrZero(row.classScore);
            const examsScore = toNumberOrZero(row.examsScore);
            const total = classScore + examsScore;
            const { grade, remark } = gradeFromTotal(total);

            return (
              <div
                key={s.key}
                className="grid grid-cols-7 items-center border-t border-slate-200 px-4 py-3 text-sm"
              >
                <div className="col-span-2 font-semibold text-slate-900">{s.label}</div>

                <div className="text-center">
                  <input
                    type="number"
                    value={row.classScore ?? ""}
                    onChange={(e) => setSubjectField(s.key, "classScore", e.target.value)}
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none"
                  />
                </div>

                <div className="text-center">
                  <input
                    type="number"
                    value={row.examsScore ?? ""}
                    onChange={(e) => setSubjectField(s.key, "examsScore", e.target.value)}
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none"
                  />
                </div>

                <div className="text-center">
                  <input
                    type="number"
                    value={Number.isFinite(total) ? total : ""}
                    readOnly
                    className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm outline-none"
                    title="Total = Class + Exams"
                  />
                </div>

                <div className="text-center font-semibold">{grade}</div>

                <div className="text-center">
                  <span className="text-slate-700">{row.positionInSubjectText || "—"}</span>
                </div>

                {/* remarks (computed) */}
                <div className="col-span-7 mt-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Remarks:</span> {remark}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Remarks */}
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-slate-600">Class Teacher’s Remarks</label>
          <input
            value={teacherRemarks}
            onChange={(e) => setTeacherRemarks(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">H.O.D recommendation</label>
          <input
            value={hodRecommendation}
            onChange={(e) => setHodRecommendation(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          />
        </div>
      </div>

      {/* Child Evaluation */}
      <div className="mt-6 rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900">Child’s Evaluation</h3>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">Extra Curricular Activities</label>
            <input
              value={extraCurricular}
              onChange={(e) => setExtraCurricular(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Conduct</label>
            <input
              value={conduct}
              onChange={(e) => setConduct(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Attitude</label>
            <input
              value={attitude}
              onChange={(e) => setAttitude(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Interest/Hobby(ies)</label>
            <input
              value={interestHobby}
              onChange={(e) => setInterestHobby(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Class Teacher’s Comments</label>
            <input
              value={classTeacherComments}
              onChange={(e) => setClassTeacherComments(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring"
            />
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Note: Overall Position + Subject Positions are computed by Admin per class after all reports are saved.
      </p>
    </div>
  );
}
