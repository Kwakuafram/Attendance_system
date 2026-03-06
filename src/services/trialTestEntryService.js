import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

/**
 * Aggregates:
 * 90-100 => 1
 * 80-89  => 2
 * 70-79  => 3
 * 60-69  => 4
 * 55-59  => 5
 * 50-54  => 6
 * 40-49  => 7
 * 35-39  => 8
 * 0-34   => 9
 */
export function scoreToAggregate(score) {
  const s = Number(score ?? 0);
  if (!Number.isFinite(s)) return 9;
  if (s >= 90) return 1;
  if (s >= 80) return 2;
  if (s >= 70) return 3;
  if (s >= 60) return 4;
  if (s >= 55) return 5;
  if (s >= 50) return 6;
  if (s >= 40) return 7;
  if (s >= 35) return 8;
  return 9;
}

// Competition ranking: 1,2,2,4...
function rankCompetitionDescending(rows, scoreKey) {
  const sorted = [...rows].sort(
    (a, b) => (b[scoreKey] ?? 0) - (a[scoreKey] ?? 0)
  );

  let lastScore = null;
  let lastPos = 0;

  return sorted.map((r, idx) => {
    const score = r[scoreKey] ?? 0;
    const pos = score === lastScore ? lastPos : idx + 1;
    lastScore = score;
    lastPos = pos;
    return { ...r, overallPositionRaw: pos };
  });
}

export function toOrdinal(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return "—";
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
  const mod10 = num % 10;
  if (mod10 === 1) return `${num}st`;
  if (mod10 === 2) return `${num}nd`;
  if (mod10 === 3) return `${num}rd`;
  return `${num}th`;
}

function docIdFor(classId, monthKey) {
  return `${classId}_${monthKey}`;
}

