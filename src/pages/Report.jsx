// src/pages/report.jsx
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import toast from "react-hot-toast";

function isPreschoolClassName(name = "") {
  const n = String(name).toLowerCase();
  return (
    n.includes("creche") ||
    n.includes("crèche") ||
    n.includes("nursery") ||
    n.includes("kg") ||
    n.includes("k.g")
  );
}

function todayKey(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Matches your booklet subjects
const SUBJECT_KEYS = ["numeracy", "literacy", "creativeArts", "owop", "phonics"];
const SUBJECT_LABELS = {
  numeracy: "Numeracy",
  literacy: "Literacy",
  creativeArts: "Creative Arts",
  owop: "O.W.O.P",
  phonics: "Phonics",
};

// Academics tick rows (from your image)
const ACADEMICS_ITEMS = [
  { key: "identifyNumerals", label: "Can identify numerals from 1 -" },
  { key: "writeNumerals", label: "Can write numerals from 1 -" },
  {
    key: "identifyLowerUpper",
    label: "Can identify lower and upper case letters Aa -",
  },
  {
    key: "writeLowerUpper",
    label: "Can write lower and upper case letters Aa -",
  },
  {
    key: "identifySounds",
    label: "Can identify and make sounds of some letters",
  },
  {
    key: "identifyHumanBody",
    label: "Can identify some parts of the human body",
  },
  {
    key: "functionsBodyParts",
    label: "Can mention some functions of some parts of the body",
  },
  {
    key: "drawFruits",
    label: "Can identify and draw different kinds of fruit",
  },
];

// Attitude/Human relation rows (from your image)
const ATTITUDE_ITEMS = [
  { key: "confident", label: "Is confident." },
  { key: "workIndependently", label: "Can work independently." },
  {
    key: "askAnswerNoFear",
    label: "Can ask and answer questions without fear.",
  },
  { key: "participate", label: "Can participate during activities." },
  { key: "associateWithOthers", label: "Is good at associating with others." },
  { key: "settleDisputes", label: "Good at settling disputes amicably" },
];

const ACADEMICS_GRADES = ["EXCELLENT", "V_GOOD", "GOOD", "AVERAGE"];
const ATTITUDE_GRADES = ["REGULAR", "NOT_OFTEN", "SELDOM"];

function emptyGradeMap(items, defaultValue = "") {
  return items.reduce((acc, it) => {
    acc[it.key] = defaultValue;
    return acc;
  }, {});
}

function emptySubjects() {
  return SUBJECT_KEYS.reduce((acc, k) => {
    acc[k] = { classScore: "", examsScore: "" }; // total is computed, not stored in state
    return acc;
  }, {});
}

function safeNum(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function Report({ teacherClass, students, profile }) {
  // Guard: only preschool class teacher should see editor
  const isPreschool = useMemo(() => {
    if (!teacherClass) return false;
    if (teacherClass.classGroup) return teacherClass.classGroup === "PRESCHOOL";
    return isPreschoolClassName(teacherClass.name);
  }, [teacherClass]);

  const [studentId, setStudentId] = useState("");
  const student = useMemo(
    () => students?.find((s) => s.id === studentId) || null,
    [students, studentId]
  );

  const [termName, setTermName] = useState("Term One");
  const [termNo, setTermNo] = useState(1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [reportDate, setReportDate] = useState(todayKey());
  const [nextTermBegins, setNextTermBegins] = useState("");

  const [attendancePresent, setAttendancePresent] = useState("");
  const [attendanceTotal, setAttendanceTotal] = useState("");
  const [rollNo, setRollNo] = useState("");

  const [academicsGrades, setAcademicsGrades] = useState(() =>
    emptyGradeMap(ACADEMICS_ITEMS)
  );
  const [academicsNotes, setAcademicsNotes] = useState({
    numeralsTo: "",
    writeNumeralsTo: "",
    lettersTo: "",
    writeLettersTo: "",
  });

  const [attitudeGrades, setAttitudeGrades] = useState(() =>
    emptyGradeMap(ATTITUDE_ITEMS)
  );

  const [subjects, setSubjects] = useState(() => emptySubjects());

  const [teacherRemarks, setTeacherRemarks] = useState("");
  const [hodRecommendation, setHodRecommendation] = useState("");

  const [busy, setBusy] = useState(false);

  // Ensure student is selected to avoid undefined crashes
  useEffect(() => {
    if (!studentId && students?.length) setStudentId(students[0].id);
  }, [students, studentId]);

  // Compute total per subject (UI + save)
  function subjectTotal(k) {
    const cs = Number(subjects?.[k]?.classScore ?? 0);
    const es = Number(subjects?.[k]?.examsScore ?? 0);
    const csVal = Number.isFinite(cs) ? cs : 0;
    const esVal = Number.isFinite(es) ? es : 0;
    return csVal + esVal;
  }

  function setSubjectField(k, field, value) {
    setSubjects((prev) => ({
      ...prev,
      [k]: { ...prev[k], [field]: value },
    }));
  }

  // Load existing report (if saved before)
  useEffect(() => {
    (async () => {
      if (!isPreschool) return;
      if (!teacherClass?.id || !studentId) return;

      const reportKey = `${year}_T${termNo}`;
      const ref = doc(
        db,
        "classes",
        teacherClass.id,
        "students",
        studentId,
        "reports",
        reportKey
      );

      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      const data = snap.data();

      setTermName(data.termName ?? "Term One");
      setTermNo(data.termNo ?? 1);
      setYear(data.year ?? new Date().getFullYear());
      setReportDate(data.reportDate ?? todayKey());
      setNextTermBegins(data.nextTermBegins ?? "");

      setAttendancePresent(
        data.attendance?.present == null ? "" : String(data.attendance.present)
      );
      setAttendanceTotal(
        data.attendance?.total == null ? "" : String(data.attendance.total)
      );
      setRollNo(data.rollNo == null ? "" : String(data.rollNo));

      setAcademicsGrades(
        data.academicsGrades ?? emptyGradeMap(ACADEMICS_ITEMS)
      );
      setAcademicsNotes(
        data.academicsNotes ?? {
          numeralsTo: "",
          writeNumeralsTo: "",
          lettersTo: "",
          writeLettersTo: "",
        }
      );

      setAttitudeGrades(data.attitudeGrades ?? emptyGradeMap(ATTITUDE_ITEMS));

      // Load subjects (ignore stored totalScore; we compute it)
      const loadedSubjects = emptySubjects();
      const incoming = data.subjects || {};
      SUBJECT_KEYS.forEach((k) => {
        loadedSubjects[k] = {
          classScore:
            incoming?.[k]?.classScore == null ? "" : String(incoming[k].classScore),
          examsScore:
            incoming?.[k]?.examsScore == null ? "" : String(incoming[k].examsScore),
        };
      });
      setSubjects(loadedSubjects);

      setTeacherRemarks(data.teacherRemarks ?? "");
      setHodRecommendation(data.hodRecommendation ?? "");
    })().catch(() => {});
  }, [isPreschool, teacherClass?.id, studentId, year, termNo]);

  async function saveReport() {
    toast.dismiss();

    if (!isPreschool) {
      toast.error("Not allowed. Preschool reports are for Preschool teachers only.");
      return;
    }
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
      const reportKey = `${year}_T${termNo}`;

      const ref = doc(
        db,
        "classes",
        teacherClass.id,
        "students",
        student.id,
        "reports",
        reportKey
      );

      // Read once so we do not overwrite createdAt
      const existingSnap = await getDoc(ref);
      const existing = existingSnap.exists() ? existingSnap.data() : null;

      const payload = {
        reportType: "PRESCHOOL",

        classId: teacherClass.id,
        className: teacherClass.name || "",

        studentId: student.id,
        studentName: student.fullName || "",

        year,
        termNo,
        termName,
        reportDate,
        nextTermBegins,

        rollNo,

        attendance: {
          present: safeNum(attendancePresent),
          total: safeNum(attendanceTotal),
        },

        academicsGrades,
        academicsNotes,
        attitudeGrades,

        subjects: SUBJECT_KEYS.reduce((acc, k) => {
          const row = subjects[k] || {};
          const cs = safeNum(row.classScore);
          const es = safeNum(row.examsScore);

          const csVal = Number.isFinite(cs) ? cs : 0;
          const esVal = Number.isFinite(es) ? es : 0;

          acc[k] = {
            label: SUBJECT_LABELS[k],
            classScore: cs,
            examsScore: es,
            totalScore: cs == null && es == null ? null : csVal + esVal,
          };
          return acc;
        }, {}),

        teacherRemarks,
        hodRecommendation,

        createdAt: existing?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedByUid: profile?.uid || "",
        updatedByName: profile?.fullName || "",
      };

      await setDoc(ref, payload, { merge: true });

      toast.success("Report saved.");
    } catch (e) {
      toast.error(e?.message || "Failed to save report.");
    } finally {
      setBusy(false);
    }
  }

  // Hide editor for non-preschool teachers (per your requirement)
  if (!isPreschool) return null;

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Preschool Reports
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Class:{" "}
            <span className="font-semibold">
              {teacherClass?.name || teacherClass?.id}
            </span>
          </p>
        </div>

        <button
          disabled={busy}
          onClick={saveReport}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save Report"}
        </button>
      </div>

      {/* Student + Term */}
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

      {/* Dates + Attendance */}
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
          <label className="text-xs font-semibold text-slate-600">No. on roll</label>
          <input
            type="number"
            value={rollNo}
            onChange={(e) => setRollNo(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          />
        </div>

        <div className="md:col-span-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Numerals to</label>
            <input
              value={academicsNotes.numeralsTo}
              onChange={(e) =>
                setAcademicsNotes((p) => ({ ...p, numeralsTo: e.target.value }))
              }
              placeholder="e.g. 30"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Writes numerals to</label>
            <input
              value={academicsNotes.writeNumeralsTo}
              onChange={(e) =>
                setAcademicsNotes((p) => ({ ...p, writeNumeralsTo: e.target.value }))
              }
              placeholder="e.g. 10"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Letters Aa to</label>
            <input
              value={academicsNotes.lettersTo}
              onChange={(e) =>
                setAcademicsNotes((p) => ({ ...p, lettersTo: e.target.value }))
              }
              placeholder="e.g. Zz"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
            />
          </div>
        </div>
      </div>

      {/* Academics tick table */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Academics</h3>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-5 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
            <div className="col-span-2">Item</div>
            <div className="text-center">Excellent</div>
            <div className="text-center">V. Good</div>
            <div className="text-center">Good / Average</div>
          </div>

          {ACADEMICS_ITEMS.map((it) => {
            const v = academicsGrades[it.key] || "";
            return (
              <div
                key={it.key}
                className="grid grid-cols-5 items-center border-t border-slate-200 px-4 py-3 text-sm"
              >
                <div className="col-span-2 text-slate-700">{it.label}</div>

                <div className="text-center">
                  <input
                    type="radio"
                    name={`acad_${it.key}`}
                    checked={v === "EXCELLENT"}
                    onChange={() =>
                      setAcademicsGrades((p) => ({ ...p, [it.key]: "EXCELLENT" }))
                    }
                  />
                </div>

                <div className="text-center">
                  <input
                    type="radio"
                    name={`acad_${it.key}`}
                    checked={v === "V_GOOD"}
                    onChange={() =>
                      setAcademicsGrades((p) => ({ ...p, [it.key]: "V_GOOD" }))
                    }
                  />
                </div>

                <div className="text-center">
                  <select
                    value={v === "GOOD" || v === "AVERAGE" ? v : ""}
                    onChange={(e) =>
                      setAcademicsGrades((p) => ({ ...p, [it.key]: e.target.value }))
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none"
                  >
                    <option value="">—</option>
                    <option value="GOOD">Good</option>
                    <option value="AVERAGE">Average</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attitude & Human Relation */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">
          Attitude and Human Relation
        </h3>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-5 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
            <div className="col-span-2">Item</div>
            <div className="text-center">Regular</div>
            <div className="text-center">Not Often</div>
            <div className="text-center">Seldom</div>
          </div>

          {ATTITUDE_ITEMS.map((it) => {
            const v = attitudeGrades[it.key] || "";
            return (
              <div
                key={it.key}
                className="grid grid-cols-5 items-center border-t border-slate-200 px-4 py-3 text-sm"
              >
                <div className="col-span-2 text-slate-700">{it.label}</div>

                {ATTITUDE_GRADES.map((g) => (
                  <div key={g} className="text-center">
                    <input
                      type="radio"
                      name={`att_${it.key}`}
                      checked={v === g}
                      onChange={() => setAttitudeGrades((p) => ({ ...p, [it.key]: g }))}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Subjects */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Subjects</h3>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-4 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
            <div>Subject</div>
            <div className="text-center">Class score</div>
            <div className="text-center">Exams score</div>
            <div className="text-center">Total score</div>
          </div>

          {SUBJECT_KEYS.map((k) => (
            <div
              key={k}
              className="grid grid-cols-4 items-center border-t border-slate-200 px-4 py-3 text-sm"
            >
              <div className="font-semibold text-slate-900">{SUBJECT_LABELS[k]}</div>

              <div className="text-center">
                <input
                  type="number"
                  value={subjects?.[k]?.classScore ?? ""}
                  onChange={(e) => setSubjectField(k, "classScore", e.target.value)}
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none"
                />
              </div>

              <div className="text-center">
                <input
                  type="number"
                  value={subjects?.[k]?.examsScore ?? ""}
                  onChange={(e) => setSubjectField(k, "examsScore", e.target.value)}
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none"
                />
              </div>

              <div className="text-center">
                <input
                  type="number"
                  value={subjectTotal(k)}
                  readOnly
                  className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm outline-none"
                  title="Total = Class + Exams"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Remarks */}
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-slate-600">
            Class Teacher’s Remarks
          </label>
          <input
            value={teacherRemarks}
            onChange={(e) => setTeacherRemarks(e.target.value)}
            placeholder="e.g. Keep it up!"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">
            H.O.D recommendation
          </label>
          <input
            value={hodRecommendation}
            onChange={(e) => setHodRecommendation(e.target.value)}
            placeholder="e.g. Good!"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          />
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Note: Admin will have a separate Print/View page for reports. Teachers only
        save/edit for their class.
      </p>
    </div>
  );
}
