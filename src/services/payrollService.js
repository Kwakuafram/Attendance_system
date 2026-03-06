import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { accraMonthKey, accraMonthName } from "../utils/month";
import { getUserProfile } from "./attendanceService";

// doc id pattern for monthly payroll adjustments
export function payrollDocId(uid, monthKey) {
  return `${uid}_${monthKey}`;
}

function sumOtherDeductions(otherDeductions) {
  if (!Array.isArray(otherDeductions)) return 0;
  return otherDeductions.reduce((sum, d) => sum + Number(d?.amount ?? 0), 0);
}

// Sum monthly late penalties from attendance
export async function getMonthlyLatePenalty(uid, monthKey) {
  const q = query(
    collection(db, "attendance"),
    where("teacherId", "==", uid),
    where("monthKey", "==", monthKey),
    where("isLate", "==", true)
  );

  const snap = await getDocs(q);

  let lateCount = 0;
  let penaltyTotal = 0;

  snap.forEach((d) => {
    const row = d.data();
    lateCount += 1;
    penaltyTotal += Number(row.latePenalty ?? 0);
  });

  return { lateCount, penaltyTotal };
}

// Read admin-entered monthly adjustments/deductions
export async function getPayrollAdjustments(uid, monthKey) {
  const ref = doc(db, "payroll_adjustments", payrollDocId(uid, monthKey));
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Save/overwrite monthly adjustments (admin)
export async function upsertPayrollAdjustments({
  teacherId,
  monthKey,
  otherDeductions, // array: [{id,label,amount}]
  welfareOverride = null, // optional
  ssnitRateOverride = null, // optional
  adminUid,
}) {
  const ref = doc(db, "payroll_adjustments", payrollDocId(teacherId, monthKey));

  await setDoc(
    ref,
    {
      teacherId,
      monthKey,

      otherDeductions: Array.isArray(otherDeductions) ? otherDeductions : [],

      // Optional overrides (null means use defaults)
      welfareOverride,
      ssnitRateOverride,

      updatedAt: serverTimestamp(),
      updatedBy: adminUid || null,

      // create metadata if missing
      createdAt: serverTimestamp(),
      createdBy: adminUid || null,
    },
    { merge: true }
  );
}

// Main payroll computation
export async function getPayrollSummary(uid, monthKey = accraMonthKey()) {
  const profile = await getUserProfile(uid);
  const base = Number(profile?.baseMonthlySalary ?? 0);

  const { lateCount, penaltyTotal: totalLatePenalty } =
    await getMonthlyLatePenalty(uid, monthKey);

  const adj = await getPayrollAdjustments(uid, monthKey);

  // Defaults
  const defaultSsnitRate = 0.055;
  const defaultWelfare = 20;

  const ssnitRate = Number(adj?.ssnitRateOverride ?? defaultSsnitRate);
  const welfare = Number(adj?.welfareOverride ?? defaultWelfare);

  const ssnit = base * ssnitRate;

  const otherDeductions = Array.isArray(adj?.otherDeductions) ? adj.otherDeductions : [];
  const otherDeductionsTotal = sumOtherDeductions(otherDeductions);

  const totalDeductions =
    Number(totalLatePenalty) + Number(ssnit) + Number(welfare) + Number(otherDeductionsTotal);

  const net = Math.max(0, base - totalDeductions);

  return {
    teacherId: uid,
    teacherName: profile?.fullName || "",
    monthKey,
    monthName: accraMonthName(),
    currency: "GHS",

    baseSalary: base,

    lateCount,
    totalLatePenalty,

    ssnitRate,
    ssnit,

    welfare,

    otherDeductions,
    otherDeductionsTotal,

    totalDeductions,
    netSalary: net,
  };
}

// payrollService.js

// ... your existing exports, including getPayrollSummary(...)

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Loads payroll for multiple teachers for a given monthKey.
 * Requires getPayrollSummary(uid, monthKey) to exist in this file.
 */
export async function getPayrollSummariesForTeachers(teachers, monthKey, concurrency = 6) {
  const ids = (teachers || []).map((t) => t.id).filter(Boolean);
  const batches = chunk(ids, Math.max(1, concurrency));

  const results = [];
  for (const batch of batches) {
    const rows = await Promise.all(batch.map((uid) => getPayrollSummary(uid, monthKey)));
    results.push(...rows);
  }

  results.sort((a, b) =>
    String(a.teacherName || "").localeCompare(String(b.teacherName || ""))
  );

  return results;
}