export async function getTrialTestPositionsDoc({ classId, monthKey }) {
  const ref = doc(db, "trial_test_positions", docIdFor(classId, monthKey));
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * Save raw entries only
 * entries: { [studentId]: { studentName, scores: {k: number | ""} } }
 */
export async function saveTrialTestEntries({
  classId,
  className,
  monthKey,
  subjects,
  rows,
}) {
  const ref = doc(db, "trial_test_positions", docIdFor(classId, monthKey));

  const entries = {};
  for (const r of rows) {
    entries[r.studentId] = {
      studentName: r.studentName || "",
      scores: r.scores || {},
    };
  }

  await setDoc(
    ref,
    {
      classId,
      className,
      monthKey,
      subjects,
      entries,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return true;
}

/**
 * ✅ compute rules:
 * - A subject counts ONLY if mark is present (not "" / null / undefined)
 * - totalScore = sum of ONLY entered subject scores
 * - totalAggregate = sum of ONLY entered subject aggregates
 * - overallPosition ranked from totalScore (descending)
 * - overallPosition displayed as ordinal (1st, 2nd, 3rd...)
 */
export async function computeAndWriteTrialTestResults({ classId, monthKey }) {
  const ref = doc(db, "trial_test_positions", docIdFor(classId, monthKey));
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error("No saved entries found. Save scores first.");

  const data = snap.data();
  const entries = data.entries || {};
  const subjects = data.subjects || [];
  const subjectKeys = subjects.map((s) => s.key);

  const baseRows = Object.entries(entries).map(([studentId, e]) => {
    const studentName = e?.studentName || studentId;
    const scores = e?.scores || {};

    const subjectsOut = {};
    let totalScore = 0;
    let totalAggregate = 0;

    for (const k of subjectKeys) {
      const raw = scores?.[k];

      // ✅ mark considered "missing" if blank/undefined/null
      const hasMark = !(raw === "" || raw == null);

      if (!hasMark) {
        subjectsOut[k] = { hasMark: false, score: null, aggregate: null };
        continue;
      }

      const sc = Number(raw);
      const score = Number.isFinite(sc)
        ? Math.max(0, Math.min(100, Math.trunc(sc)))
        : 0;

      const aggregate = scoreToAggregate(score);

      subjectsOut[k] = { hasMark: true, score, aggregate };

      // ✅ only add if mark exists
      totalScore += score;
      totalAggregate += aggregate;
    }

    return {
      studentId,
      studentName,
      totalScore,
      totalAggregate,
      subjects: subjectsOut,
    };
  });

  const ranked = rankCompetitionDescending(baseRows, "totalScore").map((r) => ({
    ...r,
    overallPosition: toOrdinal(r.overallPositionRaw),
  }));

  const computed = {
    generatedAt: new Date().toISOString(),
    studentMatrix: ranked,
  };

  await setDoc(
    ref,
    {
      computed,
      computedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return computed;
}

export function printTrialTestResults({
  schoolName = "",
  className = "",
  monthKey = "",
  subjects = [],
  computed,
}) {
  const rows = computed?.studentMatrix || [];
  if (!rows.length) throw new Error("No computed rows to print.");

  const monthName = (() => {
    try {
      return new Date(`${monthKey}-01`).toLocaleString(undefined, {
        month: "long",
        year: "numeric",
      });
    } catch {
      return monthKey;
    }
  })();

  const headCols = `
    <th>Student</th>
    <th style="text-align:center;">Pos</th>
    <th style="text-align:center;">Total</th>
    <th style="text-align:center;">Tot Agg</th>
    ${subjects
      .map(
        (s) =>
          `<th style="text-align:center;">${escapeHtml(s.label)}<br/><span style="font-weight:400;">Score</span></th>
           <th style="text-align:center;">${escapeHtml(s.label)}<br/><span style="font-weight:400;">Agg</span></th>`
      )
      .join("")}
  `;

  const body = rows
    .slice()
    .sort((a, b) => (a.overallPositionRaw ?? 999999) - (b.overallPositionRaw ?? 999999))
    .map((r) => {
      const subTds = subjects
        .map((s) => {
          const v = r.subjects?.[s.key] || {};
          const has = v.hasMark === true;
          return `
            <td style="text-align:center;">${has ? num(v.score) : "—"}</td>
            <td style="text-align:center;font-weight:700;">${has ? num(v.aggregate) : "—"}</td>
          `;
        })
        .join("");

      return `
        <tr>
          <td>${escapeHtml(r.studentName || r.studentId)}</td>
          <td style="text-align:center;font-weight:700;">${escapeHtml(r.overallPosition || "—")}</td>
          <td style="text-align:center;">${num(r.totalScore)}</td>
          <td style="text-align:center;font-weight:700;">${num(r.totalAggregate)}</td>
          ${subTds}
        </tr>
      `;
    })
    .join("");

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Trial Test Results - ${escapeHtml(className)} - ${escapeHtml(monthKey)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 18px; }
    .title { font-weight: 800; font-size: 18px; margin: 0; }
    .meta { margin-top: 6px; color: #444; font-size: 12px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; }
    th { background: #f6f6f6; text-align: left; }
    .note { margin-top: 10px; font-size: 11px; color: #555; }
    @media print { body { margin: 0; } .noPrint { display: none; } }
  </style>
</head>
<body>
  <div>
    <p class="title">${escapeHtml(schoolName || "School")} — Trial Test Results</p>
    <div class="meta">
      <div><b>Class:</b> ${escapeHtml(className || "—")}</div>
      <div><b>Month:</b> ${escapeHtml(monthName)}</div>
      <div><b>Generated:</b> ${escapeHtml(computed?.generatedAt || "")}</div>
    </div>

    <table>
      <thead><tr>${headCols}</tr></thead>
      <tbody>${body}</tbody>
    </table>

    <div class="note">
      <b>Notes:</b> Blank subject marks are not included in Total Score or Total Aggregate.
      Overall position is based on Total Score.
    </div>

    <div class="noPrint" style="margin-top: 14px;">
      <button onclick="window.print()" style="padding:10px 14px;border:1px solid #ddd;border-radius:10px;background:white;cursor:pointer;">
        Print
      </button>
    </div>
  </div>
</body>
</html>
`;

  const w = window.open("", "_blank", "width=1200,height=800");
  if (!w) throw new Error("Popup blocked. Allow popups and try again.");
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function num(v) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? String(n) : "0";
}
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
