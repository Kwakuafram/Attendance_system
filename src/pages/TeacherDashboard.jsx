import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { ITEM_KEYS, setStudentItemReceived } from "../services/studentItemsService";
import {
  getSalarySummary,
  getTodayAttendance,
  requestCheckIn,
  getRecentAttendance,
  requestCheckOut,
  getMonthAttendance,
} from "../services/attendanceService";

import {
  getTeacherClass,
  getStudentsForClass,
  getTodayAbsenceIds,
  submitTodayClassAttendance,
  getSessionWithAbsent,
  getClassAttendanceSummary,
  getFrequentAbsentees,
} from "../services/studentAttendanceService";

import Report from "../pages/Report";
import BasicReport from "../pages/BasicReport"; // NEW

import {
  checkMissedAttendance,
  submitAbsenceReason,
  blockTeacher,
} from "../services/absenceReasonService";
import {
  LEAVE_TYPES,
  createLeaveRequest,
  getTeacherLeaveRequests,
} from "../services/leaveRequestService";

import { useLanguage } from "../i18n/useLanguage";
import LanguageSwitcher from "../i18n/LanguageSwitcher";
import {
  ASSESSMENT_DOMAINS,
  RATING_SCALE,
  buildBlankAssessment,
  computeAssessmentScores,
  currentWeekKey,
  saveWeeklyAssessment,
  updateWeeklyAssessment,
  getTeacherAssessments,
  getAssessmentForWeek,
} from "../services/teacherAssessmentService";

import { isSchoolDay, getHolidayName } from "../utils/ghanaHolidays";
import { getDailyQuote } from "../utils/mondayQuotes";
import { accraYyyyMmDd } from "../utils/accraTime";
import {
  getUserNotifications,
  markNotificationRead,
  markAllRead,
} from "../services/notificationService";

