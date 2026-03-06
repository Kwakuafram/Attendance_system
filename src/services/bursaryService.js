import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  runTransaction,
  increment,
  orderBy,
  limit,
  startAfter,
  
} from "firebase/firestore";
import { db } from "../firebase";

// ----------------------------
// Helpers
// ----------------------------
export function dateKey(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ISO week helper (for WEEKLY periodKey)
function getISOWeekKey(dateObj) {
  const d = new Date(
    Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const yyyy = d.getUTCFullYear();
  return `${yyyy}-W${String(weekNo).padStart(2, "0")}`;
}

export function getPeriodKey({ billingPlan, selectedDate }) {
  const [y, m, d] = String(selectedDate).split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);

  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");

  switch (String(billingPlan || "").toUpperCase()) {
    case "DAILY":
      return selectedDate;
    case "WEEKLY":
      return getISOWeekKey(dt);
    case "MONTHLY":
      return `${yyyy}-${mm}`;
    case "TERMLY":
      return `${yyyy}-TERM`;
    default:
      return selectedDate;
  }
}

// ----------------------------
// DAILY pricing (optional; you already have this logic)
// ----------------------------
export const PRICING = {
  PRESCHOOL: { feeding: 8, fees: 6, classes: 1, healthMaintenance: 0.8, pta: 0.2 },
  BASIC: { feeding: 10, fees: 5, classes: 1, healthMaintenance: 0.8, pta: 0.2 },
};

// ----------------------------
// FEES DUE
// ----------------------------
export const DUE_BY_GROUP = {
  PRESCHOOL: { feesDue: 340, healthMaintenanceDue: 60 },
  BASIC: { feesDue: 300, healthMaintenanceDue: 60 },
};

export function computeDueFromStudent(student) {
  const group =
    String(student?.classGroup || "").toUpperCase() === "PRESCHOOL"
      ? "PRESCHOOL"
      : "BASIC";

  const due = DUE_BY_GROUP[group];
  const totalDue = Number(due.feesDue) + Number(due.healthMaintenanceDue);

  return {
    classGroup: group,
    feesDue: Number(due.feesDue),
    healthMaintenanceDue: Number(due.healthMaintenanceDue),
    totalDue,
  };
}

export function getStudentBillingPlan(student) {
  const plan = String(student?.billingPlan || "DAILY").toUpperCase();
  if (["DAILY", "WEEKLY", "MONTHLY", "TERMLY"].includes(plan)) return plan;
  return "DAILY";
}

export function computeAmountsFromStudent(student) {
  const className = String(student?.className || "").toLowerCase();
  const groupFromDoc = student?.classGroup;

  const inferredPreschool =
    className.includes("creche") ||
    className.includes("nursery") ||
    className.includes("kg1") ||
    className.includes("kg2") ||
    className.includes("kg 1") ||
    className.includes("kg 2");

  const classGroup =
    groupFromDoc === "PRESCHOOL" || groupFromDoc === "BASIC"
      ? groupFromDoc
      : inferredPreschool
      ? "PRESCHOOL"
      : "BASIC";

  const base = PRICING?.[classGroup] ?? PRICING.BASIC;

  const feeExempt = student?.feeExempt === true;
  const hmExempt = student?.healthMaintenanceExempt === true;
  const ptaExempt = student?.ptaExempt === true;

  const feedingExempt = student?.feedingExempt === true;
  const classesExempt = student?.classesExempt === true;

  const feeding = feedingExempt ? 0 : Number(base.feeding || 0);
  const classes = classesExempt ? 0 : Number(base.classes || 0);

  const fees = feeExempt ? 0 : Number(base.fees || 0);
  const healthMaintenance = hmExempt ? 0 : Number(base.healthMaintenance || 0);
  const pta = ptaExempt ? 0 : Number(base.pta || 0);

  const total = feeding + fees + classes + healthMaintenance + pta;

  return { classGroup, feeding, fees, classes, healthMaintenance, pta, total };
}

function encodeStudentPath(studentPath) {
  return String(studentPath).replaceAll("/", "|");
}

function totalsDocIdFromStudent(student) {
  const p = student?.studentPath || student?.id;
  if (!p) throw new Error("Missing studentPath.");
  return encodeStudentPath(p);
}

// ----------------------------
// Reads
// ----------------------------
export async function listPaymentsByDate(date) {
  if (!date) throw new Error("Missing date.");
  const qy = query(collection(db, "bursary_payments"), where("date", "==", date));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listAllStudentTotals() {
  const snap = await getDocs(collection(db, "bursary_student_totals"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listAllBursaryAccounts() {
  const snap = await getDocs(collection(db, "bursary_accounts"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Read accounts for just a subset of students (chunked by 10 due to Firestore 'in' limit).
 * studentPaths: ["classes/{classId}/students/{studentId}", ...]
 */
export async function listAccountsByStudentPaths(studentPaths = []) {
  const paths = Array.isArray(studentPaths) ? studentPaths.filter(Boolean) : [];
  if (!paths.length) return [];

  const results = [];
  const chunkSize = 10;

  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);

    // docId in bursary_accounts is encoded studentPath (slashes -> pipes)
    const ids = chunk.map((p) => encodeStudentPath(p));

    const qy = query(
      collection(db, "bursary_accounts"),
      where("__name__", "in", ids)
    );

    const snap = await getDocs(qy);
    results.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  return results;
}

// ----------------------------
// Writes
// ----------------------------
export async function markStudentPayment({
  date,
  student,
  createdByUid,
  createdByName,
  manualTotal,
  periodKeyOverride,
}) {
  if (!date) throw new Error("Missing date.");
  if (!student?.studentPath) throw new Error("Missing studentPath.");
  if (!createdByUid) throw new Error("Not signed in.");

  const billingPlan = getStudentBillingPlan(student);
  const periodKey = periodKeyOverride || getPeriodKey({ billingPlan, selectedDate: date });
  const due = computeDueFromStudent(student);

  let items;
  let total;
  let classGroup;

  if (billingPlan === "DAILY") {
    const a = computeAmountsFromStudent(student);
    classGroup = a.classGroup;
    items = {
      fees: a.fees,
      feeding: a.feeding,
      healthMaintenance: a.healthMaintenance,
      classes: a.classes,
      pta: a.pta,
    };
    total = a.total;
  } else {
    const t = Number(manualTotal);
    if (!Number.isFinite(t) || t <= 0) throw new Error("Enter a valid amount.");

    const a = computeAmountsFromStudent(student);
    classGroup = a.classGroup;

    items = {
      fees: 0,
      feeding: 0,
      healthMaintenance: 0,
      classes: 0,
      pta: 0,
      manual: t,
    };
    total = t;
  }

  const now = serverTimestamp();

  const totalsDocId = totalsDocIdFromStudent(student);
  const totalsRef = doc(db, "bursary_student_totals", totalsDocId);
  const accountRef = doc(db, "bursary_accounts", totalsDocId);

  const feePaidDelta =
    billingPlan === "DAILY" ? Number(items.fees || 0) : Number(items.manual || 0);

  const hmPaidDelta =
    billingPlan === "DAILY" ? Number(items.healthMaintenance || 0) : 0;

  return await runTransaction(db, async (tx) => {
    const totalsSnap = await tx.get(totalsRef);
    const accountSnap = await tx.get(accountRef);

    const paymentRef = doc(collection(db, "bursary_payments"));
    tx.set(paymentRef, {
      date,
      periodKey,
      billingPlan,

      studentId: student.studentPath,
      studentPath: student.studentPath,

      studentName: student.fullName || "—",
      classId: student.classId || "",
      className: student.className || "—",
      classGroup: classGroup || due.classGroup,

      items,
      total,

      status: "PAID",
      createdByUid,
      createdByName: createdByName || "",
      createdAt: now,
      updatedAt: now,
    });

    if (!totalsSnap.exists()) {
      tx.set(totalsRef, {
        studentId: student.studentPath,
        studentPath: student.studentPath,
        studentName: student.fullName || "—",
        className: student.className || "—",
        classGroup: classGroup || due.classGroup,

        totalPaid: total,
        lastPaymentAt: now,

        feesPaid: Number(items.fees || 0),
        feedingPaid: Number(items.feeding || 0),
        healthMaintenancePaid: Number(items.healthMaintenance || 0),
        classesPaid: Number(items.classes || 0),
        ptaPaid: Number(items.pta || 0),
        manualPaid: Number(items.manual || 0),
      });
    } else {
      tx.update(totalsRef, {
        totalPaid: increment(total),
        lastPaymentAt: now,

        feesPaid: increment(Number(items.fees || 0)),
        feedingPaid: increment(Number(items.feeding || 0)),
        healthMaintenancePaid: increment(Number(items.healthMaintenance || 0)),
        classesPaid: increment(Number(items.classes || 0)),
        ptaPaid: increment(Number(items.pta || 0)),
        manualPaid: increment(Number(items.manual || 0)),
      });
    }

    if (!accountSnap.exists()) {
      const totalPaidFeesHM = feePaidDelta + hmPaidDelta;

      tx.set(accountRef, {
        studentId: student.studentPath,
        studentPath: student.studentPath,
        studentName: student.fullName || "—",
        className: student.className || "—",
        classGroup: due.classGroup,

        feesDue: due.feesDue,
        healthMaintenanceDue: due.healthMaintenanceDue,
        totalDue: due.totalDue,

        feesPaid: feePaidDelta,
        healthMaintenancePaid: hmPaidDelta,
        totalPaidFeesHM,

        updatedAt: now,
      });
    } else {
      tx.update(accountRef, {
        feesDue: due.feesDue,
        healthMaintenanceDue: due.healthMaintenanceDue,
        totalDue: due.totalDue,

        feesPaid: increment(feePaidDelta),
        healthMaintenancePaid: increment(hmPaidDelta),
        totalPaidFeesHM: increment(feePaidDelta + hmPaidDelta),

        updatedAt: now,
      });
    }

    return { id: paymentRef.id };
  });
}

export async function deletePayment(paymentId) {
  if (!paymentId) throw new Error("Missing paymentId.");
  await deleteDoc(doc(db, "bursary_payments", paymentId));
}

// ----------------------------
// Students pagination (collection group)
// ----------------------------
export async function listStudentsPage({ pageSize = 25, cursorDoc = null }) {
  // Ensure stable ordering for pagination
  const base = query(
    collectionGroup(db, "students"),
    orderBy("fullName"),
    orderBy("__name__"),
    limit(pageSize)
  );

  const qy = cursorDoc
    ? query(
        collectionGroup(db, "students"),
        orderBy("fullName"),
        orderBy("__name__"),
        startAfter(cursorDoc),
        limit(pageSize)
      )
    : base;

  const snap = await getDocs(qy);

  const rows = snap.docs.map((s) => {
    const data = s.data() || {};
    const studentPath = s.ref.path;

    const parts = studentPath.split("/");
    const classId = parts[1];

    return {
      id: studentPath,
      studentDocId: s.id,
      studentPath,

      fullName: data.fullName || "—",
      status: data.status || "ACTIVE",

      classId,
      className: data.className || "—",
      classGroup: data.classGroup || null,

      billingPlan: String(data.billingPlan || "DAILY").toUpperCase(),

      feeExempt: data.feeExempt === true,
      healthMaintenanceExempt: data.healthMaintenanceExempt === true,
      ptaExempt: data.ptaExempt === true,

      ...data,
    };
  });

  const last = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;

  return {
    rows,
    lastDoc: last,
    hasMore: snap.docs.length === pageSize,
  };
}
