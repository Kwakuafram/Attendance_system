import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import schoolLogo from "../assets/schoollogo.jpeg"; // adjust path + filename
import toast from "react-hot-toast";
import { useLanguage } from "../i18n/useLanguage";
import LanguageSwitcher from "../i18n/LanguageSwitcher";
import { getAdminQuote } from "../utils/adminQuotes";
import { accraYyyyMmDd } from "../utils/accraTime";
import { isSchoolDay, getHolidayName } from "../utils/ghanaHolidays";
import { createReceipt as createFeeReceipt } from "../services/feeReceiptService";
import { computeAndWriteBasicPositions } from "../services/reportPositionsService";
import {
  getPayrollSummary,
  upsertPayrollAdjustments,
} from "../services/payrollService";

import TrialTestEntryCard from "../pages/TrialTestEntryCard.jsx";

import { getPayrollSummariesForTeachers } from "../services/payrollService";
import { printPayrollPdf } from "../services/payrollPrintService";
// ✅ IMPORTANT: import ONLY what exists in the service
import { printTeacherPayrollRegisterPdf } from "../services/teacherPayrollRegisterPrintService";

import {
  getAdminTodayOverview,
  getAdminDailyTrends,
} from "../services/adminAnalyticsService";

import { ensureSchoolConfig, getSchoolConfig } from "../services/schoolService";
import { generateDailyCodesForStaff, getTodayDailyCodes } from "../services/dailyCodeService";
import {
  adminApproveCheckIn,
  adminRejectCheckIn,
  adminListPendingCheckIns,
  adminListPendingCheckOuts,
  adminApproveCheckOut,
  adminRejectCheckOut,
} from "../services/attendanceService";

import {
  adminGetTodayAttendanceSessionsForAllClasses,
  adminGetAbsentList,
  adminOverrideAttendance,
  getStudentAttendanceRates,
  getStudentsForClass,
} from "../services/studentAttendanceService";

import {
  listPaymentsByDateRange,
  groupDailyTotals,
} from "../services/bursaryAdminService";

import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  deleteDoc,
  orderBy,
  getDoc,
  limit,
} from "firebase/firestore";

import {
  getBlockedTeachers,
  unblockTeacher,
  getTeacherAbsenceReasons,
  getAllRecentAbsenceReasons,
} from "../services/absenceReasonService";
import {
  sendBroadcastNotification,
  sendUserNotification,
  getAllNotifications,
} from "../services/notificationService";
import {
  getPendingLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
} from "../services/leaveRequestService";
import { logAudit, getRecentAuditLog, AUDIT_ACTIONS } from "../services/auditService";
import TeacherWeeklyAssessment from "../pages/TeacherWeeklyAssessment";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

export default function AdminDashboard({ profile }) {
  const user = auth.currentUser;
  const { t } = useLanguage();

  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Holiday Banner or Daily Motivational Quote
  const todayStr = accraYyyyMmDd();
  const holidayName = useMemo(() => getHolidayName(todayStr), [todayStr]);
  const dailyQuote = useMemo(() => {
    if (!isSchoolDay(todayStr)) return null;
    return getAdminQuote(todayStr);
  }, [todayStr]);

  // School settings editing
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    lateAfterMinutes: "",
    codeExpiresMinutes: "",
    penaltyPerLate: "",
    currency: "",
  });

  // Class editing
  const [editingClass, setEditingClass] = useState(null);
  const [editClassName, setEditClassName] = useState("");
  const [editClassTeacherId, setEditClassTeacherId] = useState("");

  // Student editing
  const [editingStudent, setEditingStudent] = useState(null);
  const [editStudentName, setEditStudentName] = useState("");

  // Teacher attendance history
  const [teacherHistoryUid, setTeacherHistoryUid] = useState(null);
  const [teacherHistory, setTeacherHistory] = useState([]);
  const [historyBusy, setHistoryBusy] = useState(false);

  // School + checkins
  const [school, setSchool] = useState(null);
  const [dailyCodes, setDailyCodes] = useState(null); // { date, codes: { uid: code } }
  const [pending, setPending] = useState([]);
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [pendingOut, setPendingOut] = useState([]);
const [rejectingOut, setRejectingOut] = useState(null);
const [rejectReasonOut, setRejectReasonOut] = useState("");

// ============================
// Payroll (Admin)
// ============================
const [payrollMonth, setPayrollMonth] = useState(""); // e.g. 2026-01
const [payrollTeacherId, setPayrollTeacherId] = useState("");
const [payrollBusy, setPayrollBusy] = useState(false);
const [payrollSummary, setPayrollSummary] = useState(null);