export default function TeacherDashboard() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [today, setToday] = useState(null);
  const [salary, setSalary] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("checkin");
  const [msg, setMsg] = useState("");
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [nowTick, setNowTick] = useState(Date.now());


  // ============================
  // Class Attendance states
  // ============================
  const [teacherClass, setTeacherClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [absentIds, setAbsentIds] = useState(new Set());
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [attendanceMsg, setAttendanceMsg] = useState("");
  const [attendanceSummary, setAttendanceSummary] = useState(null);

  // Attendance History Browser
  const [historyDate, setHistoryDate] = useState("");
  const [historySession, setHistorySession] = useState(null);
  const [historyBusy, setHistoryBusy] = useState(false);

  // Attendance Summary Stats (week/month)
  const [attendanceStats, setAttendanceStats] = useState(null);

  // Frequently Absent Students
  const [frequentAbsentees, setFrequentAbsentees] = useState([]);

  // Absence Reasons (when marking absent)
  const [absenceReasons, setAbsenceReasons] = useState({});

  // ============================
  // Student Items Collection
  // ============================
  const [itemBusy, setItemBusy] = useState(false);
  const [itemMsg, setItemMsg] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [itemFilter, setItemFilter] = useState("ALL"); // ALL | MISSING | COMPLETED


  const [bankName, setBankName] = useState("");
const [bankAccountNumber, setBankAccountNumber] = useState("");
const [ssnitNumber, setSsnitNumber] = useState("");

const [bankBusy, setBankBusy] = useState(false);
const [bankMsg, setBankMsg] = useState("");

  // ============================
  // Blocked / Absence Reason
  // ============================
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");
  const [missedInfo, setMissedInfo] = useState(null); // { missed, missedDate, missedType }
  const [absenceReason, setAbsenceReason] = useState("");
  const [absenceBusy, setAbsenceBusy] = useState(false);
  const [absenceMsg, setAbsenceMsg] = useState("");

  // ============================
  // Notifications
  // ============================
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // ============================
  // Calendar View
  // ============================
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [calendarRecords, setCalendarRecords] = useState([]);

  // ============================
  // Leave Requests
  // ============================
  const [leaveType, setLeaveType] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState([]);

  // ============================
  // Self-Assessment (GES/NaCCA)
  // ============================
  const [assessWeek, setAssessWeek] = useState(currentWeekKey);
  const [assessRatings, setAssessRatings] = useState(() => buildBlankAssessment());
  const [assessStrengths, setAssessStrengths] = useState("");
  const [assessAreas, setAssessAreas] = useState("");
  const [assessActionPlan, setAssessActionPlan] = useState("");
  const [assessComment, setAssessComment] = useState("");
  const [assessBusy, setAssessBusy] = useState(false);
  const [assessExistingId, setAssessExistingId] = useState(null);
  const [assessExistingStatus, setAssessExistingStatus] = useState(null);
  const [assessHistory, setAssessHistory] = useState([]);
  const [expandedDomains, setExpandedDomains] = useState(
    () => new Set(ASSESSMENT_DOMAINS.map((d) => d.id))
  );
  const assessScores = useMemo(() => computeAssessmentScores(assessRatings), [assessRatings]);

  // Load existing assessment when week changes
  useEffect(() => {
    if (!user || !assessWeek) return;
    (async () => {
      try {
        const existing = await getAssessmentForWeek(user.uid, assessWeek);
        if (existing) {
          setAssessExistingId(existing.id);
          setAssessExistingStatus(existing.status);
          setAssessRatings(existing.ratings || buildBlankAssessment());
          setAssessStrengths(existing.strengthsObserved || "");
          setAssessAreas(existing.areasForImprovement || "");
          setAssessActionPlan(existing.agreedActionPlan || "");
          setAssessComment(existing.overallComment || "");
        } else {
          setAssessExistingId(null);
          setAssessExistingStatus(null);
          setAssessRatings(buildBlankAssessment());
          setAssessStrengths("");
          setAssessAreas("");
          setAssessActionPlan("");
          setAssessComment("");
        }
      } catch (e) {
        console.error("Load assessment for week:", e);
      }
    })();
  }, [user, assessWeek]);

  // ============================
  // Holiday Banner or Daily Motivational Quote
  // ============================
  // todayStr declared only once here for the whole component
  const todayStr = accraYyyyMmDd();
  const holidayName = useMemo(() => getHolidayName(todayStr), [todayStr]);
  const dailyQuote = useMemo(() => {
    if (!isSchoolDay(todayStr)) return null;
    return getDailyQuote(todayStr);
  }, [todayStr]);


  function todayKey(d = new Date()) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function isAfter3pmGMT(d = new Date()) {
  // Ghana is GMT (UTC+0). Use UTC hours/minutes to avoid client timezone issues.
  const hh = d.getUTCHours();
  const mm = d.getUTCMinutes();
  return hh > 15 || (hh === 15 && mm >= 0);
}

function fmtTime(ts) {
  try {
    if (!ts) return "—";
    return new Date(ts.toMillis()).toLocaleTimeString();
  } catch {
    return "—";
  }
}

  // ============================
  // Calendar helpers
  // ============================
  // Load attendance records for the selected calendar month
  useEffect(() => {
    if (!user || !calendarMonth) return;
    (async () => {
      try {
        const recs = await getMonthAttendance(user.uid, calendarMonth);
        setCalendarRecords(recs);
      } catch (e) {
        console.error("Load calendar records:", e);
      }
    })();
  }, [user, calendarMonth]);

  // (removed duplicate declaration)

  const calendarDays = useMemo(() => {
    if (!calendarMonth) return [];
    const [y, m] = calendarMonth.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0);
    const startDow = firstDay.getDay(); // 0=Sun

    // Build lookup from monthly records
    const histMap = {};
    for (const h of (calendarRecords || [])) {
      if (h.date) histMap[h.date] = h;
    }

    const days = [];
    // Leading empty cells
    for (let i = 0; i < startDow; i++) days.push(null);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const record = histMap[dateStr] || null;
      const dow = new Date(y, m - 1, d).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isToday = dateStr === todayStr;

      let status = "none"; // none | approved | pending | rejected | late
      if (record) {
        const s = record.status || "";
        if (s === "IN_APPROVED" || s === "OUT_APPROVED" || s === "PENDING_OUT" || s === "REJECTED_OUT") {
          status = record.isLate ? "late" : "approved";
        } else if (s === "PENDING_IN") {
          status = "pending";
        } else if (s === "REJECTED") {
          status = "rejected";
        }
      }

      days.push({ date: dateStr, day: d, status, isWeekend, isToday, record });
    }

    return days;
  }, [calendarMonth, calendarRecords, todayStr]);


  // IMPORTANT: keep these labels aligned with ITEM_KEYS coming from your service
  const ITEM_LABELS = {
    bleach: "Bleach",
    antiseptic: "Antiseptic",
    detergent: "Detergent",
    serum: "Serum",
    soap: "Soap",
  };

  function getStudentItemReceived(student, itemKey) {
    return student?.items?.[itemKey]?.received === true;
  }

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

  const getStudentItemsProgress = useCallback(
    (student) => {
      const receivedCount = ITEM_KEYS.reduce(
        (acc, k) => acc + (getStudentItemReceived(student, k) ? 1 : 0),
        0
      );
      return { receivedCount, total: ITEM_KEYS.length };
    },
    []
  );

  const filteredItemStudents = useMemo(() => {
    const s = itemSearch.trim().toLowerCase();
    let rows = students;

    if (s) {
      rows = rows.filter((st) =>
        String(st.fullName || "").toLowerCase().includes(s)
      );
    }

    rows = rows.filter((st) => {
      const { receivedCount, total } = getStudentItemsProgress(st);
      const isCompleted = receivedCount === total;

      if (itemFilter === "COMPLETED") return isCompleted;
      if (itemFilter === "MISSING") return !isCompleted;
      return true; // ALL
    });

    return rows;
  }, [students, itemSearch, itemFilter, getStudentItemsProgress]);

  async function toggleItemReceived(studentId, itemKey) {
    setItemMsg("");
    if (!user?.uid) return;

    if (!teacherClass?.id) {
      setItemMsg("No class assigned. Contact admin.");
      return;
    }

    // Optimistic UI update
    const prevStudents = students;
    const nextStudents = students.map((st) => {
      if (st.id !== studentId) return st;

      const current = st?.items?.[itemKey]?.received === true;
      const nextReceived = !current;

      return {
        ...st,
        items: {
          ...(st.items || {}),
          [itemKey]: {
            ...(st.items?.[itemKey] || {}),
            received: nextReceived,
          },
        },
      };
    });

    setStudents(nextStudents);

    setItemBusy(true);
    try {
      const st = nextStudents.find((x) => x.id === studentId);
      const received = st?.items?.[itemKey]?.received === true;

      await setStudentItemReceived({
        classId: teacherClass.id,
        studentId,
        itemKey,
        received,
        teacherUid: user.uid,
      });

      setItemMsg("Saved.");
    } catch (e) {
      setStudents(prevStudents);
      setItemMsg(e?.message || "Failed to update item.");
    } finally {
      setItemBusy(false);
      setTimeout(() => setItemMsg(""), 1500);
    }
  }

  async function handleSaveBankDetails() {
  setBankMsg("");
  if (!user?.uid) return;

  const cleanBank = String(bankName || "").trim();
  const cleanAcct = String(bankAccountNumber || "").trim();
  const cleanSsnit = String(ssnitNumber || "").trim();

  // Minimal validation (adjust as you like)
  if (!cleanBank) {
    setBankMsg("Bank name is required.");
    return;
  }
  if (!cleanAcct) {
    setBankMsg("Bank account number is required.");
    return;
  }
  if (cleanAcct.length < 6) {
    setBankMsg("Bank account number looks too short.");
    return;
  }
  if (!cleanSsnit) {
    setBankMsg("SSNIT number is required.");
    return;
  }

  setBankBusy(true);
  try {
    await updateDoc(doc(db, "users", user.uid), {
      bankName: cleanBank,
      bankAccountNumber: cleanAcct,
      ssnitNumber: cleanSsnit,
      updatedAt: serverTimestamp(),
    });

    setBankMsg("Saved successfully.");
    await refresh(); // reload profile so UI stays consistent
  } catch (e) {
    setBankMsg(e?.message || "Failed to save bank details.");
  } finally {
    setBankBusy(false);
    setTimeout(() => setBankMsg(""), 2000);
  }
}


  async function loadClassAttendance(teacherUid) {
    const cls = await getTeacherClass(teacherUid);
    setTeacherClass(cls);

    const studs = await getStudentsForClass(cls.id);
    setStudents(studs);

    const sessionId = `${cls.id}_${todayKey()}`;
    const existingAbsent = await getTodayAbsenceIds(sessionId);
    setAbsentIds(existingAbsent);

    setAttendanceSummary(null);

    // Load stats + frequent absentees in background
    try {
      const [stats, frequent] = await Promise.all([
        getClassAttendanceSummary(cls.id),
        getFrequentAbsentees(cls.id, 30, 3),
      ]);
      setAttendanceStats(stats);
      setFrequentAbsentees(frequent);
    } catch {
      /* non-critical */
    }
  }

  async function loadHistoryForDate(dateStr) {
    if (!teacherClass?.id || !dateStr) return;
    setHistoryBusy(true);
    setHistorySession(null);
    try {
      const session = await getSessionWithAbsent(teacherClass.id, dateStr);
      setHistorySession(session);
    } catch (e) {
      setAttendanceMsg(e?.message || "Failed to load history.");
    } finally {
      setHistoryBusy(false);
    }
  }

  useEffect(() => {
  if (!profile) return;

  setBankName(profile.bankName || "");
  setBankAccountNumber(profile.bankAccountNumber || "");
  setSsnitNumber(profile.ssnitNumber || "");
}, [profile]);


  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) return;

      try {
        const profSnap = await getDoc(doc(db, "users", u.uid));
        const profData = profSnap.exists() ? profSnap.data() : null;
        setProfile(profData);

        // Check if teacher is blocked
        if (profData?.isBlocked) {
          setIsBlocked(true);
          setBlockedReason(profData.blockedReason || "No absence reason provided.");
          return; // stop loading anything else
        }

        // Check if teacher missed attendance yesterday
        try {
          const missed = await checkMissedAttendance(u.uid);
          if (missed.missed) {
            setMissedInfo(missed);
          }
        } catch (e) {
          console.error("Error checking missed attendance:", e);
        }

        const t = await getTodayAttendance(u.uid);
        setToday(t.data);

        const s = await getSalarySummary(u.uid);
        setSalary(s);

        const h = await getRecentAttendance(u.uid, 14);
        setHistory(h);

        // Refresh calendar records for current month
        try {
          const calRecs = await getMonthAttendance(u.uid, calendarMonth);
          setCalendarRecords(calRecs);
        } catch (e) {
          console.error("Calendar records:", e);
        }

        await loadClassAttendance(u.uid);

        // Load notifications
        try {
          const notifs = await getUserNotifications(u.uid);
          setNotifications(notifs);
          setUnreadCount(notifs.filter((n) => !n.read).length);
        } catch (e) {
          console.error("Error loading notifications:", e);
        }

        // Load leave requests
        try {
          const leaves = await getTeacherLeaveRequests(u.uid);
          setLeaveRequests(leaves);
        } catch (e) {
          console.error("Error loading leave requests:", e);
        }

        // Load assessment history
        try {
          const hist = await getTeacherAssessments(u.uid, 12);
          setAssessHistory(hist);
        } catch (e) {
          console.error("Error loading assessments:", e);
        }
      } catch (e) {
        setMsg(e?.message || "Failed to load dashboard.");
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    if (!user) return;

    const profSnap = await getDoc(doc(db, "users", user.uid));
    const profData = profSnap.exists() ? profSnap.data() : null;
    setProfile(profData);

    // Check if teacher is blocked
    if (profData?.isBlocked) {
      setIsBlocked(true);
      setBlockedReason(profData.blockedReason || "No absence reason provided.");
      return;
    }
    setIsBlocked(false);
    setBlockedReason("");

    // Check if teacher missed attendance yesterday
    try {
      const missed = await checkMissedAttendance(user.uid);
      if (missed.missed) {
        setMissedInfo(missed);
      } else {
        setMissedInfo(null);
      }
    } catch (e) {
      console.error("Error checking missed attendance:", e);
    }

    const t = await getTodayAttendance(user.uid);
    setToday(t.data);

    const s = await getSalarySummary(user.uid);
    setSalary(s);

    const h = await getRecentAttendance(user.uid, 14);
    setHistory(h);

    // Refresh calendar records
    try {
      const calRecs = await getMonthAttendance(user.uid, calendarMonth);
      setCalendarRecords(calRecs);
    } catch (e) {
      console.error("Calendar records:", e);
    }

    await loadClassAttendance(user.uid);
  }

  const status = today?.status || "NOT_REQUESTED";

  const canSubmit = useMemo(() => {
    if (!user) return false;
    return status === "NOT_REQUESTED" || status === "REJECTED";
  }, [user, status]);

  const submitLabel = useMemo(() => {
    if (status === "PENDING_IN") return "Waiting for approval…";
    if (status === "IN_APPROVED") return "Approved";
    if (status === "REJECTED") return "Re-submit Request";
    return "Request Check-In";
  }, [status]);

  const after3pm = useMemo(() => isAfter3pmGMT(new Date(nowTick)), [nowTick]);

