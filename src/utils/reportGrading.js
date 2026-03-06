// src/utils/reportGrading.js

export function gradeFromTotal(total) {
  const t = Number(total);

  if (!Number.isFinite(t)) {
    return { grade: "", remark: "" };
  }

  if (t >= 90 && t <= 100) return { grade: "A+", remark: "EP Excellent Performance" };
  if (t >= 80 && t <= 89) return { grade: "A", remark: "VGP Very Good Performance" };
  if (t >= 70 && t <= 79) return { grade: "B", remark: "GP Good Performance" };
  if (t >= 60 && t <= 69) return { grade: "C", remark: "AP Advance Performance" };
  if (t >= 50 && t <= 59) return { grade: "D", remark: "PLP Proficiency Level Performance" };
  if (t >= 40 && t <= 49) return { grade: "E", remark: "BP Beginner’s Performance" };
  if (t >= 30 && t <= 39) return { grade: "N.G.P", remark: "PBE Performance Below Expectation" };
  if (t >= 0 && t <= 29) return { grade: "", remark: "PBE No Grade Possible" };

  return { grade: "", remark: "" };
}

export function toNumberOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toNumberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