const [deductionLabel, setDeductionLabel] = useState("");
const [deductionAmount, setDeductionAmount] = useState("");
const [payrollOtherDeductions, setPayrollOtherDeductions] = useState([]); // [{id,label,amount}]

  // Teachers
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [editFullName, setEditFullName] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editSalary, setEditSalary] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Student attendance sessions (today)
  const [todaySessions, setTodaySessions] = useState([]);
  const [sessionsBusy, setSessionsBusy] = useState(false);
  const [openSessionId, setOpenSessionId] = useState("");
  const [openAbsent, setOpenAbsent] = useState([]);
  const [absentBusy, setAbsentBusy] = useState(false);

  // Student attendance rates (Feature 8)
  const [studentRates, setStudentRates] = useState(new Map());
  const [ratesBusy, setRatesBusy] = useState(false);

  // Admin override (Feature 9)
  const [overrideBusy, setOverrideBusy] = useState(null); // studentId being overridden
  const [overrideStudents, setOverrideStudents] = useState([]); // class students for override dropdown
  const [overrideAddId, setOverrideAddId] = useState(""); // student to mark absent

  // Receipts
  const [receiptStudentId, setReceiptStudentId] = useState("");
  const [receiptStudentName, setReceiptStudentName] = useState("");
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptMethod, setReceiptMethod] = useState("CASH");
  const [receiptRef, setReceiptRef] = useState("");
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [todayReceipts, setTodayReceipts] = useState([]);
  const [lastReceipt, setLastReceipt] = useState(null);

  const [todayOverview, setTodayOverview] = useState(null);

  const [trendFrom, setTrendFrom] = useState(""); // YYYY-MM-DD
  const [trendTo, setTrendTo] = useState(""); // YYYY-MM-DD
  const [trends, setTrends] = useState(null);

  // Export CSV
  const [exportMonth, setExportMonth] = useState("");

  // Class setup
  const [classes, setClasses] = useState([]);
  const [className, setClassName] = useState("");
  const [classTeacherId, setClassTeacherId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState([]);
  const [studentName, setStudentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentName, setParentName] = useState("");

  // Bursary totals
  const [bursaryFrom, setBursaryFrom] = useState("");
  const [bursaryTo, setBursaryTo] = useState("");
  const [bursaryBusy, setBursaryBusy] = useState(false);
  const [dailyTotals, setDailyTotals] = useState([]);

  // ============================
  // Blocked Teachers
  // ============================
  const [blockedTeachers, setBlockedTeachers] = useState([]);
  const [selectedBlockedTeacher, setSelectedBlockedTeacher] = useState(null);
  const [blockedTeacherReasons, setBlockedTeacherReasons] = useState([]);
  const [blockedBusy, setBlockedBusy] = useState(false);
  const [recentAbsenceReasons, setRecentAbsenceReasons] = useState([]);

  // ============================
  // Leave Requests (Admin)
  // ============================
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [leaveRejectReason, setLeaveRejectReason] = useState("");
  const [leaveRejectingId, setLeaveRejectingId] = useState(null);
  const [leaveBusy, setLeaveBusy] = useState(false);

  // ============================
  // Notifications
  // ============================
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifRecipient, setNotifRecipient] = useState("ALL");
  const [notifBusy, setNotifBusy] = useState(false);
  const [sentNotifications, setSentNotifications] = useState([]);

  // ============================
  // Audit Log
  // ============================
  const [auditEntries, setAuditEntries] = useState([]);
  const [auditFilter, setAuditFilter] = useState("ALL");
  const [auditLoading, setAuditLoading] = useState(false);

  // ============================
  // Admin: Report Viewer (Print)
  // ============================
  const [reportClassId, setReportClassId] = useState("");
  const [reportStudents, setReportStudents] = useState([]);
  const [reportStudentId, setReportStudentId] = useState("");
  const [reportYear, setReportYear] = useState(
    String(new Date().getFullYear())
  );
  const [reportTerm, setReportTerm] = useState("1");
  const [reportBusy, setReportBusy] = useState(false);
  const [loadedReport, setLoadedReport] = useState(null);

  // Ranking map: studentId -> { total, position }
  const [classRanking, setClassRanking] = useState(new Map());

  // ===== Preschool constants (same keys as your Report form) =====
  const SUBJECT_KEYS = [
    "numeracy",
    "literacy",
    "creativeArts",
    "owop",
    "phonics",
  ];
  const SUBJECT_LABELS = {
    numeracy: "Numeracy",
    literacy: "Literacy",
    creativeArts: "Creative Arts",
    owop: "O.W.O.P",
    phonics: "Phonics",
  };

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

  const ATTITUDE_ITEMS = [
    { key: "confident", label: "Is confident." },
    { key: "workIndependently", label: "Can work independently." },
    {
      key: "askAnswerNoFear",
      label: "Can ask and answer questions without fear.",
    },
    { key: "participate", label: "Can participate during activities." },
    {
      key: "associateWithOthers",
      label: "Is good at associating with others.",
    },
    { key: "settleDisputes", label: "Good at settling disputes amicably" },
  ];

  function logFsError(tag, e) {
    console.error(`[${tag}]`, {
      code: e?.code,
      message: e?.message,
      name: e?.name,
      stack: e?.stack,
    });
  }

  // ---------- helpers ----------
  function minutesToHHMM(mins) {
    const m = Number(mins);
    if (!Number.isFinite(m)) return "06:20";
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function dateKey(d = new Date()) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function toDateKey(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  function safe(v) {
    return String(v ?? "")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function reportDocId(year, term) {
    return `${year}_T${term}`;
  }

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // Overall total for ranking: sum of (classScore + examsScore) for all subjects
  function calcOverallTotal(report) {
    const subjects = report?.subjects || {};
    return SUBJECT_KEYS.reduce((sum, k) => {
      const row = subjects?.[k] || {};
      const cs = Number(row.classScore ?? 0) || 0;
      const es = Number(row.examsScore ?? 0) || 0;
      return sum + cs + es;
    }, 0);
  }

  // Competition ranking: 1,2,2,4...
  function rankReportsByTotal(rows) {
    const sorted = [...rows].sort((a, b) => b.total - a.total);
    const out = new Map();

    let lastScore = null;
    let lastPos = 0;

    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const score = r.total;

      const pos = score === lastScore ? lastPos : i + 1;

      out.set(r.studentId, { total: score, position: pos });

      lastScore = score;
      lastPos = pos;
    }

    return out;
  }

  // ---------- bursary defaults ----------
  useEffect(() => {
    const to = toDateKey(new Date());
    const from = toDateKey(daysAgo(6));
    setBursaryFrom(from);
    setBursaryTo(to);
  }, []);

  useEffect(() => {
  // Default to current monthKey like "YYYY-MM"
  const d = new Date();
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  setPayrollMonth(month);
}, []);


  useEffect(() => {
    const original = toast.error;

    toast.error = (msg, ...rest) => {
      // Force display even if "Errors" are hidden
      console.log("TOAST.ERROR MESSAGE =>", msg);

      // Force a visible stack without groups
      const stack = new Error("toast.error origin").stack;
      console.log("TOAST.ERROR STACK =>\n", stack);

      return original(msg, ...rest);
    };

    return () => {
      toast.error = original;
    };
  }, []);

  function money(n) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}

async function printAllPayrollPdf() {
  toast.dismiss();
  setPayrollBusy(true);
  try {
    if (!payrollMonth) throw new Error("Select a payroll month (YYYY-MM).");
    if (!teachers.length) throw new Error("No teachers found.");

    const summaries = await getPayrollSummariesForTeachers(teachers, payrollMonth, 6);

    if (!summaries.length) throw new Error("No payroll data found.");

    printPayrollPdf({
      summaries,
      schoolName: "GREENIDGE INTERNATIONAL SCH.",
    });

    toast.success("Opening print dialog…");
  } catch (e) {
    toast.error(e?.message || "Failed to print payroll.");
  } finally {
    setPayrollBusy(false);
  }
}

 // ============================
  // Payroll: Print Register (ALL teachers)  ✅ FIXED (no undefined summaries)
  // ============================
  async function printTeachersPayrollRegister() {
    toast.dismiss();
    setPayrollBusy(true);

    // open window first to avoid popup blocking
    const w = window.open("", "_blank", "width=1200,height=800");
    if (!w) {
      toast.error("Popup blocked. Please allow popups for this site, then try again.");
      setPayrollBusy(false);
      return;
    }

    // show loading immediately
    w.document.open();
    w.document.write(`
      <html>
        <head><meta charset="utf-8" /><title>Preparing register…</title></head>
        <body style="font-family:Arial;padding:24px;">
          <h3>Preparing teachers payroll register…</h3>
          <p>Please wait.</p>
        </body>
      </html>
    `);
    w.document.close();

    try {
      if (!payrollMonth) throw new Error("Select a payroll month (YYYY-MM).");
      if (!teachers.length) throw new Error("No teachers found.");

      // ✅ summaries is defined here (fixes your ReferenceError)
 // 1) Fetch summaries
const summariesRaw = await getPayrollSummariesForTeachers(teachers, payrollMonth, 6);
if (!summariesRaw.length) throw new Error("No payroll data found.");

// 2) Attach user/teacher docs (from your users collection) to each summary
const teacherById = new Map(teachers.map((t) => [t.id, t]));

// If your payroll summaries use teacherId, this will work.
// If they use another key, add it below.
const summaries = summariesRaw.map((s) => {
  const teacher =
    teacherById.get(s.teacherId) ||
    teacherById.get(s.teacherUid) ||
    teacherById.get(s.userId) ||
    teacherById.get(s.uid) ||
    null;

  return { ...s, teacher };
});

const monthName = new Date(`${payrollMonth}-01`).toLocaleString(undefined, {
  month: "long",
  year: "numeric",
});

const preparedBy = profile?.fullName || user?.email || "";
const preparedAt = new Date().toLocaleString();

// 3) Print
printTeacherPayrollRegisterPdf({
  summaries,
  schoolName: "GREENIDGE INTERNATIONAL SCH.",
  monthKey: payrollMonth,
  monthName,
  currency: school?.currency || "GHS",
  preparedBy,
  preparedAt,
  targetWindow: w,
});


      toast.success("Opening print dialog…");
    } catch (e) {
      toast.error(e?.message || "Failed to print register.");
      try {
        w.document.open();
        w.document.write(`
          <html>
            <head><meta charset="utf-8" /><title>Error</title></head>
            <body style="font-family:Arial;padding:24px;">
              <h3>Failed to print register</h3>
              <pre style="white-space:pre-wrap;">${safe(e?.message || e)}</pre>
            </body>
          </html>
        `);
        w.document.close();
      } catch { /* print window blocked */ }
    } finally {
      setPayrollBusy(false);
    }
  }


async function loadPayroll() {
  toast.dismiss();
  setPayrollBusy(true);
  setPayrollSummary(null);

  try {
    if (!payrollMonth) throw new Error("Select a payroll month (YYYY-MM).");
    if (!payrollTeacherId) throw new Error("Select a teacher.");

    const res = await getPayrollSummary(payrollTeacherId, payrollMonth);
    setPayrollSummary(res);

    // Use loaded other deductions as editable state
    setPayrollOtherDeductions(res.otherDeductions || []);

    toast.success("Payroll loaded.");
  } catch (e) {
    toast.error(e?.message || "Failed to load payroll.");
  } finally {
    setPayrollBusy(false);
  }
}

function addOtherDeduction() {
  toast.dismiss();

  const label = String(deductionLabel || "").trim();
  const amt = Number(deductionAmount);

  if (!label) {
    toast.error("Enter deduction label.");
    return;
  }
  if (!Number.isFinite(amt) || amt <= 0) {
    toast.error("Enter a valid deduction amount.");
    return;
  }

  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  setPayrollOtherDeductions((prev) => [
    ...prev,
    { id, label, amount: amt },
  ]);

  setDeductionLabel("");
  setDeductionAmount("");
}

function removeOtherDeduction(id) {
  setPayrollOtherDeductions((prev) => prev.filter((x) => x.id !== id));
}

async function savePayrollDeductions() {
  toast.dismiss();
  setPayrollBusy(true);
  try {
    if (!user?.uid) throw new Error("Not signed in.");
    if (!payrollMonth) throw new Error("Select payroll month.");
    if (!payrollTeacherId) throw new Error("Select teacher.");

    await upsertPayrollAdjustments({
      teacherId: payrollTeacherId,
      monthKey: payrollMonth,
      otherDeductions: payrollOtherDeductions,
      adminUid: user.uid,
    });

    // Reload payroll to reflect recomputed net
    const res = await getPayrollSummary(payrollTeacherId, payrollMonth);
    setPayrollSummary(res);
    setPayrollOtherDeductions(res.otherDeductions || []);

    toast.success("Payroll deductions saved.");
  } catch (e) {
    toast.error(e?.message || "Failed to save payroll deductions.");
  } finally {
    setPayrollBusy(false);
  }
}


  async function loadBursaryDailyTotals(from, to) {
    setBursaryBusy(true);
    try {
      const payments = await listPaymentsByDateRange(from, to);
      const grouped = groupDailyTotals(payments);
      setDailyTotals(grouped);
    } finally {
      setBursaryBusy(false);
    }
  }

  async function loadTrends() {
    toast.dismiss();
    try {
      if (!trendFrom || !trendTo) throw new Error("Select Trend From and To.");
      const res = await getAdminDailyTrends(trendFrom, trendTo);
      setTrends(res);
      toast.success("Trends loaded.");
    } catch (e) {
      toast.error(e?.message || "Failed to load trends.");
    }
  }

  // ---------- refresh ----------
  async function loadTodayReceipts() {
    const today = dateKey();
    const rq = query(
      collection(db, "fee_receipts"),
      where("date", "==", today),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const snap = await getDocs(rq);
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setTodayReceipts(rows);
  }

  async function refresh() {
    const s = await getSchoolConfig();
    setSchool(s);

    // Load per-user daily codes
    const dc = await getTodayDailyCodes();
    setDailyCodes(dc);

    const list = await adminListPendingCheckIns();
    setPending(list);
    const outList = await adminListPendingCheckOuts(); // defaults to today
setPendingOut(outList);


    const tq = query(collection(db, "users"), where("role", "in", ["TEACHER", "NON_TEACHER"]));
    const tsnap = await getDocs(tq);
    const trows = tsnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setTeachers(trows);

    // Student attendance sessions
    try {
      setSessionsBusy(true);
      const sessions = await adminGetTodayAttendanceSessionsForAllClasses();
      setTodaySessions(sessions);
    } finally {
      setSessionsBusy(false);
    }

    // Classes
    const csnap = await getDocs(collection(db, "classes"));
    const crows = csnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setClasses(crows);

    if (!selectedClassId && crows.length) {
      setSelectedClassId(crows[0].id);
    }

    await loadTodayReceipts();

    if (bursaryFrom && bursaryTo) {
      await loadBursaryDailyTotals(bursaryFrom, bursaryTo);
    }

    // ===== Analytics: Today Overview =====
    try {
      const ov = await getAdminTodayOverview();
      setTodayOverview(ov);
    } catch (e) {
      // option
      // al: toast.error(e?.message || "Failed to load today overview");
      logFsError("AdminDashboard.refresh.TodayOverview", e);
    }

    // ===== Analytics: Trends (optional auto-load) =====
    try {
      if (trendFrom && trendTo) {
        const tr = await getAdminDailyTrends(trendFrom, trendTo);
        setTrends(tr);
      }
    } catch (e) {
      // optional
      logFsError("AdminDashboard.refresh.Trends", e);
    }

    // ===== Blocked teachers =====
    try {
      const blocked = await getBlockedTeachers();
      setBlockedTeachers(blocked);
    } catch (e) {
      logFsError("AdminDashboard.refresh.BlockedTeachers", e);
    }

    // ===== Recent absence reasons =====
    try {
      const reasons = await getAllRecentAbsenceReasons(30);
      setRecentAbsenceReasons(reasons);
    } catch (e) {
      logFsError("AdminDashboard.refresh.AbsenceReasons", e);
    }

    // ===== Pending leave requests =====
    try {
      const leaves = await getPendingLeaveRequests();
      setPendingLeaves(leaves);
    } catch (e) {
      logFsError("AdminDashboard.refresh.PendingLeaves", e);
    }
  }

  useEffect(() => {
    refresh().catch((e) =>
      toast.error(e?.message || "Failed to load admin data.")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const to = toDateKey(new Date());
    const from = toDateKey(daysAgo(13));
    setTrendFrom(from);
    setTrendTo(to);
  }, []);

  // ---------- load students for selected class (for receipts + roster) ----------
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setStudentRates(new Map());
      return;
    }

    (async () => {
      try {
        const ssnap = await getDocs(
          collection(db, "classes", selectedClassId, "students")
        );
        const srows = ssnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        srows.sort((a, b) =>
          String(a.fullName || "").localeCompare(String(b.fullName || ""))
        );
        setStudents(srows);
      } catch (e) {
        toast.error(e?.message || "Failed to load students.");
      }
    })();
  }, [selectedClassId]);

  useEffect(() => {
    const st = students.find((s) => s.id === receiptStudentId);
    if (st?.fullName) setReceiptStudentName(st.fullName);
  }, [receiptStudentId, students]);

  // ---------- Report Viewer: load class students ----------
  useEffect(() => {
    if (!reportClassId) {
      setReportStudents([]);
      setReportStudentId("");
      setLoadedReport(null);
      setClassRanking(new Map());
      return;
    }

    (async () => {
      try {
        const snap = await getDocs(
          collection(db, "classes", reportClassId, "students")
        );
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) =>
          String(a.fullName || "").localeCompare(String(b.fullName || ""))
        );
        setReportStudents(rows);
        setReportStudentId(rows[0]?.id || "");
        setLoadedReport(null);
        setClassRanking(new Map());
      } catch (e) {
        toast.error(e?.message || "Failed to load class students.");
      }
    })();
  }, [reportClassId]);

  // ---------- Pending checkins actions ----------
  async function handleReject(attendance) {
    setRejecting(attendance);
    setRejectReason("");
  }

  async function confirmReject() {
    toast.dismiss();
    setBusy(true);
    try {
      if (!user?.uid) throw new Error("Not signed in.");
      if (!rejecting?.id) throw new Error("No request selected.");
      if (!rejectReason.trim()) throw new Error("Enter a rejection reason.");

      await adminRejectCheckIn(rejecting.id, user.uid, rejectReason);
      logAudit({ action: AUDIT_ACTIONS.CHECKIN_REJECTED, actorId: user.uid, actorName: user.displayName || user.email, targetId: rejecting.id, details: rejectReason });
      setRejecting(null);
      setRejectReason("");
      await refresh();
      toast.success("Rejection successful.");
    } catch (e) {
      toast.error(e?.message || "Rejection failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove(attendanceId) {
    toast.dismiss();
    setBusy(true);
    try {
      if (!user?.uid) throw new Error("Not signed in.");
      await adminApproveCheckIn(attendanceId, user.uid);
      logAudit({ action: AUDIT_ACTIONS.CHECKIN_APPROVED, actorId: user.uid, actorName: user.displayName || user.email, targetId: attendanceId, details: "Check-in approved" });
      await refresh();
      toast.success("Approval successful.");
    } catch (e) {
      toast.error(e?.message || "Approval failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApproveOut(attendanceId) {
  toast.dismiss();
  setBusy(true);
  try {
    if (!user?.uid) throw new Error("Not signed in.");
    await adminApproveCheckOut(attendanceId, user.uid);
    await refresh();
    toast.success("Checkout approved.");
  } catch (e) {
    toast.error(e?.message || "Checkout approval failed.");
  } finally {
    setBusy(false);
  }
}

function handleRejectOut(attendance) {
  setRejectingOut(attendance);
  setRejectReasonOut("");
}

async function confirmRejectOut() {
  toast.dismiss();
  setBusy(true);
  try {
    if (!user?.uid) throw new Error("Not signed in.");
    if (!rejectingOut?.id) throw new Error("No request selected.");
    if (!rejectReasonOut.trim()) throw new Error("Enter a rejection reason.");

    await adminRejectCheckOut(rejectingOut.id, user.uid, rejectReasonOut);
    setRejectingOut(null);
    setRejectReasonOut("");
    await refresh();
    toast.success("Checkout rejected.");
  } catch (e) {
    toast.error(e?.message || "Checkout rejection failed.");
  } finally {
    setBusy(false);
  }
}


  // ============================
  // Blocked Teacher handlers
  // ============================
  async function handleViewBlockedTeacher(teacher) {
    setSelectedBlockedTeacher(teacher);
    setBlockedTeacherReasons([]);
    setBlockedBusy(true);
    try {
      const reasons = await getTeacherAbsenceReasons(teacher.uid, 20);
      setBlockedTeacherReasons(reasons);
    } catch (e) {
      toast.error(e?.message || "Failed to load absence reasons.");
    } finally {
      setBlockedBusy(false);
    }
  }

  async function handleUnblockTeacher(uid, teacherName) {
    if (!window.confirm(`Unblock "${teacherName || 'this teacher'}"? They will be able to check in again.`)) return;
    toast.dismiss();
    setBlockedBusy(true);
    try {
      await unblockTeacher(uid);
      logAudit({ action: AUDIT_ACTIONS.TEACHER_UNBLOCKED, actorId: user?.uid, actorName: user?.displayName || user?.email, targetId: uid, targetName: teacherName, details: "Teacher unblocked by admin" });
      setSelectedBlockedTeacher(null);
      setBlockedTeacherReasons([]);
      await refresh();
      toast.success("Teacher unblocked.");
    } catch (e) {
      toast.error(e?.message || "Failed to unblock teacher.");
    } finally {
      setBlockedBusy(false);
    }
  }


  async function handleGenerateOrRotateCode() {
    toast.dismiss();
    setBusy(true);
    try {
      if (!user?.uid) throw new Error("Not signed in.");
      if (!teachers.length) throw new Error("No staff loaded yet.");
      await ensureSchoolConfig(user.uid);
      await generateDailyCodesForStaff(user.uid, teachers);
      await refresh();
      toast.success(`Daily codes generated for ${teachers.length} staff members.`);
    } catch (e) {
      toast.error(e?.message || "Failed to generate daily codes.");
    } finally {
      setBusy(false);
    }
  }

  // ---------- School Settings ----------
  function openSettingsEditor() {
    setSettingsForm({
      lateAfterMinutes: String(school?.lateAfterMinutes ?? 375),
      codeExpiresMinutes: String(school?.codeExpiresMinutes ?? 380),
      penaltyPerLate: String(school?.penaltyPerLate ?? 5),
      currency: school?.currency ?? "GHS",
    });
    setEditingSettings(true);
  }

  async function handleSaveSettings() {
    toast.dismiss();
    setBusy(true);
    try {
      const ref = doc(db, "school", "main");
      await updateDoc(ref, {
        lateAfterMinutes: Number(settingsForm.lateAfterMinutes) || 375,
        codeExpiresMinutes: Number(settingsForm.codeExpiresMinutes) || 380,
        penaltyPerLate: Number(settingsForm.penaltyPerLate) || 5,
        currency: settingsForm.currency.trim() || "GHS",
        updatedAt: serverTimestamp(),
      });
      setEditingSettings(false);
      await refresh();
      toast.success("School settings updated.");
    } catch (e) {
      toast.error(e?.message || "Failed to update settings.");
    } finally {
      setBusy(false);
    }
  }

  // ---------- Class Edit / Delete ----------
  function openClassEditor(cls) {
    setEditingClass(cls);
    setEditClassName(cls.name || "");
    setEditClassTeacherId(cls.teacherUid || "");
  }

  async function handleSaveClass() {
    toast.dismiss();
    setBusy(true);
    try {
      if (!editingClass) return;
      const name = editClassName.trim();
      if (!name) throw new Error("Class name is required.");
      if (!editClassTeacherId) throw new Error("Select a teacher.");

      const teacher = teachers.find((t) => t.id === editClassTeacherId);
      if (!teacher) throw new Error("Teacher not found.");

      await updateDoc(doc(db, "classes", editingClass.id), {
        name,
        teacherUid: editClassTeacherId,
        teacherName: teacher.fullName || teacher.email || "Teacher",
        updatedAt: serverTimestamp(),
      });

      setEditingClass(null);
      await refresh();
      toast.success("Class updated.");
    } catch (e) {
      toast.error(e?.message || "Failed to update class.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteClass(cls) {
    if (!window.confirm(`Delete class "${cls.name}"? This will remove the class and all its students permanently.`)) return;
    toast.dismiss();
    setBusy(true);
    try {
      // Delete all students in the class first
      const studentsSnap = await getDocs(collection(db, "classes", cls.id, "students"));
      await Promise.all(studentsSnap.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, "classes", cls.id));
      logAudit({ action: AUDIT_ACTIONS.CLASS_DELETED, actorId: user?.uid, actorName: user?.displayName || user?.email, targetId: cls.id, targetName: cls.name, details: `Class "${cls.name}" deleted` });
      await refresh();
      if (selectedClassId === cls.id) {
        setSelectedClassId("");
        setStudents([]);
      }
      toast.success("Class deleted.");
    } catch (e) {
      toast.error(e?.message || "Failed to delete class.");
    } finally {
      setBusy(false);
    }
  }

  // ---------- Student Edit ----------
  function openStudentEditor(student) {
    setEditingStudent(student);
    setEditStudentName(student.fullName || "");
  }

  async function handleSaveStudent() {
    toast.dismiss();
    setBusy(true);
    try {
      if (!editingStudent || !selectedClassId) return;
      const name = editStudentName.trim();
      if (!name) throw new Error("Student name is required.");

      await updateDoc(
        doc(db, "classes", selectedClassId, "students", editingStudent.id),
        { fullName: name, updatedAt: serverTimestamp() }
      );

      setEditingStudent(null);
      // Refresh student list
      const ssnap = await getDocs(collection(db, "classes", selectedClassId, "students"));
      const srows = ssnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      srows.sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || "")));
      setStudents(srows);
      toast.success("Student name updated.");
    } catch (e) {
      toast.error(e?.message || "Failed to update student.");
    } finally {
      setBusy(false);
    }
  }

  // ---------- Teacher Attendance History ----------
  async function loadTeacherHistory(teacherUid) {
    if (teacherHistoryUid === teacherUid) {
      setTeacherHistoryUid(null);
      setTeacherHistory([]);
      return;
    }
    setTeacherHistoryUid(teacherUid);
    setHistoryBusy(true);
    try {
      const q2 = query(
        collection(db, "attendance"),
        where("teacherId", "==", teacherUid),
        orderBy("date", "desc"),
        limit(30)
      );
      const snap = await getDocs(q2);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTeacherHistory(rows);
    } catch (e) {
      toast.error(e?.message || "Failed to load attendance history.");
      setTeacherHistory([]);
    } finally {
      setHistoryBusy(false);
    }
  }

  // ---------- Receipts ----------
  function printReceipt(r) {
    if (!r) return;

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${safe(r.dailyNo)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    .box { max-width: 380px; margin: 0 auto; border: 1px solid #ddd; padding: 16px; border-radius: 10px; }
    .header { position: relative; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid #eee; }
    .schoolName { text-align: center; font-weight: 800; font-size: 16px; margin: 0; }
    .subtitle { text-align: center; color: #555; font-size: 12px; margin-top: 4px; }
    .logo { position: absolute; right: 0; top: 0; width: 46px; height: 46px; object-fit: contain; }
    .muted { color: #555; font-size: 12px; }
    .row { display: flex; justify-content: space-between; margin-top: 10px; font-size: 13px; }
    .hr { border-top: 1px dashed #ccc; margin: 12px 0; }
    .total { font-weight: 700; font-size: 14px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="header">
      <img class="logo" src="${schoolLogo}" alt="School logo" />
      <div class="schoolName">${safe("GREENIDGE INTERNATIONAL SCH.")}</div>
      <div class="subtitle">School Fees Receipt</div>
    </div>

    <div class="muted">Daily No: ${safe(r.dailyNo)}</div>
    <div class="muted">Term No: ${safe(r.termNo)}</div>
    <div class="muted">Date: ${safe(r.date)}</div>
    <div class="hr"></div>

    <div class="row"><div>Student</div><div>${safe(r.studentName)}</div></div>
    <div class="row"><div>Class</div><div>${safe(
      r.className || "—"
    )}</div></div>
    <div class="row"><div>Method</div><div>${safe(r.paymentMethod)}</div></div>
    <div class="row"><div>Reference</div><div>${safe(
      r.reference || "—"
    )}</div></div>

    <div class="hr"></div>
    <div class="row total"><div>Amount</div><div>${safe(r.currency)} ${safe(
      r.amount
    )}</div></div>

    <div class="hr"></div>
    <div class="muted">Issued by: ${safe(r.createdByName || "")}</div>
  </div>

  <script>window.print();</script>
</body>
</html>
`;
    const w = window.open("", "_blank", "width=500,height=700");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  async function handleCreateReceipt() {
    toast.dismiss();
    setReceiptBusy(true);
    try {
      if (!user?.uid) throw new Error("Not signed in.");

      const cls = classes.find((c) => c.id === selectedClassId);

      const created = await createFeeReceipt({
        receiptType: "FEES",
        adminUid: user.uid,
        adminName: profile?.fullName || user.email || "",
        studentName: receiptStudentName,
        studentId: receiptStudentId || "",
        classId: selectedClassId || "",
        className: cls?.name || "",
        amount: receiptAmount,
        currency: school?.currency || "GHS",
        paymentMethod: receiptMethod,
        reference: receiptRef,
        purpose: "SCHOOL_FEES",
      });

      setLastReceipt(created);
      setReceiptAmount("");
      setReceiptRef("");
      setReceiptStudentId("");
      setReceiptStudentName("");

      await loadTodayReceipts();
      toast.success("Receipt created.");

      printReceipt(created);
    } catch (e) {
      toast.error(e?.message || "Failed to create receipt.");
    } finally {
      setReceiptBusy(false);
    }
  }

  // ---------- Teacher editing ----------
  const filteredTeachers = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return teachers;

    return teachers.filter((t) => {
      const name = (t.fullName || "").toLowerCase();
      const email = (t.email || "").toLowerCase();
      const contact = (t.contact || "").toLowerCase();
      const address = (t.address || "").toLowerCase();
      return (
        name.includes(s) ||
        email.includes(s) ||
        contact.includes(s) ||
        address.includes(s)
      );
    });
  }, [teachers, search]);

  function openTeacher(t) {
    setSelectedTeacher(t);
    setEditFullName(t.fullName || "");
    setEditContact(t.contact || "");
    setEditAddress(t.address || "");
    setEditSalary(
      t.baseMonthlySalary != null ? String(t.baseMonthlySalary) : ""
    );
    setEditEmail(t.email || "");
  }

  async function handleSaveTeacher() {
    toast.dismiss();
    setBusy(true);
    try {
      if (!selectedTeacher?.id) throw new Error("No teacher selected.");

      const salaryNum = editSalary.trim() === "" ? 0 : Number(editSalary);
      if (!Number.isFinite(salaryNum) || salaryNum < 0) {
        throw new Error("Salary must be a valid number.");
      }

      await updateDoc(doc(db, "users", selectedTeacher.id), {
        fullName: editFullName.trim(),
        contact: editContact.trim(),
        address: editAddress.trim(),
        baseMonthlySalary: salaryNum,
        email: editEmail.trim(),
        updatedAt: new Date(),
      });

      toast.success("Teacher updated.");
      setSelectedTeacher(null);
      await refresh();
    } catch (e) {
      toast.error(e?.message || "Failed to save teacher.");
    } finally {
      setBusy(false);
    }
  }

  // ---------- Student exemptions (optional fields on student doc) ----------
  async function updateStudentExemption(studentId, patch) {
    toast.dismiss();
    setBusy(true);

    try {
      if (!selectedClassId) throw new Error("No class selected.");

      await updateDoc(
        doc(db, "classes", selectedClassId, "students", studentId),
        {
          ...patch,
        }
      );

      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, ...patch } : s))
      );
      toast.success("Updated exemptions.");
    } catch (e) {
      toast.error(e?.message || "Failed to update exemptions.");
    } finally {
      setBusy(false);
    }
  }

  // ---------- Attendance sessions: toggle open + load absent list ----------
  async function toggleOpenSession(sessionId) {
    if (openSessionId === sessionId) {
      setOpenSessionId("");
      setOpenAbsent([]);
      setOverrideStudents([]);
      setOverrideAddId("");
      return;
    }

    setOpenSessionId(sessionId);
    setOpenAbsent([]);
    setOverrideStudents([]);
    setOverrideAddId("");
    setAbsentBusy(true);
    try {
      const [rows, session] = await Promise.all([
        adminGetAbsentList(sessionId),
        Promise.resolve(todaySessions.find((s) => s.id === sessionId)),
      ]);
      setOpenAbsent(rows);
      // Load class students for override dropdown
      if (session?.classId) {
        try {
          const sts = await getStudentsForClass(session.classId);
          setOverrideStudents(sts);
        } catch { /* ignore — override just won't show dropdown */ }
      }
    } catch (e) {
      toast.error(e?.message || "Failed to load absent list.");
    } finally {
      setAbsentBusy(false);
    }
  }

  // ---------- Admin override attendance (Feature 9) ----------
  async function handleOverride(studentId, studentName, action) {
    if (!openSessionId) return;
    setOverrideBusy(studentId);
    try {
      await adminOverrideAttendance(openSessionId, studentId, studentName, action);
      // Refresh absent list
      const rows = await adminGetAbsentList(openSessionId);
      setOpenAbsent(rows);
      // Update session counts in todaySessions
      setTodaySessions((prev) =>
        prev.map((s) => {
          if (s.id !== openSessionId) return s;
          const newAbsent = rows.length;
          return { ...s, absentCount: newAbsent, presentCount: s.totalStudents - newAbsent };
        })
      );
      setOverrideAddId("");
      toast.success(action === "MARK_PRESENT" ? "Student marked present." : "Student marked absent.");
    } catch (e) {
      toast.error(e?.message || "Override failed.");
    } finally {
      setOverrideBusy(null);
    }
  }

  // ---------- Load student attendance rates (Feature 8) ----------
  async function loadStudentRates() {
    if (!selectedClassId || !students.length) return;
    setRatesBusy(true);
    try {
      const rates = await getStudentAttendanceRates(selectedClassId, students.map((s) => s.id));
      setStudentRates(rates);
    } catch {
      toast.error("Failed to load attendance rates.");
    } finally {
      setRatesBusy(false);
    }
  }

  // ---------- Export CSV ----------
  function downloadCsv(filename, rows) {
    const escape = (v) => {
      const s = String(v ?? "");
      if (s.includes('"') || s.includes(",") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const header = Object.keys(rows[0] || {}).join(",");
    const body = rows
      .map((r) => Object.values(r).map(escape).join(","))
      .join("\n");
    const csv = `${header}\n${body}`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportMonthlyCsv() {
    toast.dismiss();
    setBusy(true);
    try {
      const monthKey = exportMonth.trim();
      if (!monthKey) throw new Error("Enter a monthKey like 2026-01.");

      const aq = query(
        collection(db, "attendance"),
        where("monthKey", "==", monthKey)
      );
      const snap = await getDocs(aq);

      const rows = snap.docs.map((d) => {
        const a = d.data();
        return {
          date: a.date || "",
          teacherId: a.teacherId || "",
          teacherName: a.teacherName || "",
          status: a.status || "",
          isLate: a.isLate === true ? "YES" : a.isLate === false ? "NO" : "",
          latePenalty: a.latePenalty ?? "",
          requestedAt: a.checkInRequestedAt
            ? a.checkInRequestedAt.toDate().toISOString()
            : "",
          approvedAt: a.checkInApprovedAt
            ? a.checkInApprovedAt.toDate().toISOString()
            : "",
          approvedBy: a.checkInApprovedBy || "",
          codeUsed: a.checkInCodeUsed || "",
          codeExpiredAtRequest: a.codeExpiredAtRequest ? "YES" : "NO",
        };
      });

      if (!rows.length)
        throw new Error("No attendance records found for this month.");

      downloadCsv(`attendance_${monthKey}.csv`, rows);
      toast.success("Export successful.");
    } catch (e) {
      toast.error(e?.message || "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  // ---------- Class + student management ----------
  async function handleCreateClass() {
    toast.dismiss();
    setBusy(true);
    try {
      const name = className.trim();
      if (!name) throw new Error("Enter a class name.");
      if (!classTeacherId) throw new Error("Select a teacher.");

      const teacher = teachers.find((t) => t.id === classTeacherId);
      if (!teacher) throw new Error("Selected teacher not found.");

      await addDoc(collection(db, "classes"), {
        name,
        teacherUid: classTeacherId,
        teacherName: teacher.fullName || teacher.email || "Teacher",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      logAudit({ action: AUDIT_ACTIONS.CLASS_CREATED, actorId: user?.uid, actorName: user?.displayName || user?.email, details: `Class "${name}" created, teacher: ${teacher.fullName || teacher.email}` });
      setClassName("");
      setClassTeacherId("");
      await refresh();
      toast.success("Class created.");
    } catch (e) {
      toast.error(e?.message || "Failed to create class.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddStudent() {
    toast.dismiss();
    setBusy(true);
    try {
      const n = studentName.trim();
      if (!selectedClassId) throw new Error("Select a class first.");
      if (!n) throw new Error("Enter student name.");

      const selectedClass = classes.find((c) => c.id === selectedClassId);
      if (!selectedClass) throw new Error("Class not found.");

      const lower = String(selectedClass.name || "").toLowerCase();
      const classGroup =
        lower.includes("creche") ||
        lower.includes("crèche") ||
        lower.includes("nursery") ||
        lower.includes("kg") ||
        lower.includes("k.g")
          ? "PRESCHOOL"
          : "BASIC";

      await addDoc(collection(db, "classes", selectedClassId, "students"), {
        fullName: n,
        status: "ACTIVE",

        classId: selectedClassId,
        className: selectedClass.name,
        classGroup,

        parentPhone: parentPhone.trim() || "",
        parentName: parentName.trim() || "",

        feeExempt: false,
        healthMaintenanceExempt: false,
        feedingExempt: false,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      logAudit({ action: AUDIT_ACTIONS.STUDENT_ADDED, actorId: user?.uid, actorName: user?.displayName || user?.email, targetName: n, details: `Student "${n}" added to ${selectedClass.name}` });
      setStudentName("");
      setParentPhone("");
      setParentName("");

      const ssnap = await getDocs(
        collection(db, "classes", selectedClassId, "students")
      );
      const srows = ssnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      srows.sort((a, b) =>
        String(a.fullName || "").localeCompare(String(b.fullName || ""))
      );
      setStudents(srows);

      toast.success("Student added.");
    } catch (e) {
      toast.error(e?.message || "Failed to add student.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveStudent(studentId, studentName) {
    if (!window.confirm(`Remove "${studentName || 'this student'}" from the class? This cannot be undone.`)) return;
    toast.dismiss();
    setBusy(true);
    try {
      if (!selectedClassId) throw new Error("Select a class first.");

      await deleteDoc(
        doc(db, "classes", selectedClassId, "students", studentId)
      );
      logAudit({ action: AUDIT_ACTIONS.STUDENT_DELETED, actorId: user?.uid, actorName: user?.displayName || user?.email, targetId: studentId, targetName: studentName, details: `Student "${studentName}" removed from class` });

      const ssnap = await getDocs(
        collection(db, "classes", selectedClassId, "students")
      );
      const srows = ssnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      srows.sort((a, b) =>
        String(a.fullName || "").localeCompare(String(b.fullName || ""))
      );
      setStudents(srows);

      toast.success("Student removed.");
    } catch (e) {
      toast.error(e?.message || "Failed to remove student.");
    } finally {
      setBusy(false);
    }
  }

  // ---------- Report Viewer: load report + compute ranking ----------
  async function loadReport() {
    toast.dismiss();
    setReportBusy(true);
    setLoadedReport(null);
    setClassRanking(new Map());

    try {
      if (!reportClassId) throw new Error("Select a class.");
      if (!reportStudentId) throw new Error("Select a student.");
      if (!reportYear.trim()) throw new Error("Enter year.");
      if (!reportTerm) throw new Error("Select term.");

      const rid = reportDocId(reportYear.trim(), reportTerm);

      // Load selected student's report
      const ref = doc(
        db,
        "classes",
        reportClassId,
        "students",
        reportStudentId,
        "reports",
        rid
      );
      const snap = await getDoc(ref);
      if (!snap.exists())
        throw new Error("No report found for this Year/Term.");

      const reportData = { id: snap.id, ...snap.data() };
      setLoadedReport(reportData);

      // Compute ranking for the whole class for the same year/term
      // Only include students that actually have a report doc (recommended)
      const rankingRows = await Promise.all(
        reportStudents.map(async (st) => {
          const rref = doc(
            db,
            "classes",
            reportClassId,
            "students",
            st.id,
            "reports",
            rid
          );
          const rsnap = await getDoc(rref);
          if (!rsnap.exists()) return null;
          const rep = rsnap.data();
          const total = calcOverallTotal(rep);
          return { studentId: st.id, total };
        })
      );

      const valid = rankingRows.filter((x) => x && Number.isFinite(x.total));
      const rankMap = rankReportsByTotal(valid);

      setClassRanking(rankMap);
      toast.success("Report loaded (Position computed).");
    } catch (e) {
      toast.error(e?.message || "Failed to load report.");
    } finally {
      setReportBusy(false);
    }
  }

  // ---------- Print report (PRESCHOOL format, includes Total + Position) ----------
  function printStudentReport({ report, student, cls, schoolName, ranking }) {
    if (!report || !student || !cls) return;

    const isPreschool =
      String(report.reportType || "").toUpperCase() === "PRESCHOOL";

    // Compute totals
    const overallTotal = calcOverallTotal(report);
    const posObj = ranking?.get?.(student.id);
    const positionText = posObj ? ordinal(posObj.position) : "—";
    const outOfText = ranking?.size ? ranking.size : "";

    // Build academics tick rows from map
    const acadGrades = report?.academicsGrades || {};
    const academicsRowsHtml = ACADEMICS_ITEMS.map((it) => {
      const grade = String(acadGrades?.[it.key] || "").toUpperCase(); // EXCELLENT | V_GOOD | GOOD | AVERAGE
      return `
        <tr>
          <td class="label">${safe(it.label)}</td>
          <td class="c">${grade === "EXCELLENT" ? "✓" : ""}</td>
          <td class="c">${grade === "V_GOOD" ? "✓" : ""}</td>
          <td class="c">${grade === "GOOD" ? "✓" : ""}</td>
          <td class="c">${grade === "AVERAGE" ? "✓" : ""}</td>
        </tr>
      `;
    }).join("");

    // Build attitude tick rows from map
    const attGrades = report?.attitudeGrades || {};
    const attitudeRowsHtml = ATTITUDE_ITEMS.map((it) => {
      const grade = String(attGrades?.[it.key] || "").toUpperCase(); // REGULAR | NOT_OFTEN | SELDOM
      return `
        <tr>
          <td class="label">${safe(it.label)}</td>
          <td class="c">${grade === "REGULAR" ? "✓" : ""}</td>
          <td class="c">${grade === "NOT_OFTEN" ? "✓" : ""}</td>
          <td class="c">${grade === "SELDOM" ? "✓" : ""}</td>
        </tr>
      `;
    }).join("");

    // Subjects rows from map
    const subjects = report?.subjects || {};
    const subjectRowsHtml = SUBJECT_KEYS.map((k) => {
      const row = subjects?.[k] || {};
      const label = row?.label || SUBJECT_LABELS[k] || k;

      const classScore = row.classScore == null ? "" : Number(row.classScore);
      const examsScore = row.examsScore == null ? "" : Number(row.examsScore);

      const cs = Number(row.classScore ?? 0) || 0;
      const es = Number(row.examsScore ?? 0) || 0;
      const total = cs + es;

      return `
        <tr>
          <td class="label">${safe(label)}</td>
          <td class="r">${safe(classScore === "" ? "" : classScore)}</td>
          <td class="r">${safe(examsScore === "" ? "" : examsScore)}</td>
          <td class="r strong">${safe(total)}</td>
        </tr>
      `;
    }).join("");

    const attendance = report?.attendance || {};
    const present = attendance?.present ?? "—";
    const totalDays = attendance?.total ?? "—";

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Report ${safe(student.fullName)} ${safe(report.id)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 18px; }
    .sheet { max-width: 840px; margin: 0 auto; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .title { font-weight: 800; font-size: 18px; margin: 0; }
    .meta { font-size: 12px; color:#444; margin-top:6px; line-height:1.6; }
    .box { border:1px solid #ddd; border-radius:10px; padding:12px; margin-top:12px; }
    .box h3 { margin:0 0 8px 0; font-size: 13px; }
    table { width:100%; border-collapse:collapse; }
    th, td { border:1px solid #ddd; padding:6px 8px; font-size:12px; }
    th { background:#f6f6f6; text-align:left; }
    .c { text-align:center; width:72px; }
    .r { text-align:right; width:110px; }
    .label { width:auto; }
    .strong { font-weight:700; }
    .line { display:flex; justify-content:space-between; gap:12px; font-size:12px; margin-top:6px; }
    .muted { color:#555; }
    .sig { margin-top:10px; font-size:12px; }
    .sigRow { display:flex; justify-content:space-between; gap:12px; margin-top:8px; }
    .sigLine { flex:1; border-bottom:1px dotted #333; height:16px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <p class="title">${safe(schoolName || "School")} — Student Report</p>
        <div class="meta">
          <div><span class="muted">Student:</span> <b>${safe(
            student.fullName || report.studentName || "—"
          )}</b></div>
          <div><span class="muted">Class:</span> <b>${safe(
            cls.name || report.className || "—"
          )}</b></div>
          <div><span class="muted">Year/Term:</span> <b>${safe(
            report.year ?? ""
          )} / ${safe(
      report.termName || `Term ${report.termNo || ""}`
    )}</b></div>
          <div><span class="muted">Report Date:</span> <b>${safe(
            report.reportDate || "—"
          )}</b></div>
        </div>
      </div>
      <div class="meta" style="text-align:right;">
        <div><span class="muted">Report ID:</span> <b>${safe(
          report.id
        )}</b></div>
        <div><span class="muted">Type:</span> <b>${safe(
          report.reportType || ""
        )}</b></div>
        <div><span class="muted">Total Score:</span> <b>${safe(
          overallTotal
        )}</b></div>
        <div><span class="muted">Position:</span> <b>${safe(positionText)}${
      outOfText ? ` out of ${safe(outOfText)}` : ""
    }</b></div>
      </div>
    </div>

    ${
      isPreschool
        ? `
      <div class="box">
        <h3>ACADEMICS (Tick)</h3>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="c">Excellent</th>
              <th class="c">V. Good</th>
              <th class="c">Good</th>
              <th class="c">Average</th>
            </tr>
          </thead>
          <tbody>
            ${academicsRowsHtml}
          </tbody>
        </table>
      </div>

      <div class="box">
        <h3>ATTITUDE AND HUMAN RELATION</h3>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="c">Regular</th>
              <th class="c">Not often</th>
              <th class="c">Seldom</th>
            </tr>
          </thead>
          <tbody>
            ${attitudeRowsHtml}
          </tbody>
        </table>
      </div>
    `
        : `
      <div class="box">
        <h3>NOTE</h3>
        <div class="meta">This print layout is currently optimized for PRESCHOOL report type. Report type is: <b>${safe(
          report.reportType || ""
        )}</b></div>
      </div>
    `
    }

    <div class="box">
      <h3>SUBJECTS</h3>
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th class="r">Class score</th>
            <th class="r">Exams score</th>
            <th class="r">Total score</th>
          </tr>
        </thead>
        <tbody>
          ${subjectRowsHtml}
        </tbody>
      </table>

      <div class="line">
        <div><span class="muted">Attendance:</span> ${safe(
          present
        )} out of ${safe(totalDays)}</div>
        <div><span class="muted">No. on Roll:</span> ${safe(
          report.rollNo ?? "—"
        )}</div>
      </div>
      <div class="line">
        <div><span class="muted">Next Term Begins:</span> ${safe(
          report.nextTermBegins || "—"
        )}</div>
      </div>
    </div>

    <div class="box">
      <h3>REMARKS</h3>
      <div class="line"><div><span class="muted">Class Teacher’s Remarks:</span> <b>${safe(
        report.teacherRemarks || "—"
      )}</b></div></div>
      <div class="line"><div><span class="muted">H.O.D recommendation:</span> <b>${safe(
        report.hodRecommendation || "—"
      )}</b></div></div>

      <div class="sig">
        <div class="sigRow">
          <div style="flex:1;">
            <div class="muted">Class Teacher’s Signature</div>
            <div class="sigLine"></div>
          </div>
          <div style="flex:1;">
            <div class="muted">Head of School’s Comments & Signature</div>
            <div class="sigLine"></div>
          </div>
        </div>

        <div class="sigRow">
          <div style="flex:1;">
            <div class="muted">Supervisor’s Signature</div>
            <div class="sigLine"></div>
          </div>
          <div style="flex:1;">
            <div class="muted">Promoted to</div>
            <div class="sigLine"></div>
          </div>
        </div>
      </div>
    </div>

  </div>

  <script>window.print();</script>
</body>
</html>
`;

    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  // ---------- Selected class for UI ----------
  const selectedClassForRoster = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || null;
  }, [classes, selectedClassId]);

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* ═══ Header ═══ */}
        <div className="mb-6 overflow-hidden rounded-2xl bg-linear-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Admin Dashboard
              </h1>
              <p className="mt-1 text-sm text-white/80">
                {profile?.fullName || user?.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <button
                onClick={() => signOut(auth)}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                {t("logout")}
              </button>
            </div>
          </div>
        </div>

        {/* ═══ Holiday Banner or Daily Quote ═══ */}
        {holidayName ? (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-linear-to-r from-amber-50 to-yellow-50 px-5 py-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-2xl">🎉</div>
              <div>
                <div className="text-lg font-bold text-amber-700">Today is a Public Holiday!</div>
                <div className="mt-1 text-base font-semibold text-amber-800">{holidayName}</div>
                <div className="mt-1 text-sm text-amber-700">Enjoy your day off, admin!</div>
              </div>
            </div>
          </div>
        ) : dailyQuote ? (
          <div className="mb-6 rounded-2xl border border-purple-200 bg-linear-to-br from-purple-50 via-indigo-50 to-pink-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-purple-600">🏛️ {dailyQuote.greeting}</p>
            <p className="mt-2 text-base italic text-slate-800">&ldquo;{dailyQuote.quote}&rdquo;</p>
            <p className="mt-1 text-xs font-medium text-slate-500">— {dailyQuote.author}</p>
          </div>
        ) : null}

        {/* ═══ Tab Navigation ═══ */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { id: "overview",   label: "Overview",    icon: "📊", bg: "bg-indigo-500",  ring: "ring-indigo-300",  badge: pending.length + pendingOut.length },
            { id: "teachers",   label: "Teachers",    icon: "👥", bg: "bg-violet-500",  ring: "ring-violet-300",  badge: 0 },
            { id: "classes",    label: "Classes",     icon: "🏫", bg: "bg-teal-500",    ring: "ring-teal-300",    badge: 0 },
            { id: "attendance", label: "Attendance",  icon: "✅", bg: "bg-emerald-500", ring: "ring-emerald-300", badge: 0 },
            { id: "finance",    label: "Finance",     icon: "💰", bg: "bg-amber-500",   ring: "ring-amber-300",   badge: 0 },
            { id: "reports",    label: "Reports",     icon: "📝", bg: "bg-rose-500",    ring: "ring-rose-300",    badge: 0 },
            { id: "tests",      label: "Tests",       icon: "📋", bg: "bg-cyan-500",    ring: "ring-cyan-300",    badge: 0 },
            { id: "payroll",    label: "Payroll",     icon: "💵", bg: "bg-sky-500",     ring: "ring-sky-300",     badge: 0 },
            { id: "notifications", label: "Notifications", icon: "🔔", bg: "bg-pink-500", ring: "ring-pink-300", badge: 0 },
            { id: "audit", label: "Audit Log", icon: "🕵️", bg: "bg-slate-600", ring: "ring-slate-400", badge: 0 },
            { id: "assessment", label: "Assessment", icon: "📋", bg: "bg-violet-600", ring: "ring-violet-300", badge: 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                activeTab === tab.id
                  ? `${tab.bg} text-white shadow-lg ring-2 ${tab.ring} ring-offset-1`
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:shadow-sm",
              ].join(" ")}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
              {tab.badge > 0 && (
                <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ═══ TAB: Overview ═══ */}
        <div className={activeTab !== "overview" ? "hidden" : ""}>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Daily Codes (Per Staff) */}
          <div className="rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-blue-50 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-indigo-900">
              Daily Codes (Per Staff)
            </h2>

            <div className="mt-3 text-sm text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-600">Code date</span>
                <span className="font-semibold">
                  {dailyCodes?.date || "—"}
                </span>
              </div>

              <div className="mt-2 flex justify-between">
                <span className="text-slate-600">Expires</span>
                <span className="font-semibold">
                  {minutesToHHMM(school?.codeExpiresMinutes ?? 380)}
                </span>
              </div>

              <div className="mt-2 flex justify-between">
                <span className="text-slate-600">Late after</span>
                <span className="font-semibold">
                  {minutesToHHMM(school?.lateAfterMinutes ?? 375)}
                </span>
              </div>

              <div className="mt-2 flex justify-between">
                <span className="text-slate-600">Penalty per late</span>
                <span className="font-semibold">
                  {school?.currency ?? "GHS"}{" "}
                  {Number(school?.penaltyPerLate ?? 5)}
                </span>
              </div>
            </div>

            {/* Per-staff codes table */}
            {dailyCodes?.codes ? (
              <div className="mt-4 max-h-60 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">Staff</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teachers
                      .filter((t) => dailyCodes.codes[t.id])
                      .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""))
                      .map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-800">{t.fullName || t.id}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">
                            {dailyCodes.codes[t.id]}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No codes generated yet for today.</p>
            )}

            <button
              disabled={busy}
              onClick={handleGenerateOrRotateCode}
              className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {busy ? "Working..." : "Generate Daily Codes for All Staff"}
            </button>

            <p className="mt-2 text-xs text-slate-500">
              Generates a unique 4-digit code for each staff member. Regenerating replaces all codes for today.
            </p>
          </div>

          {/* School Settings */}
          <div className="rounded-2xl border border-purple-200 bg-linear-to-br from-purple-50 to-pink-50 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-purple-900">⚙️ School Settings</h2>
              {!editingSettings && (
                <button
                  onClick={openSettingsEditor}
                  className="rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50"
                >
                  Edit
                </button>
              )}
            </div>

            {editingSettings ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Late after (minutes from midnight)</label>
                  <input
                    type="number"
                    value={settingsForm.lateAfterMinutes}
                    onChange={(e) => setSettingsForm({ ...settingsForm, lateAfterMinutes: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Code expires (minutes from midnight)</label>
                  <input
                    type="number"
                    value={settingsForm.codeExpiresMinutes}
                    onChange={(e) => setSettingsForm({ ...settingsForm, codeExpiresMinutes: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Penalty per late ({settingsForm.currency || "GHS"})</label>
                  <input
                    type="number"
                    value={settingsForm.penaltyPerLate}
                    onChange={(e) => setSettingsForm({ ...settingsForm, penaltyPerLate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Currency code</label>
                  <input
                    value={settingsForm.currency}
                    onChange={(e) => setSettingsForm({ ...settingsForm, currency: e.target.value })}
                    placeholder="GHS"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={handleSaveSettings}
                    className="flex-1 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-60"
                  >
                    {busy ? "Saving..." : "Save Settings"}
                  </button>
                  <button
                    onClick={() => setEditingSettings(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-600">Late after</span>
                  <span className="font-semibold">{minutesToHHMM(school?.lateAfterMinutes ?? 375)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Code expires</span>
                  <span className="font-semibold">{minutesToHHMM(school?.codeExpiresMinutes ?? 380)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Penalty per late</span>
                  <span className="font-semibold">{school?.currency ?? "GHS"} {Number(school?.penaltyPerLate ?? 5)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Currency</span>
                  <span className="font-semibold">{school?.currency ?? "GHS"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Pending approvals */}
          <div className="rounded-2xl border border-orange-200 bg-linear-to-br from-orange-50 to-amber-50 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-orange-900">
              Pending Check-ins
            </h2>

            <div className="mt-4 space-y-3">
              {pending.length ? (
                pending.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {p.teacherName || p.teacherId}
                        </div>
                        <div className="text-xs text-slate-600">
                          Date: {p.date} • Requested:{" "}
                          {p.checkInRequestedAt
                            ? new Date(
                                p.checkInRequestedAt.toMillis()
                              ).toLocaleTimeString()
                            : "—"}
                        </div>
                        <div className="text-xs text-slate-600">
                          Code used: {p.checkInCodeUsed || "—"}
                          {p.codeExpiredAtRequest ? (
                            <span className="ml-2 rounded-md bg-amber-50 px-2 py-0.5 text-amber-700">
                              expired-at-request
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          disabled={busy}
                          onClick={() => handleApprove(p.id)}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                          Approve
                        </button>

                        <button
                          disabled={busy}
                          onClick={() => handleReject(p)}
                          className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-600">
                  No pending requests.
                </div>
              )}
            </div>

            {rejecting ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        Reject Check-in
                      </h3>
                      <p className="text-sm text-slate-600">
                        {rejecting.teacherName || rejecting.teacherId} •{" "}
                        {rejecting.date}
                      </p>
                    </div>
                    <button
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => setRejecting(null)}
                      disabled={busy}
                    >
                      Close
                    </button>
                  </div>

                  <div className="mt-5">
                    <label className="text-xs font-semibold text-slate-600">
                      Reason
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={4}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring"
                      placeholder="Example: Wrong code / not on premises / contact admin..."
                    />
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      disabled={busy}
                      onClick={confirmReject}
                      className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
                    >
                      {busy ? "Rejecting..." : "Confirm Reject"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Pending check-outs */}
<div className="rounded-2xl border border-orange-200 bg-linear-to-br from-orange-50 to-amber-50 p-6 shadow-sm">
  <h2 className="text-base font-semibold text-orange-900">
    Pending Check-outs
  </h2>

  <div className="mt-4 space-y-3">
    {pendingOut.length ? (
      pendingOut.map((p) => (
        <div
          key={p.id}
          className="rounded-xl border border-slate-200 p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {p.teacherName || p.teacherId}
              </div>

              <div className="text-xs text-slate-600">
                Date: {p.date} • Requested:{" "}
                {p.checkOutRequestedAt
                  ? new Date(p.checkOutRequestedAt.toMillis()).toLocaleTimeString()
                  : "—"}
              </div>

              <div className="text-xs text-slate-600">
                Check-in approved:{" "}
                {p.checkInApprovedAt
                  ? new Date(p.checkInApprovedAt.toMillis()).toLocaleTimeString()
                  : "—"}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => handleApproveOut(p.id)}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                Approve
              </button>

              <button
                disabled={busy}
                onClick={() => handleRejectOut(p)}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ))
    ) : (
      <div className="text-sm text-slate-600">
        No pending check-out requests.
      </div>
    )}
  </div>

  {/* Reject checkout modal */}
  {rejectingOut ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Reject Check-out
            </h3>
            <p className="text-sm text-slate-600">
              {rejectingOut.teacherName || rejectingOut.teacherId} •{" "}
              {rejectingOut.date}
            </p>
          </div>

          <button
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => setRejectingOut(null)}
            disabled={busy}
          >
            Close
          </button>
        </div>

        <div className="mt-5">
          <label className="text-xs font-semibold text-slate-600">
            Reason
          </label>
          <textarea
            value={rejectReasonOut}
            onChange={(e) => setRejectReasonOut(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring"
            placeholder="Example: Teacher left early / not on premises / contact admin..."
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            disabled={busy}
            onClick={confirmRejectOut}
            className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
          >
            {busy ? "Rejecting..." : "Confirm Reject"}
          </button>
        </div>
      </div>
    </div>
  ) : null}
</div>

          {/* ========== BLOCKED TEACHERS ========== */}
          <div className="mt-6 rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-rose-700">
                  🚫 Blocked Teachers
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Teachers who missed attendance and did not provide a reason. Unblock them after reviewing.
                </p>
              </div>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-bold text-rose-700">
                {blockedTeachers.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {blockedTeachers.length ? (
                blockedTeachers.map((t) => (
                  <div
                    key={t.uid}
                    className="rounded-xl border border-rose-200 bg-rose-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {t.fullName || t.email || t.uid}
                        </div>
                        <div className="text-xs text-slate-600">
                          {t.email || ""} {t.contact ? `• ${t.contact}` : ""}
                        </div>
                        <div className="mt-1 text-xs text-rose-700">
                          Reason: {t.blockedReason || "No reason recorded"}
                        </div>
                        {t.blockedAt ? (
                          <div className="text-xs text-slate-500">
                            Blocked: {new Date(t.blockedAt.toMillis?.() || t.blockedAt).toLocaleString()}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex gap-2">
                        <button
                          disabled={blockedBusy}
                          onClick={() => handleViewBlockedTeacher(t)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          View Reasons
                        </button>
                        <button
                          disabled={blockedBusy}
                          onClick={() => handleUnblockTeacher(t.uid, t.fullName || t.email)}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                          {blockedBusy ? "..." : "Unblock"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-600">
                  No blocked teachers. All staff are in good standing. ✅
                </div>
              )}
            </div>

            {/* Blocked teacher detail modal */}
            {selectedBlockedTeacher ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg max-h-[80vh] overflow-y-auto">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {selectedBlockedTeacher.fullName || selectedBlockedTeacher.email || "Teacher"}
                      </h3>
                      <p className="text-sm text-slate-600">
                        Blocked: {selectedBlockedTeacher.blockedReason || "No reason recorded"}
                      </p>
                    </div>
                    <button
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => setSelectedBlockedTeacher(null)}
                      disabled={blockedBusy}
                    >
                      Close
                    </button>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-slate-700">Absence History</h4>
                    {blockedBusy ? (
                      <div className="mt-2 text-sm text-slate-600">Loading...</div>
                    ) : blockedTeacherReasons.length ? (
                      <div className="mt-2 space-y-2">
                        {blockedTeacherReasons.map((r) => (
                          <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex justify-between text-xs text-slate-600">
                              <span className="font-semibold">{r.date}</span>
                              <span className={
                                r.missedType === "NO_CHECKIN"
                                  ? "text-rose-600 font-semibold"
                                  : "text-amber-600 font-semibold"
                              }>
                                {r.missedType === "NO_CHECKIN" ? "Missed Check-in" : "Missed Check-out"}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-slate-900">{r.reason}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-600">
                        No absence reasons submitted by this teacher.
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      disabled={blockedBusy}
                      onClick={() => handleUnblockTeacher(selectedBlockedTeacher.uid, selectedBlockedTeacher.fullName || selectedBlockedTeacher.email)}
                      className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {blockedBusy ? "Unblocking..." : "Unblock Teacher"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* ========== PENDING LEAVE REQUESTS ========== */}
          <div className="mt-6 rounded-2xl border border-orange-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-orange-700">
                  🏖️ Pending Leave Requests
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Teachers requesting time off. Approve or reject each request.
                </p>
              </div>
              <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
                {pendingLeaves.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {pendingLeaves.length ? (
                pendingLeaves.map((lv) => {
                  const teacher = teachers.find((t) => t.id === lv.teacherId);
                  return (
                    <div
                      key={lv.id}
                      className="rounded-xl border border-orange-200 bg-orange-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-900">
                            {teacher?.fullName || lv.teacherName || lv.teacherId?.slice(0, 8) || "—"}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                            <span className="inline-flex items-center rounded-full border border-orange-300 bg-white px-2 py-0.5 font-semibold text-orange-700">
                              {lv.leaveType || "—"}
                            </span>
                            <span>
                              {lv.startDate} → {lv.endDate}
                            </span>
                          </div>
                          {lv.reason ? (
                            <div className="mt-2 text-sm text-slate-700 italic">
                              "{lv.reason}"
                            </div>
                          ) : null}
                          {lv.createdAt ? (
                            <div className="mt-1 text-xs text-slate-400">
                              Submitted: {new Date(lv.createdAt.toMillis?.() || lv.createdAt).toLocaleString()}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-col gap-2">
                          <button
                            disabled={leaveBusy}
                            onClick={async () => {
                              setLeaveBusy(true);
                              try {
                                await approveLeaveRequest(lv.id);
                                logAudit({ action: AUDIT_ACTIONS.LEAVE_APPROVED, actorId: user?.uid, actorName: user?.displayName || user?.email, targetId: lv.id, targetName: lv.teacherName || "", details: `${lv.leaveType} leave approved (${lv.startDate} to ${lv.endDate})` });
                                toast.success("Leave approved ✅");
                                setPendingLeaves((prev) => prev.filter((x) => x.id !== lv.id));
                              } catch (e) {
                                toast.error(e.message || "Failed to approve");
                              }
                              setLeaveBusy(false);
                            }}
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                          >
                            {leaveBusy ? "..." : "Approve"}
                          </button>
                          {leaveRejectingId === lv.id ? (
                            <div className="flex flex-col gap-1">
                              <input
                                type="text"
                                placeholder="Reason (optional)"
                                value={leaveRejectReason}
                                onChange={(e) => setLeaveRejectReason(e.target.value)}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                              />
                              <button
                                disabled={leaveBusy}
                                onClick={async () => {
                                  setLeaveBusy(true);
                                  try {
                                    await rejectLeaveRequest(lv.id, leaveRejectReason.trim() || undefined);
                                    logAudit({ action: AUDIT_ACTIONS.LEAVE_REJECTED, actorId: user?.uid, actorName: user?.displayName || user?.email, targetId: lv.id, targetName: lv.teacherName || "", details: `${lv.leaveType} leave rejected. ${leaveRejectReason.trim() || ""}` });
                                    toast.success("Leave rejected");
                                    setPendingLeaves((prev) => prev.filter((x) => x.id !== lv.id));
                                    setLeaveRejectingId(null);
                                    setLeaveRejectReason("");
                                  } catch (e) {
                                    toast.error(e.message || "Failed to reject");
                                  }
                                  setLeaveBusy(false);
                                }}
                                className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
                              >
                                {leaveBusy ? "..." : "Confirm Reject"}
                              </button>
                            </div>
                          ) : (
                            <button
                              disabled={leaveBusy}
                              onClick={() => { setLeaveRejectingId(lv.id); setLeaveRejectReason(""); }}
                              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-slate-600">
                  No pending leave requests. 🎉
                </div>
              )}
            </div>
          </div>

          {/* ========== RECENT ABSENCE REASONS ========== */}
          <div className="mt-6 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-amber-700">
              📋 Recent Absence Reasons
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Reasons submitted by teachers for missed check-ins or check-outs.
            </p>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-5 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                <div>Date</div>
                <div>Teacher</div>
                <div>Type</div>
                <div className="col-span-2">Reason</div>
              </div>

              {recentAbsenceReasons.length ? (
                recentAbsenceReasons.map((r) => {
                  const teacher = teachers.find((t) => t.id === r.teacherId);
                  return (
                    <div
                      key={r.id}
                      className="grid grid-cols-5 items-center border-t border-slate-200 px-4 py-3 text-sm"
                    >
                      <div className="text-slate-700">{r.date || "—"}</div>
                      <div className="text-slate-900 font-semibold truncate">
                        {teacher?.fullName || r.teacherId?.slice(0, 8) || "—"}
                      </div>
                      <div>
                        <span className={[
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                          r.missedType === "NO_CHECKIN"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200",
                        ].join(" ")}>
                          {r.missedType === "NO_CHECKIN" ? "No Check-in" : "No Check-out"}
                        </span>
                      </div>
                      <div className="col-span-2 text-slate-700 truncate">
                        {r.reason || "—"}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-6 text-sm text-slate-600">
                  No absence reasons submitted yet.
                </div>
              )}
            </div>
          </div>


          {/* Analytics: Today Overview */}
          <div className="mt-6 rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-purple-50 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-indigo-900">
                  Today Overview
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Summary of today’s teacher check-ins, student attendance
                  submissions, and finance totals.
                </p>
              </div>

              <button
                disabled={busy}
                onClick={async () => {
                  toast.dismiss();
                  try {
                    const ov = await getAdminTodayOverview();
                    setTodayOverview(ov);
                    toast.success("Today overview refreshed.");
                  } catch (e) {
                    toast.error(e?.message || "Failed to refresh overview.");
                  }
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                <div className="text-xs font-semibold text-indigo-600">
                  Teachers Approved
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {todayOverview?.teacherCheckins?.approved ?? "—"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Pending: {todayOverview?.teacherCheckins?.pending ?? "—"} •
                  Rejected: {todayOverview?.teacherCheckins?.rejected ?? "—"}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="text-xs font-semibold text-emerald-600">
                  Student Attendance
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {todayOverview?.studentAttendance?.submittedClasses ?? "—"} /{" "}
                  {todayOverview?.studentAttendance?.totalClasses ?? "—"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Submitted classes / Total classes
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="text-xs font-semibold text-amber-600">
                  Today Receipts
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {todayOverview?.fees?.receiptsCount ?? "—"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Total: {todayOverview?.fees?.currency ?? "GHS"}{" "}
                  {todayOverview?.fees?.amountTotal ?? "—"}
                </div>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
                <div className="text-xs font-semibold text-purple-600">
                  Bursary Payments
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {todayOverview?.bursary?.paymentsCount ?? "—"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Grand: {todayOverview?.bursary?.currency ?? "GHS"}{" "}
                  {todayOverview?.bursary?.grandTotal ?? "—"}
                </div>
              </div>
            </div>

            {todayOverview?.flags?.lateTeachersCount != null ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                Late teachers today:{" "}
                <span className="font-semibold text-slate-900">
                  {todayOverview.flags.lateTeachersCount}
                </span>
                {todayOverview.flags.codeExpiredAtRequestCount != null ? (
                  <>
                    {" "}
                    • Code expired-at-request:{" "}
                    <span className="font-semibold text-slate-900">
                      {todayOverview.flags.codeExpiredAtRequestCount}
                    </span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Analytics: Trends */}
          <div className="mt-6 rounded-2xl border border-indigo-200 bg-linear-to-br from-blue-50 to-indigo-50 p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-indigo-900">
                  Daily Trends
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Track daily activity across attendance and finance. Use this
                  to spot drop-offs and peak days.
                </p>
              </div>

              <button
                disabled={busy || !trendFrom || !trendTo}
                onClick={loadTrends}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                Load Trends
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  From
                </label>
                <input
                  type="date"
                  value={trendFrom}
                  onChange={(e) => setTrendFrom(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">
                  To
                </label>
                <input
                  type="date"
                  value={trendTo}
                  onChange={(e) => setTrendTo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold text-slate-600">Days</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {trends?.rows?.length ?? "—"}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold text-slate-600">
                  Teacher approvals (sum)
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {trends?.totals?.teacherApproved ?? "—"}
                </div>
              </div>
            </div>

            {/* ═══ Trends Chart ═══ */}
            {trends?.rows?.length > 0 && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Attendance & Finance Trend
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={trends.rows} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => v?.slice(5) || v}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 12 }}
                      labelFormatter={(v) => `Date: ${v}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="teacherApproved" name="Teachers Approved" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="studentSubmittedClasses" name="Classes Submitted" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="feesTotal" name="Fees (GHS)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="bursaryGrand" name="Bursary (GHS)" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-7 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                <div>Date</div>
                <div className="text-center">Teachers Approved</div>
                <div className="text-center">Teachers Pending</div>
                <div className="text-center">Student Classes Submitted</div>
                <div className="text-right">Fees (GHS)</div>
                <div className="text-right">Bursary (GHS)</div>
                <div className="text-right">Grand (GHS)</div>
              </div>

              {trends?.rows?.length ? (
                <div className="max-h-96 overflow-auto bg-white">
                  {trends.rows.map((r) => (
                    <div
                      key={r.date}
                      className="grid grid-cols-7 items-center border-t border-slate-200 px-4 py-3 text-sm"
                    >
                      <div className="font-semibold text-slate-900">
                        {r.date}
                      </div>
                      <div className="text-center text-slate-700">
                        {r.teacherApproved ?? 0}
                      </div>
                      <div className="text-center text-slate-700">
                        {r.teacherPending ?? 0}
                      </div>
                      <div className="text-center text-slate-700">
                        {r.studentSubmittedClasses ?? 0}
                      </div>
                      <div className="text-right text-slate-700">
                        {r.feesTotal ?? 0}
                      </div>
                      <div className="text-right text-slate-700">
                        {r.bursaryGrand ?? 0}
                      </div>
                      <div className="text-right font-semibold text-slate-900">
                        {Number(r.feesTotal ?? 0) +
                          Number(r.bursaryGrand ?? 0) || 0}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-sm text-slate-600">
                  No trends loaded. Select a date range and click “Load Trends”.
                </div>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* ═══ TAB: Finance ═══ */}
        <div className={activeTab !== "finance" ? "hidden" : ""}>
        {/* School Fees Receipts */}
        <div className="mt-6 rounded-2xl border border-amber-200 bg-linear-to-br from-amber-50 to-orange-50 p-6 shadow-sm border-l-4 border-l-amber-400">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-amber-900">
                School Fees Receipts
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Issues receipt numbers per-day and per-term. Admin only.
              </p>
            </div>
            <button
              disabled={receiptBusy}
              onClick={loadTodayReceipts}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Create Receipt
              </h3>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Class
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    disabled={receiptBusy || !classes.length}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    {!classes.length ? (
                      <option value="">No classes yet</option>
                    ) : null}
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.teacherName || c.teacherUid}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Student (from roster)
                    </label>
                    <select
                      value={receiptStudentId}
                      onChange={(e) => setReceiptStudentId(e.target.value)}
                      disabled={receiptBusy || !selectedClassId}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">Select student</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName || s.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Or type student name
                    </label>
                    <input
                      value={receiptStudentName}
                      onChange={(e) => setReceiptStudentName(e.target.value)}
                      placeholder="e.g. Ama Mensah"
                      disabled={receiptBusy}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Amount ({school?.currency || "GHS"})
                    </label>
                    <input
                      type="number"
                      value={receiptAmount}
                      onChange={(e) => setReceiptAmount(e.target.value)}
                      placeholder="e.g. 250"
                      disabled={receiptBusy}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Payment method
                    </label>
                    <select
                      value={receiptMethod}
                      onChange={(e) => setReceiptMethod(e.target.value)}
                      disabled={receiptBusy}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="CASH">Cash</option>
                      <option value="MOMO">MoMo</option>
                      <option value="BANK">Bank</option>
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Reference (optional)
                    </label>
                    <input
                      value={receiptRef}
                      onChange={(e) => setReceiptRef(e.target.value)}
                      placeholder="MoMo ref / teller"
                      disabled={receiptBusy}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>
                </div>

                <button
                  disabled={receiptBusy}
                  onClick={handleCreateReceipt}
                  className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
                >
                  {receiptBusy ? "Issuing..." : "Issue Receipt & Print"}
                </button>

                {lastReceipt ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <div className="font-semibold text-slate-900">
                      Last receipt
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      Daily:{" "}
                      <span className="font-semibold">
                        {lastReceipt.dailyNo}
                      </span>{" "}
                      • Term:{" "}
                      <span className="font-semibold">
                        {lastReceipt.termNo}
                      </span>
                    </div>
                    <button
                      onClick={() => printReceipt(lastReceipt)}
                      className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Print again
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Today’s Receipts
              </h3>

              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-3 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                  <div>Receipt</div>
                  <div>Student</div>
                  <div className="text-right">Action</div>
                </div>

                {todayReceipts.length ? (
                  <div className="max-h-80 overflow-auto bg-white">
                    {todayReceipts.map((r) => (
                      <div
                        key={r.id}
                        className="grid grid-cols-3 items-center border-t border-slate-200 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">
                            {r.dailyNo}
                          </div>
                          <div className="text-xs text-slate-500">
                            {r.termNo}
                          </div>
                        </div>
                        <div className="truncate text-slate-700">
                          {r.studentName}
                        </div>
                        <div className="text-right">
                          <button
                            onClick={() => printReceipt(r)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Print
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-sm text-slate-600">
                    No receipts issued today.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* ═══ TAB: Teachers ═══ */}
        <div className={activeTab !== "teachers" ? "hidden" : ""}>
        {/* Teachers */}
        <div className="mt-6 rounded-2xl border border-violet-200 bg-linear-to-br from-violet-50 to-purple-50 p-6 shadow-sm border-l-4 border-l-violet-400">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-violet-900">Teachers</h2>
            <span className="text-sm text-slate-600">
              {filteredTeachers.length} shown
            </span>
          </div>

          <div className="mt-4 flex gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, contact, address..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
            />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Contact</th>
                  <th className="py-2">Address</th>
                  <th className="py-2">Salary</th>
                  <th className="py-2">History</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.length ? (
                  filteredTeachers.map((t) => (
                    <tr
                      key={t.id}
                      className="border-t border-slate-200 cursor-pointer hover:bg-slate-50"
                      onClick={() => openTeacher(t)}
                    >
                      <td className="py-2 font-semibold text-slate-900">
                        {t.fullName || "—"}
                      </td>
                      <td className="py-2 text-slate-700">{t.email || "—"}</td>
                      <td className="py-2 text-slate-700">
                        {t.contact || "—"}
                      </td>
                      <td className="py-2 text-slate-700">
                        {t.address || "—"}
                      </td>
                      <td className="py-2 text-slate-700">
                        {t.baseMonthlySalary != null
                          ? `GHS ${t.baseMonthlySalary}`
                          : "—"}
                      </td>
                      <td className="py-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); loadTeacherHistory(t.id); }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            teacherHistoryUid === t.id
                              ? "bg-violet-600 text-white"
                              : "border border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
                          }`}
                        >
                          {teacherHistoryUid === t.id ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-4 text-slate-600" colSpan={6}>
                      No teachers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Teacher Attendance History Panel */}
          {teacherHistoryUid && (
            <div className="mt-4 rounded-xl border border-violet-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-violet-800">
                Recent Attendance — {teachers.find((t) => t.id === teacherHistoryUid)?.fullName || "Teacher"}
              </h3>
              {historyBusy ? (
                <p className="mt-3 text-sm text-slate-600">Loading...</p>
              ) : teacherHistory.length ? (
                <div className="mt-3 max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Date</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Late?</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Check-in</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Check-out</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teacherHistory.map((h) => (
                        <tr key={h.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-semibold text-slate-900">{h.date || "—"}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              h.status === "CHECKED_IN" || h.status === "CHECKED_OUT"
                                ? "bg-emerald-100 text-emerald-700"
                                : h.status === "PENDING"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              {h.status || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {h.isLate === true ? (
                              <span className="text-rose-600 font-semibold">YES</span>
                            ) : h.isLate === false ? (
                              <span className="text-emerald-600">NO</span>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {h.checkInApprovedAt ? new Date(h.checkInApprovedAt.toDate?.() ?? h.checkInApprovedAt).toLocaleTimeString() : "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {h.checkOutApprovedAt ? new Date(h.checkOutApprovedAt.toDate?.() ?? h.checkOutApprovedAt).toLocaleTimeString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No attendance records found (last 30 days).</p>
              )}
            </div>
          )}

          <p className="mt-2 text-xs text-slate-500">
            Click a teacher row to view details and update
            salary/contact/address.
          </p>
        </div>
        </div>

        {/* ═══ TAB: Classes ═══ */}
        <div className={activeTab !== "classes" ? "hidden" : ""}>
        {/* Class Setup */}
        <div className="mt-6 rounded-2xl border border-teal-200 bg-linear-to-br from-teal-50 to-cyan-50 p-6 shadow-sm border-l-4 border-l-teal-400">
          <h2 className="text-base font-semibold text-teal-900">
            Class Setup
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Create classes and add students. Teachers already exist as users.
          </p>

          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {/* Create class */}
            <div className="rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Create Class
              </h3>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Class name
                  </label>
                  <input
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="e.g. JHS 2A"
                    disabled={busy}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Assign teacher
                  </label>
                  <select
                    value={classTeacherId}
                    onChange={(e) => setClassTeacherId(e.target.value)}
                    disabled={busy}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">Select teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName || t.email || t.id}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  disabled={busy}
                  onClick={handleCreateClass}
                  className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {busy ? "Working..." : "Create Class"}
                </button>

                <p className="text-xs text-slate-500">
                  Each teacher manages exactly one class.
                </p>
              </div>
            </div>

            {/* Existing Classes List */}
            <div className="rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Existing Classes</h3>
              {classes.length ? (
                <div className="mt-3 space-y-2">
                  {classes.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.teacherName || c.teacherUid || "No teacher"}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openClassEditor(c)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => handleDeleteClass(c)}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No classes yet. Create one above.</p>
              )}
            </div>

            {/* Add students */}
            <div className="rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Add Students
              </h3>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Select class
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    disabled={busy || !classes.length}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    {!classes.length ? (
                      <option value="">No classes yet</option>
                    ) : null}
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.teacherName || c.teacherUid}
                      </option>
                    ))}
                  </select>

                  {selectedClassForRoster ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      <div className="font-semibold text-slate-900">
                        {selectedClassForRoster.name}
                      </div>
                      <div className="text-xs text-slate-600">
                        Teacher:{" "}
                        <span className="font-semibold text-slate-800">
                          {selectedClassForRoster.teacherName || "—"}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Student name
                  </label>
                  <input
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g. Ama Mensah"
                    disabled={busy || !selectedClassId}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Parent name (optional)
                    </label>
                    <input
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="e.g. Kofi Mensah"
                      disabled={busy || !selectedClassId}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Parent phone (optional)
                    </label>
                    <input
                      value={parentPhone}
                      onChange={(e) => setParentPhone(e.target.value)}
                      placeholder="e.g. +233 24 xxx xxxx"
                      disabled={busy || !selectedClassId}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>
                </div>

                <button
                  disabled={busy || !selectedClassId}
                  onClick={handleAddStudent}
                  className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {busy ? "Working..." : "Add Student"}
                </button>

                {/* Roster */}
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                    <div>Roster</div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={loadStudentRates}
                        disabled={ratesBusy || !students.length}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        {ratesBusy ? "Loading…" : "📊 Load Attendance %"}
                      </button>
                      <div>{students.length} students</div>
                    </div>
                  </div>

                  {students.length ? (
                    <div className="max-h-80 overflow-auto">
                      {students.map((s) => {
                        const rateInfo = studentRates.get(s.id);
                        return (
                        <div
                          key={s.id}
                          className="flex items-start justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-semibold text-slate-900">
                                {s.fullName || "—"}
                              </span>
                              {rateInfo && (
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    rateInfo.rate >= 90
                                      ? "bg-emerald-100 text-emerald-700"
                                      : rateInfo.rate >= 75
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-red-100 text-red-700"
                                  }`}
                                  title={`${rateInfo.present}/${rateInfo.total} days present (last 30 days)`}
                                >
                                  {rateInfo.rate}%
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              {s.status || "ACTIVE"}
                              {rateInfo && (
                                <span className="ml-2 text-slate-400">
                                  · {rateInfo.present}P / {rateInfo.absent}A in {rateInfo.total} days
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-700">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={s.feeExempt === true}
                                  disabled={busy}
                                  onChange={(e) =>
                                    updateStudentExemption(s.id, {
                                      feeExempt: e.target.checked,
                                    })
                                  }
                                />
                                Fees exempt
                              </label>

                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={s.healthMaintenanceExempt === true}
                                  disabled={busy}
                                  onChange={(e) =>
                                    updateStudentExemption(s.id, {
                                      healthMaintenanceExempt: e.target.checked,
                                    })
                                  }
                                />
                                Health &amp; Maintenance exempt
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={s.feedingExempt === true}
                                  disabled={busy}
                                  onChange={(e) =>
                                    updateStudentExemption(s.id, {
                                      feedingExempt: e.target.checked,
                                    })
                                  }
                                />
                                Feeding exempt
                              </label>
                            </div>
                          </div>

                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() => openStudentEditor(s)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                              title="Edit student name"
                            >
                              Edit
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => handleRemoveStudent(s.id, s.fullName)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                              title="Remove student"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-sm text-slate-600">
                      {selectedClassId
                        ? "No students added to this class yet."
                        : "Select a class to view students."}
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-500">
                  Add students one-by-one here. If you want bulk upload (Excel),
                  we can add that next.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Class Edit Modal */}
        {editingClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-slate-900">Edit Class</h3>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Class name</label>
                  <input
                    value={editClassName}
                    onChange={(e) => setEditClassName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Assign teacher</label>
                  <select
                    value={editClassTeacherId}
                    onChange={(e) => setEditClassTeacherId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
                  >
                    <option value="">Select teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName || t.email || t.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  disabled={busy}
                  onClick={handleSaveClass}
                  className="flex-1 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-60"
                >
                  {busy ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => setEditingClass(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Student Edit Modal */}
        {editingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-slate-900">Edit Student</h3>
              <div className="mt-4">
                <label className="text-xs font-semibold text-slate-600">Student name</label>
                <input
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring"
                />
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  disabled={busy}
                  onClick={handleSaveStudent}
                  className="flex-1 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-60"
                >
                  {busy ? "Saving..." : "Save Name"}
                </button>
                <button
                  onClick={() => setEditingStudent(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* ═══ TAB: Finance (Bursary) ═══ */}
        <div className={activeTab !== "finance" ? "hidden" : ""}>
        {/* Bursary Daily Totals */}
        <div className="mt-6 rounded-2xl border border-amber-200 bg-linear-to-br from-amber-50 to-orange-50 p-6 shadow-sm border-l-4 border-l-amber-400">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-amber-900">
                Bursary — Daily Totals
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Totals grouped per day for the selected date range.
              </p>
            </div>

            <button
              disabled={bursaryBusy || !bursaryFrom || !bursaryTo}
              onClick={() => loadBursaryDailyTotals(bursaryFrom, bursaryTo)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              {bursaryBusy ? "Loading..." : "Load"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">
                From
              </label>
              <input
                type="date"
                value={bursaryFrom}
                onChange={(e) => setBursaryFrom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">To</label>
              <input
                type="date"
                value={bursaryTo}
                onChange={(e) => setBursaryTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold text-slate-600">
                Days shown
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {dailyTotals.length}
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-7 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
              <div>Date</div>
              <div className="text-center">Payments</div>
              <div className="text-right">Feeding</div>
              <div className="text-right">Fees</div>
              <div className="text-right">Classes</div>
              <div className="text-right">Health</div>
              <div className="text-right">Grand</div>
            </div>

            {dailyTotals.length ? (
              dailyTotals.map((d) => (
                <div
                  key={d.date}
                  className="grid grid-cols-7 items-center border-t border-slate-200 px-4 py-3 text-sm"
                >
                  <div className="font-semibold text-slate-900">{d.date}</div>
                  <div className="text-center text-slate-700">
                    {d.paymentsCount}
                  </div>
                  <div className="text-right text-slate-700">
                    GHS {d.feeding}
                  </div>
                  <div className="text-right text-slate-700">GHS {d.fees}</div>
                  <div className="text-right text-slate-700">
                    GHS {d.classes}
                  </div>
                  <div className="text-right text-slate-700">
                    GHS {d.healthMaintenance}
                  </div>
                  <div className="text-right font-semibold text-slate-900">
                    GHS {d.grand}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-sm text-slate-600">
                {bursaryBusy
                  ? "Loading..."
                  : "No bursary payments found in this range."}
              </div>
            )}
          </div>
        </div>
        </div>

        {/* ═══ TAB: Attendance ═══ */}
        <div className={activeTab !== "attendance" ? "hidden" : ""}>
        {/* Student Attendance (Today) */}
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-green-50 p-6 shadow-sm border-l-4 border-l-emerald-400">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-emerald-900">
                Student Attendance (Today)
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Shows today submissions per class. Click “View” to see
                absentees.
              </p>
            </div>

            <button
              disabled={sessionsBusy}
              onClick={refresh}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              {sessionsBusy ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-6 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
              <div className="col-span-2">Class</div>
              <div>Teacher</div>
              <div className="text-center">Present</div>
              <div className="text-center">Absent</div>
              <div className="text-right">Action</div>
            </div>

            {todaySessions.length ? (
              todaySessions.map((s) => {
                const isOpen = openSessionId === s.id;
                const submitted = s.status === "SUBMITTED";

                return (
                  <div key={s.id} className="border-t border-slate-200">
                    <div className="grid grid-cols-6 items-center gap-x-3 px-4 py-3 text-sm">
                      <div className="col-span-2 min-w-0">
                        <div className="truncate font-semibold text-slate-900">
                          {s.className}
                        </div>
                        <div className="text-xs text-slate-500">
                          Status:{" "}
                          <span
                            className={
                              submitted ? "text-emerald-700" : "text-amber-700"
                            }
                          >
                            {submitted ? "SUBMITTED" : "NOT SUBMITTED"}
                          </span>
                          {" • "}Date: {s.date}
                        </div>
                      </div>

                      <div className="min-w-0 truncate text-slate-700">
                        {s.teacherName || "—"}
                      </div>

                      <div className="text-center font-semibold text-slate-900">
                        {submitted ? s.presentCount : "—"}
                      </div>
                      <div className="text-center font-semibold text-slate-900">
                        {submitted ? s.absentCount : "—"}
                      </div>

                      <div className="text-right">
                        <button
                          disabled={!submitted || absentBusy}
                          onClick={() => toggleOpenSession(s.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        >
                          {isOpen ? "Hide" : "View"}
                        </button>
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="bg-slate-50 px-4 py-4">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-slate-600">
                            Absent students
                          </div>
                          {s.adminOverride && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                              Admin edited
                            </span>
                          )}
                        </div>

                        {absentBusy ? (
                          <div className="mt-2 text-sm text-slate-600">
                            Loading...
                          </div>
                        ) : openAbsent.length ? (
                          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                            {openAbsent.map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-slate-900">
                                    {a.studentName || a.studentId || "—"}
                                    {a.adminOverride && (
                                      <span className="ml-1.5 text-[10px] font-bold text-violet-600">★</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {a.reason
                                      ? `Reason: ${a.reason}`
                                      : "No reason"}
                                  </div>
                                </div>
                                <button
                                  disabled={overrideBusy === a.id}
                                  onClick={() =>
                                    handleOverride(
                                      a.id,
                                      a.studentName || a.studentId,
                                      "MARK_PRESENT"
                                    )
                                  }
                                  className="ml-3 shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                >
                                  {overrideBusy === a.id ? "…" : "✓ Mark Present"}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-slate-600">
                            No absentees marked.
                          </div>
                        )}

                        {/* Add student as absent (override) */}
                        {overrideStudents.length > 0 && (
                          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                            <div className="text-xs font-semibold text-amber-800">
                              Mark a present student as absent
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <select
                                value={overrideAddId}
                                onChange={(e) => setOverrideAddId(e.target.value)}
                                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring"
                              >
                                <option value="">Select student…</option>
                                {overrideStudents
                                  .filter(
                                    (st) =>
                                      !openAbsent.some((a) => a.id === st.id)
                                  )
                                  .map((st) => (
                                    <option key={st.id} value={st.id}>
                                      {st.fullName || st.id}
                                    </option>
                                  ))}
                              </select>
                              <button
                                disabled={
                                  !overrideAddId || overrideBusy === overrideAddId
                                }
                                onClick={() => {
                                  const st = overrideStudents.find(
                                    (x) => x.id === overrideAddId
                                  );
                                  if (st)
                                    handleOverride(
                                      st.id,
                                      st.fullName || st.id,
                                      "MARK_ABSENT"
                                    );
                                }}
                                className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                              >
                                {overrideBusy === overrideAddId
                                  ? "…"
                                  : "✗ Mark Absent"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-6 text-sm text-slate-600">
                {sessionsBusy ? "Loading..." : "No classes found yet."}
              </div>
            )}
          </div>
        </div>
        </div>

        {/* ═══ TAB: Reports ═══ */}
        <div className={activeTab !== "reports" ? "hidden" : ""}>
        {/* Admin: Report Viewer */}
        <div className="mt-6 rounded-2xl border border-rose-200 bg-linear-to-br from-rose-50 to-pink-50 p-6 shadow-sm border-l-4 border-l-rose-400">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-rose-900">
                Report Viewer (Admin)
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Load and print a student report by Class → Student → Year/Term.
                Printing includes Total Score and Position.
              </p>
            </div>

            <button
              disabled={reportBusy}
              onClick={loadReport}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
            >
              {reportBusy ? "Loading..." : "Load Report"}
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600">
                Select Class
              </label>
              <select
                value={reportClassId}
                onChange={(e) => setReportClassId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
              >
                <option value="">Choose class...</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.teacherName || c.teacherUid}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600">
                Select Student
              </label>
              <select
                value={reportStudentId}
                onChange={(e) => setReportStudentId(e.target.value)}
                disabled={!reportClassId}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
              >
                {!reportClassId ? (
                  <option value="">Select a class first</option>
                ) : (
                  reportStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName || s.id}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">
                Year
              </label>
              <input
                value={reportYear}
                onChange={(e) => setReportYear(e.target.value)}
                placeholder="e.g. 2026"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">
                Term
              </label>
              <select
                value={reportTerm}
                onChange={(e) => setReportTerm(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">
                {loadedReport ? "Loaded Report" : "No report loaded"}
              </div>

              <button
                disabled={!loadedReport}
                onClick={() => {
                  const cls = classes.find((c) => c.id === reportClassId);
                  const st = reportStudents.find(
                    (s) => s.id === reportStudentId
                  );
                  printStudentReport({
                    report: loadedReport,
                    student: st,
                    cls,
                    schoolName: "GREENIDGE INTERNATIONAL SCH.",
                    ranking: classRanking,
                  });
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Print to paper
              </button>
            </div>

            {loadedReport ? (
              <div className="bg-white px-4 py-4 text-sm text-slate-700">
                {(() => {
                  const total = calcOverallTotal(loadedReport);
                  const posObj = classRanking.get(reportStudentId);
                  const pos = posObj ? ordinal(posObj.position) : "—";
                  const outOf = classRanking.size || "—";
                  return (
                    <>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div>
                          <div className="text-xs text-slate-500">
                            Report ID
                          </div>
                          <div className="font-semibold">{loadedReport.id}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">
                            Report Type
                          </div>
                          <div className="font-semibold">
                            {loadedReport.reportType || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">
                            Total Score (sum of subject totals)
                          </div>
                          <div className="font-semibold">{total}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Position</div>
                          <div className="font-semibold">
                            {pos} {classRanking.size ? `out of ${outOf}` : ""}
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-slate-500">
                        Position is ranked within the same Class, Year and Term
                        using Total Score = Σ(Class Score + Exams Score). Ties
                        share the same position (1,2,2,4...).
                      </p>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="bg-white px-4 py-6 text-sm text-slate-600">
                Choose a class, student, year and term, then click “Load
                Report”.
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-rose-200 bg-linear-to-br from-rose-50 to-pink-50 p-6 shadow-sm border-l-4 border-l-rose-400">
          <h2 className="text-base font-semibold text-rose-900">
            Compute BASIC Positions
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            After teachers finish saving reports, run this to compute class
            positions and subject positions.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600">
                Class
              </label>
              <select
                value={reportClassId}
                onChange={(e) => setReportClassId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
              >
                <option value="">Choose class...</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.teacherName || c.teacherUid}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">
                Year
              </label>
              <input
                value={reportYear}
                onChange={(e) => setReportYear(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">
                Term
              </label>
              <select
                value={reportTerm}
                onChange={(e) => setReportTerm(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
          </div>

          <button
            onClick={async () => {
              toast.dismiss();
              try {
                if (!reportClassId) throw new Error("Select a class.");
                const res = await computeAndWriteBasicPositions({
                  classId: reportClassId,
                  year: reportYear,
                  termNo: Number(reportTerm),
                });
                toast.success(
                  `Positions updated for ${res.updatedCount} students.`
                );
              } catch (e) {
                toast.error(e?.message || "Failed to compute positions.");
              }
            }}
            className="mt-4 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Compute Positions Now
          </button>
        </div>

        {/* Export CSV */}
        <div className="mt-6 rounded-2xl border border-rose-200 bg-linear-to-br from-rose-50 to-pink-50 p-6 shadow-sm border-l-4 border-l-rose-400">
          <h2 className="text-base font-semibold text-rose-900">
            Export Monthly Report (CSV)
          </h2>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <input
              value={exportMonth}
              onChange={(e) => setExportMonth(e.target.value)}
              placeholder="Month key e.g. 2026-01"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
            />
            <button
              disabled={busy}
              onClick={exportMonthlyCsv}
              className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
            >
              {busy ? "Exporting..." : "Export CSV"}
            </button>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Exports all attendance records where{" "}
            <span className="font-semibold">monthKey</span> matches (example:
            2026-01).
          </p>
        </div>
        </div>

        {/* ═══ TAB: Tests ═══ */}
        <div className={activeTab !== "tests" ? "hidden" : ""}>
          <div className="rounded-2xl border border-cyan-200 bg-linear-to-br from-cyan-50 to-teal-50 p-6 shadow-sm border-l-4 border-l-cyan-400">
            <h2 className="text-base font-semibold text-cyan-900">📋 Trial Test Entry</h2>
            <p className="mt-1 text-xs text-slate-500">
              Enter and manage trial test scores for students across classes.
            </p>
            <div className="mt-4">
              <TrialTestEntryCard
                classes={classes}
                defaultClassId={selectedClassId}
                schoolName="GREENIDGE INTERNATIONAL SCH."
                isAdmin={profile?.role === "ADMIN" || true}
              />
            </div>
          </div>
        </div>

        {/* ═══ TAB: Payroll ═══ */}
        <div className={activeTab !== "payroll" ? "hidden" : ""}>
        <div className="mt-6 rounded-2xl border border-sky-200 bg-linear-to-br from-sky-50 to-blue-50 p-6 shadow-sm border-l-4 border-l-sky-400">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-sky-900">Payroll</h2>
      <p className="mt-1 text-xs text-slate-500">
        Calculates Net Salary = Base − (Late penalties + SSNIT 5.5% + Welfare GHS 20 + Other deductions).
      </p>
    </div>

    <div className="flex flex-wrap gap-2">
      <button
        disabled={payrollBusy}
        onClick={loadPayroll}
        className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
      >
        {payrollBusy ? "Loading..." : "Load Payroll"}
      </button>

      <button
        disabled={payrollBusy || !payrollMonth}
        onClick={printAllPayrollPdf}
        className="rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-60"
      >
        Print All (PDF)
      </button>

      <button
        disabled={payrollBusy || !payrollMonth}
        onClick={printTeachersPayrollRegister}
        className="rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-60"
      >
        Print Teachers Register
      </button>
    </div>
  </div>

  <div className="mt-4 grid gap-4 md:grid-cols-3">
    <div>
      <label className="text-xs font-semibold text-slate-600">Month (YYYY-MM)</label>
      <input
        value={payrollMonth}
        onChange={(e) => setPayrollMonth(e.target.value)}
        placeholder="e.g. 2026-01"
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
      />
    </div>

    <div className="md:col-span-2">
      <label className="text-xs font-semibold text-slate-600">Teacher</label>
      <select
        value={payrollTeacherId}
        onChange={(e) => setPayrollTeacherId(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
      >
        <option value="">Select teacher...</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.fullName || t.email || t.id}
          </option>
        ))}
      </select>
    </div>
  </div>


  {/* Summary */}
  <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
    <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
      Payroll Summary
    </div>

    {payrollSummary ? (
      <div className="bg-white px-4 py-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-600">Base Salary</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {payrollSummary.currency} {money(payrollSummary.baseSalary)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-600">Late Penalty</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {payrollSummary.currency} {money(payrollSummary.totalLatePenalty)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Late days: {payrollSummary.lateCount}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-600">
              SSNIT ({(Number(payrollSummary.ssnitRate) * 100).toFixed(1)}%)
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {payrollSummary.currency} {money(payrollSummary.ssnit)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-600">Welfare</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {payrollSummary.currency} {money(payrollSummary.welfare)}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Other Deductions</div>
            <div className="text-sm font-semibold text-slate-900">
              {payrollSummary.currency} {money(payrollSummary.otherDeductionsTotal)}
            </div>
          </div>

          {/* Add deduction */}
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Label</label>
              <input
                value={deductionLabel}
                onChange={(e) => setDeductionLabel(e.target.value)}
                placeholder="e.g. Loan repayment"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Amount (GHS)</label>
              <input
                type="number"
                value={deductionAmount}
                onChange={(e) => setDeductionAmount(e.target.value)}
                placeholder="e.g. 50"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
              />
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <button
              disabled={payrollBusy}
              onClick={addOtherDeduction}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Add Deduction
            </button>

            <button
              disabled={payrollBusy || !payrollTeacherId || !payrollMonth}
              onClick={savePayrollDeductions}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {payrollBusy ? "Saving..." : "Save Deductions"}
            </button>
          </div>

          {/* Deductions list */}
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-3 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
              <div>Label</div>
              <div className="text-right">Amount</div>
              <div className="text-right">Action</div>
            </div>

            {payrollOtherDeductions.length ? (
              payrollOtherDeductions.map((d) => (
                <div
                  key={d.id}
                  className="grid grid-cols-3 items-center border-t border-slate-200 px-4 py-3 text-sm"
                >
                  <div className="truncate text-slate-700">{d.label}</div>
                  <div className="text-right font-semibold text-slate-900">
                    GHS {money(d.amount)}
                  </div>
                  <div className="text-right">
                    <button
                      disabled={payrollBusy}
                      onClick={() => removeOtherDeduction(d.id)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-4 text-sm text-slate-600">
                No other deductions for this month.
              </div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-600">Total Deductions</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {payrollSummary.currency} {money(payrollSummary.totalDeductions)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-emerald-50 px-4 py-3">
            <div className="text-xs font-semibold text-emerald-700">Net Salary</div>
            <div className="mt-1 text-lg font-semibold text-emerald-900">
              {payrollSummary.currency} {money(payrollSummary.netSalary)}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Net Salary is clamped at 0 to avoid negative pay.
        </p>
      </div>
    ) : (
      <div className="bg-white px-4 py-6 text-sm text-slate-600">
        Select a month and teacher, then click “Load Payroll”.
      </div>
    )}
          </div>
        </div>
        </div>
      </div>

      {/* Teacher modal */}
      {selectedTeacher ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Teacher Details
                </h3>
                <p className="text-sm text-slate-600">
                  {selectedTeacher.email || selectedTeacher.id}
                </p>
              </div>
              <button
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setSelectedTeacher(null)}
                disabled={busy}
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Full name
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Contact
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring"
                  value={editContact}
                  onChange={(e) => setEditContact(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Address
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Monthly salary (GHS)
                </label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring"
                  value={editSalary}
                  onChange={(e) => setEditSalary(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Email
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                disabled={busy}
                onClick={handleSaveTeacher}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save changes"}
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Only admins can update teacher profile details and salary.
            </p>
          </div>
        </div>
      ) : null}

      {/* ═══ TAB: Notifications ═══ */}
      <div className={activeTab !== "notifications" ? "hidden" : ""}>
        <div className="rounded-2xl border border-pink-200 bg-linear-to-br from-pink-50 to-rose-50 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-pink-900">
            🔔 Send Notification
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Send announcements or messages to all staff or a specific teacher.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-600">Recipient</label>
              <select
                value={notifRecipient}
                onChange={(e) => setNotifRecipient(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
              >
                <option value="ALL">All Staff (Broadcast)</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName || t.email || t.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Title</label>
              <input
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="e.g. Staff Meeting Tomorrow"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold text-slate-600">Message</label>
            <textarea
              value={notifBody}
              onChange={(e) => setNotifBody(e.target.value)}
              rows={3}
              placeholder="Type your message here..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
            />
          </div>

          <button
            disabled={notifBusy || !notifTitle.trim() || !notifBody.trim()}
            onClick={async () => {
              setNotifBusy(true);
              try {
                if (notifRecipient === "ALL") {
                  await sendBroadcastNotification({ title: notifTitle.trim(), body: notifBody.trim() });
                } else {
                  await sendUserNotification({
                    recipientId: notifRecipient,
                    type: "announcement",
                    title: notifTitle.trim(),
                    body: notifBody.trim(),
                  });
                }
                toast.success("Notification sent!");
                setNotifTitle("");
                setNotifBody("");
                // Reload sent list
                const all = await getAllNotifications(30);
                setSentNotifications(all);
              } catch (e) {
                toast.error(e?.message || "Failed to send notification.");
              } finally {
                setNotifBusy(false);
              }
            }}
            className="mt-4 rounded-xl bg-pink-600 px-6 py-3 text-sm font-semibold text-white hover:bg-pink-500 disabled:opacity-60"
          >
            {notifBusy ? "Sending..." : "Send Notification"}
          </button>
        </div>

        {/* Sent Notifications History */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Sent Notifications</h3>
            <button
              onClick={async () => {
                const all = await getAllNotifications(30);
                setSentNotifications(all);
              }}
              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Refresh
            </button>
          </div>

          <div className="mt-3 max-h-96 space-y-2 overflow-auto">
            {sentNotifications.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
                Click Refresh to load sent notifications.
              </p>
            ) : (
              sentNotifications.map((n) => (
                <div key={n.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                    <span className={[
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                      n.recipientId === "ALL" ? "bg-pink-100 text-pink-700" : "bg-indigo-100 text-indigo-700",
                    ].join(" ")}>
                      {n.recipientId === "ALL" ? "Broadcast" : "Individual"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{n.body}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SMS / WhatsApp Alerts */}
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-teal-50 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-emerald-900">
            📱 SMS / WhatsApp Parent Alerts
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            When students are marked absent, this system can queue SMS or WhatsApp messages
            to their parents. Add parent phone numbers when registering students (Classes tab).
            Messages are queued in Firestore for your backend/Cloud Function to send via
            Twilio, Africa&apos;s Talking, or Hubtel.
          </p>

          <div className="mt-4 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold text-emerald-800">Setup instructions:</p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-slate-600">
              <li>Add parent phone numbers when creating students (Classes → Add Students)</li>
              <li>Deploy a Cloud Function that watches <code>sms_queue</code> and sends via your SMS provider</li>
              <li>Messages will be auto-queued when teachers submit absence attendance</li>
            </ol>
          </div>
        </div>
      </div>

      {/* ================================================================
          AUDIT LOG TAB
          ================================================================ */}
      <div className={activeTab !== "audit" ? "hidden" : ""}>
        <div className="rounded-2xl border border-slate-300 bg-linear-to-br from-slate-50 to-gray-50 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                🕵️ Audit Log
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                A chronological record of all important admin actions.
              </p>
            </div>
            <button
              disabled={auditLoading}
              onClick={async () => {
                setAuditLoading(true);
                try {
                  const entries = await getRecentAuditLog(200);
                  setAuditEntries(entries);
                } catch (e) {
                  toast.error(e?.message || "Failed to load audit log.");
                } finally {
                  setAuditLoading(false);
                }
              }}
              className="rounded-xl bg-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-600 disabled:opacity-60"
            >
              {auditLoading ? "Loading..." : "Load / Refresh"}
            </button>
          </div>

          {/* Filter */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Filter:</span>
            {["ALL", ...Object.values(AUDIT_ACTIONS)].map((a) => (
              <button
                key={a}
                onClick={() => setAuditFilter(a)}
                className={[
                  "rounded-full border px-2.5 py-1 text-[10px] font-semibold transition",
                  auditFilter === a
                    ? "border-indigo-400 bg-indigo-100 text-indigo-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                {a.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          {/* Entries */}
          <div className="mt-4 max-h-[60vh] space-y-2 overflow-auto">
            {auditEntries.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                Click &ldquo;Load / Refresh&rdquo; to fetch audit entries.
              </p>
            ) : (
              auditEntries
                .filter((e) => auditFilter === "ALL" || e.action === auditFilter)
                .map((entry) => {
                  const actionColors = {
                    CHECKIN_APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-300",
                    CHECKIN_REJECTED: "bg-rose-100 text-rose-800 border-rose-300",
                    TEACHER_BLOCKED: "bg-red-100 text-red-800 border-red-300",
                    TEACHER_UNBLOCKED: "bg-green-100 text-green-800 border-green-300",
                    LEAVE_APPROVED: "bg-teal-100 text-teal-800 border-teal-300",
                    LEAVE_REJECTED: "bg-orange-100 text-orange-800 border-orange-300",
                    NOTIFICATION_SENT: "bg-pink-100 text-pink-800 border-pink-300",
                    CLASS_CREATED: "bg-blue-100 text-blue-800 border-blue-300",
                    CLASS_DELETED: "bg-rose-100 text-rose-800 border-rose-300",
                    STUDENT_ADDED: "bg-sky-100 text-sky-800 border-sky-300",
                    STUDENT_DELETED: "bg-amber-100 text-amber-800 border-amber-300",
                    TEACHER_CREATED: "bg-indigo-100 text-indigo-800 border-indigo-300",
                    FEE_RECEIPT_ADDED: "bg-yellow-100 text-yellow-800 border-yellow-300",
                    PAYROLL_GENERATED: "bg-purple-100 text-purple-800 border-purple-300",
                  };
                  const color = actionColors[entry.action] || "bg-slate-100 text-slate-700 border-slate-200";
                  return (
                    <div key={entry.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${color}`}>
                              {(entry.action || "").replace(/_/g, " ")}
                            </span>
                            <span className="text-xs font-semibold text-slate-800">
                              {entry.actorName || entry.actorId?.slice(0, 8) || "System"}
                            </span>
                            {entry.targetName ? (
                              <span className="text-xs text-slate-500">
                                → {entry.targetName}
                              </span>
                            ) : null}
                          </div>
                          {entry.details ? (
                            <p className="mt-1 text-xs text-slate-600">{entry.details}</p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-[10px] text-slate-400 text-right">
                          {entry.createdAt?.toDate
                            ? entry.createdAt.toDate().toLocaleString()
                            : ""}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
            {auditEntries.length > 0 &&
              auditEntries.filter((e) => auditFilter === "ALL" || e.action === auditFilter).length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                No entries match the selected filter.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          TAB: Assessment (GES/NaCCA Weekly Teacher Assessment)
      ═══════════════════════════════════════════════════════ */}
      <div className={activeTab !== "assessment" ? "hidden" : ""}>
        <TeacherWeeklyAssessment profile={profile} user={user} />
      </div>
    </div>
  );
}