// Show checkout section as soon as check-in is approved (and continue showing during checkout states)
const showCheckoutSection = useMemo(() => {
  return (
    status === "IN_APPROVED" ||
    status === "PENDING_OUT" ||
    status === "OUT_APPROVED" ||
    status === "REJECTED_OUT"
  );
}, [status]);

// Teacher can request checkout when check-in is approved OR checkout was rejected (allow retry)
const canRequestCheckout = useMemo(() => {
  return status === "IN_APPROVED" || status === "REJECTED_OUT";
}, [status]);

const checkoutDisabledReason = useMemo(() => {
  if (!showCheckoutSection) return "";
  if (!after3pm) return "Checkout opens after 3:00pm GMT.";
  if (!canRequestCheckout) {
    if (status === "PENDING_OUT") return "Checkout already requested. Waiting for admin approval…";
    if (status === "OUT_APPROVED") return "Checkout approved.";
    return "Checkout not available.";
  }
  return "";
}, [showCheckoutSection, after3pm, canRequestCheckout, status]);

async function handleRequestCheckout() {
  setMsg("");
  if (!user?.uid) return;

  setBusy(true);
  try {
    if (!after3pm) throw new Error("Checkout opens after 3:00pm GMT.");
    if (!canRequestCheckout) return;

    await requestCheckOut(user.uid);
    await refresh();
    setMsg("Checkout request submitted. Waiting for admin approval.");
  } catch (e) {
    setMsg(e?.message || "Checkout request failed.");
  } finally {
    setBusy(false);
  }
}


  async function handleRequestCheckIn() {
    setMsg("");
    if (!user) return;

    setBusy(true);
    try {
      await requestCheckIn(user.uid, code);
      setCode("");
      await refresh();
      setMsg("Check-in request submitted. Waiting for admin approval.");
    } catch (e) {
      setMsg(e?.message || "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  // ============================
  // Absence Reason handler
  // ============================
  async function handleSubmitAbsenceReason() {
    setAbsenceMsg("");
    if (!user?.uid || !missedInfo) return;

    setAbsenceBusy(true);
    try {
      await submitAbsenceReason(user.uid, {
        date: missedInfo.missedDate,
        reason: absenceReason,
        missedType: missedInfo.missedType,
      });
      setAbsenceMsg("Reason submitted. Thank you.");
      setMissedInfo(null);
      setAbsenceReason("");
    } catch (e) {
      setAbsenceMsg(e?.message || "Failed to submit reason.");
    } finally {
      setAbsenceBusy(false);
    }
  }

  async function handleDismissAbsenceWarning() {
    // If teacher dismisses without providing a reason, BLOCK them
    if (!user?.uid || !missedInfo) return;

    setAbsenceBusy(true);
    try {
      await blockTeacher(user.uid, `No reason provided for missed ${missedInfo.missedType === "NO_CHECKIN" ? "check-in" : "check-out"} on ${missedInfo.missedDate}`);
      setIsBlocked(true);
      setBlockedReason(`You were blocked for not providing a reason for your missed attendance on ${missedInfo.missedDate}. Contact admin to unblock.`);
      setMissedInfo(null);
    } catch (e) {
      setAbsenceMsg(e?.message || "Error.");
    } finally {
      setAbsenceBusy(false);
    }
  }

  const isPreschool = useMemo(() => {
    if (teacherClass?.classGroup) return teacherClass.classGroup === "PRESCHOOL";
    return isPreschoolClassName(teacherClass?.name);
  }, [teacherClass]);

  const showRejected = status === "REJECTED";
  const rejectionReason = today?.rejectionReason || "";
  const rejectedAt = today?.rejectedAt ? new Date(today.rejectedAt.toMillis()) : null;

  // ============================
  // Attendance helpers
  // ============================
  const presentCount = useMemo(() => {
    const total = students.length;
    const absent = absentIds.size;
    return Math.max(0, total - absent);
  }, [students.length, absentIds]);

  function toggleAbsent(studentId) {
    setAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function markAllPresent() {
    setAbsentIds(new Set());
  }

  useEffect(() => {
  const t = setInterval(() => setNowTick(Date.now()), 30_000); // 30s tick
  return () => clearInterval(t);
}, []);


  async function handleSubmitClassAttendance() {
    setAttendanceMsg("");
    setAttendanceSummary(null);

    if (!user?.uid) return;

    if (!teacherClass?.id) {
      setAttendanceMsg("No class assigned. Contact admin.");
      return;
    }
    if (!students.length) {
      setAttendanceMsg("No students in your class yet. Contact admin.");
      return;
    }

    setAttendanceBusy(true);
    try {
      const absentStudentIds = Array.from(absentIds);

      const res = await submitTodayClassAttendance({
        teacherUid: user.uid,
        classId: teacherClass.id,
        students,
        absentStudentIds,
        absenceReasons,
      });

      setAttendanceSummary(res);
      setAttendanceMsg("Attendance submitted successfully.");
    } catch (e) {
      setAttendanceMsg(e?.message || "Failed to submit class attendance.");
    } finally {
      setAttendanceBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ========== BLOCKED OVERLAY ========== */}
      {isBlocked ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-bold text-rose-700">Account Blocked</h2>
            <p className="mt-3 text-sm text-slate-700">
              Your account has been blocked due to:
            </p>
            <div className="mt-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-medium text-rose-800">
              {blockedReason || "No absence reason provided."}
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Please contact the school admin to resolve this and get unblocked.
            </p>
            <button
              onClick={() => signOut(auth)}
              className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}

      {/* ========== ABSENCE REASON MODAL ========== */}
      {missedInfo && !isBlocked ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Missed Attendance — Reason Required
                </h3>
                <p className="text-sm text-slate-600">
                  {missedInfo.missedType === "NO_CHECKIN"
                    ? `You did not check in on ${missedInfo.missedDate}.`
                    : `You did not check out on ${missedInfo.missedDate}.`}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
              <strong>Warning:</strong> If you dismiss this without providing a reason, your account will be <strong>blocked</strong> and you will need to contact the admin to unblock it.
            </div>

            {absenceMsg ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {absenceMsg}
              </div>
            ) : null}

            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-600">
                Reason for missing {missedInfo.missedType === "NO_CHECKIN" ? "check-in" : "check-out"}
              </label>
              <textarea
                value={absenceReason}
                onChange={(e) => setAbsenceReason(e.target.value)}
                rows={4}
                disabled={absenceBusy}
                placeholder="Explain why you missed your attendance (e.g. sick leave, family emergency, travel)..."
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            <div className="mt-5 flex gap-3">
              <button
                disabled={absenceBusy || !absenceReason.trim()}
                onClick={handleSubmitAbsenceReason}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {absenceBusy ? "Submitting..." : "Submit Reason"}
              </button>
              <button
                disabled={absenceBusy}
                onClick={handleDismissAbsenceWarning}
                className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
              >
                {absenceBusy ? "..." : "Dismiss (will block)"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* ═══ Header ═══ */}
        <div className="mb-6 overflow-hidden rounded-2xl bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-500 p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t("dashboard")} — {t("teacher")}
              </h1>
              <p className="mt-1 text-sm text-white/80">
                {profile?.fullName ? profile.fullName : user?.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* 🌐 Language Switcher */}
              <LanguageSwitcher />
              {/* 🔔 Notification Bell */}
              <button
                onClick={async () => {
                  setShowNotifPanel((p) => !p);
                  // Auto-refresh when opening
                  if (!showNotifPanel && user) {
                    try {
                      const notifs = await getUserNotifications(user.uid);
                      setNotifications(notifs);
                      setUnreadCount(notifs.filter((n) => !n.read).length);
                    } catch (e) {
                      console.error("Auto-refresh notifications failed:", e);
                    }
                  }
                }}
                className={[
                  "relative rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-lg backdrop-blur-sm transition hover:bg-white/20",
                  unreadCount > 0 ? "ring-2 ring-yellow-300/60" : "",
                ].join(" ")}
              >
                <span className={unreadCount > 0 ? "inline-block animate-bell-ring" : ""}>
                  🔔
                </span>
                {unreadCount > 0 && (
                  <>
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow animate-badge-pulse">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                    <span className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-red-400 animate-badge-ping" />
                  </>
                )}
              </button>
              <button
                onClick={() => signOut(auth)}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                {t("logout")}
              </button>
            </div>
          </div>
        </div>

        {/* ═══ Notification Panel (slide-down) ═══ */}
        {showNotifPanel && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">🔔 Notifications</h3>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!user) return;
                    try {
                      const notifs = await getUserNotifications(user.uid);
                      setNotifications(notifs);
                      setUnreadCount(notifs.filter((n) => !n.read).length);
                    } catch (e) {
                      console.error("Refresh notifications failed:", e);
                    }
                  }}
                  className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  ↻ Refresh
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={async () => {
                      if (!user) return;
                      await markAllRead(user.uid);
                      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                      setUnreadCount(0);
                    }}
                    className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowNotifPanel(false)}
                  className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-3 max-h-80 space-y-2 overflow-auto">
              {notifications.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={async () => {
                      if (!n.read) {
                        await markNotificationRead(n.id);
                        setNotifications((prev) =>
                          prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
                        );
                        setUnreadCount((c) => Math.max(0, c - 1));
                      }
                    }}
                    className={[
                      "cursor-pointer rounded-xl border px-4 py-3 transition",
                      n.read
                        ? "border-slate-100 bg-slate-50"
                        : "border-indigo-200 bg-indigo-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900">
                        {n.title || "Notification"}
                      </div>
                      {!n.read && (
                        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{n.body || ""}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {n.createdAt?.toDate
                        ? n.createdAt.toDate().toLocaleString()
                        : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ═══ Tab Navigation ═══ */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { id: "checkin",    label: "Check-in",     icon: "🕐", bg: "bg-emerald-500",  ring: "ring-emerald-300" },
            { id: "attendance", label: "Attendance",   icon: "✅", bg: "bg-indigo-500",   ring: "ring-indigo-300" },
            { id: "items",      label: "Items",        icon: "📦", bg: "bg-amber-500",    ring: "ring-amber-300" },
            { id: "salary",     label: "Salary & Bank",icon: "💰", bg: "bg-violet-500",   ring: "ring-violet-300" },
            { id: "profile",    label: "Profile",      icon: "👤", bg: "bg-sky-500",      ring: "ring-sky-300" },
            { id: "leave",      label: "Leave",        icon: "🏖️", bg: "bg-orange-500",   ring: "ring-orange-300" },
            { id: "assessment", label: "Assessment",   icon: "📋", bg: "bg-violet-500",   ring: "ring-violet-300" },
            { id: "reports",    label: "Reports",      icon: "📝", bg: "bg-rose-500",     ring: "ring-rose-300" },
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
            </button>
          ))}
        </div>

        {msg ? (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {msg}
          </div>
        ) : null}

        {/* ========== HOLIDAY BANNER or DAILY MOTIVATIONAL QUOTE ========== */}
        {holidayName ? (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-linear-to-r from-amber-50 to-yellow-50 px-5 py-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-2xl">
                🎉
              </div>
              <div>
                <div className="text-lg font-bold text-amber-700">Today is a Public Holiday!</div>
                <div className="mt-1 text-base font-semibold text-amber-800">{holidayName}</div>
                <div className="mt-1 text-sm text-amber-700">Enjoy your day off, teacher!</div>
              </div>
            </div>
          </div>
        ) : dailyQuote ? (
          <div className="mb-6 rounded-2xl border border-indigo-200 bg-linear-to-r from-indigo-50 to-purple-50 px-5 py-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl">
                ✨
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                  {dailyQuote.greeting}
                </div>
                <p className="mt-2 text-sm font-medium italic text-slate-800">
                  "{dailyQuote.quote}"
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  — {dailyQuote.author}
                </p>
                <p className="mt-2 text-xs text-indigo-600">
                  Have a wonderful and productive day! 💪
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* ═══ TAB: Check-in ═══ */}
        <div className={activeTab !== "checkin" ? "hidden" : ""}>

        {showRejected ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <div className="font-semibold">Your check-in request was rejected.</div>
            <div className="mt-1 text-rose-800">
              {rejectionReason ? `Reason: ${rejectionReason}` : "Reason not provided."}
            </div>
            {rejectedAt ? (
              <div className="mt-1 text-xs text-rose-700">
                Rejected at: {rejectedAt.toLocaleTimeString()}
              </div>
            ) : null}
            <div className="mt-2 text-xs text-rose-700">
              You can correct the issue and re-submit using the daily code.
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Today */}
          <div className="rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-teal-50 p-6 shadow-sm border-l-4 border-l-emerald-400">
            <h2 className="text-base font-semibold text-emerald-900">Today</h2>
            <p className="mt-2 text-sm text-slate-600">
              Status: <span className="font-semibold text-slate-900">{status}</span>
            </p>

            <div className="mt-5">
              <label className="text-sm font-medium text-slate-700">Daily Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter code"
                disabled={busy || !canSubmit}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
              />

              <button
                disabled={busy || !canSubmit}
                onClick={handleRequestCheckIn}
                className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {busy ? "Submitting..." : submitLabel}
              </button>

              {/* Checkout (shows once check-in is approved) */}
{showCheckoutSection ? (
  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-semibold text-slate-900">Checkout</div>
        <div className="mt-1 text-xs text-slate-600">
          {status === "IN_APPROVED"
            ? "You can request checkout today (enabled after 3:00pm GMT)."
            : status === "PENDING_OUT"
            ? "Checkout requested. Waiting for admin approval…"
            : status === "OUT_APPROVED"
            ? "Checkout approved. Have a good day."
            : status === "REJECTED_OUT"
            ? "Your checkout was rejected. You can re-request after 3:00pm GMT."
            : ""}
        </div>

        <div className="mt-2 text-xs text-slate-600">
          Check-in approved:{" "}
          <span className="font-semibold text-slate-900">
            {fmtTime(today?.checkInApprovedAt)}
          </span>
        </div>

        {status === "OUT_APPROVED" ? (
          <div className="mt-1 text-xs text-slate-600">
            Checkout approved:{" "}
            <span className="font-semibold text-slate-900">
              {fmtTime(today?.checkOutApprovedAt)}
            </span>
          </div>
        ) : null}

        {status === "REJECTED_OUT" ? (
          <div className="mt-2 text-xs text-rose-700">
            {today?.checkOutRejectionReason
              ? `Reason: ${today.checkOutRejectionReason}`
              : "Reason not provided."}
          </div>
        ) : null}

        {!after3pm ? (
          <div className="mt-2 text-xs text-amber-700">
            Checkout will unlock at 3:00pm GMT.
          </div>
        ) : null}
      </div>

      <div className="flex flex-col items-end gap-2">
        <button
          disabled={
            busy ||
            !after3pm ||
            !canRequestCheckout ||
            status === "PENDING_OUT" ||
            status === "OUT_APPROVED"
          }
          onClick={handleRequestCheckout}
          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-60"
        >
          {busy
            ? "Working..."
            : status === "PENDING_OUT"
            ? "Pending..."
            : status === "OUT_APPROVED"
            ? "Checked out"
            : "Request Checkout"}
        </button>

        {checkoutDisabledReason ? (
          <div className="text-xs text-slate-500">{checkoutDisabledReason}</div>
        ) : null}
      </div>
    </div>
  </div>
) : null}


              <p className="mt-3 text-xs text-slate-500">
                Late after <span className="font-semibold">06:15</span>. Penalty is applied per late day.
              </p>
            </div>
          </div>

          {/* Salary */}
          <div className="rounded-2xl border border-violet-200 bg-linear-to-br from-violet-50 to-purple-50 p-6 shadow-sm border-l-4 border-l-violet-400">
            <h2 className="text-base font-semibold text-violet-900">
              {salary?.monthName ? `Salary — ${salary.monthName}` : "This Month Salary"}
            </h2>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Base salary</span>
                <span className="font-semibold text-slate-900">
                  {salary ? `${salary.currency} ${salary.baseSalary}` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Late days</span>
                <span className="font-semibold text-slate-900">
                  {salary ? salary.lateCount : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total penalty</span>
                <span className="font-semibold text-slate-900">
                  {salary ? `${salary.currency} ${salary.penaltyTotal}` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Month</span>
                <span className="font-semibold text-slate-900">
                  {salary ? salary.monthName : "—"}
                </span>
              </div>

              <div className="flex justify-between border-t border-slate-200 pt-3">
                <span className="text-slate-900 font-semibold">Net salary</span>
                <span className="text-slate-900 font-semibold">
                  {salary ? `${salary.currency} ${salary.netSalary}` : "—"}
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Net salary = base salary − late penalties (GHS 5 per late day).
            </p>
          </div>
        </div>
        </div>

        {/* ═══ TAB: Salary & Bank ═══ */}
        <div className={activeTab !== "salary" ? "hidden" : ""}>

        {/* Salary Overview */}
        <div className="mb-6 rounded-2xl border border-violet-200 bg-linear-to-br from-violet-50 to-purple-50 p-6 shadow-sm border-l-4 border-l-violet-400">
          <h2 className="text-base font-semibold text-violet-900">
            {salary?.monthName ? `Salary — ${salary.monthName}` : "This Month Salary"}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-violet-200 bg-white/60 px-4 py-3 text-center">
              <div className="text-xs font-semibold text-violet-600">Base Salary</div>
              <div className="mt-1 text-lg font-bold text-violet-900">
                {salary ? `${salary.currency} ${salary.baseSalary}` : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-white/60 px-4 py-3 text-center">
              <div className="text-xs font-semibold text-amber-600">Late Days</div>
              <div className="mt-1 text-lg font-bold text-amber-900">
                {salary ? salary.lateCount : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-white/60 px-4 py-3 text-center">
              <div className="text-xs font-semibold text-rose-600">Penalty</div>
              <div className="mt-1 text-lg font-bold text-rose-900">
                {salary ? `${salary.currency} ${salary.penaltyTotal}` : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white/60 px-4 py-3 text-center">
              <div className="text-xs font-semibold text-emerald-600">Net Salary</div>
              <div className="mt-1 text-lg font-bold text-emerald-900">
                {salary ? `${salary.currency} ${salary.netSalary}` : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Bank + SSNIT Details */}
<div className="mt-6 rounded-2xl border border-violet-200 bg-linear-to-br from-violet-50 to-purple-50 p-6 shadow-sm border-l-4 border-l-violet-400">
  <div className="flex items-start justify-between gap-4">
    <div>
      <h2 className="text-base font-semibold text-violet-900">
        Bank & SSNIT Details
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Provide details for salary processing. Only admins can view payroll details (recommended).
      </p>
    </div>
  </div>

  {bankMsg ? (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      {bankMsg}
    </div>
  ) : null}

  <div className="mt-4 grid gap-4 md:grid-cols-3">
    <div>
      <label className="text-xs font-semibold text-slate-600">Bank name</label>
      <input
        value={bankName}
        onChange={(e) => setBankName(e.target.value)}
        placeholder="e.g. Ecobank"
        disabled={bankBusy}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
      />
    </div>

    <div>
      <label className="text-xs font-semibold text-slate-600">
        Bank account number
      </label>
      <input
        value={bankAccountNumber}
        onChange={(e) => setBankAccountNumber(e.target.value)}
        placeholder="e.g. 0123456789"
        disabled={bankBusy}
        inputMode="numeric"
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
      />
    </div>

    <div>
      <label className="text-xs font-semibold text-slate-600">
        SSNIT number
      </label>
      <input
        value={ssnitNumber}
        onChange={(e) => setSsnitNumber(e.target.value)}
        placeholder="e.g. C1234567890"
        disabled={bankBusy}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50 disabled:text-slate-400"
      />
    </div>
  </div>

  <button
    disabled={bankBusy || !user?.uid}
    onClick={handleSaveBankDetails}
    className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
  >
    {bankBusy ? "Saving..." : "Save Bank Details"}
  </button>
</div>
        </div>

        {/* ═══ TAB: Attendance ═══ */}
        <div className={activeTab !== "attendance" ? "hidden" : ""}>

        {/* Weekly / Monthly Stats */}
        {attendanceStats && (
          <div className="mb-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <div className="text-xs font-semibold text-indigo-600">This Week</div>
              <div className="mt-1 text-2xl font-bold text-indigo-900">{attendanceStats.week.rate}%</div>
              <div className="mt-0.5 text-[10px] text-indigo-600">{attendanceStats.week.days} day{attendanceStats.week.days !== 1 ? "s" : ""} • {attendanceStats.week.present} present</div>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
              <div className="text-xs font-semibold text-violet-600">This Month (30d)</div>
              <div className="mt-1 text-2xl font-bold text-violet-900">{attendanceStats.month.rate}%</div>
              <div className="mt-0.5 text-[10px] text-violet-600">{attendanceStats.month.days} day{attendanceStats.month.days !== 1 ? "s" : ""} • {attendanceStats.month.present} present</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="text-xs font-semibold text-emerald-600">Total Present (30d)</div>
              <div className="mt-1 text-2xl font-bold text-emerald-900">{attendanceStats.month.present}</div>
              <div className="mt-0.5 text-[10px] text-emerald-600">out of {attendanceStats.month.total} records</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <div className="text-xs font-semibold text-rose-600">Total Absent (30d)</div>
              <div className="mt-1 text-2xl font-bold text-rose-900">{attendanceStats.month.absent}</div>
              <div className="mt-0.5 text-[10px] text-rose-600">{attendanceStats.totalSessions} session{attendanceStats.totalSessions !== 1 ? "s" : ""} submitted</div>
            </div>
          </div>
        )}

        {/* Frequent Absentees Alert */}
        {frequentAbsentees.length > 0 && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-800">⚠️ Frequently Absent Students (3+ times in 30 days)</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {frequentAbsentees.map((fa) => (
                <span key={fa.studentId} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-800">
                  {fa.studentName}
                  <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{fa.absentCount}×</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Class Attendance */}
        <div className="rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-blue-50 p-6 shadow-sm border-l-4 border-l-indigo-400">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-indigo-900">
                Class Attendance (Today)
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {teacherClass ? (
                  <>
                    Class:{" "}
                    <span className="font-semibold text-slate-900">
                      {teacherClass.name || teacherClass.id}
                    </span>
                  </>
                ) : (
                  "Loading class…"
                )}
              </p>
            </div>

            <button
              disabled={attendanceBusy}
              onClick={markAllPresent}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Mark all present
            </button>
          </div>

          {attendanceMsg ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {attendanceMsg}
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <div className="text-xs font-semibold text-indigo-600">Total students</div>
              <div className="mt-1 text-lg font-semibold text-indigo-900">
                {students.length}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="text-xs font-semibold text-emerald-600">Present</div>
              <div className="mt-1 text-lg font-semibold text-emerald-900">
                {presentCount}
              </div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <div className="text-xs font-semibold text-rose-600">Absent</div>
              <div className="mt-1 text-lg font-semibold text-rose-900">
                {absentIds.size}
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-3 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
              <div>Student</div>
              <div>Status</div>
              <div className="text-right">Action</div>
            </div>

            {students.length ? (
              students.map((s) => {
                const isAbsent = absentIds.has(s.id);
                return (
                  <div key={s.id} className="border-t border-slate-200">
                    <div className="grid grid-cols-3 items-center gap-x-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">
                          {s.fullName || "—"}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <span
                          className={[
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                            isAbsent
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200",
                          ].join(" ")}
                        >
                          {isAbsent ? "Absent" : "Present"}
                        </span>
                      </div>

                      <div className="text-right">
                        <button
                          disabled={attendanceBusy}
                          onClick={() => toggleAbsent(s.id)}
                          className={[
                            "rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60",
                            isAbsent
                              ? "bg-emerald-600 text-white hover:bg-emerald-500"
                              : "bg-rose-600 text-white hover:bg-rose-500",
                          ].join(" ")}
                        >
                          {isAbsent ? "Mark Present" : "Mark Absent"}
                        </button>
                      </div>
                    </div>

                    {/* Absence reason input (shown when marked absent) */}
                    {isAbsent && (
                      <div className="border-t border-rose-100 bg-rose-50/50 px-4 py-2">
                        <input
                          value={absenceReasons[s.id] || ""}
                          onChange={(e) => setAbsenceReasons((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          placeholder="Reason for absence (optional)…"
                          className="w-full rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs outline-none focus:ring focus:ring-rose-200"
                        />
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-6 text-sm text-slate-600">
                No students found for this class. Contact admin.
              </div>
            )}
          </div>

          <button
            disabled={attendanceBusy || !teacherClass || students.length === 0}
            onClick={handleSubmitClassAttendance}
            className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {attendanceBusy ? "Submitting..." : "Submit Today's Attendance"}
          </button>

          {attendanceSummary ? (
            <p className="mt-2 text-xs text-slate-500">
              Submitted for {attendanceSummary.date}. Present:{" "}
              <span className="font-semibold">{attendanceSummary.presentCount}</span>, Absent:{" "}
              <span className="font-semibold">{attendanceSummary.absentCount}</span>.
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Tip: Default is Present. Only mark Absentees, then submit. You can add a reason when marking absent.
            </p>
          )}
        </div>

        {/* Attendance History Browser */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">📅 Attendance History</h2>
          <p className="mt-1 text-xs text-slate-500">Browse past attendance records by date.</p>

          <div className="mt-4 flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-600">Select date</label>
              <input
                type="date"
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                max={todayKey()}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring"
              />
            </div>
            <button
              disabled={historyBusy || !historyDate}
              onClick={() => loadHistoryForDate(historyDate)}
              className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {historyBusy ? "Loading..." : "Load"}
            </button>
          </div>

          {historySession ? (
            <div className="mt-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold text-slate-600">Date</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{historySession.date}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="text-xs font-semibold text-emerald-600">Present</div>
                  <div className="mt-1 text-sm font-semibold text-emerald-900">{historySession.presentCount ?? "—"}</div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <div className="text-xs font-semibold text-rose-600">Absent</div>
                  <div className="mt-1 text-sm font-semibold text-rose-900">{historySession.absentCount ?? "—"}</div>
                </div>
              </div>

              {historySession.absentees?.length > 0 ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                  <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">Absentees</div>
                  {historySession.absentees.map((a) => (
                    <div key={a.id} className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-sm">
                      <span className="font-semibold text-slate-900">{a.studentName || "—"}</span>
                      <span className="text-xs text-slate-500">{a.reason || "No reason"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-emerald-700 font-medium">✅ All students were present on this day.</p>
              )}
            </div>
          ) : historyDate && !historyBusy ? (
            <p className="mt-4 text-sm text-slate-500">No attendance record found for this date. Click Load to fetch.</p>
          ) : null}
        </div>
        </div>

        {/* ═══ TAB: Items ═══ */}
        <div className={activeTab !== "items" ? "hidden" : ""}>
        {/* Student Items Collection */}
        <div className="mt-6 rounded-2xl border border-amber-200 bg-linear-to-br from-amber-50 to-orange-50 p-6 shadow-sm border-l-4 border-l-amber-400">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-amber-900">
                Student Items Collection
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Mark items as received when students bring them.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Class:{" "}
                <span className="font-semibold text-slate-800">
                  {teacherClass?.name || teacherClass?.id || "—"}
                </span>
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 md:w-auto md:min-w-[320px]">
              <input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search student..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
              />

              <div className="grid grid-cols-3 gap-2">
                <button
                  disabled={itemBusy}
                  onClick={() => setItemFilter("ALL")}
                  className={[
                    "rounded-xl border px-3 py-2 text-sm font-semibold",
                    itemFilter === "ALL"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  All
                </button>
                <button
                  disabled={itemBusy}
                  onClick={() => setItemFilter("MISSING")}
                  className={[
                    "rounded-xl border px-3 py-2 text-sm font-semibold",
                    itemFilter === "MISSING"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  Missing
                </button>
                <button
                  disabled={itemBusy}
                  onClick={() => setItemFilter("COMPLETED")}
                  className={[
                    "rounded-xl border px-3 py-2 text-sm font-semibold",
                    itemFilter === "COMPLETED"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  Completed
                </button>
              </div>
            </div>
          </div>

          {itemMsg ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {itemMsg}
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            {/* Header */}
            <div
              className="grid bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600"
              style={{ gridTemplateColumns: `2fr repeat(${ITEM_KEYS.length}, 1fr)` }}
            >
              <div className="col-span-1">Student</div>
              {ITEM_KEYS.map((k) => (
                <div key={k} className="text-left">
                  {ITEM_LABELS[k] || k}
                </div>
              ))}
            </div>

            {filteredItemStudents.length ? (
              filteredItemStudents.map((st) => {
                const { receivedCount, total } = getStudentItemsProgress(st);

                return (
                  <div
                    key={st.id}
                    className="border-t border-slate-200 px-4 py-3 text-sm"
                    style={{ display: "grid", gridTemplateColumns: `2fr repeat(${ITEM_KEYS.length}, 1fr)` }}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">
                        {st.fullName || "—"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {receivedCount}/{total} received
                      </div>
                    </div>

                    {ITEM_KEYS.map((k) => {
                      const received = getStudentItemReceived(st, k);

                      return (
                        <div key={k} className="flex items-center justify-start">
                          <button
                            disabled={itemBusy}
                            onClick={() => toggleItemReceived(st.id, k)}
                            className={[
                              "rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60",
                              received
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                            ].join(" ")}
                            title={ITEM_LABELS[k] || k}
                          >
                            {received ? "Received" : "Missing"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-6 text-sm text-slate-600">
                No students match your filter/search.
              </div>
            )}
          </div>
        </div>
        </div>

        {/* ═══ TAB: Profile ═══ */}
        <div className={activeTab !== "profile" ? "hidden" : ""}>
        {/* Profile + Attendance History */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Profile */}
          <div className="rounded-2xl border border-sky-200 bg-linear-to-br from-sky-50 to-cyan-50 p-6 shadow-sm border-l-4 border-l-sky-400">
            <h2 className="text-base font-semibold text-sky-900">Profile</h2>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Full name</span>
                <span className="font-semibold text-slate-900 text-right">
                  {profile?.fullName || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Contact</span>
                <span className="font-semibold text-slate-900 text-right">
                  {profile?.contact || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Address</span>
                <span className="font-semibold text-slate-900 text-right">
                  {profile?.address || "—"}
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              If any details are wrong, contact the admin to update your profile.
            </p>
          </div>

          {/* Attendance History */}
          <div className="rounded-2xl border border-sky-200 bg-linear-to-br from-sky-50 to-cyan-50 p-6 shadow-sm border-l-4 border-l-sky-400">
            <h2 className="text-base font-semibold text-sky-900">
              Attendance History (Last 14 days)
            </h2>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-4 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                <div>Date</div>
                <div>Status</div>
                <div>Late</div>
                <div className="text-right">Penalty</div>
              </div>

              {history?.length ? (
                history.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-4 items-center px-4 py-3 text-sm border-t border-slate-200"
                  >
                    <div className="text-slate-700">{row.date || "—"}</div>
                    <div className="text-slate-700">{row.status || "—"}</div>
                    <div className="text-slate-700">
                      {typeof row.isLate === "boolean" ? (row.isLate ? "Yes" : "No") : "—"}
                    </div>
                    <div className="text-right font-semibold text-slate-900">
                      {row.latePenalty != null ? `GHS ${row.latePenalty}` : "—"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-6 text-sm text-slate-600">
                  No recent attendance records yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ Attendance Calendar ═══ */}
        <div className="mt-6 rounded-2xl border border-sky-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-sky-900">📅 Attendance Calendar</h2>
            <input
              type="month"
              value={calendarMonth}
              onChange={(e) => setCalendarMonth(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring"
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-emerald-400" /> Approved</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-amber-400" /> Late</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-blue-400" /> Pending</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-red-400" /> Rejected</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-slate-200" /> Weekend</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded ring-2 ring-violet-500 bg-white" /> Today</span>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, i) =>
              cell === null ? (
                <div key={`empty-${i}`} />
              ) : (
                <div
                  key={cell.date}
                  title={cell.record ? `${cell.record.status}${cell.record.isLate ? " (Late)" : ""}` : cell.isWeekend ? "Weekend" : "No record"}
                  className={[
                    "flex h-9 items-center justify-center rounded-lg text-xs font-semibold transition",
                    cell.isToday ? "ring-2 ring-violet-500 ring-offset-1" : "",
                    cell.status === "approved"
                      ? "bg-emerald-200 text-emerald-800"
                      : cell.status === "late"
                      ? "bg-amber-200 text-amber-800"
                      : cell.status === "pending"
                      ? "bg-blue-200 text-blue-800"
                      : cell.status === "rejected"
                      ? "bg-red-200 text-red-800"
                      : cell.isWeekend
                      ? "bg-slate-100 text-slate-400"
                      : "bg-white text-slate-600",
                  ].join(" ")}
                >
                  {cell.day}
                </div>
              )
            )}
          </div>
        </div>
        </div>

        {/* ═══ TAB: Leave ═══ */}
        <div className={activeTab !== "leave" ? "hidden" : ""}>
          <div className="rounded-2xl border border-orange-200 bg-linear-to-br from-orange-50 to-amber-50 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-orange-900">🏖️ Request Leave</h2>
            <p className="mt-1 text-xs text-slate-500">
              Submit a leave request in advance. Admin will approve or deny.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-600">Leave Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
                >
                  <option value="">Select type...</option>
                  {LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Start Date</label>
                  <input
                    type="date"
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">End Date</label>
                  <input
                    type="date"
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-600">Reason</label>
              <textarea
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                rows={3}
                placeholder="Explain why you need leave..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
              />
            </div>

            <button
              disabled={leaveBusy || !leaveType || !leaveStart || !leaveEnd || !leaveReason.trim()}
              onClick={async () => {
                setLeaveBusy(true);
                try {
                  await createLeaveRequest({
                    teacherId: user.uid,
                    teacherName: profile?.fullName || user?.email || "",
                    leaveType,
                    startDate: leaveStart,
                    endDate: leaveEnd,
                    reason: leaveReason,
                  });
                  setLeaveType("");
                  setLeaveStart("");
                  setLeaveEnd("");
                  setLeaveReason("");
                  const leaves = await getTeacherLeaveRequests(user.uid);
                  setLeaveRequests(leaves);
                  setMsg("Leave request submitted!");
                } catch (e) {
                  setMsg(e?.message || "Failed to submit leave request.");
                } finally {
                  setLeaveBusy(false);
                }
              }}
              className="mt-4 rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-60"
            >
              {leaveBusy ? "Submitting..." : "Submit Leave Request"}
            </button>
          </div>

          {/* Leave History */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Your Leave Requests</h3>
            <div className="mt-3 max-h-96 space-y-2 overflow-auto">
              {leaveRequests.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">No leave requests yet.</p>
              ) : (
                leaveRequests.map((lr) => (
                  <div key={lr.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-sm font-semibold text-slate-900">
                          {LEAVE_TYPES.find((t) => t.value === lr.leaveType)?.label || lr.leaveType}
                        </span>
                        <span className="ml-2 text-xs text-slate-500">
                          {lr.startDate} → {lr.endDate}
                        </span>
                      </div>
                      <span className={[
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                        lr.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" :
                        lr.status === "REJECTED" ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700",
                      ].join(" ")}>
                        {lr.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{lr.reason}</p>
                    {lr.adminResponse && (
                      <p className="mt-1 text-xs text-indigo-600">Admin: {lr.adminResponse}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ═══ TAB: Self-Assessment (GES/NaCCA) ═══ */}
        <div className={activeTab !== "assessment" ? "hidden" : ""}>
          <div className="space-y-6">
            {/* Header */}
            <div className="rounded-2xl border border-violet-200 bg-linear-to-br from-violet-50 to-purple-50 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-violet-900">📋 Weekly Self-Assessment</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Rate yourself honestly on each GES/NaCCA criterion. Your submission will be reviewed by the Head Teacher.
                  </p>
                </div>
                <button
                  disabled={assessBusy || assessExistingStatus === "REVIEWED"}
                  onClick={async () => {
                    toast.dismiss();
                    if (!user) return;
                    const rated = Object.values(assessRatings).filter((r) => r.score > 0).length;
                    if (rated === 0) { toast.error("Rate at least one criterion."); return; }
                    setAssessBusy(true);
                    try {
                      if (assessExistingId) {
                        await updateWeeklyAssessment(assessExistingId, {
                          ratings: assessRatings,
                          strengthsObserved: assessStrengths,
                          areasForImprovement: assessAreas,
                          agreedActionPlan: assessActionPlan,
                          overallComment: assessComment,
                          status: "SUBMITTED",
                        });
                        setAssessExistingStatus("SUBMITTED");
                        toast.success("Assessment updated & submitted ✅");
                      } else {
                        const ref = await saveWeeklyAssessment({
                          teacherId: user.uid,
                          teacherName: profile?.fullName || user.email || "",
                          weekKey: assessWeek,
                          ratings: assessRatings,
                          strengthsObserved: assessStrengths,
                          areasForImprovement: assessAreas,
                          agreedActionPlan: assessActionPlan,
                          overallComment: assessComment,
                          status: "SUBMITTED",
                        });
                        setAssessExistingId(ref.id);
                        setAssessExistingStatus("SUBMITTED");
                        toast.success("Assessment submitted ✅");
                      }
                      const hist = await getTeacherAssessments(user.uid, 12);
                      setAssessHistory(hist);
                    } catch (e) {
                      toast.error(e?.message || "Failed to submit.");
                    } finally {
                      setAssessBusy(false);
                    }
                  }}
                  className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {assessBusy ? "Submitting..." : assessExistingId ? "Update & Resubmit" : "Submit Assessment"}
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Week</label>
                  <input
                    type="week"
                    value={assessWeek}
                    onChange={(e) => setAssessWeek(e.target.value)}
                    disabled={assessExistingStatus === "REVIEWED"}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50"
                  />
                </div>
                <div className="flex items-end">
                  {assessExistingStatus && (
                    <span className={[
                      "rounded-full border px-3 py-1.5 text-xs font-bold",
                      assessExistingStatus === "REVIEWED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      assessExistingStatus === "SUBMITTED" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-slate-50 text-slate-600 border-slate-200",
                    ].join(" ")}>
                      {assessExistingStatus === "REVIEWED" ? "✅ Reviewed by Admin" :
                       assessExistingStatus === "SUBMITTED" ? "⏳ Pending Review" : "📝 Draft"}
                    </span>
                  )}
                </div>
              </div>

              {assessExistingStatus === "REVIEWED" && (
                <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs text-emerald-800">
                  ✅ This assessment has been reviewed by admin. You cannot edit it.
                </div>
              )}
            </div>

            {/* Overall Score Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Your Self-Assessment Score</h3>
                  <div className="mt-1 flex items-baseline gap-3">
                    <span className="text-3xl font-extrabold text-slate-900">{assessScores.overall.pct}%</span>
                    <span className={[
                      "rounded-full border px-3 py-1 text-xs font-bold",
                      assessScores.overall.grade === "Excellent" ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
                      assessScores.overall.grade === "Good" ? "text-sky-700 bg-sky-50 border-sky-200" :
                      assessScores.overall.grade === "Satisfactory" ? "text-amber-700 bg-amber-50 border-amber-200" :
                      "text-rose-700 bg-rose-50 border-rose-200",
                    ].join(" ")}>
                      {assessScores.overall.grade}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{assessScores.overall.earned} / {assessScores.overall.possible} points</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {ASSESSMENT_DOMAINS.map((domain) => {
                    const ds = assessScores.domainScores[domain.id];
                    return (
                      <div key={domain.id} className="min-w-35 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          {domain.label.replace("Domain ", "D")}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-slate-200">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                ds.pct >= 75 ? "bg-emerald-500" : ds.pct >= 50 ? "bg-amber-500" : "bg-rose-500"
                              }`}
                              style={{ width: `${ds.pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-700">{ds.pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rating scale legend */}
              <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
                <span className="text-xs font-semibold text-slate-500">Scale:</span>
                {RATING_SCALE.map((r) => (
                  <span key={r.value} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                    <span className={`h-2 w-2 rounded-full ${
                      r.value === 4 ? "bg-emerald-500" : r.value === 3 ? "bg-sky-500" : r.value === 2 ? "bg-amber-500" : "bg-rose-500"
                    }`} />
                    {r.value} = {r.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Domain Sections */}
            {ASSESSMENT_DOMAINS.map((domain) => {
              const expanded = expandedDomains.has(domain.id);
              const ds = assessScores.domainScores[domain.id];

              return (
                <div key={domain.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <button
                    onClick={() => {
                      setExpandedDomains((prev) => {
                        const next = new Set(prev);
                        next.has(domain.id) ? next.delete(domain.id) : next.add(domain.id);
                        return next;
                      });
                    }}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left hover:bg-slate-50 transition"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{domain.label}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">{domain.description}</p>
                      <p className="mt-0.5 text-[10px] text-violet-600 font-semibold">{domain.gesRef}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-slate-900">{ds.pct}%</div>
                        <div className="text-[10px] text-slate-500">{ds.earned}/{ds.possible}</div>
                      </div>
                      <span className="text-lg text-slate-400">{expanded ? "▼" : "▶"}</span>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-100 divide-y divide-slate-100">
                      {domain.criteria.map((criterion) => {
                        const r = assessRatings?.[criterion.id] || { score: 0, comment: "" };
                        const isReadOnly = assessExistingStatus === "REVIEWED";

                        return (
                          <div key={criterion.id} className="px-6 py-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold text-slate-900">{criterion.label}</h4>
                                <p className="mt-1 text-xs text-slate-600">{criterion.description}</p>
                                <p className="mt-0.5 text-[10px] text-violet-500 font-semibold">Ref: {criterion.gesRef}</p>
                              </div>

                              {/* Rating Buttons */}
                              <div className="flex gap-1.5 shrink-0">
                                {RATING_SCALE.map((scale) => (
                                  <button
                                    key={scale.value}
                                    disabled={isReadOnly}
                                    onClick={() => {
                                      setAssessRatings((prev) => ({
                                        ...prev,
                                        [criterion.id]: { ...prev[criterion.id], score: scale.value },
                                      }));
                                    }}
                                    title={`${scale.value} – ${scale.label} (${scale.tag})`}
                                    className={[
                                      "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition",
                                      r.score === scale.value
                                        ? `${scale.value === 4 ? "bg-emerald-500 ring-emerald-300" : scale.value === 3 ? "bg-sky-500 ring-sky-300" : scale.value === 2 ? "bg-amber-500 ring-amber-300" : "bg-rose-500 ring-rose-300"} text-white ring-2 shadow-md`
                                        : "bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:hover:bg-slate-100",
                                    ].join(" ")}
                                  >
                                    {scale.value}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Indicators */}
                            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Look-fors / Indicators</div>
                              <ul className="space-y-1">
                                {criterion.indicators.map((ind, i) => (
                                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                    <span className="mt-0.5 text-violet-400">•</span>{ind}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Comment */}
                            <input
                              type="text"
                              placeholder="Your comment / reflection..."
                              value={r.comment}
                              disabled={isReadOnly}
                              onChange={(e) => {
                                setAssessRatings((prev) => ({
                                  ...prev,
                                  [criterion.id]: { ...prev[criterion.id], comment: e.target.value },
                                }));
                              }}
                              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs outline-none focus:ring focus:ring-violet-200 disabled:bg-slate-50"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Summary / Reflection */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Reflection & Action Plan</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-emerald-700">✅ My Strengths This Week</label>
                  <textarea
                    rows={3}
                    value={assessStrengths}
                    disabled={assessExistingStatus === "REVIEWED"}
                    onChange={(e) => setAssessStrengths(e.target.value)}
                    placeholder="What went well this week..."
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-amber-700">⚠️ Areas I Need to Improve</label>
                  <textarea
                    rows={3}
                    value={assessAreas}
                    disabled={assessExistingStatus === "REVIEWED"}
                    onChange={(e) => setAssessAreas(e.target.value)}
                    placeholder="What I need to work on..."
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-violet-700">📋 My Action Plan for Next Week</label>
                <textarea
                  rows={3}
                  value={assessActionPlan}
                  disabled={assessExistingStatus === "REVIEWED"}
                  onChange={(e) => setAssessActionPlan(e.target.value)}
                  placeholder="Specific steps I will take to improve..."
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">💬 Additional Comments</label>
                <textarea
                  rows={2}
                  value={assessComment}
                  disabled={assessExistingStatus === "REVIEWED"}
                  onChange={(e) => setAssessComment(e.target.value)}
                  placeholder="Any other remarks..."
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Admin Feedback (visible when reviewed) */}
            {assessExistingStatus === "REVIEWED" && assessHistory.length > 0 && (() => {
              const latest = assessHistory.find((h) => h.weekKey === assessWeek && h.status === "REVIEWED");
              if (!latest) return null;
              return (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-emerald-900">✅ Admin Feedback</h3>
                  <p className="mt-1 text-xs text-slate-500">Reviewed by: {latest.reviewedByName || "Admin"}</p>
                  {latest.adminComment && <div className="mt-3 text-sm text-slate-800"><span className="font-semibold">Comment:</span> {latest.adminComment}</div>}
                  {latest.adminStrengths && <div className="mt-2 text-sm text-slate-800"><span className="font-semibold text-emerald-700">Strengths noted:</span> {latest.adminStrengths}</div>}
                  {latest.adminAreasForImprovement && <div className="mt-2 text-sm text-slate-800"><span className="font-semibold text-amber-700">Areas to improve:</span> {latest.adminAreasForImprovement}</div>}
                  {latest.adminActionPlan && <div className="mt-2 text-sm text-slate-800"><span className="font-semibold text-violet-700">Action plan:</span> {latest.adminActionPlan}</div>}
                  {latest.adminPct != null && (
                    <div className="mt-3 text-sm">
                      <span className="font-semibold">Admin Rating:</span>{" "}
                      <span className="text-lg font-extrabold">{latest.adminPct}%</span>{" "}
                      <span className="text-xs font-bold text-slate-500">({latest.adminGrade})</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* History */}
            {assessHistory.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">📊 My Assessment History</h3>
                <div className="mt-4 space-y-2">
                  {assessHistory.map((h) => (
                    <div
                      key={h.id}
                      onClick={() => setAssessWeek(h.weekKey)}
                      className={[
                        "flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition hover:bg-slate-50",
                        h.weekKey === assessWeek ? "border-violet-300 bg-violet-50" : "border-slate-100 bg-slate-50",
                      ].join(" ")}
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Week: {h.weekKey}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={[
                            "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                            h.status === "REVIEWED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            h.status === "SUBMITTED" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-slate-50 text-slate-600 border-slate-200",
                          ].join(" ")}>
                            {h.status}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {h.createdAt?.toDate ? h.createdAt.toDate().toLocaleDateString() : ""}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-slate-900">{h.pct ?? 0}%</div>
                        <span className={[
                          "inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold",
                          h.grade === "Excellent" ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
                          h.grade === "Good" ? "text-sky-700 bg-sky-50 border-sky-200" :
                          h.grade === "Satisfactory" ? "text-amber-700 bg-amber-50 border-amber-200" :
                          "text-rose-700 bg-rose-50 border-rose-200",
                        ].join(" ")}>
                          {h.grade || "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ TAB: Reports ═══ */}
        <div className={activeTab !== "reports" ? "hidden" : ""}>
        {/* Reports section */}
       {isPreschool ? (
  <Report teacherClass={teacherClass} students={students} profile={profile} />
) : (
  <BasicReport teacherClass={teacherClass} students={students} profile={profile} />
)}
        </div>
      </div>
    </div>
  );
}
