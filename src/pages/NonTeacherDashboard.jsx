import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  getSalarySummary,
  getTodayAttendance,
  requestCheckIn,
  getRecentAttendance,
} from "../services/attendanceService";
import toast from "react-hot-toast";
import {
  checkMissedAttendance,
  submitAbsenceReason,
  blockTeacher,
} from "../services/absenceReasonService";

import { isSchoolDay, getHolidayName } from "../utils/ghanaHolidays";
import { getDailyQuote } from "../utils/mondayQuotes";
import { accraYyyyMmDd } from "../utils/accraTime";
import {
  getUserNotifications,
  markNotificationRead,
  markAllRead,
} from "../services/notificationService";
import { useLanguage } from "../i18n/useLanguage";
import LanguageSwitcher from "../i18n/LanguageSwitcher";

export default function NonTeacherDashboard() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [today, setToday] = useState(null);
  const [salary, setSalary] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);

  // Blocked / Absence Reason
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");
  const [missedInfo, setMissedInfo] = useState(null);
  const [absenceReason, setAbsenceReason] = useState("");
  const [absenceBusy, setAbsenceBusy] = useState(false);
  const [absenceMsg, setAbsenceMsg] = useState("");

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // Holiday Banner or Daily Motivational Quote
  const todayStr = accraYyyyMmDd();
  const holidayName = useMemo(() => getHolidayName(todayStr), [todayStr]);
  const dailyQuote = useMemo(() => {
    if (!isSchoolDay(todayStr)) return null;
    return getDailyQuote(todayStr);
  }, [todayStr]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) return;

      try {
        const profSnap = await getDoc(doc(db, "users", u.uid));
        const profData = profSnap.exists() ? profSnap.data() : null;
        setProfile(profData);

        if (profData?.isBlocked) {
          setIsBlocked(true);
          setBlockedReason(profData.blockedReason || "No absence reason provided.");
          return;
        }

        try {
          const missed = await checkMissedAttendance(u.uid);
          if (missed.missed) setMissedInfo(missed);
        } catch (e) {
          console.error("Error checking missed attendance:", e);
        }

        const t = await getTodayAttendance(u.uid);
        setToday(t.data);

        const s = await getSalarySummary(u.uid);
        setSalary(s);

        const h = await getRecentAttendance(u.uid, 14);
        setHistory(h);

        try {
          const notifs = await getUserNotifications(u.uid);
          setNotifications(notifs);
          setUnreadCount(notifs.filter((n) => !n.read).length);
        } catch (e) {
          console.error("Error loading notifications:", e);
        }
      } catch {
       toast.error("Failed to load dashboard data.");
      }
    });

    return () => unsub();
  }, []);

  async function refresh() {
    if (!user) return;

    const profSnap = await getDoc(doc(db, "users", user.uid));
    const profData = profSnap.exists() ? profSnap.data() : null;
    setProfile(profData);

    if (profData?.isBlocked) {
      setIsBlocked(true);
      setBlockedReason(profData.blockedReason || "No absence reason provided.");
      return;
    }
    setIsBlocked(false);
    setBlockedReason("");

    try {
      const missed = await checkMissedAttendance(user.uid);
      if (missed.missed) setMissedInfo(missed);
      else setMissedInfo(null);
    } catch (e) {
      console.error("Error checking missed attendance:", e);
    }

    const t = await getTodayAttendance(user.uid);
    setToday(t.data);

    const s = await getSalarySummary(user.uid);
    setSalary(s);

    const h = await getRecentAttendance(user.uid, 14);
    setHistory(h);
  }

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

  async function handleRequestCheckIn() {
    toast.dismiss();
    if (!user) return;

    setBusy(true);
    try {
      await requestCheckIn(user.uid, code);
      setCode("");
      await refresh();
      toast.success("Check-in request submitted. Waiting for admin approval.");
    } catch (e) {
      toast.error(e?.message || "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  const showRejected = status === "REJECTED";
  const rejectionReason = today?.rejectionReason || "";
  const rejectedAt = today?.rejectedAt ? new Date(today.rejectedAt.toMillis()) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* BLOCKED OVERLAY */}
      {isBlocked ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-bold text-rose-700">Account Blocked</h2>
            <p className="mt-3 text-sm text-slate-700">Your account has been blocked due to:</p>
            <div className="mt-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-medium text-rose-800">
              {blockedReason || "No absence reason provided."}
            </div>
            <p className="mt-4 text-sm text-slate-600">Please contact the school admin to resolve this and get unblocked.</p>
            <button onClick={() => signOut(auth)} className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">Sign out</button>
          </div>
        </div>
      ) : null}

      {/* ABSENCE REASON MODAL */}
      {missedInfo && !isBlocked ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Missed Attendance — Reason Required</h3>
            <p className="mt-1 text-sm text-slate-600">
              {missedInfo.missedType === "NO_CHECKIN"
                ? `You did not check in on ${missedInfo.missedDate}.`
                : `You did not check out on ${missedInfo.missedDate}.`}
            </p>
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
              <strong>Warning:</strong> Dismissing without a reason will <strong>block</strong> your account.
            </div>
            {absenceMsg ? <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{absenceMsg}</div> : null}
            <textarea value={absenceReason} onChange={(e) => setAbsenceReason(e.target.value)} rows={4} disabled={absenceBusy} placeholder="Explain why you missed your attendance..." className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50" />
            <div className="mt-4 flex gap-3">
              <button disabled={absenceBusy || !absenceReason.trim()} onClick={handleSubmitAbsenceReason} className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{absenceBusy ? "Submitting..." : "Submit Reason"}</button>
              <button disabled={absenceBusy} onClick={handleDismissAbsenceWarning} className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60">{absenceBusy ? "..." : "Dismiss (will block)"}</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 overflow-hidden rounded-2xl bg-linear-to-r from-sky-600 via-blue-600 to-indigo-500 p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
              <p className="mt-1 text-sm text-white/80">
                {profile?.fullName ? profile.fullName : user?.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <button
                onClick={async () => {
                  setShowNotifPanel((p) => !p);
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

        {/* Notification Panel */}
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
                <button onClick={() => setShowNotifPanel(false)} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">Close</button>
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
                        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
                        setUnreadCount((c) => Math.max(0, c - 1));
                      }
                    }}
                    className={["cursor-pointer rounded-xl border px-4 py-3 transition", n.read ? "border-slate-100 bg-slate-50" : "border-indigo-200 bg-indigo-50"].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900">{n.title || "Notification"}</div>
                      {!n.read && <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{n.body || ""}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : ""}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Holiday Banner or Daily Motivational Quote */}
        {holidayName ? (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-linear-to-r from-amber-50 to-yellow-50 px-5 py-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-2xl">🎉</div>
              <div>
                <div className="text-lg font-bold text-amber-700">Today is a Public Holiday!</div>
                <div className="mt-1 text-base font-semibold text-amber-800">{holidayName}</div>
                <div className="mt-1 text-sm text-amber-700">Enjoy your day off!</div>
              </div>
            </div>
          </div>
        ) : dailyQuote ? (
          <div className="mb-6 rounded-2xl border border-indigo-200 bg-linear-to-r from-indigo-50 to-purple-50 px-5 py-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl">✨</div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-indigo-600">{dailyQuote.greeting}</div>
                <p className="mt-2 text-sm font-medium italic text-slate-800">"{dailyQuote.quote}"</p>
                <p className="mt-1 text-xs text-slate-500">— {dailyQuote.author}</p>
                <p className="mt-2 text-xs text-indigo-600">Have a wonderful and productive day! 💪</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Rejected banner */}
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
          <div className="rounded-2xl border border-sky-200 bg-linear-to-br from-sky-50 to-blue-50 p-6 shadow-sm border-l-4 border-l-sky-400">
            <h2 className="text-base font-semibold text-sky-900">Today</h2>
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
                className="mt-3 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
              >
                {busy ? "Submitting..." : submitLabel}
              </button>

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

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Profile */}
          <div className="rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-teal-50 p-6 shadow-sm border-l-4 border-l-emerald-400">
            <h2 className="text-base font-semibold text-emerald-900">Profile</h2>

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
          <div className="rounded-2xl border border-amber-200 bg-linear-to-br from-amber-50 to-orange-50 p-6 shadow-sm border-l-4 border-l-amber-400">
            <h2 className="text-base font-semibold text-amber-900">
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

      </div>
    </div>
  );
}
