import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

import {
  saveTrialTestEntries,
  computeAndWriteTrialTestResults,
  getTrialTestPositionsDoc,
  printTrialTestResults,
} from "../services/trialTestEntryService.js";

const SUBJECTS = [
  { key: "english", label: "English" },
  { key: "mathematics", label: "Mathematics" },
  { key: "science", label: "Science" },
  { key: "socialStudies", label: "Social Studies" },
  { key: "creativeArts", label: "Creative Arts" },
  { key: "careerTech", label: "Career Tech" },
  { key: "rme", label: "RME" },
  { key: "computing", label: "Computing" },
  { key: "akuapemTwi", label: "Akuapem Twi" },
];

function clampScore(v) {
  // allow empty while typing
  if (v === "" || v == null) return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.trunc(n);
}

export default function TrialTestEntryCard({
  classes = [],
  schoolName = "",
  isAdmin = true,
}) {
  const [trialClassId, setTrialClassId] = useState("");
  const [trialMonth, setTrialMonth] = useState("");
  const [busy, setBusy] = useState(false);

  // ✅ scores now allow "" to mean “not entered”
  const [rows, setRows] = useState([]);
  const [computed, setComputed] = useState(null);

  useEffect(() => {
    const d = new Date();
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setTrialMonth(m);
  }, []);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === trialClassId) || null,
    [classes, trialClassId]
  );

  useEffect(() => {
    if (!trialClassId) {
      setRows([]);
      setComputed(null);
      return;
    }

    (async () => {
      setBusy(true);
      try {
        const snap = await getDocs(
          collection(db, "classes", trialClassId, "students")
        );

        const students = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) =>
            String(a.fullName || "").localeCompare(String(b.fullName || ""))
          );

        const blank = students.map((st) => {
          const scores = {};
          // ✅ default blank (not 0) so it won’t count unless entered
          for (const s of SUBJECTS) scores[s.key] = "";
          return {
            studentId: st.id,
            studentName: st.fullName || st.name || st.id,
            scores,
          };
        });

        setRows(blank);
        setComputed(null);

        if (trialMonth) {
          const docData = await getTrialTestPositionsDoc({
            classId: trialClassId,
            monthKey: trialMonth,
          });

          if (docData?.entries) {
            setRows((prev) =>
              prev.map((r) => {
                const saved = docData.entries[r.studentId];
                if (!saved) return r;
                return {
                  ...r,
                  studentName: saved.studentName || r.studentName,
                  scores: { ...r.scores, ...(saved.scores || {}) },
                };
              })
            );
          }

          if (docData?.computed) setComputed(docData.computed);
        }
      } catch (e) {
        toast.error(e?.message || "Failed to load roster.");
      } finally {
        setBusy(false);
      }
    })();
  }, [trialClassId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!trialClassId || !trialMonth) return;

    (async () => {
      setBusy(true);
      try {
        const docData = await getTrialTestPositionsDoc({
          classId: trialClassId,
          monthKey: trialMonth,
        });

        if (docData?.entries) {
          setRows((prev) =>
            prev.map((r) => {
              const saved = docData.entries[r.studentId];
              if (!saved) return r;
              return {
                ...r,
                studentName: saved.studentName || r.studentName,
                scores: { ...r.scores, ...(saved.scores || {}) },
              };
            })
          );
        }

        setComputed(docData?.computed || null);
      } catch {
        setComputed(null);
      } finally {
        setBusy(false);
      }
    })();
  }, [trialMonth, trialClassId]);

  function updateScore(studentId, subjectKey, value) {
    const v = clampScore(value);

    setRows((prev) =>
      prev.map((r) => {
        if (r.studentId !== studentId) return r;
        return {
          ...r,
          scores: {
            ...r.scores,
            // ✅ keep blank as blank; entered numbers stay numbers
            [subjectKey]: v === "" ? "" : v,
          },
        };
      })
    );
  }

  async function handleSave() {
    toast.dismiss();
    setBusy(true);
    try {
      if (!isAdmin) throw new Error("Unauthorized.");
      if (!trialClassId) throw new Error("Select a class.");
      if (!trialMonth) throw new Error("Enter month (YYYY-MM).");
      if (!rows.length) throw new Error("No students loaded.");

      await saveTrialTestEntries({
        classId: trialClassId,
        className: selectedClass?.name || "",
        monthKey: trialMonth,
        subjects: SUBJECTS,
        rows,
      });

      toast.success("Trial test scores saved.");
    } catch (e) {
      toast.error(e?.message || "Failed to save.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCompute() {
    toast.dismiss();
    setBusy(true);
    try {
      if (!isAdmin) throw new Error("Unauthorized.");
      if (!trialClassId) throw new Error("Select a class.");
      if (!trialMonth) throw new Error("Enter month (YYYY-MM).");
      if (!rows.length) throw new Error("No students loaded.");

      await saveTrialTestEntries({
        classId: trialClassId,
        className: selectedClass?.name || "",
        monthKey: trialMonth,
        subjects: SUBJECTS,
        rows,
      });

      const computedRes = await computeAndWriteTrialTestResults({
        classId: trialClassId,
        monthKey: trialMonth,
      });

      setComputed(computedRes);
      toast.success("Computed totals + aggregates + overall positions.");
    } catch (e) {
      toast.error(e?.message || "Failed to compute.");
    } finally {
      setBusy(false);
    }
  }

  function handlePrint() {
    toast.dismiss();
    try {
      if (!computed) throw new Error("No computed results yet.");

      printTrialTestResults({
        schoolName,
        className: selectedClass?.name || "",
        monthKey: trialMonth,
        subjects: SUBJECTS,
        computed,
      });
    } catch (e) {
      toast.error(e?.message || "Failed to print.");
    }
  }

  if (!isAdmin) return null;

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Trial Test Entry + Results (Admin)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Enter scores (0–100). Blank means “not entered” and won’t count in totals/aggregate.
            Overall Position is based on Total Score.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={handleSave}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {busy ? "Working..." : "Save Scores"}
          </button>

          <button
            disabled={busy}
            onClick={handleCompute}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? "Computing..." : "Compute Results"}
          </button>

          <button
            disabled={busy || !computed}
            onClick={handlePrint}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Print Results
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-slate-600">Class</label>
          <select
            value={trialClassId}
            onChange={(e) => setTrialClassId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          >
            <option value="">Choose class...</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.teacherName || c.teacherUid}
              </option>
            ))}
          </select>

          {selectedClass ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="font-semibold text-slate-900">
                {selectedClass.name}
              </div>
              <div className="text-xs text-slate-600">
                Teacher:{" "}
                <span className="font-semibold">
                  {selectedClass.teacherName || "—"}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">
            Month (YYYY-MM)
          </label>
          <input
            value={trialMonth}
            onChange={(e) => setTrialMonth(e.target.value)}
            placeholder="e.g. 2026-01"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
          />
        </div>
      </div>

      {/* Entry Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
        <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
          Enter Scores (0–100)
        </div>

        {rows.length ? (
          <div className="max-h-130 overflow-auto bg-white">
            <div
              className="grid gap-2 border-b border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
              style={{
                gridTemplateColumns: `260px repeat(${SUBJECTS.length}, 120px)`,
              }}
            >
              <div>Student</div>
              {SUBJECTS.map((s) => (
                <div key={s.key} className="text-center">
                  {s.label}
                </div>
              ))}
            </div>

            {rows.map((r) => (
              <div
                key={r.studentId}
                className="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm"
                style={{
                  gridTemplateColumns: `260px repeat(${SUBJECTS.length}, 120px)`,
                }}
              >
                <div className="truncate font-semibold text-slate-900">
                  {r.studentName}
                </div>

                {SUBJECTS.map((s) => (
                  <div key={s.key} className="flex justify-center">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      inputMode="numeric"
                      value={r.scores?.[s.key] ?? ""}
                      onChange={(e) =>
                        updateScore(r.studentId, s.key, e.target.value)
                      }
                      className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm text-center outline-none focus:ring"
                      placeholder="—"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white px-4 py-6 text-sm text-slate-600">
            Select a class to load students.
          </div>
        )}
      </div>

      {/* Computed preview */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
        <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
          Computed Preview (Subject Agg + Total Agg + Overall Position)
        </div>

        {computed?.studentMatrix?.length ? (
          <div className="max-h-96 overflow-auto bg-white">
            <div
              className="grid gap-2 border-b border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
              style={{
                gridTemplateColumns: `260px 90px 100px 110px repeat(${SUBJECTS.length}, 180px)`,
              }}
            >
              <div>Student</div>
              <div className="text-center">Pos</div>
              <div className="text-center">Total</div>
              <div className="text-center">Tot Agg</div>

              {SUBJECTS.map((s) => (
                <div key={s.key} className="text-center">
                  {s.label} (Score / Agg)
                </div>
              ))}
            </div>

            {computed.studentMatrix
              .slice()
              .sort(
                (a, b) =>
                  (a.overallPositionRaw ?? 999999) -
                  (b.overallPositionRaw ?? 999999)
              )
              .map((r) => (
                <div
                  key={r.studentId}
                  className="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm"
                  style={{
                    gridTemplateColumns: `260px 90px 100px 110px repeat(${SUBJECTS.length}, 180px)`,
                  }}
                >
                  <div className="truncate font-semibold text-slate-900">
                    {r.studentName}
                  </div>

                  <div className="text-center font-semibold text-slate-900">
                    {r.overallPosition ?? "—"}
                  </div>

                  <div className="text-center text-slate-700">
                    {r.totalScore ?? 0}
                  </div>

                  <div className="text-center font-semibold text-slate-900">
                    {r.totalAggregate ?? 0}
                  </div>

                  {SUBJECTS.map((s) => {
                    const sub = r.subjects?.[s.key] || {};
                    const has = sub.hasMark === true;
                    return (
                      <div key={s.key} className="text-center text-slate-700">
                        <span className="font-semibold">
                          {has ? sub.score : "—"}
                        </span>
                        <span className="text-slate-400"> / </span>
                        <span className="font-semibold">
                          {has ? sub.aggregate : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
        ) : (
          <div className="bg-white px-4 py-6 text-sm text-slate-600">
            No computed results yet. Click “Compute Results”.
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Saved to:{" "}
        <span className="font-semibold">
          trial_test_positions/{`{classId}_{YYYY-MM}`}
        </span>
      </p>
    </div>
  );
}
